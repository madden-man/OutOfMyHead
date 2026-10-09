import { nanoid } from "nanoid";
import { db } from "../db/db";
import { buildDrawContext } from "../domain/drawContext";
import { computeWeights, drawExperiment, rerollExperiment, type DrawContext } from "../domain/draw";
import { checkAttachmentFile } from "../domain/attachments";
import { sessionOrigin } from "../domain/origin";
import { clampFloor, withSeason } from "../domain/seasons";
import { nextRoster } from "../domain/verdict";
import {
  DEFAULT_SETTINGS,
  DEFAULT_TRIAL_LENGTH,
  MAX_ACTIVE,
  MIN_ACTIVE,
  type Attachment,
  type Draw,
  type Experiment,
  type Pull,
  type Stream,
  type Season,
  type Session,
  type Settings,
  type Trial,
  type Verdict,
} from "../domain/types";
import { now, today } from "../lib/clock";
import { rng } from "../lib/random";

export async function getActiveTrial(): Promise<Trial | undefined> {
  return db.trials.where("status").equals("active").first();
}

/** Onboarding: open trial 1 with 2 to 4 experiments starting today. */
export async function startFirstTrial(experimentIds: string[]): Promise<Trial> {
  if (experimentIds.length < MIN_ACTIVE || experimentIds.length > MAX_ACTIVE) {
    throw new Error(`A trial needs ${MIN_ACTIVE} to ${MAX_ACTIVE} experiments`);
  }
  return db.transaction("rw", db.trials, db.settings, async () => {
    const existing = await getActiveTrial();
    if (existing) return existing;
    const count = await db.trials.count();
    const trial: Trial = {
      id: nanoid(),
      number: count + 1,
      startDate: today(),
      lengthDays: DEFAULT_TRIAL_LENGTH,
      experimentIds: [...experimentIds],
      status: "active",
    };
    await db.trials.add(trial);
    const settings = (await db.settings.get("settings")) ?? DEFAULT_SETTINGS;
    await db.settings.put({ ...settings, onboarded: true });
    return trial;
  });
}

/** The draw context for `date` from stored rows. Call inside a transaction over those tables. */
async function drawContextFor(trial: Trial, date: string): Promise<DrawContext> {
  const [experiments, draws, sessions, settings] = await Promise.all([
    db.experiments.bulkGet(trial.experimentIds),
    db.draws.where("trialId").equals(trial.id).toArray(),
    db.sessions.where("trialId").equals(trial.id).toArray(),
    db.settings.get("settings"),
  ]);
  return buildDrawContext({
    trial,
    experiments: experiments.filter((e) => e !== undefined),
    draws,
    sessions,
    settings: settings ?? DEFAULT_SETTINGS,
    today: date,
  });
}

/**
 * The draw locks per calendar day per trial. If today has a draw, return it.
 * Otherwise compute one and store it. Transactional, so a double call is safe.
 */
export async function ensureTodayDraw(trialId: string): Promise<Draw | undefined> {
  const date = today();
  return db.transaction("rw", [db.draws, db.trials, db.sessions, db.experiments, db.settings], async () => {
    const existing = await db.draws.where({ trialId, date }).first();
    if (existing) return existing;
    const trial = await db.trials.get(trialId);
    if (!trial || trial.status !== "active") return undefined;
    const result = drawExperiment(await drawContextFor(trial, date), rng);
    if (!result) return undefined;
    const draw: Draw = { id: nanoid(), trialId, date, experimentId: result.experimentId, weights: result.weights };
    await db.draws.add(draw);
    return draw;
  });
}

/** Pass: skip the draw and pick another active experiment. Weights do not change. */
export async function passTo(drawId: string, experimentId: string): Promise<void> {
  await db.transaction("rw", db.draws, async () => {
    const draw = await db.draws.get(drawId);
    if (!draw || draw.passedTo || draw.experimentId === experimentId) return;
    await db.draws.update(drawId, { passedTo: experimentId });
  });
}

/**
 * Reroll once per day, from the remaining experiments. Not a pass. The pool is
 * the trial as it stands now: an experiment removed since the draw is out, and
 * one added since the draw comes in at the weight it would have had this
 * morning. The stored weights are updated to match, so "Why this one" agrees.
 */
export async function rerollDraw(drawId: string): Promise<void> {
  await db.transaction("rw", [db.draws, db.trials, db.sessions, db.experiments, db.settings], async () => {
    const draw = await db.draws.get(drawId);
    if (!draw || draw.rerolledFrom || draw.passedTo) return;
    const trial = await db.trials.get(draw.trialId);
    if (!trial || trial.status !== "active") return;
    const missing = trial.experimentIds.some((id) => draw.weights[id] === undefined);
    const fresh = missing ? computeWeights(await drawContextFor(trial, draw.date)) : {};
    const weights: Record<string, number> = {};
    for (const id of trial.experimentIds) {
      const w = draw.weights[id] ?? fresh[id];
      if (w !== undefined) weights[id] = w;
    }
    const next = rerollExperiment(weights, draw.experimentId, rng);
    if (!next) return;
    await db.draws.update(drawId, { experimentId: next, rerolledFrom: draw.experimentId, weights });
  });
}

export interface SessionInput {
  experimentId: string;
  minutes: number;
  pull: Pull;
  thoughtAboutIt: boolean;
  nextNote: string;
  startedAt?: string;
  snippet?: string;
  /** One image or audio file. Checked against the size limit before it is stored. */
  file?: Blob & { name?: string };
}

/** Log a session for today. The origin is derived from today's draw. */
export async function logSession(input: SessionInput): Promise<Session> {
  const date = today();
  return db.transaction("rw", [db.sessions, db.draws, db.trials], async () => {
    const trial = await getActiveTrial();
    if (!trial) throw new Error("No active trial");
    const draw = await db.draws.where({ trialId: trial.id, date }).first();
    const sessionsToday = await db.sessions.where({ trialId: trial.id, date }).toArray();
    const minutes = Math.max(0, Math.round(input.minutes));
    const session: Session = {
      id: nanoid(),
      trialId: trial.id,
      experimentId: input.experimentId,
      date,
      startedAt: input.startedAt ?? new Date(now().getTime() - minutes * 60_000).toISOString(),
      minutes,
      pull: input.pull,
      thoughtAboutIt: input.thoughtAboutIt,
      origin: sessionOrigin(draw, input.experimentId, sessionsToday),
      nextNote: input.nextNote.trim(),
    };
    const snippet = input.snippet?.trim();
    if (input.file) {
      const check = checkAttachmentFile(input.file);
      if (!check.ok) throw new Error(check.message);
      const attachment: Attachment = { kind: check.kind, blob: input.file, mime: check.mime };
      if (input.file.name) attachment.name = input.file.name;
      if (snippet) attachment.text = snippet;
      session.attachment = attachment;
    } else if (snippet) {
      session.attachment = { kind: "text", text: snippet };
    }
    await db.sessions.add(session);
    return session;
  });
}

export type TrialChange = { ok: true } | { ok: false; reason: "full" | "minimum" | "no-trial" };

export async function addToTrial(experimentId: string): Promise<TrialChange> {
  return db.transaction("rw", db.trials, async () => {
    const trial = await getActiveTrial();
    if (!trial) return { ok: false, reason: "no-trial" } as const;
    if (trial.experimentIds.includes(experimentId)) return { ok: true } as const;
    if (trial.experimentIds.length >= MAX_ACTIVE) return { ok: false, reason: "full" } as const;
    await db.trials.update(trial.id, { experimentIds: [...trial.experimentIds, experimentId] });
    return { ok: true } as const;
  });
}

/**
 * Remove an experiment from the active trial. If today's draw pointed at it,
 * today's draw is cleared so a fresh one is drawn from what remains.
 */
export async function removeFromTrial(experimentId: string): Promise<TrialChange> {
  return db.transaction("rw", db.trials, db.draws, async () => {
    const trial = await getActiveTrial();
    if (!trial) return { ok: false, reason: "no-trial" } as const;
    if (!trial.experimentIds.includes(experimentId)) return { ok: true } as const;
    if (trial.experimentIds.length <= MIN_ACTIVE) return { ok: false, reason: "minimum" } as const;
    await db.trials.update(trial.id, { experimentIds: trial.experimentIds.filter((id) => id !== experimentId) });
    const draw = await db.draws.where({ trialId: trial.id, date: today() }).first();
    if (draw && (draw.experimentId === experimentId || draw.passedTo === experimentId)) {
      await db.draws.delete(draw.id);
    }
    return { ok: true } as const;
  });
}

async function readSettings(): Promise<Settings> {
  const settings = await db.settings.get("settings");
  return settings ?? { ...DEFAULT_SETTINGS, floorPerWeek: { ...DEFAULT_SETTINGS.floorPerWeek } };
}

/**
 * Switch the season from today on. Today's draw is already locked and stays;
 * the new season shapes tomorrow's draw.
 */
export async function setSeason(season: Season): Promise<void> {
  await db.transaction("rw", db.settings, async () => {
    const settings = await readSettings();
    await db.settings.put(withSeason(settings, season, today()));
  });
}

/** Set the weekly floor for one season, kept to 0 through 7. */
export async function setFloor(season: Season, floor: number): Promise<void> {
  await db.transaction("rw", db.settings, async () => {
    const settings = await readSettings();
    await db.settings.put({ ...settings, floorPerWeek: { ...settings.floorPerWeek, [season]: clampFloor(floor) } });
  });
}

/** Set or clear the single daily nudge time ("HH:MM"). */
export async function setNudgeTime(time: string | undefined): Promise<void> {
  await db.transaction("rw", db.settings, async () => {
    const settings = await readSettings();
    const next: Settings = { ...settings };
    if (time) next.nudgeTime = time;
    else delete next.nudgeTime;
    await db.settings.put(next);
  });
}

export interface CloseTrialInput {
  verdicts: Record<string, Verdict>;
  /** For each cut experiment, the library experiment that takes its place. */
  replacements: Record<string, string>;
}

/**
 * Close the active trial with a verdict per experiment and open the next one
 * starting today. Keep and extend carry over; each cut is swapped for its
 * replacement, so the next trial has as many experiments as this one.
 */
export async function closeTrial(input: CloseTrialInput): Promise<Trial> {
  return db.transaction("rw", db.trials, async () => {
    const trial = await getActiveTrial();
    if (!trial) throw new Error("No active trial");
    const roster = nextRoster(trial.experimentIds, input.verdicts, input.replacements);
    if (!roster.ok) throw new Error(`Cannot close trial: ${roster.reason}`);

    const verdicts: Record<string, Verdict> = {};
    const replacements: Record<string, string> = {};
    for (const id of trial.experimentIds) {
      const verdict = input.verdicts[id];
      if (verdict) verdicts[id] = verdict;
      const replacement = input.replacements[id];
      if (verdict === "cut" && replacement) replacements[id] = replacement;
    }
    const closed: Partial<Trial> = { status: "closed", verdicts, closedAt: now().toISOString() };
    if (Object.keys(replacements).length > 0) closed.replacements = replacements;
    await db.trials.update(trial.id, closed);

    const next: Trial = {
      id: nanoid(),
      number: trial.number + 1,
      startDate: today(),
      lengthDays: DEFAULT_TRIAL_LENGTH,
      experimentIds: roster.experimentIds,
      status: "active",
    };
    await db.trials.add(next);
    return next;
  });
}

export interface NewExperiment {
  name: string;
  stream: Stream;
  do: string;
  tests: string;
  unit: string;
  portable: boolean;
}

/** A user-authored experiment. It joins the library, not the trial. */
export async function createExperiment(input: NewExperiment): Promise<Experiment> {
  const name = input.name.trim();
  if (!name) throw new Error("A custom experiment needs a name");
  const experiment: Experiment = {
    id: nanoid(),
    stream: input.stream,
    name,
    do: input.do.trim(),
    tests: input.tests.trim(),
    unit: input.unit.trim(),
    portable: input.portable,
    custom: true,
    archived: false,
  };
  await db.experiments.add(experiment);
  return experiment;
}

export type ArchiveResult = { ok: true } | { ok: false; reason: "in-trial" };

/** Hide an experiment from the library, or bring it back. One in the active trial stays visible. */
export async function setArchived(experimentId: string, archived: boolean): Promise<ArchiveResult> {
  return db.transaction("rw", db.experiments, db.trials, async () => {
    if (archived) {
      const trial = await getActiveTrial();
      if (trial?.experimentIds.includes(experimentId)) return { ok: false, reason: "in-trial" } as const;
    }
    await db.experiments.update(experimentId, { archived });
    return { ok: true } as const;
  });
}

/** Whether any trial, past or present, refers to the experiment. */
export function trialReferences(trials: readonly Trial[], experimentId: string): boolean {
  return trials.some(
    (t) =>
      t.experimentIds.includes(experimentId) ||
      Object.values(t.replacements ?? {}).includes(experimentId) ||
      experimentId in (t.verdicts ?? {}),
  );
}

export type DeleteResult = { ok: true } | { ok: false; reason: "seed" | "referenced" };

/**
 * Delete a custom experiment that no trial refers to and no session uses.
 * Seed experiments and anything with history can only be archived.
 */
export async function deleteExperiment(experimentId: string): Promise<DeleteResult> {
  return db.transaction("rw", db.experiments, db.trials, db.sessions, async () => {
    const experiment = await db.experiments.get(experimentId);
    if (!experiment) return { ok: true } as const;
    if (!experiment.custom) return { ok: false, reason: "seed" } as const;
    const trials = await db.trials.toArray();
    const used = (await db.sessions.where("experimentId").equals(experimentId).count()) > 0;
    if (used || trialReferences(trials, experimentId)) return { ok: false, reason: "referenced" } as const;
    await db.experiments.delete(experimentId);
    return { ok: true } as const;
  });
}

/** Every localStorage key the app writes starts with this, so reset can find them all. */
export const STORAGE_PREFIX = "oomh.";

/**
 * Delete the whole local database and the app's localStorage keys (the
 * nudge's last-fired date). The caller reloads to land on onboarding.
 */
export async function resetAllData(): Promise<void> {
  // Keep auto-open so live queries see an empty store until the reload.
  await db.delete({ disableAutoOpen: false });
  try {
    const keys = Array.from({ length: window.localStorage.length }, (_, i) => window.localStorage.key(i));
    for (const key of keys) if (key?.startsWith(STORAGE_PREFIX)) window.localStorage.removeItem(key);
  } catch {
    // Storage can be blocked; there is nothing stored to clear then.
  }
}

import { nanoid } from "nanoid";
import { db } from "../db/db";
import { buildDrawContext } from "../domain/drawContext";
import { drawExperiment, rerollExperiment } from "../domain/draw";
import { sessionOrigin } from "../domain/origin";
import {
  DEFAULT_SETTINGS,
  DEFAULT_TRIAL_LENGTH,
  MAX_ACTIVE,
  MIN_ACTIVE,
  type Attachment,
  type Draw,
  type Pull,
  type Session,
  type Trial,
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
    const [experiments, draws, sessions, settings] = await Promise.all([
      db.experiments.bulkGet(trial.experimentIds),
      db.draws.where("trialId").equals(trialId).toArray(),
      db.sessions.where("trialId").equals(trialId).toArray(),
      db.settings.get("settings"),
    ]);
    const ctx = buildDrawContext({
      trial,
      experiments: experiments.filter((e) => e !== undefined),
      draws,
      sessions,
      settings: settings ?? DEFAULT_SETTINGS,
      today: date,
    });
    const result = drawExperiment(ctx, rng);
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

/** Reroll once per day, from the remaining experiments. Not a pass. */
export async function rerollDraw(drawId: string): Promise<void> {
  await db.transaction("rw", db.draws, async () => {
    const draw = await db.draws.get(drawId);
    if (!draw || draw.rerolledFrom || draw.passedTo) return;
    const next = rerollExperiment(draw.weights, draw.experimentId, rng);
    if (!next) return;
    await db.draws.update(drawId, { experimentId: next, rerolledFrom: draw.experimentId });
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
    if (snippet) {
      const attachment: Attachment = { kind: "text", text: snippet };
      session.attachment = attachment;
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

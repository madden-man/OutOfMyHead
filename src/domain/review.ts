import { toLocalISODate } from "./dates";
import { compareSessionsNewestFirst } from "./notes";
import type { Experiment, Session, Trial } from "./types";

/**
 * The date a trial's numbers are read as of. An active trial reads as of
 * today. A closed trial reads as of the day it closed, so weeks after it
 * never count.
 */
export function reviewAsOf(trial: Pick<Trial, "status" | "closedAt">, today: string): string {
  if (trial.status === "closed" && trial.closedAt) {
    const closed = toLocalISODate(new Date(trial.closedAt));
    return closed < today ? closed : today;
  }
  return today;
}

/**
 * The experiments a trial covers: its roster in order, then any experiment
 * that has sessions in the trial but left the roster (removed in the Library).
 */
export function trialExperiments(
  trial: Pick<Trial, "id" | "experimentIds">,
  experimentsById: ReadonlyMap<string, Experiment>,
  sessions: readonly Session[],
): Experiment[] {
  const ids = [...trial.experimentIds];
  for (const s of sessions) if (s.trialId === trial.id && !ids.includes(s.experimentId)) ids.push(s.experimentId);
  return ids.map((id) => experimentsById.get(id)).filter((e): e is Experiment => e !== undefined);
}

/** Trials newest first, for the Review selector. */
export function trialsNewestFirst<T extends Pick<Trial, "number">>(trials: readonly T[]): T[] {
  return [...trials].sort((a, b) => b.number - a.number);
}

/** Every session in the trial that has an attachment, newest first. */
export function trialWork(sessions: readonly Session[], trialId: string): Session[] {
  return sessions.filter((s) => s.trialId === trialId && s.attachment).sort(compareSessionsNewestFirst);
}

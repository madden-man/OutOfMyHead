import { clearedWeek, trialWeeks, weekPhase } from "./floor";
import type { Draw, Session, Settings, Trial } from "./types";

// Per-experiment numbers for one trial. Used by the verdict flow and by Review.

export interface ExperimentStats {
  sessions: number;
  minutes: number;
  /** Mean pull, 1 to 5, or null with no sessions. */
  averagePull: number | null;
  unprompted: number;
  /** Share of sessions where the user had thought about it since last time, 0 to 1, or null. */
  thoughtAboutItRate: number | null;
  /** Days the draw landed on this experiment and the user passed to another. */
  passes: number;
  daysDrawn: number;
  /** Weeks so far (completed or current) where the experiment cleared a floor above 0. */
  floorWeeksCleared: number;
}

export interface StatsInput {
  trial: Pick<Trial, "id" | "startDate" | "lengthDays">;
  sessions: readonly Session[];
  draws: readonly Draw[];
  settings: Settings;
  today: string;
}

export function experimentStats(input: StatsInput & { experiment: { id: string; portable: boolean } }): ExperimentStats {
  const { trial, sessions, draws, settings, today, experiment } = input;
  const mine = sessions.filter((s) => s.trialId === trial.id && s.experimentId === experiment.id);
  const drawn = draws.filter((d) => d.trialId === trial.id && d.experimentId === experiment.id);
  const n = mine.length;
  const weeks = trialWeeks(trial, today).filter((w) => weekPhase(w, today) !== "future");
  return {
    sessions: n,
    minutes: mine.reduce((sum, s) => sum + s.minutes, 0),
    averagePull: n === 0 ? null : round(mine.reduce((sum, s) => sum + s.pull, 0) / n, 2),
    unprompted: mine.filter((s) => s.origin === "unprompted").length,
    thoughtAboutItRate: n === 0 ? null : round(mine.filter((s) => s.thoughtAboutIt).length / n, 3),
    passes: drawn.filter((d) => d.passedTo !== undefined && d.passedTo !== experiment.id).length,
    daysDrawn: drawn.length,
    floorWeeksCleared: weeks.filter((week) => clearedWeek({ trial, sessions, settings, today, experiment, week }))
      .length,
  };
}

/** Stats for every experiment in a trial, keyed by experiment id. */
export function trialStats(
  input: StatsInput & { experiments: readonly { id: string; portable: boolean }[] },
): Record<string, ExperimentStats> {
  const out: Record<string, ExperimentStats> = {};
  for (const experiment of input.experiments) out[experiment.id] = experimentStats({ ...input, experiment });
  return out;
}

export function formatPull(pull: number | null): string {
  return pull === null ? "None yet" : pull.toFixed(1);
}

export function formatRate(rate: number | null): string {
  return rate === null ? "None yet" : `${Math.round(rate * 100)}%`;
}

function round(n: number, places: number): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { nextNotes } from "../domain/notes";
import type { Draw, Experiment, Session, Settings, Trial } from "../domain/types";

export interface AppState {
  settings: Settings | undefined;
  experiments: Experiment[];
  experimentsById: Map<string, Experiment>;
  trial: Trial | undefined;
  /** Every trial, oldest first. */
  trials: Trial[];
  /** Draws for the active trial. */
  draws: Draw[];
  /** Draws for every trial, for Review and export. */
  allDraws: Draw[];
  sessions: Session[];
  notes: Record<string, string>;
}

async function load(): Promise<AppState> {
  const [settings, experiments, trials, sessions, allDraws] = await Promise.all([
    db.settings.get("settings"),
    db.experiments.toArray(),
    db.trials.orderBy("number").toArray(),
    db.sessions.toArray(),
    db.draws.toArray(),
  ]);
  const trial = trials.find((t) => t.status === "active");
  const draws = trial ? allDraws.filter((d) => d.trialId === trial.id) : [];
  experiments.sort((a, b) => (a.seedId ?? 1e9) - (b.seedId ?? 1e9) || a.name.localeCompare(b.name));
  return {
    settings,
    experiments,
    experimentsById: new Map(experiments.map((e) => [e.id, e])),
    trial,
    trials,
    draws,
    allDraws,
    sessions,
    notes: nextNotes(sessions),
  };
}

/** One live view over the whole local store. The data set is small by design. */
export function useAppStore(): AppState | undefined {
  return useLiveQuery(load, []);
}

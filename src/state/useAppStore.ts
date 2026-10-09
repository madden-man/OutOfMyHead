import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { nextNotes } from "../domain/notes";
import type { Draw, Experiment, Session, Settings, Trial } from "../domain/types";

export interface AppState {
  settings: Settings | undefined;
  experiments: Experiment[];
  experimentsById: Map<string, Experiment>;
  trial: Trial | undefined;
  draws: Draw[];
  sessions: Session[];
  notes: Record<string, string>;
}

async function load(): Promise<AppState> {
  const [settings, experiments, trial, sessions] = await Promise.all([
    db.settings.get("settings"),
    db.experiments.toArray(),
    db.trials.where("status").equals("active").first(),
    db.sessions.toArray(),
  ]);
  const draws = trial ? await db.draws.where("trialId").equals(trial.id).toArray() : [];
  experiments.sort((a, b) => (a.seedId ?? 1e9) - (b.seedId ?? 1e9) || a.name.localeCompare(b.name));
  return {
    settings,
    experiments,
    experimentsById: new Map(experiments.map((e) => [e.id, e])),
    trial,
    draws,
    sessions,
    notes: nextNotes(sessions),
  };
}

/** One live view over the whole local store. The data set is small by design. */
export function useAppStore(): AppState | undefined {
  return useLiveQuery(load, []);
}

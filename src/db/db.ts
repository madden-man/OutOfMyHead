import { Dexie, type EntityTable } from "dexie";
import type { Draw, Experiment, Session, Settings, Trial } from "../domain/types";

export class OutOfMyHeadDB extends Dexie {
  experiments!: EntityTable<Experiment, "id">;
  trials!: EntityTable<Trial, "id">;
  draws!: EntityTable<Draw, "id">;
  sessions!: EntityTable<Session, "id">;
  settings!: EntityTable<Settings, "id">;

  constructor(name = "out-of-my-head") {
    super(name);
    this.version(1).stores({
      experiments: "id, seedId, stream, archived",
      trials: "id, number, status",
      draws: "id, trialId, date, &[trialId+date]",
      sessions: "id, trialId, experimentId, date, [trialId+date]",
      settings: "id",
    });
  }
}

export const db = new OutOfMyHeadDB();

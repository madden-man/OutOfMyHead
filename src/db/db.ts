import { Dexie, type EntityTable } from "dexie";
import type { Draw, Experiment, Session, Settings, Trial } from "../domain/types";
import { seedSources } from "./seedSources";

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
    // Version 2 keeps the seed's `source`. Rows imported by version 1 dropped
    // it, so fill it back in from the seed file by seedId.
    this.version(2)
      .stores({})
      .upgrade(async (tx) => {
        const sources = seedSources();
        await tx
          .table<Experiment, string>("experiments")
          .toCollection()
          .modify((e) => {
            const source = e.seedId === undefined ? undefined : sources.get(e.seedId);
            if (source && !e.source) e.source = source;
          });
      });
  }
}

export const db = new OutOfMyHeadDB();

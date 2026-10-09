import { nanoid } from "nanoid";
import seed from "../../seed/experiments.json";
import { DEFAULT_SETTINGS, type Experiment, type Stream } from "../domain/types";
import { db } from "./db";

interface SeedExperiment {
  id: number;
  stream: string;
  name: string;
  do: string;
  tests: string;
  unit: string;
  portable: boolean;
}

const STREAM_SET = new Set<string>(["writing", "piano", "production"]);

function isStream(value: string): value is Stream {
  return STREAM_SET.has(value);
}

/** Map the seed file to Experiment rows. Exported for tests. */
export function seedExperiments(): Experiment[] {
  return (seed as SeedExperiment[]).map((s) => {
    if (!isStream(s.stream)) throw new Error(`Seed ${s.id} has unknown stream ${s.stream}`);
    return {
      id: nanoid(),
      seedId: s.id,
      stream: s.stream,
      name: s.name,
      do: s.do,
      tests: s.tests,
      unit: s.unit,
      portable: s.portable,
      custom: false,
      archived: false,
    };
  });
}

/**
 * First run: load the seed library and default settings. Runs in one
 * transaction and checks for settings first, so calling it twice is safe.
 */
export async function ensureSeeded(): Promise<void> {
  await db.transaction("rw", db.settings, db.experiments, async () => {
    if (await db.settings.get("settings")) return;
    if ((await db.experiments.count()) === 0) await db.experiments.bulkAdd(seedExperiments());
    await db.settings.put({ ...DEFAULT_SETTINGS, floorPerWeek: { ...DEFAULT_SETTINGS.floorPerWeek } });
  });
}

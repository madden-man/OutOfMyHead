import seed from "../../seed/experiments.json";

/** The seed file's `source` per seedId. Used to backfill rows imported before it was kept. */
export function seedSources(): Map<number, string> {
  const map = new Map<number, string>();
  for (const s of seed as { id: number; source?: string }[]) if (s.source) map.set(s.id, s.source);
  return map;
}

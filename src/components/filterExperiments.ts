import type { Experiment } from "../domain/types";
import type { StreamChoice } from "./StreamFilter";

export function filterExperiments(
  experiments: readonly Experiment[],
  opts: { stream: StreamChoice; portableOnly: boolean; query: string },
): Experiment[] {
  const q = opts.query.trim().toLowerCase();
  return experiments.filter((e) => {
    if (e.archived) return false;
    if (opts.stream !== "all" && e.stream !== opts.stream) return false;
    if (opts.portableOnly && !e.portable) return false;
    if (!q) return true;
    return [e.name, e.do, e.tests, e.unit].some((t) => t.toLowerCase().includes(q));
  });
}

import { STREAMS, type Experiment, type Stream } from "../domain/types";
import type { StreamChoice } from "./StreamFilter";

export interface ExperimentFilter {
  stream: StreamChoice;
  portableOnly: boolean;
  query: string;
  /** Archived experiments are hidden unless this is on. */
  showArchived?: boolean;
}

export function filterExperiments(experiments: readonly Experiment[], opts: ExperimentFilter): Experiment[] {
  const q = opts.query.trim().toLowerCase();
  return experiments.filter((e) => {
    if (e.archived && !opts.showArchived) return false;
    if (opts.stream !== "all" && e.stream !== opts.stream) return false;
    if (opts.portableOnly && !e.portable) return false;
    if (!q) return true;
    return [e.name, e.do, e.tests, e.unit].some((t) => t.toLowerCase().includes(q));
  });
}

/** How many experiments each stream choice would show, with the other filters applied. */
export function streamCounts(
  experiments: readonly Experiment[],
  opts: Omit<ExperimentFilter, "stream">,
): Record<StreamChoice, number> {
  const matching = filterExperiments(experiments, { ...opts, stream: "all" });
  const counts = { all: matching.length } as Record<StreamChoice, number>;
  for (const s of STREAMS) counts[s as Stream] = matching.filter((e) => e.stream === s).length;
  return counts;
}

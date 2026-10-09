import type { Season } from "./types";

export interface DrawCandidate {
  id: string;
  portable: boolean;
}

export interface DrawContext {
  /** The trial's active experiments, in trial order. */
  experiments: DrawCandidate[];
  /**
   * Days of the trial already behind us (day 1 is 0). The fairness step uses
   * this as the number of draws that should have happened so far.
   */
  dayIndex: number;
  /** Experiment drawn yesterday, if any. */
  drawnYesterday?: string;
  /** Times each experiment has been drawn in this trial before today. */
  timesDrawn: Record<string, number>;
  /** Sessions logged per experiment in the current trial week, before today. */
  sessionsThisWeek: Record<string, number>;
  /** The floor for the current season, in sessions per experiment per week. */
  floorPerWeek: number;
  /**
   * This week's floor per experiment, when known. It follows the floor strip:
   * the lowest floor if the season changed mid-week, a short final week
   * scaled, a resting experiment at 0. Falls back to `floorPerWeek`.
   */
  weekFloors?: Record<string, number>;
  season: Season;
}

export type Rng = () => number;

export const YESTERDAY_FACTOR = 0.4;
export const FAIRNESS_FACTOR = 0.5;
export const FLOOR_BOOST = 1;

/**
 * Weights per experiment, per the spec:
 * 1. start at 1
 * 2. drawn yesterday: times 0.4
 * 3. fairness: add max(0, expected - timesDrawn) * 0.5
 * 4. behind the weekly floor: add 1
 * 5. travel and not portable: 0; all zero falls back to uniform
 * 6. newborn uses the same weights (the UI changes, not the math)
 */
export function computeWeights(ctx: DrawContext): Record<string, number> {
  const weights: Record<string, number> = {};
  const count = ctx.experiments.length;
  if (count === 0) return weights;
  const expected = ctx.dayIndex / count;

  for (const exp of ctx.experiments) {
    let w = 1;
    if (ctx.drawnYesterday === exp.id) w *= YESTERDAY_FACTOR;
    const deficit = expected - (ctx.timesDrawn[exp.id] ?? 0);
    w += Math.max(0, deficit) * FAIRNESS_FACTOR;
    const floor = ctx.weekFloors?.[exp.id] ?? ctx.floorPerWeek;
    if ((ctx.sessionsThisWeek[exp.id] ?? 0) < floor) w += FLOOR_BOOST;
    if (ctx.season === "travel" && !exp.portable) w = 0;
    weights[exp.id] = round(w);
  }

  if (Object.values(weights).every((w) => w === 0)) {
    for (const exp of ctx.experiments) weights[exp.id] = 1;
  }
  return weights;
}

/**
 * Weighted pick. `exclude` removes ids from the pool (used by reroll). If the
 * remaining weights are all zero the pick is uniform over what remains.
 * Returns undefined only when nothing remains.
 */
export function pickWeighted(
  weights: Record<string, number>,
  rng: Rng,
  exclude: readonly string[] = [],
): string | undefined {
  const pool = Object.entries(weights).filter(([id]) => !exclude.includes(id));
  if (pool.length === 0) return undefined;
  const total = pool.reduce((sum, [, w]) => sum + w, 0);
  const entries: [string, number][] = total > 0 ? pool : pool.map(([id]) => [id, 1]);
  const sum = total > 0 ? total : pool.length;

  let target = rng() * sum;
  for (const [id, w] of entries) {
    if (w <= 0) continue;
    if (target < w) return id;
    target -= w;
  }
  // Floating point can leave a sliver at the end; fall to the last positive entry.
  return [...entries].reverse().find(([, w]) => w > 0)?.[0];
}

export interface DrawResult {
  experimentId: string;
  weights: Record<string, number>;
}

/** Compute weights and draw one experiment. */
export function drawExperiment(ctx: DrawContext, rng: Rng): DrawResult | undefined {
  const weights = computeWeights(ctx);
  const experimentId = pickWeighted(weights, rng);
  return experimentId === undefined ? undefined : { experimentId, weights };
}

/** Reroll: draw again from the remaining experiments, using the same weights. */
export function rerollExperiment(
  weights: Record<string, number>,
  currentId: string,
  rng: Rng,
): string | undefined {
  return pickWeighted(weights, rng, [currentId]);
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

import { describe, expect, it } from "vitest";
import { computeWeights, drawExperiment, pickWeighted, rerollExperiment, type DrawContext } from "./draw";

const base = (overrides: Partial<DrawContext> = {}): DrawContext => ({
  experiments: [
    { id: "a", portable: true },
    { id: "b", portable: false },
    { id: "c", portable: false },
  ],
  dayIndex: 0,
  timesDrawn: {},
  sessionsThisWeek: { a: 5, b: 5, c: 5 },
  floorPerWeek: 2,
  season: "normal",
  ...overrides,
});

/** An rng that returns the given values in order. */
const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length] ?? 0;
};

describe("computeWeights", () => {
  it("starts every experiment at 1", () => {
    expect(computeWeights(base())).toEqual({ a: 1, b: 1, c: 1 });
  });

  it("multiplies yesterday's draw by 0.4", () => {
    expect(computeWeights(base({ drawnYesterday: "b" }))).toEqual({ a: 1, b: 0.4, c: 1 });
  });

  it("adds half the fairness deficit, never a negative", () => {
    // Six days behind us, three experiments: each should have 2 draws.
    const w = computeWeights(base({ dayIndex: 6, timesDrawn: { a: 4, b: 2, c: 0 } }));
    expect(w).toEqual({ a: 1, b: 1, c: 2 });
  });

  it("adds 1 when behind the weekly floor", () => {
    const w = computeWeights(base({ sessionsThisWeek: { a: 0, b: 1, c: 2 } }));
    expect(w).toEqual({ a: 2, b: 2, c: 1 });
  });

  it("never boosts for the floor when the floor is 0", () => {
    const w = computeWeights(base({ floorPerWeek: 0, sessionsThisWeek: {} }));
    expect(w).toEqual({ a: 1, b: 1, c: 1 });
  });

  it("uses each experiment's week floor over the season floor", () => {
    // Season floor 2, but this week a's floor is 1 (season changed) and b rests at 0.
    const w = computeWeights(base({ sessionsThisWeek: { a: 1, b: 0, c: 1 }, weekFloors: { a: 1, b: 0 } }));
    expect(w).toEqual({ a: 1, b: 1, c: 2 });
  });

  it("combines the steps in order", () => {
    // b: 1 * 0.4 + max(0, 1 - 0) * 0.5 + 1 = 1.9
    const w = computeWeights(
      base({ drawnYesterday: "b", dayIndex: 3, timesDrawn: { a: 2, b: 0, c: 1 }, sessionsThisWeek: { a: 3, c: 3 } }),
    );
    expect(w).toEqual({ a: 1, b: 1.9, c: 1 });
  });

  it("zero-weights non-portable experiments in travel season", () => {
    expect(computeWeights(base({ season: "travel" }))).toEqual({ a: 1, b: 0, c: 0 });
  });

  it("falls back to uniform when travel zeroes everything", () => {
    const w = computeWeights(
      base({
        season: "travel",
        experiments: [
          { id: "b", portable: false },
          { id: "c", portable: false },
        ],
      }),
    );
    expect(w).toEqual({ b: 1, c: 1 });
  });

  it("keeps the same weights in newborn season", () => {
    const ctx = base({ drawnYesterday: "a", dayIndex: 4, timesDrawn: { a: 3 } });
    expect(computeWeights({ ...ctx, season: "newborn" })).toEqual(computeWeights(ctx));
  });

  it("returns nothing for an empty trial", () => {
    expect(computeWeights(base({ experiments: [] }))).toEqual({});
  });
});

describe("computeWeights, spec checks", () => {
  it("adds a fractional fairness deficit", () => {
    // Four days behind, three experiments: expected 4/3 each.
    const w = computeWeights(base({ dayIndex: 4, timesDrawn: { a: 2, b: 1, c: 1 } }));
    expect(w).toEqual({ a: 1, b: 1.167, c: 1.167 });
  });

  it("counts a never-drawn experiment as fully behind", () => {
    const w = computeWeights(base({ dayIndex: 9, timesDrawn: { a: 5, b: 4 } }));
    // expected 3: a and b are ahead, c is 3 behind.
    expect(w).toEqual({ a: 1, b: 1, c: 2.5 });
  });

  it("boosts only below the floor, not at it", () => {
    const w = computeWeights(base({ floorPerWeek: 1, sessionsThisWeek: { a: 0, b: 1, c: 2 } }));
    expect(w).toEqual({ a: 2, b: 1, c: 1 });
  });

  it("applies the yesterday factor before the additive boosts", () => {
    const w = computeWeights(base({ drawnYesterday: "a", sessionsThisWeek: { b: 5, c: 5 } }));
    expect(w.a).toBe(1.4);
  });

  it("zero-weights non-portable experiments in travel even when they are behind", () => {
    const w = computeWeights(
      base({ season: "travel", dayIndex: 6, timesDrawn: { a: 6 }, sessionsThisWeek: {}, floorPerWeek: 1 }),
    );
    expect(w).toEqual({ a: 2, b: 0, c: 0 });
  });

  it("never draws a resting experiment in travel", () => {
    const ctx = base({ season: "travel" });
    for (const r of [0, 0.25, 0.5, 0.75, 0.999]) expect(drawExperiment(ctx, () => r)?.experimentId).toBe("a");
  });

  it("draws uniformly when travel zeroes everything", () => {
    const ctx = base({
      season: "travel",
      drawnYesterday: "b",
      experiments: [
        { id: "b", portable: false },
        { id: "c", portable: false },
      ],
    });
    expect(drawExperiment(ctx, () => 0.49)).toEqual({ experimentId: "b", weights: { b: 1, c: 1 } });
    expect(drawExperiment(ctx, () => 0.51)?.experimentId).toBe("c");
  });

  it("gives newborn the same weights with the same floor", () => {
    const ctx = base({ drawnYesterday: "c", dayIndex: 5, timesDrawn: { a: 1, c: 3 }, sessionsThisWeek: { a: 0 } });
    expect(computeWeights({ ...ctx, season: "newborn" })).toEqual(computeWeights(ctx));
    expect(computeWeights({ ...ctx, season: "newborn" })).toEqual({ a: 2.333, b: 2.833, c: 1.4 });
  });
});

describe("pickWeighted", () => {
  const weights = { a: 1, b: 2, c: 1 };

  it("walks the cumulative weights", () => {
    expect(pickWeighted(weights, () => 0)).toBe("a");
    expect(pickWeighted(weights, () => 0.24)).toBe("a");
    expect(pickWeighted(weights, () => 0.26)).toBe("b");
    expect(pickWeighted(weights, () => 0.74)).toBe("b");
    expect(pickWeighted(weights, () => 0.76)).toBe("c");
    expect(pickWeighted(weights, () => 0.999999)).toBe("c");
  });

  it("never picks a zero weight", () => {
    for (const r of [0, 0.3, 0.6, 0.99]) {
      expect(pickWeighted({ a: 0, b: 1, c: 0 }, () => r)).toBe("b");
    }
  });

  it("excludes ids and goes uniform when the rest are zero", () => {
    expect(pickWeighted({ a: 3, b: 0, c: 0 }, () => 0.9, ["a"])).toBe("c");
    expect(pickWeighted({ a: 1 }, () => 0.5, ["a"])).toBeUndefined();
  });

  it("matches the weights over many draws", () => {
    let x = 0;
    const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 4000; i++) {
      x = (i + 0.5) / 4000;
      const id = pickWeighted(weights, () => x);
      if (id) counts[id] = (counts[id] ?? 0) + 1;
    }
    expect(counts).toEqual({ a: 1000, b: 2000, c: 1000 });
  });
});

describe("drawExperiment and reroll", () => {
  it("draws with the injected rng and returns the weights used", () => {
    const result = drawExperiment(base({ drawnYesterday: "a" }), seq(0));
    expect(result).toEqual({ experimentId: "a", weights: { a: 0.4, b: 1, c: 1 } });
    expect(drawExperiment(base({ drawnYesterday: "a" }), seq(0.5))?.experimentId).toBe("b");
  });

  it("returns undefined with no experiments", () => {
    expect(drawExperiment(base({ experiments: [] }), seq(0))).toBeUndefined();
  });

  it("rerolls from the remaining experiments only", () => {
    const weights = { a: 1, b: 1, c: 1 };
    for (const r of [0, 0.4, 0.99]) {
      expect(rerollExperiment(weights, "a", () => r)).not.toBe("a");
    }
    expect(rerollExperiment({ a: 1, b: 1 }, "a", () => 0.7)).toBe("b");
  });
});

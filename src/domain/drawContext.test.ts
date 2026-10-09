import { describe, expect, it } from "vitest";
import { computeWeights } from "./draw";
import { buildDrawContext } from "./drawContext";
import { DEFAULT_SETTINGS, type Draw, type Experiment, type Session, type Trial } from "./types";

const exp = (id: string, portable = false): Experiment => ({
  id,
  stream: "writing",
  name: id,
  do: "",
  tests: "",
  unit: "",
  portable,
  custom: false,
  archived: false,
});

const trial: Trial = {
  id: "t1",
  number: 1,
  startDate: "2026-10-01",
  lengthDays: 21,
  experimentIds: ["a", "b"],
  status: "active",
};

const draw = (date: string, experimentId: string, trialId = "t1"): Draw => ({
  id: `${trialId}-${date}`,
  trialId,
  date,
  experimentId,
  weights: {},
});

const session = (date: string, experimentId: string): Session => ({
  id: `${date}-${experimentId}`,
  trialId: "t1",
  experimentId,
  date,
  startedAt: `${date}T10:00:00.000Z`,
  minutes: 10,
  pull: 3,
  thoughtAboutIt: false,
  origin: "drawn",
  nextNote: "",
});

describe("buildDrawContext", () => {
  it("collects history before today for the current trial week", () => {
    const ctx = buildDrawContext({
      trial,
      experiments: [exp("a", true), exp("b"), exp("z")],
      draws: [
        draw("2026-10-07", "a"),
        draw("2026-10-08", "b"),
        draw("2026-10-09", "b"),
        draw("2026-10-10", "a"), // today, ignored
        draw("2026-10-09", "a", "other-trial"),
      ],
      sessions: [
        session("2026-10-07", "a"), // week 1, ignored
        session("2026-10-08", "a"), // week 2 starts on day 8
        session("2026-10-09", "b"),
        session("2026-10-09", "b"),
        session("2026-10-10", "a"), // today, ignored
      ],
      settings: DEFAULT_SETTINGS,
      today: "2026-10-10",
    });
    expect(ctx).toEqual({
      experiments: [
        { id: "a", portable: true },
        { id: "b", portable: false },
      ],
      dayIndex: 9,
      drawnYesterday: "b",
      timesDrawn: { a: 1, b: 2 },
      sessionsThisWeek: { a: 1, b: 2 },
      floorPerWeek: 2,
      season: "normal",
      weekFloors: { a: 2, b: 2 },
    });
  });

  it("uses the floor for the current season and starts day 1 at index 0", () => {
    const ctx = buildDrawContext({
      trial,
      experiments: [exp("a"), exp("b")],
      draws: [],
      sessions: [],
      settings: { ...DEFAULT_SETTINGS, season: "travel" },
      today: "2026-10-01",
    });
    expect(ctx.dayIndex).toBe(0);
    expect(ctx.floorPerWeek).toBe(1);
    expect(ctx.drawnYesterday).toBeUndefined();
  });

  it("uses the week floor the strip shows: lowest season this week, resting at 0", () => {
    // Travel on day 8 (week 2 starts), back to normal on day 10, today is day 11.
    const settings = {
      ...DEFAULT_SETTINGS,
      floorPerWeek: { normal: 3, travel: 1, newborn: 0 },
      seasonLog: [
        { date: "0000-01-01", season: "normal" as const },
        { date: "2026-10-08", season: "travel" as const },
        { date: "2026-10-10", season: "normal" as const },
      ],
    };
    const ctx = buildDrawContext({
      trial,
      experiments: [exp("a", true), exp("b")],
      draws: [],
      sessions: [session("2026-10-08", "a")],
      settings,
      today: "2026-10-11",
    });
    expect(ctx.floorPerWeek).toBe(3);
    expect(ctx.weekFloors).toEqual({ a: 1, b: 0 });
    // a has 1 session against a week floor of 1, b is resting: neither gets the boost.
    const w = computeWeights(ctx);
    const fairness = (10 / 2) * 0.5;
    expect(w).toEqual({ a: 1 + fairness, b: 1 + fairness });
  });

  it("scales the floor for a short final week", () => {
    const short: Trial = { ...trial, lengthDays: 17 };
    const ctx = buildDrawContext({
      trial: short,
      experiments: [exp("a"), exp("b")],
      draws: [],
      sessions: [session("2026-10-15", "a")],
      settings: { ...DEFAULT_SETTINGS, floorPerWeek: { normal: 4, travel: 1, newborn: 0 } },
      today: "2026-10-16",
    });
    // Days 15 to 17 are a 3-day week: ceil(4 * 3 / 7) = 2.
    expect(ctx.weekFloors).toEqual({ a: 2, b: 2 });
    expect(ctx.sessionsThisWeek).toEqual({ a: 1 });
  });
});

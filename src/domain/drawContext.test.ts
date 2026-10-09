import { describe, expect, it } from "vitest";
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
});

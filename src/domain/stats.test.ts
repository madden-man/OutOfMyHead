import { describe, expect, it } from "vitest";
import { addDays } from "./dates";
import { experimentStats, formatPull, formatRate, trialStats } from "./stats";
import { DEFAULT_SETTINGS, type Draw, type Pull, type Session, type SessionOrigin, type Trial } from "./types";

const START = "2026-10-01";
const day = (n: number) => addDays(START, n - 1);
const trial: Trial = { id: "t1", number: 1, startDate: START, lengthDays: 21, experimentIds: ["a", "b"], status: "active" };
const A = { id: "a", portable: true };
const B = { id: "b", portable: false };

let n = 0;
const s = (d: number, experimentId: string, pull: Pull, thought: boolean, origin: SessionOrigin = "drawn", trialId = "t1"): Session => ({
  id: `s${n++}`,
  trialId,
  experimentId,
  date: day(d),
  startedAt: `${day(d)}T10:00:00.000Z`,
  minutes: 10,
  pull,
  thoughtAboutIt: thought,
  origin,
  nextNote: "",
});
const draw = (d: number, experimentId: string, passedTo?: string): Draw => ({
  id: `d${d}`,
  trialId: "t1",
  date: day(d),
  experimentId,
  weights: {},
  ...(passedTo ? { passedTo } : {}),
});

// Hand-computed fixture: a has 4 sessions in trial t1, pulls 5, 4, 2, 3, two
// thought about, one unprompted, one passed-to. Week 1: 3 sessions (cleared), week 2: 1.
const sessions = [
  s(1, "a", 5, true),
  s(2, "a", 4, false, "unprompted"),
  s(3, "a", 2, true, "passed-to"),
  s(9, "a", 3, false),
  s(1, "b", 1, false),
  s(2, "a", 5, true, "drawn", "other-trial"),
];
const draws = [draw(1, "a"), draw(2, "b", "a"), draw(3, "b", "a"), draw(8, "a", "b"), draw(9, "a")];

describe("experimentStats", () => {
  it("matches the hand-computed fixture", () => {
    const stats = experimentStats({ trial, sessions, draws, settings: DEFAULT_SETTINGS, today: day(15), experiment: A });
    expect(stats).toEqual({
      sessions: 4,
      minutes: 40,
      averagePull: 3.5,
      unprompted: 1,
      passedToSessions: 1,
      thoughtAboutItRate: 0.5,
      passes: 1,
      daysDrawn: 3,
      floorWeeksCleared: 1,
    });
  });

  it("counts passes away from the drawn experiment", () => {
    const stats = experimentStats({ trial, sessions, draws, settings: DEFAULT_SETTINGS, today: day(15), experiment: B });
    expect(stats.passes).toBe(2);
    expect(stats.sessions).toBe(1);
    expect(stats.floorWeeksCleared).toBe(0);
  });

  it("returns nulls with no sessions", () => {
    const stats = experimentStats({ trial, sessions: [], draws: [], settings: DEFAULT_SETTINGS, today: day(2), experiment: A });
    expect(stats.averagePull).toBeNull();
    expect(stats.thoughtAboutItRate).toBeNull();
    expect(formatPull(stats.averagePull)).toBe("None yet");
    expect(formatRate(stats.thoughtAboutItRate)).toBe("None yet");
  });

  it("counts the current week once it is cleared", () => {
    const stats = experimentStats({
      trial,
      sessions: [s(15, "a", 3, false), s(16, "a", 3, false)],
      draws: [],
      settings: DEFAULT_SETTINGS,
      today: day(16),
      experiment: A,
    });
    expect(stats.floorWeeksCleared).toBe(1);
  });

  it("does not count newborn weeks with no floor as cleared", () => {
    const stats = experimentStats({
      trial,
      sessions: [s(1, "a", 3, false)],
      draws: [],
      settings: { ...DEFAULT_SETTINGS, season: "newborn" },
      today: day(9),
      experiment: A,
    });
    expect(stats.floorWeeksCleared).toBe(0);
  });
});

describe("trialStats", () => {
  it("keys stats by experiment", () => {
    const all = trialStats({ trial, sessions, draws, settings: DEFAULT_SETTINGS, today: day(15), experiments: [A, B] });
    expect(Object.keys(all)).toEqual(["a", "b"]);
    expect(all.a?.sessions).toBe(4);
  });
});

describe("formatters", () => {
  it("formats pull and rate", () => {
    expect(formatPull(3.456)).toBe("3.5");
    expect(formatRate(0.666)).toBe("67%");
  });
});

describe("floor weeks cleared by roster", () => {
  const C = { id: "c", portable: true };
  const weighted = (d: number, ids: string[]): Draw => ({
    id: `w${d}`,
    trialId: "t1",
    date: day(d),
    experimentId: ids[0] ?? "a",
    weights: Object.fromEntries(ids.map((id) => [id, 1])),
  });

  it("keeps a removed experiment's past weeks in its history", () => {
    // c is in week 1, cleared it, then left the trial before week 2.
    const history = [
      ...[1, 2, 3, 4, 5, 6, 7].map((d) => weighted(d, ["a", "b", "c"])),
      ...[8, 9, 10, 11, 12, 13, 14].map((d) => weighted(d, ["a", "b"])),
    ];
    const cSessions = [s(1, "c", 4, true), s(2, "c", 3, false)];
    const stats = experimentStats({
      trial,
      sessions: cSessions,
      draws: history,
      settings: DEFAULT_SETTINGS,
      today: day(15),
      experiment: C,
    });
    expect(stats.floorWeeksCleared).toBe(1);
  });

  it("does not count weeks before an experiment joined", () => {
    // c joins in week 2. Sessions logged before then do not clear week 1 for it.
    const history = [
      ...[1, 2, 3, 4, 5, 6, 7].map((d) => weighted(d, ["a", "b"])),
      ...[8, 9, 10, 11, 12, 13, 14].map((d) => weighted(d, ["a", "b", "c"])),
    ];
    const cSessions = [s(1, "c", 4, true), s(2, "c", 3, false), s(8, "c", 3, false), s(9, "c", 3, false)];
    const stats = experimentStats({
      trial: { ...trial, experimentIds: ["a", "b", "c"] },
      sessions: cSessions,
      draws: history,
      settings: DEFAULT_SETTINGS,
      today: day(15),
      experiment: C,
    });
    expect(stats.floorWeeksCleared).toBe(1);
  });
});

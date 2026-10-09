import { describe, expect, it } from "vitest";
import { addDays } from "./dates";
import { clearedWeek, floorStrip, streakWeeks, trialWeeks, weekFloor, weekPill, type TrialWeek } from "./floor";
import { withSeason } from "./seasons";
import { DEFAULT_SETTINGS, type Session, type Settings, type Trial } from "./types";

const START = "2026-10-01";
const trial: Trial = {
  id: "t1",
  number: 1,
  startDate: START,
  lengthDays: 21,
  experimentIds: ["a", "b"],
  status: "active",
};
const A = { id: "a", portable: true };
const B = { id: "b", portable: false };
const day = (n: number) => addDays(START, n - 1);

/** Week `n` (1-based) of the trial as of `today`. */
const wk = (n: number, today = day(9), t: Pick<Trial, "startDate" | "lengthDays"> = trial): TrialWeek => {
  const w = trialWeeks(t, today)[n - 1];
  if (!w) throw new Error(`No week ${n}`);
  return w;
};

let seq = 0;
const s = (dayIndex: number, experimentId: string, trialId = "t1"): Session => ({
  id: `s${seq++}`,
  trialId,
  experimentId,
  date: day(dayIndex),
  startedAt: `${day(dayIndex)}T10:00:00.000Z`,
  minutes: 10,
  pull: 3,
  thoughtAboutIt: false,
  origin: "drawn",
  nextNote: "",
});

const settings = (overrides: Partial<Settings> = {}): Settings => ({
  ...DEFAULT_SETTINGS,
  floorPerWeek: { ...DEFAULT_SETTINGS.floorPerWeek },
  ...overrides,
});

describe("trialWeeks", () => {
  it("splits 21 days into three weeks", () => {
    const weeks = trialWeeks(trial, day(1));
    expect(weeks.map((w) => [w.firstDay, w.lastDay])).toEqual([
      [1, 7],
      [8, 14],
      [15, 21],
    ]);
    expect(weeks[1]).toMatchObject({ startDate: "2026-10-08", endDate: "2026-10-14", days: 7, planned: true });
  });

  it("ends a 24-day trial on a short week", () => {
    const weeks = trialWeeks({ startDate: START, lengthDays: 24 }, day(1));
    expect(weeks.map((w) => w.days)).toEqual([7, 7, 7, 3]);
  });

  it("adds full weeks while the trial runs past its length", () => {
    const weeks = trialWeeks(trial, day(23));
    expect(weeks).toHaveLength(4);
    expect(weeks[3]).toMatchObject({ firstDay: 22, lastDay: 28, planned: false });
  });
});

describe("weekFloor", () => {
  const w1 = wk(1, day(1));
  const w2 = wk(2, day(1));

  it("uses the season floor", () => {
    expect(weekFloor(settings(), w1, day(3), A)).toBe(2);
    expect(weekFloor(settings({ season: "travel" }), w1, day(3), A)).toBe(1);
    expect(weekFloor(settings({ season: "newborn" }), w1, day(3), A)).toBe(0);
  });

  it("takes the lowest floor when the season changed during the week", () => {
    const st = withSeason(settings(), "travel", day(10));
    expect(weekFloor(st, w1, day(12), A)).toBe(2);
    expect(weekFloor(st, w2, day(12), A)).toBe(1);
  });

  it("rests non-portable experiments in travel weeks", () => {
    expect(weekFloor(settings({ season: "travel" }), w1, day(3), B)).toBe(0);
  });

  it("scales the floor for a short final week", () => {
    expect(weekFloor(settings(), wk(4, day(23), { startDate: START, lengthDays: 24 }), day(23), A)).toBe(1);
  });
});

describe("weekPill", () => {
  const w1 = wk(1);
  const w2 = wk(2);
  const w3 = wk(3);

  it("shows cleared, with a bonus above the floor", () => {
    expect(weekPill({ week: w1, count: 2, floor: 2, today: day(9) })).toMatchObject({
      kind: "cleared",
      label: "Cleared",
      bonus: 0,
    });
    expect(weekPill({ week: w1, count: 4, floor: 2, today: day(9) })).toMatchObject({
      kind: "cleared",
      label: "Cleared +2",
      bonus: 2,
      description: "Week 1, cleared with 2 bonus sessions",
    });
  });

  it("shows progress in the current week", () => {
    expect(weekPill({ week: w2, count: 1, floor: 2, today: day(9) })).toMatchObject({
      kind: "progress",
      label: "1 of 2",
    });
  });

  it("leaves future weeks blank", () => {
    expect(weekPill({ week: w3, count: 0, floor: 2, today: day(9) })).toMatchObject({ kind: "future", label: "" });
  });

  it("shows a thin past week as sessions done, never as missed", () => {
    const pill = weekPill({ week: w1, count: 1, floor: 2, today: day(9) });
    expect(pill).toMatchObject({ kind: "done", label: "1 done" });
    expect(pill.description.toLowerCase()).not.toContain("miss");
  });

  it("shows n done when there is no floor", () => {
    expect(weekPill({ week: w2, count: 3, floor: 0, today: day(9) })).toMatchObject({
      kind: "done",
      label: "3 done",
    });
  });
});

describe("floorStrip", () => {
  it("counts this trial's sessions per week", () => {
    const sessions = [s(1, "a"), s(2, "a"), s(3, "a"), s(8, "a"), s(8, "b"), s(9, "a", "other")];
    const strip = floorStrip({ trial, sessions, settings: settings(), today: day(9), experiment: A });
    expect(strip.map((p) => p.label)).toEqual(["Cleared +1", "1 of 2", ""]);
  });

  it("shows n done in newborn season", () => {
    const strip = floorStrip({
      trial,
      sessions: [s(1, "a")],
      settings: settings({ season: "newborn" }),
      today: day(2),
      experiment: A,
    });
    expect(strip[0]?.label).toBe("1 done");
  });
});

describe("clearedWeek", () => {
  it("needs a floor above 0", () => {
    const input = { trial, sessions: [s(1, "a")], today: day(9), experiment: A, week: wk(1) };
    expect(clearedWeek({ ...input, settings: settings() })).toBe(false);
    expect(clearedWeek({ ...input, settings: settings({ season: "travel" }) })).toBe(true);
    expect(clearedWeek({ ...input, settings: settings({ season: "newborn" }) })).toBe(false);
  });
});

describe("streakWeeks", () => {
  const both = (days: number[]) => days.flatMap((d) => [s(d, "a"), s(d, "b")]);

  it("counts consecutive completed weeks where every experiment cleared", () => {
    const sessions = both([1, 2, 8, 9]);
    expect(streakWeeks({ trial, sessions, settings: settings(), today: day(15), experiments: [A, B] })).toBe(2);
  });

  it("does not count the week in progress", () => {
    const sessions = both([1, 2, 8, 9, 15, 16]);
    expect(streakWeeks({ trial, sessions, settings: settings(), today: day(17), experiments: [A, B] })).toBe(2);
  });

  it("stops at the most recent week that did not clear", () => {
    const sessions = [...both([1, 2, 15, 16]), s(8, "a"), s(9, "a")];
    expect(streakWeeks({ trial, sessions, settings: settings(), today: day(22), experiments: [A, B] })).toBe(1);
  });

  it("treats newborn weeks as neutral", () => {
    // Week 1 cleared, week 2 newborn with nothing logged, week 3 cleared.
    let st = withSeason(settings(), "newborn", day(8));
    st = withSeason(st, "normal", day(15));
    const sessions = both([1, 2, 15, 16]);
    expect(streakWeeks({ trial, sessions, settings: st, today: day(22), experiments: [A, B] })).toBe(2);
  });

  it("is 0 with no completed weeks", () => {
    expect(streakWeeks({ trial, sessions: both([1, 2]), settings: settings(), today: day(5), experiments: [A, B] })).toBe(0);
  });
});

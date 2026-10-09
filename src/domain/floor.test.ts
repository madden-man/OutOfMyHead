import { describe, expect, it } from "vitest";
import { addDays } from "./dates";
import { clearedWeek, floorStrip, streakWeeks, trialWeeks, weekFloor, weekPill, weekRoster, type TrialWeek } from "./floor";
import { withSeason } from "./seasons";
import { DEFAULT_SETTINGS, type Draw, type Session, type Settings, type Trial } from "./types";

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
    const strip = floorStrip({ trial, draws: [], sessions, settings: settings(), today: day(9), experiment: A });
    expect(strip.map((p) => p.label)).toEqual(["Cleared +1", "1 of 2", ""]);
  });

  it("shows n done in newborn season", () => {
    const strip = floorStrip({
      trial,
      draws: [],
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
    const input = { trial, draws: [], sessions: [s(1, "a")], today: day(9), experiment: A, week: wk(1) };
    expect(clearedWeek({ ...input, settings: settings() })).toBe(false);
    expect(clearedWeek({ ...input, settings: settings({ season: "travel" }) })).toBe(true);
    expect(clearedWeek({ ...input, settings: settings({ season: "newborn" }) })).toBe(false);
  });
});

describe("streakWeeks", () => {
  const both = (days: number[]) => days.flatMap((d) => [s(d, "a"), s(d, "b")]);

  it("counts consecutive completed weeks where every experiment cleared", () => {
    const sessions = both([1, 2, 8, 9]);
    expect(streakWeeks({ trial, draws: [], sessions, settings: settings(), today: day(15), experiments: [A, B] })).toBe(2);
  });

  it("does not count the week in progress", () => {
    const sessions = both([1, 2, 8, 9, 15, 16]);
    expect(streakWeeks({ trial, draws: [], sessions, settings: settings(), today: day(17), experiments: [A, B] })).toBe(2);
  });

  it("stops at the most recent week that did not clear", () => {
    const sessions = [...both([1, 2, 15, 16]), s(8, "a"), s(9, "a")];
    expect(streakWeeks({ trial, draws: [], sessions, settings: settings(), today: day(22), experiments: [A, B] })).toBe(1);
  });

  it("treats newborn weeks as neutral", () => {
    // Week 1 cleared, week 2 newborn with nothing logged, week 3 cleared.
    let st = withSeason(settings(), "newborn", day(8));
    st = withSeason(st, "normal", day(15));
    const sessions = both([1, 2, 15, 16]);
    expect(streakWeeks({ trial, draws: [], sessions, settings: st, today: day(22), experiments: [A, B] })).toBe(2);
  });

  it("is 0 with no completed weeks", () => {
    expect(streakWeeks({ trial, draws: [], sessions: both([1, 2]), settings: settings(), today: day(5), experiments: [A, B] })).toBe(0);
  });
});

describe("roster by week", () => {
  const C = { id: "c", portable: true };
  /** One draw per day, its weights keyed by the experiments in the trial that day. */
  const draws = (days: number[], ids: string[]): Draw[] =>
    days.map((d) => ({
      id: `d${d}`,
      trialId: "t1",
      date: day(d),
      experimentId: ids[0] ?? "a",
      weights: Object.fromEntries(ids.map((id) => [id, 1])),
    }));
  const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const cleared = (ids: string[], days: number[]) => ids.flatMap((id) => days.map((d) => s(d, id)));

  // c joins on day 10, partway through week 2.
  const added: Trial = { ...trial, experimentIds: ["a", "b", "c"] };
  const addedDraws = [...draws(range(1, 9), ["a", "b"]), ...draws(range(10, 14), ["a", "b", "c"])];

  it("reads a week's roster from its draws, falling back to the trial when a week has none", () => {
    expect([...weekRoster(added, addedDraws, wk(1, day(15)), day(15))].sort()).toEqual(["a", "b"]);
    expect([...weekRoster(added, addedDraws, wk(2, day(15)), day(15))].sort()).toEqual(["a", "b", "c"]);
    expect([...weekRoster(added, [], wk(1, day(15)), day(15))].sort()).toEqual(["a", "b", "c"]);
  });

  it("keeps week 1 neutral for an experiment added in week 2", () => {
    const sessions = [...cleared(["a", "b"], [1, 2, 8, 9]), ...cleared(["c"], [10, 11])];
    const input = { trial: added, sessions, settings: settings(), today: day(15) };
    expect(streakWeeks({ ...input, draws: addedDraws, experiments: [A, B, C] })).toBe(2);
    // Judged against today's roster instead, c's empty week 1 would end the streak there.
    expect(streakWeeks({ ...input, draws: [], experiments: [A, B, C] })).toBe(1);

    const strip = floorStrip({ ...input, draws: addedDraws, experiment: C });
    expect(strip[0]).toMatchObject({ kind: "absent", label: "", description: "Week 1, not in the trial yet" });
    expect(strip[1]).toMatchObject({ kind: "cleared" });
    expect(clearedWeek({ ...input, draws: addedDraws, experiment: C, week: wk(1, day(15)) })).toBe(false);
  });

  it("still judges a removed experiment's past weeks by the roster they had", () => {
    // c leaves after week 1. Week 1 still needs it; week 2 does not.
    const removedDraws = [...draws(range(1, 7), ["a", "b", "c"]), ...draws(range(8, 14), ["a", "b"])];
    const base = cleared(["a", "b"], [1, 2, 8, 9]);
    const input = { trial, draws: removedDraws, settings: settings(), today: day(15), experiments: [A, B, C] };
    expect(streakWeeks({ ...input, sessions: [...base, ...cleared(["c"], [1, 2])] })).toBe(2);
    expect(streakWeeks({ ...input, sessions: [...base, s(1, "c")] })).toBe(1);
  });

  it("counts the week in progress for an experiment added after today's draw", () => {
    const strip = floorStrip({
      trial: added,
      draws: draws(range(1, 10), ["a", "b"]),
      sessions: [],
      settings: settings(),
      today: day(10),
      experiment: C,
    });
    expect(strip.map((p) => p.kind)).toEqual(["absent", "progress", "future"]);
  });
});

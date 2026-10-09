import { describe, expect, it } from "vitest";
import { SINCE_ALWAYS, clampFloor, seasonOn, seasonsDuring, withSeason } from "./seasons";
import { DEFAULT_SETTINGS, type Settings } from "./types";

const settings = (overrides: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...overrides });

describe("seasons", () => {
  it("uses the current season for every date without a log", () => {
    const s = settings({ season: "travel" });
    expect(seasonOn(s, "2020-01-01")).toBe("travel");
    expect(seasonsDuring(s, "2026-10-01", "2026-10-07")).toEqual(["travel"]);
  });

  it("records the earlier season on the first switch", () => {
    const s = withSeason(settings(), "newborn", "2026-10-10");
    expect(s.season).toBe("newborn");
    expect(s.seasonLog).toEqual([
      { date: SINCE_ALWAYS, season: "normal" },
      { date: "2026-10-10", season: "newborn" },
    ]);
    expect(seasonOn(s, "2026-10-09")).toBe("normal");
    expect(seasonOn(s, "2026-10-10")).toBe("newborn");
    expect(seasonsDuring(s, "2026-10-08", "2026-10-14").sort()).toEqual(["newborn", "normal"]);
    expect(seasonsDuring(s, "2026-10-01", "2026-10-07")).toEqual(["normal"]);
  });

  it("keeps one entry per day and drops a same-day switch back", () => {
    let s = withSeason(settings(), "travel", "2026-10-10");
    s = withSeason(s, "newborn", "2026-10-10");
    expect(s.seasonLog?.at(-1)).toEqual({ date: "2026-10-10", season: "newborn" });
    expect(s.seasonLog).toHaveLength(2);
    s = withSeason(s, "normal", "2026-10-10");
    expect(s.season).toBe("normal");
    expect(s.seasonLog).toEqual([{ date: SINCE_ALWAYS, season: "normal" }]);
  });

  it("returns the same settings when the season does not change", () => {
    const s = settings();
    expect(withSeason(s, "normal", "2026-10-10")).toBe(s);
  });

  it("clamps floors to 0 through 7", () => {
    expect(clampFloor(-1)).toBe(0);
    expect(clampFloor(3.4)).toBe(3);
    expect(clampFloor(12)).toBe(7);
    expect(clampFloor(Number.NaN)).toBe(0);
  });
});

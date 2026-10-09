import { describe, expect, it } from "vitest";
import {
  addDays,
  dateOfTrialDay,
  daysBetween,
  parseLocalISODate,
  toLocalISODate,
  trialDayIndex,
  trialWeekIndex,
  weekDayRange,
} from "./dates";

describe("dates", () => {
  it("formats the local calendar date, not the UTC one", () => {
    expect(toLocalISODate(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
    expect(toLocalISODate(new Date(2026, 11, 31, 0, 1))).toBe("2026-12-31");
  });

  it("round trips through parse", () => {
    expect(toLocalISODate(parseLocalISODate("2026-03-09"))).toBe("2026-03-09");
    expect(() => parseLocalISODate("2026-3-9")).toThrow();
  });

  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("counts whole days across a daylight saving change", () => {
    expect(daysBetween("2026-03-07", "2026-03-10")).toBe(3);
    expect(daysBetween("2026-10-31", "2026-11-02")).toBe(2);
    expect(daysBetween("2026-10-08", "2026-10-08")).toBe(0);
  });

  it("makes the start date day 1", () => {
    expect(trialDayIndex("2026-10-08", "2026-10-08")).toBe(1);
    expect(trialDayIndex("2026-10-08", "2026-10-28")).toBe(21);
    expect(dateOfTrialDay("2026-10-08", 21)).toBe("2026-10-28");
  });

  it("uses trial-relative weeks of seven days", () => {
    expect(trialWeekIndex(1)).toBe(1);
    expect(trialWeekIndex(7)).toBe(1);
    expect(trialWeekIndex(8)).toBe(2);
    expect(trialWeekIndex(14)).toBe(2);
    expect(trialWeekIndex(15)).toBe(3);
    expect(trialWeekIndex(21)).toBe(3);
    expect(weekDayRange(2)).toEqual({ first: 8, last: 14 });
  });
});

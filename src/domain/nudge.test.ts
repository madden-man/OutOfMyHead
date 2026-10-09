import { describe, expect, it } from "vitest";
import { nudgeBody, nudgeDue, parseTime } from "./nudge";

const at = (h: number, m: number, s = 0) => new Date(2026, 9, 8, h, m, s);

describe("nudge", () => {
  it("parses HH:MM", () => {
    expect(parseTime("08:30")).toEqual({ hours: 8, minutes: 30 });
    expect(parseTime("24:00")).toBeUndefined();
    expect(parseTime("8:30")).toBeUndefined();
    expect(parseTime(undefined)).toBeUndefined();
  });

  it("is due from the chosen minute through a short grace window", () => {
    expect(nudgeDue(at(8, 29, 59), "08:30", undefined)).toBe(false);
    expect(nudgeDue(at(8, 30, 0), "08:30", undefined)).toBe(true);
    expect(nudgeDue(at(8, 39, 59), "08:30", undefined)).toBe(true);
    expect(nudgeDue(at(8, 40, 0), "08:30", undefined)).toBe(false);
    expect(nudgeDue(at(20, 0), "08:30", undefined)).toBe(false);
  });

  it("fires once a day", () => {
    expect(nudgeDue(at(8, 31), "08:30", "2026-10-08")).toBe(false);
    expect(nudgeDue(at(8, 31), "08:30", "2026-10-07")).toBe(true);
  });

  it("is never due without a time", () => {
    expect(nudgeDue(at(8, 30), undefined, undefined)).toBe(false);
  });

  it("names the draw and the next note", () => {
    expect(nudgeBody("Piano into the box", "Bars 9 to 16")).toBe("Today: Piano into the box. Pick up: Bars 9 to 16");
    expect(nudgeBody("Piano into the box", "  ")).toBe("Today: Piano into the box.");
  });
});

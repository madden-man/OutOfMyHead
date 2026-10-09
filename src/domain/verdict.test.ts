import { describe, expect, it } from "vitest";
import { nextRoster } from "./verdict";

describe("nextRoster", () => {
  it("keeps, extends, and swaps cuts in place", () => {
    expect(nextRoster(["a", "b", "c"], { a: "keep", b: "cut", c: "extend" }, { b: "x" })).toEqual({
      ok: true,
      experimentIds: ["a", "x", "c"],
    });
  });

  it("needs a verdict for every experiment", () => {
    expect(nextRoster(["a", "b"], { a: "keep" }, {})).toEqual({ ok: false, reason: "undecided", experimentId: "b" });
  });

  it("needs a replacement for every cut", () => {
    expect(nextRoster(["a", "b"], { a: "keep", b: "cut" }, {})).toEqual({
      ok: false,
      reason: "needs-replacement",
      experimentId: "b",
    });
  });

  it("rejects a replacement already in the roster", () => {
    expect(nextRoster(["a", "b"], { a: "keep", b: "cut" }, { b: "a" })).toMatchObject({ ok: false, reason: "duplicate" });
  });

  it("enforces 2 to 4 experiments", () => {
    expect(nextRoster(["a"], { a: "keep" }, {})).toMatchObject({ ok: false, reason: "size" });
  });
});

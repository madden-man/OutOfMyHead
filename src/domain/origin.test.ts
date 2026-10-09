import { describe, expect, it } from "vitest";
import { sessionOrigin } from "./origin";
import type { Draw, Session } from "./types";

const draw = (overrides: Partial<Draw> = {}): Draw => ({
  id: "d1",
  trialId: "t1",
  date: "2026-10-08",
  experimentId: "a",
  weights: { a: 1, b: 1, c: 1 },
  ...overrides,
});

const sessionOn = (experimentId: string) => ({ experimentId }) as Session;

describe("sessionOrigin", () => {
  it("marks the drawn experiment as drawn, even on a second session", () => {
    expect(sessionOrigin(draw(), "a", [])).toBe("drawn");
    expect(sessionOrigin(draw(), "a", [sessionOn("a")])).toBe("drawn");
  });

  it("marks a rerolled draw as rerolled", () => {
    expect(sessionOrigin(draw({ experimentId: "b", rerolledFrom: "a" }), "b", [])).toBe("rerolled");
  });

  it("marks the first session on the passed-to experiment", () => {
    const d = draw({ passedTo: "c" });
    expect(sessionOrigin(d, "c", [])).toBe("passed-to");
    expect(sessionOrigin(d, "c", [sessionOn("c")])).toBe("unprompted");
  });

  it("treats everything else as unprompted", () => {
    expect(sessionOrigin(draw(), "b", [])).toBe("unprompted");
    expect(sessionOrigin(undefined, "a", [])).toBe("unprompted");
  });
});

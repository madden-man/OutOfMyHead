import { describe, expect, it } from "vitest";
import { reviewAsOf, trialExperiments, trialsNewestFirst, trialWork } from "./review";
import type { Experiment, Session, Trial } from "./types";

const exp = (id: string): Experiment => ({
  id,
  stream: "writing",
  name: id,
  do: "",
  tests: "",
  unit: "",
  portable: true,
  custom: false,
  archived: false,
});

const session = (id: string, date: string, experimentId: string, withAttachment = true, trialId = "t1"): Session => ({
  id,
  trialId,
  experimentId,
  date,
  startedAt: `${date}T09:00:00.000Z`,
  minutes: 5,
  pull: 3,
  thoughtAboutIt: false,
  origin: "drawn",
  nextNote: "",
  ...(withAttachment ? { attachment: { kind: "text" as const, text: id } } : {}),
});

describe("review helpers", () => {
  it("reads a closed trial as of its closing day", () => {
    const closedAt = new Date(2026, 9, 20, 18, 0).toISOString();
    expect(reviewAsOf({ status: "closed", closedAt }, "2026-11-30")).toBe("2026-10-20");
    expect(reviewAsOf({ status: "active" }, "2026-11-30")).toBe("2026-11-30");
  });

  it("lists the roster, then experiments with sessions that left it", () => {
    const byId = new Map(["a", "b", "c"].map((id) => [id, exp(id)]));
    const trial: Pick<Trial, "id" | "experimentIds"> = { id: "t1", experimentIds: ["b", "a"] };
    const list = trialExperiments(trial, byId, [session("s1", "2026-10-01", "c", false), session("s2", "2026-10-01", "c", false, "t2")]);
    expect(list.map((e) => e.id)).toEqual(["b", "a", "c"]);
  });

  it("orders trials and work newest first", () => {
    expect(trialsNewestFirst([{ number: 1 }, { number: 3 }, { number: 2 }]).map((t) => t.number)).toEqual([3, 2, 1]);
    const work = trialWork(
      [
        session("old", "2026-10-01", "a"),
        session("none", "2026-10-05", "a", false),
        session("new", "2026-10-04", "a"),
        session("other", "2026-10-09", "a", true, "t2"),
      ],
      "t1",
    );
    expect(work.map((s) => s.id)).toEqual(["new", "old"]);
  });
});

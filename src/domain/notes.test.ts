import { describe, expect, it } from "vitest";
import { latestSession, nextNoteFor, nextNotes } from "./notes";
import type { Session } from "./types";

let n = 0;
const session = (overrides: Partial<Session>): Session => ({
  id: `s${n++}`,
  trialId: "t1",
  experimentId: "a",
  date: "2026-10-08",
  startedAt: "2026-10-08T12:00:00.000Z",
  minutes: 10,
  pull: 3,
  thoughtAboutIt: false,
  origin: "drawn",
  nextNote: "",
  ...overrides,
});

describe("next notes", () => {
  const sessions = [
    session({ experimentId: "a", date: "2026-10-08", nextNote: "older" }),
    session({ experimentId: "a", date: "2026-10-10", nextNote: "newest by date" }),
    session({ experimentId: "a", date: "2026-10-09", nextNote: "middle" }),
    session({ experimentId: "b", date: "2026-10-09", startedAt: "2026-10-09T08:00:00.000Z", nextNote: "morning" }),
    session({ experimentId: "b", date: "2026-10-09", startedAt: "2026-10-09T20:00:00.000Z", nextNote: "evening" }),
  ];

  it("uses the most recent session by date", () => {
    expect(nextNoteFor(sessions, "a")).toBe("newest by date");
  });

  it("breaks same-day ties by start time", () => {
    expect(nextNoteFor(sessions, "b")).toBe("evening");
    expect(latestSession(sessions, "b")?.nextNote).toBe("evening");
  });

  it("is undefined for an experiment with no sessions", () => {
    expect(nextNoteFor(sessions, "z")).toBeUndefined();
  });

  it("builds the map for every experiment", () => {
    expect(nextNotes(sessions)).toEqual({ a: "newest by date", b: "evening" });
  });

  it("takes an empty note literally when it is the latest", () => {
    const withBlank = [...sessions, session({ experimentId: "a", date: "2026-10-11", nextNote: "" })];
    expect(nextNoteFor(withBlank, "a")).toBe("");
  });
});

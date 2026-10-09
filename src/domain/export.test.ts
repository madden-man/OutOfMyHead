import { describe, expect, it } from "vitest";
import { buildJsonExport, buildMarkdownExport, exportFileName, type ExportInput } from "./export";
import { DEFAULT_SETTINGS, type Experiment, type Session, type Trial } from "./types";

const exp = (id: string, name: string): Experiment => ({
  id,
  stream: "piano",
  name,
  do: "",
  tests: "",
  unit: "",
  portable: false,
  custom: false,
  archived: false,
});

const trials: Trial[] = [
  {
    id: "t2",
    number: 2,
    startDate: "2026-10-29",
    lengthDays: 21,
    experimentIds: ["a", "c"],
    status: "active",
  },
  {
    id: "t1",
    number: 1,
    startDate: "2026-10-08",
    lengthDays: 21,
    experimentIds: ["a", "b"],
    status: "closed",
    verdicts: { a: "keep", b: "cut" },
    replacements: { b: "c" },
    closedAt: new Date(2026, 9, 29, 9).toISOString(),
  },
];

const sessions: Session[] = [
  {
    id: "s1",
    trialId: "t1",
    experimentId: "a",
    date: "2026-10-08",
    startedAt: "2026-10-08T09:00:00.000Z",
    minutes: 15,
    pull: 4,
    thoughtAboutIt: true,
    origin: "drawn",
    nextNote: "Bridge, bars 17 to 24",
    attachment: { kind: "text", text: "Line one\nLine two" },
  },
  {
    id: "s2",
    trialId: "t1",
    experimentId: "b",
    date: "2026-10-09",
    startedAt: "2026-10-09T09:00:00.000Z",
    minutes: 10,
    pull: 2,
    thoughtAboutIt: false,
    origin: "passed-to",
    nextNote: "Slower",
    attachment: { kind: "audio", blob: new Blob(["xyz"]), mime: "audio/mp4", name: "take.m4a" },
  },
];

const input: ExportInput = {
  experiments: [exp("a", "Tune"), exp("b", "Comping"), exp("c", "Voicings")],
  trials,
  draws: [],
  sessions,
  settings: { ...DEFAULT_SETTINGS, onboarded: true },
  today: "2026-10-30",
  exportedAt: "2026-10-30T12:00:00.000Z",
};

describe("exports", () => {
  it("JSON keeps every record and leaves blobs out", () => {
    const doc = JSON.parse(buildJsonExport(input));
    expect(doc.trials.map((t: Trial) => t.number)).toEqual([1, 2]);
    expect(doc.sessions).toHaveLength(2);
    expect(doc.sessions[1].attachment).toEqual({ kind: "audio", mime: "audio/mp4", name: "take.m4a", size: 3 });
    expect(doc.experiments).toHaveLength(3);
  });

  it("Markdown has a section per trial, stats, and every session", () => {
    const md = buildMarkdownExport(input);
    expect(md).toContain("## Trial 1\n\nStarted Oct 8, 2026, 21 days planned, closed Oct 29, 2026.");
    expect(md).toContain("- Verdict: Cut, replaced by Voicings");
    expect(md).toContain("- Passed to: 1");
    expect(md).toContain(
      "- 2026-10-08, Tune, 15 min, pull 4 (Wanted to), drawn. Next: Bridge, bars 17 to 24 Snippet: Line one\n  Line two",
    );
    expect(md).toContain("- 2026-10-09, Comping, 10 min, pull 2 (Meh), passed to. Next: Slower Audio: take.m4a");
    expect(md).toContain("## Trial 2");
    expect(md.indexOf("## Trial 1")).toBeLessThan(md.indexOf("## Trial 2"));
    expect(md).toContain("No sessions logged.");
  });

  it("names files by date", () => {
    expect(exportFileName("2026-10-30", "md")).toBe("out-of-my-head-2026-10-30.md");
  });
});

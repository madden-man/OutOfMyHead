import { attachmentMeta } from "./attachments";
import { parseLocalISODate } from "./dates";
import { reviewAsOf, trialExperiments } from "./review";
import { formatPull, formatRate, trialStats } from "./stats";
import {
  DEFAULT_SETTINGS,
  PULL_LABELS,
  STREAM_LABELS,
  VERDICT_LABELS,
  type Draw,
  type Experiment,
  type Session,
  type SessionOrigin,
  type Settings,
  type Trial,
} from "./types";

export interface ExportInput {
  experiments: readonly Experiment[];
  trials: readonly Trial[];
  draws: readonly Draw[];
  sessions: readonly Session[];
  settings: Settings | undefined;
  today: string;
  exportedAt: string;
}

export const EXPORT_FORMAT = "out-of-my-head";
export const EXPORT_VERSION = 1;

/** Everything in the store as one JSON document. Attachment blobs stay out; their metadata stays in. */
export function buildJsonExport(input: ExportInput): string {
  const doc = {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: input.exportedAt,
    settings: input.settings ?? null,
    experiments: input.experiments,
    trials: [...input.trials].sort((a, b) => a.number - b.number),
    draws: [...input.draws].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
    sessions: sortOldestFirst(input.sessions).map((s) =>
      s.attachment ? { ...s, attachment: attachmentMeta(s.attachment) } : s,
    ),
  };
  return JSON.stringify(doc, null, 2);
}

const ORIGIN_TEXT: Record<SessionOrigin, string> = {
  drawn: "drawn",
  rerolled: "rerolled",
  "passed-to": "passed to",
  unprompted: "unprompted",
};

const longDate = new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "numeric" });

function formatDate(iso: string): string {
  return longDate.format(parseLocalISODate(iso));
}

/** One section per trial: per experiment stats, then every session as a bullet. */
export function buildMarkdownExport(input: ExportInput): string {
  const settings = input.settings ?? DEFAULT_SETTINGS;
  const byId = new Map(input.experiments.map((e) => [e.id, e]));
  const lines: string[] = ["# Out of My Head", "", `Exported ${formatDate(input.today)}.`];

  const trials = [...input.trials].sort((a, b) => a.number - b.number);
  if (trials.length === 0) lines.push("", "No trials yet.");

  for (const trial of trials) {
    const asOf = reviewAsOf(trial, input.today);
    const experiments = trialExperiments(trial, byId, input.sessions);
    const stats = trialStats({
      trial,
      sessions: input.sessions,
      draws: input.draws,
      settings,
      today: asOf,
      experiments,
    });
    const status = trial.status === "active" ? "active" : `closed ${formatDate(asOf)}`;
    lines.push("", `## Trial ${trial.number}`, "");
    lines.push(`Started ${formatDate(trial.startDate)}, ${trial.lengthDays} days planned, ${status}.`);

    for (const e of experiments) {
      const st = stats[e.id];
      if (!st) continue;
      lines.push("", `### ${e.name}`, "");
      lines.push(`- Stream: ${STREAM_LABELS[e.stream]}`);
      const verdict = trial.verdicts?.[e.id];
      if (verdict) {
        const replacement = trial.replacements?.[e.id];
        const replacedBy = replacement ? byId.get(replacement)?.name : undefined;
        lines.push(`- Verdict: ${VERDICT_LABELS[verdict]}${replacedBy ? `, replaced by ${replacedBy}` : ""}`);
      }
      lines.push(
        `- Sessions: ${st.sessions}`,
        `- Minutes: ${st.minutes}`,
        `- Average pull: ${formatPull(st.averagePull)}`,
        `- Unprompted: ${st.unprompted}`,
        `- Passed to: ${st.passedToSessions}`,
        `- Thought about it: ${formatRate(st.thoughtAboutItRate)}`,
        `- Passes: ${st.passes}`,
        `- Floor weeks cleared: ${st.floorWeeksCleared}`,
      );
    }

    const sessions = sortOldestFirst(input.sessions.filter((s) => s.trialId === trial.id));
    lines.push("", "### Sessions", "");
    if (sessions.length === 0) lines.push("No sessions logged.");
    for (const s of sessions) lines.push(sessionBullet(s, byId.get(s.experimentId)?.name ?? "Removed experiment"));
  }
  return `${lines.join("\n")}\n`;
}

function sessionBullet(s: Session, name: string): string {
  const parts = [
    `${s.date}, ${name}`,
    `${s.minutes} min`,
    `pull ${s.pull} (${PULL_LABELS[s.pull]})`,
    ORIGIN_TEXT[s.origin],
  ];
  let line = `- ${parts.join(", ")}.`;
  if (s.nextNote) line += ` Next: ${oneLine(s.nextNote)}`;
  const a = s.attachment;
  if (a?.text) line += ` Snippet: ${indentContinuation(a.text)}`;
  if (a && a.kind !== "text") line += ` ${a.kind === "image" ? "Image" : "Audio"}: ${a.name ?? "untitled"} (not included in this file).`;
  return line;
}

function oneLine(text: string): string {
  return text.replace(/\s*\n\s*/g, " ").trim();
}

/** Keep a multi-line snippet inside its bullet. */
function indentContinuation(text: string): string {
  return text.trim().replace(/\n/g, "\n  ");
}

function sortOldestFirst(sessions: readonly Session[]): Session[] {
  return [...sessions].sort((a, b) =>
    a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.startedAt < b.startedAt ? -1 : a.startedAt > b.startedAt ? 1 : 0,
  );
}

/** A file name for an export made on `today`. */
export function exportFileName(today: string, ext: "json" | "md"): string {
  return `out-of-my-head-${today}.${ext}`;
}

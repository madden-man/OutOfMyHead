import type { Session } from "./types";

/** Newest first: by date, then by start time. */
export function compareSessionsNewestFirst(a: Session, b: Session): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  if (a.startedAt !== b.startedAt) return a.startedAt < b.startedAt ? 1 : -1;
  return 0;
}

/** The most recent session for an experiment, across all trials. */
export function latestSession(sessions: readonly Session[], experimentId: string): Session | undefined {
  let latest: Session | undefined;
  for (const s of sessions) {
    if (s.experimentId !== experimentId) continue;
    if (!latest || compareSessionsNewestFirst(s, latest) < 0) latest = s;
  }
  return latest;
}

/** The next note for one experiment: the nextNote of its most recent session. */
export function nextNoteFor(sessions: readonly Session[], experimentId: string): string | undefined {
  return latestSession(sessions, experimentId)?.nextNote;
}

/** Next notes for every experiment that has at least one session. */
export function nextNotes(sessions: readonly Session[]): Record<string, string> {
  const latest: Record<string, Session> = {};
  for (const s of sessions) {
    const current = latest[s.experimentId];
    if (!current || compareSessionsNewestFirst(s, current) < 0) latest[s.experimentId] = s;
  }
  const notes: Record<string, string> = {};
  for (const [id, s] of Object.entries(latest)) notes[id] = s.nextNote;
  return notes;
}

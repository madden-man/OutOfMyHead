import { MAX_ACTIVE, MIN_ACTIVE, type Verdict } from "./types";

export type RosterResult =
  | { ok: true; experimentIds: string[] }
  | { ok: false; reason: "undecided" | "needs-replacement" | "duplicate" | "size"; experimentId?: string };

/**
 * The next trial's roster from this trial's verdicts. Keep and extend stay,
 * in their current order; each cut is swapped in place for its replacement.
 */
export function nextRoster(
  current: readonly string[],
  verdicts: Readonly<Record<string, Verdict | undefined>>,
  replacements: Readonly<Record<string, string | undefined>>,
): RosterResult {
  const next: string[] = [];
  for (const id of current) {
    const verdict = verdicts[id];
    if (!verdict) return { ok: false, reason: "undecided", experimentId: id };
    if (verdict === "cut") {
      const replacement = replacements[id];
      if (!replacement) return { ok: false, reason: "needs-replacement", experimentId: id };
      next.push(replacement);
    } else {
      next.push(id);
    }
  }
  if (new Set(next).size !== next.length) return { ok: false, reason: "duplicate" };
  if (next.length < MIN_ACTIVE || next.length > MAX_ACTIVE) return { ok: false, reason: "size" };
  return { ok: true, experimentIds: next };
}

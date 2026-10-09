import type { Draw, Session, SessionOrigin } from "./types";

/**
 * Origin of a session logged today on `experimentId`.
 * - The drawn experiment is "drawn", or "rerolled" when the draw was rerolled.
 * - The first session on the passed-to experiment is "passed-to".
 * - Anything else is free choice: "unprompted".
 */
export function sessionOrigin(
  draw: Draw | undefined,
  experimentId: string,
  sessionsToday: readonly Session[],
): SessionOrigin {
  if (!draw) return "unprompted";
  if (experimentId === draw.experimentId) return draw.rerolledFrom ? "rerolled" : "drawn";
  if (experimentId === draw.passedTo) {
    const already = sessionsToday.some((s) => s.experimentId === experimentId);
    return already ? "unprompted" : "passed-to";
  }
  return "unprompted";
}

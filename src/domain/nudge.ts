import { toLocalISODate } from "./dates";

/**
 * The nudge fires once a day at the chosen minute while the app is open. A
 * short grace window covers timers that a backgrounded tab delays; opening
 * the app hours later does not fire a stale nudge.
 */
export const NUDGE_GRACE_MINUTES = 10;

export function parseTime(hhmm: string | undefined): { hours: number; minutes: number } | undefined {
  const match = /^(\d{2}):(\d{2})$/.exec(hhmm ?? "");
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return undefined;
  return { hours, minutes };
}

/** True when `now` is at or just after today's nudge time and today's nudge has not fired. */
export function nudgeDue(now: Date, hhmm: string | undefined, lastFiredDate: string | undefined): boolean {
  const time = parseTime(hhmm);
  if (!time) return false;
  if (lastFiredDate === toLocalISODate(now)) return false;
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), time.hours, time.minutes, 0, 0);
  const late = now.getTime() - target.getTime();
  return late >= 0 && late < NUDGE_GRACE_MINUTES * 60_000;
}

export function nudgeBody(name: string, note: string | undefined): string {
  const pickUp = note?.trim();
  return pickUp ? `Today: ${name}. Pick up: ${pickUp}` : `Today: ${name}.`;
}

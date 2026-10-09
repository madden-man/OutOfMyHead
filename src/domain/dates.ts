// Calendar helpers. Every date in the domain is a local YYYY-MM-DD string.

const pad = (n: number): string => String(n).padStart(2, "0");

/** The local calendar date of `d` as YYYY-MM-DD. */
export function toLocalISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parse a YYYY-MM-DD string as local midnight. */
export function parseLocalISODate(iso: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) throw new Error(`Not a local ISO date: ${iso}`);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** Shift a local ISO date by a whole number of calendar days. */
export function addDays(iso: string, days: number): string {
  const d = parseLocalISODate(iso);
  d.setDate(d.getDate() + days);
  return toLocalISODate(d);
}

/**
 * Whole calendar days from `from` to `to`. Uses UTC math on the date parts so
 * daylight saving shifts never produce a fractional day.
 */
export function daysBetween(from: string, to: string): number {
  const a = parseLocalISODate(from);
  const b = parseLocalISODate(to);
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / 86_400_000);
}

/** Day N of the trial, where the start date is day 1. */
export function trialDayIndex(startDate: string, today: string): number {
  return daysBetween(startDate, today) + 1;
}

/** Trial-relative week for a 1-based day index: days 1 to 7 are week 1. */
export function trialWeekIndex(dayIndex: number): number {
  return Math.floor((Math.max(1, dayIndex) - 1) / 7) + 1;
}

/** First and last day index of a trial-relative week. */
export function weekDayRange(week: number): { first: number; last: number } {
  const first = (week - 1) * 7 + 1;
  return { first, last: first + 6 };
}

/** The local ISO date of day `dayIndex` in a trial that starts on `startDate`. */
export function dateOfTrialDay(startDate: string, dayIndex: number): string {
  return addDays(startDate, dayIndex - 1);
}

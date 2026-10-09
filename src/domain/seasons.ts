import { MAX_FLOOR, MIN_FLOOR, type Season, type SeasonChange, type Settings } from "./types";

/** A date before any trial, used to record the season that was in effect before the first change. */
export const SINCE_ALWAYS = "0000-01-01";

function sortedLog(settings: Settings): SeasonChange[] {
  return [...(settings.seasonLog ?? [])].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** The season in effect on `date`. Without a log, the current season applies to every date. */
export function seasonOn(settings: Settings, date: string): Season {
  let season: Season | undefined;
  for (const change of sortedLog(settings)) {
    if (change.date <= date) season = change.season;
  }
  return season ?? settings.season;
}

/** Every season in effect at some point from `from` to `to`, inclusive. */
export function seasonsDuring(settings: Settings, from: string, to: string): Season[] {
  const seasons = new Set<Season>([seasonOn(settings, from)]);
  for (const change of sortedLog(settings)) {
    if (change.date > from && change.date <= to) seasons.add(change.season);
  }
  return [...seasons];
}

/**
 * Switch the season starting `today`. The log keeps one entry per day (the
 * last choice wins) and records the earlier season on first use so past
 * weeks keep the floor they had.
 */
export function withSeason(settings: Settings, season: Season, today: string): Settings {
  if (season === settings.season) return settings;
  const log = settings.seasonLog?.length
    ? sortedLog(settings).filter((c) => c.date !== today)
    : [{ date: SINCE_ALWAYS, season: settings.season }];
  const before = [...log].reverse().find((c) => c.date < today)?.season;
  if (before !== season) log.push({ date: today, season });
  return { ...settings, season, seasonLog: log };
}

/** Keep a floor inside its bounds as a whole number of sessions. */
export function clampFloor(n: number): number {
  if (!Number.isFinite(n)) return MIN_FLOOR;
  return Math.min(MAX_FLOOR, Math.max(MIN_FLOOR, Math.round(n)));
}

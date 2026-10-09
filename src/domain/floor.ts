import { dateOfTrialDay, trialDayIndex } from "./dates";
import { seasonsDuring } from "./seasons";
import type { Season, Session, Settings, Trial } from "./types";

// Weekly floor, derived from sessions. The app only ever reports cleared or
// not yet cleared. Sessions above the floor are bonus. Nothing here is a miss.

export interface TrialWeek {
  week: number; // 1-based
  firstDay: number; // trial day index, day 1 is the start date
  lastDay: number;
  startDate: string;
  endDate: string;
  days: number;
  planned: boolean; // false for weeks after the planned length, while the trial runs over
}

export type WeekPhase = "past" | "current" | "future";

/**
 * Trial-relative weeks: days 1 to 7, 8 to 14, and so on. A planned length
 * that is not a multiple of 7 ends on a short week. If the trial runs past
 * its planned length, full weeks continue until they cover `today`.
 */
export function trialWeeks(trial: Pick<Trial, "startDate" | "lengthDays">, today: string): TrialWeek[] {
  const weeks: TrialWeek[] = [];
  const push = (firstDay: number, lastDay: number, planned: boolean) =>
    weeks.push({
      week: weeks.length + 1,
      firstDay,
      lastDay,
      startDate: dateOfTrialDay(trial.startDate, firstDay),
      endDate: dateOfTrialDay(trial.startDate, lastDay),
      days: lastDay - firstDay + 1,
      planned,
    });
  for (let first = 1; first <= trial.lengthDays; first += 7) {
    push(first, Math.min(first + 6, trial.lengthDays), true);
  }
  const todayIndex = trialDayIndex(trial.startDate, today);
  while ((weeks.at(-1)?.lastDay ?? 0) < todayIndex) {
    const first = (weeks.at(-1)?.lastDay ?? 0) + 1;
    push(first, first + 6, false);
  }
  return weeks;
}

export function weekPhase(week: TrialWeek, today: string): WeekPhase {
  if (week.endDate < today) return "past";
  if (week.startDate > today) return "future";
  return "current";
}

/** The trial week that contains `today`, if any. */
export function currentWeek(weeks: readonly TrialWeek[], today: string): TrialWeek | undefined {
  return weeks.find((w) => weekPhase(w, today) === "current");
}

/** Seasons in effect during the week, up to today. Future weeks use today's season. */
export function weekSeasons(settings: Settings, week: TrialWeek, today: string): Season[] {
  if (week.startDate > today) return seasonsDuring(settings, today, today);
  const end = week.endDate < today ? week.endDate : today;
  return seasonsDuring(settings, week.startDate, end);
}

/** Newborn weeks never break a streak and never extend one. */
export function isNewbornWeek(settings: Settings, week: TrialWeek, today: string): boolean {
  return weekSeasons(settings, week, today).includes("newborn");
}

/**
 * The floor for one experiment in one week. When the season changed during
 * the week, the lowest floor applies. A short final week scales the floor by
 * its length (rounded up). A non-portable experiment rests in travel weeks
 * and has no floor.
 */
export function weekFloor(
  settings: Settings,
  week: TrialWeek,
  today: string,
  experiment: { portable: boolean },
): number {
  const seasons = weekSeasons(settings, week, today);
  if (!experiment.portable && seasons.includes("travel")) return 0;
  const base = Math.min(...seasons.map((s) => settings.floorPerWeek[s]));
  return week.days >= 7 ? base : Math.ceil((base * week.days) / 7);
}

export function sessionsInWeek(
  sessions: readonly Session[],
  trialId: string,
  experimentId: string,
  week: TrialWeek,
): number {
  let n = 0;
  for (const s of sessions) {
    if (s.trialId === trialId && s.experimentId === experimentId && s.date >= week.startDate && s.date <= week.endDate) {
      n++;
    }
  }
  return n;
}

export type PillKind = "cleared" | "progress" | "done" | "future";

export interface WeekPill {
  week: number;
  phase: WeekPhase;
  kind: PillKind;
  count: number;
  floor: number;
  bonus: number;
  /** Short visible text. Empty for future weeks. */
  label: string;
  /** Full sentence for assistive tech and tooltips. */
  description: string;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);

export function weekPill(input: {
  week: TrialWeek;
  count: number;
  floor: number;
  today: string;
}): WeekPill {
  const { week, count, floor, today } = input;
  const phase = weekPhase(week, today);
  const base = { week: week.week, phase, count, floor, bonus: 0 };
  const name = `Week ${week.week}`;
  if (phase === "future") {
    return { ...base, kind: "future", label: "", description: `${name}, not started` };
  }
  if (floor === 0) {
    return {
      ...base,
      kind: "done",
      label: `${count} done`,
      description: `${name}, no floor, ${plural(count, "session", "sessions")} done`,
    };
  }
  if (count >= floor) {
    const bonus = count - floor;
    return {
      ...base,
      bonus,
      kind: "cleared",
      label: bonus > 0 ? `Cleared +${bonus}` : "Cleared",
      description: `${name}, cleared${bonus > 0 ? ` with ${plural(bonus, "bonus session", "bonus sessions")}` : ""}`,
    };
  }
  if (phase === "current") {
    return {
      ...base,
      kind: "progress",
      label: `${count} of ${floor}`,
      description: `${name}, ${count} of ${floor} so far`,
    };
  }
  return {
    ...base,
    kind: "done",
    label: `${count} done`,
    description: `${name}, ${plural(count, "session", "sessions")} done`,
  };
}

export interface FloorInput {
  trial: Pick<Trial, "id" | "startDate" | "lengthDays">;
  sessions: readonly Session[];
  settings: Settings;
  today: string;
}

/** The weekly floor strip for one experiment: one pill per trial week. */
export function floorStrip(input: FloorInput & { experiment: { id: string; portable: boolean } }): WeekPill[] {
  const { trial, sessions, settings, today, experiment } = input;
  return trialWeeks(trial, today).map((week) =>
    weekPill({
      week,
      count: sessionsInWeek(sessions, trial.id, experiment.id, week),
      floor: weekFloor(settings, week, today, experiment),
      today,
    }),
  );
}

/** Whether one experiment cleared a floor above 0 in a week. */
export function clearedWeek(
  input: FloorInput & { experiment: { id: string; portable: boolean }; week: TrialWeek },
): boolean {
  const floor = weekFloor(input.settings, input.week, input.today, input.experiment);
  return floor > 0 && sessionsInWeek(input.sessions, input.trial.id, input.experiment.id, input.week) >= floor;
}

/**
 * Streak in weeks: consecutive completed weeks, counting back from the most
 * recent, where every active experiment cleared its floor. Newborn weeks are
 * neutral: they neither break the streak nor add to it.
 */
export function streakWeeks(input: FloorInput & { experiments: readonly { id: string; portable: boolean }[] }): number {
  const { trial, sessions, settings, today, experiments } = input;
  if (experiments.length === 0) return 0;
  const completed = trialWeeks(trial, today).filter((w) => weekPhase(w, today) === "past");
  let streak = 0;
  for (const week of completed.reverse()) {
    if (isNewbornWeek(settings, week, today)) continue;
    const allCleared = experiments.every(
      (e) => sessionsInWeek(sessions, trial.id, e.id, week) >= weekFloor(settings, week, today, e),
    );
    if (!allCleared) break;
    streak++;
  }
  return streak;
}


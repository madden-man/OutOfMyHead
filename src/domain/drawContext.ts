import { addDays, trialDayIndex, trialWeekIndex, weekDayRange, dateOfTrialDay } from "./dates";
import type { DrawContext } from "./draw";
import type { Draw, Experiment, Session, Settings, Trial } from "./types";

/** Build the draw context for `today` from stored rows. Pure. */
export function buildDrawContext(input: {
  trial: Trial;
  experiments: readonly Experiment[];
  draws: readonly Draw[];
  sessions: readonly Session[];
  settings: Settings;
  today: string;
}): DrawContext {
  const { trial, experiments, draws, sessions, settings, today } = input;
  const byId = new Map(experiments.map((e) => [e.id, e]));
  const active = trial.experimentIds
    .map((id) => byId.get(id))
    .filter((e): e is Experiment => e !== undefined)
    .map((e) => ({ id: e.id, portable: e.portable }));

  const dayIndex = trialDayIndex(trial.startDate, today);
  const earlier = draws.filter((d) => d.trialId === trial.id && d.date < today);
  const timesDrawn: Record<string, number> = {};
  for (const d of earlier) timesDrawn[d.experimentId] = (timesDrawn[d.experimentId] ?? 0) + 1;

  const yesterday = addDays(today, -1);
  const drawnYesterday = earlier.find((d) => d.date === yesterday)?.experimentId;

  const { first } = weekDayRange(trialWeekIndex(dayIndex));
  const weekStart = dateOfTrialDay(trial.startDate, first);
  const sessionsThisWeek: Record<string, number> = {};
  for (const s of sessions) {
    if (s.trialId !== trial.id || s.date < weekStart || s.date >= today) continue;
    sessionsThisWeek[s.experimentId] = (sessionsThisWeek[s.experimentId] ?? 0) + 1;
  }

  const ctx: DrawContext = {
    experiments: active,
    dayIndex: Math.max(0, dayIndex - 1),
    timesDrawn,
    sessionsThisWeek,
    floorPerWeek: settings.floorPerWeek[settings.season],
    season: settings.season,
  };
  if (drawnYesterday) ctx.drawnYesterday = drawnYesterday;
  return ctx;
}

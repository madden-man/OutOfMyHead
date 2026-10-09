export type Stream = "writing" | "piano" | "production";

export interface Experiment {
  id: string;
  seedId?: number; // 1..60 when from the seed library
  stream: Stream;
  name: string;
  do: string; // what to do each session
  tests: string; // what this experiment tests
  unit: string; // the minimum unit, e.g. "one 100-word fragment"
  portable: boolean; // can it come on a trip
  custom: boolean; // user-authored
  archived: boolean;
}

export type Season = "normal" | "travel" | "newborn";

export interface Trial {
  id: string;
  number: number; // 1, 2, 3...
  startDate: string; // day 1
  lengthDays: number; // default 21
  experimentIds: string[]; // 2..4 active experiments
  status: "active" | "closed";
  verdicts?: Record<string, "keep" | "cut" | "extend">;
  closedAt?: string;
}

export interface Draw {
  id: string;
  trialId: string;
  date: string; // one per calendar day per trial
  experimentId: string; // what was drawn
  weights: Record<string, number>; // the weights used, for transparency
  rerolledFrom?: string; // experimentId if the user rerolled once
  passedTo?: string; // experimentId if the user passed to another
}

export type SessionOrigin = "drawn" | "passed-to" | "unprompted" | "rerolled";

export interface Session {
  id: string;
  trialId: string;
  experimentId: string;
  date: string;
  startedAt: string;
  minutes: number;
  pull: 1 | 2 | 3 | 4 | 5; // how much you wanted to start
  thoughtAboutIt: boolean; // thought about it off the clock since last session
  origin: SessionOrigin;
  nextNote: string; // one line: what to pick up next time
  attachment?: Attachment;
}

export interface Attachment {
  kind: "text" | "image" | "audio";
  text?: string;
  blob?: Blob; // stored in Dexie
  mime?: string;
  name?: string;
}

export interface Settings {
  id: "settings";
  season: Season;
  floorPerWeek: Record<Season, number>; // sessions per experiment per week; default normal 2, travel 1, newborn 0
  nudgeTime?: string; // "HH:MM" local, optional single daily nudge
  onboarded: boolean;
}

export type Pull = Session["pull"];

export const STREAMS: readonly Stream[] = ["writing", "piano", "production"];

export const STREAM_LABELS: Record<Stream, string> = {
  writing: "Writing",
  piano: "Jazz piano",
  production: "Production",
};

export const PULL_LABELS: Record<Pull, string> = {
  1: "Dreaded it",
  2: "Meh",
  3: "Fine",
  4: "Wanted to",
  5: "Could not wait",
};

export const DEFAULT_TRIAL_LENGTH = 21;
export const MIN_ACTIVE = 2;
export const MAX_ACTIVE = 4;

export const DEFAULT_SETTINGS: Settings = {
  id: "settings",
  season: "normal",
  floorPerWeek: { normal: 2, travel: 1, newborn: 0 },
  onboarded: false,
};

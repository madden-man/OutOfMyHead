# Out of My Head: product spec

Out of My Head runs three-week experiments on a busy person's creative life and helps them read the results. Its job is to answer "what should I work on today?" and "is this one pulling me back?". It does not schedule time. Every interaction should take under a minute.

The owner has three streams: writing (fantasy, fiction, poetry, philosophy), jazz piano (Open Studio Level 3 range), and music production. Sixty seed experiments ship in `seed/experiments.json`, twenty per stream.

Out of scope, on purpose: accounts, social features, calendar scheduling, daily nag reminders, elaborate planning, and any metric that frames a thin week as failure.

## Stack

- Vite + React 18 + TypeScript (strict). Mobile-first PWA installed to the home screen. Works offline.
- Local-first. Dexie (IndexedDB) is the only store. No backend.
- State: a single `useAppStore` built on Dexie live queries (or zustand over Dexie). Keep domain logic in pure functions under `src/domain/` so it is testable without React.
- Tests: Vitest + React Testing Library + `fake-indexeddb`. Integration tests render the real `<App />` against a fresh Dexie database and drive it through the UI. Pure domain functions get unit tests too.
- Lint: eslint + typescript-eslint. `npm run check` runs typecheck, lint, and tests. CI (GitHub Actions) runs `npm run check` on push.
- No CSS framework. Plain CSS with tokens (see Standards). One `src/styles/tokens.css` and component-level CSS.

## Domain model

All ids are strings (nanoid). Dates are ISO `YYYY-MM-DD` local-date strings unless noted. Timestamps are ISO datetime strings.

```ts
type Stream = "writing" | "piano" | "production";

interface Experiment {
  id: string;
  seedId?: number;          // 1..60 when from the seed library
  stream: Stream;
  name: string;
  do: string;               // what to do each session
  tests: string;            // what this experiment tests
  unit: string;             // the minimum unit, e.g. "one 100-word fragment"
  portable: boolean;        // can it come on a trip
  source?: string;          // where the idea comes from (seed experiments)
  custom: boolean;          // user-authored
  archived: boolean;
}

type Season = "normal" | "travel" | "newborn";

interface Trial {
  id: string;
  number: number;           // 1, 2, 3...
  startDate: string;        // day 1
  lengthDays: number;       // default 21
  experimentIds: string[];  // 2..4 active experiments
  status: "active" | "closed";
  verdicts?: Record<string, "keep" | "cut" | "extend">;
  replacements?: Record<string, string>;   // cut experimentId -> the experiment that replaced it
  closedAt?: string;
}

interface Draw {
  id: string;
  trialId: string;
  date: string;             // one per calendar day per trial
  experimentId: string;     // what was drawn
  weights: Record<string, number>;   // the weights used, for transparency
  rerolledFrom?: string;    // experimentId if the user rerolled once
  passedTo?: string;        // experimentId if the user passed to another
}

type SessionOrigin = "drawn" | "passed-to" | "unprompted" | "rerolled";

interface Session {
  id: string;
  trialId: string;
  experimentId: string;
  date: string;
  startedAt: string;
  minutes: number;
  pull: 1 | 2 | 3 | 4 | 5;         // how much you wanted to start
  thoughtAboutIt: boolean;          // thought about it off the clock since last session
  origin: SessionOrigin;
  nextNote: string;                 // one line: what to pick up next time
  attachment?: Attachment;
}

interface Attachment {
  kind: "text" | "image" | "audio";
  text?: string;
  blob?: Blob;              // stored in Dexie
  mime?: string;
  name?: string;
}

interface Settings {
  id: "settings";
  season: Season;
  floorPerWeek: Record<Season, number>;   // sessions per experiment per week; default normal 2, travel 1, newborn 0
  nudgeTime?: string;                     // "HH:MM" local, optional single daily nudge
  onboarded: boolean;
  seasonLog?: { date: string; season: Season }[];  // season changes, so past weeks keep their floor
}
```

Derived (never stored): next note per experiment = `nextNote` of its most recent session. Weekly floor status. Review stats. Streaks in weeks.

## The daily draw

The draw happens at the first app open of a calendar day for the active trial and is locked for the day. The Today screen leads with the drawn experiment and its next note.

Weights, computed in `src/domain/draw.ts` as a pure function `computeWeights(ctx)` and `drawExperiment(ctx, rng)`:

1. Every active experiment starts at weight 1.
2. Drawn yesterday: multiply by 0.4.
3. Fairness: `expected = dayIndex / activeCount`, `deficit = expected - timesDrawnSoFar`. Add `max(0, deficit) * 0.5`.
4. Behind the weekly floor this week: add 1.
5. Travel season and not portable: weight 0. If all weights are 0, fall back to uniform.
6. Newborn season: same weights, but the UI presents the draw as an offer, hides Pass, and nothing counts against the user.

The RNG is injectable so tests are deterministic.

Pass: the user may skip the draw and pick a different active experiment. The draw records `passedTo`. A session logged on the passed-to experiment has origin `passed-to`. Passing is measured, never punished: it does not change weights.

Reroll: once per day. If the drawn experiment is impossible today, reroll from the remaining experiments. Recorded as `rerolledFrom`. Does not count as a pass.

A second session on the same day on any experiment is free choice and gets origin `unprompted` unless it is on the drawn experiment.

## Floor, weeks, seasons

- The floor is sessions per experiment per week. Defaults: normal 2, travel 1, newborn 0.
- Weeks are trial-relative: days 1 to 7, 8 to 14, 15 to 21.
- The app only reports cleared or not cleared. Sessions above the floor display as bonus, never as a missed target.
- Streaks count consecutive weeks where every active experiment cleared its floor. Newborn weeks never break a streak.
- Season is a global setting with three values. Travel surfaces portable experiments and zero-weights the rest. Newborn drops the floor to 0 and hides Pass.
- Season changes are logged by date in `Settings.seasonLog` so a past week is judged by the season it actually had. If the season changed during a week, the lowest floor among those seasons applies, and any newborn day makes the whole week a newborn week.
- Newborn weeks are neutral for streaks: they neither break nor extend one. Only completed weeks count toward a streak; the current week joins once it ends. Streaks are per trial.
- In a travel week, non-portable experiments are resting and have no floor (they cannot be drawn, so they are never measured against one).
- A planned length that is not a multiple of 7 ends on a short week whose floor scales with its length, rounded up. A trial that runs past its length continues in full 7-day weeks.
- The floor per season is editable from 0 to 7.

## Trial lifecycle

- A trial has 2 to 4 experiments and a length (default 21 days).
- On the last day (and after), Today shows "Close this trial". The Trial screen offers "Close trial early" at any time, behind an in-page confirm. Both open the verdict screen: for each experiment, the stats strip plus Keep, Cut, or Extend. Cut opens the library to pick a replacement. Every cut needs a replacement, so the next trial has as many experiments as this one. Confirming closes the trial (status, verdicts, replacements, closedAt) and opens the next one, starting today with the default length, with kept, extended, and replacement experiments in the old order. Extend keeps the experiment with its history visible in the new trial (marked "Extended from trial N" on the Trial screen; next notes carry across trials).
- Closed trials remain readable in Review.

## Screens

1. **Today.** Day N of L, season badge. The drawn experiment as a large card: name, stream, the next note, buttons Start session, Pass (hidden in newborn), Reroll (once). Below, the other active experiments collapsed, each with its next note and a Log session button (origin unprompted). A thin weekly floor strip per experiment. A "Why this one" disclosure that shows the weights.
2. **Log session.** Minutes (timer or manual), pull 1 to 5 with labels (dreaded it, meh, fine, wanted to, could not wait), "Thought about it since last time?" yes/no, attachment (text snippet, image, or audio file), next note. Save. Target: 30 seconds.
3. **Trial.** Active experiments, days remaining, 21-day grid showing each day's draw colored by stream with a mark for logged sessions and passes. Fairness count (days drawn per experiment). Close trial early.
4. **Review.** Per trial: for each experiment, sessions, average pull, unprompted sessions, thought-about-it rate, passes, floor weeks cleared. A work grid of attachments. Charts: thin bars, one series color per stream, legend, direct labels, hover tooltips, and a table view toggle. Export JSON and Markdown.
5. **Library.** Sixty seed experiments plus custom ones. Filter by stream, portable, search. Add to trial (max 4 active), create custom, archive.
6. **Settings.** Season, floor per season, nudge time, export, reset.

## Phases

### Phase 1: usable in a weekend
Scaffold, domain model, Dexie schema, seed import on first run, onboarding (pick 2 to 4 experiments to start trial 1), Today with daily draw + Pass + Reroll, Log session, next notes, Library (browse, filter, add to trial), basic Trial screen with the day grid. Both themes. Integration tests: onboarding creates a trial; the draw locks for the day; logging a session updates the next note; passing records `passedTo`; reroll works once.

### Phase 2: the signal
Weighted draw with fairness and floor boosts, weekly floor strip, streaks by week, seasons (travel filter, newborn mode), verdict flow and trial rollover, the optional single daily nudge (Notification API, permission asked only when the user sets a time), Settings screen. Integration tests: weights behave per spec with an injected RNG; travel zero-weights non-portable; newborn hides Pass and never breaks a streak; verdict flow opens trial 2 with the right experiments.

The nudge fires only while the app is open (no service worker push yet). The app checks the clock every 15 seconds and on visibility change, and fires once per day from the chosen minute through a 10-minute grace window, so a throttled background tab still gets it but opening the app hours later does not fire a stale nudge.

As built, with these deliberate choices:

- Past weeks are judged against the roster the trial had then, not today's. Each stored draw's `weights` keys record which experiments were in the trial that day, so an experiment counts as in the trial during a week when it appears in the weights of at least one draw dated inside that week. A week with no draws falls back to the current roster, and the week in progress also includes the current roster, so an experiment added after today's draw belongs to this week. This applies to streaks, the floor strip, and floor weeks cleared in stats and Review. An experiment added mid-trial shows blank pills for the weeks before it joined ("not in the trial yet") and never counts against the streak for them. One removed from the trial still needs its floor in the weeks it was in, and those weeks still count in its Review history.

### Phase 3: the payoff
Attachments (text, image, audio) stored in Dexie, work grid in Review, review charts and table view, export JSON and Markdown, PWA manifest + service worker (vite-plugin-pwa) for offline install, custom experiments, archive. Integration tests: attachments round-trip; export contains every session; review numbers match a hand-computed fixture.

As built, with these deliberate choices:

- One attachment per session. A session with an image or audio file keeps the text snippet on the same attachment as `text`, so the work grid shows the photo or recording with its caption. Files are checked before saving: image or audio only, up to 25 MB, with a plain sentence when one does not fit.
- The draw's "behind the weekly floor" boost uses the same week floor as the floor strip (`DrawContext.weekFloors`, from `weekFloor` in `src/domain/floor.ts`): the lowest floor if the season changed mid-week, a short final week scaled, a resting experiment at 0. The season's flat floor is only the fallback.
- Stats add `passedToSessions` (sessions logged after passing to the experiment, a positive signal), and the stats strip on the verdict screen and in Review also shows minutes and days drawn.
- Review reads a closed trial as of the day it closed, so weeks after it never count. It lists the trial's roster, plus any experiment that has sessions in the trial but left the roster.
- Custom experiments can be deleted only when no trial refers to them (roster, verdict, or replacement) and no session uses them; otherwise they can only be archived. An experiment in the active trial cannot be archived until it is removed from the trial. Archived experiments are hidden from onboarding, the Library (unless "Show archived" is on), and the replacement picker.
- Exports leave image and audio blobs out and keep their kind, type, name, and size. Markdown lists sessions oldest first under each trial.
- Reset deletes the Dexie database and reloads the page, which seeds the library again and lands on onboarding.
- The service worker precaches the app shell and caches the Google Fonts after the first online visit. It registers only in production builds.

## Standards (mandatory)

- Never use em dashes in any output: UI copy, code comments, commits, docs. Use commas, periods, or restructure.
- Field titles and labels are never greyed out. Labels use `--color-text` or `--color-text-secondary`. `--color-text-muted` is only for genuinely tertiary hints and must still be legible on the dark theme.
- Both themes, equal care. Every color is a token on `:root`, redefined under `@media (prefers-color-scheme: dark)` and under `:root[data-theme="dark"]`. `body` has an explicit token background. Form controls follow `color-scheme`.
- Phone first. 16px gutters, no horizontal scroll, large tap targets (44px).
- Copy: active voice, short sentences, buttons say what they do. Never frame a thin week as failure. No "you missed", no red for a missed floor.
- Charts: thin marks (bars 24px max, 4px rounded data end), 2px surface gap, legend for 2+ series, text in text tokens never series colors, hover tooltips, a table view. Stream colors: writing blue (`#2a78d6` light / `#3987e5` dark), piano orange (`#eb6834` / `#d95926`), production aqua (`#1baf7a` / `#199e70`).
- Domain logic in pure functions with unit tests. Integration tests through the real UI against fake IndexedDB.
- Commit messages: short imperative subject, body explains why. End with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

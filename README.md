# Out of My Head

A local-first PWA that runs three-week experiments on a creative practice and helps you read the results. Each day it draws one experiment from the active trial, shows the note you left yourself last time, and lets you log a session in about thirty seconds. It answers two questions: what should I work on today, and is this one pulling me back?

There is no backend and no account. Everything lives in IndexedDB on the device (via Dexie). The product spec, the source of truth for the domain model, the draw algorithm, and the screens, is in [`docs/SPEC.md`](docs/SPEC.md). The sixty seed experiments live in [`seed/experiments.json`](seed/experiments.json) and are imported on first run.

## Run it

Requires Node 22.12 or newer and npm.

```sh
npm install
npm run dev       # Vite dev server
npm run build     # typecheck and production build into dist/
npm run preview   # serve the production build
```

## Test it

```sh
npm test            # Vitest, once
npm run test:watch  # Vitest, watching
npm run lint        # eslint, zero warnings allowed
npm run typecheck   # tsc
npm run check       # typecheck, lint, and tests; must pass before any commit
```

- Pure domain logic in `src/domain/` (draw weights, dates, next notes, session origin, seasons, weekly floor and streaks, trial stats, verdict roster, nudge timing) has unit tests next to each module.
- Integration tests in `src/test/` render the real `<App />` against a fresh `fake-indexeddb` database per test and drive it through the UI with Testing Library.
- The current time and the draw's random source are injectable (`src/lib/clock.ts`, `src/lib/random.ts`) so tests control "today" and which experiment is drawn. The day rollover (`useToday`) and the nudge scheduler (`useNudge`) read that clock on an interval, so tests drive them with fake intervals.

CI runs `npm ci && npm run check` on Node 22 for every push and pull request (`.github/workflows/check.yml`).

## Layout

```
src/
  domain/     types, draw, dates, notes, origin, seasons, floor, stats, verdict, nudge (pure, unit tested)
  db/         Dexie schema and first-run seed import
  state/      useAppStore (one Dexie live query), actions (writes), useToday, useNudge
  lib/        injectable clock and rng, Notification seam
  screens/    Onboarding, Today, LogSession, TrialScreen, Library, Settings, Verdict
  components/ shared UI pieces
  styles/     tokens.css (every color, both themes), base.css, screens.css
  test/       integration tests and setup
```

## Status

- **Phase 1, usable in a weekend: done.** Scaffold, domain model, Dexie schema, seed import, onboarding, Today with the locked daily draw, Pass and Reroll, Log session with a timer and a text snippet, next notes, Library with filter, search, and add or remove from trial (2 to 4 active), Trial screen with the day grid, light and dark themes. The full weighted draw (yesterday, fairness, weekly floor, travel zero weights, uniform fallback) is already implemented in `src/domain/draw.ts`.
- **Phase 2, the signal: done.** Weighted draw verified against the spec with more unit tests. Weekly floor strip on Today and Trial (cleared with bonus, progress in the current week, "n done" with no floor, never red, never "missed"). Streaks by week on Trial, with newborn weeks neutral. Settings tab: season (Normal, Travel, Newborn), floor per season (0 to 7), and the optional daily nudge. Travel marks non-portable experiments as resting and zero-weights them from the next draw. Verdict flow with a stats strip per experiment (sessions, average pull, unprompted, thought-about-it rate, passes, floor weeks cleared), Keep, Cut with a library replacement, or Extend, then rollover into the next trial. The day rolls over at midnight while the app stays open. Seed sources show in the Library. Settings export and reset come with Phase 3.
- **Phase 3, the payoff: not started.** Image and audio attachments, Review with charts and the work grid, export, offline install via service worker, custom experiments, archive.

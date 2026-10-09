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

- Pure domain logic in `src/domain/` (draw weights, dates, next notes, session origin) has unit tests next to each module.
- Integration tests in `src/test/` render the real `<App />` against a fresh `fake-indexeddb` database per test and drive it through the UI with Testing Library.
- The current time and the draw's random source are injectable (`src/lib/clock.ts`, `src/lib/random.ts`) so tests control "today" and which experiment is drawn.

CI runs `npm ci && npm run check` on Node 22 for every push and pull request (`.github/workflows/check.yml`).

## Layout

```
src/
  domain/     types, draw weights, dates, notes, origin (pure, unit tested)
  db/         Dexie schema and first-run seed import
  state/      useAppStore (one Dexie live query) and actions (writes)
  lib/        injectable clock and rng
  screens/    Onboarding, Today, LogSession, TrialScreen, Library
  components/ shared UI pieces
  styles/     tokens.css (every color, both themes), base.css, screens.css
  test/       integration tests and setup
```

## Status

- **Phase 1, usable in a weekend: done.** Scaffold, domain model, Dexie schema, seed import, onboarding, Today with the locked daily draw, Pass and Reroll, Log session with a timer and a text snippet, next notes, Library with filter, search, and add or remove from trial (2 to 4 active), Trial screen with the day grid, light and dark themes. The full weighted draw (yesterday, fairness, weekly floor, travel zero weights, uniform fallback) is already implemented in `src/domain/draw.ts`.
- **Phase 2, the signal: not started.** Weekly floor strip, streaks, season switching in Settings, newborn and travel UI, verdict flow and trial rollover, the daily nudge.
- **Phase 3, the payoff: not started.** Image and audio attachments, Review with charts and the work grid, export, offline install via service worker, custom experiments, archive.

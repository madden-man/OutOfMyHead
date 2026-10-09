# Out of My Head

A local-first PWA that runs three-week experiments on a creative practice and reads the results. Read `docs/SPEC.md` before any work. It is the source of truth for the domain model, the daily draw algorithm, the screens, the phases, and the standards.

## Commands

- `npm run dev` starts Vite.
- `npm run check` runs typecheck, lint, and tests. It must pass before any commit.
- `npm test` runs Vitest once. `npm run test:watch` watches.

## Rules

- No em dashes anywhere (UI copy, comments, commits, docs).
- Labels are never muted grey. Use `--color-text` or `--color-text-secondary`.
- Both themes get equal care. Every color is a token. Check dark mode.
- Domain logic lives in `src/domain/` as pure functions with unit tests. UI behavior is covered by integration tests that render `<App />` against `fake-indexeddb`.
- Copy never frames a thin week as failure.
- Keep the seed library in `seed/experiments.json` as the one source for the 60 experiments. Import it, do not copy it.

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../App";
import { db } from "../db/db";
import { addDays } from "../domain/dates";
import type { Session } from "../domain/types";
import { setClock } from "../lib/clock";
import { setRng } from "../lib/random";

export const WORLD = "The 100-word world";
export const TUNE = "One tune, three weeks";
export const UGLY = "The ugly-beat sprint";

/** Fix "now" to a local date and time. Month is 1-based here. */
export function setToday(year: number, month: number, day: number, hour = 9): void {
  setClock(() => new Date(year, month - 1, day, hour, 0, 0));
}

export function setRandom(value: number): void {
  setRng(() => value);
}

export function renderApp() {
  const user = userEvent.setup();
  const view = render(<App />);
  return { user, ...view };
}

/** Render the app and finish onboarding with the given experiments. */
export async function onboard(names: string[] = [WORLD, TUNE, UGLY]) {
  const app = renderApp();
  await screen.findByRole("button", { name: "Start trial 1" });
  for (const name of names) {
    await app.user.click(screen.getByRole("button", { name: `Pick ${name}` }));
  }
  await app.user.click(screen.getByRole("button", { name: "Start trial 1" }));
  await screen.findByRole("heading", { level: 1, name: /Day 1 of 21/ });
  return app;
}

/** The name shown on today's draw card once the draw exists. */
export async function drawnName(): Promise<string> {
  const heading = await screen.findByRole("heading", { level: 2, name: (_, el) => el.id === "draw-name" });
  return heading.textContent ?? "";
}

export function drawCard(): HTMLElement {
  const heading = document.getElementById("draw-name");
  const card = heading?.closest("section");
  if (!card) throw new Error("No draw card");
  return card;
}

export function inDrawCard() {
  return within(drawCard());
}

export const ERASURE = "Erasure";

/** The id of a library experiment by name. */
export async function idOf(name: string): Promise<string> {
  const e = (await db.experiments.toArray()).find((x) => x.name === name);
  if (!e) throw new Error(`No experiment named ${name}`);
  return e.id;
}

let sessionSeq = 0;

/**
 * Store sessions directly, one per (day, experiment), for history a test
 * needs before it drives the UI. Days are 1-based trial days.
 */
export async function addSessions(names: string[], days: number[]): Promise<void> {
  const trial = await db.trials.where("status").equals("active").first();
  if (!trial) throw new Error("No active trial");
  const rows: Session[] = [];
  for (const name of names) {
    const experimentId = await idOf(name);
    for (const d of days) {
      const date = addDays(trial.startDate, d - 1);
      rows.push({
        id: `seeded-${sessionSeq++}`,
        trialId: trial.id,
        experimentId,
        date,
        startedAt: `${date}T08:00:00.000Z`,
        minutes: 10,
        pull: 4,
        thoughtAboutIt: true,
        origin: "unprompted",
        nextNote: `Pick up ${name} after day ${d}`,
      });
    }
  }
  await db.sessions.bulkAdd(rows);
}

/** The floor strip pills for one experiment, by their visible text. */
export function floorLabels(name: string): string[] {
  const strip = screen.getAllByRole("list", { name: `Weekly floor for ${name}` })[0];
  if (!strip) throw new Error(`No floor strip for ${name}`);
  return within(strip)
    .getAllByRole("listitem")
    .map((li) => li.textContent ?? "");
}

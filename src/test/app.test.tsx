import { act, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { db } from "../db/db";
import { addToTrial } from "../state/actions";
import { TUNE, UGLY, WORLD, drawnName, inDrawCard, onboard, renderApp, setRandom, setToday } from "./helpers";

async function logSessionThroughUi(
  user: Awaited<ReturnType<typeof onboard>>["user"],
  opts: { minutes: string; pull: string; thought: "Yes" | "No"; note: string; snippet?: string },
) {
  await screen.findByRole("heading", { level: 1, name: "Log session" });
  await user.type(screen.getByLabelText("Minutes"), opts.minutes);
  await user.click(screen.getByRole("radio", { name: opts.pull }));
  await user.click(screen.getByRole("radio", { name: opts.thought }));
  await user.type(screen.getByLabelText("Next note"), opts.note);
  if (opts.snippet) await user.type(screen.getByLabelText(/Snippet/), opts.snippet);
  await user.click(screen.getByRole("button", { name: "Save session" }));
  await screen.findByRole("heading", { level: 1, name: /Day \d+ of 21/ });
}

describe("Out of My Head", () => {
  it("onboarding creates trial 1 and lands on Today", async () => {
    setToday(2026, 10, 8);
    setRandom(0);
    renderApp();

    expect(await screen.findByRole("heading", { level: 1, name: /Three weeks/ })).toBeInTheDocument();
    const start = screen.getByRole("button", { name: "Start trial 1" });
    expect(start).toBeDisabled();

    await onboardFromHere([WORLD, TUNE]);

    const trials = await db.trials.toArray();
    expect(trials).toHaveLength(1);
    const [trial] = trials;
    expect(trial).toMatchObject({ number: 1, startDate: "2026-10-08", lengthDays: 21, status: "active" });
    expect(trial?.experimentIds).toHaveLength(2);
    expect(await db.settings.get("settings")).toMatchObject({ onboarded: true });
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
    expect([WORLD, TUNE]).toContain(await drawnName());
  });

  it("stores the draw and shows the same experiment after a remount on the same day", async () => {
    setToday(2026, 10, 8);
    setRandom(0.99);
    const app = await onboard();
    const first = await drawnName();
    expect(first).toBe(UGLY);
    await waitFor(async () => expect(await db.draws.count()).toBe(1));

    app.unmount();
    setRandom(0);
    setToday(2026, 10, 8, 21);
    renderApp();
    expect(await drawnName()).toBe(first);
    expect(await db.draws.count()).toBe(1);

    const [draw] = await db.draws.toArray();
    expect(draw?.date).toBe("2026-10-08");
    expect(Object.keys(draw?.weights ?? {})).toHaveLength(3);
  });

  it("draws again on the next calendar day", async () => {
    setToday(2026, 10, 8);
    setRandom(0.3);
    const app = await onboard();
    expect(await drawnName()).toBe(WORLD);
    app.unmount();

    setToday(2026, 10, 9);
    renderApp();
    expect(await screen.findByRole("heading", { level: 1, name: "Day 2 of 21" })).toBeInTheDocument();
    await waitFor(async () => expect(await db.draws.count()).toBe(2));
    // Yesterday's draw is weighted down, so the same rng value lands elsewhere.
    expect(await drawnName()).toBe(TUNE);
    const world = (await db.experiments.toArray()).find((e) => e.name === WORLD);
    const today = (await db.draws.toArray()).find((d) => d.date === "2026-10-09");
    const weights = today?.weights ?? {};
    expect(weights[world?.id ?? ""]).toBe(1.4);
    expect(Object.values(weights).filter((w) => w === 2.167)).toHaveLength(2);
  });

  it("logging a session updates the next note on Today", async () => {
    setToday(2026, 10, 8);
    setRandom(0);
    const { user } = await onboard();
    expect(await drawnName()).toBe(WORLD);
    expect(inDrawCard().getByText(/No note yet/)).toBeInTheDocument();

    await user.click(inDrawCard().getByRole("button", { name: "Start session" }));
    await logSessionThroughUi(user, {
      minutes: "15",
      pull: "Wanted to",
      thought: "Yes",
      note: "Describe the ferry at night",
      snippet: "The ferryman counts in a language nobody else remembers.",
    });

    expect(await inDrawCard().findByText("Describe the ferry at night")).toBeInTheDocument();
    expect(inDrawCard().getByText(/Logged today: 1 session, 15 min/)).toBeInTheDocument();

    const [session] = await db.sessions.toArray();
    expect(session).toMatchObject({
      minutes: 15,
      pull: 4,
      thoughtAboutIt: true,
      origin: "drawn",
      date: "2026-10-08",
      nextNote: "Describe the ferry at night",
      attachment: { kind: "text", text: "The ferryman counts in a language nobody else remembers." },
    });
  });

  it("an unprompted session on another experiment shows its note in the list below", async () => {
    setToday(2026, 10, 8);
    setRandom(0);
    const { user } = await onboard();
    expect(await drawnName()).toBe(WORLD);

    await user.click(screen.getByText(TUNE, { selector: ".other-name" }));
    await user.click(screen.getByRole("button", { name: `Log session for ${TUNE}` }));
    await logSessionThroughUi(user, { minutes: "10", pull: "Fine", thought: "No", note: "Bridge, bars 17 to 24" });

    const other = screen.getByText(TUNE, { selector: ".other-name" }).closest("details");
    expect(other).not.toBeNull();
    expect(within(other as HTMLElement).getByText("Bridge, bars 17 to 24")).toBeInTheDocument();
    const [session] = await db.sessions.toArray();
    expect(session?.origin).toBe("unprompted");
  });

  it("Pass records passedTo and the next session is passed-to", async () => {
    setToday(2026, 10, 8);
    setRandom(0);
    const { user } = await onboard();
    expect(await drawnName()).toBe(WORLD);

    await user.click(inDrawCard().getByRole("button", { name: "Pass" }));
    await user.click(screen.getByRole("button", { name: `Pass to ${UGLY}` }));

    expect(await drawnName()).toBe(UGLY);
    expect(inDrawCard().getByText("You passed to")).toBeInTheDocument();
    expect(inDrawCard().queryByRole("button", { name: "Pass" })).not.toBeInTheDocument();
    const [draw] = await db.draws.toArray();
    expect(draw).toMatchObject({ experimentId: expect.any(String), passedTo: expect.any(String) });
    const ugly = (await db.experiments.toArray()).find((e) => e.name === UGLY);
    expect(draw?.passedTo).toBe(ugly?.id);

    await user.click(inDrawCard().getByRole("button", { name: "Start session" }));
    await logSessionThroughUi(user, { minutes: "20", pull: "Meh", thought: "No", note: "Bounce it" });

    const [session] = await db.sessions.toArray();
    expect(session).toMatchObject({ experimentId: ugly?.id, origin: "passed-to" });
  });

  it("Reroll works once and then the button disappears", async () => {
    setToday(2026, 10, 8);
    setRandom(0);
    const app = await onboard();
    expect(await drawnName()).toBe(WORLD);

    await app.user.click(inDrawCard().getByRole("button", { name: "Reroll" }));
    await waitFor(async () => expect(await drawnName()).toBe(TUNE));
    expect(inDrawCard().queryByRole("button", { name: "Reroll" })).not.toBeInTheDocument();
    expect(inDrawCard().getByText(`Rerolled from ${WORLD}.`)).toBeInTheDocument();

    const [draw] = await db.draws.toArray();
    const world = (await db.experiments.toArray()).find((e) => e.name === WORLD);
    expect(draw?.rerolledFrom).toBe(world?.id);
    expect(draw?.passedTo).toBeUndefined();

    app.unmount();
    renderApp();
    expect(await drawnName()).toBe(TUNE);
    expect(inDrawCard().queryByRole("button", { name: "Reroll" })).not.toBeInTheDocument();

    await app.user.click(inDrawCard().getByRole("button", { name: "Start session" }));
    await logSessionThroughUi(app.user, { minutes: "5", pull: "Could not wait", thought: "Yes", note: "Next chorus" });
    const [session] = await db.sessions.toArray();
    expect(session?.origin).toBe("rerolled");
  });

  it("Reroll draws from the trial as it stands, not the roster at draw time", async () => {
    setToday(2026, 10, 8);
    setRandom(0);
    const app = await onboard();
    expect(await drawnName()).toBe(WORLD);

    await app.user.click(screen.getByRole("button", { name: "Library" }));
    await screen.findByRole("heading", { level: 1, name: "Library" });
    await app.user.click(screen.getByRole("button", { name: `Remove ${TUNE} from trial` }));
    await app.user.click(await screen.findByRole("button", { name: "Add Erasure to trial" }));
    await screen.findByText(/3 of 4 in this trial/);

    await app.user.click(screen.getByRole("button", { name: "Today" }));
    await app.user.click(await inDrawCard().findByRole("button", { name: "Reroll" }));
    await waitFor(async () => expect(await drawnName()).toBe(UGLY));

    const [draw] = await db.draws.toArray();
    const byName = new Map((await db.experiments.toArray()).map((e) => [e.name, e.id]));
    expect(Object.keys(draw?.weights ?? {}).sort()).toEqual(
      [byName.get(WORLD), byName.get(UGLY), byName.get("Erasure")].sort(),
    );
  });

  it("Library caps the trial at 4 active experiments", async () => {
    setToday(2026, 10, 8);
    setRandom(0);
    const { user } = await onboard();

    await user.click(screen.getByRole("button", { name: "Library" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Library" })).toBeInTheDocument();
    expect(screen.getByText(/3 of 4 in this trial/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add Letters to your kid to trial" }));
    expect(await screen.findByText(/4 of 4 in this trial/)).toBeInTheDocument();

    const addButtons = screen.getAllByRole("button", { name: /^Add .* to trial$/ });
    expect(addButtons).toHaveLength(56);
    for (const b of addButtons) expect(b).toBeDisabled();

    let result: Awaited<ReturnType<typeof addToTrial>> | undefined;
    const extra = (await db.experiments.toArray()).find((e) => e.name === "Erasure");
    await act(async () => {
      result = await addToTrial(extra?.id ?? "");
    });
    expect(result).toEqual({ ok: false, reason: "full" });
    expect((await db.trials.toArray())[0]?.experimentIds).toHaveLength(4);

    await user.click(screen.getByRole("button", { name: "Remove Letters to your kid from trial" }));
    expect(await screen.findByText(/3 of 4 in this trial/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Erasure to trial" })).toBeEnabled();
  });

  it("Library filters by stream, portable, and search", async () => {
    setToday(2026, 10, 8);
    setRandom(0);
    const { user } = await onboard();
    await user.click(screen.getByRole("button", { name: "Library" }));
    await screen.findByRole("heading", { level: 1, name: "Library" });
    expect(screen.getByText("60 experiments")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Production" }));
    expect(screen.getByText("20 experiments")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Portable only" }));
    expect(screen.getByText("2 experiments")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "All" }));
    await user.type(screen.getByRole("searchbox", { name: "Search experiments" }), "postcard");
    expect(screen.getByText("1 experiment")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Trip postcards" })).toBeInTheDocument();
  });

  it("Trial shows the day grid with marks for sessions and passes", async () => {
    setToday(2026, 10, 8);
    setRandom(0);
    const { user } = await onboard();
    await drawnName();
    await user.click(inDrawCard().getByRole("button", { name: "Pass" }));
    await user.click(screen.getByRole("button", { name: `Pass to ${TUNE}` }));
    await user.click(inDrawCard().getByRole("button", { name: "Start session" }));
    await logSessionThroughUi(user, { minutes: "12", pull: "Fine", thought: "No", note: "Slow it down" });

    await user.click(screen.getByRole("button", { name: "Trial" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Trial 1" })).toBeInTheDocument();
    expect(screen.getByText(/20 days remaining/)).toBeInTheDocument();
    const days = screen.getAllByRole("listitem").filter((li) => li.classList.contains("day"));
    expect(days).toHaveLength(21);
    const today = days[0];
    expect(today).toHaveClass("stream-writing", "is-today");
    expect(today?.getAttribute("aria-label")).toBe(`Day 1, ${formatShort(2026, 10, 8)}, drew ${WORLD}, passed to ${TUNE}, 1 session`);
    expect(today?.querySelector(".mark-session")).not.toBeNull();
    expect(today?.querySelector(".mark-pass")).not.toBeNull();
    expect(days[1]).toHaveClass("is-future");
  });

  it("Trial keeps drawing the grid past the planned length, in full weeks", async () => {
    setToday(2026, 10, 8);
    setRandom(0);
    const app = await onboard();
    await drawnName();
    app.unmount();

    // Day 25: four days past the planned 21.
    setToday(2026, 11, 1);
    const { user } = renderApp();
    expect(await screen.findByRole("heading", { level: 1, name: "Day 25" })).toBeInTheDocument();
    await drawnName();
    await user.click(screen.getByRole("button", { name: "Trial" }));
    expect(await screen.findByText(/Day 25, past the planned 21\./)).toBeInTheDocument();
    expect(screen.queryByText(/last planned day/)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "The 25 days so far" })).toBeInTheDocument();
    const days = screen.getAllByRole("listitem").filter((li) => li.classList.contains("day"));
    expect(days).toHaveLength(28);
    expect(days[24]).toHaveClass("is-today", "is-drawn");
    expect(days[27]).toHaveClass("is-future");

    await user.click(screen.getByRole("button", { name: "Review" }));
    expect(await screen.findByText(/day 25, 21 planned\./)).toBeInTheDocument();
  });
});

function formatShort(y: number, m: number, d: number): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(y, m - 1, d));
}

async function onboardFromHere(names: string[]) {
  const { default: userEvent } = await import("@testing-library/user-event");
  const user = userEvent.setup();
  for (const name of names) await user.click(screen.getByRole("button", { name: `Pick ${name}` }));
  await user.click(screen.getByRole("button", { name: "Start trial 1" }));
  await screen.findByRole("heading", { level: 1, name: "Day 1 of 21" });
}

import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "../db/db";
import { setClock } from "../lib/clock";
import { NUDGE_CHECK_MS } from "../state/useNudge";
import {
  ERASURE,
  TUNE,
  UGLY,
  WORLD,
  addSessions,
  drawnName,
  floorLabels,
  idOf,
  inDrawCard,
  onboard,
  renderApp,
  setRandom,
  setToday,
} from "./helpers";

type User = Awaited<ReturnType<typeof onboard>>["user"];

async function openTab(user: User, name: "Today" | "Trial" | "Library" | "Settings") {
  await user.click(screen.getByRole("button", { name }));
  if (name === "Today") await screen.findByRole("heading", { level: 1, name: /^Day \d+/ });
  else if (name === "Trial") await screen.findByRole("heading", { level: 1, name: /^Trial \d+/ });
  else await screen.findByRole("heading", { level: 1, name });
}

async function chooseSeason(user: User, season: "Normal" | "Travel" | "Newborn") {
  await openTab(user, "Settings");
  await user.click(screen.getByRole("radio", { name: season }));
  await waitFor(async () =>
    expect((await db.settings.get("settings"))?.season).toBe(season.toLowerCase()),
  );
}

function otherSummary(name: string): HTMLElement {
  const summary = screen.getByText(name, { selector: ".other-name" }).closest("summary");
  if (!summary) throw new Error(`No summary for ${name}`);
  return summary;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("Phase 2: seasons", () => {
  it("travel rests non-portable experiments and the next draw never picks them", async () => {
    setToday(2026, 10, 8);
    setRandom(0.5);
    const app = await onboard([WORLD, TUNE, UGLY]);
    expect(await drawnName()).toBe(TUNE);
    const todayDraw = (await db.draws.toArray())[0];

    await chooseSeason(app.user, "Travel");
    await openTab(app.user, "Today");
    // Today's draw stays locked, even though Tune is not portable.
    expect(await drawnName()).toBe(TUNE);
    expect((await db.draws.toArray())[0]).toEqual(todayDraw);
    expect(screen.getByText("Travel season")).toBeInTheDocument();
    expect(within(otherSummary(UGLY)).getByText("Resting")).toBeInTheDocument();
    expect(within(otherSummary(WORLD)).queryByText("Resting")).not.toBeInTheDocument();

    app.unmount();
    setToday(2026, 10, 9);
    // 0.99 would land on the last experiment in a uniform or normal draw.
    setRandom(0.99);
    renderApp();
    await screen.findByRole("heading", { level: 1, name: "Day 2 of 21" });
    await waitFor(async () => expect(await db.draws.count()).toBe(2));
    expect(await drawnName()).toBe(WORLD);

    const draw = (await db.draws.toArray()).find((d) => d.date === "2026-10-09");
    const [world, tune, ugly] = await Promise.all([idOf(WORLD), idOf(TUNE), idOf(UGLY)]);
    expect(draw?.experimentId).toBe(world);
    expect(draw?.weights[tune]).toBe(0);
    expect(draw?.weights[ugly]).toBe(0);
    // World: 1, plus fairness (1/3 behind) * 0.5, plus 1 below the travel floor of 1.
    expect(draw?.weights[world]).toBe(2.167);
  });

  it("newborn hides Pass, offers the draw, and the floor strip shows sessions done", async () => {
    setToday(2026, 10, 8);
    setRandom(0);
    const app = await onboard([WORLD, TUNE, UGLY]);
    expect(await drawnName()).toBe(WORLD);
    expect(inDrawCard().getByRole("button", { name: "Pass" })).toBeInTheDocument();
    expect(floorLabels(WORLD)).toEqual(["0 of 2", "", ""]);

    await chooseSeason(app.user, "Newborn");
    await openTab(app.user, "Today");
    expect(inDrawCard().queryByRole("button", { name: "Pass" })).not.toBeInTheDocument();
    expect(inDrawCard().getByText("Today's offer")).toBeInTheDocument();
    expect(floorLabels(WORLD)).toEqual(["0 done", "", ""]);

    await addSessions([WORLD], [1]);
    await waitFor(() => expect(floorLabels(WORLD)).toEqual(["1 done", "", ""]));
    expect(floorLabels(TUNE)).toEqual(["0 done", "", ""]);
    expect(document.body.textContent?.toLowerCase()).not.toContain("missed");
  });

  it("newborn weeks never break a streak", async () => {
    setToday(2026, 10, 8);
    setRandom(0);
    let app = await onboard([WORLD, TUNE]);
    await addSessions([WORLD, TUNE], [1, 2]);
    app.unmount();

    // Week 2: newborn, nothing logged.
    setToday(2026, 10, 15);
    app = renderApp();
    await screen.findByRole("heading", { level: 1, name: "Day 8 of 21" });
    await chooseSeason(app.user, "Newborn");
    app.unmount();

    setToday(2026, 10, 22);
    app = renderApp();
    await screen.findByRole("heading", { level: 1, name: "Day 15 of 21" });
    await openTab(app.user, "Trial");
    // Week 1 cleared, week 2 newborn and empty: still a streak of 1.
    expect(screen.getByTestId("streak")).toHaveTextContent("1 week");
    expect(floorLabels(WORLD)).toEqual(["Cleared", "0 done", "0 done"]);
  });

  it("settings keep each floor between 0 and 7", async () => {
    setToday(2026, 10, 8);
    setRandom(0);
    const app = await onboard();
    await openTab(app.user, "Settings");
    const lower = screen.getByRole("button", { name: "Lower the newborn floor" });
    expect(lower).toBeDisabled();
    const raise = screen.getByRole("button", { name: "Raise the travel floor" });
    for (let i = 0; i < 6; i++) await app.user.click(raise);
    await waitFor(async () => expect((await db.settings.get("settings"))?.floorPerWeek.travel).toBe(7));
    expect(raise).toBeDisabled();
  });
});

describe("Phase 2: floor and streaks", () => {
  it("shows a streak of 2 when every floor cleared for two weeks", async () => {
    setToday(2026, 10, 8);
    setRandom(0);
    let app = await onboard([WORLD, TUNE]);
    await addSessions([WORLD, TUNE], [1, 2, 8, 9]);
    await addSessions([WORLD], [3]);
    app.unmount();

    setToday(2026, 10, 22);
    app = renderApp();
    await screen.findByRole("heading", { level: 1, name: "Day 15 of 21" });
    expect(floorLabels(WORLD)).toEqual(["Cleared+1", "Cleared", "0 of 2"]);

    await openTab(app.user, "Trial");
    expect(screen.getByTestId("streak")).toHaveTextContent("2 weeks");
    expect(floorLabels(TUNE)).toEqual(["Cleared", "Cleared", "0 of 2"]);
    const bonus = screen.getAllByRole("listitem", { name: "Week 1, cleared with 1 bonus session" });
    expect(bonus).toHaveLength(1);
  });
});

describe("Phase 2: verdict flow", () => {
  it("closing with one cut and a replacement opens trial 2 with the right roster", async () => {
    setToday(2026, 10, 8);
    setRandom(0);
    let app = await onboard([WORLD, TUNE, UGLY]);
    await addSessions([WORLD], [1, 2]);
    app.unmount();

    setToday(2026, 10, 28);
    app = renderApp();
    await screen.findByRole("heading", { level: 1, name: "Day 21 of 21" });
    await app.user.click(screen.getByRole("button", { name: "Close this trial" }));
    await screen.findByRole("heading", { level: 1, name: "Close trial 1" });

    const confirm = screen.getByRole("button", { name: "Close trial 1 and start trial 2" });
    expect(confirm).toBeDisabled();

    const worldCard = screen.getByRole("article", { name: WORLD });
    expect(within(worldCard).getByText("Sessions").nextSibling).toHaveTextContent("2");
    expect(within(worldCard).getByText("Average pull").nextSibling).toHaveTextContent("4.0");
    expect(within(worldCard).getByText("Thought about it").nextSibling).toHaveTextContent("100%");
    expect(within(worldCard).getByText("Floor weeks cleared").nextSibling).toHaveTextContent("1");

    const group = (name: string) => screen.getByRole("group", { name: `What next for ${name}?` });
    await app.user.click(within(group(WORLD)).getByRole("radio", { name: "Keep" }));
    await app.user.click(within(group(TUNE)).getByRole("radio", { name: "Cut" }));
    await app.user.click(within(group(UGLY)).getByRole("radio", { name: "Extend" }));
    expect(screen.getByText(`Pick a replacement for ${TUNE}.`)).toBeInTheDocument();
    expect(confirm).toBeDisabled();

    const picker = screen.getByRole("group", { name: `Replacement for ${TUNE}` });
    await app.user.click(within(picker).getByRole("radio", { name: "Writing" }));
    expect(within(picker).queryByRole("button", { name: `Replace ${TUNE} with ${WORLD}` })).not.toBeInTheDocument();
    await app.user.type(within(picker).getByRole("searchbox"), "erasure");
    await app.user.click(within(picker).getByRole("button", { name: `Replace ${TUNE} with ${ERASURE}` }));

    expect(confirm).toBeEnabled();
    const roster = within(screen.getByRole("region", { name: "Trial 2" })).getAllByRole("listitem");
    expect(roster.map((li) => li.textContent)).toEqual([WORLD, ERASURE, UGLY]);
    await app.user.click(confirm);

    await screen.findByRole("heading", { level: 1, name: "Day 1 of 21" });
    const [world, tune, ugly, erasure] = await Promise.all([idOf(WORLD), idOf(TUNE), idOf(UGLY), idOf(ERASURE)]);
    const trials = await db.trials.orderBy("number").toArray();
    expect(trials).toHaveLength(2);
    expect(trials[0]).toMatchObject({
      number: 1,
      status: "closed",
      verdicts: { [world]: "keep", [tune]: "cut", [ugly]: "extend" },
      replacements: { [tune]: erasure },
      closedAt: expect.stringMatching(/^2026-10-2/),
    });
    expect(trials[1]).toMatchObject({
      number: 2,
      status: "active",
      startDate: "2026-10-28",
      lengthDays: 21,
      experimentIds: [world, erasure, ugly],
    });
    await waitFor(async () =>
      expect((await db.draws.toArray()).filter((d) => d.trialId === trials[1]?.id)).toHaveLength(1),
    );

    await openTab(app.user, "Trial");
    expect(screen.getByRole("heading", { level: 1, name: "Trial 2" })).toBeInTheDocument();
    expect(screen.getByText("Extended from trial 1")).toBeInTheDocument();
    // History carries over: World's next note comes from trial 1.
    await openTab(app.user, "Today");
    expect(screen.getAllByText(`Pick up ${WORLD} after day 2`).length).toBeGreaterThan(0);
  });

  it("Trial offers Close trial early with an in-page confirm", async () => {
    setToday(2026, 10, 8);
    setRandom(0);
    const app = await onboard();
    expect(screen.queryByRole("button", { name: "Close this trial" })).not.toBeInTheDocument();
    await openTab(app.user, "Trial");

    await app.user.click(screen.getByRole("button", { name: "Close trial early" }));
    const confirm = screen.getByRole("group", { name: "Confirm closing early" });
    await app.user.click(within(confirm).getByRole("button", { name: "Keep going" }));
    expect(screen.queryByRole("group", { name: "Confirm closing early" })).not.toBeInTheDocument();

    await app.user.click(screen.getByRole("button", { name: "Close trial early" }));
    await app.user.click(screen.getByRole("button", { name: "Choose verdicts" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Close trial 1" })).toBeInTheDocument();
    expect(screen.getByText(/Closing on day 1 of 21/)).toBeInTheDocument();
    await app.user.click(screen.getByRole("button", { name: "Back" }));
    await screen.findByRole("heading", { level: 1, name: "Day 1 of 21" });
    expect((await db.trials.toArray())[0]?.status).toBe("active");
  });
});

describe("Phase 2: daily nudge and day rollover", () => {
  function installNotification(permission: NotificationPermission = "default") {
    const shown: { title: string; body: string | undefined }[] = [];
    class FakeNotification {
      static permission: NotificationPermission = permission;
      static requestPermission = vi.fn(async () => {
        FakeNotification.permission = "granted";
        return "granted" as const;
      });
      readonly title: string;
      constructor(title: string, options?: NotificationOptions) {
        this.title = title;
        shown.push({ title, body: options?.body });
      }
    }
    Object.defineProperty(window, "Notification", { value: FakeNotification, configurable: true, writable: true });
    return { shown, FakeNotification };
  }

  afterEach(() => {
    Reflect.deleteProperty(window, "Notification");
  });

  it("saves the nudge time, asks permission then, and fires once at the chosen minute", async () => {
    const { shown, FakeNotification } = installNotification();
    setToday(2026, 10, 8, 8);
    setRandom(0);
    const app = await onboard([WORLD, TUNE]);
    expect(await drawnName()).toBe(WORLD);
    await addSessions([WORLD], [1]);

    await openTab(app.user, "Settings");
    expect(screen.getByTestId("nudge-status")).toHaveTextContent("Off. Set a time to turn it on.");
    expect(FakeNotification.requestPermission).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Nudge time"), { target: { value: "08:30" } });
    await waitFor(async () => expect((await db.settings.get("settings"))?.nudgeTime).toBe("08:30"));
    expect(FakeNotification.requestPermission).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("On. One nudge at 08:30 each day while the app is open.")).toBeInTheDocument();
    app.unmount();

    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    let current = new Date(2026, 9, 8, 8, 29, 40);
    setClock(() => current);
    renderApp();
    expect(await drawnName()).toBe(WORLD);

    act(() => {
      vi.advanceTimersByTime(NUDGE_CHECK_MS);
    });
    expect(shown).toHaveLength(0);

    current = new Date(2026, 9, 8, 8, 30, 5);
    act(() => {
      vi.advanceTimersByTime(NUDGE_CHECK_MS);
    });
    expect(shown).toEqual([{ title: "Out of My Head", body: `Today: ${WORLD}. Pick up: Pick up ${WORLD} after day 1` }]);

    current = new Date(2026, 9, 8, 8, 31, 0);
    act(() => {
      vi.advanceTimersByTime(NUDGE_CHECK_MS * 4);
    });
    expect(shown).toHaveLength(1);
  });

  it("explains in a plain sentence when notifications are unavailable", async () => {
    setToday(2026, 10, 8);
    setRandom(0);
    const app = await onboard();
    await openTab(app.user, "Settings");
    fireEvent.change(screen.getByLabelText("Nudge time"), { target: { value: "07:15" } });
    await waitFor(async () => expect((await db.settings.get("settings"))?.nudgeTime).toBe("07:15"));
    expect(screen.getByTestId("nudge-status")).toHaveTextContent(
      "Saved for 07:15, but this browser cannot show notifications.",
    );
    await app.user.click(screen.getByRole("button", { name: "Turn off nudge" }));
    await waitFor(async () => expect((await db.settings.get("settings"))?.nudgeTime).toBeUndefined());
  });

  it("rolls over to a new day and draws when the app stays open past midnight", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    let current = new Date(2026, 9, 8, 23, 58, 0);
    setClock(() => current);
    setRandom(0.5);
    await onboard([WORLD, TUNE]);
    expect(await drawnName()).toBe(TUNE);

    current = new Date(2026, 9, 9, 0, 0, 30);
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(await screen.findByRole("heading", { level: 1, name: "Day 2 of 21" })).toBeInTheDocument();
    await waitFor(async () => expect(await db.draws.count()).toBe(2));
    await waitFor(() => expect(document.getElementById("draw-name")).toHaveTextContent(WORLD));
    const draw = (await db.draws.toArray()).find((d) => d.date === "2026-10-09");
    expect(draw?.weights).toEqual({ [await idOf(WORLD)]: 2.25, [await idOf(TUNE)]: 1.4 });
  });
});

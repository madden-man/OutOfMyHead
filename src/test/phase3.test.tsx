import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { db } from "../db/db";
import { addDays } from "../domain/dates";
import type { Draw, Session, SessionOrigin, Pull } from "../domain/types";
import { setReload } from "../lib/reload";
import { deleteExperiment } from "../state/actions";
import { TUNE, UGLY, WORLD, drawnName, idOf, inDrawCard, onboard, renderApp, setRandom, setToday } from "./helpers";

type User = Awaited<ReturnType<typeof onboard>>["user"];

async function openTab(user: User, name: "Today" | "Trial" | "Review" | "Library" | "Settings") {
  await user.click(screen.getByRole("button", { name }));
  if (name === "Today") await screen.findByRole("heading", { level: 1, name: /^Day \d+/ });
  else if (name === "Trial") await screen.findByRole("heading", { level: 1, name: /^Trial \d+/ });
  else await screen.findByRole("heading", { level: 1, name });
}

async function fillSession(user: User, note: string) {
  await screen.findByRole("heading", { level: 1, name: "Log session" });
  await user.type(screen.getByLabelText("Minutes"), "12");
  await user.click(screen.getByRole("radio", { name: "Wanted to" }));
  await user.click(screen.getByRole("radio", { name: "Yes" }));
  await user.type(screen.getByLabelText("Next note"), note);
}

/** A tiny valid PNG, so the bytes are real even though jsdom never decodes them. */
function pngFile(name = "sketch.png"): File {
  const bytes = Uint8Array.from(
    atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="),
    (c) => c.charCodeAt(0),
  );
  return new File([bytes], name, { type: "image/png" });
}

/** Read exported files: capture each Blob handed to URL.createObjectURL. */
function captureObjectUrls() {
  const blobs: Blob[] = [];
  vi.spyOn(URL, "createObjectURL").mockImplementation((obj: Blob | MediaSource) => {
    blobs.push(obj as Blob);
    return `blob:test/export-${blobs.length}`;
  });
  return blobs;
}

describe("Phase 3: attachments", () => {
  it("an image attachment round-trips into the Review work grid", async () => {
    setToday(2026, 10, 8);
    setRandom(0);
    const { user } = await onboard([WORLD, TUNE]);
    expect(await drawnName()).toBe(WORLD);

    await user.click(inDrawCard().getByRole("button", { name: "Start session" }));
    await fillSession(user, "Crop the ferry sketch");
    await user.upload(screen.getByLabelText(/Image or audio/), pngFile());
    expect(await screen.findByRole("img", { name: "Preview of sketch.png" })).toBeInTheDocument();
    expect(screen.getByText("Image, 70 bytes")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save session" }));
    await screen.findByRole("heading", { level: 1, name: "Day 1 of 21" });

    const [session] = await db.sessions.toArray();
    expect(session?.attachment).toMatchObject({ kind: "image", mime: "image/png", name: "sketch.png" });
    expect(session?.attachment?.blob?.size).toBe(70);
    expect(new Uint8Array(await (session?.attachment?.blob as Blob).arrayBuffer()).slice(1, 4)).toEqual(
      Uint8Array.from([0x50, 0x4e, 0x47]),
    );

    await openTab(user, "Review");
    const grid = screen.getByRole("list", { name: "Work from trial 1" });
    const tile = within(grid).getByRole("article", { name: /^The 100-word world, Oct 8, day 1$/ });
    const img = within(tile).getByRole("img", { name: /sketch\.png from The 100-word world/ });
    expect(img.getAttribute("src")).toMatch(/^blob:/);
  });

  it("rejects a file over 25 MB with a plain sentence and keeps the form", async () => {
    setToday(2026, 10, 8);
    setRandom(0);
    const { user } = await onboard([WORLD, TUNE]);
    await drawnName();
    await user.click(inDrawCard().getByRole("button", { name: "Start session" }));
    await fillSession(user, "Shorter take");
    const big = new File([new Uint8Array(4)], "take.m4a", { type: "audio/mp4" });
    Object.defineProperty(big, "size", { value: 26 * 1024 * 1024 });
    await user.upload(screen.getByLabelText(/Image or audio/), big);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That file is 26.0 MB. Files up to 25 MB fit; try a shorter clip or a smaller photo.",
    );
    await user.click(screen.getByRole("button", { name: "Save session" }));
    await screen.findByRole("heading", { level: 1, name: "Day 1 of 21" });
    const [session] = await db.sessions.toArray();
    expect(session?.attachment).toBeUndefined();
  });
});

describe("Phase 3: export and reset", () => {
  it("JSON export holds every session and Markdown holds each next note", async () => {
    setToday(2026, 10, 8);
    setRandom(0);
    const { user } = await onboard([WORLD, TUNE]);
    await drawnName();
    await user.click(inDrawCard().getByRole("button", { name: "Start session" }));
    await fillSession(user, "Crop the ferry sketch");
    await user.upload(screen.getByLabelText(/Image or audio/), pngFile());
    await user.click(screen.getByRole("button", { name: "Save session" }));
    await screen.findByRole("heading", { level: 1, name: "Day 1 of 21" });
    const { addSessions } = await import("./helpers");
    await addSessions([WORLD, TUNE], [1, 2]);
    const stored = await db.sessions.toArray();
    expect(stored).toHaveLength(5);

    await openTab(user, "Settings");
    const blobs = captureObjectUrls();
    await user.click(screen.getByRole("button", { name: "Export JSON" }));
    const link = await screen.findByRole("link", { name: "Download out-of-my-head-2026-10-08.json" });
    expect(link).toHaveAttribute("href", "blob:test/export-1");
    expect(link).toHaveAttribute("download", "out-of-my-head-2026-10-08.json");

    const json = JSON.parse(await (blobs[0] as Blob).text());
    expect(json.format).toBe("out-of-my-head");
    expect(json.sessions.map((s: Session) => s.id).sort()).toEqual(stored.map((s) => s.id).sort());
    expect(json.experiments).toHaveLength(60);
    expect(json.trials).toHaveLength(1);
    expect(json.draws).toHaveLength(1);
    expect(json.settings).toMatchObject({ season: "normal", onboarded: true });
    const withImage = json.sessions.find((s: Session) => s.attachment?.kind === "image");
    expect(withImage.attachment).toEqual({ kind: "image", mime: "image/png", name: "sketch.png", size: 70 });

    await user.click(screen.getByRole("button", { name: "Export Markdown" }));
    await screen.findByRole("link", { name: "Download out-of-my-head-2026-10-08.md" });
    const md = await (blobs[1] as Blob).text();
    expect(md).toContain("## Trial 1");
    expect(md).toContain(`### ${WORLD}`);
    for (const s of stored) expect(md).toContain(`Next: ${s.nextNote}`);
    expect(md).toContain("Image: sketch.png (not included in this file).");
    expect(md.match(/^- 2026-10-0\d, /gm)).toHaveLength(5);
  });

  it("Reset all data deletes the database behind a confirm and reloads to onboarding", async () => {
    setToday(2026, 10, 8);
    setRandom(0);
    const reload = vi.fn();
    setReload(reload);
    const app = await onboard([WORLD, TUNE]);
    await openTab(app.user, "Settings");

    await app.user.click(screen.getByRole("button", { name: "Reset all data" }));
    const confirm = screen.getByRole("group", { name: "Confirm reset" });
    await app.user.click(within(confirm).getByRole("button", { name: "Keep my data" }));
    expect(await db.trials.count()).toBe(1);

    window.localStorage.setItem("oomh.nudge.lastFired", "2026-10-08");
    window.localStorage.setItem("not-ours", "kept");
    await app.user.click(screen.getByRole("button", { name: "Reset all data" }));
    await app.user.click(screen.getByRole("button", { name: "Delete everything" }));
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(window.localStorage.getItem("oomh.nudge.lastFired")).toBeNull();
    expect(window.localStorage.getItem("not-ours")).toBe("kept");
    expect(await db.trials.count()).toBe(0);
    expect(await db.sessions.count()).toBe(0);

    app.unmount();
    renderApp();
    expect(await screen.findByRole("button", { name: "Start trial 1" })).toBeInTheDocument();
    expect(await db.experiments.count()).toBe(60);
  });
});

describe("Phase 3: Review numbers", () => {
  // Trial 1 starts 2026-10-08 with World and Tune, floor 2. Today is day 15.
  // World: days 1 drawn (pull 5, thought, 20 min), 2 unprompted (4, no, 10),
  //   3 passed-to (3, thought, 15), 8 drawn (2, no, 5), 9 passed-to (5, thought, 30).
  //   5 sessions, 80 min, pull 19 / 5 = 3.8, unprompted 1, passed to 2,
  //   thought 3 of 5 = 60%, passes 0, week 1 (3) and week 2 (2) cleared = 2.
  // Tune: days 2 drawn (2, no, 10), 10 unprompted (1, no, 10).
  //   2 sessions, 20 min, pull 1.5, unprompted 1, passed to 0, thought 0%,
  //   passes 2 (drawn on days 3 and 9, passed to World), no week cleared = 0.
  async function seedFixture() {
    setToday(2026, 10, 8);
    setRandom(0);
    const app = await onboard([WORLD, TUNE]);
    expect(await drawnName()).toBe(WORLD);
    const trial = await db.trials.toCollection().first();
    if (!trial) throw new Error("no trial");
    const [world, tune] = await Promise.all([idOf(WORLD), idOf(TUNE)]);
    const date = (d: number) => addDays(trial.startDate, d - 1);
    const draw = (d: number, experimentId: string, passedTo?: string): Draw => ({
      id: `fx-draw-${d}`,
      trialId: trial.id,
      date: date(d),
      experimentId,
      weights: { [world]: 1, [tune]: 1 },
      ...(passedTo ? { passedTo } : {}),
    });
    const session = (
      d: number,
      experimentId: string,
      origin: SessionOrigin,
      pull: Pull,
      thoughtAboutIt: boolean,
      minutes: number,
    ): Session => ({
      id: `fx-${d}-${experimentId}`,
      trialId: trial.id,
      experimentId,
      date: date(d),
      startedAt: `${date(d)}T08:00:00.000Z`,
      minutes,
      pull,
      thoughtAboutIt,
      origin,
      nextNote: `Note ${d}`,
    });
    await db.draws.bulkAdd([
      draw(2, tune),
      draw(3, tune, world),
      draw(8, world),
      draw(9, tune, world),
      draw(10, world),
    ]);
    await db.sessions.bulkAdd([
      session(1, world, "drawn", 5, true, 20),
      session(2, world, "unprompted", 4, false, 10),
      session(3, world, "passed-to", 3, true, 15),
      session(8, world, "drawn", 2, false, 5),
      session(9, world, "passed-to", 5, true, 30),
      session(2, tune, "drawn", 2, false, 10),
      session(10, tune, "unprompted", 1, false, 10),
    ]);
    app.unmount();
    setToday(2026, 10, 22);
    const next = renderApp();
    await screen.findByRole("heading", { level: 1, name: "Day 15 of 21" });
    return { ...next, world, tune };
  }

  function stat(card: HTMLElement, label: string): string {
    return within(card).getByText(label, { selector: "dt" }).nextSibling?.textContent ?? "";
  }

  it("matches the hand-computed fixture, in the cards, the charts, and the table", async () => {
    const { user, world, tune } = await seedFixture();
    await openTab(user, "Review");
    expect(screen.getByRole("combobox", { name: "Trial" })).toHaveDisplayValue("Trial 1, current");

    const worldCard = screen.getByRole("article", { name: WORLD });
    expect(
      ["Sessions", "Minutes", "Average pull", "Unprompted", "Passed to", "Thought about it", "Passes", "Floor weeks cleared"].map(
        (l) => stat(worldCard, l),
      ),
    ).toEqual(["5", "80", "3.8", "1", "2", "60%", "0", "2"]);
    const tuneCard = screen.getByRole("article", { name: TUNE });
    expect(
      ["Sessions", "Minutes", "Average pull", "Unprompted", "Passed to", "Thought about it", "Passes", "Floor weeks cleared"].map(
        (l) => stat(tuneCard, l),
      ),
    ).toEqual(["2", "20", "1.5", "1", "0", "0%", "2", "0"]);

    // Charts: direct labels at the tip, and full sentences for assistive tech.
    expect(screen.getByTestId(`chart-sessions-${world}`)).toHaveAccessibleName(`${WORLD}: 5 sessions, 80 min`);
    expect(screen.getByTestId(`chart-sessions-${tune}`)).toHaveTextContent("2");
    expect(screen.getByTestId(`chart-pull-${world}`)).toHaveAccessibleName(`${WORLD}: average pull 3.8 of 5`);
    expect(screen.getByTestId(`chart-pull-${tune}`)).toHaveTextContent("1.5");
    expect(screen.getByText("1 dreaded it")).toBeInTheDocument();
    expect(screen.getByText("5 could not wait")).toBeInTheDocument();
    expect(screen.getByTestId(`chart-choices-${world}-passedTo`)).toHaveTextContent("2");
    expect(screen.getByTestId(`chart-choices-${tune}-passes`)).toHaveTextContent("2");
    expect(screen.getByTestId(`chart-choices-${tune}-unprompted`)).toHaveTextContent("1");
    const legend = screen.getByRole("list", { name: "Legend" });
    expect(within(legend).getAllByRole("listitem").map((li) => li.textContent)).toEqual([WORLD, TUNE]);

    // A hover or focus tooltip is a positioned element, not a title attribute.
    const bar = screen.getByTestId(`chart-sessions-${world}`);
    expect(bar).not.toHaveAttribute("title");
    fireEvent.focus(bar);
    expect(screen.getByRole("tooltip")).toHaveTextContent(`${WORLD}: 5 sessions, 80 min`);
    expect(bar).toHaveAttribute("aria-describedby", screen.getByRole("tooltip").id);
    fireEvent.blur(bar);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    fireEvent.mouseEnter(screen.getByTestId(`chart-choices-${tune}-passes`));
    expect(screen.getByRole("tooltip")).toHaveTextContent(`${TUNE}: passes 2`);

    // The table shows the same numbers.
    const toggle = screen.getByRole("button", { name: "Table" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader").map((th) => th.textContent)).toEqual([
      "Experiment",
      "Sessions",
      "Minutes",
      "Average pull",
      "Unprompted",
      "Passed to",
      "Passes",
    ]);
    const cells = (name: string) =>
      within(within(table).getByRole("rowheader", { name }).closest("tr") as HTMLElement)
        .getAllByRole("cell")
        .map((td) => td.textContent);
    expect(cells(WORLD)).toEqual(["5", "80", "3.8", "1", "2", "0"]);
    expect(cells(TUNE)).toEqual(["2", "20", "1.5", "1", "0", "2"]);
    expect(screen.queryByTestId(`chart-sessions-${world}`)).not.toBeInTheDocument();

    // No attachments in the fixture: the work grid says so plainly.
    expect(screen.getByText(/Nothing saved in this trial yet/)).toBeInTheDocument();
  });

  it("closed trials stay readable, newest first in the selector", async () => {
    const { user } = await seedFixture();
    await user.click(screen.getByRole("button", { name: "Trial" }));
    await screen.findByRole("heading", { level: 1, name: "Trial 1" });
    await user.click(screen.getByRole("button", { name: "Close trial early" }));
    await user.click(screen.getByRole("button", { name: "Choose verdicts" }));
    await screen.findByRole("heading", { level: 1, name: "Close trial 1" });
    const group = (name: string) => screen.getByRole("group", { name: `What next for ${name}?` });
    await user.click(within(group(WORLD)).getByRole("radio", { name: "Keep" }));
    await user.click(within(group(TUNE)).getByRole("radio", { name: "Extend" }));
    expect(stat(screen.getByRole("article", { name: WORLD }), "Passed to")).toBe("2");
    await user.click(screen.getByRole("button", { name: "Close trial 1 and start trial 2" }));
    await screen.findByRole("heading", { level: 1, name: "Day 1 of 21" });

    await openTab(user, "Review");
    const select = screen.getByRole("combobox", { name: "Trial" });
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Trial 2, current",
      "Trial 1, Oct 8 to Oct 22",
    ]);
    expect(stat(screen.getByRole("article", { name: WORLD }), "Sessions")).toBe("0");

    await user.selectOptions(select, "Trial 1, Oct 8 to Oct 22");
    const worldCard = screen.getByRole("article", { name: WORLD });
    expect(stat(worldCard, "Sessions")).toBe("5");
    expect(stat(worldCard, "Floor weeks cleared")).toBe("2");
    expect(within(worldCard).getByText("Keep")).toBeInTheDocument();
  });
});

describe("Phase 3: custom experiments and archive", () => {
  it("a custom experiment can join the trial, and archiving hides one from the Library", async () => {
    setToday(2026, 10, 8);
    setRandom(0);
    const { user } = await onboard([WORLD, TUNE]);
    await openTab(user, "Library");
    expect(screen.getByText("60 experiments")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Create experiment" }));
    const save = screen.getByRole("button", { name: "Save experiment" });
    expect(save).toBeDisabled();
    await user.type(screen.getByLabelText("Name"), "Voice memo haiku");
    const panel = screen.getByRole("region", { name: "Create experiment" });
    await user.click(within(within(panel).getByRole("group", { name: "Stream" })).getByRole("radio", { name: "Jazz piano" }));
    await user.type(screen.getByLabelText("Do"), "Hum a three-phrase line into the phone, then find it on the keys.");
    await user.type(screen.getByLabelText(/Tests/), "Whether singing first makes the line yours");
    await user.type(screen.getByLabelText("Minimum unit"), "one three-phrase line");
    await user.click(within(panel).getByRole("checkbox", { name: /Portable/ }));
    await user.click(save);

    expect(await screen.findByRole("status")).toHaveTextContent("Created Voice memo haiku.");
    const created = (await db.experiments.toArray()).find((e) => e.name === "Voice memo haiku");
    expect(created).toMatchObject({ custom: true, archived: false, stream: "piano", portable: true, unit: "one three-phrase line" });
    expect(screen.getByText("61 experiments")).toBeInTheDocument();
    const firstCard = screen.getAllByRole("article")[0] as HTMLElement;
    expect(firstCard).toHaveAccessibleName("Voice memo haiku");
    expect(within(firstCard).getByText("Custom")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add Voice memo haiku to trial" }));
    await waitFor(async () =>
      expect((await db.trials.toCollection().first())?.experimentIds).toContain(created?.id),
    );
    expect(screen.queryByRole("button", { name: "Delete Voice memo haiku" })).not.toBeInTheDocument();
    expect(await deleteExperiment(created?.id ?? "")).toEqual({ ok: false, reason: "referenced" });

    // A seed experiment can be archived too; it leaves the list and the stream count.
    expect(within(screen.getByRole("group", { name: "Stream" })).getByRole("radio", { name: "Writing" }).closest("label")).toHaveTextContent("Writing20");
    await user.click(screen.getByRole("button", { name: `Archive ${UGLY}` }));
    await waitFor(() => expect(screen.queryByRole("article", { name: UGLY })).not.toBeInTheDocument());
    expect((await db.experiments.toArray()).find((e) => e.name === UGLY)?.archived).toBe(true);
    expect(screen.getByText("60 experiments")).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: /Show archived/ }));
    const archived = screen.getByRole("article", { name: UGLY });
    expect(within(archived).getByText("Archived")).toBeInTheDocument();
    await user.click(within(archived).getByRole("button", { name: `Unarchive ${UGLY}` }));
    await waitFor(async () => expect((await db.experiments.toArray()).find((e) => e.name === UGLY)?.archived).toBe(false));

    // An unused custom experiment can be deleted; archiving it hides it first.
    await user.click(screen.getByRole("button", { name: "Create experiment" }));
    await user.type(screen.getByLabelText("Name"), "Scratch idea");
    await user.type(screen.getByLabelText("Do"), "Try it once.");
    await user.type(screen.getByLabelText("Minimum unit"), "one try");
    await user.click(screen.getByRole("button", { name: "Save experiment" }));
    await screen.findByRole("article", { name: "Scratch idea" });
    await user.click(screen.getByRole("checkbox", { name: /Show archived/ }));
    await user.click(screen.getByRole("button", { name: "Archive Scratch idea" }));
    await waitFor(() => expect(screen.queryByRole("article", { name: "Scratch idea" })).not.toBeInTheDocument());
    await user.click(screen.getByRole("checkbox", { name: /Show archived/ }));
    await user.click(screen.getByRole("button", { name: "Delete Scratch idea" }));
    await user.click(
      within(screen.getByRole("group", { name: "Confirm deleting Scratch idea" })).getByRole("button", {
        name: "Delete experiment",
      }),
    );
    await waitFor(async () => expect((await db.experiments.toArray()).some((e) => e.name === "Scratch idea")).toBe(false));
  });
});

import { Dexie } from "dexie";
import { describe, expect, it } from "vitest";
import { OutOfMyHeadDB, db } from "./db";
import { ensureSeeded, seedExperiments } from "./seed";

describe("seed import", () => {
  it("maps all sixty seed experiments", () => {
    const rows = seedExperiments();
    expect(rows).toHaveLength(60);
    expect(new Set(rows.map((r) => r.seedId)).size).toBe(60);
    for (const stream of ["writing", "piano", "production"]) {
      expect(rows.filter((r) => r.stream === stream)).toHaveLength(20);
    }
    expect(rows.every((r) => r.custom === false && r.archived === false)).toBe(true);
  });

  it("keeps the seed source", () => {
    const rows = seedExperiments();
    expect(rows[0]).toMatchObject({ seedId: 1, source: "Drabble practice" });
    expect(rows.every((r) => typeof r.source === "string" && r.source.length > 0)).toBe(true);
  });

  it("seeds once, even when called twice at the same time", async () => {
    await Promise.all([ensureSeeded(), ensureSeeded()]);
    await ensureSeeded();
    expect(await db.experiments.count()).toBe(60);
    expect(await db.settings.get("settings")).toMatchObject({ season: "normal", onboarded: false });
    expect((await db.experiments.where("seedId").equals(1).first())?.source).toBe("Drabble practice");
  });

  it("fills source back in when upgrading a version 1 database", async () => {
    const name = "upgrade-from-v1";
    const v1 = new Dexie(name);
    v1.version(1).stores({
      experiments: "id, seedId, stream, archived",
      trials: "id, number, status",
      draws: "id, trialId, date, &[trialId+date]",
      sessions: "id, trialId, experimentId, date, [trialId+date]",
      settings: "id",
    });
    await v1.table("experiments").bulkAdd([
      { id: "x1", seedId: 1, stream: "writing", name: "The 100-word world", custom: false, archived: false },
      { id: "x2", stream: "writing", name: "Mine", custom: true, archived: false },
    ]);
    v1.close();

    const v2 = new OutOfMyHeadDB(name);
    expect((await v2.experiments.get("x1"))?.source).toBe("Drabble practice");
    expect((await v2.experiments.get("x2"))?.source).toBeUndefined();
    await v2.delete();
  });

  it("opens a populated version 2 database with its rows and blobs intact", async () => {
    const name = "reopen-v2";
    const first = new OutOfMyHeadDB(name);
    const blob = new Blob(["png bytes"], { type: "image/png" });
    await first.sessions.add({
      id: "s1",
      trialId: "t1",
      experimentId: "x1",
      date: "2026-10-08",
      startedAt: "2026-10-08T08:00:00.000Z",
      minutes: 10,
      pull: 4,
      thoughtAboutIt: true,
      origin: "drawn",
      nextNote: "Keep going",
      attachment: { kind: "image", blob, mime: "image/png", name: "a.png" },
    });
    first.close();

    const again = new OutOfMyHeadDB(name);
    expect(again.verno).toBe(2);
    const row = await again.sessions.get("s1");
    expect(row?.nextNote).toBe("Keep going");
    expect(row?.attachment?.blob?.size).toBe(blob.size);
    await again.delete();
  });
});

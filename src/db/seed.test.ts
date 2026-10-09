import { describe, expect, it } from "vitest";
import { db } from "./db";
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
    expect(rows[0]).not.toHaveProperty("source");
  });

  it("seeds once, even when called twice at the same time", async () => {
    await Promise.all([ensureSeeded(), ensureSeeded()]);
    await ensureSeeded();
    expect(await db.experiments.count()).toBe(60);
    expect(await db.settings.get("settings")).toMatchObject({ season: "normal", onboarded: false });
  });
});

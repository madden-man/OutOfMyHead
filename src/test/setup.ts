import "fake-indexeddb/auto";
import "./nodeBlob";
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";
import { db } from "../db/db";
import { resetClock } from "../lib/clock";
import { resetRng } from "../lib/random";
import { resetReload } from "../lib/reload";

// jsdom does not implement scrolling; the app scrolls to top on navigation.
window.scrollTo = () => undefined;

// jsdom has no object URLs. Tests that read an exported file replace these.
let urlSeq = 0;
URL.createObjectURL = () => `blob:test/${urlSeq++}`;
URL.revokeObjectURL = () => undefined;

beforeEach(async () => {
  await db.delete({ disableAutoOpen: false });
});

afterEach(() => {
  cleanup();
  try {
    window.localStorage.clear();
  } catch {
    // Some environments block storage; nothing to clear.
  }
  resetClock();
  resetRng();
  resetReload();
});

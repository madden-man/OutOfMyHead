import "fake-indexeddb/auto";
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";
import { db } from "../db/db";
import { resetClock } from "../lib/clock";
import { resetRng } from "../lib/random";

// jsdom does not implement scrolling; the app scrolls to top on navigation.
window.scrollTo = () => undefined;

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
});

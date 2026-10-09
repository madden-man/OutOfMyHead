import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setClock } from "../lib/clock";
import { useToday } from "./useToday";

let current = new Date(2026, 9, 8, 23, 59, 0);

describe("useToday", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    current = new Date(2026, 9, 8, 23, 59, 0);
    setClock(() => current);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rolls over to the next day on the minute tick", () => {
    const { result } = renderHook(() => useToday());
    expect(result.current).toBe("2026-10-08");

    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(result.current).toBe("2026-10-08");

    current = new Date(2026, 9, 9, 0, 0, 30);
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(result.current).toBe("2026-10-09");
  });

  it("re-reads the clock when the page becomes visible", () => {
    const { result } = renderHook(() => useToday());
    expect(result.current).toBe("2026-10-08");
    current = new Date(2026, 9, 10, 7, 0, 0);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current).toBe("2026-10-10");
  });

  it("stops ticking after unmount", () => {
    const { unmount } = renderHook(() => useToday());
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

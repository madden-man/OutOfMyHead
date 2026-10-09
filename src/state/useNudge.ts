import { useEffect, useRef } from "react";
import { toLocalISODate } from "../domain/dates";
import { nudgeDue } from "../domain/nudge";
import { now } from "../lib/clock";
import { showNudge } from "../lib/notify";

export const NUDGE_CHECK_MS = 15_000;
const LAST_FIRED_KEY = "oomh.nudge.lastFired";

function readLastFired(): string | undefined {
  try {
    return window.localStorage.getItem(LAST_FIRED_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function writeLastFired(date: string): void {
  try {
    window.localStorage.setItem(LAST_FIRED_KEY, date);
  } catch {
    // Storage can be blocked. The in-memory guard still holds for this session.
  }
}

/**
 * While the app is open, check the clock every 15 seconds and when the page
 * becomes visible. At the chosen minute, show one notification for the day.
 * `body` is read at fire time so it always names today's draw.
 */
export function useNudge(nudgeTime: string | undefined, body: string | undefined): void {
  const bodyRef = useRef(body);
  useEffect(() => {
    bodyRef.current = body;
  }, [body]);

  useEffect(() => {
    if (!nudgeTime) return;
    let lastFired = readLastFired();
    const check = () => {
      const at = now();
      if (!nudgeDue(at, nudgeTime, lastFired)) return;
      const text = bodyRef.current;
      if (!text) return;
      lastFired = toLocalISODate(at);
      writeLastFired(lastFired);
      showNudge(text);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") check();
    };
    check();
    const handle = setInterval(check, NUDGE_CHECK_MS);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(handle);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [nudgeTime]);
}

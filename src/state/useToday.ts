import { useEffect, useState } from "react";
import { today } from "../lib/clock";

export const TODAY_REFRESH_MS = 60_000;

/**
 * Today's local date, kept fresh. Re-reads the clock every minute and when the
 * page becomes visible again, so an app left open past midnight rolls over to
 * the new day (and draws for it).
 */
export function useToday(refreshMs = TODAY_REFRESH_MS): string {
  const [day, setDay] = useState(today);
  useEffect(() => {
    const refresh = () => setDay(today());
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const handle = setInterval(refresh, refreshMs);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(handle);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", refresh);
    };
  }, [refreshMs]);
  return day;
}

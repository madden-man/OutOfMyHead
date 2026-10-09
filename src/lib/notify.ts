// The browser Notification API, behind a small seam so the app degrades
// quietly where it is missing and tests can stand in for it.

export type NudgePermission = "unsupported" | NotificationPermission;

function api(): typeof Notification | undefined {
  return typeof window !== "undefined" && "Notification" in window ? window.Notification : undefined;
}

export function nudgePermission(): NudgePermission {
  return api()?.permission ?? "unsupported";
}

/** Ask once, only when the user sets a nudge time. Never throws. */
export async function requestNudgePermission(): Promise<NudgePermission> {
  const N = api();
  if (!N) return "unsupported";
  if (N.permission !== "default") return N.permission;
  try {
    return await N.requestPermission();
  } catch {
    return N.permission;
  }
}

/** Show one notification if allowed. Returns whether it was shown. */
export function showNudge(body: string): boolean {
  const N = api();
  if (!N || N.permission !== "granted") return false;
  try {
    new N("Out of My Head", { body, tag: "daily-nudge" });
    return true;
  } catch {
    return false;
  }
}

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

const TITLE = "Out of My Head";

function worker(): ServiceWorkerContainer | undefined {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator ? navigator.serviceWorker : undefined;
}

/**
 * Show one notification if allowed. Returns whether it was handed to the
 * browser. Android Chrome and installed PWAs refuse `new Notification()` and
 * only show notifications through the service worker, so that path comes
 * first whenever a service worker controls the page, and is the fallback when
 * the constructor throws.
 */
export function showNudge(body: string): boolean {
  const N = api();
  if (!N || N.permission !== "granted") return false;
  const options: NotificationOptions = { body, tag: "daily-nudge" };
  const sw = worker();
  const viaWorker = async (reg: ServiceWorkerRegistration | undefined) => {
    if (reg) await reg.showNotification(TITLE, options);
  };
  if (sw?.controller) {
    void sw.ready.then(viaWorker).catch(() => undefined);
    return true;
  }
  try {
    new N(TITLE, options);
    return true;
  } catch {
    if (!sw) return false;
    void sw
      .getRegistration()
      .then(viaWorker)
      .catch(() => undefined);
    return true;
  }
}

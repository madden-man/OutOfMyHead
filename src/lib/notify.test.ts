import { afterEach, describe, expect, it, vi } from "vitest";
import { showNudge } from "./notify";

/** A Notification whose constructor throws, as on Android Chrome and in installed PWAs. */
const ConstructorlessNotification = Object.assign(
  function Notification() {
    throw new TypeError("Illegal constructor. Use ServiceWorkerRegistration.showNotification() instead.");
  },
  { permission: "granted" as NotificationPermission },
);

function installWorker(controlled: boolean) {
  const showNotification = vi.fn(async () => undefined);
  const registration = { showNotification } as unknown as ServiceWorkerRegistration;
  const container = {
    controller: controlled ? {} : null,
    ready: Promise.resolve(registration),
    getRegistration: vi.fn(async () => registration),
  };
  Object.defineProperty(navigator, "serviceWorker", { value: container, configurable: true });
  return showNotification;
}

describe("showNudge", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "Notification");
    Reflect.deleteProperty(navigator, "serviceWorker");
  });

  it("shows through the service worker when one controls the page", async () => {
    Object.defineProperty(window, "Notification", { value: ConstructorlessNotification, configurable: true });
    const show = installWorker(true);
    expect(showNudge("Today: Erasure.")).toBe(true);
    await vi.waitFor(() =>
      expect(show).toHaveBeenCalledWith("Out of My Head", { body: "Today: Erasure.", tag: "daily-nudge" }),
    );
  });

  it("falls back to the service worker when the constructor is refused", async () => {
    Object.defineProperty(window, "Notification", { value: ConstructorlessNotification, configurable: true });
    const show = installWorker(false);
    expect(showNudge("Today: Erasure.")).toBe(true);
    await vi.waitFor(() => expect(show).toHaveBeenCalledTimes(1));
  });

  it("reports nothing shown without permission", () => {
    const denied = { permission: "denied" as NotificationPermission };
    Object.defineProperty(window, "Notification", { value: denied, configurable: true });
    const show = installWorker(true);
    expect(showNudge("Today: Erasure.")).toBe(false);
    expect(show).not.toHaveBeenCalled();
  });
});

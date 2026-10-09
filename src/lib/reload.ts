// Reloading the page goes through this seam so tests can observe it.

let reloadFn: () => void = () => window.location.reload();

export function reloadApp(): void {
  reloadFn();
}

export function setReload(fn: () => void): void {
  reloadFn = fn;
}

export function resetReload(): void {
  reloadFn = () => window.location.reload();
}

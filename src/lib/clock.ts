import { toLocalISODate } from "../domain/dates";

// The app reads the current time only through this module so tests can set "today".

let nowFn: () => Date = () => new Date();

export function now(): Date {
  return nowFn();
}

export function today(): string {
  return toLocalISODate(nowFn());
}

export function setClock(fn: () => Date): void {
  nowFn = fn;
}

export function resetClock(): void {
  nowFn = () => new Date();
}

import type { Rng } from "../domain/draw";

// The app draws through this module so tests can make the draw deterministic.

let rngFn: Rng = Math.random;

export function rng(): number {
  return rngFn();
}

export function setRng(fn: Rng): void {
  rngFn = fn;
}

export function resetRng(): void {
  rngFn = Math.random;
}

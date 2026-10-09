import type { WeekPill } from "../domain/floor";

/** One pill per trial week. Cleared weeks show any bonus; nothing is ever marked as missed. */
export function FloorStrip({ pills, label }: { pills: WeekPill[]; label: string }) {
  return (
    <ol className="floor-strip" aria-label={label}>
      {pills.map((p) => (
        <li
          key={p.week}
          className={`floor-pill is-${p.kind}${p.phase === "current" ? " is-current" : ""}`}
          aria-label={p.description}
          title={p.description}
        >
          {p.kind === "cleared" ? (
            <>
              <span>Cleared</span>
              {p.bonus > 0 && <span className="floor-bonus">+{p.bonus}</span>}
            </>
          ) : (
            p.label
          )}
        </li>
      ))}
    </ol>
  );
}

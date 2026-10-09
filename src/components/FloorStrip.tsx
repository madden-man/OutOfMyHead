import { useId } from "react";
import type { WeekPill } from "../domain/floor";
import { useTooltip } from "./useTooltip";

/**
 * One pill per trial week. Cleared weeks show any bonus; nothing is ever
 * marked as missed. Each week is a 44px focusable cell around the visible
 * pill, and shows its full description on hover and on focus.
 */
export function FloorStrip({ pills, label }: { pills: WeekPill[]; label: string }) {
  const { box, bind, layer } = useTooltip(`${useId()}-tip`);
  return (
    <div className="tip-host" ref={box}>
      <ol className="floor-strip" aria-label={label}>
        {pills.map((p) => (
          <li key={p.week} className="floor-cell" aria-label={p.description} {...bind(String(p.week), p.description)}>
            <span className={`floor-pill is-${p.kind}${p.phase === "current" ? " is-current" : ""}`}>
              {p.kind === "cleared" ? (
                <>
                  <span>Cleared</span>
                  {p.bonus > 0 && <span className="floor-bonus">+{p.bonus}</span>}
                </>
              ) : (
                p.label
              )}
            </span>
          </li>
        ))}
      </ol>
      {layer}
    </div>
  );
}

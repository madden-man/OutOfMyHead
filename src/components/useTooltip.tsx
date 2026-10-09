import { useRef, useState, type FocusEvent, type MouseEvent, type ReactNode } from "react";

// One positioned tooltip per container, shown on hover and on keyboard focus.
// The container (the element `box` is attached to) must be position: relative.
// Used by the Review charts, the Trial day grid, and the weekly floor strip.

interface Tip {
  key: string;
  text: string;
  x: number;
  y: number;
}

/** Half the tooltip's max width (220px in `.chart-tooltip`), so it never spills past the container. */
const HALF_TIP = 110;

export function useTooltip(tipId: string) {
  const box = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);

  const show = (key: string, text: string, el: HTMLElement) => {
    const container = box.current;
    if (!container) return;
    const outer = container.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const width = outer.width || 1;
    // Center over the element, kept inside the container so the tooltip never clips.
    const x = Math.min(Math.max(r.left - outer.left + r.width / 2, HALF_TIP), Math.max(HALF_TIP, width - HALF_TIP));
    setTip({ key, text, x, y: r.top - outer.top });
  };
  const hide = (key: string) => setTip((t) => (t && t.key === key ? null : t));

  const bind = (key: string, text: string) => ({
    tabIndex: 0,
    "aria-describedby": tip?.key === key ? tipId : undefined,
    onMouseEnter: (e: MouseEvent<HTMLElement>) => show(key, text, e.currentTarget),
    onMouseLeave: () => hide(key),
    onFocus: (e: FocusEvent<HTMLElement>) => show(key, text, e.currentTarget),
    onBlur: () => hide(key),
  });

  const layer: ReactNode = tip ? (
    <div id={tipId} role="tooltip" className="chart-tooltip" style={{ left: tip.x, top: tip.y }}>
      {tip.text}
    </div>
  ) : null;

  return { box, bind, layer };
}

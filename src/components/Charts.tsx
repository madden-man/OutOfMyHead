import type { CSSProperties } from "react";
import type { Stream } from "../domain/types";
import { useTooltip } from "./useTooltip";

// Plain HTML charts. Bars are at most 24px thick with a 4px rounded data end
// and a square baseline, colored by stream. Text always wears text tokens.
// Every mark has a hover and focus tooltip; the Table view carries the same numbers.

export interface ChartRow {
  id: string;
  name: string;
  stream: Stream;
}

export function ChartLegend({ rows }: { rows: readonly ChartRow[] }) {
  return (
    <ul className="chart-legend" aria-label="Legend">
      {rows.map((r) => (
        <li key={r.id} className={`stream-${r.stream}`}>
          <span className="stream-dot" aria-hidden="true" />
          {r.name}
        </li>
      ))}
    </ul>
  );
}

const ratio = (value: number, max: number) => (max > 0 ? Math.max(0, Math.min(1, value / max)) : 0);

/** Horizontal bars, one per row, with the value at the bar tip. */
export function BarChart({
  id,
  title,
  rows,
  values,
  tooltips,
}: {
  id: string;
  title: string;
  rows: readonly ChartRow[];
  values: Record<string, number>;
  tooltips: Record<string, string>;
}) {
  const { box, bind, layer } = useTooltip(`${id}-tip`);
  const max = Math.max(0, ...rows.map((r) => values[r.id] ?? 0));
  return (
    <figure className="chart" aria-labelledby={`${id}-title`}>
      <figcaption id={`${id}-title`} className="chart-title">
        {title}
      </figcaption>
      <div className="chart-plot" ref={box}>
        <ul className="bar-rows">
          {rows.map((r) => {
            const v = values[r.id] ?? 0;
            const tip = tooltips[r.id] ?? `${r.name}: ${v}`;
            return (
              <li
                key={r.id}
                className={`bar-row stream-${r.stream}`}
                aria-label={tip}
                data-testid={`${id}-${r.id}`}
                {...bind(r.id, tip)}
              >
                <span className="bar-name">{r.name}</span>
                <span className="bar-track">
                  <span className="bar" style={{ "--ratio": ratio(v, max) } as CSSProperties} />
                  <span className="bar-value">{v}</span>
                </span>
              </li>
            );
          })}
        </ul>
        {layer}
      </div>
    </figure>
  );
}

/** Average pull as a dot on a 1 to 5 scale. */
export function PullScale({
  id,
  title,
  rows,
  values,
  tooltips,
}: {
  id: string;
  title: string;
  rows: readonly ChartRow[];
  values: Record<string, number | null>;
  tooltips: Record<string, string>;
}) {
  const { box, bind, layer } = useTooltip(`${id}-tip`);
  return (
    <figure className="chart" aria-labelledby={`${id}-title`}>
      <figcaption id={`${id}-title`} className="chart-title">
        {title}
      </figcaption>
      <div className="chart-plot" ref={box}>
        <ul className="bar-rows">
          {rows.map((r) => {
            const v = values[r.id] ?? null;
            const tip = tooltips[r.id] ?? r.name;
            const position = v === null ? 0 : (v - 1) / 4;
            return (
              <li
                key={r.id}
                className={`bar-row stream-${r.stream}`}
                aria-label={tip}
                data-testid={`${id}-${r.id}`}
                {...bind(r.id, tip)}
              >
                <span className="bar-name">{r.name}</span>
                <span className="pull-track">
                  <span className="pull-line" aria-hidden="true">
                    {[0, 1, 2, 3, 4].map((t) => (
                      <span key={t} className="pull-tick" style={{ "--pos": t / 4 } as CSSProperties} />
                    ))}
                  </span>
                  {v === null ? (
                    <span className="pull-none">None yet</span>
                  ) : (
                    <>
                      <span className="pull-dot" style={{ "--pos": position } as CSSProperties} />
                      <span
                        className={`pull-value${position > 0.7 ? " is-left" : ""}`}
                        style={{ "--pos": position } as CSSProperties}
                      >
                        {v.toFixed(1)}
                      </span>
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="pull-axis" aria-hidden="true">
          <span />
          <span className="pull-axis-labels">
            <span>1 dreaded it</span>
            <span>5 could not wait</span>
          </span>
        </div>
        {layer}
      </div>
    </figure>
  );
}

export interface SmallMetric {
  key: string;
  label: string;
}

/** A small row per experiment: a few counts side by side on one shared scale. */
export function SmallRows({
  id,
  title,
  rows,
  metrics,
  values,
}: {
  id: string;
  title: string;
  rows: readonly ChartRow[];
  metrics: readonly SmallMetric[];
  values: Record<string, Record<string, number>>;
}) {
  const { box, bind, layer } = useTooltip(`${id}-tip`);
  const max = Math.max(0, ...rows.flatMap((r) => metrics.map((m) => values[r.id]?.[m.key] ?? 0)));
  return (
    <figure className="chart" aria-labelledby={`${id}-title`}>
      <figcaption id={`${id}-title`} className="chart-title">
        {title}
      </figcaption>
      <div className="chart-plot" ref={box}>
        <ul className="small-rows">
          {rows.map((r) => (
            <li key={r.id} className={`small-row stream-${r.stream}`}>
              <p className="small-row-name">
                <span className="stream-dot" aria-hidden="true" />
                {r.name}
              </p>
              <ul className="small-metrics">
                {metrics.map((m) => {
                  const v = values[r.id]?.[m.key] ?? 0;
                  const tip = `${r.name}: ${m.label.toLowerCase()} ${v}`;
                  return (
                    <li
                      key={m.key}
                      className="small-metric"
                      aria-label={tip}
                      data-testid={`${id}-${r.id}-${m.key}`}
                      {...bind(`${r.id}-${m.key}`, tip)}
                    >
                      <span className="small-metric-label">{m.label}</span>
                      <span className="bar-track is-small">
                        <span className="bar" style={{ "--ratio": ratio(v, max) } as CSSProperties} />
                        <span className="bar-value">{v}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
        {layer}
      </div>
    </figure>
  );
}

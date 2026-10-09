import { statsRows, type ExperimentStats } from "../domain/stats";

export function StatsStrip({ stats, label }: { stats: ExperimentStats | undefined; label?: string }) {
  if (!stats) return null;
  return (
    <dl className="stats-strip" aria-label={label}>
      {statsRows(stats).map(([name, value]) => (
        <div key={name}>
          <dt>{name}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

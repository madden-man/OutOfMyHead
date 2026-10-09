import { StreamTag } from "../components/StreamTag";
import { dateOfTrialDay, parseLocalISODate, trialDayIndex } from "../domain/dates";
import type { Experiment } from "../domain/types";
import type { AppState } from "../state/useAppStore";

const dateFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

function formatDate(iso: string): string {
  return dateFormat.format(parseLocalISODate(iso));
}

export function TrialScreen({ state, today }: { state: AppState; today: string }) {
  const { trial, experimentsById, draws, sessions } = state;
  if (!trial) return null;

  const day = trialDayIndex(trial.startDate, today);
  const remaining = Math.max(0, trial.lengthDays - day);
  const active = trial.experimentIds
    .map((id) => experimentsById.get(id))
    .filter((e): e is Experiment => e !== undefined);
  const trialSessions = sessions.filter((s) => s.trialId === trial.id);
  const drawsByDate = new Map(draws.map((d) => [d.date, d]));

  const weeks: number[][] = [];
  for (let d = 1; d <= trial.lengthDays; d++) {
    const w = Math.floor((d - 1) / 7);
    (weeks[w] ??= []).push(d);
  }

  return (
    <main className="screen trial">
      <header className="screen-header">
        <p className="wordmark">Out of My Head</p>
        <h1 className="screen-title">Trial {trial.number}</h1>
        <p className="lede">
          Started {formatDate(trial.startDate)}.{" "}
          {remaining === 0
            ? "This is the last planned day."
            : remaining === 1
              ? "1 day remaining."
              : `${remaining} days remaining.`}
        </p>
      </header>

      <section aria-labelledby="active-title">
        <h2 id="active-title" className="section-title">
          Active experiments
        </h2>
        <ul className="active-list">
          {active.map((e) => {
            const drawn = draws.filter((d) => d.experimentId === e.id).length;
            const logged = trialSessions.filter((s) => s.experimentId === e.id).length;
            return (
              <li key={e.id} className={`active-item stream-${e.stream}`}>
                <StreamTag stream={e.stream} />
                <p className="active-name">{e.name}</p>
                <p className="active-stats">
                  Drawn {drawn === 1 ? "1 day" : `${drawn} days`}, {logged === 1 ? "1 session" : `${logged} sessions`}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="grid-title">
        <h2 id="grid-title" className="section-title">
          The {trial.lengthDays} days
        </h2>
        <div className="day-grid" role="list">
          {weeks.map((days, i) => (
            <div key={i} className="day-week" role="listitem">
              <p className="day-week-label">Week {i + 1}</p>
              <ol className="day-row">
                {days.map((d) => {
                  const date = dateOfTrialDay(trial.startDate, d);
                  const draw = drawsByDate.get(date);
                  const exp = draw ? experimentsById.get(draw.experimentId) : undefined;
                  const count = trialSessions.filter((s) => s.date === date).length;
                  const passedTo = draw?.passedTo ? experimentsById.get(draw.passedTo) : undefined;
                  const parts = [`Day ${d}, ${formatDate(date)}`];
                  if (exp) parts.push(`drew ${exp.name}`);
                  if (passedTo) parts.push(`passed to ${passedTo.name}`);
                  if (count > 0) parts.push(count === 1 ? "1 session" : `${count} sessions`);
                  const classes = [
                    "day",
                    exp ? `stream-${exp.stream} is-drawn` : "",
                    date === today ? "is-today" : "",
                    date > today ? "is-future" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <li key={d} className={classes} aria-label={parts.join(", ")} title={parts.join(", ")}>
                      <span className="day-number" aria-hidden="true">
                        {d}
                      </span>
                      {count > 0 && <span className="mark-session" aria-hidden="true" />}
                      {passedTo && <span className="mark-pass" aria-hidden="true" />}
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
        <ul className="legend">
          <li>
            <span className="legend-swatch stream-writing" aria-hidden="true" />
            Writing
          </li>
          <li>
            <span className="legend-swatch stream-piano" aria-hidden="true" />
            Jazz piano
          </li>
          <li>
            <span className="legend-swatch stream-production" aria-hidden="true" />
            Production
          </li>
          <li>
            <span className="legend-mark mark-session" aria-hidden="true" />
            Session logged
          </li>
          <li>
            <span className="legend-mark mark-pass" aria-hidden="true" />
            Passed
          </li>
        </ul>
      </section>
    </main>
  );
}

import { useState } from "react";
import type { Route } from "../App";
import { FloorStrip } from "../components/FloorStrip";
import { StreamTag } from "../components/StreamTag";
import { dateOfTrialDay, parseLocalISODate, trialDayIndex } from "../domain/dates";
import { floorStrip, streakWeeks } from "../domain/floor";
import type { Experiment } from "../domain/types";
import type { AppState } from "../state/useAppStore";

const dateFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

function formatDate(iso: string): string {
  return dateFormat.format(parseLocalISODate(iso));
}

export function TrialScreen({ state, today, go }: { state: AppState; today: string; go: (r: Route) => void }) {
  const { trial, trials, settings, experimentsById, draws, sessions } = state;
  const [confirming, setConfirming] = useState(false);
  if (!trial || !settings) return null;

  const day = trialDayIndex(trial.startDate, today);
  const remaining = Math.max(0, trial.lengthDays - day);
  const active = trial.experimentIds
    .map((id) => experimentsById.get(id))
    .filter((e): e is Experiment => e !== undefined);
  const trialSessions = sessions.filter((s) => s.trialId === trial.id);
  const drawsByDate = new Map(draws.map((d) => [d.date, d]));
  const streak = streakWeeks({ trial, sessions, settings, today, experiments: active });
  const previous = trials.find((t) => t.number === trial.number - 1);
  const extended = (id: string) => previous?.verdicts?.[id] === "extend";
  const lastDayReached = day >= trial.lengthDays;

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

      <section className="streak" aria-labelledby="streak-title">
        <h2 id="streak-title" className="eyebrow">
          Streak
        </h2>
        <p className="streak-value" data-testid="streak">
          {streak === 1 ? "1 week" : `${streak} weeks`}
        </p>
        <p className="hint">
          Weeks in a row where every experiment cleared its floor. Newborn weeks pause the count, they never end it.
        </p>
      </section>

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
                <div className="active-meta">
                  <StreamTag stream={e.stream} />
                  {extended(e.id) && <span className="badge">Extended from trial {previous?.number}</span>}
                </div>
                <p className="active-name">{e.name}</p>
                <p className="active-stats">
                  Drawn {drawn === 1 ? "1 day" : `${drawn} days`}, {logged === 1 ? "1 session" : `${logged} sessions`}
                </p>
                <FloorStrip
                  label={`Weekly floor for ${e.name}`}
                  pills={floorStrip({ trial, sessions, settings, today, experiment: e })}
                />
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

      <section className="close-trial" aria-labelledby="close-trial-title">
        <h2 id="close-trial-title" className="section-title">
          {lastDayReached ? "Close this trial" : "Close trial early"}
        </h2>
        {lastDayReached ? (
          <>
            <p className="hint">Keep, cut, or extend each experiment, then trial {trial.number + 1} starts today.</p>
            <button type="button" className="btn btn-primary btn-block" onClick={() => go({ name: "verdict" })}>
              Close this trial
            </button>
          </>
        ) : confirming ? (
          <div className="confirm" role="group" aria-label="Confirm closing early">
            <p>
              Close trial {trial.number} on day {day} of {trial.lengthDays}? Next you choose keep, cut, or extend for
              each experiment. Nothing closes until you confirm there.
            </p>
            <div className="confirm-actions">
              <button type="button" className="btn btn-primary" onClick={() => go({ name: "verdict" })}>
                Choose verdicts
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirming(false)}>
                Keep going
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="hint">Three weeks is a plan, not a rule. If you already know, you can decide now.</p>
            <button type="button" className="btn btn-secondary" onClick={() => setConfirming(true)}>
              Close trial early
            </button>
          </>
        )}
      </section>
    </main>
  );
}

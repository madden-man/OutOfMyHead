import { useState } from "react";
import type { Route } from "../App";
import { FloorStrip } from "../components/FloorStrip";
import { StreamTag } from "../components/StreamTag";
import { trialDayIndex } from "../domain/dates";
import { floorStrip } from "../domain/floor";
import type { Draw, Experiment, Season } from "../domain/types";
import { passTo, rerollDraw } from "../state/actions";
import type { AppState } from "../state/useAppStore";

const SEASON_LABELS: Record<Season, string> = {
  normal: "Normal season",
  travel: "Travel season",
  newborn: "Newborn season",
};

export function Today({ state, today, go }: { state: AppState; today: string; go: (r: Route) => void }) {
  const { trial, settings, experimentsById, notes, sessions, draws } = state;
  const [passing, setPassing] = useState(false);
  if (!trial || !settings) return null;

  const day = trialDayIndex(trial.startDate, today);
  const draw = draws.find((d) => d.date === today);
  const active = trial.experimentIds
    .map((id) => experimentsById.get(id))
    .filter((e): e is Experiment => e !== undefined);
  const focusId = draw?.passedTo ?? draw?.experimentId;
  const focus = focusId ? experimentsById.get(focusId) : undefined;
  const others = active.filter((e) => e.id !== focusId);
  const todaySessions = sessions.filter((s) => s.trialId === trial.id && s.date === today);
  const newborn = settings.season === "newborn";
  const travel = settings.season === "travel";
  const lastDayReached = day >= trial.lengthDays;

  const minutesToday = (id: string) =>
    todaySessions.filter((s) => s.experimentId === id).reduce((sum, s) => sum + s.minutes, 0);
  const countToday = (id: string) => todaySessions.filter((s) => s.experimentId === id).length;

  return (
    <main className="screen today">
      <header className="screen-header">
        <p className="wordmark">Out of My Head</p>
        <div className="today-meta">
          <h1 className="screen-title">
            {day <= trial.lengthDays ? `Day ${day} of ${trial.lengthDays}` : `Day ${day}`}
          </h1>
          <span className="badge">{SEASON_LABELS[settings.season]}</span>
        </div>
        {day > trial.lengthDays && (
          <p className="hint">Past the planned {trial.lengthDays} days. The draw keeps going until you close the trial.</p>
        )}
      </header>

      {lastDayReached && (
        <section className="close-banner" aria-labelledby="close-title">
          <h2 id="close-title" className="close-banner-title">
            {day === trial.lengthDays ? "Last planned day" : "Ready when you are"}
          </h2>
          <p>Read how each experiment went, then keep, cut, or extend it for trial {trial.number + 1}.</p>
          <button type="button" className="btn btn-primary btn-block" onClick={() => go({ name: "verdict" })}>
            Close this trial
          </button>
        </section>
      )}

      {!draw || !focus ? (
        <section className="draw-card is-loading" aria-busy="true">
          <p className="eyebrow">Drawing today&apos;s experiment</p>
        </section>
      ) : (
        <section className={`draw-card stream-${focus.stream}`} aria-labelledby="draw-name">
          <p className="eyebrow">
            {draw.passedTo ? "You passed to" : newborn ? "Today's offer" : "Today's draw"}
          </p>
          <StreamTag stream={focus.stream} />
          <h2 id="draw-name" className="draw-name">
            {focus.name}
          </h2>
          <p className="draw-do">{focus.do}</p>

          <NextNote note={notes[focus.id]} />

          {countToday(focus.id) > 0 && (
            <p className="logged-today">
              Logged today: {countToday(focus.id) === 1 ? "1 session" : `${countToday(focus.id)} sessions`},{" "}
              {minutesToday(focus.id)} min
            </p>
          )}

          <div className="draw-actions">
            <button type="button" className="btn btn-primary btn-block" onClick={() => go({ name: "log", experimentId: focus.id })}>
              Start session
            </button>
            <div className="draw-actions-row">
              {!newborn && !draw.passedTo && active.length > 1 && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  aria-expanded={passing}
                  onClick={() => setPassing((p) => !p)}
                >
                  Pass
                </button>
              )}
              {!draw.rerolledFrom && !draw.passedTo && active.length > 1 && (
                <button type="button" className="btn btn-secondary" onClick={() => void rerollDraw(draw.id)}>
                  Reroll
                </button>
              )}
            </div>
            {draw.passedTo && (
              <p className="hint">
                Drawn today: {experimentsById.get(draw.experimentId)?.name ?? "an experiment"}. Passing is fine, it is
                part of the data.
              </p>
            )}
            {draw.rerolledFrom && !draw.passedTo && (
              <p className="hint">Rerolled from {experimentsById.get(draw.rerolledFrom)?.name ?? "another experiment"}.</p>
            )}
          </div>

          {passing && !draw.passedTo && (
            <div className="pass-picker" role="group" aria-label="Pass to another experiment">
              <p className="field-label">Work on this one instead</p>
              {active
                .filter((e) => e.id !== draw.experimentId)
                .map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    className={`btn btn-option stream-${e.stream}`}
                    onClick={() => {
                      setPassing(false);
                      void passTo(draw.id, e.id);
                    }}
                  >
                    <span className="stream-dot" aria-hidden="true" />
                    Pass to {e.name}
                  </button>
                ))}
            </div>
          )}

          <WhyThisOne draw={draw} experimentsById={experimentsById} />
        </section>
      )}

      {others.length > 0 && (
        <section className="others" aria-labelledby="others-title">
          <h2 id="others-title" className="section-title">
            Also in this trial
          </h2>
          <ul className="others-list">
            {others.map((e) => (
              <li key={e.id}>
                <details className={`other stream-${e.stream}`}>
                  <summary>
                    <span className="stream-dot" aria-hidden="true" />
                    <span className="other-name">{e.name}</span>
                    {travel && !e.portable && <span className="badge">Resting</span>}
                    {countToday(e.id) > 0 && <span className="badge">Logged today</span>}
                  </summary>
                  <div className="other-body">
                    {travel && !e.portable && (
                      <p className="hint">Resting while you travel. The draw skips it until the season changes.</p>
                    )}
                    <NextNote note={notes[e.id]} />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      aria-label={`Log session for ${e.name}`}
                      onClick={() => go({ name: "log", experimentId: e.id })}
                    >
                      Log session
                    </button>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="floor" aria-labelledby="floor-title">
        <h2 id="floor-title" className="section-title">
          Weekly floor
        </h2>
        <p className="hint floor-intro">{floorIntro(settings.season, settings.floorPerWeek[settings.season])}</p>
        <ul className="floor-list">
          {active.map((e) => (
            <li key={e.id} className={`floor-row stream-${e.stream}`}>
              <p className="floor-name">
                <span className="stream-dot" aria-hidden="true" />
                {e.name}
              </p>
              <FloorStrip
                label={`Weekly floor for ${e.name}`}
                pills={floorStrip({ trial, sessions, settings, today, experiment: e })}
              />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function floorIntro(season: Season, floor: number): string {
  if (floor === 0) return "No floor this season. Every session counts, and nothing here is owed.";
  const sessions = floor === 1 ? "1 session" : `${floor} sessions`;
  if (season === "newborn") return `${sessions} per experiment per week. Newborn weeks never break a streak.`;
  if (season === "travel") return `${sessions} per portable experiment per week. The rest are resting.`;
  return `${sessions} per experiment per week. Anything above it is bonus.`;
}

function NextNote({ note }: { note: string | undefined }) {
  return (
    <div className="next-note">
      <p className="field-label">Next note</p>
      {note ? (
        <p className="next-note-text" data-testid="next-note">
          {note}
        </p>
      ) : (
        <p className="next-note-text is-empty">No note yet. Start wherever feels easy.</p>
      )}
    </div>
  );
}

function WhyThisOne({ draw, experimentsById }: { draw: Draw; experimentsById: Map<string, Experiment> }) {
  const entries = Object.entries(draw.weights);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  return (
    <details className="why">
      <summary>Why this one</summary>
      <p className="hint">
        Every experiment starts at weight 1. Drawn yesterday lowers it. Being drawn less than its share, or sitting
        below the weekly floor, raises it.
      </p>
      <table className="why-table">
        <thead>
          <tr>
            <th scope="col">Experiment</th>
            <th scope="col">Weight</th>
            <th scope="col">Chance</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([id, w]) => (
            <tr key={id} className={id === draw.experimentId ? "is-drawn" : undefined}>
              <th scope="row">{experimentsById.get(id)?.name ?? "Removed experiment"}</th>
              <td>{w.toFixed(2)}</td>
              <td>{total > 0 ? `${Math.round((w / total) * 100)}%` : "0%"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

import { useState } from "react";
import { BlobAudio, BlobImage } from "../components/BlobMedia";
import { BarChart, ChartLegend, PullScale, SmallRows, type ChartRow } from "../components/Charts";
import { StatsStrip } from "../components/StatsStrip";
import { StreamTag } from "../components/StreamTag";
import { parseLocalISODate, trialDayIndex } from "../domain/dates";
import { reviewAsOf, trialExperiments, trialsNewestFirst, trialWork } from "../domain/review";
import { formatPull, trialStats, type ExperimentStats } from "../domain/stats";
import { VERDICT_LABELS, type Session, type Trial } from "../domain/types";
import type { AppState } from "../state/useAppStore";

const shortDate = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const formatDate = (iso: string) => shortDate.format(parseLocalISODate(iso));

/** "day 5 of 21", or "day 25, 21 planned" once a trial runs past its length. */
function dayOf(day: number, length: number): string {
  const d = Math.max(1, day);
  return d > length ? `day ${d}, ${length} planned` : `day ${d} of ${length}`;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);

function trialOption(t: Trial, today: string): string {
  if (t.status === "active") return `Trial ${t.number}, current`;
  return `Trial ${t.number}, ${formatDate(t.startDate)} to ${formatDate(reviewAsOf(t, today))}`;
}

export function Review({ state, today }: { state: AppState; today: string }) {
  const { trials, settings, experimentsById, sessions, allDraws } = state;
  const ordered = trialsNewestFirst(trials);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [table, setTable] = useState(false);
  const trial = ordered.find((t) => t.id === selectedId) ?? ordered[0];
  if (!trial || !settings) return null;

  const asOf = reviewAsOf(trial, today);
  const experiments = trialExperiments(trial, experimentsById, sessions);
  const stats = trialStats({ trial, sessions, draws: allDraws, settings, today: asOf, experiments });
  const rows: ChartRow[] = experiments.map((e) => ({ id: e.id, name: e.name, stream: e.stream }));
  const work = trialWork(sessions, trial.id);
  const get = (id: string): ExperimentStats | undefined => stats[id];
  const sessionValues = Object.fromEntries(rows.map((r) => [r.id, get(r.id)?.sessions ?? 0]));
  const pullValues = Object.fromEntries(rows.map((r) => [r.id, get(r.id)?.averagePull ?? null]));
  const sessionTips = Object.fromEntries(
    rows.map((r) => {
      const s = get(r.id);
      return [r.id, `${r.name}: ${plural(s?.sessions ?? 0, "session", "sessions")}, ${s?.minutes ?? 0} min`];
    }),
  );
  const pullTips = Object.fromEntries(
    rows.map((r) => {
      const p = get(r.id)?.averagePull ?? null;
      return [r.id, p === null ? `${r.name}: no sessions yet` : `${r.name}: average pull ${p.toFixed(1)} of 5`];
    }),
  );
  const choiceValues = Object.fromEntries(
    rows.map((r) => {
      const s = get(r.id);
      return [r.id, { unprompted: s?.unprompted ?? 0, passedTo: s?.passedToSessions ?? 0, passes: s?.passes ?? 0 }];
    }),
  );

  return (
    <main className="screen review">
      <header className="screen-header">
        <p className="wordmark">Out of My Head</p>
        <h1 className="screen-title">Review</h1>
        <p className="lede">What pulled you back, in numbers and in the work itself.</p>
      </header>

      <div className="field">
        <label className="field-label" htmlFor="review-trial">
          Trial
        </label>
        <select
          id="review-trial"
          className="input select"
          value={trial.id}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {ordered.map((t) => (
            <option key={t.id} value={t.id}>
              {trialOption(t, today)}
            </option>
          ))}
        </select>
        <p className="hint">
          {trial.status === "active"
            ? `Started ${formatDate(trial.startDate)}, ${dayOf(trialDayIndex(trial.startDate, today), trial.lengthDays)}.`
            : `Ran ${formatDate(trial.startDate)} to ${formatDate(asOf)}.`}
        </p>
      </div>

      <section aria-labelledby="review-numbers-title">
        <h2 id="review-numbers-title" className="section-title">
          Per experiment
        </h2>
        <ul className="review-list">
          {experiments.map((e) => {
            const verdict = trial.verdicts?.[e.id];
            return (
              <li key={e.id}>
                <article className={`review-card stream-${e.stream}`} aria-labelledby={`review-${e.id}`}>
                  <div className="review-card-meta">
                    <StreamTag stream={e.stream} />
                    {verdict && <span className="badge">{VERDICT_LABELS[verdict]}</span>}
                  </div>
                  <h3 id={`review-${e.id}`} className="review-name">
                    {e.name}
                  </h3>
                  <StatsStrip stats={stats[e.id]} label={`Numbers for ${e.name}`} />
                </article>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="charts" aria-labelledby="review-charts-title">
        <div className="charts-head">
          <h2 id="review-charts-title" className="section-title">
            Charts
          </h2>
          <button
            type="button"
            className="btn btn-secondary"
            aria-pressed={table}
            onClick={() => setTable((t) => !t)}
          >
            Table
          </button>
        </div>
        <ChartLegend rows={rows} />
        {table ? (
          <div className="table-wrap">
            <table className="data-table">
              <caption className="visually-hidden">Trial {trial.number} numbers per experiment</caption>
              <thead>
                <tr>
                  <th scope="col">Experiment</th>
                  <th scope="col">Sessions</th>
                  <th scope="col">Minutes</th>
                  <th scope="col">Average pull</th>
                  <th scope="col">Unprompted</th>
                  <th scope="col">Passed to</th>
                  <th scope="col">Passes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const s = get(r.id);
                  return (
                    <tr key={r.id}>
                      <th scope="row">{r.name}</th>
                      <td>{s?.sessions ?? 0}</td>
                      <td>{s?.minutes ?? 0}</td>
                      <td>{formatPull(s?.averagePull ?? null)}</td>
                      <td>{s?.unprompted ?? 0}</td>
                      <td>{s?.passedToSessions ?? 0}</td>
                      <td>{s?.passes ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="chart-stack">
            <BarChart id="chart-sessions" title="Sessions" rows={rows} values={sessionValues} tooltips={sessionTips} />
            <PullScale id="chart-pull" title="Average pull" rows={rows} values={pullValues} tooltips={pullTips} />
            <SmallRows
              id="chart-choices"
              title="Unprompted, passed to, and passes"
              rows={rows}
              metrics={[
                { key: "unprompted", label: "Unprompted" },
                { key: "passedTo", label: "Passed to" },
                { key: "passes", label: "Passes" },
              ]}
              values={choiceValues}
            />
          </div>
        )}
      </section>

      <section aria-labelledby="review-work-title">
        <h2 id="review-work-title" className="section-title">
          The work
        </h2>
        {work.length === 0 ? (
          <p className="hint">
            Nothing saved in this trial yet. Add a snippet, a photo, or a recording when you log a session and it
            lands here.
          </p>
        ) : (
          <ul className="work-grid" aria-label={`Work from trial ${trial.number}`}>
            {work.map((s) => (
              <WorkTile
                key={s.id}
                session={s}
                day={trialDayIndex(trial.startDate, s.date)}
                name={experimentsById.get(s.experimentId)?.name ?? "Removed experiment"}
                stream={experimentsById.get(s.experimentId)?.stream}
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function WorkTile({
  session,
  day,
  name,
  stream,
}: {
  session: Session;
  day: number;
  name: string;
  stream: ChartRow["stream"] | undefined;
}) {
  const a = session.attachment;
  if (!a) return null;
  const when = `${formatDate(session.date)}, day ${day}`;
  const kindClass = a.kind === "audio" ? " is-audio" : a.kind === "image" ? " is-image" : "";
  return (
    <li className={`work-tile${kindClass}${stream ? ` stream-${stream}` : ""}`}>
      <article aria-label={`${name}, ${when}`}>
        <p className="work-when">{when}</p>
        <p className="work-name">
          <span className="stream-dot" aria-hidden="true" />
          {name}
        </p>
        {a.kind === "image" && a.blob && (
          <BlobImage className="work-image" blob={a.blob} alt={`${a.name ?? "Image"} from ${name}, ${when}`} />
        )}
        {a.kind === "audio" && a.blob && (
          <>
            <BlobAudio className="work-audio" blob={a.blob} label={`${a.name ?? "Recording"} from ${name}`} />
            {a.name && <p className="hint">{a.name}</p>}
          </>
        )}
        {a.text && <p className="work-text">{a.text}</p>}
      </article>
    </li>
  );
}

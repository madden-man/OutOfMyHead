import { useMemo, useState } from "react";
import { StreamFilter, type StreamChoice } from "../components/StreamFilter";
import { StatsStrip } from "../components/StatsStrip";
import { StreamTag } from "../components/StreamTag";
import { filterExperiments } from "../components/filterExperiments";
import { trialDayIndex } from "../domain/dates";
import { trialStats } from "../domain/stats";
import { VERDICT_LABELS, type Experiment, type Verdict as VerdictChoice } from "../domain/types";
import { nextRoster } from "../domain/verdict";
import { closeTrial } from "../state/actions";
import type { AppState } from "../state/useAppStore";

const CHOICES: VerdictChoice[] = ["keep", "cut", "extend"];

const CHOICE_NOTES: Record<VerdictChoice, string> = {
  keep: "Carries into the next trial.",
  extend: "Carries into the next trial with its history, marked as extended.",
  cut: "Leaves the trial. Pick what takes its place.",
};

export function Verdict({
  state,
  today,
  onBack,
  onClosed,
}: {
  state: AppState;
  today: string;
  onBack: () => void;
  onClosed: () => void;
}) {
  const { trial, settings, experiments, experimentsById, sessions, draws } = state;
  const [verdicts, setVerdicts] = useState<Record<string, VerdictChoice>>({});
  const [replacements, setReplacements] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const active = useMemo(
    () => (trial?.experimentIds ?? []).map((id) => experimentsById.get(id)).filter((e): e is Experiment => !!e),
    [trial, experimentsById],
  );
  if (!trial || !settings) return null;

  const stats = trialStats({ trial, sessions, draws, settings, today, experiments: active });
  const day = trialDayIndex(trial.startDate, today);
  const roster = nextRoster(trial.experimentIds, verdicts, replacements);
  const nextNumber = trial.number + 1;

  const choose = (id: string, verdict: VerdictChoice) => {
    setVerdicts((v) => ({ ...v, [id]: verdict }));
    if (verdict !== "cut") replace(id, undefined);
  };
  const replace = (cutId: string, withId: string | undefined) =>
    setReplacements((r) => {
      const next = Object.fromEntries(Object.entries(r).filter(([k]) => k !== cutId));
      if (withId) next[cutId] = withId;
      return next;
    });

  const confirm = async () => {
    if (!roster.ok || saving) return;
    setSaving(true);
    setFailed(false);
    try {
      await closeTrial({ verdicts, replacements });
      onClosed();
    } catch {
      setSaving(false);
      setFailed(true);
    }
  };

  const pending = (() => {
    if (roster.ok) return undefined;
    const name = roster.experimentId ? experimentsById.get(roster.experimentId)?.name : undefined;
    if (roster.reason === "undecided") return "Choose keep, cut, or extend for each experiment.";
    if (roster.reason === "needs-replacement") return `Pick a replacement for ${name ?? "the cut experiment"}.`;
    return "Each experiment can only be in the next trial once.";
  })();

  return (
    <main className="screen verdict">
      <header className="screen-header">
        <button type="button" className="btn btn-link back" onClick={onBack}>
          Back
        </button>
        <h1 className="screen-title">Close trial {trial.number}</h1>
        <p className="lede">
          {day > trial.lengthDays
            ? `${day} days done, ${trial.lengthDays} planned.`
            : day === trial.lengthDays
            ? `${trial.lengthDays} days done.`
            : `Closing on day ${day} of ${trial.lengthDays}.`}{" "}
          Look at what pulled you back, then decide what comes into trial {nextNumber}.
        </p>
      </header>

      <ul className="verdict-list">
        {active.map((e) => {
          const verdict = verdicts[e.id];
          const replacementId = replacements[e.id];
          const replacement = replacementId ? experimentsById.get(replacementId) : undefined;
          const taken = new Set([...trial.experimentIds, ...Object.values(replacements)]);
          return (
            <li key={e.id}>
              <article className={`verdict-card stream-${e.stream}`} aria-labelledby={`verdict-${e.id}`}>
                <StreamTag stream={e.stream} />
                <h2 id={`verdict-${e.id}`} className="verdict-name">
                  {e.name}
                </h2>
                <StatsStrip stats={stats[e.id]} />
                <fieldset className="field">
                  <legend className="field-label">What next for {e.name}?</legend>
                  <div className="segmented segmented-3">
                    {CHOICES.map((c) => (
                      <label key={c} className={verdict === c ? "is-checked" : undefined}>
                        <input
                          type="radio"
                          name={`verdict-${e.id}`}
                          value={c}
                          checked={verdict === c}
                          onChange={() => choose(e.id, c)}
                        />
                        <span>{VERDICT_LABELS[c]}</span>
                      </label>
                    ))}
                  </div>
                  {verdict && <p className="hint">{CHOICE_NOTES[verdict]}</p>}
                </fieldset>
                {verdict === "cut" &&
                  (replacement ? (
                    <div className="replacement-chosen">
                      <p>
                        <span className="field-label">Replacement</span>
                        {replacement.name}
                      </p>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        aria-label={`Change the replacement for ${e.name}`}
                        onClick={() => replace(e.id, undefined)}
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <ReplacementPicker
                      cut={e}
                      experiments={experiments}
                      taken={taken}
                      onPick={(id) => replace(e.id, id)}
                    />
                  ))}
              </article>
            </li>
          );
        })}
      </ul>

      <section className="verdict-summary" aria-labelledby="verdict-summary-title">
        <h2 id="verdict-summary-title" className="section-title">
          Trial {nextNumber}
        </h2>
        {roster.ok ? (
          <ul className="roster">
            {roster.experimentIds.map((id) => (
              <li key={id}>{experimentsById.get(id)?.name}</li>
            ))}
          </ul>
        ) : (
          <p className="settings-note">{pending}</p>
        )}
        <p className="hint">Trial {nextNumber} starts today and runs 21 days.</p>
        {failed && <p className="settings-note">That did not save. Try again.</p>}
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={!roster.ok || saving}
          onClick={() => void confirm()}
        >
          Close trial {trial.number} and start trial {nextNumber}
        </button>
      </section>
    </main>
  );
}

function ReplacementPicker({
  cut,
  experiments,
  taken,
  onPick,
}: {
  cut: Experiment;
  experiments: readonly Experiment[];
  taken: ReadonlySet<string>;
  onPick: (id: string) => void;
}) {
  const [stream, setStream] = useState<StreamChoice>(cut.stream);
  const [query, setQuery] = useState("");
  const options = filterExperiments(experiments, { stream, portableOnly: false, query }).filter((e) => !taken.has(e.id));
  const searchId = `replace-search-${cut.id}`;
  return (
    <div className="replacement-picker" role="group" aria-label={`Replacement for ${cut.name}`}>
      <p className="field-label">Pick a replacement from the library</p>
      <label className="visually-hidden" htmlFor={searchId}>
        Search for a replacement for {cut.name}
      </label>
      <input
        id={searchId}
        className="input"
        type="search"
        placeholder="Search the library"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <StreamFilter name={`replace-stream-${cut.id}`} value={stream} onChange={setStream} />
      {options.length === 0 ? (
        <p className="hint">Nothing matches. Try another stream or search.</p>
      ) : (
        <ul className="replacement-options">
          {options.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                className={`btn btn-option stream-${o.stream}`}
                aria-label={`Replace ${cut.name} with ${o.name}`}
                onClick={() => onPick(o.id)}
              >
                <span className="stream-dot" aria-hidden="true" />
                <span className="replacement-option-text">
                  <span className="replacement-option-name">{o.name}</span>
                  <span className="replacement-option-unit">{o.unit}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import { useMemo, useState, type FormEvent } from "react";
import { ExperimentCard } from "../components/ExperimentCard";
import { StreamFilter, type StreamChoice } from "../components/StreamFilter";
import { filterExperiments, streamCounts } from "../components/filterExperiments";
import { MAX_ACTIVE, MIN_ACTIVE, STREAM_LABELS, STREAMS, type Experiment, type Stream } from "../domain/types";
import {
  addToTrial,
  createExperiment,
  deleteExperiment,
  removeFromTrial,
  setArchived,
  trialReferences,
} from "../state/actions";
import type { AppState } from "../state/useAppStore";

export function Library({ state }: { state: AppState }) {
  const [stream, setStream] = useState<StreamChoice>("all");
  const [portableOnly, setPortableOnly] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const visible = useMemo(() => {
    const list = filterExperiments(state.experiments, { stream, portableOnly, query, showArchived });
    // A just-created experiment leads the list so it is one tap from the trial.
    const created = createdId ? list.find((e) => e.id === createdId) : undefined;
    return created ? [created, ...list.filter((e) => e !== created)] : list;
  }, [state.experiments, stream, portableOnly, query, showArchived, createdId]);
  const counts = useMemo(
    () => streamCounts(state.experiments, { portableOnly, query, showArchived }),
    [state.experiments, portableOnly, query, showArchived],
  );
  const archivedCount = state.experiments.filter((e) => e.archived).length;
  const activeIds = state.trial?.experimentIds ?? [];
  const full = activeIds.length >= MAX_ACTIVE;
  const atMinimum = activeIds.length <= MIN_ACTIVE;
  const createdName = createdId ? state.experimentsById.get(createdId)?.name : undefined;

  const deletable = (e: Experiment) =>
    e.custom && !trialReferences(state.trials, e.id) && !state.sessions.some((s) => s.experimentId === e.id);

  return (
    <main className="screen library">
      <header className="screen-header">
        <p className="wordmark">Out of My Head</p>
        <div className="library-title">
          <h1 className="screen-title">Library</h1>
          {!creating && (
            <button type="button" className="btn btn-secondary" onClick={() => setCreating(true)}>
              Create experiment
            </button>
          )}
        </div>
        <p className="lede" aria-live="polite">
          {activeIds.length} of {MAX_ACTIVE} in this trial.
          {full ? " Remove one to make room." : ""}
        </p>
      </header>

      {creating && (
        <CreateExperimentForm
          onCancel={() => setCreating(false)}
          onCreated={(e) => {
            setCreating(false);
            setCreatedId(e.id);
          }}
        />
      )}
      {createdName && !creating && (
        <p className="notice" role="status">
          Created {createdName}. It is first in the list below.
        </p>
      )}

      <div className="filters">
        <label className="visually-hidden" htmlFor="library-search">
          Search experiments
        </label>
        <input
          id="library-search"
          className="input"
          type="search"
          placeholder="Search experiments"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <StreamFilter name="library-stream" value={stream} onChange={setStream} counts={counts} />
        <div className="filters-toggles">
          <label className="toggle">
            <input type="checkbox" checked={portableOnly} onChange={(e) => setPortableOnly(e.target.checked)} />
            <span>Portable only</span>
          </label>
          <label className="toggle">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            <span>Show archived{archivedCount > 0 ? ` (${archivedCount})` : ""}</span>
          </label>
        </div>
      </div>

      <p className="hint" aria-live="polite">
        {visible.length === 1 ? "1 experiment" : `${visible.length} experiments`}
      </p>

      <ul className="exp-list">
        {visible.map((e) => {
          const inTrial = activeIds.includes(e.id);
          return (
            <li key={e.id}>
              <ExperimentCard experiment={e} selected={inTrial}>
                {inTrial ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-quiet"
                      aria-label={`Remove ${e.name} from trial`}
                      disabled={atMinimum}
                      onClick={() => void removeFromTrial(e.id)}
                    >
                      Remove from trial
                    </button>
                    {atMinimum && <p className="hint">A trial keeps at least {MIN_ACTIVE}.</p>}
                  </>
                ) : e.archived ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    aria-label={`Unarchive ${e.name}`}
                    onClick={() => void setArchived(e.id, false)}
                  >
                    Unarchive
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      aria-label={`Add ${e.name} to trial`}
                      disabled={full}
                      onClick={() => void addToTrial(e.id)}
                    >
                      Add to trial
                    </button>
                    <button
                      type="button"
                      className="btn btn-link"
                      aria-label={`Archive ${e.name}`}
                      onClick={() => void setArchived(e.id, true)}
                    >
                      Archive
                    </button>
                  </>
                )}
                {!inTrial && deletable(e) && confirmDelete !== e.id && (
                  <button
                    type="button"
                    className="btn btn-link"
                    aria-label={`Delete ${e.name}`}
                    onClick={() => setConfirmDelete(e.id)}
                  >
                    Delete
                  </button>
                )}
                {confirmDelete === e.id && (
                  <div className="confirm" role="group" aria-label={`Confirm deleting ${e.name}`}>
                    <p>Delete {e.name} for good? It has no sessions and no trial uses it.</p>
                    <div className="confirm-actions">
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => {
                          setConfirmDelete(null);
                          void deleteExperiment(e.id);
                        }}
                      >
                        Delete experiment
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>
                        Keep it
                      </button>
                    </div>
                  </div>
                )}
              </ExperimentCard>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

function CreateExperimentForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (e: Experiment) => void;
}) {
  const [name, setName] = useState("");
  const [stream, setStream] = useState<Stream>("writing");
  const [what, setWhat] = useState("");
  const [tests, setTests] = useState("");
  const [unit, setUnit] = useState("");
  const [portable, setPortable] = useState(false);
  const [saving, setSaving] = useState(false);
  const canSave = name.trim() !== "" && what.trim() !== "" && unit.trim() !== "" && !saving;

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!canSave) return;
    setSaving(true);
    try {
      onCreated(await createExperiment({ name, stream, do: what, tests, unit, portable }));
    } catch {
      setSaving(false);
    }
  };

  return (
    <section className="create-panel" aria-labelledby="create-title">
      <h2 id="create-title" className="section-title">
        Create experiment
      </h2>
      <form className="form" onSubmit={submit}>
        <div className="field">
          <label className="field-label" htmlFor="new-name">
            Name
          </label>
          <input id="new-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <fieldset className="field">
          <legend className="field-label">Stream</legend>
          <div className="chips">
            {STREAMS.map((s) => (
              <label key={s} className={`chip stream-${s}`}>
                <input type="radio" name="new-stream" checked={stream === s} onChange={() => setStream(s)} />
                <span>{STREAM_LABELS[s]}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="field">
          <label className="field-label" htmlFor="new-do">
            Do
          </label>
          <textarea
            id="new-do"
            className="input textarea"
            rows={3}
            placeholder="What to do each session"
            value={what}
            onChange={(e) => setWhat(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="new-tests">
            Tests <span className="field-optional">(optional)</span>
          </label>
          <input
            id="new-tests"
            className="input"
            placeholder="What this experiment finds out"
            value={tests}
            onChange={(e) => setTests(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="new-unit">
            Minimum unit
          </label>
          <input
            id="new-unit"
            className="input"
            placeholder="For example, one 100-word fragment"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          />
        </div>
        <label className="toggle">
          <input type="checkbox" checked={portable} onChange={(e) => setPortable(e.target.checked)} />
          <span>Portable, it can come on a trip</span>
        </label>
        <div className="confirm-actions">
          <button type="submit" className="btn btn-primary" disabled={!canSave}>
            Save experiment
          </button>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}

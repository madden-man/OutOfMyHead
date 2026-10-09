import { useMemo, useState } from "react";
import { ExperimentCard } from "../components/ExperimentCard";
import { StreamFilter, type StreamChoice } from "../components/StreamFilter";
import { filterExperiments } from "../components/filterExperiments";
import { MAX_ACTIVE, MIN_ACTIVE } from "../domain/types";
import { addToTrial, removeFromTrial } from "../state/actions";
import type { AppState } from "../state/useAppStore";

export function Library({ state }: { state: AppState }) {
  const [stream, setStream] = useState<StreamChoice>("all");
  const [portableOnly, setPortableOnly] = useState(false);
  const [query, setQuery] = useState("");
  const visible = useMemo(
    () => filterExperiments(state.experiments, { stream, portableOnly, query }),
    [state.experiments, stream, portableOnly, query],
  );
  const activeIds = state.trial?.experimentIds ?? [];
  const full = activeIds.length >= MAX_ACTIVE;
  const atMinimum = activeIds.length <= MIN_ACTIVE;

  return (
    <main className="screen library">
      <header className="screen-header">
        <p className="wordmark">Out of My Head</p>
        <h1 className="screen-title">Library</h1>
        <p className="lede" aria-live="polite">
          {activeIds.length} of {MAX_ACTIVE} in this trial.
          {full ? " Remove one to make room." : ""}
        </p>
      </header>

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
        <StreamFilter name="library-stream" value={stream} onChange={setStream} />
        <label className="toggle">
          <input type="checkbox" checked={portableOnly} onChange={(e) => setPortableOnly(e.target.checked)} />
          <span>Portable only</span>
        </label>
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
                ) : (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    aria-label={`Add ${e.name} to trial`}
                    disabled={full}
                    onClick={() => void addToTrial(e.id)}
                  >
                    Add to trial
                  </button>
                )}
              </ExperimentCard>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

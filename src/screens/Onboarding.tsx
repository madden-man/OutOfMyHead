import { useMemo, useState } from "react";
import { ExperimentCard } from "../components/ExperimentCard";
import { StreamFilter, type StreamChoice } from "../components/StreamFilter";
import { filterExperiments } from "../components/filterExperiments";
import { MAX_ACTIVE, MIN_ACTIVE, type Experiment } from "../domain/types";
import { startFirstTrial } from "../state/actions";

export function Onboarding({ experiments }: { experiments: Experiment[] }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [stream, setStream] = useState<StreamChoice>("all");
  const [busy, setBusy] = useState(false);
  const visible = useMemo(
    () => filterExperiments(experiments, { stream, portableOnly: false, query: "" }),
    [experiments, stream],
  );

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= MAX_ACTIVE ? p : [...p, id]));

  const canStart = picked.length >= MIN_ACTIVE && picked.length <= MAX_ACTIVE && !busy;
  const start = async () => {
    if (!canStart) return;
    setBusy(true);
    try {
      await startFirstTrial(picked);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="screen onboarding">
      <header className="onboarding-intro">
        <p className="wordmark">Out of My Head</p>
        <h1 className="display">Three weeks. A few small experiments. See what pulls you back.</h1>
        <p className="lede">
          Pick two to four experiments for your first trial. Each day the app draws one for you to work on. Do as
          little as the minimum unit and log how it felt.
        </p>
      </header>

      <StreamFilter name="onboarding-stream" value={stream} onChange={setStream} />

      <ul className="exp-list">
        {visible.map((e) => {
          const isPicked = picked.includes(e.id);
          const full = !isPicked && picked.length >= MAX_ACTIVE;
          return (
            <li key={e.id}>
              <ExperimentCard experiment={e} selected={isPicked}>
                <button
                  type="button"
                  className={isPicked ? "btn btn-quiet" : "btn btn-secondary"}
                  aria-pressed={isPicked}
                  aria-label={`${isPicked ? "Remove" : "Pick"} ${e.name}`}
                  disabled={full}
                  onClick={() => toggle(e.id)}
                >
                  {isPicked ? "Picked" : "Pick"}
                </button>
              </ExperimentCard>
            </li>
          );
        })}
      </ul>

      <div className="action-bar">
        <p className="action-bar-count" aria-live="polite">
          {picked.length === 0
            ? "Pick two to four"
            : `${picked.length} picked${picked.length < MIN_ACTIVE ? ", pick one more" : ""}${
                picked.length === MAX_ACTIVE ? ", that is the most" : ""
              }`}
        </p>
        <button type="button" className="btn btn-primary" disabled={!canStart} onClick={start}>
          Start trial 1
        </button>
      </div>
    </main>
  );
}

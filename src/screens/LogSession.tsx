import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { StreamTag } from "../components/StreamTag";
import { BlobImage } from "../components/BlobMedia";
import { attachmentMime, checkAttachmentFile, formatBytes } from "../domain/attachments";
import { PULL_LABELS, type Pull } from "../domain/types";
import { now } from "../lib/clock";
import { logSession } from "../state/actions";
import type { AppState } from "../state/useAppStore";

const PULLS: Pull[] = [1, 2, 3, 4, 5];

interface TimerState {
  runningSince: number | null; // ms timestamp while running
  accumulated: number; // ms from earlier runs
  firstStart: string | null; // ISO datetime of the first start
}

function elapsed(t: TimerState, at: number): number {
  return t.accumulated + (t.runningSince === null ? 0 : at - t.runningSince);
}

function formatClock(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function toMinutes(ms: number): number {
  return Math.max(1, Math.round(ms / 60_000));
}

export function LogSession({
  state,
  experimentId,
  onDone,
}: {
  state: AppState;
  experimentId: string;
  onDone: () => void;
}) {
  const experiment = state.experimentsById.get(experimentId);
  const lastNote = state.notes[experimentId];
  const [minutes, setMinutes] = useState("");
  const [pull, setPull] = useState<Pull | null>(null);
  const [thought, setThought] = useState<boolean | null>(null);
  const [nextNote, setNextNote] = useState("");
  const [snippet, setSnippet] = useState("");
  const [file, setFile] = useState<File | undefined>(undefined);
  const [fileError, setFileError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [timer, setTimer] = useState<TimerState>({ runningSince: null, accumulated: 0, firstStart: null });
  const [tick, setTick] = useState(() => now().getTime());

  const running = timer.runningSince !== null;
  useEffect(() => {
    if (!running) return;
    const handle = window.setInterval(() => setTick(now().getTime()), 1000);
    return () => window.clearInterval(handle);
  }, [running]);

  if (!experiment) {
    return (
      <main className="screen">
        <p>That experiment is not in the library any more.</p>
        <button type="button" className="btn btn-secondary" onClick={onDone}>
          Back to Today
        </button>
      </main>
    );
  }

  const startTimer = () => {
    const t = now();
    setTick(t.getTime());
    setTimer((prev) => ({
      ...prev,
      runningSince: t.getTime(),
      firstStart: prev.firstStart ?? t.toISOString(),
    }));
  };
  const pauseTimer = () => {
    const at = now().getTime();
    const ms = elapsed(timer, at);
    setTick(at);
    setTimer({ ...timer, runningSince: null, accumulated: ms });
    setMinutes(String(toMinutes(ms)));
  };
  const resetTimer = () => setTimer({ runningSince: null, accumulated: 0, firstStart: null });

  const minutesValue = Number(minutes);
  const timerMs = elapsed(timer, tick);
  const minutesValid = running || (minutes.trim() !== "" && Number.isFinite(minutesValue) && minutesValue > 0);
  const canSave = minutesValid && pull !== null && thought !== null && !saving;

  const pickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (!picked) return;
    const check = checkAttachmentFile(picked);
    if (!check.ok) {
      setFileError(check.message);
      e.target.value = "";
      return;
    }
    setFileError(null);
    setFile(picked);
  };
  const removeFile = () => {
    setFile(undefined);
    setFileError(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSave || pull === null || thought === null) return;
    setSaving(true);
    setSaveError(null);
    const finalMinutes = running ? toMinutes(elapsed(timer, now().getTime())) : minutesValue;
    try {
      await logSession({
        experimentId,
        minutes: finalMinutes,
        pull,
        thoughtAboutIt: thought,
        nextNote,
        snippet,
        ...(file ? { file } : {}),
        ...(timer.firstStart ? { startedAt: timer.firstStart } : {}),
      });
      onDone();
    } catch (err) {
      setSaving(false);
      setSaveError(err instanceof Error ? err.message : "That did not save. Try again.");
    }
  };

  return (
    <main className="screen log">
      <header className="screen-header">
        <button type="button" className="btn btn-link back" onClick={onDone}>
          Back to Today
        </button>
        <h1 className="screen-title">Log session</h1>
        <div className="log-exp">
          <StreamTag stream={experiment.stream} />
          <p className="log-exp-name">{experiment.name}</p>
          <p className="hint">Minimum: {experiment.unit}</p>
        </div>
      </header>

      <form className="form" onSubmit={submit}>
        <section className="field">
          <label className="field-label" htmlFor="minutes">
            Minutes
          </label>
          <div className="timer">
            <output className="timer-clock" aria-label="Timer">
              {formatClock(timerMs)}
            </output>
            {running ? (
              <button type="button" className="btn btn-secondary" onClick={pauseTimer}>
                Stop timer
              </button>
            ) : (
              <button type="button" className="btn btn-secondary" onClick={startTimer}>
                {timerMs > 0 ? "Resume timer" : "Start timer"}
              </button>
            )}
            {!running && timerMs > 0 && (
              <button type="button" className="btn btn-link" onClick={resetTimer}>
                Reset
              </button>
            )}
          </div>
          <input
            id="minutes"
            className="input input-number"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            placeholder={running ? "Timer running" : "Or type minutes"}
            value={running ? "" : minutes}
            disabled={running}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </section>

        <fieldset className="field">
          <legend className="field-label">How much did you want to start?</legend>
          <div className="pull-scale">
            {PULLS.map((p) => (
              <label key={p} className={`pull-option${pull === p ? " is-checked" : ""}`}>
                <input type="radio" name="pull" value={p} checked={pull === p} onChange={() => setPull(p)} />
                <span className="pull-number" aria-hidden="true">
                  {p}
                </span>
                <span className="pull-label">{PULL_LABELS[p]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="field">
          <legend className="field-label">Thought about it since last time?</legend>
          <div className="segmented">
            <label className={thought === true ? "is-checked" : undefined}>
              <input type="radio" name="thought" checked={thought === true} onChange={() => setThought(true)} />
              <span>Yes</span>
            </label>
            <label className={thought === false ? "is-checked" : undefined}>
              <input type="radio" name="thought" checked={thought === false} onChange={() => setThought(false)} />
              <span>No</span>
            </label>
          </div>
        </fieldset>

        <section className="field">
          <label className="field-label" htmlFor="next-note">
            Next note
          </label>
          <input
            id="next-note"
            className="input"
            type="text"
            autoComplete="off"
            placeholder="What to pick up next time"
            value={nextNote}
            onChange={(e) => setNextNote(e.target.value)}
          />
          {lastNote && <p className="hint">Last time: {lastNote}</p>}
        </section>

        <section className="field">
          <label className="field-label" htmlFor="snippet">
            Snippet <span className="field-optional">(optional)</span>
          </label>
          <textarea
            id="snippet"
            className="input textarea"
            rows={4}
            placeholder="Paste a line, a fragment, a chord change"
            value={snippet}
            onChange={(e) => setSnippet(e.target.value)}
          />
        </section>

        <section className="field">
          <label className="field-label" htmlFor="attachment">
            Image or audio <span className="field-optional">(optional)</span>
          </label>
          <input
            ref={fileInput}
            id="attachment"
            className="file-input"
            type="file"
            accept="image/*,audio/*"
            aria-describedby="attachment-hint"
            onChange={pickFile}
          />
          <p id="attachment-hint" className="hint">
            One photo or one recording, up to 25 MB.
          </p>
          {fileError && (
            <p className="form-message" role="alert">
              {fileError}
            </p>
          )}
          {file && <FilePreview file={file} onRemove={removeFile} />}
        </section>

        {saveError && (
          <p className="form-message" role="alert">
            {saveError}
          </p>
        )}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary btn-block" disabled={!canSave}>
            Save session
          </button>
        </div>
      </form>
    </main>
  );
}

function FilePreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const isImage = attachmentMime(file).startsWith("image/");
  return (
    <div className="file-preview">
      {isImage && <BlobImage className="file-preview-image" blob={file} alt={`Preview of ${file.name}`} />}
      <div className="file-preview-meta">
        <p className="file-preview-name">{file.name}</p>
        <p className="hint">
          {isImage ? "Image" : "Audio"}, {formatBytes(file.size)}
        </p>
        <button type="button" className="btn btn-secondary" aria-label={`Remove ${file.name}`} onClick={onRemove}>
          Remove
        </button>
      </div>
    </div>
  );
}

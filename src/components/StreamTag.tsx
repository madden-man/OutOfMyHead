import { STREAM_LABELS, type Stream } from "../domain/types";

export function StreamTag({ stream }: { stream: Stream }) {
  return (
    <span className={`stream-tag stream-${stream}`}>
      <span className="stream-dot" aria-hidden="true" />
      {STREAM_LABELS[stream]}
    </span>
  );
}

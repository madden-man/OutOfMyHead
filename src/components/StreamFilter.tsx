import { STREAM_LABELS, STREAMS, type Stream } from "../domain/types";

export type StreamChoice = Stream | "all";

export function StreamFilter({
  value,
  onChange,
  name,
  counts,
}: {
  value: StreamChoice;
  onChange: (value: StreamChoice) => void;
  name: string;
  /** Optional count shown on each chip. The list's live count announces it too. */
  counts?: Record<StreamChoice, number>;
}) {
  const options: { value: StreamChoice; label: string }[] = [
    { value: "all", label: "All" },
    ...STREAMS.map((s) => ({ value: s, label: STREAM_LABELS[s] })),
  ];
  return (
    <fieldset className="chips">
      <legend className="visually-hidden">Stream</legend>
      {options.map((o) => (
        <label key={o.value} className={`chip${o.value !== "all" ? ` stream-${o.value}` : ""}`}>
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
          />
          <span>
            {o.label}
            {counts && (
              <span className="chip-count" aria-hidden="true">
                {counts[o.value]}
              </span>
            )}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

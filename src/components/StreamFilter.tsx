import { STREAM_LABELS, STREAMS, type Stream } from "../domain/types";

export type StreamChoice = Stream | "all";

export function StreamFilter({
  value,
  onChange,
  name,
}: {
  value: StreamChoice;
  onChange: (value: StreamChoice) => void;
  name: string;
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
          <span>{o.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

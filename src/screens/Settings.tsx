import { useState } from "react";
import { parseTime } from "../domain/nudge";
import { MAX_FLOOR, MIN_FLOOR, SEASON_LABELS, type Season } from "../domain/types";
import { nudgePermission, requestNudgePermission, type NudgePermission } from "../lib/notify";
import { setFloor, setNudgeTime, setSeason } from "../state/actions";
import type { AppState } from "../state/useAppStore";

const SEASONS: Season[] = ["normal", "travel", "newborn"];

const SEASON_NOTES: Record<Season, string> = {
  normal: "Every active experiment is in the draw. The floor is a gentle target, and anything above it is bonus.",
  travel:
    "Only portable experiments are drawn, starting tomorrow. The rest rest, with no floor, until you switch back. Today's draw stays as it is.",
  newborn:
    "The draw becomes an offer, Pass goes away, and these weeks never break a streak. Do what you can, and that is plenty.",
};

export function Settings({ state }: { state: AppState }) {
  const { settings } = state;
  if (!settings) return null;

  return (
    <main className="screen settings">
      <header className="screen-header">
        <p className="wordmark">Out of My Head</p>
        <h1 className="screen-title">Settings</h1>
      </header>

      <fieldset className="settings-group">
        <legend className="section-title">Season</legend>
        <div className="segmented segmented-3">
          {SEASONS.map((season) => (
            <label key={season} className={settings.season === season ? "is-checked" : undefined}>
              <input
                type="radio"
                name="season"
                value={season}
                checked={settings.season === season}
                onChange={() => void setSeason(season)}
              />
              <span>{SEASON_LABELS[season]}</span>
            </label>
          ))}
        </div>
        <p className="settings-note" aria-live="polite">
          {SEASON_NOTES[settings.season]}
        </p>
      </fieldset>

      <section className="settings-group" aria-labelledby="floor-settings-title">
        <h2 id="floor-settings-title" className="section-title">
          Weekly floor
        </h2>
        <p className="settings-note">
          Sessions per experiment per week, from {MIN_FLOOR} to {MAX_FLOOR}. The app shows a week as cleared, and
          anything above the floor as bonus.
        </p>
        <ul className="floor-settings">
          {SEASONS.map((season) => (
            <li key={season}>
              <FloorStepper season={season} value={settings.floorPerWeek[season]} />
            </li>
          ))}
        </ul>
      </section>

      <NudgeSettings nudgeTime={settings.nudgeTime} />
    </main>
  );
}

function FloorStepper({ season, value }: { season: Season; value: number }) {
  const label = SEASON_LABELS[season];
  const id = `floor-${season}`;
  return (
    <div className="stepper">
      <span className="stepper-label" id={id}>
        {label}
      </span>
      <div className="stepper-controls">
        <button
          type="button"
          className="btn btn-secondary stepper-btn"
          aria-label={`Lower the ${label.toLowerCase()} floor`}
          disabled={value <= MIN_FLOOR}
          onClick={() => void setFloor(season, value - 1)}
        >
          -
        </button>
        <output className="stepper-value" aria-labelledby={id} aria-live="polite">
          {value}
        </output>
        <button
          type="button"
          className="btn btn-secondary stepper-btn"
          aria-label={`Raise the ${label.toLowerCase()} floor`}
          disabled={value >= MAX_FLOOR}
          onClick={() => void setFloor(season, value + 1)}
        >
          +
        </button>
      </div>
    </div>
  );
}

function NudgeSettings({ nudgeTime }: { nudgeTime: string | undefined }) {
  const [draft, setDraft] = useState(nudgeTime ?? "");
  const [permission, setPermission] = useState<NudgePermission>(nudgePermission);

  const save = async (value: string) => {
    setDraft(value);
    if (!parseTime(value)) return;
    await setNudgeTime(value);
    setPermission(await requestNudgePermission());
  };

  const turnOff = async () => {
    setDraft("");
    await setNudgeTime(undefined);
  };

  return (
    <section className="settings-group" aria-labelledby="nudge-title">
      <h2 id="nudge-title" className="section-title">
        Daily nudge
      </h2>
      <p className="settings-note">
        One optional reminder a day that names the day&apos;s draw. It comes only while the app is open.
      </p>
      <div className="field">
        <label className="field-label" htmlFor="nudge-time">
          Nudge time
        </label>
        <input
          id="nudge-time"
          className="input input-time"
          type="time"
          value={draft}
          onChange={(e) => void save(e.target.value)}
        />
      </div>
      <p className="settings-note" aria-live="polite" data-testid="nudge-status">
        {nudgeStatus(nudgeTime, permission)}
      </p>
      {nudgeTime && (
        <button type="button" className="btn btn-secondary" onClick={() => void turnOff()}>
          Turn off nudge
        </button>
      )}
    </section>
  );
}

function nudgeStatus(time: string | undefined, permission: NudgePermission): string {
  if (permission === "unsupported") {
    return time
      ? `Saved for ${time}, but this browser cannot show notifications. Today's draw is waiting whenever you open the app.`
      : "This browser cannot show notifications. Today's draw is waiting whenever you open the app.";
  }
  if (!time) return "Off. Set a time to turn it on.";
  if (permission === "granted") return `On. One nudge at ${time} each day while the app is open.`;
  if (permission === "denied") {
    return `Saved for ${time}. Notifications are off for this app in your browser settings, so the nudge stays quiet until you allow them there.`;
  }
  return `Saved for ${time}. Allow notifications when your browser asks.`;
}

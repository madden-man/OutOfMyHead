import { useEffect, useState } from "react";
import { ensureSeeded } from "./db/seed";
import { TabBar, type Tab } from "./components/TabBar";
import { ensureTodayDraw } from "./state/actions";
import { useAppStore, type AppState } from "./state/useAppStore";
import { useNudge } from "./state/useNudge";
import { useToday } from "./state/useToday";
import { nudgeBody } from "./domain/nudge";
import { Onboarding } from "./screens/Onboarding";
import { Today } from "./screens/Today";
import { LogSession } from "./screens/LogSession";
import { TrialScreen } from "./screens/TrialScreen";
import { Library } from "./screens/Library";
import { Review } from "./screens/Review";
import { Settings } from "./screens/Settings";
import { Verdict } from "./screens/Verdict";

export type Route = { name: Tab } | { name: "log"; experimentId: string } | { name: "verdict" };

/** The nudge text for today's draw, or undefined before the draw exists. */
function todayNudge(state: AppState | undefined, today: string): string | undefined {
  const draw = state?.draws.find((d) => d.date === today);
  if (!state || !draw) return undefined;
  const id = draw.passedTo ?? draw.experimentId;
  const experiment = state.experimentsById.get(id);
  return experiment ? nudgeBody(experiment.name, state.notes[id]) : undefined;
}

export function App() {
  const [seeded, setSeeded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [route, setRoute] = useState<Route>({ name: "today" });
  const state = useAppStore();
  const today = useToday();
  useNudge(state?.settings?.onboarded ? state.settings.nudgeTime : undefined, todayNudge(state, today));

  useEffect(() => {
    let cancelled = false;
    ensureSeeded()
      .then(() => {
        if (!cancelled) setSeeded(true);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const trialId = state?.trial?.id;
  const hasTodayDraw = state?.draws.some((d) => d.date === today) ?? false;
  useEffect(() => {
    if (!trialId || hasTodayDraw) return;
    ensureTodayDraw(trialId).catch((e: unknown) => {
      setError(e instanceof Error ? e.message : String(e));
    });
  }, [trialId, hasTodayDraw, today]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  if (error) {
    return (
      <main className="screen">
        <h1 className="screen-title">Something went wrong</h1>
        <p>The local database could not open. Reload to try again.</p>
        <p className="hint">{error}</p>
      </main>
    );
  }

  if (!seeded || !state || !state.settings) {
    return (
      <main className="screen screen-loading" aria-busy="true">
        <p className="wordmark">Out of My Head</p>
      </main>
    );
  }

  if (!state.settings.onboarded || !state.trial) {
    return <Onboarding experiments={state.experiments} />;
  }

  const go = (next: Route) => setRoute(next);
  const tab: Tab | undefined = route.name === "log" || route.name === "verdict" ? undefined : route.name;
  const fullScreen = route.name === "log" || route.name === "verdict";

  return (
    <div className="app">
      <div className={fullScreen ? "app-body is-full" : "app-body"}>
        {route.name === "today" && <Today state={state} today={today} go={go} />}
        {route.name === "log" && (
          <LogSession
            state={state}
            experimentId={route.experimentId}
            onDone={() => go({ name: "today" })}
          />
        )}
        {route.name === "trial" && <TrialScreen state={state} today={today} go={go} />}
        {route.name === "review" && <Review state={state} today={today} />}
        {route.name === "library" && <Library state={state} />}
        {route.name === "settings" && <Settings state={state} today={today} />}
        {route.name === "verdict" && (
          <Verdict
            state={state}
            today={today}
            onBack={() => go({ name: "today" })}
            onClosed={() => go({ name: "today" })}
          />
        )}
      </div>
      {!fullScreen && <TabBar current={tab} onSelect={(t) => go({ name: t })} />}
    </div>
  );
}

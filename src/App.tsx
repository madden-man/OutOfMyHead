import { useEffect, useState } from "react";
import { ensureSeeded } from "./db/seed";
import { TabBar, type Tab } from "./components/TabBar";
import { ensureTodayDraw } from "./state/actions";
import { useAppStore } from "./state/useAppStore";
import { today as todayFromClock } from "./lib/clock";
import { Onboarding } from "./screens/Onboarding";
import { Today } from "./screens/Today";
import { LogSession } from "./screens/LogSession";
import { TrialScreen } from "./screens/TrialScreen";
import { Library } from "./screens/Library";

export type Route = { name: Tab } | { name: "log"; experimentId: string };

export function App() {
  const [seeded, setSeeded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [route, setRoute] = useState<Route>({ name: "today" });
  const state = useAppStore();
  const today = todayFromClock();

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
  const tab: Tab | undefined = route.name === "log" ? undefined : route.name;

  return (
    <div className="app">
      <div className="app-body">
        {route.name === "today" && <Today state={state} today={today} go={go} />}
        {route.name === "log" && (
          <LogSession
            state={state}
            experimentId={route.experimentId}
            onDone={() => go({ name: "today" })}
          />
        )}
        {route.name === "trial" && <TrialScreen state={state} today={today} />}
        {route.name === "library" && <Library state={state} />}
      </div>
      {route.name !== "log" && <TabBar current={tab} onSelect={(t) => go({ name: t })} />}
    </div>
  );
}

export type Tab = "today" | "trial" | "library";

const TABS: { id: Tab; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "trial", label: "Trial" },
  { id: "library", label: "Library" },
];

export function TabBar({ current, onSelect }: { current: Tab | undefined; onSelect: (tab: Tab) => void }) {
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          className="tabbar-item"
          aria-current={current === t.id ? "page" : undefined}
          onClick={() => onSelect(t.id)}
        >
          <TabIcon tab={t.id} />
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

function TabIcon({ tab }: { tab: Tab }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (tab === "today") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
      </svg>
    );
  }
  if (tab === "trial") {
    return (
      <svg {...common}>
        <rect x="4" y="4" width="4" height="4" rx="1" />
        <rect x="10" y="4" width="4" height="4" rx="1" />
        <rect x="16" y="4" width="4" height="4" rx="1" />
        <rect x="4" y="10" width="4" height="4" rx="1" />
        <rect x="10" y="10" width="4" height="4" rx="1" />
        <rect x="4" y="16" width="4" height="4" rx="1" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M5 4h4v16H5zM10 4h4v16h-4z" />
      <path d="m15.5 5.2 3.8-1 3.9 14.8-3.8 1z" transform="translate(-2 0)" />
    </svg>
  );
}

/** Wrapping section switches keep every workspace reachable on narrow phones. */
export function WorkspaceTabs({
  value,
  onChange,
  items,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  items: { value: string; label: string; count?: number }[];
  label: string;
}) {
  return (
    <nav
      aria-label={label}
      className="spf-workspace-tabs mt-5 flex flex-wrap gap-1 rounded-2xl border border-[var(--portal-border)] bg-white p-1.5"
    >
      {items.map((item) => (
        <button
          type="button"
          key={item.value}
          aria-pressed={value === item.value}
          onClick={() => onChange(item.value)}
          className={`min-h-11 min-w-0 flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold sm:flex-none ${value === item.value ? "bg-[var(--portal-surface)] text-[var(--portal-accent)]" : "text-[var(--portal-muted)] hover:bg-[var(--portal-canvas)]"}`}
        >
          {item.label}
          {item.count !== undefined && (
            <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] tabular-nums">
              {item.count}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}

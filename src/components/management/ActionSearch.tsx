import { useMemo, useRef, useState } from "react";
import { ArrowUpRight, Search, X } from "lucide-react";
import { searchActions } from "./action-search-catalog";
import "./admin-search-layout.css";

/** Search only offers destinations allowed by the signed-in workspace role.
 * Destination route guards and Supabase permissions still determine actual access. */
export function ActionSearch({ role, readOnly = false }: { role: string; readOnly?: boolean }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const matches = useMemo(() => searchActions(query, role), [query, role]);

  return <div className="w-full min-w-0 max-w-xl" role="search" aria-label="Search available portal tools">
    <div className="flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-3 text-white focus-within:border-[var(--portal-highlight)] focus-within:ring-2 focus-within:ring-[var(--portal-highlight)]/30">
      <Search size={17} className="shrink-0 text-[color:var(--portal-highlight)]" aria-hidden="true" />
      <input
        ref={input}
        type="search"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
        onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}
        placeholder="Search any tool or task…"
        aria-label="Search available actions"
        aria-expanded={open}
        aria-controls="staff-action-results"
        disabled={readOnly}
        className="min-w-0 flex-1 bg-transparent py-3 text-sm text-white placeholder:text-white/65 outline-none disabled:cursor-not-allowed disabled:opacity-80"
      />
      {!readOnly && query && <button type="button" aria-label="Clear search" onClick={() => { setQuery(""); setOpen(true); input.current?.focus(); }} className="rounded p-1 hover:bg-white/10"><X size={15} /></button>}
      {!readOnly && open && <button type="button" onClick={() => setOpen(false)} aria-label="Close search results" className="rounded px-2 py-1 text-xs font-bold text-[color:var(--portal-highlight)] hover:bg-white/10">Close</button>}
    </div>
    {!readOnly && open && <section id="staff-action-results" aria-label="Action search results" className="mt-3 max-h-[min(54dvh,460px)] overflow-y-auto overscroll-contain rounded-2xl border border-[var(--portal-border)] bg-white p-2 text-[color:var(--portal-ink)] shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <p role="status" className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--portal-muted)]">{query.trim() ? `${matches.length} matching actions` : "Suggested actions"}</p>
        <span className="text-[11px] text-[color:var(--portal-muted)]">Tap a result to open it</span>
      </div>
      {matches.map((action) => <a key={`${action.href}-${action.label}`} href={action.href} className="flex items-center justify-between gap-3 rounded-xl px-3 py-3 hover:bg-[var(--portal-surface)] focus:bg-[var(--portal-surface)] focus:outline-2 focus:outline-[var(--portal-accent)]">
        <span className="min-w-0"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[color:var(--portal-muted)]">{action.category}</span><span className="block text-sm font-bold">{action.label}</span><span className="mt-0.5 block text-xs leading-5 text-[color:var(--portal-muted)]">{action.description}</span></span>
        <ArrowUpRight size={16} className="shrink-0 text-[color:var(--portal-muted)]" aria-hidden="true" />
      </a>)}
      {matches.length === 0 && <p className="px-3 py-5 text-sm text-[color:var(--portal-muted)]">No matching tools found. Try “attendance”, “members”, “salary”, “blog” or “gallery”.</p>}
    </section>}
  </div>;
}

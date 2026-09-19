import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";

type Action = { label: string; href: string; detail: string; roles: ("staff" | "reception" | "admin")[] };
const actions: Action[] = [
  { label: "Staff portal", href: "/portal/staff", detail: "Employee login and staff profile", roles: ["staff"] },
  { label: "Clock in / out", href: "/staff-attendance", detail: "Scan your staff attendance", roles: ["staff"] },
  { label: "Missed scans", href: "/staff-missed-scans", detail: "Request attendance correction", roles: ["staff", "admin"] },
  { label: "Reception 2.0", href: "/reception-workspace", detail: "Front desk workspace and member search", roles: ["reception", "admin"] },
  { label: "Member directory", href: "/management-members", detail: "Find member accounts", roles: ["reception", "admin"] },
  { label: "Member profiles", href: "/management-profiles", detail: "Open member details", roles: ["reception", "admin"] },
  { label: "Member QR scanner", href: "/reception-checkin", detail: "Record member check-ins", roles: ["reception", "admin"] },
  { label: "Member attendance", href: "/management-attendance", detail: "Member visit history", roles: ["reception", "admin"] },
  { label: "Register or renew", href: "/management-standard-plan", detail: "Standard plans and payments", roles: ["reception", "admin"] },
  { label: "Custom plan", href: "/management-custom-plan", detail: "Custom membership days and price", roles: ["reception", "admin"] },
  { label: "Birthday and expiry reminders", href: "/management-communications", detail: "WhatsApp communications", roles: ["reception", "admin"] },
  { label: "Operations", href: "/management-operations", detail: "Daily gym operations", roles: ["reception", "admin"] },
  { label: "Admin portal", href: "/staff-admin", detail: "Administration dashboard", roles: ["admin"] },
  { label: "Staff directory", href: "/management-staff", detail: "Manage employee records", roles: ["admin"] },
  { label: "Monthly staff", href: "/management-staff-monthly", detail: "Monthly attendance reports", roles: ["admin"] },
  { label: "Staff QR review", href: "/management-staff-review", detail: "Investigate attendance anomalies", roles: ["admin"] },
  { label: "Salary records", href: "/management-payroll", detail: "Pay ledger", roles: ["admin"] },
  { label: "Revenue", href: "/management-revenue", detail: "Revenue report", roles: ["admin"] },
  { label: "Export attendance", href: "/management-attendance-export", detail: "Attendance CSV", roles: ["admin"] },
  { label: "Export salaries", href: "/management-payroll-export", detail: "Salary CSV", roles: ["admin"] },
];
export function ActionSearch({ role }: { role: string }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const category = ["admin", "owner", "manager"].includes(role.toLowerCase()) ? "admin" : role.toLowerCase() === "reception" ? "reception" : "staff";
  useEffect(() => { const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); }; const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); input.current?.blur(); } }; document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape); return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); }; }, []);
  const results = useMemo(() => { const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean); return actions.filter(action => action.roles.includes(category)).filter(action => words.every(word => `${action.label} ${action.detail}`.toLowerCase().includes(word))); }, [query, category]);
  return <div ref={root} className="relative w-full min-w-0 max-w-sm" role="search" aria-label="Search available actions"><div className="flex min-w-0 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-3 text-white focus-within:border-[#b8ee73]"><Search size={17} className="shrink-0 text-[#b8ee73]"/><input ref={input} type="search" value={query} onFocus={() => setOpen(true)} onChange={event => { setQuery(event.target.value); setOpen(true); }} placeholder="Search actions…" aria-expanded={open} aria-controls="portal-action-results" className="min-w-0 flex-1 bg-transparent py-3 text-sm text-white placeholder:text-white/65 outline-none"/>{query && <button type="button" aria-label="Clear" onClick={() => { setQuery(""); input.current?.focus(); }} className="rounded p-1"><X size={15}/></button>}</div>{open && <div id="portal-action-results" className="absolute left-0 right-0 top-full z-[100] mt-2 max-h-[min(65vh,420px)] overflow-y-auto rounded-2xl border border-[#d9e6d2] bg-white p-2 text-[#193d2b] shadow-2xl"><p className="px-3 py-2 text-[11px] font-bold uppercase text-[#718172]">{query.trim() ? `${results.length} matching actions` : "Quick actions"}</p>{results.map(action => <a key={action.href} href={action.href} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2.5 hover:bg-[#edf6e9]"><strong className="block text-sm">{action.label}</strong><span className="mt-0.5 block text-xs text-[#667668]">{action.detail}</span></a>)}{!results.length && <p className="px-3 py-5 text-sm">No matching actions.</p>}</div>}</div>;
}

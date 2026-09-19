import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";

type Action = {
  label: string;
  href: string;
  description: string;
  keywords: string;
  management?: boolean;
  reception?: boolean;
  admin?: boolean;
};

const actions: Action[] = [
  { label: "Staff login / profile", href: "/staff", description: "Open your staff account", keywords: "login profile account" },
  { label: "Staff clock in / out", href: "/staff-attendance", description: "Record your work attendance", keywords: "shift qr scan work time" },
  { label: "Report a missed scan", href: "/staff-missed-scans", description: "Explain a forgotten clock-in or clock-out and track management's decision", keywords: "missed scan forgotten correction request attendance" },
  { label: "Reception 2.0", href: "/reception-workspace", description: "Open the reception workspace and member search", keywords: "reception front desk member dashboard", reception: true },
  { label: "Original reception dashboard", href: "/reception-dashboard", description: "Original reception and member tools", keywords: "member register renew manage membership", reception: true },
  { label: "Member QR scanner", href: "/reception-checkin", description: "Scan member check-ins", keywords: "camera entry exit attendance", reception: true },
  { label: "Dashboard overview", href: "/management-preview", description: "Gym management overview", keywords: "home statistics", reception: true },
  { label: "Find members", href: "/management-members", description: "Search the member directory", keywords: "member search status expiry", reception: true },
  { label: "Member profiles", href: "/management-profiles", description: "View member details", keywords: "member information membership", reception: true },
  { label: "Member attendance", href: "/management-attendance", description: "Review member visits", keywords: "visit history checkin", reception: true },
  { label: "Operations", href: "/management-operations", description: "Reception and gym actions", keywords: "tools tasks", reception: true },
  { label: "Register / renew", href: "/management-standard-plan", description: "Register members and add standard plans", keywords: "membership payment daily weekly monthly", reception: true },
  { label: "Custom plan", href: "/management-custom-plan", description: "Set custom membership days and price", keywords: "membership registration fee", reception: true },
  { label: "Birthdays and reminders", href: "/management-communications", description: "Send WhatsApp birthday and expiry messages", keywords: "birthday reminder whatsapp", reception: true },
  { label: "Staff directory", href: "/management-staff", description: "Staff profiles", keywords: "team employees", management: true },
  { label: "Monthly staff report", href: "/management-staff-monthly", description: "Attendance and work hours", keywords: "late shift punctuality", management: true },
  { label: "Review QR exceptions", href: "/management-staff-review", description: "Find late, open, overlapping and invalid staff clock-ins", keywords: "attendance anomaly duplicates missing checkout clockout correction review", management: true },
  { label: "Review missed-scan requests", href: "/staff-missed-scans", description: "Administrator review of staff explanations without changing QR records", keywords: "forgotten scan approve reject management request", admin: true },
  { label: "Export attendance", href: "/management-attendance-export", description: "Download attendance CSV", keywords: "staff spreadsheet", management: true },
  { label: "Salary records", href: "/management-payroll", description: "Recorded payroll entries", keywords: "salary wages payment", management: true },
  { label: "Export salaries", href: "/management-payroll-export", description: "Download salary CSV", keywords: "payroll spreadsheet", management: true },
  { label: "Revenue", href: "/management-revenue", description: "Review recorded gym revenue", keywords: "income finance sales", management: true },
  { label: "Staff admin", href: "/staff-admin", description: "Original administration tools", keywords: "payroll manage staff", management: true },
];

export function ActionSearch({ role }: { role: string }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const normalized = role.toLowerCase();
  const management = ["admin", "owner", "manager"].includes(normalized);
  const reception = management || normalized === "reception";
  const admin = normalized === "admin";

  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); input.current?.blur(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, []);

  const matches = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return actions.filter((action) => (!action.management || management) && (!action.reception || reception) && (!action.admin || admin))
      .filter((action) => words.every((word) => `${action.label} ${action.description} ${action.keywords}`.toLowerCase().includes(word)));
  }, [query, management, reception, admin]);

  return <div ref={root} className="relative w-full max-w-sm" role="search" aria-label="Search staff and reception actions">
    <div className="flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-3 text-white focus-within:border-[#b8ee73] focus-within:ring-2 focus-within:ring-[#b8ee73]/30"><Search size={17} className="shrink-0 text-[#b8ee73]"/><input ref={input} type="search" value={query} onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} placeholder="Search actions…" aria-label="Search available actions" aria-expanded={open} aria-controls="staff-action-results" className="min-w-0 flex-1 bg-transparent py-3 text-sm text-white placeholder:text-white/65 outline-none"/>{query && <button type="button" aria-label="Clear search" onClick={() => { setQuery(""); input.current?.focus(); }} className="rounded p-1 hover:bg-white/10"><X size={15}/></button>}</div>
    {open && <div id="staff-action-results" className="absolute left-0 right-0 top-full z-[100] mt-2 max-h-[min(65vh,420px)] overflow-y-auto rounded-2xl border border-[#d9e6d2] bg-white p-2 text-[#193d2b] shadow-2xl"><p className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[#718172]">{query.trim() ? `${matches.length} matching actions` : "Quick actions"}</p>{matches.map((action) => <a key={`${action.href}-${action.label}`} href={action.href} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2.5 hover:bg-[#edf6e9] focus:bg-[#edf6e9] focus:outline-none"><span className="block text-sm font-bold">{action.label}</span><span className="mt-0.5 block text-xs text-[#667668]">{action.description}</span></a>)}{matches.length === 0 && <p className="px-3 py-5 text-sm text-[#667668]">No matching actions. Try “member”, “salary” or “scan”.</p>}</div>}
  </div>;
}

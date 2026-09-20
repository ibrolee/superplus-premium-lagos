import { useMemo, useRef, useState } from "react";
import { ArrowUpRight, Search, X } from "lucide-react";
import "./admin-search-layout.css";

type Category = "Members" | "Attendance" | "Staff" | "Finance" | "Website" | "Operations" | "Account";
type Action = {
  label: string;
  href: string;
  description: string;
  keywords: string;
  category: Category;
  management?: boolean;
  reception?: boolean;
  admin?: boolean;
  staffOnly?: boolean;
};

// These are destinations that exist in the current website. Search never grants permission:
// protected destination pages and Supabase RLS remain the final authority.
const actions: Action[] = [
  { label: "Staff account", href: "/staff", description: "View your employee profile and staff tools", keywords: "login account profile employee details", category: "Account", staffOnly: true },
  { label: "Staff clock in / out", href: "/staff-attendance", description: "Record your QR work attendance", keywords: "attendance checkin checkout shift scan timesheet work hours", category: "Attendance", staffOnly: true },
  { label: "Report a missed scan", href: "/staff-missed-scans", description: "Report a forgotten clock-in or clock-out", keywords: "attendance forgot correction request qr exception", category: "Attendance", staffOnly: true },
  { label: "Reception 2.0", href: "/reception-workspace", description: "Front-desk workspace and member search", keywords: "reception counter front desk dashboard customer", category: "Operations", reception: true },
  { label: "Member QR scanner", href: "/reception-checkin", description: "Scan gym entry and exit for members", keywords: "gym attendance member attendance checkin checkout visit entry exit barcode camera qr", category: "Attendance", reception: true },
  { label: "Dashboard overview", href: "/management-preview", description: "Gym dashboard, figures and daily overview", keywords: "home statistics insights performance summary", category: "Operations", reception: true },
  { label: "Find members", href: "/management-members", description: "Search the member directory and membership status", keywords: "member directory customer client list search registered members active expiry", category: "Members", reception: true },
  { label: "Member profiles", href: "/management-profiles", description: "View member information, plans and visits", keywords: "member account details record subscription membership history", category: "Members", reception: true },
  { label: "Gym attendance", href: "/management-attendance", description: "Review member attendance, gym visits and check-ins", keywords: "member attendance gym attendance visit history entry exit checkin checkout visitors daily", category: "Attendance", reception: true },
  { label: "Operations hub", href: "/management-operations", description: "All reception and gym management actions", keywords: "tools tasks shortcuts admin management operations", category: "Operations", reception: true },
  { label: "Register a new member", href: "/management-standard-plan", description: "Create a member and initial paid membership", keywords: "signup registration new member customer join enrollment payment", category: "Members", reception: true },
  { label: "Add or renew membership", href: "/management-standard-plan", description: "Add a standard plan to an existing member", keywords: "subscription membership daily weekly monthly plan renewal payment", category: "Members", reception: true },
  { label: "Custom membership plan", href: "/management-custom-plan", description: "Choose custom days, price and optional registration fee", keywords: "membership subscription flexible duration fee registration tailored pricing", category: "Members", reception: true },
  { label: "Birthdays and expiry reminders", href: "/management-communications", description: "Prepare birthday and membership-expiry WhatsApp messages", keywords: "message communications whatsapp notification renewal expiring follow up", category: "Members", reception: true },
  { label: "Staff directory", href: "/management-staff", description: "Staff list, profiles and daily QR attendance", keywords: "employees team workforce workers staff attendance employee attendance qr", category: "Staff", management: true },
  { label: "Staff attendance", href: "/management-staff", description: "Review daily employee clock-ins and work hours", keywords: "attendance timesheet employee shift clockin checkout punctuality late working hours", category: "Attendance", management: true },
  { label: "Monthly staff attendance", href: "/management-staff-monthly", description: "Monthly staff work hours, late arrivals and attendance reports", keywords: "attendance employee timesheet month report shifts lateness payroll", category: "Attendance", management: true },
  { label: "Review QR attendance exceptions", href: "/management-staff-review", description: "Find late, open, overlapping and invalid staff scans", keywords: "attendance missing checkout correction anomaly duplicate shift review", category: "Attendance", management: true },
  { label: "Review missed-scan requests", href: "/staff-missed-scans", description: "Review staff reports of forgotten QR scans", keywords: "attendance employee forgot scan approve reject correction clock", category: "Attendance", admin: true },
  { label: "Export staff attendance", href: "/management-attendance-export", description: "Download staff attendance and work-hours CSV", keywords: "attendance timesheet spreadsheet report download export excel", category: "Attendance", management: true },
  { label: "Salary records", href: "/management-payroll", description: "Review saved employee salary and payroll entries", keywords: "wages payments payslip compensation earnings payroll staff", category: "Finance", management: true },
  { label: "Export salaries", href: "/management-payroll-export", description: "Download salary and payroll CSV records", keywords: "wages paycheck spreadsheet excel download staff finance", category: "Finance", management: true },
  { label: "Revenue report", href: "/management-revenue", description: "View income, payments, transactions and revenue filters", keywords: "sales earnings money finances financial report payment history turnover cash pos bank transfer", category: "Finance", management: true },
  { label: "Admin dashboard and staff management", href: "/staff-admin", description: "Original dashboard with revenue, staff, attendance and management controls", keywords: "administrator admin portal overview staff management roles salary payroll financial report", category: "Operations", management: true },
  { label: "Manage staff and approvals", href: "/staff-admin#staff", description: "Open administrator tools to manage employee profiles and approvals", keywords: "staff roles permissions add edit suspend approve employment profile", category: "Staff", management: true },
  { label: "Original revenue and payment report", href: "/staff-admin#revenue", description: "Open the original administrator financial dashboard", keywords: "income sales payments financial analytics earnings transactions", category: "Finance", management: true },
  { label: "Blog Management", href: "/staff-blog", description: "Create, edit, schedule and publish fitness blog articles", keywords: "website content articles posts publish drafts editor author image upload blog", category: "Website", management: true },
  { label: "Gallery Management", href: "/staff-gallery", description: "Upload, edit, publish and delete gym photos and videos", keywords: "website gallery images pictures photos media videos upload optimize thumbnails", category: "Website", management: true },
];

const related: readonly string[][] = [
  ["attendance", "attendence", "attend", "checkin", "checkout", "clock", "visit", "shift", "timesheet", "presence"],
  ["member", "members", "customer", "customers", "client", "gymgoer"],
  ["staff", "employee", "employees", "worker", "workers", "team", "workforce"],
  ["membership", "subscription", "plan", "renewal", "renew", "registration", "enrollment"],
  ["salary", "salaries", "payroll", "wage", "wages", "payslip", "compensation"],
  ["revenue", "income", "sales", "earnings", "turnover", "financial", "finance"],
  ["gallery", "image", "images", "photo", "photos", "picture", "pictures", "video", "videos", "media"],
  ["blog", "article", "post", "posts", "content", "publication"],
  ["scan", "scanner", "qr", "barcode"],
  ["download", "export", "csv", "spreadsheet", "excel"],
  ["birthday", "birthdays", "reminder", "reminders", "whatsapp", "message", "notification"],
];

function normalize(text: string): string {
  return text.normalize("NFKD").toLowerCase().replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    previous = current;
  }
  return previous[b.length];
}
function tokenScore(word: string, action: Action): number {
  const label = normalize(action.label);
  const details = normalize(`${action.description} ${action.keywords} ${action.category}`);
  const labelWords = label.split(" ");
  const detailWords = details.split(" ");
  if (labelWords.some((part) => part === word)) return 12;
  if (labelWords.some((part) => part.startsWith(word))) return 10;
  if (label.includes(word)) return 8;
  if (detailWords.some((part) => part === word)) return 7;
  if (detailWords.some((part) => part.startsWith(word))) return 5;
  if (details.includes(word)) return 4;
  const family = related.find((group) => group.some((term) => term === word || (word.length >= 4 && term.startsWith(word))));
  if (family && [...labelWords, ...detailWords].some((part) => family.includes(part))) return 3;
  if (word.length >= 4) {
    const limit = word.length >= 7 ? 2 : 1;
    if (labelWords.some((part) => Math.abs(part.length - word.length) <= limit && distance(word, part) <= limit)) return 2;
    if (detailWords.some((part) => Math.abs(part.length - word.length) <= limit && distance(word, part) <= limit)) return 1;
  }
  return 0;
}
function rankAction(query: string, action: Action): number {
  const words = normalize(query).split(" ").filter(Boolean);
  if (!words.length) return 1;
  const scores = words.map((word) => tokenScore(word, action));
  return scores.every(Boolean) ? scores.reduce((sum, score) => sum + score, 0) : 0;
}

export function ActionSearch({ role }: { role: string }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const normalized = role.trim().toLowerCase();
  const management = ["admin", "owner", "manager"].includes(normalized);
  const reception = management || normalized === "reception";
  const admin = normalized === "admin";
  const staffOnly = !reception;
  const visible = useMemo(() => actions.filter((action) =>
    (!action.management || management) && (!action.reception || reception) && (!action.admin || admin) && (!action.staffOnly || staffOnly)),
  [management, reception, admin, staffOnly]);
  const matches = useMemo(() => {
    if (!query.trim()) return visible.slice(0, 7);
    return visible.map((action) => ({ action, score: rankAction(query, action) }))
      .filter(({ score }) => score > 0).sort((a, b) => b.score - a.score || a.action.label.localeCompare(b.action.label))
      .map(({ action }) => action);
  }, [query, visible]);

  return <div className="w-full max-w-xl min-w-0" role="search" aria-label="Search available portal tools">
    <div className="flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-3 text-white focus-within:border-[#b8ee73] focus-within:ring-2 focus-within:ring-[#b8ee73]/30">
      <Search size={17} className="shrink-0 text-[#b8ee73]" aria-hidden="true" />
      <input ref={input} type="search" value={query} onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }} placeholder="Search any tool or task…" aria-label="Search available actions" aria-expanded={open} aria-controls="staff-action-results" className="min-w-0 flex-1 bg-transparent py-3 text-sm text-white placeholder:text-white/65 outline-none" />
      {query && <button type="button" aria-label="Clear search" onClick={() => { setQuery(""); setOpen(true); input.current?.focus(); }} className="rounded p-1 hover:bg-white/10"><X size={15}/></button>}
      {open && <button type="button" onClick={() => setOpen(false)} className="rounded px-2 py-1 text-xs font-bold text-[#d3f9a4] hover:bg-white/10" aria-label="Close search results">Close</button>}
    </div>
    {open && <section id="staff-action-results" aria-label="Action search results" className="mt-3 max-h-[min(54dvh,460px)] overflow-y-auto overscroll-contain rounded-2xl border border-[#d9e6d2] bg-white p-2 text-[#193d2b] shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"><p role="status" className="text-[11px] font-bold uppercase tracking-wider text-[#718172]">{query.trim() ? `${matches.length} matching actions` : "Suggested actions"}</p><span className="text-[11px] text-[#718172]">Tap a result to open it</span></div>
      {matches.map((action) => <a key={`${action.href}-${action.label}`} href={action.href} className="flex items-center justify-between gap-3 rounded-xl px-3 py-3 hover:bg-[#edf6e9] focus:bg-[#edf6e9] focus:outline-2 focus:outline-[#4b854b]"><span className="min-w-0"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#54815c]">{action.category}</span><span className="block text-sm font-bold">{action.label}</span><span className="mt-0.5 block text-xs leading-5 text-[#667668]">{action.description}</span></span><ArrowUpRight size={16} className="shrink-0 text-[#54815c]" aria-hidden="true" /></a>)}
      {matches.length === 0 && <p className="px-3 py-5 text-sm text-[#667668]">No matching tools found. Try another term, such as “attendance”, “members”, “salary” or “gallery”.</p>}
    </section>}
  </div>;
}

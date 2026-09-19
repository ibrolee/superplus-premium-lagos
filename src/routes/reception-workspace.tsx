import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, Cake, CalendarClock, CheckCircle2, CreditCard, RefreshCw, Search, UserPlus, Users, Wallet } from "lucide-react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/reception-workspace")({ component: ReceptionWorkspace });
type Member = { id: string; full_name: string | null; phone: string | null; email: string | null };
type Membership = { id: string; member_id: string; start_date: string | null; end_date: string | null; status: string | null };
const todayLagos = () => { const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()); const value = (type: string) => parts.find(part => part.type === type)?.value || ""; return `${value("year")}-${value("month")}-${value("day")}`; };
const plusDays = (date: string, days: number) => { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); };
async function allRows<T>(table: "members" | "memberships", columns: string): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from(table).select(columns).order("id", { ascending: true }).range(offset, offset + 499);
    if (error) throw error;
    const batch = (data || []) as T[];
    rows.push(...batch);
    if (batch.length < 500) return rows;
  }
}
const shortcuts = [
  { label: "Register a member", detail: "Registration and new membership", href: "/management-standard-plan", icon: UserPlus, managementOnly: false },
  { label: "Renew membership", detail: "Search members and add a plan", href: "/management-members", icon: RefreshCw, managementOnly: false },
  { label: "Custom Plan", detail: "Custom days, price and registration fee", href: "/management-custom-plan", icon: CreditCard, managementOnly: false },
  { label: "Member QR scanner", detail: "Check members in and out", href: "/reception-checkin", icon: Activity, managementOnly: false },
  { label: "Member directory", detail: "Search and open member profiles", href: "/management-members", icon: Users, managementOnly: false },
  { label: "Birthdays & reminders", detail: "Personalised WhatsApp messages", href: "/management-communications", icon: Cake, managementOnly: false },
  { label: "Revenue records", detail: "Management-only financial report", href: "/management-revenue", icon: Wallet, managementOnly: true },
];
function ReceptionWorkspace() {
  const [authorized, setAuthorized] = useState(false);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [members, setMembers] = useState<Member[]>([]);
  const [plans, setPlans] = useState<Membership[]>([]);
  const [search, setSearch] = useState("");
  const today = todayLagos();
  const cutoff = plusDays(today, 7);
  useEffect(() => {
    let cancelled = false;
    setAuthorized(false); setRole("");
    (async () => {
      setLoading(true); setError("");
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) throw new Error("Sign in through your reception portal first.");
        const { data: staff, error: staffError } = await supabase.from("staff_users").select("role,active").eq("auth_user_id", auth.user.id).maybeSingle();
        if (staffError) throw staffError;
        const nextRole = String(staff?.role || "").toLowerCase();
        if (!staff?.active || !["reception", "admin", "owner", "manager"].includes(nextRole)) throw new Error("Your account does not have reception permissions.");
        const [people, memberships] = await Promise.all([
          allRows<Member>("members", "id,full_name,phone,email"),
          allRows<Membership>("memberships", "id,member_id,start_date,end_date,status"),
        ]);
        if (!cancelled) { setMembers(people); setPlans(memberships); setRole(nextRole); setAuthorized(true); }
      } catch (cause) {
        if (!cancelled) { setAuthorized(false); setRole(""); setError(cause instanceof Error ? cause.message : "Unable to load the reception workspace."); }
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [refresh]);
  const counts = useMemo(() => {
    const active = new Set<string>(); const expiring = new Set<string>(); const expired = new Set<string>();
    for (const plan of plans) {
      const start = plan.start_date?.slice(0, 10); const end = plan.end_date?.slice(0, 10);
      const status = String(plan.status || "").toLowerCase();
      if (!start || !end || ["paused", "cancelled", "canceled", "void"].includes(status)) continue;
      if (start <= today && end >= today) { active.add(plan.member_id); if (end <= cutoff) expiring.add(plan.member_id); }
      else if (end < today) expired.add(plan.member_id);
    }
    return { active: active.size, expiring: expiring.size, expired: [...expired].filter(id => !active.has(id)).length };
  }, [plans, today, cutoff]);
  const results = useMemo(() => { const needle = search.trim().toLowerCase(); return needle.length < 2 ? [] : members.filter(member => [member.full_name, member.phone, member.email].some(value => value?.toLowerCase().includes(needle))).slice(0, 8); }, [members, search]);
  const management = ["admin", "owner", "manager"].includes(role);
  return <main className="min-h-screen min-w-0 bg-[#f4f6f1] px-3 py-6 text-[#183125] sm:px-6 sm:py-9 lg:px-9 lg:py-12"><div className="mx-auto w-full min-w-0 max-w-7xl space-y-6 sm:space-y-8">
    <header className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="text-xs font-black uppercase tracking-[.12em] text-[#5a7c5d] sm:tracking-[.2em]">Super Plus Fitness · Reception</p><h1 className="mt-2 break-words text-3xl font-black leading-tight tracking-tight sm:text-4xl lg:text-5xl">Reception 2.0</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#607366]">A mobile-friendly front desk: member lookup, membership details and the tools you use every day.</p></div><button type="button" onClick={() => setRefresh(value => value + 1)} disabled={loading} className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-[#cbd9c9] bg-white px-4 py-3 text-sm font-bold disabled:opacity-50 sm:w-auto"><RefreshCw size={16} className={loading ? "animate-spin" : ""}/> Refresh overview</button></header>
    {error && <div role="alert" className="min-w-0 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:p-5">{error} <a href="/portal/reception" className="font-bold underline">Reception login</a> · <a href="/portal/admin" className="font-bold underline">Admin login</a></div>}
    {loading && <p role="status" className="rounded-2xl border bg-white p-5 text-sm">Loading your authorised workspace…</p>}
    {!loading && authorized && !error && <>
      <section aria-label="Membership snapshot" className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">{[
        { label: "Registered members", value: members.length, icon: Users },
        { label: "Currently active", value: counts.active, icon: CheckCircle2 },
        { label: "Expiring within 7 days", value: counts.expiring, icon: CalendarClock },
        { label: "Expired without active plan", value: counts.expired, icon: Activity },
      ].map(({label,value,icon:Icon}) => <div key={label} className="min-w-0 rounded-2xl border border-[#e0e9dc] bg-white p-3 sm:p-5"><div className="flex min-w-0 items-start justify-between gap-2 text-xs font-semibold leading-5 text-[#617466] sm:text-sm"><span className="min-w-0 break-words">{label}</span><Icon size={19} className="shrink-0"/></div><p className="mt-3 text-3xl font-black tabular-nums sm:mt-4 sm:text-4xl">{value.toLocaleString("en-NG")}</p></div>)}</section>
      <section className="min-w-0 rounded-2xl bg-[#193b2a] p-4 text-white sm:rounded-3xl sm:p-7"><div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><h2 className="text-xl font-black">Find a member</h2><p className="mt-1 text-sm leading-6 text-[#c7ddca]">Search by name, phone or email to open their profile.</p></div><a href="/management-members" className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[#b8ee73] px-4 py-3 text-sm font-bold text-[#173326] sm:w-auto">Member directory <ArrowRight size={16}/></a></div>
        <label className="mt-5 flex min-w-0 items-center gap-3 rounded-xl bg-white px-3 text-[#173326] sm:px-4"><Search size={19} className="shrink-0"/><span className="sr-only">Search members</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Enter at least two characters…" className="w-full min-w-0 bg-transparent py-4 text-sm outline-none"/></label>
        {search.trim().length >= 2 && <div aria-live="polite" className="mt-3 min-w-0 space-y-2">{results.length ? results.map(member => <div key={member.id} className="flex min-w-0 flex-col gap-3 rounded-xl bg-white/10 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4"><div className="min-w-0"><p className="break-words font-semibold">{member.full_name || "Unnamed member"}</p><p className="mt-1 break-all text-xs text-[#c7ddca]">{member.phone || member.email || "No contact recorded"}</p></div><a href={`/reception-member/${encodeURIComponent(member.id)}`} aria-label={`Open profile for ${member.full_name || "unnamed member"}`} className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-lg border border-white/30 px-3 py-2 text-xs font-bold hover:bg-white/10 sm:w-auto">Open profile <ArrowRight size={13}/></a></div>) : <p className="py-3 text-sm text-[#c7ddca]">No matching members in the directory.</p>}{results.length === 8 && <p className="text-xs text-[#c7ddca]">Showing up to eight matches. Use the directory for more.</p>}</div>}
      </section>
      <section className="min-w-0"><div className="mb-4"><h2 className="text-2xl font-black">Quick actions</h2><p className="mt-1 text-sm text-[#607366]">The existing protected front-desk tools in one place.</p></div><div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">{shortcuts.filter(action => !action.managementOnly || management).map(({label,detail,href,icon:Icon}) => <a key={`${href}-${label}`} href={href} className="group flex min-w-0 min-h-32 flex-col justify-between rounded-2xl border border-[#e0e9dc] bg-white p-4 transition hover:border-[#84b879] hover:shadow-lg sm:p-5"><span className="flex items-start justify-between gap-2"><Icon size={23} className="shrink-0 text-[#427a43]"/><ArrowRight size={18} className="shrink-0 transition group-hover:translate-x-1"/></span><span className="min-w-0"><strong className="block break-words text-lg">{label}</strong><span className="mt-1 block break-words text-sm text-[#607366]">{detail}</span></span></a>)}</div></section>
      <p className="text-xs leading-5 text-[#607366]">Overview counts use recorded membership dates and status; they are not independently verified payment totals. This page does not modify member records.</p>
    </>}
  </div></main>;
}

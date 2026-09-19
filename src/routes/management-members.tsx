import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, CalendarClock, CheckCircle2, Loader2, RefreshCw, Search, UserPlus, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/management-members")({ component: ManagementMembers });
type Member = { id: string; full_name: string | null; email: string | null; phone: string | null };
type Membership = { id: string; member_id: string; plan_name: string | null; start_date: string | null; end_date: string | null; status: string | null };
type Status = "active" | "expiring" | "upcoming" | "paused" | "expired" | "inactive";
type MemberRow = Member & { plan: string; expiry: string | null; status: Status };
type Filter = "all" | "active" | "expiring" | "expired" | "inactive";
const PAGE_SIZE = 20;
const labels: Record<Status, string> = { active: "Active", expiring: "Expiring soon", upcoming: "Upcoming", paused: "Paused", expired: "Expired", inactive: "No active plan" };
function lagosDay() { const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()); const part = (type: string) => parts.find(item => item.type === type)?.value || ""; return `${part("year")}-${part("month")}-${part("day")}`; }
function addDays(day: string, amount: number) { const value = new Date(`${day}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + amount); return value.toISOString().slice(0, 10); }
function formatDate(date: string | null) { return date ? new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date.slice(0, 10)}T12:00:00Z`)) : "—"; }
async function readAll<T>(table: "members" | "memberships", columns: string): Promise<T[]> { const result: T[] = []; for (let offset = 0; ; offset += 500) { const { data, error } = await supabase.from(table).select(columns).order("id", { ascending: true }).range(offset, offset + 499); if (error) throw error; const batch = (data || []) as T[]; result.push(...batch); if (batch.length < 500) return result; } }
function makeRow(member: Member, plans: Membership[], today: string, cutoff: string): MemberRow {
  const byExpiry = [...plans].sort((a,b) => (b.end_date || "").localeCompare(a.end_date || ""));
  const valid = (m: Membership) => !!m.start_date && !!m.end_date && !["paused", "cancelled", "canceled", "void"].includes((m.status || "").toLowerCase());
  const active = byExpiry.find(m => valid(m) && m.start_date!.slice(0,10) <= today && m.end_date!.slice(0,10) >= today);
  const upcoming = byExpiry.find(m => valid(m) && m.start_date!.slice(0,10) > today);
  const chosen = active || upcoming || byExpiry[0];
  let status: Status = "inactive";
  if (active) status = active.end_date!.slice(0,10) <= cutoff ? "expiring" : "active";
  else if (upcoming) status = "upcoming";
  else if (byExpiry.some(m => (m.status || "").toLowerCase() === "paused")) status = "paused";
  else if (byExpiry.some(m => !!m.end_date && m.end_date.slice(0,10) < today)) status = "expired";
  return { ...member, plan: chosen?.plan_name || "No membership", expiry: chosen?.end_date || null, status };
}
function ManagementMembers() {
  const [role, setRole] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const today = lagosDay();
  useEffect(() => { let cancelled = false; (async () => { setLoading(true); setError(""); try {
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) throw new Error("Sign in through the reception or admin portal first.");
    const { data: staff, error: staffError } = await supabase.from("staff_users").select("role,active").eq("auth_user_id", auth.user.id).maybeSingle();
    if (staffError) throw staffError;
    const roleName = String(staff?.role || "").toLowerCase();
    if (!staff?.active || !["reception","admin","owner","manager"].includes(roleName)) throw new Error("Only active reception and management accounts can access the directory.");
    const [people, plans] = await Promise.all([readAll<Member>("members","id,full_name,email,phone"), readAll<Membership>("memberships","id,member_id,plan_name,start_date,end_date,status")]);
    if (!cancelled) { setRole(roleName); setMembers(people); setMemberships(plans); }
  } catch (cause) { if (!cancelled) { setRole(null); setError(cause instanceof Error ? cause.message : "Unable to load member records."); } } finally { if (!cancelled) setLoading(false); } })(); return () => { cancelled = true; }; }, [reload]);
  const rows = useMemo(() => { const grouped = new Map<string,Membership[]>(); for (const membership of memberships) { const plans = grouped.get(membership.member_id) || []; plans.push(membership); grouped.set(membership.member_id,plans); } const cutoff=addDays(today,7); return members.map(member => makeRow(member,grouped.get(member.id)||[],today,cutoff)).sort((a,b)=>(a.full_name||"").localeCompare(b.full_name||"")); }, [members,memberships,today]);
  const active = rows.filter(m=>["active","expiring"].includes(m.status)).length;
  const expiring = rows.filter(m=>m.status==="expiring").length;
  const expired = rows.filter(m=>m.status==="expired").length;
  const tabs: {value:Filter;text:string;count:number}[] = [{value:"all",text:"All",count:rows.length},{value:"active",text:"Active",count:active},{value:"expiring",text:"Expiring",count:expiring},{value:"expired",text:"Expired",count:expired},{value:"inactive",text:"Other",count:rows.length-active-expired}];
  const filtered = useMemo(() => { const needle=query.trim().toLowerCase(); return rows.filter(row => { if (filter==="active" && !["active","expiring"].includes(row.status)) return false; if (filter==="expiring" && row.status!=="expiring") return false; if (filter==="expired" && row.status!=="expired") return false; if (filter==="inactive" && !["inactive","paused","upcoming"].includes(row.status)) return false; return !needle || [row.full_name,row.phone,row.email].some(value=>value?.toLowerCase().includes(needle)); }); }, [rows,filter,query]);
  const pages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
  const current=Math.min(page,pages);
  const visible=filtered.slice((current-1)*PAGE_SIZE,current*PAGE_SIZE);
  return <main className="min-h-screen min-w-0 bg-[#f4f6f1] px-3 py-6 text-[#16221c] sm:px-7 sm:py-9 lg:px-10"><div className="mx-auto w-full min-w-0 max-w-6xl">
    <header className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><a href="/reception-workspace" className="inline-flex items-center gap-2 text-sm font-bold text-[#356942]"><ArrowLeft size={16}/> Reception 2.0</a><p className="mt-5 text-xs font-bold uppercase tracking-[.13em] text-[#5f7b68]">Super Plus / Members</p><h1 className="mt-2 break-words text-3xl font-black sm:text-4xl">Member directory</h1><p className="mt-2 text-sm leading-6 text-[#637469]">Find members, view plans and open detailed profiles.</p></div><button type="button" disabled={loading} onClick={() => setReload(n=>n+1)} className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-[#ccd8cb] bg-white px-4 py-3 text-sm font-semibold disabled:opacity-50 sm:w-auto"><RefreshCw size={16} className={loading?"animate-spin":""}/> Refresh</button></header>
    {error && <p role="alert" className="mt-6 break-words rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error} <a href="/portal/reception" className="font-bold underline">Reception login</a></p>}
    {loading && <p role="status" className="mt-7 flex items-center gap-3 rounded-2xl bg-white p-5 text-sm"><Loader2 className="animate-spin" size={20}/> Loading member records…</p>}
    {!loading && role && !error && <>
      <section aria-label="Membership overview" className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4">{[{title:"Members",value:rows.length,icon:Users},{title:"Active members",value:active,icon:CheckCircle2},{title:"Expiring in 7 days",value:expiring,icon:CalendarClock}].map(({title,value,icon:Icon}) => <div key={title} className="min-w-0 rounded-2xl border border-[#e1e8dd] bg-white p-3 sm:p-5"><div className="flex min-w-0 items-start justify-between gap-2 text-xs font-semibold text-[#627468] sm:text-sm"><span className="min-w-0 break-words">{title}</span><Icon size={19} className="shrink-0"/></div><p className="mt-4 text-3xl font-black sm:text-4xl">{value.toLocaleString("en-NG")}</p></div>)}</section>
      <section className="mt-6 min-w-0 rounded-2xl border border-[#e1e8dd] bg-white p-3 sm:rounded-3xl sm:p-7"><div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><h2 className="text-xl font-black">All member records</h2><p className="mt-1 text-xs leading-5 text-[#748276]">Directory shows existing records; payments and memberships use dedicated tools.</p></div><a href="/management-standard-plan" className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[#1a3226] px-4 py-3 text-sm font-bold text-white sm:w-auto"><UserPlus size={17}/> Register / renew</a></div>
        <label className="mt-6 flex min-w-0 items-center gap-2 rounded-xl border border-[#d8e2d5] bg-[#f8faf6] px-3 sm:gap-3 sm:px-4"><Search size={19} className="shrink-0 text-[#69816f]"/><span className="sr-only">Search name, phone or email</span><input value={query} onChange={event=>{setQuery(event.target.value);setPage(1);}} placeholder="Search name, phone or email" className="w-full min-w-0 bg-transparent py-4 text-sm outline-none"/></label>
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Filter members">{tabs.map(tab=><button type="button" key={tab.value} aria-pressed={filter===tab.value} onClick={()=>{setFilter(tab.value);setPage(1);}} className={`min-w-0 rounded-full border px-3 py-2 text-xs font-bold sm:px-4 ${filter===tab.value?"border-[#193d2b] bg-[#193d2b] text-white":"border-[#e0e7de] text-[#58715d]"}`}>{tab.text} · {tab.count}</button>)}</div>
        <p className="mt-4 text-xs text-[#748276]">{filtered.length} matching members · page {current} of {pages}</p>
        <div className="mt-2 divide-y divide-[#e7ede4]">{visible.map(member=><a href={`/reception-member/${encodeURIComponent(member.id)}`} key={member.id} className="group flex min-w-0 items-start gap-3 py-4 hover:text-[#356942]"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#edf5e7] text-sm font-black text-[#38673e] sm:size-11">{(member.full_name||"?").trim().slice(0,1).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="break-words text-sm font-bold">{member.full_name||"Unnamed member"}</p><p className="mt-1 break-all text-xs text-[#748276]">{member.phone||member.email||"No contact details"}</p><p className="mt-1 break-words text-xs text-[#748276]">{member.plan} · ends {formatDate(member.expiry)}</p><span className={`mt-2 inline-flex max-w-full rounded-full px-2 py-1 text-[10px] font-bold sm:text-xs ${member.status==="active"?"bg-emerald-50 text-emerald-800":member.status==="expiring"?"bg-amber-50 text-amber-800":"bg-[#f1f3ef] text-[#647468]"}`}>{labels[member.status]}</span></div><ChevronRight size={18} className="mt-1 shrink-0 text-[#829686]"/></a>)}{!visible.length && <p className="py-12 text-center text-sm text-[#748276]">No matching members.</p>}</div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#e7ede4] pt-5"><button type="button" disabled={current===1} onClick={()=>setPage(current-1)} className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-bold disabled:opacity-40"><ChevronLeft size={16}/> Previous</button><span className="text-xs">{current} / {pages}</span><button type="button" disabled={current>=pages} onClick={()=>setPage(current+1)} className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-bold disabled:opacity-40">Next <ChevronRight size={16}/></button></div>
      </section>
    </>}
  </div></main>;
}

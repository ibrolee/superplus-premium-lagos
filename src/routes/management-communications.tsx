import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowUpRight, Cake, CalendarClock, CheckCircle2, Loader2, MessageCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/management-communications")({ component: ManagementCommunications });

type Member = { id: string; full_name: string | null; phone: string | null; birth_day: number | null; birth_month: number | null };
type Plan = { id: string; member_id: string; plan_name: string | null; start_date: string | null; end_date: string | null; status: string | null; payment_status: string | null };
type Reminder = { member: Member; plan: Plan; days: number };
const LAGOS = "Africa/Lagos";
const PAGE_SIZE = 500;
const birthdayDefault = "Happy Birthday, {name}! 🎉🎂 Everyone at Super Plus Fitness & Spa wishes you a wonderful birthday and a healthy, happy year ahead. Thank you for being part of our fitness family!";
const expiryDefault = "Hello {name}, this is a friendly reminder from Super Plus Fitness & Spa that your {plan} expires on {date} ({days}). We'd love to keep you moving! You can renew at www.superplusfitness.com or speak with reception. Thank you!";
function todayInLagos() {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: LAGOS, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (name: string) => parts.find((item) => item.type === name)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function addDays(date: string, days: number) { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
function dateOnly(value: string | null) { return value?.slice(0, 10) || ""; }
function niceDate(value: string | null) { const date = dateOnly(value); return date ? new Intl.DateTimeFormat("en-NG", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T12:00:00Z`)) : "Not recorded"; }
function whatsappNumber(phone: string | null) {
  const digits = (phone || "").replace(/\D/g, "");
  if (/^0\d{10}$/.test(digits)) return `234${digits.slice(1)}`;
  if (/^234\d{10}$/.test(digits)) return digits;
  return "";
}
function firstName(member: Member) { return member.full_name?.trim().split(/\s+/)[0] || "there"; }
function message(template: string, member: Member, plan?: Plan, days?: number) {
  const remaining = days === 0 ? "today" : days === 1 ? "in 1 day" : `in ${days ?? 0} days`;
  const values: Record<string, string> = { name: firstName(member), plan: plan?.plan_name || "membership", date: niceDate(plan?.end_date || null), days: remaining };
  return template.replace(/\{(name|plan|date|days)\}/g, (_match, key: string) => values[key] ?? "");
}
function whatsappUrl(phone: string | null, text: string) { const number = whatsappNumber(phone); return number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : ""; }
function eligible(plan: Plan, day: string) {
  const status = (plan.status || "").toLowerCase();
  const payment = (plan.payment_status || "").toLowerCase();
  return Boolean(dateOnly(plan.start_date) && dateOnly(plan.end_date) && dateOnly(plan.start_date) <= day &&
    !["cancelled", "canceled", "paused", "inactive", "expired", "void"].includes(status) &&
    !["failed", "unpaid", "pending", "refunded", "cancelled", "canceled", "void"].includes(payment));
}
async function readAll<T>(table: "members" | "memberships", columns: string): Promise<T[]> {
  const records: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase.from(table).select(columns).order("id", { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const batch = (data || []) as T[];
    records.push(...batch);
    if (batch.length < PAGE_SIZE) return records;
  }
}

function ManagementCommunications() {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [members, setMembers] = useState<Member[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [birthdayText, setBirthdayText] = useState(birthdayDefault);
  const [expiryText, setExpiryText] = useState(expiryDefault);
  const today = todayInLagos();
  const month = Number(today.slice(5, 7));
  const day = Number(today.slice(8, 10));
  const cutoff = addDays(today, 7);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError(""); setAuthorized(false);
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) throw Error("Please sign in through the Staff Portal first.");
        const { data: staff, error: staffError } = await supabase.from("staff_users").select("role,active").eq("auth_user_id", auth.user.id).maybeSingle();
        if (staffError) throw staffError;
        if (!staff?.active || !["reception", "admin", "owner", "manager"].includes(String(staff.role || "").toLowerCase())) throw Error("Only active reception and management staff can view member reminders.");
        const [memberRows, planRows] = await Promise.all([
          readAll<Member>("members", "id,full_name,phone,birth_day,birth_month"),
          readAll<Plan>("memberships", "id,member_id,plan_name,start_date,end_date,status,payment_status"),
        ]);
        if (!cancelled) { setMembers(memberRows); setPlans(planRows); setAuthorized(true); }
      } catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load member reminders."); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [reload]);

  const birthdays = useMemo(() => members.filter((member) => member.birth_month === month && member.birth_day === day).sort((a, b) => (a.full_name || "").localeCompare(b.full_name || "")), [members, month, day]);
  const reminders = useMemo(() => {
    const byMember = new Map(members.map((member) => [member.id, member]));
    const byMemberPlans = new Map<string, Plan[]>();
    for (const plan of plans) { const existing = byMemberPlans.get(plan.member_id) || []; existing.push(plan); byMemberPlans.set(plan.member_id, existing); }
    const result: Reminder[] = [];
    for (const plan of plans) {
      const expiry = dateOnly(plan.end_date);
      if (!expiry || expiry < today || expiry > cutoff || !eligible(plan, today)) continue;
      const member = byMember.get(plan.member_id);
      if (!member) continue;
      // A renewal for the same plan already covering the next day should not trigger another reminder.
      const nextDay = addDays(expiry, 1);
      const renewed = (byMemberPlans.get(plan.member_id) || []).some((other) => other.id !== plan.id && other.plan_name === plan.plan_name && eligible(other, nextDay) && dateOnly(other.start_date) <= nextDay && dateOnly(other.end_date) > expiry);
      if (renewed) continue;
      const days = Math.round((Date.parse(`${expiry}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000);
      result.push({ member, plan, days });
    }
    return result.sort((a, b) => a.days - b.days || (a.member.full_name || "").localeCompare(b.member.full_name || ""));
  }, [members, plans, today, cutoff]);

  return <main className="min-h-screen bg-[#f4f6f1] px-4 py-8 text-[#16221c] sm:px-8"><div className="mx-auto max-w-6xl">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><a href="/reception-dashboard" className="inline-flex items-center gap-2 text-sm font-bold text-[#356942]"><ArrowLeft size={16}/> Reception Dashboard</a><p className="mt-7 text-xs font-black uppercase tracking-[.2em] text-[#62905b]">Super Plus / Reception</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">Member communications</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-[#647468]">Birthdays today and membership renewals due in seven days. Choose a member to open WhatsApp with a ready-to-send message.</p></div><button type="button" disabled={loading} onClick={() => setReload((value) => value + 1)} className="inline-flex items-center gap-2 rounded-xl border border-[#d8e2d5] bg-white px-4 py-3 text-sm font-bold disabled:opacity-50"><RefreshCw size={16} className={loading ? "animate-spin" : ""}/> Refresh</button></div>
    {loading && <div className="mt-8 flex items-center gap-3 rounded-2xl bg-white p-6 text-sm text-[#607264]"><Loader2 className="animate-spin" size={20}/> Loading member records…</div>}
    {!loading && error && <div role="alert" className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">{error} <a href="/staff" className="font-bold underline">Staff login</a></div>}
    {!loading && authorized && <>
      <div className="mt-8 grid gap-4 sm:grid-cols-2"><a href="#birthday-messages" className="rounded-[24px] border border-[#e2e9dc] bg-white p-6 transition hover:border-[#7eaf75]"><div className="flex justify-between"><p className="text-sm font-bold text-[#617567]">Birthdays today</p><Cake className="text-[#4a8244]"/></div><p className="mt-5 text-5xl font-black">{birthdays.length}</p><p className="mt-2 text-xs text-[#748276]">{today} · Lagos date</p></a><a href="#renewal-messages" className="rounded-[24px] bg-[#1a3226] p-6 text-white transition hover:bg-[#264631]"><div className="flex justify-between"><p className="text-sm font-bold text-[#c5d4c6]">Plans expiring in 7 days</p><CalendarClock className="text-[#b8ee73]"/></div><p className="mt-5 text-5xl font-black">{reminders.length}</p><p className="mt-2 text-xs text-[#c5d4c6]">Active, not already renewed</p></a></div>
      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[#d9e6d2] bg-[#eef6e9] p-5 text-sm leading-6 text-[#476149]"><ShieldCheck className="mt-0.5 shrink-0" size={20}/><p>Messages are <strong>not sent automatically.</strong> Each button opens the selected member's WhatsApp chat with your message prefilled. Check it and tap Send in WhatsApp. Members without a valid Nigerian WhatsApp number cannot be opened. Nothing is written to member, payment or attendance records.</p></div>
      <section id="birthday-messages" className="mt-10 scroll-mt-8 rounded-[24px] border border-[#e1e8dd] bg-white p-5 sm:p-7"><div className="flex items-center gap-3"><span className="rounded-xl bg-[#edf6e7] p-3 text-[#386f40]"><Cake size={23}/></span><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#63915f]">Celebrate members</p><h2 className="text-2xl font-black">Today's birthdays <span className="text-[#719275]">({birthdays.length})</span></h2></div></div><label htmlFor="birthday-template" className="mt-7 block text-xs font-black uppercase tracking-wide text-[#586f5f]">Birthday message · editable</label><textarea id="birthday-template" rows={3} maxLength={1500} value={birthdayText} onChange={(event) => setBirthdayText(event.target.value)} className="mt-2 w-full rounded-xl border border-[#d7e3d3] bg-[#f8faf6] p-4 text-sm leading-6 outline-none focus:border-[#63915f]"/><p className="mt-2 text-xs text-[#748276]">Use {'{name}'} to personalise. Edits apply to buttons below and are not saved after you leave this page.</p><div className="mt-5 divide-y divide-[#e8eee5]">{birthdays.length === 0 && <p className="py-8 text-sm text-[#748276]">No recorded member birthdays today. Check members' birth dates in their profiles if someone is missing.</p>}{birthdays.map((member) => { const url = whatsappUrl(member.phone, message(birthdayText, member)); return <div key={member.id} className="flex flex-wrap items-center gap-3 py-5"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#eef6e8] font-black text-[#377041]">{(member.full_name || "?").slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="font-bold">{member.full_name || "Unnamed member"}</p><p className="mt-1 text-xs text-[#728173]">{member.phone || "No phone recorded"}</p></div>{url && birthdayText.trim() ? <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#1f713b] px-4 py-3 text-sm font-bold text-white hover:bg-[#14592d]"><MessageCircle size={17}/> Birthday WhatsApp <ArrowUpRight size={15}/></a> : <span className="rounded-xl bg-[#f1f3ef] px-3 py-2 text-xs font-semibold text-[#647468]">{!url ? "Valid phone required" : "Enter a message"}</span>}</div>; })}</div></section>
      <section id="renewal-messages" className="mt-8 scroll-mt-8 rounded-[24px] border border-[#e1e8dd] bg-white p-5 sm:p-7"><div className="flex items-center gap-3"><span className="rounded-xl bg-[#edf6e7] p-3 text-[#386f40]"><CalendarClock size={23}/></span><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#63915f]">Keep members active</p><h2 className="text-2xl font-black">Expiry reminders <span className="text-[#719275]">({reminders.length})</span></h2></div></div><label htmlFor="renewal-template" className="mt-7 block text-xs font-black uppercase tracking-wide text-[#586f5f]">Renewal message · editable</label><textarea id="renewal-template" rows={4} maxLength={1500} value={expiryText} onChange={(event) => setExpiryText(event.target.value)} className="mt-2 w-full rounded-xl border border-[#d7e3d3] bg-[#f8faf6] p-4 text-sm leading-6 outline-none focus:border-[#63915f]"/><p className="mt-2 text-xs text-[#748276]">Personalise with {'{name}'}, {'{plan}'}, {'{date}'}, and {'{days}'}.</p><div className="mt-5 divide-y divide-[#e8eee5]">{reminders.length === 0 && <p className="py-8 text-sm text-[#748276]">No eligible plans are due to expire in the next seven days.</p>}{reminders.map(({ member, plan, days }) => { const url = whatsappUrl(member.phone, message(expiryText, member, plan, days)); return <div key={plan.id} className="flex flex-wrap items-center gap-3 py-5"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#eef6e8] font-black text-[#377041]"><CalendarClock size={20}/></span><div className="min-w-0 flex-1"><p className="font-bold">{member.full_name || "Unnamed member"}</p><p className="mt-1 text-xs text-[#728173]">{plan.plan_name || "Membership"} · expires {niceDate(plan.end_date)}</p><p className="mt-1 text-xs font-bold text-[#357142]">{days === 0 ? "Expires today" : `${days} ${days === 1 ? "day" : "days"} left`} · {member.phone || "No phone"}</p></div>{url && expiryText.trim() ? <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#1f713b] px-4 py-3 text-sm font-bold text-white hover:bg-[#14592d]"><MessageCircle size={17}/> WhatsApp reminder <ArrowUpRight size={15}/></a> : <span className="rounded-xl bg-[#f1f3ef] px-3 py-2 text-xs font-semibold text-[#647468]">{!url ? "Valid phone required" : "Enter a message"}</span>}</div>; })}</div></section>
      <p className="mt-8 flex items-center gap-2 text-xs text-[#748276]"><CheckCircle2 size={16}/> Messages must be reviewed and sent individually in WhatsApp; this page does not confirm delivery.</p>
    </>}
  </div></main>;
}

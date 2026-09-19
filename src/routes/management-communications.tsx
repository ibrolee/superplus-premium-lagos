import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Cake,
  CalendarClock,
  CheckCircle2,
  Loader2,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/management-communications")({
  component: ManagementCommunications,
});

type Member = {
  id: string;
  full_name: string | null;
  phone: string | null;
  birth_day: number | null;
  birth_month: number | null;
};
type Plan = {
  id: string;
  member_id: string;
  plan_name: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  payment_status: string | null;
};
type Reminder = { member: Member; plan: Plan; days: number };
type ReminderType = "birthday" | "renewal";
type ReminderReceipt = {
  member_id: string;
  reminder_type: ReminderType;
  reminder_key: string;
  sent_at: string;
};

const LAGOS = "Africa/Lagos";
const PAGE_SIZE = 500;
const birthdayDefault = `Happy Birthday, {name}! 🥳🎂🎉\n\nToday is all about YOU, and your Super Plus Fitness & Spa family is sending you a big birthday hug! 💚 Thank you for being part of our community and bringing your own special energy to the gym. We hope this new chapter brings you plenty of laughter, beautiful memories, good health, and exciting wins—inside and outside the gym. 💪✨\n\nEnjoy your day, eat some cake (we won't count the calories today! 😄🍰), and remember that we're always cheering you on. Here's to more strength, more smiles, and an amazing year ahead! 🎁🎈\n\nWith love,\nYour Super Plus Fitness & Spa family 💚`;
const expiryDefault = `Hey {name}! 👋💚\n\nJust a little heads-up from your Super Plus Fitness & Spa family: your {plan} is set to expire {days} ({date}). ⏰ We hope you've been enjoying your time with us! It's always a pleasure having you as part of our fitness community, and we'd love to keep cheering you on as you work towards your goals. 💪🔥\n\nIf you're ready to keep the good energy going, you can renew at www.superplusfitness.com or simply chat with our reception team—we'll be happy to help. 😊 No worries if your plans have changed; we just didn't want the date to sneak up on you!\n\nThanks for choosing to train with us. Here's to more progress, more good vibes, and many more wins together! 🌟\n\nYour Super Plus Fitness & Spa family 💚`;

function todayInLagos() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LAGOS,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (name: string) => parts.find((item) => item.type === name)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function dateOnly(value: string | null) { return value?.slice(0, 10) || ""; }
function niceDate(value: string | null) {
  const date = dateOnly(value);
  return date ? new Intl.DateTimeFormat("en-NG", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T12:00:00Z`)) : "Not recorded";
}
function niceTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: LAGOS,
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
function whatsappNumber(phone: string | null) {
  const digits = (phone || "").replace(/\D/g, "");
  if (/^0\d{10}$/.test(digits)) return `234${digits.slice(1)}`;
  if (/^234\d{10}$/.test(digits)) return digits;
  return "";
}
function firstName(member: Member) { return member.full_name?.trim().split(/\s+/)[0] || "there"; }
function message(template: string, member: Member, plan?: Plan, days?: number) {
  const remaining = days === 0 ? "today" : days === 1 ? "in 1 day" : `in ${days ?? 0} days`;
  const values: Record<string, string> = {
    name: firstName(member),
    plan: plan?.plan_name || "membership",
    date: niceDate(plan?.end_date || null),
    days: remaining,
  };
  return template.replace(/\{(name|plan|date|days)\}/g, (_match, key: string) => values[key] ?? "");
}
function whatsappUrl(phone: string | null, text: string) {
  const number = whatsappNumber(phone);
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : "";
}
function receiptId(memberId: string, kind: ReminderType, reminderKey: string) {
  return `${memberId}:${kind}:${reminderKey}`;
}
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
async function readReceipts(today: string, cutoff: string): Promise<ReminderReceipt[]> {
  const records: ReminderReceipt[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase.from("member_reminder_send_status")
      .select("member_id,reminder_type,reminder_key,sent_at")
      .gte("occasion_date", today)
      .lte("occasion_date", cutoff)
      .order("member_id", { ascending: true })
      .order("reminder_type", { ascending: true })
      .order("reminder_key", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const batch = (data || []) as ReminderReceipt[];
    records.push(...batch);
    if (batch.length < PAGE_SIZE) return records;
  }
}

function ManagementCommunications() {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [markError, setMarkError] = useState("");
  const [reload, setReload] = useState(0);
  const [members, setMembers] = useState<Member[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [receipts, setReceipts] = useState<Record<string, ReminderReceipt>>({});
  const [saving, setSaving] = useState<string[]>([]);
  const [birthdayText, setBirthdayText] = useState(birthdayDefault);
  const [expiryText, setExpiryText] = useState(expiryDefault);
  const today = todayInLagos();
  const month = Number(today.slice(5, 7));
  const day = Number(today.slice(8, 10));
  const cutoff = addDays(today, 7);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      setAuthorized(false);
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) throw Error("Please sign in through the Staff Portal first.");
        const { data: staff, error: staffError } = await supabase.from("staff_users").select("role,active").eq("auth_user_id", auth.user.id).maybeSingle();
        if (staffError) throw staffError;
        if (!staff?.active || !["reception", "admin", "owner", "manager"].includes(String(staff.role || "").toLowerCase())) {
          throw Error("Only active reception and management staff can view member reminders.");
        }
        // Fail closed if confirmations cannot load: otherwise a previously sent
        // reminder could misleadingly appear unsent on another staff device.
        const [memberRows, planRows, receiptRows] = await Promise.all([
          readAll<Member>("members", "id,full_name,phone,birth_day,birth_month"),
          readAll<Plan>("memberships", "id,member_id,plan_name,start_date,end_date,status,payment_status"),
          readReceipts(today, cutoff),
        ]);
        if (!cancelled) {
          setMembers(memberRows);
          setPlans(planRows);
          setReceipts(Object.fromEntries(receiptRows.map((item) => [receiptId(item.member_id, item.reminder_type, item.reminder_key), item])));
          setAuthorized(true);
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load member reminders.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reload, today, cutoff]);

  async function markSent(memberId: string, kind: ReminderType, reminderKey: string, occasionDate: string) {
    const id = receiptId(memberId, kind, reminderKey);
    if (receipts[id] || saving.includes(id)) return;
    setMarkError("");
    setSaving((previous) => [...previous, id]);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw Error("Please sign in again before confirming a message.");
      const { data, error: insertError } = await supabase.from("member_reminder_send_status")
        .insert({ member_id: memberId, reminder_type: kind, reminder_key: reminderKey, occasion_date: occasionDate, confirmed_by: auth.user.id })
        .select("member_id,reminder_type,reminder_key,sent_at")
        .single();
      if (insertError) {
        // Another authorised staff member may have marked it first. Show the
        // existing confirmation rather than overwriting it or claiming failure.
        if (insertError.code !== "23505") throw insertError;
        const existing = await supabase.from("member_reminder_send_status")
          .select("member_id,reminder_type,reminder_key,sent_at")
          .eq("member_id", memberId).eq("reminder_type", kind).eq("reminder_key", reminderKey).maybeSingle();
        if (existing.error || !existing.data) throw existing.error || Error("Unable to reload the existing confirmation.");
        setReceipts((previous) => ({ ...previous, [id]: existing.data as ReminderReceipt }));
      } else if (data) {
        setReceipts((previous) => ({ ...previous, [id]: data as ReminderReceipt }));
      }
    } catch (cause) {
      setMarkError(cause instanceof Error ? cause.message : "Could not save the confirmation. Please try again.");
    } finally {
      setSaving((previous) => previous.filter((item) => item !== id));
    }
  }

  const birthdays = useMemo(() => members.filter((member) => member.birth_month === month && member.birth_day === day)
    .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || "")), [members, month, day]);
  const reminders = useMemo(() => {
    const byMember = new Map(members.map((member) => [member.id, member]));
    const byMemberPlans = new Map<string, Plan[]>();
    for (const plan of plans) {
      const existing = byMemberPlans.get(plan.member_id) || [];
      existing.push(plan);
      byMemberPlans.set(plan.member_id, existing);
    }
    const result: Reminder[] = [];
    for (const plan of plans) {
      const expiry = dateOnly(plan.end_date);
      if (!expiry || expiry < today || expiry > cutoff || !eligible(plan, today)) continue;
      const member = byMember.get(plan.member_id);
      if (!member) continue;
      const nextDay = addDays(expiry, 1);
      const renewed = (byMemberPlans.get(plan.member_id) || []).some((other) =>
        other.id !== plan.id && other.plan_name === plan.plan_name && eligible(other, nextDay) &&
        dateOnly(other.start_date) <= nextDay && dateOnly(other.end_date) > expiry);
      if (renewed) continue;
      const days = Math.round((Date.parse(`${expiry}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000);
      result.push({ member, plan, days });
    }
    return result.sort((a, b) => a.days - b.days || (a.member.full_name || "").localeCompare(b.member.full_name || ""));
  }, [members, plans, today, cutoff]);

  return <main className="min-h-screen bg-[#f4f6f1] px-4 py-8 text-[#16221c] sm:px-8"><div className="mx-auto max-w-6xl">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><a href="/reception-workspace" className="inline-flex items-center gap-2 text-sm font-bold text-[#356942]"><ArrowLeft size={16}/> Reception 2.0</a><p className="mt-7 text-xs font-black uppercase tracking-[.2em] text-[#62905b]">Super Plus / Reception</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">Member communications</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-[#647468]">Warm birthday wishes and friendly renewal reminders, with a shared record of messages your team confirms as sent.</p></div><button type="button" disabled={loading} onClick={() => setReload((value) => value + 1)} className="inline-flex items-center gap-2 rounded-xl border border-[#d8e2d5] bg-white px-4 py-3 text-sm font-bold disabled:opacity-50"><RefreshCw size={16} className={loading ? "animate-spin" : ""}/> Refresh</button></div>
    {loading && <div className="mt-8 flex items-center gap-3 rounded-2xl bg-white p-6 text-sm text-[#607264]"><Loader2 className="animate-spin" size={20}/> Loading member records and send confirmations…</div>}
    {!loading && error && <div role="alert" className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">{error} <a href="/staff" className="font-bold underline">Staff login</a></div>}
    {!loading && authorized && <>
      <div className="mt-8 grid gap-4 sm:grid-cols-2"><a href="#birthday-messages" className="rounded-[24px] border border-[#e2e9dc] bg-white p-6 transition hover:border-[#7eaf75]"><div className="flex justify-between"><p className="text-sm font-bold text-[#617567]">Birthdays today</p><Cake className="text-[#4a8244]"/></div><p className="mt-5 text-5xl font-black">{birthdays.length}</p><p className="mt-2 text-xs text-[#748276]">{today} · Lagos date</p></a><a href="#renewal-messages" className="rounded-[24px] bg-[#1a3226] p-6 text-white transition hover:bg-[#264631]"><div className="flex justify-between"><p className="text-sm font-bold text-[#c5d4c6]">Plans expiring in 7 days</p><CalendarClock className="text-[#b8ee73]"/></div><p className="mt-5 text-5xl font-black">{reminders.length}</p><p className="mt-2 text-xs text-[#c5d4c6]">Active, not already renewed</p></a></div>
      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[#d9e6d2] bg-[#eef6e9] p-5 text-sm leading-6 text-[#476149]"><ShieldCheck className="mt-0.5 shrink-0" size={20}/><p><strong>Messages are not sent automatically.</strong> Open WhatsApp, review the prefilled message and tap Send there. <strong>Only after actually sending it, tap “Mark message sent” here.</strong> Your team's manual confirmation is saved and shared across devices; it does not verify WhatsApp delivery. Sending again requires confirmation. Member, payment and attendance records are not changed.</p></div>
      {markError && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Could not save message status: {markError}</p>}
      <section id="birthday-messages" className="mt-10 scroll-mt-8 rounded-[24px] border border-[#e1e8dd] bg-white p-5 sm:p-7"><div className="flex items-center gap-3"><span className="rounded-xl bg-[#edf6e7] p-3 text-[#386f40]"><Cake size={23}/></span><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#63915f]">Celebrate members</p><h2 className="text-2xl font-black">Today's birthdays <span className="text-[#719275]">({birthdays.length})</span></h2></div></div><label htmlFor="birthday-template" className="mt-7 block text-xs font-black uppercase tracking-wide text-[#586f5f]">Birthday message · editable</label><textarea id="birthday-template" rows={7} maxLength={1500} value={birthdayText} onChange={(event) => setBirthdayText(event.target.value)} className="mt-2 w-full rounded-xl border border-[#d7e3d3] bg-[#f8faf6] p-4 text-sm leading-6 outline-none focus:border-[#63915f]"/><p className="mt-2 text-xs text-[#748276]">Use {'{name}'} to personalise. Edits affect the WhatsApp links below and reset when you leave this page.</p><div className="mt-5 divide-y divide-[#e8eee5]">{birthdays.length === 0 && <p className="py-8 text-sm text-[#748276]">No recorded member birthdays today. Check members' birth dates in their profiles if someone is missing.</p>}{birthdays.map((member) => {
        const kind: ReminderType = "birthday";
        const key = today;
        const id = receiptId(member.id, kind, key);
        const receipt = receipts[id];
        const url = whatsappUrl(member.phone, message(birthdayText, member));
        const canSend = Boolean(url && birthdayText.trim());
        return <div key={member.id} className="flex flex-wrap items-center gap-3 py-5"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#eef6e8] font-black text-[#377041]">{(member.full_name || "?").slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="font-bold">{member.full_name || "Unnamed member"}</p><p className="mt-1 text-xs text-[#728173]">{member.phone || "No phone recorded"}</p></div><div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{canSend ? <a href={url} target="_blank" rel="noopener noreferrer" onClick={(event) => { if (receipt && !window.confirm(`You already marked ${firstName(member)}'s birthday message as sent. Send the message again?`)) event.preventDefault(); }} className="inline-flex items-center gap-2 rounded-xl bg-[#1f713b] px-4 py-3 text-sm font-bold text-white hover:bg-[#14592d]"><MessageCircle size={17}/>{receipt ? "Send message again" : "Birthday WhatsApp"}<ArrowUpRight size={15}/></a> : <span className="rounded-xl bg-[#f1f3ef] px-3 py-2 text-xs font-semibold text-[#647468]">{!url ? "Valid phone required" : "Enter a message"}</span>}{receipt ? <span role="status" className="inline-flex items-center gap-2 rounded-xl border border-[#c8e6ca] bg-[#eff9ef] px-4 py-3 text-sm font-bold text-[#246737]"><CheckCircle2 size={17}/> Message sent · {niceTimestamp(receipt.sent_at)}</span> : <button type="button" disabled={!canSend || saving.includes(id)} onClick={() => void markSent(member.id, kind, key, today)} className="inline-flex items-center gap-2 rounded-xl border border-[#81b18a] bg-white px-4 py-3 text-sm font-bold text-[#23663b] hover:bg-[#eff9ef] disabled:cursor-not-allowed disabled:opacity-50">{saving.includes(id) ? <Loader2 size={17} className="animate-spin"/> : <CheckCircle2 size={17}/>} {saving.includes(id) ? "Saving…" : "Mark message sent"}</button>}</div></div>;
      })}</div></section>
      <section id="renewal-messages" className="mt-8 scroll-mt-8 rounded-[24px] border border-[#e1e8dd] bg-white p-5 sm:p-7"><div className="flex items-center gap-3"><span className="rounded-xl bg-[#edf6e7] p-3 text-[#386f40]"><CalendarClock size={23}/></span><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#63915f]">Keep members active</p><h2 className="text-2xl font-black">Expiry reminders <span className="text-[#719275]">({reminders.length})</span></h2></div></div><label htmlFor="renewal-template" className="mt-7 block text-xs font-black uppercase tracking-wide text-[#586f5f]">Renewal message · editable</label><textarea id="renewal-template" rows={8} maxLength={1500} value={expiryText} onChange={(event) => setExpiryText(event.target.value)} className="mt-2 w-full rounded-xl border border-[#d7e3d3] bg-[#f8faf6] p-4 text-sm leading-6 outline-none focus:border-[#63915f]"/><p className="mt-2 text-xs text-[#748276]">Personalise with {'{name}'}, {'{plan}'}, {'{date}'}, and {'{days}'}.</p><div className="mt-5 divide-y divide-[#e8eee5]">{reminders.length === 0 && <p className="py-8 text-sm text-[#748276]">No eligible plans are due to expire in the next seven days.</p>}{reminders.map(({ member, plan, days }) => {
        const kind: ReminderType = "renewal";
        const occasionDate = dateOnly(plan.end_date);
        const key = `${plan.id}:${occasionDate}`;
        const id = receiptId(member.id, kind, key);
        const receipt = receipts[id];
        const url = whatsappUrl(member.phone, message(expiryText, member, plan, days));
        const canSend = Boolean(url && expiryText.trim());
        return <div key={plan.id} className="flex flex-wrap items-center gap-3 py-5"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#eef6e8] font-black text-[#377041]"><CalendarClock size={20}/></span><div className="min-w-0 flex-1"><p className="font-bold">{member.full_name || "Unnamed member"}</p><p className="mt-1 text-xs text-[#728173]">{plan.plan_name || "Membership"} · expires {niceDate(plan.end_date)}</p><p className="mt-1 text-xs font-bold text-[#357142]">{days === 0 ? "Expires today" : `${days} ${days === 1 ? "day" : "days"} left`} · {member.phone || "No phone"}</p></div><div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{canSend ? <a href={url} target="_blank" rel="noopener noreferrer" onClick={(event) => { if (receipt && !window.confirm(`You already marked ${firstName(member)}'s ${plan.plan_name || "membership"} reminder as sent. Send the message again?`)) event.preventDefault(); }} className="inline-flex items-center gap-2 rounded-xl bg-[#1f713b] px-4 py-3 text-sm font-bold text-white hover:bg-[#14592d]"><MessageCircle size={17}/>{receipt ? "Send message again" : "WhatsApp reminder"}<ArrowUpRight size={15}/></a> : <span className="rounded-xl bg-[#f1f3ef] px-3 py-2 text-xs font-semibold text-[#647468]">{!url ? "Valid phone required" : "Enter a message"}</span>}{receipt ? <span role="status" className="inline-flex items-center gap-2 rounded-xl border border-[#c8e6ca] bg-[#eff9ef] px-4 py-3 text-sm font-bold text-[#246737]"><CheckCircle2 size={17}/> Message sent · {niceTimestamp(receipt.sent_at)}</span> : <button type="button" disabled={!canSend || saving.includes(id)} onClick={() => void markSent(member.id, kind, key, occasionDate)} className="inline-flex items-center gap-2 rounded-xl border border-[#81b18a] bg-white px-4 py-3 text-sm font-bold text-[#23663b] hover:bg-[#eff9ef] disabled:cursor-not-allowed disabled:opacity-50">{saving.includes(id) ? <Loader2 size={17} className="animate-spin"/> : <CheckCircle2 size={17}/>} {saving.includes(id) ? "Saving…" : "Mark message sent"}</button>}</div></div>;
      })}</div></section>
      <p className="mt-8 flex items-center gap-2 text-xs text-[#748276]"><CheckCircle2 size={16}/> “Message sent” means a staff member confirmed sending it, not that WhatsApp confirmed delivery. No message is sent by the website itself.</p>
    </>}
  </div></main>;
}

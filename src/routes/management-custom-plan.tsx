import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, CreditCard, Loader2, Search, ShieldCheck, UserPlus, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/management-custom-plan")({ component: ManagementCustomPlan });

type Member = { id: string; full_name: string | null; phone: string | null };
type ExistingPlan = { id: string; plan_name: string | null; start_date: string | null; end_date: string | null; status: string | null };
type Receipt = { member: Member; start: string; end: string; days: number; price: number; fee: number; total: number; method: string };
const LAGOS = "Africa/Lagos";

function todayInLagos() {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: LAGOS, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function expiry(start: string, days: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !Number.isInteger(days) || days < 1 || days > 3650) return "";
  const date = new Date(`${start}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== start) return "";
  date.setUTCDate(date.getUTCDate() + days - 1);
  return date.toISOString().slice(0, 10);
}
function niceDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}
const naira = (amount: number) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 }).format(amount);

function ManagementCustomPlan() {
  const [authorized, setAuthorized] = useState(false);
  const [accessLoading, setAccessLoading] = useState(true);
  const [accessError, setAccessError] = useState("");
  const [term, setTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [results, setResults] = useState<Member[]>([]);
  const [member, setMember] = useState<Member | null>(null);
  const [existing, setExisting] = useState<ExistingPlan[]>([]);
  const [days, setDays] = useState("30");
  const [price, setPrice] = useState("");
  const [includeFee, setIncludeFee] = useState(true);
  const [start, setStart] = useState(todayInLagos());
  const [method, setMethod] = useState("Bank Transfer");
  const [paymentReceived, setPaymentReceived] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const duration = Number(days);
  const amount = price.trim() ? Number(price) : NaN;
  const fee = includeFee ? 7000 : 0;
  const total = Number.isFinite(amount) ? amount + fee : 0;
  const end = expiry(start, duration);
  const valid = !!member && !!end && Number.isFinite(amount) && amount > 0 && amount <= 100000000 && Math.round(amount * 100) === amount * 100 && (method === "POS" || method === "Bank Transfer");

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) throw new Error("Sign in through the Staff Portal first.");
        const { data: staff, error: staffError } = await supabase.from("staff_users").select("role,active").eq("auth_user_id", auth.user.id).maybeSingle();
        if (staffError) throw staffError;
        if (!staff?.active || !["reception", "admin", "owner", "manager"].includes(String(staff.role || "").toLowerCase())) throw new Error("Only active reception and management accounts can create memberships.");
        if (!cancelled) setAuthorized(true);
      } catch (cause) {
        if (!cancelled) setAccessError(cause instanceof Error ? cause.message : "Could not verify staff access.");
      } finally { if (!cancelled) setAccessLoading(false); }
    }
    void check();
    return () => { cancelled = true; };
  }, []);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authorized || savingRef.current) return;
    setSearchError(""); setResults([]);
    const safe = term.trim().replace(/[%_,()\\]/g, " ").trim();
    if (safe.length < 2) { setSearchError("Enter at least two characters of a name or phone number."); return; }
    setSearching(true);
    try {
      const { data, error: lookupError } = await supabase.from("members").select("id,full_name,phone")
        .or(`full_name.ilike.%${safe}%,phone.ilike.%${safe}%`).order("full_name", { ascending: true }).limit(15);
      if (lookupError) throw lookupError;
      setResults((data || []) as Member[]);
    } catch (cause) { setSearchError(cause instanceof Error ? cause.message : "Member search failed."); }
    finally { setSearching(false); }
  }

  async function selectMember(next: Member) {
    if (savingRef.current) return;
    setMember(next); setResults([]); setPaymentReceived(false); setReceipt(null); setError(""); setExisting([]);
    const { data, error: lookupError } = await supabase.from("memberships")
      .select("id,plan_name,start_date,end_date,status").eq("member_id", next.id).order("end_date", { ascending: false }).limit(4);
    if (lookupError) setError(`Could not show existing plans: ${lookupError.message}`);
    else setExisting((data || []) as ExistingPlan[]);
  }

  function changeField(action: () => void) {
    if (savingRef.current) return;
    action(); setPaymentReceived(false); setError("");
  }

  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current || receipt) return;
    if (!valid || !member) { setError("Select a member and enter a valid duration, start date and price."); return; }
    if (!paymentReceived) { setError("Confirm the POS or bank transfer has actually been received before recording payment."); return; }
    const chosenMember = member;
    const chosen = { member: chosenMember, start, end, days: duration, price: amount, fee, total, method };
    if (!window.confirm(`Create a NEW Custom Plan for ${chosenMember.full_name || "this member"}?\n\n${duration} day(s): ${niceDate(start)} – ${niceDate(end)}\nPlan: ${naira(amount)}\nRegistration: ${naira(fee)}\nTOTAL PAYMENT RECEIVED: ${naira(total)} (${method})\n\nThis records a successful payment and creates an additional membership. Existing plans will not be replaced.`)) return;
    savingRef.current = true; setSaving(true); setError("");
    try {
      const { data: plan, error: planError } = await supabase.from("membership_plans").select("id,name").eq("name", "Custom Plan").maybeSingle();
      if (planError) throw planError;
      if (!plan) throw new Error("Custom Plan is not configured in membership_plans. Use the existing Reception Dashboard and contact management.");
      const metadata = {
        plan_name: "Custom Plan", start_date: start, end_date: end, concurrent_membership: true,
        custom_plan: true, custom_days: duration, custom_price: amount,
        registration_fee_included: includeFee, registration_fee: fee, total_amount: total,
      };
      const { data, error: saveError } = await supabase.rpc("reception_add_existing_membership", {
        p_member_id: chosenMember.id, p_plan_id: plan.id, p_start_date: start,
        p_duration_days: duration, p_amount: total, p_payment_method: method, p_metadata: metadata,
      });
      if (saveError) throw saveError;
      if (!data?.success) throw new Error("The membership and payment were not confirmed. Please check the existing dashboard before trying again.");
      setReceipt(chosen);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create membership. Check existing records before retrying."); }
    finally { savingRef.current = false; setSaving(false); }
  }

  return <div className="min-h-screen bg-[#f4f6f1] px-4 py-8 text-[#16221c] sm:px-7 lg:py-12">
    <div className="mx-auto max-w-6xl">
      <a href="/management-operations" className="inline-flex items-center gap-2 text-sm font-bold text-[#356942]"><ArrowLeft size={17}/> Back to operations</a>
      <div className="mt-6 flex flex-wrap items-start justify-between gap-5"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#65905c]">Super Plus / Memberships</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Create a Custom Plan</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[#637469]">Add a separately priced membership to an existing member. This uses the same database transaction as your current reception workflow.</p></div><span className="inline-flex items-center gap-2 rounded-full bg-[#e8f3e2] px-4 py-2 text-xs font-bold text-[#32633c]"><ShieldCheck size={17}/> Staff only</span></div>
      {accessLoading && <p className="mt-7 flex items-center gap-2 rounded-2xl bg-white p-5 text-sm"><Loader2 className="animate-spin" size={18}/> Checking staff access…</p>}
      {!accessLoading && accessError && <p role="alert" className="mt-7 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{accessError} <a href="/staff" className="font-bold underline">Staff login</a></p>}
      {!accessLoading && authorized && <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,1fr)]">
        <div className="space-y-6">
          <section className="rounded-[24px] border border-[#e1e8dd] bg-white p-5 sm:p-7"><div className="flex items-center gap-3"><span className="rounded-xl bg-[#edf6e7] p-3 text-[#38673e]"><Users size={20}/></span><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#65905c]">Step 01</p><h2 className="text-xl font-black">Choose the member</h2></div></div>
            {member ? <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-[#d8e6d0] bg-[#f1f8ee] p-4"><div className="min-w-0"><p className="truncate font-bold">{member.full_name || "Unnamed member"}</p><p className="mt-1 text-xs text-[#627468]">{member.phone || "No phone number"}</p></div><button disabled={saving || !!receipt} type="button" className="text-xs font-bold text-[#356942] underline disabled:opacity-40" onClick={() => { setMember(null); setExisting([]); setPaymentReceived(false); }}>Change</button></div> : <form onSubmit={(event) => void search(event)} className="mt-5 flex gap-2"><label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#d8e2d5] bg-[#f8faf6] px-3"><Search size={17}/><span className="sr-only">Member name or phone</span><input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Name or phone" className="w-full min-w-0 bg-transparent py-3 text-sm outline-none"/></label><button disabled={searching} type="submit" className="rounded-xl bg-[#1a3226] px-4 text-sm font-bold text-white disabled:opacity-50">{searching ? "Searching" : "Find"}</button></form>}
            {searchError && <p role="alert" className="mt-3 text-sm text-red-700">{searchError}</p>}
            {!member && results.length > 0 && <div className="mt-3 divide-y divide-[#e7ede4] rounded-xl border border-[#e7ede4]">{results.map((item) => <button key={item.id} type="button" onClick={() => void selectMember(item)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[#f1f8ee]"><span><span className="block text-sm font-bold">{item.full_name || "Unnamed member"}</span><span className="text-xs text-[#637469]">{item.phone || "No phone"}</span></span><ArrowRight size={16}/></button>)}</div>}
            {member && existing.length > 0 && <div className="mt-5 border-t border-[#e7ede4] pt-4"><p className="text-xs font-bold uppercase tracking-[.15em] text-[#627468]">Existing memberships · unchanged</p>{existing.map((item) => <div key={item.id} className="mt-3 flex items-center justify-between gap-2 text-xs"><span className="font-semibold">{item.plan_name || "Membership"} <span className="font-normal text-[#637469]">({item.status || "Unknown"})</span></span><span className="shrink-0 text-[#637469]">{niceDate(item.end_date)}</span></div>)}</div>}
            <a href="/management-members" className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-[#356942]">Full member directory <ArrowRight size={15}/></a>
          </section>
          <form onSubmit={(event) => void createPlan(event)} className="rounded-[24px] border border-[#e1e8dd] bg-white p-5 sm:p-7"><div className="flex items-center gap-3"><span className="rounded-xl bg-[#edf6e7] p-3 text-[#38673e]"><CalendarDays size={20}/></span><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#65905c]">Step 02</p><h2 className="text-xl font-black">Plan and payment</h2></div></div>
            <div className="mt-6 grid gap-5 sm:grid-cols-2"><label className="text-xs font-bold text-[#526e57]">Duration (days)<input required disabled={saving || !!receipt} type="number" min={1} max={3650} step={1} value={days} onChange={(event) => changeField(() => setDays(event.target.value))} className="mt-2 block w-full rounded-xl border border-[#d8e2d5] bg-[#f8faf6] px-4 py-3 text-base text-[#16221c]"/></label><label className="text-xs font-bold text-[#526e57]">Start date<input required disabled={saving || !!receipt} type="date" value={start} onChange={(event) => changeField(() => setStart(event.target.value))} className="mt-2 block w-full rounded-xl border border-[#d8e2d5] bg-[#f8faf6] px-4 py-3 text-base text-[#16221c]"/></label><label className="text-xs font-bold text-[#526e57]">Plan price (₦)<input required disabled={saving || !!receipt} type="number" inputMode="decimal" min="0.01" max="100000000" step="0.01" value={price} onChange={(event) => changeField(() => setPrice(event.target.value))} placeholder="Enter custom price" className="mt-2 block w-full rounded-xl border border-[#d8e2d5] bg-[#f8faf6] px-4 py-3 text-base text-[#16221c]"/></label><label className="text-xs font-bold text-[#526e57]">Payment method<select disabled={saving || !!receipt} value={method} onChange={(event) => changeField(() => setMethod(event.target.value))} className="mt-2 block w-full rounded-xl border border-[#d8e2d5] bg-[#f8faf6] px-4 py-3 text-base text-[#16221c]"><option value="Bank Transfer">Bank Transfer</option><option value="POS">POS</option></select></label></div>
            <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl bg-[#f2f7ed] p-4 text-sm"><input disabled={saving || !!receipt} type="checkbox" checked={includeFee} onChange={(event) => changeField(() => setIncludeFee(event.target.checked))} className="mt-1 size-4 accent-[#38673e]"/><span><strong>Add ₦7,000 registration fee</strong><span className="mt-1 block text-xs text-[#637469]">Optional. Fee is either ₦7,000 or ₦0.</span></span></label>
            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><input disabled={saving || !!receipt} type="checkbox" checked={paymentReceived} onChange={(event) => setPaymentReceived(event.target.checked)} className="mt-1 size-4 accent-[#38673e]"/><span><strong>I have verified and received this payment.</strong><span className="mt-1 block text-xs">Submitting records a successful payment. Do not tick for a pending transfer or unpaid membership.</span></span></label>
            {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
            {receipt ? <div className="mt-6 rounded-xl bg-[#e8f6e3] p-5 text-sm text-[#27552f]"><p className="flex items-center gap-2 font-black"><CheckCircle2 size={18}/> Membership created successfully</p><p className="mt-2">A separate Custom Plan and payment were recorded for {receipt.member.full_name || "the member"}.</p><a href={`/reception-member/${receipt.member.id}`} className="mt-3 inline-flex items-center gap-2 font-bold underline">View member profile <ArrowRight size={15}/></a></div> : <button type="submit" disabled={!valid || !paymentReceived || saving} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a3226] px-5 py-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40">{saving ? <Loader2 className="animate-spin" size={18}/> : <CreditCard size={18}/>} {saving ? "Recording membership…" : `Confirm membership & ${naira(total)} payment`}</button>}
          </form>
        </div>
        <aside className="h-fit space-y-5 lg:sticky lg:top-6"><section className="rounded-[24px] bg-[#1a3226] p-6 text-white"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#b8ee73]">Live calculation</p><h2 className="mt-3 text-2xl font-black">Custom Plan summary</h2><dl className="mt-6 space-y-4 text-sm"><div className="flex justify-between gap-3"><dt className="text-[#c2d0c4]">Member</dt><dd className="max-w-[60%] truncate text-right font-bold">{member?.full_name || "Not selected"}</dd></div><div className="flex justify-between gap-3"><dt className="text-[#c2d0c4]">Duration</dt><dd className="font-bold">{Number.isInteger(duration) && duration > 0 ? `${duration} days` : "—"}</dd></div><div className="flex justify-between gap-3"><dt className="text-[#c2d0c4]">Starts</dt><dd className="font-bold">{niceDate(start)}</dd></div><div className="flex justify-between gap-3"><dt className="text-[#c2d0c4]">Expires</dt><dd className="font-bold">{niceDate(end)}</dd></div><div className="flex justify-between gap-3"><dt className="text-[#c2d0c4]">Plan</dt><dd className="font-bold">{Number.isFinite(amount) && amount > 0 ? naira(amount) : "—"}</dd></div><div className="flex justify-between gap-3"><dt className="text-[#c2d0c4]">Registration</dt><dd className="font-bold">{naira(fee)}</dd></div></dl><div className="mt-6 flex items-center justify-between border-t border-white/20 pt-5"><span className="text-sm text-[#c2d0c4]">Total</span><strong className="text-3xl font-black text-[#b8ee73]">{naira(total)}</strong></div><p className="mt-5 text-xs leading-5 text-[#c2d0c4]">Expiry is inclusive: a one-day plan starts and ends on the same day. Existing memberships are not replaced.</p></section><a href="/reception-dashboard" className="flex items-center justify-between gap-2 rounded-2xl border border-[#dbe5d8] bg-white p-5 text-sm font-bold">Standard registration & other plans <UserPlus size={18}/></a></aside>
      </div>}
    </div>
  </div>;
}

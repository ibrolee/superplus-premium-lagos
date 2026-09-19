import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, CreditCard, Loader2, Search, ShieldCheck, UserPlus, Users } from "lucide-react";
import { membershipPlans } from "@/lib/site-data";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/management-standard-plan")({ component: StandardPlan });
type Member = { id: string; full_name: string | null; phone: string | null };
type Receipt = { id: string; name: string; plan: string; total: number; end: string };

// These two plans are for reception only, never for the public pricing page.
// Match their names and prices to the existing reception dashboard.
const receptionPlans = [
  ...membershipPlans,
  { id: "personal-training-only", name: "Personal Training Only", price: 30000, registration: 0 },
  { id: "custom-plan", name: "Custom Plan", price: 0, registration: 7000 },
];
const durations: Record<string, number> = {
  daily: 1, weekly: 7, monthly: 30, quarterly: 90, "semi-annual": 180,
  yearly: 365, "vip-silver": 30, "vip-gold": 30, family: 30,
  "personal-training": 30, "personal-training-only": 30,
};
const money = (value: number) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 }).format(value);
function lagosDay() {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: string) => parts.find(p => p.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function expires(day: string, duration: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isInteger(duration) || duration < 1 || duration > 3650) return "";
  const date = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== day) return "";
  date.setUTCDate(date.getUTCDate() + duration - 1);
  return date.toISOString().slice(0, 10);
}
const input = "mt-2 w-full rounded-xl border border-[#d8e2d5] bg-[#f8faf6] px-4 py-3 text-base text-[#16221c] outline-none focus:border-[#548351] disabled:opacity-60";

function StandardPlan() {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState("");
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [term, setTerm] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [member, setMember] = useState<Member | null>(null);
  const [searching, setSearching] = useState(false);
  const [planId, setPlanId] = useState("monthly");
  const [customDays, setCustomDays] = useState("30");
  const [customPrice, setCustomPrice] = useState("");
  const [start, setStart] = useState(lagosDay());
  const [feeOn, setFeeOn] = useState(true);
  const [method, setMethod] = useState("Bank Transfer");
  const [received, setReceived] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const busy = useRef(false);

  const plan = receptionPlans.find(item => item.id === planId) || receptionPlans[0]!;
  const custom = plan.id === "custom-plan";
  const duration = custom ? Number(customDays) : durations[plan.id] || 30;
  const amount = custom ? (customPrice.trim() ? Number(customPrice) : NaN) : plan.price;
  const end = expires(start, duration);
  const fee = feeOn && (mode === "new" || custom) ? plan.registration : 0;
  const total = amount + fee;
  const priceValid = Number.isFinite(amount) && amount > 0 && amount <= 100000000 && Number.isInteger(Math.round(amount * 1000000) / 10000);
  const birthdayValid = (!birthDay && !birthMonth) || Boolean(birthDay && birthMonth && Number.isInteger(Number(birthDay)) && Number.isInteger(Number(birthMonth)) && Number(birthMonth) >= 1 && Number(birthMonth) <= 12 && Number(birthDay) >= 1 && Number(birthDay) <= new Date(2000, Number(birthMonth), 0).getDate());
  const valid = Boolean(end && priceValid && total > 0 && (method === "POS" || method === "Bank Transfer") && (mode === "new" ? name.trim().length >= 2 && /^0\d{10}$/.test(phone.trim()) && birthdayValid : member));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) throw Error("Sign in through the Staff Portal first.");
        const { data, error: staffError } = await supabase.from("staff_users").select("role,active").eq("auth_user_id", authData.user.id).maybeSingle();
        if (staffError) throw staffError;
        if (!data?.active || !["reception", "admin", "owner", "manager"].includes(String(data.role || "").toLowerCase())) throw Error("Only active reception and management accounts may use this form.");
        if (!cancelled) setAuthorized(true);
      } catch (cause) { if (!cancelled) setAccessError(cause instanceof Error ? cause.message : "Could not verify access."); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  function edit(change: () => void) {
    if (busy.current || receipt) return;
    change(); setReceived(false); setError("");
  }
  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authorized || busy.current) return;
    const safe = term.trim().replace(/[%_,()\\]/g, " ").trim();
    if (safe.length < 2) { setError("Enter at least two characters to search."); return; }
    setSearching(true); setMembers([]); setError("");
    try {
      const { data, error: lookupError } = await supabase.from("members").select("id,full_name,phone")
        .or(`full_name.ilike.%${safe}%,phone.ilike.%${safe}%`).order("full_name", { ascending: true }).limit(15);
      if (lookupError) throw lookupError;
      setMembers((data || []) as Member[]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Search failed."); }
    finally { setSearching(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authorized || busy.current || receipt) return;
    setError("");
    if (!valid) { setError("Choose a member or enter valid details, duration, plan price and start date."); return; }
    if (!received) { setError("Confirm the full POS or bank transfer has actually been received first."); return; }
    busy.current = true; setSaving(true);
    try {
      if (mode === "new") {
        const { data: duplicates, error: lookupError } = await supabase.from("members").select("id,full_name").eq("phone", phone.trim()).limit(1);
        if (lookupError) throw lookupError;
        if (duplicates?.length) throw Error(`This phone already belongs to ${duplicates[0]!.full_name || "another member"}. Open their existing profile instead of registering twice.`);
      }
      const person = mode === "new" ? name.trim() : member?.full_name || "member";
      if (!window.confirm(`${mode === "new" ? "Register new member" : "Add separate membership for"} ${person}?\n${plan.name} · ${duration} days · ${start} to ${end}\nPlan ${money(amount)} · registration ${money(fee)}\nTOTAL PAYMENT RECEIVED: ${money(total)} (${method}).\n\nThis records a real successful payment. Existing memberships will not be replaced.`)) return;
      if (mode === "new") {
        // Match the existing reception registration RPC, including its custom-plan duration and amount inputs.
        const { data, error: saveError } = await supabase.rpc("reception_add_member", {
          p_full_name: name.trim(), p_email: email.trim() || null, p_phone: phone.trim(),
          p_address: address.trim() || null, p_birth_day: birthDay ? Number(birthDay) : null,
          p_birth_month: birthMonth ? Number(birthMonth) : null, p_plan_name: plan.name,
          p_start_date: start, p_duration_days: duration, p_amount: total, p_payment_method: method,
        });
        if (saveError) throw saveError;
        if (!data?.success || !data.member_id) throw Error("Registration confirmation is uncertain. Check existing records before trying again.");
        setReceipt({ id: data.member_id, name: name.trim(), plan: plan.name, total, end: data.end_date || end });
      } else {
        if (!member) throw Error("Choose a member first.");
        const { data: dbPlan, error: planError } = await supabase.from("membership_plans").select("id,name").eq("name", plan.name).maybeSingle();
        if (planError) throw planError;
        if (!dbPlan) throw Error(`${plan.name} was not found in the database. Use the existing Reception Dashboard.`);
        const metadata = custom ? {
          plan_name: "Custom Plan", start_date: start, end_date: end, concurrent_membership: true,
          custom_plan: true, custom_days: duration, custom_price: amount,
          registration_fee_included: feeOn, registration_fee: fee, total_amount: total,
        } : { plan_name: plan.name, start_date: start, end_date: end, concurrent_membership: true };
        const { data, error: saveError } = await supabase.rpc("reception_add_existing_membership", {
          p_member_id: member.id, p_plan_id: dbPlan.id, p_start_date: start,
          p_duration_days: duration, p_amount: total, p_payment_method: method, p_metadata: metadata,
        });
        if (saveError) throw saveError;
        if (!data?.success) throw Error("Membership confirmation is uncertain. Check the member record before trying again.");
        setReceipt({ id: member.id, name: member.full_name || "Member", plan: plan.name, total, end });
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Transaction failed. Check existing records before retrying."); }
    finally { busy.current = false; setSaving(false); }
  }

  return <main className="min-h-screen bg-[#f4f6f1] px-4 py-8 text-[#16221c] sm:px-8"><div className="mx-auto max-w-6xl">
    <a href="/management-operations" className="text-sm font-bold text-[#356942]">← Back to operations</a>
    <header className="mt-6"><p className="text-xs font-black uppercase tracking-[.2em] text-[#65905c]">Super Plus / Front desk</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Registration & memberships</h1><p className="mt-3 text-sm text-[#637469]">All reception plans, including Custom Plan and Personal Training Only. Record real payments only.</p></header>
    {loading && <p className="mt-8 rounded-xl bg-white p-6"><Loader2 className="inline animate-spin"/> Checking staff access…</p>}
    {!loading && accessError && <p role="alert" className="mt-8 rounded-xl bg-red-50 p-6 text-red-800">{accessError} <a href="/staff" className="underline">Staff login</a></p>}
    {authorized && !receipt && <>
      <div className="mt-7 grid gap-2 rounded-2xl bg-white p-2 sm:grid-cols-2">{(["new", "existing"] as const).map(value => <button key={value} type="button" disabled={saving} aria-pressed={mode === value} onClick={() => edit(() => setMode(value))} className={`rounded-xl px-4 py-4 text-sm font-bold ${mode === value ? "bg-[#1a3226] text-white" : "text-[#52715b]"}`}>{value === "new" ? <UserPlus className="mr-2 inline" size={18}/> : <Users className="mr-2 inline" size={18}/>} {value === "new" ? "Register new member" : "Existing member · add plan"}</button>)}</div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,1fr)]"><div className="space-y-6">
        <section className="rounded-[24px] border border-[#e1e8dd] bg-white p-5 sm:p-7"><h2 className="text-xl font-black">01 · {mode === "new" ? "Member details" : "Find existing member"}</h2>
          {mode === "new" ? <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-bold">Full name *<input required minLength={2} value={name} disabled={saving} onChange={e => edit(() => setName(e.target.value))} className={input}/></label>
            <label className="text-xs font-bold">Phone * (11 digits)<input required inputMode="tel" pattern="0[0-9]{10}" maxLength={11} value={phone} disabled={saving} onChange={e => edit(() => setPhone(e.target.value))} className={input}/></label>
            <label className="text-xs font-bold">Email (optional)<input type="email" value={email} disabled={saving} onChange={e => edit(() => setEmail(e.target.value))} className={input}/></label>
            <label className="text-xs font-bold">Address (optional)<input value={address} disabled={saving} onChange={e => edit(() => setAddress(e.target.value))} className={input}/></label>
            <label className="text-xs font-bold">Birth day (optional)<input type="number" min={1} max={31} value={birthDay} disabled={saving} onChange={e => edit(() => setBirthDay(e.target.value))} className={input}/></label>
            <label className="text-xs font-bold">Birth month (optional)<select value={birthMonth} disabled={saving} onChange={e => edit(() => setBirthMonth(e.target.value))} className={input}><option value="">Not provided</option>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{new Intl.DateTimeFormat("en-NG", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2000, i, 1)))}</option>)}</select></label>
            <p className="text-xs text-[#637469] sm:col-span-2">Enter both birthday fields or leave both empty. Exact matching phone numbers cannot be registered twice here.</p>
          </div> : <>
            <form onSubmit={event => void search(event)} className="mt-5 flex gap-2"><label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border bg-[#f8faf6] px-3"><Search size={18}/><span className="sr-only">Search members</span><input value={term} onChange={event => setTerm(event.target.value)} placeholder="Name or phone" className="w-full min-w-0 bg-transparent py-3 outline-none"/></label><button type="submit" disabled={searching || saving} className="rounded-xl bg-[#1a3226] px-4 font-bold text-white">{searching ? "Searching" : "Find"}</button></form>
            {members.map(item => <button key={item.id} type="button" disabled={saving} onClick={() => edit(() => setMember(item))} className="mt-2 flex w-full justify-between rounded-xl border bg-[#f8faf6] p-3 text-left text-sm"><span>{item.full_name || "Member"} · {item.phone || "No phone"}</span><ArrowRight size={16}/></button>)}
            {member && <p className="mt-4 rounded-xl bg-[#eef7e8] p-4 text-sm font-bold">Selected: {member.full_name} · <a href={`/reception-member/${member.id}`} className="underline">View existing profile</a></p>}
          </>}
        </section>
        <form onSubmit={event => void submit(event)} className="rounded-[24px] border border-[#e1e8dd] bg-white p-5 sm:p-7"><h2 className="text-xl font-black">02 · Plan and payment</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-bold">Plan *<select value={planId} disabled={saving} onChange={event => edit(() => setPlanId(event.target.value))} className={input}>{receptionPlans.map(item => <option value={item.id} key={item.id}>{item.name} · {item.id === "custom-plan" ? "Enter amount" : money(item.price)}</option>)}</select></label>
            <label className="text-xs font-bold">Start date *<input required type="date" value={start} disabled={saving} onChange={event => edit(() => setStart(event.target.value))} className={input}/></label>
            {custom && <><label className="text-xs font-bold">Custom duration (days) *<input required type="number" min={1} max={3650} step={1} value={customDays} disabled={saving} onChange={event => edit(() => setCustomDays(event.target.value))} className={input}/></label><label className="text-xs font-bold">Custom plan price (₦) *<input required type="number" min={0.01} max={100000000} step="0.01" value={customPrice} disabled={saving} onChange={event => edit(() => setCustomPrice(event.target.value))} placeholder="Enter agreed price" className={input}/></label></>}
            <label className="text-xs font-bold">Payment method *<select value={method} disabled={saving} onChange={event => edit(() => setMethod(event.target.value))} className={input}><option value="Bank Transfer">Bank Transfer</option><option value="POS">POS</option></select></label>
            {(mode === "new" || custom) && <label className="flex items-center gap-2 self-end rounded-xl border p-4 text-xs font-bold"><input type="checkbox" checked={feeOn} disabled={saving} onChange={event => edit(() => setFeeOn(event.target.checked))}/> Include registration ({money(plan.registration)})</label>}
          </div>
          <p className="mt-5 text-sm text-[#637469]">{end ? `${duration} days · ${start} to ${end} inclusive.` : "Enter a valid duration and start date."} {mode === "existing" ? "Creates a separate membership; it does not extend or overwrite an existing one." : "Registers a new member and first membership."}</p>
          <label className="mt-6 flex gap-3 rounded-xl bg-[#edf7e8] p-4 text-sm font-bold"><input type="checkbox" checked={received} disabled={saving} onChange={event => setReceived(event.target.checked)}/><span>I confirm the full {priceValid ? money(total) : "amount shown above"} was received via {method} and should be recorded as successful.</span></label>
          {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
          <button disabled={!valid || !received || saving} type="submit" className="mt-5 flex w-full justify-center gap-2 rounded-xl bg-[#193d2b] p-4 text-sm font-black text-white disabled:opacity-40">{saving ? <Loader2 size={18} className="animate-spin"/> : <CreditCard size={18}/>} {saving ? "Saving…" : "Confirm actual payment & save"}</button>
          <p className="mt-3 text-xs text-[#637469]">If an error occurs after confirmation, check records before retrying to avoid duplicates. Never submit a test payment.</p>
        </form>
      </div>
      <aside className="h-fit rounded-[24px] bg-[#1a3226] p-6 text-white"><p className="text-xs font-black uppercase tracking-[.2em] text-[#b8ee73]">Transaction summary</p><h2 className="mt-3 text-2xl font-black">{plan.name}</h2><p className="mt-2 text-sm text-[#c2d0c4]">{end ? `${duration} days · expires ${end}` : "Enter a valid duration"}</p><div className="mt-6 space-y-4 border-t border-white/20 pt-5 text-sm"><p className="flex justify-between"><span>Membership</span><strong>{priceValid ? money(amount) : "Enter price"}</strong></p>{(mode === "new" || custom) && <p className="flex justify-between"><span>Registration</span><strong>{money(fee)}</strong></p>}<p className="flex justify-between border-t border-white/20 pt-4 text-lg font-black"><span>Total</span><span className="text-[#b8ee73]">{priceValid ? money(total) : "—"}</span></p></div><p className="mt-6 text-xs leading-6 text-[#c2d0c4]"><ShieldCheck className="mb-2 text-[#b8ee73]" size={19}/>Standard prices and reception-only options match the existing reception configuration. Custom amounts are entered by staff.</p><a href="/reception-dashboard" className="mt-4 inline-block text-xs font-bold text-[#b8ee73]">Original Reception Dashboard →</a></aside>
      </div>
    </>}
    {authorized && receipt && <section role="status" className="mt-8 rounded-[24px] bg-white p-8"><CheckCircle2 size={40} className="text-[#378246]"/><h2 className="mt-4 text-2xl font-black">Membership and payment recorded</h2><p className="mt-2 text-sm text-[#637469]">{receipt.name} · {receipt.plan} · expiry {receipt.end}</p><p className="mt-4 text-3xl font-black">{money(receipt.total)}</p><p className="mt-3 text-xs text-[#637469]">Do not repeat this payment.</p><a href={`/reception-member/${receipt.id}`} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#193d2b] px-5 py-3 text-sm font-bold text-white">Open member profile <ArrowRight size={16}/></a></section>}
  </div></main>;
}

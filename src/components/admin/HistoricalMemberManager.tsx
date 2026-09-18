import { useEffect, useMemo, useState } from "react";
import { ChevronDown, History, Plus, RefreshCw, Search, UserPlus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

type Member = { id: string; full_name: string; email: string | null; phone: string | null };
type Plan = { id: string; name: string; price: number | null; duration_days: number | null; active: boolean };

const inputClass = "mt-1 w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary";
const labelClass = "grid min-w-0 gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground";
function lagosToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function HistoricalMemberManager({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [memberId, setMemberId] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [planId, setPlanId] = useState("");
  const [startDate, setStartDate] = useState(lagosToday);
  const [duration, setDuration] = useState("");
  const [historicalAmount, setHistoricalAmount] = useState("");
  const [historicalDate, setHistoricalDate] = useState("");
  const [notes, setNotes] = useState("Paid before the new revenue reporting period.");
  const [planName, setPlanName] = useState("");
  const [planPrice, setPlanPrice] = useState("");
  const [planDuration, setPlanDuration] = useState("");
  const [planDescription, setPlanDescription] = useState("");

  async function loadLists() {
    setListLoading(true);
    try {
      const allMembers: Member[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error: memberError } = await supabase.rpc("admin_members_list")
          .order("created_at", { ascending: false }).range(offset, offset + 499);
        if (memberError) throw memberError;
        const page = (data || []) as Member[];
        allMembers.push(...page);
        if (page.length < 500) break;
      }
      const { data: planData, error: planError } = await supabase.rpc("admin_membership_plans")
        .eq("active", true).order("name");
      if (planError) throw planError;
      setMembers(allMembers);
      setPlans((planData || []) as Plan[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load members and plans.");
    } finally {
      setListLoading(false);
    }
  }

  useEffect(() => { void loadLists(); }, [refreshKey]);

  const selectedMember = members.find((member) => member.id === memberId);
  const selectedPlan = plans.find((plan) => plan.id === planId);
  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (query.length < 2) return [];
    return members.filter((member) =>
      member.full_name.toLowerCase().includes(query) ||
      (member.email || "").toLowerCase().includes(query) ||
      (member.phone || "").includes(query),
    ).slice(0, 35);
  }, [members, search]);

  function selectExisting(member: Member) {
    setMemberId(member.id);
    setSearch(member.full_name);
    setPlanId("");
    setError("");
    setSuccess("");
  }

  async function importMember() {
    setError(""); setSuccess("");
    if (!memberId && !fullName.trim()) { setError("Enter the new member's full name or select an existing member."); return; }
    if (memberId && !planId) { setError("Select a plan to activate for the existing member."); return; }
    if (planId && (!startDate || !Number.isInteger(Number(duration || selectedPlan?.duration_days)) || Number(duration || selectedPlan?.duration_days) < 1)) {
      setError("Select a start date and valid number of membership days."); return;
    }
    if (planId && !selectedPlan) { setError("Select a valid membership plan."); return; }
    const amount = historicalAmount.trim() ? Number(historicalAmount) : 0;
    if (!Number.isFinite(amount) || amount < 0) { setError("Historical amount must be zero or greater."); return; }
    if (amount > 0 && !historicalDate) { setError("Enter the actual payment date when recording a historical payment."); return; }
    if (!notes.trim()) { setError("Enter an audit note explaining the historical activation."); return; }
    const action = memberId ? `Activate a previously paid plan for ${selectedMember?.full_name || "this member"}` : `Import ${fullName.trim()}`;
    if (!window.confirm(`${action}?\n\nThis operation will NOT increase new revenue. An optional historical payment will remain visible in payment history.`)) return;
    setSaving(true);
    try {
      const paidAt = historicalDate ? new Date(`${historicalDate}T12:00:00+01:00`).toISOString() : null;
      const { data, error: importError } = await supabase.rpc("admin_import_historical_member", {
        p_member_id: memberId || null,
        p_full_name: memberId ? null : fullName.trim(),
        p_email: memberId ? null : email.trim() || null,
        p_phone: memberId ? null : phone.trim() || null,
        p_address: memberId ? null : address.trim() || null,
        p_birth_day: memberId || !birthDay ? null : Number(birthDay),
        p_birth_month: memberId || !birthMonth ? null : Number(birthMonth),
        p_plan_id: planId || null,
        p_start_date: planId ? startDate : null,
        p_duration_days: planId ? Number(duration || selectedPlan?.duration_days || 0) : null,
        p_historical_amount: amount,
        p_historical_paid_at: paidAt,
        p_notes: notes.trim(),
      });
      if (importError) throw importError;
      if (!data?.success) throw new Error("Historical import could not be confirmed.");
      setSuccess(`Saved successfully. ${data.membership_id ? "Membership activated." : "Member created."} No new revenue was recorded.`);
      setMemberId(""); setSearch(""); setFullName(""); setEmail(""); setPhone(""); setAddress("");
      setBirthDay(""); setBirthMonth(""); setPlanId(""); setDuration("");
      setHistoricalAmount(""); setHistoricalDate("");
      onChanged();
    } catch (cause) {
  console.error("Historical member import error:", cause);

  const issue = cause as {
    message?: string;
    details?: string;
    hint?: string;
    code?: string;
  } | null;

  const errorMessage = [
    issue?.message || "Historical import failed.",
    issue?.details,
    issue?.hint,
    issue?.code ? `Error code: ${issue.code}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  setError(errorMessage);
} finally {
  setSaving(false);
}
  }

  async function createPlan() {
    setError(""); setSuccess("");
    if (!planName.trim() || !Number.isFinite(Number(planPrice)) || Number(planPrice) < 0 ||
      !Number.isInteger(Number(planDuration)) || Number(planDuration) < 1) {
      setError("Enter a plan name, non-negative price and a duration of at least one day."); return;
    }
    setSaving(true);
    try {
      const { data, error: createError } = await supabase.rpc("admin_create_membership_plan", {
        p_name: planName.trim(), p_price: Number(planPrice), p_duration_days: Number(planDuration),
        p_description: planDescription.trim() || null,
      });
      if (createError) throw createError;
      if (!data?.success) throw new Error("Membership plan was not confirmed.");
      setSuccess("Membership plan created. Plan creation does not create a payment or change revenue.");
      setPlanName(""); setPlanPrice(""); setPlanDuration(""); setPlanDescription("");
      await loadLists(); onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create membership plan.");
    } finally { setSaving(false); }
  }

  return (
    <details id="members-panel" className="group overflow-hidden rounded-2xl border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 [&::-webkit-details-marker]:hidden sm:p-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="rounded-xl bg-violet-100 p-3 text-violet-700"><UserPlus className="h-5 w-5" /></div>
          <div><p className="text-xs font-bold uppercase tracking-widest text-primary">Administrator only</p>
            <h2 className="font-display text-xl font-bold uppercase sm:text-2xl">Manage Members</h2>
            <p className="mt-1 text-xs text-muted-foreground">Import existing members, activate previously paid plans and create membership plans.</p></div>
        </div>
        <ChevronDown className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-6 border-t border-border p-4 sm:p-6">
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <div className="flex items-center gap-2 font-bold"><History className="h-4 w-4" /> Historical import — excluded from new revenue</div>
          <p className="mt-2">Use this ONLY for members and plans paid before the new reporting period. New payments collected today must use the normal payment process. Existing payment records are never deleted.</p>
        </div>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {success && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-700">{success}</p>}
        <div className="flex items-center justify-between gap-3"><h3 className="font-display text-lg font-bold uppercase">Import or activate a member</h3><Button type="button" variant="outline" onClick={() => void loadLists()} disabled={listLoading || saving}><RefreshCw className="h-4 w-4" /> Refresh</Button></div>
        <div className="grid gap-4 rounded-xl border border-border bg-background p-4">
          <label className={labelClass}><span>Find existing member (name, phone or email)</span><div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4" /><input value={search} onChange={(e) => {setSearch(e.target.value); if (memberId) setMemberId("");}} placeholder="Search existing members..." className={`${inputClass} pl-9`} /></div></label>
          {listLoading && <p className="text-xs text-muted-foreground">Loading member records...</p>}
          {!memberId && search.length >= 2 && <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
            {searchResults.length ? searchResults.map((member) => <button key={member.id} type="button" onClick={() => selectExisting(member)} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"><span className="font-semibold">{member.full_name}</span><span className="ml-2 text-xs text-muted-foreground">{member.phone || member.email || "No contact"}</span></button>) : <p className="p-2 text-xs text-muted-foreground">No matching member. Register a new member below.</p>}
          </div>}
          {memberId && <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800"><span>Selected: <strong>{selectedMember?.full_name || memberId}</strong></span><button type="button" className="font-bold underline" onClick={() => {setMemberId(""); setSearch("");}}>Clear selection</button></div>}
          {!memberId && <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>New member full name *<input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} /></label>
            <label className={labelClass}>Email<input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label className={labelClass}>Phone<input type="tel" className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
            <label className={labelClass}>Address<input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} /></label>
            <label className={labelClass}>Birth day<select className={inputClass} value={birthDay} onChange={(e) => setBirthDay(e.target.value)}><option value="">Not specified</option>{Array.from({length: 31},(_,i)=>i+1).map((day)=><option key={day} value={day}>{day}</option>)}</select></label>
            <label className={labelClass}>Birth month<select className={inputClass} value={birthMonth} onChange={(e) => setBirthMonth(e.target.value)}><option value="">Not specified</option>{Array.from({length: 12},(_,i)=>i+1).map((month)=><option key={month} value={month}>{month}</option>)}</select></label>
          </div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>Previously paid plan {memberId ? "*" : "(optional for member-only import)"}
              <select className={inputClass} value={planId} onChange={(e)=>{setPlanId(e.target.value);setDuration("");if (!e.target.value) {setHistoricalAmount("");setHistoricalDate("");}}}><option value="">{memberId ? "Select plan..." : "Member only — no plan yet"}</option>{plans.map((plan)=><option key={plan.id} value={plan.id}>{plan.name} · ₦{Number(plan.price || 0).toLocaleString("en-NG")}</option>)}</select></label>
            {planId && <label className={labelClass}>Membership start date<input type="date" className={inputClass} value={startDate} onChange={(e)=>setStartDate(e.target.value)} /></label>}
            {planId && <label className={labelClass}>Number of days<input type="number" min="1" max="3650" className={inputClass} value={duration || String(selectedPlan?.duration_days || "")} onChange={(e)=>setDuration(e.target.value)} /></label>}
            {planId && <label className={labelClass}>Actual amount paid previously (₦, optional)<input type="number" min="0" step="0.01" className={inputClass} value={historicalAmount} onChange={(e)=>setHistoricalAmount(e.target.value)} placeholder="0 = no historical payment entry" /></label>}
            {planId && Number(historicalAmount) > 0 && <label className={labelClass}>Actual historical payment date *<input type="date" max={lagosToday()} className={inputClass} value={historicalDate} onChange={(e)=>setHistoricalDate(e.target.value)} /></label>}
          </div>
          <label className={labelClass}>Audit note *<textarea rows={2} className={inputClass} value={notes} onChange={(e)=>setNotes(e.target.value)} /></label>
          <p className="text-xs text-muted-foreground">Membership expiry is calculated automatically. Historical amounts are saved in payment history but excluded from the new revenue report. Leave the amount at zero if the previous amount is unknown; no payment record will be fabricated.</p>
          <Button type="button" onClick={() => void importMember()} disabled={saving || listLoading} className="w-full sm:w-fit"><UserPlus className="h-4 w-4" /> {saving ? "Saving..." : memberId ? "Activate previously paid membership" : "Import member / historical plan"}</Button>
        </div>
        <details className="group/plan overflow-hidden rounded-xl border border-border">
          <summary className="flex cursor-pointer list-none items-center justify-between p-4 [&::-webkit-details-marker]:hidden"><span className="flex items-center gap-2 font-display text-lg font-bold uppercase"><Plus className="h-5 w-5" /> Create membership plan</span><ChevronDown className="h-4 w-4 transition-transform group-open/plan:rotate-180" /></summary>
          <div className="grid gap-4 border-t border-border p-4 sm:grid-cols-2">
            <label className={labelClass}>Plan name *<input className={inputClass} value={planName} onChange={(e)=>setPlanName(e.target.value)} /></label>
            <label className={labelClass}>Plan price (₦) *<input type="number" min="0" step="0.01" className={inputClass} value={planPrice} onChange={(e)=>setPlanPrice(e.target.value)} /></label>
            <label className={labelClass}>Duration in days *<input type="number" min="1" max="3650" className={inputClass} value={planDuration} onChange={(e)=>setPlanDuration(e.target.value)} /></label>
            <label className={labelClass}>Description<input className={inputClass} value={planDescription} onChange={(e)=>setPlanDescription(e.target.value)} /></label>
            <div className="sm:col-span-2"><p className="mb-3 text-xs text-muted-foreground">Creating a plan never records revenue. This creates a database plan for historical imports; other website plan lists may also require updating if they use hard-coded options.</p><Button type="button" onClick={() => void createPlan()} disabled={saving}><Plus className="h-4 w-4" /> {saving ? "Saving..." : "Create plan"}</Button></div>
          </div>
        </details>
      </div>
    </details>
  );
}

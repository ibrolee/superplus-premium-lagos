import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, Plus, Scissors, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { lagosToday } from "@/lib/pt-payroll";
import { SPA_COMMISSION_RATE, spaCommissionAmount, type SpaCommission } from "@/lib/spa-commissions";
import { recoveryServices } from "../../../supabase/functions/_shared/spa-services";

type Staff = { id: string; full_name: string; status: string; position: string | null };
type Props = {
  month: string;
  staff: Staff[];
  records: SpaCommission[];
  disabled: boolean;
  onChanged: () => void;
};
const money = (amount: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 }).format(amount);
const field = "mt-1.5 w-full min-w-0 rounded-xl border border-[var(--portal-border)] bg-white px-3 py-3 text-sm outline-none focus:border-[var(--portal-accent)] disabled:opacity-50";
const named = (staff: Staff) => (/salmah/i.test(staff.full_name) ? 0 : /james/i.test(staff.full_name) ? 1 : /chinedu/i.test(staff.full_name) ? 2 : 3);
const isServiceAmount = (s: string) => /^\d+(\.\d{1,2})?$/.test(s) && Number(s) > 0 && Number(s) <= 100000000;

export function SpaCommissions({ month, staff, records, disabled, onChanged }: Props) {
  const today = lagosToday();
  const [staffId, setStaffId] = useState("");
  const [service, setService] = useState("");
  const [customer, setCustomer] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(month === today.slice(0, 7) ? today : month + "-01");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setDate(month === lagosToday().slice(0, 7) ? lagosToday() : month + "-01");
    setError("");
    setNotice("");
  }, [month]);

  const eligible = useMemo(() => staff
    .filter((person) => person.status === "approved" && !/super plus fitness admin/i.test(person.full_name))
    .sort((a, b) => named(a) - named(b) || a.full_name.localeCompare(b.full_name)), [staff]);
  const monthly = useMemo(() => records
    .filter((record) => record.service_date.slice(0, 7) === month)
    .sort((a, b) => b.service_date.localeCompare(a.service_date) || b.created_at.localeCompare(a.created_at)), [records, month]);
  const total = monthly.reduce((sum, row) => sum + Number(row.commission_amount), 0);
  const paid = monthly.filter((row) => row.status === "paid").reduce((sum, row) => sum + Number(row.commission_amount), 0);
  const byStaff = useMemo(() => {
    const output = new Map<string, { name: string; count: number; total: number; paid: number }>();
    for (const item of monthly) {
      const person = staff.find((row) => row.id === item.staff_profile_id);
      const current = output.get(item.staff_profile_id) || { name: person?.full_name || "Former staff member", count: 0, total: 0, paid: 0 };
      current.count++;
      current.total += Number(item.commission_amount);
      if (item.status === "paid") current.paid += Number(item.commission_amount);
      output.set(item.staff_profile_id, current);
    }
    return [...output.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [monthly, staff]);
  const canSave = !!staffId && service.trim().length >= 2 && service.trim().length <= 150 &&
    isServiceAmount(amount) && date.startsWith(month) && date <= today &&
    customer.length <= 120 && notes.length <= 1000;
  const blocked = disabled || !!busy;
  const selectedCommission = spaCommissionAmount(Number(amount));

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (blocked || !canSave) return;
    setBusy("saving");
    setError("");
    setNotice("");
    const { error: insertError } = await supabase.from("spa_staff_commissions").insert({
      staff_profile_id: staffId,
      service_name: service.trim(),
      customer_name: customer.trim() || null,
      service_date: date,
      service_amount: Number(amount),
      notes: notes.trim(),
      source: "manual",
      status: "pending",
    });
    if (insertError) setError(insertError.message);
    else {
      setNotice(`Spa service recorded. Staff commission: ${money(selectedCommission)} (30%).`);
      setService("");
      setAmount("");
      setCustomer("");
      setNotes("");
      onChanged();
    }
    setBusy("");
  }

  async function markPaid(item: SpaCommission) {
    if (blocked || item.status !== "pending") return;
    const person = staff.find((row) => row.id === item.staff_profile_id)?.full_name || "this staff member";
    if (!window.confirm(`Confirm you have paid ${money(item.commission_amount)} spa commission to ${person} for ${item.service_name}? This permanently locks the record.`)) return;
    setBusy(item.id);
    setError("");
    setNotice("");
    const { data, error: updateError } = await supabase.from("spa_staff_commissions")
      .update({ status: "paid" }).eq("id", item.id).eq("status", "pending").select("id");
    if (updateError) setError(updateError.message);
    else if (!data?.length) setError("This commission was already processed. Refresh before trying again.");
    else { setNotice("Spa commission marked paid."); onChanged(); }
    setBusy("");
  }

  async function remove(item: SpaCommission) {
    if (blocked || item.status !== "pending" || item.source !== "manual") return;
    if (!window.confirm(`Delete the unpaid ${item.service_name} spa commission for ${money(item.commission_amount)}? This cannot be undone.`)) return;
    setBusy(item.id);
    setError("");
    setNotice("");
    const { data, error: deleteError } = await supabase.from("spa_staff_commissions")
      .delete().eq("id", item.id).eq("status", "pending").eq("source", "manual").select("id");
    if (deleteError) setError(deleteError.message);
    else if (!data?.length) setError("This commission is already paid or no longer exists.");
    else { setNotice("Unpaid spa commission entry deleted."); onChanged(); }
    setBusy("");
  }

  return <section className="mt-5 rounded-2xl border border-[var(--portal-border)] bg-white p-4 sm:p-6" aria-label="Spa staff commissions">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-black"><Scissors size={21} />Spa service commissions</h2>
        <p className="mt-1 text-xs leading-5 text-[color:var(--portal-muted)]">
          The staff member who performed each spa service receives a fixed {Math.round(SPA_COMMISSION_RATE * 100)}% of the service amount. Separate from salary and PT commission.
        </p>
      </div>
      <span className="rounded-xl bg-orange-100 px-3 py-2 text-xs font-black text-orange-900">30% staff commission</span>
    </div>
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
      <div className="rounded-xl bg-[var(--portal-canvas)] p-3"><p className="text-[11px] text-[color:var(--portal-muted)]">Commission earned</p><p className="mt-1 text-lg font-black">{money(total)}</p></div>
      <div className="rounded-xl bg-[var(--portal-canvas)] p-3"><p className="text-[11px] text-[color:var(--portal-muted)]">Paid</p><p className="mt-1 text-lg font-black">{money(paid)}</p></div>
      <div className="col-span-2 rounded-xl bg-[var(--portal-ink)] p-3 text-white sm:col-span-1"><p className="text-[11px] text-white/75">Still owed</p><p className="mt-1 text-lg font-black">{money(total - paid)}</p></div>
    </div>
    <p className="mt-3 text-xs leading-5 text-[color:var(--portal-muted)]">
      Completed and paid website spa bookings are recorded automatically for the assigned staff. Use the form below only for services handled directly at the gym; do not record website bookings twice.
    </p>
    <form onSubmit={(event) => void save(event)} className="mt-4 rounded-xl border border-[var(--portal-border)] bg-[var(--portal-canvas)] p-4">
      <h3 className="flex items-center gap-2 text-sm font-black"><Plus size={16} />Add spa service commission</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold">Staff who performed the service
          <select required className={field} value={staffId} disabled={blocked} onChange={(event) => setStaffId(event.target.value)}>
            <option value="">Select staff</option>
            {eligible.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold">Service date
          <input className={field} type="date" required min={month + "-01"} max={today < month + "-31" ? today : month + "-31"} value={date} disabled={blocked}
            onChange={(event) => setDate(event.target.value)} />
        </label>
        <label className="text-xs font-bold">Spa service performed
          <input className={field} required maxLength={150} minLength={2} list="spf-spa-service-options" value={service} placeholder="e.g. Pedicure" disabled={blocked}
            onChange={(event) => setService(event.target.value)} />
          <datalist id="spf-spa-service-options">{recoveryServices.map((item) => <option key={item.id} value={item.name} />)}</datalist>
        </label>
        <label className="text-xs font-bold">Service amount received (₦)
          <input className={field} type="number" min="0.01" max="100000000" step="0.01" required inputMode="decimal" value={amount} placeholder="10000" disabled={blocked}
            onChange={(event) => setAmount(event.target.value)} />
        </label>
        <label className="text-xs font-bold">Customer name (optional)
          <input className={field} maxLength={120} value={customer} placeholder="Customer name" disabled={blocked}
            onChange={(event) => setCustomer(event.target.value)} />
        </label>
        <label className="text-xs font-bold">Management note (optional)
          <input className={field} maxLength={1000} value={notes} placeholder="Cash/POS, details, etc." disabled={blocked}
            onChange={(event) => setNotes(event.target.value)} />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3">
        <p className="text-xs font-semibold">Commission: <strong className="ml-1 text-base">{money(selectedCommission)}</strong><span className="ml-2 text-[color:var(--portal-muted)]">30% of service amount</span></p>
        <button type="submit" disabled={blocked || !canSave} className="rounded-xl bg-[var(--portal-ink)] px-5 py-3 text-xs font-bold text-white disabled:opacity-40">
          {busy === "saving" ? "Saving…" : "Record spa commission"}
        </button>
      </div>
    </form>
    {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-800">{error}</p>}
    {notice && <p role="status" className="mt-3 rounded-xl bg-green-50 p-3 text-xs text-green-800">{notice}</p>}
    {byStaff.length > 0 && <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {byStaff.map(([id, row]) => <div key={id} className="rounded-xl border p-3">
        <p className="text-sm font-black">{row.name}</p>
        <p className="mt-1 text-xs text-[color:var(--portal-muted)]">{row.count} spa service(s)</p>
        <p className="mt-2 text-base font-black">{money(row.total)}</p>
        <p className="mt-1 text-xs text-[color:var(--portal-muted)]">{money(row.total - row.paid)} unpaid</p>
      </div>)}
    </div>}
    <div className="mt-5 space-y-2">
      <h3 className="text-sm font-black">Spa commission records · {month}</h3>
      {monthly.length === 0 && <p className="rounded-xl bg-[var(--portal-canvas)] p-4 text-xs text-[color:var(--portal-muted)]">No spa services recorded for this month yet.</p>}
      {monthly.map((item) => <article key={item.id} className="rounded-xl border border-[var(--portal-border)] p-3 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-black">{item.service_name}</p>
            <p className="mt-1 text-xs text-[color:var(--portal-muted)]">
              {staff.find((person) => person.id === item.staff_profile_id)?.full_name || "Staff record"} · {item.service_date}
            </p>
            <p className="mt-1 text-xs text-[color:var(--portal-muted)]">
              {item.source === "website_booking" ? "Website booking (automatic)" : "Manual spa entry"}{item.customer_name ? ` · ${item.customer_name}` : ""}
            </p>
            {item.notes && item.source === "manual" && <p className="mt-1 text-xs text-[color:var(--portal-muted)]">{item.notes}</p>}
          </div>
          <div className="text-right">
            <p className="text-base font-black">{money(Number(item.commission_amount))}</p>
            <p className="mt-1 text-xs text-[color:var(--portal-muted)]">30% of {money(Number(item.service_amount))}</p>
            <p className={`mt-1 text-xs font-bold ${item.status === "paid" ? "text-green-700" : "text-amber-800"}`}>
              {item.status === "paid" ? "Paid" : "Pending"}
            </p>
          </div>
        </div>
        {item.status === "pending" && <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={blocked} onClick={() => void markPaid(item)}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--portal-ink)] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40">
            <CheckCircle2 size={14} />Mark commission paid
          </button>
          {item.source === "manual" && <button type="button" disabled={blocked} onClick={() => void remove(item)}
            className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2.5 text-xs font-bold text-red-700 disabled:opacity-40">
            <Trash2 size={14} />Delete unpaid entry
          </button>}
        </div>}
        {item.status === "paid" && item.paid_at && <p className="mt-2 text-xs text-[color:var(--portal-muted)]">Payment recorded on {new Date(item.paid_at).toLocaleDateString("en-NG", { timeZone: "Africa/Lagos" })}</p>}
      </article>)}
    </div>
  </section>;
}

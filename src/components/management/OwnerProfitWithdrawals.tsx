import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, Loader2, Plus, Wallet, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getUserErrorMessage } from "@/lib/user-error";

type Withdrawal = {
  id: string;
  withdrawal_date: string;
  amount: number;
  recipient: string;
  payment_method: "Cash" | "POS" | "Bank Transfer";
  reference: string;
  notes: string;
  updated_at: string;
};
type MonthData = { withdrawal_total: number; withdrawal_count: number; withdrawals: Withdrawal[] };
const field =
  "mt-2 w-full min-w-0 rounded-xl border border-[var(--portal-border)] bg-white px-4 py-3 text-base text-[color:var(--portal-ink)] outline-none focus:border-[var(--portal-accent)] disabled:opacity-50";
const money = (value: number) => new Intl.NumberFormat("en-NG", {
  style: "currency", currency: "NGN", minimumFractionDigits: 0, maximumFractionDigits: 2,
}).format(value);
const dateLabel = (value: string) => new Intl.DateTimeFormat("en-NG", {
  day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos",
}).format(new Date(value + "T12:00:00Z"));

export function OwnerProfitWithdrawals({ month, today }: { month: string; today: string }) {
  const [data, setData] = useState<MonthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("Owner");
  const [method, setMethod] = useState<Withdrawal["payment_method"]>("Bank Transfer");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    void supabase.rpc("admin_get_owner_withdrawals_month", { p_month_start: month + "-01" })
      .then(({ data: result, error: cause }) => {
        if (cause) throw cause;
        if (live) setData(result as MonthData);
      })
      .catch((cause) => { if (live) setError(getUserErrorMessage(cause, "Unable to load owner withdrawals.")); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [month, reload]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const numericAmount = Number(amount);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < "2026-10-01" || date > today ||
        !Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > 100000000 ||
        !/^\d+(?:\.\d{1,2})?$/.test(amount) || !recipient.trim() || recipient.trim().length > 120 ||
        reference.length > 200 || notes.length > 1500) {
      setError("Enter a valid date, amount, recipient and optional reference/notes.");
      return;
    }
    setBusy(true); setError(""); setNotice("");
    try {
      const { error: cause } = await supabase.from("gym_owner_withdrawals").insert({
        withdrawal_date: date, amount: numericAmount, recipient: recipient.trim(),
        payment_method: method, reference: reference.trim(), notes: notes.trim(),
      });
      if (cause) throw cause;
      setNotice("Owner profit withdrawal recorded. Profit and expense totals are unchanged.");
      setOpen(false); setAmount(""); setReference(""); setNotes("");
      setReload((v) => v + 1);
    } catch (cause) {
      setError(getUserErrorMessage(cause, "Unable to record owner withdrawal."));
    } finally { setBusy(false); }
  }

  async function voidWithdrawal(item: Withdrawal) {
    if (busy || !window.confirm("Remove this withdrawal from the monthly totals? The record will be retained in the audit history.")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const { data: updated, error: cause } = await supabase.from("gym_owner_withdrawals")
        .update({ voided_at: new Date().toISOString() })
        .eq("id", item.id).eq("updated_at", item.updated_at).is("voided_at", null)
        .select("id").maybeSingle();
      if (cause) throw cause;
      if (!updated) throw Error("This withdrawal changed elsewhere. Refresh and try again.");
      setNotice("Withdrawal removed from totals; the audit record was retained.");
      setReload((v) => v + 1);
    } catch (cause) { setError(getUserErrorMessage(cause, "Unable to remove withdrawal.")); }
    finally { setBusy(false); }
  }

  return <section className="mt-6 rounded-2xl border border-[var(--portal-border)] bg-white p-5 sm:p-6" aria-labelledby="owner-withdrawals-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 id="owner-withdrawals-title" className="flex items-center gap-2 text-lg font-black"><Wallet size={20}/> Owner profit withdrawals</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-[color:var(--portal-muted)]">Record profit distributions to the owner separately from operating expenses. Withdrawals reduce cash retained by the business, not the month's operating profit.</p>
      </div>
      <button type="button" disabled={busy || loading} onClick={() => { setOpen(true); setDate(month === today.slice(0,7) ? today : month + "-01"); setError(""); setNotice(""); }} className="inline-flex items-center gap-2 rounded-xl bg-[var(--portal-ink)] px-4 py-3 text-sm font-bold text-white disabled:opacity-40"><Plus size={17}/> Record withdrawal</button>
    </div>
    {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="mt-4 flex items-center gap-2 rounded-xl bg-green-50 p-3 text-sm text-green-800"><CheckCircle2 size={16}/>{notice}</p>}
    {open && <form onSubmit={(e) => void save(e)} className="mt-5 grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
      <div className="flex items-center justify-between gap-3 sm:col-span-2"><h3 className="font-black">New owner withdrawal</h3><button type="button" aria-label="Close withdrawal form" onClick={() => setOpen(false)} disabled={busy} className="rounded-lg p-2 hover:bg-[var(--portal-surface)]"><X size={18}/></button></div>
      <label className="text-sm font-bold">Withdrawal date<input type="date" required min="2026-10-01" max={today} value={date} onChange={(e) => setDate(e.target.value)} disabled={busy} className={field}/></label>
      <label className="text-sm font-bold">Amount (₦)<input type="number" required min="0.01" max="100000000" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={busy} placeholder="0" className={field}/></label>
      <label className="text-sm font-bold">Recipient<input required maxLength={120} value={recipient} onChange={(e) => setRecipient(e.target.value)} disabled={busy} className={field}/></label>
      <label className="text-sm font-bold">Payment method<select value={method} onChange={(e) => setMethod(e.target.value as Withdrawal["payment_method"])} disabled={busy} className={field}><option>Bank Transfer</option><option>Cash</option><option>POS</option></select></label>
      <label className="text-sm font-bold">Transfer reference (optional)<input maxLength={200} value={reference} onChange={(e) => setReference(e.target.value)} disabled={busy} placeholder="Bank transaction reference" className={field}/></label>
      <label className="text-sm font-bold">Notes (optional)<input maxLength={1500} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={busy} placeholder="Optional note" className={field}/></label>
      <div className="flex gap-2 sm:col-span-2"><button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-[var(--portal-ink)] px-5 py-3 text-sm font-bold text-white disabled:opacity-40">{busy ? <Loader2 size={17} className="animate-spin"/> : <CheckCircle2 size={17}/>}Save withdrawal</button><button type="button" disabled={busy} onClick={() => setOpen(false)} className="rounded-xl border px-5 py-3 text-sm font-bold">Cancel</button></div>
    </form>}
    <div className="mt-5 grid gap-3 sm:grid-cols-3">
      <article className="rounded-xl border p-4"><p className="text-xs font-bold text-[color:var(--portal-muted)]">Total withdrawals · {month}</p><p className="mt-2 text-xl font-black tabular-nums">{loading ? "Loading…" : money(Number(data?.withdrawal_total || 0))}</p></article>
      <article className="rounded-xl border p-4"><p className="text-xs font-bold text-[color:var(--portal-muted)]">Transactions</p><p className="mt-2 text-xl font-black tabular-nums">{loading ? "…" : Number(data?.withdrawal_count || 0)}</p></article>
      <article className="rounded-xl border p-4"><p className="text-xs font-bold text-[color:var(--portal-muted)]">Profit impact</p><p className="mt-2 text-xl font-black">₦0</p><p className="mt-1 text-xs text-[color:var(--portal-muted)]">Does not reduce operating profit</p></article>
    </div>
    <div className="mt-5 overflow-x-auto">
      <table className="w-full min-w-[680px] text-left text-sm"><thead><tr className="border-b text-xs text-[color:var(--portal-muted)]"><th className="py-3 pr-3">Date</th><th className="py-3 pr-3">Recipient</th><th className="py-3 pr-3">Method / reference</th><th className="py-3 pr-3">Notes</th><th className="py-3 pr-3 text-right">Amount</th><th className="py-3 text-right">Action</th></tr></thead>
      <tbody>{(data?.withdrawals || []).map((item) => <tr key={item.id} className="border-b last:border-0"><td className="py-3 pr-3 whitespace-nowrap">{dateLabel(item.withdrawal_date)}</td><td className="py-3 pr-3">{item.recipient}</td><td className="py-3 pr-3">{item.payment_method}{item.reference && <span className="block text-xs text-[color:var(--portal-muted)]">{item.reference}</span>}</td><td className="py-3 pr-3 max-w-[220px] whitespace-pre-wrap break-words">{item.notes || "—"}</td><td className="py-3 pr-3 text-right font-bold tabular-nums">{money(Number(item.amount))}</td><td className="py-3 text-right"><button type="button" disabled={busy} onClick={() => void voidWithdrawal(item)} className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-40">Remove</button></td></tr>)}
      {!loading && !(data?.withdrawals || []).length && <tr><td colSpan={6} className="py-8 text-center text-[color:var(--portal-muted)]">No owner withdrawals recorded for this month.</td></tr>}</tbody></table>
    </div>
  </section>;
}

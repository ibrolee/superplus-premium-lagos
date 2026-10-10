import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatDate } from "@/lib/pt-payroll";
const formatMoney = (value: number, currency = "NGN") => new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);

export type SalaryAdvance = { id: string; staff_profile_id: string; salary_month: string; amount: number; salary_snapshot: number; currency: string; reason: string; status: string; requested_at: string; review_note: string; paid_at: string | null };
type Summary = { today: string; month: string; salary: number; currency: string; maximum: number; paid_advances: number; remaining: number; can_request: boolean; requests: SalaryAdvance[] };
export function StaffSalaryAdvance({ staffProfileId, readOnly = false }: { staffProfileId: string; readOnly?: boolean }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setSummary(null); setError("");
    void supabase.rpc("get_staff_salary_advance_summary", { p_staff_profile_id: staffProfileId }).then(({ data, error }) => {
      if (cancelled) return;
      if (error) setError(error.message); else setSummary(data as Summary);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [staffProfileId, reload]);
  useEffect(() => {
    // Keep a profile left open over midnight in sync with the server's date.
    const timer = window.setInterval(() => setReload((value) => value + 1), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || readOnly || !summary?.can_request) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0 || value > summary.maximum || Math.abs(value * 100 - Math.round(value * 100)) > .000001) { setError("Enter a valid amount within your advance limit."); return; }
    setBusy(true); setError(""); setSuccess("");
    try {
      const { error } = await supabase.rpc("request_staff_salary_advance", { p_amount: value, p_reason: reason });
      if (error) throw error;
      setAmount(""); setReason(""); setSuccess("Advance requested. Admin will review it."); setReload((value) => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : (cause as { message?: string }).message || "Unable to request advance."); }
    finally { setBusy(false); }
  }
  return <section className="mb-6 border border-border bg-muted/10 p-4 sm:p-5">
    <h3 className="font-display text-xl font-bold uppercase">Salary advance</h3>
    <p className="mt-2 text-sm text-muted-foreground">One request each month, from the 15th through the last day of the month in Nigerian time. Maximum: 40% of your fixed monthly salary. Paid advances are deducted from that month’s salary, paid on the following 1st.</p>
    {loading && <p className="mt-3 text-sm" role="status">Loading advance details…</p>}
    {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
    {success && <p className="mt-3 text-sm text-green-700" role="status">{success}</p>}
    {summary && <>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">{[["Maximum advance", summary.maximum], ["Advances paid this month", summary.paid_advances], ["Remaining salary due", summary.remaining]].map(([label, value]) => <div key={String(label)} className="border border-border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 break-words font-bold">{formatMoney(Number(value), summary.currency)}</p></div>)}</div>
      {readOnly ? <p className="mt-4 text-sm text-muted-foreground">Admin preview is read-only.</p> : summary.can_request ? <form onSubmit={(event) => void submit(event)} className="mt-4 space-y-3">
        <label className="block text-sm font-bold">Amount ({summary.currency})<input type="number" required min="0.01" step="0.01" max={summary.maximum} value={amount} disabled={busy} onChange={(event) => setAmount(event.target.value)} className="mt-1 block w-full border border-border bg-background p-3" /></label>
        <label className="block text-sm font-bold">Reason (optional)<textarea maxLength={1000} value={reason} disabled={busy} onChange={(event) => setReason(event.target.value)} className="mt-1 block w-full border border-border bg-background p-3" /></label>
        <button disabled={busy} className="bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-40">{busy ? "Submitting…" : "Request advance"}</button>
      </form> : <p className="mt-4 text-sm text-muted-foreground">{summary.requests.some((request) => request.salary_month === summary.month) ? "Your request for this month is recorded below." : summary.maximum <= 0 ? "A fixed monthly salary must be set before requesting an advance." : "Requests are available from the 15th through the last day of each month."}</p>}
      <div className="mt-4 space-y-3">{summary.requests.map((request) => <article key={request.id} className="border border-border bg-background p-3 text-sm">
        <div className="flex flex-wrap justify-between gap-2"><strong>{formatMoney(request.amount, request.currency)}</strong><span className="font-bold capitalize">{request.status}</span></div>
        <p className="mt-1 text-xs text-muted-foreground">Salary month: {request.salary_month.slice(0, 7)} · Requested {formatDate(request.requested_at.slice(0, 10))}</p>
        {request.reason && <p className="mt-2 break-words">{request.reason}</p>}
        {request.review_note && <p className="mt-2 break-words">Admin: {request.review_note}</p>}
        {request.paid_at && <p className="mt-2 text-xs font-bold text-green-700">Paid {formatDate(request.paid_at.slice(0, 10))} · deducted from this salary month</p>}
      </article>)}</div>
      <button disabled={loading || busy} onClick={() => setReload((value) => value + 1)} className="mt-4 text-xs font-bold underline disabled:opacity-40">Refresh advance status</button>
    </>}
  </section>;
}

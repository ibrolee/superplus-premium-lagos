import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatDate, formatMoney, lagosToday } from "@/lib/pt-payroll";

type Cycle = { membership_id: string; member_id: string; member_name: string; plan_name: string; start_date: string; source: "coach" | "gym" | null; assigned_to_ifeanyi: boolean | null; is_pt: boolean; revenue: number | null; pt_fee: number | null; commission: number; review_status: string };
type Run = { total: number; breakdown: Cycle[]; status: string; paid_at: string | null };
type Period = { period_start: string; period_end: string; pay_date: string; rows: Cycle[]; run: Run | null };
export type ContractSummary = { total: number; paid: number };
export function IfeanyiContractPayroll({ month, reload, onSummary }: { month: string; reload: number; onSummary: (value: ContractSummary) => void }) {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [sources, setSources] = useState<Record<string, string>>({});
  const [fees, setFees] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(""); onSummary({ total: 0, paid: 0 });
    supabase.rpc("management_get_ifeanyi_payroll", { p_month_start: `${month}-01` }).then(({ data, error }) => {
      if (cancelled) return;
      if (error) { setError(error.message); setPeriods([]); }
      else {
        const values = (data?.periods || []) as Period[];
        setPeriods(values);
        onSummary({ total: values.reduce((sum, period) => sum + period.rows.reduce((amount, row) => amount + Number(row.commission), 0), 0),
          paid: values.filter((period) => period.run?.status === "paid").reduce((sum, period) => sum + Number(period.run?.total || 0), 0) });
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [month, reload, revision, onSummary]);
  async function act(key: string, action: () => PromiseLike<{ error: { message: string } | null }>, confirmation?: string) {
    if (busy || loading || (confirmation && !window.confirm(confirmation))) return;
    setBusy(key); setError(""); setMessage("");
    try {
      const { error } = await action();
      if (error) throw Error(error.message);
      setSources({}); setFees({}); setMessage("Saved. Recorded payments appear in Ifeanyi's payment history."); setRevision((value) => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save commission."); }
    finally { setBusy(""); }
  }
  return <section className="mt-5 rounded-2xl border bg-white p-4 sm:p-6">
    <h2 className="text-xl font-black">Coach Ifeanyi · Contract commissions</h2>
    <p className="mt-2 text-xs leading-5 text-[#647468]">Part-time coach · commission only. Personally sourced PT: 40% of the package. Personally sourced regular membership: 35% on every paid renewal. Gym-assigned PT: 40% of the PT fee. Registration fees are excluded.</p>
    <p className="mt-2 text-xs leading-5 text-[#647468]">Current prices: ₦57,000 PT package → ₦22,800 sourced commission; ₦27,000 monthly membership → ₦9,450; ₦30,000 PT fee → ₦12,000 gym-assigned commission. Calculations use actual recorded payments.</p>
    <label className="mt-4 block text-xs font-bold">Approve client sources
      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search member name to approve a referral" className="mt-2 w-full rounded-xl border p-3 text-sm" />
    </label>
    <p className="mt-2 text-xs text-[#647468]">Source approval carries across this client's renewals. PT clients must also be assigned to Ifeanyi in <a className="font-bold underline" href="/management-personal-training">PT management</a>. Confirm the PT portion for combined gym-generated packages.</p>
    {loading && <p role="status" className="mt-4 text-sm">Loading contract commissions…</p>}
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {message && <p role="status" className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">{message}</p>}
    {!loading && periods.map((period, index) => {
      const paid = period.run?.status === "paid";
      const total = period.rows.reduce((sum, row) => sum + Number(row.commission), 0);
      const dirty = !!period.run && !paid && JSON.stringify(period.run.breakdown) !== JSON.stringify(period.rows);
      const relevant = period.rows.filter((row) => row.source === "coach" || row.assigned_to_ifeanyi);
      const needsReview = relevant.filter((row) => row.review_status !== "Ready" && row.review_status !== "Previously commissioned");
      const visible = period.rows.filter((row) => row.commission > 0 || (!paid && (row.source === "coach" || row.assigned_to_ifeanyi || (search.trim().length >= 2 && row.member_name.toLowerCase().includes(search.trim().toLowerCase())))));
      return <div key={period.period_start} className="mt-5 rounded-xl border p-4">
        <h3 className="text-sm font-black">{index === 0 ? "First half" : "Second half"} · {formatDate(period.period_start)} – {formatDate(period.period_end)}</h3>
        <p className="mt-1 text-xs text-[#647468]">Pay date: {formatDate(period.pay_date)}{index === 1 ? " · with salary" : ""}</p>
        <p className="mt-3 text-2xl font-black">{formatMoney(total)}</p>
        {needsReview.length > 0 && !paid && <p className="mt-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">{needsReview.length} client cycles need review and contribute ₦0 until resolved.</p>}
        {paid ? <p className="mt-2 text-xs font-bold text-green-800">Paid · figures locked · recorded in staff history</p> : <div className="mt-3 flex flex-wrap gap-2">
          <button disabled={loading || !!busy} onClick={() => void act(`save-${period.period_start}`, () => supabase.rpc("management_save_ifeanyi_payout", { p_period_start: period.period_start }))} className="rounded-xl border px-4 py-2.5 text-xs font-bold disabled:opacity-40">Save commission payout</button>
          <button disabled={loading || !!busy || !period.run || dirty || total <= 0 || needsReview.length > 0 || lagosToday() < period.pay_date} onClick={() => void act(`paid-${period.period_start}`, () => supabase.rpc("management_mark_ifeanyi_payout_paid", { p_period_start: period.period_start, p_expected_total: total }), `Confirm ${formatMoney(total)} has been paid to Coach Ifeanyi for this period? This locks its figures and updates his payment history.`)} className="rounded-xl bg-[#193b2a] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40">{lagosToday() < period.pay_date ? `Due ${formatDate(period.pay_date)}` : !period.run || dirty ? "Save payout first" : "Mark commission paid"}</button>
        </div>}
        {dirty && <p className="mt-2 text-xs text-amber-900">Calculation changed. Save the updated payout.</p>}
        <div className="mt-4 space-y-3">{visible.map((row) => {
          const source = sources[row.membership_id] ?? row.source ?? "";
          const fee = fees[row.membership_id] ?? (row.pt_fee === null ? "" : String(row.pt_fee));
          const reviewFee = row.is_pt && source === "gym" && !row.plan_name.toLowerCase().startsWith("personal training only");
          const invalidFee = reviewFee && (!fee.trim() || !Number.isFinite(Number(fee)) || Number(fee) < 0 || Number(fee) > Number(row.revenue || 0));
          return <article key={row.membership_id} className="rounded-xl bg-[#f8faf6] p-3">
            <div className="flex flex-wrap justify-between gap-2"><div><h4 className="text-sm font-bold">{row.member_name}</h4><p className="mt-1 text-xs text-[#647468]">{row.plan_name} · {formatDate(row.start_date)}</p></div><strong className="text-sm">{formatMoney(Number(row.commission))}</strong></div>
            <p className="mt-2 text-xs">Membership payment: {row.revenue === null ? "No linked payment" : formatMoney(Number(row.revenue))} · {row.is_pt && row.source === "gym" ? `PT fee: ${row.pt_fee === null ? "confirm below" : formatMoney(Number(row.pt_fee))}` : row.source === "coach" ? row.is_pt ? "40% package share" : "35% referral share · each renewal" : "Source unapproved"}</p>
            {!paid && <>
              <p className="mt-2 text-xs font-bold text-[#647468]">{row.review_status}</p>
              <label className="mt-3 block text-xs font-bold">Client source<select value={source} disabled={!!busy} onChange={(event) => setSources((values) => ({ ...values, [row.membership_id]: event.target.value }))} className="mt-1 block w-full rounded-lg border bg-white p-2.5 text-sm"><option value="">Select source</option><option value="coach">Personally sourced by Ifeanyi</option><option value="gym">Gym-generated client</option></select></label>
              {reviewFee && <label className="mt-3 block text-xs font-bold">PT fee within this payment (₦)<input type="number" min="0" max={Number(row.revenue || 0)} step="0.01" value={fee} placeholder="Current standard PT fee: 30000" disabled={!!busy} onChange={(event) => setFees((values) => ({ ...values, [row.membership_id]: event.target.value }))} className="mt-1 w-full rounded-lg border bg-white p-2.5 text-sm" /></label>}
              <button disabled={!!busy || !source || invalidFee} onClick={() => void act(row.membership_id, () => supabase.rpc("management_review_ifeanyi_cycle", { p_membership_id: row.membership_id, p_source: source, p_pt_fee: reviewFee ? Number(fee) : null }))} className="mt-3 text-xs font-bold underline disabled:opacity-40">Approve source{reviewFee ? " and PT fee" : ""}</button>
            </>}
          </article>;
        })}</div>
        {visible.length === 0 && <p className="mt-3 text-xs text-[#647468]">No qualifying client cycles. Search a member above to approve a personally sourced client for this period.</p>}
      </div>;
    })}
  </section>;
}

import { useState } from "react";
import type { SalaryAdvance } from "@/components/StaffSalaryAdvance";
import { formatDate } from "@/lib/pt-payroll";
const formatMoney = (value: number, currency = "NGN") => new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
export function SalaryAdvanceRequests({ requests, staff, busy, onAction }: { requests: SalaryAdvance[]; staff: { id: string; full_name: string }[]; busy: boolean; onAction: (request: SalaryAdvance, action: string, note: string) => void }) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  return <section className="mt-5 rounded-2xl border bg-white p-4 sm:p-6">
    <h2 className="text-xl font-black">Salary advance requests</h2>
    <p className="mt-2 text-xs text-[#647468]">Requests are open from the 15th through the last day of each month (Nigerian time), up to 40% of base salary. Approval reserves the request; only marking it paid deducts it from salary. Mark paid after making the actual transfer.</p>
    {requests.length === 0 && <p className="mt-4 text-sm text-[#647468]">No advance requests for this salary month.</p>}
    <div className="mt-4 space-y-3">{requests.map((request) => <article key={request.id} className="rounded-xl border bg-[#f8faf6] p-4">
      <div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-bold">{staff.find((person) => person.id === request.staff_profile_id)?.full_name || "Staff"}</h3><p className="mt-1 text-xs text-[#647468]">Requested {formatDate(request.requested_at.slice(0, 10))} · salary {formatMoney(request.salary_snapshot, request.currency)}</p></div><div><strong>{formatMoney(request.amount, request.currency)}</strong><p className="mt-1 text-xs font-bold capitalize">{request.status}</p></div></div>
      {request.reason && <p className="mt-3 break-words text-sm">{request.reason}</p>}
      {request.review_note && <p className="mt-2 break-words text-xs">Admin note: {request.review_note}</p>}
      {request.paid_at && <p className="mt-2 text-xs font-bold text-green-800">Paid {formatDate(request.paid_at.slice(0, 10))} · salary balance reduced automatically</p>}
      {["pending", "approved"].includes(request.status) && <div className="mt-3 space-y-3">
        <label className="block text-xs font-bold">Review note (optional)<textarea maxLength={1000} value={notes[request.id] || ""} disabled={busy} onChange={(event) => setNotes((values) => ({ ...values, [request.id]: event.target.value }))} className="mt-1 block w-full rounded-xl border bg-white p-3 text-sm" /></label>
        <div className="flex flex-wrap gap-2">
          {request.status === "pending" ? <button disabled={busy} onClick={() => onAction(request, "approved", notes[request.id] || "")} className="rounded-xl bg-[#193b2a] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40">Approve</button> : <button disabled={busy} onClick={() => onAction(request, "paid", "")} className="rounded-xl bg-[#193b2a] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40">Mark advance paid</button>}
          <button disabled={busy} onClick={() => onAction(request, "rejected", notes[request.id] || "")} className="rounded-xl border bg-white px-4 py-2.5 text-xs font-bold text-red-800 disabled:opacity-40">Reject</button>
        </div>
      </div>}
    </article>)}</div>
  </section>;
}

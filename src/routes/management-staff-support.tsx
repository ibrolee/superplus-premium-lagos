import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminWorkspaceShell } from "@/components/admin/AdminWorkspaceShell";
import { supportDate, supportStatus, type StaffSupportRequest } from "@/components/StaffSupportRequests";
import { supabase } from "@/lib/supabase";
export const Route = createFileRoute("/management-staff-support")({ component: StaffSupport });
type Row = StaffSupportRequest & { staff_profiles: { full_name: string; position: string | null } | null };
function ReviewCard({ row, busy, onSave }: { row: Row; busy: boolean; onSave: (id: string, status: string, response: string) => void }) {
  const [status, setStatus] = useState(row.status);
  const [response, setResponse] = useState(row.admin_response);
  useEffect(() => { setStatus(row.status); setResponse(row.admin_response); }, [row.status, row.admin_response]);
  return <article className="rounded-2xl border bg-white p-4 sm:p-5">
    <div className="flex flex-wrap justify-between gap-2"><div><h2 className="break-words font-bold">{row.subject}</h2><p className="mt-1 text-xs text-[#647468]">{row.staff_profiles?.full_name || "Staff"} · {row.staff_profiles?.position || "Staff"}</p></div><span className="text-xs font-bold">{supportStatus(row.status)}</span></div>
    <p className="mt-2 text-xs capitalize text-[#647468]">{row.submission_type} · {supportDate(row.submitted_at)}</p>
    <p className="mt-4 whitespace-pre-wrap break-words text-sm">{row.details}</p>
    <form onSubmit={(event) => { event.preventDefault(); onSave(row.id, status, response); }} className="mt-5 space-y-3">
      <label className="block text-xs font-bold">Status<select value={status} disabled={busy} onChange={(event) => setStatus(event.target.value as Row["status"])} className="mt-1 block w-full rounded-xl border p-3 text-sm"><option value="open">Submitted</option><option value="in_review">In review</option><option value="resolved">Resolved</option></select></label>
      <label className="block text-xs font-bold">Response to staff<textarea rows={3} maxLength={5000} required={status === "resolved"} value={response} disabled={busy} onChange={(event) => setResponse(event.target.value)} className="mt-1 block w-full rounded-xl border p-3 text-sm" /></label>
      <button disabled={busy || (status === "resolved" && !response.trim())} className="rounded-xl bg-[#193b2a] px-4 py-3 text-xs font-bold text-white disabled:opacity-40">Save review</button>
    </form>
  </article>;
}
function StaffSupport() {
  const [rows, setRows] = useState<Row[]>([]);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);
  const [filter, setFilter] = useState("all");
  const [type, setType] = useState("all");
  const [search, setSearch] = useState("");
  useEffect(() => {
    let cancelled = false; setLoading(true); setError("");
    async function load() {
      try {
        const { data: auth, error } = await supabase.auth.getUser();
        if (error || !auth.user) throw Error("Sign in through the Staff Portal first.");
        const { data: account, error: accountError } = await supabase.from("staff_users").select("role,active").eq("auth_user_id", auth.user.id).maybeSingle();
        if (accountError) throw Error(accountError.message);
        if (!account?.active || !["admin", "owner"].includes(account.role)) throw Error("Only admin and owner accounts can review staff requests and complaints.");
        const result: Row[] = [];
        for (let offset = 0; ; offset += 500) {
          const { data, error } = await supabase.from("staff_support_requests").select("id,staff_profile_id,submission_type,subject,details,status,admin_response,submitted_at,updated_at,staff_profiles(full_name,position)").order("submitted_at", { ascending: false }).order("id").range(offset, offset + 499);
          if (error) throw Error(error.message);
          result.push(...(data || []) as unknown as Row[]);
          if ((data || []).length < 500) break;
        }
        if (!cancelled) { setRows(result); setAuthorized(true); }
      } catch (cause) { if (!cancelled) { setAuthorized(false); setError(cause instanceof Error ? cause.message : "Unable to load messages."); } }
      finally { if (!cancelled) setLoading(false); }
    }
    void load(); return () => { cancelled = true; };
  }, [reload]);
  async function save(id: string, status: string, response: string) {
    if (busy) return; setBusy(true); setError(""); setMessage("");
    try {
      const { error } = await supabase.rpc("review_staff_support_request", { p_request_id: id, p_status: status, p_response: response });
      if (error) throw Error(error.message);
      setMessage("Saved. The staff member can see the updated status and response."); setReload((value) => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save review."); }
    finally { setBusy(false); }
  }
  const filtered = rows.filter((row) => (filter === "all" || row.status === filter) && (type === "all" || row.submission_type === type) && `${row.subject} ${row.details} ${row.staff_profiles?.full_name || ""}`.toLowerCase().includes(search.toLowerCase().trim()));
  return <AdminWorkspaceShell title="Staff requests & complaints" subtitle="Private staff messages, review status and responses." active="/management-staff-support">
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {message && <p role="status" className="mt-4 rounded-xl bg-green-50 p-4 text-sm text-green-800">{message}</p>}
    {loading && <p role="status" className="mt-4 text-sm">Loading staff messages…</p>}
    {authorized && <>
      <div className="mt-4 grid gap-3 sm:grid-cols-3"><label className="text-xs font-bold">Status<select value={filter} onChange={(event) => setFilter(event.target.value)} className="mt-1 block w-full rounded-xl border bg-white p-3 text-sm"><option value="all">All statuses</option><option value="open">Submitted</option><option value="in_review">In review</option><option value="resolved">Resolved</option></select></label><label className="text-xs font-bold">Type<select value={type} onChange={(event) => setType(event.target.value)} className="mt-1 block w-full rounded-xl border bg-white p-3 text-sm"><option value="all">All messages</option><option value="request">Requests</option><option value="complaint">Complaints</option></select></label><label className="text-xs font-bold">Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Staff name or message" className="mt-1 block w-full rounded-xl border bg-white p-3 text-sm" /></label></div>
      <button disabled={loading || busy} onClick={() => setReload((value) => value + 1)} className="mt-4 text-xs font-bold underline disabled:opacity-40">Refresh messages</button>
      <p className="mt-3 text-xs text-[#647468]">{rows.filter((row) => row.status !== "resolved").length} outstanding · {filtered.length} shown. Staff see their own messages and responses only.</p>
      <div className="mt-5 space-y-4">{filtered.map((row) => <ReviewCard key={row.id} row={row} busy={busy || loading} onSave={(id, status, response) => void save(id, status, response)} />)}</div>
      {!loading && filtered.length === 0 && <p className="mt-5 text-sm text-[#647468]">No matching staff requests or complaints.</p>}
    </>}
  </AdminWorkspaceShell>;
}

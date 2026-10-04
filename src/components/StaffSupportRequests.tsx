import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
export type StaffSupportRequest = { id: string; staff_profile_id: string; submission_type: "request" | "complaint"; subject: string; details: string; status: "open" | "in_review" | "resolved"; admin_response: string; submitted_at: string; updated_at: string };
export const supportStatus = (status: string) => ({ open: "Submitted", in_review: "In review", resolved: "Resolved" })[status] || status;
export const supportDate = (value: string) => new Intl.DateTimeFormat("en-NG", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
export function StaffSupportRequests({ staffProfileId, readOnly = false }: { staffProfileId: string; readOnly?: boolean }) {
  const [rows, setRows] = useState<StaffSupportRequest[]>([]);
  const [type, setType] = useState("request");
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const submissionId = useRef<string | null>(null);
  const load = useCallback(async () => {
    const result: StaffSupportRequest[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from("staff_support_requests").select("id,staff_profile_id,submission_type,subject,details,status,admin_response,submitted_at,updated_at").eq("staff_profile_id", staffProfileId).order("submitted_at", { ascending: false }).order("id").range(offset, offset + 499);
      if (error) throw Error(error.message);
      result.push(...(data || []) as StaffSupportRequest[]);
      if ((data || []).length < 500) return result;
    }
  }, [staffProfileId]);
  useEffect(() => {
    let cancelled = false; setLoading(true); setError("");
    void load().then((rows) => { if (!cancelled) setRows(rows); }).catch((cause: Error) => { if (!cancelled) setError(cause.message); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [load, reload]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (readOnly || busy) return;
    setBusy(true); setError(""); setMessage("");
    submissionId.current ||= crypto.randomUUID();
    try {
      const { error } = await supabase.rpc("submit_staff_support_request", { p_submission_id: submissionId.current, p_type: type, p_subject: subject, p_details: details });
      if (error) throw Error(error.message);
      submissionId.current = null; setSubject(""); setDetails(""); setMessage("Submitted. Admin can now review your message."); setReload((value) => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to submit your message."); }
    finally { setBusy(false); }
  }
  return <div className="p-4 sm:p-6">
    <h2 className="font-display text-2xl font-bold uppercase">Requests & complaints</h2>
    <p className="mt-2 text-sm text-muted-foreground">Send a request or report a concern. Visible only to you and admin/owner accounts. This is not anonymous.</p>
    {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="mt-4 text-sm text-green-700">{message}</p>}
    {readOnly ? <p className="mt-4 text-sm text-muted-foreground">Admin preview is read-only.</p> : <form onSubmit={(event) => void submit(event)} className="mt-5 space-y-4">
      <label className="block text-sm font-bold">Message type<select value={type} disabled={busy} onChange={(event) => { setType(event.target.value); submissionId.current = null; }} className="mt-1 block w-full border border-border bg-background p-3"><option value="request">Request</option><option value="complaint">Complaint</option></select></label>
      <label className="block text-sm font-bold">Subject<input required maxLength={150} value={subject} disabled={busy} onChange={(event) => { setSubject(event.target.value); submissionId.current = null; }} className="mt-1 block w-full border border-border bg-background p-3" /></label>
      <label className="block text-sm font-bold">Details<textarea required rows={5} maxLength={5000} value={details} disabled={busy} onChange={(event) => { setDetails(event.target.value); submissionId.current = null; }} className="mt-1 block w-full border border-border bg-background p-3" /></label>
      <Button disabled={busy || !subject.trim() || !details.trim()} type="submit">{busy ? "Submitting…" : "Submit message"}</Button>
    </form>}
    <div className="mt-7 flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold">My submissions</h3><Button variant="outline" disabled={loading || busy} onClick={() => setReload((value) => value + 1)}>Refresh</Button></div>
    {loading ? <p role="status" className="mt-3 text-sm">Loading submissions…</p> : rows.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No requests or complaints submitted yet.</p> : <div className="mt-4 space-y-3">{rows.map((row) => <article key={row.id} className="border border-border p-4">
      <div className="flex flex-wrap justify-between gap-2"><h4 className="break-words font-bold">{row.subject}</h4><span className="text-xs font-bold">{supportStatus(row.status)}</span></div>
      <p className="mt-1 text-xs capitalize text-muted-foreground">{row.submission_type} · {supportDate(row.submitted_at)}</p>
      <p className="mt-3 whitespace-pre-wrap break-words text-sm">{row.details}</p>
      {row.admin_response && <div className="mt-4 border-l-2 border-primary bg-primary/5 p-3"><p className="text-xs font-bold">Admin response · {supportDate(row.updated_at)}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm">{row.admin_response}</p></div>}
    </article>)}</div>}
  </div>;
}

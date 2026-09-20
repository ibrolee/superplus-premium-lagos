import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/staff-missed-scans")({ component: MissedScansPage });
type Request = {
  id: string;
  staff_profile_id: string;
  work_date: string;
  kind: string;
  approximate_clock_in: string | null;
  approximate_clock_out: string | null;
  reason: string;
  status: string;
  created_at: string;
  review_note: string | null;
};
type Profile = { id: string; full_name: string; staff_id: string };
const lagosToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export default function MissedScansPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [manager, setManager] = useState(false);
  const [requests, setRequests] = useState<Request[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [date, setDate] = useState(lagosToday());
  const [kind, setKind] = useState("clock_in");
  const [clockIn, setClockIn] = useState("");
  const [clockOut, setClockOut] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  async function refresh(isManager: boolean, ownProfile: Profile | null) {
    const query = supabase
      .from("staff_missed_scan_requests")
      .select(
        "id,staff_profile_id,work_date,kind,approximate_clock_in,approximate_clock_out,reason,status,created_at,review_note",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    const { data, error } = await (isManager
      ? query
      : query.eq("staff_profile_id", ownProfile?.id ?? "00000000-0000-0000-0000-000000000000"));
    if (error) throw error;
    setRequests((data ?? []) as Request[]);
  }
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();
        if (error) throw error;
        if (!user) {
          setMessage("Sign in through your staff account first.");
          return;
        }
        const [{ data: own, error: ownError }, { data: admin, error: adminError }] =
          await Promise.all([
            supabase
              .from("staff_profiles")
              .select("id,full_name,staff_id")
              .eq("auth_user_id", user.id)
              .eq("status", "approved")
              .maybeSingle(),
            supabase
              .from("staff_users")
              .select("role,active")
              .eq("auth_user_id", user.id)
              .maybeSingle(),
          ]);
        if (ownError || adminError) throw ownError ?? adminError;
        const isManager = admin?.active === true && admin.role === "admin";
        if (!own && !isManager) {
          setMessage("An approved staff profile or active administrator account is required.");
          return;
        }
        if (!mounted) return;
        setUserId(user.id);
        setProfile(own as Profile | null);
        setManager(isManager);
        if (isManager) {
          const { data: people, error: peopleError } = await supabase
            .from("staff_profiles")
            .select("id,full_name,staff_id")
            .order("full_name")
            .limit(500);
          if (peopleError) throw peopleError;
          if (mounted) setProfiles((people ?? []) as Profile[]);
        }
        await refresh(isManager, own as Profile | null);
      } catch (error) {
        if (mounted)
          setMessage(error instanceof Error ? error.message : "Unable to load requests.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !profile || !userId) return;
    if (reason.trim().length < 10 || reason.trim().length > 1000) {
      setMessage("Provide a reason between 10 and 1,000 characters.");
      return;
    }
    if (
      (kind !== "clock_out" && !clockIn) ||
      (kind !== "clock_in" && !clockOut) ||
      (kind === "both" && clockOut <= clockIn)
    ) {
      setMessage("Enter valid approximate times for the selected scan type.");
      return;
    }
    setBusy(true);
    setMessage("");
    const { error } = await supabase.rpc("submit_staff_missed_scan", {
      p_work_date: date,
      p_kind: kind,
      p_clock_in: kind === "clock_out" ? null : clockIn,
      p_clock_out: kind === "clock_in" ? null : clockOut,
      p_reason: reason.trim(),
    });
    if (error) setMessage(error.message);
    else {
      setMessage(
        "Request submitted for management review. This does not change recorded hours or salary.",
      );
      setReason("");
      setClockIn("");
      setClockOut("");
      try {
        await refresh(manager, profile);
      } catch {
        setMessage("Request saved, but the list could not refresh.");
      }
    }
    setBusy(false);
  }
  async function review(id: string, decision: "approved" | "rejected") {
    if (busy || !manager || !userId) return;
    setBusy(true);
    setMessage("");
    const { error } = await supabase.rpc("review_staff_missed_scan", {
      p_request_id: id,
      p_decision: decision,
      p_note: notes[id]?.trim() || null,
    });
    if (error) setMessage(error.message);
    else {
      setMessage(`Request ${decision}. Original QR scans and salary records were not changed.`);
      try {
        await refresh(manager, profile);
      } catch {
        setMessage("Decision saved, but the list could not refresh.");
      }
    }
    setBusy(false);
  }
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-10 text-foreground">
      <div>
        <Link to="/staff" className="text-sm underline">
          ← Staff dashboard
        </Link>
        <h1 className="mt-3 text-3xl font-bold">Missed QR scan requests</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Requests are reviewed separately. They do not create QR attendance, verify hours or adjust
          salary.
        </p>
      </div>
      {message && (
        <p role="status" className="rounded-lg border p-3 text-sm">
          {message}
        </p>
      )}
      {loading ? (
        <p>Loading…</p>
      ) : !userId ? (
        <p>Please sign in to continue.</p>
      ) : (
        <>
          {profile && (
            <form onSubmit={submit} className="space-y-4 rounded-xl border p-5">
              <h2 className="text-xl font-semibold">Report a missed scan</h2>
              <p className="text-sm text-muted-foreground">
                Signed in as {profile.full_name}. Provide the date and approximate time; management
                will review your explanation.
              </p>
              <label className="block text-sm">
                Work date
                <input
                  required
                  type="date"
                  value={date}
                  max={lagosToday()}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 block w-full rounded border bg-background p-2"
                />
              </label>
              <label className="block text-sm">
                Missed scan
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                  className="mt-1 block w-full rounded border bg-background p-2"
                >
                  <option value="clock_in">Clock-in</option>
                  <option value="clock_out">Clock-out</option>
                  <option value="both">Both</option>
                </select>
              </label>
              {kind !== "clock_out" && (
                <label className="block text-sm">
                  Approximate clock-in
                  <input
                    required
                    type="time"
                    value={clockIn}
                    onChange={(e) => setClockIn(e.target.value)}
                    className="mt-1 block w-full rounded border bg-background p-2"
                  />
                </label>
              )}
              {kind !== "clock_in" && (
                <label className="block text-sm">
                  Approximate clock-out
                  <input
                    required
                    type="time"
                    value={clockOut}
                    onChange={(e) => setClockOut(e.target.value)}
                    className="mt-1 block w-full rounded border bg-background p-2"
                  />
                </label>
              )}
              <label className="block text-sm">
                What happened?
                <textarea
                  required
                  minLength={10}
                  maxLength={1000}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-1 block min-h-24 w-full rounded border bg-background p-2"
                  placeholder="Explain why you could not scan…"
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-primary px-5 py-2 text-primary-foreground disabled:opacity-50"
              >
                {busy ? "Saving…" : "Submit for review"}
              </button>
            </form>
          )}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">
              {manager ? "Management review queue" : "My requests"}
            </h2>
            {requests.length === 500 && (
              <p className="text-sm text-amber-700">
                Showing the 500 most recent requests; older records are not included.
              </p>
            )}
            {requests.length === 0 && (
              <p className="text-sm text-muted-foreground">No requests found.</p>
            )}
            {requests.map((item) => (
              <article key={item.id} className="space-y-2 rounded-xl border p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <strong>
                    {manager
                      ? (profiles.find((p) => p.id === item.staff_profile_id)?.full_name ??
                          "Staff member") + " · "
                      : ""}
                    {item.work_date} · {item.kind.replace("_", "-")}
                  </strong>
                  <span className="text-sm font-semibold capitalize">{item.status}</span>
                </div>
                <p className="text-sm">
                  Approximate time: {item.approximate_clock_in ?? "—"} /{" "}
                  {item.approximate_clock_out ?? "—"}
                </p>
                <p className="whitespace-pre-wrap text-sm">{item.reason}</p>
                {item.review_note && <p className="text-sm">Management note: {item.review_note}</p>}
                {manager && item.status === "pending" && (
                  <div className="space-y-2">
                    <label className="block text-sm">
                      Review note (optional)
                      <textarea
                        maxLength={1000}
                        value={notes[item.id] ?? ""}
                        onChange={(e) =>
                          setNotes((previous) => ({ ...previous, [item.id]: e.target.value }))
                        }
                        className="mt-1 block min-h-16 w-full rounded border bg-background p-2"
                      />
                    </label>
                    <div className="flex gap-2">
                      <button
                        disabled={busy}
                        onClick={() => review(item.id, "approved")}
                        className="rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
                      >
                        Approve request
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => review(item.id, "rejected")}
                        className="rounded border px-4 py-2 disabled:opacity-50"
                      >
                        Reject request
                      </button>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </section>
        </>
      )}
    </main>
  );
}

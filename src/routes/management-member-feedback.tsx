import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Lightbulb,
  MessageSquareWarning,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { AdminWorkspaceShell } from "@/components/admin/AdminWorkspaceShell";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/management-member-feedback")({
  component: ManagementMemberFeedback,
});

type FeedbackRow = {
  id: string;
  member_id: string;
  membership_id: string;
  submission_type: "suggestion" | "issue";
  category: string;
  subject: string | null;
  details: string;
  status: "pending" | "reviewed" | "resolved";
  management_note: string | null;
  submitted_at: string;
  updated_at: string;
  member: {
    full_name: string | null;
    phone: string | null;
    email: string | null;
  } | null;
};

type ExperienceRow = {
  id: string;
  member_id: string;
  feedback_kind: "app" | "gym";
  overall_rating: number;
  ratings: Record<string, number>;
  comments: string | null;
  points_awarded: number;
  submitted_at: string;
  updated_at: string;
  member: {
    full_name: string | null;
    phone: string | null;
    email: string | null;
  } | null;
};

const categoryLabel = (value: string) =>
  ({
    coach: "Coach",
    staff: "Staff member",
    equipment: "Equipment",
    facilities: "Facilities",
    cleanliness: "Cleanliness",
    payment: "Payment / billing",
    safety: "Safety",
    service: "Gym service / experience",
    other: "Other",
  })[value] || value.replaceAll("_", " ");

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("en-NG", {
    timeZone: "Africa/Lagos",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

function ManagementMemberFeedback() {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [experienceRows, setExperienceRows] = useState<ExperienceRow[]>([]);
  const [status, setStatus] = useState<"pending" | "reviewed" | "resolved" | "all">("pending");
  const [type, setType] = useState<"all" | "suggestion" | "issue">("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    const [submissionResult, experienceResult] = await Promise.all([
      supabase
        .from("member_feedback_submissions")
        .select(
          "id,member_id,membership_id,submission_type,category,subject,details,status,management_note,submitted_at,updated_at,member:members(full_name,phone,email)",
        )
        .order("submitted_at", { ascending: false })
        .limit(500),
      supabase
        .from("member_experience_feedback")
        .select(
          "id,member_id,feedback_kind,overall_rating,ratings,comments,points_awarded,submitted_at,updated_at,member:members(full_name,phone,email)",
        )
        .order("submitted_at", { ascending: false })
        .limit(500),
    ]);

    const queryError = submissionResult.error || experienceResult.error;
    if (queryError) {
      setRows([]);
      setExperienceRows([]);
      setError(queryError.message);
    } else {
      setRows((submissionResult.data ?? []) as unknown as FeedbackRow[]);
      setExperienceRows((experienceResult.data ?? []) as unknown as ExperienceRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(
    () => ({
      pending: rows.filter((row) => row.status === "pending").length,
      suggestions: rows.filter((row) => row.submission_type === "suggestion").length,
      issues: rows.filter((row) => row.submission_type === "issue").length,
      resolved: rows.filter((row) => row.status === "resolved").length,
    }),
    [rows],
  );

  const experienceSummary = useMemo(() => {
    const average = (kind: "app" | "gym") => {
      const values = experienceRows
        .filter((row) => row.feedback_kind === kind)
        .map((row) => Number(row.overall_rating || 0))
        .filter((value) => value > 0);
      return values.length
        ? (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)
        : "—";
    };

    return {
      appCount: experienceRows.filter((row) => row.feedback_kind === "app").length,
      gymCount: experienceRows.filter((row) => row.feedback_kind === "gym").length,
      appAverage: average("app"),
      gymAverage: average("gym"),
    };
  }, [experienceRows]);

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (status !== "all" && row.status !== status) return false;
      if (type !== "all" && row.submission_type !== type) return false;
      if (!needle) return true;
      const haystack = [
        row.member?.full_name,
        row.member?.phone,
        row.member?.email,
        row.subject,
        row.details,
        categoryLabel(row.category),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [query, rows, status, type]);

  async function updateStatus(row: FeedbackRow, nextStatus: "reviewed" | "resolved") {
    const note = window.prompt(
      nextStatus === "resolved"
        ? "Optional management note before resolving this submission:"
        : "Optional management note:",
      row.management_note ?? "",
    );
    if (note === null) return;

    setSavingId(row.id);
    setError("");
    setMessage("");

    const { error: updateError } = await supabase
      .from("member_feedback_submissions")
      .update({
        status: nextStatus,
        management_note: note.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (updateError) {
      setError(updateError.message);
    } else {
      setMessage(
        nextStatus === "resolved"
          ? "Member submission marked resolved."
          : "Member submission marked reviewed.",
      );
      await load();
    }
    setSavingId(null);
  }

  return (
    <AdminWorkspaceShell
      title="Member Reports & Suggestions"
      subtitle="Review confidential member suggestions and reports about coaches, staff, equipment, facilities, payments, safety and the gym experience."
      active="/management-member-feedback"
    >
      <section className="mt-7 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: "Pending", value: counts.pending, icon: AlertCircle },
          { label: "Suggestions", value: counts.suggestions, icon: Lightbulb },
          { label: "Issues", value: counts.issues, icon: MessageSquareWarning },
          { label: "Resolved", value: counts.resolved, icon: CheckCircle2 },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-[#dce7d8] bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-[#68796d]">{label}</p>
              <Icon size={17} className="text-[#2f7746]" />
            </div>
            <p className="mt-3 text-3xl font-black">{value}</p>
          </div>
        ))}
      </section>

      <section className="mt-5 rounded-[24px] border border-[#d8e5d4] bg-white p-4 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-[#68796d]">Private experience ratings</p>
            <h2 className="mt-1 text-xl font-black">App & gym feedback</h2>
            <p className="mt-1 text-xs leading-5 text-[#657568]">
              These are private Super Plus ratings. The member receives the same one-time 10 SP bonus whether the rating is high or low.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#d8e2d5] px-4 py-2.5 text-xs font-bold"
          >
            <RefreshCw size={15} /> Refresh
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#dce7d8] bg-[#f8faf6] p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-[#68796d]">App feedback</p>
            <p className="mt-2 text-3xl font-black">{experienceSummary.appAverage} / 5</p>
            <p className="mt-1 text-xs text-[#657568]">{experienceSummary.appCount} submission{experienceSummary.appCount === 1 ? "" : "s"}</p>
          </div>
          <div className="rounded-2xl border border-[#dce7d8] bg-[#f8faf6] p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-[#68796d]">Gym experience</p>
            <p className="mt-2 text-3xl font-black">{experienceSummary.gymAverage} / 5</p>
            <p className="mt-1 text-xs text-[#657568]">{experienceSummary.gymCount} submission{experienceSummary.gymCount === 1 ? "" : "s"}</p>
          </div>
        </div>

        {!!experienceRows.length && (
          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {experienceRows.slice(0, 20).map((row) => (
              <article key={row.id} className="rounded-2xl border border-[#e4ebe1] bg-[#fbfcfa] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase text-[#38673e]">
                      {row.feedback_kind === "app" ? "App Feedback" : "Gym Experience"}
                    </p>
                    <p className="mt-1 font-black">{row.member?.full_name || "Member"}</p>
                    <p className="mt-1 text-xs text-[#68766d]">
                      {row.member?.phone || row.member?.email || "No contact"}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#fff2d6] px-3 py-1.5 text-xs font-black text-[#8a5b00]">
                    ★ {row.overall_rating}/5
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {Object.entries(row.ratings || {}).map(([key, value]) => (
                    <span key={key} className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold capitalize text-[#536359]">
                      {key.replaceAll("_", " ")}: {value}/5
                    </span>
                  ))}
                </div>
                {row.comments && (
                  <p className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm leading-6 text-[#46564c]">
                    {row.comments}
                  </p>
                )}
                <p className="mt-3 text-[10px] text-[#7a827d]">
                  Submitted {formatDateTime(row.submitted_at)} · {row.points_awarded} SP bonus
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mt-5 rounded-[24px] border border-[#d8e5d4] bg-white p-4 sm:p-6">
        <div className="flex items-start gap-3 rounded-2xl border border-[#d7e5d4] bg-[#f3f8f0] p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#193b2a] text-white">
            <ShieldCheck size={18} />
          </span>
          <div>
            <p className="text-sm font-black text-[#244f32]">Management-only confidential queue</p>
            <p className="mt-1 text-xs leading-5 text-[#607366]">
              Members are told that only authorised Super Plus management accounts can access these submissions.
              Coaches, other staff and reception cannot read them through their dashboards.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            {(["pending", "reviewed", "resolved", "all"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setStatus(item)}
                className={
                  "rounded-full px-4 py-2 text-xs font-black capitalize " +
                  (status === item
                    ? "bg-[#193b2a] text-white"
                    : "border border-[#d8e2d5] bg-[#f8faf6] text-[#395844]")
                }
              >
                {item}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex gap-2">
              {(["all", "suggestion", "issue"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setType(item)}
                  className={
                    "rounded-full px-3 py-2 text-[11px] font-black capitalize " +
                    (type === item
                      ? "bg-[#e5f2df] text-[#245c36]"
                      : "border border-[#d8e2d5] bg-white text-[#627068]")
                  }
                >
                  {item === "all" ? "All types" : item}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#d8e2d5] px-4 py-2.5 text-xs font-bold"
            >
              <RefreshCw size={15} /> Refresh
            </button>
          </div>
        </div>

        <label className="relative mt-4 block">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#7b887e]"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search member, category, subject or details"
            className="w-full rounded-xl border border-[#d8e2d5] bg-[#fbfcfa] py-3 pl-10 pr-4 text-sm outline-none"
          />
        </label>

        {!!error && (
          <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </p>
        )}
        {!!message && (
          <p role="status" className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            {message}
          </p>
        )}

        {loading ? (
          <p role="status" className="mt-5 rounded-xl bg-[#f4f6f1] p-5 text-sm">
            Loading confidential member feedback…
          </p>
        ) : !filteredRows.length ? (
          <p className="mt-5 rounded-xl border border-dashed border-[#d8e2d5] p-8 text-center text-sm text-[#647468]">
            No matching member submissions.
          </p>
        ) : (
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {filteredRows.map((row) => (
              <article
                key={row.id}
                className={
                  "rounded-2xl border p-5 " +
                  (row.submission_type === "issue"
                    ? "border-[#ecd8d4] bg-[#fffaf8]"
                    : "border-[#dce8d9] bg-[#f8faf6]")
                }
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={
                          "rounded-full px-2.5 py-1 text-[10px] font-black uppercase " +
                          (row.submission_type === "issue"
                            ? "bg-red-100 text-red-800"
                            : "bg-green-100 text-green-800")
                        }
                      >
                        {row.submission_type}
                      </span>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase text-[#526357]">
                        {categoryLabel(row.category)}
                      </span>
                    </div>
                    <h2 className="mt-3 text-lg font-black">
                      {row.subject || (row.submission_type === "suggestion" ? "Member suggestion" : "Member issue report")}
                    </h2>
                    <p className="mt-1 text-xs text-[#68766d]">
                      Submitted {formatDateTime(row.submitted_at)}
                    </p>
                  </div>
                  <span
                    className={
                      "rounded-full px-3 py-1.5 text-[10px] font-black uppercase " +
                      (row.status === "pending"
                        ? "bg-amber-100 text-amber-800"
                        : row.status === "reviewed"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-green-100 text-green-800")
                    }
                  >
                    {row.status}
                  </span>
                </div>

                <div className="mt-4 rounded-xl bg-white p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-[#7a827d]">Member</p>
                  <p className="mt-1 text-sm font-black">{row.member?.full_name || "Member"}</p>
                  <p className="mt-1 text-xs text-[#68766d]">
                    {row.member?.phone || row.member?.email || "No contact"}
                  </p>
                </div>

                <div className="mt-3 rounded-xl bg-white p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-[#7a827d]">
                    {row.submission_type === "suggestion" ? "Suggestion" : "Issue details"}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#46564c]">{row.details}</p>
                </div>

                {!!row.management_note && (
                  <div className="mt-3 rounded-xl border border-[#d8e2d5] bg-white p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-[#7a827d]">Management note</p>
                    <p className="mt-2 text-sm leading-6 text-[#46564c]">{row.management_note}</p>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {row.status === "pending" && (
                    <button
                      type="button"
                      disabled={savingId === row.id}
                      onClick={() => void updateStatus(row, "reviewed")}
                      className="inline-flex items-center gap-2 rounded-xl border border-[#d8e2d5] bg-white px-4 py-2.5 text-xs font-bold disabled:opacity-50"
                    >
                      <CheckCircle2 size={15} /> Mark reviewed
                    </button>
                  )}
                  {row.status !== "resolved" && (
                    <button
                      type="button"
                      disabled={savingId === row.id}
                      onClick={() => void updateStatus(row, "resolved")}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#193b2a] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                    >
                      <CheckCircle2 size={15} /> Resolve
                    </button>
                  )}
                  <span className="inline-flex items-center gap-2 rounded-xl border border-[#d8e2d5] bg-white px-3 py-2 text-[11px] font-semibold text-[#647468]">
                    <Clock3 size={14} /> {formatDateTime(row.submitted_at)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </AdminWorkspaceShell>
  );
}

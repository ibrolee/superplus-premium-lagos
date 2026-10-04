import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Dumbbell,
  RefreshCw,
  Star,
  UserRound,
  Users,
} from "lucide-react";
import { AdminWorkspaceShell } from "@/components/admin/AdminWorkspaceShell";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/management-personal-training")({
  component: ManagementPersonalTraining,
});

type Trainer = {
  staff_profile_id: string;
  display_name: string;
  active: boolean;
  sort_order: number;
};

type Member = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
};

type PtMembership = {
  id: string;
  member_id: string;
  plan_name: string | null;
  start_date: string;
  end_date: string;
  status: string;
  payment_status: string | null;
  created_at: string;
};

type Assignment = {
  membership_id: string;
  member_id: string;
  trainer_staff_profile_id: string;
  updated_at: string;
};

type Evaluation = {
  membership_id: string;
  member_id: string;
  trainer_staff_profile_id: string;
  overall_rating: number;
  professionalism_rating: number;
  punctuality_rating: number;
  communication_rating: number;
  coaching_quality_rating: number;
  motivation_rating: number;
  program_consistency: boolean;
  comments: string | null;
  continuation_choice: "continue" | "change" | "finish";
  requested_trainer_staff_profile_id: string | null;
  change_reason: string | null;
  management_status: "pending" | "reviewed" | "resolved";
  management_note: string | null;
  submitted_at: string;
};

type View = "current" | "expiring" | "unassigned" | "feedback" | "all";

const DAY = 86400000;
const lagosToday = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const pick = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
};
const addDays = (value: string, days: number) => {
  const date = new Date(value + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value + "T12:00:00Z"));
const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("en-NG", {
    timeZone: "Africa/Lagos",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

function ManagementPersonalTraining() {
  const [memberships, setMemberships] = useState<PtMembership[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [view, setView] = useState<View>("current");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingMembershipId, setSavingMembershipId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    const [membershipResult, trainerResult, assignmentResult, evaluationResult] = await Promise.all([
      supabase
        .from("memberships")
        .select("id,member_id,plan_name,start_date,end_date,status,payment_status,created_at")
        .ilike("plan_name", "Personal Training%")
        .order("end_date", { ascending: false })
        .limit(600),
      supabase
        .from("pt_trainers")
        .select("staff_profile_id,display_name,active,sort_order")
        .order("sort_order", { ascending: true }),
      supabase
        .from("pt_assignments")
        .select("membership_id,member_id,trainer_staff_profile_id,updated_at")
        .order("updated_at", { ascending: false }),
      supabase
        .from("pt_evaluations")
        .select("membership_id,member_id,trainer_staff_profile_id,overall_rating,professionalism_rating,punctuality_rating,communication_rating,coaching_quality_rating,motivation_rating,program_consistency,comments,continuation_choice,requested_trainer_staff_profile_id,change_reason,management_status,management_note,submitted_at")
        .order("submitted_at", { ascending: false }),
    ]);

    const firstError =
      membershipResult.error || trainerResult.error || assignmentResult.error || evaluationResult.error;

    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    const nextMemberships = (membershipResult.data || []) as PtMembership[];
    const memberIds = Array.from(new Set(nextMemberships.map((row) => row.member_id)));
    let nextMembers: Member[] = [];

    if (memberIds.length) {
      const memberResult = await supabase
        .from("members")
        .select("id,full_name,phone,email")
        .in("id", memberIds);
      if (memberResult.error) {
        setError(memberResult.error.message);
        setLoading(false);
        return;
      }
      nextMembers = (memberResult.data || []) as Member[];
    }

    setMemberships(nextMemberships);
    setMembers(nextMembers);
    setTrainers((trainerResult.data || []) as Trainer[]);
    setAssignments((assignmentResult.data || []) as Assignment[]);
    setEvaluations((evaluationResult.data || []) as Evaluation[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const today = lagosToday();
  const memberMap = useMemo(() => new Map(members.map((row) => [row.id, row])), [members]);
  const trainerMap = useMemo(
    () => new Map(trainers.map((row) => [row.staff_profile_id, row])),
    [trainers],
  );
  const assignmentMap = useMemo(
    () => new Map(assignments.map((row) => [row.membership_id, row])),
    [assignments],
  );
  const evaluationMap = useMemo(
    () => new Map(evaluations.map((row) => [row.membership_id, row])),
    [evaluations],
  );

  const isCurrent = (row: PtMembership) =>
    row.status === "active" &&
    row.payment_status === "paid" &&
    row.start_date <= today &&
    row.end_date >= today;

  const currentCount = memberships.filter(isCurrent).length;
  const expiringCount = memberships.filter(
    (row) => isCurrent(row) && row.end_date <= addDays(today, 7),
  ).length;
  const unassignedCount = memberships.filter(
    (row) => isCurrent(row) && !assignmentMap.has(row.id),
  ).length;
  const pendingFeedbackCount = evaluations.filter(
    (row) => row.management_status === "pending",
  ).length;

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return memberships.filter((row) => {
      const member = memberMap.get(row.member_id);
      const assignment = assignmentMap.get(row.id);
      const trainer = assignment ? trainerMap.get(assignment.trainer_staff_profile_id) : null;
      const evaluation = evaluationMap.get(row.id);

      const viewMatch =
        view === "all" ||
        (view === "current" && isCurrent(row)) ||
        (view === "expiring" && isCurrent(row) && row.end_date <= addDays(today, 7)) ||
        (view === "unassigned" && isCurrent(row) && !assignment) ||
        (view === "feedback" && evaluation?.management_status === "pending");

      if (!viewMatch) return false;
      if (!needle) return true;

      return [
        member?.full_name,
        member?.phone,
        member?.email,
        trainer?.display_name,
        row.plan_name,
      ].some((value) => value?.toLowerCase().includes(needle));
    });
  }, [memberships, memberMap, assignmentMap, evaluationMap, trainerMap, query, view, today]);

  const trainerStats = trainers.map((trainer) => {
    const coachEvaluations = evaluations.filter(
      (row) => row.trainer_staff_profile_id === trainer.staff_profile_id,
    );
    const average = coachEvaluations.length
      ? coachEvaluations.reduce((sum, row) => sum + Number(row.overall_rating || 0), 0) /
        coachEvaluations.length
      : 0;
    const continued = coachEvaluations.filter((row) => row.continuation_choice === "continue").length;
    return { trainer, count: coachEvaluations.length, average, continued };
  });

  async function assignCoach(membershipId: string, trainerId: string) {
    setSavingMembershipId(membershipId);
    setError("");
    setMessage("");
    const { error: updateError } = await supabase.rpc("management_set_pt_assignment", {
      p_membership_id: membershipId,
      p_trainer_staff_profile_id: trainerId || null,
    });
    if (updateError) {
      setError(updateError.message);
    } else {
      setMessage(trainerId ? "PT coach assignment updated." : "PT coach assignment cleared.");
      await load();
    }
    setSavingMembershipId(null);
  }

  async function updateEvaluation(evaluation: Evaluation, status: "reviewed" | "resolved") {
    const promptText =
      status === "resolved"
        ? "Optional management note before resolving this feedback:"
        : "Optional management note:";
    const note = window.prompt(promptText, evaluation.management_note || "");
    if (note === null) return;

    setError("");
    setMessage("");
    const { error: updateError } = await supabase.rpc("management_update_pt_evaluation", {
      p_membership_id: evaluation.membership_id,
      p_status: status,
      p_note: note,
    });
    if (updateError) setError(updateError.message);
    else {
      setMessage(status === "resolved" ? "Feedback marked resolved." : "Feedback marked reviewed.");
      await load();
    }
  }

  return (
    <AdminWorkspaceShell
      title="Personal Training"
      subtitle="Assign coaches, monitor PT expiries, review trainer evaluations and handle continuation or change requests."
      active="/management-personal-training"
    >
      <section className="mt-7 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: "Current PT", value: currentCount, icon: Users },
          { label: "Expiring in 7 days", value: expiringCount, icon: CalendarDays },
          { label: "Unassigned", value: unassignedCount, icon: AlertCircle },
          { label: "Feedback to review", value: pendingFeedbackCount, icon: Star },
        ].map(({ label, value, icon: Icon }) => (
          <button
            type="button"
            key={label}
            onClick={() =>
              setView(
                label === "Current PT"
                  ? "current"
                  : label === "Expiring in 7 days"
                    ? "expiring"
                    : label === "Unassigned"
                      ? "unassigned"
                      : "feedback",
              )
            }
            className="rounded-2xl border border-[#dce7d8] bg-white p-4 text-left"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-[#68796d]">{label}</p>
              <Icon size={17} className="text-[#2f7746]" />
            </div>
            <p className="mt-3 text-3xl font-black">{value}</p>
          </button>
        ))}
      </section>

      <section className="mt-5 rounded-[24px] border border-[#e1e8dd] bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#65905c]">
              Trainer performance
            </p>
            <h2 className="mt-1 text-xl font-black">Evaluation overview</h2>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-xl border border-[#d8e2d5] px-4 py-2.5 text-xs font-bold"
          >
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {trainerStats.map(({ trainer, count, average, continued }) => (
            <article key={trainer.staff_profile_id} className="rounded-2xl bg-[#f4f7f1] p-4">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-[#193b2a] text-white">
                  <Dumbbell size={18} />
                </span>
                <div>
                  <h3 className="font-black">{trainer.display_name}</h3>
                  <p className="text-xs text-[#68796d]">{count} evaluation{count === 1 ? "" : "s"}</p>
                </div>
              </div>
              <p className="mt-4 text-2xl font-black">
                {count ? average.toFixed(1) : "—"} <span className="text-sm text-[#9a7b20]">★</span>
              </p>
              <p className="mt-1 text-xs text-[#68796d]">
                {count ? `${continued} chose to continue with this trainer` : "No submitted evaluations yet"}
              </p>
            </article>
          ))}
        </div>
      </section>

      {!!error && (
        <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </p>
      )}
      {!!message && (
        <p role="status" className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          {message}
        </p>
      )}

      <section className="mt-5 rounded-[24px] border border-[#e1e8dd] bg-white p-4 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {(["current", "expiring", "unassigned", "feedback", "all"] as View[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setView(item)}
                className={
                  "rounded-full px-4 py-2 text-xs font-black capitalize " +
                  (view === item
                    ? "bg-[#193b2a] text-white"
                    : "border border-[#d8e2d5] bg-[#f8faf6] text-[#395844]")
                }
              >
                {item === "feedback" ? "Feedback" : item}
              </button>
            ))}
          </div>
          <label className="flex min-w-0 items-center gap-2 rounded-xl border border-[#d8e2d5] bg-[#f8faf6] px-3 lg:w-80">
            <UserRound size={17} />
            <span className="sr-only">Search PT members</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search member or coach"
              className="w-full min-w-0 bg-transparent py-3 text-sm outline-none"
            />
          </label>
        </div>

        {loading && (
          <p role="status" className="mt-6 rounded-xl bg-[#f4f6f1] p-5 text-sm">
            Loading Personal Training records…
          </p>
        )}

        {!loading && !rows.length && (
          <p className="mt-6 rounded-xl border border-dashed border-[#d8e2d5] p-8 text-center text-sm text-[#647468]">
            No PT records match this view.
          </p>
        )}

        {!loading && !!rows.length && (
          <div className="mt-6 space-y-4">
            {rows.map((membership) => {
              const member = memberMap.get(membership.member_id);
              const assignment = assignmentMap.get(membership.id);
              const evaluation = evaluationMap.get(membership.id);
              const assignedTrainer = assignment
                ? trainerMap.get(assignment.trainer_staff_profile_id)
                : null;
              const active = isCurrent(membership);
              const expiring = active && membership.end_date <= addDays(today, 7);

              return (
                <article key={membership.id} className="rounded-2xl border border-[#dce8d9] bg-[#f9fbf7] p-4 sm:p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="break-words text-lg font-black">{member?.full_name || "Unknown member"}</h2>
                        <span
                          className={
                            "rounded-full px-2.5 py-1 text-[10px] font-black uppercase " +
                            (active ? "bg-green-100 text-green-800" : "bg-[#ecefe9] text-[#637168]")
                          }
                        >
                          {active ? "Current" : membership.end_date < today ? "Expired" : "Upcoming"}
                        </span>
                        {expiring && (
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase text-amber-800">
                            Expiring soon
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-[#647468]">
                        {member?.phone || member?.email || "No contact"}
                      </p>
                      <p className="mt-3 text-sm font-semibold">
                        {membership.plan_name} · {formatDate(membership.start_date)} → {formatDate(membership.end_date)}
                      </p>
                    </div>

                    <label className="min-w-0 text-xs font-black xl:w-64">
                      Assigned coach
                      <select
                        value={assignment?.trainer_staff_profile_id || ""}
                        disabled={savingMembershipId === membership.id}
                        onChange={(event) => void assignCoach(membership.id, event.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-[#cdd9cb] bg-white px-3 py-3 text-sm font-bold outline-none"
                      >
                        <option value="">Unassigned</option>
                        {trainers.filter((trainer) => trainer.active).map((trainer) => (
                          <option key={trainer.staff_profile_id} value={trainer.staff_profile_id}>
                            {trainer.display_name}
                          </option>
                        ))}
                      </select>
                      <span className="mt-1 block font-normal text-[#718075]">
                        {assignedTrainer ? "Saved for this PT cycle." : "Choose the member’s actual trainer."}
                      </span>
                    </label>
                  </div>

                  {evaluation && (
                    <div className="mt-5 rounded-2xl border border-[#d8e4d4] bg-white p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#65905c]">
                            Trainer evaluation
                          </p>
                          <p className="mt-1 text-xl font-black">
                            {evaluation.overall_rating}/5 <span className="text-[#b28a2d]">★</span>
                          </p>
                          <p className="mt-1 text-xs text-[#647468]">
                            Submitted {formatDateTime(evaluation.submitted_at)}
                          </p>
                        </div>
                        <span className="rounded-full bg-[#eef4eb] px-3 py-1.5 text-[10px] font-black uppercase text-[#42634a]">
                          {evaluation.management_status}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
                        {[
                          ["Professionalism", evaluation.professionalism_rating],
                          ["Punctuality", evaluation.punctuality_rating],
                          ["Communication", evaluation.communication_rating],
                          ["Coaching", evaluation.coaching_quality_rating],
                          ["Motivation", evaluation.motivation_rating],
                          ["Programme", evaluation.program_consistency ? "Yes" : "No"],
                        ].map(([label, value]) => (
                          <div key={String(label)} className="rounded-xl bg-[#f4f7f1] p-3">
                            <p className="text-[9px] font-black uppercase text-[#748078]">{label}</p>
                            <p className="mt-1 font-black">{value}</p>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 text-sm leading-6 text-[#52655a]">
                        <p>
                          <strong>Next step:</strong>{" "}
                          {evaluation.continuation_choice === "continue"
                            ? `Continue with ${trainerMap.get(evaluation.trainer_staff_profile_id)?.display_name || "same trainer"}`
                            : evaluation.continuation_choice === "change"
                              ? `Change to ${trainerMap.get(evaluation.requested_trainer_staff_profile_id || "")?.display_name || "another trainer"}`
                              : "Finish personal training"}
                        </p>
                        {evaluation.change_reason && (
                          <p className="mt-2"><strong>Change reason:</strong> {evaluation.change_reason}</p>
                        )}
                        {evaluation.comments && (
                          <p className="mt-2"><strong>Comment:</strong> {evaluation.comments}</p>
                        )}
                        {evaluation.management_note && (
                          <p className="mt-2"><strong>Management note:</strong> {evaluation.management_note}</p>
                        )}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {evaluation.management_status === "pending" && (
                          <button
                            type="button"
                            onClick={() => void updateEvaluation(evaluation, "reviewed")}
                            className="inline-flex items-center gap-2 rounded-xl border border-[#cfdccf] px-4 py-2.5 text-xs font-bold"
                          >
                            <CheckCircle2 size={15} /> Mark reviewed
                          </button>
                        )}
                        {evaluation.management_status !== "resolved" && (
                          <button
                            type="button"
                            onClick={() => void updateEvaluation(evaluation, "resolved")}
                            className="inline-flex items-center gap-2 rounded-xl bg-[#193b2a] px-4 py-2.5 text-xs font-bold text-white"
                          >
                            <CheckCircle2 size={15} /> Resolve
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </AdminWorkspaceShell>
  );
}

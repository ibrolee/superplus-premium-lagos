import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  ChevronDown,
  Dumbbell,
  RefreshCw,
  Save,
  ShieldAlert,
  Star,
  UserRound,
  Users,
} from "lucide-react";
import { AdminWorkspaceShell } from "@/components/admin/AdminWorkspaceShell";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/management-personal-training")({
  component: ManagementPersonalTraining,
});

import {
  type Trainer, type Member, type PtMembership, type Assignment, type Evaluation,
  type CoachReport, type PtPayoutBreakdown, type PtPayoutRun, type View,
  FULL_PAYOUT_MIN_TRAINEES, LOW_VOLUME_TRAINEE_COMMISSION, RENEWAL_GRACE_DAYS,
  RATING_MIN_EVALUATIONS, DAY, lagosToday, addDays, calendarDate,
  payPeriodFromStart, currentPayPeriodStart, previousPayPeriodStart, buildPayPeriodStarts,
  formatDate, formatDateTime, coachReportCategoryLabel, formatMoney, twoCycleRetentionForCoach,
  calculatePtPayout,
} from "@/lib/pt-payroll";

function ManagementPersonalTraining() {
  const [memberships, setMemberships] = useState<PtMembership[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [coachReports, setCoachReports] = useState<CoachReport[]>([]);
  const [payoutRuns, setPayoutRuns] = useState<PtPayoutRun[]>([]);
  const [payoutPeriodStart, setPayoutPeriodStart] = useState(currentPayPeriodStart());
  const [payoutPool, setPayoutPool] = useState<string | null>(null);
  const [adjustPoolOpen, setAdjustPoolOpen] = useState(false);
  const [payoutSaving, setPayoutSaving] = useState(false);
  const [payoutMarkingId, setPayoutMarkingId] = useState<string | null>(null);
  const [payoutMessage, setPayoutMessage] = useState("");
  const [view, setView] = useState<View>("current");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingMembershipId, setSavingMembershipId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [coachPerformanceOpen, setCoachPerformanceOpen] = useState(false);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [savingReportId, setSavingReportId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    const [membershipResult, trainerResult, staffTitleResult, assignmentResult, evaluationResult, payoutResult, reportResult] = await Promise.all([
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
        .from("staff_profiles")
        .select("id,position"),
      supabase
        .from("pt_assignments")
        .select("membership_id,member_id,trainer_staff_profile_id,updated_at")
        .order("updated_at", { ascending: false }),
      supabase
        .from("pt_evaluations")
        .select("membership_id,member_id,trainer_staff_profile_id,overall_rating,professionalism_rating,punctuality_rating,communication_rating,coaching_quality_rating,motivation_rating,program_consistency,comments,continuation_choice,requested_trainer_staff_profile_id,change_reason,management_status,management_note,submitted_at")
        .order("submitted_at", { ascending: false }),
      supabase
        .from("pt_semimonthly_payout_runs")
        .select("id,period_start,period_end,pay_date,auto_payout_pool,payout_pool,breakdown,financial_locked,status,paid_at,created_by,updated_at")
        .order("period_start", { ascending: false })
        .limit(26),
      supabase
        .from("pt_coach_reports")
        .select("id,membership_id,member_id,coach_staff_profile_id,category,details,incident_date,status,submitted_at,updated_at")
        .order("submitted_at", { ascending: false })
        .limit(300),
    ]);

    const firstError =
      membershipResult.error || trainerResult.error || staffTitleResult.error || assignmentResult.error || evaluationResult.error || payoutResult.error || reportResult.error;

    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    const nextMemberships = (membershipResult.data || []) as PtMembership[];
    const nextReports = (reportResult.data || []) as CoachReport[];
    const memberIds = Array.from(new Set([
      ...nextMemberships.map((row) => row.member_id),
      ...nextReports.map((row) => row.member_id),
    ]));
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

    const staffTitleMap = new Map(
      (staffTitleResult.data || []).map((row) => [row.id, row.position || null] as const),
    );

    setMemberships(nextMemberships);
    setMembers(nextMembers);
    setTrainers(
      (trainerResult.data || []).map((trainer) => ({
        ...trainer,
        staff_title: staffTitleMap.get(trainer.staff_profile_id) || null,
      })) as Trainer[],
    );
    setAssignments((assignmentResult.data || []) as Assignment[]);
    setEvaluations((evaluationResult.data || []) as Evaluation[]);
    setCoachReports(nextReports);
    setPayoutRuns((payoutResult.data || []) as PtPayoutRun[]);
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
  const pendingCoachReportsCount = coachReports.filter((row) => row.status === "pending").length;

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
    const currentTraineeIds = new Set(
      memberships
        .filter(
          (row) =>
            isCurrent(row) &&
            assignmentMap.get(row.id)?.trainer_staff_profile_id === trainer.staff_profile_id,
        )
        .map((row) => row.member_id),
    );
    const traineeCount = currentTraineeIds.size;
    const count = coachEvaluations.length;
    const averageOf = (pick: (evaluation: Evaluation) => number) =>
      count
        ? coachEvaluations.reduce((sum, row) => sum + Number(pick(row) || 0), 0) / count
        : 0;
    const average = averageOf((row) => row.overall_rating);
    const professionalism = averageOf((row) => row.professionalism_rating);
    const punctuality = averageOf((row) => row.punctuality_rating);
    const communication = averageOf((row) => row.communication_rating);
    const coachingQuality = averageOf((row) => row.coaching_quality_rating);
    const motivation = averageOf((row) => row.motivation_rating);
    const programConsistency = count
      ? (coachEvaluations.filter((row) => row.program_consistency).length / count) * 100
      : 0;
    const continued = coachEvaluations.filter((row) => row.continuation_choice === "continue").length;
    const changed = coachEvaluations.filter((row) => row.continuation_choice === "change").length;
    const finished = coachEvaluations.filter((row) => row.continuation_choice === "finish").length;
    const percent = (value: number) => (count ? Math.round((value / count) * 100) : 0);
    const ratingReady = count >= RATING_MIN_EVALUATIONS;
    return {
      trainer,
      count,
      traineeCount,
      average,
      professionalism,
      punctuality,
      communication,
      coachingQuality,
      motivation,
      programConsistency,
      continued,
      changed,
      finished,
      continueRate: percent(continued),
      changeRate: percent(changed),
      finishRate: percent(finished),
      ratingReady,
    };
  });

  const selectedPeriod = payPeriodFromStart(payoutPeriodStart);
  const payoutPeriodOptions = useMemo(
    () => [...new Set([...buildPayPeriodStarts(26), ...payoutRuns.map((run) => run.period_start)])].sort((a, b) => b.localeCompare(a)),
    [payoutRuns],
  );
  const selectedPayoutRun = payoutRuns.find(
    (row) => row.period_start === payoutPeriodStart,
  ) || null;

  const payoutCalculation = useMemo(() => calculatePtPayout({
    trainers, memberships, evaluations, assignmentMap, payoutPeriodStart, payoutPool,
    payoutRuns, selectedPayoutRun, today,
  }), [trainers, memberships, evaluations, assignmentMap, payoutPeriodStart, payoutPool, payoutRuns, selectedPayoutRun, today]);
  const payoutLocked = selectedPayoutRun?.status === "paid" || selectedPayoutRun?.financial_locked === true;

  const invalidPool = payoutPool !== null &&
    (!payoutPool.trim() || !Number.isFinite(Number(payoutPool)) || Number(payoutPool) < 0);
  const payoutBusy = loading || payoutSaving || payoutMarkingId !== null;
  const payoutNeedsSave = selectedPayoutRun?.status === "pending" && !payoutLocked && (
    Math.abs(Number(selectedPayoutRun.payout_pool) - payoutCalculation.pool) > 0.01 ||
    Math.abs(Number(selectedPayoutRun.auto_payout_pool) - payoutCalculation.autoPool) > 0.01 ||
    JSON.stringify(selectedPayoutRun.breakdown) !== JSON.stringify(payoutCalculation.rows)
  );

  async function savePayoutRun() {
    if (payoutBusy || invalidPool) return;
    if (payoutLocked) {
      setError("Payments have been recorded for this PT payout. Its figures are locked.");
      return;
    }
    if (payoutCalculation.fullEligibleCount === 0 && payoutCalculation.pool > 0) {
      setError("No in-house coach has 3 or more trainees in this pay period, so the 50/30/20 pool must be ₦0.");
      return;
    }
    if (payoutCalculation.fullEligibleCount === 0 && payoutCalculation.commissionTotal <= 0) {
      setError("There is no PT payout to save for this pay period yet.");
      return;
    }

    setPayoutSaving(true);
    setError("");
    setPayoutMessage("");
    const { error: saveError } = await supabase.rpc(
      "management_save_pt_semimonthly_payout_run",
      {
        p_period_start: payoutCalculation.periodStart,
        p_auto_payout_pool: payoutCalculation.autoPool,
        p_payout_pool: payoutCalculation.pool,
        p_breakdown: payoutCalculation.rows,
      },
    );

    if (saveError) {
      setError(saveError.message);
    } else {
      setPayoutMessage(
        `PT payout saved for ${formatDate(payoutCalculation.periodStart)} – ${formatDate(payoutCalculation.periodEnd)}. Pay date: ${formatDate(payoutCalculation.payDate)}.`,
      );
      setPayoutPool(null);
      await load();
    }
    setPayoutSaving(false);
  }

  async function markPayoutPaid(run: PtPayoutRun) {
    if (run.status === "paid" || payoutBusy || invalidPool) return;
    if (payoutNeedsSave) {
      setError("The calculation has changed. Save PT payout before marking it paid.");
      return;
    }
    if (today < run.pay_date) {
      setError(`This PT payout is due on ${formatDate(run.pay_date)}.`);
      return;
    }
    const total = (run.breakdown || []).reduce(
      (sum, row) => sum + Number(row.recommended_payout || 0),
      0,
    );
    const confirmed = window.confirm(
      `Mark the PT payout for ${formatDate(run.period_start)} – ${formatDate(run.period_end)} as PAID?\n\nPay date: ${formatDate(run.pay_date)}\nTotal: ${formatMoney(total)}\n\nOnce paid, this calculation is locked.`,
    );
    if (!confirmed) return;

    setPayoutMarkingId(run.id);
    setError("");
    setPayoutMessage("");
    const { error: markError } = await supabase.rpc(
      "management_mark_pt_semimonthly_payout_paid",
      { p_payout_run_id: run.id },
    );
    if (markError) {
      setError(markError.message);
    } else {
      setPayoutMessage(
        `PT payout for ${formatDate(run.period_start)} – ${formatDate(run.period_end)} marked paid.`,
      );
      await load();
    }
    setPayoutMarkingId(null);
  }

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

  async function updateCoachReport(reportId: string, status: "reviewed" | "resolved") {
    setSavingReportId(reportId);
    setError("");
    setMessage("");
    const { error: updateError } = await supabase
      .from("pt_coach_reports")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", reportId);
    if (updateError) {
      setError(updateError.message);
    } else {
      setMessage(status === "resolved" ? "Coach report marked resolved." : "Coach report marked reviewed.");
      await load();
    }
    setSavingReportId(null);
  }

  return (
    <AdminWorkspaceShell
      title="Personal Training"
      subtitle="Assign coaches, monitor PT expiries, review coach evaluations and handle continuation or change requests."
      active="/management-personal-training"
    >
      <section className="mt-7 grid grid-cols-2 gap-3 xl:grid-cols-5">
        {[
          { label: "Current PT", value: currentCount, icon: Users, targetView: "current" as View },
          { label: "Expiring in 7 days", value: expiringCount, icon: CalendarDays, targetView: "expiring" as View },
          { label: "Unassigned", value: unassignedCount, icon: AlertCircle, targetView: "unassigned" as View },
          { label: "Feedback to review", value: pendingFeedbackCount, icon: Star, targetView: "feedback" as View },
          { label: "Confidential reports", value: pendingCoachReportsCount, icon: ShieldAlert, targetView: null },
        ].map(({ label, value, icon: Icon, targetView }) => (
          <button
            type="button"
            key={label}
            onClick={() => {
              if (targetView) {
                setView(targetView);
                setMembersOpen(true);
              } else {
                setReportsOpen(true);
              }
            }}
            className="rounded-2xl border border-[#dce7d8] bg-white p-4 text-left"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-[#68796d]">{label}</p>
              <Icon size={17} className={label === "Confidential reports" && value > 0 ? "text-[#9a3939]" : "text-[#2f7746]"} />
            </div>
            <p className="mt-3 text-3xl font-black">{value}</p>
          </button>
        ))}
      </section>

      <section className="mt-5 rounded-[24px] border border-[#e1e8dd] bg-white p-4 sm:p-6">
        <button
          type="button"
          aria-expanded={coachPerformanceOpen}
          onClick={() => setCoachPerformanceOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-4 text-left"
        >
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#65905c]">
              Coach performance
            </p>
            <h2 className="mt-1 text-xl font-black">Evaluation overview</h2>
            <p className="mt-1 text-xs text-[#6c7a70]">Ratings, trainee retention and performance breakdown.</p>
          </div>
          <ChevronDown
            size={22}
            className={`shrink-0 text-[#42634a] transition-transform ${coachPerformanceOpen ? "rotate-180" : ""}`}
          />
        </button>
        {coachPerformanceOpen && (
          <>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => void load()}
                className="inline-flex items-center gap-2 rounded-xl border border-[#d8e2d5] px-4 py-2.5 text-xs font-bold"
              >
                <RefreshCw size={15} /> Refresh
              </button>
            </div>
            <div className="mt-5 grid gap-4 xl:grid-cols-3">
          {trainerStats.map((stats) => {
            const {
              trainer,
              count,
              traineeCount,
              average,
              professionalism,
              punctuality,
              communication,
              coachingQuality,
              motivation,
              programConsistency,
              continueRate,
              changeRate,
              finishRate,
              ratingReady,
            } = stats;
            const categories = [
              ["Coaching quality", coachingQuality],
              ["Professionalism", professionalism],
              ["Communication", communication],
              ["Punctuality", punctuality],
              ["Motivation", motivation],
            ] as const;

            return (
              <article key={trainer.staff_profile_id} className="rounded-2xl border border-[#e0e9dc] bg-[#f7f9f5] p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#193b2a] text-white">
                    <Dumbbell size={19} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-black">{trainer.display_name}</h3>
                      <span className="rounded-full bg-[#dfeedd] px-2.5 py-1 text-[10px] font-black text-[#2f7746]">
                        {traineeCount} trainee{traineeCount === 1 ? "" : "s"}
                      </span>
                      <span
                        className={
                          "rounded-full px-2.5 py-1 text-[10px] font-black " +
                          (trainer.staff_title?.trim().toLowerCase() === "part-time coach"
                            ? "bg-violet-100 text-violet-800"
                            : "bg-[#eef2eb] text-[#526357]")
                        }
                      >
                        {trainer.staff_title || "Coach"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-[#68796d]">
                      {count} evaluation{count === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl bg-white p-4">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[.15em] text-[#738176]">
                        Overall coach rating
                      </p>
                      <p className="mt-1 text-3xl font-black">
                        {count ? average.toFixed(1) : "—"} <span className="text-base text-[#9a7b20]">★</span>
                      </p>
                    </div>
                    <span
                      className={
                        "rounded-full px-2.5 py-1 text-[9px] font-black uppercase " +
                        (ratingReady
                          ? "bg-green-100 text-green-800"
                          : "bg-amber-100 text-amber-800")
                      }
                    >
                      {ratingReady ? "Established rating" : "Not enough feedback yet"}
                    </span>
                  </div>
                  {!ratingReady && count > 0 && (
                    <p className="mt-2 text-[11px] leading-5 text-[#6e7c72]">
                      Rating is provisional until this coach has at least 2 evaluations.
                    </p>
                  )}
                  {!count && (
                    <p className="mt-2 text-[11px] leading-5 text-[#6e7c72]">
                      The overall rating will appear after trainees submit feedback.
                    </p>
                  )}
                </div>

                <div className="mt-4">
                  <p className="text-[9px] font-black uppercase tracking-[.15em] text-[#738176]">
                    Category averages
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {categories.map(([label, value]) => (
                      <div key={label} className="rounded-xl bg-white p-3">
                        <p className="text-[9px] font-black uppercase leading-4 text-[#748078]">{label}</p>
                        <p className="mt-1 text-base font-black">{count ? value.toFixed(1) : "—"} <span className="text-[10px] text-[#9a7b20]">★</span></p>
                      </div>
                    ))}
                    <div className="rounded-xl bg-white p-3">
                      <p className="text-[9px] font-black uppercase leading-4 text-[#748078]">Programme consistency</p>
                      <p className="mt-1 text-base font-black">{count ? `${Math.round(programConsistency)}%` : "—"}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-[9px] font-black uppercase tracking-[.15em] text-[#738176]">
                    What trainees chose next
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-[#eaf5e7] p-3">
                      <p className="text-lg font-black text-[#2f7746]">{count ? `${continueRate}%` : "—"}</p>
                      <p className="mt-1 text-[9px] font-black uppercase text-[#55745d]">Continue</p>
                    </div>
                    <div className="rounded-xl bg-amber-50 p-3">
                      <p className="text-lg font-black text-amber-800">{count ? `${changeRate}%` : "—"}</p>
                      <p className="mt-1 text-[9px] font-black uppercase text-amber-700">Change</p>
                    </div>
                    <div className="rounded-xl bg-[#eef0ec] p-3">
                      <p className="text-lg font-black text-[#58645d]">{count ? `${finishRate}%` : "—"}</p>
                      <p className="mt-1 text-[9px] font-black uppercase text-[#6f7972]">Finish PT</p>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
            </div>
          </>
        )}
      </section>

      <section className="mt-5 rounded-[24px] border border-[#d8e5d4] bg-white p-4 sm:p-6">
        <button
          type="button"
          aria-expanded={payoutOpen}
          onClick={() => setPayoutOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-4 text-left"
        >
          <div className="max-w-2xl">
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#65905c]">
              PT payday calculator
            </p>
            <h2 className="mt-1 text-xl font-black">Coach PT Payout</h2>
            <p className="mt-1 text-xs text-[#6c7a70]">
              Fixed paydays: 16th of every month, then 1st of the next month together with salary.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <CircleDollarSign className="size-7 text-[#2f7746]" />
            <ChevronDown
              size={22}
              className={`text-[#42634a] transition-transform ${payoutOpen ? "rotate-180" : ""}`}
            />
          </div>
        </button>

        {payoutOpen && (
          <>
            <div className="mt-4 rounded-xl border border-[#dbe6d8] bg-[#f8faf6] p-4 text-xs leading-5 text-[#5e7064]">
              <strong className="text-[#30483a]">Simple schedule:</strong>{" "}
              PT work from the <strong>1st–15th</strong> is paid on the <strong>16th</strong>.
              PT work from the <strong>16th–last day of the month</strong> is paid on the
              <strong> 1st of the next month</strong> together with salary.
            </div>

            <div className="mt-5 grid gap-3 md:max-w-xl">
              <label className="text-xs font-black">
                PT Pay Period
                <select
                  value={payoutPeriodStart}
                  disabled={payoutBusy}
                  onChange={(event) => {
                    setPayoutPeriodStart(event.target.value);
                    setAdjustPoolOpen(false);
                    setPayoutPool(null);
                    setPayoutMessage("");
                    setError("");
                  }}
                  className="mt-1.5 w-full rounded-xl border border-[#cedbc9] bg-white px-3 py-3 text-sm font-semibold outline-none"
                >
                  {payoutPeriodOptions.map((start) => {
                    const period = payPeriodFromStart(start);
                    return (
                      <option key={start} value={start}>
                        {formatDate(period.start)} – {formatDate(period.end)} · pay date {formatDate(period.payDate)}
                      </option>
                    );
                  })}
                </select>
                <span className="mt-1.5 block font-normal text-[#728077]">
                  {selectedPeriod.salaryDay
                    ? `Pay date ${formatDate(selectedPeriod.payDate)} · together with salary`
                    : `Pay date ${formatDate(selectedPeriod.payDate)}`}
                </span>
              </label>

            </div>

            <div className="mt-4 rounded-xl border border-[#dfe7dc] bg-white p-4">
              <p className="text-xs font-black text-[#65806b]">Automatic 50/30/20 pool</p>
              <p className="mt-1 text-2xl font-black text-[#193b2a]">{formatMoney(payoutCalculation.autoPool)}</p>
              <p className="mt-1 text-xs text-[#68766d]">₦10,000 × payable membership cycles assigned to eligible coaches.</p>
              {payoutCalculation.poolOverridden && (
                <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs font-bold text-amber-900">
                  Manually adjusted pool: {formatMoney(payoutCalculation.pool)} · Automatic: {formatMoney(payoutCalculation.autoPool)}
                </p>
              )}
              {!payoutLocked && (
                <div className="mt-3 space-y-3">
                  <button type="button" disabled={payoutBusy || payoutCalculation.fullEligibleCount === 0}
                    onClick={() => setAdjustPoolOpen((open) => !open)}
                    aria-expanded={adjustPoolOpen}
                    className="rounded-xl border border-[#cbd8c8] px-4 py-2 text-xs font-black disabled:opacity-40">
                    {adjustPoolOpen ? "Hide adjustment" : "Adjust pool"}
                  </button>
                  {adjustPoolOpen && (
                    <label className="block text-xs font-black">
                      Override amount (₦)
                      <input type="number" min="0" step="0.01" inputMode="decimal"
                        value={payoutPool ?? String(payoutCalculation.pool)}
                        onChange={(event) => setPayoutPool(event.target.value)} disabled={payoutBusy}
                        className="mt-1.5 w-full rounded-xl border border-[#cedbc9] px-3 py-3 text-sm" />
                    </label>
                  )}
                  {(payoutCalculation.poolOverridden || payoutPool !== null) && (
                    <button type="button" disabled={payoutBusy}
                      onClick={() => { setPayoutPool(String(payoutCalculation.autoPool)); setAdjustPoolOpen(false); }}
                      className="text-xs font-bold underline">Use automatic amount</button>
                  )}
                  {invalidPool && <p role="alert" className="text-xs text-red-800">Enter a valid amount of ₦0 or more, or use the automatic amount.</p>}
                </div>
              )}
              <p className="mt-3 text-xs leading-5 text-[#68766d]">3+ trainees: 50/30/20 pool. 1–2 trainees: ₦10,000 once per payable membership cycle. 0 trainees: ₦0. Part-time coaches are handled separately.</p>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-[#edf5ea] p-3 text-center">
                <p className="text-xl font-black text-[#2f7746]">50%</p>
                <p className="text-[9px] font-black uppercase text-[#65766a]">Team share</p>
              </div>
              <div className="rounded-xl bg-[#f3f5ed] p-3 text-center">
                <p className="text-xl font-black text-[#52633f]">30%</p>
                <p className="text-[9px] font-black uppercase text-[#65766a]">Workload</p>
              </div>
              <div className="rounded-xl bg-[#fff6df] p-3 text-center">
                <p className="text-xl font-black text-[#8b6d24]">20%</p>
                <p className="text-[9px] font-black uppercase text-[#756b50]">Performance</p>
              </div>
            </div>

            {payoutCalculation.unassignedCount > 0 && (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
                <AlertCircle size={17} className="mt-0.5 shrink-0" />
                <p>
                  <strong>{payoutCalculation.unassignedCount} paid PT trainee{payoutCalculation.unassignedCount === 1 ? "" : "s"}</strong>{" "}
                  overlap this period without a coach assignment. Assign them before finalising payout.
                </p>
              </div>
            )}

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                disabled={payoutBusy || invalidPool || payoutLocked}
                onClick={() => void savePayoutRun()}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#193b2a] px-4 py-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save size={15} /> {payoutSaving ? "Saving…" : payoutLocked ? "Payments recorded · figures locked" : "Save PT payout"}
              </button>
              {selectedPayoutRun?.status === "pending" && !payoutLocked && (
                <button
                  type="button"
                  disabled={payoutBusy || invalidPool || payoutNeedsSave || today < selectedPayoutRun.pay_date}
                  onClick={() => void markPayoutPaid(selectedPayoutRun)}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#193b2a] bg-white px-4 py-3 text-xs font-black text-[#193b2a] disabled:opacity-45"
                >
                  <CheckCircle2 size={15} />
                  {today < selectedPayoutRun.pay_date
                    ? `Pay on ${formatDate(selectedPayoutRun.pay_date)}`
                    : payoutMarkingId === selectedPayoutRun.id
                      ? "Saving…"
                      : "Mark payout paid"}
                </button>
              )}
            </div>

            {payoutNeedsSave && (
              <p role="status" className="mt-3 text-xs text-amber-900">Calculation updated. Save PT payout before marking it paid.</p>
            )}
            {payoutLocked && selectedPayoutRun?.status === "pending" && (
              <a href="/management-salary-payments" className="mt-3 inline-block text-xs font-bold underline">Record remaining coach payments in Salary payments</a>
            )}
            {payoutLocked && (
              <p className="mt-3 text-xs font-bold text-green-800">Payments recorded · these saved financial figures are locked.</p>
            )}
            {!!payoutMessage && (
              <p className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-xs font-semibold text-green-800">
                {payoutMessage}
              </p>
            )}

            <div className="mt-5 grid gap-3 xl:grid-cols-3">
              {payoutCalculation.rows.map((row) => (
                <article key={row.trainer_staff_profile_id} className="rounded-2xl border border-[#dde7d9] bg-[#f8faf6] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black">{row.trainer_name}</h3>
                      <p className="mt-1 text-xs text-[#6a786e]">
                        {row.trainee_count} assigned trainee{row.trainee_count === 1 ? "" : "s"} in this pay period
                      </p>
                      <span className={
                        "mt-2 inline-flex rounded-full px-2.5 py-1 text-[9px] font-black uppercase " +
                        (row.full_pool_eligible
                          ? "bg-green-100 text-green-800"
                          : row.trainee_count > 0
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-700")
                      }>
                        {row.full_pool_eligible
                          ? "50/30/20 eligible"
                          : row.trainee_count > 0
                            ? "₦10k membership commission"
                            : "No PT payout"}
                      </span>
                    </div>
                    <p className="text-xl font-black text-[#193b2a]">{formatMoney(row.recommended_payout)}</p>
                  </div>

                  {row.full_pool_eligible ? (
                    <div className="mt-4 grid grid-cols-3 gap-1 text-center">
                      <div className="rounded-xl bg-white p-3">
                        <p className="break-words text-xs font-black">{formatMoney(row.team_share)}</p>
                        <p className="mt-1 text-[9px] font-black uppercase text-[#778178]">Team</p>
                      </div>
                      <div className="rounded-xl bg-white p-3">
                        <p className="break-words text-xs font-black">{formatMoney(row.workload_share)}</p>
                        <p className="mt-1 text-[9px] font-black uppercase text-[#778178]">Workload</p>
                      </div>
                      <div className="rounded-xl bg-white p-3">
                        <p className="break-words text-xs font-black">{formatMoney(row.performance_share)}</p>
                        <p className="mt-1 text-[9px] font-black uppercase text-[#778178]">Performance</p>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl border border-[#dce7d9] bg-white p-3">
                      <p className="text-[9px] font-black uppercase tracking-wider text-[#778178]">Fixed commission</p>
                      <p className="mt-1 text-xs text-[#68766d]">
                        {Number(row.payable_membership_count || 0) > 0
                          ? `₦10,000 × ${row.payable_membership_count} PT membership cycle${row.payable_membership_count === 1 ? "" : "s"}`
                          : "No new payable PT membership cycle in this period"}
                      </p>
                    </div>
                  )}

                  <div className="mt-4 space-y-2 text-xs text-[#5f7064]">
                    <div className="flex items-center justify-between gap-3">
                      <span>Two-cycle retention</span>
                      <strong className="text-[#33483a]">
                        {row.renewal_rate === null
                          ? "Not enough data"
                          : `${Math.round(row.renewal_rate * 100)}% (${row.renewed_same_trainer}/${row.renewal_eligible})`}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Trainee rating</span>
                      <strong className="text-[#33483a]">
                        {row.rating_average === null
                          ? "No ratings"
                          : `${row.rating_average.toFixed(1)}/5 · ${row.rating_count} review${row.rating_count === 1 ? "" : "s"}`}
                      </strong>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-4 grid gap-2 rounded-xl bg-[#193b2a] p-4 text-white sm:grid-cols-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[.14em] text-white/65">Pool used</p>
                <p className="mt-0.5 text-lg font-black">{formatMoney(payoutCalculation.pool)}</p>
                <p className="mt-1 text-[9px] text-white/60">
                  Auto {formatMoney(payoutCalculation.autoPool)}{payoutCalculation.poolOverridden ? " · overridden" : ""}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[.14em] text-white/65">1–2 trainee commissions</p>
                <p className="mt-0.5 text-lg font-black">{formatMoney(payoutCalculation.commissionTotal)}</p>
                <p className="mt-1 text-[9px] text-white/60">₦10,000 per payable PT membership cycle</p>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[.14em] text-white/65">Total PT payroll due</p>
                <p className="mt-0.5 text-lg font-black">{formatMoney(payoutCalculation.totalRecommended)}</p>
                <p className="mt-1 text-[9px] text-white/60">Pay date {formatDate(payoutCalculation.payDate)}</p>
              </div>
            </div>

            {payoutRuns.length > 0 && (
              <div className="mt-5 rounded-2xl border border-[#dce6d9] bg-[#fbfcf9] p-4">
                <p className="text-[10px] font-black uppercase tracking-[.14em] text-[#65905c]">Recent PT paydays</p>
                <div className="mt-3 grid gap-2">
                  {payoutRuns.slice(0, 6).map((run) => {
                    const total = (run.breakdown || []).reduce(
                      (sum, row) => sum + Number(row.recommended_payout || 0),
                      0,
                    );
                    return (
                      <button
                        type="button"
                        key={run.id}
                        disabled={payoutBusy}
                        onClick={() => {
                          setPayoutPeriodStart(run.period_start);
                          setAdjustPoolOpen(false);
                          setPayoutPool(null);
                          setPayoutMessage("");
                          setError("");
                        }}
                        className="flex flex-col gap-2 rounded-xl border border-[#dde5da] bg-white p-3 text-left sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="text-xs font-black">
                            {formatDate(run.period_start)} – {formatDate(run.period_end)}
                          </p>
                          <p className="mt-1 text-[10px] text-[#6e7b72]">
                            Pay date {formatDate(run.pay_date)}
                            {run.status === "paid" && run.paid_at ? ` · paid ${formatDateTime(run.paid_at)}` : " · pending"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-[#193b2a]">{formatMoney(total)}</span>
                          <span className={
                            "rounded-full px-2.5 py-1 text-[9px] font-black uppercase " +
                            (run.status === "paid"
                              ? "bg-green-100 text-green-800"
                              : "bg-amber-100 text-amber-800")
                          }>
                            {run.status}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <section className="mt-5 rounded-[24px] border border-[#e1e8dd] bg-white p-4 sm:p-6">
        <button
          type="button"
          aria-expanded={reportsOpen}
          onClick={() => setReportsOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-4 text-left"
        >
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#8c4a43]">Confidential</p>
            <h2 className="mt-1 text-xl font-black">Coach Reports</h2>
            <p className="mt-1 text-xs text-[#6c7a70]">
              Private concerns submitted by active PT members. Coaches cannot access these reports.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {pendingCoachReportsCount > 0 && (
              <span className="rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-black text-red-800">
                {pendingCoachReportsCount} pending
              </span>
            )}
            <ChevronDown
              size={22}
              className={`text-[#6a4945] transition-transform ${reportsOpen ? "rotate-180" : ""}`}
            />
          </div>
        </button>

        {reportsOpen && (
          <div className="mt-5 space-y-3">
            {!coachReports.length ? (
              <p className="rounded-xl border border-dashed border-[#d8e2d5] p-7 text-center text-sm text-[#647468]">
                No confidential coach reports have been submitted.
              </p>
            ) : (
              coachReports.map((report) => {
                const member = memberMap.get(report.member_id);
                const coach = trainerMap.get(report.coach_staff_profile_id);
                return (
                  <article key={report.id} className="rounded-2xl border border-[#eadbd7] bg-[#fffaf8] p-4 sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-black">{coachReportCategoryLabel(report.category)}</h3>
                          <span
                            className={
                              "rounded-full px-2.5 py-1 text-[10px] font-black uppercase " +
                              (report.status === "pending"
                                ? "bg-red-100 text-red-800"
                                : report.status === "reviewed"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-green-100 text-green-800")
                            }
                          >
                            {report.status}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-[#66746b]">
                          Submitted {formatDateTime(report.submitted_at)}
                          {report.incident_date ? ` · Incident ${formatDate(report.incident_date)}` : ""}
                        </p>
                      </div>
                      <ShieldAlert size={21} className="shrink-0 text-[#974a43]" />
                    </div>

                    <div className="mt-4 grid gap-3 rounded-xl bg-white p-4 text-xs sm:grid-cols-2">
                      <div>
                        <p className="font-black uppercase tracking-wider text-[#7a827d]">Member</p>
                        <p className="mt-1 text-sm font-bold">{member?.full_name || "Unknown member"}</p>
                        <p className="mt-0.5 text-[#68766d]">{member?.phone || member?.email || "No contact"}</p>
                      </div>
                      <div>
                        <p className="font-black uppercase tracking-wider text-[#7a827d]">Reported coach</p>
                        <p className="mt-1 text-sm font-bold">{coach?.display_name || "Coach"}</p>
                      </div>
                    </div>

                    <div className="mt-3 rounded-xl bg-white p-4">
                      <p className="text-[10px] font-black uppercase tracking-wider text-[#7a827d]">Member's report</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#46564c]">{report.details}</p>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {report.status === "pending" && (
                        <button
                          type="button"
                          disabled={savingReportId === report.id}
                          onClick={() => void updateCoachReport(report.id, "reviewed")}
                          className="inline-flex items-center gap-2 rounded-xl border border-[#d8c8c4] bg-white px-4 py-2.5 text-xs font-bold disabled:opacity-50"
                        >
                          <CheckCircle2 size={15} /> Mark reviewed
                        </button>
                      )}
                      {report.status !== "resolved" && (
                        <button
                          type="button"
                          disabled={savingReportId === report.id}
                          onClick={() => void updateCoachReport(report.id, "resolved")}
                          className="inline-flex items-center gap-2 rounded-xl bg-[#193b2a] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                        >
                          <CheckCircle2 size={15} /> Resolve
                        </button>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        )}
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
        <button
          type="button"
          aria-expanded={membersOpen}
          onClick={() => setMembersOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-4 text-left"
        >
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#65905c]">
              PT members
            </p>
            <h2 className="mt-1 text-xl font-black">Personal Training Members</h2>
            <p className="mt-1 text-xs text-[#6c7a70]">
              Coach assignments, renewals, feedback and PT membership records.
            </p>
          </div>
          <ChevronDown
            size={22}
            className={`shrink-0 text-[#42634a] transition-transform ${membersOpen ? "rotate-180" : ""}`}
          />
        </button>

        {membersOpen && (
          <>
            <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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
                            {trainer.display_name}{trainer.staff_title ? ` — ${trainer.staff_title}` : ""}
                          </option>
                        ))}
                      </select>
                      <span className="mt-1 block font-normal text-[#718075]">
                        {assignedTrainer ? "Saved for this PT cycle." : "Choose the member’s actual coach."}
                      </span>
                    </label>
                  </div>

                  {evaluation && (
                    <div className="mt-5 rounded-2xl border border-[#d8e4d4] bg-white p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#65905c]">
                            Coach evaluation
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
                            ? `Continue with ${trainerMap.get(evaluation.trainer_staff_profile_id)?.display_name || "same coach"}`
                            : evaluation.continuation_choice === "change"
                              ? `Change to ${trainerMap.get(evaluation.requested_trainer_staff_profile_id || "")?.display_name || "another coach"}`
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
          </>
        )}
      </section>
    </AdminWorkspaceShell>
  );
}

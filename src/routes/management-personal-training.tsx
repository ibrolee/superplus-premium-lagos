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

type Trainer = {
  staff_profile_id: string;
  display_name: string;
  active: boolean;
  sort_order: number;
  coach_type: "in_house" | "part_time";
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
  assignment_source: "management" | "coach_referred" | "member_requested";
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

type CoachReport = {
  id: string;
  membership_id: string;
  member_id: string;
  coach_staff_profile_id: string;
  category: string;
  details: string;
  incident_date: string | null;
  status: "pending" | "reviewed" | "resolved";
  submitted_at: string;
  updated_at: string;
};

type PtPayoutBreakdown = {
  trainer_staff_profile_id: string;
  trainer_name: string;
  trainee_count: number;
  renewal_eligible: number;
  renewed_same_trainer: number;
  renewal_rate: number | null;
  rating_count: number;
  rating_average: number | null;
  performance_index: number;
  team_share: number;
  workload_share: number;
  performance_share: number;
  recommended_payout: number;
};

type PtPartTimeSettlement = {
  coach_staff_profile_id: string;
  coach_name: string;
  eligible_count: number;
  coach_referred_count: number;
  member_requested_count: number;
  non_eligible_count: number;
  manual_amount: number;
};

type PtPayoutRun = {
  id: string;
  payout_month: string;
  payout_pool: number;
  breakdown: PtPayoutBreakdown[];
  part_time_settlements: PtPartTimeSettlement[];
  created_by: string | null;
  updated_at: string;
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
const coachReportCategoryLabel = (value: string) =>
  ({
    training_quality: "Training quality",
    punctuality: "Punctuality / attendance",
    communication: "Communication",
    conduct: "Coach conduct",
    safety: "Safety concern",
    inappropriate_behaviour: "Inappropriate behaviour",
    other: "Other",
  })[value] || value.replaceAll("_", " ");

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
const monthBounds = (month: string) => {
  const start = `${month}-01`;
  const next = new Date(start + "T12:00:00Z");
  next.setUTCMonth(next.getUTCMonth() + 1);
  next.setUTCDate(0);
  return { start, end: next.toISOString().slice(0, 10) };
};

function ManagementPersonalTraining() {
  const [memberships, setMemberships] = useState<PtMembership[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [coachReports, setCoachReports] = useState<CoachReport[]>([]);
  const [payoutRuns, setPayoutRuns] = useState<PtPayoutRun[]>([]);
  const [payoutMonth, setPayoutMonth] = useState(lagosToday().slice(0, 7));
  const [payoutPool, setPayoutPool] = useState("");
  const [partTimeSettlementAmounts, setPartTimeSettlementAmounts] = useState<Record<string, string>>({});
  const [payoutSaving, setPayoutSaving] = useState(false);
  const [payoutMessage, setPayoutMessage] = useState("");
  const [view, setView] = useState<View>("current");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingMembershipId, setSavingMembershipId] = useState<string | null>(null);
  const [savingCoachTypeId, setSavingCoachTypeId] = useState<string | null>(null);
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

    const [membershipResult, trainerResult, assignmentResult, evaluationResult, payoutResult, reportResult] = await Promise.all([
      supabase
        .from("memberships")
        .select("id,member_id,plan_name,start_date,end_date,status,payment_status,created_at")
        .ilike("plan_name", "Personal Training%")
        .order("end_date", { ascending: false })
        .limit(600),
      supabase
        .from("pt_trainers")
        .select("staff_profile_id,display_name,active,sort_order,coach_type")
        .order("sort_order", { ascending: true }),
      supabase
        .from("pt_assignments")
        .select("membership_id,member_id,trainer_staff_profile_id,assignment_source,updated_at")
        .order("updated_at", { ascending: false }),
      supabase
        .from("pt_evaluations")
        .select("membership_id,member_id,trainer_staff_profile_id,overall_rating,professionalism_rating,punctuality_rating,communication_rating,coaching_quality_rating,motivation_rating,program_consistency,comments,continuation_choice,requested_trainer_staff_profile_id,change_reason,management_status,management_note,submitted_at")
        .order("submitted_at", { ascending: false }),
      supabase
        .from("pt_payout_runs")
        .select("id,payout_month,payout_pool,breakdown,part_time_settlements,created_by,updated_at")
        .order("payout_month", { ascending: false })
        .limit(24),
      supabase
        .from("pt_coach_reports")
        .select("id,membership_id,member_id,coach_staff_profile_id,category,details,incident_date,status,submitted_at,updated_at")
        .order("submitted_at", { ascending: false })
        .limit(300),
    ]);

    const firstError =
      membershipResult.error || trainerResult.error || assignmentResult.error || evaluationResult.error || payoutResult.error || reportResult.error;

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

    setMemberships(nextMemberships);
    setMembers(nextMembers);
    setTrainers((trainerResult.data || []) as Trainer[]);
    setAssignments((assignmentResult.data || []) as Assignment[]);
    setEvaluations((evaluationResult.data || []) as Evaluation[]);
    setCoachReports(nextReports);
    setPayoutRuns((payoutResult.data || []) as PtPayoutRun[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const saved = payoutRuns.find((row) => row.payout_month.slice(0, 7) === payoutMonth);
    setPayoutPool(saved ? String(Number(saved.payout_pool)) : "");
    const savedSettlements = saved?.part_time_settlements || [];
    setPartTimeSettlementAmounts(
      Object.fromEntries(
        savedSettlements.map((row) => [row.coach_staff_profile_id, String(Number(row.manual_amount || 0))]),
      ),
    );
  }, [payoutMonth, payoutRuns]);

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
    const ratingReady = count >= 3;
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

  const payoutCalculation = useMemo(() => {
    const activeTrainers = trainers.filter(
      (trainer) => trainer.active && trainer.coach_type === "in_house",
    );
    const { start: monthStart, end: monthEnd } = monthBounds(payoutMonth);
    const pool = Math.max(0, Number(payoutPool || 0));
    const measurementEnd = monthEnd < today ? monthEnd : today;
    const maturedRenewalEnd = addDays(measurementEnd, -7);
    const renewalWindowStart = addDays(maturedRenewalEnd, -89);

    const unassignedMemberIds = new Set(
      memberships
        .filter(
          (row) =>
            row.payment_status === "paid" &&
            row.start_date <= monthEnd &&
            row.end_date >= monthStart &&
            !assignmentMap.has(row.id),
        )
        .map((row) => row.member_id),
    );

    const rawRows = activeTrainers.map((trainer) => {
      const traineeIds = new Set(
        memberships
          .filter(
            (row) =>
              row.payment_status === "paid" &&
              row.start_date <= monthEnd &&
              row.end_date >= monthStart &&
              assignmentMap.get(row.id)?.trainer_staff_profile_id === trainer.staff_profile_id,
          )
          .map((row) => row.member_id),
      );

      const eligibleRenewals = memberships.filter(
        (row) =>
          row.payment_status === "paid" &&
          row.end_date >= renewalWindowStart &&
          row.end_date <= maturedRenewalEnd &&
          assignmentMap.get(row.id)?.trainer_staff_profile_id === trainer.staff_profile_id,
      );

      const renewedSameTrainer = eligibleRenewals.filter((cycle) =>
        memberships.some(
          (candidate) =>
            candidate.id !== cycle.id &&
            candidate.member_id === cycle.member_id &&
            candidate.payment_status === "paid" &&
            candidate.created_at > cycle.created_at &&
            candidate.start_date <= addDays(cycle.end_date, 7) &&
            assignmentMap.get(candidate.id)?.trainer_staff_profile_id === trainer.staff_profile_id,
        ),
      ).length;

      const renewalRate = eligibleRenewals.length
        ? renewedSameTrainer / eligibleRenewals.length
        : null;
      const coachEvaluations = evaluations.filter(
        (row) => row.trainer_staff_profile_id === trainer.staff_profile_id,
      );
      const ratingAverage = coachEvaluations.length
        ? coachEvaluations.reduce((sum, row) => sum + Number(row.overall_rating || 0), 0) /
          coachEvaluations.length
        : null;
      const ratingScore =
        coachEvaluations.length >= 3 && ratingAverage !== null ? ratingAverage / 5 : null;
      const performanceIndex =
        renewalRate !== null && ratingScore !== null
          ? renewalRate * 0.75 + ratingScore * 0.25
          : renewalRate ?? ratingScore;

      return {
        trainer,
        traineeCount: traineeIds.size,
        renewalEligible: eligibleRenewals.length,
        renewedSameTrainer,
        renewalRate,
        ratingCount: coachEvaluations.length,
        ratingAverage,
        rawPerformanceIndex: performanceIndex,
      };
    });

    const measured = rawRows
      .map((row) => row.rawPerformanceIndex)
      .filter((value): value is number => value !== null);
    const neutralPerformance = measured.length
      ? measured.reduce((sum, value) => sum + value, 0) / measured.length
      : 1;
    const workloadTotal = rawRows.reduce((sum, row) => sum + row.traineeCount, 0);
    const performanceTotal = rawRows.reduce(
      (sum, row) => sum + (row.rawPerformanceIndex ?? neutralPerformance),
      0,
    );
    const teamPool = pool * 0.5;
    const workloadPool = pool * 0.3;
    const performancePool = pool * 0.2;

    const rows: PtPayoutBreakdown[] = rawRows.map((row) => {
      const performanceIndex = row.rawPerformanceIndex ?? neutralPerformance;
      const teamShare = activeTrainers.length ? teamPool / activeTrainers.length : 0;
      const workloadShare = workloadTotal
        ? workloadPool * (row.traineeCount / workloadTotal)
        : activeTrainers.length
          ? workloadPool / activeTrainers.length
          : 0;
      const performanceShare = performanceTotal
        ? performancePool * (performanceIndex / performanceTotal)
        : activeTrainers.length
          ? performancePool / activeTrainers.length
          : 0;

      return {
        trainer_staff_profile_id: row.trainer.staff_profile_id,
        trainer_name: row.trainer.display_name,
        trainee_count: row.traineeCount,
        renewal_eligible: row.renewalEligible,
        renewed_same_trainer: row.renewedSameTrainer,
        renewal_rate: row.renewalRate,
        rating_count: row.ratingCount,
        rating_average: row.ratingAverage,
        performance_index: performanceIndex,
        team_share: teamShare,
        workload_share: workloadShare,
        performance_share: performanceShare,
        recommended_payout: teamShare + workloadShare + performanceShare,
      };
    });

    return {
      pool,
      monthStart,
      monthEnd,
      rows,
      unassignedCount: unassignedMemberIds.size,
      workloadTotal,
      maturedRenewalEnd,
      renewalWindowStart,
    };
  }, [trainers, memberships, evaluations, assignmentMap, payoutMonth, payoutPool, today]);

  const partTimeSettlementRows = useMemo(() => {
    const { start: monthStart, end: monthEnd } = monthBounds(payoutMonth);
    return trainers
      .filter((trainer) => trainer.active && trainer.coach_type === "part_time")
      .map((trainer) => {
        const byMember = new Map<string, { membership: PtMembership; assignment: Assignment }>();
        memberships
          .filter(
            (membership) =>
              membership.payment_status === "paid" &&
              membership.start_date <= monthEnd &&
              membership.end_date >= monthStart &&
              assignmentMap.get(membership.id)?.trainer_staff_profile_id === trainer.staff_profile_id,
          )
          .forEach((membership) => {
            const assignment = assignmentMap.get(membership.id);
            if (!assignment) return;
            const current = byMember.get(membership.member_id);
            if (!current || membership.created_at > current.membership.created_at) {
              byMember.set(membership.member_id, { membership, assignment });
            }
          });

        const records = Array.from(byMember.values());
        const eligible = records.filter(({ assignment }) =>
          ["coach_referred", "member_requested"].includes(assignment.assignment_source),
        );
        const coachReferred = eligible.filter(
          ({ assignment }) => assignment.assignment_source === "coach_referred",
        );
        const memberRequested = eligible.filter(
          ({ assignment }) => assignment.assignment_source === "member_requested",
        );
        const nonEligible = records.filter(
          ({ assignment }) => assignment.assignment_source === "management",
        );

        return {
          trainer,
          eligibleCount: eligible.length,
          coachReferredCount: coachReferred.length,
          memberRequestedCount: memberRequested.length,
          nonEligibleCount: nonEligible.length,
          manualAmount: Math.max(0, Number(partTimeSettlementAmounts[trainer.staff_profile_id] || 0)),
          eligibleMembers: eligible.map(({ membership, assignment }) => ({
            member: memberMap.get(membership.member_id),
            source: assignment.assignment_source,
          })),
        };
      });
  }, [trainers, memberships, assignmentMap, memberMap, payoutMonth, partTimeSettlementAmounts]);

  async function savePayoutRun() {
    const partTimeTotal = partTimeSettlementRows.reduce((sum, row) => sum + row.manualAmount, 0);
    if (payoutCalculation.pool <= 0 && partTimeTotal <= 0) {
      setError("Enter an in-house payout pool or a part-time coach settlement amount before saving.");
      return;
    }
    setPayoutSaving(true);
    setError("");
    setPayoutMessage("");
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id || null;
    const { error: saveError } = await supabase.from("pt_payout_runs").upsert(
      {
        payout_month: payoutCalculation.monthStart,
        payout_pool: payoutCalculation.pool,
        team_weight: 0.5,
        workload_weight: 0.3,
        performance_weight: 0.2,
        breakdown: payoutCalculation.rows,
        part_time_settlements: partTimeSettlementRows.map((row) => ({
          coach_staff_profile_id: row.trainer.staff_profile_id,
          coach_name: row.trainer.display_name,
          eligible_count: row.eligibleCount,
          coach_referred_count: row.coachReferredCount,
          member_requested_count: row.memberRequestedCount,
          non_eligible_count: row.nonEligibleCount,
          manual_amount: row.manualAmount,
        })),
        created_by: userId,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "payout_month" },
    );
    if (saveError) {
      setError(saveError.message);
    } else {
      setPayoutMessage("Monthly PT payout calculation saved.");
      await load();
    }
    setPayoutSaving(false);
  }

  async function updateCoachType(trainerId: string, coachType: "in_house" | "part_time") {
    setSavingCoachTypeId(trainerId);
    setError("");
    setMessage("");
    const { error: updateError } = await supabase.rpc("management_set_pt_coach_type", {
      p_staff_profile_id: trainerId,
      p_coach_type: coachType,
    });
    if (updateError) {
      setError(updateError.message);
    } else {
      setMessage(coachType === "part_time" ? "Coach marked as part-time." : "Coach marked as in-house.");
      await load();
    }
    setSavingCoachTypeId(null);
  }

  async function updateAssignmentSource(
    membershipId: string,
    source: "management" | "coach_referred" | "member_requested",
  ) {
    setSavingMembershipId(membershipId);
    setError("");
    setMessage("");
    const { error: updateError } = await supabase.rpc("management_set_pt_assignment_source", {
      p_membership_id: membershipId,
      p_assignment_source: source,
    });
    if (updateError) {
      setError(updateError.message);
    } else {
      setMessage("Part-time coach payout eligibility updated.");
      await load();
    }
    setSavingMembershipId(null);
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
                      Rating is provisional until this coach has at least 3 evaluations.
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
              Monthly PT payout
            </p>
            <h2 className="mt-1 text-xl font-black">Coach payout calculator</h2>
            <p className="mt-1 text-xs text-[#6c7a70]">Monthly coach payout recommendations and saved calculations.</p>
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
            <p className="mt-4 text-xs leading-5 text-[#67776c]">
              Enter the amount management has decided is available to pay PT coaches for the month.
              The calculator recommends a split using 50% equal team share, 30% assigned-trainee workload
              and 20% performance. Cover sessions are not included.
            </p>

            <div className="mt-5 grid gap-3 md:grid-cols-[180px_minmax(0,1fr)_auto] md:items-end">
          <label className="text-xs font-black">
            Payout month
            <input
              type="month"
              max={today.slice(0, 7)}
              value={payoutMonth}
              onChange={(event) => { setPayoutMonth(event.target.value); setPayoutMessage(""); }}
              className="mt-1.5 w-full rounded-xl border border-[#cedbc9] bg-white px-3 py-3 text-sm font-semibold outline-none"
            />
          </label>
          <label className="text-xs font-black">
            Total PT coach payout amount
            <input
              type="number"
              min="0"
              step="1000"
              inputMode="decimal"
              value={payoutPool}
              onChange={(event) => setPayoutPool(event.target.value)}
              placeholder="e.g. 300000"
              className="mt-1.5 w-full rounded-xl border border-[#cedbc9] bg-white px-3 py-3 text-sm font-semibold outline-none"
            />
            <span className="mt-1.5 block font-normal text-[#728077]">
              This is the amount available for coaches after Super Plus has done its own monthly calculations.
            </span>
          </label>
          <button
            type="button"
            disabled={payoutSaving || payoutCalculation.pool <= 0}
            onClick={() => void savePayoutRun()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#193b2a] px-4 py-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save size={15} /> {payoutSaving ? "Saving…" : "Save monthly payout"}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-[#edf5ea] p-3 text-center">
            <p className="text-xl font-black text-[#2f7746]">50%</p>
            <p className="text-[9px] font-black uppercase text-[#65766a]">Equal team share</p>
          </div>
          <div className="rounded-xl bg-[#f3f5ed] p-3 text-center">
            <p className="text-xl font-black text-[#52633f]">30%</p>
            <p className="text-[9px] font-black uppercase text-[#65766a]">Trainee workload</p>
          </div>
          <div className="rounded-xl bg-[#fff6df] p-3 text-center">
            <p className="text-xl font-black text-[#8b6d24]">20%</p>
            <p className="text-[9px] font-black uppercase text-[#756b50]">Performance</p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-[#e1e7dd] bg-[#fafbf8] p-4 text-xs leading-5 text-[#637168]">
          <strong className="text-[#33483a]">Performance rule:</strong> where enough data exists, the performance
          score is 75% matured 90-day same-coach renewal rate and 25% established trainee rating. A rating only
          counts after at least 3 evaluations. PT cycles that expired less than 7 days ago are not treated as
          failed renewals yet. If a coach has no measurable data, the system uses a neutral team-average score.
        </div>

        {payoutCalculation.unassignedCount > 0 && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
            <AlertCircle size={17} className="mt-0.5 shrink-0" />
            <p>
              <strong>{payoutCalculation.unassignedCount} paid PT trainee{payoutCalculation.unassignedCount === 1 ? "" : "s"}</strong>{" "}
              overlap this month without a coach assignment. Assign them before treating the workload split as final.
            </p>
          </div>
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
                    {row.trainee_count} assigned trainee{row.trainee_count === 1 ? "" : "s"} in selected month
                  </p>
                </div>
                <p className="text-xl font-black text-[#193b2a]">{formatMoney(row.recommended_payout)}</p>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-white p-3">
                  <p className="text-sm font-black">{formatMoney(row.team_share)}</p>
                  <p className="mt-1 text-[9px] font-black uppercase text-[#778178]">Team</p>
                </div>
                <div className="rounded-xl bg-white p-3">
                  <p className="text-sm font-black">{formatMoney(row.workload_share)}</p>
                  <p className="mt-1 text-[9px] font-black uppercase text-[#778178]">Workload</p>
                </div>
                <div className="rounded-xl bg-white p-3">
                  <p className="text-sm font-black">{formatMoney(row.performance_share)}</p>
                  <p className="mt-1 text-[9px] font-black uppercase text-[#778178]">Performance</p>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-xs text-[#5f7064]">
                <div className="flex items-center justify-between gap-3">
                  <span>90-day renewal</span>
                  <strong className="text-[#33483a]">
                    {row.renewal_rate === null ? "Not enough matured data" : `${Math.round(row.renewal_rate * 100)}% (${row.renewed_same_trainer}/${row.renewal_eligible})`}
                  </strong>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Trainee rating</span>
                  <strong className="text-[#33483a]">
                    {row.rating_average === null ? "No ratings" : `${row.rating_average.toFixed(1)}/5 · ${row.rating_count} review${row.rating_count === 1 ? "" : "s"}`}
                  </strong>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#193b2a] px-4 py-3 text-white">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[.14em] text-white/65">Management-entered payout pool</p>
            <p className="mt-0.5 text-lg font-black">{formatMoney(payoutCalculation.pool)}</p>
          </div>
          <p className="max-w-md text-right text-[10px] leading-4 text-white/70">
            This is a recommendation for management. Saved monthly calculations can be updated later if assignments or figures change.
          </p>
        </div>
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
                            {trainer.display_name}
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

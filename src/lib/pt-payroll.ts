export type Trainer = {
  staff_profile_id: string;
  display_name: string;
  active: boolean;
  sort_order: number;
  staff_title: string | null;
};

export type Member = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
};

export type PtMembership = {
  id: string;
  member_id: string;
  plan_name: string | null;
  start_date: string;
  end_date: string;
  status: string;
  payment_status: string | null;
  created_at: string;
};

export type Assignment = {
  membership_id: string;
  member_id: string;
  trainer_staff_profile_id: string;
  updated_at: string;
};

export type Evaluation = {
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

export type CoachReport = {
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

export type PtPayoutBreakdown = {
  trainer_staff_profile_id: string;
  trainer_name: string;
  trainee_count: number;
  renewal_eligible: number;
  renewed_same_trainer: number;
  renewal_rate: number | null;
  rating_count: number;
  rating_average: number | null;
  performance_index: number;
  payout_mode?: "full_50_30_20" | "trainee_commission" | "none";
  full_pool_eligible?: boolean;
  trainee_commission?: number;
  payable_membership_count?: number;
  payable_membership_ids?: string[];
  team_share: number;
  workload_share: number;
  performance_share: number;
  recommended_payout: number;
};

export type PtPayoutRun = {
  id: string;
  period_start: string;
  period_end: string;
  pay_date: string;
  auto_payout_pool: number;
  payout_pool: number;
  breakdown: PtPayoutBreakdown[];
  financial_locked?: boolean;
  status: "pending" | "paid";
  paid_at: string | null;
  created_by: string | null;
  updated_at: string;
};

export type View = "current" | "expiring" | "unassigned" | "feedback" | "all";

export const FULL_PAYOUT_MIN_TRAINEES = 3;
export const LOW_VOLUME_TRAINEE_COMMISSION = 10_000;
export const RENEWAL_GRACE_DAYS = 3;
export const RATING_MIN_EVALUATIONS = 2;

export const DAY = 86400000;
export const lagosToday = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const pick = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
};
export const addDays = (value: string, days: number) => {
  const date = new Date(value + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
export const calendarDate = (year: number, monthIndex: number, day: number) =>
  new Date(Date.UTC(year, monthIndex, day, 12)).toISOString().slice(0, 10);
export const payPeriodFromStart = (start: string) => {
  const date = new Date(start + "T12:00:00Z");
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  if (date.getUTCDate() === 1) {
    return {
      start: calendarDate(year, month, 1),
      end: calendarDate(year, month, 15),
      payDate: calendarDate(year, month, 16),
      salaryDay: false,
    };
  }
  const nextMonth = calendarDate(year, month + 1, 1);
  return {
    start: calendarDate(year, month, 16),
    end: addDays(nextMonth, -1),
    payDate: nextMonth,
    salaryDay: true,
  };
};
export const currentPayPeriodStart = () => {
  const today = lagosToday();
  const date = new Date(today + "T12:00:00Z");
  return calendarDate(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() <= 15 ? 1 : 16,
  );
};
export const previousPayPeriodStart = (start: string) => {
  const date = new Date(start + "T12:00:00Z");
  if (date.getUTCDate() === 16) {
    return calendarDate(date.getUTCFullYear(), date.getUTCMonth(), 1);
  }
  return calendarDate(date.getUTCFullYear(), date.getUTCMonth() - 1, 16);
};
export const buildPayPeriodStarts = (count = 14) => {
  const starts: string[] = [];
  let cursor = currentPayPeriodStart();
  for (let index = 0; index < count; index += 1) {
    starts.push(cursor);
    cursor = previousPayPeriodStart(cursor);
  }
  return starts;
};
export const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value + "T12:00:00Z"));
export const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("en-NG", {
    timeZone: "Africa/Lagos",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
export const coachReportCategoryLabel = (value: string) =>
  ({
    training_quality: "Training quality",
    punctuality: "Punctuality / attendance",
    communication: "Communication",
    conduct: "Coach conduct",
    safety: "Safety concern",
    inappropriate_behaviour: "Inappropriate behaviour",
    other: "Other",
  })[value] || value.replaceAll("_", " ");

export const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
export const twoCycleRetentionForCoach = (
  memberships: PtMembership[],
  assignmentMap: Map<string, Assignment>,
  trainerId: string,
  measurementEnd: string,
) => {
  const maturedSecondCycleEnd = addDays(measurementEnd, -RENEWAL_GRACE_DAYS);
  const byMember = new Map<string, PtMembership[]>();

  memberships
    .filter(
      (row) =>
        row.payment_status === "paid" &&
        row.start_date <= measurementEnd,
    )
    .forEach((row) => {
      const current = byMember.get(row.member_id) || [];
      current.push(row);
      byMember.set(row.member_id, current);
    });

  let eligibleClients = 0;
  let retainedClients = 0;

  byMember.forEach((memberCycles) => {
    const cycles = [...memberCycles].sort(
      (a, b) =>
        a.start_date.localeCompare(b.start_date) ||
        a.created_at.localeCompare(b.created_at) ||
        a.id.localeCompare(b.id),
    );

    let eligible = false;
    let retained = false;

    for (let index = 0; index < cycles.length - 1; index += 1) {
      const first = cycles[index];
      const second = cycles[index + 1];
      if (!first || !second) continue;
      if (
        assignmentMap.get(first.id)?.trainer_staff_profile_id !== trainerId ||
        assignmentMap.get(second.id)?.trainer_staff_profile_id !== trainerId ||
        second.end_date <= first.end_date ||
        second.start_date > addDays(first.end_date, RENEWAL_GRACE_DAYS) ||
        second.end_date > maturedSecondCycleEnd
      ) {
        continue;
      }

      eligible = true;
      const third = cycles[index + 2];
      if (
        third &&
        assignmentMap.get(third.id)?.trainer_staff_profile_id === trainerId &&
        third.end_date > second.end_date &&
        third.start_date <= addDays(second.end_date, RENEWAL_GRACE_DAYS)
      ) {
        retained = true;
      }
    }

    if (eligible) eligibleClients += 1;
    if (retained) retainedClients += 1;
  });

  return {
    eligibleClients,
    retainedClients,
    retentionRate: eligibleClients ? retainedClients / eligibleClients : null,
  };
};

export type PtPayoutInput = {
  trainers: Trainer[]; memberships: PtMembership[]; evaluations: Evaluation[];
  assignmentMap: Map<string, Assignment>; payoutPeriodStart: string; payoutPool: string | null;
  payoutRuns: PtPayoutRun[]; selectedPayoutRun: PtPayoutRun | null; today: string;
};
export function calculatePtPayout(input: PtPayoutInput) {
  const { trainers, memberships, evaluations, assignmentMap, payoutPeriodStart, payoutPool, payoutRuns, selectedPayoutRun, today } = input;

    // Paid history must always display the immutable database snapshot.
    if (selectedPayoutRun && (selectedPayoutRun.status === "paid" || selectedPayoutRun.financial_locked)) {
      const rows = selectedPayoutRun.breakdown || [];
      const pool = Number(selectedPayoutRun.payout_pool);
      const autoPool = Number(selectedPayoutRun.auto_payout_pool);
      return {
        pool, autoPool, poolOverridden: Math.abs(pool - autoPool) > 0.01,
        periodStart: selectedPayoutRun.period_start,
        periodEnd: selectedPayoutRun.period_end,
        payDate: selectedPayoutRun.pay_date,
        rows,
        fullEligibleCount: rows.filter((row) => row.full_pool_eligible).length,
        commissionTotal: rows.reduce((sum, row) => sum + Number(row.trainee_commission || 0), 0),
        totalRecommended: rows.reduce((sum, row) => sum + Number(row.recommended_payout || 0), 0),
        unassignedCount: 0,
        measurementEnd: selectedPayoutRun.period_end,
      };
    }
    const activeTrainers = trainers.filter(
      (trainer) =>
        trainer.active &&
        trainer.staff_title?.trim().toLowerCase() === "in-house coach",
    );
    const periodStart = payoutPeriodStart;
    const period = payPeriodFromStart(periodStart);
    const periodEnd = period.end;
    const payDate = period.payDate;
    const measurementEnd = periodEnd < today ? periodEnd : today;
    const measurementCutoff = new Date(`${measurementEnd}T23:59:59+01:00`).getTime();

    const previouslyPaidMembershipIds = new Set(
      payoutRuns
        .filter((run) => run.period_start !== periodStart)
        .flatMap((run) =>
          (run.breakdown || []).flatMap((row) => row.payable_membership_ids || []),
        ),
    );

    const unassignedMemberIds = new Set(
      memberships
        .filter(
          (row) =>
            row.payment_status === "paid" &&
            row.start_date <= measurementEnd &&
            row.end_date >= periodStart &&
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
              row.start_date <= measurementEnd &&
              row.end_date >= periodStart &&
              assignmentMap.get(row.id)?.trainer_staff_profile_id === trainer.staff_profile_id,
          )
          .map((row) => row.member_id),
      );

      const payableMembershipIds = memberships
        .filter(
          (row) =>
            row.payment_status === "paid" &&
            row.start_date >= periodStart &&
            row.start_date <= measurementEnd &&
            !previouslyPaidMembershipIds.has(row.id) &&
            assignmentMap.get(row.id)?.trainer_staff_profile_id === trainer.staff_profile_id,
        )
        .map((row) => row.id);

      const twoCycleRetention = twoCycleRetentionForCoach(
        memberships,
        assignmentMap,
        trainer.staff_profile_id,
        measurementEnd,
      );
      const renewalRate = twoCycleRetention.retentionRate;
      const coachEvaluations = evaluations.filter(
        (row) =>
          row.trainer_staff_profile_id === trainer.staff_profile_id &&
          new Date(row.submitted_at).getTime() <= measurementCutoff,
      );
      const ratingAverage = coachEvaluations.length
        ? coachEvaluations.reduce((sum, row) => sum + Number(row.overall_rating || 0), 0) /
          coachEvaluations.length
        : null;
      const ratingScore =
        coachEvaluations.length >= RATING_MIN_EVALUATIONS && ratingAverage !== null
          ? ratingAverage / 5
          : null;
      const performanceIndex =
        renewalRate !== null && ratingScore !== null
          ? renewalRate * 0.75 + ratingScore * 0.25
          : renewalRate ?? ratingScore;

      return {
        trainer,
        traineeCount: traineeIds.size,
        renewalEligible: twoCycleRetention.eligibleClients,
        renewedSameTrainer: twoCycleRetention.retainedClients,
        renewalRate,
        ratingCount: coachEvaluations.length,
        ratingAverage,
        payableMembershipIds,
        rawPerformanceIndex: performanceIndex,
      };
    });

    const fullEligibleRows = rawRows.filter(
      (row) => row.traineeCount >= FULL_PAYOUT_MIN_TRAINEES,
    );

    const autoPool =
      fullEligibleRows.reduce(
        (sum, row) => sum + row.payableMembershipIds.length,
        0,
      ) * LOW_VOLUME_TRAINEE_COMMISSION;

    const savedOverride = selectedPayoutRun &&
      Math.abs(Number(selectedPayoutRun.payout_pool) - Number(selectedPayoutRun.auto_payout_pool)) > 0.01;
    const defaultPool = savedOverride ? Number(selectedPayoutRun.payout_pool) : autoPool;
    const pool = Math.max(
      0,
      payoutPool === null ? defaultPool : Number(payoutPool || 0),
    );

    const measured = fullEligibleRows
      .map((row) => row.rawPerformanceIndex)
      .filter((value): value is number => value !== null);
    const neutralPerformance = measured.length
      ? measured.reduce((sum, value) => sum + value, 0) / measured.length
      : 1;
    const workloadTotal = fullEligibleRows.reduce((sum, row) => sum + row.traineeCount, 0);
    const performanceTotal = fullEligibleRows.reduce(
      (sum, row) => sum + (row.rawPerformanceIndex ?? neutralPerformance),
      0,
    );
    const teamPool = pool * 0.5;
    const workloadPool = pool * 0.3;
    const performancePool = pool * 0.2;

    const rows: PtPayoutBreakdown[] = rawRows.map((row) => {
      const fullPoolEligible = row.traineeCount >= FULL_PAYOUT_MIN_TRAINEES;
      const performanceIndex = row.rawPerformanceIndex ?? neutralPerformance;
      const traineeCommission = fullPoolEligible
        ? 0
        : row.payableMembershipIds.length * LOW_VOLUME_TRAINEE_COMMISSION;
      const teamShare =
        fullPoolEligible && fullEligibleRows.length
          ? teamPool / fullEligibleRows.length
          : 0;
      const workloadShare =
        fullPoolEligible && workloadTotal
          ? workloadPool * (row.traineeCount / workloadTotal)
          : 0;
      const performanceShare =
        fullPoolEligible
          ? performanceTotal
            ? performancePool * (performanceIndex / performanceTotal)
            : fullEligibleRows.length
              ? performancePool / fullEligibleRows.length
              : 0
          : 0;
      const recommendedPayout = fullPoolEligible
        ? teamShare + workloadShare + performanceShare
        : traineeCommission;

      return {
        trainer_staff_profile_id: row.trainer.staff_profile_id,
        trainer_name: row.trainer.display_name,
        trainee_count: row.traineeCount,
        renewal_eligible: row.renewalEligible,
        renewed_same_trainer: row.renewedSameTrainer,
        renewal_rate: row.renewalRate,
        rating_count: row.ratingCount,
        rating_average: row.ratingAverage,
        performance_index: fullPoolEligible ? performanceIndex : 0,
        payout_mode:
          fullPoolEligible
            ? "full_50_30_20"
            : row.payableMembershipIds.length > 0
              ? "trainee_commission"
              : "none",
        full_pool_eligible: fullPoolEligible,
        trainee_commission: traineeCommission,
        payable_membership_count: row.payableMembershipIds.length,
        payable_membership_ids: row.payableMembershipIds,
        team_share: teamShare,
        workload_share: workloadShare,
        performance_share: performanceShare,
        recommended_payout: recommendedPayout,
      };
    });

    return {
      pool,
      autoPool,
      poolOverridden: Math.abs(pool - autoPool) > 0.01,
      periodStart,
      periodEnd,
      payDate,
      rows,
      fullEligibleCount: fullEligibleRows.length,
      commissionTotal: rows.reduce((sum, row) => sum + Number(row.trainee_commission || 0), 0),
      totalRecommended: rows.reduce((sum, row) => sum + row.recommended_payout, 0),
      unassignedCount: unassignedMemberIds.size,
      measurementEnd,
    };
}

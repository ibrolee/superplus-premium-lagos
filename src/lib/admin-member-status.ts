export type DirectoryPlan = {
  id: string;
  member_id: string;
  plan_name: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  payment_status: string | null;
};
export function memberPlanSummary(plans: DirectoryPlan[], today: string) {
  const sorted = [...plans].sort((a, b) => (b.end_date || "").localeCompare(a.end_date || ""));
  const paid = (p: DirectoryPlan) =>
    p.payment_status?.toLowerCase() === "paid" && p.status?.toLowerCase() === "active";
  const current = sorted.filter(
    (p) =>
      paid(p) &&
      !!p.start_date &&
      !!p.end_date &&
      p.start_date.slice(0, 10) <= today &&
      p.end_date.slice(0, 10) >= today,
  );
  const upcoming = sorted.find(
    (p) => paid(p) && !!p.start_date && p.start_date.slice(0, 10) > today,
  );
  const plan = current[0] || upcoming || sorted[0];
  const cutoff = new Date(`${today}T12:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() + 7);
  const expiring =
    !!current[0]?.end_date &&
    current[0].end_date.slice(0, 10) <= cutoff.toISOString().slice(0, 10) &&
    !upcoming;
  const status = current.length
    ? expiring
      ? "expiring"
      : "active"
    : upcoming
      ? "upcoming"
      : !plan
        ? "none"
        : plan.status?.toLowerCase() === "paused"
          ? "paused"
          : plan.end_date && plan.end_date.slice(0, 10) < today
            ? "expired"
            : "other";
  const labels: Record<string, string> = {
    active: "Active",
    expiring: "Expiring soon",
    upcoming: "Starts soon",
    none: "No plan",
    paused: "Paused",
    expired: "Expired",
    other: "Review plan",
  };
  return {
    status,
    label: labels[status],
    plan:
      current.length > 1 ? `${current.length} active plans` : plan?.plan_name || "No membership",
    expiry: plan?.end_date?.slice(0, 10) || null,
  };
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  DollarSign,
  LogOut,
  RefreshCw,
  ShieldCheck,
  UserRound,
  XCircle,
  TrendingUp,
  ChevronDown,
  Pencil,
  Save,
  X,
  FileText,
  Trash2,
  Users,
  CalendarDays,
  LayoutDashboard,
  Menu,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { Button } from "../components/ui/button";

type StaffProfile = {
  id: string;
  auth_user_id: string;
  staff_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  birth_day: number | null;
  birth_month: number | null;
  address: string | null;
  position: string | null;
  department: string | null;
  employment_type: string | null;
  employment_date: string | null;
  role: string;
  status: "pending" | "approved" | "suspended" | "inactive";
  created_at: string;
};

type SalaryRecord = {
  id: string;
  staff_profile_id: string;
  amount: number;
  currency: string;
  pay_period_start: string | null;
  pay_period_end: string | null;
  payment_date: string | null;
  status: "pending" | "paid" | "cancelled";
  notes: string | null;
  created_at: string;
};

type AttendanceRecord = {
  id: string;
  checked_in_at: string;
  checked_out_at: string | null;
  notes: string | null;
};

type RevenuePayment = {
  id: string;
  member_id: string | null;
  membership_id: string | null;
  amount: number;
  currency: string;
  status: string;
  payment_method: string | null;
  provider: string;
  paystack_reference: string | null;
  paid_at: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

type RevenueMember = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
};

type RevenueMembership = {
  id: string;
  plan_name: string | null;
};

type RevenuePaymentRow = RevenuePayment & {
  member: RevenueMember | null;
  membership: RevenueMembership | null;
};

type PaymentSource =
  | "all"
  | "website"
  | "cash"
  | "pos"
  | "bank_transfer";

const roles = [
  { value: "staff", label: "Staff" },
  { value: "reception", label: "Reception" },
  { value: "trainer", label: "Trainer" },
  { value: "spa_staff", label: "Spa Staff" },
  { value: "manager", label: "Manager" },
  { value: "admin", label: "Admin" },
];

const departments = [
  "Management",
  "Reception",
  "Fitness",
  "Personal Training",
  "Spa",
  "Cleaning",
  "Security",
  "Marketing",
  "Administration",
  "Other",
];

const employmentTypes = [
  "Full Time",
  "Part Time",
  "Contract",
  "Casual",
];

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00`));
}

function formatTimeOnly(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-NG", { timeZone: "Africa/Lagos", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(value));
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

function formatMoney(amount: number, currency = "NGN") {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

function statusLabel(status: StaffProfile["status"]) {
  switch (status) {
    case "approved":
      return "Approved";
    case "suspended":
      return "Suspended";
    case "inactive":
      return "Inactive";
    default:
      return "Pending";
  }
}

function statusClass(status: StaffProfile["status"]) {
  switch (status) {
    case "approved":
      return "border-green-500/30 bg-green-500/10 text-green-700";
    case "suspended":
      return "border-red-500/30 bg-red-500/10 text-red-700";
    case "inactive":
      return "border-gray-400/30 bg-gray-400/10 text-gray-600";
    default:
      return "border-orange-500/30 bg-orange-500/10 text-orange-700";
  }
}

function getPaymentPlan(payment: RevenuePaymentRow) {
  const membershipPlan = payment.membership?.plan_name;

  if (membershipPlan) return membershipPlan;

  const metadataPlan = payment.metadata?.plan_name;

  if (typeof metadataPlan === "string" && metadataPlan.trim()) {
    return metadataPlan;
  }

  return "Membership";
}

function getPaymentMemberName(payment: RevenuePaymentRow) {
  if (payment.member?.full_name) {
    return payment.member.full_name;
  }

  const metadataName = payment.metadata?.full_name;

  if (typeof metadataName === "string" && metadataName.trim()) {
    return metadataName;
  }

  return "Unknown Member";
}

function getPaymentDate(payment: RevenuePaymentRow) {
  return payment.paid_at || payment.created_at;
}

function normalizePaymentValue(value: unknown) {
  if (typeof value !== "string") return "";

  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function getPaymentSource(
  payment: RevenuePaymentRow,
): Exclude<PaymentSource, "all"> | "other" {
  const method = normalizePaymentValue(
    payment.payment_method,
  );

  const provider = normalizePaymentValue(payment.provider);

  const metadataMethod = normalizePaymentValue(
    payment.metadata?.payment_method,
  );

  const metadataSource = normalizePaymentValue(
    payment.metadata?.payment_source,
  );

  const metadataProvider = normalizePaymentValue(
    payment.metadata?.provider,
  );

  const candidates = [
    method,
    provider,
    metadataMethod,
    metadataSource,
    metadataProvider,
  ];

  // Website / online payments.
  // Paystack is treated as a website payment regardless of whether
  // the payment_method says card, online, Paystack, etc.
  if (
    candidates.some((value) =>
      [
        "paystack",
        "online",
        "online payment",
        "website",
        "card",
        "card payment",
      ].includes(value),
    )
  ) {
    return "website";
  }

  // Manual payment methods.
  if (candidates.includes("cash")) {
    return "cash";
  }

  if (
    candidates.includes("pos") ||
    candidates.includes("point of sale")
  ) {
    return "pos";
  }

  if (
    candidates.includes("bank transfer") ||
    candidates.includes("bank")
  ) {
    return "bank_transfer";
  }

  return "other";
}

function getPaymentSourceLabel(
  payment: RevenuePaymentRow,
) {
  const source = getPaymentSource(payment);

  switch (source) {
    case "website":
      return "Website";
    case "cash":
      return "Cash";
    case "pos":
      return "POS";
    case "bank_transfer":
      return "Bank Transfer";
    default:
      return "Other";
  }
}

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function startOfWeek(date: Date) {
  const result = startOfDay(date);
  const day = result.getDay();
  const difference = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + difference);
  return result;
}

function startOfMonth(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    1,
    0,
    0,
    0,
    0,
  );
}

function isSameDay(first: Date, second: Date) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function RevenueReport({
  payments,
  loading,
  onRefresh,
}: {
  payments: RevenuePaymentRow[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const [period, setPeriod] = useState<
    "today" | "week" | "month" | "all"
  >("month");

  const [paymentSource, setPaymentSource] =
    useState<PaymentSource>("all");

  const [paymentSearch, setPaymentSearch] = useState("");

  const now = new Date();

  const periodStart = useMemo(() => {
    switch (period) {
      case "today":
        return startOfDay(now);
      case "week":
        return startOfWeek(now);
      case "month":
        return startOfMonth(now);
      default:
        return null;
    }
  }, [period]);

  const sourcePayments = useMemo(() => {
    return payments.filter((payment) => {
      if (payment.status.toLowerCase() !== "success") {
        return false;
      }

      if (paymentSource === "all") {
        return true;
      }

      return getPaymentSource(payment) === paymentSource;
    });
  }, [payments, paymentSource]);

  const periodPayments = useMemo(() => {
    return sourcePayments.filter((payment) => {
      if (!periodStart) return true;

      return (
        new Date(getPaymentDate(payment)) >= periodStart
      );
    });
  }, [sourcePayments, periodStart]);

  const totalRevenue = useMemo(
    () =>
      periodPayments.reduce(
        (total, payment) =>
          total + Number(payment.amount || 0),
        0,
      ),
    [periodPayments],
  );

  const todayRevenue = useMemo(
    () =>
      sourcePayments
        .filter((payment) =>
          isSameDay(
            new Date(getPaymentDate(payment)),
            now,
          ),
        )
        .reduce(
          (total, payment) =>
            total + Number(payment.amount || 0),
          0,
        ),
    [sourcePayments, now],
  );

  const monthRevenue = useMemo(() => {
    const monthStart = startOfMonth(now);

    return sourcePayments
      .filter(
        (payment) =>
          new Date(getPaymentDate(payment)) >= monthStart,
      )
      .reduce(
        (total, payment) =>
          total + Number(payment.amount || 0),
        0,
      );
  }, [sourcePayments, now]);

  const averagePayment =
    periodPayments.length > 0
      ? totalRevenue / periodPayments.length
      : 0;

  const revenueByPlan = useMemo(() => {
    const grouped = new Map<
      string,
      {
        plan: string;
        amount: number;
        count: number;
      }
    >();

    periodPayments.forEach((payment) => {
      const plan = getPaymentPlan(payment);
      const existing = grouped.get(plan);

      if (existing) {
        existing.amount += Number(payment.amount || 0);
        existing.count += 1;
      } else {
        grouped.set(plan, {
          plan,
          amount: Number(payment.amount || 0),
          count: 1,
        });
      }
    });

    return Array.from(grouped.values()).sort(
      (a, b) => b.amount - a.amount,
    );
  }, [periodPayments]);

  const filteredPayments = useMemo(() => {
    const query = paymentSearch.trim().toLowerCase();

    return periodPayments
      .filter((payment) => {
        if (!query) return true;

        const memberName =
          getPaymentMemberName(payment).toLowerCase();

        const email =
          payment.member?.email?.toLowerCase() || "";

        const phone =
          payment.member?.phone?.toLowerCase() || "";

        const reference =
          payment.paystack_reference?.toLowerCase() || "";

        const plan = getPaymentPlan(payment).toLowerCase();

        const source =
          getPaymentSourceLabel(payment).toLowerCase();

        const method =
          payment.payment_method?.toLowerCase() || "";

        return (
          memberName.includes(query) ||
          email.includes(query) ||
          phone.includes(query) ||
          reference.includes(query) ||
          plan.includes(query) ||
          source.includes(query) ||
          method.includes(query)
        );
      })
      .sort(
        (a, b) =>
          new Date(getPaymentDate(b)).getTime() -
          new Date(getPaymentDate(a)).getTime(),
      );
  }, [periodPayments, paymentSearch]);

  return (
    <details id="revenue-panel" className="group min-w-0 overflow-hidden border border-border bg-card">
      <summary className="flex min-w-0 cursor-pointer list-none items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden sm:gap-4 sm:p-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted sm:h-11 sm:w-11">
            <TrendingUp className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Admin
            </p>

            <h2 className="mt-1 truncate font-display text-xl font-bold uppercase sm:text-2xl">
              Revenue Report
            </h2>

            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground sm:text-sm">
              Track successful membership payments and revenue.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:inline">
            Open
          </span>

          <ChevronDown className="h-5 w-5 transition-transform group-open:rotate-180" />
        </div>
      </summary>

      <div className="min-w-0 border-t border-border">
        <div className="min-w-0 border-b border-border p-4 sm:p-6">
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-3">
                <TrendingUp className="h-5 w-5 shrink-0" />

                <div className="min-w-0">
                  <h2 className="font-display text-xl font-bold uppercase sm:text-2xl">
                    Revenue Report
                  </h2>

                  <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                    Track successful membership payments and revenue.
                  </p>
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={onRefresh}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh Revenue
            </Button>
          </div>

          <div className="mt-5 grid min-w-0 gap-2 sm:mt-6 sm:flex sm:flex-wrap">
            {[
              ["today", "Today"],
              ["week", "This Week"],
              ["month", "This Month"],
              ["all", "All Time"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() =>
                  setPeriod(
                    value as
                      | "today"
                      | "week"
                      | "month"
                      | "all",
                  )
                }
                className={`min-w-0 border px-3 py-2.5 text-xs font-semibold uppercase sm:px-4 sm:py-2 ${
                  period === value
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-5 border-t border-border pt-5">
            <div className="mb-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Payment Source
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Filter revenue by how the payment was received.
              </p>
            </div>

            <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {[
                ["all", "All Payments"],
                ["website", "Website"],
                ["cash", "Cash"],
                ["pos", "POS"],
                ["bank_transfer", "Bank Transfer"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setPaymentSource(
                      value as PaymentSource,
                    )
                  }
                  className={`min-w-0 border px-3 py-2.5 text-xs font-semibold uppercase sm:px-4 sm:py-2 ${
                    paymentSource === value
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="min-w-0 p-4 sm:p-6">
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            <div className="min-w-0 overflow-hidden border border-border bg-background p-4 sm:p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Revenue
              </p>

              <p className="mt-3 break-all text-2xl font-bold sm:text-3xl">
                {formatMoney(totalRevenue)}
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Selected period
              </p>
            </div>

            <div className="min-w-0 overflow-hidden border border-border bg-background p-4 sm:p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Today
              </p>

              <p className="mt-3 break-all text-2xl font-bold sm:text-3xl">
                {formatMoney(todayRevenue)}
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Successful payments today
              </p>
            </div>

            <div className="min-w-0 overflow-hidden border border-border bg-background p-4 sm:p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Payments
              </p>

              <p className="mt-3 text-2xl font-bold sm:text-3xl">
                {periodPayments.length}
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Successful transactions
              </p>
            </div>

            <div className="min-w-0 overflow-hidden border border-border bg-background p-4 sm:p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Average Payment
              </p>

              <p className="mt-3 break-all text-2xl font-bold sm:text-3xl">
                {formatMoney(averagePayment)}
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Average per successful payment
              </p>
            </div>
          </div>

          <div className="mt-4 grid min-w-0 gap-4 lg:mt-6 lg:grid-cols-[1fr_1.4fr] lg:gap-6">
            <div className="min-w-0 overflow-hidden border border-border bg-background p-4 sm:p-5">
              <h3 className="font-display text-lg font-bold uppercase sm:text-xl">
                Revenue by Plan
              </h3>

              <div className="mt-5 min-w-0">
                {revenueByPlan.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No successful payments in this period.
                  </p>
                ) : (
                  <div className="min-w-0 space-y-3">
                    {revenueByPlan.map((item) => {
                      const percentage =
                        totalRevenue > 0
                          ? (item.amount / totalRevenue) * 100
                          : 0;

                      return (
                        <div
                          key={item.plan}
                          className="min-w-0 border-b border-border pb-3 last:border-0"
                        >
                          <div className="flex min-w-0 items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="break-words font-semibold">
                                {item.plan}
                              </p>

                              <p className="mt-1 text-xs text-muted-foreground">
                                {item.count} payment
                                {item.count === 1 ? "" : "s"}
                              </p>
                            </div>

                            <p className="shrink-0 break-all text-right text-sm font-bold sm:text-base">
                              {formatMoney(item.amount)}
                            </p>
                          </div>

                          <div className="mt-3 h-2 overflow-hidden bg-muted">
                            <div
                              className="h-full bg-foreground"
                              style={{
                                width: `${Math.min(
                                  100,
                                  Math.max(0, percentage),
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mt-6 border-t border-border pt-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    This Month
                  </span>

                  <span className="shrink-0 text-sm font-bold sm:text-base">
                    {formatMoney(monthRevenue)}
                  </span>
                </div>
              </div>
            </div>

            <div className="min-w-0 overflow-hidden border border-border bg-background p-4 sm:p-5">
              <div className="flex min-w-0 flex-col gap-4">
                <div className="min-w-0">
                  <h3 className="font-display text-lg font-bold uppercase sm:text-xl">
                    Payment Transactions
                  </h3>

                  <p className="mt-1 text-xs text-muted-foreground">
                    {periodPayments.length} successful payment
                    {periodPayments.length === 1 ? "" : "s"}
                  </p>
                </div>

                <input
                  value={paymentSearch}
                  onChange={(event) =>
                    setPaymentSearch(event.target.value)
                  }
                  placeholder="Search payments..."
                  className="h-10 w-full min-w-0 border border-border bg-background px-3 text-sm outline-none focus:border-foreground"
                />
              </div>

              <div className="mt-5 min-w-0">
                {loading ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Loading payment records...
                  </p>
                ) : filteredPayments.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No successful payment records found.
                  </p>
                ) : (
                  <>
                    <div className="space-y-3 md:hidden">
                      {filteredPayments.map((payment) => (
                        <div
                          key={payment.id}
                          className="min-w-0 overflow-hidden border border-border bg-card p-4"
                        >
                          <div className="flex min-w-0 items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="break-words font-semibold">
                                {getPaymentMemberName(payment)}
                              </p>

                              {payment.member?.email && (
                                <p className="mt-1 break-all text-xs text-muted-foreground">
                                  {payment.member.email}
                                </p>
                              )}
                            </div>

                            <p className="shrink-0 text-right text-sm font-bold">
                              {formatMoney(
                                Number(payment.amount || 0),
                                payment.currency || "NGN",
                              )}
                            </p>
                          </div>

                          <div className="mt-4 grid min-w-0 grid-cols-2 gap-x-4 gap-y-4 border-t border-border pt-4">
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                                Plan
                              </p>

                              <p className="mt-1 break-words text-sm font-medium">
                                {getPaymentPlan(payment)}
                              </p>
                            </div>

                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                                Source
                              </p>

                              <p className="mt-1 break-words text-sm font-medium">
                                {getPaymentSourceLabel(payment)}
                              </p>
                            </div>

                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                                Method
                              </p>

                              <p className="mt-1 break-words text-sm capitalize">
                                {payment.payment_method || "Paystack"}
                              </p>
                            </div>

                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                                Date
                              </p>

                              <p className="mt-1 break-words text-sm">
                                {formatDateTime(
                                  getPaymentDate(payment),
                                )}
                              </p>
                            </div>

                            <div className="min-w-0 col-span-2">
                              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                                Reference
                              </p>

                              <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">
                                {payment.paystack_reference || "—"}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="hidden min-w-0 overflow-x-auto md:block">
                      <table className="w-full min-w-[950px] text-left text-sm">
                        <thead>
                          <tr className="border-b border-border text-xs uppercase tracking-widest text-muted-foreground">
                            <th className="px-3 py-3">Member</th>
                            <th className="px-3 py-3">Plan</th>
                            <th className="px-3 py-3">Amount</th>
                            <th className="px-3 py-3">Source</th>
                            <th className="px-3 py-3">Method</th>
                            <th className="px-3 py-3">Date</th>
                            <th className="px-3 py-3">Reference</th>
                          </tr>
                        </thead>

                        <tbody>
                          {filteredPayments.map((payment) => (
                            <tr
                              key={payment.id}
                              className="border-b border-border"
                            >
                              <td className="max-w-[220px] px-3 py-4">
                                <p className="break-words font-semibold">
                                  {getPaymentMemberName(payment)}
                                </p>

                                {payment.member?.email && (
                                  <p className="mt-1 break-all text-xs text-muted-foreground">
                                    {payment.member.email}
                                  </p>
                                )}
                              </td>

                              <td className="max-w-[160px] break-words px-3 py-4">
                                {getPaymentPlan(payment)}
                              </td>

                              <td className="whitespace-nowrap px-3 py-4 font-bold">
                                {formatMoney(
                                  Number(payment.amount || 0),
                                  payment.currency || "NGN",
                                )}
                              </td>

                              <td className="whitespace-nowrap px-3 py-4 font-medium">
                                {getPaymentSourceLabel(payment)}
                              </td>

                              <td className="px-3 py-4 capitalize">
                                {payment.payment_method || "Paystack"}
                              </td>

                              <td className="whitespace-nowrap px-3 py-4">
                                {formatDateTime(
                                  getPaymentDate(payment),
                                )}
                              </td>

                              <td className="max-w-[180px] px-3 py-4">
                                <span className="break-all font-mono text-xs">
                                  {payment.paystack_reference || "—"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </details>
  );
}

function StaffAdminPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [revenueLoading, setRevenueLoading] = useState(true);
  const [revenuePayments, setRevenuePayments] = useState<RevenuePaymentRow[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffProfile | null>(null);
  const [salaryRecords, setSalaryRecords] = useState<SalaryRecord[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [allAttendance, setAllAttendance] = useState<Array<AttendanceRecord & { staff_profile_id: string }>>([]);
  const [attendanceDate, setAttendanceDate] = useState(() => {
    const now = new Date();
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "suspended" | "inactive">("all");
  const [showSalaryForm, setShowSalaryForm] = useState(false);
  const [position, setPosition] = useState("");
  const [department, setDepartment] = useState("");
  const [employmentType, setEmploymentType] = useState("Full Time");
  const [employmentDate, setEmploymentDate] = useState("");
  const [role, setRole] = useState("staff");
  const [editingPersonalInfo, setEditingPersonalInfo] = useState(false);
  const [personalFullName, setPersonalFullName] = useState("");
  const [personalPhone, setPersonalPhone] = useState("");
  const [personalBirthDay, setPersonalBirthDay] = useState("");
  const [personalBirthMonth, setPersonalBirthMonth] = useState("");
  const [personalAddress, setPersonalAddress] = useState("");
  const [salaryAmount, setSalaryAmount] = useState("");
  const [salaryStart, setSalaryStart] = useState("");
  const [salaryEnd, setSalaryEnd] = useState("");
  const [salaryPaymentDate, setSalaryPaymentDate] = useState("");
  const [salaryStatus, setSalaryStatus] = useState<"pending" | "paid" | "cancelled">("pending");
  const [salaryNotes, setSalaryNotes] = useState("");

  async function verifyAdmin() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/staff";
      return false;
    }
    const { data, error: adminError } = await supabase.from("staff_users").select("id, role, active").eq("auth_user_id", user.id).maybeSingle();
    if (adminError) {
      setError(adminError.message);
      return false;
    }
    const isAdmin = data?.active === true && ["admin", "owner", "manager"].includes(String(data.role).toLowerCase());
    if (!isAdmin) {
      setError("You do not have permission to access staff management.");
      return false;
    }
    return true;
  }

  const REVENUE_START = new Date("2026-09-16T12:01:18.000Z");

  async function loadRevenue() {
    setRevenueLoading(true);
    try {
      const { data: paymentData, error: paymentError } = await supabase.from("payments").select(`id, member_id, membership_id, amount, currency, status, payment_method, provider, paystack_reference, paid_at, created_at, metadata`).eq("status", "success").order("paid_at", { ascending: false, nullsFirst: false }).limit(2000);
      if (paymentError) {
        setError(paymentError.message);
        setRevenuePayments([]);
        return;
      }
      const payments = ((paymentData || []) as RevenuePayment[]).filter((payment) => new Date(payment.paid_at || payment.created_at) >= REVENUE_START);
      if (!payments.length) {
        setRevenuePayments([]);
        return;
      }
      const memberIds = Array.from(new Set(payments.map((p) => p.member_id).filter((id): id is string => typeof id === "string" && id.length > 0)));
      const membershipIds = Array.from(new Set(payments.map((p) => p.membership_id).filter((id): id is string => typeof id === "string" && id.length > 0)));
      let members: RevenueMember[] = [];
      let memberships: RevenueMembership[] = [];
      if (memberIds.length) {
        const { data } = await supabase.from("members").select("id, full_name, email, phone").in("id", memberIds);
        members = (data || []) as RevenueMember[];
      }
      if (membershipIds.length) {
        const { data } = await supabase.from("memberships").select("id, plan_name").in("id", membershipIds);
        memberships = (data || []) as RevenueMembership[];
      }
      const memberMap = new Map(members.map((m) => [m.id, m]));
      const membershipMap = new Map(memberships.map((m) => [m.id, m]));
      setRevenuePayments(payments.map((payment) => ({ ...payment, member: payment.member_id ? memberMap.get(payment.member_id) || null : null, membership: payment.membership_id ? membershipMap.get(payment.membership_id) || null : null })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load revenue records.");
      setRevenuePayments([]);
    } finally {
      setRevenueLoading(false);
    }
  }

  async function loadStaff() {
    setLoading(true);
    setError("");
    const allowed = await verifyAdmin();
    if (!allowed) {
      setLoading(false);
      return;
    }
    const { data, error: staffError } = await supabase.from("staff_profiles").select(`id, auth_user_id, staff_id, full_name, email, phone, birth_day, birth_month, address, position, department, employment_type, employment_date, role, status, created_at`).order("created_at", { ascending: false });
    if (staffError) {
      setError(staffError.message);
      setLoading(false);
      return;
    }
    setStaff((data || []) as StaffProfile[]);
    setLoading(false);
  }

  function lagosDateBounds(date: string) {
    const start = new Date(`${date}T00:00:00+01:00`);
    const end = new Date(`${date}T00:00:00+01:00`);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }

  async function loadAllAttendance(date = attendanceDate) {
    const { start, end } = lagosDateBounds(date);
    const { data, error: attendanceError } = await supabase.from("staff_attendance").select("id, staff_profile_id, checked_in_at, checked_out_at, notes").gte("checked_in_at", start.toISOString()).lt("checked_in_at", end.toISOString()).order("checked_in_at", { ascending: false }).limit(2000);
    if (attendanceError) {
      setError(attendanceError.message);
      return;
    }
    setAllAttendance((data || []) as Array<AttendanceRecord & { staff_profile_id: string }>);
  }

  async function refreshAll() {
    setError("");
    await Promise.all([loadStaff(), loadRevenue(), loadAllAttendance()]);
  }

  async function loadStaffDetails(profile: StaffProfile) {
    setSelectedStaff(profile);
    setError("");
    setSuccess("");
    setPosition(profile.position || "");
    setDepartment(profile.department || "");
    setEmploymentType(profile.employment_type || "Full Time");
    setEmploymentDate(profile.employment_date || "");
    setRole(profile.role || "staff");
    setPersonalFullName(profile.full_name || "");
    setPersonalPhone(profile.phone || "");
    setPersonalBirthDay(profile.birth_day ? String(profile.birth_day) : "");
    setPersonalBirthMonth(profile.birth_month ? String(profile.birth_month) : "");
    setPersonalAddress(profile.address || "");
    setEditingPersonalInfo(false);
    setShowSalaryForm(false);
    const [salaryResult, attendanceResult] = await Promise.all([
      supabase.from("staff_salary_records").select("id, staff_profile_id, amount, currency, pay_period_start, pay_period_end, payment_date, status, notes, created_at").eq("staff_profile_id", profile.id).order("created_at", { ascending: false }),
      supabase.from("staff_attendance").select("id, checked_in_at, checked_out_at, notes").eq("staff_profile_id", profile.id).order("checked_in_at", { ascending: false }).limit(50),
    ]);
    if (salaryResult.error) { setError(salaryResult.error.message); return; }
    if (attendanceResult.error) { setError(attendanceResult.error.message); return; }
    setSalaryRecords((salaryResult.data || []) as SalaryRecord[]);
    setAttendanceRecords((attendanceResult.data || []) as AttendanceRecord[]);
  }

  async function savePersonalInformation() {
    if (!selectedStaff) return;
    const cleanName = personalFullName.trim();
    const cleanPhone = personalPhone.trim();
    const cleanAddress = personalAddress.trim();
    const birthDayValue = personalBirthDay ? Number(personalBirthDay) : null;
    const birthMonthValue = personalBirthMonth ? Number(personalBirthMonth) : null;
    if (!cleanName) { setError("Full name cannot be empty."); return; }
    if (birthDayValue !== null && (birthDayValue < 1 || birthDayValue > 31)) { setError("Birthday must be between 1 and 31."); return; }
    if (birthMonthValue !== null && (birthMonthValue < 1 || birthMonthValue > 12)) { setError("Birth month must be between 1 and 12."); return; }
    if ((birthDayValue === null) !== (birthMonthValue === null)) { setError("Enter both birthday and birth month."); return; }
    setSaving(true); setError(""); setSuccess("");
    const { error: profileError } = await supabase.from("staff_profiles").update({ full_name: cleanName, phone: cleanPhone || null, birth_day: birthDayValue, birth_month: birthMonthValue, address: cleanAddress || null }).eq("id", selectedStaff.id);
    if (profileError) { setError(profileError.message); setSaving(false); return; }
    const { data: existingStaffUser } = await supabase.from("staff_users").select("id").eq("auth_user_id", selectedStaff.auth_user_id).maybeSingle();
    if (existingStaffUser?.id) {
      const { error } = await supabase.from("staff_users").update({ full_name: cleanName }).eq("id", existingStaffUser.id);
      if (error) { setError(error.message); setSaving(false); return; }
    }
    const updated = { ...selectedStaff, full_name: cleanName, phone: cleanPhone || null, birth_day: birthDayValue, birth_month: birthMonthValue, address: cleanAddress || null };
    setSelectedStaff(updated); setStaff((current) => current.map((m) => m.id === updated.id ? updated : m)); setEditingPersonalInfo(false); setSuccess("Personal information updated successfully."); setSaving(false);
  }

  async function saveStaffDetails() {
    if (!selectedStaff) return;
    setSaving(true); setError(""); setSuccess("");
    const newStatus = selectedStaff.status === "pending" ? "approved" : selectedStaff.status;
    const { error: profileError } = await supabase.from("staff_profiles").update({ position: position.trim() || null, department: department || null, employment_type: employmentType, employment_date: employmentDate || null, role, status: newStatus }).eq("id", selectedStaff.id);
    if (profileError) { setError(profileError.message); setSaving(false); return; }
    const { data: existingStaffUser } = await supabase.from("staff_users").select("id").eq("auth_user_id", selectedStaff.auth_user_id).maybeSingle();
    if (existingStaffUser?.id) {
      const { error } = await supabase.from("staff_users").update({ role, active: true, full_name: selectedStaff.full_name }).eq("id", existingStaffUser.id);
      if (error) { setError(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("staff_users").insert({ id: crypto.randomUUID(), auth_user_id: selectedStaff.auth_user_id, role, full_name: selectedStaff.full_name, active: true });
      if (error) { setError(error.message); setSaving(false); return; }
    }
    const updated = { ...selectedStaff, position: position.trim() || null, department: department || null, employment_type: employmentType, employment_date: employmentDate || null, role, status: newStatus as StaffProfile["status"] };
    setSelectedStaff(updated); setStaff((current) => current.map((m) => m.id === updated.id ? updated : m)); setSuccess(selectedStaff.status === "pending" ? "Staff member approved successfully." : "Staff details saved successfully."); setSaving(false);
  }

  async function changeStaffStatus(profile: StaffProfile, newStatus: StaffProfile["status"]) {
    setSaving(true); setError(""); setSuccess("");
    const { error: profileError } = await supabase.from("staff_profiles").update({ status: newStatus }).eq("id", profile.id);
    if (profileError) { setError(profileError.message); setSaving(false); return; }
    const { data: existingStaffUser } = await supabase.from("staff_users").select("id").eq("auth_user_id", profile.auth_user_id).maybeSingle();
    if (existingStaffUser?.id) {
      const { error } = await supabase.from("staff_users").update({ active: newStatus === "approved" }).eq("id", existingStaffUser.id);
      if (error) { setError(error.message); setSaving(false); return; }
    }
    const updated = { ...profile, status: newStatus };
    setStaff((current) => current.map((m) => m.id === profile.id ? updated : m));
    if (selectedStaff?.id === profile.id) setSelectedStaff(updated);
    setSuccess(`${profile.full_name} is now ${statusLabel(newStatus).toLowerCase()}.`); setSaving(false);
  }

  async function deleteStaff(profile: StaffProfile) {
    if (profile.auth_user_id === (await supabase.auth.getUser()).data.user?.id) {
      setError("You cannot delete your own account.");
      return;
    }
    const confirmed = window.confirm(`Delete ${profile.full_name} permanently? This removes the staff profile, attendance, salary records and login account. This cannot be undone.`);
    if (!confirmed) return;
    setSaving(true); setError(""); setSuccess("");
    const { error: deleteError } = await supabase.rpc("delete_staff_member", { p_staff_profile_id: profile.id });
    if (deleteError) {
      setError(deleteError.message);
      setSaving(false);
      return;
    }
    setStaff((current) => current.filter((m) => m.id !== profile.id));
    setAllAttendance((current) => current.filter((m) => m.staff_profile_id !== profile.id));
    if (selectedStaff?.id === profile.id) {
      setSelectedStaff(null);
      setSalaryRecords([]);
      setAttendanceRecords([]);
    }
    setSuccess(`${profile.full_name} was deleted successfully.`);
    setSaving(false);
  }

  async function addSalaryRecord() {
    if (!selectedStaff) return;
    const amount = Number(salaryAmount);
    if (!amount || amount <= 0) { setError("Enter a valid salary amount."); return; }
    setSaving(true); setError(""); setSuccess("");
    const { error: salaryError } = await supabase.from("staff_salary_records").insert({ staff_profile_id: selectedStaff.id, amount, currency: "NGN", pay_period_start: salaryStart || null, pay_period_end: salaryEnd || null, payment_date: salaryPaymentDate || null, status: salaryStatus, notes: salaryNotes.trim() || null });
    if (salaryError) { setError(salaryError.message); setSaving(false); return; }
    setSalaryAmount(""); setSalaryStart(""); setSalaryEnd(""); setSalaryPaymentDate(""); setSalaryStatus("pending"); setSalaryNotes(""); setShowSalaryForm(false); setSuccess("Salary record added successfully."); setSaving(false); await loadStaffDetails(selectedStaff);
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/staff";
  }

  const filteredStaff = useMemo(() => {
    const query = search.trim().toLowerCase();
    return staff.filter((member) => {
      const matchesFilter = filter === "all" || member.status === filter;
      if (!matchesFilter) return false;
      if (!query) return true;
      return member.full_name?.toLowerCase().includes(query) || member.email?.toLowerCase().includes(query) || member.phone?.toLowerCase().includes(query) || member.staff_id?.toLowerCase().includes(query);
    });
  }, [staff, search, filter]);

  const counts = useMemo(() => ({
    all: staff.length,
    pending: staff.filter((m) => m.status === "pending").length,
    approved: staff.filter((m) => m.status === "approved").length,
    suspended: staff.filter((m) => m.status === "suspended").length,
    inactive: staff.filter((m) => m.status === "inactive").length,
  }), [staff]);

  const groupedStaff = useMemo(() => {
    const statuses: Array<StaffProfile["status"]> = ["pending", "approved", "suspended", "inactive"];
    return statuses.map((status) => ({ status, members: filteredStaff.filter((m) => m.status === status) })).filter((group) => group.members.length > 0);
  }, [filteredStaff]);

  const staffById = useMemo(() => new Map(staff.map((member) => [member.id, member])), [staff]);

  function isLateClockIn(value: string) {
    const parts = new Intl.DateTimeFormat("en-NG", { timeZone: "Africa/Lagos", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(new Date(value));
    const hour = Number(parts.find((p) => p.type === "hour")?.value || 0);
    const minute = Number(parts.find((p) => p.type === "minute")?.value || 0);
    return hour > 7 || (hour === 7 && minute > 30);
  }

  useEffect(() => { void refreshAll(); }, []);
  useEffect(() => { if (!loading) void loadAllAttendance(attendanceDate); }, [attendanceDate]);

  return (
    <main className="spf-admin min-h-screen min-w-0 overflow-x-hidden bg-background">
      <header className="sticky top-0 z-30 min-w-0 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 shrink-0" /><span className="truncate text-xs font-semibold uppercase tracking-[0.2em]">Super Plus Fitness</span></div>
              <h1 className="mt-1 font-display text-2xl font-bold uppercase sm:text-3xl">Staff Management</h1>
            </div>
            <details className="group/nav relative w-full max-w-full border border-border bg-card lg:w-auto">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold uppercase [&::-webkit-details-marker]:hidden"><span className="flex items-center gap-2"><Menu className="h-5 w-5" /> Navigation</span><ChevronDown className="h-4 w-4 transition-transform group-open/nav:rotate-180" /></summary>
              <nav className="grid gap-2 border-t border-border p-3 sm:grid-cols-2 lg:min-w-64 lg:grid-cols-1">
                <a href="#revenue" onClick={() => document.getElementById("revenue-panel")?.setAttribute("open", "")} className="flex items-center gap-2 border border-border px-3 py-3 text-sm font-semibold"><TrendingUp className="h-4 w-4" /> Revenue Report</a>
                <a href="#attendance" onClick={() => document.getElementById("attendance-panel")?.setAttribute("open", "")} className="flex items-center gap-2 border border-border px-3 py-3 text-sm font-semibold"><CalendarDays className="h-4 w-4" /> Staff Attendance</a>
                <a href="#staff" onClick={() => document.getElementById("staff-panel")?.setAttribute("open", "")} className="flex items-center gap-2 border border-border px-3 py-3 text-sm font-semibold"><Users className="h-4 w-4" /> Staff Directory</a>
                <Link to="/staff-blog" className="flex items-center gap-2 border border-border px-3 py-3 text-sm font-semibold"><FileText className="h-4 w-4" /> Blog</Link>
                <Button variant="outline" onClick={() => void refreshAll()} disabled={loading || saving || revenueLoading}><RefreshCw className="h-4 w-4" /> Refresh</Button>
                <Button variant="outline" onClick={logout} disabled={saving}><LogOut className="h-4 w-4" /> Log Out</Button>
              </nav>
            </details>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl min-w-0 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {error && <div className="mb-5 break-words border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700">{error}</div>}
        {success && <div className="mb-5 break-words border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-700">{success}</div>}

        {loading ? <div className="py-20 text-center text-muted-foreground">Loading staff management...</div> : (
          <>
            <section id="revenue" className="scroll-mt-28">
              <RevenueReport payments={revenuePayments} loading={revenueLoading} onRefresh={() => void loadRevenue()} />
            </section>
            <section id="attendance" className="mt-6 scroll-mt-28">
              <details id="attendance-panel" className="group overflow-hidden border border-border bg-card" open={false}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 [&::-webkit-details-marker]:hidden sm:p-5"><div className="flex min-w-0 items-center gap-3"><LayoutDashboard className="h-5 w-5 shrink-0" /><div className="min-w-0"><h2 className="font-display text-xl font-bold uppercase sm:text-2xl">Staff Attendance</h2><p className="mt-1 text-xs text-muted-foreground">All staff attendance for a selected Lagos date. Clock-ins after 7:30 AM are highlighted red.</p></div></div><ChevronDown className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180" /></summary>
                <div className="border-t border-border p-4 sm:p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><label className="w-full sm:max-w-xs"><span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Attendance Date</span><input type="date" value={attendanceDate} onChange={(e)=>setAttendanceDate(e.target.value)} className="mt-2 h-11 w-full border border-border bg-background px-3" /></label><Button variant="outline" onClick={()=>void loadAllAttendance(attendanceDate)}><RefreshCw className="h-4 w-4" />Refresh Attendance</Button></div><div className="mt-5 grid min-w-0 gap-3">{staff.length===0?<p className="p-4 text-center text-muted-foreground">No staff records.</p>:staff.map((member)=>{const record=allAttendance.find((r)=>r.staff_profile_id===member.id);const late=record?isLateClockIn(record.checked_in_at):false;const start=record?new Date(record.checked_in_at).getTime():0;const end=record?(record.checked_out_at?new Date(record.checked_out_at).getTime():Date.now()):0;const mins=Math.max(0,Math.floor((end-start)/60000));return <div key={member.id} className="min-w-0 border border-border p-3 sm:p-4"><div className="flex min-w-0 flex-wrap items-center justify-between gap-2"><div className="min-w-0"><p className="break-words font-semibold">{member.full_name}</p><p className="text-xs text-muted-foreground">{member.staff_id}</p></div><span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${statusClass(member.status)}`}>{statusLabel(member.status)}</span></div><div className="mt-3 grid min-w-0 grid-cols-1 gap-3 border-t border-border pt-3 text-sm sm:grid-cols-3"><div className="min-w-0"><p className="text-xs uppercase text-muted-foreground">Clock In</p><p className={`break-words font-semibold ${late ? "text-red-600" : ""}`}>{record?<>{formatTimeOnly(record.checked_in_at)}{late&&<span className="ml-1">(Late)</span>}</>:"Not clocked in"}</p></div><div className="min-w-0"><p className="text-xs uppercase text-muted-foreground">Clock Out</p><p className="break-words font-semibold">{record?(record.checked_out_at?formatTimeOnly(record.checked_out_at):"Still inside"):"—"}</p></div><div className="min-w-0"><p className="text-xs uppercase text-muted-foreground">Duration</p><p className="font-semibold">{record?(Math.floor(mins/60)>0?`${Math.floor(mins/60)}h ${mins%60}m`:`${mins%60}m`):"—"}</p></div></div></div>})}</div></div>
              </details>
            </section>
            <section id="staff" className="mt-6 scroll-mt-28">
              <details id="staff-panel" className="group overflow-hidden border border-border bg-card" open={false}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 [&::-webkit-details-marker]:hidden sm:p-5">
                  <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Staff Management</p><h2 className="mt-1 font-display text-xl font-bold uppercase sm:text-2xl">Staff Directory</h2><p className="mt-1 text-xs text-muted-foreground">Status groups are collapsed by default. Open a group to manage staff.</p></div>
                  <ChevronDown className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <div className="border-t border-border p-4 sm:p-5">
                  <div className="mb-5 flex min-w-0 flex-col gap-3 sm:flex-row">
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search staff..." className="h-11 min-w-0 flex-1 border border-border bg-background px-3 outline-none focus:border-foreground" />
                    <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="h-11 border border-border bg-background px-3 text-sm sm:w-48"><option value="all">All Statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="suspended">Suspended</option><option value="inactive">Inactive</option></select>
                  </div>
                  {groupedStaff.length === 0 ? <div className="border border-border p-8 text-center text-sm text-muted-foreground">No staff found.</div> : <div className="space-y-3">
                    {groupedStaff.map((group) => (
                      <details key={group.status} className="group/status overflow-hidden border border-border" open={false}>
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-background p-4 [&::-webkit-details-marker]:hidden">
                          <div className="flex min-w-0 items-center gap-3"><span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${statusClass(group.status)}`}>{statusLabel(group.status)}</span><span className="text-sm font-semibold">{group.members.length} staff</span></div><ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open/status:rotate-180" />
                        </summary>
                        <div className="border-t border-border">
                          {group.members.map((member) => <div key={member.id} className="border-b border-border last:border-b-0">
                            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 p-4">
                              <div className="min-w-0 flex-1"><h3 className="break-words font-display text-base font-bold uppercase sm:text-lg">{member.full_name}</h3><p className="mt-1 break-words text-xs text-muted-foreground">{member.staff_id}{member.position ? ` • ${member.position}` : ""}</p></div>
                              <button type="button" onClick={() => { if (selectedStaff?.id === member.id) setSelectedStaff(null); else void loadStaffDetails(member); }} className="shrink-0 border border-border px-3 py-2 text-xs font-semibold uppercase hover:bg-muted">{selectedStaff?.id === member.id ? "Close Profile" : "Staff Profile"}</button>
                            </div>
            {selectedStaff?.id === member.id && <section className="border-t border-border p-3 sm:p-4">
              <details className="group overflow-hidden border border-border bg-card" open={false}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 [&::-webkit-details-marker]:hidden sm:p-5"><div className="flex min-w-0 items-center gap-3"><UserRound className="h-6 w-6 shrink-0" /><div className="min-w-0"><h2 className="truncate font-display text-xl font-bold uppercase sm:text-2xl">{selectedStaff.full_name}</h2><p className="text-xs text-muted-foreground">{selectedStaff.staff_id} • Staff Profile</p></div></div><div className="flex shrink-0 items-center gap-3"><span className={`hidden rounded-full border px-2 py-1 text-[10px] font-bold uppercase sm:inline ${statusClass(selectedStaff.status)}`}>{statusLabel(selectedStaff.status)}</span><ChevronDown className="h-5 w-5 transition-transform group-open:rotate-180" /></div></summary>
                <div className="space-y-4 border-t border-border p-4 sm:p-6">
                  <details className="group/section border border-border" open={false}><summary className="flex cursor-pointer list-none items-center justify-between p-4 [&::-webkit-details-marker]:hidden"><span className="font-display text-lg font-bold uppercase">Personal Information</span><ChevronDown className="h-4 w-4 transition-transform group-open/section:rotate-180" /></summary><div className="border-t border-border p-4 sm:p-5">
                    {!editingPersonalInfo ? <div className="grid gap-4 sm:grid-cols-2"><div><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Full Name</p><p className="mt-1 break-words font-medium">{selectedStaff.full_name}</p></div><div><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Email</p><p className="mt-1 break-all font-medium">{selectedStaff.email || "—"}</p></div><div><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Phone</p><p className="mt-1 font-medium">{selectedStaff.phone || "—"}</p></div><div><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Birthday</p><p className="mt-1 font-medium">{selectedStaff.birth_day && selectedStaff.birth_month ? `${selectedStaff.birth_day}/${selectedStaff.birth_month}` : "—"}</p></div><div className="sm:col-span-2"><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Address</p><p className="mt-1 break-words font-medium">{selectedStaff.address || "—"}</p></div><div className="sm:col-span-2"><Button variant="outline" onClick={() => setEditingPersonalInfo(true)}><Pencil className="h-4 w-4" />Edit Personal Information</Button></div></div> : <div className="grid gap-4 sm:grid-cols-2"><label><span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Full Name</span><input value={personalFullName} onChange={(e) => setPersonalFullName(e.target.value)} className="mt-2 h-11 w-full border border-border bg-background px-3" /></label><label><span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Phone</span><input value={personalPhone} onChange={(e) => setPersonalPhone(e.target.value)} className="mt-2 h-11 w-full border border-border bg-background px-3" /></label><label><span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Birth Day</span><select value={personalBirthDay} onChange={(e) => setPersonalBirthDay(e.target.value)} className="mt-2 h-11 w-full border border-border bg-background px-3"><option value="">Day</option>{Array.from({length:31},(_,i)=>i+1).map((d)=><option key={d} value={d}>{d}</option>)}</select></label><label><span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Birth Month</span><select value={personalBirthMonth} onChange={(e) => setPersonalBirthMonth(e.target.value)} className="mt-2 h-11 w-full border border-border bg-background px-3"><option value="">Month</option>{["January","February","March","April","May","June","July","August","September","October","November","December"].map((m,i)=><option key={m} value={i+1}>{m}</option>)}</select></label><label className="sm:col-span-2"><span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Address</span><textarea value={personalAddress} onChange={(e) => setPersonalAddress(e.target.value)} rows={3} className="mt-2 w-full border border-border bg-background px-3 py-3" /></label><div className="flex flex-wrap gap-2 sm:col-span-2"><Button onClick={() => void savePersonalInformation()} disabled={saving}><Save className="h-4 w-4" />Save</Button><Button variant="outline" onClick={() => setEditingPersonalInfo(false)} disabled={saving}><X className="h-4 w-4" />Cancel</Button></div></div>}
                  </div></details>

                  <details className="group/section border border-border" open={false}><summary className="flex cursor-pointer list-none items-center justify-between p-4 [&::-webkit-details-marker]:hidden"><div><span className="font-display text-lg font-bold uppercase">Employment & Access</span><p className="mt-1 text-xs text-muted-foreground">Job information, role and account status.</p></div><ChevronDown className="h-4 w-4 transition-transform group-open/section:rotate-180" /></summary><div className="border-t border-border p-4 sm:p-5"><div className="grid gap-4 sm:grid-cols-2"><label><span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Position</span><input value={position} onChange={(e) => setPosition(e.target.value)} className="mt-2 h-11 w-full border border-border bg-background px-3" /></label><label><span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Department</span><select value={department} onChange={(e) => setDepartment(e.target.value)} className="mt-2 h-11 w-full border border-border bg-background px-3"><option value="">Select department</option>{departments.map((d)=><option key={d} value={d}>{d}</option>)}</select></label><label><span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Employment Type</span><select value={employmentType} onChange={(e) => setEmploymentType(e.target.value)} className="mt-2 h-11 w-full border border-border bg-background px-3">{employmentTypes.map((d)=><option key={d}>{d}</option>)}</select></label><label><span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Employment Date</span><input type="date" value={employmentDate} onChange={(e) => setEmploymentDate(e.target.value)} className="mt-2 h-11 w-full border border-border bg-background px-3" /></label><label className="sm:col-span-2"><span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Staff Role / System Access</span><select value={role} onChange={(e) => setRole(e.target.value)} className="mt-2 h-11 w-full border border-border bg-background px-3">{roles.map((r)=><option key={r.value} value={r.value}>{r.label}</option>)}</select></label></div><div className="mt-5 flex flex-wrap gap-2"><Button onClick={() => void saveStaffDetails()} disabled={saving}><CheckCircle2 className="h-4 w-4" />{selectedStaff.status === "pending" ? "Save & Approve" : "Save Changes"}</Button>{selectedStaff.status === "approved" && <><Button variant="outline" onClick={() => void changeStaffStatus(selectedStaff,"suspended")} disabled={saving}><XCircle className="h-4 w-4" />Suspend</Button><Button variant="outline" onClick={() => void changeStaffStatus(selectedStaff,"inactive")} disabled={saving}>Mark Inactive</Button></>}{(selectedStaff.status === "suspended" || selectedStaff.status === "inactive") && <Button variant="outline" onClick={() => void changeStaffStatus(selectedStaff,"approved")} disabled={saving}><CheckCircle2 className="h-4 w-4" />Reactivate</Button>}</div></div></details>

                  <details className="group/section border border-border" open={false}><summary className="flex cursor-pointer list-none items-center justify-between p-4 [&::-webkit-details-marker]:hidden"><div><span className="font-display text-lg font-bold uppercase">Salary</span><p className="mt-1 text-xs text-muted-foreground">Salary records and payment history.</p></div><ChevronDown className="h-4 w-4 transition-transform group-open/section:rotate-180" /></summary><div className="border-t border-border p-4 sm:p-5"><Button variant="outline" onClick={() => setShowSalaryForm((v) => !v)}><DollarSign className="h-4 w-4" />{showSalaryForm ? "Close Salary Form" : "Add Salary"}</Button>{showSalaryForm && <div className="mt-4 grid gap-4 border border-border p-4 sm:grid-cols-2"><label><span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Amount (₦)</span><input type="number" min="0" value={salaryAmount} onChange={(e)=>setSalaryAmount(e.target.value)} className="mt-2 h-11 w-full border border-border bg-background px-3" /></label><label><span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Status</span><select value={salaryStatus} onChange={(e)=>setSalaryStatus(e.target.value as typeof salaryStatus)} className="mt-2 h-11 w-full border border-border bg-background px-3"><option value="pending">Pending</option><option value="paid">Paid</option><option value="cancelled">Cancelled</option></select></label><label><span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Period Start</span><input type="date" value={salaryStart} onChange={(e)=>setSalaryStart(e.target.value)} className="mt-2 h-11 w-full border border-border bg-background px-3" /></label><label><span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Period End</span><input type="date" value={salaryEnd} onChange={(e)=>setSalaryEnd(e.target.value)} className="mt-2 h-11 w-full border border-border bg-background px-3" /></label><label><span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Payment Date</span><input type="date" value={salaryPaymentDate} onChange={(e)=>setSalaryPaymentDate(e.target.value)} className="mt-2 h-11 w-full border border-border bg-background px-3" /></label><label><span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Notes</span><input value={salaryNotes} onChange={(e)=>setSalaryNotes(e.target.value)} className="mt-2 h-11 w-full border border-border bg-background px-3" /></label><div className="sm:col-span-2"><Button onClick={() => void addSalaryRecord()} disabled={saving}><Save className="h-4 w-4" />Save Salary Record</Button></div></div>}<div className="mt-5 overflow-x-auto">{salaryRecords.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No salary records yet.</p> : <table className="w-full min-w-[650px] text-left text-sm"><thead><tr className="border-b border-border text-xs uppercase tracking-widest text-muted-foreground"><th className="px-3 py-3">Amount</th><th className="px-3 py-3">Period</th><th className="px-3 py-3">Payment Date</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Notes</th></tr></thead><tbody>{salaryRecords.map((record)=><tr key={record.id} className="border-b border-border"><td className="px-3 py-4 font-semibold">{formatMoney(record.amount, record.currency)}</td><td className="px-3 py-4">{record.pay_period_start || record.pay_period_end ? `${formatDate(record.pay_period_start)} – ${formatDate(record.pay_period_end)}` : "—"}</td><td className="px-3 py-4">{formatDate(record.payment_date)}</td><td className="px-3 py-4 uppercase">{record.status}</td><td className="px-3 py-4">{record.notes || "—"}</td></tr>)}</tbody></table>}</div></div></details>

                  <details className="group/section border border-red-500/30" open={false}><summary className="flex cursor-pointer list-none items-center justify-between p-4 [&::-webkit-details-marker]:hidden"><div><span className="font-display text-lg font-bold uppercase text-red-700">Danger Zone</span><p className="mt-1 text-xs text-muted-foreground">Permanently delete this staff member and their account.</p></div><ChevronDown className="h-4 w-4 transition-transform group-open/section:rotate-180" /></summary><div className="border-t border-red-500/30 p-4"><Button variant="outline" onClick={() => void deleteStaff(selectedStaff)} disabled={saving} className="border-red-500/40 text-red-700 hover:bg-red-500/10"><Trash2 className="h-4 w-4" />Delete Staff Member</Button></div></details>

                  <details className="group/section border border-border" open={false}><summary className="flex cursor-pointer list-none items-center justify-between p-4 [&::-webkit-details-marker]:hidden"><div><span className="font-display text-lg font-bold uppercase">Attendance History</span><p className="mt-1 text-xs text-muted-foreground">Recent attendance for this staff member.</p></div><ChevronDown className="h-4 w-4 transition-transform group-open/section:rotate-180" /></summary><div className="border-t border-border p-4 sm:p-5"><div className="overflow-x-auto">{attendanceRecords.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No attendance records yet.</p> : <table className="w-full min-w-[650px] text-left text-sm"><thead><tr className="border-b border-border text-xs uppercase tracking-widest text-muted-foreground"><th className="px-3 py-3">Check-in</th><th className="px-3 py-3">Check-out</th><th className="px-3 py-3">Duration</th><th className="px-3 py-3">Notes</th></tr></thead><tbody>{attendanceRecords.map((record)=>{const start=new Date(record.checked_in_at).getTime();const end=record.checked_out_at?new Date(record.checked_out_at).getTime():Date.now();const mins=Math.max(0,Math.floor((end-start)/60000));return <tr key={record.id} className="border-b border-border"><td className={`px-3 py-4 ${isLateClockIn(record.checked_in_at)?"font-bold text-red-600":""}`}>{formatTimeOnly(record.checked_in_at)}{isLateClockIn(record.checked_in_at)&&<span className="ml-1">(Late)</span>}</td><td className="px-3 py-4">{record.checked_out_at?formatTimeOnly(record.checked_out_at):"Still inside"}</td><td className="px-3 py-4 font-semibold">{Math.floor(mins/60)>0?`${Math.floor(mins/60)}h ${mins%60}m`:`${mins%60}m`}</td><td className="px-3 py-4">{record.notes||"—"}</td></tr>})}</tbody></table>}</div></div></details>
                </div>
              </details>
            </section>}

                          </div>)}
                        </div>
                      </details>
                    ))}
                  </div>}
                </div>
              </details>
            </section>


          </>
        )}
      </div>
    </main>
  );
}

export const Route = createFileRoute("/staff-admin")({ component: StaffAdminPage });

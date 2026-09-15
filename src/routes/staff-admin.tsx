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
  CreditCard,
  TrendingUp,
  Users,
  CalendarDays,
  ChevronDown,
  Pencil,
  Save,
  X,
  FileText,
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

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
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

  const periodPayments = useMemo(() => {
    return payments.filter((payment) => {
      if (payment.status.toLowerCase() !== "success") {
        return false;
      }

      if (!periodStart) return true;

      return new Date(getPaymentDate(payment)) >= periodStart;
    });
  }, [payments, periodStart]);

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
      payments
        .filter(
          (payment) =>
            payment.status.toLowerCase() === "success" &&
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
    [payments, now],
  );

  const monthRevenue = useMemo(() => {
    const monthStart = startOfMonth(now);

    return payments
      .filter(
        (payment) =>
          payment.status.toLowerCase() === "success" &&
          new Date(getPaymentDate(payment)) >= monthStart,
      )
      .reduce(
        (total, payment) =>
          total + Number(payment.amount || 0),
        0,
      );
  }, [payments, now]);

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

        return (
          memberName.includes(query) ||
          email.includes(query) ||
          phone.includes(query) ||
          reference.includes(query) ||
          plan.includes(query)
        );
      })
      .sort(
        (a, b) =>
          new Date(getPaymentDate(b)).getTime() -
          new Date(getPaymentDate(a)).getTime(),
      );
  }, [periodPayments, paymentSearch]);

  return (
    <details className="group mb-8 border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 [&::-webkit-details-marker]:hidden sm:p-6">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted">
            <TrendingUp className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Admin
            </p>

            <h2 className="mt-1 font-display text-2xl font-bold uppercase">
              Revenue Report
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
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

      <div className="border-t border-border">
        <div className="border-b border-border p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5" />

                <div>
                  <h2 className="font-display text-2xl font-bold uppercase">
                    Revenue Report
                  </h2>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Track successful membership payments and revenue.
                  </p>
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={onRefresh}
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh Revenue
            </Button>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
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
                className={`border px-4 py-2 text-xs font-semibold uppercase ${
                  period === value
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="border border-border bg-background p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Revenue
              </p>

              <p className="mt-3 break-words text-3xl font-bold">
                {formatMoney(totalRevenue)}
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Selected period
              </p>
            </div>

            <div className="border border-border bg-background p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Today
              </p>

              <p className="mt-3 break-words text-3xl font-bold">
                {formatMoney(todayRevenue)}
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Successful payments today
              </p>
            </div>

            <div className="border border-border bg-background p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Payments
              </p>

              <p className="mt-3 text-3xl font-bold">
                {periodPayments.length}
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Successful transactions
              </p>
            </div>

            <div className="border border-border bg-background p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Average Payment
              </p>

              <p className="mt-3 break-words text-3xl font-bold">
                {formatMoney(averagePayment)}
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Average per successful payment
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
            <div className="border border-border bg-background p-5">
              <h3 className="font-display text-xl font-bold uppercase">
                Revenue by Plan
              </h3>

              <div className="mt-5">
                {revenueByPlan.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No successful payments in this period.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {revenueByPlan.map((item) => {
                      const percentage =
                        totalRevenue > 0
                          ? (item.amount / totalRevenue) * 100
                          : 0;

                      return (
                        <div
                          key={item.plan}
                          className="border-b border-border pb-3 last:border-0"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="font-semibold">
                                {item.plan}
                              </p>

                              <p className="mt-1 text-xs text-muted-foreground">
                                {item.count} payment
                                {item.count === 1 ? "" : "s"}
                              </p>
                            </div>

                            <p className="font-bold">
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
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    This Month
                  </span>

                  <span className="font-bold">
                    {formatMoney(monthRevenue)}
                  </span>
                </div>
              </div>
            </div>

            <div className="border border-border bg-background p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-display text-xl font-bold uppercase">
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
                  className="h-10 w-full border border-border bg-background px-3 text-sm outline-none sm:w-64"
                />
              </div>

              <div className="mt-5 overflow-x-auto">
                {loading ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Loading payment records...
                  </p>
                ) : filteredPayments.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No successful payment records found.
                  </p>
                ) : (
                  <table className="w-full min-w-[850px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs uppercase tracking-widest text-muted-foreground">
                        <th className="px-3 py-3">Member</th>
                        <th className="px-3 py-3">Plan</th>
                        <th className="px-3 py-3">Amount</th>
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
                          <td className="px-3 py-4">
                            <p className="font-semibold">
                              {getPaymentMemberName(payment)}
                            </p>

                            {payment.member?.email && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {payment.member.email}
                              </p>
                            )}
                          </td>

                          <td className="px-3 py-4">
                            {getPaymentPlan(payment)}
                          </td>

                          <td className="px-3 py-4 font-bold">
                            {formatMoney(
                              Number(payment.amount || 0),
                              payment.currency || "NGN",
                            )}
                          </td>

                          <td className="px-3 py-4 capitalize">
                            {payment.payment_method || "Paystack"}
                          </td>

                          <td className="whitespace-nowrap px-3 py-4">
                            {formatDateTime(
                              getPaymentDate(payment),
                            )}
                          </td>

                          <td className="px-3 py-4">
                            <span className="font-mono text-xs">
                              {payment.paystack_reference || "—"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
  const [revenuePayments, setRevenuePayments] = useState<
    RevenuePaymentRow[]
  >([]);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [selectedStaff, setSelectedStaff] =
    useState<StaffProfile | null>(null);

  const [salaryRecords, setSalaryRecords] = useState<SalaryRecord[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<
    AttendanceRecord[]
  >([]);

  const [search, setSearch] = useState("");

  const [filter, setFilter] = useState<
    "all" | "pending" | "approved" | "suspended" | "inactive"
  >("all");

  const [showSalaryForm, setShowSalaryForm] = useState(false);

  const [position, setPosition] = useState("");
  const [department, setDepartment] = useState("");
  const [employmentType, setEmploymentType] = useState("Full Time");
  const [employmentDate, setEmploymentDate] = useState("");
  const [role, setRole] = useState("staff");

  const [editingPersonalInfo, setEditingPersonalInfo] =
    useState(false);

  const [personalFullName, setPersonalFullName] = useState("");
  const [personalPhone, setPersonalPhone] = useState("");
  const [personalBirthDay, setPersonalBirthDay] = useState("");
  const [personalBirthMonth, setPersonalBirthMonth] = useState("");
  const [personalAddress, setPersonalAddress] = useState("");

  const [salaryAmount, setSalaryAmount] = useState("");
  const [salaryStart, setSalaryStart] = useState("");
  const [salaryEnd, setSalaryEnd] = useState("");
  const [salaryPaymentDate, setSalaryPaymentDate] = useState("");

  const [salaryStatus, setSalaryStatus] = useState<
    "pending" | "paid" | "cancelled"
  >("pending");

  const [salaryNotes, setSalaryNotes] = useState("");

  async function verifyAdmin() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/staff";
      return false;
    }

    const { data, error: adminError } = await supabase
      .from("staff_users")
      .select("id, role, active")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (adminError) {
      setError(adminError.message);
      return false;
    }

    const isAdmin =
      data?.active === true &&
      ["admin", "owner", "manager"].includes(
        String(data.role).toLowerCase(),
      );

    if (!isAdmin) {
      setError(
        "You do not have permission to access staff management.",
      );
      return false;
    }

    return true;
  }

  async function loadRevenue() {
    setRevenueLoading(true);

    try {
      const { data: paymentData, error: paymentError } =
        await supabase
          .from("payments")
          .select(
            `
            id,
            member_id,
            membership_id,
            amount,
            currency,
            status,
            payment_method,
            provider,
            paystack_reference,
            paid_at,
            created_at,
            metadata
          `,
          )
          .eq("status", "success")
          .order("paid_at", {
            ascending: false,
            nullsFirst: false,
          })
          .limit(2000);

      if (paymentError) {
        setError(paymentError.message);
        setRevenuePayments([]);
        return;
      }

      const payments = (paymentData || []) as RevenuePayment[];

      if (payments.length === 0) {
        setRevenuePayments([]);
        return;
      }

      const memberIds = Array.from(
        new Set(
          payments
            .map((payment) => payment.member_id)
            .filter(
              (id): id is string =>
                typeof id === "string" && id.length > 0,
            ),
        ),
      );

      const membershipIds = Array.from(
        new Set(
          payments
            .map((payment) => payment.membership_id)
            .filter(
              (id): id is string =>
                typeof id === "string" && id.length > 0,
            ),
        ),
      );

      let members: RevenueMember[] = [];

      if (memberIds.length > 0) {
        const { data: memberData } = await supabase
          .from("members")
          .select(
            "id, full_name, email, phone",
          )
          .in("id", memberIds);

        members = (memberData || []) as RevenueMember[];
      }

      let memberships: RevenueMembership[] = [];

      if (membershipIds.length > 0) {
        const { data: membershipData } = await supabase
          .from("memberships")
          .select("id, plan_name")
          .in("id", membershipIds);

        memberships =
          (membershipData || []) as RevenueMembership[];
      }

      const memberMap = new Map(
        members.map((member) => [member.id, member]),
      );

      const membershipMap = new Map(
        memberships.map((membership) => [
          membership.id,
          membership,
        ]),
      );

      setRevenuePayments(
        payments.map((payment) => ({
          ...payment,
          member: payment.member_id
            ? memberMap.get(payment.member_id) || null
            : null,
          membership: payment.membership_id
            ? membershipMap.get(payment.membership_id) || null
            : null,
        })),
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to load revenue records.",
      );
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

    const { data, error: staffError } = await supabase
      .from("staff_profiles")
      .select(
        `
        id,
        auth_user_id,
        staff_id,
        full_name,
        email,
        phone,
        birth_day,
        birth_month,
        address,
        position,
        department,
        employment_type,
        employment_date,
        role,
        status,
        created_at
      `,
      )
      .order("created_at", { ascending: false });

    if (staffError) {
      setError(staffError.message);
      setLoading(false);
      return;
    }

    setStaff((data || []) as StaffProfile[]);
    setLoading(false);
  }

  async function refreshAll() {
    setError("");

    await Promise.all([
      loadStaff(),
      loadRevenue(),
    ]);
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
    setPersonalBirthDay(
      profile.birth_day ? String(profile.birth_day) : "",
    );
    setPersonalBirthMonth(
      profile.birth_month ? String(profile.birth_month) : "",
    );
    setPersonalAddress(profile.address || "");

    setEditingPersonalInfo(false);
    setShowSalaryForm(false);

    const [salaryResult, attendanceResult] =
      await Promise.all([
        supabase
          .from("staff_salary_records")
          .select(
            `
            id,
            staff_profile_id,
            amount,
            currency,
            pay_period_start,
            pay_period_end,
            payment_date,
            status,
            notes,
            created_at
          `,
          )
          .eq("staff_profile_id", profile.id)
          .order("created_at", { ascending: false }),

        supabase
          .from("staff_attendance")
          .select(
            `
            id,
            checked_in_at,
            checked_out_at,
            notes
          `,
          )
          .eq("staff_profile_id", profile.id)
          .order("checked_in_at", { ascending: false })
          .limit(50),
      ]);

    if (salaryResult.error) {
      setError(salaryResult.error.message);
      return;
    }

    if (attendanceResult.error) {
      setError(attendanceResult.error.message);
      return;
    }

    setSalaryRecords(
      (salaryResult.data || []) as SalaryRecord[],
    );

    setAttendanceRecords(
      (attendanceResult.data || []) as AttendanceRecord[],
    );
  }

  async function savePersonalInformation() {
    if (!selectedStaff) return;

    const cleanName = personalFullName.trim();
    const cleanPhone = personalPhone.trim();
    const cleanAddress = personalAddress.trim();

    const birthDayValue = personalBirthDay
      ? Number(personalBirthDay)
      : null;

    const birthMonthValue = personalBirthMonth
      ? Number(personalBirthMonth)
      : null;

    if (!cleanName) {
      setError("Full name cannot be empty.");
      return;
    }

    if (
      birthDayValue !== null &&
      (birthDayValue < 1 || birthDayValue > 31)
    ) {
      setError("Birthday must be between 1 and 31.");
      return;
    }

    if (
      birthMonthValue !== null &&
      (birthMonthValue < 1 || birthMonthValue > 12)
    ) {
      setError("Birth month must be between 1 and 12.");
      return;
    }

    if (
      (birthDayValue === null) !==
      (birthMonthValue === null)
    ) {
      setError("Enter both birthday and birth month.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const { error: profileError } = await supabase
      .from("staff_profiles")
      .update({
        full_name: cleanName,
        phone: cleanPhone || null,
        birth_day: birthDayValue,
        birth_month: birthMonthValue,
        address: cleanAddress || null,
      })
      .eq("id", selectedStaff.id);

    if (profileError) {
      setError(profileError.message);
      setSaving(false);
      return;
    }

    const { data: existingStaffUser } = await supabase
      .from("staff_users")
      .select("id")
      .eq("auth_user_id", selectedStaff.auth_user_id)
      .maybeSingle();

    if (existingStaffUser?.id) {
      const { error: updateError } = await supabase
        .from("staff_users")
        .update({
          full_name: cleanName,
        })
        .eq("id", existingStaffUser.id);

      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }
    }

    const updatedProfile: StaffProfile = {
      ...selectedStaff,
      full_name: cleanName,
      phone: cleanPhone || null,
      birth_day: birthDayValue,
      birth_month: birthMonthValue,
      address: cleanAddress || null,
    };

    setSelectedStaff(updatedProfile);

    setStaff((current) =>
      current.map((member) =>
        member.id === updatedProfile.id
          ? updatedProfile
          : member,
      ),
    );

    setEditingPersonalInfo(false);
    setSuccess("Personal information updated successfully.");
    setSaving(false);
  }

  async function saveStaffDetails() {
    if (!selectedStaff) return;

    setSaving(true);
    setError("");
    setSuccess("");

    const { error: profileError } = await supabase
      .from("staff_profiles")
      .update({
        position: position.trim() || null,
        department: department || null,
        employment_type: employmentType,
        employment_date: employmentDate || null,
        role,
        status:
          selectedStaff.status === "pending"
            ? "approved"
            : selectedStaff.status,
      })
      .eq("id", selectedStaff.id);

    if (profileError) {
      setError(profileError.message);
      setSaving(false);
      return;
    }

    const { data: existingStaffUser } = await supabase
      .from("staff_users")
      .select("id")
      .eq("auth_user_id", selectedStaff.auth_user_id)
      .maybeSingle();

    if (existingStaffUser?.id) {
      const { error: updateError } = await supabase
        .from("staff_users")
        .update({
          role,
          active: true,
          full_name: selectedStaff.full_name,
        })
        .eq("id", existingStaffUser.id);

      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }
    } else {
      const { error: insertError } = await supabase
        .from("staff_users")
        .insert({
          id: crypto.randomUUID(),
          auth_user_id: selectedStaff.auth_user_id,
          role,
          full_name: selectedStaff.full_name,
          active: true,
        });

      if (insertError) {
        setError(insertError.message);
        setSaving(false);
        return;
      }
    }

    const updatedProfile: StaffProfile = {
      ...selectedStaff,
      position: position.trim() || null,
      department: department || null,
      employment_type: employmentType,
      employment_date: employmentDate || null,
      role,
      status:
        selectedStaff.status === "pending"
          ? "approved"
          : selectedStaff.status,
    };

    setSelectedStaff(updatedProfile);

    setStaff((current) =>
      current.map((member) =>
        member.id === updatedProfile.id
          ? updatedProfile
          : member,
      ),
    );

    setSuccess(
      selectedStaff.status === "pending"
        ? "Staff member approved successfully."
        : "Staff details saved successfully.",
    );

    setSaving(false);
  }

  async function changeStaffStatus(
    profile: StaffProfile,
    newStatus: StaffProfile["status"],
  ) {
    setSaving(true);
    setError("");
    setSuccess("");

    const { error: profileError } = await supabase
      .from("staff_profiles")
      .update({
        status: newStatus,
      })
      .eq("id", profile.id);

    if (profileError) {
      setError(profileError.message);
      setSaving(false);
      return;
    }

    const { data: existingStaffUser } = await supabase
      .from("staff_users")
      .select("id")
      .eq("auth_user_id", profile.auth_user_id)
      .maybeSingle();

    if (existingStaffUser?.id) {
      const { error: staffUserError } = await supabase
        .from("staff_users")
        .update({
          active: newStatus === "approved",
        })
        .eq("id", existingStaffUser.id);

      if (staffUserError) {
        setError(staffUserError.message);
        setSaving(false);
        return;
      }
    }

    const updatedProfile = {
      ...profile,
      status: newStatus,
    };

    setStaff((current) =>
      current.map((member) =>
        member.id === profile.id
          ? updatedProfile
          : member,
      ),
    );

    if (selectedStaff?.id === profile.id) {
      setSelectedStaff(updatedProfile);
    }

    setSuccess(
      `${profile.full_name} is now ${statusLabel(
        newStatus,
      ).toLowerCase()}.`,
    );

    setSaving(false);
  }

  async function addSalaryRecord() {
    if (!selectedStaff) return;

    const amount = Number(salaryAmount);

    if (!amount || amount <= 0) {
      setError("Enter a valid salary amount.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const { error: salaryError } = await supabase
      .from("staff_salary_records")
      .insert({
        staff_profile_id: selectedStaff.id,
        amount,
        currency: "NGN",
        pay_period_start: salaryStart || null,
        pay_period_end: salaryEnd || null,
        payment_date: salaryPaymentDate || null,
        status: salaryStatus,
        notes: salaryNotes.trim() || null,
      });

    if (salaryError) {
      setError(salaryError.message);
      setSaving(false);
      return;
    }

    setSalaryAmount("");
    setSalaryStart("");
    setSalaryEnd("");
    setSalaryPaymentDate("");
    setSalaryStatus("pending");
    setSalaryNotes("");
    setShowSalaryForm(false);

    setSuccess("Salary record added successfully.");

    setSaving(false);

    await loadStaffDetails(selectedStaff);
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/staff";
  }

  const filteredStaff = useMemo(() => {
    const query = search.trim().toLowerCase();

    return staff.filter((member) => {
      const matchesFilter =
        filter === "all" || member.status === filter;

      if (!matchesFilter) return false;

      if (!query) return true;

      return (
        member.full_name?.toLowerCase().includes(query) ||
        member.email?.toLowerCase().includes(query) ||
        member.phone?.toLowerCase().includes(query) ||
        member.staff_id?.toLowerCase().includes(query)
      );
    });
  }, [staff, search, filter]);

  const pendingCount = staff.filter(
    (member) => member.status === "pending",
  ).length;

  const approvedCount = staff.filter(
    (member) => member.status === "approved",
  ).length;

  const suspendedCount = staff.filter(
    (member) => member.status === "suspended",
  ).length;

  const inactiveCount = staff.filter(
    (member) => member.status === "inactive",
  ).length;

  useEffect(() => {
    void refreshAll();
  }, []);

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />

              <span className="text-sm font-semibold uppercase tracking-[0.2em]">
                Super Plus Fitness
              </span>
            </div>

            <h1 className="font-display text-3xl font-bold uppercase">
              Admin Staff Portal
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Manage staff, salaries, attendance and business administration.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/staff-blog">
              <Button variant="outline">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">
                  Blog Management
                </span>
                <span className="sm:hidden">
                  Blog
                </span>
              </Button>
            </Link>

            <Button
              variant="outline"
              onClick={() => void refreshAll()}
              disabled={loading || saving || revenueLoading}
            >
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">
                Refresh
              </span>
            </Button>

            <Button
              variant="outline"
              onClick={logout}
              disabled={saving}
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">
                Logout
              </span>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-700">
            {success}
          </div>
        )}

        {!loading && (
          <RevenueReport
            payments={revenuePayments}
            loading={revenueLoading}
            onRefresh={() => void loadRevenue()}
          />
        )}

        {loading ? (
          <div className="py-20 text-center text-muted-foreground">
            Loading staff management...
          </div>
        ) : (
          <>
            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="border border-border bg-card p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Pending
                </p>
                <p className="mt-2 text-4xl font-bold">
                  {pendingCount}
                </p>
              </div>

              <div className="border border-border bg-card p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Approved
                </p>
                <p className="mt-2 text-4xl font-bold">
                  {approvedCount}
                </p>
              </div>

              <div className="border border-border bg-card p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Suspended
                </p>
                <p className="mt-2 text-4xl font-bold">
                  {suspendedCount}
                </p>
              </div>

              <div className="border border-border bg-card p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Inactive
                </p>
                <p className="mt-2 text-4xl font-bold">
                  {inactiveCount}
                </p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-primary">
                Staff Management
              </p>

              <h2 className="mt-1 font-display text-3xl font-bold uppercase">
                Staff Administration
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Manage staff applications, employment information,
                salaries and attendance.
              </p>
            </div>

            <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
              <section className="border border-border bg-card">
                <div className="border-b border-border p-5">
                  <h2 className="font-display text-xl font-bold uppercase">
                    Staff
                  </h2>

                  <input
                    value={search}
                    onChange={(event) =>
                      setSearch(event.target.value)
                    }
                    placeholder="Search staff..."
                    className="mt-4 h-11 w-full border border-border bg-background px-3 outline-none focus:border-foreground"
                  />

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {[
                      ["all", "All"],
                      ["pending", "Pending"],
                      ["approved", "Approved"],
                      ["suspended", "Suspended"],
                      ["inactive", "Inactive"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          setFilter(
                            value as
                              | "all"
                              | "pending"
                              | "approved"
                              | "suspended"
                              | "inactive",
                          )
                        }
                        className={`border px-3 py-2 text-xs font-semibold uppercase ${
                          filter === value
                            ? "border-foreground bg-foreground text-background"
                            : "border-border bg-background"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="max-h-[700px] overflow-y-auto">
                  {filteredStaff.length === 0 ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      No staff found.
                    </div>
                  ) : (
                    filteredStaff.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() =>
                          void loadStaffDetails(member)
                        }
                        className={`w-full border-b border-border p-5 text-left transition ${
                          selectedStaff?.id === member.id
                            ? "bg-muted"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="truncate font-display text-lg font-bold uppercase">
                              {member.full_name}
                            </h3>

                            <p className="mt-1 text-xs text-muted-foreground">
                              {member.staff_id}
                            </p>

                            {member.position && (
                              <p className="mt-2 text-sm">
                                {member.position}
                              </p>
                            )}
                          </div>

                          <span
                            className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${statusClass(
                              member.status,
                            )}`}
                          >
                            {statusLabel(member.status)}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </section>

              <section>
                {!selectedStaff ? (
                  <div className="flex min-h-[500px] items-center justify-center border border-border bg-card p-8 text-center">
                    <div>
                      <UserRound className="mx-auto h-12 w-12 text-muted-foreground" />

                      <h2 className="mt-4 font-display text-2xl font-bold uppercase">
                        Select a Staff Member
                      </h2>

                      <p className="mt-2 max-w-md text-sm text-muted-foreground">
                        Select a staff member from the list to review
                        their application, employment information,
                        salary and attendance.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="border border-border bg-card p-6">
                      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                            <UserRound className="h-6 w-6" />
                          </div>

                          <div>
                            <h2 className="font-display text-3xl font-bold uppercase">
                              {selectedStaff.full_name}
                            </h2>

                            <p className="text-sm text-muted-foreground">
                              {selectedStaff.staff_id}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`w-fit rounded-full border px-3 py-2 text-xs font-bold uppercase ${statusClass(
                            selectedStaff.status,
                          )}`}
                        >
                          {statusLabel(selectedStaff.status)}
                        </span>
                      </div>

                      {selectedStaff.status === "pending" && (
                        <div className="mt-6 border border-orange-500/30 bg-orange-500/10 p-4">
                          <div className="flex gap-3">
                            <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />

                            <div>
                              <p className="font-semibold">
                                Pending Staff Application
                              </p>

                              <p className="mt-1 text-sm text-muted-foreground">
                                Review the applicant's information,
                                assign their employment details and
                                click Save & Approve.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="border border-border bg-card p-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="font-display text-xl font-bold uppercase">
                            Personal Information
                          </h3>

                          <p className="mt-1 text-sm text-muted-foreground">
                            Personal details for this staff member.
                          </p>
                        </div>

                        {!editingPersonalInfo ? (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setError("");
                              setSuccess("");
                              setPersonalFullName(
                                selectedStaff.full_name || "",
                              );
                              setPersonalPhone(
                                selectedStaff.phone || "",
                              );
                              setPersonalBirthDay(
                                selectedStaff.birth_day
                                  ? String(
                                      selectedStaff.birth_day,
                                    )
                                  : "",
                              );
                              setPersonalBirthMonth(
                                selectedStaff.birth_month
                                  ? String(
                                      selectedStaff.birth_month,
                                    )
                                  : "",
                              );
                              setPersonalAddress(
                                selectedStaff.address || "",
                              );
                              setEditingPersonalInfo(true);
                            }}
                            disabled={saving}
                          >
                            <Pencil className="h-4 w-4" />
                            Edit Personal Information
                          </Button>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              onClick={() =>
                                setEditingPersonalInfo(false)
                              }
                              disabled={saving}
                            >
                              <X className="h-4 w-4" />
                              Cancel
                            </Button>

                            <Button
                              onClick={() =>
                                void savePersonalInformation()
                              }
                              disabled={saving}
                            >
                              <Save className="h-4 w-4" />
                              {saving
                                ? "Saving..."
                                : "Save Personal Information"}
                            </Button>
                          </div>
                        )}
                      </div>

                      {!editingPersonalInfo ? (
                        <div className="mt-6 grid gap-5 sm:grid-cols-2">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                              Full Name
                            </p>
                            <p className="mt-1 font-medium">
                              {selectedStaff.full_name}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                              Email
                            </p>
                            <p className="mt-1 break-all font-medium">
                              {selectedStaff.email || "—"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                              Phone
                            </p>
                            <p className="mt-1 font-medium">
                              {selectedStaff.phone || "—"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                              Birthday
                            </p>
                            <p className="mt-1 font-medium">
                              {selectedStaff.birth_day &&
                              selectedStaff.birth_month
                                ? `${selectedStaff.birth_day}/${selectedStaff.birth_month}`
                                : "—"}
                            </p>
                          </div>

                          <div className="sm:col-span-2">
                            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                              Address
                            </p>
                            <p className="mt-1 font-medium">
                              {selectedStaff.address || "—"}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-6 grid gap-5 sm:grid-cols-2">
                          <label>
                            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                              Full Name
                            </span>

                            <input
                              value={personalFullName}
                              onChange={(event) =>
                                setPersonalFullName(
                                  event.target.value,
                                )
                              }
                              className="mt-2 h-11 w-full border border-border bg-background px-3 outline-none"
                            />
                          </label>

                          <label>
                            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                              Email
                            </span>

                            <input
                              value={selectedStaff.email || ""}
                              disabled
                              readOnly
                              className="mt-2 h-11 w-full cursor-not-allowed border border-border bg-muted px-3 text-muted-foreground"
                            />
                          </label>

                          <label>
                            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                              Phone
                            </span>

                            <input
                              type="tel"
                              value={personalPhone}
                              onChange={(event) =>
                                setPersonalPhone(
                                  event.target.value,
                                )
                              }
                              className="mt-2 h-11 w-full border border-border bg-background px-3 outline-none"
                            />
                          </label>

                          <div className="grid grid-cols-2 gap-3">
                            <label>
                              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                                Birth Day
                              </span>

                              <select
                                value={personalBirthDay}
                                onChange={(event) =>
                                  setPersonalBirthDay(
                                    event.target.value,
                                  )
                                }
                                className="mt-2 h-11 w-full border border-border bg-background px-3"
                              >
                                <option value="">
                                  Day
                                </option>

                                {Array.from(
                                  { length: 31 },
                                  (_, index) => index + 1,
                                ).map((day) => (
                                  <option
                                    key={day}
                                    value={day}
                                  >
                                    {day}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label>
                              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                                Birth Month
                              </span>

                              <select
                                value={personalBirthMonth}
                                onChange={(event) =>
                                  setPersonalBirthMonth(
                                    event.target.value,
                                  )
                                }
                                className="mt-2 h-11 w-full border border-border bg-background px-3"
                              >
                                <option value="">
                                  Month
                                </option>

                                {[
                                  "January",
                                  "February",
                                  "March",
                                  "April",
                                  "May",
                                  "June",
                                  "July",
                                  "August",
                                  "September",
                                  "October",
                                  "November",
                                  "December",
                                ].map((month, index) => (
                                  <option
                                    key={month}
                                    value={index + 1}
                                  >
                                    {month}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>

                          <label className="sm:col-span-2">
                            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                              Address
                            </span>

                            <textarea
                              value={personalAddress}
                              onChange={(event) =>
                                setPersonalAddress(
                                  event.target.value,
                                )
                              }
                              rows={3}
                              className="mt-2 w-full border border-border bg-background px-3 py-3 outline-none"
                            />
                          </label>
                        </div>
                      )}
                    </div>

                    <div className="border border-border bg-card p-6">
                      <h3 className="font-display text-xl font-bold uppercase">
                        Employment Information
                      </h3>

                      <p className="mt-1 text-sm text-muted-foreground">
                        Assign the staff member's job and access level.
                      </p>

                      <div className="mt-6 grid gap-5 sm:grid-cols-2">
                        <label>
                          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                            Position
                          </span>

                          <input
                            value={position}
                            onChange={(event) =>
                              setPosition(event.target.value)
                            }
                            className="mt-2 h-11 w-full border border-border bg-background px-3"
                          />
                        </label>

                        <label>
                          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                            Department
                          </span>

                          <select
                            value={department}
                            onChange={(event) =>
                              setDepartment(event.target.value)
                            }
                            className="mt-2 h-11 w-full border border-border bg-background px-3"
                          >
                            <option value="">
                              Select department
                            </option>

                            {departments.map((item) => (
                              <option key={item} value={item}>
                                {item}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label>
                          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                            Employment Type
                          </span>

                          <select
                            value={employmentType}
                            onChange={(event) =>
                              setEmploymentType(event.target.value)
                            }
                            className="mt-2 h-11 w-full border border-border bg-background px-3"
                          >
                            {employmentTypes.map((item) => (
                              <option key={item} value={item}>
                                {item}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label>
                          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                            Employment Date
                          </span>

                          <input
                            type="date"
                            value={employmentDate}
                            onChange={(event) =>
                              setEmploymentDate(event.target.value)
                            }
                            className="mt-2 h-11 w-full border border-border bg-background px-3"
                          />
                        </label>

                        <label className="sm:col-span-2">
                          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                            Staff Role / System Access
                          </span>

                          <select
                            value={role}
                            onChange={(event) =>
                              setRole(event.target.value)
                            }
                            className="mt-2 h-11 w-full border border-border bg-background px-3"
                          >
                            {roles.map((item) => (
                              <option
                                key={item.value}
                                value={item.value}
                              >
                                {item.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <div className="mt-6 flex flex-wrap gap-3">
                        <Button
                          onClick={() =>
                            void saveStaffDetails()
                          }
                          disabled={saving}
                        >
                          <CheckCircle2 className="h-4 w-4" />

                          {selectedStaff.status === "pending"
                            ? "Save & Approve"
                            : "Save Changes"}
                        </Button>

                        {selectedStaff.status === "approved" && (
                          <>
                            <Button
                              variant="outline"
                              onClick={() =>
                                void changeStaffStatus(
                                  selectedStaff,
                                  "suspended",
                                )
                              }
                              disabled={saving}
                            >
                              <XCircle className="h-4 w-4" />
                              Suspend Staff
                            </Button>

                            <Button
                              variant="outline"
                              onClick={() =>
                                void changeStaffStatus(
                                  selectedStaff,
                                  "inactive",
                                )
                              }
                              disabled={saving}
                            >
                              <XCircle className="h-4 w-4" />
                              Mark Inactive
                            </Button>
                          </>
                        )}

                        {(selectedStaff.status === "suspended" ||
                          selectedStaff.status === "inactive") && (
                          <Button
                            onClick={() =>
                              void changeStaffStatus(
                                selectedStaff,
                                "approved",
                              )
                            }
                            disabled={saving}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Reactivate Staff
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="border border-border bg-card p-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="font-display text-xl font-bold uppercase">
                            Salary
                          </h3>

                          <p className="mt-1 text-sm text-muted-foreground">
                            Salary records for this staff member.
                          </p>
                        </div>

                        <Button
                          variant="outline"
                          onClick={() =>
                            setShowSalaryForm((current) => !current)
                          }
                        >
                          <DollarSign className="h-4 w-4" />

                          {showSalaryForm
                            ? "Close"
                            : "Add Salary"}
                        </Button>
                      </div>

                      {showSalaryForm && (
                        <div className="mt-6 border border-border bg-muted/30 p-5">
                          <div className="grid gap-5 sm:grid-cols-2">
                            <label>
                              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                                Amount
                              </span>

                              <input
                                type="number"
                                min="0"
                                value={salaryAmount}
                                onChange={(event) =>
                                  setSalaryAmount(event.target.value)
                                }
                                className="mt-2 h-11 w-full border border-border bg-background px-3"
                              />
                            </label>

                            <label>
                              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                                Status
                              </span>

                              <select
                                value={salaryStatus}
                                onChange={(event) =>
                                  setSalaryStatus(
                                    event.target.value as
                                      | "pending"
                                      | "paid"
                                      | "cancelled",
                                  )
                                }
                                className="mt-2 h-11 w-full border border-border bg-background px-3"
                              >
                                <option value="pending">
                                  Pending
                                </option>
                                <option value="paid">
                                  Paid
                                </option>
                                <option value="cancelled">
                                  Cancelled
                                </option>
                              </select>
                            </label>

                            <label>
                              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                                Pay Period Start
                              </span>

                              <input
                                type="date"
                                value={salaryStart}
                                onChange={(event) =>
                                  setSalaryStart(event.target.value)
                                }
                                className="mt-2 h-11 w-full border border-border bg-background px-3"
                              />
                            </label>

                            <label>
                              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                                Pay Period End
                              </span>

                              <input
                                type="date"
                                value={salaryEnd}
                                onChange={(event) =>
                                  setSalaryEnd(event.target.value)
                                }
                                className="mt-2 h-11 w-full border border-border bg-background px-3"
                              />
                            </label>

                            <label>
                              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                                Payment Date
                              </span>

                              <input
                                type="date"
                                value={salaryPaymentDate}
                                onChange={(event) =>
                                  setSalaryPaymentDate(
                                    event.target.value,
                                  )
                                }
                                className="mt-2 h-11 w-full border border-border bg-background px-3"
                              />
                            </label>

                            <label>
                              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                                Notes
                              </span>

                              <input
                                value={salaryNotes}
                                onChange={(event) =>
                                  setSalaryNotes(event.target.value)
                                }
                                className="mt-2 h-11 w-full border border-border bg-background px-3"
                              />
                            </label>
                          </div>

                          <div className="mt-5">
                            <Button
                              onClick={() =>
                                void addSalaryRecord()
                              }
                              disabled={saving}
                            >
                              <DollarSign className="h-4 w-4" />
                              Save Salary Record
                            </Button>
                          </div>
                        </div>
                      )}

                      <div className="mt-6 overflow-x-auto">
                        {salaryRecords.length === 0 ? (
                          <p className="py-8 text-center text-sm text-muted-foreground">
                            No salary records yet.
                          </p>
                        ) : (
                          <table className="w-full min-w-[700px] text-left text-sm">
                            <thead>
                              <tr className="border-b border-border text-xs uppercase tracking-widest text-muted-foreground">
                                <th className="px-3 py-3">
                                  Amount
                                </th>
                                <th className="px-3 py-3">
                                  Period
                                </th>
                                <th className="px-3 py-3">
                                  Payment Date
                                </th>
                                <th className="px-3 py-3">
                                  Status
                                </th>
                                <th className="px-3 py-3">
                                  Notes
                                </th>
                              </tr>
                            </thead>

                            <tbody>
                              {salaryRecords.map((record) => (
                                <tr
                                  key={record.id}
                                  className="border-b border-border"
                                >
                                  <td className="px-3 py-4 font-semibold">
                                    {formatMoney(
                                      record.amount,
                                      record.currency,
                                    )}
                                  </td>

                                  <td className="px-3 py-4">
                                    {record.pay_period_start ||
                                    record.pay_period_end
                                      ? `${formatDate(
                                          record.pay_period_start,
                                        )} – ${formatDate(
                                          record.pay_period_end,
                                        )}`
                                      : "—"}
                                  </td>

                                  <td className="px-3 py-4">
                                    {formatDate(
                                      record.payment_date,
                                    )}
                                  </td>

                                  <td className="px-3 py-4">
                                    <span className="rounded-full border border-border px-2 py-1 text-xs font-semibold uppercase">
                                      {record.status}
                                    </span>
                                  </td>

                                  <td className="px-3 py-4">
                                    {record.notes || "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>

                    <div className="border border-border bg-card p-6">
                      <div>
                        <h3 className="font-display text-xl font-bold uppercase">
                          Attendance
                        </h3>

                        <p className="mt-1 text-sm text-muted-foreground">
                          Recent staff clock-in and clock-out records.
                        </p>
                      </div>

                      <div className="mt-6 overflow-x-auto">
                        {attendanceRecords.length === 0 ? (
                          <p className="py-8 text-center text-sm text-muted-foreground">
                            No attendance records yet.
                          </p>
                        ) : (
                          <table className="w-full min-w-[650px] text-left text-sm">
                            <thead>
                              <tr className="border-b border-border text-xs uppercase tracking-widest text-muted-foreground">
                                <th className="px-3 py-3">
                                  Check-in
                                </th>
                                <th className="px-3 py-3">
                                  Check-out
                                </th>
                                <th className="px-3 py-3">
                                  Duration
                                </th>
                                <th className="px-3 py-3">
                                  Notes
                                </th>
                              </tr>
                            </thead>

                            <tbody>
                              {attendanceRecords.map((record) => {
                                const start = new Date(
                                  record.checked_in_at,
                                ).getTime();

                                const end = record.checked_out_at
                                  ? new Date(
                                      record.checked_out_at,
                                    ).getTime()
                                  : Date.now();

                                const minutes = Math.max(
                                  0,
                                  Math.floor(
                                    (end - start) / 60000,
                                  ),
                                );

                                const hours = Math.floor(
                                  minutes / 60,
                                );

                                const remainingMinutes =
                                  minutes % 60;

                                return (
                                  <tr
                                    key={record.id}
                                    className="border-b border-border"
                                  >
                                    <td className="px-3 py-4">
                                      {formatDateTime(
                                        record.checked_in_at,
                                      )}
                                    </td>

                                    <td className="px-3 py-4">
                                      {record.checked_out_at
                                        ? formatDateTime(
                                            record.checked_out_at,
                                          )
                                        : "Still inside"}
                                    </td>

                                    <td className="px-3 py-4 font-semibold">
                                      {hours > 0
                                        ? `${hours}h ${remainingMinutes}m`
                                        : `${remainingMinutes}m`}
                                    </td>

                                    <td className="px-3 py-4">
                                      {record.notes || "—"}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export const Route = createFileRoute("/staff-admin")({
  component: StaffAdminPage,
});
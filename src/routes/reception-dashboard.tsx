import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Cake,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Loader2,
  LogIn,
  LogOut,
  Phone,
  QrCode,
  RefreshCw,
  Search,
  TrendingUp,
  UserPlus,
  UserRound,
  Users,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { membershipPlans, formatNaira } from "@/lib/site-data";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/reception-dashboard")({
  component: ReceptionDashboardPage,
});

type Member = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  birth_day: number | null;
  birth_month: number | null;
};

type Membership = {
  id: string;
  member_id: string;
  plan_name: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  payment_status: string | null;
};

type Attendance = {
  id: string;
  member_id: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
  created_at: string | null;
  member?: {
    full_name: string | null;
    phone: string | null;
  } | null;
};

const planDurationDays: Record<string, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
  quarterly: 90,
  "semi-annual": 180,
  yearly: 365,
  "vip-silver": 30,
  "vip-gold": 30,
  family: 30,
  "personal-training": 30,
};

function getLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDaysToDateString(dateString: string, days: number) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + days);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDateOnly(value: unknown) {
  if (!value) return null;

  const stringValue = String(value).trim();

  if (!stringValue) return null;

  return stringValue.slice(0, 10);
}

function isMembershipValidToday(membership: Membership | null) {
  if (!membership) return false;

  const startDate = getDateOnly(membership.start_date);
  const endDate = getDateOnly(membership.end_date);

  if (!startDate || !endDate) return false;

  const today = getLocalDateString();

  return startDate <= today && today <= endDate;
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(`${value.slice(0, 10)}T12:00:00`);

  return date.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(value: string | null) {
  if (!value) return "—";

  return new Date(value).toLocaleTimeString("en-NG", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getDaysRemaining(endDate: string | null) {
  if (!endDate) return null;

  const today = new Date(`${getLocalDateString()}T12:00:00`);
  const end = new Date(`${endDate.slice(0, 10)}T12:00:00`);

  return Math.ceil(
    (end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
}

function getBirthdayLabel(member: Member) {
  if (!member.birth_day || !member.birth_month) return "Birthday not set";

  const date = new Date(
    2000,
    member.birth_month - 1,
    member.birth_day,
  );

  return date.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "long",
  });
}

function isBirthdayToday(member: Member) {
  if (!member.birth_day || !member.birth_month) return false;

  const today = new Date();

  return (
    member.birth_day === today.getDate() &&
    member.birth_month === today.getMonth() + 1
  );
}

function isBirthdayThisMonth(member: Member) {
  if (!member.birth_month) return false;

  return member.birth_month === new Date().getMonth() + 1;
}

function ExpandableSummary({
  eyebrow,
  title,
  description,
  count,
  icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  count?: number;
  icon: ReactNode;
}) {
  return (
    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 [&::-webkit-details-marker]:hidden sm:p-6">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center bg-primary text-primary-foreground">
          {icon}
        </div>

        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
            {eyebrow}
          </p>

          <h2 className="mt-1 font-display text-2xl font-bold uppercase sm:text-3xl">
            {title}
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            {description}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {typeof count === "number" && (
          <span className="hidden min-w-9 items-center justify-center bg-muted px-3 py-2 text-sm font-bold sm:flex">
            {count}
          </span>
        )}

        <ChevronDown className="size-5 transition-transform group-open:rotate-180" />
      </div>
    </summary>
  );
}

function ReceptionDashboardPage() {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  const [members, setMembers] = useState<Member[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [monthlyAttendance, setMonthlyAttendance] = useState<Attendance[]>([]);

  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  const [addMemberName, setAddMemberName] = useState("");
  const [addMemberEmail, setAddMemberEmail] = useState("");
  const [addMemberPhone, setAddMemberPhone] = useState("");
  const [addMemberAddress, setAddMemberAddress] = useState("");
  const [addMemberBirthDay, setAddMemberBirthDay] = useState("");
  const [addMemberBirthMonth, setAddMemberBirthMonth] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState(
    membershipPlans[2]?.id || "",
  );
  const [addMemberStartDate, setAddMemberStartDate] =
    useState(getLocalDateString());
  const [includeRegistrationFee, setIncludeRegistrationFee] =
    useState(true);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [addingMember, setAddingMember] = useState(false);
  const [addMemberError, setAddMemberError] = useState("");
  const [addMemberSuccess, setAddMemberSuccess] = useState<{
    memberId: string;
    membershipId: string;
    planName: string;
    startDate: string;
    endDate: string;
    total: number;
  } | null>(null);

  const selectedPlan =
    membershipPlans.find((plan) => plan.id === selectedPlanId) ||
    membershipPlans[0];

  const selectedPlanDuration = selectedPlan
    ? planDurationDays[selectedPlan.id] || 30
    : 30;

  const registrationAmount =
    selectedPlan && includeRegistrationFee
      ? selectedPlan.registration
      : 0;

  const totalAmount = selectedPlan
    ? selectedPlan.price + registrationAmount
    : 0;

  const calculatedEndDate =
    addMemberStartDate && selectedPlan
      ? addDaysToDateString(
          addMemberStartDate,
          selectedPlanDuration - 1,
        )
      : "";

  async function checkStaffAccess() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/reception-checkin";
      return false;
    }

    const { data, error } = await supabase
      .from("staff_users")
      .select("id")
      .eq("auth_user_id", user.id)
      .eq("active", true)
      .maybeSingle();

    if (error || !data) {
      await supabase.auth.signOut();
      window.location.href = "/reception-checkin";
      return false;
    }

    setAuthorized(true);
    return true;
  }

  async function loadDashboard() {
    setRefreshing(true);

    try {
      const today = getLocalDateString();

      const firstDayOfMonth = new Date();
      firstDayOfMonth.setDate(1);

      const monthStart = `${firstDayOfMonth.getFullYear()}-${String(
        firstDayOfMonth.getMonth() + 1,
      ).padStart(2, "0")}-01`;

      const [
        membersResult,
        membershipsResult,
        attendanceResult,
        monthlyAttendanceResult,
      ] = await Promise.all([
        supabase
          .from("members")
          .select(
            "id, full_name, email, phone, birth_day, birth_month",
          )
          .order("full_name", { ascending: true }),

        supabase
          .from("memberships")
          .select(
            "id, member_id, plan_name, start_date, end_date, status, payment_status",
          )
          .order("created_at", { ascending: false }),

        supabase
          .from("attendance")
          .select(
            `
              id,
              member_id,
              checked_in_at,
              checked_out_at,
              created_at,
              member:members (
                full_name,
                phone
              )
            `,
          )
          .gte("created_at", `${today}T00:00:00`)
          .lte("created_at", `${today}T23:59:59`)
          .order("created_at", { ascending: false }),

        supabase
          .from("attendance")
          .select(
            `
              id,
              member_id,
              checked_in_at,
              checked_out_at,
              created_at,
              member:members (
                full_name,
                phone
              )
            `,
          )
          .gte("created_at", `${monthStart}T00:00:00`)
          .order("created_at", { ascending: false }),
      ]);

      if (membersResult.error) throw membersResult.error;
      if (membershipsResult.error) throw membershipsResult.error;
      if (attendanceResult.error) throw attendanceResult.error;
      if (monthlyAttendanceResult.error)
        throw monthlyAttendanceResult.error;

      setMembers((membersResult.data || []) as Member[]);
      setMemberships((membershipsResult.data || []) as Membership[]);
      setAttendance((attendanceResult.data || []) as Attendance[]);
      setMonthlyAttendance(
        (monthlyAttendanceResult.data || []) as Attendance[],
      );
    } catch (error) {
      console.error("Dashboard loading error:", error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function init() {
      const ok = await checkStaffAccess();

      if (ok && mounted) {
        await loadDashboard();
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  const latestMembershipByMember = useMemo(() => {
    const map = new Map<string, Membership>();

    for (const membership of memberships) {
      if (!map.has(membership.member_id)) {
        map.set(membership.member_id, membership);
      }
    }

    return map;
  }, [memberships]);

  const insideMemberIds = useMemo(() => {
    return new Set(
      attendance
        .filter(
          (item) =>
            item.checked_in_at && !item.checked_out_at,
        )
        .map((item) => item.member_id),
    );
  }, [attendance]);

  const currentlyInside = useMemo(() => {
    return members.filter((member) => insideMemberIds.has(member.id));
  }, [members, insideMemberIds]);

  const birthdaysToday = useMemo(
    () => members.filter(isBirthdayToday),
    [members],
  );

  const birthdaysThisMonth = useMemo(
    () => members.filter(isBirthdayThisMonth),
    [members],
  );

  const expiringSoon = useMemo(() => {
    return members
      .map((member) => ({
        member,
        membership: latestMembershipByMember.get(member.id) || null,
      }))
      .filter(({ membership }) => {
        if (!membership?.end_date) return false;

        const days = getDaysRemaining(membership.end_date);

        return days !== null && days >= 0 && days <= 7;
      })
      .sort((a, b) => {
        const aDate = a.membership?.end_date || "";
        const bDate = b.membership?.end_date || "";

        return aDate.localeCompare(bDate);
      });
  }, [members, latestMembershipByMember]);

  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return [];

    return members
      .filter((member) => {
        return (
          member.full_name?.toLowerCase().includes(query) ||
          member.email?.toLowerCase().includes(query) ||
          member.phone?.toLowerCase().includes(query)
        );
      })
      .slice(0, 20);
  }, [members, search]);

  const visitsToday = attendance.length;

  const monthlyVisits = monthlyAttendance.length;

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/reception-checkin";
  }

  async function handleAddMember(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setAddMemberError("");
    setAddMemberSuccess(null);

    if (!addMemberName.trim()) {
      setAddMemberError("Member name is required.");
      return;
    }

    if (!selectedPlan) {
      setAddMemberError("Please select a membership plan.");
      return;
    }

    if (!addMemberStartDate) {
      setAddMemberError("Membership start date is required.");
      return;
    }

    if (
      addMemberBirthDay &&
      (Number(addMemberBirthDay) < 1 ||
        Number(addMemberBirthDay) > 31)
    ) {
      setAddMemberError("Please enter a valid birth day.");
      return;
    }

    if (
      addMemberBirthMonth &&
      (Number(addMemberBirthMonth) < 1 ||
        Number(addMemberBirthMonth) > 12)
    ) {
      setAddMemberError("Please select a valid birth month.");
      return;
    }

    setAddingMember(true);

    try {
      const durationDays =
        planDurationDays[selectedPlan.id] || 30;

      const { data, error } = await supabase.rpc(
        "reception_add_member",
        {
          p_full_name: addMemberName.trim(),
          p_email: addMemberEmail.trim() || null,
          p_phone: addMemberPhone.trim() || null,
          p_address: addMemberAddress.trim() || null,
          p_birth_day: addMemberBirthDay
            ? Number(addMemberBirthDay)
            : null,
          p_birth_month: addMemberBirthMonth
            ? Number(addMemberBirthMonth)
            : null,
          p_plan_name: selectedPlan.name,
          p_start_date: addMemberStartDate,
          p_duration_days: durationDays,
          p_amount: totalAmount,
          p_payment_method: paymentMethod,
        },
      );

      if (error) throw error;

      const result = data as {
        success?: boolean;
        member_id?: string;
        membership_id?: string;
        plan_name?: string;
        start_date?: string;
        end_date?: string;
      };

      if (!result?.success) {
        throw new Error("Member registration failed.");
      }

      setAddMemberSuccess({
        memberId: result.member_id || "",
        membershipId: result.membership_id || "",
        planName: result.plan_name || selectedPlan.name,
        startDate:
          result.start_date || addMemberStartDate,
        endDate:
          result.end_date || calculatedEndDate,
        total: totalAmount,
      });

      setAddMemberName("");
      setAddMemberEmail("");
      setAddMemberPhone("");
      setAddMemberAddress("");
      setAddMemberBirthDay("");
      setAddMemberBirthMonth("");
      setSelectedPlanId(membershipPlans[2]?.id || "");
      setAddMemberStartDate(getLocalDateString());
      setIncludeRegistrationFee(true);
      setPaymentMethod("Cash");

      await loadDashboard();
    } catch (error: any) {
      console.error("Add member error:", error);

      setAddMemberError(
        error?.message ||
          "Unable to add member. Please try again.",
      );
    } finally {
      setAddingMember(false);
    }
  }

  function sendWhatsApp(message: string, phone: string | null) {
    if (!phone) return;

    const cleanPhone = phone.replace(/\D/g, "");

    const normalizedPhone = cleanPhone.startsWith("0")
      ? `234${cleanPhone.slice(1)}`
      : cleanPhone;

    window.open(
      `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(
        message,
      )}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  if (!authorized || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-sm font-bold uppercase tracking-wider">
          <Loader2 className="size-5 animate-spin" />
          Loading reception dashboard...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted/30">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-primary">
              Super Plus Fitness & Spa
            </p>

            <h1 className="mt-1 font-display text-3xl font-bold uppercase sm:text-4xl">
              Reception Dashboard
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={loadDashboard}
              disabled={refreshing}
            >
              <RefreshCw
                className={`size-4 ${
                  refreshing ? "animate-spin" : ""
                }`}
              />
              <span className="hidden sm:inline">
                Refresh
              </span>
            </Button>

            <Button
              variant="outline"
              onClick={handleLogout}
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* SEARCH */}
        <section className="mb-8">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search members by name, phone or email..."
              className="h-14 w-full border border-border bg-background pl-12 pr-4 text-sm outline-none transition focus:border-primary"
            />
          </div>

          {searchResults.length > 0 && (
            <div className="mt-2 border border-border bg-background shadow-sm">
              {searchResults.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => {
                    setSelectedMember(member);
                    setSearch("");
                  }}
                  className="flex w-full items-center justify-between border-b border-border px-4 py-4 text-left last:border-b-0 hover:bg-muted"
                >
                  <div>
                    <p className="font-bold">
                      {member.full_name || "Unnamed member"}
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      {member.phone || member.email || "No contact"}
                    </p>
                  </div>

                  <span className="text-xs font-extrabold uppercase text-primary">
                    View Profile
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* OVERVIEW */}
        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="border border-border bg-background p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                Currently Inside
              </p>

              <LogIn className="size-5 text-primary" />
            </div>

            <p className="mt-4 font-display text-4xl font-bold">
              {currentlyInside.length}
            </p>
          </div>

          <div className="border border-border bg-background p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                Visits Today
              </p>

              <Activity className="size-5 text-primary" />
            </div>

            <p className="mt-4 font-display text-4xl font-bold">
              {visitsToday}
            </p>
          </div>

          <div className="border border-border bg-background p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                Birthdays Today
              </p>

              <Cake className="size-5 text-primary" />
            </div>

            <p className="mt-4 font-display text-4xl font-bold">
              {birthdaysToday.length}
            </p>
          </div>

          <div className="border border-border bg-background p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                Expiring Soon
              </p>

              <Clock3 className="size-5 text-primary" />
            </div>

            <p className="mt-4 font-display text-4xl font-bold">
              {expiringSoon.length}
            </p>
          </div>
        </section>

        {/* ADD A MEMBER — COLLAPSED BY DEFAULT */}
        <details className="group mb-10">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 border border-border bg-background p-5 shadow-sm [&::-webkit-details-marker]:hidden sm:p-6">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center bg-primary text-primary-foreground">
                <UserPlus className="size-6" />
              </div>

              <div className="min-w-0">
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
                  Reception
                </p>

                <h2 className="mt-1 font-display text-2xl font-bold uppercase sm:text-3xl">
                  Add A Member
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Register a new member, activate their membership and record their payment.
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 text-xs font-extrabold uppercase text-primary">
              <span className="hidden sm:inline">
                Open
              </span>

              <ChevronDown className="size-5 transition-transform group-open:rotate-180" />
            </div>
          </summary>

          <div className="mt-3 border border-border bg-background shadow-sm">
            <div className="border-b border-border bg-primary p-6 text-primary-foreground sm:p-7">
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] opacity-80">
                New Registration
              </p>

              <h3 className="mt-2 font-display text-3xl font-bold uppercase">
                Member Details
              </h3>

              <p className="mt-2 max-w-2xl text-sm opacity-90">
                Add a walk-in member, activate their membership and record the payment received at reception.
              </p>
            </div>

            <form
              onSubmit={handleAddMember}
              className="space-y-8 p-6 sm:p-8"
            >
              <div>
                <p className="mb-4 text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
                  Personal Information
                </p>

                <div className="grid gap-5 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-bold">
                      Full Name *
                    </label>

                    <input
                      value={addMemberName}
                      onChange={(event) =>
                        setAddMemberName(event.target.value)
                      }
                      placeholder="Member full name"
                      className="h-12 w-full border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold">
                      Email
                    </label>

                    <input
                      type="email"
                      value={addMemberEmail}
                      onChange={(event) =>
                        setAddMemberEmail(event.target.value)
                      }
                      placeholder="member@email.com"
                      className="h-12 w-full border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold">
                      Phone
                    </label>

                    <input
                      value={addMemberPhone}
                      onChange={(event) =>
                        setAddMemberPhone(event.target.value)
                      }
                      placeholder="080..."
                      className="h-12 w-full border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-bold">
                      Address
                    </label>

                    <textarea
                      value={addMemberAddress}
                      onChange={(event) =>
                        setAddMemberAddress(event.target.value)
                      }
                      placeholder="Member address"
                      rows={3}
                      className="w-full resize-none border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-4 text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
                  Birthday
                </p>

                <p className="mb-4 text-sm text-muted-foreground">
                  Year is not required. Only the day and month are collected.
                </p>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-bold">
                      Birth Day
                    </label>

                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={addMemberBirthDay}
                      onChange={(event) =>
                        setAddMemberBirthDay(event.target.value)
                      }
                      placeholder="1–31"
                      className="h-12 w-full border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold">
                      Birth Month
                    </label>

                    <select
                      value={addMemberBirthMonth}
                      onChange={(event) =>
                        setAddMemberBirthMonth(event.target.value)
                      }
                      className="h-12 w-full border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                    >
                      <option value="">
                        Select month
                      </option>
                      <option value="1">January</option>
                      <option value="2">February</option>
                      <option value="3">March</option>
                      <option value="4">April</option>
                      <option value="5">May</option>
                      <option value="6">June</option>
                      <option value="7">July</option>
                      <option value="8">August</option>
                      <option value="9">September</option>
                      <option value="10">October</option>
                      <option value="11">November</option>
                      <option value="12">December</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-4 text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
                  Membership
                </p>

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-bold">
                      Membership Plan *
                    </label>

                    <select
                      value={selectedPlanId}
                      onChange={(event) =>
                        setSelectedPlanId(event.target.value)
                      }
                      className="h-12 w-full border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                    >
                      {membershipPlans.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.name} — {formatNaira(plan.price)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold">
                      Start Date *
                    </label>

                    <input
                      type="date"
                      value={addMemberStartDate}
                      onChange={(event) =>
                        setAddMemberStartDate(event.target.value)
                      }
                      className="h-12 w-full border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                    />
                  </div>
                </div>

                {selectedPlan && (
                  <div className="mt-5 grid gap-4 sm:grid-cols-3">
                    <div className="border border-border bg-muted/40 p-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Plan Price
                      </p>

                      <p className="mt-2 text-xl font-bold">
                        {formatNaira(selectedPlan.price)}
                      </p>
                    </div>

                    <div className="border border-border bg-muted/40 p-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Duration
                      </p>

                      <p className="mt-2 text-xl font-bold">
                        {selectedPlan.duration}
                      </p>
                    </div>

                    <div className="border border-border bg-muted/40 p-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Membership Ends
                      </p>

                      <p className="mt-2 text-xl font-bold">
                        {formatDate(calculatedEndDate)}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <p className="mb-4 text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
                  Payment
                </p>

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-bold">
                      Payment Method
                    </label>

                    <select
                      value={paymentMethod}
                      onChange={(event) =>
                        setPaymentMethod(event.target.value)
                      }
                      className="h-12 w-full border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                    >
                      <option value="Cash">Cash</option>
                      <option value="POS">POS</option>
                      <option value="Bank Transfer">
                        Bank Transfer
                      </option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    <label className="flex min-h-12 w-full cursor-pointer items-center gap-3 border border-border px-4">
                      <input
                        type="checkbox"
                        checked={includeRegistrationFee}
                        onChange={(event) =>
                          setIncludeRegistrationFee(
                            event.target.checked,
                          )
                        }
                        className="size-4"
                      />

                      <span className="text-sm font-bold">
                        Include registration fee
                      </span>
                    </label>
                  </div>
                </div>

                <div className="mt-5 border border-primary bg-primary/5 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-extrabold uppercase tracking-wider">
                      Total Payment
                    </span>

                    <span className="font-display text-3xl font-bold">
                      {formatNaira(totalAmount)}
                    </span>
                  </div>

                  {selectedPlan && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {selectedPlan.name}:{" "}
                      {formatNaira(selectedPlan.price)}
                      {includeRegistrationFee &&
                        selectedPlan.registration > 0 &&
                        ` + ${formatNaira(
                          selectedPlan.registration,
                        )} registration`}
                    </p>
                  )}
                </div>
              </div>

              {addMemberError && (
                <div className="flex items-start gap-3 border border-destructive/30 bg-destructive/5 p-4 text-sm">
                  <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" />

                  <div>
                    <p className="font-bold">
                      Registration failed
                    </p>

                    <p className="mt-1 text-muted-foreground">
                      {addMemberError}
                    </p>
                  </div>
                </div>
              )}

              {addMemberSuccess && (
                <div className="border border-primary bg-primary/5 p-5">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />

                    <div>
                      <p className="font-bold">
                        Member added successfully
                      </p>

                      <p className="mt-1 text-sm text-muted-foreground">
                        {addMemberSuccess.planName} has been activated.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Start
                      </p>

                      <p className="mt-1 font-bold">
                        {formatDate(
                          addMemberSuccess.startDate,
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        End
                      </p>

                      <p className="mt-1 font-bold">
                        {formatDate(
                          addMemberSuccess.endDate,
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Paid
                      </p>

                      <p className="mt-1 font-bold">
                        {formatNaira(
                          addMemberSuccess.total,
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <Button
                  type="submit"
                  size="lg"
                  disabled={addingMember}
                  className="min-w-48"
                >
                  {addingMember ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Adding Member...
                    </>
                  ) : (
                    <>
                      <UserPlus className="size-4" />
                      Add Member
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </details>

        {/* ATTENDANCE ANALYTICS */}
        <details className="group mb-4 border border-border bg-background shadow-sm">
          <ExpandableSummary
            eyebrow="Analytics"
            title="Attendance Analytics"
            description="A quick view of today's and this month's activity."
            icon={<BarChart3 className="size-5" />}
          />

          <div className="border-t border-border p-5 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="border border-border p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Today
                </p>

                <p className="mt-2 font-display text-3xl font-bold">
                  {visitsToday}
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  total visits
                </p>
              </div>

              <div className="border border-border p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  This Month
                </p>

                <p className="mt-2 font-display text-3xl font-bold">
                  {monthlyVisits}
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  total visits
                </p>
              </div>

              <div className="border border-border p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Members
                </p>

                <p className="mt-2 font-display text-3xl font-bold">
                  {members.length}
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  registered members
                </p>
              </div>

              <div className="border border-border p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Inside Now
                </p>

                <p className="mt-2 font-display text-3xl font-bold">
                  {currentlyInside.length}
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  currently checked in
                </p>
              </div>
            </div>
          </div>
        </details>

        {/* TODAY'S ATTENDANCE */}
        <details className="group mb-4 border border-border bg-background shadow-sm">
          <ExpandableSummary
            eyebrow="Today"
            title="Today's Attendance"
            description="Every check-in and check-out recorded today."
            count={attendance.length}
            icon={<Clock3 className="size-5" />}
          />

          <div className="border-t border-border">
            {attendance.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">
                No attendance has been recorded today.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {attendance.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-bold">
                        {item.member?.full_name ||
                          "Unknown member"}
                      </p>

                      <p className="mt-1 text-sm text-muted-foreground">
                        {item.member?.phone || "No phone"}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm">
                      <div>
                        <p className="text-xs font-bold uppercase text-muted-foreground">
                          In
                        </p>

                        <p className="font-bold">
                          {formatTime(
                            item.checked_in_at,
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-bold uppercase text-muted-foreground">
                          Out
                        </p>

                        <p className="font-bold">
                          {item.checked_out_at
                            ? formatTime(
                                item.checked_out_at,
                              )
                            : "Inside"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </details>

        {/* CURRENTLY INSIDE */}
        <details className="group mb-4 border border-border bg-background shadow-sm">
          <ExpandableSummary
            eyebrow="Live"
            title="Currently Inside"
            description="Members who are currently checked into the gym."
            count={currentlyInside.length}
            icon={<Users className="size-5" />}
          />

          <div className="border-t border-border">
            {currentlyInside.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">
                Nobody is currently inside the gym.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {currentlyInside.map((member) => (
                  <div
                    key={member.id}
                    className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center bg-primary/10 text-primary">
                        <UserRound className="size-5" />
                      </div>

                      <div>
                        <p className="font-bold">
                          {member.full_name}
                        </p>

                        <p className="mt-1 text-sm text-muted-foreground">
                          {member.phone || "No phone"}
                        </p>
                      </div>
                    </div>

                    <span className="inline-flex w-fit items-center gap-2 bg-primary/10 px-3 py-2 text-xs font-extrabold uppercase text-primary">
                      <CheckCircle2 className="size-4" />
                      Inside
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </details>

        {/* EXPIRING SOON */}
        <details className="group mb-4 border border-border bg-background shadow-sm">
          <ExpandableSummary
            eyebrow="Membership"
            title="Expiring Soon"
            description="Members whose memberships expire within the next 7 days."
            count={expiringSoon.length}
            icon={<TrendingUp className="size-5" />}
          />

          <div className="border-t border-border">
            {expiringSoon.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">
                No memberships are expiring within the next 7 days.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {expiringSoon.map(
                  ({ member, membership }) => {
                    const daysRemaining =
                      getDaysRemaining(
                        membership?.end_date || null,
                      );

                    return (
                      <div
                        key={member.id}
                        className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between"
                      >
                        <div>
                          <p className="font-bold">
                            {member.full_name}
                          </p>

                          <p className="mt-1 text-sm text-muted-foreground">
                            {membership?.plan_name ||
                              "Membership"}{" "}
                            · Expires{" "}
                            {formatDate(
                              membership?.end_date ||
                                null,
                            )}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <span className="bg-muted px-3 py-2 text-xs font-bold">
                            {daysRemaining === 0
                              ? "Expires today"
                              : `${daysRemaining} ${
                                  daysRemaining === 1
                                    ? "day"
                                    : "days"
                                } left`}
                          </span>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              sendWhatsApp(
                                `Hello ${
                                  member.full_name ||
                                  "there"
                                }, this is Super Plus Fitness & Spa. Your ${
                                  membership?.plan_name ||
                                  "membership"
                                } expires on ${formatDate(
                                  membership?.end_date ||
                                    null,
                                )}. Contact us to renew your membership.`,
                                member.phone,
                              )
                            }
                            disabled={!member.phone}
                          >
                            <Phone className="size-4" />
                            WhatsApp
                          </Button>
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            )}
          </div>
        </details>

        {/* TODAY'S BIRTHDAYS */}
        <details className="group mb-4 border border-border bg-background shadow-sm">
          <ExpandableSummary
            eyebrow="Members"
            title="Today's Birthdays"
            description="Members celebrating their birthday today."
            count={birthdaysToday.length}
            icon={<Cake className="size-5" />}
          />

          <div className="border-t border-border">
            {birthdaysToday.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">
                No member birthdays today.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {birthdaysToday.map((member) => (
                  <div
                    key={member.id}
                    className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-bold">
                        {member.full_name}
                      </p>

                      <p className="mt-1 text-sm text-muted-foreground">
                        {getBirthdayLabel(member)}
                      </p>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        sendWhatsApp(
                          `Happy Birthday ${
                            member.full_name ||
                            "from everyone"
                          }! 🎉🎂 Super Plus Fitness & Spa wishes you a fantastic birthday and a wonderful year ahead!`,
                          member.phone,
                        )
                      }
                      disabled={!member.phone}
                    >
                      <Phone className="size-4" />
                      Send Birthday Message
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </details>

        {/* BIRTHDAYS THIS MONTH */}
        <details className="group mb-8 border border-border bg-background shadow-sm">
          <ExpandableSummary
            eyebrow="Members"
            title="Birthdays This Month"
            description="All members with birthdays during the current month."
            count={birthdaysThisMonth.length}
            icon={<Cake className="size-5" />}
          />

          <div className="border-t border-border">
            {birthdaysThisMonth.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">
                No birthdays recorded for this month.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {birthdaysThisMonth
                  .sort((a, b) => {
                    return (
                      (a.birth_day || 0) -
                      (b.birth_day || 0)
                    );
                  })
                  .map((member) => (
                    <div
                      key={member.id}
                      className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-bold">
                          {member.full_name}
                        </p>

                        <p className="mt-1 text-sm text-muted-foreground">
                          {getBirthdayLabel(member)}
                        </p>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          sendWhatsApp(
                            `Hello ${
                              member.full_name ||
                              "there"
                            }, Super Plus Fitness & Spa is wishing you an early happy birthday! 🎉 We look forward to celebrating you.`,
                            member.phone,
                          )
                        }
                        disabled={!member.phone}
                      >
                        <Phone className="size-4" />
                        WhatsApp
                      </Button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </details>

        {/* QUICK ACTIONS */}
        <section className="mb-8">
          <div className="mb-4">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
              Reception
            </p>

            <h2 className="mt-1 font-display text-3xl font-bold uppercase">
              Quick Actions
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Link
              to="/reception-checkin"
              className="flex items-center justify-between border border-border bg-background p-5 shadow-sm transition hover:border-primary"
            >
              <div className="flex items-center gap-4">
                <div className="flex size-11 items-center justify-center bg-primary text-primary-foreground">
                  <QrCode className="size-5" />
                </div>

                <div>
                  <p className="font-bold uppercase">
                    Reception Check-In
                  </p>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Scan member QR codes.
                  </p>
                </div>
              </div>

              <ChevronDown className="size-5 -rotate-90" />
            </Link>

            <button
              type="button"
              onClick={loadDashboard}
              className="flex items-center justify-between border border-border bg-background p-5 text-left shadow-sm transition hover:border-primary"
            >
              <div className="flex items-center gap-4">
                <div className="flex size-11 items-center justify-center bg-primary text-primary-foreground">
                  <RefreshCw className="size-5" />
                </div>

                <div>
                  <p className="font-bold uppercase">
                    Refresh Dashboard
                  </p>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Load the latest member and attendance data.
                  </p>
                </div>
              </div>

              <RefreshCw className="size-5" />
            </button>
          </div>
        </section>
      </div>

      {/* MEMBER PROFILE MODAL */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto border border-border bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-border p-5">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
                  Member Profile
                </p>

                <h2 className="mt-1 font-display text-2xl font-bold uppercase">
                  {selectedMember.full_name ||
                    "Unnamed Member"}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelectedMember(null)}
                className="flex size-10 items-center justify-center border border-border hover:bg-muted"
                aria-label="Close"
              >
                <XCircle className="size-5" />
              </button>
            </div>

            <div className="space-y-5 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Phone
                  </p>

                  <p className="mt-1 font-bold">
                    {selectedMember.phone || "Not provided"}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Email
                  </p>

                  <p className="mt-1 break-all font-bold">
                    {selectedMember.email || "Not provided"}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Birthday
                  </p>

                  <p className="mt-1 font-bold">
                    {getBirthdayLabel(selectedMember)}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Membership
                  </p>

                  <p className="mt-1 font-bold">
                    {latestMembershipByMember.get(
                      selectedMember.id,
                    )?.plan_name || "No membership"}
                  </p>
                </div>
              </div>

              {(() => {
                const membership =
                  latestMembershipByMember.get(
                    selectedMember.id,
                  ) || null;

                const valid =
                  isMembershipValidToday(membership);

                return (
                  <div
                    className={`border p-4 ${
                      valid
                        ? "border-primary bg-primary/5"
                        : "border-destructive/30 bg-destructive/5"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {valid ? (
                        <CheckCircle2 className="size-5 text-primary" />
                      ) : (
                        <XCircle className="size-5 text-destructive" />
                      )}

                      <div>
                        <p className="font-bold">
                          {valid
                            ? "Membership Active"
                            : "Membership Not Active"}
                        </p>

                        <p className="mt-1 text-sm text-muted-foreground">
                          {membership
                            ? `${formatDate(
                                membership.start_date,
                              )} – ${formatDate(
                                membership.end_date,
                              )}`
                            : "No membership found"}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="flex flex-col gap-3 sm:flex-row">
                {selectedMember.phone && (
                  <Button
                    className="flex-1"
                    onClick={() =>
                      sendWhatsApp(
                        `Hello ${
                          selectedMember.full_name ||
                          "there"
                        }, this is Super Plus Fitness & Spa.`,
                        selectedMember.phone,
                      )
                    }
                  >
                    <Phone className="size-4" />
                    WhatsApp
                  </Button>
                )}

                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setSelectedMember(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
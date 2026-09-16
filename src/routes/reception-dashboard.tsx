import {
  createFileRoute,
  Link,
} from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Cake,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Loader2,
  LogIn,
  Phone,
  QrCode,
  RefreshCw,
  Search,
  TrendingUp,
  UserPlus,
  UserRound,
  Users,
  XCircle,
  Pause,
  Play,
  CalendarPlus,
    Ban,
  Plus,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  membershipPlans,
  formatNaira,
} from "@/lib/site-data";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute(
  "/reception-dashboard",
)({
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
  paused_at?: string | null;
  paused_until?: string | null;
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
  "personal-training-only": 30,
};

const receptionOnlyPlan = {
  id: "personal-training-only",
  name: "Personal Training Only",
  category: "Training" as const,
  group: "Training" as const,
  price: 30000,
  duration: "One month",
  registration: 0,
  benefits: [
    "Personal training only",
    "30-day validity",
    "Can run concurrently with another membership",
  ],
  checkoutUrl: "",
};

const customMembershipPlan = {
  id: "custom-plan",
  name: "Custom Plan",
  category: "Membership" as const,
  group: "Membership" as const,
  price: 0,
  duration: "Custom duration",
  registration: 7000,
  benefits: [
    "Custom number of days",
    "Custom price",
    "Optional ₦7,000 registration fee",
  ],
  checkoutUrl: "",
};

function getLocalDateString() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDaysToDateString(
  dateString: string,
  days: number,
) {
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

function getDaysBetween(
  startDate: string,
  endDate: string,
) {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);

  return Math.max(
    0,
    Math.ceil(
      (end.getTime() - start.getTime()) /
        (1000 * 60 * 60 * 24),
    ),
  );
}

function isMembershipValidToday(
  membership: Membership | null,
) {
  if (!membership) return false;

  const status = String(
    membership.status || "",
  ).toLowerCase();

  if (
    status === "paused" ||
    status === "cancelled"
  ) {
    return false;
  }

  const startDate = getDateOnly(
    membership.start_date,
  );

  const endDate = getDateOnly(
    membership.end_date,
  );

  if (!startDate || !endDate) return false;

  const today = getLocalDateString();

  return (
    startDate <= today &&
    today <= endDate
  );
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const dateOnly = getDateOnly(value);

  if (!dateOnly) return "—";

  const date = new Date(`${dateOnly}T12:00:00`);

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

  const endDateOnly = getDateOnly(endDate);

  if (!endDateOnly) return null;

  const today = new Date(
    `${getLocalDateString()}T12:00:00`,
  );

  const end = new Date(`${endDateOnly}T12:00:00`);

  return Math.ceil(
    (end.getTime() - today.getTime()) /
      (1000 * 60 * 60 * 24),
  );
}

function getBirthdayLabel(member: Member) {
  if (
    !member.birth_day ||
    !member.birth_month
  ) {
    return "Birthday not set";
  }

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
  if (
    !member.birth_day ||
    !member.birth_month
  ) {
    return false;
  }

  const today = new Date();

  return (
    member.birth_day === today.getDate() &&
    member.birth_month === today.getMonth() + 1
  );
}

function isBirthdayThisMonth(member: Member) {
  if (!member.birth_month) return false;

  return (
    member.birth_month ===
    new Date().getMonth() + 1
  );
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
  const [monthlyAttendance, setMonthlyAttendance] =
    useState<Attendance[]>([]);

  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const [selectedMember, setSelectedMember] =
    useState<Member | null>(null);

  const [selectedMembershipId, setSelectedMembershipId] =
    useState<string | null>(null);

  const [membershipAction, setMembershipAction] =
    useState<
      "extend" | "pause" | "resume" | "cancel" | null
    >(null);

  const [extensionDays, setExtensionDays] =
    useState("7");

  const [pauseUntilDate, setPauseUntilDate] =
    useState(
      addDaysToDateString(
        getLocalDateString(),
        7,
      ),
    );

  const [membershipActionLoading, setMembershipActionLoading] =
    useState(false);

  const [membershipActionError, setMembershipActionError] =
    useState("");

  const [membershipActionSuccess, setMembershipActionSuccess] =
    useState("");
  const [deletingMembershipId, setDeletingMembershipId] =
    useState<string | null>(null);

  const [addMembershipOpen, setAddMembershipOpen] =
    useState(false);

  const [addMembershipPlanId, setAddMembershipPlanId] =
    useState(membershipPlans[2]?.id || "");

  const [addMembershipStartDate, setAddMembershipStartDate] =
    useState(getLocalDateString());

  const [addMembershipPaymentMethod, setAddMembershipPaymentMethod] =
    useState("Cash");

  /*
   * Custom Plan fields.
   *
   * These are only used by:
   * Member Profile → Add Another Membership.
   */
  const [customMembershipDays, setCustomMembershipDays] =
    useState("30");

  const [customMembershipPrice, setCustomMembershipPrice] =
    useState("");

  const [customIncludeRegistrationFee, setCustomIncludeRegistrationFee] =
    useState(true);

  const [addingMembership, setAddingMembership] =
    useState(false);

  const [addMembershipError, setAddMembershipError] =
    useState("");

  const [addMembershipSuccess, setAddMembershipSuccess] =
    useState("");

  const [addMemberName, setAddMemberName] =
    useState("");

  const [addMemberEmail, setAddMemberEmail] =
    useState("");

  const [addMemberPhone, setAddMemberPhone] =
    useState("");

  const [addMemberAddress, setAddMemberAddress] =
    useState("");

  const [addMemberBirthDay, setAddMemberBirthDay] =
    useState("");

  const [addMemberBirthMonth, setAddMemberBirthMonth] =
    useState("");

  const [selectedPlanId, setSelectedPlanId] =
    useState(membershipPlans[2]?.id || "");

  const [addMemberStartDate, setAddMemberStartDate] =
    useState(getLocalDateString());

  const [includeRegistrationFee, setIncludeRegistrationFee] =
    useState(true);

  const [paymentMethod, setPaymentMethod] =
    useState("Cash");

  const [addingMember, setAddingMember] =
    useState(false);

  const [addMemberError, setAddMemberError] =
    useState("");

  const [addMemberSuccess, setAddMemberSuccess] =
    useState<{
      memberId: string;
      membershipId: string;
      planName: string;
      startDate: string;
      endDate: string;
      total: number;
    } | null>(null);

  /*
   * Custom Plan is deliberately added only to receptionPlans.
   * It is NOT added to the public customer website.
   */
  const receptionPlans = useMemo(
    () => [
      ...membershipPlans,
      receptionOnlyPlan,
      customMembershipPlan,
    ],
    [],
  );

  const selectedPlan =
    receptionPlans.find(
      (plan) => plan.id === selectedPlanId,
    ) || receptionPlans[0];

  const selectedAddMembershipPlan =
    receptionPlans.find(
      (plan) => plan.id === addMembershipPlanId,
    ) || receptionPlans[0];

  const isPersonalTrainingOnly =
    selectedPlan?.id ===
    "personal-training-only";

  const isAddMembershipPersonalTrainingOnly =
    selectedAddMembershipPlan?.id ===
    "personal-training-only";

  const isCustomAddMembership =
    selectedAddMembershipPlan?.id ===
    "custom-plan";

  const selectedPlanDuration =
    selectedPlan
      ? planDurationDays[selectedPlan.id] || 30
      : 30;

  const addMembershipDuration =
    selectedAddMembershipPlan
      ? planDurationDays[
          selectedAddMembershipPlan.id
        ] || 30
      : 30;

  const registrationAmount =
    selectedPlan &&
    !isPersonalTrainingOnly &&
    includeRegistrationFee
      ? selectedPlan.registration
      : 0;

  const totalAmount = selectedPlan
    ? selectedPlan.price + registrationAmount
    : 0;

  /*
   * Custom Plan registration fee is always exactly ₦7,000.
   */
  const customRegistrationAmount =
    isCustomAddMembership &&
    customIncludeRegistrationFee
      ? 7000
      : 0;

  const customDaysNumber =
    Number(customMembershipDays);

  const customPriceNumber =
    Number(customMembershipPrice);

  const customMembershipTotal =
    customPriceNumber > 0
      ? customPriceNumber +
        customRegistrationAmount
      : customRegistrationAmount;

  const calculatedEndDate =
    addMemberStartDate && selectedPlan
      ? addDaysToDateString(
          addMemberStartDate,
          selectedPlanDuration - 1,
        )
      : "";

  const standardAddMembershipEndDate =
    addMembershipStartDate &&
    selectedAddMembershipPlan &&
    !isCustomAddMembership
      ? addDaysToDateString(
          addMembershipStartDate,
          addMembershipDuration - 1,
        )
      : "";

  const customAddMembershipEndDate =
    addMembershipStartDate &&
    Number.isInteger(customDaysNumber) &&
    customDaysNumber >= 1 &&
    customDaysNumber <= 3650
      ? addDaysToDateString(
          addMembershipStartDate,
          customDaysNumber - 1,
        )
      : "";

  const addMembershipEndDate =
    isCustomAddMembership
      ? customAddMembershipEndDate
      : standardAddMembershipEndDate;

  const addMembershipTotal =
    isCustomAddMembership
      ? customMembershipTotal
      : selectedAddMembershipPlan?.price || 0;

  const pauseDaysPreview =
    pauseUntilDate &&
    membershipAction === "pause"
      ? getDaysBetween(
          getLocalDateString(),
          pauseUntilDate,
        )
      : 0;

  const selectedMembershipCurrentEnd =
    selectedMembershipId
      ? memberships.find(
          (membership) =>
            membership.id === selectedMembershipId,
        )?.end_date || null
      : null;

  const projectedExpiryAfterPause =
    selectedMembershipCurrentEnd &&
    pauseUntilDate &&
    membershipAction === "pause"
      ? addDaysToDateString(
          selectedMembershipCurrentEnd,
          pauseDaysPreview,
        )
      : null;

  async function checkStaffAccess() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href =
        "/reception-checkin";
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

      window.location.href =
        "/reception-checkin";

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
          .order("full_name", {
            ascending: true,
          }),

        supabase
          .from("memberships")
          .select(
            "id, member_id, plan_name, start_date, end_date, status, payment_status, paused_at, paused_until",
          )
          .order("created_at", {
            ascending: false,
          }),

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
          .gte(
            "created_at",
            `${today}T00:00:00`,
          )
          .lte(
            "created_at",
            `${today}T23:59:59`,
          )
          .order("created_at", {
            ascending: false,
          }),

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
          .gte(
            "created_at",
            `${monthStart}T00:00:00`,
          )
          .order("created_at", {
            ascending: false,
          }),
      ]);

      if (membersResult.error)
        throw membersResult.error;

      if (membershipsResult.error)
        throw membershipsResult.error;

      if (attendanceResult.error)
        throw attendanceResult.error;

      if (monthlyAttendanceResult.error)
        throw monthlyAttendanceResult.error;

      setMembers(
        (membersResult.data || []) as Member[],
      );

      setMemberships(
        (membershipsResult.data || []) as Membership[],
      );

      setAttendance(
        (attendanceResult.data || []) as Attendance[],
      );

      setMonthlyAttendance(
        (monthlyAttendanceResult.data || []) as Attendance[],
      );
    } catch (error) {
      console.error(
        "Dashboard loading error:",
        error,
      );
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

    void init();

    return () => {
      mounted = false;
    };
  }, []);

  const membershipsByMember =
    useMemo(() => {
      const map = new Map<string, Membership[]>();

      for (const membership of memberships) {
        const existing =
          map.get(membership.member_id) || [];

        existing.push(membership);

        map.set(
          membership.member_id,
          existing,
        );
      }

      return map;
    }, [memberships]);

  const insideMemberIds =
    useMemo(
      () =>
        new Set(
          attendance
            .filter(
              (item) =>
                item.checked_in_at &&
                !item.checked_out_at,
            )
            .map(
              (item) => item.member_id,
            ),
        ),
      [attendance],
    );

  const currentlyInside =
    useMemo(
      () =>
        members.filter((member) =>
          insideMemberIds.has(member.id),
        ),
      [members, insideMemberIds],
    );

  const birthdaysToday =
    useMemo(
      () =>
        members.filter(isBirthdayToday),
      [members],
    );

  const birthdaysThisMonth =
    useMemo(
      () =>
        members.filter(
          isBirthdayThisMonth,
        ),
      [members],
    );

  const expiringSoon =
    useMemo(() => {
      const result: {
        member: Member;
        membership: Membership;
      }[] = [];

      for (const member of members) {
        const memberMemberships =
          membershipsByMember.get(
            member.id,
          ) || [];

        for (const membership of memberMemberships) {
          if (!membership.end_date) continue;

          const status = String(
            membership.status || "",
          ).toLowerCase();

          if (
            status === "paused" ||
            status === "cancelled"
          ) {
            continue;
          }

          const days = getDaysRemaining(
            membership.end_date,
          );

          if (
            days !== null &&
            days >= 0 &&
            days <= 7
          ) {
            result.push({
              member,
              membership,
            });
          }
        }
      }

      return result.sort(
        (a, b) =>
          (
            a.membership.end_date || ""
          ).localeCompare(
            b.membership.end_date || "",
          ),
      );
    }, [
      members,
      membershipsByMember,
    ]);

  const searchResults =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      if (!query) return [];

      return members
        .filter((member) =>
          member.full_name
            ?.toLowerCase()
            .includes(query) ||
          member.email
            ?.toLowerCase()
            .includes(query) ||
          member.phone
            ?.toLowerCase()
            .includes(query),
        )
        .slice(0, 20);
    }, [members, search]);

  const selectedMemberMemberships =
    selectedMember
      ? membershipsByMember.get(
          selectedMember.id,
        ) || []
      : [];

  const selectedMembership =
    selectedMembershipId
      ? memberships.find(
          (membership) =>
            membership.id ===
            selectedMembershipId,
        ) || null
      : selectedMemberMemberships[0] ||
        null;

  const visitsToday = attendance.length;
  const monthlyVisits =
    monthlyAttendance.length;

  async function handleLogout() {
    await supabase.auth.signOut();

    window.location.href =
      "/reception-checkin";
  }

  function resetMembershipManagement() {
    setMembershipAction(null);
    setSelectedMembershipId(null);
    setMembershipActionError("");
    setMembershipActionSuccess("");

    setPauseUntilDate(
      addDaysToDateString(
        getLocalDateString(),
        7,
      ),
    );
  }

  async function handleMembershipAction() {
    if (
      !selectedMember ||
      !membershipAction
    ) {
      return;
    }

    setMembershipActionError("");
    setMembershipActionSuccess("");

    if (
      membershipAction === "extend"
    ) {
      const days = Number(extensionDays);

      if (
        !Number.isInteger(days) ||
        days < 1 ||
        days > 3650
      ) {
        setMembershipActionError(
          "Enter a valid extension between 1 and 3650 days.",
        );

        return;
      }
    }

    if (
      membershipAction === "pause"
    ) {
      if (!pauseUntilDate) {
        setMembershipActionError(
          "Please select a pause-until date.",
        );

        return;
      }

      const today = getLocalDateString();

      if (pauseUntilDate <= today) {
        setMembershipActionError(
          "Pause-until date must be after today.",
        );

        return;
      }
    }

    if (
      membershipAction === "cancel"
    ) {
      const confirmed =
        window.confirm(
          `Cancel ${
            selectedMembership?.plan_name ||
            "this membership"
          } for ${
            selectedMember.full_name ||
            "this member"
          }?\n\nThis will immediately make this membership inactive.`,
        );

      if (!confirmed) return;
    }

    setMembershipActionLoading(true);

    try {
      if (!selectedMembership) {
        throw new Error(
          "Please select a membership to manage.",
        );
      }

      const { data, error } =
        await supabase.rpc(
          "reception_manage_membership",
          {
            p_membership_id:
              selectedMembership.id,
            p_action:
              membershipAction,
            p_days:
              membershipAction ===
              "extend"
                ? Number(extensionDays)
                : null,
            p_paused_until:
              membershipAction ===
              "pause"
                ? pauseUntilDate
                : null,
          },
        );

      if (error) throw error;

      const result = data as {
        success?: boolean;
        action?: string;
        new_status?: string;
        new_end_date?: string;
        days_added?: number;
        pause_days?: number;
        paused_until?: string;
      };

      if (!result?.success) {
        throw new Error(
          "Membership action could not be completed.",
        );
      }

      if (
        membershipAction === "extend"
      ) {
        const days =
          result.days_added ||
          Number(extensionDays);

        setMembershipActionSuccess(
          `${
            selectedMembership.plan_name ||
            "Membership"
          } extended by ${days} day${
            days === 1 ? "" : "s"
          }. New expiry: ${formatDate(
            result.new_end_date ||
              null,
          )}.`,
        );
      } else if (
        membershipAction === "pause"
      ) {
        setMembershipActionSuccess(
          `${
            selectedMembership.plan_name ||
            "Membership"
          } paused until ${formatDate(
            result.paused_until ||
              pauseUntilDate,
          )}.`,
        );
      } else if (
        membershipAction === "resume"
      ) {
        setMembershipActionSuccess(
          `${
            selectedMembership.plan_name ||
            "Membership"
          } resumed successfully. ${
            result.pause_days || 0
          } paused day${
            (result.pause_days || 0) ===
            1
              ? ""
              : "s"
          } restored.`,
        );
      } else if (
        membershipAction === "cancel"
      ) {
        setMembershipActionSuccess(
          `${
            selectedMembership.plan_name ||
            "Membership"
          } cancelled successfully.`,
        );
      }

      setMembershipAction(null);

      await loadDashboard();
    } catch (error: any) {
      console.error(
        "Membership management error:",
        error,
      );

      setMembershipActionError(
        error?.message ||
          "Unable to update membership. Please try again.",
      );
    } finally {
      setMembershipActionLoading(false);
    }
  }

  async function handleAddMembershipToExistingMember() {
    if (!selectedMember) return;

    setAddMembershipError("");
    setAddMembershipSuccess("");

    if (!selectedAddMembershipPlan) {
      setAddMembershipError(
        "Please select a membership plan.",
      );

      return;
    }

    if (!addMembershipStartDate) {
      setAddMembershipError(
        "Membership start date is required.",
      );

      return;
    }

    /*
     * Custom Plan validation.
     */
    if (isCustomAddMembership) {
      const days =
        Number(customMembershipDays);

      const price =
        Number(customMembershipPrice);

      if (
        !Number.isInteger(days) ||
        days < 1 ||
        days > 3650
      ) {
        setAddMembershipError(
          "Custom Plan duration must be between 1 and 3650 days.",
        );

        return;
      }

      if (
        !Number.isFinite(price) ||
        price <= 0
      ) {
        setAddMembershipError(
          "Custom Plan price must be greater than ₦0.",
        );

        return;
      }
    }

    const confirmed =
      window.confirm(
        `Activate ${
          selectedAddMembershipPlan.name
        } for ${
          selectedMember.full_name ||
          "this member"
        }?\n\nAmount: ${formatNaira(
          addMembershipTotal,
        )}\nStart: ${formatDate(
          addMembershipStartDate,
        )}\nEnd: ${formatDate(
          addMembershipEndDate,
        )}\n\nThis will create a separate membership and will NOT replace any existing membership.`,
      );

    if (!confirmed) return;

    setAddingMembership(true);

    try {
      /*
       * Always resolve the actual database plan.
       *
       * Custom Plan uses the database row created
       * in membership_plans with name = "Custom Plan".
       */
      const { data: planData, error: planError } =
        await supabase
          .from("membership_plans")
          .select("id, name")
          .eq(
            "name",
            selectedAddMembershipPlan.name,
          )
          .maybeSingle();

      if (planError) throw planError;

      if (!planData) {
        throw new Error(
          `Membership plan "${selectedAddMembershipPlan.name}" was not found in the database.`,
        );
      }

      const endDate =
        addMembershipEndDate;

      if (!endDate) {
        throw new Error(
          "Unable to calculate the membership expiry date.",
        );
      }

      /*
       * Create a separate membership.
       *
       * Existing memberships are intentionally not touched.
       */
      const {
        data: membershipData,
        error: membershipError,
      } = await supabase
        .from("memberships")
        .insert({
          member_id:
            selectedMember.id,
          plan_id:
            planData.id,
          plan_name:
            selectedAddMembershipPlan.name,
          start_date:
            addMembershipStartDate,
          end_date: endDate,
          status: "active",
          payment_status: "paid",
          source:
            "reception_manual",
        })
        .select("id")
        .single();

      if (membershipError) {
        throw membershipError;
      }

      /*
       * Build payment metadata.
       *
       * Custom Plan stores the custom details explicitly.
       */
      const paymentMetadata =
        isCustomAddMembership
          ? {
              plan_name: "Custom Plan",
              start_date:
                addMembershipStartDate,
              end_date: endDate,
              concurrent_membership:
                true,
              custom_plan: true,
              custom_days:
                Number(customMembershipDays),
              custom_price:
                Number(customMembershipPrice),
              registration_fee_included:
                customIncludeRegistrationFee,
              registration_fee:
                customRegistrationAmount,
              total_amount:
                addMembershipTotal,
            }
          : {
              plan_name:
                selectedAddMembershipPlan.name,
              start_date:
                addMembershipStartDate,
              end_date: endDate,
              concurrent_membership:
                true,
            };

      const { error: paymentError } =
        await supabase
          .from("payments")
          .insert({
            member_id:
              selectedMember.id,
            membership_id:
              membershipData.id,
            amount:
              addMembershipTotal,
            currency: "NGN",
            status: "success",
            payment_method:
              addMembershipPaymentMethod,
            provider: "manual",
            paid_at:
              new Date().toISOString(),
            metadata: paymentMetadata,
            source:
              "reception_manual",
          });

      if (paymentError) {
        throw paymentError;
      }

      setAddMembershipSuccess(
        `${
          selectedAddMembershipPlan.name
        } activated successfully for ${
          selectedMember.full_name ||
          "this member"
        }. Existing memberships were not changed.`,
      );

      setAddMembershipOpen(false);

      setAddMembershipPlanId(
        membershipPlans[2]?.id || "",
      );

      setAddMembershipStartDate(
        getLocalDateString(),
      );

      setAddMembershipPaymentMethod(
        "Cash",
      );

      /*
       * Reset Custom Plan fields for the next use.
       */
      setCustomMembershipDays("30");
      setCustomMembershipPrice("");
      setCustomIncludeRegistrationFee(
        true,
      );

      await loadDashboard();
    } catch (error: any) {
      console.error(
        "Add concurrent membership error:",
        error,
      );

      setAddMembershipError(
        error?.message ||
          "Unable to activate the additional membership.",
      );
    } finally {
      setAddingMembership(false);
    }
  }

  async function handleAddMember(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setAddMemberError("");
    setAddMemberSuccess(null);

    if (!addMemberName.trim()) {
      setAddMemberError(
        "Member name is required.",
      );

      return;
    }

    if (!selectedPlan) {
      setAddMemberError(
        "Please select a membership plan.",
      );

      return;
    }

    if (!addMemberStartDate) {
      setAddMemberError(
        "Membership start date is required.",
      );

      return;
    }

    if (
      addMemberBirthDay &&
      (Number(addMemberBirthDay) < 1 ||
        Number(addMemberBirthDay) > 31)
    ) {
      setAddMemberError(
        "Please enter a valid birth day.",
      );

      return;
    }

    if (
      addMemberBirthMonth &&
      (Number(addMemberBirthMonth) < 1 ||
        Number(addMemberBirthMonth) > 12)
    ) {
      setAddMemberError(
        "Please select a valid birth month.",
      );

      return;
    }

    setAddingMember(true);

    try {
      const durationDays =
        planDurationDays[selectedPlan.id] ||
        30;

      const { data, error } =
        await supabase.rpc(
          "reception_add_member",
          {
            p_full_name:
              addMemberName.trim(),
            p_email:
              addMemberEmail.trim() || null,
            p_phone:
              addMemberPhone.trim() || null,
            p_address:
              addMemberAddress.trim() || null,
            p_birth_day:
              addMemberBirthDay
                ? Number(addMemberBirthDay)
                : null,
            p_birth_month:
              addMemberBirthMonth
                ? Number(addMemberBirthMonth)
                : null,
            p_plan_name:
              selectedPlan.name,
            p_start_date:
              addMemberStartDate,
            p_duration_days:
              durationDays,
            p_amount:
              totalAmount,
            p_payment_method:
              paymentMethod,
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
        throw new Error(
          "Member registration failed.",
        );
      }

      setAddMemberSuccess({
        memberId:
          result.member_id || "",
        membershipId:
          result.membership_id || "",
        planName:
          result.plan_name ||
          selectedPlan.name,
        startDate:
          result.start_date ||
          addMemberStartDate,
        endDate:
          result.end_date ||
          calculatedEndDate,
        total: totalAmount,
      });

      setAddMemberName("");
      setAddMemberEmail("");
      setAddMemberPhone("");
      setAddMemberAddress("");
      setAddMemberBirthDay("");
      setAddMemberBirthMonth("");

      setSelectedPlanId(
        membershipPlans[2]?.id || "",
      );

      setAddMemberStartDate(
        getLocalDateString(),
      );

      setIncludeRegistrationFee(true);
      setPaymentMethod("Cash");

      await loadDashboard();
    } catch (error: any) {
      console.error(
        "Add member error:",
        error,
      );

      setAddMemberError(
        error?.message ||
          "Unable to add member. Please try again.",
      );
    } finally {
      setAddingMember(false);
    }
  }

  function sendWhatsApp(
    message: string,
    phone: string | null,
  ) {
    if (!phone) return;

    const cleanPhone =
      phone.replace(/\D/g, "");

    const normalizedPhone =
      cleanPhone.startsWith("0")
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
                  refreshing
                    ? "animate-spin"
                    : ""
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
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search members by name, phone or email..."
              className="h-14 w-full border border-border bg-background pl-12 pr-4 text-sm outline-none transition focus:border-primary"
            />
          </div>

          {searchResults.length > 0 && (
            <div className="mt-2 border border-border bg-background shadow-sm">
              {searchResults.map(
                (member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => {
                      setSelectedMember(member);
                      setSearch("");
                      resetMembershipManagement();
                      setAddMembershipError("");
                      setAddMembershipSuccess("");
                    }}
                    className="flex w-full items-center justify-between border-b border-border px-4 py-4 text-left last:border-b-0 hover:bg-muted"
                  >
                    <div>
                      <p className="font-bold">
                        {member.full_name ||
                          "Unnamed member"}
                      </p>

                      <p className="mt-1 text-xs text-muted-foreground">
                        {member.phone ||
                          member.email ||
                          "No contact"}
                      </p>
                    </div>

                    <span className="text-xs font-extrabold uppercase text-primary">
                      View Profile
                    </span>
                  </button>
                ),
              )}
            </div>
          )}
        </section>

        {/* OVERVIEW */}
        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "Currently Inside",
              value: currentlyInside.length,
              icon: <LogIn className="size-5 text-primary" />,
            },
            {
              label: "Visits Today",
              value: visitsToday,
              icon: <Activity className="size-5 text-primary" />,
            },
            {
              label: "Birthdays Today",
              value: birthdaysToday.length,
              icon: <Cake className="size-5 text-primary" />,
            },
            {
              label: "Expiring Soon",
              value: expiringSoon.length,
              icon: <Clock3 className="size-5 text-primary" />,
            },
          ].map((item) => (
            <div
              key={item.label}
              className="border border-border bg-background p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                  {item.label}
                </p>
                {item.icon}
              </div>

              <p className="mt-4 font-display text-4xl font-bold">
                {item.value}
              </p>
            </div>
          ))}
        </section>

        {/* ADD A MEMBER */}
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
                        setAddMemberName(
                          event.target.value,
                        )
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
                        setAddMemberEmail(
                          event.target.value,
                        )
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
                        setAddMemberPhone(
                          event.target.value,
                        )
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
                        setAddMemberAddress(
                          event.target.value,
                        )
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
                        setAddMemberBirthDay(
                          event.target.value,
                        )
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
                        setAddMemberBirthMonth(
                          event.target.value,
                        )
                      }
                      className="h-12 w-full border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                    >
                      <option value="">
                        Select month
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
                      ].map(
                        (month, index) => (
                          <option
                            key={month}
                            value={index + 1}
                          >
                            {month}
                          </option>
                        ),
                      )}
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
                      onChange={(event) => {
                        const nextPlanId =
                          event.target.value;

                        setSelectedPlanId(
                          nextPlanId,
                        );

                        setIncludeRegistrationFee(
                          nextPlanId !==
                            "personal-training-only",
                        );
                      }}
                      className="h-12 w-full border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                    >
                      {receptionPlans
                        .filter(
                          (plan) =>
                            plan.id !==
                            "custom-plan",
                        )
                        .map((plan) => (
                          <option
                            key={plan.id}
                            value={plan.id}
                          >
                            {plan.name} —{" "}
                            {formatNaira(
                              plan.price,
                            )}
                            {plan.id ===
                            "personal-training-only"
                              ? " (No registration fee)"
                              : ""}
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
                        setAddMemberStartDate(
                          event.target.value,
                        )
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
                        {formatNaira(
                          selectedPlan.price,
                        )}
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
                        {formatDate(
                          calculatedEndDate,
                        )}
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
                        setPaymentMethod(
                          event.target.value,
                        )
                      }
                      className="h-12 w-full border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                    >
                      <option value="Cash">
                        Cash
                      </option>
                      <option value="POS">
                        POS
                      </option>
                      <option value="Bank Transfer">
                        Bank Transfer
                      </option>
                      <option value="Other">
                        Other
                      </option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    <label className="flex min-h-12 w-full cursor-pointer items-center gap-3 border border-border px-4">
                      <input
                        type="checkbox"
                        checked={
                          isPersonalTrainingOnly
                            ? false
                            : includeRegistrationFee
                        }
                        onChange={(event) =>
                          setIncludeRegistrationFee(
                            event.target.checked,
                          )
                        }
                        disabled={
                          isPersonalTrainingOnly
                        }
                        className="size-4"
                      />

                      <span className="text-sm font-bold">
                        {isPersonalTrainingOnly
                          ? "No registration fee for this plan"
                          : "Include registration fee"}
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
                      {formatNaira(
                        totalAmount,
                      )}
                    </span>
                  </div>

                  {selectedPlan && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {selectedPlan.name}:{" "}
                      {formatNaira(
                        selectedPlan.price,
                      )}
                      {!isPersonalTrainingOnly &&
                        includeRegistrationFee &&
                        selectedPlan.registration >
                          0 &&
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
                        {addMemberSuccess.planName}{" "}
                        has been activated.
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
                        {item.member?.phone ||
                          "No phone"}
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
                {currentlyInside.map(
                  (member) => (
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
                            {member.phone ||
                              "No phone"}
                          </p>
                        </div>
                      </div>

                      <span className="inline-flex w-fit items-center gap-2 bg-primary/10 px-3 py-2 text-xs font-extrabold uppercase text-primary">
                        <CheckCircle2 className="size-4" />
                        Inside
                      </span>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        </details>

        {/* EXPIRING SOON */}
        <details className="group mb-4 border border-border bg-background shadow-sm">
          <ExpandableSummary
            eyebrow="Membership"
            title="Expiring Soon"
            description="Memberships expiring within the next 7 days."
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
                        membership.end_date,
                      );

                    return (
                      <div
                        key={membership.id}
                        className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between"
                      >
                        <div>
                          <p className="font-bold">
                            {member.full_name}
                          </p>

                          <p className="mt-1 text-sm text-muted-foreground">
                            {membership.plan_name ||
                              "Membership"}{" "}
                            · Expires{" "}
                            {formatDate(
                              membership.end_date,
                            )}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <span className="bg-muted px-3 py-2 text-xs font-bold">
                            {daysRemaining === 0
                              ? "Expires today"
                              : `${daysRemaining} ${
                                  daysRemaining ===
                                  1
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
                                  membership.plan_name ||
                                  "membership"
                                } expires on ${formatDate(
                                  membership.end_date,
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
                {birthdaysToday.map(
                  (member) => (
                    <div
                      key={member.id}
                      className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-bold">
                          {member.full_name}
                        </p>

                        <p className="mt-1 text-sm text-muted-foreground">
                          {getBirthdayLabel(
                            member,
                          )}
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
                  ),
                )}
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
                {[...birthdaysThisMonth]
                  .sort(
                    (a, b) =>
                      (a.birth_day || 0) -
                      (b.birth_day || 0),
                  )
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
                          {getBirthdayLabel(
                            member,
                          )}
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
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border border-border bg-background shadow-2xl">

            {/* MODAL HEADER */}
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
                onClick={() => {
                  setSelectedMember(null);
                  resetMembershipManagement();
                  setAddMembershipOpen(false);
                  setAddMembershipError("");
                  setAddMembershipSuccess("");
                }}
                className="flex size-10 items-center justify-center border border-border hover:bg-muted"
                aria-label="Close"
              >
                <XCircle className="size-5" />
              </button>
            </div>

            <div className="space-y-5 p-5">

              {/* MEMBER DETAILS */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Phone
                  </p>

                  <p className="mt-1 font-bold">
                    {selectedMember.phone ||
                      "Not provided"}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Email
                  </p>

                  <p className="mt-1 break-all font-bold">
                    {selectedMember.email ||
                      "Not provided"}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Birthday
                  </p>

                  <p className="mt-1 font-bold">
                    {getBirthdayLabel(
                      selectedMember,
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Memberships
                  </p>

                  <p className="mt-1 font-bold">
                    {
                      selectedMemberMemberships.length
                    }{" "}
                    active/recorded plan
                    {selectedMemberMemberships.length ===
                    1
                      ? ""
                      : "s"}
                  </p>
                </div>
              </div>

              {/* ALL MEMBERSHIPS */}
              <div className="border border-border">
                <div className="border-b border-border bg-muted/20 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
                        Memberships
                      </p>

                      <h3 className="mt-1 font-display text-xl font-bold uppercase">
                        Member Plans
                      </h3>
                    </div>

                    <span className="bg-primary px-3 py-2 text-xs font-extrabold text-primary-foreground">
                      {
                        selectedMemberMemberships.length
                      }
                    </span>
                  </div>
                </div>

                <div className="divide-y divide-border">
                  {selectedMemberMemberships.length ===
                  0 ? (
                    <div className="p-5 text-sm text-muted-foreground">
                      This member has no memberships.
                    </div>
                  ) : (
                    selectedMemberMemberships.map(
                      (membership) => {
                        const valid =
                          isMembershipValidToday(
                            membership,
                          );

                        const status =
                          String(
                            membership.status ||
                              "",
                          ).toLowerCase();

                        return (
                          <div
                            key={membership.id}
                            className="p-5"
                          >
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-bold">
                                    {membership.plan_name ||
                                      "Membership"}
                                  </p>

                                  <span
                                    className={`px-2 py-1 text-[10px] font-extrabold uppercase ${
                                      status ===
                                      "paused"
                                        ? "bg-orange-500/10 text-orange-600"
                                        : status ===
                                            "cancelled"
                                          ? "bg-destructive/10 text-destructive"
                                          : valid
                                            ? "bg-primary/10 text-primary"
                                            : "bg-muted text-muted-foreground"
                                    }`}
                                  >
                                    {status ===
                                    "paused"
                                      ? "Paused"
                                      : status ===
                                          "cancelled"
                                        ? "Cancelled"
                                        : valid
                                          ? "Active"
                                          : "Not Active"}
                                  </span>
                                </div>

                                <p className="mt-2 text-sm text-muted-foreground">
                                  {formatDate(
                                    membership.start_date,
                                  )}{" "}
                                  –{" "}
                                  {formatDate(
                                    membership.end_date,
                                  )}
                                </p>

                                {membership.paused_until && (
                                  <p className="mt-2 text-xs font-semibold text-orange-600">
                                    Paused until{" "}
                                    {formatDate(
                                      membership.paused_until,
                                    )}
                                  </p>
                                )}
                              </div>

                              <Button
                                variant={
                                  selectedMembershipId ===
                                  membership.id
                                    ? "default"
                                    : "outline"
                                }
                                size="sm"
                                onClick={() => {
                                  setSelectedMembershipId(
                                    membership.id,
                                  );

                                  setMembershipAction(null);
                                  setMembershipActionError("");
                                  setMembershipActionSuccess("");

                                  setPauseUntilDate(
                                    addDaysToDateString(
                                      getLocalDateString(),
                                      7,
                                    ),
                                  );
                                }}
                              >
                                {selectedMembershipId ===
                                membership.id
                                  ? "Selected"
                                  : "Manage"}
                              </Button>
                            </div>
                          </div>
                        );
                      },
                    )
                  )}
                </div>
              </div>

              {/* ADD ANOTHER MEMBERSHIP */}
              <div className="border border-primary/30 bg-primary/5">
                <button
                  type="button"
                  onClick={() => {
                    setAddMembershipOpen(
                      !addMembershipOpen,
                    );

                    setAddMembershipError("");
                    setAddMembershipSuccess("");
                  }}
                  className="flex w-full items-center justify-between gap-4 p-5 text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center bg-primary text-primary-foreground">
                      <Plus className="size-5" />
                    </div>

                    <div>
                      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
                        Reception
                      </p>

                      <h3 className="mt-1 font-display text-xl font-bold uppercase">
                        Add Another Membership
                      </h3>

                      <p className="mt-1 text-sm text-muted-foreground">
                        Activate another plan without replacing existing memberships.
                      </p>
                    </div>
                  </div>

                  <ChevronDown
                    className={`size-5 transition-transform ${
                      addMembershipOpen
                        ? "rotate-180"
                        : ""
                    }`}
                  />
                </button>

                {addMembershipOpen && (
                  <div className="border-t border-primary/20 p-5">

                    {/* PLAN / DATE / PAYMENT */}
                    <div className="grid gap-5 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-bold">
                          Membership Plan
                        </label>

                        <select
                          value={
                            addMembershipPlanId
                          }
                          onChange={(event) => {
                            const nextPlanId =
                              event.target.value;

                            setAddMembershipPlanId(
                              nextPlanId,
                            );

                            /*
                             * When switching away from Custom Plan,
                             * clear its previous validation error.
                             */
                            setAddMembershipError("");
                          }}
                          className="h-12 w-full border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                        >
                          {receptionPlans.map(
                            (plan) => (
                              <option
                                key={plan.id}
                                value={plan.id}
                              >
                                {plan.name}
                                {plan.id ===
                                "custom-plan"
                                  ? " — Set custom price"
                                  : ` — ${formatNaira(
                                      plan.price,
                                    )}`}
                                {plan.id ===
                                "personal-training-only"
                                  ? " (No registration fee)"
                                  : ""}
                              </option>
                            ),
                          )}
                        </select>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-bold">
                          Start Date
                        </label>

                        <input
                          type="date"
                          value={
                            addMembershipStartDate
                          }
                          onChange={(event) =>
                            setAddMembershipStartDate(
                              event.target.value,
                            )
                          }
                          className="h-12 w-full border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-bold">
                          Payment Method
                        </label>

                        <select
                          value={
                            addMembershipPaymentMethod
                          }
                          onChange={(event) =>
                            setAddMembershipPaymentMethod(
                              event.target.value,
                            )
                          }
                          className="h-12 w-full border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                        >
                          <option value="Cash">
                            Cash
                          </option>
                          <option value="POS">
                            POS
                          </option>
                          <option value="Bank Transfer">
                            Bank Transfer
                          </option>
                          <option value="Other">
                            Other
                          </option>
                        </select>
                      </div>

                      {!isCustomAddMembership && (
                        <div className="border border-border bg-background p-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            New Membership
                          </p>

                          <p className="mt-1 font-bold">
                            {
                              selectedAddMembershipPlan.name
                            }
                          </p>

                          <p className="mt-1 text-sm text-muted-foreground">
                            {formatDate(
                              addMembershipStartDate,
                            )}{" "}
                            –{" "}
                            {formatDate(
                              addMembershipEndDate,
                            )}
                          </p>

                          <p className="mt-3 text-lg font-bold">
                            {formatNaira(
                              addMembershipTotal,
                            )}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* CUSTOM PLAN */}
                    {isCustomAddMembership && (
                      <div className="mt-5 border border-primary/30 bg-background p-5">
                        <div className="mb-5">
                          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
                            Custom Membership
                          </p>

                          <h4 className="mt-1 font-display text-2xl font-bold uppercase">
                            Set Your Own Plan
                          </h4>

                          <p className="mt-1 text-sm text-muted-foreground">
                            Enter the number of days and the membership price. The expiry date and total payment are calculated automatically.
                          </p>
                        </div>

                        <div className="grid gap-5 md:grid-cols-2">
                          <div>
                            <label className="mb-2 block text-sm font-bold">
                              Number of Days *
                            </label>

                            <input
                              type="number"
                              min="1"
                              max="3650"
                              step="1"
                              value={
                                customMembershipDays
                              }
                              onChange={(event) => {
                                setCustomMembershipDays(
                                  event.target.value,
                                );

                                setAddMembershipError(
                                  "",
                                );
                              }}
                              placeholder="e.g. 14"
                              className="h-12 w-full border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                            />

                            <p className="mt-2 text-xs text-muted-foreground">
                              Enter between 1 and 3650 days.
                            </p>
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-bold">
                              Custom Plan Price *
                            </label>

                            <div className="relative">
                              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                                ₦
                              </span>

                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={
                                  customMembershipPrice
                                }
                                onChange={(event) => {
                                  setCustomMembershipPrice(
                                    event.target.value,
                                  );

                                  setAddMembershipError(
                                    "",
                                  );
                                }}
                                placeholder="e.g. 18000"
                                className="h-12 w-full border border-border bg-background pl-9 pr-4 text-sm outline-none focus:border-primary"
                              />
                            </div>
                          </div>
                        </div>

                        {/* REGISTRATION FEE */}
                        <div className="mt-5">
                          <label className="flex min-h-12 cursor-pointer items-center gap-3 border border-border bg-background px-4">
                            <input
                              type="checkbox"
                              checked={
                                customIncludeRegistrationFee
                              }
                              onChange={(event) =>
                                setCustomIncludeRegistrationFee(
                                  event.target.checked,
                                )
                              }
                              className="size-4"
                            />

                            <span className="text-sm font-bold">
                              Include ₦7,000 registration fee
                            </span>
                          </label>

                          <p className="mt-2 text-xs text-muted-foreground">
                            Uncheck this if the member should not pay the registration fee.
                          </p>
                        </div>

                        {/* CUSTOM PLAN SUMMARY */}
                        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                          <div className="border border-border bg-muted/40 p-4">
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                              Plan Price
                            </p>

                            <p className="mt-2 text-xl font-bold">
                              {customPriceNumber >
                              0
                                ? formatNaira(
                                    customPriceNumber,
                                  )
                                : "₦0"}
                            </p>
                          </div>

                          <div className="border border-border bg-muted/40 p-4">
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                              Duration
                            </p>

                            <p className="mt-2 text-xl font-bold">
                              {Number.isInteger(
                                customDaysNumber,
                              ) &&
                              customDaysNumber >=
                                1 &&
                              customDaysNumber <=
                                3650
                                ? `${customDaysNumber} ${
                                    customDaysNumber ===
                                    1
                                      ? "day"
                                      : "days"
                                  }`
                                : "—"}
                            </p>
                          </div>

                          <div className="border border-border bg-muted/40 p-4">
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                              Registration
                            </p>

                            <p className="mt-2 text-xl font-bold">
                              {formatNaira(
                                customRegistrationAmount,
                              )}
                            </p>
                          </div>

                          <div className="border border-primary/30 bg-primary/5 p-4">
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                              Membership Ends
                            </p>

                            <p className="mt-2 text-xl font-bold text-primary">
                              {formatDate(
                                customAddMembershipEndDate,
                              )}
                            </p>
                          </div>
                        </div>

                        {/* CUSTOM TOTAL */}
                        <div className="mt-5 border border-primary bg-primary/5 p-5">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
                                Total Payment
                              </p>

                              <p className="mt-1 text-sm text-muted-foreground">
                                Custom Plan{" "}
                                {customPriceNumber >
                                  0 &&
                                  `(${formatNaira(
                                    customPriceNumber,
                                  )})`}
                                {customRegistrationAmount >
                                  0 &&
                                  ` + ${formatNaira(
                                    customRegistrationAmount,
                                  )} registration`}
                              </p>
                            </div>

                            <p className="font-display text-3xl font-bold">
                              {formatNaira(
                                customMembershipTotal,
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PERSONAL TRAINING NOTICE */}
                    {isAddMembershipPersonalTrainingOnly && (
                      <div className="mt-4 border border-primary/30 bg-primary/10 p-4 text-sm">
                        <p className="font-bold text-primary">
                          Personal Training Only
                        </p>

                        <p className="mt-1 text-muted-foreground">
                          No registration fee. This plan will remain separate from the member's existing gym membership and can be active concurrently.
                        </p>
                      </div>
                    )}

                    {/* ERROR */}
                    {addMembershipError && (
                      <div className="mt-4 border border-destructive/30 bg-destructive/10 p-4 text-sm font-semibold text-destructive">
                        {addMembershipError}
                      </div>
                    )}

                    {/* SUCCESS */}
                    {addMembershipSuccess && (
                      <div className="mt-4 border border-primary/30 bg-primary/10 p-4 text-sm font-semibold text-primary">
                        {addMembershipSuccess}
                      </div>
                    )}

                    <div className="mt-5">
                      <Button
                        onClick={() =>
                          void handleAddMembershipToExistingMember()
                        }
                        disabled={
                          addingMembership
                        }
                        className="w-full sm:w-auto"
                      >
                        {addingMembership ? (
                          <>
                            <Loader2 className="size-4 animate-spin" />
                            Activating...
                          </>
                        ) : (
                          <>
                            <Plus className="size-4" />
                            Activate Membership
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* SELECTED MEMBERSHIP MANAGEMENT */}
              {selectedMembership && (
                <div className="border border-border bg-muted/20">
                  <div className="border-b border-border p-5">
                    <div className="flex items-center gap-3">
                      <CalendarPlus className="size-5 text-primary" />

                      <div>
                        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
                          Reception
                        </p>

                        <h3 className="mt-1 font-display text-xl font-bold uppercase">
                          Manage Membership
                        </h3>
                      </div>
                    </div>

                    <p className="mt-2 text-sm text-muted-foreground">
                      Managing:{" "}
                      <span className="font-bold text-foreground">
                        {selectedMembership.plan_name ||
                          "Membership"}
                      </span>
                    </p>
                  </div>

                  <div className="p-5">
                    {membershipActionError && (
                      <div className="mb-4 border border-destructive/30 bg-destructive/10 p-4 text-sm font-semibold text-destructive">
                        {membershipActionError}
                      </div>
                    )}

                    {membershipActionSuccess && (
                      <div className="mb-4 border border-primary/30 bg-primary/10 p-4 text-sm font-semibold text-primary">
                        {membershipActionSuccess}
                      </div>
                    )}

                    {/* EXTEND */}
                    {membershipAction ===
                    "extend" ? (
                      <div>
                        <p className="text-sm font-semibold">
                          How many days would you like to add?
                        </p>

                        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                          <input
                            type="number"
                            min="1"
                            max="3650"
                            value={extensionDays}
                            onChange={(event) =>
                              setExtensionDays(
                                event.target.value,
                              )
                            }
                            className="h-12 w-full border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                          />

                          <Button
                            onClick={() =>
                              void handleMembershipAction()
                            }
                            disabled={
                              membershipActionLoading
                            }
                          >
                            {membershipActionLoading ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <CalendarPlus className="size-4" />
                            )}

                            Confirm Extension
                          </Button>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setMembershipAction(null);
                            setMembershipActionError("");
                          }}
                          className="mt-3 text-xs font-bold uppercase text-muted-foreground hover:text-foreground"
                        >
                          Cancel
                        </button>
                      </div>

                    /* PAUSE */
                    ) : membershipAction ===
                      "pause" ? (
                      <div>
                        <p className="text-sm font-semibold">
                          Pause this membership?
                        </p>

                        <p className="mt-2 text-sm text-muted-foreground">
                          Choose the date when the pause should end. The paused period will be restored to the membership.
                        </p>

                        <div className="mt-5 border border-orange-500/30 bg-orange-500/5 p-5">
                          <label className="mb-2 block text-sm font-bold">
                            Pause Until
                          </label>

                          <input
                            type="date"
                            value={pauseUntilDate}
                            min={addDaysToDateString(
                              getLocalDateString(),
                              1,
                            )}
                            onChange={(event) => {
                              setPauseUntilDate(
                                event.target.value,
                              );

                              setMembershipActionError(
                                "",
                              );
                            }}
                            className="h-12 w-full border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                          />

                          <p className="mt-2 text-xs text-muted-foreground">
                            Select the last day of the pause. The membership will resume after this pause period.
                          </p>
                        </div>

                        {pauseUntilDate && (
                          <div className="mt-4 grid gap-4 sm:grid-cols-3">
                            <div className="border border-border bg-background p-4">
                              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Current Expiry
                              </p>

                              <p className="mt-2 font-bold">
                                {formatDate(
                                  selectedMembership.end_date,
                                )}
                              </p>
                            </div>

                            <div className="border border-border bg-background p-4">
                              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Pause Period
                              </p>

                              <p className="mt-2 font-bold">
                                {pauseDaysPreview}{" "}
                                day
                                {pauseDaysPreview ===
                                1
                                  ? ""
                                  : "s"}
                              </p>
                            </div>

                            <div className="border border-primary/30 bg-primary/5 p-4">
                              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                New Expiry
                              </p>

                              <p className="mt-2 font-bold text-primary">
                                {formatDate(
                                  projectedExpiryAfterPause,
                                )}
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="mt-5 flex flex-wrap gap-3">
                          <Button
                            onClick={() =>
                              void handleMembershipAction()
                            }
                            disabled={
                              membershipActionLoading
                            }
                          >
                            {membershipActionLoading ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Pause className="size-4" />
                            )}

                            Confirm Pause
                          </Button>

                          <Button
                            variant="outline"
                            onClick={() =>
                              setMembershipAction(null)
                            }
                            disabled={
                              membershipActionLoading
                            }
                          >
                            Back
                          </Button>
                        </div>
                      </div>

                    /* RESUME */
                    ) : membershipAction ===
                      "resume" ? (
                      <div>
                        <p className="text-sm font-semibold">
                          Resume this membership?
                        </p>

                        <p className="mt-2 text-sm text-muted-foreground">
                          The paused period will be added back to this membership's expiry date.
                        </p>

                        {selectedMembership.paused_until && (
                          <div className="mt-4 border border-orange-500/30 bg-orange-500/5 p-4">
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                              Paused Until
                            </p>

                            <p className="mt-1 font-bold">
                              {formatDate(
                                selectedMembership.paused_until,
                              )}
                            </p>
                          </div>
                        )}

                        <div className="mt-4 flex flex-wrap gap-3">
                          <Button
                            onClick={() =>
                              void handleMembershipAction()
                            }
                            disabled={
                              membershipActionLoading
                            }
                          >
                            {membershipActionLoading ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Play className="size-4" />
                            )}

                            Confirm Resume
                          </Button>

                          <Button
                            variant="outline"
                            onClick={() =>
                              setMembershipAction(null)
                            }
                            disabled={
                              membershipActionLoading
                            }
                          >
                            Back
                          </Button>
                        </div>
                      </div>

                    /* CANCEL */
                    ) : membershipAction ===
                      "cancel" ? (
                      <div>
                        <p className="text-sm font-semibold">
                          Cancel this membership?
                        </p>

                        <p className="mt-2 text-sm text-muted-foreground">
                          Only this membership will be cancelled. Other memberships remain active.
                        </p>

                        <div className="mt-4 flex flex-wrap gap-3">
                          <Button
                            variant="outline"
                            onClick={() =>
                              void handleMembershipAction()
                            }
                            disabled={
                              membershipActionLoading
                            }
                          >
                            {membershipActionLoading ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Ban className="size-4" />
                            )}

                            Confirm Cancellation
                          </Button>

                          <Button
                            variant="outline"
                            onClick={() =>
                              setMembershipAction(null)
                            }
                            disabled={
                              membershipActionLoading
                            }
                          >
                            Keep Membership
                          </Button>
                        </div>
                      </div>

                    /* NORMAL ACTION BUTTONS */
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setMembershipAction("extend");
                            setMembershipActionError("");
                            setMembershipActionSuccess("");
                          }}
                        >
                          <CalendarPlus className="size-4" />
                          Extend
                        </Button>

                        {String(
                          selectedMembership.status ||
                            "",
                        ).toLowerCase() ===
                        "paused" ? (
                          <Button
                            onClick={() => {
                              setMembershipAction("resume");
                              setMembershipActionError("");
                              setMembershipActionSuccess("");
                            }}
                          >
                            <Play className="size-4" />
                            Resume
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setPauseUntilDate(
                                addDaysToDateString(
                                  getLocalDateString(),
                                  7,
                                ),
                              );

                              setMembershipAction("pause");
                              setMembershipActionError("");
                              setMembershipActionSuccess("");
                            }}
                            disabled={
                              String(
                                selectedMembership.status ||
                                  "",
                              ).toLowerCase() ===
                              "cancelled"
                            }
                          >
                            <Pause className="size-4" />
                            Pause
                          </Button>
                        )}

                        <Button
                          variant="outline"
                          onClick={() => {
                            setMembershipAction("cancel");
                            setMembershipActionError("");
                            setMembershipActionSuccess("");
                          }}
                          disabled={
                            String(
                              selectedMembership.status ||
                                "",
                            ).toLowerCase() ===
                            "cancelled"
                          }
                          className="sm:col-span-2"
                        >
                          <Ban className="size-4" />
                          Cancel Membership
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STATUS SUMMARY */}
              {selectedMemberMemberships.map(
                (membership) => {
                  const valid =
                    isMembershipValidToday(
                      membership,
                    );

                  const status =
                    String(
                      membership.status ||
                        "",
                    ).toLowerCase();

                  return (
                    <div
                      key={`status-${membership.id}`}
                      className={`border p-4 ${
                        status === "paused"
                          ? "border-orange-500/30 bg-orange-500/10"
                          : status ===
                              "cancelled"
                            ? "border-destructive/30 bg-destructive/10"
                            : valid
                              ? "border-primary bg-primary/5"
                              : "border-destructive/30 bg-destructive/5"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {status ===
                        "paused" ? (
                          <Pause className="mt-0.5 size-5 shrink-0 text-orange-600" />
                        ) : status ===
                          "cancelled" ? (
                          <Ban className="mt-0.5 size-5 shrink-0 text-destructive" />
                        ) : valid ? (
                          <CheckCircle2 className="mt-0.5 size-5 text-primary" />
                        ) : (
                          <XCircle className="mt-0.5 size-5 text-destructive" />
                        )}

                        <div>
                          <p className="font-bold">
                            {membership.plan_name ||
                              "Membership"}{" "}
                            —{" "}
                            {status === "paused"
                              ? "Paused"
                              : status ===
                                  "cancelled"
                                ? "Cancelled"
                                : valid
                                  ? "Active"
                                  : "Not Active"}
                          </p>

                          <p className="mt-1 text-sm text-muted-foreground">
                            {formatDate(
                              membership.start_date,
                            )}{" "}
                            –{" "}
                            {formatDate(
                              membership.end_date,
                            )}
                          </p>

                          {membership.paused_at && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Paused on{" "}
                              {formatDate(
                                membership.paused_at,
                              )}
                            </p>
                          )}

                          {membership.paused_until && (
                            <p className="mt-1 text-xs font-semibold text-orange-600">
                              Paused until{" "}
                              {formatDate(
                                membership.paused_until,
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                },
              )}

              {/* WHATSAPP / CLOSE */}
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
                  onClick={() => {
                    setSelectedMember(null);
                    resetMembershipManagement();
                    setAddMembershipOpen(false);
                    setAddMembershipError("");
                    setAddMembershipSuccess("");
                  }}
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
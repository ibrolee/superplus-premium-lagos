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
import { supabase } from "@/lib/supabase";
import {
  membershipPlans,
  formatNaira,
} from "@/lib/site-data";

export const Route = createFileRoute("/reception-dashboard")({
  head: () => ({
    meta: [
      {
        title: "Reception Dashboard — Super Plus Fitness",
      },
      {
        name: "description",
        content:
          "Staff-only Super Plus Fitness reception dashboard.",
      },
    ],
  }),
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
};

type MemberWithMembership = Member & {
  membership: Membership | null;
};

type AttendanceRecord = {
  id: string;
  member_id: string;
  checked_in_at: string;
  checked_out_at: string | null;
};

type AttendanceWithMember = AttendanceRecord & {
  member: {
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

function getTodayParts() {
  const now = new Date();

  return {
    day: now.getDate(),
    month: now.getMonth() + 1,
  };
}

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getLocalDayRange() {
  const start = new Date();

  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function getLocalWeekRange() {
  const now = new Date();

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  const day = start.getDay();

  const daysSinceMonday = day === 0 ? 6 : day - 1;

  start.setDate(start.getDate() - daysSinceMonday);

  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  return {
    start,
    end,
  };
}

function getLocalMonthRange() {
  const now = new Date();

  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
    0,
    0,
    0,
    0,
  );

  const end = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    1,
    0,
    0,
    0,
    0,
  );

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function addDaysToDateString(
  dateString: string,
  days: number,
) {
  const date = new Date(`${dateString}T00:00:00`);

  date.setDate(date.getDate() + days);

  return getLocalDateString(date);
}

function getMonthName(month: number) {
  return new Intl.DateTimeFormat("en-NG", {
    month: "long",
  }).format(new Date(2026, month - 1, 1));
}

function formatBirthday(
  day: number | null,
  month: number | null,
) {
  if (!day || !month) {
    return "Birthday not available";
  }

  return `${day} ${getMonthName(month)}`;
}

function getDateOnly(value: unknown) {
  if (!value) return null;

  const stringValue = String(value).trim();

  if (!stringValue) return null;

  return stringValue.slice(0, 10);
}

function isMembershipActive(
  membership: Membership | null,
) {
  if (!membership) return false;

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

function getDaysUntilExpiry(
  endDate: string | null,
) {
  if (!endDate) return null;

  const today = getLocalDateString();

  const start = new Date(
    `${today}T00:00:00`,
  );

  const end = new Date(
    `${endDate}T00:00:00`,
  );

  return Math.round(
    (end.getTime() - start.getTime()) /
      (1000 * 60 * 60 * 24),
  );
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(
    new Date(`${value}T00:00:00`),
  );
}

function formatDuration(
  checkedInAt: string,
  checkedOutAt: string | null,
) {
  const start = new Date(checkedInAt);

  const end = checkedOutAt
    ? new Date(checkedOutAt)
    : new Date();

  const minutes = Math.max(
    0,
    Math.round(
      (end.getTime() - start.getTime()) /
        60000,
    ),
  );

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m`;
  }

  return `${remainingMinutes}m`;
}

function formatHourRange(hour: number) {
  const start = new Date();
  start.setHours(hour, 0, 0, 0);

  const end = new Date(start);
  end.setHours(hour + 1, 0, 0, 0);

  const formatter = new Intl.DateTimeFormat(
    "en-NG",
    {
      hour: "numeric",
      minute: "2-digit",
    },
  );

  return `${formatter.format(start)}–${formatter.format(end)}`;
}

/* WhatsApp birthday message */
function createWhatsAppBirthdayUrl(
  member: Member,
) {
  if (!member.phone) return null;

  const phone = member.phone.replace(
    /\D/g,
    "",
  );

  if (!phone) return null;

  let whatsappNumber = phone;

  if (phone.startsWith("0")) {
    whatsappNumber = `234${phone.slice(1)}`;
  } else if (phone.startsWith("234")) {
    whatsappNumber = phone;
  }

  const firstName =
    member.full_name
      ?.trim()
      .split(/\s+/)[0] ||
    "Member";

  const message =
    `🎉🎂 HAPPY BIRTHDAY, ${firstName}! 🎂🎉\n\n` +
    `Today is a special day, and everyone at Super Plus Fitness & Spa wants to take a moment to celebrate YOU. ❤️\n\n` +
    `We are truly grateful to have you as part of the Super Plus family. Your commitment, energy and presence mean so much to us, and we hope this new chapter of your life brings you greater happiness, good health, peace, success and many beautiful memories. 🙏✨\n\n` +
    `May this new year of your life be filled with strength to overcome every challenge, courage to chase your goals, and countless reasons to smile. May you continue to grow, thrive and become the very best version of yourself. 💪🏽❤️\n\n` +
    `From all of us at Super Plus Fitness & Spa, we wish you a truly amazing birthday and a wonderful year ahead. 🥳🎈\n\n` +
    `Keep shining, keep growing and keep staying strong! 💪🔥\n\n` +
    `Enjoy your special day! 🎂🎉\n\n` +
    `With love from your Super Plus family ❤️\n` +
    `— Super Plus Fitness & Spa`;

  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    message,
  )}`;
}

/* WhatsApp renewal reminder */
function createWhatsAppRenewalUrl(
  member: MemberWithMembership,
) {
  if (!member.phone) return null;

  const phone = member.phone.replace(
    /\D/g,
    "",
  );

  if (!phone) return null;

  let whatsappNumber = phone;

  if (phone.startsWith("0")) {
    whatsappNumber = `234${phone.slice(1)}`;
  } else if (phone.startsWith("234")) {
    whatsappNumber = phone;
  }

  const firstName =
    member.full_name
      ?.trim()
      .split(/\s+/)[0] ||
    "Member";

  const expiryDate = getDateOnly(
    member.membership?.end_date,
  );

  if (!expiryDate) return null;

  const formattedExpiryDate =
    new Intl.DateTimeFormat("en-NG", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(
      new Date(
        `${expiryDate}T00:00:00`,
      ),
    );

  const message =
    `💪🏽❤️ HELLO ${firstName}! ❤️💪🏽\n\n` +
    `We noticed that your membership at Super Plus Fitness & Spa is coming to an end soon, and we wanted to personally reach out to you. 😊\n\n` +
    `It has been a pleasure having you as part of the Super Plus family. Every workout, every effort, and every step you've taken toward becoming stronger and healthier matters. 🏋🏽‍♂️🔥\n\n` +
    `We would love to see you continue your fitness journey with us without any break. Your goals are important to us, and we are always here to support you, encourage you and help you keep moving forward. ❤️\n\n` +
    `Your membership expires on ${formattedExpiryDate}. 📅\n\n` +
    `Whenever you're ready, you can renew your membership and keep the momentum going. Don't let the progress you've worked so hard for stop here. 💪🏽✨\n\n` +
    `Thank you for choosing Super Plus Fitness & Spa and for being part of our family. We truly appreciate having you with us. 🙏❤️\n\n` +
    `Stay strong. Stay consistent. Keep becoming better. 🔥\n\n` +
    `We look forward to seeing you again! 😊💪🏽\n\n` +
    `With love from your Super Plus family ❤️\n` +
    `— Super Plus Fitness & Spa`;

  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    message,
  )}`;
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
  count: number;
  icon: ReactNode;
}) {
  return (
    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 border border-border bg-background p-5 shadow-sm [&::-webkit-details-marker]:hidden sm:p-6">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
            {eyebrow}
          </p>

          <span className="bg-muted px-2 py-1 text-[10px] font-extrabold uppercase">
            {count}
          </span>
        </div>

        <h2 className="mt-2 font-display text-3xl font-bold uppercase sm:text-4xl">
          {title}
        </h2>

        <p className="mt-2 text-sm text-muted-foreground">
          {description}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-center gap-2">
        <div className="flex size-11 items-center justify-center bg-primary text-primary-foreground">
          {icon}
        </div>

        <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase text-primary">
          View
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
        </span>
      </div>
    </summary>
  );
}

function ReceptionDashboardPage() {
  const [checkingAccess, setCheckingAccess] =
    useState(true);

  const [staffName, setStaffName] =
    useState("");

  const [members, setMembers] =
    useState<MemberWithMembership[]>(
      [],
    );

  const [todayAttendance, setTodayAttendance] =
    useState<AttendanceWithMember[]>(
      [],
    );

  const [monthlyAttendance, setMonthlyAttendance] =
    useState<AttendanceWithMember[]>(
      [],
    );

  const [loadingMembers, setLoadingMembers] =
    useState(false);

  const [loadingAttendance, setLoadingAttendance] =
    useState(false);

  const [loadingAnalytics, setLoadingAnalytics] =
    useState(false);

  const [loadError, setLoadError] =
    useState("");

  const [loggingOut, setLoggingOut] =
    useState(false);

  const [memberSearch, setMemberSearch] =
    useState("");

  /*
   * ADD MEMBER FORM
   */
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
    useState(
      membershipPlans[2]?.id || "",
    );

  const [addMemberStartDate, setAddMemberStartDate] =
    useState(
      getLocalDateString(),
    );

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

  const today = useMemo(
    () => getTodayParts(),
    [],
  );

  const currentMonthName =
    getMonthName(today.month);

  const todayDateString =
    getLocalDateString();

  const sevenDaysFromToday =
    addDaysToDateString(
      todayDateString,
      7,
    );

  const weekRange = useMemo(
    () => getLocalWeekRange(),
    [],
  );

  const selectedPlan =
    membershipPlans.find(
      (plan) =>
        plan.id === selectedPlanId,
    ) ||
    membershipPlans[0];

  const selectedPlanDuration =
    selectedPlan
      ? planDurationDays[
          selectedPlan.id
        ] || 30
      : 30;

  const registrationAmount =
    selectedPlan &&
    includeRegistrationFee
      ? selectedPlan.registration
      : 0;

  const totalAmount =
    selectedPlan
      ? selectedPlan.price +
        registrationAmount
      : 0;

  const calculatedEndDate =
    addMemberStartDate
      ? addDaysToDateString(
          addMemberStartDate,
          selectedPlanDuration - 1,
        )
      : "";

  useEffect(() => {
    let active = true;

    async function checkStaffAccess() {
      setCheckingAccess(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;

      if (!session) {
        setCheckingAccess(false);
        return;
      }

      const {
        data: staff,
        error: staffError,
      } = await supabase
        .from("staff_users")
        .select(
          "full_name, role, active",
        )
        .eq(
          "auth_user_id",
          session.user.id,
        )
        .eq("active", true)
        .maybeSingle();

      if (!active) return;

      if (staffError || !staff) {
        await supabase.auth.signOut();
        setCheckingAccess(false);
        return;
      }

      setStaffName(
        staff.full_name ||
          "Reception",
      );

      setCheckingAccess(false);
    }

    checkStaffAccess();

    return () => {
      active = false;
    };
  }, []);

  async function loadMembers() {
    setLoadingMembers(true);
    setLoadError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setStaffName("");
        return;
      }

      const {
        data: staff,
        error: staffError,
      } = await supabase
        .from("staff_users")
        .select(
          "full_name, role, active",
        )
        .eq(
          "auth_user_id",
          session.user.id,
        )
        .eq("active", true)
        .maybeSingle();

      if (
        staffError ||
        !staff
      ) {
        await supabase.auth.signOut();
        setStaffName("");
        return;
      }

      setStaffName(
        staff.full_name ||
          "Reception",
      );

      const {
        data: memberData,
        error: membersError,
      } = await supabase
        .from("members")
        .select(
          "id, full_name, email, phone, birth_day, birth_month",
        )
        .order("full_name", {
          ascending: true,
        });

      if (membersError) {
        throw new Error(
          membersError.message,
        );
      }

      const memberRows =
        (memberData ||
          []) as Member[];

      if (
        memberRows.length ===
        0
      ) {
        setMembers([]);
        return;
      }

      const memberIds =
        memberRows.map(
          (member) =>
            member.id,
        );

      const {
        data: membershipData,
        error: membershipError,
      } = await supabase
        .from("memberships")
        .select(
          "id, member_id, plan_name, start_date, end_date, status",
        )
        .in(
          "member_id",
          memberIds,
        )
        .order("end_date", {
          ascending: false,
        });

      if (membershipError) {
        throw new Error(
          membershipError.message,
        );
      }

      const membershipRows =
        (membershipData ||
          []) as Membership[];

      const latestMembershipByMember =
        new Map<
          string,
          Membership
        >();

      for (const membership of membershipRows) {
        if (
          !latestMembershipByMember.has(
            membership.member_id,
          )
        ) {
          latestMembershipByMember.set(
            membership.member_id,
            membership,
          );
        }
      }

      setMembers(
        memberRows.map(
          (member) => ({
            ...member,
            membership:
              latestMembershipByMember.get(
                member.id,
              ) || null,
          }),
        ),
      );
    } catch (error) {
      console.error(
        "Reception dashboard member error:",
        error,
      );

      setLoadError(
        error instanceof Error
          ? error.message
          : "Unable to load members.",
      );
    } finally {
      setLoadingMembers(false);
    }
  }

  async function loadAttendance() {
    setLoadingAttendance(true);
    setLoadingAnalytics(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setStaffName("");
        return;
      }

      const {
        data: staff,
        error: staffError,
      } = await supabase
        .from("staff_users")
        .select(
          "full_name, role, active",
        )
        .eq(
          "auth_user_id",
          session.user.id,
        )
        .eq("active", true)
        .maybeSingle();

      if (
        staffError ||
        !staff
      ) {
        await supabase.auth.signOut();
        setStaffName("");
        return;
      }

      const {
        start: todayStart,
        end: todayEnd,
      } = getLocalDayRange();

      const {
        start: monthStart,
        end: monthEnd,
      } = getLocalMonthRange();

      const [
        todayResult,
        monthResult,
      ] = await Promise.all([
        supabase
          .from("attendance")
          .select(
            `
              id,
              member_id,
              checked_in_at,
              checked_out_at,
              members (
                full_name,
                phone
              )
            `,
          )
          .gte(
            "checked_in_at",
            todayStart,
          )
          .lt(
            "checked_in_at",
            todayEnd,
          )
          .order(
            "checked_in_at",
            {
              ascending: false,
            },
          ),

        supabase
          .from("attendance")
          .select(
            `
              id,
              member_id,
              checked_in_at,
              checked_out_at,
              members (
                full_name,
                phone
              )
            `,
          )
          .gte(
            "checked_in_at",
            monthStart,
          )
          .lt(
            "checked_in_at",
            monthEnd,
          )
          .order(
            "checked_in_at",
            {
              ascending: false,
            },
          ),
      ]);

      if (todayResult.error) {
        throw new Error(
          todayResult.error.message,
        );
      }

      if (monthResult.error) {
        throw new Error(
          monthResult.error.message,
        );
      }

      function mapAttendance(
        rows: any[],
      ): AttendanceWithMember[] {
        return (rows || []).map(
          (record) => ({
            id: record.id,
            member_id:
              record.member_id,
            checked_in_at:
              record.checked_in_at,
            checked_out_at:
              record.checked_out_at,
            member:
              record.members
                ? {
                    full_name:
                      record
                        .members
                        .full_name ||
                      null,
                    phone:
                      record
                        .members
                        .phone ||
                      null,
                  }
                : null,
          }),
        );
      }

      setTodayAttendance(
        mapAttendance(
          todayResult.data || [],
        ),
      );

      setMonthlyAttendance(
        mapAttendance(
          monthResult.data || [],
        ),
      );
    } catch (error) {
      console.error(
        "Reception attendance error:",
        error,
      );

      setLoadError(
        error instanceof Error
          ? error.message
          : "Unable to load attendance.",
      );
    } finally {
      setLoadingAttendance(false);
      setLoadingAnalytics(false);
    }
  }

  async function refreshDashboard() {
    setLoadError("");

    await Promise.all([
      loadMembers(),
      loadAttendance(),
    ]);
  }

  useEffect(() => {
    if (
      !checkingAccess &&
      staffName
    ) {
      refreshDashboard();
    }
  }, [
    checkingAccess,
    staffName,
  ]);

  async function handleLogout() {
    setLoggingOut(true);

    await supabase.auth.signOut();

    setStaffName("");
    setMembers([]);
    setTodayAttendance([]);
    setMonthlyAttendance([]);
    setMemberSearch("");
    setLoggingOut(false);
  }

  async function handleAddMember(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setAddMemberError("");
    setAddMemberSuccess(null);

    if (!addMemberName.trim()) {
      setAddMemberError(
        "Full name is required.",
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
        "Please enter a valid birthday.",
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
        planDurationDays[
          selectedPlan.id
        ] || 30;

      const { data, error } =
        await supabase.rpc(
          "reception_add_member",
          {
            p_full_name:
              addMemberName.trim(),
            p_email:
              addMemberEmail.trim() ||
              null,
            p_phone:
              addMemberPhone.trim() ||
              null,
            p_address:
              addMemberAddress.trim() ||
              null,
            p_birth_day:
              addMemberBirthDay
                ? Number(
                    addMemberBirthDay,
                  )
                : null,
            p_birth_month:
              addMemberBirthMonth
                ? Number(
                    addMemberBirthMonth,
                  )
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

      if (error) {
        throw new Error(
          error.message,
        );
      }

      if (!data?.success) {
        throw new Error(
          data?.error ||
            "Unable to add member.",
        );
      }

      setAddMemberSuccess({
        memberId:
          data.member_id,
        membershipId:
          data.membership_id,
        planName:
          data.plan_name ||
          selectedPlan.name,
        startDate:
          data.start_date ||
          addMemberStartDate,
        endDate:
          data.end_date ||
          calculatedEndDate,
        total: totalAmount,
      });

      setAddMemberName("");
      setAddMemberEmail("");
      setAddMemberPhone("");
      setAddMemberAddress("");
      setAddMemberBirthDay("");
      setAddMemberBirthMonth("");
      setPaymentMethod("Cash");
      setIncludeRegistrationFee(true);

      await refreshDashboard();
    } catch (error) {
      console.error(
        "Add member error:",
        error,
      );

      setAddMemberError(
        error instanceof Error
          ? error.message
          : "Unable to add member.",
      );
    } finally {
      setAddingMember(false);
    }
  }

  const birthdaysToday =
    members.filter(
      (member) =>
        member.birth_day ===
          today.day &&
        member.birth_month ===
          today.month,
    );

  const birthdaysThisMonth =
    members
      .filter(
        (member) =>
          member.birth_month ===
          today.month,
      )
      .sort((a, b) => {
        return (
          (a.birth_day || 0) -
          (b.birth_day || 0)
        );
      });

  const currentlyInside =
    todayAttendance.filter(
      (attendance) =>
        !attendance.checked_out_at,
    );

  const uniqueVisitorsToday =
    new Set(
      todayAttendance.map(
        (attendance) =>
          attendance.member_id,
      ),
    ).size;

  const expiringSoon =
    members
      .filter((member) => {
        const endDate =
          getDateOnly(
            member.membership?.end_date,
          );

        if (!endDate) return false;

        return (
          endDate >=
            todayDateString &&
          endDate <=
            sevenDaysFromToday
        );
      })
      .sort((a, b) => {
        const dateA =
          getDateOnly(
            a.membership?.end_date,
          ) || "";

        const dateB =
          getDateOnly(
            b.membership?.end_date,
          ) || "";

        return dateA.localeCompare(
          dateB,
        );
      });

  const thisWeekAttendance =
    monthlyAttendance.filter(
      (attendance) => {
        const checkIn = new Date(
          attendance.checked_in_at,
        );

        return (
          checkIn >=
            weekRange.start &&
          checkIn <
            weekRange.end
        );
      },
    );

  const todayVisits =
    todayAttendance.length;

  const weekVisits =
    thisWeekAttendance.length;

  const monthVisits =
    monthlyAttendance.length;

  const monthUniqueMembers =
    new Set(
      monthlyAttendance.map(
        (attendance) =>
          attendance.member_id,
      ),
    ).size;

  const averageVisitsPerMember =
    monthUniqueMembers > 0
      ? monthVisits /
        monthUniqueMembers
      : 0;

  const busiestDayData =
    useMemo(() => {
      const counts =
        new Map<
          string,
          number
        >();

      for (const attendance of monthlyAttendance) {
        const date =
          getDateOnly(
            attendance.checked_in_at,
          );

        if (!date) continue;

        counts.set(
          date,
          (counts.get(date) ||
            0) + 1,
        );
      }

      let busiestDate:
        | string
        | null = null;

      let busiestCount = 0;

      for (const [
        date,
        count,
      ] of counts.entries()) {
        if (
          count >
          busiestCount
        ) {
          busiestDate =
            date;

          busiestCount =
            count;
        }
      }

      return {
        date: busiestDate,
        count: busiestCount,
      };
    }, [
      monthlyAttendance,
    ]);

  const busiestHourData =
    useMemo(() => {
      const counts =
        new Map<
          number,
          number
        >();

      for (const attendance of monthlyAttendance) {
        const date =
          new Date(
            attendance.checked_in_at,
          );

        if (
          Number.isNaN(
            date.getTime(),
          )
        ) {
          continue;
        }

        const hour =
          date.getHours();

        counts.set(
          hour,
          (counts.get(hour) ||
            0) + 1,
        );
      }

      let busiestHour:
        | number
        | null = null;

      let busiestCount = 0;

      for (const [
        hour,
        count,
      ] of counts.entries()) {
        if (
          count >
          busiestCount
        ) {
          busiestHour =
            hour;

          busiestCount =
            count;
        }
      }

      return {
        hour: busiestHour,
        count: busiestCount,
      };
    }, [
      monthlyAttendance,
    ]);

  const searchTerm =
    memberSearch
      .trim()
      .toLowerCase();

  const searchedMembers =
    searchTerm
      ? members
          .filter((member) => {
            const name =
              member.full_name
                ?.toLowerCase() ||
              "";

            const phone =
              member.phone
                ?.toLowerCase() ||
              "";

            const email =
              member.email
                ?.toLowerCase() ||
              "";

            return (
              name.includes(
                searchTerm,
              ) ||
              phone.includes(
                searchTerm,
              ) ||
              email.includes(
                searchTerm,
              )
            );
          })
          .slice(0, 20)
      : [];

  if (checkingAccess) {
    return (
      <main className="min-h-[75vh] bg-muted py-20">
        <div className="section-shell flex min-h-[50vh] items-center justify-center">
          <div className="flex items-center gap-3 text-sm font-bold uppercase">
            <Loader2 className="size-5 animate-spin" />
            Checking staff access...
          </div>
        </div>
      </main>
    );
  }

  if (!staffName) {
    return (
      <main className="min-h-[75vh] bg-muted py-16 sm:py-24">
        <div className="section-shell flex min-h-[60vh] items-center justify-center">
          <div className="w-full max-w-md border border-border bg-background p-7 shadow-sm sm:p-10">
            <div className="mx-auto flex size-12 items-center justify-center bg-primary text-primary-foreground">
              <Users className="size-6" />
            </div>

            <p className="mt-6 text-center text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
              Super Plus Fitness
            </p>

            <h1 className="display-title mt-3 text-center text-4xl sm:text-5xl">
              Reception Dashboard
            </h1>

            <p className="mt-4 text-center text-sm leading-6 text-muted-foreground">
              Staff login is required to access the reception dashboard.
            </p>

            <Link
              to="/reception-checkin"
              className="mt-8 block"
            >
              <Button
                size="lg"
                className="w-full"
              >
                <QrCode />
                Go To Reception Login
              </Button>
            </Link>

            <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">
              This area is restricted to authorized Super Plus Fitness staff.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[75vh] bg-muted py-10 sm:py-16">
      <div className="section-shell">
        <div className="mx-auto max-w-6xl">

          {/* HEADER */}
          <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
                Super Plus Fitness
              </p>

              <h1 className="display-title text-4xl sm:text-6xl">
                Reception Dashboard
              </h1>

              <p className="mt-3 text-sm text-muted-foreground">
                Welcome{" "}
                <strong>{staffName}</strong>
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Link
                to="/reception-checkin"
                className="w-full sm:w-auto"
              >
                <Button className="w-full">
                  <QrCode />
                  Open QR Scanner
                </Button>
              </Link>

              <Button
                variant="outline"
                onClick={refreshDashboard}
                disabled={
                  loadingMembers ||
                  loadingAttendance
                }
                className="w-full sm:w-auto"
              >
                {loadingMembers ||
                loadingAttendance ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <RefreshCw />
                )}
                Refresh
              </Button>

              <Button
                variant="outline"
                onClick={handleLogout}
                disabled={loggingOut}
                className="w-full sm:w-auto"
              >
                {loggingOut ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <LogOut />
                )}
                Log Out
              </Button>
            </div>
          </div>

          {/* ERROR */}
          {loadError && (
            <section className="mb-8 border border-destructive/30 bg-destructive/10 p-5">
              <div className="flex items-start gap-3">
                <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" />

                <div>
                  <p className="text-xs font-extrabold uppercase text-destructive">
                    Dashboard Error
                  </p>

                  <p className="mt-1 text-sm leading-6 text-destructive">
                    {loadError}
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* ADD A MEMBER */}
          <section className="mb-10">
            <div className="border border-border bg-background shadow-sm">
              <div className="border-b border-border bg-primary p-6 text-primary-foreground sm:p-7">
                <div className="flex items-start gap-4">
                  <div className="flex size-12 shrink-0 items-center justify-center bg-primary-foreground text-primary">
                    <UserPlus className="size-6" />
                  </div>

                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[0.18em] opacity-80">
                      Reception
                    </p>

                    <h2 className="mt-1 font-display text-3xl font-bold uppercase sm:text-4xl">
                      Add A Member
                    </h2>

                    <p className="mt-2 max-w-2xl text-sm leading-6 opacity-80">
                      Register a new member, activate their membership and record their payment.
                    </p>
                  </div>
                </div>
              </div>

              <form
                onSubmit={handleAddMember}
                className="p-5 sm:p-7"
              >
                {addMemberError && (
                  <div className="mb-6 border border-destructive/30 bg-destructive/10 p-4">
                    <div className="flex items-start gap-3">
                      <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" />

                      <div>
                        <p className="text-xs font-extrabold uppercase text-destructive">
                          Unable To Add Member
                        </p>

                        <p className="mt-1 text-sm text-destructive">
                          {addMemberError}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {addMemberSuccess && (
                  <div className="mb-6 border border-green-600/30 bg-green-600/10 p-5">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-green-700" />

                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-extrabold uppercase text-green-700">
                          Member Added Successfully
                        </p>

                        <h3 className="mt-1 font-display text-2xl font-bold uppercase">
                          Membership Activated
                        </h3>

                        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                          <div>
                            <span className="text-xs font-extrabold uppercase text-muted-foreground">
                              Plan
                            </span>

                            <p className="mt-1 font-bold">
                              {addMemberSuccess.planName}
                            </p>
                          </div>

                          <div>
                            <span className="text-xs font-extrabold uppercase text-muted-foreground">
                              Amount Recorded
                            </span>

                            <p className="mt-1 font-bold">
                              {formatNaira(
                                addMemberSuccess.total,
                              )}
                            </p>
                          </div>

                          <div>
                            <span className="text-xs font-extrabold uppercase text-muted-foreground">
                              Start
                            </span>

                            <p className="mt-1 font-bold">
                              {formatDate(
                                addMemberSuccess.startDate,
                              )}
                            </p>
                          </div>

                          <div>
                            <span className="text-xs font-extrabold uppercase text-muted-foreground">
                              Expiry
                            </span>

                            <p className="mt-1 font-bold">
                              {formatDate(
                                addMemberSuccess.endDate,
                              )}
                            </p>
                          </div>
                        </div>

                        <Link
                          to="/reception-member/$memberId"
                          params={{
                            memberId:
                              addMemberSuccess.memberId,
                          }}
                          className="mt-5 inline-block"
                        >
                          <Button
                            type="button"
                            variant="outline"
                          >
                            <UserRound />
                            View Member Profile
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid gap-6 lg:grid-cols-2">

                  {/* PERSONAL INFORMATION */}
                  <div>
                    <div className="mb-5">
                      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">
                        01
                      </p>

                      <h3 className="mt-1 font-display text-2xl font-bold uppercase">
                        Personal Information
                      </h3>
                    </div>

                    <div className="grid gap-4">
                      <div>
                        <label className="mb-2 block text-xs font-extrabold uppercase tracking-wide">
                          Full Name *
                        </label>

                        <input
                          type="text"
                          value={addMemberName}
                          onChange={(event) =>
                            setAddMemberName(
                              event.target.value,
                            )
                          }
                          placeholder="Member full name"
                          required
                          className="h-12 w-full rounded-md border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-extrabold uppercase tracking-wide">
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
                          className="h-12 w-full rounded-md border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-extrabold uppercase tracking-wide">
                          Phone Number
                        </label>

                        <input
                          type="tel"
                          value={addMemberPhone}
                          onChange={(event) =>
                            setAddMemberPhone(
                              event.target.value,
                            )
                          }
                          placeholder="08012345678"
                          className="h-12 w-full rounded-md border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-extrabold uppercase tracking-wide">
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
                          className="w-full rounded-md border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    </div>
                  </div>

                  {/* BIRTHDAY */}
                  <div>
                    <div className="mb-5">
                      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">
                        02
                      </p>

                      <h3 className="mt-1 font-display text-2xl font-bold uppercase">
                        Birthday
                      </h3>

                      <p className="mt-1 text-xs text-muted-foreground">
                        Year is not required.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-2 block text-xs font-extrabold uppercase tracking-wide">
                          Day
                        </label>

                        <select
                          value={
                            addMemberBirthDay
                          }
                          onChange={(event) =>
                            setAddMemberBirthDay(
                              event.target.value,
                            )
                          }
                          className="h-12 w-full rounded-md border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="">
                            Day
                          </option>

                          {Array.from(
                            { length: 31 },
                            (_, index) =>
                              index + 1,
                          ).map(
                            (day) => (
                              <option
                                key={day}
                                value={day}
                              >
                                {day}
                              </option>
                            ),
                          )}
                        </select>
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-extrabold uppercase tracking-wide">
                          Month
                        </label>

                        <select
                          value={
                            addMemberBirthMonth
                          }
                          onChange={(event) =>
                            setAddMemberBirthMonth(
                              event.target.value,
                            )
                          }
                          className="h-12 w-full rounded-md border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="">
                            Month
                          </option>

                          {Array.from(
                            { length: 12 },
                            (_, index) =>
                              index + 1,
                          ).map(
                            (month) => (
                              <option
                                key={month}
                                value={month}
                              >
                                {getMonthName(
                                  month,
                                )}
                              </option>
                            ),
                          )}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* MEMBERSHIP */}
                  <div className="lg:col-span-2">
                    <div className="mb-5">
                      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">
                        03
                      </p>

                      <h3 className="mt-1 font-display text-2xl font-bold uppercase">
                        Membership
                      </h3>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-3">

                      <div className="lg:col-span-2">
                        <label className="mb-2 block text-xs font-extrabold uppercase tracking-wide">
                          Membership Plan *
                        </label>

                        <select
                          value={
                            selectedPlanId
                          }
                          onChange={(event) =>
                            setSelectedPlanId(
                              event.target.value,
                            )
                          }
                          required
                          className="h-12 w-full rounded-md border border-input bg-background px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-ring"
                        >
                          {membershipPlans.map(
                            (plan) => (
                              <option
                                key={plan.id}
                                value={plan.id}
                              >
                                {plan.name} —{" "}
                                {formatNaira(
                                  plan.price,
                                )}
                              </option>
                            ),
                          )}
                        </select>
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-extrabold uppercase tracking-wide">
                          Start Date *
                        </label>

                        <input
                          type="date"
                          value={
                            addMemberStartDate
                          }
                          onChange={(event) =>
                            setAddMemberStartDate(
                              event.target.value,
                            )
                          }
                          required
                          className="h-12 w-full rounded-md border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    </div>

                    {selectedPlan && (
                      <div className="mt-5 grid gap-4 sm:grid-cols-3">

                        <div className="border border-border bg-muted p-5">
                          <p className="text-xs font-extrabold uppercase text-muted-foreground">
                            Membership Fee
                          </p>

                          <p className="mt-2 font-display text-2xl font-black">
                            {formatNaira(
                              selectedPlan.price,
                            )}
                          </p>

                          <p className="mt-1 text-xs text-muted-foreground">
                            {selectedPlan.duration}
                          </p>
                        </div>

                        <div className="border border-border bg-muted p-5">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs font-extrabold uppercase text-muted-foreground">
                              Registration
                            </p>

                            <button
                              type="button"
                              role="switch"
                              aria-checked={
                                includeRegistrationFee
                              }
                              onClick={() =>
                                setIncludeRegistrationFee(
                                  (current) =>
                                    !current,
                                )
                              }
                              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                                includeRegistrationFee
                                  ? "bg-primary"
                                  : "bg-muted-foreground/30"
                              }`}
                            >
                              <span
                                className={`absolute top-1 size-4 rounded-full bg-white transition-transform ${
                                  includeRegistrationFee
                                    ? "translate-x-6"
                                    : "translate-x-1"
                                }`}
                              />
                            </button>
                          </div>

                          <p className="mt-2 font-display text-2xl font-black">
                            {formatNaira(
                              registrationAmount,
                            )}
                          </p>

                          <p className="mt-1 text-xs text-muted-foreground">
                            {includeRegistrationFee
                              ? "Registration fee included"
                              : "Registration fee waived"}
                          </p>
                        </div>

                        <div className="border border-primary/30 bg-primary/5 p-5">
                          <p className="text-xs font-extrabold uppercase text-primary">
                            Total Amount
                          </p>

                          <p className="mt-2 font-display text-3xl font-black">
                            {formatNaira(
                              totalAmount,
                            )}
                          </p>

                          <p className="mt-1 text-xs text-muted-foreground">
                            Amount to record
                          </p>
                        </div>
                      </div>
                    )}

                    {selectedPlan && (
                      <div className="mt-5 flex flex-col gap-3 border border-border bg-background p-5 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                            Membership Period
                          </p>

                          <p className="mt-1 font-bold">
                            {formatDate(
                              addMemberStartDate,
                            )}{" "}
                            →{" "}
                            {formatDate(
                              calculatedEndDate,
                            )}
                          </p>
                        </div>

                        <div className="text-left sm:text-right">
                          <p className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                            Duration
                          </p>

                          <p className="mt-1 font-bold">
                            {selectedPlanDuration} day
                            {selectedPlanDuration ===
                            1
                              ? ""
                              : "s"}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* PAYMENT */}
                  <div className="lg:col-span-2">
                    <div className="mb-5">
                      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">
                        04
                      </p>

                      <h3 className="mt-1 font-display text-2xl font-bold uppercase">
                        Payment
                      </h3>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-xs font-extrabold uppercase tracking-wide">
                          Payment Method *
                        </label>

                        <select
                          value={
                            paymentMethod
                          }
                          onChange={(event) =>
                            setPaymentMethod(
                              event.target.value,
                            )
                          }
                          required
                          className="h-12 w-full rounded-md border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
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

                          <option value="Paystack">
                            Paystack
                          </option>
                        </select>
                      </div>

                      <div className="flex items-end">
                        <div className="w-full border border-primary/30 bg-primary/5 p-4">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-xs font-extrabold uppercase">
                              Amount To Record
                            </span>

                            <span className="font-display text-2xl font-black">
                              {formatNaira(
                                totalAmount,
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 border-t border-border pt-6">
                  <Button
                    type="submit"
                    size="lg"
                    disabled={
                      addingMember ||
                      !selectedPlan
                    }
                    className="w-full sm:w-auto"
                  >
                    {addingMember ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <UserPlus />
                    )}

                    {addingMember
                      ? "Activating Member..."
                      : "Activate Member"}
                  </Button>

                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    Activating the member will create their member record, membership, payment record and QR token.
                  </p>
                </div>
              </form>
            </div>
          </section>

          {/* MEMBER SEARCH */}
          <section className="mb-8">
            <div className="border border-border bg-background p-5 shadow-sm sm:p-6">
              <div className="flex items-start gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center bg-primary text-primary-foreground">
                  <Search className="size-6" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
                    Reception
                  </p>

                  <h2 className="mt-1 font-display text-3xl font-bold uppercase">
                    Find A Member
                  </h2>

                  <p className="mt-2 text-sm text-muted-foreground">
                    Search by name, phone number or email.
                  </p>
                </div>
              </div>

              <div className="relative mt-5">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />

                <input
                  type="search"
                  value={memberSearch}
                  onChange={(event) =>
                    setMemberSearch(
                      event.target.value,
                    )
                  }
                  placeholder="Search member name, phone or email..."
                  className="h-13 w-full rounded-md border border-input bg-background pl-12 pr-4 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {memberSearch.trim() && (
                <div className="mt-4">
                  {searchedMembers.length ===
                  0 ? (
                    <div className="border border-border bg-muted p-6 text-center">
                      <XCircle className="mx-auto size-7 text-muted-foreground" />

                      <p className="mt-3 font-bold uppercase">
                        No Member Found
                      </p>

                      <p className="mt-1 text-xs text-muted-foreground">
                        Try another name, phone number or email.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border overflow-hidden border border-border">
                      {searchedMembers.map(
                        (member) => (
                          <div
                            key={member.id}
                            className="flex flex-col gap-4 bg-background p-5 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <h3 className="font-display text-2xl font-bold uppercase">
                              {member.full_name ||
                                "Member"}
                            </h3>

                            <Link
                              to="/reception-member/$memberId"
                              params={{
                                memberId:
                                  member.id,
                              }}
                              className="w-full sm:w-auto"
                            >
                              <Button
                                variant="outline"
                                className="w-full sm:w-auto"
                              >
                                <UserRound />
                                View Profile
                              </Button>
                            </Link>
                          </div>
                        ),
                      )}
                    </div>
                  )}

                  {searchedMembers.length ===
                    20 && (
                    <p className="mt-3 text-center text-[10px] font-extrabold uppercase text-muted-foreground">
                      Showing first 20 matches — refine your search
                    </p>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* OVERVIEW */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

            <div className="border border-border bg-background p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-extrabold uppercase tracking-[0.12em]">
                  Currently Inside
                </p>

                <div className="flex size-10 items-center justify-center bg-primary text-primary-foreground">
                  <Users className="size-5" />
                </div>
              </div>

              <p className="mt-5 font-display text-4xl font-bold">
                {currentlyInside.length}
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Members currently in the gym
              </p>
            </div>

            <div className="border border-border bg-background p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-extrabold uppercase tracking-[0.12em]">
                  Visits Today
                </p>

                <div className="flex size-10 items-center justify-center bg-primary text-primary-foreground">
                  <LogIn className="size-5" />
                </div>
              </div>

              <p className="mt-5 font-display text-4xl font-bold">
                {todayVisits}
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                {uniqueVisitorsToday} unique member
                {uniqueVisitorsToday === 1
                  ? ""
                  : "s"}
              </p>
            </div>

            <div className="border border-border bg-background p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-extrabold uppercase tracking-[0.12em]">
                  Birthdays Today
                </p>

                <div className="flex size-10 items-center justify-center bg-primary text-primary-foreground">
                  <Cake className="size-5" />
                </div>
              </div>

              <p className="mt-5 font-display text-4xl font-bold">
                {birthdaysToday.length}
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Birthday
                {birthdaysToday.length === 1
                  ? ""
                  : "s"}{" "}
                today
              </p>
            </div>

            <div className="border border-border bg-background p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-extrabold uppercase tracking-[0.12em]">
                  Expiring Soon
                </p>

                <div className="flex size-10 items-center justify-center bg-primary text-primary-foreground">
                  <Clock3 className="size-5" />
                </div>
              </div>

              <p className="mt-5 font-display text-4xl font-bold">
                {expiringSoon.length}
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Memberships within 7 days
              </p>
            </div>
          </section>

          {/* ATTENDANCE ANALYTICS */}
          <section className="mt-10">
            <details className="group">
              <ExpandableSummary
                eyebrow="Business Intelligence"
                title="Attendance Analytics"
                description={`Attendance performance for ${currentMonthName}.`}
                count={monthVisits}
                icon={
                  <BarChart3 className="size-6" />
                }
              />

              <div className="mt-3 border border-border bg-background p-5 shadow-sm sm:p-6">

                {loadingAnalytics ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="flex items-center gap-3 text-sm font-bold uppercase">
                      <Loader2 className="size-5 animate-spin" />
                      Calculating analytics...
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

                      <div className="border border-border p-5">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-extrabold uppercase text-muted-foreground">
                            Today
                          </p>

                          <Activity className="size-5 text-primary" />
                        </div>

                        <p className="mt-4 font-display text-4xl font-black">
                          {todayVisits}
                        </p>

                        <p className="mt-1 text-xs text-muted-foreground">
                          visits
                        </p>
                      </div>

                      <div className="border border-border p-5">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-extrabold uppercase text-muted-foreground">
                            This Week
                          </p>

                          <TrendingUp className="size-5 text-primary" />
                        </div>

                        <p className="mt-4 font-display text-4xl font-black">
                          {weekVisits}
                        </p>

                        <p className="mt-1 text-xs text-muted-foreground">
                          visits
                        </p>
                      </div>

                      <div className="border border-border p-5">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-extrabold uppercase text-muted-foreground">
                            This Month
                          </p>

                          <BarChart3 className="size-5 text-primary" />
                        </div>

                        <p className="mt-4 font-display text-4xl font-black">
                          {monthVisits}
                        </p>

                        <p className="mt-1 text-xs text-muted-foreground">
                          total visits
                        </p>
                      </div>

                      <div className="border border-border p-5">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-extrabold uppercase text-muted-foreground">
                            Unique Members
                          </p>

                          <Users className="size-5 text-primary" />
                        </div>

                        <p className="mt-4 font-display text-4xl font-black">
                          {monthUniqueMembers}
                        </p>

                        <p className="mt-1 text-xs text-muted-foreground">
                          visited this month
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 sm:grid-cols-3">

                      <div className="border border-border bg-muted p-5">
                        <p className="text-xs font-extrabold uppercase text-muted-foreground">
                          Average Visits / Member
                        </p>

                        <p className="mt-3 font-display text-3xl font-black">
                          {averageVisitsPerMember.toFixed(
                            1,
                          )}
                        </p>

                        <p className="mt-1 text-xs text-muted-foreground">
                          visits per unique member
                        </p>
                      </div>

                      <div className="border border-border bg-muted p-5">
                        <p className="text-xs font-extrabold uppercase text-muted-foreground">
                          Busiest Day
                        </p>

                        <p className="mt-3 font-display text-2xl font-black uppercase">
                          {busiestDayData.date
                            ? formatDate(
                                busiestDayData.date,
                              )
                            : "No data"}
                        </p>

                        <p className="mt-1 text-xs text-muted-foreground">
                          {busiestDayData.count} visit
                          {busiestDayData.count ===
                          1
                            ? ""
                            : "s"}{" "}
                          this month
                        </p>
                      </div>

                      <div className="border border-border bg-muted p-5">
                        <p className="text-xs font-extrabold uppercase text-muted-foreground">
                          Busiest Hour
                        </p>

                        <p className="mt-3 font-display text-2xl font-black uppercase">
                          {busiestHourData.hour !==
                          null
                            ? formatHourRange(
                                busiestHourData.hour,
                              )
                            : "No data"}
                        </p>

                        <p className="mt-1 text-xs text-muted-foreground">
                          {busiestHourData.count} visit
                          {busiestHourData.count ===
                          1
                            ? ""
                            : "s"}{" "}
                          started during this hour
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </details>
          </section>

          {/* TODAY'S ATTENDANCE */}
          <section className="mt-10">
            <details
              className="group"
              open
            >
              <ExpandableSummary
                eyebrow="Daily Attendance"
                title="Today's Attendance"
                description="Every member visit recorded today."
                count={
                  todayAttendance.length
                }
                icon={
                  <Activity className="size-6" />
                }
              />

              <div className="mt-3">
                {loadingAttendance ? (
                  <div className="flex items-center justify-center border border-border bg-background py-16">
                    <div className="flex items-center gap-3 text-sm font-bold uppercase">
                      <Loader2 className="size-5 animate-spin" />
                      Loading today's attendance...
                    </div>
                  </div>
                ) : todayAttendance.length ===
                  0 ? (
                  <div className="border border-border bg-background p-8 text-center shadow-sm">
                    <Activity className="mx-auto size-8 text-muted-foreground" />

                    <h3 className="mt-4 font-display text-2xl font-bold uppercase">
                      No Attendance Today
                    </h3>

                    <p className="mt-2 text-sm text-muted-foreground">
                      No member check-ins have been recorded today.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-hidden border border-border bg-background shadow-sm">

                    <div className="hidden grid-cols-[1fr_130px_130px_120px] gap-4 border-b border-border bg-muted px-5 py-4 text-[10px] font-extrabold uppercase tracking-[0.12em] md:grid">
                      <div>Member</div>
                      <div>Check-In</div>
                      <div>Check-Out</div>
                      <div>Duration</div>
                    </div>

                    <div className="divide-y divide-border">
                      {todayAttendance.map(
                        (attendance) => {
                          const inside =
                            !attendance.checked_out_at;

                          return (
                            <div
                              key={
                                attendance.id
                              }
                              className="grid gap-4 px-5 py-5 md:grid-cols-[1fr_130px_130px_120px] md:items-center"
                            >
                              <div className="min-w-0">
                                <p className="font-bold uppercase">
                                  {attendance.member?.full_name ||
                                    "Member"}
                                </p>

                                {attendance.member?.phone && (
                                  <a
                                    href={`tel:${attendance.member.phone}`}
                                    className="mt-1 flex items-center gap-2 text-xs text-muted-foreground hover:text-primary"
                                  >
                                    <Phone className="size-3" />
                                    {
                                      attendance
                                        .member
                                        .phone
                                    }
                                  </a>
                                )}
                              </div>

                              <div>
                                <p className="text-sm font-bold">
                                  {formatTime(
                                    attendance.checked_in_at,
                                  )}
                                </p>

                                <p className="text-[10px] font-extrabold uppercase text-muted-foreground">
                                  Check-in
                                </p>
                              </div>

                              <div>
                                <p className="text-sm font-bold">
                                  {inside
                                    ? "Still inside"
                                    : formatTime(
                                        attendance.checked_out_at!,
                                      )}
                                </p>

                                <p
                                  className={`text-[10px] font-extrabold uppercase ${
                                    inside
                                      ? "text-primary"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  {inside
                                    ? "Currently inside"
                                    : "Check-out"}
                                </p>
                              </div>

                              <div>
                                <p className="text-sm font-bold">
                                  {formatDuration(
                                    attendance.checked_in_at,
                                    attendance.checked_out_at,
                                  )}
                                </p>

                                <p className="text-[10px] font-extrabold uppercase text-muted-foreground">
                                  Duration
                                </p>
                              </div>
                            </div>
                          );
                        },
                      )}
                    </div>
                  </div>
                )}
              </div>
            </details>
          </section>

          {/* CURRENTLY INSIDE */}
          <section className="mt-10">
            <details className="group">
              <ExpandableSummary
                eyebrow="Live Attendance"
                title="Currently Inside"
                description="Members who have checked in but have not checked out."
                count={
                  currentlyInside.length
                }
                icon={
                  <Users className="size-6" />
                }
              />

              <div className="mt-3">
                {currentlyInside.length ===
                0 ? (
                  <div className="border border-border bg-background p-8 text-center shadow-sm">
                    <LogIn className="mx-auto size-8 text-muted-foreground" />

                    <h3 className="mt-4 font-display text-2xl font-bold uppercase">
                      Nobody Is Currently Inside
                    </h3>

                    <p className="mt-2 text-sm text-muted-foreground">
                      Members will appear here after they scan in.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-hidden border border-border bg-background shadow-sm">
                    <div className="divide-y divide-border">
                      {currentlyInside.map(
                        (attendance) => (
                          <div
                            key={
                              attendance.id
                            }
                            className="grid gap-4 px-5 py-5 md:grid-cols-[1fr_130px_130px] md:items-center"
                          >
                            <div>
                              <p className="font-bold uppercase">
                                {attendance.member?.full_name ||
                                  "Member"}
                              </p>

                              {attendance.member?.phone && (
                                <a
                                  href={`tel:${attendance.member.phone}`}
                                  className="mt-1 flex items-center gap-2 text-xs text-muted-foreground hover:text-primary"
                                >
                                  <Phone className="size-3" />
                                  {
                                    attendance
                                      .member
                                      .phone
                                  }
                                </a>
                              )}
                            </div>

                            <div>
                              <p className="text-sm font-bold">
                                {formatTime(
                                  attendance.checked_in_at,
                                )}
                              </p>

                              <p className="text-[10px] font-extrabold uppercase text-muted-foreground">
                                Checked in
                              </p>
                            </div>

                            <div>
                              <p className="text-sm font-bold">
                                {formatDuration(
                                  attendance.checked_in_at,
                                  null,
                                )}
                              </p>

                              <p className="text-[10px] font-extrabold uppercase text-muted-foreground">
                                Current visit
                              </p>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}
              </div>
            </details>
          </section>

          {/* EXPIRING SOON */}
          <section className="mt-10">
            <details className="group">
              <ExpandableSummary
                eyebrow="Membership Alerts"
                title="Expiring Soon"
                description="Memberships expiring today or within the next 7 days."
                count={
                  expiringSoon.length
                }
                icon={
                  <Clock3 className="size-6" />
                }
              />

              <div className="mt-3">
                {expiringSoon.length ===
                0 ? (
                  <div className="border border-border bg-background p-8 text-center shadow-sm">
                    <CheckCircle2 className="mx-auto size-8 text-green-700" />

                    <h3 className="mt-4 font-display text-2xl font-bold uppercase">
                      No Expiring Memberships
                    </h3>

                    <p className="mt-2 text-sm text-muted-foreground">
                      No memberships are expiring within the next 7 days.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {expiringSoon.map(
                      (member) => {
                        const days =
                          getDaysUntilExpiry(
                            getDateOnly(
                              member.membership?.end_date,
                            ),
                          );

                        const whatsappUrl =
                          createWhatsAppRenewalUrl(
                            member,
                          );

                        return (
                          <div
                            key={
                              member.id
                            }
                            className="border border-border bg-background p-6 shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <h3 className="font-display text-2xl font-bold uppercase">
                                  {member.full_name ||
                                    "Member"}
                                </h3>

                                <p className="mt-1 text-sm text-muted-foreground">
                                  {member.membership?.plan_name ||
                                    "Membership"}
                                </p>
                              </div>

                              <span className="shrink-0 bg-primary/10 px-3 py-1 text-[10px] font-extrabold uppercase text-primary">
                                {days === 0
                                  ? "Expires today"
                                  : days === 1
                                    ? "1 day left"
                                    : `${days} days left`}
                              </span>
                            </div>

                            <div className="mt-5 grid gap-3 text-sm">
                              <div className="flex items-center gap-3">
                                <Clock3 className="size-4 text-primary" />

                                <span>
                                  Expires{" "}
                                  <strong>
                                    {getDateOnly(
                                      member.membership?.end_date,
                                    )}
                                  </strong>
                                </span>
                              </div>

                              {member.phone && (
                                <a
                                  href={`tel:${member.phone}`}
                                  className="flex items-center gap-3 hover:text-primary"
                                >
                                  <Phone className="size-4 text-primary" />

                                  <span>
                                    {member.phone}
                                  </span>
                                </a>
                              )}

                              {whatsappUrl ? (
                                <a
                                  href={
                                    whatsappUrl
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-2 inline-flex w-full items-center justify-center rounded-md bg-green-600 px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-white transition-opacity hover:opacity-90"
                                >
                                  <span className="mr-2 text-base">
                                    💬
                                  </span>

                                  Send WhatsApp Renewal Reminder
                                </a>
                              ) : (
                                <div className="mt-2 rounded-md bg-muted px-4 py-3 text-center text-[10px] font-extrabold uppercase text-muted-foreground">
                                  No phone number — WhatsApp unavailable
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                )}
              </div>
            </details>
          </section>

          {/* TODAY'S BIRTHDAYS */}
          <section className="mt-10">
            <details className="group">
              <ExpandableSummary
                eyebrow="Today"
                title="Today's Birthdays"
                description="Members celebrating their birthday today."
                count={
                  birthdaysToday.length
                }
                icon={
                  <Cake className="size-6" />
                }
              />

              <div className="mt-3">
                {birthdaysToday.length ===
                0 ? (
                  <div className="border border-border bg-background p-8 text-center shadow-sm">
                    <Cake className="mx-auto size-8 text-muted-foreground" />

                    <h3 className="mt-4 font-display text-2xl font-bold uppercase">
                      No Birthdays Today
                    </h3>

                    <p className="mt-2 text-sm text-muted-foreground">
                      There are no recorded member birthdays for today.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {birthdaysToday.map(
                      (member) => {
                        const active =
                          isMembershipActive(
                            member.membership,
                          );

                        const whatsappUrl =
                          createWhatsAppBirthdayUrl(
                            member,
                          );

                        return (
                          <div
                            key={
                              member.id
                            }
                            className="border border-primary/30 bg-background p-6 shadow-sm"
                          >
                            <div className="flex items-start gap-4">
                              <div className="flex size-12 shrink-0 items-center justify-center bg-primary text-primary-foreground">
                                <Cake className="size-6" />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                  <div>
                                    <h3 className="font-display text-2xl font-bold uppercase">
                                      {member.full_name ||
                                        "Member"}
                                    </h3>

                                    <p className="mt-1 text-sm font-bold text-primary">
                                      Birthday today 🎉
                                    </p>
                                  </div>

                                  <span
                                    className={`inline-flex w-fit items-center gap-1.5 px-2.5 py-1 text-[10px] font-extrabold uppercase ${
                                      active
                                        ? "bg-green-600/10 text-green-700"
                                        : "bg-destructive/10 text-destructive"
                                    }`}
                                  >
                                    {active ? (
                                      <CheckCircle2 className="size-3" />
                                    ) : (
                                      <XCircle className="size-3" />
                                    )}

                                    {active
                                      ? "Active"
                                      : "Expired"}
                                  </span>
                                </div>

                                <div className="mt-5 grid gap-3 text-sm">
                                  <div className="flex items-center gap-3">
                                    <Cake className="size-4 shrink-0 text-primary" />

                                    <span>
                                      {formatBirthday(
                                        member.birth_day,
                                        member.birth_month,
                                      )}
                                    </span>
                                  </div>

                                  {member.phone && (
                                    <a
                                      href={`tel:${member.phone}`}
                                      className="flex items-center gap-3 hover:text-primary"
                                    >
                                      <Phone className="size-4 shrink-0 text-primary" />

                                      <span>
                                        {member.phone}
                                      </span>
                                    </a>
                                  )}

                                  {member.membership?.plan_name && (
                                    <div className="flex items-center gap-3">
                                      <UserRound className="size-4 shrink-0 text-primary" />

                                      <span>
                                        {
                                          member
                                            .membership
                                            .plan_name
                                        }
                                      </span>
                                    </div>
                                  )}

                                  {whatsappUrl ? (
                                    <a
                                      href={
                                        whatsappUrl
                                      }
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="mt-2 inline-flex w-full items-center justify-center rounded-md bg-green-600 px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-white transition-opacity hover:opacity-90"
                                    >
                                      <span className="mr-2 text-base">
                                        💬
                                      </span>

                                      Send WhatsApp Birthday Message
                                    </a>
                                  ) : (
                                    <div className="mt-2 rounded-md bg-muted px-4 py-3 text-center text-[10px] font-extrabold uppercase text-muted-foreground">
                                      No phone number — WhatsApp unavailable
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                )}
              </div>
            </details>
          </section>

          {/* BIRTHDAYS THIS MONTH */}
          <section className="mt-10">
            <details className="group">
              <ExpandableSummary
                eyebrow={currentMonthName}
                title="Birthdays This Month"
                description={`All members celebrating their birthday in ${currentMonthName}, arranged by date.`}
                count={
                  birthdaysThisMonth.length
                }
                icon={
                  <Cake className="size-6" />
                }
              />

              <div className="mt-3">
                {birthdaysThisMonth.length ===
                0 ? (
                  <div className="border border-border bg-background p-8 text-center shadow-sm">
                    <Cake className="mx-auto size-8 text-muted-foreground" />

                    <h3 className="mt-4 font-display text-2xl font-bold uppercase">
                      No Birthdays This Month
                    </h3>

                    <p className="mt-2 text-sm text-muted-foreground">
                      No member birthdays have been recorded for{" "}
                      {currentMonthName}.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-hidden border border-border bg-background shadow-sm">
                    <div className="hidden grid-cols-[90px_1fr_150px_170px] gap-4 border-b border-border bg-muted px-5 py-4 text-[10px] font-extrabold uppercase tracking-[0.12em] md:grid">
                      <div>Date</div>
                      <div>Member</div>
                      <div>Membership</div>
                      <div>Phone</div>
                    </div>

                    <div className="divide-y divide-border">
                      {birthdaysThisMonth.map(
                        (member) => {
                          const active =
                            isMembershipActive(
                              member.membership,
                            );

                          const isToday =
                            member.birth_day ===
                              today.day;

                          return (
                            <div
                              key={
                                member.id
                              }
                              className={`grid gap-4 px-5 py-5 md:grid-cols-[90px_1fr_150px_170px] md:items-center ${
                                isToday
                                  ? "bg-primary/5"
                                  : "bg-background"
                              }`}
                            >
                              <div>
                                <div className="font-display text-2xl font-bold">
                                  {
                                    member.birth_day
                                  }
                                </div>

                                {isToday && (
                                  <span className="text-[10px] font-extrabold uppercase text-primary">
                                    Today
                                  </span>
                                )}
                              </div>

                              <div className="min-w-0">
                                <p className="font-bold uppercase">
                                  {member.full_name ||
                                    "Member"}
                                </p>

                                {member.email && (
                                  <p className="mt-1 truncate text-xs text-muted-foreground">
                                    {
                                      member.email
                                    }
                                  </p>
                                )}
                              </div>

                              <div>
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-extrabold uppercase ${
                                    active
                                      ? "bg-green-600/10 text-green-700"
                                      : "bg-destructive/10 text-destructive"
                                  }`}
                                >
                                  {active ? (
                                    <CheckCircle2 className="size-3" />
                                  ) : (
                                    <XCircle className="size-3" />
                                  )}

                                  {active
                                    ? "Active"
                                    : "Expired"}
                                </span>

                                {member.membership?.plan_name && (
                                  <p className="mt-2 text-xs text-muted-foreground">
                                    {
                                      member
                                        .membership
                                        .plan_name
                                    }
                                  </p>
                                )}
                              </div>

                              <div>
                                {member.phone ? (
                                  <a
                                    href={`tel:${member.phone}`}
                                    className="flex items-center gap-2 text-sm hover:text-primary"
                                  >
                                    <Phone className="size-4 shrink-0 text-primary" />

                                    <span>
                                      {
                                        member.phone
                                      }
                                    </span>
                                  </a>
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    No phone number
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        },
                      )}
                    </div>
                  </div>
                )}
              </div>
            </details>
          </section>

          {/* QUICK ACTIONS */}
          <section className="mt-10 grid gap-4 sm:grid-cols-2">
            <Link
              to="/reception-checkin"
              className="block"
            >
              <div className="border border-border bg-background p-6 shadow-sm transition-colors hover:border-primary">
                <div className="flex items-center gap-4">
                  <div className="flex size-12 items-center justify-center bg-primary text-primary-foreground">
                    <QrCode className="size-6" />
                  </div>

                  <div>
                    <h3 className="font-display text-2xl font-bold uppercase">
                      Reception Check-In
                    </h3>

                    <p className="mt-1 text-sm text-muted-foreground">
                      Scan member QR codes for check-in and check-out.
                    </p>
                  </div>
                </div>
              </div>
            </Link>

            <button
              type="button"
              onClick={refreshDashboard}
              className="text-left"
            >
              <div className="h-full border border-border bg-background p-6 shadow-sm transition-colors hover:border-primary">
                <div className="flex items-center gap-4">
                  <div className="flex size-12 items-center justify-center bg-primary text-primary-foreground">
                    <RefreshCw className="size-6" />
                  </div>

                  <div>
                    <h3 className="font-display text-2xl font-bold uppercase">
                      Refresh Dashboard
                    </h3>

                    <p className="mt-1 text-sm text-muted-foreground">
                      Refresh attendance, birthdays and membership alerts.
                    </p>
                  </div>
                </div>
              </div>
            </button>
          </section>

          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <UserRound className="size-4" />

            <span>
              Super Plus Fitness &amp; Spa — Reception
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
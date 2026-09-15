import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
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
  UserRound,
  Users,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

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

  const startDate = getDateOnly(membership.start_date);
  const endDate = getDateOnly(membership.end_date);

  if (!startDate || !endDate) return false;

  const today = getLocalDateString();

  return startDate <= today && today <= endDate;
}

function getDaysUntilExpiry(
  endDate: string | null,
) {
  if (!endDate) return null;

  const today = getLocalDateString();

  const start = new Date(`${today}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  const difference =
    end.getTime() - start.getTime();

  return Math.round(
    difference / (1000 * 60 * 60 * 24),
  );
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDuration(
  checkedInAt: string,
  checkedOutAt: string | null,
) {
  const end = checkedOutAt
    ? new Date(checkedOutAt)
    : new Date();

  const start = new Date(checkedInAt);

  const minutes = Math.max(
    0,
    Math.round(
      (end.getTime() - start.getTime()) / 60000,
    ),
  );

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m`;
  }

  return `${remainingMinutes}m`;
}

/* WhatsApp birthday message */
function createWhatsAppBirthdayUrl(
  member: Member,
) {
  if (!member.phone) return null;

  const phone = member.phone.replace(/\D/g, "");

  if (!phone) return null;

  let whatsappNumber = phone;

  if (phone.startsWith("0")) {
    whatsappNumber = `234${phone.slice(1)}`;
  } else if (phone.startsWith("234")) {
    whatsappNumber = phone;
  }

  const firstName =
    member.full_name?.trim().split(/\s+/)[0] ||
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

  const phone = member.phone.replace(/\D/g, "");

  if (!phone) return null;

  let whatsappNumber = phone;

  if (phone.startsWith("0")) {
    whatsappNumber = `234${phone.slice(1)}`;
  } else if (phone.startsWith("234")) {
    whatsappNumber = phone;
  }

  const firstName =
    member.full_name?.trim().split(/\s+/)[0] ||
    "Member";

  const expiryDate =
    getDateOnly(
      member.membership?.end_date,
    );

  if (!expiryDate) return null;

  const formattedExpiryDate =
    new Intl.DateTimeFormat("en-NG", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(
      new Date(`${expiryDate}T00:00:00`),
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

  const [members, setMembers] = useState<
    MemberWithMembership[]
  >([]);

  const [todayAttendance, setTodayAttendance] =
    useState<AttendanceWithMember[]>([]);

  const [loadingMembers, setLoadingMembers] =
    useState(false);

  const [loadingAttendance, setLoadingAttendance] =
    useState(false);

  const [loadError, setLoadError] =
    useState("");

  const [loggingOut, setLoggingOut] =
    useState(false);

  const [memberSearch, setMemberSearch] =
    useState("");

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
        .select("full_name, role, active")
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
        staff.full_name || "Reception",
      );

      setCheckingAccess(false);
    }

    checkStaffAccess();

    return () => {
      active = false;
    };
  }, []);

  async function loadAttendance() {
    setLoadingAttendance(true);

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
        .select("full_name, role, active")
        .eq(
          "auth_user_id",
          session.user.id,
        )
        .eq("active", true)
        .maybeSingle();

      if (staffError || !staff) {
        await supabase.auth.signOut();
        setStaffName("");
        return;
      }

      const { start, end } =
        getLocalDayRange();

      const {
        data: attendanceData,
        error: attendanceError,
      } = await supabase
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
          start,
        )
        .lt(
          "checked_in_at",
          end,
        )
        .order("checked_in_at", {
          ascending: false,
        });

      if (attendanceError) {
        throw new Error(
          attendanceError.message,
        );
      }

      const records: AttendanceWithMember[] =
        (attendanceData || []).map(
          (record: any) => ({
            id: record.id,
            member_id: record.member_id,
            checked_in_at:
              record.checked_in_at,
            checked_out_at:
              record.checked_out_at,
            member: record.members
              ? {
                  full_name:
                    record.members
                      .full_name || null,
                  phone:
                    record.members.phone ||
                    null,
                }
              : null,
          }),
        );

      setTodayAttendance(records);
    } catch (error) {
      console.error(
        "Reception attendance error:",
        error,
      );

      setLoadError(
        error instanceof Error
          ? error.message
          : "Unable to load today's attendance.",
      );
    } finally {
      setLoadingAttendance(false);
    }
  }

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
        .select("full_name, role, active")
        .eq(
          "auth_user_id",
          session.user.id,
        )
        .eq("active", true)
        .maybeSingle();

      if (staffError || !staff) {
        await supabase.auth.signOut();
        setStaffName("");
        return;
      }

      setStaffName(
        staff.full_name || "Reception",
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
        (memberData || []) as Member[];

      if (memberRows.length === 0) {
        setMembers([]);
        return;
      }

      const memberIds =
        memberRows.map(
          (member) => member.id,
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
        new Map<string, Membership>();

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

      const combined: MemberWithMembership[] =
        memberRows.map((member) => ({
          ...member,
          membership:
            latestMembershipByMember.get(
              member.id,
            ) || null,
        }));

      setMembers(combined);
    } catch (error) {
      console.error(
        "Reception dashboard error:",
        error,
      );

      setLoadError(
        error instanceof Error
          ? error.message
          : "Unable to load dashboard information.",
      );
    } finally {
      setLoadingMembers(false);
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
    setMemberSearch("");
    setLoggingOut(false);
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
        const dayA =
          a.birth_day || 0;

        const dayB =
          b.birth_day || 0;

        return dayA - dayB;
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
            member.membership
              ?.end_date,
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
              Staff login is required to access the reception
              dashboard.
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
              This area is restricted to authorized Super Plus
              Fitness staff.
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
                Welcome,{" "}
                <strong>
                  {staffName}
                </strong>
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
                onClick={
                  refreshDashboard
                }
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
                onClick={
                  handleLogout
                }
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
                  value={
                    memberSearch
                  }
                  onChange={(
                    event,
                  ) =>
                    setMemberSearch(
                      event.target
                        .value,
                    )
                  }
                  placeholder="Search member name, phone or email..."
                  className="h-13 w-full rounded-md border border-input bg-background pl-12 pr-4 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* NEW SEARCH RESULT DESIGN */}
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
                            key={
                              member.id
                            }
                            className="flex flex-col gap-4 bg-background p-5 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0">
                              <h3 className="font-display text-2xl font-bold uppercase">
                                {member.full_name ||
                                  "Member"}
                              </h3>
                            </div>

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
                {
                  currentlyInside.length
                }
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
                {
                  todayAttendance.length
                }
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                {
                  uniqueVisitorsToday
                }{" "}
                unique member
                {uniqueVisitorsToday ===
                1
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
                {
                  birthdaysToday.length
                }
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Birthday
                {birthdaysToday.length ===
                1
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
                {
                  expiringSoon.length
                }
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Memberships within 7 days
              </p>
            </div>
          </section>

          {/* CURRENTLY INSIDE */}
          <section className="mt-8">
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
                {loadingAttendance ? (
                  <div className="flex items-center justify-center border border-border bg-background py-16">
                    <div className="flex items-center gap-3 text-sm font-bold uppercase">
                      <Loader2 className="size-5 animate-spin" />
                      Loading attendance...
                    </div>
                  </div>
                ) : currentlyInside.length ===
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
                    <div className="hidden grid-cols-[1fr_130px_130px] gap-4 border-b border-border bg-muted px-5 py-4 text-[10px] font-extrabold uppercase tracking-[0.12em] md:grid">
                      <div>
                        Member
                      </div>

                      <div>
                        Check-In
                      </div>

                      <div>
                        Duration
                      </div>
                    </div>

                    <div className="divide-y divide-border">
                      {currentlyInside.map(
                        (
                          attendance,
                        ) => (
                          <div
                            key={
                              attendance.id
                            }
                            className="grid gap-4 px-5 py-5 md:grid-cols-[1fr_130px_130px] md:items-center"
                          >
                            <div className="min-w-0">
                              <p className="font-bold uppercase">
                                {attendance.member?.full_name ||
                                  "Member"}
                              </p>

                              {attendance.member
                                ?.phone && (
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
                      No memberships are expiring within the next
                      7 days.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {expiringSoon.map(
                      (member) => {
                        const days =
                          getDaysUntilExpiry(
                            getDateOnly(
                              member
                                .membership
                                ?.end_date,
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

                              <span
                                className={`shrink-0 px-3 py-1 text-[10px] font-extrabold uppercase ${
                                  days ===
                                  0
                                    ? "bg-destructive/10 text-destructive"
                                    : days !==
                                          null &&
                                        days <=
                                          3
                                      ? "bg-primary/10 text-primary"
                                      : "bg-muted text-foreground"
                                }`}
                              >
                                {days ===
                                0
                                  ? "Expires today"
                                  : days ===
                                      1
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
                                      member
                                        .membership
                                        ?.end_date,
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
                                    {
                                      member.phone
                                    }
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
                {loadingMembers ? (
                  <div className="flex items-center justify-center border border-border bg-background py-16">
                    <div className="flex items-center gap-3 text-sm font-bold uppercase">
                      <Loader2 className="size-5 animate-spin" />
                      Loading birthdays...
                    </div>
                  </div>
                ) : birthdaysToday.length ===
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
                                        {
                                          member.phone
                                        }
                                      </span>
                                    </a>
                                  )}

                                  {member.membership
                                    ?.plan_name && (
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
                eyebrow={
                  currentMonthName
                }
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
                {loadingMembers ? (
                  <div className="flex items-center justify-center border border-border bg-background py-16">
                    <div className="flex items-center gap-3 text-sm font-bold uppercase">
                      <Loader2 className="size-5 animate-spin" />
                      Loading birthdays...
                    </div>
                  </div>
                ) : birthdaysThisMonth.length ===
                  0 ? (
                  <div className="border border-border bg-background p-8 text-center shadow-sm">
                    <Cake className="mx-auto size-8 text-muted-foreground" />

                    <h3 className="mt-4 font-display text-2xl font-bold uppercase">
                      No Birthdays This Month
                    </h3>

                    <p className="mt-2 text-sm text-muted-foreground">
                      No member birthdays have been recorded for{" "}
                      {
                        currentMonthName
                      }.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-hidden border border-border bg-background shadow-sm">
                    <div className="hidden grid-cols-[90px_1fr_150px_170px] gap-4 border-b border-border bg-muted px-5 py-4 text-[10px] font-extrabold uppercase tracking-[0.12em] md:grid">
                      <div>
                        Date
                      </div>

                      <div>
                        Member
                      </div>

                      <div>
                        Membership
                      </div>

                      <div>
                        Phone
                      </div>
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

                                {member.membership
                                  ?.plan_name && (
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
                      Scan member QR codes for check-in and
                      check-out.
                    </p>
                  </div>
                </div>
              </div>
            </Link>

            <button
              type="button"
              onClick={
                refreshDashboard
              }
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
                      Refresh attendance, birthdays and
                      membership alerts.
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
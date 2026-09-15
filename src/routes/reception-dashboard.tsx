import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Cake,
  CheckCircle2,
  Clock3,
  Loader2,
  LogOut,
  Phone,
  QrCode,
  RefreshCw,
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

function getTodayParts() {
  const now = new Date();

  return {
    day: now.getDate(),
    month: now.getMonth() + 1,
  };
}

function getMonthName(month: number) {
  return new Intl.DateTimeFormat("en-NG", {
    month: "long",
  }).format(new Date(2026, month - 1, 1));
}

function formatBirthday(day: number | null, month: number | null) {
  if (!day || !month) return "Birthday not available";

  return `${day} ${getMonthName(month)}`;
}

function getDateOnly(value: unknown) {
  if (!value) return null;

  const stringValue = String(value).trim();

  if (!stringValue) return null;

  return stringValue.slice(0, 10);
}

function getLocalDateString() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isMembershipActive(membership: Membership | null) {
  if (!membership) return false;

  const startDate = getDateOnly(membership.start_date);
  const endDate = getDateOnly(membership.end_date);

  if (!startDate || !endDate) return false;

  const today = getLocalDateString();

  return startDate <= today && today <= endDate;
}

function getMembershipStatus(membership: Membership | null) {
  if (isMembershipActive(membership)) {
    return "Active";
  }

  return "Expired";
}

function ReceptionDashboardPage() {
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [staffName, setStaffName] = useState("");

  const [members, setMembers] = useState<MemberWithMembership[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [loggingOut, setLoggingOut] = useState(false);

  const today = useMemo(() => getTodayParts(), []);

  const currentMonthName = getMonthName(today.month);

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

      const { data: staff, error: staffError } = await supabase
        .from("staff_users")
        .select("full_name, role, active")
        .eq("auth_user_id", session.user.id)
        .eq("active", true)
        .maybeSingle();

      if (!active) return;

      if (staffError || !staff) {
        await supabase.auth.signOut();
        setCheckingAccess(false);
        return;
      }

      setStaffName(staff.full_name || "Reception");
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

      const { data: staff, error: staffError } = await supabase
        .from("staff_users")
        .select("full_name, role, active")
        .eq("auth_user_id", session.user.id)
        .eq("active", true)
        .maybeSingle();

      if (staffError || !staff) {
        await supabase.auth.signOut();
        setStaffName("");
        return;
      }

      setStaffName(staff.full_name || "Reception");

      const { data: memberData, error: membersError } =
        await supabase
          .from("members")
          .select(
            "id, full_name, email, phone, birth_day, birth_month",
          )
          .not("birth_day", "is", null)
          .not("birth_month", "is", null)
          .order("birth_month", {
            ascending: true,
          })
          .order("birth_day", {
            ascending: true,
          });

      if (membersError) {
        throw new Error(membersError.message);
      }

      const memberRows = (memberData || []) as Member[];

      if (memberRows.length === 0) {
        setMembers([]);
        return;
      }

      const memberIds = memberRows.map((member) => member.id);

      const { data: membershipData, error: membershipError } =
        await supabase
          .from("memberships")
          .select(
            "id, member_id, plan_name, start_date, end_date, status",
          )
          .in("member_id", memberIds)
          .order("end_date", {
            ascending: false,
          });

      if (membershipError) {
        throw new Error(membershipError.message);
      }

      const membershipRows =
        (membershipData || []) as Membership[];

      const latestMembershipByMember =
        new Map<string, Membership>();

      for (const membership of membershipRows) {
        if (!latestMembershipByMember.has(membership.member_id)) {
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
            latestMembershipByMember.get(member.id) || null,
        }));

      setMembers(combined);
    } catch (error) {
      console.error("Reception dashboard error:", error);

      setLoadError(
        error instanceof Error
          ? error.message
          : "Unable to load birthday information.",
      );
    } finally {
      setLoadingMembers(false);
    }
  }

  useEffect(() => {
    if (!checkingAccess && staffName) {
      loadMembers();
    }
  }, [checkingAccess, staffName]);

  async function handleLogout() {
    setLoggingOut(true);

    await supabase.auth.signOut();

    setStaffName("");
    setMembers([]);
    setLoggingOut(false);
  }

  const birthdaysToday = members.filter(
    (member) =>
      member.birth_day === today.day &&
      member.birth_month === today.month,
  );

  const birthdaysThisMonth = members
    .filter(
      (member) => member.birth_month === today.month,
    )
    .sort((a, b) => {
      const dayA = a.birth_day || 0;
      const dayB = b.birth_day || 0;

      return dayA - dayB;
    });

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
              <Button size="lg" className="w-full">
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
                Welcome, <strong>{staffName}</strong>
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
                onClick={loadMembers}
                disabled={loadingMembers}
                className="w-full sm:w-auto"
              >
                {loadingMembers ? (
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

          {/* SUMMARY CARDS */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="border border-border bg-background p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-extrabold uppercase tracking-[0.12em]">
                  Today's Birthdays
                </p>

                <div className="flex size-10 items-center justify-center bg-primary text-primary-foreground">
                  <Cake className="size-5" />
                </div>
              </div>

              <p className="mt-5 font-display text-4xl font-bold">
                {birthdaysToday.length}
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Birthday{birthdaysToday.length === 1 ? "" : "s"} today
              </p>
            </div>

            <div className="border border-border bg-background p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-extrabold uppercase tracking-[0.12em]">
                  This Month
                </p>

                <div className="flex size-10 items-center justify-center bg-primary text-primary-foreground">
                  <Cake className="size-5" />
                </div>
              </div>

              <p className="mt-5 font-display text-4xl font-bold">
                {birthdaysThisMonth.length}
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Birthdays in {currentMonthName}
              </p>
            </div>

            <div className="border border-border bg-background p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-extrabold uppercase tracking-[0.12em]">
                  Members With DOB
                </p>

                <div className="flex size-10 items-center justify-center bg-primary text-primary-foreground">
                  <Users className="size-5" />
                </div>
              </div>

              <p className="mt-5 font-display text-4xl font-bold">
                {members.length}
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Birthday records available
              </p>
            </div>

            <div className="border border-border bg-background p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-extrabold uppercase tracking-[0.12em]">
                  Current Date
                </p>

                <div className="flex size-10 items-center justify-center bg-primary text-primary-foreground">
                  <Clock3 className="size-5" />
                </div>
              </div>

              <p className="mt-5 font-display text-4xl font-bold">
                {today.day}
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                {currentMonthName}
              </p>
            </div>
          </section>

          {loadError && (
            <section className="mt-6 border border-destructive/30 bg-destructive/10 p-6">
              <div className="flex items-start gap-4">
                <XCircle className="mt-0.5 size-6 shrink-0 text-destructive" />

                <div>
                  <h2 className="font-bold uppercase text-destructive">
                    Dashboard Problem
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-destructive">
                    {loadError}
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* TODAY'S BIRTHDAYS */}
          <section className="mt-8">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
                  Today
                </p>

                <h2 className="font-display text-3xl font-bold uppercase sm:text-4xl">
                  Today's Birthdays
                </h2>

                <p className="mt-2 text-sm text-muted-foreground">
                  Members celebrating their birthday today.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs font-extrabold uppercase">
                <Cake className="size-4 text-primary" />
                {birthdaysToday.length} member
                {birthdaysToday.length === 1 ? "" : "s"}
              </div>
            </div>

            {loadingMembers ? (
              <div className="flex items-center justify-center border border-border bg-background py-16">
                <div className="flex items-center gap-3 text-sm font-bold uppercase">
                  <Loader2 className="size-5 animate-spin" />
                  Loading birthdays...
                </div>
              </div>
            ) : birthdaysToday.length === 0 ? (
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
                {birthdaysToday.map((member) => {
                  const active = isMembershipActive(
                    member.membership,
                  );

                  return (
                    <div
                      key={member.id}
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
                                <span>{member.phone}</span>
                              </a>
                            )}

                            {member.membership?.plan_name && (
                              <div className="flex items-center gap-3">
                                <UserRound className="size-4 shrink-0 text-primary" />
                                <span>
                                  {
                                    member.membership
                                      .plan_name
                                  }
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* THIS MONTH */}
          <section className="mt-10">
            <div className="mb-5">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
                {currentMonthName}
              </p>

              <h2 className="font-display text-3xl font-bold uppercase sm:text-4xl">
                Birthdays This Month
              </h2>

              <p className="mt-2 text-sm text-muted-foreground">
                All members celebrating their birthday in{" "}
                {currentMonthName}, arranged by date.
              </p>
            </div>

            {loadingMembers ? (
              <div className="flex items-center justify-center border border-border bg-background py-16">
                <div className="flex items-center gap-3 text-sm font-bold uppercase">
                  <Loader2 className="size-5 animate-spin" />
                  Loading birthdays...
                </div>
              </div>
            ) : birthdaysThisMonth.length === 0 ? (
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
                  {birthdaysThisMonth.map((member) => {
                    const active = isMembershipActive(
                      member.membership,
                    );

                    const isToday =
                      member.birth_day === today.day;

                    return (
                      <div
                        key={member.id}
                        className={`grid gap-4 px-5 py-5 md:grid-cols-[90px_1fr_150px_170px] md:items-center ${
                          isToday
                            ? "bg-primary/5"
                            : "bg-background"
                        }`}
                      >
                        <div>
                          <div className="font-display text-2xl font-bold">
                            {member.birth_day}
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
                              {member.email}
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
                                member.membership
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
                                {member.phone}
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
                  })}
                </div>
              </div>
            )}
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
              onClick={loadMembers}
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
                      Refresh member birthday information.
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
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Clock3,
  LogIn,
  LogOut,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Users,
  UserRound,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/reception-dashboard")({
  head: () => ({
    meta: [
      { title: "Attendance Dashboard — Super Plus Fitness" },
      {
        name: "description",
        content: "Super Plus Fitness reception attendance dashboard.",
      },
    ],
  }),
  component: ReceptionDashboardPage,
});

type AttendanceRow = {
  id: string;
  member_id: string;
  checked_in_at: string;
  checked_out_at: string | null;
  checked_by: string | null;
};

type Member = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
};

type Membership = {
  id: string;
  member_id: string;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  plan_name?: string | null;
  name?: string | null;
  plan?: string | null;
};

type AttendanceDisplay = AttendanceRow & {
  member: Member;
  membership: Membership | null;
};

function ReceptionDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [staffName, setStaffName] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [rows, setRows] = useState<AttendanceDisplay[]>([]);
  const [error, setError] = useState("");

  async function loadDashboard(showRefresh = false) {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setAuthorized(false);
        setLoading(false);
        setRefreshing(false);
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
        setAuthorized(false);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      setAuthorized(true);
      setStaffName(staff.full_name || "Reception");

      const { data: attendance, error: attendanceError } =
        await supabase
          .from("attendance")
          .select(
            "id, member_id, checked_in_at, checked_out_at, checked_by",
          )
          .order("checked_in_at", { ascending: false })
          .limit(100);

      if (attendanceError) {
        throw new Error(attendanceError.message);
      }

      const attendanceRows = (attendance || []) as AttendanceRow[];

      if (attendanceRows.length === 0) {
        setRows([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const memberIds = [
        ...new Set(attendanceRows.map((row) => row.member_id)),
      ];

      const { data: members, error: membersError } = await supabase
        .from("members")
        .select("id, full_name, email, phone")
        .in("id", memberIds);

      if (membersError) {
        throw new Error(membersError.message);
      }

      const { data: memberships, error: membershipsError } =
        await supabase
          .from("memberships")
          .select("*")
          .in("member_id", memberIds)
          .order("created_at", { ascending: false });

      if (membershipsError) {
        throw new Error(membershipsError.message);
      }

      const memberMap = new Map<string, Member>();

      for (const member of (members || []) as Member[]) {
        memberMap.set(member.id, member);
      }

      const membershipMap = new Map<string, Membership>();

      for (const membership of (memberships || []) as Membership[]) {
        if (!membershipMap.has(membership.member_id)) {
          membershipMap.set(membership.member_id, membership);
        }
      }

      const displayRows: AttendanceDisplay[] = attendanceRows
        .map((attendanceRow) => {
          const member = memberMap.get(attendanceRow.member_id);

          if (!member) {
            return null;
          }

          return {
            ...attendanceRow,
            member,
            membership:
              membershipMap.get(attendanceRow.member_id) || null,
          };
        })
        .filter(
          (row): row is AttendanceDisplay => row !== null,
        );

      setRows(displayRows);
    } catch (dashboardError) {
      console.error("Dashboard error:", dashboardError);

      setError(
        dashboardError instanceof Error
          ? dashboardError.message
          : "Unable to load the attendance dashboard.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    setAuthorized(false);
    setStaffName("");
  }

  function formatTime(value: string) {
    return new Date(value).toLocaleTimeString("en-NG", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatDate(value: string) {
    return new Date(value).toLocaleDateString("en-NG", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function getPlanName(membership: Membership | null) {
    if (!membership) return "Membership";

    return (
      membership.plan_name ||
      membership.name ||
      membership.plan ||
      "Membership"
    );
  }

  const today = new Date();

  const todayRows = rows.filter((row) => {
    const date = new Date(row.checked_in_at);

    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  });

  const insideRows = rows.filter(
    (row) => row.checked_out_at === null,
  );

  const checkedOutToday = todayRows.filter(
    (row) => row.checked_out_at !== null,
  );

  if (loading) {
    return (
      <main className="min-h-[75vh] bg-muted py-20">
        <div className="section-shell flex min-h-[50vh] items-center justify-center">
          <div className="flex items-center gap-3 text-sm font-bold uppercase">
            <Loader2 className="size-5 animate-spin" />
            Loading attendance dashboard...
          </div>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="min-h-[75vh] bg-muted py-16 sm:py-24">
        <div className="section-shell flex min-h-[60vh] items-center justify-center">
          <div className="w-full max-w-md border border-border bg-background p-8 text-center shadow-sm">
            <ShieldCheck className="mx-auto size-12 text-primary" />

            <h1 className="display-title mt-6 text-4xl">
              Reception Access
            </h1>

            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              You must be logged in as an authorized Super Plus Fitness
              staff member to view attendance.
            </p>

            <Link
              to="/reception-checkin"
              className="mt-7 block"
            >
              <Button className="w-full">
                Go to Reception Login
              </Button>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[75vh] bg-muted py-10 sm:py-16">
      <div className="section-shell">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Link
                to="/reception-checkin"
                className="mb-5 inline-flex items-center gap-2 text-sm font-bold uppercase text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-4" />
                Reception Scanner
              </Link>

              <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
                Super Plus Fitness
              </p>

              <h1 className="display-title text-4xl sm:text-6xl">
                Attendance Dashboard
              </h1>

              <p className="mt-3 text-sm text-muted-foreground">
                Logged in as <strong>{staffName}</strong>
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                variant="outline"
                onClick={() => loadDashboard(true)}
                disabled={refreshing}
              >
                {refreshing ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <RefreshCw />
                )}
                Refresh
              </Button>

              <Button
                variant="outline"
                onClick={handleLogout}
              >
                Log Out
              </Button>
            </div>
          </div>

          {error && (
            <section className="mb-6 border border-destructive/30 bg-destructive/10 p-6">
              <div className="flex items-start gap-4">
                <XCircle className="mt-0.5 size-6 shrink-0 text-destructive" />

                <div>
                  <h2 className="font-bold uppercase text-destructive">
                    Dashboard Problem
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-destructive">
                    {error}
                  </p>
                </div>
              </div>
            </section>
          )}

          <section className="grid gap-4 sm:grid-cols-3">
            <div className="border border-border bg-background p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex size-11 items-center justify-center bg-primary text-primary-foreground">
                  <Users className="size-6" />
                </div>

                <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                  Now
                </span>
              </div>

              <p className="mt-6 font-display text-5xl font-bold">
                {insideRows.length}
              </p>

              <p className="mt-2 text-xs font-extrabold uppercase tracking-wider">
                Members Inside
              </p>
            </div>

            <div className="border border-border bg-background p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex size-11 items-center justify-center bg-primary text-primary-foreground">
                  <LogIn className="size-6" />
                </div>

                <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                  Today
                </span>
              </div>

              <p className="mt-6 font-display text-5xl font-bold">
                {todayRows.length}
              </p>

              <p className="mt-2 text-xs font-extrabold uppercase tracking-wider">
                Today's Check-Ins
              </p>
            </div>

            <div className="border border-border bg-background p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex size-11 items-center justify-center bg-primary text-primary-foreground">
                  <LogOut className="size-6" />
                </div>

                <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                  Today
                </span>
              </div>

              <p className="mt-6 font-display text-5xl font-bold">
                {checkedOutToday.length}
              </p>

              <p className="mt-2 text-xs font-extrabold uppercase tracking-wider">
                Today's Check-Outs
              </p>
            </div>
          </section>

          <section className="mt-8 border border-border bg-background shadow-sm">
            <div className="flex flex-col gap-4 border-b border-border p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center bg-primary text-primary-foreground">
                    <Users className="size-5" />
                  </div>

                  <h2 className="font-display text-2xl font-bold uppercase">
                    Who's Inside Now
                  </h2>
                </div>

                <p className="mt-2 text-sm text-muted-foreground">
                  Members who have checked in but have not checked out.
                </p>
              </div>

              <span className="w-fit border border-primary/20 bg-primary/5 px-4 py-2 text-xs font-extrabold uppercase tracking-wider">
                {insideRows.length} Inside
              </span>
            </div>

            {insideRows.length === 0 ? (
              <div className="p-10 text-center">
                <UserRound className="mx-auto size-10 text-muted-foreground" />

                <h3 className="mt-4 font-display text-2xl font-bold uppercase">
                  Nobody Inside
                </h3>

                <p className="mt-2 text-sm text-muted-foreground">
                  No members are currently checked in.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {insideRows.map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="flex size-11 shrink-0 items-center justify-center bg-primary/10">
                        <UserRound className="size-5 text-primary" />
                      </div>

                      <div className="min-w-0">
                        <h3 className="truncate font-bold uppercase">
                          {row.member.full_name || "Member"}
                        </h3>

                        <p className="mt-1 text-xs text-muted-foreground">
                          {getPlanName(row.membership)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <Clock3 className="size-4 text-primary" />
                      <span className="font-bold">
                        In since {formatTime(row.checked_in_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="mt-8 border border-border bg-background shadow-sm">
            <div className="border-b border-border p-6">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center bg-primary text-primary-foreground">
                  <Clock3 className="size-5" />
                </div>

                <div>
                  <h2 className="font-display text-2xl font-bold uppercase">
                    Attendance History
                  </h2>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Latest 100 attendance records.
                  </p>
                </div>
              </div>
            </div>

            {rows.length === 0 ? (
              <div className="p-10 text-center">
                <Clock3 className="mx-auto size-10 text-muted-foreground" />

                <h3 className="mt-4 font-display text-2xl font-bold uppercase">
                  No Attendance Yet
                </h3>

                <p className="mt-2 text-sm text-muted-foreground">
                  Attendance records will appear here after members scan in.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted text-left">
                      <th className="px-5 py-4 text-xs font-extrabold uppercase tracking-wider">
                        Member
                      </th>

                      <th className="px-5 py-4 text-xs font-extrabold uppercase tracking-wider">
                        Plan
                      </th>

                      <th className="px-5 py-4 text-xs font-extrabold uppercase tracking-wider">
                        Date
                      </th>

                      <th className="px-5 py-4 text-xs font-extrabold uppercase tracking-wider">
                        Check-In
                      </th>

                      <th className="px-5 py-4 text-xs font-extrabold uppercase tracking-wider">
                        Check-Out
                      </th>

                      <th className="px-5 py-4 text-xs font-extrabold uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-border last:border-0"
                      >
                        <td className="px-5 py-5">
                          <p className="font-bold uppercase">
                            {row.member.full_name || "Member"}
                          </p>

                          {row.member.phone && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {row.member.phone}
                            </p>
                          )}
                        </td>

                        <td className="px-5 py-5 text-sm">
                          {getPlanName(row.membership)}
                        </td>

                        <td className="px-5 py-5 text-sm">
                          {formatDate(row.checked_in_at)}
                        </td>

                        <td className="px-5 py-5 text-sm font-bold">
                          {formatTime(row.checked_in_at)}
                        </td>

                        <td className="px-5 py-5 text-sm font-bold">
                          {row.checked_out_at
                            ? formatTime(row.checked_out_at)
                            : "—"}
                        </td>

                        <td className="px-5 py-5">
                          {row.checked_out_at ? (
                            <span className="inline-flex items-center gap-2 border border-border bg-muted px-3 py-2 text-xs font-extrabold uppercase">
                              <LogOut className="size-3.5" />
                              Out
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-2 border border-green-600/20 bg-green-600/10 px-3 py-2 text-xs font-extrabold uppercase text-green-700">
                              <LogIn className="size-3.5" />
                              Inside
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/reception-checkin" className="flex-1">
              <Button className="w-full" size="lg">
                <QrCodeIcon />
                Scan Member QR
              </Button>
            </Link>

            <Button
              variant="outline"
              size="lg"
              className="flex-1"
              onClick={() => loadDashboard(true)}
              disabled={refreshing}
            >
              {refreshing ? (
                <Loader2 className="animate-spin" />
              ) : (
                <RefreshCw />
              )}
              Refresh Attendance
            </Button>
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-4" />
            <span>
              Super Plus Fitness &amp; Spa — Authorized Reception
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}

function QrCodeIcon() {
  return <LogIn className="size-5" />;
}
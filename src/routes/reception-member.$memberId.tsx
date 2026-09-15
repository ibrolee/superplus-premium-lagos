import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Cake,
  CheckCircle2,
  ChevronDown,
  Clock3,
  CreditCard,
  Download,
  Loader2,
  LogIn,
  LogOut,
  Mail,
  Phone,
  QrCode,
  UserRound,
  XCircle,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute(
  "/reception-member/$memberId",
)({
  head: () => ({
    meta: [
      {
        title:
          "Member Profile — Super Plus Fitness",
      },
      {
        name: "description",
        content:
          "Staff member profile for Super Plus Fitness reception.",
      },
    ],
  }),
  component: ReceptionMemberProfilePage,
});

type Member = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  birth_day: number | null;
  birth_month: number | null;
  qr_token: string | null;
};

type Membership = {
  id: string;
  member_id: string;
  plan_name: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  payment_status: string | null;
  source: string | null;
  created_at: string | null;
};

type Payment = {
  id: string;
  member_id: string | null;
  membership_id: string | null;
  amount: number;
  currency: string;
  status: string;
  payment_method: string | null;
  provider: string | null;
  paystack_reference: string | null;
  paid_at: string | null;
  created_at: string;
};

type AttendanceRecord = {
  id: string;
  member_id: string;
  checked_in_at: string;
  checked_out_at: string | null;
  created_at: string | null;
};

function getLocalDateString(
  date = new Date(),
) {
  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1,
  ).padStart(2, "0");
  const day = String(
    date.getDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDateOnly(value: unknown) {
  if (!value) return null;

  const stringValue = String(value).trim();

  if (!stringValue) return null;

  return stringValue.slice(0, 10);
}

function formatDate(value: string | null) {
  const date = getDateOnly(value);

  if (!date) return "Not available";

  const parsed = new Date(
    `${date}T00:00:00`,
  );

  return new Intl.DateTimeFormat(
    "en-NG",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    },
  ).format(parsed);
}

function formatDateTime(
  value: string | null,
) {
  if (!value) return "Not available";

  return new Intl.DateTimeFormat(
    "en-NG",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    },
  ).format(new Date(value));
}

function formatAmount(
  amount: number,
  currency = "NGN",
) {
  if (currency === "NGN") {
    return `₦${Number(
      amount || 0,
    ).toLocaleString("en-NG")}`;
  }

  return `${currency} ${Number(
    amount || 0,
  ).toLocaleString()}`;
}

function getMonthName(month: number) {
  return new Intl.DateTimeFormat(
    "en-NG",
    {
      month: "long",
    },
  ).format(
    new Date(2026, month - 1, 1),
  );
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

  if (!startDate || !endDate) {
    return false;
  }

  const today =
    getLocalDateString();

  return (
    startDate <= today &&
    today <= endDate
  );
}

function getDaysRemaining(
  endDate: string | null,
) {
  const date = getDateOnly(endDate);

  if (!date) return null;

  const today =
    getLocalDateString();

  const start = new Date(
    `${today}T00:00:00`,
  );

  const end = new Date(
    `${date}T00:00:00`,
  );

  return Math.round(
    (end.getTime() -
      start.getTime()) /
      (1000 * 60 * 60 * 24),
  );
}

function formatAttendanceDuration(
  checkedInAt: string,
  checkedOutAt: string | null,
) {
  const start = new Date(
    checkedInAt,
  );

  const end = checkedOutAt
    ? new Date(checkedOutAt)
    : new Date();

  const minutes = Math.max(
    0,
    Math.round(
      (end.getTime() -
        start.getTime()) /
        60000,
    ),
  );

  const hours = Math.floor(
    minutes / 60,
  );

  const remainingMinutes =
    minutes % 60;

  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m`;
  }

  return `${remainingMinutes}m`;
}

function SectionSummary({
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
  icon: React.ReactNode;
}) {
  return (
    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 border border-border bg-background p-5 shadow-sm [&::-webkit-details-marker]:hidden sm:p-6">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
            {eyebrow}
          </p>

          {typeof count ===
            "number" && (
            <span className="bg-muted px-2 py-1 text-[10px] font-extrabold uppercase">
              {count}
            </span>
          )}
        </div>

        <h2 className="mt-2 font-display text-2xl font-bold uppercase sm:text-3xl">
          {title}
        </h2>

        <p className="mt-2 text-sm text-muted-foreground">
          {description}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <div className="flex size-11 items-center justify-center bg-primary text-primary-foreground">
          {icon}
        </div>

        <ChevronDown className="size-5 text-primary transition-transform group-open:rotate-180" />
      </div>
    </summary>
  );
}

function ReceptionMemberProfilePage() {
  const { memberId } =
    Route.useParams();

  const [checkingAccess, setCheckingAccess] =
    useState(true);

  const [staffName, setStaffName] =
    useState("");

  const [member, setMember] =
    useState<Member | null>(null);

  const [memberships, setMemberships] =
    useState<Membership[]>([]);

  const [payments, setPayments] =
    useState<Payment[]>([]);

  const [attendance, setAttendance] =
    useState<AttendanceRecord[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      setCheckingAccess(true);
      setLoading(true);
      setError("");

      try {
        const {
          data: { session },
        } =
          await supabase.auth.getSession();

        if (!session) {
          if (active) {
            setCheckingAccess(false);
            setLoading(false);
          }

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

          if (active) {
            setCheckingAccess(false);
            setLoading(false);
          }

          return;
        }

        if (!active) return;

        setStaffName(
          staff.full_name ||
            "Reception",
        );

        setCheckingAccess(false);

        const [
          memberResult,
          membershipsResult,
          paymentsResult,
          attendanceResult,
        ] = await Promise.all([
          supabase
            .from("members")
            .select(
              "id, full_name, email, phone, birth_day, birth_month, qr_token",
            )
            .eq("id", memberId)
            .maybeSingle(),

          supabase
            .from("memberships")
            .select(
              "id, member_id, plan_name, start_date, end_date, status, payment_status, source, created_at",
            )
            .eq(
              "member_id",
              memberId,
            )
            .order("start_date", {
              ascending: false,
            }),

          supabase
            .from("payments")
            .select(
              "id, member_id, membership_id, amount, currency, status, payment_method, provider, paystack_reference, paid_at, created_at",
            )
            .eq(
              "member_id",
              memberId,
            )
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("attendance")
            .select(
              "id, member_id, checked_in_at, checked_out_at, created_at",
            )
            .eq(
              "member_id",
              memberId,
            )
            .order(
              "checked_in_at",
              {
                ascending: false,
              },
            ),
        ]);

        if (
          memberResult.error
        ) {
          throw new Error(
            memberResult.error.message,
          );
        }

        if (
          membershipsResult.error
        ) {
          throw new Error(
            membershipsResult.error.message,
          );
        }

        if (
          paymentsResult.error
        ) {
          throw new Error(
            paymentsResult.error.message,
          );
        }

        if (
          attendanceResult.error
        ) {
          throw new Error(
            attendanceResult.error.message,
          );
        }

        if (!memberResult.data) {
          throw new Error(
            "Member could not be found.",
          );
        }

        if (!active) return;

        setMember(
          memberResult.data as Member,
        );

        setMemberships(
          (membershipsResult.data ||
            []) as Membership[],
        );

        setPayments(
          (paymentsResult.data ||
            []) as Payment[],
        );

        setAttendance(
          (attendanceResult.data ||
            []) as AttendanceRecord[],
        );
      } catch (loadError) {
        console.error(
          "Reception member profile error:",
          loadError,
        );

        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load member profile.",
          );
        }
      } finally {
        if (active) {
          setCheckingAccess(false);
          setLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, [memberId]);

  const currentMembership =
    useMemo(() => {
      const activeMemberships =
        memberships.filter(
          isMembershipActive,
        );

      if (
        activeMemberships.length ===
        0
      ) {
        return null;
      }

      return (
        activeMemberships.sort(
          (a, b) => {
            const aEnd =
              getDateOnly(
                a.end_date,
              ) || "";

            const bEnd =
              getDateOnly(
                b.end_date,
              ) || "";

            return bEnd.localeCompare(
              aEnd,
            );
          },
        )[0] || null
      );
    }, [memberships]);

  const latestMembership =
    memberships[0] || null;

  const isCurrentlyInside =
    attendance.some(
      (record) =>
        !record.checked_out_at,
    );

  const daysRemaining =
    getDaysRemaining(
      currentMembership?.end_date ||
        null,
    );

  const totalPaid =
    payments.reduce(
      (total, payment) =>
        payment.status.toLowerCase() ===
        "success"
          ? total +
            Number(payment.amount || 0)
          : total,
      0,
    );

  function downloadQrCode() {
    const svg =
      document.getElementById(
        "member-profile-qr",
      ) as SVGElement | null;

    if (!svg) return;

    const serializer =
      new XMLSerializer();

    const svgString =
      serializer.serializeToString(
        svg,
      );

    const svgBlob = new Blob(
      [svgString],
      {
        type: "image/svg+xml;charset=utf-8",
      },
    );

    const url =
      URL.createObjectURL(
        svgBlob,
      );

    const image =
      new Image();

    image.onload = () => {
      const canvas =
        document.createElement(
          "canvas",
        );

      canvas.width = 800;
      canvas.height = 800;

      const context =
        canvas.getContext("2d");

      if (!context) {
        URL.revokeObjectURL(url);
        return;
      }

      context.fillStyle =
        "#ffffff";

      context.fillRect(
        0,
        0,
        canvas.width,
        canvas.height,
      );

      context.drawImage(
        image,
        50,
        50,
        700,
        700,
      );

      const downloadUrl =
        canvas.toDataURL(
          "image/png",
        );

      const link =
        document.createElement(
          "a",
        );

      link.href = downloadUrl;

      link.download =
        `${
          member?.full_name
            ?.replace(
              /\s+/g,
              "-",
            )
            .toLowerCase() ||
          "member"
        }-qr-code.png`;

      link.click();

      URL.revokeObjectURL(url);
    };

    image.src = url;
  }

  if (
    checkingAccess ||
    loading
  ) {
    return (
      <main className="min-h-[75vh] bg-muted py-20">
        <div className="section-shell flex min-h-[50vh] items-center justify-center">
          <div className="flex items-center gap-3 text-sm font-bold uppercase">
            <Loader2 className="size-5 animate-spin" />
            Loading member profile...
          </div>
        </div>
      </main>
    );
  }

  if (!staffName) {
    return (
      <main className="min-h-[75vh] bg-muted py-20">
        <div className="section-shell flex min-h-[50vh] items-center justify-center">
          <div className="max-w-md border border-border bg-background p-8 text-center">
            <XCircle className="mx-auto size-8 text-destructive" />

            <h1 className="mt-4 font-display text-3xl font-bold uppercase">
              Staff Access Required
            </h1>

            <Link
              to="/reception-checkin"
              className="mt-6 inline-block"
            >
              <Button>
                Go To Reception Login
              </Button>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (error || !member) {
    return (
      <main className="min-h-[75vh] bg-muted py-16">
        <div className="section-shell">
          <Link
            to="/reception-dashboard"
            className="inline-flex items-center gap-2 text-sm font-bold uppercase text-primary"
          >
            <ArrowLeft className="size-4" />
            Back To Dashboard
          </Link>

          <div className="mx-auto mt-8 max-w-2xl border border-destructive/30 bg-background p-8 text-center">
            <XCircle className="mx-auto size-8 text-destructive" />

            <h1 className="mt-4 font-display text-3xl font-bold uppercase">
              Unable To Load Member
            </h1>

            <p className="mt-3 text-sm text-muted-foreground">
              {error ||
                "Member profile is unavailable."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  const statusActive =
    Boolean(currentMembership);

  return (
    <main className="min-h-[75vh] bg-muted py-10 sm:py-16">
      <div className="section-shell">
        <div className="mx-auto max-w-5xl">

          {/* BACK */}
          <Link
            to="/reception-dashboard"
            className="inline-flex items-center gap-2 text-sm font-extrabold uppercase text-primary hover:opacity-80"
          >
            <ArrowLeft className="size-4" />
            Back To Reception Dashboard
          </Link>

          {/* HEADER */}
          <header className="mt-6 border border-border bg-background p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
                  Member Profile
                </p>

                <h1 className="mt-2 break-words font-display text-4xl font-bold uppercase sm:text-6xl">
                  {member.full_name ||
                    "Member"}
                </h1>

                <p className="mt-2 text-xs text-muted-foreground">
                  Reception:{" "}
                  {staffName}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span
                  className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-extrabold uppercase ${
                    statusActive
                      ? "bg-green-600/10 text-green-700"
                      : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {statusActive ? (
                    <CheckCircle2 className="size-4" />
                  ) : (
                    <XCircle className="size-4" />
                  )}

                  {statusActive
                    ? "Active"
                    : "Expired"}
                </span>

                {isCurrentlyInside && (
                  <span className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 text-xs font-extrabold uppercase text-primary">
                    <LogIn className="size-4" />
                    Inside
                  </span>
                )}
              </div>
            </div>
          </header>

          {/* PERSONAL INFORMATION */}
          <section className="mt-6">
            <details className="group">
              <SectionSummary
                eyebrow="Member"
                title="Personal Information"
                description="Basic contact and birthday information."
                icon={
                  <UserRound className="size-5" />
                }
              />

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="border border-border bg-background p-5">
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
                    Full Name
                  </span>

                  <p className="mt-2 font-bold">
                    {member.full_name ||
                      "Not available"}
                  </p>
                </div>

                <div className="border border-border bg-background p-5">
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
                    Birthday
                  </span>

                  <p className="mt-2 flex items-center gap-2 font-bold">
                    <Cake className="size-4 text-primary" />

                    {formatBirthday(
                      member.birth_day,
                      member.birth_month,
                    )}
                  </p>
                </div>

                <div className="border border-border bg-background p-5">
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
                    Phone
                  </span>

                  {member.phone ? (
                    <a
                      href={`tel:${member.phone}`}
                      className="mt-2 flex items-center gap-2 font-bold hover:text-primary"
                    >
                      <Phone className="size-4 text-primary" />
                      {member.phone}
                    </a>
                  ) : (
                    <p className="mt-2 font-bold text-muted-foreground">
                      Not available
                    </p>
                  )}
                </div>

                <div className="border border-border bg-background p-5">
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
                    Email
                  </span>

                  {member.email ? (
                    <a
                      href={`mailto:${member.email}`}
                      className="mt-2 flex items-center gap-2 break-all font-bold hover:text-primary"
                    >
                      <Mail className="size-4 shrink-0 text-primary" />
                      {member.email}
                    </a>
                  ) : (
                    <p className="mt-2 font-bold text-muted-foreground">
                      Not available
                    </p>
                  )}
                </div>
              </div>
            </details>
          </section>

          {/* CURRENT MEMBERSHIP */}
          <section className="mt-6">
            <details
              className="group"
              open
            >
              <SectionSummary
                eyebrow="Membership"
                title="Current Membership"
                description="The member's currently valid membership."
                icon={
                  <CreditCard className="size-5" />
                }
              />

              <div className="mt-3">
                {!currentMembership ? (
                  <div className="border border-border bg-background p-8 text-center">
                    <XCircle className="mx-auto size-8 text-destructive" />

                    <h3 className="mt-4 font-display text-2xl font-bold uppercase">
                      No Active Membership
                    </h3>

                    <p className="mt-2 text-sm text-muted-foreground">
                      This member currently has no valid active membership.
                    </p>
                  </div>
                ) : (
                  <div className="border border-border bg-background p-6 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-primary">
                          Current Plan
                        </p>

                        <h3 className="mt-2 font-display text-3xl font-bold uppercase">
                          {currentMembership.plan_name ||
                            "Membership"}
                        </h3>
                      </div>

                      <span className="inline-flex w-fit items-center gap-2 bg-green-600/10 px-4 py-2 text-xs font-extrabold uppercase text-green-700">
                        <CheckCircle2 className="size-4" />
                        Active
                      </span>
                    </div>

                    <div className="mt-6 grid gap-4 sm:grid-cols-3">
                      <div className="border border-border p-4">
                        <span className="text-[10px] font-extrabold uppercase text-muted-foreground">
                          Start Date
                        </span>

                        <p className="mt-2 font-bold">
                          {formatDate(
                            currentMembership.start_date,
                          )}
                        </p>
                      </div>

                      <div className="border border-border p-4">
                        <span className="text-[10px] font-extrabold uppercase text-muted-foreground">
                          Expiry Date
                        </span>

                        <p className="mt-2 font-bold">
                          {formatDate(
                            currentMembership.end_date,
                          )}
                        </p>
                      </div>

                      <div className="border border-border p-4">
                        <span className="text-[10px] font-extrabold uppercase text-muted-foreground">
                          Time Remaining
                        </span>

                        <p className="mt-2 font-bold">
                          {daysRemaining ===
                          0
                            ? "Expires today"
                            : daysRemaining ===
                                1
                              ? "1 day"
                              : daysRemaining !==
                                  null &&
                                daysRemaining >
                                  1
                                ? `${daysRemaining} days`
                                : "Expired"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </details>
          </section>

          {/* MEMBERSHIP HISTORY */}
          <section className="mt-6">
            <details className="group">
              <SectionSummary
                eyebrow="History"
                title="Membership History"
                description="All memberships recorded for this member."
                count={
                  memberships.length
                }
                icon={
                  <Clock3 className="size-5" />
                }
              />

              <div className="mt-3">
                {memberships.length ===
                0 ? (
                  <div className="border border-border bg-background p-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      No membership history available.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border overflow-hidden border border-border bg-background">
                    {memberships.map(
                      (
                        membership,
                      ) => {
                        const active =
                          isMembershipActive(
                            membership,
                          );

                        return (
                          <div
                            key={
                              membership.id
                            }
                            className="p-5 sm:p-6"
                          >
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <h3 className="font-display text-2xl font-bold uppercase">
                                  {membership.plan_name ||
                                    "Membership"}
                                </h3>

                                <p className="mt-1 text-xs text-muted-foreground">
                                  Added{" "}
                                  {formatDateTime(
                                    membership.created_at,
                                  )}
                                </p>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <span
                                  className={`px-3 py-1.5 text-[10px] font-extrabold uppercase ${
                                    active
                                      ? "bg-green-600/10 text-green-700"
                                      : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  {active
                                    ? "Active"
                                    : "Expired"}
                                </span>

                                {membership.payment_status && (
                                  <span className="bg-primary/10 px-3 py-1.5 text-[10px] font-extrabold uppercase text-primary">
                                    {
                                      membership.payment_status
                                    }
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="mt-5 grid gap-3 sm:grid-cols-3">
                              <div>
                                <span className="text-[10px] font-extrabold uppercase text-muted-foreground">
                                  Start
                                </span>

                                <p className="mt-1 text-sm font-bold">
                                  {formatDate(
                                    membership.start_date,
                                  )}
                                </p>
                              </div>

                              <div>
                                <span className="text-[10px] font-extrabold uppercase text-muted-foreground">
                                  Expiry
                                </span>

                                <p className="mt-1 text-sm font-bold">
                                  {formatDate(
                                    membership.end_date,
                                  )}
                                </p>
                              </div>

                              <div>
                                <span className="text-[10px] font-extrabold uppercase text-muted-foreground">
                                  Source
                                </span>

                                <p className="mt-1 text-sm font-bold">
                                  {membership.source ||
                                    "Not recorded"}
                                </p>
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

          {/* PAYMENT HISTORY */}
          <section className="mt-6">
            <details className="group">
              <SectionSummary
                eyebrow="Financial"
                title="Payment History"
                description="All recorded payments made by this member."
                count={
                  payments.length
                }
                icon={
                  <CreditCard className="size-5" />
                }
              />

              <div className="mt-3">
                <div className="mb-3 border border-border bg-background p-5">
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
                    Total Successful Payments
                  </span>

                  <p className="mt-2 font-display text-3xl font-bold">
                    {formatAmount(
                      totalPaid,
                    )}
                  </p>
                </div>

                {payments.length ===
                0 ? (
                  <div className="border border-border bg-background p-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      No payment history available.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border overflow-hidden border border-border bg-background">
                    {payments.map(
                      (payment) => (
                        <div
                          key={
                            payment.id
                          }
                          className="p-5 sm:p-6"
                        >
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="font-display text-2xl font-bold">
                                {formatAmount(
                                  payment.amount,
                                  payment.currency,
                                )}
                              </p>

                              <p className="mt-1 text-xs text-muted-foreground">
                                {formatDateTime(
                                  payment.paid_at ||
                                    payment.created_at,
                                )}
                              </p>
                            </div>

                            <span
                              className={`inline-flex w-fit items-center gap-2 px-3 py-1.5 text-[10px] font-extrabold uppercase ${
                                payment.status.toLowerCase() ===
                                "success"
                                  ? "bg-green-600/10 text-green-700"
                                  : "bg-destructive/10 text-destructive"
                              }`}
                            >
                              {payment.status.toLowerCase() ===
                              "success" ? (
                                <CheckCircle2 className="size-3" />
                              ) : (
                                <XCircle className="size-3" />
                              )}

                              {
                                payment.status
                              }
                            </span>
                          </div>

                          <div className="mt-5 grid gap-3 sm:grid-cols-2">
                            <div>
                              <span className="text-[10px] font-extrabold uppercase text-muted-foreground">
                                Payment Method
                              </span>

                              <p className="mt-1 text-sm font-bold">
                                {payment.payment_method ||
                                  "Not recorded"}
                              </p>
                            </div>

                            <div>
                              <span className="text-[10px] font-extrabold uppercase text-muted-foreground">
                                Provider
                              </span>

                              <p className="mt-1 text-sm font-bold">
                                {payment.provider ||
                                  "Not recorded"}
                              </p>
                            </div>

                            {payment.paystack_reference && (
                              <div className="sm:col-span-2">
                                <span className="text-[10px] font-extrabold uppercase text-muted-foreground">
                                  Paystack Reference
                                </span>

                                <p className="mt-1 break-all font-mono text-xs">
                                  {
                                    payment.paystack_reference
                                  }
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>
            </details>
          </section>

          {/* ATTENDANCE HISTORY */}
          <section className="mt-6">
            <details className="group">
              <SectionSummary
                eyebrow="Visits"
                title="Attendance History"
                description="Every recorded gym visit for this member."
                count={
                  attendance.length
                }
                icon={
                  <LogIn className="size-5" />
                }
              />

              <div className="mt-3">
                {attendance.length ===
                0 ? (
                  <div className="border border-border bg-background p-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      No attendance history available.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border overflow-hidden border border-border bg-background">
                    {attendance.map(
                      (record) => {
                        const inside =
                          !record.checked_out_at;

                        return (
                          <div
                            key={
                              record.id
                            }
                            className="p-5 sm:p-6"
                          >
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <h3 className="font-bold uppercase">
                                  {formatDate(
                                    record.checked_in_at,
                                  )}
                                </h3>

                                <p className="mt-1 text-xs text-muted-foreground">
                                  Visit duration:{" "}
                                  {formatAttendanceDuration(
                                    record.checked_in_at,
                                    record.checked_out_at,
                                  )}
                                </p>
                              </div>

                              <span
                                className={`inline-flex w-fit items-center gap-2 px-3 py-1.5 text-[10px] font-extrabold uppercase ${
                                  inside
                                    ? "bg-primary/10 text-primary"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {inside ? (
                                  <LogIn className="size-3" />
                                ) : (
                                  <LogOut className="size-3" />
                                )}

                                {inside
                                  ? "Currently Inside"
                                  : "Completed"}
                              </span>
                            </div>

                            <div className="mt-5 grid gap-3 sm:grid-cols-2">
                              <div>
                                <span className="text-[10px] font-extrabold uppercase text-muted-foreground">
                                  Check-In
                                </span>

                                <p className="mt-1 text-sm font-bold">
                                  {formatDateTime(
                                    record.checked_in_at,
                                  )}
                                </p>
                              </div>

                              <div>
                                <span className="text-[10px] font-extrabold uppercase text-muted-foreground">
                                  Check-Out
                                </span>

                                <p className="mt-1 text-sm font-bold">
                                  {record.checked_out_at
                                    ? formatDateTime(
                                        record.checked_out_at,
                                      )
                                    : "Not checked out"}
                                </p>
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

          {/* QR CODE */}
          <section className="mt-6">
            <details className="group">
              <SectionSummary
                eyebrow="Access"
                title="QR Code"
                description="The member's permanent gym check-in QR code."
                icon={
                  <QrCode className="size-5" />
                }
              />

              <div className="mt-3 border border-border bg-background p-6 shadow-sm sm:p-8">
                {!member.qr_token ? (
                  <div className="py-8 text-center">
                    <XCircle className="mx-auto size-8 text-destructive" />

                    <h3 className="mt-4 font-display text-2xl font-bold uppercase">
                      QR Code Unavailable
                    </h3>

                    <p className="mt-2 text-sm text-muted-foreground">
                      This member does not currently have a QR token.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="border border-border bg-white p-5">
                      <QRCodeSVG
                        id="member-profile-qr"
                        value={
                          member.qr_token
                        }
                        size={260}
                        level="H"
                        includeMargin
                      />
                    </div>

                    <p className="mt-5 text-center text-xs text-muted-foreground">
                      Reception can use this QR code to check the member in or out.
                    </p>

                    <Button
                      type="button"
                      className="mt-5"
                      onClick={
                        downloadQrCode
                      }
                    >
                      <Download />
                      Download QR Code
                    </Button>
                  </div>
                )}
              </div>
            </details>
          </section>

          {/* CURRENT STATUS */}
          <section className="mt-6">
            <details
              className="group"
              open
            >
              <SectionSummary
                eyebrow="Overview"
                title="Current Status"
                description="At-a-glance membership and attendance status."
                icon={
                  <CheckCircle2 className="size-5" />
                }
              />

              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div
                  className={`border p-6 ${
                    statusActive
                      ? "border-green-600/20 bg-green-600/5"
                      : "border-destructive/20 bg-destructive/5"
                  }`}
                >
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
                    Membership Status
                  </span>

                  <p
                    className={`mt-2 font-display text-3xl font-bold uppercase ${
                      statusActive
                        ? "text-green-700"
                        : "text-destructive"
                    }`}
                  >
                    {statusActive
                      ? "Active"
                      : "Expired"}
                  </p>

                  {latestMembership && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {latestMembership.plan_name ||
                        "Membership"}{" "}
                      • expires{" "}
                      {formatDate(
                        latestMembership.end_date,
                      )}
                    </p>
                  )}
                </div>

                <div
                  className={`border p-6 ${
                    isCurrentlyInside
                      ? "border-primary/20 bg-primary/5"
                      : "border-border bg-background"
                  }`}
                >
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
                    Gym Attendance
                  </span>

                  <p className="mt-2 font-display text-3xl font-bold uppercase">
                    {isCurrentlyInside
                      ? "Inside"
                      : "Outside"}
                  </p>

                  <p className="mt-2 text-sm text-muted-foreground">
                    {isCurrentlyInside
                      ? "Member has checked in and has not checked out."
                      : "Member is not currently checked in."}
                  </p>
                </div>
              </div>
            </details>
          </section>

          <div className="mt-10 flex items-center justify-center gap-2 text-xs text-muted-foreground">
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
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  LogOut,
  QrCode,
  UserRound,
  Loader2,
  AlertCircle,
  RefreshCw,
  CreditCard,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { membershipPlans, formatNaira } from "@/lib/site-data";

export const Route = createFileRoute("/member")({
  head: () => ({
    meta: [
      {
        title: "Member Dashboard — Super Plus Fitness",
      },
      {
        name: "description",
        content:
          "View your Super Plus Fitness membership, QR code and attendance.",
      },
    ],
  }),
  component: MemberDashboard,
});

function getLocalDateString() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDateOnly(value: unknown) {
  if (!value) return null;

  const stringValue = String(value).trim();

  if (!stringValue) return null;

  return stringValue.slice(0, 10);
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T12:00:00`);

  date.setDate(date.getDate() + days);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isMembershipValidToday(membership: any) {
  if (!membership) return false;

  const startDate = getDateOnly(
    membership?.start_date ||
      membership?.starts_at ||
      membership?.started_at ||
      null,
  );

  const endDate = getDateOnly(
    membership?.end_date ||
      membership?.expiry_date ||
      membership?.expires_at ||
      membership?.expiration_date ||
      null,
  );

  if (!startDate || !endDate) {
    return false;
  }

  const today = getLocalDateString();

  return startDate <= today && today <= endDate;
}

/**
 * Combines memberships that run continuously.
 *
 * Example:
 * Membership 1: Sep 13 → Sep 15
 * Membership 2: Sep 16 → Sep 16
 *
 * Dashboard displays:
 * Sep 13 → Sep 16
 *
 * The individual records remain untouched in Supabase.
 */
function getContinuousMembership(memberships: any[]) {
  if (!memberships || memberships.length === 0) {
    return null;
  }

  const today = getLocalDateString();

  const normalized = memberships
    .map((membership) => ({
      ...membership,
      normalizedStart: getDateOnly(membership?.start_date),
      normalizedEnd: getDateOnly(membership?.end_date),
    }))
    .filter(
      (membership) =>
        membership.normalizedStart &&
        membership.normalizedEnd,
    )
    .sort((a, b) =>
      a.normalizedStart.localeCompare(b.normalizedStart),
    );

  if (normalized.length === 0) {
    return null;
  }

  // Find the membership that is active today.
  let currentIndex = normalized.findIndex(
    (membership) =>
      membership.normalizedStart <= today &&
      today <= membership.normalizedEnd,
  );

  // If there is no membership active today,
  // show the most recently created membership.
  if (currentIndex === -1) {
    return (
      [...normalized].sort((a, b) =>
        String(b.created_at || "").localeCompare(
          String(a.created_at || ""),
        ),
      )[0] || null
    );
  }

  const currentMembership = normalized[currentIndex];

  let combinedStart = currentMembership.normalizedStart;
  let combinedEnd = currentMembership.normalizedEnd;

  // Look forward and combine memberships that start
  // on the day immediately after the current period ends,
  // or overlap it.
  for (
    let index = currentIndex + 1;
    index < normalized.length;
    index++
  ) {
    const nextMembership = normalized[index];

    const nextStart = nextMembership.normalizedStart;
    const nextEnd = nextMembership.normalizedEnd;

    if (!nextStart || !nextEnd) {
      continue;
    }

    const dayAfterCurrentEnd = addDays(combinedEnd, 1);

    // If the next membership starts on or before the day
    // immediately after the current membership ends,
    // it is continuous.
    if (nextStart <= dayAfterCurrentEnd) {
      if (nextEnd > combinedEnd) {
        combinedEnd = nextEnd;
      }

      continue;
    }

    // There is a gap, so stop combining.
    break;
  }

  return {
    ...currentMembership,
    start_date: combinedStart,
    end_date: combinedEnd,
  };
}

function MemberDashboard() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState<any>(null);
  const [membership, setMembership] = useState<any>(null);
  const [error, setError] = useState("");
  const [showPlans, setShowPlans] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadMember() {
      setLoading(true);
      setError("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;

      if (!session) {
        navigate({ to: "/login" });
        return;
      }

      const { data: memberData, error: memberError } =
        await supabase
          .from("members")
          .select("*")
          .eq("auth_user_id", session.user.id)
          .maybeSingle();

      if (!active) return;

      if (memberError) {
        setError(memberError.message);
        setLoading(false);
        return;
      }

      if (!memberData) {
        setError(
          "Your login was successful, but your member account has not been linked yet. Please contact Super Plus Fitness reception.",
        );
        setLoading(false);
        return;
      }

      setMember(memberData);

      const { data: membershipData, error: membershipError } =
        await supabase
          .from("memberships")
          .select("*")
          .eq("member_id", memberData.id)
          .order("created_at", { ascending: false });

      if (!active) return;

      if (membershipError) {
        setError(membershipError.message);
        setLoading(false);
        return;
      }

      const continuousMembership =
        getContinuousMembership(
          membershipData || [],
        );

      setMembership(continuousMembership);
      setLoading(false);
    }

    loadMember();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && active) {
        navigate({ to: "/login" });
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  async function handlePayment() {
    if (!selectedPlan) {
      setPaymentError("Please select a membership plan.");
      return;
    }

    setPaymentLoading(true);
    setPaymentError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate({ to: "/login" });
        return;
      }

      const { data, error: functionError } =
        await supabase.functions.invoke(
          "initialize-payment",
          {
            body: {
              planId: selectedPlan,
            },
          },
        );

      if (functionError) {
        console.error(
          "Payment initialization error:",
          functionError,
        );

        throw new Error(
          functionError.message ||
            "Unable to start payment.",
        );
      }

      if (!data?.authorization_url) {
        throw new Error(
          data?.error ||
            "Unable to create Paystack payment.",
        );
      }

      window.location.href =
        data.authorization_url;
    } catch (paymentException) {
      console.error(
        "Payment error:",
        paymentException,
      );

      setPaymentError(
        paymentException instanceof Error
          ? paymentException.message
          : "Unable to start payment. Please try again.",
      );

      setPaymentLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-[75vh] bg-muted py-20">
        <div className="section-shell flex min-h-[50vh] items-center justify-center">
          <div className="flex items-center gap-3 text-sm font-bold uppercase">
            <Loader2 className="size-5 animate-spin" />
            Loading your account...
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-[75vh] bg-muted py-16 sm:py-24">
        <div className="section-shell">
          <div className="mx-auto max-w-2xl border border-border bg-background p-8 shadow-sm sm:p-12">
            <AlertCircle className="size-10 text-destructive" />

            <h1 className="display-title mt-6 text-4xl sm:text-5xl">
              Account Issue
            </h1>

            <p className="mt-5 text-sm leading-7 text-muted-foreground">
              {error}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/login">
                <Button>Back to Login</Button>
              </Link>

              <Button
                variant="outline"
                onClick={handleLogout}
              >
                Log Out
              </Button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const fullName =
    member?.full_name ||
    `${member?.first_name ?? ""} ${member?.last_name ?? ""}`.trim() ||
    "Member";

  const planName =
    membership?.plan_name ||
    membership?.name ||
    membership?.plan ||
    "Membership";

  const startDate =
    membership?.start_date ||
    membership?.starts_at ||
    membership?.started_at ||
    null;

  const expiryDate =
    membership?.end_date ||
    membership?.expiry_date ||
    membership?.expires_at ||
    membership?.expiration_date ||
    null;

  const isActive =
    isMembershipValidToday(membership);

  function formatDate(value: string | null) {
    if (!value) return "Not available";

    const dateOnly = getDateOnly(value);

    if (!dateOnly) return "Not available";

    const [year, month, day] =
      dateOnly.split("-").map(Number);

    const date = new Date(
      year,
      month - 1,
      day,
    );

    if (Number.isNaN(date.getTime())) {
      return "Not available";
    }

    return date.toLocaleDateString(
      "en-NG",
      {
        day: "numeric",
        month: "long",
        year: "numeric",
      },
    );
  }

  function calculateDaysRemaining(
    value: string | null,
  ) {
    if (!value) return null;

    const dateOnly =
      getDateOnly(value);

    if (!dateOnly) return null;

    const [year, month, day] =
      dateOnly.split("-").map(Number);

    const expiry = new Date(
      year,
      month - 1,
      day,
    );

    const todayParts =
      getLocalDateString()
        .split("-")
        .map(Number);

    const today = new Date(
      todayParts[0],
      todayParts[1] - 1,
      todayParts[2],
    );

    const difference =
      expiry.getTime() -
      today.getTime();

    return Math.max(
      0,
      Math.ceil(
        difference /
          (1000 * 60 * 60 * 24),
      ),
    );
  }

  const daysRemaining = isActive
    ? calculateDaysRemaining(expiryDate)
    : 0;

  return (
    <main className="min-h-[75vh] bg-muted py-10 sm:py-16">
      <div className="section-shell">
        <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
              Super Plus Fitness
            </p>

            <h1 className="display-title text-5xl sm:text-6xl">
              Welcome,{" "}
              {fullName.split(" ")[0]}
            </h1>

            <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
              Manage your membership and
              access your gym QR code from
              your member account.
            </p>
          </div>

          <Button
            variant="outline"
            onClick={handleLogout}
            className="w-full sm:w-auto"
          >
            <LogOut />
            Log Out
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          {/* Membership */}
          <section className="border border-border bg-background p-7 shadow-sm sm:p-9">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-primary">
                  Your Membership
                </p>

                <h2 className="mt-3 font-display text-3xl font-bold uppercase">
                  {planName}
                </h2>
              </div>

              <div
                className={`flex shrink-0 items-center gap-2 border px-3 py-2 text-xs font-extrabold uppercase ${
                  isActive
                    ? "border-green-600/30 bg-green-600/10 text-green-700"
                    : "border-destructive/30 bg-destructive/10 text-destructive"
                }`}
              >
                {isActive ? (
                  <CheckCircle2 className="size-4" />
                ) : (
                  <AlertCircle className="size-4" />
                )}

                {isActive
                  ? "Active"
                  : "Expired"}
              </div>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="border border-border p-5">
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-muted-foreground">
                  <CalendarDays className="size-4" />
                  Start Date
                </div>

                <p className="mt-3 font-bold">
                  {formatDate(startDate)}
                </p>
              </div>

              <div className="border border-border p-5">
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-muted-foreground">
                  <Clock3 className="size-4" />
                  Expiry Date
                </div>

                <p className="mt-3 font-bold">
                  {formatDate(expiryDate)}
                </p>
              </div>

              <div
                className={`border p-5 ${
                  isActive
                    ? "border-primary/30 bg-primary/5"
                    : "border-destructive/30 bg-destructive/5"
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-muted-foreground">
                  <Clock3 className="size-4" />
                  Time Remaining
                </div>

                <p className="mt-3 font-bold">
                  {isActive &&
                  daysRemaining !==
                    null
                    ? daysRemaining ===
                      0
                      ? "Expires today"
                      : `${daysRemaining} ${
                          daysRemaining ===
                          1
                            ? "day"
                            : "days"
                        }`
                    : "Membership expired"}
                </p>
              </div>
            </div>

            <div className="mt-6">
              <Button
                variant={
                  isActive
                    ? "outline"
                    : "default"
                }
                size="lg"
                className="w-full"
                onClick={() => {
                  setShowPlans(
                    (current) =>
                      !current,
                  );
                  setPaymentError("");
                }}
              >
                <RefreshCw />
                {showPlans
                  ? "Close Plans"
                  : isActive
                    ? "Renew / Extend Membership"
                    : "Renew Membership"}
              </Button>
            </div>

            {showPlans && (
              <div className="mt-6 border-t border-border pt-6">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-primary">
                    Choose Your Plan
                  </p>

                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Select a plan below. Payment
                    is processed securely by
                    Paystack.
                  </p>
                </div>

                <div className="mt-5 grid gap-3">
                  {membershipPlans.map(
                    (plan) => {
                      const isSelected =
                        selectedPlan ===
                        plan.id;

                      return (
                        <button
                          key={plan.id}
                          type="button"
                          onClick={() =>
                            setSelectedPlan(
                              plan.id,
                            )
                          }
                          className={`w-full border p-4 text-left transition ${
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "border-border bg-background hover:border-primary/50"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="font-display text-lg font-bold uppercase">
                                {plan.name}
                              </p>

                              <p className="mt-1 text-xs text-muted-foreground">
                                {plan.duration}
                              </p>
                            </div>

                            <p className="shrink-0 font-display text-lg font-bold">
                              {formatNaira(
                                plan.price,
                              )}
                            </p>
                          </div>

                          {isSelected && (
                            <div className="mt-3 flex items-center gap-2 text-xs font-extrabold uppercase text-primary">
                              <CheckCircle2 className="size-4" />
                              Selected
                            </div>
                          )}
                        </button>
                      );
                    },
                  )}
                </div>

                {selectedPlan && (
                  <div className="mt-5 border border-border bg-muted p-4">
                    <div className="flex items-center gap-3">
                      <CreditCard className="size-5 text-primary" />

                      <div>
                        <p className="text-xs font-extrabold uppercase">
                          Payment
                        </p>

                        <p className="mt-1 text-sm text-muted-foreground">
                          You will be redirected
                          to Paystack to complete
                          your payment.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {paymentError && (
                  <div className="mt-4 border border-destructive/30 bg-destructive/10 p-4 text-sm font-semibold text-destructive">
                    {paymentError}
                  </div>
                )}

                <Button
                  size="lg"
                  className="mt-5 w-full"
                  disabled={
                    !selectedPlan ||
                    paymentLoading
                  }
                  onClick={
                    handlePayment
                  }
                >
                  {paymentLoading ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Preparing Payment...
                    </>
                  ) : (
                    <>
                      Continue to Paystack
                      <CreditCard />
                    </>
                  )}
                </Button>
              </div>
            )}
          </section>

          {/* QR */}
          <section className="border border-border bg-background p-7 shadow-sm sm:p-9">
            <div className="flex size-12 items-center justify-center bg-primary text-primary-foreground">
              <QrCode className="size-6" />
            </div>

            <h2 className="mt-6 font-display text-3xl font-bold uppercase">
              Gym QR Code
            </h2>

            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Your unique member QR code is
              used to check in and out of the
              gym.
            </p>

            <Link
              to="/my-qr"
              className="mt-7 block"
            >
              <Button
                size="lg"
                className="w-full"
              >
                Open My QR Code
                <QrCode />
              </Button>
            </Link>
          </section>
        </div>

        {/* Member information */}
        <section className="mt-6 border border-border bg-background p-7 shadow-sm sm:p-9">
          <div className="flex items-center gap-3">
            <UserRound className="size-5 text-primary" />

            <h2 className="font-display text-2xl font-bold uppercase">
              Member Information
            </h2>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-xs font-extrabold uppercase text-muted-foreground">
                Full Name
              </p>

              <p className="mt-2 font-bold">
                {fullName}
              </p>
            </div>

            <div>
              <p className="text-xs font-extrabold uppercase text-muted-foreground">
                Email
              </p>

              <p className="mt-2 break-all font-bold">
                {member?.email ||
                  "Not available"}
              </p>
            </div>

            <div>
              <p className="text-xs font-extrabold uppercase text-muted-foreground">
                Phone
              </p>

              <p className="mt-2 font-bold">
                {member?.phone ||
                  "Not available"}
              </p>
            </div>
          </div>
        </section>

        <div className="mt-8 border border-border bg-background p-6 text-center">
          <p className="text-xs leading-5 text-muted-foreground">
            Need help with your membership?
            Visit Super Plus Fitness & Spa at
            No. 105 Apata Street, Shomolu,
            Lagos, or contact us on
            07054263170.
          </p>
        </div>
      </div>
    </main>
  );
}
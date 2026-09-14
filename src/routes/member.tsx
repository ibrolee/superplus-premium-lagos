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
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

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

function MemberDashboard() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState<any>(null);
  const [membership, setMembership] = useState<any>(null);
  const [error, setError] = useState("");

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

      const { data: memberData, error: memberError } = await supabase
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

      const { data: membershipData } = await supabase
        .from("memberships")
        .select("*")
        .eq("member_id", memberData.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (active) {
        setMembership(membershipData ?? null);
        setLoading(false);
      }
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

              <Button variant="outline" onClick={handleLogout}>
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
    membership?.status === "active" ||
    membership?.is_active === true ||
    (expiryDate ? new Date(expiryDate) >= new Date() : false);

  function formatDate(value: string | null) {
    if (!value) return "Not available";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "Not available";

    return date.toLocaleDateString("en-NG", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  return (
    <main className="min-h-[75vh] bg-muted py-10 sm:py-16">
      <div className="section-shell">
        <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
              Super Plus Fitness
            </p>

            <h1 className="display-title text-5xl sm:text-6xl">
              Welcome, {fullName.split(" ")[0]}
            </h1>

            <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
              Manage your membership and access your gym QR code from your
              member account.
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
                <CheckCircle2 className="size-4" />
                {isActive ? "Active" : "Inactive"}
              </div>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
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
            </div>
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
              Your unique member QR code is used to check in and out of the
              gym.
            </p>

            <Link to="/my-qr" className="mt-7 block">
              <Button size="lg" className="w-full">
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
              <p className="mt-2 font-bold">{fullName}</p>
            </div>

            <div>
              <p className="text-xs font-extrabold uppercase text-muted-foreground">
                Email
              </p>
              <p className="mt-2 break-all font-bold">
                {member?.email || "Not available"}
              </p>
            </div>

            <div>
              <p className="text-xs font-extrabold uppercase text-muted-foreground">
                Phone
              </p>
              <p className="mt-2 font-bold">
                {member?.phone || "Not available"}
              </p>
            </div>
          </div>
        </section>

        <div className="mt-8 border border-border bg-background p-6 text-center">
          <p className="text-xs leading-5 text-muted-foreground">
            Need help with your membership? Visit Super Plus Fitness & Spa at
            No. 105 Apata Street, Shomolu, Lagos, or contact us on
            07054263170.
          </p>
        </div>
      </div>
    </main>
  );
}
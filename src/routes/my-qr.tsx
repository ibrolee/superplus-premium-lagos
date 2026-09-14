import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, QrCode, UserRound } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/my-qr")({
  head: () => ({
    meta: [
      {
        title: "My QR Code — Super Plus Fitness",
      },
      {
        name: "description",
        content: "Your Super Plus Fitness gym access QR code.",
      },
    ],
  }),
  component: MyQrPage,
});

function MyQrPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadQrCode() {
      setLoading(true);
      setError("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;

      if (!session) {
        navigate({ to: "/login", replace: true });
        return;
      }

      const { data, error: memberError } = await supabase
        .from("members")
        .select("full_name, email, qr_token")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();

      if (!active) return;

      if (memberError) {
        setError(memberError.message);
        setLoading(false);
        return;
      }

      if (!data) {
        setError(
          "Your member account could not be found. Please contact Super Plus Fitness reception.",
        );
        setLoading(false);
        return;
      }

      if (!data.qr_token) {
        setError(
          "Your QR code has not been generated yet. Please contact Super Plus Fitness reception.",
        );
        setLoading(false);
        return;
      }

      setMember(data);
      setLoading(false);
    }

    loadQrCode();

    return () => {
      active = false;
    };
  }, [navigate]);

  if (loading) {
    return (
      <main className="min-h-[75vh] bg-muted py-20">
        <div className="section-shell flex min-h-[50vh] items-center justify-center">
          <div className="flex items-center gap-3 text-sm font-bold uppercase">
            <Loader2 className="size-5 animate-spin" />
            Loading your QR code...
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-[75vh] bg-muted py-16 sm:py-24">
        <div className="section-shell">
          <div className="mx-auto max-w-md border border-border bg-background p-8 text-center shadow-sm">
            <QrCode className="mx-auto size-12 text-destructive" />

            <h1 className="mt-6 font-display text-3xl font-bold uppercase">
              QR Code Unavailable
            </h1>

            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              {error}
            </p>

            <Link to="/member" className="mt-7 block">
              <Button className="w-full">
                Back to Dashboard
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
        <div className="mx-auto max-w-lg">
          <Link
            to="/member"
            className="mb-6 inline-flex items-center gap-2 text-sm font-bold uppercase text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to Dashboard
          </Link>

          <section className="border border-border bg-background p-7 text-center shadow-sm sm:p-10">
            <div className="mx-auto flex size-12 items-center justify-center bg-primary text-primary-foreground">
              <QrCode className="size-6" />
            </div>

            <p className="mt-6 text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
              Super Plus Fitness
            </p>

            <h1 className="display-title mt-3 text-4xl sm:text-5xl">
              My Gym QR Code
            </h1>

            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Show this QR code to reception when checking in or out of the
              gym.
            </p>

            <div className="mx-auto mt-8 flex w-fit items-center justify-center border border-border bg-white p-5">
              <QRCodeSVG
                value={member.qr_token}
                size={260}
                level="H"
                includeMargin
              />
            </div>

            <div className="mt-7 border border-border bg-muted p-5">
              <div className="flex items-center justify-center gap-2">
                <UserRound className="size-4 text-primary" />

                <p className="text-xs font-extrabold uppercase tracking-[0.12em]">
                  {member.full_name || "Member"}
                </p>
              </div>

              <p className="mt-2 break-all text-xs text-muted-foreground">
                {member.email}
              </p>
            </div>

            <div className="mt-7 border border-primary/20 bg-primary/5 p-4">
              <p className="text-xs leading-5 text-muted-foreground">
                Keep this QR code on your phone. Reception will scan it to
                record your gym entry and exit.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
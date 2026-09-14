import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  LogIn,
  LogOut,
  QrCode,
  UserRound,
  XCircle,
} from "lucide-react";
import { Html5QrcodeScanner } from "html5-qrcode";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/reception-checkin")({
  head: () => ({
    meta: [
      {
        title: "Reception Check-In — Super Plus Fitness",
      },
      {
        name: "description",
        content: "Scan member QR codes to record gym attendance.",
      },
    ],
  }),
  component: ReceptionCheckInPage,
});

type ScanResult = {
  type: "in" | "out";
  memberName: string;
  planName: string;
  message: string;
};

function ReceptionCheckInPage() {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const processingRef = useRef(false);

  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "reception-qr-reader",
      {
        fps: 10,
        qrbox: {
          width: 250,
          height: 250,
        },
        rememberLastUsedCamera: true,
      },
      false,
    );

    scannerRef.current = scanner;

    async function handleScan(decodedText: string) {
      if (processingRef.current) return;

      processingRef.current = true;
      setError("");
      setResult(null);

      try {
        const qrToken = decodedText.trim();

        const { data: member, error: memberError } = await supabase
          .from("members")
          .select("id, full_name, email, qr_token")
          .eq("qr_token", qrToken)
          .maybeSingle();

        if (memberError) {
          throw new Error(memberError.message);
        }

        if (!member) {
          throw new Error(
            "This QR code is not registered to a Super Plus Fitness member.",
          );
        }

        const { data: membership, error: membershipError } = await supabase
          .from("memberships")
          .select("*")
          .eq("member_id", member.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (membershipError) {
          throw new Error(membershipError.message);
        }

        const expiryDate =
          membership?.end_date ||
          membership?.expiry_date ||
          membership?.expires_at ||
          membership?.expiration_date ||
          null;

        const membershipActive =
          membership?.status === "active" ||
          membership?.is_active === true ||
          (expiryDate ? new Date(expiryDate) >= new Date() : false);

        const planName =
          membership?.plan_name ||
          membership?.name ||
          membership?.plan ||
          "Membership";

        if (!membershipActive) {
          setResult({
            type: "in",
            memberName: member.full_name || "Member",
            planName,
            message:
              "Membership is inactive or expired. Access should not be granted.",
          });

          return;
        }

        const { data: openAttendance, error: attendanceError } =
          await supabase
            .from("attendance")
            .select("id, checked_in_at, checked_out_at")
            .eq("member_id", member.id)
            .is("checked_out_at", null)
            .order("checked_in_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (attendanceError) {
          throw new Error(attendanceError.message);
        }

        if (openAttendance) {
          const { error: checkoutError } = await supabase
            .from("attendance")
            .update({
              checked_out_at: new Date().toISOString(),
            })
            .eq("id", openAttendance.id);

          if (checkoutError) {
            throw new Error(checkoutError.message);
          }

          setResult({
            type: "out",
            memberName: member.full_name || "Member",
            planName,
            message: "Check-out recorded successfully.",
          });
        } else {
          const {
            data: {
              user: currentUser,
            },
          } = await supabase.auth.getUser();

          const { error: checkinError } = await supabase
            .from("attendance")
            .insert({
              member_id: member.id,
              checked_in_at: new Date().toISOString(),
              checked_by: currentUser?.id ?? null,
            });

          if (checkinError) {
            throw new Error(checkinError.message);
          }

          setResult({
            type: "in",
            memberName: member.full_name || "Member",
            planName,
            message: "Check-in recorded successfully.",
          });
        }
      } catch (scanError) {
        console.error("QR scan error:", scanError);

        setError(
          scanError instanceof Error
            ? scanError.message
            : "Unable to process this QR code.",
        );
      } finally {
        setTimeout(() => {
          processingRef.current = false;
        }, 2000);
      }
    }

    scanner.render(
      (decodedText) => {
        handleScan(decodedText);
      },
      () => {
        // Ignore normal camera scanning failures.
      },
    );

    setReady(true);

    return () => {
      if (scannerRef.current) {
        scannerRef.current
          .clear()
          .catch(() => {
            // Scanner may already be stopped.
          });
      }
    };
  }, []);

  return (
    <main className="min-h-[75vh] bg-muted py-10 sm:py-16">
      <div className="section-shell">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 text-center">
            <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
              Super Plus Fitness
            </p>

            <h1 className="display-title text-4xl sm:text-6xl">
              Reception Scanner
            </h1>

            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
              Scan a member's QR code to automatically record their gym entry
              or exit.
            </p>
          </div>

          <section className="border border-border bg-background p-5 shadow-sm sm:p-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex size-11 items-center justify-center bg-primary text-primary-foreground">
                <QrCode className="size-6" />
              </div>

              <div>
                <h2 className="font-display text-2xl font-bold uppercase">
                  Scan Member QR
                </h2>

                <p className="text-xs text-muted-foreground">
                  Point the camera at the member's QR code.
                </p>
              </div>
            </div>

            <div
              id="reception-qr-reader"
              className="overflow-hidden border border-border bg-white"
            />

            {ready && (
              <p className="mt-4 text-center text-xs font-bold uppercase text-muted-foreground">
                Camera scanner ready
              </p>
            )}
          </section>

          {error && (
            <section className="mt-6 border border-destructive/30 bg-destructive/10 p-6">
              <div className="flex items-start gap-4">
                <XCircle className="mt-0.5 size-6 shrink-0 text-destructive" />

                <div>
                  <h2 className="font-bold uppercase text-destructive">
                    Scan Problem
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-destructive">
                    {error}
                  </p>
                </div>
              </div>
            </section>
          )}

          {result && (
            <section
              className={`mt-6 border p-7 shadow-sm ${
                result.type === "in"
                  ? "border-green-600/30 bg-green-600/10"
                  : "border-primary/30 bg-primary/10"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center bg-background">
                  {result.type === "in" ? (
                    <LogIn className="size-6 text-green-700" />
                  ) : (
                    <LogOut className="size-6 text-primary" />
                  )}
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-extrabold uppercase tracking-[0.15em]">
                    {result.type === "in" ? "Checked In" : "Checked Out"}
                  </p>

                  <h2 className="mt-2 font-display text-3xl font-bold uppercase">
                    {result.memberName}
                  </h2>

                  <p className="mt-2 text-sm font-bold">
                    {result.planName}
                  </p>

                  <div className="mt-4 flex items-center gap-2 text-sm">
                    <CheckCircle2 className="size-4" />
                    {result.message}
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="border border-border bg-background p-5 text-center">
              <LogIn className="mx-auto size-5 text-primary" />
              <p className="mt-3 text-xs font-extrabold uppercase">
                First Scan
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Checks member in
              </p>
            </div>

            <div className="border border-border bg-background p-5 text-center">
              <LogOut className="mx-auto size-5 text-primary" />
              <p className="mt-3 text-xs font-extrabold uppercase">
                Next Scan
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Checks member out
              </p>
            </div>

            <div className="border border-border bg-background p-5 text-center">
              <Clock3 className="mx-auto size-5 text-primary" />
              <p className="mt-3 text-xs font-extrabold uppercase">
                Automatic
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Attendance is recorded
              </p>
            </div>
          </section>

          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
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
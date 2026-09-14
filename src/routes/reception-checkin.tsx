import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  Clock3,
  Loader2,
  LogIn,
  LogOut,
  QrCode,
  UserRound,
  XCircle,
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/reception-checkin")({
  head: () => ({
    meta: [
      { title: "Reception Check-In — Super Plus Fitness" },
      {
        name: "description",
        content: "Staff-only member QR check-in and check-out.",
      },
    ],
  }),
  component: ReceptionCheckInPage,
});

type ScanResult = {
  type: "in" | "out" | "denied";
  memberName: string;
  planName: string;
  message: string;
};

function ReceptionCheckInPage() {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const processingRef = useRef(false);

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [staffName, setStaffName] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [scannerStarted, setScannerStarted] = useState(false);
  const [startingScanner, setStartingScanner] = useState(false);

  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState("");

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

  async function handleStaffLogin(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setLoggingIn(true);
    setLoginError("");

    const cleanEmail = email.trim().toLowerCase();

    const { data, error: authError } =
      await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

    if (authError || !data.user) {
      setLoginError(
        authError?.message ||
          "Unable to sign in. Please check your email and password.",
      );
      setLoggingIn(false);
      return;
    }

    const { data: staff, error: staffError } = await supabase
      .from("staff_users")
      .select("full_name, role, active")
      .eq("auth_user_id", data.user.id)
      .eq("active", true)
      .maybeSingle();

    if (staffError || !staff) {
      await supabase.auth.signOut();

      setLoginError(
        "This account is not authorized to access the reception scanner.",
      );

      setLoggingIn(false);
      return;
    }

    setStaffName(staff.full_name || "Reception");
    setPassword("");
    setLoggingIn(false);
  }

  async function stopScanner() {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {
        // Scanner may already be stopped.
      }

      try {
        scannerRef.current.clear();
      } catch {
        // Scanner may already be cleared.
      }

      scannerRef.current = null;
    }

    processingRef.current = false;
    setScannerStarted(false);
    setStartingScanner(false);
  }

  async function handleLogout() {
    await stopScanner();
    await supabase.auth.signOut();

    setResult(null);
    setError("");
    setStaffName("");
  }

  async function processQrCode(decodedText: string) {
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

      const { data: membership, error: membershipError } =
        await supabase
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
          type: "denied",
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
          data: { user: currentUser },
        } = await supabase.auth.getUser();

        if (!currentUser) {
          throw new Error(
            "Your staff session has expired. Please log in again.",
          );
        }

        const { error: checkinError } = await supabase
          .from("attendance")
          .insert({
            member_id: member.id,
            checked_in_at: new Date().toISOString(),
            checked_by: currentUser.id,
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

  function startScanner() {
    if (startingScanner || scannerStarted) return;

    setError("");
    setResult(null);
    setStartingScanner(true);
    setScannerStarted(true);
  }

  useEffect(() => {
    if (!scannerStarted) return;

    let cancelled = false;

    async function initializeScanner() {
      try {
        if (!window.isSecureContext) {
          throw new Error(
            "Camera access requires a secure HTTPS connection.",
          );
        }

        const scannerElement =
          document.getElementById("reception-qr-reader");

        if (!scannerElement) {
          throw new Error(
            "Scanner area could not be loaded. Please refresh the page and try again.",
          );
        }

        const scanner = new Html5Qrcode("reception-qr-reader");

        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: {
              width: 250,
              height: 250,
            },
            aspectRatio: 1,
          },
          (decodedText) => {
            processQrCode(decodedText);
          },
          () => {
            // Normal QR scanning misses are ignored.
          },
        );

        if (cancelled) {
          try {
            await scanner.stop();
          } catch {}

          try {
            scanner.clear();
          } catch {}

          return;
        }

        setStartingScanner(false);
      } catch (scannerError) {
        console.error("Camera start error:", scannerError);

        if (scannerRef.current) {
          try {
            await scannerRef.current.stop();
          } catch {}

          try {
            scannerRef.current.clear();
          } catch {}

          scannerRef.current = null;
        }

        if (!cancelled) {
          const message =
            scannerError instanceof Error
              ? scannerError.message
              : String(scannerError);

          setError(
            message ||
              "Unable to start the camera. Please allow camera access and try again.",
          );

          setScannerStarted(false);
          setStartingScanner(false);
        }
      }
    }

    initializeScanner();

    return () => {
      cancelled = true;
    };
  }, [scannerStarted]);

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .catch(() => {})
          .finally(() => {
            try {
              scannerRef.current?.clear();
            } catch {}
          });
      }
    };
  }, []);

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
              <QrCode className="size-6" />
            </div>

            <p className="mt-6 text-center text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
              Super Plus Fitness
            </p>

            <h1 className="display-title mt-3 text-center text-4xl sm:text-5xl">
              Reception Login
            </h1>

            <p className="mt-4 text-center text-sm leading-6 text-muted-foreground">
              Staff login is required to access the member QR scanner.
            </p>

            <form
              onSubmit={handleStaffLogin}
              className="mt-8 grid gap-5"
            >
              <label className="grid gap-2 text-sm font-bold">
                Staff email

                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="spfitnessandspa@gmail.com"
                  autoComplete="email"
                  required
                  disabled={loggingIn}
                  className="h-13 rounded-md border border-input bg-background px-4 font-normal outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                />
              </label>

              <label className="grid gap-2 text-sm font-bold">
                Password

                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  disabled={loggingIn}
                  className="h-13 rounded-md border border-input bg-background px-4 font-normal outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                />
              </label>

              {loginError && (
                <div
                  role="alert"
                  className="border border-destructive/30 bg-destructive/10 p-4 text-sm leading-6 text-destructive"
                >
                  {loginError}
                </div>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={loggingIn}
              >
                {loggingIn ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Access Scanner
                    <LogIn />
                  </>
                )}
              </Button>
            </form>

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
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
                Super Plus Fitness
              </p>

              <h1 className="display-title text-4xl sm:text-6xl">
                Reception Scanner
              </h1>

              <p className="mt-3 text-sm text-muted-foreground">
                Logged in as <strong>{staffName}</strong>
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Link
                to="/reception-dashboard"
                className="w-full sm:w-auto"
              >
                <Button
                  variant="outline"
                  className="w-full"
                >
                  <BarChart3 />
                  Dashboard
                </Button>
              </Link>

              <Button
                variant="outline"
                onClick={handleLogout}
                className="w-full sm:w-auto"
              >
                Log Out
              </Button>
            </div>
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

            {!scannerStarted && (
              <Button
                type="button"
                size="lg"
                className="w-full"
                onClick={startScanner}
                disabled={startingScanner}
              >
                {startingScanner ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Starting Camera...
                  </>
                ) : (
                  <>
                    Start Camera Scanner
                    <QrCode />
                  </>
                )}
              </Button>
            )}

            {scannerStarted && (
              <>
                <div
                  id="reception-qr-reader"
                  className="overflow-hidden border border-border bg-white"
                />

                {startingScanner && (
                  <div className="flex items-center justify-center gap-3 py-8 text-sm font-bold uppercase">
                    <Loader2 className="size-5 animate-spin" />
                    Starting Camera...
                  </div>
                )}

                {!startingScanner && (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-4 w-full"
                    onClick={stopScanner}
                  >
                    Stop Camera
                  </Button>
                )}

                {!startingScanner && (
                  <p className="mt-4 text-center text-xs font-bold uppercase text-muted-foreground">
                    Camera scanner ready — point it at a member QR code
                  </p>
                )}
              </>
            )}
          </section>

          {error && (
            <section className="mt-6 border border-destructive/30 bg-destructive/10 p-6">
              <div className="flex items-start gap-4">
                <XCircle className="mt-0.5 size-6 shrink-0 text-destructive" />

                <div>
                  <h2 className="font-bold uppercase text-destructive">
                    Camera / Scan Problem
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
                result.type === "denied"
                  ? "border-destructive/30 bg-destructive/10"
                  : result.type === "in"
                    ? "border-green-600/30 bg-green-600/10"
                    : "border-primary/30 bg-primary/10"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center bg-background">
                  {result.type === "denied" ? (
                    <XCircle className="size-6 text-destructive" />
                  ) : result.type === "in" ? (
                    <LogIn className="size-6 text-green-700" />
                  ) : (
                    <LogOut className="size-6 text-primary" />
                  )}
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-extrabold uppercase tracking-[0.15em]">
                    {result.type === "denied"
                      ? "Access Denied"
                      : result.type === "in"
                        ? "Checked In"
                        : "Checked Out"}
                  </p>

                  <h2 className="mt-2 font-display text-3xl font-bold uppercase">
                    {result.memberName}
                  </h2>

                  <p className="mt-2 text-sm font-bold">
                    {result.planName}
                  </p>

                  <div className="mt-4 flex items-center gap-2 text-sm">
                    {result.type === "denied" ? (
                      <XCircle className="size-4 text-destructive" />
                    ) : (
                      <CheckCircle2 className="size-4" />
                    )}

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
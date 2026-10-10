import "@/components/reception/reception-responsive.css";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  Camera,
  CheckCircle2,
  Loader2,
  LogIn,
  LogOut,
  QrCode,
  SwitchCamera,
  Volume2,
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
  timeLabel: string;
};

type CameraFacing = "user" | "environment";

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

function getMembershipPlanName(membership: any) {
  return (
    membership?.plan_name ||
    membership?.name ||
    membership?.plan ||
    "Membership"
  );
}

function isMembershipValidToday(membership: any) {
  if (!membership) return false;

  if (
    String(membership.status || "").toLowerCase() !== "active" ||
    String(membership.payment_status || "").toLowerCase() !== "paid"
  ) {
    return false;
  }

  const startDate = getDateOnly(
    membership?.start_date ||
      membership?.starts_at ||
      membership?.start_at ||
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

function formatScanTime() {
  return new Intl.DateTimeFormat("en-NG", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
}

function ReceptionCheckInPage() {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const processingRef = useRef(false);
  const resetTimerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [staffName, setStaffName] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [scannerStarted, setScannerStarted] = useState(false);
  const [startingScanner, setStartingScanner] = useState(false);
  const [processingScan, setProcessingScan] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<CameraFacing>("environment");

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

  async function prepareAudio() {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
      }
    } catch {
      // Scanning remains usable even when the browser blocks sound.
    }
  }

  function playTone(
    startFrequency: number,
    endFrequency: number,
    duration = 0.16,
  ) {
    const context = audioContextRef.current;

    if (!context || context.state !== "running") return;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const startAt = context.currentTime;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(startFrequency, startAt);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(1, endFrequency),
      startAt + duration,
    );

    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.18, startAt + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.02);
  }

  function playFeedbackTone(type: ScanResult["type"]) {
    void prepareAudio().then(() => {
      if (type === "denied") {
        playTone(230, 150, 0.24);
        window.setTimeout(() => playTone(180, 130, 0.2), 120);
      } else if (type === "out") {
        playTone(760, 540, 0.14);
        window.setTimeout(() => playTone(620, 440, 0.12), 100);
      } else {
        playTone(700, 980, 0.12);
        window.setTimeout(() => playTone(900, 1250, 0.14), 95);
      }
    });

    try {
      if ("vibrate" in navigator) {
        navigator.vibrate(type === "denied" ? [120, 70, 120] : 80);
      }
    } catch {
      // Vibration is optional.
    }
  }

  function showScanResult(nextResult: Omit<ScanResult, "timeLabel">) {
    const completeResult = {
      ...nextResult,
      timeLabel: formatScanTime(),
    };

    setResult(completeResult);
    setProcessingScan(false);
    playFeedbackTone(completeResult.type);
  }

  function clearResetTimer() {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }

  function scheduleScannerResume() {
    clearResetTimer();

    resetTimerRef.current = window.setTimeout(() => {
      setResult(null);
      setError("");
      setProcessingScan(false);
      processingRef.current = false;

      try {
        scannerRef.current?.resume();
      } catch {
        // Scanner may have been stopped while feedback was visible.
      }

      resetTimerRef.current = null;
    }, 3400);
  }

  async function stopScanner() {
    clearResetTimer();

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
    setProcessingScan(false);
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
    setProcessingScan(true);
    setError("");
    setResult(null);

    try {
      try {
        scannerRef.current?.pause(true);
      } catch {
        // If pause is unsupported, processingRef still prevents duplicate reads.
      }

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
        showScanResult({
          type: "denied",
          memberName: "QR Not Recognized",
          planName: "No matching member",
          message: "Please see reception for assistance.",
        });
        return;
      }

      const { data: memberships, error: membershipError } =
        await supabase
          .from("memberships")
          .select("*")
          .eq("member_id", member.id)
          .order("created_at", { ascending: false });

      if (membershipError) {
        throw new Error(membershipError.message);
      }

      const validMembership =
        memberships?.find((membership) =>
          isMembershipValidToday(membership),
        ) || null;

      const planName = getMembershipPlanName(
        validMembership || memberships?.[0],
      );

      if (!validMembership) {
        showScanResult({
          type: "denied",
          memberName: member.full_name || "Member",
          planName,
          message: "Membership is inactive, unpaid or expired.",
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

        showScanResult({
          type: "out",
          memberName: member.full_name || "Member",
          planName,
          message: "Check-out recorded. Goodbye!",
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

        showScanResult({
          type: "in",
          memberName: member.full_name || "Member",
          planName,
          message: "Access granted. Check-in recorded.",
        });
      }
    } catch (scanError) {
      console.error("QR scan error:", scanError);

      showScanResult({
        type: "denied",
        memberName: "Scan Failed",
        planName: "Access not recorded",
        message:
          scanError instanceof Error
            ? scanError.message
            : "Unable to process this QR code.",
      });
    } finally {
      scheduleScannerResume();
    }
  }

  function startScanner() {
    if (startingScanner || scannerStarted) return;

    void prepareAudio();
    setError("");
    setResult(null);
    setStartingScanner(true);
    setScannerStarted(true);
  }

  async function switchCamera(nextFacing: CameraFacing) {
    if (nextFacing === cameraFacing || startingScanner) return;

    const shouldRestart = scannerStarted;

    if (shouldRestart) {
      await stopScanner();
    }

    setCameraFacing(nextFacing);
    setResult(null);
    setError("");

    if (shouldRestart) {
      window.setTimeout(() => {
        setStartingScanner(true);
        setScannerStarted(true);
      }, 0);
    }
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
            "Scanner area could not be loaded. Please refresh and try again.",
          );
        }

        const scanner = new Html5Qrcode("reception-qr-reader");

        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: cameraFacing },
          {
            fps: 12,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const shortestSide = Math.min(
                viewfinderWidth,
                viewfinderHeight,
              );
              const boxSize = Math.max(
                180,
                Math.min(290, Math.floor(shortestSide * 0.72)),
              );

              return {
                width: boxSize,
                height: boxSize,
              };
            },
            aspectRatio: 1,
          },
          (decodedText) => {
            void processQrCode(decodedText);
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
  }, [scannerStarted, cameraFacing]);

  useEffect(() => {
    return () => {
      clearResetTimer();

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

      void audioContextRef.current?.close().catch(() => {});
    };
  }, []);

  if (checkingAccess) {
    return (
      <main className="reception-responsive min-h-[75vh] bg-muted py-20">
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
      <main className="reception-responsive min-h-[75vh] bg-muted py-16 sm:py-24">
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

  const isDenied = result?.type === "denied";
  const isCheckIn = result?.type === "in";

  return (
    <main className="reception-responsive min-h-[100svh] overflow-x-hidden bg-[#f3f6f1] px-3 py-3 sm:px-6 sm:py-6">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-3">
        <header className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background px-4 py-3 shadow-sm">
          <div className="min-w-0">
            <p className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-primary">
              Super Plus Fitness
            </p>
            <h1 className="truncate font-display text-xl font-black uppercase leading-none sm:text-2xl">
              Member Scanner
            </h1>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Link to="/reception-workspace">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Reception dashboard"
                title="Reception dashboard"
              >
                <BarChart3 className="size-4" />
              </Button>
            </Link>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleLogout}
            >
              Log out
            </Button>
          </div>
        </header>

        <section className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-3">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.12em]">
                Camera
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {cameraFacing === "environment" ? "Back camera" : "Front camera"}
              </p>
            </div>

            <div className="grid grid-cols-2 rounded-xl bg-muted p-1">
              <button
                type="button"
                onClick={() => void switchCamera("user")}
                disabled={startingScanner}
                className={`flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-bold transition disabled:opacity-50 ${
                  cameraFacing === "user"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                <Camera className="size-3.5" />
                Front
              </button>

              <button
                type="button"
                onClick={() => void switchCamera("environment")}
                disabled={startingScanner}
                className={`flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-bold transition disabled:opacity-50 ${
                  cameraFacing === "environment"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                <SwitchCamera className="size-3.5" />
                Back
              </button>
            </div>
          </div>

          <div className="relative h-[58svh] min-h-[360px] max-h-[610px] overflow-hidden bg-black">
            {!scannerStarted && !error && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#101410] px-7 text-center text-white">
                <div className="flex size-16 items-center justify-center rounded-2xl bg-white/10">
                  <QrCode className="size-8" />
                </div>

                <h2 className="mt-5 font-display text-3xl font-black uppercase">
                  Ready to Scan
                </h2>

                <p className="mt-2 max-w-xs text-sm leading-5 text-white/65">
                  Start the camera once, then members can scan their cards themselves.
                </p>

                <Button
                  type="button"
                  size="lg"
                  className="mt-6 min-h-12 w-full max-w-xs"
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
                      <Camera />
                      Start Scanner
                    </>
                  )}
                </Button>

                <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-white/55">
                  <Volume2 className="size-4" />
                  Sound feedback is on
                </div>
              </div>
            )}

            <div
              id="reception-qr-reader"
              className="h-full w-full overflow-hidden bg-black [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
            />

            {scannerStarted && !result && !error && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pb-4 pt-12 text-center text-white">
                {processingScan ? (
                  <div className="mx-auto flex w-fit items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-xs font-bold uppercase tracking-wide backdrop-blur">
                    <Loader2 className="size-4 animate-spin" />
                    Checking membership...
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-black uppercase tracking-wide">
                      Hold QR inside the frame
                    </p>
                    <p className="mt-1 text-xs text-white/70">
                      It scans automatically — no button needed
                    </p>
                  </>
                )}
              </div>
            )}

            {error && !result && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#8f1d1d] px-6 text-center text-white">
                <XCircle className="size-16" />
                <h2 className="mt-4 font-display text-3xl font-black uppercase">
                  Camera Problem
                </h2>
                <p className="mt-3 max-w-sm text-sm leading-6 text-white/85">
                  {error}
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-6 min-h-11 w-full max-w-xs"
                  onClick={startScanner}
                >
                  Try Again
                </Button>
              </div>
            )}

            {result && (
              <div
                role="status"
                aria-live="assertive"
                className={`absolute inset-0 z-40 flex flex-col items-center justify-center px-5 py-5 text-center text-white ${
                  isDenied
                    ? "bg-[#a91f24]"
                    : isCheckIn
                      ? "bg-[#17823b]"
                      : "bg-[#176c8a]"
                }`}
              >
                <div className="flex size-20 items-center justify-center rounded-full bg-white/16">
                  {isDenied ? (
                    <XCircle className="size-12" />
                  ) : isCheckIn ? (
                    <LogIn className="size-11" />
                  ) : (
                    <LogOut className="size-11" />
                  )}
                </div>

                <p className="mt-4 text-sm font-black uppercase tracking-[0.18em] text-white/85">
                  {isDenied
                    ? "Access Denied"
                    : isCheckIn
                      ? "Access Granted"
                      : "Checked Out"}
                </p>

                <h2 className="mt-2 max-w-full break-words font-display text-[clamp(1.9rem,8vw,3rem)] font-black uppercase leading-[0.95]">
                  {result.memberName}
                </h2>

                <div className="mt-4 w-full max-w-sm rounded-2xl bg-black/15 px-4 py-3 backdrop-blur-sm">
                  <p className="truncate text-sm font-black">
                    {result.planName}
                  </p>
                  <p className="mt-1 text-sm leading-5 text-white/90">
                    {result.message}
                  </p>
                </div>

                <div className="mt-4 flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-xs font-black uppercase tracking-wide">
                  {isDenied ? (
                    <XCircle className="size-4" />
                  ) : (
                    <CheckCircle2 className="size-4" />
                  )}
                  {result.timeLabel}
                </div>

                <p className="mt-3 text-[11px] font-semibold text-white/65">
                  Scanner will reset automatically
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-[11px] font-bold text-muted-foreground">
                Logged in as {staffName}
              </p>
            </div>

            {scannerStarted ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void stopScanner()}
              >
                Stop Camera
              </Button>
            ) : (
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                <Volume2 className="size-3.5" />
                Green/blue = accepted · Red = denied
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

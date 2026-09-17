import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Html5Qrcode } from "html5-qrcode";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Clock3,
  LogIn,
  LogOut,
  RefreshCw,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/staff-attendance")({
  component: StaffAttendancePage,
});

type ScanResult = {
  success?: boolean;
  action?: "clock_in" | "clock_out";
  staff_name?: string;
  attendance_id?: string;
  checked_in_at?: string;
  checked_out_at?: string;
  error?: string;
};

function formatTime(value?: string) {
  if (!value) return "—";

  return new Date(value).toLocaleTimeString("en-NG", {
    hour: "numeric",
    hour12: true,
    minute: "2-digit",
    second: "2-digit",
  });
}

function StaffAttendancePage() {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerRunningRef = useRef(false);
  const scanLockedRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [staffName, setStaffName] = useState("");
  const [scannerReady, setScannerReady] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState("");

  async function stopScanner() {
    const scanner = scannerRef.current;

    if (!scanner) {
      setScanning(false);
      scannerRunningRef.current = false;
      return;
    }

    if (scannerRunningRef.current) {
      try {
        await scanner.stop();
      } catch {
        // Scanner may already have stopped.
      }
    }

    try {
      scanner.clear();
    } catch {
      // Ignore cleanup errors.
    }

    scannerRunningRef.current = false;
    setScanning(false);
  }

  async function checkStaffAccess() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/staff";
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("staff_profiles")
        .select("id, full_name, status")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (!profile || profile.status !== "approved") {
        setAuthorized(false);
        setError("Your staff account is not approved for attendance.");
        return;
      }

      setStaffName(profile.full_name);
      setAuthorized(true);
    } catch (err) {
      console.error(err);
      setError("Unable to verify your staff account.");
    } finally {
      setLoading(false);
    }
  }

  async function startScanner() {
    if (!authorized || processing) return;

    setError("");
    setResult(null);
    scanLockedRef.current = false;

    await stopScanner();

    const scanner = new Html5Qrcode("staff-attendance-reader");

    scannerRef.current = scanner;

    try {
      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        async (decodedText) => {
          if (scanLockedRef.current || processing) return;

          scanLockedRef.current = true;
          setProcessing(true);

          await stopScanner();

          try {
            const { data, error: rpcError } = await supabase.rpc(
              "staff_scan_attendance",
              {
                p_location_code: decodedText.trim(),
              },
            );

            if (rpcError) {
              throw rpcError;
            }

            const scanResult = data as ScanResult;

            if (!scanResult?.success) {
              throw new Error(
                scanResult?.error || "Attendance scan failed.",
              );
            }

            setResult(scanResult);
          } catch (err) {
            console.error(err);

            const message =
              err instanceof Error
                ? err.message
                : "Unable to record attendance.";

            setError(message);
            scanLockedRef.current = false;
          } finally {
            setProcessing(false);
          }
        },
        () => {
          // Ignore normal "QR not found yet" scanner messages.
        },
      );

      scannerRunningRef.current = true;
      setScanning(true);
      setScannerReady(true);
    } catch (err) {
      console.error(err);

      setScannerReady(false);
      setScanning(false);
      scannerRunningRef.current = false;

      setError(
        "Unable to start the camera. Please allow camera access and try again.",
      );

      try {
        scanner.clear();
      } catch {
        // Ignore cleanup errors.
      }
    }
  }

  useEffect(() => {
    void checkStaffAccess();

    return () => {
      void stopScanner();
    };
  }, []);

  useEffect(() => {
    if (authorized) {
      // Give the page a moment to render the scanner container.
      const timer = window.setTimeout(() => {
        void startScanner();
      }, 300);

      return () => window.clearTimeout(timer);
    }
  }, [authorized]);

  if (loading) {
    return (
      <main className="min-h-screen bg-background px-4 py-10">
        <div className="mx-auto flex max-w-md items-center justify-center">
          <div className="text-center">
            <RefreshCw className="mx-auto mb-3 size-8 animate-spin" />
            <p className="text-sm text-muted-foreground">
              Checking staff account...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="min-h-screen bg-background px-4 py-8">
        <div className="mx-auto max-w-md">
          <Button variant="ghost" asChild className="mb-6">
            <Link to="/staff">
              <ArrowLeft className="mr-2 size-4" />
              Back to Staff Portal
            </Link>
          </Button>

          <Card>
            <CardContent className="py-10 text-center">
              <XCircle className="mx-auto mb-4 size-12 text-destructive" />

              <h1 className="font-display text-2xl font-bold uppercase">
                Attendance Unavailable
              </h1>

              <p className="mt-2 text-sm text-muted-foreground">
                {error || "Your account cannot use staff attendance yet."}
              </p>

              <Button asChild className="mt-6">
                <Link to="/staff">Return to Staff Portal</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6 pb-10">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <Button variant="ghost" asChild>
            <Link to="/staff">
              <ArrowLeft className="mr-2 size-4" />
              Staff Portal
            </Link>
          </Button>

          <Badge variant="outline">Staff Attendance</Badge>
        </div>

        <div className="mb-6 text-center">
          <h1 className="font-display text-3xl font-black uppercase tracking-tight">
            Scan Attendance QR
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Scan the Super Plus Fitness attendance QR code to clock in or
            clock out.
          </p>
        </div>

        {result ? (
          <Card className="overflow-hidden">
            <CardContent className="py-10 text-center">
              <CheckCircle2 className="mx-auto mb-5 size-16 text-green-600" />

              <Badge
                className="mb-4"
                variant={
                  result.action === "clock_in" ? "default" : "secondary"
                }
              >
                {result.action === "clock_in"
                  ? "CLOCKED IN"
                  : "CLOCKED OUT"}
              </Badge>

              <h2 className="font-display text-2xl font-bold uppercase">
                {result.staff_name || staffName}
              </h2>

              <div className="mt-6 space-y-3 text-sm">
                {result.action === "clock_in" ? (
                  <div className="flex items-center justify-center gap-2">
                    <LogIn className="size-4" />
                    <span>
                      Clock-in:{" "}
                      <strong>{formatTime(result.checked_in_at)}</strong>
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-center gap-2">
                      <LogIn className="size-4" />
                      <span>
                        Clock-in:{" "}
                        <strong>{formatTime(result.checked_in_at)}</strong>
                      </span>
                    </div>

                    <div className="flex items-center justify-center gap-2">
                      <LogOut className="size-4" />
                      <span>
                        Clock-out:{" "}
                        <strong>{formatTime(result.checked_out_at)}</strong>
                      </span>
                    </div>
                  </>
                )}
              </div>

              <Button
                className="mt-8 w-full"
                onClick={() => {
                  setResult(null);
                  setError("");
                  void startScanner();
                }}
              >
                <RefreshCw className="mr-2 size-4" />
                Scan Again
              </Button>

              <Button
                variant="outline"
                asChild
                className="mt-3 w-full"
              >
                <Link to="/staff">Back to Staff Portal</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-3 text-center">
                <CardTitle className="flex items-center justify-center gap-2">
                  <Camera className="size-5" />
                  Attendance Scanner
                </CardTitle>

                <p className="text-sm text-muted-foreground">
                  Staff: <strong>{staffName}</strong>
                </p>
              </CardHeader>

              <CardContent>
                <div
                  id="staff-attendance-reader"
                  className="overflow-hidden rounded-xl border bg-black"
                />

                {!scanning && !processing && (
                  <Button
                    className="mt-4 w-full"
                    onClick={() => void startScanner()}
                  >
                    <Camera className="mr-2 size-4" />
                    Start Camera
                  </Button>
                )}

                {scanning && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Camera className="size-4" />
                    Point your camera at the gym attendance QR code.
                  </div>
                )}

                {processing && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-sm font-medium">
                    <RefreshCw className="size-4 animate-spin" />
                    Recording attendance...
                  </div>
                )}

                {scannerReady && !scanning && !processing && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Clock3 className="size-4" />
                    Scanner ready.
                  </div>
                )}

                {error && (
                  <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-center text-sm text-destructive">
                    {error}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardContent className="py-5">
                <div className="text-center text-sm">
                  <p className="font-semibold">How it works</p>

                  <div className="mt-3 space-y-2 text-muted-foreground">
                    <p>1. Scan the QR code displayed at the gym.</p>
                    <p>2. First scan = Clock In.</p>
                    <p>3. Next scan = Clock Out.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}

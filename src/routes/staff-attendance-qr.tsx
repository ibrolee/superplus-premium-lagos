import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, Printer, ShieldCheck } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/staff-attendance-qr")({
  component: StaffAttendanceQrPage,
});

const ATTENDANCE_CODE = "SPF-GYM-ATTENDANCE-2026";

function StaffAttendanceQrPage() {
  const qrRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function checkAccess() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setError("You must be logged in.");
          return;
        }

        const { data: staffUser, error: staffError } = await supabase
          .from("staff_users")
          .select("role, active")
          .eq("auth_user_id", user.id)
          .maybeSingle();

        if (staffError) {
          throw staffError;
        }

        const role = String(staffUser?.role || "").toLowerCase();

        if (!staffUser?.active || !["admin", "owner", "manager"].includes(role)) {
          setError("You do not have permission to view this QR code.");
          return;
        }

        setAuthorized(true);
      } catch (err) {
        console.error(err);
        setError("Unable to verify management access.");
      } finally {
        setLoading(false);
      }
    }

    void checkAccess();
  }, []);

  function printQr() {
    window.print();
  }

  function downloadQr() {
    const svg = qrRef.current?.querySelector("svg");

    if (!svg) return;

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);

    const svgBlob = new Blob([svgString], {
      type: "image/svg+xml;charset=utf-8",
    });

    const url = URL.createObjectURL(svgBlob);

    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 1200;

      const context = canvas.getContext("2d");

      if (!context) {
        URL.revokeObjectURL(url);
        return;
      }

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);

      context.drawImage(image, 100, 100, 1000, 1000);

      URL.revokeObjectURL(url);

      const link = document.createElement("a");
      link.download = "super-plus-fitness-staff-attendance-qr.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    };

    image.src = url;
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-background px-4 py-10">
        <div className="mx-auto max-w-md text-center">
          <p className="text-sm text-muted-foreground">Checking management access...</p>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="min-h-screen bg-background px-4 py-10">
        <div className="mx-auto max-w-md">
          <Card>
            <CardContent className="py-10 text-center">
              <ShieldCheck className="mx-auto mb-4 size-12" />

              <h1 className="font-display text-2xl font-bold uppercase">Access Restricted</h1>

              <p className="mt-2 text-sm text-muted-foreground">{error}</p>

              <Button asChild className="mt-6">
                <Link to="/staff">Back to Staff Portal</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between print:hidden">
          <Button variant="outline" asChild>
            <Link to="/staff">← Staff Portal</Link>
          </Button>

          <Badge variant="outline">Management</Badge>
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="text-center">
            <CardTitle className="font-display text-3xl font-black uppercase">
              Staff Attendance QR
            </CardTitle>

            <p className="text-sm text-muted-foreground print:hidden">
              Print this QR code and place it at the gym reception/entrance.
            </p>
          </CardHeader>

          <CardContent>
            <div
              ref={qrRef}
              className="mx-auto max-w-lg rounded-2xl border bg-white p-8 text-center"
            >
              <div className="mb-5">
                <h2 className="font-display text-2xl font-black uppercase tracking-tight text-black">
                  Super Plus Fitness & Spa
                </h2>

                <p className="mt-1 text-sm font-semibold text-black">STAFF ATTENDANCE</p>
              </div>

              <div className="mx-auto flex justify-center">
                <QRCodeSVG value={ATTENDANCE_CODE} size={360} level="H" includeMargin />
              </div>

              <div className="mt-6">
                <p className="text-xl font-black uppercase text-black">
                  Scan to Clock In / Clock Out
                </p>

                <p className="mt-2 text-sm text-black">
                  Staff members must scan this QR code using the Staff Portal.
                </p>
              </div>

              <div className="mt-6 border-t border-black/20 pt-4">
                <p className="text-xs text-black">No. 105 Apata Street, Shomolu, Lagos</p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 print:hidden">
              <Button type="button" variant="outline" onClick={downloadQr}>
                <Download className="mr-2 size-4" />
                Download QR
              </Button>

              <Button type="button" onClick={printQr}>
                <Printer className="mr-2 size-4" />
                Print QR
              </Button>
            </div>

            <div className="mt-6 rounded-lg border bg-muted/40 p-4 text-center text-sm text-muted-foreground print:hidden">
              <p className="font-semibold text-foreground">Important</p>

              <p className="mt-1">
                Keep this QR code at the gym. Staff should not use a personal staff QR code for
                attendance.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

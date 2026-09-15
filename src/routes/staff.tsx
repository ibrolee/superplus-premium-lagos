import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  Phone,
  QrCode,
  ShieldCheck,
  UserRound,
  Wallet,
  XCircle,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/staff")({
  head: () => ({
    meta: [
      {
        title: "Staff Portal — Super Plus Fitness",
      },
      {
        name: "description",
        content:
          "Super Plus Fitness staff portal.",
      },
    ],
  }),
  component: StaffPortalPage,
});

type StaffProfile = {
  id: string;
  auth_user_id: string;
  staff_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  birth_day: number | null;
  birth_month: number | null;
  address: string | null;
  position: string | null;
  department: string | null;
  employment_type: string | null;
  employment_date: string | null;
  role: string;
  status: string;
  qr_token: string;
};

type SalaryRecord = {
  id: string;
  amount: number;
  currency: string;
  pay_period_start: string | null;
  pay_period_end: string | null;
  payment_date: string | null;
  status: string;
  notes: string | null;
};

type AttendanceRecord = {
  id: string;
  checked_in_at: string;
  checked_out_at: string | null;
};

function formatMoney(
  amount: number,
) {
  return `₦${Number(amount || 0).toLocaleString(
    "en-NG",
  )}`;
}

function formatDate(
  value: string | null,
) {
  if (!value) return "Not available";

  return new Intl.DateTimeFormat(
    "en-NG",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    },
  ).format(
    new Date(`${value}T00:00:00`),
  );
}

function formatDateTime(
  value: string,
) {
  return new Intl.DateTimeFormat(
    "en-NG",
    {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    },
  ).format(new Date(value));
}

function formatDuration(
  start: string,
  end: string | null,
) {
  const startDate = new Date(start);
  const endDate = end
    ? new Date(end)
    : new Date();

  const minutes = Math.max(
    0,
    Math.round(
      (endDate.getTime() -
        startDate.getTime()) /
        60000,
    ),
  );

  const hours = Math.floor(
    minutes / 60,
  );

  const mins = minutes % 60;

  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }

  return `${mins}m`;
}

function StaffPortalPage() {
  const [loading, setLoading] =
    useState(true);

  const [profile, setProfile] =
    useState<StaffProfile | null>(
      null,
    );

  const [salary, setSalary] =
    useState<SalaryRecord[]>([]);

  const [attendance, setAttendance] =
    useState<AttendanceRecord[]>(
      [],
    );

  const [mode, setMode] =
    useState<
      "login" | "register"
    >("login");

  const [fullName, setFullName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  const [loggingOut, setLoggingOut] =
    useState(false);

  const [editingProfile, setEditingProfile] =
    useState(false);

  const [address, setAddress] =
    useState("");

  async function loadStaff() {
    setLoading(true);
    setError("");

    const {
      data: {
        session,
      },
    } =
      await supabase.auth.getSession();

    if (!session) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const {
      data,
      error: profileError,
    } = await supabase
      .from("staff_profiles")
      .select("*")
      .eq(
        "auth_user_id",
        session.user.id,
      )
      .maybeSingle();

    if (profileError) {
      setError(
        profileError.message,
      );
      setLoading(false);
      return;
    }

    if (!data) {
      await supabase.auth.signOut();

      setProfile(null);
      setError(
        "No staff profile was found for this account.",
      );
      setLoading(false);
      return;
    }

    setProfile(
      data as StaffProfile,
    );

    setAddress(
      data.address || "",
    );

    if (
      data.status ===
      "approved"
    ) {
      await loadStaffData(
        data.id,
      );
    }

    setLoading(false);
  }

  async function loadStaffData(
    staffProfileId: string,
  ) {
    const [
      salaryResult,
      attendanceResult,
    ] =
      await Promise.all([
        supabase
          .from(
            "staff_salary_records",
          )
          .select(
            "id, amount, currency, pay_period_start, pay_period_end, payment_date, status, notes",
          )
          .eq(
            "staff_profile_id",
            staffProfileId,
          )
          .order(
            "payment_date",
            {
              ascending: false,
            },
          ),

        supabase
          .from(
            "staff_attendance",
          )
          .select(
            "id, checked_in_at, checked_out_at",
          )
          .eq(
            "staff_profile_id",
            staffProfileId,
          )
          .order(
            "checked_in_at",
            {
              ascending: false,
            },
          )
          .limit(50),
      ]);

    if (!salaryResult.error) {
      setSalary(
        (salaryResult.data ||
          []) as SalaryRecord[],
      );
    }

    if (
      !attendanceResult.error
    ) {
      setAttendance(
        (attendanceResult.data ||
          []) as AttendanceRecord[],
      );
    }
  }

  useEffect(() => {
    loadStaff();

    const {
      data: listener,
    } =
      supabase.auth.onAuthStateChange(
        () => {
          loadStaff();
        },
      );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleLogin(
    event: FormEvent,
  ) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setMessage("");

    const {
      error: loginError,
    } =
      await supabase.auth.signInWithPassword(
        {
          email:
            email.trim(),
          password,
        },
      );

    if (loginError) {
      setError(
        loginError.message,
      );
      setSaving(false);
      return;
    }

    await loadStaff();

    setSaving(false);
  }

  async function handleRegister(
    event: FormEvent,
  ) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setMessage("");

    if (
      password.length < 8
    ) {
      setError(
        "Password must be at least 8 characters.",
      );
      setSaving(false);
      return;
    }

    if (
      password !==
      confirmPassword
    ) {
      setError(
        "Passwords do not match.",
      );
      setSaving(false);
      return;
    }

    const {
      data,
      error: signupError,
    } =
      await supabase.auth.signUp({
        email:
          email.trim(),
        password,
        options: {
          data: {
            account_type:
              "staff",
            full_name:
              fullName.trim(),
            phone:
              phone.trim(),
          },
          emailRedirectTo:
            `${window.location.origin}/staff`,
        },
      });

    if (signupError) {
      setError(
        signupError.message,
      );
      setSaving(false);
      return;
    }

    if (data.session) {
      await loadStaff();
    } else {
      setMessage(
        "Registration received. Check your email to confirm your account. After confirmation, return to the Staff Portal and log in.",
      );
    }

    setSaving(false);
  }

  async function saveProfile(
    event: FormEvent,
  ) {
    event.preventDefault();

    if (!profile) return;

    setSaving(true);
    setError("");
    setMessage("");

    const {
      error: updateError,
    } =
      await supabase
        .from("staff_profiles")
        .update({
          phone:
            phone.trim() ||
            null,
          address:
            address.trim() ||
            null,
        })
        .eq(
          "id",
          profile.id,
        );

    if (updateError) {
      setError(
        updateError.message,
      );
    } else {
      setMessage(
        "Profile updated successfully.",
      );

      setEditingProfile(
        false,
      );

      await loadStaff();
    }

    setSaving(false);
  }

  async function handleClockIn() {
    if (!profile) return;

    setSaving(true);
    setError("");

    const {
      data: openVisit,
    } =
      await supabase
        .from(
          "staff_attendance",
        )
        .select("id")
        .eq(
          "staff_profile_id",
          profile.id,
        )
        .is(
          "checked_out_at",
          null,
        )
        .limit(1)
        .maybeSingle();

    if (openVisit) {
      setError(
        "You are already checked in.",
      );
      setSaving(false);
      return;
    }

    const {
      error: clockError,
    } =
      await supabase
        .from(
          "staff_attendance",
        )
        .insert({
          staff_profile_id:
            profile.id,
        });

    if (clockError) {
      setError(
        clockError.message,
      );
    } else {
      await loadStaffData(
        profile.id,
      );
    }

    setSaving(false);
  }

  async function handleClockOut() {
    if (!profile) return;

    setSaving(true);
    setError("");

    const {
      data: openVisit,
      error: findError,
    } =
      await supabase
        .from(
          "staff_attendance",
        )
        .select("id")
        .eq(
          "staff_profile_id",
          profile.id,
        )
        .is(
          "checked_out_at",
          null,
        )
        .order(
          "checked_in_at",
          {
            ascending: false,
          },
        )
        .limit(1)
        .maybeSingle();

    if (findError) {
      setError(
        findError.message,
      );
      setSaving(false);
      return;
    }

    if (!openVisit) {
      setError(
        "You are not currently checked in.",
      );
      setSaving(false);
      return;
    }

    const {
      error: clockError,
    } =
      await supabase
        .from(
          "staff_attendance",
        )
        .update({
          checked_out_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          openVisit.id,
        );

    if (clockError) {
      setError(
        clockError.message,
      );
    } else {
      await loadStaffData(
        profile.id,
      );
    }

    setSaving(false);
  }

  async function downloadQr() {
    const canvas =
      document.querySelector(
        "#staff-profile-qr",
      ) as SVGSVGElement | null;

    if (!canvas || !profile) {
      return;
    }

    const svgData =
      new XMLSerializer().serializeToString(
        canvas,
      );

    const svgBlob =
      new Blob(
        [svgData],
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
      const canvasElement =
        document.createElement(
          "canvas",
        );

      canvasElement.width = 1000;
      canvasElement.height = 1000;

      const context =
        canvasElement.getContext(
          "2d",
        );

      if (!context) return;

      context.fillStyle =
        "#ffffff";

      context.fillRect(
        0,
        0,
        1000,
        1000,
      );

      context.drawImage(
        image,
        100,
        100,
        800,
        800,
      );

      const link =
        document.createElement(
          "a",
        );

      link.download =
        `${profile.staff_id}-qr.png`;

      link.href =
        canvasElement.toDataURL(
          "image/png",
        );

      link.click();

      URL.revokeObjectURL(
        url,
      );
    };

    image.src = url;
  }

  async function handleLogout() {
    setLoggingOut(true);

    await supabase.auth.signOut();

    setProfile(null);
    setSalary([]);
    setAttendance([]);

    setLoggingOut(false);
  }

  if (loading) {
    return (
      <main className="min-h-[70vh] bg-muted py-20">
        <div className="section-shell flex min-h-[50vh] items-center justify-center">
          <div className="flex items-center gap-3 text-sm font-bold uppercase">
            <Clock3 className="size-5 animate-spin" />
            Loading staff portal...
          </div>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-[75vh] bg-muted py-12 sm:py-20">
        <div className="section-shell">
          <div className="mx-auto max-w-lg border border-border bg-background p-7 shadow-sm sm:p-10">

            <div className="mx-auto flex size-14 items-center justify-center bg-primary text-primary-foreground">
              <BriefcaseBusiness className="size-7" />
            </div>

            <p className="mt-6 text-center text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
              Super Plus Fitness
            </p>

            <h1 className="display-title mt-3 text-center text-4xl sm:text-5xl">
              Staff Portal
            </h1>

            <p className="mt-3 text-center text-sm text-muted-foreground">
              Staff members can register and access their employee information here.
            </p>

            <div className="mt-8 grid grid-cols-2 border border-border">
              <button
                type="button"
                onClick={() =>
                  setMode("login")
                }
                className={`p-4 text-xs font-extrabold uppercase ${
                  mode === "login"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background"
                }`}
              >
                Login
              </button>

              <button
                type="button"
                onClick={() =>
                  setMode(
                    "register",
                  )
                }
                className={`p-4 text-xs font-extrabold uppercase ${
                  mode === "register"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background"
                }`}
              >
                Register
              </button>
            </div>

            {error && (
              <div className="mt-5 border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                {error}
              </div>
            )}

            {message && (
              <div className="mt-5 border border-green-600/30 bg-green-600/10 p-4 text-sm text-green-700">
                {message}
              </div>
            )}

            {mode ===
            "login" ? (
              <form
                onSubmit={
                  handleLogin
                }
                className="mt-7 space-y-5"
              >
                <div>
                  <label className="text-xs font-extrabold uppercase">
                    Email
                  </label>

                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(event) =>
                      setEmail(
                        event.target
                          .value,
                      )
                    }
                    className="mt-2 h-12 w-full rounded-md border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div>
                  <label className="text-xs font-extrabold uppercase">
                    Password
                  </label>

                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(event) =>
                      setPassword(
                        event.target
                          .value,
                      )
                    }
                    className="mt-2 h-12 w-full rounded-md border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={
                    saving
                  }
                  className="h-12 w-full"
                >
                  {saving ? (
                    "Signing in..."
                  ) : (
                    <>
                      <LogIn />
                      Staff Login
                    </>
                  )}
                </Button>
              </form>
            ) : (
              <form
                onSubmit={
                  handleRegister
                }
                className="mt-7 space-y-5"
              >
                <div>
                  <label className="text-xs font-extrabold uppercase">
                    Full Name
                  </label>

                  <input
                    required
                    value={fullName}
                    onChange={(event) =>
                      setFullName(
                        event.target
                          .value,
                      )
                    }
                    className="mt-2 h-12 w-full rounded-md border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div>
                  <label className="text-xs font-extrabold uppercase">
                    Email
                  </label>

                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(event) =>
                      setEmail(
                        event.target
                          .value,
                      )
                    }
                    className="mt-2 h-12 w-full rounded-md border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div>
                  <label className="text-xs font-extrabold uppercase">
                    Phone
                  </label>

                  <input
                    type="tel"
                    value={phone}
                    onChange={(event) =>
                      setPhone(
                        event.target
                          .value,
                      )
                    }
                    className="mt-2 h-12 w-full rounded-md border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div>
                  <label className="text-xs font-extrabold uppercase">
                    Password
                  </label>

                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(event) =>
                      setPassword(
                        event.target
                          .value,
                      )
                    }
                    className="mt-2 h-12 w-full rounded-md border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div>
                  <label className="text-xs font-extrabold uppercase">
                    Confirm Password
                  </label>

                  <input
                    type="password"
                    required
                    value={
                      confirmPassword
                    }
                    onChange={(
                      event,
                    ) =>
                      setConfirmPassword(
                        event.target
                          .value,
                      )
                    }
                    className="mt-2 h-12 w-full rounded-md border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={
                    saving
                  }
                  className="h-12 w-full"
                >
                  {saving
                    ? "Creating account..."
                    : "Create Staff Account"}
                </Button>

                <p className="text-center text-xs leading-5 text-muted-foreground">
                  Registration does not automatically grant staff access. Management must approve the account.
                </p>
              </form>
            )}
          </div>
        </div>
      </main>
    );
  }

  if (
    profile.status !==
    "approved"
  ) {
    return (
      <main className="min-h-[75vh] bg-muted py-20">
        <div className="section-shell">
          <div className="mx-auto max-w-lg border border-border bg-background p-8 text-center shadow-sm">

            <div className="mx-auto flex size-14 items-center justify-center bg-primary/10 text-primary">
              <ShieldCheck className="size-7" />
            </div>

            <h1 className="display-title mt-6 text-4xl">
              Account Pending
            </h1>

            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Your staff account has been created successfully, but management has not approved it yet.
            </p>

            <div className="mt-6 flex items-center justify-center gap-2 bg-primary/10 px-4 py-3 text-xs font-extrabold uppercase text-primary">
              <Clock3 className="size-4" />
              Awaiting Approval
            </div>

            <Button
              variant="outline"
              onClick={
                handleLogout
              }
              className="mt-6"
            >
              <LogOut />
              Log Out
            </Button>
          </div>
        </div>
      </main>
    );
  }

  const currentlyClockedIn =
    attendance.some(
      (record) =>
        !record.checked_out_at,
    );

  return (
    <main className="min-h-[75vh] bg-muted py-10 sm:py-16">
      <div className="section-shell">
        <div className="mx-auto max-w-6xl">

          {/* HEADER */}
          <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
                Super Plus Fitness
              </p>

              <h1 className="display-title mt-3 text-4xl sm:text-6xl">
                Staff Portal
              </h1>

              <p className="mt-3 text-sm text-muted-foreground">
                Welcome,{" "}
                <strong>
                  {profile.full_name}
                </strong>
              </p>
            </div>

            <Button
              variant="outline"
              onClick={
                handleLogout
              }
              disabled={
                loggingOut
              }
            >
              <LogOut />
              {loggingOut
                ? "Logging out..."
                : "Log Out"}
            </Button>
          </div>

          {error && (
            <div className="mb-6 border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {message && (
            <div className="mb-6 border border-green-600/30 bg-green-600/10 p-4 text-sm text-green-700">
              {message}
            </div>
          )}

          {/* PROFILE SUMMARY */}
          <section className="grid gap-4 md:grid-cols-3">

            <div className="border border-border bg-background p-6 shadow-sm md:col-span-2">
              <div className="flex items-start gap-5">
                <div className="flex size-16 shrink-0 items-center justify-center bg-primary text-primary-foreground">
                  <UserRound className="size-8" />
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-primary">
                    Staff Member
                  </p>

                  <h2 className="mt-1 font-display text-3xl font-bold uppercase sm:text-4xl">
                    {profile.full_name}
                  </h2>

                  <p className="mt-2 text-sm text-muted-foreground">
                    {profile.position ||
                      "Staff Member"}
                    {profile.department
                      ? ` • ${profile.department}`
                      : ""}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="bg-green-600/10 px-3 py-1.5 text-[10px] font-extrabold uppercase text-green-700">
                      Active Staff
                    </span>

                    <span className="bg-muted px-3 py-1.5 text-[10px] font-extrabold uppercase">
                      {profile.staff_id}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="border border-border bg-background p-6 shadow-sm">
              <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-primary">
                Staff ID
              </p>

              <p className="mt-3 font-display text-3xl font-black">
                {profile.staff_id}
              </p>

              <p className="mt-2 text-xs text-muted-foreground">
                Use this ID when communicating with management.
              </p>
            </div>
          </section>

          {/* CLOCK IN */}
          <section className="mt-8 border border-border bg-background p-6 shadow-sm">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">

              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-primary">
                  Today's Attendance
                </p>

                <h2 className="mt-2 font-display text-3xl font-bold uppercase">
                  {currentlyClockedIn
                    ? "You Are Clocked In"
                    : "You Are Clocked Out"}
                </h2>

                <p className="mt-2 text-sm text-muted-foreground">
                  Record your working hours directly from the staff portal.
                </p>
              </div>

              <div className="flex w-full gap-3 md:w-auto">
                {!currentlyClockedIn ? (
                  <Button
                    onClick={
                      handleClockIn
                    }
                    disabled={
                      saving
                    }
                    className="w-full md:w-auto"
                  >
                    <LogIn />
                    Clock In
                  </Button>
                ) : (
                  <Button
                    onClick={
                      handleClockOut
                    }
                    disabled={
                      saving
                    }
                    className="w-full md:w-auto"
                  >
                    <LogOut />
                    Clock Out
                  </Button>
                )}
              </div>
            </div>
          </section>

          {/* PERSONAL INFORMATION */}
          <section className="mt-8">
            <details
              open
              className="group"
            >
              <summary className="cursor-pointer list-none border border-border bg-background p-5 shadow-sm [&::-webkit-details-marker]:hidden">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-primary">
                      Profile
                    </p>

                    <h2 className="mt-2 font-display text-3xl font-bold uppercase">
                      Personal Information
                    </h2>
                  </div>

                  <UserRound className="size-6 text-primary" />
                </div>
              </summary>

              <div className="mt-3 border border-border bg-background p-6 shadow-sm">
                {!editingProfile ? (
                  <>
                    <div className="grid gap-5 sm:grid-cols-2">

                      <div>
                        <p className="text-[10px] font-extrabold uppercase text-muted-foreground">
                          Full Name
                        </p>

                        <p className="mt-1 font-bold">
                          {profile.full_name}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] font-extrabold uppercase text-muted-foreground">
                          Email
                        </p>

                        <p className="mt-1 font-bold">
                          {profile.email ||
                            "Not available"}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] font-extrabold uppercase text-muted-foreground">
                          Phone
                        </p>

                        <p className="mt-1 font-bold">
                          {profile.phone ||
                            "Not available"}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] font-extrabold uppercase text-muted-foreground">
                          Address
                        </p>

                        <p className="mt-1 font-bold">
                          {profile.address ||
                            "Not available"}
                        </p>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      onClick={() =>
                        setEditingProfile(
                          true,
                        )
                      }
                      className="mt-6"
                    >
                      Edit Contact Information
                    </Button>
                  </>
                ) : (
                  <form
                    onSubmit={
                      saveProfile
                    }
                    className="space-y-5"
                  >
                    <div>
                      <label className="text-xs font-extrabold uppercase">
                        Phone
                      </label>

                      <input
                        value={
                          phone
                        }
                        onChange={(
                          event,
                        ) =>
                          setPhone(
                            event.target
                              .value,
                          )
                        }
                        className="mt-2 h-12 w-full rounded-md border border-input px-4 text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-extrabold uppercase">
                        Address
                      </label>

                      <textarea
                        value={
                          address
                        }
                        onChange={(
                          event,
                        ) =>
                          setAddress(
                            event.target
                              .value,
                          )
                        }
                        rows={3}
                        className="mt-2 w-full rounded-md border border-input px-4 py-3 text-sm"
                      />
                    </div>

                    <div className="flex gap-3">
                      <Button
                        type="submit"
                        disabled={
                          saving
                        }
                      >
                        Save Changes
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setEditingProfile(
                            false,
                          )
                        }
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </details>
          </section>

          {/* JOB INFORMATION */}
          <section className="mt-8">
            <details className="group">
              <summary className="cursor-pointer list-none border border-border bg-background p-5 shadow-sm [&::-webkit-details-marker]:hidden">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-primary">
                      Employment
                    </p>

                    <h2 className="mt-2 font-display text-3xl font-bold uppercase">
                      Job Information
                    </h2>
                  </div>

                  <BriefcaseBusiness className="size-6 text-primary" />
                </div>
              </summary>

              <div className="mt-3 grid gap-4 border border-border bg-background p-6 shadow-sm sm:grid-cols-2 lg:grid-cols-3">

                <div>
                  <p className="text-[10px] font-extrabold uppercase text-muted-foreground">
                    Position
                  </p>

                  <p className="mt-1 font-bold">
                    {profile.position ||
                      "Not assigned"}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-extrabold uppercase text-muted-foreground">
                    Department
                  </p>

                  <p className="mt-1 font-bold">
                    {profile.department ||
                      "Not assigned"}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-extrabold uppercase text-muted-foreground">
                    Employment Type
                  </p>

                  <p className="mt-1 font-bold">
                    {profile.employment_type ||
                      "Not specified"}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-extrabold uppercase text-muted-foreground">
                    Employment Date
                  </p>

                  <p className="mt-1 font-bold">
                    {formatDate(
                      profile.employment_date,
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-extrabold uppercase text-muted-foreground">
                    Staff ID
                  </p>

                  <p className="mt-1 font-bold">
                    {profile.staff_id}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-extrabold uppercase text-muted-foreground">
                    Status
                  </p>

                  <p className="mt-1 font-bold uppercase">
                    {profile.status}
                  </p>
                </div>
              </div>
            </details>
          </section>

          {/* SALARY */}
          <section className="mt-8">
            <details className="group">
              <summary className="cursor-pointer list-none border border-border bg-background p-5 shadow-sm [&::-webkit-details-marker]:hidden">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-primary">
                      Payroll
                    </p>

                    <h2 className="mt-2 font-display text-3xl font-bold uppercase">
                      Salary History
                    </h2>
                  </div>

                  <Wallet className="size-6 text-primary" />
                </div>
              </summary>

              <div className="mt-3 overflow-hidden border border-border bg-background shadow-sm">

                {salary.length ===
                0 ? (
                  <div className="p-8 text-center">
                    <Wallet className="mx-auto size-8 text-muted-foreground" />

                    <p className="mt-4 font-bold uppercase">
                      No Salary Records Yet
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {salary.map(
                      (record) => (
                        <div
                          key={
                            record.id
                          }
                          className="grid gap-4 p-5 md:grid-cols-[1fr_160px_140px]"
                        >
                          <div>
                            <p className="font-bold">
                              {record.pay_period_start &&
                              record.pay_period_end
                                ? `${formatDate(
                                    record.pay_period_start,
                                  )} – ${formatDate(
                                    record.pay_period_end,
                                  )}`
                                : "Salary period"}
                            </p>

                            {record.notes && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {
                                  record.notes
                                }
                              </p>
                            )}
                          </div>

                          <div>
                            <p className="font-display text-2xl font-bold">
                              {formatMoney(
                                record.amount,
                              )}
                            </p>
                          </div>

                          <div>
                            <span
                              className={`inline-flex px-3 py-1.5 text-[10px] font-extrabold uppercase ${
                                record.status ===
                                "paid"
                                  ? "bg-green-600/10 text-green-700"
                                  : "bg-primary/10 text-primary"
                              }`}
                            >
                              {
                                record.status
                              }
                            </span>

                            {record.payment_date && (
                              <p className="mt-2 text-xs text-muted-foreground">
                                Paid{" "}
                                {formatDate(
                                  record.payment_date,
                                )}
                              </p>
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

          {/* ATTENDANCE */}
          <section className="mt-8">
            <details className="group">
              <summary className="cursor-pointer list-none border border-border bg-background p-5 shadow-sm [&::-webkit-details-marker]:hidden">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-primary">
                      Timekeeping
                    </p>

                    <h2 className="mt-2 font-display text-3xl font-bold uppercase">
                      Attendance History
                    </h2>
                  </div>

                  <CalendarDays className="size-6 text-primary" />
                </div>
              </summary>

              <div className="mt-3 overflow-hidden border border-border bg-background shadow-sm">
                {attendance.length ===
                0 ? (
                  <div className="p-8 text-center">
                    <CalendarDays className="mx-auto size-8 text-muted-foreground" />

                    <p className="mt-4 font-bold uppercase">
                      No Attendance Records
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {attendance.map(
                      (record) => (
                        <div
                          key={
                            record.id
                          }
                          className="grid gap-4 p-5 md:grid-cols-[1fr_1fr_140px]"
                        >
                          <div>
                            <p className="text-[10px] font-extrabold uppercase text-muted-foreground">
                              Check-In
                            </p>

                            <p className="mt-1 font-bold">
                              {formatDateTime(
                                record.checked_in_at,
                              )}
                            </p>
                          </div>

                          <div>
                            <p className="text-[10px] font-extrabold uppercase text-muted-foreground">
                              Check-Out
                            </p>

                            <p className="mt-1 font-bold">
                              {record.checked_out_at
                                ? formatDateTime(
                                    record.checked_out_at,
                                  )
                                : "Still working"}
                            </p>
                          </div>

                          <div>
                            <p className="text-[10px] font-extrabold uppercase text-muted-foreground">
                              Duration
                            </p>

                            <p className="mt-1 font-bold">
                              {formatDuration(
                                record.checked_in_at,
                                record.checked_out_at,
                              )}
                            </p>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>
            </details>
          </section>

          {/* QR */}
          <section className="mt-8">
            <details className="group">
              <summary className="cursor-pointer list-none border border-border bg-background p-5 shadow-sm [&::-webkit-details-marker]:hidden">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-primary">
                      Identification
                    </p>

                    <h2 className="mt-2 font-display text-3xl font-bold uppercase">
                      Staff QR Code
                    </h2>
                  </div>

                  <QrCode className="size-6 text-primary" />
                </div>
              </summary>

              <div className="mt-3 border border-border bg-background p-8 shadow-sm">

                <div className="mx-auto flex max-w-md flex-col items-center text-center">

                  <div className="border border-border bg-white p-6">
                    <QRCodeSVG
                      id="staff-profile-qr"
                      value={`STAFF:${profile.qr_token}`}
                      size={260}
                      level="H"
                      includeMargin
                    />
                  </div>

                  <h3 className="mt-6 font-display text-2xl font-bold uppercase">
                    {profile.full_name}
                  </h3>

                  <p className="mt-1 text-sm text-muted-foreground">
                    {profile.staff_id}
                  </p>

                  <p className="mt-4 max-w-sm text-xs leading-5 text-muted-foreground">
                    Keep this QR code available for staff attendance and identification.
                  </p>

                  <Button
                    onClick={
                      downloadQr
                    }
                    className="mt-6"
                  >
                    <Download />
                    Download QR Code
                  </Button>
                </div>
              </div>
            </details>
          </section>

          <div className="mt-10 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-4" />
            <span>
              Super Plus Fitness &amp; Spa — Staff Portal
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
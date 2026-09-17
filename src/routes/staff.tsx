import { useEffect, useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  LogIn,
  LogOut,
  QrCode,
  ScanLine,
  ShieldCheck,
  UserRound,
  Wallet,
  XCircle,
  KeyRound,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/staff")({
  component: StaffPage,
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
  status: "pending" | "approved" | "suspended" | "inactive";
  qr_token: string;
  created_at: string;
};

type SalaryRecord = {
  id: string;
  amount: number;
  currency: string;
  pay_period_start: string | null;
  pay_period_end: string | null;
  payment_date: string | null;
  status: "pending" | "paid" | "cancelled";
  notes: string | null;
  created_at: string;
};

type AttendanceRecord = {
  id: string;
  checked_in_at: string;
  checked_out_at: string | null;
  notes: string | null;
  created_at: string;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00`));
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Lagos",
  }).format(new Date(value));
}

function formatMoney(amount: number, currency = "NGN") {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

function statusLabel(status: StaffProfile["status"]) {
  switch (status) {
    case "approved":
      return "Approved";
    case "suspended":
      return "Suspended";
    case "inactive":
      return "Inactive";
    default:
      return "Pending";
  }
}

function statusClass(status: StaffProfile["status"]) {
  switch (status) {
    case "approved":
      return "border-green-500/30 bg-green-500/10 text-green-700";
    case "suspended":
      return "border-red-500/30 bg-red-500/10 text-red-700";
    case "inactive":
      return "border-gray-400/30 bg-gray-400/10 text-gray-600";
    default:
      return "border-orange-500/30 bg-orange-500/10 text-orange-700";
  }
}

function durationLabel(
  checkedIn: string,
  checkedOut: string | null,
) {
  const start = new Date(checkedIn).getTime();

  const end = checkedOut
    ? new Date(checkedOut).getTime()
    : Date.now();

  const minutes = Math.max(
    0,
    Math.floor((end - start) / 60000),
  );

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m`;
  }

  return `${remainingMinutes}m`;
}

function getRoleLabel(role: string) {
  const labels: Record<string, string> = {
    staff: "Staff",
    reception: "Reception",
    trainer: "Trainer",
    spa_staff: "Spa Staff",
    manager: "Manager",
    admin: "Admin",
    owner: "Owner",
  };

  return labels[role] || role;
}

function StaffPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [salaryRecords, setSalaryRecords] = useState<SalaryRecord[]>([]);
  const [attendanceRecords, setAttendanceRecords] =
    useState<AttendanceRecord[]>([]);

  const [isAdmin, setIsAdmin] = useState(false);

  const [loginMode, setLoginMode] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  const [forgotPasswordMode, setForgotPasswordMode] =
    useState(false);
  const [resetEmail, setResetEmail] = useState("");

  const [showProfile, setShowProfile] = useState(true);
  const [showEmployment, setShowEmployment] = useState(false);
  const [showSalary, setShowSalary] = useState(false);
  const [showAttendance, setShowAttendance] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const [editContact, setEditContact] = useState(false);
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");

  async function loadStaff() {
    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setProfile(null);
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    const { data: staffUser } = await supabase
      .from("staff_users")
      .select("id, role, active")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    const managementAccess =
      staffUser?.active === true &&
      ["admin", "owner", "manager"].includes(
        String(staffUser.role || "").toLowerCase(),
      );

    setIsAdmin(managementAccess);

    const { data: staffProfile, error: profileError } =
      await supabase
        .from("staff_profiles")
        .select(
          `
          id,
          auth_user_id,
          staff_id,
          full_name,
          email,
          phone,
          birth_day,
          birth_month,
          address,
          position,
          department,
          employment_type,
          employment_date,
          role,
          status,
          qr_token,
          created_at
        `,
        )
        .eq("auth_user_id", user.id)
        .maybeSingle();

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    if (!staffProfile) {
      setError("No staff profile was found for this account.");
      setLoading(false);
      return;
    }

    const staff = staffProfile as StaffProfile;

    setProfile(staff);
    setEditPhone(staff.phone || "");
    setEditAddress(staff.address || "");

    const [salaryResult, attendanceResult] = await Promise.all([
      supabase
        .from("staff_salary_records")
        .select(
          `
          id,
          amount,
          currency,
          pay_period_start,
          pay_period_end,
          payment_date,
          status,
          notes,
          created_at
        `,
        )
        .eq("staff_profile_id", staff.id)
        .order("created_at", { ascending: false }),

      supabase
        .from("staff_attendance")
        .select(
          `
          id,
          checked_in_at,
          checked_out_at,
          notes,
          created_at
        `,
        )
        .eq("staff_profile_id", staff.id)
        .order("checked_in_at", { ascending: false })
        .limit(100),
    ]);

    if (salaryResult.error) {
      setError(salaryResult.error.message);
      setLoading(false);
      return;
    }

    if (attendanceResult.error) {
      setError(attendanceResult.error.message);
      setLoading(false);
      return;
    }

    setSalaryRecords(
      (salaryResult.data || []) as SalaryRecord[],
    );

    setAttendanceRecords(
      (attendanceResult.data || []) as AttendanceRecord[],
    );

    setLoading(false);
  }

  async function sendPasswordReset() {
    const cleanEmail = resetEmail.trim().toLowerCase();

    if (!cleanEmail) {
      setError("Enter your staff email address.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const redirectUrl =
      `${window.location.origin}/staff-reset-password`;

    const { error: resetError } =
      await supabase.auth.resetPasswordForEmail(
        cleanEmail,
        {
          redirectTo: redirectUrl,
        },
      );

    if (resetError) {
      setError(resetError.message);
      setSaving(false);
      return;
    }

    setSuccess(
      "Password reset instructions have been sent to your email. Check your inbox and follow the link to create a new password.",
    );

    setSaving(false);
  }

  async function login() {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const { error: loginError } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

    if (loginError) {
      setError(loginError.message);
      setSaving(false);
      return;
    }

    setPassword("");
    await loadStaff();

    setSaving(false);
  }

  async function register() {
    if (!fullName.trim()) {
      setError("Enter your full name.");
      return;
    }

    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }

    if (!phone.trim()) {
      setError("Enter your phone number.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const redirectUrl =
      `${window.location.origin}/staff`;

    const { data, error: signupError } =
      await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            account_type: "staff",
            full_name: fullName.trim(),
            phone: phone.trim(),
          },
        },
      });

    if (signupError) {
      setError(signupError.message);
      setSaving(false);
      return;
    }

    setPassword("");

    if (!data.session) {
      setSuccess(
        "Registration submitted successfully. Please confirm your email, then return to the Staff Portal. Your application is waiting for management approval.",
      );
    } else {
      setSuccess(
        "Registration submitted. Your staff application is waiting for management approval.",
      );
    }

    setSaving(false);
  }

  async function logout() {
    await supabase.auth.signOut();

    setProfile(null);
    setSalaryRecords([]);
    setAttendanceRecords([]);
    setIsAdmin(false);
    setError("");
    setSuccess("");
  }

  async function updateContactInformation() {
    if (!profile) return;

    setSaving(true);
    setError("");
    setSuccess("");

    const { error: updateError } = await supabase
      .from("staff_profiles")
      .update({
        phone: editPhone.trim() || null,
        address: editAddress.trim() || null,
      })
      .eq("id", profile.id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setProfile({
      ...profile,
      phone: editPhone.trim() || null,
      address: editAddress.trim() || null,
    });

    setEditContact(false);
    setSuccess("Contact information updated successfully.");
    setSaving(false);
  }

  async function downloadQr() {
    const svg = document.querySelector(
      "#staff-profile-qr",
    ) as SVGElement | null;

    if (!svg || !profile) {
      setError("QR code is not ready yet.");
      return;
    }

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);

    const svgBlob = new Blob([svgString], {
      type: "image/svg+xml;charset=utf-8",
    });

    const url = URL.createObjectURL(svgBlob);

    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement("canvas");

      canvas.width = 1000;
      canvas.height = 1000;

      const context = canvas.getContext("2d");

      if (!context) {
        URL.revokeObjectURL(url);
        return;
      }

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, 1000, 1000);

      context.drawImage(image, 100, 100, 800, 800);

      canvas.toBlob((blob) => {
        if (!blob) {
          URL.revokeObjectURL(url);
          return;
        }

        const downloadUrl =
          URL.createObjectURL(blob);

        const link =
          document.createElement("a");

        link.href = downloadUrl;
        link.download = `${profile.staff_id}-QR.png`;
        link.click();

        URL.revokeObjectURL(downloadUrl);
        URL.revokeObjectURL(url);
      }, "image/png");
    };

    image.src = url;
  }

  useEffect(() => {
    void loadStaff();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadStaff();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const activeAttendance = useMemo(
    () =>
      attendanceRecords.find(
        (record) => !record.checked_out_at,
      ) || null,
    [attendanceRecords],
  );

  /*
   * ----------------------------------------------------
   * LOGIN / REGISTER
   * ----------------------------------------------------
   */

  if (!profile && !loading) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="border border-border bg-card p-6 sm:p-10">
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center bg-primary text-primary-foreground">
                <BriefcaseBusiness className="h-8 w-8" />
              </div>

              <p className="mt-6 text-sm font-bold uppercase tracking-[0.25em] text-primary">
                Super Plus Fitness
              </p>

              <h1 className="mt-3 font-display text-5xl font-bold uppercase sm:text-7xl">
                Staff Portal
              </h1>

              <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-muted-foreground">
                Staff members can register and access their employee
                information here.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-2 border border-border">
              <button
                type="button"
                onClick={() => {
                  setLoginMode(true);
                  setForgotPasswordMode(false);
                  setError("");
                  setSuccess("");
                }}
                className={`py-4 text-sm font-bold uppercase ${
                  loginMode
                    ? "bg-primary text-primary-foreground"
                    : "bg-background"
                }`}
              >
                Login
              </button>

              <button
                type="button"
                onClick={() => {
                  setLoginMode(false);
                  setForgotPasswordMode(false);
                  setError("");
                  setSuccess("");
                }}
                className={`py-4 text-sm font-bold uppercase ${
                  !loginMode
                    ? "bg-primary text-primary-foreground"
                    : "bg-background"
                }`}
              >
                Register
              </button>
            </div>

            {error && (
              <div className="mt-6 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            {success && (
              <div className="mt-6 border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-700">
                {success}
              </div>
            )}

            {forgotPasswordMode ? (
              <>
                <div className="mt-8 border border-border bg-muted/30 p-5">
                  <div className="flex gap-3">
                    <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-primary" />

                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-primary">
                        Account Recovery
                      </p>

                      <h2 className="mt-2 font-display text-2xl font-bold uppercase">
                        Forgot Password?
                      </h2>

                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Enter the email address you used to create
                        your staff account. We will send you a secure
                        link to create a new password.
                      </p>
                    </div>
                  </div>
                </div>

                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void sendPasswordReset();
                  }}
                  className="mt-8 grid gap-5"
                >
                  <label className="grid gap-2 text-sm font-bold">
                    Staff Email

                    <input
                      value={resetEmail}
                      onChange={(event) =>
                        setResetEmail(event.target.value)
                      }
                      type="email"
                      placeholder="Enter your staff email"
                      autoComplete="email"
                      className="h-12 border border-input bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-ring"
                    />
                  </label>

                  <Button
                    type="submit"
                    size="lg"
                    disabled={saving}
                    className="mt-2"
                  >
                    <KeyRound />
                    {saving
                      ? "Sending Reset Link..."
                      : "Send Reset Link"}
                  </Button>
                </form>

                <button
                  type="button"
                  onClick={() => {
                    setForgotPasswordMode(false);
                    setError("");
                    setSuccess("");
                  }}
                  className="mt-5 w-full text-center text-sm font-bold text-muted-foreground underline underline-offset-4"
                >
                  ← Back to Staff Login
                </button>
              </>
            ) : (
              <>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();

                    if (loginMode) {
                      void login();
                    } else {
                      void register();
                    }
                  }}
                  className="mt-8 grid gap-5"
                >
                  {!loginMode && (
                    <>
                      <label className="grid gap-2 text-sm font-bold">
                        Full Name

                        <input
                          value={fullName}
                          onChange={(event) =>
                            setFullName(event.target.value)
                          }
                          placeholder="Enter your full name"
                          autoComplete="name"
                          className="h-12 border border-input bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-ring"
                        />
                      </label>

                      <label className="grid gap-2 text-sm font-bold">
                        Phone

                        <input
                          value={phone}
                          onChange={(event) =>
                            setPhone(event.target.value)
                          }
                          type="tel"
                          placeholder="Enter your phone number"
                          autoComplete="tel"
                          className="h-12 border border-input bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-ring"
                        />
                      </label>
                    </>
                  )}

                  <label className="grid gap-2 text-sm font-bold">
                    Email

                    <input
                      value={email}
                      onChange={(event) =>
                        setEmail(event.target.value)
                      }
                      type="email"
                      placeholder="Enter your email"
                      autoComplete="email"
                      className="h-12 border border-input bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-ring"
                    />
                  </label>

                  <label className="grid gap-2 text-sm font-bold">
                    Password

                    <input
                      value={password}
                      onChange={(event) =>
                        setPassword(event.target.value)
                      }
                      type="password"
                      placeholder={
                        loginMode
                          ? "Enter your password"
                          : "Create a password"
                      }
                      autoComplete={
                        loginMode
                          ? "current-password"
                          : "new-password"
                      }
                      className="h-12 border border-input bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-ring"
                    />
                  </label>

                  <Button
                    type="submit"
                    size="lg"
                    disabled={saving}
                    className="mt-2"
                  >
                    {loginMode ? (
                      <>
                        <LogIn />
                        Staff Login
                      </>
                    ) : (
                      <>
                        <BriefcaseBusiness />
                        Submit Staff Application
                      </>
                    )}
                  </Button>
                </form>

                {loginMode && (
                  <button
                    type="button"
                    onClick={() => {
                      setForgotPasswordMode(true);
                      setResetEmail(email);
                      setError("");
                      setSuccess("");
                    }}
                    className="mt-5 w-full text-center text-sm font-bold text-primary underline underline-offset-4"
                  >
                    Forgot password?
                  </button>
                )}
              </>
            )}

            {!loginMode && (
              <div className="mt-6 border border-orange-500/30 bg-orange-500/10 p-4 text-sm text-orange-800">
                <strong className="block">
                  Staff approval required
                </strong>

                <p className="mt-1">
                  Your registration will be reviewed by Super Plus
                  Fitness management before your staff account becomes
                  active.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-4xl px-4 py-24 text-center">
          <p className="text-sm text-muted-foreground">
            Loading Staff Portal...
          </p>
        </div>
      </main>
    );
  }

  if (!profile) {
    return null;
  }

  /*
   * ----------------------------------------------------
   * PENDING / SUSPENDED / INACTIVE
   * ----------------------------------------------------
   */

  if (profile.status !== "approved") {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
          <div className="border border-border bg-card p-6 sm:p-10">
            <div className="text-center">
              {profile.status === "pending" ? (
                <Clock3 className="mx-auto h-14 w-14 text-primary" />
              ) : profile.status === "suspended" ? (
                <XCircle className="mx-auto h-14 w-14 text-red-600" />
              ) : (
                <XCircle className="mx-auto h-14 w-14 text-muted-foreground" />
              )}

              <p className="mt-6 text-xs font-bold uppercase tracking-[0.25em] text-primary">
                Super Plus Fitness
              </p>

              <h1 className="mt-3 font-display text-4xl font-bold uppercase sm:text-6xl">
                Staff Portal
              </h1>

              <div
                className={`mx-auto mt-8 w-fit rounded-full border px-4 py-2 text-xs font-bold uppercase ${statusClass(
                  profile.status,
                )}`}
              >
                {statusLabel(profile.status)}
              </div>

              <h2 className="mt-8 font-display text-2xl font-bold uppercase">
                {profile.status === "pending"
                  ? "Application Awaiting Approval"
                  : profile.status === "suspended"
                    ? "Staff Account Suspended"
                    : "Staff Account Inactive"}
              </h2>

              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                {profile.status === "pending"
                  ? "Your staff application has been received. Management needs to review and approve your application before you can access staff features."
                  : profile.status === "suspended"
                    ? "Your staff account is currently suspended. Please contact Super Plus Fitness management."
                    : "Your staff account is currently inactive. Please contact Super Plus Fitness management."}
              </p>

              <div className="mt-8 border border-border bg-muted p-5 text-left">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Staff ID
                </p>

                <p className="mt-2 font-display text-2xl font-bold">
                  {profile.staff_id}
                </p>
              </div>

              <Button
                variant="outline"
                className="mt-6"
                onClick={() => void logout()}
              >
                <LogOut />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  /*
   * ----------------------------------------------------
   * APPROVED STAFF DASHBOARD
   * ----------------------------------------------------
   */

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">

        {error && (
          <div className="mb-6 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-700">
            {success}
          </div>
        )}

        {/* HEADER */}
        <header className="border border-border bg-card p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">
                Super Plus Fitness
              </p>

              <h1 className="mt-2 font-display text-4xl font-bold uppercase sm:text-5xl">
                Staff Portal
              </h1>

              <p className="mt-2 text-sm text-muted-foreground">
                Welcome, {profile.full_name}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {isAdmin && (
                <Button asChild>
                  <Link to="/staff-admin">
                    <ShieldCheck />
                    Staff Management
                  </Link>
                </Button>
              )}

              <Button
                variant="outline"
                onClick={() => void logout()}
              >
                <LogOut />
                Logout
              </Button>
            </div>
          </div>
        </header>

        {/* STAFF SUMMARY */}
        <section className="mt-6 border border-border bg-card p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center bg-primary text-primary-foreground">
              <UserRound className="h-8 w-8" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-widest text-primary">
                Staff Member
              </p>

              <h2 className="mt-1 font-display text-3xl font-bold uppercase">
                {profile.full_name}
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                {profile.position || "Staff"}{" "}
                {profile.department
                  ? `• ${profile.department}`
                  : ""}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-[10px] font-bold uppercase text-green-700">
                  Active Staff
                </span>

                <span className="rounded-full border border-border px-3 py-1 text-[10px] font-bold uppercase">
                  {profile.staff_id}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* QR ATTENDANCE */}
        <section className="mt-4 border-2 border-primary/40 bg-primary/5 p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ScanLine className="size-6 text-primary" />

                <p className="text-xs font-bold uppercase tracking-widest text-primary">
                  Staff Timekeeping
                </p>
              </div>

              <h2 className="mt-2 font-display text-3xl font-black uppercase">
                {activeAttendance
                  ? "Currently Clocked In"
                  : "Clock In / Clock Out"}
              </h2>

              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                Scan the attendance QR code displayed at the gym to
                record your working hours.
              </p>

              {activeAttendance && (
                <p className="mt-3 text-sm font-semibold">
                  Clocked in:{" "}
                  {formatDateTime(
                    activeAttendance.checked_in_at,
                  )}
                </p>
              )}
            </div>

            <Button
              asChild
              size="lg"
              className="w-full shrink-0 sm:w-auto"
            >
              <Link to="/staff-attendance">
                <ScanLine />
                Scan Attendance QR
              </Link>
            </Button>
          </div>
        </section>

        {/* STAFF ID */}
        <section className="mt-4 border border-border bg-card p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            Staff ID
          </p>

          <p className="mt-2 font-display text-2xl font-bold uppercase">
            {profile.staff_id}
          </p>

          <p className="mt-2 text-xs text-muted-foreground">
            Use this ID when communicating with management.
          </p>
        </section>

        {/* PERSONAL INFORMATION */}
        <section className="mt-4 border border-border bg-card">
          <button
            type="button"
            onClick={() =>
              setShowProfile((current) => !current)
            }
            className="flex w-full items-center justify-between p-5 text-left"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary">
                Profile
              </p>

              <h2 className="mt-1 font-display text-2xl font-bold uppercase">
                Personal Information
              </h2>
            </div>

            <UserRound className="text-primary" />
          </button>

          {showProfile && (
            <div className="border-t border-border p-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Full Name
                  </p>

                  <p className="mt-1 font-medium">
                    {profile.full_name}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Email
                  </p>

                  <p className="mt-1 break-all font-medium">
                    {profile.email || "—"}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Phone
                  </p>

                  <p className="mt-1 font-medium">
                    {profile.phone || "Not available"}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Birthday
                  </p>

                  <p className="mt-1 font-medium">
                    {profile.birth_day &&
                    profile.birth_month
                      ? `${profile.birth_day}/${profile.birth_month}`
                      : "Not available"}
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Address
                  </p>

                  <p className="mt-1 font-medium">
                    {profile.address || "Not available"}
                  </p>
                </div>
              </div>

              {!editContact ? (
                <Button
                  variant="outline"
                  className="mt-5"
                  onClick={() => setEditContact(true)}
                >
                  Edit Contact Information
                </Button>
              ) : (
                <div className="mt-6 border border-border bg-muted/30 p-5">
                  <div className="grid gap-5">
                    <label className="grid gap-2 text-sm font-bold">
                      Phone

                      <input
                        value={editPhone}
                        onChange={(event) =>
                          setEditPhone(event.target.value)
                        }
                        type="tel"
                        className="h-11 border border-border bg-background px-3 font-normal outline-none"
                      />
                    </label>

                    <label className="grid gap-2 text-sm font-bold">
                      Address

                      <textarea
                        value={editAddress}
                        onChange={(event) =>
                          setEditAddress(event.target.value)
                        }
                        rows={3}
                        className="border border-border bg-background p-3 font-normal outline-none"
                      />
                    </label>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() =>
                          void updateContactInformation()
                        }
                        disabled={saving}
                      >
                        <CheckCircle2 />
                        Save
                      </Button>

                      <Button
                        variant="outline"
                        onClick={() =>
                          setEditContact(false)
                        }
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* EMPLOYMENT */}
        <section className="mt-4 border border-border bg-card">
          <button
            type="button"
            onClick={() =>
              setShowEmployment((current) => !current)
            }
            className="flex w-full items-center justify-between p-5 text-left"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary">
                Employment
              </p>

              <h2 className="mt-1 font-display text-2xl font-bold uppercase">
                Job Information
              </h2>
            </div>

            <BriefcaseBusiness className="text-primary" />
          </button>

          {showEmployment && (
            <div className="border-t border-border p-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Position
                  </p>

                  <p className="mt-1 font-medium">
                    {profile.position || "Not assigned"}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Department
                  </p>

                  <p className="mt-1 font-medium">
                    {profile.department || "Not assigned"}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Employment Type
                  </p>

                  <p className="mt-1 font-medium">
                    {profile.employment_type || "Not assigned"}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Employment Date
                  </p>

                  <p className="mt-1 font-medium">
                    {formatDate(profile.employment_date)}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    System Role
                  </p>

                  <p className="mt-1 font-medium">
                    {getRoleLabel(profile.role)}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Staff Status
                  </p>

                  <p className="mt-1 font-medium">
                    {statusLabel(profile.status)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* SALARY */}
        <section className="mt-4 border border-border bg-card">
          <button
            type="button"
            onClick={() =>
              setShowSalary((current) => !current)
            }
            className="flex w-full items-center justify-between p-5 text-left"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary">
                Payroll
              </p>

              <h2 className="mt-1 font-display text-2xl font-bold uppercase">
                Salary History
              </h2>
            </div>

            <Wallet className="text-primary" />
          </button>

          {showSalary && (
            <div className="border-t border-border p-5">
              {salaryRecords.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No salary records available yet.
                </p>
              ) : (
                <div className="grid gap-4">
                  {salaryRecords.map((record) => (
                    <article
                      key={record.id}
                      className="border border-border p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                            Amount
                          </p>

                          <p className="mt-1 font-display text-2xl font-bold">
                            {formatMoney(
                              record.amount,
                              record.currency,
                            )}
                          </p>
                        </div>

                        <span className="w-fit rounded-full border border-border px-3 py-1 text-xs font-bold uppercase">
                          {record.status}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-4 sm:grid-cols-3">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            Pay Period
                          </p>

                          <p className="mt-1 text-sm">
                            {record.pay_period_start ||
                            record.pay_period_end
                              ? `${formatDate(
                                  record.pay_period_start,
                                )} – ${formatDate(
                                  record.pay_period_end,
                                )}`
                              : "—"}
                          </p>
                        </div>

                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            Payment Date
                          </p>

                          <p className="mt-1 text-sm">
                            {formatDate(
                              record.payment_date,
                            )}
                          </p>
                        </div>

                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            Notes
                          </p>

                          <p className="mt-1 text-sm">
                            {record.notes || "—"}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* ATTENDANCE HISTORY */}
        <section className="mt-4 border border-border bg-card">
          <button
            type="button"
            onClick={() =>
              setShowAttendance((current) => !current)
            }
            className="flex w-full items-center justify-between p-5 text-left"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary">
                Timekeeping
              </p>

              <h2 className="mt-1 font-display text-2xl font-bold uppercase">
                Attendance History
              </h2>
            </div>

            <CalendarDays className="text-primary" />
          </button>

          {showAttendance && (
            <div className="border-t border-border p-5">
              {attendanceRecords.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No attendance records yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[650px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs uppercase tracking-widest text-muted-foreground">
                        <th className="px-3 py-3">
                          Check-in
                        </th>

                        <th className="px-3 py-3">
                          Check-out
                        </th>

                        <th className="px-3 py-3">
                          Duration
                        </th>

                        <th className="px-3 py-3">
                          Notes
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {attendanceRecords.map((record) => (
                        <tr
                          key={record.id}
                          className="border-b border-border"
                        >
                          <td className="px-3 py-4">
                            {formatDateTime(
                              record.checked_in_at,
                            )}
                          </td>

                          <td className="px-3 py-4">
                            {record.checked_out_at
                              ? formatDateTime(
                                  record.checked_out_at,
                                )
                              : "Still inside"}
                          </td>

                          <td className="px-3 py-4 font-semibold">
                            {durationLabel(
                              record.checked_in_at,
                              record.checked_out_at,
                            )}
                          </td>

                          <td className="px-3 py-4">
                            {record.notes || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>

        {/* PERSONAL QR */}
        <section className="mt-4 border border-border bg-card">
          <button
            type="button"
            onClick={() =>
              setShowQr((current) => !current)
            }
            className="flex w-full items-center justify-between p-5 text-left"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary">
                Identification
              </p>

              <h2 className="mt-1 font-display text-2xl font-bold uppercase">
                Staff QR Code
              </h2>
            </div>

            <QrCode className="text-primary" />
          </button>

          {showQr && (
            <div className="border-t border-border p-6">
              <div className="mx-auto max-w-md text-center">
                <p className="text-sm text-muted-foreground">
                  This is your personal staff identification QR.
                </p>

                <div className="mt-6 flex justify-center bg-white p-6">
                  <QRCodeSVG
                    id="staff-profile-qr"
                    value={`STAFF:${profile.qr_token}`}
                    size={260}
                    level="H"
                    includeMargin
                  />
                </div>

                <p className="mt-4 font-display text-xl font-bold">
                  {profile.staff_id}
                </p>

                <Button
                  variant="outline"
                  className="mt-5"
                  onClick={() => void downloadQr()}
                >
                  <Download />
                  Download QR Code
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* MANAGEMENT */}
        {isAdmin && (
          <section className="mt-6 border border-primary/30 bg-primary/5 p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />

                  <p className="text-xs font-bold uppercase tracking-widest text-primary">
                    Management Access
                  </p>
                </div>

                <h2 className="mt-2 font-display text-2xl font-bold uppercase">
                  Staff Management
                </h2>

                <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                  Review staff applications, approve staff, assign
                  employment details, manage salaries and view staff
                  attendance.
                </p>
              </div>

              <Button asChild className="shrink-0">
                <Link to="/staff-admin">
                  <ShieldCheck />
                  Open Staff Management
                </Link>
              </Button>
            </div>
          </section>
        )}

        <p className="py-8 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Super Plus Fitness & Spa — Staff
          Portal
        </p>
      </div>
    </main>
  );
}
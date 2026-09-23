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

type LoginType = "staff" | "admin";

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

  return hours > 0
    ? `${hours}h ${remainingMinutes}m`
    : `${remainingMinutes}m`;
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

  const [loginType, setLoginType] = useState<LoginType>("staff");
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
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setProfile(null);
      setSalaryRecords([]);
      setAttendanceRecords([]);
      setLoading(false);
      return;
    }

    const { data: staffUser, error: roleError } = await supabase
      .from("staff_users")
      .select("id, role, active")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (roleError) {
      setError(roleError.message);
      setLoading(false);
      return;
    }

    const role = String(staffUser?.role || "").toLowerCase();

    if (
      staffUser?.active === true &&
      ["admin", "owner", "manager"].includes(role)
    ) {
      setProfile(null);
      setLoading(false);
      window.location.replace("/staff-admin");
      return;
    }

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
      setProfile(null);
      setError(
        "No staff profile was found for this account. Please contact management.",
      );
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
      setError("Enter your email address.");
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

    const { data, error: loginError } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

    if (loginError || !data.user) {
      setError(loginError?.message || "Unable to sign in.");
      setSaving(false);
      return;
    }

    const { data: staffUser, error: roleError } = await supabase
      .from("staff_users")
      .select("role, active")
      .eq("auth_user_id", data.user.id)
      .maybeSingle();

    if (roleError) {
      setError(roleError.message);
      setSaving(false);
      return;
    }

    const role = String(staffUser?.role || "").toLowerCase();

    const isAdmin =
      staffUser?.active === true &&
      ["admin", "owner", "manager"].includes(role);

    if (loginType === "admin") {
      if (!isAdmin) {
        await supabase.auth.signOut();

        setError(
          "This account does not have administrator access. Please use Staff Login.",
        );

        setSaving(false);
        return;
      }

      setPassword("");
      window.location.replace("/staff-admin");
      return;
    }

    if (isAdmin) {
      setPassword("");
      window.location.replace("/staff-admin");
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

    const redirectUrl = `${window.location.origin}/staff`;

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

    setSuccess(
      data.session
        ? "Registration submitted. Your staff application is waiting for management approval."
        : "Registration submitted successfully. Please confirm your email, then return to the Staff Portal. Your application is waiting for management approval.",
    );

    setSaving(false);
  }

  async function logout() {
    await supabase.auth.signOut();

    setProfile(null);
    setSalaryRecords([]);
    setAttendanceRecords([]);
    setError("");
    setSuccess("");
    setLoginType("staff");
    setLoginMode(true);
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

        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = downloadUrl;
        link.download = `${profile.staff_id}-QR.png`;
        link.click();

        URL.revokeObjectURL(downloadUrl);
        URL.revokeObjectURL(url);
      }, "image/png");
    };

    image.onerror = () => URL.revokeObjectURL(url);
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
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="border border-border bg-card p-6 sm:p-10">
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center bg-primary text-primary-foreground">
                {loginType === "admin" ? (
                  <ShieldCheck className="h-8 w-8" />
                ) : (
                  <BriefcaseBusiness className="h-8 w-8" />
                )}
              </div>

              <p className="mt-6 text-sm font-bold uppercase tracking-[0.25em] text-primary">
                Super Plus Fitness
              </p>

              <h1 className="mt-3 font-display text-4xl font-bold uppercase sm:text-7xl">
                {loginType === "admin"
                  ? "Admin Login"
                  : "Staff Portal"}
              </h1>

              <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-muted-foreground">
                {loginType === "admin"
                  ? "Sign in to access the Staff Management Dashboard."
                  : "Staff members can register and access their employee information here."}
              </p>
            </div>

            <div className="mt-10 grid grid-cols-2 border border-border">
              <button
                type="button"
                onClick={() => {
                  setLoginType("staff");
                  setLoginMode(true);
                  setForgotPasswordMode(false);
                  setError("");
                  setSuccess("");
                  setPassword("");
                }}
                className={`flex items-center justify-center gap-2 px-2 py-4 text-xs font-bold uppercase sm:text-sm ${
                  loginType === "staff"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background"
                }`}
              >
                <UserRound className="h-4 w-4" />
                Staff Login
              </button>

              <button
                type="button"
                onClick={() => {
                  setLoginType("admin");
                  setLoginMode(true);
                  setForgotPasswordMode(false);
                  setError("");
                  setSuccess("");
                  setPassword("");
                }}
                className={`flex items-center justify-center gap-2 px-2 py-4 text-xs font-bold uppercase sm:text-sm ${
                  loginType === "admin"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background"
                }`}
              >
                <ShieldCheck className="h-4 w-4" />
                Admin Login
              </button>
            </div>

            {loginType === "staff" && (
              <div className="mt-5 grid grid-cols-2 border border-border">
                <button
                  type="button"
                  onClick={() => {
                    setLoginMode(true);
                    setForgotPasswordMode(false);
                    setError("");
                    setSuccess("");
                  }}
                  className={`py-3 text-xs font-bold uppercase ${
                    loginMode
                      ? "bg-foreground text-background"
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
                  className={`py-3 text-xs font-bold uppercase ${
                    !loginMode
                      ? "bg-foreground text-background"
                      : "bg-background"
                  }`}
                >
                  Register
                </button>
              </div>
            )}

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
                        Enter your account email address. We will send
                        you a link to create a new password.
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
                    Email

                    <input
                      value={resetEmail}
                      onChange={(event) =>
                        setResetEmail(event.target.value)
                      }
                      type="email"
                      placeholder="Enter your email"
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
                  ← Back to Login
                </button>
              </>
            ) : (
              <>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();

                    if (loginType === "staff" && !loginMode) {
                      void register();
                    } else {
                      void login();
                    }
                  }}
                  className="mt-8 grid gap-5"
                >
                  {loginType === "staff" && !loginMode && (
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
                      type="text"
                      placeholder={
                        loginType === "staff" && !loginMode
                          ? "Create a password"
                          : "Enter your password"
                      }
                      autoComplete={
                        loginType === "staff" && !loginMode
                          ? "new-password"
                          : "current-password"
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
                    {loginType === "admin" ? (
                      <>
                        <ShieldCheck />
                        {saving
                          ? "Signing In..."
                          : "Admin Login"}
                      </>
                    ) : loginMode ? (
                      <>
                        <LogIn />
                        {saving
                          ? "Signing In..."
                          : "Staff Login"}
                      </>
                    ) : (
                      <>
                        <BriefcaseBusiness />
                        {saving
                          ? "Submitting..."
                          : "Submit Staff Application"}
                      </>
                    )}
                  </Button>
                </form>

                {(loginType === "admin" || loginMode) && (
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

            {loginType === "staff" && !loginMode && (
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

  if (profile.status !== "approved") {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
          <div className="border border-border bg-card p-6 sm:p-10">
            <div className="text-center">
              {profile.status === "pending" ? (
                <Clock3 className="mx-auto h-14 w-14 text-primary" />
              ) : (
                <XCircle className="mx-auto h-14 w-14 text-red-600" />
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
                  : "Your staff account is currently unavailable. Please contact Super Plus Fitness management."}
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

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
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

        <header className="border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">
                Super Plus Fitness
              </p>

              <h1 className="mt-1 font-display text-3xl font-bold uppercase sm:text-4xl">
                Staff Portal
              </h1>

              <p className="mt-2 text-sm text-muted-foreground">
                Welcome, {profile.full_name}
              </p>
            </div>

            <Button
              variant="outline"
              onClick={() => void logout()}
            >
              <LogOut />
              Logout
            </Button>
          </div>
        </header>

        <section className="mt-3 border border-border bg-card p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-primary text-primary-foreground">
              <UserRound className="h-6 w-6" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-widest text-primary">
                Staff Member
              </p>

              <h2 className="mt-0.5 font-display text-2xl font-bold uppercase">
                {profile.full_name}
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                {profile.position || "Staff"}{" "}
                {profile.department
                  ? `• ${profile.department}`
                  : ""}
              </p>

              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase text-green-700">
                  Active Staff
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-3 border-2 border-primary/40 bg-primary/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ScanLine className="size-5 text-primary" />

                <p className="text-xs font-bold uppercase tracking-widest text-primary">
                  Staff Timekeeping
                </p>
              </div>

              <h2 className="mt-1 font-display text-2xl font-black uppercase">
                {activeAttendance
                  ? "Currently Clocked In"
                  : "Clock In / Clock Out"}
              </h2>

              <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">
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
              className="h-10 w-full shrink-0 text-xs sm:w-auto"
            >
              <Link to="/staff-attendance">
                <ScanLine />
                Scan Attendance QR
              </Link>
            </Button>
          </div>
        </section>

        <section className="mt-4 border border-border bg-card">
          <button
            type="button"
            onClick={() =>
              setShowProfile((current) => !current)
            }
            className="flex w-full items-center justify-between p-3.5 text-left"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary">
                Profile
              </p>

              <h2 className="mt-0.5 font-display text-xl font-bold uppercase">
                Personal Information
              </h2>
            </div>

            <UserRound className="text-primary" />
          </button>

          {showProfile && (
            <div className="border-t border-border p-4">
              <div className="grid gap-3 sm:grid-cols-2">
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
                    {profile.birth_day && profile.birth_month
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

        <section className="mt-4 border border-border bg-card">
          <button
            type="button"
            onClick={() =>
              setShowEmployment((current) => !current)
            }
            className="flex w-full items-center justify-between p-3.5 text-left"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary">
                Employment
              </p>

              <h2 className="mt-0.5 font-display text-xl font-bold uppercase">
                Job Information
              </h2>
            </div>

            <BriefcaseBusiness className="text-primary" />
          </button>

          {showEmployment && (
            <div className="border-t border-border p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["Position", profile.position || "Not assigned"],
                  ["Department", profile.department || "Not assigned"],
                  [
                    "Employment Type",
                    profile.employment_type || "Not assigned",
                  ],
                  [
                    "Employment Date",
                    formatDate(profile.employment_date),
                  ],
                  ["System Role", getRoleLabel(profile.role)],
                  ["Staff Status", statusLabel(profile.status)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      {label}
                    </p>

                    <p className="mt-1 font-medium">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="mt-4 border border-border bg-card">
          <button
            type="button"
            onClick={() =>
              setShowSalary((current) => !current)
            }
            className="flex w-full items-center justify-between p-3.5 text-left"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary">
                Payroll
              </p>

              <h2 className="mt-0.5 font-display text-xl font-bold uppercase">
                Salary History
              </h2>
            </div>

            <Wallet className="text-primary" />
          </button>

          {showSalary && (
            <div className="border-t border-border p-4">
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
                            {formatDate(record.payment_date)}
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

        <section className="mt-4 border border-border bg-card">
          <button
            type="button"
            onClick={() =>
              setShowAttendance((current) => !current)
            }
            className="flex w-full items-center justify-between p-3.5 text-left"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary">
                Timekeeping
              </p>

              <h2 className="mt-0.5 font-display text-xl font-bold uppercase">
                Attendance History
              </h2>
            </div>

            <CalendarDays className="text-primary" />
          </button>

          {showAttendance && (
            <div className="border-t border-border p-4">
              {attendanceRecords.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No attendance records yet.
                </p>
              ) : (
                <div className="grid gap-3">
                  {attendanceRecords.map((record) => (
                    <article
                      key={record.id}
                      className="border border-border p-4"
                    >
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-bold uppercase text-muted-foreground">
                            Clock In
                          </p>

                          <p className="mt-1 text-sm font-semibold">
                            {formatDateTime(record.checked_in_at)}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-bold uppercase text-muted-foreground">
                            Clock Out
                          </p>

                          <p className="mt-1 text-sm font-semibold">
                            {record.checked_out_at
                              ? formatDateTime(record.checked_out_at)
                              : "Still inside"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-bold uppercase text-muted-foreground">
                            Duration
                          </p>

                          <p className="mt-1 text-sm font-semibold">
                            {durationLabel(
                              record.checked_in_at,
                              record.checked_out_at,
                            )}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-bold uppercase text-muted-foreground">
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

        <section className="mt-4 border border-border bg-card">
          <button
            type="button"
            onClick={() =>
              setShowQr((current) => !current)
            }
            className="flex w-full items-center justify-between p-3.5 text-left"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary">
                Identification
              </p>

              <h2 className="mt-0.5 font-display text-xl font-bold uppercase">
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

        <p className="py-8 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Super Plus Fitness & Spa — Staff
          Portal
        </p>
      </div>
    </main>
  );
}
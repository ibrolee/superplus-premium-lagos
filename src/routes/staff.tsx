import { PrivateStaffContractTerms } from "@/components/PrivateStaffContractTerms";
import { useEffect, useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  Home,
  AlertCircle,
  LogIn,
  LogOut,
  QrCode,
  ScanLine,
  ShieldCheck,
  Star,
  UserRound,
  Wallet,
  XCircle,
  KeyRound,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

type StaffSalarySetting = {
  staff_profile_id: string;
  current_monthly_salary: number;
  currency: string;
  updated_at: string;
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
  payroll_kind: string | null;
  scheduled_pay_date: string | null;
};

type AttendanceRecord = {
  id: string;
  checked_in_at: string;
  checked_out_at: string | null;
  notes: string | null;
  created_at: string;
};

type CoachPerformance = {
  staff_profile_id: string;
  coach_name: string;
  current_trainees: number;
  evaluation_count: number;
  rating_established: boolean;
  overall_rating: number | null;
  professionalism_rating: number | null;
  punctuality_rating: number | null;
  communication_rating: number | null;
  coaching_quality_rating: number | null;
  motivation_rating: number | null;
  program_consistency_percent: number | null;
  continue_rate: number | null;
  renewal_eligible: number;
  renewed_same_coach: number;
  renewal_rate: number | null;
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
    maximumFractionDigits: 0,
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

function lagosDay(value: string | number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function durationLabel(checkedIn: string, checkedOut: string | null) {
  const start = new Date(checkedIn).getTime();

  const end = checkedOut ? new Date(checkedOut).getTime() : Date.now();

  const minutes = Math.max(0, Math.floor((end - start) / 60000));

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return hours > 0 ? `${hours}h ${remainingMinutes}m` : `${remainingMinutes}m`;
}

function getRoleLabel(role: string) {
  const labels: Record<string, string> = {
    staff: "Staff",
    reception: "Reception",
    trainer: "Coach",
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
  const [currentSalary, setCurrentSalary] = useState<StaffSalarySetting | null>(null);
  const [salaryRecords, setSalaryRecords] = useState<SalaryRecord[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [coachPerformance, setCoachPerformance] = useState<CoachPerformance | null>(null);

  const [loginType, setLoginType] = useState<LoginType>("staff");
  const [loginMode, setLoginMode] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [resetEmail, setResetEmail] = useState("");

  const [activeSection, setActiveSection] = useState("personal");
  const [now, setNow] = useState(() => Date.now());

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
      setCurrentSalary(null);
      setSalaryRecords([]);
      setAttendanceRecords([]);
      setCoachPerformance(null);
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

    if (staffUser?.active === true && ["admin", "owner", "manager"].includes(role)) {
      setProfile(null);
      setLoading(false);
      window.location.replace("/staff-admin");
      return;
    }

    const { data: staffProfile, error: profileError } = await supabase
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
      setError("No staff profile was found for this account. Please contact management.");
      setLoading(false);
      return;
    }

    const staff = staffProfile as StaffProfile;

    setProfile(staff);
    setEditPhone(staff.phone || "");
    setEditAddress(staff.address || "");

    const [salarySettingResult, salaryResult, attendanceResult, coachPerformanceResult] = await Promise.all([
      supabase
        .from("staff_salary_settings")
        .select("staff_profile_id,current_monthly_salary,currency,updated_at")
        .eq("staff_profile_id", staff.id)
        .maybeSingle(),

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
          payroll_kind,
          scheduled_pay_date,
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

      supabase.rpc("get_my_pt_coaching_performance"),
    ]);

    if (salarySettingResult.error) {
      setError(salarySettingResult.error.message);
      setLoading(false);
      return;
    }

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

    setCurrentSalary((salarySettingResult.data || null) as StaffSalarySetting | null);
    setSalaryRecords((salaryResult.data || []) as SalaryRecord[]);

    setAttendanceRecords((attendanceResult.data || []) as AttendanceRecord[]);

    if (coachPerformanceResult.error) {
      setCoachPerformance(null);
    } else {
      const performanceRows = (coachPerformanceResult.data || []) as CoachPerformance[];
      setCoachPerformance(performanceRows[0] || null);
    }

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

    const redirectUrl = `${window.location.origin}/staff-reset-password`;

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: redirectUrl,
    });

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

    const { data, error: loginError } = await supabase.auth.signInWithPassword({
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

    const isAdmin = staffUser?.active === true && ["admin", "owner", "manager"].includes(role);

    if (loginType === "admin") {
      if (!isAdmin) {
        await supabase.auth.signOut();

        setError("This account does not have administrator access. Please use Staff Login.");

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

    const { data, error: signupError } = await supabase.auth.signUp({
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
    setCurrentSalary(null);
    setSalaryRecords([]);
    setAttendanceRecords([]);
    setCoachPerformance(null);
    setError("");
    setSuccess("");
    setLoginType("staff");
    setLoginMode(true);
    setActiveSection("personal");
    setEditContact(false);
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
    const svg = document.querySelector("#staff-profile-qr") as SVGElement | null;

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

  // Refresh payment history when staff return to the page or open this tab.
  useEffect(() => {
    if (!profile || activeSection !== "payments") return;
    let cancelled = false;
    const refreshPayments = async () => {
      const { data, error: paymentError } = await supabase.from("staff_salary_records")
        .select("id,amount,currency,pay_period_start,pay_period_end,payment_date,status,notes,created_at,payroll_kind,scheduled_pay_date")
        .eq("staff_profile_id", profile.id).order("created_at", { ascending: false });
      if (!cancelled && !paymentError) setSalaryRecords((data || []) as SalaryRecord[]);
    };
    void refreshPayments();
    window.addEventListener("focus", refreshPayments);
    const timer = window.setInterval(() => void refreshPayments(), 60_000);
    return () => { cancelled = true; window.removeEventListener("focus", refreshPayments); window.clearInterval(timer); };
  }, [profile?.id, activeSection]);

  // Match the scanner's midnight reset in Lagos, including an open dashboard.
  useEffect(() => {
    const refreshTime = () => setNow(Date.now());
    const timer = window.setInterval(refreshTime, 30_000);
    window.addEventListener("focus", refreshTime);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshTime);
    };
  }, []);

  const today = lagosDay(now);
  const activeAttendance = useMemo(
    () =>
      attendanceRecords.find(
        (record) => !record.checked_out_at && lagosDay(record.checked_in_at) === today,
      ) || null,
    [attendanceRecords, today],
  );
  const missedClockOuts = attendanceRecords.filter(
    (record) => !record.checked_out_at && lagosDay(record.checked_in_at) < today,
  ).length;

  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-4xl px-4 py-24 text-center">
          <p className="text-sm text-muted-foreground">Loading Staff Portal...</p>
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
                {loginType === "admin" ? "Admin Login" : "Staff Portal"}
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
                  loginType === "staff" ? "bg-primary text-primary-foreground" : "bg-background"
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
                  loginType === "admin" ? "bg-primary text-primary-foreground" : "bg-background"
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
                    loginMode ? "bg-foreground text-background" : "bg-background"
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
                    !loginMode ? "bg-foreground text-background" : "bg-background"
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
                      <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
                        Account Recovery
                      </p>

                      <h2 className="mt-2 font-display text-2xl font-bold uppercase">
                        Forgot Password?
                      </h2>

                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Enter your account email address. We will send you a link to create a new
                        password.
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
                      onChange={(event) => setResetEmail(event.target.value)}
                      type="email"
                      placeholder="Enter your email"
                      autoComplete="email"
                      className="h-12 border border-input bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-ring"
                    />
                  </label>

                  <Button type="submit" size="lg" disabled={saving} className="mt-2">
                    <KeyRound />
                    {saving ? "Sending Reset Link..." : "Send Reset Link"}
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
                          onChange={(event) => setFullName(event.target.value)}
                          placeholder="Enter your full name"
                          autoComplete="name"
                          className="h-12 border border-input bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-ring"
                        />
                      </label>

                      <label className="grid gap-2 text-sm font-bold">
                        Phone
                        <input
                          value={phone}
                          onChange={(event) => setPhone(event.target.value)}
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
                      onChange={(event) => setEmail(event.target.value)}
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
                      onChange={(event) => setPassword(event.target.value)}
                      type="text"
                      placeholder={
                        loginType === "staff" && !loginMode
                          ? "Create a password"
                          : "Enter your password"
                      }
                      autoComplete={
                        loginType === "staff" && !loginMode ? "new-password" : "current-password"
                      }
                      className="h-12 border border-input bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-ring"
                    />
                  </label>

                  <Button type="submit" size="lg" disabled={saving} className="mt-2">
                    {loginType === "admin" ? (
                      <>
                        <ShieldCheck />
                        {saving ? "Signing In..." : "Admin Login"}
                      </>
                    ) : loginMode ? (
                      <>
                        <LogIn />
                        {saving ? "Signing In..." : "Staff Login"}
                      </>
                    ) : (
                      <>
                        <BriefcaseBusiness />
                        {saving ? "Submitting..." : "Submit Staff Application"}
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
                <strong className="block">Staff approval required</strong>

                <p className="mt-1">
                  Your registration will be reviewed by Super Plus Fitness management before your
                  staff account becomes active.
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

                <p className="mt-2 font-display text-2xl font-bold">{profile.staff_id}</p>
              </div>

              <Button variant="outline" className="mt-6" onClick={() => void logout()}>
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
      <div className="mx-auto max-w-5xl px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3 border border-border bg-card p-4">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/header-logo.png"
              alt="Super Plus Fitness & Spa"
              className="h-12 w-12 shrink-0 object-contain"
            />
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary">
                Super Plus Fitness
              </p>
              <h1 className="font-display text-2xl font-bold uppercase sm:text-3xl">
                Staff Dashboard
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/">
                <Home className="size-4" />
                Home
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => void logout()}>
              <LogOut className="size-4" />
              Logout
            </Button>
          </div>
        </header>

        {error && (
          <div
            role="alert"
            className="mt-4 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700"
          >
            {error}
          </div>
        )}
        {success && (
          <div
            role="status"
            className="mt-4 border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-700"
          >
            {success}
          </div>
        )}

        <section
          aria-label="Staff identity"
          className="mt-4 flex flex-wrap items-center gap-4 border border-border bg-card p-4 sm:p-6"
        >
          <div
            aria-hidden="true"
            className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary/10 font-display text-2xl font-bold text-primary"
          >
            {profile.full_name
              .trim()
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((name) => name[0])
              .join("")}
          </div>
          <div className="min-w-0 flex-1 basis-40">
            <h2 className="break-words font-display text-2xl font-bold uppercase sm:text-3xl">
              {profile.full_name}
            </h2>
            <p className="mt-1 break-words text-sm text-muted-foreground">
              {profile.position || getRoleLabel(profile.role)}
              {profile.department ? ` · ${profile.department}` : ""}
            </p>
            <p className="mt-2 break-all text-sm">
              <span className="text-muted-foreground">Staff ID:</span>{" "}
              <strong>{profile.staff_id}</strong>
            </p>
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${statusClass(profile.status)}`}
          >
            Active Staff
          </span>
        </section>

        <section
          aria-label="Staff timekeeping"
          className="mt-3 border border-primary/40 bg-primary/5 p-4"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-bold">
                <Clock3 className="size-4 text-primary" />
                {activeAttendance ? "Currently clocked in" : "Ready for your next shift"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {activeAttendance
                  ? `Clocked in ${formatDateTime(activeAttendance.checked_in_at)}`
                  : "Scan the attendance QR at the gym to clock in or out."}
              </p>
            </div>
            <Button asChild className="w-full shrink-0 sm:w-auto">
              <Link to="/staff-attendance">
                <ScanLine />
                Scan Attendance QR
              </Link>
            </Button>
          </div>
          {missedClockOuts > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-primary/20 pt-3 text-sm">
              <AlertCircle aria-hidden="true" className="size-4 shrink-0 text-orange-700" />
              <p className="min-w-0 flex-1">
                {missedClockOuts} earlier {missedClockOuts === 1 ? "shift has" : "shifts have"} a
                missing clock-out.
              </p>
              <Link
                to="/staff-missed-scans"
                className="font-bold text-primary underline underline-offset-4"
              >
                Report missed scan
              </Link>
            </div>
          )}
        </section>

        <Tabs value={activeSection} onValueChange={setActiveSection} className="mt-5">
          <TabsList
            aria-label="Staff dashboard sections"
            className={`grid h-auto w-full grid-cols-2 gap-2 rounded-none bg-transparent p-0 sm:grid-cols-3 ${coachPerformance ? "lg:grid-cols-6" : "lg:grid-cols-5"}`}
          >
            {[
              { value: "personal", label: "Personal Information", icon: UserRound },
              { value: "employment", label: "Employment", icon: BriefcaseBusiness },
              { value: "attendance", label: "Attendance", icon: CalendarDays },
              ...(coachPerformance
                ? [{ value: "coaching", label: "Coaching Performance", icon: Star }]
                : []),
              { value: "payments", label: "Payments", icon: Wallet },
              { value: "identification", label: "Staff QR Code", icon: QrCode },
            ].map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="min-h-12 min-w-0 gap-2 whitespace-normal rounded-none border border-border bg-card px-3 py-3 text-sm font-bold text-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="personal" className="mt-4 min-w-0 border border-border bg-card">
            <div className="border-b border-border px-4 py-4 sm:px-6">
              <h2 className="font-display text-2xl font-bold uppercase">Personal Information</h2>
            </div>
            <div className="p-4 sm:p-6">
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Full Name
                  </p>
                  <p className="mt-1 break-words font-medium">{profile.full_name}</p>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Email
                  </p>
                  <p className="mt-1 break-all font-medium">{profile.email || "—"}</p>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Phone
                  </p>
                  <p className="mt-1 break-words font-medium">{profile.phone || "Not available"}</p>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Birthday
                  </p>
                  <p className="mt-1 break-words font-medium">
                    {profile.birth_day && profile.birth_month
                      ? `${profile.birth_day}/${profile.birth_month}`
                      : "Not available"}
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Address
                  </p>
                  <p className="mt-1 break-words font-medium">
                    {profile.address || "Not available"}
                  </p>
                </div>
              </div>

              {!editContact ? (
                <Button
                  variant="outline"
                  className="mt-5"
                  onClick={() => {
                    setEditPhone(profile.phone || "");
                    setEditAddress(profile.address || "");
                    setEditContact(true);
                  }}
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
                        onChange={(event) => setEditPhone(event.target.value)}
                        type="tel"
                        className="h-11 min-w-0 border border-border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-ring"
                      />
                    </label>

                    <label className="grid gap-2 text-sm font-bold">
                      Address
                      <textarea
                        value={editAddress}
                        onChange={(event) => setEditAddress(event.target.value)}
                        rows={3}
                        className="min-w-0 border border-border bg-background p-3 font-normal outline-none focus:ring-2 focus:ring-ring"
                      />
                    </label>

                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => void updateContactInformation()} disabled={saving}>
                        <CheckCircle2 />
                        Save
                      </Button>

                      <Button variant="outline" onClick={() => setEditContact(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="employment" className="mt-4 min-w-0 border border-border bg-card">
            <div className="border-b border-border px-4 py-4 sm:px-6">
              <h2 className="font-display text-2xl font-bold uppercase">Employment Details</h2>
            </div>
            <div className="p-4 sm:p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["Position", profile.position || "Not assigned"],
                  ["Department", profile.department || "Not assigned"],
                  ["Employment Type", profile.employment_type || "Not assigned"],
                  ["Current Monthly Salary", currentSalary ? formatMoney(Number(currentSalary.current_monthly_salary), currentSalary.currency) : "Not set"],
                  ["Employment Date", formatDate(profile.employment_date)],
                  ["System Role", getRoleLabel(profile.role)],
                  ["Staff Status", statusLabel(profile.status)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      {label}
                    </p>

                    <p className="mt-1 break-words font-medium">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {coachPerformance && (
            <TabsContent value="coaching" className="mt-4 min-w-0 border border-border bg-card">
              <div className="border-b border-border px-4 py-4 sm:px-6">
                <p className="text-xs font-bold uppercase tracking-widest text-primary">Personal Training</p>
                <h2 className="mt-1 font-display text-2xl font-bold uppercase">My Coaching Performance</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                  Your own PT performance summary. Individual trainee ratings, comments, change requests and identities remain private to management.
                </p>
              </div>

              <div className="p-4 sm:p-6">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="border border-border bg-muted/20 p-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Current trainees</p>
                    <p className="mt-2 font-display text-3xl font-bold">{coachPerformance.current_trainees}</p>
                  </div>
                  <div className="border border-border bg-muted/20 p-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Two-cycle retention</p>
                    <p className="mt-2 font-display text-3xl font-bold">
                      {coachPerformance.renewal_rate === null ? "—" : `${Number(coachPerformance.renewal_rate).toFixed(0)}%`}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {coachPerformance.renewal_eligible
                        ? `${coachPerformance.renewed_same_coach}/${coachPerformance.renewal_eligible} clients retained through two renewals`
                        : "No matured two-cycle opportunities yet"}
                    </p>
                  </div>
                  <div className="border border-border bg-muted/20 p-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Overall rating</p>
                    <p className="mt-2 font-display text-3xl font-bold">
                      {coachPerformance.rating_established && coachPerformance.overall_rating !== null
                        ? `${Number(coachPerformance.overall_rating).toFixed(1)}/5`
                        : "—"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {coachPerformance.rating_established
                        ? `${coachPerformance.evaluation_count} anonymised evaluations`
                        : `${coachPerformance.evaluation_count}/2 evaluations before ratings appear`}
                    </p>
                  </div>
                  <div className="border border-border bg-muted/20 p-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Continue with me</p>
                    <p className="mt-2 font-display text-3xl font-bold">
                      {coachPerformance.rating_established && coachPerformance.continue_rate !== null
                        ? `${Number(coachPerformance.continue_rate).toFixed(0)}%`
                        : "—"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Shown only after at least 2 evaluations.
                    </p>
                  </div>
                </div>

                {!coachPerformance.rating_established ? (
                  <div className="mt-5 border border-primary/20 bg-primary/5 p-4 text-sm leading-6">
                    <div className="flex items-start gap-3">
                      <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
                      <p>
                        <strong>Feedback privacy is protected.</strong> Your category ratings and continuation percentage will appear only after at least 2 trainee evaluations. Individual comments, identities and change requests remain private to management.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Rating breakdown</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {[
                        ["Coaching Quality", coachPerformance.coaching_quality_rating, "/5"],
                        ["Professionalism", coachPerformance.professionalism_rating, "/5"],
                        ["Communication", coachPerformance.communication_rating, "/5"],
                        ["Punctuality", coachPerformance.punctuality_rating, "/5"],
                        ["Motivation", coachPerformance.motivation_rating, "/5"],
                        ["Programme Consistency", coachPerformance.program_consistency_percent, "%"],
                      ].map(([label, value, suffix]) => (
                        <div key={String(label)} className="border border-border p-4">
                          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
                          <p className="mt-2 text-xl font-bold">
                            {value === null
                              ? "—"
                              : suffix === "%"
                                ? `${Number(value).toFixed(0)}%`
                                : `${Number(value).toFixed(1)}/5`}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-5 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
                  Two-cycle retention counts a client only after they have renewed twice with the same coach. The second renewal has the same 3-day grace period. Monthly payout calculations and other coaches’ figures remain management-only.
                </div>
              </div>
            </TabsContent>
          )}

          <TabsContent value="payments" className="mt-4 min-w-0 border border-border bg-card">
            <div className="border-b border-border px-4 py-4 sm:px-6">
              <h2 className="font-display text-2xl font-bold uppercase">Payment History</h2>
            </div>
            <div className="p-4 sm:p-6">
              <PrivateStaffContractTerms />
              {salaryRecords.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No payment records available yet.
                </p>
              ) : (
                <div className="grid gap-4">
                  {salaryRecords.map((record) => (
                    <article key={record.id} className="border border-border p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                            {record.payroll_kind === "contract_commission" ? "Contract commission" : record.payroll_kind === "pt_commission" ? "PT payout" : record.payroll_kind === "monthly_salary" ? "Monthly salary" : "Salary payment"}
                          </p>

                          <p className="mt-1 font-display text-2xl font-bold">
                            {formatMoney(record.amount, record.currency)}
                          </p>
                        </div>

                        <span className="w-fit rounded-full border border-border px-3 py-1 text-xs font-bold uppercase">
                          {record.status}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-4 sm:grid-cols-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                            Pay Period
                          </p>

                          <p className="mt-1 break-words text-sm">
                            {record.pay_period_start || record.pay_period_end
                              ? `${formatDate(record.pay_period_start)} – ${formatDate(
                                  record.pay_period_end,
                                )}`
                              : "—"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                            Payment Date
                          </p>

                          <p className="mt-1 break-words text-sm">
                            {formatDate(record.payment_date)}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                            Notes
                          </p>

                          <p className="mt-1 break-words text-sm">{record.notes || "—"}</p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="attendance" className="mt-4 min-w-0 border border-border bg-card">
            <div className="border-b border-border px-4 py-4 sm:px-6">
              <h2 className="font-display text-2xl font-bold uppercase">Attendance History</h2>
            </div>
            <div className="p-4 sm:p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">Your latest 100 scans · Lagos time</p>
                <Button asChild variant="outline">
                  <Link to="/staff-missed-scans">Report a missed scan</Link>
                </Button>
              </div>
              {attendanceRecords.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No attendance records yet. Scan the attendance QR at the gym to record your first
                  shift.
                </p>
              ) : (
                <div className="grid gap-3">
                  {attendanceRecords.map((record) => (
                    <article
                      key={record.id}
                      className={`border p-4 ${!record.checked_out_at && lagosDay(record.checked_in_at) < today ? "border-orange-500/40 bg-orange-500/5" : "border-border"}`}
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
                              : lagosDay(record.checked_in_at) === today
                                ? "Still clocked in"
                                : "Missing clock-out"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-bold uppercase text-muted-foreground">
                            Duration
                          </p>

                          <p className="mt-1 text-sm font-semibold">
                            {!record.checked_out_at && lagosDay(record.checked_in_at) !== today
                              ? "Incomplete scan"
                              : durationLabel(record.checked_in_at, record.checked_out_at)}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-bold uppercase text-muted-foreground">Notes</p>

                          <p className="mt-1 break-words text-sm">{record.notes || "—"}</p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="identification" className="mt-4 min-w-0 border border-border bg-card">
            <div className="border-b border-border px-4 py-4 sm:px-6">
              <h2 className="font-display text-2xl font-bold uppercase">Staff QR Code</h2>
            </div>
            <div className="p-4 sm:p-6">
              <div className="mx-auto max-w-md text-center">
                <p className="text-sm text-muted-foreground">
                  This is your personal staff identification QR.
                </p>

                <div className="mt-6 flex justify-center bg-white p-3 sm:p-6">
                  <QRCodeSVG
                    id="staff-profile-qr"
                    className="h-auto max-w-full"
                    value={`STAFF:${profile.qr_token}`}
                    size={260}
                    level="H"
                    includeMargin
                  />
                </div>

                <p className="mt-4 font-display text-xl font-bold">{profile.staff_id}</p>

                <Button variant="outline" className="mt-5" onClick={() => void downloadQr()}>
                  <Download />
                  Download QR Code
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
        <p className="py-5 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Super Plus Fitness & Spa · Staff Portal
        </p>
      </div>
    </main>
  );
}

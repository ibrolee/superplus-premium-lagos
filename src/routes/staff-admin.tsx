import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  DollarSign,
  LogOut,
  RefreshCw,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { Button } from "../components/ui/button";

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
  created_at: string;
};

type SalaryRecord = {
  id: string;
  staff_profile_id: string;
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
};

const roles = [
  { value: "staff", label: "Staff" },
  { value: "reception", label: "Reception" },
  { value: "trainer", label: "Trainer" },
  { value: "spa_staff", label: "Spa Staff" },
  { value: "manager", label: "Manager" },
  { value: "admin", label: "Admin" },
];

const departments = [
  "Management",
  "Reception",
  "Fitness",
  "Personal Training",
  "Spa",
  "Cleaning",
  "Security",
  "Marketing",
  "Administration",
  "Other",
];

const employmentTypes = [
  "Full Time",
  "Part Time",
  "Contract",
  "Casual",
];

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

export default function StaffAdminPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [selectedStaff, setSelectedStaff] =
    useState<StaffProfile | null>(null);

  const [salaryRecords, setSalaryRecords] = useState<SalaryRecord[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<
    AttendanceRecord[]
  >([]);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<
    "all" | "pending" | "approved" | "suspended" | "inactive"
  >("all");

  const [showSalaryForm, setShowSalaryForm] = useState(false);

  const [position, setPosition] = useState("");
  const [department, setDepartment] = useState("");
  const [employmentType, setEmploymentType] = useState("Full Time");
  const [employmentDate, setEmploymentDate] = useState("");
  const [role, setRole] = useState("staff");

  const [salaryAmount, setSalaryAmount] = useState("");
  const [salaryStart, setSalaryStart] = useState("");
  const [salaryEnd, setSalaryEnd] = useState("");
  const [salaryPaymentDate, setSalaryPaymentDate] = useState("");
  const [salaryStatus, setSalaryStatus] = useState<
    "pending" | "paid" | "cancelled"
  >("pending");
  const [salaryNotes, setSalaryNotes] = useState("");

  async function loadStaff() {
    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/staff";
      return;
    }

    const { data: adminRecord, error: adminError } = await supabase
      .from("staff_users")
      .select("id, role, active")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (adminError) {
      setError(adminError.message);
      setLoading(false);
      return;
    }

    const isAdmin =
      adminRecord?.active === true &&
      ["admin", "owner", "manager"].includes(adminRecord.role);

    if (!isAdmin) {
      setError("You do not have permission to access staff management.");
      setLoading(false);
      return;
    }

    const { data, error: staffError } = await supabase
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
        created_at
      `,
      )
      .order("created_at", { ascending: false });

    if (staffError) {
      setError(staffError.message);
      setLoading(false);
      return;
    }

    setStaff((data || []) as StaffProfile[]);
    setLoading(false);
  }

  async function loadStaffDetails(profile: StaffProfile) {
    setSelectedStaff(profile);
    setError("");
    setSuccess("");

    setPosition(profile.position || "");
    setDepartment(profile.department || "");
    setEmploymentType(profile.employment_type || "Full Time");
    setEmploymentDate(profile.employment_date || "");
    setRole(profile.role || "staff");

    const [salaryResult, attendanceResult] = await Promise.all([
      supabase
        .from("staff_salary_records")
        .select(
          `
          id,
          staff_profile_id,
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
        .eq("staff_profile_id", profile.id)
        .order("created_at", { ascending: false }),

      supabase
        .from("staff_attendance")
        .select(
          `
          id,
          checked_in_at,
          checked_out_at,
          notes
        `,
        )
        .eq("staff_profile_id", profile.id)
        .order("checked_in_at", { ascending: false })
        .limit(50),
    ]);

    if (salaryResult.error) {
      setError(salaryResult.error.message);
      return;
    }

    if (attendanceResult.error) {
      setError(attendanceResult.error.message);
      return;
    }

    setSalaryRecords((salaryResult.data || []) as SalaryRecord[]);
    setAttendanceRecords(
      (attendanceResult.data || []) as AttendanceRecord[],
    );
  }

  async function saveStaffDetails() {
    if (!selectedStaff) return;

    setSaving(true);
    setError("");
    setSuccess("");

    const { error: profileError } = await supabase
      .from("staff_profiles")
      .update({
        position: position.trim() || null,
        department: department || null,
        employment_type: employmentType,
        employment_date: employmentDate || null,
        role,
      })
      .eq("id", selectedStaff.id);

    if (profileError) {
      setError(profileError.message);
      setSaving(false);
      return;
    }

    const { data: existingStaffUser, error: staffUserLookupError } =
      await supabase
        .from("staff_users")
        .select("id")
        .eq("auth_user_id", selectedStaff.auth_user_id)
        .maybeSingle();

    if (staffUserLookupError) {
      setError(staffUserLookupError.message);
      setSaving(false);
      return;
    }

    if (existingStaffUser?.id) {
      const { error: staffUserUpdateError } = await supabase
        .from("staff_users")
        .update({
          role,
          active: true,
          full_name: selectedStaff.full_name,
        })
        .eq("id", existingStaffUser.id);

      if (staffUserUpdateError) {
        setError(staffUserUpdateError.message);
        setSaving(false);
        return;
      }
    } else {
      const { error: staffUserInsertError } = await supabase
        .from("staff_users")
        .insert({
          id: crypto.randomUUID(),
          auth_user_id: selectedStaff.auth_user_id,
          role,
          full_name: selectedStaff.full_name,
          active: true,
        });

      if (staffUserInsertError) {
        setError(staffUserInsertError.message);
        setSaving(false);
        return;
      }
    }

    if (selectedStaff.status === "pending") {
      const { error: approvalError } = await supabase
        .from("staff_profiles")
        .update({ status: "approved" })
        .eq("id", selectedStaff.id);

      if (approvalError) {
        setError(approvalError.message);
        setSaving(false);
        return;
      }
    }

    setSuccess("Staff details saved successfully.");
    setSaving(false);

    await loadStaff();

    const updated = staff.find((item) => item.id === selectedStaff.id);

    if (updated) {
      await loadStaffDetails({
        ...updated,
        position: position.trim() || null,
        department: department || null,
        employment_type: employmentType,
        employment_date: employmentDate || null,
        role,
        status: "approved",
      });
    }
  }

  async function changeStaffStatus(
    profile: StaffProfile,
    newStatus: StaffProfile["status"],
  ) {
    setSaving(true);
    setError("");
    setSuccess("");

    const { error: profileError } = await supabase
      .from("staff_profiles")
      .update({
        status: newStatus,
      })
      .eq("id", profile.id);

    if (profileError) {
      setError(profileError.message);
      setSaving(false);
      return;
    }

    const { data: existingStaffUser } = await supabase
      .from("staff_users")
      .select("id")
      .eq("auth_user_id", profile.auth_user_id)
      .maybeSingle();

    if (existingStaffUser?.id) {
      await supabase
        .from("staff_users")
        .update({
          active: newStatus === "approved",
        })
        .eq("id", existingStaffUser.id);
    }

    setSuccess(
      `${profile.full_name} is now ${statusLabel(newStatus).toLowerCase()}.`,
    );

    setSaving(false);
    await loadStaff();

    if (selectedStaff?.id === profile.id) {
      setSelectedStaff({
        ...profile,
        status: newStatus,
      });
    }
  }

  async function addSalaryRecord() {
    if (!selectedStaff) return;

    const amount = Number(salaryAmount);

    if (!amount || amount <= 0) {
      setError("Enter a valid salary amount.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const { error: salaryError } = await supabase
      .from("staff_salary_records")
      .insert({
        staff_profile_id: selectedStaff.id,
        amount,
        currency: "NGN",
        pay_period_start: salaryStart || null,
        pay_period_end: salaryEnd || null,
        payment_date: salaryPaymentDate || null,
        status: salaryStatus,
        notes: salaryNotes.trim() || null,
      });

    if (salaryError) {
      setError(salaryError.message);
      setSaving(false);
      return;
    }

    setSalaryAmount("");
    setSalaryStart("");
    setSalaryEnd("");
    setSalaryPaymentDate("");
    setSalaryStatus("pending");
    setSalaryNotes("");
    setShowSalaryForm(false);

    setSuccess("Salary record added successfully.");
    setSaving(false);

    await loadStaffDetails(selectedStaff);
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/staff";
  }

  const filteredStaff = useMemo(() => {
    const query = search.trim().toLowerCase();

    return staff.filter((member) => {
      const matchesFilter =
        filter === "all" || member.status === filter;

      if (!matchesFilter) return false;

      if (!query) return true;

      return (
        member.full_name?.toLowerCase().includes(query) ||
        member.email?.toLowerCase().includes(query) ||
        member.phone?.toLowerCase().includes(query) ||
        member.staff_id?.toLowerCase().includes(query)
      );
    });
  }, [staff, search, filter]);

  const pendingCount = staff.filter(
    (member) => member.status === "pending",
  ).length;

  const approvedCount = staff.filter(
    (member) => member.status === "approved",
  ).length;

  const suspendedCount = staff.filter(
    (member) => member.status === "suspended",
  ).length;

  const inactiveCount = staff.filter(
    (member) => member.status === "inactive",
  ).length;

  useEffect(() => {
    void loadStaff();
  }, []);

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-[0.2em]">
                Super Plus Fitness
              </span>
            </div>

            <h1 className="font-display text-3xl font-bold uppercase">
              Staff Management
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Manage staff applications, employment information,
              salaries and attendance.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => void loadStaff()}
              disabled={loading || saving}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>

            <Button variant="outline" onClick={logout}>
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-700">
            {success}
          </div>
        )}

        {loading ? (
          <div className="py-20 text-center text-muted-foreground">
            Loading staff management...
          </div>
        ) : (
          <>
            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="border border-border bg-card p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Pending
                </p>
                <p className="mt-2 text-4xl font-bold">{pendingCount}</p>
              </div>

              <div className="border border-border bg-card p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Approved
                </p>
                <p className="mt-2 text-4xl font-bold">{approvedCount}</p>
              </div>

              <div className="border border-border bg-card p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Suspended
                </p>
                <p className="mt-2 text-4xl font-bold">{suspendedCount}</p>
              </div>

              <div className="border border-border bg-card p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Inactive
                </p>
                <p className="mt-2 text-4xl font-bold">{inactiveCount}</p>
              </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
              <section className="border border-border bg-card">
                <div className="border-b border-border p-5">
                  <h2 className="font-display text-xl font-bold uppercase">
                    Staff
                  </h2>

                  <input
                    value={search}
                    onChange={(event) =>
                      setSearch(event.target.value)
                    }
                    placeholder="Search staff..."
                    className="mt-4 h-11 w-full border border-border bg-background px-3 outline-none focus:border-foreground"
                  />

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {[
                      ["all", "All"],
                      ["pending", "Pending"],
                      ["approved", "Approved"],
                      ["suspended", "Suspended"],
                      ["inactive", "Inactive"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          setFilter(
                            value as
                              | "all"
                              | "pending"
                              | "approved"
                              | "suspended"
                              | "inactive",
                          )
                        }
                        className={`border px-3 py-2 text-xs font-semibold uppercase ${
                          filter === value
                            ? "border-foreground bg-foreground text-background"
                            : "border-border bg-background"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="max-h-[700px] overflow-y-auto">
                  {filteredStaff.length === 0 ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      No staff found.
                    </div>
                  ) : (
                    filteredStaff.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() =>
                          void loadStaffDetails(member)
                        }
                        className={`w-full border-b border-border p-5 text-left transition ${
                          selectedStaff?.id === member.id
                            ? "bg-muted"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="truncate font-display text-lg font-bold uppercase">
                              {member.full_name}
                            </h3>

                            <p className="mt-1 text-xs text-muted-foreground">
                              {member.staff_id}
                            </p>

                            {member.position && (
                              <p className="mt-2 text-sm">
                                {member.position}
                              </p>
                            )}
                          </div>

                          <span
                            className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${statusClass(
                              member.status,
                            )}`}
                          >
                            {statusLabel(member.status)}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </section>

              <section>
                {!selectedStaff ? (
                  <div className="flex min-h-[500px] items-center justify-center border border-border bg-card p-8 text-center">
                    <div>
                      <UserRound className="mx-auto h-12 w-12 text-muted-foreground" />

                      <h2 className="mt-4 font-display text-2xl font-bold uppercase">
                        Select a Staff Member
                      </h2>

                      <p className="mt-2 max-w-md text-sm text-muted-foreground">
                        Select a staff member from the list to review
                        their application, employment information,
                        salary and attendance.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="border border-border bg-card p-6">
                      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                              <UserRound className="h-6 w-6" />
                            </div>

                            <div>
                              <h2 className="font-display text-3xl font-bold uppercase">
                                {selectedStaff.full_name}
                              </h2>

                              <p className="text-sm text-muted-foreground">
                                {selectedStaff.staff_id}
                              </p>
                            </div>
                          </div>
                        </div>

                        <span
                          className={`w-fit rounded-full border px-3 py-2 text-xs font-bold uppercase ${statusClass(
                            selectedStaff.status,
                          )}`}
                        >
                          {statusLabel(selectedStaff.status)}
                        </span>
                      </div>

                      {selectedStaff.status === "pending" && (
                        <div className="mt-6 border border-orange-500/30 bg-orange-500/10 p-4">
                          <div className="flex gap-3">
                            <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />

                            <div>
                              <p className="font-semibold">
                                Pending Staff Application
                              </p>

                              <p className="mt-1 text-sm text-muted-foreground">
                                Review the applicant's information,
                                assign their employment details and
                                click Save & Approve.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="border border-border bg-card p-6">
                      <h3 className="font-display text-xl font-bold uppercase">
                        Personal Information
                      </h3>

                      <div className="mt-5 grid gap-5 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                            Full Name
                          </p>
                          <p className="mt-1 font-medium">
                            {selectedStaff.full_name}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                            Email
                          </p>
                          <p className="mt-1 break-all font-medium">
                            {selectedStaff.email || "—"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                            Phone
                          </p>
                          <p className="mt-1 font-medium">
                            {selectedStaff.phone || "—"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                            Birthday
                          </p>
                          <p className="mt-1 font-medium">
                            {selectedStaff.birth_day &&
                            selectedStaff.birth_month
                              ? `${selectedStaff.birth_day}/${selectedStaff.birth_month}`
                              : "—"}
                          </p>
                        </div>

                        <div className="sm:col-span-2">
                          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                            Address
                          </p>
                          <p className="mt-1 font-medium">
                            {selectedStaff.address || "—"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="border border-border bg-card p-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="font-display text-xl font-bold uppercase">
                            Employment Information
                          </h3>

                          <p className="mt-1 text-sm text-muted-foreground">
                            Assign the staff member's job and access
                            level.
                          </p>
                        </div>

                        {selectedStaff.status === "pending" && (
                          <span className="text-xs font-semibold uppercase text-orange-600">
                            Approval Required
                          </span>
                        )}
                      </div>

                      <div className="mt-6 grid gap-5 sm:grid-cols-2">
                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                            Position
                          </span>

                          <input
                            value={position}
                            onChange={(event) =>
                              setPosition(event.target.value)
                            }
                            placeholder="e.g. Personal Trainer"
                            className="mt-2 h-11 w-full border border-border bg-background px-3 outline-none focus:border-foreground"
                          />
                        </label>

                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                            Department
                          </span>

                          <select
                            value={department}
                            onChange={(event) =>
                              setDepartment(event.target.value)
                            }
                            className="mt-2 h-11 w-full border border-border bg-background px-3 outline-none"
                          >
                            <option value="">
                              Select department
                            </option>

                            {departments.map((item) => (
                              <option key={item} value={item}>
                                {item}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                            Employment Type
                          </span>

                          <select
                            value={employmentType}
                            onChange={(event) =>
                              setEmploymentType(event.target.value)
                            }
                            className="mt-2 h-11 w-full border border-border bg-background px-3 outline-none"
                          >
                            {employmentTypes.map((item) => (
                              <option key={item} value={item}>
                                {item}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                            Employment Date
                          </span>

                          <input
                            type="date"
                            value={employmentDate}
                            onChange={(event) =>
                              setEmploymentDate(event.target.value)
                            }
                            className="mt-2 h-11 w-full border border-border bg-background px-3 outline-none"
                          />
                        </label>

                        <label className="block sm:col-span-2">
                          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                            Staff Role / System Access
                          </span>

                          <select
                            value={role}
                            onChange={(event) =>
                              setRole(event.target.value)
                            }
                            className="mt-2 h-11 w-full border border-border bg-background px-3 outline-none"
                          >
                            {roles.map((item) => (
                              <option
                                key={item.value}
                                value={item.value}
                              >
                                {item.label}
                              </option>
                            ))}
                          </select>

                          <p className="mt-2 text-xs text-muted-foreground">
                            Admin, Manager and Reception roles can
                            provide access to staff-management or
                            reception functions depending on the
                            portal permissions.
                          </p>
                        </label>
                      </div>

                      <div className="mt-6 flex flex-wrap gap-3">
                        <Button
                          onClick={() =>
                            void saveStaffDetails()
                          }
                          disabled={saving}
                        >
                          <CheckCircle2 className="h-4 w-4" />

                          {selectedStaff.status === "pending"
                            ? "Save & Approve"
                            : "Save Changes"}
                        </Button>

                        {selectedStaff.status === "approved" && (
                          <Button
                            variant="outline"
                            onClick={() =>
                              void changeStaffStatus(
                                selectedStaff,
                                "suspended",
                              )
                            }
                            disabled={saving}
                          >
                            <XCircle className="h-4 w-4" />
                            Suspend Staff
                          </Button>
                        )}

                        {selectedStaff.status === "suspended" && (
                          <Button
                            onClick={() =>
                              void changeStaffStatus(
                                selectedStaff,
                                "approved",
                              )
                            }
                            disabled={saving}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Reactivate Staff
                          </Button>
                        )}

                        {selectedStaff.status !== "inactive" && (
                          <Button
                            variant="outline"
                            onClick={() =>
                              void changeStaffStatus(
                                selectedStaff,
                                "inactive",
                              )
                            }
                            disabled={saving}
                          >
                            <XCircle className="h-4 w-4" />
                            Mark Inactive
                          </Button>
                        )}

                        {selectedStaff.status === "inactive" && (
                          <Button
                            onClick={() =>
                              void changeStaffStatus(
                                selectedStaff,
                                "approved",
                              )
                            }
                            disabled={saving}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Reactivate
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="border border-border bg-card p-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="font-display text-xl font-bold uppercase">
                            Salary
                          </h3>

                          <p className="mt-1 text-sm text-muted-foreground">
                            Salary records are visible only to
                            authorized management and the staff member.
                          </p>
                        </div>

                        <Button
                          variant="outline"
                          onClick={() =>
                            setShowSalaryForm((current) => !current)
                          }
                        >
                          <DollarSign className="h-4 w-4" />
                          {showSalaryForm
                            ? "Close"
                            : "Add Salary"}
                        </Button>
                      </div>

                      {showSalaryForm && (
                        <div className="mt-6 border border-border bg-muted/30 p-5">
                          <div className="grid gap-5 sm:grid-cols-2">
                            <label>
                              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                                Amount
                              </span>

                              <input
                                type="number"
                                min="0"
                                value={salaryAmount}
                                onChange={(event) =>
                                  setSalaryAmount(event.target.value)
                                }
                                placeholder="e.g. 150000"
                                className="mt-2 h-11 w-full border border-border bg-background px-3 outline-none"
                              />
                            </label>

                            <label>
                              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                                Status
                              </span>

                              <select
                                value={salaryStatus}
                                onChange={(event) =>
                                  setSalaryStatus(
                                    event.target.value as
                                      | "pending"
                                      | "paid"
                                      | "cancelled",
                                  )
                                }
                                className="mt-2 h-11 w-full border border-border bg-background px-3 outline-none"
                              >
                                <option value="pending">
                                  Pending
                                </option>
                                <option value="paid">Paid</option>
                                <option value="cancelled">
                                  Cancelled
                                </option>
                              </select>
                            </label>

                            <label>
                              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                                Pay Period Start
                              </span>

                              <input
                                type="date"
                                value={salaryStart}
                                onChange={(event) =>
                                  setSalaryStart(event.target.value)
                                }
                                className="mt-2 h-11 w-full border border-border bg-background px-3 outline-none"
                              />
                            </label>

                            <label>
                              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                                Pay Period End
                              </span>

                              <input
                                type="date"
                                value={salaryEnd}
                                onChange={(event) =>
                                  setSalaryEnd(event.target.value)
                                }
                                className="mt-2 h-11 w-full border border-border bg-background px-3 outline-none"
                              />
                            </label>

                            <label>
                              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                                Payment Date
                              </span>

                              <input
                                type="date"
                                value={salaryPaymentDate}
                                onChange={(event) =>
                                  setSalaryPaymentDate(
                                    event.target.value,
                                  )
                                }
                                className="mt-2 h-11 w-full border border-border bg-background px-3 outline-none"
                              />
                            </label>

                            <label>
                              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                                Notes
                              </span>

                              <input
                                value={salaryNotes}
                                onChange={(event) =>
                                  setSalaryNotes(event.target.value)
                                }
                                placeholder="Optional"
                                className="mt-2 h-11 w-full border border-border bg-background px-3 outline-none"
                              />
                            </label>
                          </div>

                          <div className="mt-5">
                            <Button
                              onClick={() =>
                                void addSalaryRecord()
                              }
                              disabled={saving}
                            >
                              <DollarSign className="h-4 w-4" />
                              Save Salary Record
                            </Button>
                          </div>
                        </div>
                      )}

                      <div className="mt-6 overflow-x-auto">
                        {salaryRecords.length === 0 ? (
                          <p className="py-8 text-center text-sm text-muted-foreground">
                            No salary records yet.
                          </p>
                        ) : (
                          <table className="w-full min-w-[700px] text-left text-sm">
                            <thead>
                              <tr className="border-b border-border text-xs uppercase tracking-widest text-muted-foreground">
                                <th className="px-3 py-3">
                                  Amount
                                </th>
                                <th className="px-3 py-3">
                                  Period
                                </th>
                                <th className="px-3 py-3">
                                  Payment Date
                                </th>
                                <th className="px-3 py-3">
                                  Status
                                </th>
                                <th className="px-3 py-3">
                                  Notes
                                </th>
                              </tr>
                            </thead>

                            <tbody>
                              {salaryRecords.map((record) => (
                                <tr
                                  key={record.id}
                                  className="border-b border-border"
                                >
                                  <td className="px-3 py-4 font-semibold">
                                    {formatMoney(
                                      record.amount,
                                      record.currency,
                                    )}
                                  </td>

                                  <td className="px-3 py-4">
                                    {record.pay_period_start ||
                                    record.pay_period_end
                                      ? `${formatDate(
                                          record.pay_period_start,
                                        )} – ${formatDate(
                                          record.pay_period_end,
                                        )}`
                                      : "—"}
                                  </td>

                                  <td className="px-3 py-4">
                                    {formatDate(
                                      record.payment_date,
                                    )}
                                  </td>

                                  <td className="px-3 py-4">
                                    <span className="rounded-full border border-border px-2 py-1 text-xs font-semibold uppercase">
                                      {record.status}
                                    </span>
                                  </td>

                                  <td className="px-3 py-4">
                                    {record.notes || "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>

                    <div className="border border-border bg-card p-6">
                      <div>
                        <h3 className="font-display text-xl font-bold uppercase">
                          Attendance
                        </h3>

                        <p className="mt-1 text-sm text-muted-foreground">
                          Recent staff clock-in and clock-out records.
                        </p>
                      </div>

                      <div className="mt-6 overflow-x-auto">
                        {attendanceRecords.length === 0 ? (
                          <p className="py-8 text-center text-sm text-muted-foreground">
                            No attendance records yet.
                          </p>
                        ) : (
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
                              {attendanceRecords.map((record) => {
                                const start = new Date(
                                  record.checked_in_at,
                                ).getTime();

                                const end = record.checked_out_at
                                  ? new Date(
                                      record.checked_out_at,
                                    ).getTime()
                                  : Date.now();

                                const minutes = Math.max(
                                  0,
                                  Math.floor(
                                    (end - start) / 60000,
                                  ),
                                );

                                const hours = Math.floor(
                                  minutes / 60,
                                );

                                const remainingMinutes =
                                  minutes % 60;

                                return (
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
                                      {hours > 0
                                        ? `${hours}h ${remainingMinutes}m`
                                        : `${remainingMinutes}m`}
                                    </td>

                                    <td className="px-3 py-4">
                                      {record.notes || "—"}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
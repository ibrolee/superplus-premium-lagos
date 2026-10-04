import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  BriefcaseBusiness,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import { AdminWorkspaceShell } from "@/components/admin/AdminWorkspaceShell";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/management-staff-management")({
  component: ManagementStaffManagement,
});

type StaffStatus = "pending" | "approved" | "suspended" | "inactive";

type StaffProfile = {
  id: string;
  auth_user_id: string;
  staff_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  position: string | null;
  department: string | null;
  employment_type: string | null;
  employment_date: string | null;
  role: string;
  status: StaffStatus;
  created_at: string;
};

type SalarySetting = {
  staff_profile_id: string;
  current_monthly_salary: number;
  currency: string;
  updated_at: string;
};

type EditForm = {
  full_name: string;
  phone: string;
  address: string;
  position: string;
  department: string;
  employment_type: string;
  employment_date: string;
  role: string;
  status: StaffStatus;
  salary: string;
};

const staffTitleSuggestions = [
  "Administrator",
  "Receptionist",
  "In-house Coach",
  "Part-time Coach",
  "Manager",
  "Maintenance Lead",
  "Maintenance Assistant",
  "Spa Therapist",
  "Cleaner",
  "Security",
  "Marketing",
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

const employmentTypes = ["Full Time", "Part Time", "Contract", "Casual"];

const roleOptions = [
  { value: "staff", label: "Staff" },
  { value: "reception", label: "Reception" },
  { value: "trainer", label: "Trainer" },
  { value: "spa_staff", label: "Spa Staff" },
  { value: "manager", label: "Manager" },
];

const statusLabel = (status: StaffStatus) =>
  ({
    pending: "Pending",
    approved: "Approved",
    suspended: "Suspended",
    inactive: "Inactive",
  })[status];

const statusClass = (status: StaffStatus) =>
  ({
    pending: "bg-amber-100 text-amber-800",
    approved: "bg-green-100 text-green-800",
    suspended: "bg-red-100 text-red-800",
    inactive: "bg-slate-100 text-slate-700",
  })[status];

const formatMoney = (amount: number, currency = "NGN") =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);

function emptyForm(): EditForm {
  return {
    full_name: "",
    phone: "",
    address: "",
    position: "",
    department: "",
    employment_type: "Full Time",
    employment_date: "",
    role: "staff",
    status: "approved",
    salary: "",
  };
}

function ManagementStaffManagement() {
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [salarySettings, setSalarySettings] = useState<SalarySetting[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<EditForm>(emptyForm);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | StaffStatus>("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setMessage("");

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setAuthorized(false);
      setError("Sign in with the administrator account to manage staff.");
      setLoading(false);
      return;
    }

    const { data: adminUser, error: adminError } = await supabase
      .from("staff_users")
      .select("role,active")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (adminError) {
      setAuthorized(false);
      setError(adminError.message);
      setLoading(false);
      return;
    }

    const adminRole = String(adminUser?.role || "").toLowerCase();
    if (!adminUser?.active || !["admin", "owner"].includes(adminRole)) {
      setAuthorized(false);
      setError("Only an active Admin or Owner account can manage staff profiles and salaries.");
      setLoading(false);
      return;
    }

    const [profilesResult, salaryResult] = await Promise.all([
      supabase
        .from("staff_profiles")
        .select(
          "id,auth_user_id,staff_id,full_name,email,phone,address,position,department,employment_type,employment_date,role,status,created_at",
        )
        .order("full_name", { ascending: true }),
      supabase
        .from("staff_salary_settings")
        .select("staff_profile_id,current_monthly_salary,currency,updated_at"),
    ]);

    if (profilesResult.error || salaryResult.error) {
      setAuthorized(false);
      setError(profilesResult.error?.message || salaryResult.error?.message || "Unable to load staff.");
      setLoading(false);
      return;
    }

    const profiles = (profilesResult.data || []) as StaffProfile[];
    const salaries = (salaryResult.data || []) as SalarySetting[];

    setStaff(profiles);
    setSalarySettings(salaries);
    setAuthorized(true);

    setSelectedId((current) => {
      if (current && profiles.some((profile) => profile.id === current)) return current;
      return profiles[0]?.id || null;
    });

    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const salaryMap = useMemo(
    () => new Map(salarySettings.map((row) => [row.staff_profile_id, row])),
    [salarySettings],
  );

  const selectedStaff = useMemo(
    () => staff.find((profile) => profile.id === selectedId) || null,
    [selectedId, staff],
  );

  useEffect(() => {
    if (!selectedStaff) {
      setForm(emptyForm());
      return;
    }
    const salary = salaryMap.get(selectedStaff.id);
    setForm({
      full_name: selectedStaff.full_name || "",
      phone: selectedStaff.phone || "",
      address: selectedStaff.address || "",
      position: selectedStaff.position || "",
      department: selectedStaff.department || "",
      employment_type: selectedStaff.employment_type || "Full Time",
      employment_date: selectedStaff.employment_date || "",
      role: selectedStaff.role || "staff",
      status: selectedStaff.status || "approved",
      salary: salary ? String(Number(salary.current_monthly_salary)) : "",
    });
    setError("");
    setMessage("");
  }, [selectedStaff, salaryMap]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return staff.filter((profile) => {
      if (filter !== "all" && profile.status !== filter) return false;
      if (!needle) return true;
      return [
        profile.full_name,
        profile.staff_id,
        profile.email,
        profile.phone,
        profile.position,
        profile.department,
        profile.role,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [filter, query, staff]);

  const counts = useMemo(
    () => ({
      total: staff.length,
      approved: staff.filter((profile) => profile.status === "approved").length,
      pending: staff.filter((profile) => profile.status === "pending").length,
      coaches: staff.filter((profile) =>
        ["in-house coach", "part-time coach"].includes((profile.position || "").trim().toLowerCase()),
      ).length,
    }),
    [staff],
  );

  async function saveSelectedStaff() {
    if (!selectedStaff) return;

    const cleanName = form.full_name.trim();
    if (!cleanName) {
      setError("Staff name is required.");
      return;
    }

    const salaryText = form.salary.replace(/,/g, "").trim();
    const salaryAmount = salaryText === "" ? null : Number(salaryText);
    if (salaryAmount !== null && (!Number.isFinite(salaryAmount) || salaryAmount < 0)) {
      setError("Enter a valid current monthly salary or leave it blank.");
      return;
    }

    const cleanPosition = form.position.trim();
    const nextEmploymentType =
      cleanPosition.toLowerCase() === "part-time coach" ? "Part Time" : form.employment_type;

    setSaving(true);
    setError("");
    setMessage("");

    const { error: profileError } = await supabase
      .from("staff_profiles")
      .update({
        full_name: cleanName,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        position: cleanPosition || null,
        department: form.department || null,
        employment_type: nextEmploymentType,
        employment_date: form.employment_date || null,
        role: form.role,
        status: form.status,
      })
      .eq("id", selectedStaff.id);

    if (profileError) {
      setError(profileError.message);
      setSaving(false);
      return;
    }

    if (salaryAmount === null) {
      const { error: salaryDeleteError } = await supabase
        .from("staff_salary_settings")
        .delete()
        .eq("staff_profile_id", selectedStaff.id);

      if (salaryDeleteError) {
        setError(salaryDeleteError.message);
        setSaving(false);
        return;
      }
    } else {
      const { error: salaryError } = await supabase
        .from("staff_salary_settings")
        .upsert(
          {
            staff_profile_id: selectedStaff.id,
            current_monthly_salary: salaryAmount,
            currency: "NGN",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "staff_profile_id" },
        );

      if (salaryError) {
        setError(salaryError.message);
        setSaving(false);
        return;
      }
    }

    setMessage("Staff profile and current salary saved successfully.");
    setSaving(false);
    await load();
  }

  return (
    <AdminWorkspaceShell
      title="Staff Management"
      subtitle="Manage staff profiles, employment details, coach titles, account status and current monthly salary from one clean workspace."
      active="/management-staff-management"
    >
      <section className="mt-7 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: "Total staff", value: counts.total, icon: Users },
          { label: "Approved", value: counts.approved, icon: BadgeCheck },
          { label: "Pending", value: counts.pending, icon: Clock3 },
          { label: "PT coaches", value: counts.coaches, icon: BriefcaseBusiness },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-[#dce7d8] bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-[#68796d]">{label}</p>
              <Icon size={17} className="text-[#2f7746]" />
            </div>
            <p className="mt-3 text-3xl font-black">{value}</p>
          </div>
        ))}
      </section>

      {!!error && (
        <p role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </p>
      )}
      {!!message && (
        <p role="status" className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          {message}
        </p>
      )}

      {loading ? (
        <div className="mt-5 rounded-[24px] border border-[#d8e5d4] bg-white p-8 text-sm text-[#647468]">
          Loading staff management…
        </div>
      ) : !authorized ? null : (
        <section className="mt-5 grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="rounded-[24px] border border-[#d8e5d4] bg-white p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#397748]">Team directory</p>
                <h2 className="mt-1 text-xl font-black">Choose a staff member</h2>
              </div>
              <button
                type="button"
                onClick={() => void load()}
                className="grid size-10 place-items-center rounded-xl border border-[#d8e2d5] text-[#356942]"
                aria-label="Refresh staff"
              >
                <RefreshCw size={16} />
              </button>
            </div>

            <label className="relative mt-4 block">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#79907b]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, title or staff ID"
                className="w-full rounded-xl border border-[#d8e2d5] bg-[#f8faf6] py-3 pl-10 pr-3 text-sm outline-none focus:border-[#63915f]"
              />
            </label>

            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {(["all", "approved", "pending", "suspended", "inactive"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={
                    "shrink-0 rounded-full px-3 py-2 text-[10px] font-black capitalize " +
                    (filter === value
                      ? "bg-[#193b2a] text-white"
                      : "border border-[#d8e2d5] bg-white text-[#607264]")
                  }
                >
                  {value === "all" ? "All" : value}
                </button>
              ))}
            </div>

            <div className="mt-4 max-h-[720px] space-y-2 overflow-y-auto pr-1">
              {visible.map((profile) => {
                const salary = salaryMap.get(profile.id);
                const selected = selectedId === profile.id;
                return (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => setSelectedId(profile.id)}
                    className={
                      "w-full rounded-2xl border p-4 text-left transition " +
                      (selected
                        ? "border-[#87b77e] bg-[#eef6e9]"
                        : "border-[#e1e8dd] bg-white hover:border-[#b9d0b4]")
                    }
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-[#203426]">{profile.full_name}</p>
                        <p className="mt-1 truncate text-[11px] text-[#718172]">
                          {[profile.position || profile.role, profile.department].filter(Boolean).join(" · ") || "Staff"}
                        </p>
                      </div>
                      <span className={"shrink-0 rounded-full px-2 py-1 text-[9px] font-black " + statusClass(profile.status)}>
                        {statusLabel(profile.status)}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#e4ebe1] pt-3">
                      <span className="text-[10px] font-bold text-[#718172]">{profile.staff_id || "No staff ID"}</span>
                      <span className="text-[10px] font-black text-[#315d3d]">
                        {salary ? formatMoney(salary.current_monthly_salary, salary.currency) : "Salary not set"}
                      </span>
                    </div>
                  </button>
                );
              })}
              {!visible.length && (
                <p className="rounded-xl border border-dashed border-[#d8e2d5] p-6 text-center text-xs text-[#748276]">
                  No staff match this search.
                </p>
              )}
            </div>
          </div>

          <div className="min-w-0">
            {!selectedStaff ? (
              <div className="rounded-[24px] border border-[#d8e5d4] bg-white p-8 text-center text-sm text-[#647468]">
                Select a staff member to manage their profile.
              </div>
            ) : (
              <div className="space-y-5">
                <section className="rounded-[24px] border border-[#d8e5d4] bg-white p-4 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#193b2a] text-white">
                        <UserCog size={22} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#397748]">Staff profile</p>
                        <h2 className="mt-1 truncate text-2xl font-black">{selectedStaff.full_name}</h2>
                        <p className="mt-1 text-xs text-[#6b796f]">
                          {selectedStaff.staff_id || "No staff ID"} · {selectedStaff.email || "No email"}
                        </p>
                      </div>
                    </div>
                    <span className={"self-start rounded-full px-3 py-1.5 text-[10px] font-black " + statusClass(selectedStaff.status)}>
                      {statusLabel(selectedStaff.status)}
                    </span>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <label className="text-xs font-black text-[#34483a]">
                      Full name
                      <input
                        value={form.full_name}
                        onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))}
                        className="mt-1.5 w-full rounded-xl border border-[#d4dfd1] bg-white px-3 py-3 text-sm font-normal outline-none focus:border-[#63915f]"
                      />
                    </label>
                    <label className="text-xs font-black text-[#34483a]">
                      Phone
                      <input
                        value={form.phone}
                        onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                        className="mt-1.5 w-full rounded-xl border border-[#d4dfd1] bg-white px-3 py-3 text-sm font-normal outline-none focus:border-[#63915f]"
                      />
                    </label>
                    <label className="text-xs font-black text-[#34483a] sm:col-span-2">
                      Address
                      <textarea
                        rows={2}
                        value={form.address}
                        onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                        className="mt-1.5 w-full resize-y rounded-xl border border-[#d4dfd1] bg-white px-3 py-3 text-sm font-normal outline-none focus:border-[#63915f]"
                      />
                    </label>
                  </div>
                </section>

                <section className="rounded-[24px] border border-[#d8e5d4] bg-white p-4 sm:p-6">
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#eef6e9] text-[#356942]">
                      <BriefcaseBusiness size={18} />
                    </span>
                    <div>
                      <h3 className="text-lg font-black">Employment</h3>
                      <p className="mt-1 text-xs leading-5 text-[#6c7a70]">
                        Staff title controls PT coach classification. In-house Coach joins the 50/30/20 PT payout pool; Part-time Coach stays outside it.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <label className="text-xs font-black text-[#34483a]">
                      Staff title / position
                      <input
                        list="modern-staff-title-options"
                        value={form.position}
                        onChange={(event) => {
                          const value = event.target.value;
                          setForm((current) => ({
                            ...current,
                            position: value,
                            employment_type:
                              value.trim().toLowerCase() === "part-time coach" ? "Part Time" : current.employment_type,
                          }));
                        }}
                        placeholder="Choose or type a staff title"
                        className="mt-1.5 w-full rounded-xl border border-[#d4dfd1] bg-white px-3 py-3 text-sm font-normal outline-none focus:border-[#63915f]"
                      />
                      <datalist id="modern-staff-title-options">
                        {staffTitleSuggestions.map((title) => <option key={title} value={title} />)}
                      </datalist>
                    </label>

                    <label className="text-xs font-black text-[#34483a]">
                      Department
                      <select
                        value={form.department}
                        onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))}
                        className="mt-1.5 w-full rounded-xl border border-[#d4dfd1] bg-white px-3 py-3 text-sm font-normal outline-none"
                      >
                        <option value="">Not assigned</option>
                        {departments.map((department) => <option key={department}>{department}</option>)}
                      </select>
                    </label>

                    <label className="text-xs font-black text-[#34483a]">
                      Employment type
                      <select
                        value={form.employment_type}
                        onChange={(event) => setForm((current) => ({ ...current, employment_type: event.target.value }))}
                        className="mt-1.5 w-full rounded-xl border border-[#d4dfd1] bg-white px-3 py-3 text-sm font-normal outline-none"
                      >
                        {employmentTypes.map((type) => <option key={type}>{type}</option>)}
                      </select>
                    </label>

                    <label className="text-xs font-black text-[#34483a]">
                      Employment date
                      <input
                        type="date"
                        value={form.employment_date}
                        onChange={(event) => setForm((current) => ({ ...current, employment_date: event.target.value }))}
                        className="mt-1.5 w-full rounded-xl border border-[#d4dfd1] bg-white px-3 py-3 text-sm font-normal outline-none"
                      />
                    </label>

                    <label className="text-xs font-black text-[#34483a]">
                      Staff portal role
                      <select
                        value={form.role}
                        onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
                        className="mt-1.5 w-full rounded-xl border border-[#d4dfd1] bg-white px-3 py-3 text-sm font-normal outline-none"
                      >
                        {roleOptions.map((role) => (
                          <option key={role.value} value={role.value}>{role.label}</option>
                        ))}
                      </select>
                      <span className="mt-1.5 block text-[10px] font-normal leading-4 text-[#758178]">
                        Admin/reception workspace access is managed separately through Staff account requests.
                      </span>
                    </label>

                    <label className="text-xs font-black text-[#34483a]">
                      Staff status
                      <select
                        value={form.status}
                        onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as StaffStatus }))}
                        className="mt-1.5 w-full rounded-xl border border-[#d4dfd1] bg-white px-3 py-3 text-sm font-normal outline-none"
                      >
                        {(["pending", "approved", "suspended", "inactive"] as const).map((status) => (
                          <option key={status} value={status}>{statusLabel(status)}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </section>

                <section className="rounded-[24px] border border-[#d8e5d4] bg-white p-4 sm:p-6">
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#eef6e9] text-[#356942]">
                      <CircleDollarSign size={19} />
                    </span>
                    <div>
                      <h3 className="text-lg font-black">Current monthly salary</h3>
                      <p className="mt-1 text-xs leading-5 text-[#6c7a70]">
                        This is the staff member's current base salary for future payroll calculations. It does not create a payment record.
                      </p>
                    </div>
                  </div>

                  <label className="mt-5 block text-xs font-black text-[#34483a]">
                    Monthly salary (₦)
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={form.salary}
                      onChange={(event) => setForm((current) => ({ ...current, salary: event.target.value }))}
                      placeholder="e.g. 120000"
                      className="mt-1.5 w-full rounded-xl border border-[#d4dfd1] bg-white px-3 py-3 text-base font-black outline-none focus:border-[#63915f]"
                    />
                    <span className="mt-1.5 block text-[10px] font-normal text-[#758178]">
                      Leave blank to clear the current salary. Salary payment history remains separate in Payroll.
                    </span>
                  </label>
                </section>

                <div className="sticky bottom-3 z-10 flex flex-col gap-2 rounded-2xl border border-[#cfdccf] bg-white/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-xs text-[#607264]">
                    <ShieldCheck size={16} className="text-[#356942]" />
                    Changes apply to this staff profile after saving.
                  </div>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void saveSelectedStaff()}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#193b2a] px-5 py-3 text-sm font-black text-white disabled:opacity-50"
                  >
                    {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                    {saving ? "Saving…" : "Save staff changes"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {authorized && (
        <section className="mt-5 flex items-start gap-3 rounded-2xl border border-[#d9e6d2] bg-[#eef6e9] p-4 text-xs leading-5 text-[#476149]">
          <CheckCircle2 className="mt-0.5 shrink-0" size={18} />
          <p>
            <strong>Clean separation:</strong> Staff Management now handles profiles, employment and current salary. Staff Directory remains the attendance view, while payment records stay in Payroll.
          </p>
        </section>
      )}
    </AdminWorkspaceShell>
  );
}

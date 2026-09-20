import "@/components/reception/reception-responsive.css";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  Cake,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  RefreshCw,
  Search,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/reception-workspace")({ component: ReceptionWorkspace });
type Member = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  birth_day: number | null;
  birth_month: number | null;
};
type Membership = {
  id: string;
  member_id: string;
  plan_name: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  payment_status: string | null;
};
const todayLagos = () => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${value("year")}-${value("month")}-${value("day")}`;
};
const plusDays = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
async function allRows<T>(table: "members" | "memberships", columns: string): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order("id", { ascending: true })
      .range(offset, offset + 499);
    if (error) throw error;
    const batch = (data || []) as T[];
    rows.push(...batch);
    if (batch.length < 500) return rows;
  }
}
// Match the existing Reminders page's eligibility rules so its tile totals agree with the lists.
function eligibleReminder(plan: Membership, day: string) {
  const start = plan.start_date?.slice(0, 10) || "";
  const end = plan.end_date?.slice(0, 10) || "";
  const status = (plan.status || "").toLowerCase();
  const payment = (plan.payment_status || "").toLowerCase();
  return Boolean(
    start &&
    end &&
    start <= day &&
    !["cancelled", "canceled", "paused", "inactive", "expired", "void"].includes(status) &&
    !["failed", "unpaid", "pending", "refunded", "cancelled", "canceled", "void"].includes(payment),
  );
}
const shortcuts = [
  {
    label: "Register a member",
    detail: "New membership and payment",
    href: "/management-standard-plan",
    icon: UserPlus,
    managementOnly: false,
  },
  {
    label: "Renew a membership",
    detail: "Find a member and add a plan",
    href: "/management-members",
    icon: RefreshCw,
    managementOnly: false,
  },
  {
    label: "Custom Plan",
    detail: "Custom days, price and optional registration",
    href: "/management-custom-plan",
    icon: CreditCard,
    managementOnly: false,
  },
  {
    label: "Member QR scanner",
    detail: "Check members in and out",
    href: "/reception-checkin",
    icon: Activity,
    managementOnly: false,
  },
  {
    label: "Member directory",
    detail: "Search and open existing profiles",
    href: "/management-members",
    icon: Users,
    managementOnly: false,
  },
  {
    label: "Revenue records",
    detail: "Management-only recorded revenue",
    href: "/management-revenue",
    icon: Wallet,
    managementOnly: true,
  },
];
function ReceptionWorkspace() {
  const [authorized, setAuthorized] = useState(false);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [members, setMembers] = useState<Member[]>([]);
  const [plans, setPlans] = useState<Membership[]>([]);
  const [search, setSearch] = useState("");
  const today = todayLagos();
  const cutoff = plusDays(today, 7);
  useEffect(() => {
    let cancelled = false;
    setAuthorized(false);
    setRole("");
    (async () => {
      setLoading(true);
      setError("");
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user)
          throw new Error("Sign in through the reception or admin portal first.");
        const { data: staff, error: staffError } = await supabase
          .from("staff_users")
          .select("role,active")
          .eq("auth_user_id", auth.user.id)
          .maybeSingle();
        if (staffError) throw staffError;
        const nextRole = String(staff?.role || "").toLowerCase();
        if (!staff?.active || !["reception", "admin", "owner", "manager"].includes(nextRole))
          throw new Error("An active reception or management account is required.");
        if (cancelled) return;
        setAuthorized(true);
        setRole(nextRole);
        const [people, memberships] = await Promise.all([
          allRows<Member>("members", "id,full_name,phone,email,birth_day,birth_month"),
          allRows<Membership>(
            "memberships",
            "id,member_id,plan_name,start_date,end_date,status,payment_status",
          ),
        ]);
        if (!cancelled) {
          setMembers(people);
          setPlans(memberships);
        }
      } catch (cause) {
        if (!cancelled) {
          setAuthorized(false);
          setRole("");
          setError(cause instanceof Error ? cause.message : "Unable to load reception workspace.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);
  const counts = useMemo(() => {
    const active = new Set<string>();
    const expired = new Set<string>();
    for (const plan of plans) {
      const start = plan.start_date?.slice(0, 10);
      const end = plan.end_date?.slice(0, 10);
      const status = String(plan.status || "").toLowerCase();
      if (!start || !end || ["paused", "cancelled"].includes(status)) continue;
      if (start <= today && end >= today) {
        active.add(plan.member_id);
      } else if (end < today) expired.add(plan.member_id);
    }
    return { active: active.size, expired: [...expired].filter((id) => !active.has(id)).length };
  }, [plans, today]);
  const birthdaysToday = useMemo(
    () =>
      members.filter(
        (member) =>
          member.birth_month === Number(today.slice(5, 7)) &&
          member.birth_day === Number(today.slice(8, 10)),
      ).length,
    [members, today],
  );
  const expiringReminders = useMemo(() => {
    const memberIds = new Set(members.map((member) => member.id));
    const byMemberPlans = new Map<string, Membership[]>();
    for (const plan of plans) {
      const existing = byMemberPlans.get(plan.member_id) || [];
      existing.push(plan);
      byMemberPlans.set(plan.member_id, existing);
    }
    let count = 0;
    for (const plan of plans) {
      const expiry = plan.end_date?.slice(0, 10) || "";
      if (
        !expiry ||
        expiry < today ||
        expiry > cutoff ||
        !eligibleReminder(plan, today) ||
        !memberIds.has(plan.member_id)
      )
        continue;
      const nextDay = plusDays(expiry, 1);
      const renewed = (byMemberPlans.get(plan.member_id) || []).some(
        (other) =>
          other.id !== plan.id &&
          other.plan_name === plan.plan_name &&
          eligibleReminder(other, nextDay) &&
          (other.start_date?.slice(0, 10) || "") <= nextDay &&
          (other.end_date?.slice(0, 10) || "") > expiry,
      );
      if (!renewed) count++;
    }
    return count;
  }, [members, plans, today, cutoff]);
  const results = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return needle.length < 2
      ? []
      : members
          .filter((member) =>
            [member.full_name, member.phone, member.email].some((value) =>
              value?.toLowerCase().includes(needle),
            ),
          )
          .slice(0, 8);
  }, [members, search]);
  const management = ["admin", "owner", "manager"].includes(role);
  return (
    <main className="reception-responsive min-h-screen bg-[#f4f6f1] px-4 py-8 text-[#183125] sm:px-7 lg:py-12">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[.2em] text-[#5a7c5d]">
              Super Plus Fitness · Reception
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">
              Your reception workspace
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-[#607366]">
              Everything you need for the front desk, in one place. Registration, membership and
              payment tools are available below.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRefresh((value) => value + 1)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-[#cbd9c9] bg-white px-4 py-3 text-sm font-bold disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh overview
          </button>
        </header>
        {error && (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"
          >
            {error}{" "}
            <a href="/portal" className="font-bold underline">
              Choose portal
            </a>
          </div>
        )}
        {loading && (
          <p role="status" className="rounded-2xl border bg-white p-5 text-sm">
            Loading your authorised workspace…
          </p>
        )}
        {!loading && authorized && !error && (
          <>
            <section
              aria-label="Membership snapshot"
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            >
              {[
                {
                  label: "Birthdays today",
                  value: birthdaysToday,
                  icon: Cake,
                  href: "/management-communications#birthday-messages",
                },
                {
                  label: "Plans expiring in 7 days",
                  value: expiringReminders,
                  icon: CalendarClock,
                  href: "/management-communications#renewal-messages",
                },
                { label: "Registered members", value: members.length, icon: Users, href: null },
                { label: "Currently active", value: counts.active, icon: CheckCircle2, href: null },
                {
                  label: "Expired without an active plan",
                  value: counts.expired,
                  icon: Activity,
                  href: null,
                },
              ].map(({ label, value, icon: Icon, href }) => {
                const cardClass = "rounded-2xl border border-[#e0e9dc] bg-white p-5";
                const content = (
                  <>
                    <div className="flex items-center justify-between gap-2 text-sm font-semibold text-[#617466]">
                      <span>{label}</span>
                      <Icon size={19} />
                    </div>
                    <p className="mt-4 text-4xl font-black tabular-nums">
                      {value.toLocaleString("en-NG")}
                    </p>
                  </>
                );
                return href ? (
                  <a
                    key={label}
                    href={href}
                    className={`${cardClass} block transition hover:border-[#84b879] hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#427a43]`}
                  >
                    {content}
                  </a>
                ) : (
                  <div key={label} className={cardClass}>
                    {content}
                  </div>
                );
              })}
            </section>
            <section className="rounded-3xl bg-[#193b2a] p-5 text-white sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black">Find a member</h2>
                  <p className="mt-1 text-sm text-[#c7ddca]">
                    Search by name, phone or email. Open the matching member's profile directly.
                  </p>
                </div>
                <a
                  href="/management-members"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#b8ee73] px-4 py-3 text-sm font-bold text-[#173326]"
                >
                  Full directory <ArrowRight size={16} />
                </a>
              </div>
              <label className="mt-5 flex items-center gap-3 rounded-xl bg-white px-4 text-[#173326]">
                <Search size={19} />
                <span className="sr-only">Search members</span>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Enter at least two characters…"
                  className="w-full min-w-0 bg-transparent py-4 text-sm outline-none"
                />
              </label>
              {search.trim().length >= 2 && (
                <div aria-live="polite" className="mt-3 space-y-2">
                  {results.length ? (
                    results.map((member) => (
                      <div
                        key={member.id}
                        className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl bg-white/10 px-4 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{member.full_name || "Unnamed member"}</p>
                          <p className="text-xs text-[#c7ddca]">
                            {member.phone || member.email || "No contact recorded"}
                          </p>
                        </div>
                        <a
                          href={`/reception-member/${encodeURIComponent(member.id)}`}
                          aria-label={`Open profile for ${member.full_name || "unnamed member"}`}
                          className="rounded-lg border border-white/30 px-3 py-2 text-xs font-bold hover:bg-white/10"
                        >
                          Open profile <ArrowRight size={13} className="inline" />
                        </a>
                      </div>
                    ))
                  ) : (
                    <p className="py-3 text-sm text-[#c7ddca]">
                      No matching members in the loaded directory.
                    </p>
                  )}
                  {results.length === 8 && (
                    <p className="text-xs text-[#c7ddca]">
                      Showing up to eight matches. Use the full directory for more.
                    </p>
                  )}
                </div>
              )}
            </section>
            <section>
              <div className="mb-4">
                <h2 className="text-2xl font-black">Quick actions</h2>
                <p className="mt-1 text-sm text-[#607366]">
                  Direct links to your existing, protected tools.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {shortcuts
                  .filter((action) => !action.managementOnly || management)
                  .map(({ label, detail, href, icon: Icon }) => (
                    <a
                      key={label}
                      href={href}
                      className="group flex min-h-36 min-w-0 flex-col justify-between rounded-2xl border border-[#e0e9dc] bg-white p-5 transition hover:border-[#84b879] hover:shadow-lg"
                    >
                      <span className="flex items-start justify-between gap-2">
                        <Icon size={23} className="text-[#427a43]" />
                        <ArrowRight size={18} className="transition group-hover:translate-x-1" />
                      </span>
                      <span>
                        <strong className="block text-lg">{label}</strong>
                        <span className="mt-1 block text-sm text-[#607366]">{detail}</span>
                      </span>
                    </a>
                  ))}
              </div>
            </section>
            <p className="text-xs text-[#607366]">
              Overview counts are based on recorded membership dates and status, not independently
              verified payments. No data is modified on this page.
            </p>
          </>
        )}
      </div>
    </main>
  );
}

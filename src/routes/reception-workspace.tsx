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
  LayoutDashboard,
  RefreshCw,
  ScanLine,
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
  const val = (t: string) => parts.find((p) => p.type === t)?.value || "";
  return `${val("year")}-${val("month")}-${val("day")}`;
};
const plusDays = (day: string, n: number) => {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
};
async function allRows<T>(table: "members" | "memberships", columns: string): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; ; i += 500) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order("id", { ascending: true })
      .range(i, i + 499);
    if (error) throw error;
    const batch = (data || []) as T[];
    out.push(...batch);
    if (batch.length < 500) return out;
  }
}
function eligibleReminder(p: Membership, day: string) {
  const start = p.start_date?.slice(0, 10) || "",
    end = p.end_date?.slice(0, 10) || "",
    status = (p.status || "").toLowerCase(),
    payment = (p.payment_status || "").toLowerCase();
  return (
    !!start &&
    !!end &&
    start <= day &&
    !["cancelled", "canceled", "paused", "inactive", "expired", "void"].includes(status) &&
    !["failed", "unpaid", "pending", "refunded", "cancelled", "canceled", "void"].includes(payment)
  );
}
const actions = [
  {
    label: "Register or renew",
    detail: "New customer or existing member; record payment directly",
    href: "/reception-register",
    icon: UserPlus,
    tag: "MEMBERSHIPS",
  },
  {
    label: "Find a member",
    detail: "Open a profile or review membership history",
    href: "/management-members",
    icon: Users,
    tag: "MEMBERS",
  },
  {
    label: "QR check-in",
    detail: "Scan a member in or out",
    href: "/reception-checkin",
    icon: ScanLine,
    tag: "ATTENDANCE",
  },
  {
    label: "Online renewal",
    detail: "Customer signs in and pays from their own profile",
    href: "/login",
    icon: CreditCard,
    tag: "ONLINE",
  },
];
function ReceptionWorkspace() {
  const [authorized, setAuthorized] = useState(false),
    [role, setRole] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  const [members, setMembers] = useState<Member[]>([]),
    [plans, setPlans] = useState<Membership[]>([]),
    [search, setSearch] = useState("");
  const today = todayLagos(),
    cutoff = plusDays(today, 7);
  useEffect(() => {
    let cancelled = false;
    setAuthorized(false);
    setRole("");
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user)
          throw Error("Sign in through the reception or admin portal first.");
        const { data: staff, error: staffError } = await supabase
          .from("staff_users")
          .select("role,active")
          .eq("auth_user_id", auth.user.id)
          .maybeSingle();
        if (staffError) throw staffError;
        const next = String(staff?.role || "").toLowerCase();
        if (!staff?.active || !["reception", "admin", "owner", "manager"].includes(next))
          throw Error("An active reception account is required.");
        if (cancelled) return;
        setRole(next);
        setAuthorized(true);
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
          setError(cause instanceof Error ? cause.message : "Unable to load reception dashboard.");
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
    const active = new Set<string>(),
      expired = new Set<string>();
    for (const p of plans) {
      const start = p.start_date?.slice(0, 10),
        end = p.end_date?.slice(0, 10);
      if (!start || !end || ["paused", "cancelled"].includes(String(p.status || "").toLowerCase()))
        continue;
      if (start <= today && end >= today) active.add(p.member_id);
      else if (end < today) expired.add(p.member_id);
    }
    return { active: active.size, expired: [...expired].filter((id) => !active.has(id)).length };
  }, [plans, today]);
  const birthdays = useMemo(
    () =>
      members.filter(
        (m) =>
          m.birth_month === Number(today.slice(5, 7)) && m.birth_day === Number(today.slice(8, 10)),
      ).length,
    [members, today],
  );
  const expiring = useMemo(() => {
    const byMember = new Map<string, Membership[]>();
    for (const p of plans) {
      const arr = byMember.get(p.member_id) || [];
      arr.push(p);
      byMember.set(p.member_id, arr);
    }
    let count = 0;
    for (const p of plans) {
      const expiry = p.end_date?.slice(0, 10) || "";
      if (!expiry || expiry < today || expiry > cutoff || !eligibleReminder(p, today)) continue;
      const next = plusDays(expiry, 1);
      const renewed = (byMember.get(p.member_id) || []).some(
        (o) =>
          o.id !== p.id &&
          o.plan_name === p.plan_name &&
          eligibleReminder(o, next) &&
          (o.start_date?.slice(0, 10) || "") <= next &&
          (o.end_date?.slice(0, 10) || "") > expiry,
      );
      if (!renewed) count++;
    }
    return count;
  }, [plans, today, cutoff]);
  const results = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term.length < 2
      ? []
      : members
          .filter((m) =>
            [m.full_name, m.phone, m.email].some((x) => x?.toLowerCase().includes(term)),
          )
          .slice(0, 8);
  }, [members, search]);
  const management = ["admin", "owner", "manager"].includes(role);
  const dateLabel = new Intl.DateTimeFormat("en-NG", {
    timeZone: "Africa/Lagos",
    dateStyle: "full",
  }).format(new Date());
  const snapshot = [
    {
      label: "Registered members",
      value: members.length,
      icon: Users,
      href: "/management-members",
    },
    {
      label: "Currently active",
      value: counts.active,
      icon: CheckCircle2,
      href: "/management-members",
    },
    {
      label: "Expiring soon",
      value: expiring,
      icon: CalendarClock,
      href: "/management-communications#renewal-messages",
    },
    {
      label: "Birthdays today",
      value: birthdays,
      icon: Cake,
      href: "/management-communications#birthday-messages",
    },
    {
      label: "Expired members",
      value: counts.expired,
      icon: Activity,
      href: "/management-members",
    },
  ];
  return (
    <main className="reception-responsive min-h-screen bg-[#f4f6f1] px-4 py-5 text-[#193327] sm:px-7 lg:px-10 lg:py-7">
      <div className="mx-auto max-w-[1400px] space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dce8d9] bg-white p-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#679361]">
              Super Plus / Front desk
            </p>
            <h1 className="mt-1 text-2xl font-black sm:text-3xl">Reception dashboard</h1>
            <p className="mt-1 text-sm text-[#647468]">
              Registration, renewals, check-in and member follow-ups.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRefresh((n) => n + 1)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-[#d8e2d5] bg-white px-4 py-3 text-sm font-bold disabled:opacity-50"
          >
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </header>
        {error && (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"
          >
            {error}{" "}
            <a className="font-bold underline" href="/portal">
              Choose portal
            </a>
          </div>
        )}
        {loading && (
          <p role="status" className="rounded-2xl border border-[#dce8d9] bg-white p-6 text-sm">
            Checking staff access and loading the member directory…
          </p>
        )}
        {!loading && authorized && !error && (
          <>
            <section className="relative overflow-hidden rounded-2xl bg-[#193b2a] p-4 text-white sm:p-5">
              <div className="relative flex flex-wrap items-center justify-between gap-4">
                <div className="max-w-2xl">
                  <p className="text-xs font-bold text-[#b8ee73]">{dateLabel} · Lagos time</p>
                  <h2 className="mt-1 text-2xl font-black leading-tight sm:text-3xl">
                    Ready for today's members.
                  </h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-[#d2e2d4]">
                    Register, renew, search profiles and scan QR from one front-desk workspace.
                  </p>
                </div>
                <div className="grid w-full grid-cols-2 gap-2 sm:w-auto">
                  <a
                    href="/reception-register"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#b8ee73] px-4 py-3 text-sm font-black text-[#173326]"
                  >
                    <UserPlus size={18} /> Register
                  </a>
                  <a
                    href="/reception-checkin"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/35 bg-white/10 px-4 py-3 text-sm font-bold text-white"
                  >
                    <ScanLine size={17} /> Scan
                  </a>
                </div>
              </div>
            </section>
            <section aria-label="Membership snapshot">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-black">Member snapshot</h2>
                <a
                  href="/management-members"
                  className="inline-flex items-center gap-2 text-xs font-bold text-[#356942]"
                >
                  Directory <ArrowRight size={15} />
                </a>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {snapshot.map(({ label, value, icon: Icon, href }) => (
                  <a
                    key={label}
                    href={href}
                    className="block min-w-0 rounded-2xl border border-[#dce8d9] bg-white p-3 hover:border-[#a8c9a1]"
                  >
                    <span className="flex items-center justify-between gap-2 text-[11px] font-semibold leading-4 text-[#607366]">
                      <span>{label}</span>
                      <Icon size={16} className="text-[#54815c]" />
                    </span>
                    <span className="mt-2 block text-2xl font-black tabular-nums">
                      {value.toLocaleString("en-NG")}
                    </span>
                  </a>
                ))}
              </div>
            </section>
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
              <section className="rounded-[24px] border border-[#dce8d9] bg-white p-5 sm:p-7">
                <h2 className="text-2xl font-black">Find a member</h2>
                <p className="mt-2 text-sm text-[#607366]">
                  Search name, phone or email. Open their existing profile instead of registering
                  them twice.
                </p>
                <label className="mt-5 flex items-center gap-3 rounded-xl border border-[#d8e2d5] bg-[#f7faf4] px-4">
                  <Search size={19} className="text-[#54815c]" />
                  <span className="sr-only">Search members</span>
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Name, phone or email"
                    className="w-full min-w-0 bg-transparent py-4 text-sm outline-none"
                  />
                </label>
                {search.trim().length >= 2 ? (
                  <div className="mt-3 space-y-2" aria-live="polite">
                    {results.length ? (
                      results.map((m) => (
                        <a
                          key={m.id}
                          href={`/reception-member/${encodeURIComponent(m.id)}`}
                          className="flex items-center justify-between gap-3 rounded-xl border border-[#e6ede2] p-4 text-sm"
                        >
                          <span>
                            <strong className="block">{m.full_name || "Unnamed member"}</strong>
                            <span className="text-xs text-[#637469]">
                              {m.phone || m.email || "No contact"}
                            </span>
                          </span>
                          <span className="text-xs font-bold text-[#356942]">View profile →</span>
                        </a>
                      ))
                    ) : (
                      <p className="py-4 text-sm">No matching member.</p>
                    )}
                  </div>
                ) : (
                  <p className="mt-4 text-xs text-[#849387]">
                    Tip: Use the top search to find both members and tools.
                  </p>
                )}
              </section>
              <section className="rounded-[24px] border border-[#dce8d9] bg-[#eaf4e4] p-5 sm:p-7">
                <h2 className="text-2xl font-black">Follow up today</h2>
                <p className="mt-2 text-sm text-[#586e5a]">Expiry reminders and birthdays.</p>
                <div className="mt-5 space-y-3">
                  <a
                    href="/management-communications#renewal-messages"
                    className="flex justify-between gap-3 rounded-2xl bg-white p-4"
                  >
                    <span className="text-sm font-bold">Expiry reminders</span>
                    <strong>{expiring}</strong>
                  </a>
                  <a
                    href="/management-communications#birthday-messages"
                    className="flex justify-between gap-3 rounded-2xl bg-white p-4"
                  >
                    <span className="text-sm font-bold">Today's birthdays</span>
                    <strong>{birthdays}</strong>
                  </a>
                </div>
              </section>
            </div>
            <section aria-label="Everyday actions">
              <h2 className="text-xl font-black">Quick actions</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {actions.map(({ label, detail, href, icon: Icon, tag }) => (
                  <a
                    key={label}
                    href={href}
                    className="group flex min-h-28 flex-col justify-between rounded-2xl border border-[#dce8d9] bg-white p-4 hover:border-[#9fca91]"
                  >
                    <span className="flex items-center justify-between">
                      <span className="rounded-xl bg-[#edf6e7] p-2 text-[#427a43]">
                        <Icon size={18} />
                      </span>
                      <ArrowRight size={16} />
                    </span>
                    <span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#68905d]">
                        {tag}
                      </span>
                      <strong className="mt-1 block text-base">{label}</strong>
                      <span className="mt-1 block text-xs leading-5 text-[#647468]">{detail}</span>
                    </span>
                  </a>
                ))}
              </div>
            </section>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dce8d9] bg-white p-5 text-xs leading-6 text-[#5b705d]">
              <p>
                Normal successful payments appear in revenue. Admin historical imports remain the
                separate non-revenue workflow.
              </p>
              {management && (
                <div className="flex gap-3">
                  <a
                    href="/management-revenue"
                    className="inline-flex items-center gap-1 font-bold text-[#356942]"
                  >
                    <Wallet size={15} /> Revenue
                  </a>
                  <a
                    href="/admin-workspace"
                    className="inline-flex items-center gap-1 font-bold text-[#356942]"
                  >
                    <LayoutDashboard size={15} /> Admin
                  </a>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

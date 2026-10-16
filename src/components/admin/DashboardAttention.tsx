import { useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  Gift,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { lagosToday } from "@/lib/pt-payroll";

type Count = number | null;
type Counts = {
  scans: Count;
  accounts: Count;
  bookings: Count;
  redemptions: Count;
  social: Count;
  birthdays: Count;
};
const empty: Counts = {
  scans: null,
  accounts: null,
  bookings: null,
  redemptions: null,
  social: null,
  birthdays: null,
};
export function DashboardAttention({ role, revision }: { role: string; revision: number }) {
  const [counts, setCounts] = useState<Counts>(empty);
  const [loading, setLoading] = useState(true);
  const today = lagosToday();
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setCounts(empty);
    const count = async (table: string, status = "pending"): Promise<Count> => {
      const { count, error } = await supabase
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("status", status);
      return error ? null : count;
    };
    void (async () => {
      const [scans, accounts, memberBookings, spaBookings, redemptions, social, birthdayResult] =
        await Promise.all([
          role === "admin" ? count("staff_missed_scan_requests") : Promise.resolve(null),
          role === "admin" ? count("staff_profiles") : Promise.resolve(null),
          count("member_bookings"),
          supabase
            .from("spa_bookings")
            .select("id", { count: "exact", head: true })
            .eq("status", "pending")
            .not("payment_id", "is", null),
          count("reward_redemptions"),
          count("member_social_follow_claims"),
          supabase
            .from("members")
            .select("id", { count: "exact", head: true })
            .eq("birth_day", Number(today.slice(8, 10)))
            .eq("birth_month", Number(today.slice(5, 7))),
        ]);
      if (!cancelled) {
        setCounts({
          scans,
          accounts,
          bookings:
            memberBookings === null || spaBookings.error
              ? null
              : memberBookings + (spaBookings.count || 0),
          redemptions,
          social,
          birthdays: birthdayResult.error ? null : birthdayResult.count,
        });
        setLoading(false);
      }
    })().catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [role, revision, today]);
  const day = Number(today.slice(8, 10));
  const items = [
    ...(role === "admin"
      ? [
          {
            label: "Staff requests",
            count:
              counts.scans === null || counts.accounts === null
                ? null
                : counts.scans + counts.accounts,
            note: "Accounts & missed scans",
            href: "/admin-approvals",
            icon: ShieldCheck,
          },
        ]
      : []),
    {
      label: "Booking requests",
      count: counts.bookings,
      note: "Member & paid spa bookings",
      href: "/management-bookings",
      icon: CalendarDays,
    },
    {
      label: "Reward claims",
      count: counts.redemptions,
      note: "Awaiting review",
      href: "/admin-engagement?view=requests",
      icon: Gift,
    },
    {
      label: "Social claims",
      count: counts.social,
      note: "Instagram & TikTok follows",
      href: "/admin-engagement?view=requests",
      icon: ClipboardList,
    },
    {
      label: "Birthdays today",
      count: counts.birthdays,
      note: "Member follow-ups",
      href: "/management-communications#birthday-messages",
      icon: Users,
    },
  ];
  return (
    <section className="mt-6" aria-labelledby="attention-heading">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="attention-heading" className="text-xl font-black">
          Needs attention
        </h2>
        <span className="text-xs text-[var(--portal-muted)]">{today} · Lagos time</span>
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {items.map(({ label, count, note, href, icon: Icon }) => (
          <a
            key={label}
            href={href}
            className="group min-w-0 rounded-2xl border border-[var(--portal-border)] bg-white p-4 transition hover:border-[var(--portal-accent)]"
          >
            <div className="flex items-center justify-between gap-2">
              <Icon size={18} className="text-[var(--portal-accent)]" />
              <ArrowRight size={14} className="text-[var(--portal-muted)]" />
            </div>
            <p className="mt-4 text-3xl font-black tabular-nums">
              {loading ? "…" : count === null ? "—" : count}
            </p>
            <h3 className="mt-1 text-xs font-bold">{label}</h3>
            <p className="mt-1 text-[11px] leading-5 text-[var(--portal-muted)]">
              {!loading && count === null ? "Open page to check" : note}
            </p>
          </a>
        ))}
      </div>
      {["admin", "owner"].includes(role) && (
        <a
          href="/management-salary-payments"
          className="mt-3 flex items-center gap-3 rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface)] px-4 py-3"
        >
          <Wallet size={20} className="shrink-0 text-[var(--portal-accent)]" />
          <span className="min-w-0 flex-1">
            <strong className="block text-sm">
              {day === 1 || day === 16 ? "Scheduled payday is today" : "Salaries & commissions"}
            </strong>
            <small className="text-[var(--portal-muted)]">
              Review due payments, advances and commission records.
            </small>
          </span>
          <ArrowRight size={17} />
        </a>
      )}
    </section>
  );
}

import { useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
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
  const activeItems = items.filter((item) => item.count !== 0);
  const clearedItems = items.filter((item) => item.count === 0);
  return (
    <section className="mt-6" aria-labelledby="attention-heading">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="attention-heading" className="text-xl font-black">
          Needs attention
        </h2>
        <span className="text-xs text-[var(--portal-muted)]">{today} · Lagos time</span>
      </div>

      {loading ? (
        <div role="status" className="rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-4 text-sm text-[var(--portal-muted)]">
          Checking requests and follow-ups…
        </div>
      ) : (
        <>
          {activeItems.length ? (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {activeItems.map(({ label, count, note, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  className="flex min-h-[78px] min-w-0 items-center gap-3 rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 transition hover:border-[var(--portal-accent)]"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--portal-surface)] text-[var(--portal-accent)]">
                    <Icon size={19} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-sm font-black">{label}</strong>
                    <small className="mt-1 block text-xs leading-5 text-[var(--portal-muted)]">
                      {count === null ? "Open page to check" : note}
                    </small>
                  </span>
                  <strong className="shrink-0 rounded-xl bg-[var(--portal-surface)] px-3 py-1 text-xl font-black tabular-nums text-[var(--portal-accent)]">
                    {count === null ? "—" : count}
                  </strong>
                  <ArrowRight size={15} className="shrink-0 text-[var(--portal-muted)]" />
                </a>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-4">
              <CheckCircle2 size={23} className="shrink-0 text-[var(--portal-accent)]" />
              <span>
                <strong className="block text-sm font-black">All caught up</strong>
                <small className="block text-xs leading-5 text-[var(--portal-muted)]">
                  No pending requests or birthdays today.
                </small>
              </span>
            </div>
          )}
          {clearedItems.length > 0 && (
            <details className="mt-3 rounded-xl border border-[var(--portal-border)] bg-white">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 py-3 text-xs font-bold text-[var(--portal-muted)]">
                <CheckCircle2 size={17} className="text-[var(--portal-accent)]" />
                <span className="flex-1">{clearedItems.length} checks clear · Tap to review</span>
                <ChevronDown size={16} />
              </summary>
              <div className="grid gap-1 border-t border-[var(--portal-border)] p-2 sm:grid-cols-2">
                {clearedItems.map(({ label, href, icon: Icon }) => (
                  <a
                    key={label}
                    href={href}
                    className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold hover:bg-[var(--portal-canvas)]"
                  >
                    <Icon size={16} className="text-[var(--portal-muted)]" />
                    <span className="min-w-0 flex-1">{label}</span>
                    <span className="tabular-nums">0</span>
                    <ArrowRight size={14} />
                  </a>
                ))}
              </div>
            </details>
          )}
        </>
      )}
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

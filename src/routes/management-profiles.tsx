import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Activity,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/management-profiles")({ component: ManagementProfiles });

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
  plan_name: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  payment_status: string | null;
};
type Visit = { id: string; checked_in_at: string | null; checked_out_at: string | null };
const LAGOS = "Africa/Lagos";
function lagosDay() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LAGOS,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (part: string) => parts.find((item) => item.type === part)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function dateOnly(value: string | null) {
  return value?.slice(0, 10) || "";
}
function niceDate(value: string | null) {
  const day = dateOnly(value);
  if (!day) return "Not recorded";
  const parsed = new Date(`${day}T12:00:00Z`);
  return Number.isNaN(parsed.getTime())
    ? day
    : new Intl.DateTimeFormat("en-NG", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(parsed);
}
function niceTime(value: string | null) {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "Not recorded"
    : new Intl.DateTimeFormat("en-NG", {
        timeZone: LAGOS,
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(parsed);
}
function planState(plan: Membership, today: string) {
  const status = (plan.status || "").toLowerCase();
  if (status === "cancelled" || status === "canceled") return "Cancelled";
  if (status === "paused") return "Paused";
  if (!plan.start_date || !plan.end_date) return status ? status : "Dates unavailable";
  if (dateOnly(plan.start_date) > today) return "Upcoming";
  if (dateOnly(plan.end_date) < today) return "Expired";
  if (["inactive", "failed", "void", "refunded"].includes(status)) return status;
  return "Within dates";
}
function normalizePhone(phone: string | null) {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 11) return `234${digits.slice(1)}`;
  if (digits.startsWith("234") && digits.length === 13) return digits;
  return "";
}

function ManagementProfiles() {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState("");
  const [term, setTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [results, setResults] = useState<Member[]>([]);
  const [member, setMember] = useState<Member | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [visitsCount, setVisitsCount] = useState<number | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const requestId = useRef(0);
  const today = lagosDay();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) throw new Error("Sign in through the Staff Portal first.");
        const { data: staff, error } = await supabase
          .from("staff_users")
          .select("role,active")
          .eq("auth_user_id", auth.user.id)
          .maybeSingle();
        if (error) throw error;
        if (
          !staff?.active ||
          !["reception", "admin", "owner", "manager"].includes(
            String(staff.role || "").toLowerCase(),
          )
        )
          throw new Error(
            "Only active reception and management accounts can access member profiles.",
          );
        if (!cancelled) setAuthorized(true);
      } catch (error) {
        if (!cancelled)
          setAccessError(error instanceof Error ? error.message : "Could not verify staff access.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      requestId.current += 1;
    };
  }, []);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authorized) return;
    const safe = term
      .trim()
      .replace(/[%_,()\\]/g, " ")
      .trim();
    setSearchError("");
    setResults([]);
    if (safe.length < 2) {
      setSearchError("Enter at least two characters of a member's name or phone number.");
      return;
    }
    setSearching(true);
    try {
      const { data, error } = await supabase
        .from("members")
        .select("id,full_name,phone,email,birth_day,birth_month")
        .or(`full_name.ilike.%${safe}%,phone.ilike.%${safe}%`)
        .order("full_name", { ascending: true })
        .limit(20);
      if (error) throw error;
      setResults((data || []) as Member[]);
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "Member search failed.");
    } finally {
      setSearching(false);
    }
  }

  async function selectMember(next: Member) {
    const current = ++requestId.current;
    setMember(next);
    setResults([]);
    setProfileError("");
    setProfileLoading(true);
    setMemberships([]);
    setVisits([]);
    setVisitsCount(null);
    try {
      const [plans, history] = await Promise.all([
        supabase
          .from("memberships")
          .select("id,plan_name,start_date,end_date,status,payment_status")
          .eq("member_id", next.id)
          .order("end_date", { ascending: false })
          .limit(100),
        supabase
          .from("attendance")
          .select("id,checked_in_at,checked_out_at", { count: "exact" })
          .eq("member_id", next.id)
          .order("checked_in_at", { ascending: false })
          .limit(15),
      ]);
      if (plans.error) throw plans.error;
      if (history.error) throw history.error;
      if (requestId.current !== current) return;
      setMemberships((plans.data || []) as Membership[]);
      setVisits((history.data || []) as Visit[]);
      setVisitsCount(history.count ?? 0);
    } catch (error) {
      if (requestId.current === current)
        setProfileError(
          error instanceof Error ? error.message : "Could not load this member's records.",
        );
    } finally {
      if (requestId.current === current) setProfileLoading(false);
    }
  }

  const active = memberships.filter((item) => planState(item, today) === "Within dates");
  const inside = visits.some((visit) => visit.checked_in_at && !visit.checked_out_at);
  const whatsapp = normalizePhone(member?.phone || null);
  const birthday =
    member?.birth_day &&
    member.birth_month &&
    member.birth_month >= 1 &&
    member.birth_month <= 12 &&
    member.birth_day >= 1 &&
    member.birth_day <= 31
      ? new Intl.DateTimeFormat("en-NG", { timeZone: "UTC", day: "numeric", month: "long" }).format(
          new Date(Date.UTC(2000, member.birth_month - 1, member.birth_day)),
        )
      : "Not provided";

  return (
    <main className="min-h-screen bg-[#f4f6f1] px-4 py-8 text-[#16221c] sm:px-7 lg:py-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-[#5f7b68]">
              Super Plus / Members
            </p>
            <h1 className="mt-2 text-3xl font-black sm:text-4xl">Member profiles</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#637469]">
              Search an existing member to review their membership history and recent gym visits.
              All records on this page are read-only.
            </p>
          </div>
          <a
            href="/management-members"
            className="rounded-xl border border-[#ccd8cb] bg-white px-4 py-3 text-sm font-bold text-[#356942]"
          >
            Member directory <ArrowRight className="ml-1 inline" size={16} />
          </a>
        </div>
        {loading && (
          <p className="mt-7 flex items-center gap-2 rounded-2xl bg-white p-6 text-sm">
            <Loader2 size={18} className="animate-spin" /> Checking staff access…
          </p>
        )}
        {!loading && accessError && (
          <p
            role="alert"
            className="mt-7 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800"
          >
            {accessError}{" "}
            <a href="/staff" className="font-bold underline">
              Staff login
            </a>
          </p>
        )}
        {authorized && (
          <>
            <section className="mt-7 rounded-[24px] border border-[#e1e8dd] bg-white p-5 sm:p-7">
              <div className="flex items-center gap-3">
                <span className="rounded-xl bg-[#edf6e7] p-3 text-[#38673e]">
                  <Search size={20} />
                </span>
                <div>
                  <p className="text-xs font-black uppercase tracking-[.17em] text-[#65905c]">
                    Find a member
                  </p>
                  <h2 className="text-xl font-black">Search by name or phone</h2>
                </div>
              </div>
              <form onSubmit={(event) => void search(event)} className="mt-5 flex gap-2">
                <label className="min-w-0 flex-1">
                  <span className="sr-only">Member name or phone</span>
                  <input
                    value={term}
                    onChange={(event) => setTerm(event.target.value)}
                    placeholder="Enter name or phone"
                    className="w-full rounded-xl border border-[#d8e2d5] bg-[#f8faf6] px-4 py-3.5 text-sm outline-none focus:border-[#548351]"
                  />
                </label>
                <button
                  type="submit"
                  disabled={searching}
                  className="rounded-xl bg-[#1a3226] px-5 text-sm font-black text-white disabled:opacity-50"
                >
                  {searching ? "Finding…" : "Search"}
                </button>
              </form>
              {searchError && (
                <p role="alert" className="mt-3 text-sm text-red-700">
                  {searchError}
                </p>
              )}
              {!searching && results.length > 0 && (
                <div className="mt-4 divide-y divide-[#e6ede4] rounded-xl border border-[#e6ede4]">
                  {results.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => void selectMember(item)}
                      type="button"
                      className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-[#f2f8ee]"
                    >
                      <span>
                        <strong className="block text-sm">
                          {item.full_name || "Unnamed member"}
                        </strong>
                        <span className="mt-1 block text-xs text-[#657568]">
                          {item.phone || item.email || "No contact"}
                        </span>
                      </span>
                      <ArrowRight size={18} className="shrink-0 text-[#548351]" />
                    </button>
                  ))}
                </div>
              )}
              {!searching &&
                !member &&
                !searchError &&
                term.trim().length > 1 &&
                results.length === 0 && (
                  <p className="mt-4 text-xs text-[#637469]">Search to load matching members.</p>
                )}
            </section>
            {member && (
              <>
                <section className="mt-6 rounded-[24px] bg-[#193328] p-6 text-white sm:p-8">
                  <div className="flex flex-wrap items-start justify-between gap-5">
                    <div className="flex min-w-0 items-center gap-4">
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#b8ee73] text-2xl font-black text-[#193328]">
                        {(member.full_name || "?").trim().slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-[.2em] text-[#b8ee73]">
                          Member overview
                        </p>
                        <h2 className="mt-1 break-words text-2xl font-black sm:text-3xl">
                          {member.full_name || "Unnamed member"}
                        </h2>
                        <p className="mt-2 text-sm text-[#c3d5c8]">
                          {member.phone || "No phone"} · {member.email || "No email"}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void selectMember(member)}
                      disabled={profileLoading}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-4 py-2.5 text-xs font-bold disabled:opacity-50"
                    >
                      <RefreshCw size={15} /> Refresh record
                    </button>
                  </div>
                  <div className="mt-7 flex flex-wrap gap-2 text-xs font-bold">
                    <span className="rounded-full bg-white/10 px-3 py-2">Birthday: {birthday}</span>
                    <span className="rounded-full bg-white/10 px-3 py-2">
                      Memberships shown: {memberships.length}
                    </span>
                    {!profileLoading && !profileError && (
                      <span className="rounded-full bg-[#b8ee73] px-3 py-2 text-[#193328]">
                        {active.length} within dates
                      </span>
                    )}
                    {!profileLoading && !profileError && (
                      <span className="rounded-full bg-white/10 px-3 py-2">
                        {inside ? "Open check-in" : "No open recent check-in"}
                      </span>
                    )}
                  </div>
                  <div className="mt-7 flex flex-wrap gap-3">
                    <a
                      href={`/reception-member/${member.id}`}
                      className="rounded-xl bg-[#b8ee73] px-4 py-3 text-xs font-black text-[#193328]"
                    >
                      Original full profile <ArrowRight className="ml-1 inline" size={15} />
                    </a>
                    <a
                      href="/management-standard-plan"
                      className="rounded-xl border border-white/30 px-4 py-3 text-xs font-bold"
                    >
                      Add standard plan
                    </a>
                    <a
                      href="/management-custom-plan"
                      className="rounded-xl border border-white/30 px-4 py-3 text-xs font-bold"
                    >
                      Add custom plan
                    </a>
                    {whatsapp && (
                      <a
                        href={`https://wa.me/${whatsapp}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="rounded-xl border border-white/30 px-4 py-3 text-xs font-bold"
                      >
                        WhatsApp member
                      </a>
                    )}
                  </div>
                </section>
                {profileLoading && (
                  <p className="mt-6 flex items-center gap-2 rounded-2xl bg-white p-6 text-sm">
                    <Loader2 size={18} className="animate-spin" /> Loading membership and attendance
                    history…
                  </p>
                )}
                {profileError && (
                  <p
                    role="alert"
                    className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800"
                  >
                    {profileError} History is unavailable; no records have been changed.
                  </p>
                )}
                {!profileLoading && !profileError && (
                  <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,1fr)]">
                    <section className="rounded-[24px] border border-[#e1e8dd] bg-white p-5 sm:p-7">
                      <div className="flex items-center gap-3">
                        <span className="rounded-xl bg-[#edf6e7] p-3 text-[#38673e]">
                          <CalendarClock size={20} />
                        </span>
                        <div>
                          <p className="text-xs font-black uppercase tracking-[.17em] text-[#65905c]">
                            Membership record
                          </p>
                          <h3 className="text-xl font-black">Membership history</h3>
                        </div>
                      </div>
                      <p className="mt-3 text-xs text-[#637469]">
                        Showing up to 100 records. Status below separates recorded status from date
                        coverage; date coverage alone does not verify payment or gym access.
                      </p>
                      <div className="mt-5 divide-y divide-[#e7ede4]">
                        {memberships.map((plan) => (
                          <article key={plan.id} className="py-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <strong className="text-sm">{plan.plan_name || "Membership"}</strong>
                              <span className="rounded-full bg-[#edf6e7] px-3 py-1 text-xs font-bold text-[#32633c]">
                                {planState(plan, today)}
                              </span>
                            </div>
                            <p className="mt-2 text-xs text-[#657568]">
                              {niceDate(plan.start_date)} – {niceDate(plan.end_date)}
                            </p>
                            <p className="mt-1 text-xs text-[#657568]">
                              Recorded status: {plan.status || "Not recorded"} · Payment status:{" "}
                              {plan.payment_status || "Not recorded"}
                            </p>
                          </article>
                        ))}
                        {memberships.length === 0 && (
                          <p className="py-8 text-sm text-[#637469]">
                            No membership records were found for this member.
                          </p>
                        )}
                      </div>
                    </section>
                    <section className="h-fit rounded-[24px] border border-[#e1e8dd] bg-white p-5 sm:p-7">
                      <div className="flex items-center gap-3">
                        <span className="rounded-xl bg-[#edf6e7] p-3 text-[#38673e]">
                          <Activity size={20} />
                        </span>
                        <div>
                          <p className="text-xs font-black uppercase tracking-[.17em] text-[#65905c]">
                            Gym visits
                          </p>
                          <h3 className="text-xl font-black">Recent attendance</h3>
                        </div>
                      </div>
                      <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-[#637469]">
                        <span className="rounded-full bg-[#edf6e7] px-3 py-2 font-bold text-[#32633c]">
                          {visitsCount ?? 0} total records
                        </span>
                        <span>Latest 15 visits shown</span>
                      </div>
                      <div className="mt-4 divide-y divide-[#e7ede4]">
                        {visits.map((visit) => (
                          <div key={visit.id} className="py-4">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold">
                                {niceTime(visit.checked_in_at)}
                              </span>
                              <span
                                className={`rounded-full px-2 py-1 text-[10px] font-bold ${visit.checked_out_at ? "bg-[#edf6e7] text-[#32633c]" : "bg-amber-50 text-amber-800"}`}
                              >
                                {visit.checked_out_at ? "Checked out" : "Not checked out"}
                              </span>
                            </div>
                            <p className="mt-2 text-xs text-[#657568]">
                              Out: {niceTime(visit.checked_out_at)}
                            </p>
                          </div>
                        ))}
                        {visits.length === 0 && (
                          <p className="py-8 text-sm text-[#637469]">
                            No attendance records found.
                          </p>
                        )}
                      </div>
                      <a
                        href="/management-attendance"
                        className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-[#356942]"
                      >
                        Open attendance dashboard <ArrowRight size={15} />
                      </a>
                    </section>
                  </div>
                )}
              </>
            )}
            <p className="mt-7 flex items-start gap-2 text-xs leading-6 text-[#637469]">
              <ShieldCheck className="mt-0.5 shrink-0 text-[#32633c]" size={16} /> Protected
              staff-only view. No membership, payment, QR or attendance data can be edited here.
            </p>
          </>
        )}
      </div>
    </main>
  );
}

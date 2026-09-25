import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Activity, AlertCircle, ArrowRight, Award, BarChart3, BookOpen, CalendarDays,
  CheckCircle2, Clock3, CreditCard, Dumbbell, ExternalLink, Flame, Home,
  Loader2, LogOut, Medal, Megaphone, MessageCircle, PencilLine, QrCode,
  RefreshCw, Sparkles, Star, Target, Trophy, UserRound, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnnouncementSurface } from "@/components/announcements/AnnouncementSurface";
import { supabase } from "@/lib/supabase";
import { membershipPlans, formatNaira } from "@/lib/site-data";

type Member = {
  id: string;
  full_name: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email: string | null;
  phone: string | null;
};
type Membership = {
  id: string;
  plan_name: string | null;
  name?: string | null;
  plan?: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};
type BlogPreview = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  category: string;
  published_at: string | null;
  featured_image: string | null;
};
type Visit = { id: string; checked_in_at: string; checked_out_at: string | null };
type DashboardTab = "home" | "activity" | "community" | "profile";

const DAY = 86400000;
const LAGOS = "Africa/Lagos";
const whatsappGroup = "https://chat.whatsapp.com/FysNYsQkx3rAqlB5WS4k6s?s=cl&p=i&mlu=4&ilr=4";
const receptionPhone = "2347054263170";
const supportMessage = "Hello Super Plus Fitness, I would like to request a correction to the contact details on my member profile. Please help me verify the change.";
const classMessage = "Hello Super Plus Fitness, please send me the current group-class timetable and available sessions.";
const ptMessage = "Hello Super Plus Fitness, I would like to request or book a personal training session. Please share the available options.";

function dateOnly(value: unknown) {
  return value ? String(value).trim().slice(0, 10) || null : null;
}
function getLocalDateString() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: LAGOS, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const pick = (type: string) => parts.find((item) => item.type === type)?.value || "";
  return pick("year") + "-" + pick("month") + "-" + pick("day");
}
function addDays(value: string, days: number) {
  const date = new Date(value + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
function daysBetween(start: string | null, end: string | null) {
  if (!start || !end) return null;
  return Math.round((Date.parse(end + "T12:00:00Z") - Date.parse(start + "T12:00:00Z")) / DAY);
}
function formatDate(value: string | null | undefined) {
  const date = dateOnly(value);
  if (!date) return "Not available";
  const parsed = new Date(date + "T12:00:00Z");
  return new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(parsed);
}
function toLagosKey(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: LAGOS, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const pick = (type: string) => parts.find((item) => item.type === type)?.value || "";
  return pick("year") + "-" + pick("month") + "-" + pick("day");
}
function startOfWeek(value: string) {
  const date = new Date(value + "T12:00:00Z");
  const day = date.getUTCDay();
  return addDays(value, -(day === 0 ? 6 : day - 1));
}
function formatVisit(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: LAGOS, day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true,
  }).format(new Date(value));
}
function lagosHour(value: string) {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: LAGOS, hour: "2-digit", hour12: false }).format(new Date(value)));
}
function monthLabel(key: string) {
  return new Intl.DateTimeFormat("en-NG", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(key.slice(0, 7) + "-01T12:00:00Z"));
}
function money(value: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(value);
}
function getContinuousMembership(memberships: Membership[]): Membership | null {
  if (!memberships.length) return null;
  const today = getLocalDateString();
  const normalized = memberships.map((item) => ({ ...item, normalizedStart: dateOnly(item.start_date), normalizedEnd: dateOnly(item.end_date) }))
    .filter((item) => item.normalizedStart && item.normalizedEnd)
    .sort((a, b) => String(a.normalizedStart).localeCompare(String(b.normalizedStart)));
  if (!normalized.length) return null;
  const index = normalized.findIndex((item) => String(item.normalizedStart) <= today && today <= String(item.normalizedEnd));
  if (index < 0) return [...normalized].sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))[0] || null;
  const current = normalized[index]!;
  const start = String(current.normalizedStart);
  let end = String(current.normalizedEnd);
  for (let i = index + 1; i < normalized.length; i++) {
    const next = normalized[i]!;
    if (String(next.normalizedStart) <= addDays(end, 1)) {
      if (String(next.normalizedEnd) > end) end = String(next.normalizedEnd);
    } else break;
  }
  return { ...current, start_date: start, end_date: end };
}

export function MemberDashboardV2() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState<Member | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<DashboardTab>("home");
  const [showPlans, setShowPlans] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("");
  const [coupon, setCoupon] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [visits, setVisits] = useState<Visit[]>([]);
  const [monthlyVisits, setMonthlyVisits] = useState<number | null>(null);
  const [totalVisits, setTotalVisits] = useState<number | null>(null);
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [attendanceError, setAttendanceError] = useState("");
  const [posts, setPosts] = useState<BlogPreview[]>([]);
  const [blogLoading, setBlogLoading] = useState(true);
  const [weeklyGoal, setWeeklyGoal] = useState(3);
  const [celebration, setCelebration] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadMember() {
      setLoading(true);
      setError("");
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!active) return;
        if (!session) { navigate({ to: "/login" }); return; }
        const { error: linkError } = await supabase.rpc("link_member_account");
        if (linkError) console.error("Member account linking error:", linkError);
        const { data: person, error: memberError } = await supabase.from("members").select("*").eq("auth_user_id", session.user.id).maybeSingle();
        if (!active) return;
        if (memberError) throw memberError;
        if (!person) throw new Error("Your login was successful, but we could not find a member account connected to this email. Please contact Super Plus Fitness reception.");
        setMember(person as Member);
        const { data: plans, error: membershipError } = await supabase.from("memberships").select("*").eq("member_id", person.id).order("created_at", { ascending: false });
        if (!active) return;
        if (membershipError) throw membershipError;
        setMembership(getContinuousMembership((plans || []) as Membership[]));
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to load your account.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadMember();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && active) navigate({ to: "/login" });
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [navigate]);

  useEffect(() => {
    if (!member?.id) return;
    try {
      const saved = window.localStorage.getItem("spf-weekly-goal:" + member.id);
      if (saved && [2, 3, 4, 5, 6].includes(Number(saved))) setWeeklyGoal(Number(saved));
    } catch { /* local storage unavailable */ }
  }, [member?.id]);

  useEffect(() => {
    if (!member?.id) return;
    try { window.localStorage.setItem("spf-weekly-goal:" + member.id, String(weeklyGoal)); }
    catch { /* local storage unavailable */ }
  }, [member?.id, weeklyGoal]);

  useEffect(() => {
    if (!member?.id) return;
    let active = true;
    const memberId = member.id;
    async function loadAttendance() {
      setAttendanceLoading(true);
      setAttendanceError("");
      const today = getLocalDateString();
      const monthStart = today.slice(0, 7) + "-01T00:00:00+01:00";
      const historyStart = new Date(Date.now() - 370 * DAY).toISOString();
      const [monthly, total, history] = await Promise.all([
        supabase.from("attendance").select("id", { count: "exact", head: true }).eq("member_id", memberId).gte("checked_in_at", monthStart),
        supabase.from("attendance").select("id", { count: "exact", head: true }).eq("member_id", memberId),
        supabase.from("attendance").select("id,checked_in_at,checked_out_at").eq("member_id", memberId).gte("checked_in_at", historyStart).order("checked_in_at", { ascending: false }).limit(600),
      ]);
      if (!active) return;
      if (monthly.error || total.error || history.error) {
        setAttendanceError("Attendance is unavailable right now. Your check-in records have not been changed.");
        setMonthlyVisits(null);
        setTotalVisits(null);
        setVisits([]);
      } else {
        setMonthlyVisits(monthly.count ?? 0);
        setTotalVisits(total.count ?? 0);
        setVisits((history.data || []) as Visit[]);
      }
      setAttendanceLoading(false);
    }
    void loadAttendance();
    return () => { active = false; };
  }, [member?.id]);

  useEffect(() => {
    let active = true;
    async function loadBlog() {
      const { data, error: blogError } = await supabase.from("blog_posts")
        .select("id,title,slug,excerpt,category,published_at,featured_image")
        .eq("status", "published").not("published_at", "is", null)
        .lte("published_at", new Date().toISOString()).order("published_at", { ascending: false }).limit(4);
      if (!active) return;
      if (!blogError && data) setPosts(data as BlogPreview[]);
      setBlogLoading(false);
    }
    void loadBlog();
    return () => { active = false; };
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }
  async function handlePayment() {
    if (!selectedPlan) { setPaymentError("Please select a membership plan."); return; }
    const cleanCoupon = coupon.trim().toUpperCase();
    setPaymentLoading(true);
    setPaymentError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate({ to: "/login" }); return; }
      const { data, error: functionError } = await supabase.functions.invoke("initialize-payment", {
        body: { planId: selectedPlan, ...(cleanCoupon ? { couponCode: cleanCoupon } : {}) },
      });
      if (functionError) throw new Error(functionError.message || "Unable to start payment.");
      if (!data?.authorization_url) throw new Error(data?.error || "Unable to create Paystack payment.");
      window.location.href = data.authorization_url;
    } catch (cause) {
      setPaymentError(cause instanceof Error ? cause.message : "Unable to start payment. Please try again.");
      setPaymentLoading(false);
    }
  }

  const fullName = member?.full_name || ((member?.first_name ?? "") + " " + (member?.last_name ?? "")).trim() || "Member";
  const firstName = fullName.split(/\s+/)[0] || "Member";
  const planName = membership?.plan_name || membership?.name || membership?.plan || "Membership";
  const startDate = membership?.start_date || null;
  const expiryDate = membership?.end_date || null;
  const today = getLocalDateString();
  const isActive = Boolean(startDate && expiryDate && startDate <= today && today <= expiryDate);
  const daysRemaining = isActive ? Math.max(0, daysBetween(today, expiryDate) ?? 0) : 0;
  const totalDays = daysBetween(startDate, expiryDate);
  const elapsedDays = daysBetween(startDate, today);
  const membershipProgress = isActive && totalDays !== null && totalDays > 0 && elapsedDays !== null
    ? Math.max(0, Math.min(100, Math.round((elapsedDays / totalDays) * 100))) : 0;
  const expirySoon = isActive && daysRemaining <= 7;
  const isPtMember = /personal|pt\b/i.test(planName);

  const stats = useMemo(() => {
    const currentWeekStart = startOfWeek(today);
    const currentWeekEnd = addDays(currentWeekStart, 6);
    const weekly = visits.filter((visit) => {
      const key = toLagosKey(visit.checked_in_at);
      return key >= currentWeekStart && key <= currentWeekEnd;
    });
    const currentMonth = visits.filter((visit) => toLagosKey(visit.checked_in_at).slice(0, 7) === today.slice(0, 7));
    const thisMonthCount = monthlyVisits ?? currentMonth.length;

    const thisMonthStart = today.slice(0, 7) + "-01";
    const prevMonthEnd = addDays(thisMonthStart, -1);
    const prevMonthKey = prevMonthEnd.slice(0, 7);
    const previousMonthCount = visits.filter((visit) => toLagosKey(visit.checked_in_at).slice(0, 7) === prevMonthKey).length;

    const weekdayCounts = new Array(7).fill(0) as number[];
    const timeCounts = [0, 0, 0, 0];
    visits.forEach((visit) => {
      const d = new Date(visit.checked_in_at);
      const weekday = Number(new Intl.DateTimeFormat("en-US", { timeZone: LAGOS, weekday: "short" }).formatToParts(d).find((item) => item.type === "weekday")?.value ? d.getTime() : d.getTime());
      void weekday;
      const label = new Intl.DateTimeFormat("en-US", { timeZone: LAGOS, weekday: "short" }).format(d);
      const index = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(label);
      if (index >= 0) weekdayCounts[index] += 1;
      const hour = lagosHour(visit.checked_in_at);
      if (hour < 10) timeCounts[0] += 1;
      else if (hour < 14) timeCounts[1] += 1;
      else if (hour < 18) timeCounts[2] += 1;
      else timeCounts[3] += 1;
    });
    const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const bestDayIndex = weekdayCounts.indexOf(Math.max(...weekdayCounts));
    const timeLabels = ["Early morning", "Late morning", "Afternoon", "Evening"];
    const bestTimeIndex = timeCounts.indexOf(Math.max(...timeCounts));

    const weekCounts: number[] = [];
    for (let i = 0; i < 12; i++) {
      const start = addDays(currentWeekStart, -7 * i);
      const end = addDays(start, 6);
      weekCounts.push(visits.filter((visit) => {
        const key = toLagosKey(visit.checked_in_at);
        return key >= start && key <= end;
      }).length);
    }
    let streak = 0;
    let startIndex = weekCounts[0]! >= weeklyGoal ? 0 : 1;
    for (let i = startIndex; i < weekCounts.length; i++) {
      if ((weekCounts[i] ?? 0) >= weeklyGoal) streak += 1;
      else break;
    }

    const recentEight = weekCounts.slice(0, 8).reduce((sum, count) => sum + count, 0);
    const average = Math.round((recentEight / 8) * 10) / 10;
    return {
      weeklyVisits: weekly.length,
      thisMonthCount,
      previousMonthCount,
      streak,
      favoriteDay: visits.length ? weekdayNames[bestDayIndex] : "Not enough data",
      commonTime: visits.length ? timeLabels[bestTimeIndex] : "Not enough data",
      average,
    };
  }, [visits, monthlyVisits, today, weeklyGoal]);

  const challengeTarget = 12;
  const challengeProgress = Math.min(100, Math.round((stats.thisMonthCount / challengeTarget) * 100));
  const weeklyProgress = Math.min(100, Math.round((stats.weeklyVisits / weeklyGoal) * 100));

  const achievements = [
    { key: "first", label: "First Step", detail: "Completed your first recorded visit", icon: Star, unlocked: (totalVisits ?? 0) >= 1 },
    { key: "weekly", label: "On Fire", detail: "Hit your weekly attendance goal", icon: Flame, unlocked: stats.weeklyVisits >= weeklyGoal },
    { key: "monthly10", label: "Consistent", detail: "10 visits in one month", icon: Medal, unlocked: stats.thisMonthCount >= 10 },
    { key: "club25", label: "25 Visit Club", detail: "25 total recorded visits", icon: Award, unlocked: (totalVisits ?? 0) >= 25 },
    { key: "club50", label: "50 Club", detail: "50 total recorded visits", icon: Trophy, unlocked: (totalVisits ?? 0) >= 50 },
    { key: "century", label: "Century Club", detail: "100 total recorded visits", icon: Trophy, unlocked: (totalVisits ?? 0) >= 100 },
    { key: "warrior", label: "Monthly Warrior", detail: "4 consecutive goal-hitting weeks", icon: Sparkles, unlocked: stats.streak >= 4 },
  ];

  useEffect(() => {
    if (!member?.id || attendanceLoading) return;
    const unlocked = achievements.filter((item) => item.unlocked).map((item) => item.key);
    try {
      const storageKey = "spf-achievements:" + member.id;
      const seen = JSON.parse(window.localStorage.getItem(storageKey) || "[]") as string[];
      const fresh = achievements.find((item) => item.unlocked && !seen.includes(item.key));
      window.localStorage.setItem(storageKey, JSON.stringify(Array.from(new Set([...seen, ...unlocked]))));
      if (fresh) setCelebration(fresh.label);
    } catch { /* storage unavailable */ }
  }, [member?.id, attendanceLoading, totalVisits, stats.thisMonthCount, stats.weeklyVisits, stats.streak, weeklyGoal]);

  const nextMilestone = [25, 50, 100, 200, 300].find((value) => (totalVisits ?? 0) < value);
  const milestoneRemaining = nextMilestone ? nextMilestone - (totalVisits ?? 0) : 0;

  const calendar = useMemo(() => {
    const [year, month] = today.slice(0, 7).split("-").map(Number);
    const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    const mondayOffset = first === 0 ? 6 : first - 1;
    const visitDays = new Set(visits.filter((visit) => toLagosKey(visit.checked_in_at).slice(0, 7) === today.slice(0, 7)).map((visit) => Number(toLagosKey(visit.checked_in_at).slice(8, 10))));
    return { days, mondayOffset, visitDays };
  }, [visits, today]);

  if (loading) return <main className="min-h-[75vh] bg-[#f5f7f2] py-20"><div className="section-shell flex min-h-[50vh] items-center justify-center gap-3 text-sm font-bold uppercase"><Loader2 className="size-5 animate-spin"/> Loading your account...</div></main>;
  if (error || !member) return <main className="min-h-[75vh] bg-muted py-16 sm:py-24"><div className="section-shell"><div className="mx-auto max-w-2xl rounded-2xl border border-border bg-background p-8 shadow-sm sm:p-12"><AlertCircle className="size-10 text-destructive"/><h1 className="display-title mt-6 text-4xl sm:text-5xl">Account Issue</h1><p className="mt-5 text-sm leading-7 text-muted-foreground">{error || "Unable to load your account."}</p><div className="mt-8 flex flex-wrap gap-3"><Button asChild><Link to="/login">Back to Login</Link></Button><Button variant="outline" onClick={handleLogout}>Log Out</Button></div></div></div></main>;

  const tabButton = (tab: DashboardTab, label: string, Icon: typeof Home) => (
    <button type="button" onClick={() => { setActiveTab(tab); window.scrollTo({ top: 0, behavior: "smooth" }); }}
      className={(activeTab === tab ? "text-[#1f6c3d]" : "text-[#708075]") + " flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-black"}>
      <Icon className="size-5"/><span className="truncate">{label}</span>
    </button>
  );

  return <main className="min-h-[100dvh] bg-[#f3f6f0] pb-28 text-[#20362a]">
    {celebration && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 px-4" role="dialog" aria-modal="true" aria-label="Achievement unlocked">
      <div className="w-full max-w-sm rounded-[28px] bg-white p-7 text-center shadow-2xl">
        <div className="mx-auto grid size-20 place-items-center rounded-full bg-[#e4f6d8]"><Trophy className="size-10 text-[#2c7a43]"/></div>
        <p className="mt-5 text-xs font-black uppercase tracking-[.18em] text-[#438051]">Achievement unlocked</p>
        <h2 className="mt-2 font-display text-4xl font-black uppercase">{celebration}</h2>
        <p className="mt-3 text-sm leading-6 text-[#63746a]">Another Super Plus milestone added to your profile.</p>
        <Button className="mt-6 w-full rounded-xl" onClick={() => setCelebration(null)}>Nice!</Button>
      </div>
    </div>}

    <div className="mx-auto max-w-6xl px-4 py-5 sm:px-7 sm:py-9">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#488253]">Super Plus member</p>
          <h1 className="mt-1 truncate font-display text-3xl font-black uppercase sm:text-5xl">Hi, {firstName} 👋</h1>
        </div>
        <Link to="/my-qr" className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#193b2a] text-white shadow-md" aria-label="Open gym QR code"><QrCode className="size-6"/></Link>
      </header>

      {activeTab === "home" && <div className="mt-5 space-y-4">
        <section className="overflow-hidden rounded-[26px] bg-[#193b2a] p-5 text-white shadow-lg sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#b8ee73]">Membership</p><h2 className="mt-1 font-display text-2xl font-black uppercase sm:text-3xl">{planName}</h2></div>
            <span className={(isActive ? "bg-[#dff6d7] text-[#21633a]" : "bg-[#fff0e9] text-[#a73b27]") + " inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-black"}>{isActive ? <CheckCircle2 className="size-4"/> : <AlertCircle className="size-4"/>}{isActive ? "ACTIVE" : "EXPIRED"}</span>
          </div>
          <div className="mt-5 flex items-end justify-between gap-4">
            <div><p className="text-xs text-white/65">Time remaining</p><p className="mt-1 text-2xl font-black">{isActive ? (daysRemaining === 0 ? "Expires today" : daysRemaining + " days") : "Renew to reactivate"}</p></div>
            <p className="text-right text-[11px] leading-5 text-white/65">{formatDate(expiryDate)}</p>
          </div>
          {isActive && totalDays !== null && totalDays > 0 && <div className="mt-4"><div className="h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[#b8ee73]" style={{ width: membershipProgress + "%" }}/></div></div>}
          {(expirySoon || !isActive) && <p className="mt-4 rounded-xl border border-[#b8ee73]/30 bg-white/10 p-3 text-xs leading-5">{expirySoon ? "Your plan is close to expiry. Renew early to keep your access continuous." : "Your membership is not currently active."}</p>}
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Button asChild className="h-12 rounded-xl bg-[#b8ee73] text-[#193b2a] hover:bg-[#d1faa3]"><Link to="/my-qr"><QrCode className="size-5"/> Open QR</Link></Button>
            <Button variant="outline" className="h-12 rounded-xl border-white/40 bg-transparent text-white hover:bg-white hover:text-[#193b2a]" onClick={() => setShowPlans((value) => !value)}><RefreshCw className="size-4"/> Renew</Button>
          </div>
          {showPlans && <div className="mt-5 rounded-2xl bg-white p-4 text-[#20362a]">
            <div className="grid gap-2 sm:grid-cols-2">{membershipPlans.map((plan) => <button key={plan.id} type="button" onClick={() => setSelectedPlan(plan.id)}
              className={(selectedPlan === plan.id ? "border-[#26743d] bg-[#eaf5e7]" : "border-[#dce6d9]") + " rounded-xl border p-3 text-left"}>
              <span className="flex items-start justify-between gap-2"><span className="font-display text-base font-black uppercase">{plan.name}</span><span className="text-sm font-black">{formatNaira(plan.price)}</span></span>
              <span className="mt-1 block text-[11px] text-[#6b786f]">{plan.duration}</span>
            </button>)}</div>
            <label className="mt-3 block text-xs font-black">Coupon code (optional)<input value={coupon} onChange={(event) => { setCoupon(event.target.value); setPaymentError(""); }} className="mt-1.5 w-full rounded-xl border border-[#dce6d9] px-3 py-3 text-sm" placeholder="Enter coupon code"/></label>
            {paymentError && <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700">{paymentError}</p>}
            <Button className="mt-3 w-full rounded-xl" disabled={!selectedPlan || paymentLoading} onClick={handlePayment}>{paymentLoading ? <><Loader2 className="size-4 animate-spin"/> Preparing...</> : <>Continue to Paystack <CreditCard className="size-4"/></>}</Button>
          </div>}
        </section>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "This week", value: stats.weeklyVisits + " / " + weeklyGoal, icon: Target, note: "visit goal" },
            { label: "This month", value: String(stats.thisMonthCount), icon: CalendarDays, note: "recorded visits" },
            { label: "Goal streak", value: stats.streak + (stats.streak === 1 ? " week" : " weeks"), icon: Flame, note: "consecutive" },
            { label: "All-time visits", value: totalVisits === null ? "—" : String(totalVisits), icon: Trophy, note: "QR records" },
          ].map(({ label, value, icon: Icon, note }) => <div key={label} className="rounded-2xl border border-[#dce7d8] bg-white p-4"><div className="flex items-center justify-between gap-2"><p className="text-[10px] font-black uppercase tracking-wide text-[#6c7b70]">{label}</p><Icon className="size-4 text-[#2f7746]"/></div><p className="mt-3 text-2xl font-black tabular-nums">{value}</p><p className="mt-1 text-[10px] text-[#7a867e]">{note}</p></div>)}
        </section>

        <section className="grid gap-3 md:grid-cols-2">
          <div className="rounded-[24px] border border-[#dbe6d8] bg-white p-5">
            <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#397748]">Weekly goal</p><h2 className="mt-1 font-display text-2xl font-black uppercase">{stats.weeklyVisits} of {weeklyGoal} visits</h2></div><Target className="size-6 text-[#2f7746]"/></div>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-[#edf2ea]"><div className="h-full rounded-full bg-[#4e914f]" style={{ width: weeklyProgress + "%" }}/></div>
            <p className="mt-3 text-xs leading-5 text-[#65756a]">{stats.weeklyVisits >= weeklyGoal ? "Goal complete. Keep the momentum going." : (weeklyGoal - stats.weeklyVisits) + " more " + (weeklyGoal - stats.weeklyVisits === 1 ? "visit" : "visits") + " to hit your goal this week."}</p>
          </div>
          <div className="rounded-[24px] border border-[#eadfc7] bg-[#fffaf0] p-5">
            <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#9a6c1e]">{monthLabel(today)} challenge</p><h2 className="mt-1 font-display text-2xl font-black uppercase">12-Visit Challenge</h2></div><Award className="size-6 text-[#a97826]"/></div>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-[#b68a3a]" style={{ width: challengeProgress + "%" }}/></div>
            <p className="mt-3 text-xs leading-5 text-[#786a52]">{stats.thisMonthCount >= challengeTarget ? "Challenge complete — badge earned." : stats.thisMonthCount + " / " + challengeTarget + " complete · " + (challengeTarget - stats.thisMonthCount) + " to go."}</p>
          </div>
        </section>

        {nextMilestone && <section className="rounded-[24px] border border-[#d9e7d6] bg-[#eaf5e7] p-5">
          <div className="flex items-center gap-4"><div className="grid size-12 place-items-center rounded-2xl bg-white"><Trophy className="size-6 text-[#2f7746]"/></div><div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#4c7b54]">Next milestone</p><h2 className="mt-1 font-display text-xl font-black uppercase">{nextMilestone} Visit Club</h2><p className="mt-1 text-xs text-[#65756a]">{milestoneRemaining} more recorded {milestoneRemaining === 1 ? "visit" : "visits"} to unlock it.</p></div></div>
        </section>}

        <section>
          <div className="mb-3 flex items-center justify-between"><h2 className="font-display text-xl font-black uppercase">Quick actions</h2><span className="text-[10px] text-[#6f7f73]">Tap and go</span></div>
          <div className="grid grid-cols-4 gap-2">
            <Link to="/my-qr" className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl border border-[#dbe6d7] bg-white p-2 text-center text-[10px] font-black"><QrCode className="size-6 text-[#287144]"/>QR</Link>
            <button type="button" onClick={() => setActiveTab("activity")} className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl border border-[#dbe6d7] bg-white p-2 text-[10px] font-black"><BarChart3 className="size-6 text-[#287144]"/>Activity</button>
            <a href={whatsappGroup} target="_blank" rel="noopener noreferrer" className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl border border-[#dbe6d7] bg-white p-2 text-center text-[10px] font-black"><MessageCircle className="size-6 text-[#287144]"/>Updates</a>
            <button type="button" onClick={() => setActiveTab("community")} className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl border border-[#dbe6d7] bg-white p-2 text-[10px] font-black"><Users className="size-6 text-[#287144]"/>Community</button>
          </div>
        </section>

        <section className="rounded-[24px] border border-[#dce7d8] bg-white p-5">
          <div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#397748]">For you</p><h2 className="mt-1 font-display text-2xl font-black uppercase">Fitness journal</h2></div><Link to="/blog" className="text-xs font-black text-[#2a7140]">View all →</Link></div>
          {blogLoading ? <p className="mt-4 text-xs text-[#67766c]">Loading articles...</p> : <div className="mt-4 flex snap-x gap-3 overflow-x-auto pb-2">{posts.slice(0, 3).map((post) => <a key={post.id} href={"/blog/article?slug=" + encodeURIComponent(post.slug)} className="min-w-[78%] snap-start overflow-hidden rounded-2xl border border-[#e0e8da] bg-[#fbfcfa] sm:min-w-[42%]">{post.featured_image && <img src={post.featured_image} alt="" className="aspect-[16/7] w-full object-cover"/>}<div className="p-4"><p className="text-[10px] font-black uppercase text-[#37784b]">{post.category}</p><h3 className="mt-1 font-display text-lg font-black uppercase leading-tight">{post.title}</h3></div></a>)}</div>}
        </section>
      </div>}

      {activeTab === "activity" && <div className="mt-5 space-y-4">
        <section className="rounded-[26px] bg-[#193b2a] p-5 text-white">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#b8ee73]">Your activity</p>
          <div className="mt-2 flex items-end justify-between gap-3"><div><h2 className="font-display text-3xl font-black uppercase">Build consistency</h2><p className="mt-1 text-xs text-white/70">Your QR check-ins power these stats.</p></div><Activity className="size-8 text-[#b8ee73]"/></div>
        </section>

        {attendanceLoading ? <div className="rounded-2xl bg-white p-6 text-sm"><Loader2 className="mr-2 inline size-4 animate-spin"/>Loading activity...</div> : attendanceError ? <div className="rounded-2xl bg-white p-6 text-sm">{attendanceError}</div> : <>
          <section className="rounded-[24px] border border-[#dce7d8] bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#397748]">Weekly target</p><h2 className="mt-1 font-display text-2xl font-black uppercase">{stats.weeklyVisits} / {weeklyGoal} visits</h2></div><Flame className="size-7 text-[#d86b2f]"/></div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#edf2ea]"><div className="h-full rounded-full bg-[#4e914f]" style={{ width: weeklyProgress + "%" }}/></div>
            <div className="mt-4 grid grid-cols-5 gap-2">{[2, 3, 4, 5, 6].map((goal) => <button key={goal} onClick={() => setWeeklyGoal(goal)} className={(weeklyGoal === goal ? "bg-[#1f6338] text-white" : "bg-[#f1f5ef] text-[#52675a]") + " rounded-xl px-2 py-3 text-xs font-black"}>{goal}x</button>)}</div>
            <p className="mt-3 text-[11px] leading-5 text-[#69786e]">Choose how many gym visits you want to hit each week. This preference is stored only on your device.</p>
          </section>

          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Current streak", value: stats.streak + " wk", icon: Flame },
              { label: "8-week average", value: stats.average + "/wk", icon: BarChart3 },
              { label: "Favourite day", value: stats.favoriteDay, icon: CalendarDays },
              { label: "Usual time", value: stats.commonTime, icon: Clock3 },
            ].map(({ label, value, icon: Icon }) => <div key={label} className="rounded-2xl border border-[#dce7d8] bg-white p-4"><Icon className="size-5 text-[#2f7746]"/><p className="mt-3 text-[10px] font-black uppercase text-[#778279]">{label}</p><p className="mt-1 text-sm font-black">{value}</p></div>)}
          </section>

          <section className="rounded-[24px] border border-[#dce7d8] bg-white p-5">
            <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#397748]">Visit calendar</p><h2 className="mt-1 font-display text-2xl font-black uppercase">{monthLabel(today)}</h2></div><CalendarDays className="size-6 text-[#2f7746]"/></div>
            <div className="mt-5 grid grid-cols-7 gap-1 text-center text-[9px] font-black uppercase text-[#849087]">{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((day) => <span key={day}>{day}</span>)}</div>
            <div className="mt-2 grid grid-cols-7 gap-1">{Array.from({ length: calendar.mondayOffset }).map((_, index) => <span key={"blank-" + index}/>)}
              {Array.from({ length: calendar.days }, (_, index) => index + 1).map((day) => {
                const key = today.slice(0, 8) + String(day).padStart(2, "0");
                const visited = calendar.visitDays.has(day);
                const current = key === today;
                return <div key={day} className={(visited ? "bg-[#2f7746] text-white" : current ? "border-2 border-[#2f7746] bg-[#eef6ea]" : "bg-[#f5f7f2]") + " grid aspect-square place-items-center rounded-lg text-[11px] font-black"}>{day}</div>;
              })}
            </div>
            <p className="mt-3 text-[11px] text-[#6f7d73]">Green days are recorded QR visits. Missing scans can make activity look lower than your actual attendance.</p>
          </section>

          <section className="rounded-[24px] border border-[#dce7d8] bg-white p-5">
            <div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#397748]">Achievements</p><h2 className="mt-1 font-display text-2xl font-black uppercase">Your badge cabinet</h2></div><Award className="size-6 text-[#b8872f]"/></div>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">{achievements.map(({ key, label, detail, icon: Icon, unlocked }) => <div key={key} className={(unlocked ? "border-[#cfe3c8] bg-[#f1f8ed]" : "border-[#e4e8e2] bg-[#f7f8f6] opacity-55") + " rounded-2xl border p-4"}><div className={(unlocked ? "bg-white text-[#2f7746]" : "bg-[#e8ebe6] text-[#89928b]") + " grid size-10 place-items-center rounded-xl"}><Icon className="size-5"/></div><p className="mt-3 text-sm font-black">{label}</p><p className="mt-1 text-[10px] leading-4 text-[#738077]">{detail}</p></div>)}</div>
          </section>

          <section className="rounded-[24px] border border-[#dce7d8] bg-white p-5">
            <div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#397748]">History</p><h2 className="mt-1 font-display text-2xl font-black uppercase">Recent visits</h2></div><span className="text-xs font-black">{stats.thisMonthCount} this month</span></div>
            <div className="mt-4 divide-y divide-[#e5ebe2]">{visits.slice(0, 12).map((visit) => <div key={visit.id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-black">{formatVisit(visit.checked_in_at)}</p><p className="mt-1 text-[10px] text-[#778379]">{visit.checked_out_at ? "Checked out " + formatVisit(visit.checked_out_at) : "No checkout recorded"}</p></div><CheckCircle2 className="size-5 shrink-0 text-[#4a8c50]"/></div>)}</div>
          </section>
        </>}
      </div>}

      {activeTab === "community" && <div className="mt-5 space-y-4">
        <section className="rounded-[26px] bg-[#193b2a] p-5 text-white"><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#b8ee73]">Community</p><div className="mt-2 flex items-end justify-between gap-3"><div><h2 className="font-display text-3xl font-black uppercase">What's happening</h2><p className="mt-1 text-xs text-white/70">Announcements, challenges, classes and gym updates.</p></div><Users className="size-8 text-[#b8ee73]"/></div></section>

        <div className="-mx-4 overflow-hidden sm:mx-0 sm:rounded-[24px] sm:border sm:border-[#dce7d8]"><AnnouncementSurface placement="dashboard"/></div>

        <section className="rounded-[24px] border border-[#eadfc7] bg-[#fffaf0] p-5">
          <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#9a6c1e]">Monthly challenge</p><h2 className="mt-1 font-display text-2xl font-black uppercase">12 visits in {monthLabel(today).split(" ")[0]}</h2></div><Trophy className="size-6 text-[#a97826]"/></div>
          <p className="mt-4 text-3xl font-black">{stats.thisMonthCount} <span className="text-base text-[#8b7a5e]">/ {challengeTarget}</span></p>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-[#b68a3a]" style={{ width: challengeProgress + "%" }}/></div>
          <p className="mt-3 text-xs text-[#786a52]">{stats.thisMonthCount >= challengeTarget ? "Completed. Your Monthly Challenge badge is secured." : "Keep checking in with your member QR — every recorded visit counts automatically."}</p>
        </section>

        <section className="grid gap-3 md:grid-cols-2">
          <div className="rounded-[24px] border border-[#d6e8d4] bg-white p-5">
            <div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#397748]">Group classes</p><h2 className="mt-1 font-display text-2xl font-black uppercase">Find your next session</h2></div><Users className="size-6 text-[#2f7746]"/></div>
            <p className="mt-3 text-xs leading-5 text-[#68776c]">A live timetable is not published in the system yet, so the dashboard will not invent class times or availability.</p>
            <a href={"https://wa.me/" + receptionPhone + "?text=" + encodeURIComponent(classMessage)} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1f6338] px-4 py-3 text-xs font-black text-white"><MessageCircle className="size-4"/> Ask for timetable</a>
          </div>
          <div className="rounded-[24px] border border-[#d6e8d4] bg-white p-5">
            <div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#397748]">Personal training</p><h2 className="mt-1 font-display text-2xl font-black uppercase">{isPtMember ? "Your PT access" : "Train with a coach"}</h2></div><Dumbbell className="size-6 text-[#2f7746]"/></div>
            <p className="mt-3 text-xs leading-5 text-[#68776c]">{isPtMember ? "Your current plan includes personal training. Request the next available session from the team." : "Personal training can add structured coaching, form guidance and accountability."}</p>
            <div className="mt-4 flex flex-wrap gap-2"><a href={"https://wa.me/" + receptionPhone + "?text=" + encodeURIComponent(ptMessage)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1f6338] px-4 py-3 text-xs font-black text-white"><MessageCircle className="size-4"/> Request session</a><Link to="/personal-training" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#cfdccf] px-4 py-3 text-xs font-black">Learn more <ArrowRight className="size-4"/></Link></div>
          </div>
        </section>

        <section className="rounded-[24px] border border-[#d3e6d0] bg-[#edf6eb] p-5">
          <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-[#22793d] text-white"><MessageCircle className="size-5"/></span><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#37784b]">Gym community</p><h2 className="font-display text-xl font-black uppercase">Join the WhatsApp group</h2></div></div>
          <p className="mt-3 text-xs leading-5 text-[#627367]">Announcements, events and quick updates from the Super Plus team.</p>
          <a href={whatsappGroup} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#22793d] px-4 py-3 text-xs font-black text-white">Join group <ExternalLink className="size-4"/></a>
        </section>

        <section className="rounded-[24px] border border-[#dce7d8] bg-white p-5">
          <div className="flex items-end justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#397748]">Learn & recover</p><h2 className="mt-1 font-display text-2xl font-black uppercase">Latest from the blog</h2></div><BookOpen className="size-6 text-[#2f7746]"/></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">{posts.slice(0, 4).map((post) => <a key={post.id} href={"/blog/article?slug=" + encodeURIComponent(post.slug)} className="rounded-2xl border border-[#e0e8da] p-4"><p className="text-[10px] font-black uppercase text-[#397748]">{post.category}</p><h3 className="mt-1 font-display text-lg font-black uppercase leading-tight">{post.title}</h3><span className="mt-3 inline-flex items-center gap-1 text-[10px] font-black text-[#2f7746]">Read article <ArrowRight className="size-3"/></span></a>)}</div>
        </section>
      </div>}

      {activeTab === "profile" && <div className="mt-5 space-y-4">
        <section className="rounded-[26px] bg-[#193b2a] p-5 text-white">
          <div className="flex items-center gap-4"><div className="grid size-16 shrink-0 place-items-center rounded-full bg-[#b8ee73] font-display text-2xl font-black text-[#193b2a]">{fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</div><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#b8ee73]">Member profile</p><h2 className="mt-1 truncate font-display text-3xl font-black uppercase">{fullName}</h2><p className="mt-1 text-xs text-white/70">{planName}</p></div></div>
        </section>

        <section className="rounded-[24px] border border-[#dce7d8] bg-white p-5">
          <h2 className="flex items-center gap-2 font-display text-2xl font-black uppercase"><UserRound className="size-5 text-[#287144]"/> Your details</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2"><div><p className="text-[10px] font-black uppercase text-[#78847b]">Email</p><p className="mt-1 break-all text-sm font-bold">{member.email || "Not available"}</p></div><div><p className="text-[10px] font-black uppercase text-[#78847b]">Phone</p><p className="mt-1 text-sm font-bold">{member.phone || "Not available"}</p></div></div>
          <a href={"https://wa.me/" + receptionPhone + "?text=" + encodeURIComponent(supportMessage)} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#b8d0b6] bg-[#f5f8f3] px-4 py-3 text-xs font-black text-[#235d38]"><PencilLine className="size-4"/> Request correction <ExternalLink className="size-4"/></a>
        </section>

        <section className="rounded-[24px] border border-[#dce7d8] bg-white p-5">
          <h2 className="font-display text-2xl font-black uppercase">Membership details</h2>
          <div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-[#f3f7f1] p-4"><p className="text-[10px] font-black uppercase text-[#778379]">Started</p><p className="mt-2 text-sm font-black">{formatDate(startDate)}</p></div><div className="rounded-2xl bg-[#f3f7f1] p-4"><p className="text-[10px] font-black uppercase text-[#778379]">Expires</p><p className="mt-2 text-sm font-black">{formatDate(expiryDate)}</p></div></div>
          <div className="mt-3 rounded-2xl bg-[#f3f7f1] p-4"><p className="text-[10px] font-black uppercase text-[#778379]">Recorded visits</p><p className="mt-2 text-3xl font-black">{totalVisits ?? "—"}</p></div>
        </section>

        <section className="rounded-[24px] border border-[#dce7d8] bg-white p-5">
          <h2 className="font-display text-xl font-black uppercase">Account actions</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => { setActiveTab("home"); setShowPlans(true); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#d4dfd2] px-4 text-sm font-black"><RefreshCw className="size-4"/> Renew membership</button><button type="button" onClick={handleLogout} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-black text-red-700"><LogOut className="size-4"/> Log out</button></div>
        </section>
      </div>}
    </div>

    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[#d7e1d5] bg-white/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-1 shadow-[0_-8px_28px_rgba(26,55,36,0.08)] backdrop-blur">
      <div className="mx-auto flex max-w-lg items-end">
        {tabButton("home", "Home", Home)}
        {tabButton("activity", "Activity", Activity)}
        <Link to="/my-qr" className="-mt-5 flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[10px] font-black text-[#193b2a]"><span className="grid size-14 place-items-center rounded-full border-4 border-white bg-[#b8ee73] shadow-lg"><QrCode className="size-6"/></span><span>QR</span></Link>
        {tabButton("community", "Community", Megaphone)}
        {tabButton("profile", "Profile", UserRound)}
      </div>
    </nav>
  </main>;
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Activity, AlertCircle, ArrowRight, BookOpen, CalendarDays, CheckCircle2,
  Clock3, CreditCard, ExternalLink, LogOut, MessageCircle, QrCode,
  RefreshCw, UserRound, Loader2, PencilLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { membershipPlans, formatNaira } from "@/lib/site-data";

export const Route = createFileRoute("/member")({
  head: () => ({ meta: [
    { title: "Member Dashboard — Super Plus Fitness" },
    { name: "description", content: "View your Super Plus Fitness membership, QR code and attendance." },
  ] }),
  component: MemberDashboard,
});

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

// Retain the existing membership-combining behaviour; this display does not alter any plans.
function getLocalDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
function dateOnly(value: unknown) { return value ? String(value).trim().slice(0, 10) || null : null; }
function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function getContinuousMembership(memberships: Membership[]): Membership | null {
  if (!memberships.length) return null;
  const today = getLocalDateString();
  const normalized = memberships.map(item => ({ ...item, normalizedStart: dateOnly(item.start_date), normalizedEnd: dateOnly(item.end_date) }))
    .filter(item => item.normalizedStart && item.normalizedEnd)
    .sort((a, b) => String(a.normalizedStart).localeCompare(String(b.normalizedStart)));
  if (!normalized.length) return null;
  const index = normalized.findIndex(item => String(item.normalizedStart) <= today && today <= String(item.normalizedEnd));
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
function formatDate(value: string | null | undefined) {
  const date = dateOnly(value);
  if (!date) return "Not available";
  const [year = 0, month = 0, day = 0] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day, 12));
  return Number.isNaN(parsed.getTime()) ? "Not available" : new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(parsed);
}
function daysBetween(start: string | null, end: string | null) {
  if (!start || !end) return null;
  return Math.round((Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86400000);
}
function lagosMonthStart() {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const pick = (type: string) => parts.find(item => item.type === type)?.value || "";
  return `${pick("year")}-${pick("month")}-01T00:00:00+01:00`;
}
const supportMessage = "Hello Super Plus Fitness, I would like to request a correction to the contact details on my member profile. Please help me verify the change.";

function MemberDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState<Member | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [error, setError] = useState("");
  const [showPlans, setShowPlans] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("");
  const [coupon, setCoupon] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [visits, setVisits] = useState<Visit[]>([]);
  const [monthlyVisits, setMonthlyVisits] = useState<number | null>(null);
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [attendanceError, setAttendanceError] = useState("");
  const [posts, setPosts] = useState<BlogPreview[]>([]);
  const [blogLoading, setBlogLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadMember() {
      setLoading(true);
      setError("");
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!active) return;
        if (!session) { navigate({ to: "/login" }); return; }
        // Keep the existing verified-email account-linking step unchanged.
        const { error: linkError } = await supabase.rpc("link_member_account");
        if (linkError) console.error("Member account linking error:", linkError);
        if (!active) return;
        const { data: person, error: memberError } = await supabase.from("members").select("*")
          .eq("auth_user_id", session.user.id).maybeSingle();
        if (!active) return;
        if (memberError) throw memberError;
        if (!person) throw new Error("Your login was successful, but we could not find a member account connected to this email. Please contact Super Plus Fitness reception.");
        setMember(person as Member);
        const { data: plans, error: membershipError } = await supabase.from("memberships").select("*")
          .eq("member_id", person.id).order("created_at", { ascending: false });
        if (!active) return;
        if (membershipError) throw membershipError;
        setMembership(getContinuousMembership((plans || []) as Membership[]));
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to load your account.");
      } finally { if (active) setLoading(false); }
    }
    void loadMember();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && active) navigate({ to: "/login" });
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [navigate]);

  // RLS permits a member to read only their own attendance. These reads never write scans.
  useEffect(() => {
    if (!member?.id) return;
    let active = true;
    const memberId = member.id;
    async function loadAttendance() {
      setAttendanceLoading(true);
      setAttendanceError("");
      const [monthly, recent] = await Promise.all([
        supabase.from("attendance").select("id", { count: "exact", head: true })
          .eq("member_id", memberId).gte("checked_in_at", lagosMonthStart()),
        supabase.from("attendance").select("id,checked_in_at,checked_out_at")
          .eq("member_id", memberId).order("checked_in_at", { ascending: false }).limit(5),
      ]);
      if (!active) return;
      if (monthly.error || recent.error) {
        setAttendanceError("Attendance is unavailable right now. Your check-in records have not been changed.");
        setMonthlyVisits(null); setVisits([]);
      } else { setMonthlyVisits(monthly.count ?? 0); setVisits((recent.data || []) as Visit[]); }
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
        .lte("published_at", new Date().toISOString())
        .order("published_at", { ascending: false }).limit(2);
      if (!active) return;
      if (!blogError && data) setPosts(data as BlogPreview[]);
      setBlogLoading(false);
    }
    void loadBlog();
    return () => { active = false; };
  }, []);

  async function handleLogout() { await supabase.auth.signOut(); navigate({ to: "/login" }); }

  // Preserve the existing plan selection and secure Paystack initialization flow.
  async function handlePayment() {
    if (!selectedPlan) { setPaymentError("Please select a membership plan."); return; }
    const cleanCoupon = coupon.trim().toUpperCase();
    setPaymentLoading(true); setPaymentError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate({ to: "/login" }); return; }
      const { data, error: functionError } = await supabase.functions.invoke("initialize-payment", { body: { planId: selectedPlan, ...(cleanCoupon ? { couponCode: cleanCoupon } : {}) } });
      if (functionError) { console.error("Payment initialization error:", functionError); throw new Error(functionError.message || "Unable to start payment."); }
      if (!data?.authorization_url) throw new Error(data?.error || "Unable to create Paystack payment.");
      window.location.href = data.authorization_url;
    } catch (cause) {
      console.error("Payment error:", cause);
      setPaymentError(cause instanceof Error ? cause.message : "Unable to start payment. Please try again.");
      setPaymentLoading(false);
    }
  }
  function openPlans() {
    setShowPlans(true);
    setPaymentError("");
    document.getElementById("membership-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (loading) return <main className="min-h-[75vh] bg-[#f5f7f2] py-20"><div className="section-shell flex min-h-[50vh] items-center justify-center gap-3 text-sm font-bold uppercase"><Loader2 className="size-5 animate-spin"/> Loading your account...</div></main>;
  if (error || !member) return <main className="min-h-[75vh] bg-muted py-16 sm:py-24"><div className="section-shell"><div className="mx-auto max-w-2xl rounded-2xl border border-border bg-background p-8 shadow-sm sm:p-12"><AlertCircle className="size-10 text-destructive"/><h1 className="display-title mt-6 text-4xl sm:text-5xl">Account Issue</h1><p className="mt-5 text-sm leading-7 text-muted-foreground">{error || "Unable to load your account."}</p><div className="mt-8 flex flex-wrap gap-3"><Button asChild><Link to="/login">Back to Login</Link></Button><Button variant="outline" onClick={handleLogout}>Log Out</Button></div></div></div></main>;

  const fullName = member.full_name || `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() || "Member";
  const planName = membership?.plan_name || membership?.name || membership?.plan || "Membership";
  const startDate = membership?.start_date || null;
  const expiryDate = membership?.end_date || null;
  const today = getLocalDateString();
  const isActive = Boolean(startDate && expiryDate && startDate <= today && today <= expiryDate);
  const daysRemaining = isActive ? Math.max(0, daysBetween(today, expiryDate) ?? 0) : 0;
  const totalDays = daysBetween(startDate, expiryDate);
  const elapsedDays = daysBetween(startDate, today);
  const progress = isActive && totalDays !== null && totalDays > 0 && elapsedDays !== null
    ? Math.max(0, Math.min(100, Math.round((elapsedDays / totalDays) * 100))) : 0;
  const expirySoon = isActive && daysRemaining <= 7;
  const lastVisit = visits[0]?.checked_in_at;
  const whatsappGroup = "https://chat.whatsapp.com/FysNYsQkx3rAqlB5WS4k6s?s=cl&p=i&mlu=4&ilr=4";

  return <main className="min-h-[75vh] bg-[#f5f7f2] py-7 text-[#20362a] sm:py-12">
    <div className="section-shell mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0"><p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#37784b]">Your fitness space</p><h1 className="mt-2 font-display text-4xl font-bold uppercase leading-tight sm:text-6xl">Welcome back, {fullName.split(/\s+/)[0]}</h1><p className="mt-2 text-sm text-[#627367]">Your membership, gym access and progress — all in one place.</p></div>
        <Button variant="outline" className="rounded-xl bg-white" onClick={handleLogout}><LogOut className="size-4"/> Log Out</Button>
      </header>

      <section id="membership-card" className="scroll-mt-24 overflow-hidden rounded-3xl bg-[#193b2a] p-5 text-white shadow-lg sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#b8ee73]">Your membership</p><h2 className="mt-2 font-display text-3xl font-bold uppercase sm:text-4xl">{planName}</h2></div><span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${isActive ? "bg-[#dff6d7] text-[#21633a]" : "bg-[#fff0e9] text-[#a73b27]"}`}>{isActive ? <CheckCircle2 className="size-4"/> : <AlertCircle className="size-4"/>}{isActive ? "Active" : "Expired"}</span></div>
        <div className="mt-6 grid gap-3 rounded-2xl border border-white/20 bg-white/10 p-4 sm:grid-cols-3 sm:gap-4">
          <div><p className="flex items-center gap-2 text-xs text-white/70"><CalendarDays className="size-4"/> Start date</p><p className="mt-1 text-sm font-semibold">{formatDate(startDate)}</p></div>
          <div><p className="flex items-center gap-2 text-xs text-white/70"><Clock3 className="size-4"/> Expiry date</p><p className="mt-1 text-sm font-semibold">{formatDate(expiryDate)}</p></div>
          <div><p className="flex items-center gap-2 text-xs text-white/70"><Clock3 className="size-4"/> Time remaining</p><p className="mt-1 text-lg font-bold">{isActive ? (daysRemaining === 0 ? "Expires today" : `${daysRemaining} ${daysRemaining === 1 ? "day" : "days"}`) : "Membership expired"}</p></div>
        </div>
        {isActive && totalDays !== null && totalDays > 0 && <div className="mt-5"><div className="mb-2 flex justify-between gap-3 text-xs text-white/70"><span>Membership period</span><span>{progress}% elapsed</span></div><div className="h-2 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-label="Membership period elapsed" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-[#b8ee73]" style={{width:`${progress}%`}}/></div></div>}
        {(expirySoon || !isActive) && <div role="status" className="mt-5 rounded-xl border border-[#b8ee73]/40 bg-white/10 p-4 text-sm"><strong>{expirySoon ? (daysRemaining === 0 ? "Your plan expires today." : `Your plan expires in ${daysRemaining} ${daysRemaining === 1 ? "day" : "days"}.`) : "Your membership is not currently active."}</strong> Renew below to keep your access going. This notice does not charge you or renew automatically.</div>}
        <div className="mt-6 grid gap-3 sm:grid-cols-2"><Button asChild size="lg" className="h-12 rounded-xl bg-[#b8ee73] text-[#193b2a] hover:bg-[#d1faa3]"><Link to="/my-qr"><QrCode className="size-5"/> Open My Gym QR Code</Link></Button><Button type="button" size="lg" variant="outline" onClick={() => { setShowPlans(current => !current); setPaymentError(""); }} className="h-12 rounded-xl border-white/50 bg-transparent text-white hover:bg-white hover:text-[#193b2a]"><RefreshCw className="size-4"/>{showPlans ? "Close Plans" : isActive ? "Renew / Extend Membership" : "Renew Membership"}</Button></div>
        {showPlans && <div id="membership-plans" className="mt-6 rounded-2xl bg-white p-4 text-[#20362a] sm:p-6"><p className="text-xs font-extrabold uppercase tracking-[.15em] text-[#37784b]">Choose your plan</p><p className="mt-2 text-sm text-[#627367]">Select a plan. Payment is processed securely by Paystack.</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{membershipPlans.map(plan => <button key={plan.id} type="button" onClick={() => setSelectedPlan(plan.id)} className={`rounded-xl border p-4 text-left transition ${selectedPlan === plan.id ? "border-[#26743d] bg-[#eaf5e7]" : "border-[#dce6d9] hover:border-[#80ad77]"}`} aria-pressed={selectedPlan === plan.id}><span className="flex items-start justify-between gap-2"><span className="font-display text-lg font-bold uppercase">{plan.name}</span><span className="font-bold">{formatNaira(plan.price)}</span></span><span className="mt-1 block text-xs text-[#627367]">{plan.duration}</span>{selectedPlan === plan.id && <span className="mt-2 flex items-center gap-1 text-xs font-bold text-[#26743d]"><CheckCircle2 className="size-4"/> Selected</span>}</button>)}</div><label className="mt-4 block text-sm font-bold">Coupon code (optional)<input className="mt-1.5 w-full rounded-xl border border-[#dce6d9] bg-white px-4 py-3 text-sm outline-none focus:border-[#26743d]" value={coupon} onChange={event => { setCoupon(event.target.value); setPaymentError(""); }} disabled={paymentLoading} autoComplete="off" placeholder="Enter coupon code"/></label>{selectedPlan && <p className="mt-4 flex items-center gap-2 text-sm"><CreditCard className="size-4"/> You will be redirected to Paystack to complete payment.</p>}{paymentError && <p role="alert" className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">{paymentError}</p>}<Button size="lg" className="mt-4 w-full rounded-xl" disabled={!selectedPlan || paymentLoading} onClick={handlePayment}>{paymentLoading ? <><Loader2 className="size-4 animate-spin"/> Preparing Payment...</> : <>Continue to Paystack <CreditCard className="size-4"/></>}</Button></div>}
      </section>

      <section aria-labelledby="quick-actions-title"><div className="mb-3 flex items-center justify-between gap-2"><h2 id="quick-actions-title" className="font-display text-2xl font-bold uppercase">Quick actions</h2><span className="text-xs text-[#627367]">Your essentials</span></div><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link to="/my-qr" className="flex min-h-28 flex-col justify-between rounded-2xl border border-[#dbe6d7] bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-md"><QrCode className="size-7 text-[#287144]"/><span className="flex items-center justify-between gap-2 text-sm font-bold">My QR Code <ArrowRight className="size-4"/></span></Link>
        <button type="button" onClick={openPlans} className="flex min-h-28 flex-col items-start justify-between rounded-2xl border border-[#f5ddd5] bg-[#fff4ee] p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md"><RefreshCw className="size-7 text-[#c54b37]"/><span className="flex w-full items-center justify-between gap-2 text-sm font-bold">Renew Plan <ArrowRight className="size-4"/></span></button>
        <a href={whatsappGroup} target="_blank" rel="noopener noreferrer" className="flex min-h-28 flex-col justify-between rounded-2xl border border-[#d5e9d7] bg-[#eaf6ec] p-4 transition hover:-translate-y-0.5 hover:shadow-md"><MessageCircle className="size-7 text-[#22793d]"/><span className="flex items-center justify-between gap-2 text-sm font-bold">Gym Updates <ExternalLink className="size-4"/></span></a>
        <Link to="/blog" className="flex min-h-28 flex-col justify-between rounded-2xl border border-[#e8dfcd] bg-[#faf2e5] p-4 transition hover:-translate-y-0.5 hover:shadow-md"><BookOpen className="size-7 text-[#94682c]"/><span className="flex items-center justify-between gap-2 text-sm font-bold">Read Blog <ArrowRight className="size-4"/></span></Link>
      </div></section>

      <section aria-labelledby="activity-title" className="rounded-3xl border border-[#dce7d8] bg-white p-5 sm:p-7"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#37784b]">Your progress</p><h2 id="activity-title" className="mt-1 font-display text-2xl font-bold uppercase">My gym activity</h2></div><Activity className="size-7 text-[#287144]"/></div>
        {attendanceLoading ? <p role="status" className="mt-5 flex items-center gap-2 text-sm text-[#627367]"><Loader2 className="size-4 animate-spin"/> Loading your check-ins...</p> : attendanceError ? <p role="status" className="mt-5 text-sm text-[#627367]">{attendanceError}</p> : <><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-[#f1f6ee] p-4"><p className="text-xs text-[#627367]">Visits this month</p><p className="mt-2 text-4xl font-black tabular-nums">{monthlyVisits ?? 0}</p></div><div className="rounded-2xl bg-[#f1f6ee] p-4"><p className="text-xs text-[#627367]">Last check-in</p><p className="mt-3 text-sm font-bold">{lastVisit ? new Intl.DateTimeFormat("en-NG", { timeZone: "Africa/Lagos", day: "numeric", month: "short", year: "numeric" }).format(new Date(lastVisit)) : "No visits recorded"}</p></div></div>{visits.length > 0 && <div className="mt-5"><h3 className="text-xs font-extrabold uppercase tracking-wide text-[#627367]">Recent visits</h3><ul className="mt-2 divide-y divide-[#e6eee3]">{visits.map(visit => <li key={visit.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span>{new Intl.DateTimeFormat("en-NG", { timeZone: "Africa/Lagos", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(visit.checked_in_at))}</span><span className="text-[#627367]">{visit.checked_out_at ? "Checked out" : "No checkout recorded"}</span></li>)}</ul></div>}<p className="mt-3 text-xs leading-5 text-[#627367]">Based on recorded QR check-ins only. Missing scans may mean your actual visits are higher.</p></>}
      </section>

      <section aria-labelledby="journal-title" className="rounded-3xl border border-[#dce7d8] bg-white p-5 sm:p-7"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#37784b]">The fitness journal</p><h2 id="journal-title" className="mt-1 font-display text-3xl font-bold uppercase">Train smarter. Live better.</h2><p className="mt-2 max-w-xl text-sm text-[#627367]">Workout, nutrition and recovery ideas from the Super Plus Fitness blog.</p></div><Button asChild className="rounded-xl"><Link to="/blog">Read Our Blog <ArrowRight className="size-4"/></Link></Button></div>
        {blogLoading ? <p role="status" className="mt-5 text-sm text-[#627367]">Loading the latest articles...</p> : posts.length > 0 ? <div className="mt-5 grid gap-3 sm:grid-cols-2">{posts.map(post => <a key={post.id} href={`/blog/article?slug=${encodeURIComponent(post.slug)}`} className="group overflow-hidden rounded-2xl border border-[#e0e8da] bg-[#fbfcfa] transition hover:shadow-md">{post.featured_image && <img src={post.featured_image} alt="" loading="lazy" className="aspect-[16/8] w-full object-cover"/>}<div className="p-4"><p className="text-xs font-bold uppercase tracking-wider text-[#37784b]">{post.category}</p><h3 className="mt-2 font-display text-xl font-bold uppercase leading-tight">{post.title}</h3>{post.excerpt && <p className="mt-2 line-clamp-2 text-sm text-[#627367]">{post.excerpt}</p>}<span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#287144]">Read article <ArrowRight className="size-4 transition group-hover:translate-x-1"/></span></div></a>)}</div> : <p className="mt-5 text-sm text-[#627367]">Explore our blog for fitness tips and the next published article.</p>}
      </section>

      <section aria-labelledby="community-title" className="rounded-3xl border border-[#d3e6d0] bg-[#edf6eb] p-5 sm:p-7"><div className="flex flex-wrap items-center justify-between gap-4"><div className="flex min-w-0 flex-1 items-start gap-3"><span className="rounded-xl bg-[#22793d] p-3 text-white"><MessageCircle className="size-6"/></span><div><p className="text-xs font-extrabold uppercase tracking-[.15em] text-[#37784b]">Stay connected</p><h2 id="community-title" className="mt-1 font-display text-2xl font-bold uppercase">Join our WhatsApp group</h2><p className="mt-2 text-sm text-[#627367]">Gym announcements, events and updates in one place.</p></div></div><Button asChild className="w-full rounded-xl bg-[#22793d] hover:bg-[#165c2c] sm:w-auto"><a href={whatsappGroup} target="_blank" rel="noopener noreferrer"><MessageCircle className="size-4"/> Join WhatsApp Group</a></Button></div></section>

      <section aria-labelledby="profile-title" className="rounded-3xl border border-[#dce7d8] bg-white p-5 sm:p-7"><div className="flex flex-wrap items-center justify-between gap-3"><h2 id="profile-title" className="flex items-center gap-2 font-display text-2xl font-bold uppercase"><UserRound className="size-5 text-[#287144]"/> Member information</h2><span className="rounded-full bg-[#f1f6ee] px-3 py-1 text-xs font-bold text-[#4f6b53]">Private to your account</span></div><div className="mt-5 grid gap-4 sm:grid-cols-3"><div><p className="text-xs font-bold uppercase text-[#627367]">Full name</p><p className="mt-1 font-semibold">{fullName}</p></div><div><p className="text-xs font-bold uppercase text-[#627367]">Email</p><p className="mt-1 break-all font-semibold">{member.email || "Not available"}</p></div><div><p className="text-xs font-bold uppercase text-[#627367]">Phone</p><p className="mt-1 font-semibold">{member.phone || "Not available"}</p></div></div><div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#f5f8f3] p-4"><p className="max-w-xl text-xs leading-5 text-[#627367]">Something incorrect or missing? Reception can verify and update your membership profile. Direct self-editing is not enabled for member records.</p><a className="inline-flex items-center gap-2 rounded-xl border border-[#b8d0b6] bg-white px-4 py-3 text-sm font-bold text-[#235d38] hover:bg-[#eaf6e7]" href={`https://wa.me/2347054263170?text=${encodeURIComponent(supportMessage)}`} target="_blank" rel="noopener noreferrer"><PencilLine className="size-4"/> Request a profile correction <ExternalLink className="size-4"/></a></div></section>

      <p className="rounded-2xl border border-[#dce7d8] bg-white p-5 text-center text-xs leading-6 text-[#627367]">Need help with your membership? Visit Super Plus Fitness & Spa at No. 105 Apata Street, Shomolu, Lagos, or call <a href="tel:+2347054263170" className="font-bold underline">07054263170</a>.</p>
    </div>
  </main>;
}

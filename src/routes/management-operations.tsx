import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, ArrowRight, CalendarClock, CheckCircle2, ClipboardList, CreditCard, Images, LayoutDashboard, Loader2, ScanLine, ShieldCheck, UserPlus, UserRound, Users, Wallet } from "lucide-react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/management-operations")({ component: ManagementOperations });
type Access = { role: string; management: boolean };
type Action = { label: string; description: string; href: string; icon: typeof Users; eyebrow: string };

function ManagementOperations() {
  const [access, setAccess] = useState<Access | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    async function checkAccess() {
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) throw new Error("Sign in through your reception or admin portal to open management operations.");
        const { data: staff, error: staffError } = await supabase.from("staff_users").select("role,active").eq("auth_user_id", auth.user.id).maybeSingle();
        if (staffError) throw staffError;
        const role = String(staff?.role || "").toLowerCase();
        if (!staff?.active || !["reception", "admin", "owner", "manager"].includes(role)) throw new Error("Only active reception and management accounts can access this workspace.");
        if (!cancelled) setAccess({ role, management: ["admin", "owner", "manager"].includes(role) });
      } catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to verify staff access."); }
      finally { if (!cancelled) setLoading(false); }
    }
    void checkAccess();
    return () => { cancelled = true; };
  }, []);
  const dailyActions: Action[] = [
    { label: "Register a new member online", description: "New members register and pay on the public Join page. Payments are verified automatically with Paystack.", href: "/join", icon: UserPlus, eyebrow: "Online registration" },
    { label: "Register a new walk-in offline", description: "Submit the full plan amount and mandatory registration fee as a pending request. Another manager verifies payment before creating the member or membership.", href: "/management-new-member-intake", icon: UserPlus, eyebrow: "Secure new walk-in" },
    { label: "Submit a membership payment", description: "Find an existing member and submit cash, bank transfer or POS for independent management verification. No premature activation.", href: "/management-payment-desk", icon: CreditCard, eyebrow: "Secure existing-member payment" },
    { label: "Request a Custom Plan", description: "Set custom days and price in the protected desk; a different manager must independently verify payment before activation.", href: "/management-payment-desk", icon: CreditCard, eyebrow: "Flexible membership" },
    { label: "Verify returning member", description: "Submit evidence of prior membership for Admin approval. Registration-fee recognition does not record a payment or activate a plan.", href: "/management-payment-desk", icon: ShieldCheck, eyebrow: "Existing offline members" },
    { label: "Open member profiles", description: "Search a member, inspect individual membership records and recent attendance in the redesigned staff-only view.", href: "/management-profiles", icon: UserRound, eyebrow: "Member details" },
    { label: "Scan a member", description: "Open the working QR scanner for member check-in and check-out.", href: "/reception-checkin", icon: ScanLine, eyebrow: "Gym entrance" },
    { label: "Review member directory", description: "Search all member records, review plan status and open individual member records.", href: "/management-members", icon: Users, eyebrow: "Members" },
    { label: "View attendance", description: "Check visits, today's open check-ins and historical attendance by date.", href: "/management-attendance", icon: Activity, eyebrow: "Attendance" },
    { label: "Birthdays and expiry reminders", description: "Open prepared WhatsApp messages for today's birthdays and members approaching membership expiry.", href: "/management-communications", icon: CalendarClock, eyebrow: "Member communications" },
    { label: "Staff clock-in", description: "Open the existing protected staff QR clock-in and clock-out portal.", href: "/staff-attendance", icon: CalendarClock, eyebrow: "Staff" },
  ];
  const managementActions: Action[] = [
    { label: "Review existing-member payments and claims", description: "Independently approve or reject payment requests and returning-member identity claims. Approvers cannot approve their own submissions.", href: "/management-payment-desk", icon: ShieldCheck, eyebrow: "Financial approvals" },
    { label: "Review new walk-in registration payments", description: "Verify full membership fees plus compulsory registration before atomically creating a member profile, payment and membership.", href: "/management-new-member-intake", icon: ShieldCheck, eyebrow: "New-member approvals" },
    { label: "Gallery Management", description: "Upload gym photos and videos, edit existing gallery items, publish or unpublish them, and permanently delete media.", href: "/staff-gallery", icon: Images, eyebrow: "Website gallery" },
    { label: "Staff directory & QR attendance", description: "Read-only team overview with recorded clock-ins, daily date selector, late-arrival flags and worked hours.", href: "/management-staff", icon: Users, eyebrow: "Management only" },
    { label: "Monthly staff attendance", description: "Review monthly recorded work time and late arrivals with the existing named exceptions.", href: "/management-staff-monthly", icon: CalendarClock, eyebrow: "Management only" },
    { label: "Salary records", description: "New read-only ledger of saved salary payments and statuses, separate from attendance and payroll calculations.", href: "/management-payroll", icon: Wallet, eyebrow: "Management only" },
    { label: "Staff admin & payroll", description: "Open existing administrator tools for staff roles, salaries and attendance oversight.", href: "/staff-admin", icon: ShieldCheck, eyebrow: "Existing system" },
    { label: "Revenue report", description: "Read-only management revenue view with period and payment-source filters, successful transactions and historical baseline safeguards.", href: "/management-revenue", icon: Wallet, eyebrow: "Management only" },
    { label: "Original financial report", description: "Open the existing administrator report to compare revenue figures and review complete reporting details.", href: "/staff-admin#revenue-panel", icon: Wallet, eyebrow: "Existing system" },
  ];
  return <div className="min-h-screen bg-[#f4f6f1] text-[#16221c]"><div className="mx-auto max-w-[1440px] px-4 py-9 sm:px-8 lg:px-12 lg:py-12">
    <div className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-xs font-black uppercase tracking-[.22em] text-[#5f7b68]">Super Plus / Management workspace</p><h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">Your operations, in one place.</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-[#637469]">One clear starting point for Reception 2.0, memberships, attendance and authorised management tools.</p></div><a href="/management-preview" className="inline-flex items-center gap-2 rounded-xl border border-[#ccd8cb] bg-white px-4 py-3 text-sm font-bold hover:border-[#72976f]"><LayoutDashboard size={17}/> Back to overview</a></div>
    {loading && <div className="mt-8 flex items-center gap-3 rounded-2xl border border-[#e1e8dd] bg-white p-7 text-sm text-[#617466]"><Loader2 size={20} className="animate-spin"/> Checking staff access…</div>}
    {!loading && error && <div role="alert" className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">{error} <a href="/portal" className="ml-1 font-bold underline">Choose your portal</a></div>}
    {!loading && access && <><div className="mt-8 flex flex-wrap items-center gap-3 rounded-2xl border border-[#dce9d7] bg-white px-5 py-4 text-sm"><span className="inline-flex items-center gap-2 rounded-full bg-[#edf6e7] px-3 py-1.5 font-bold capitalize text-[#32633c]"><CheckCircle2 size={16}/> {access.role} access</span><span className="text-[#657568]">Reception submits pending requests; only independently verified approvals record revenue and activate memberships.</span></div>
      <section aria-labelledby="daily-heading" className="mt-9"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#65905c]">Reception and operations</p><h2 id="daily-heading" className="mt-2 text-2xl font-black">Daily tools</h2></div><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{dailyActions.map(({ label, description, href, icon: Icon, eyebrow }) => <a key={label} href={href} className="group flex min-h-48 flex-col rounded-[22px] border border-[#e1e8dd] bg-white p-6 shadow-[0_8px_30px_rgba(20,45,28,.035)] transition hover:-translate-y-0.5 hover:border-[#90b487] hover:shadow-lg"><div className="flex items-start justify-between"><span className="rounded-xl bg-[#edf6e7] p-3 text-[#3b6b38]"><Icon size={22}/></span><ArrowRight size={18} className="text-[#77907c] transition-transform group-hover:translate-x-1"/></div><p className="mt-5 text-[10px] font-black uppercase tracking-[.18em] text-[#65905c]">{eyebrow}</p><h3 className="mt-1 text-lg font-black">{label}</h3><p className="mt-2 text-sm leading-6 text-[#66766a]">{description}</p></a>)}</div></section>
      {access.management && <section aria-labelledby="admin-heading" className="mt-11"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#65905c]">Authorised management</p><h2 id="admin-heading" className="mt-2 text-2xl font-black">Staff and financial tools</h2></div><div className="mt-5 grid gap-4 md:grid-cols-2">{managementActions.map(({ label, description, href, icon: Icon, eyebrow }) => <a key={label} href={href} className="group flex items-start gap-4 rounded-[22px] bg-[#1a3226] p-6 text-white transition hover:bg-[#254332]"><span className="rounded-xl bg-[#b8ee73] p-3 text-[#193327]"><Icon size={21}/></span><span className="min-w-0 flex-1"><span className="text-[10px] font-bold uppercase tracking-[.16em] text-[#b8ee73]">{eyebrow}</span><span className="mt-1 block text-lg font-black">{label}</span><span className="mt-2 block text-sm leading-6 text-[#c2d0c4]">{description}</span></span><ArrowRight size={17} className="shrink-0 text-[#b8ee73] transition-transform group-hover:translate-x-1"/></a>)}</div></section>}
      <div className="mt-11 rounded-2xl border border-[#dbe5d8] bg-[#eef5e9] p-5 text-sm leading-6 text-[#546c57]"><div className="flex items-start gap-3"><ClipboardList size={20} className="mt-0.5 shrink-0 text-[#32633c]"/><p><strong>Reception 2.0:</strong> Register new walk-ins only through the protected intake and existing members through the Payment & Member Desk. All offline collections stay pending until independently verified. Online Join payments remain Paystack verified.</p></div></div>
    </>}
  </div></div>;
}

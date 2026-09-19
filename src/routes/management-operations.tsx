import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, ArrowRight, CalendarClock, CheckCircle2, CreditCard, LayoutDashboard, Loader2, ScanLine, ShieldCheck, UserPlus, UserRound, Users, Wallet } from "lucide-react";
import { supabase } from "@/lib/supabase";
export const Route = createFileRoute("/management-operations")({ component: ManagementOperations });
type Access = { role: string; management: boolean };
type Action = { label: string; description: string; href: string; icon: typeof Users; eyebrow: string };
function ManagementOperations() {
  const [access,setAccess]=useState<Access|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  useEffect(()=>{let cancelled=false;(async()=>{try{const {data:auth,error:authError}=await supabase.auth.getUser();if(authError||!auth.user)throw new Error("Sign in through your reception or admin portal first.");const {data:staff,error:staffError}=await supabase.from("staff_users").select("role,active").eq("auth_user_id",auth.user.id).maybeSingle();if(staffError)throw staffError;const role=String(staff?.role||"").toLowerCase();if(!staff?.active||!["reception","admin","owner","manager"].includes(role))throw new Error("Reception or management access is required.");if(!cancelled)setAccess({role,management:["admin","owner","manager"].includes(role)});}catch(cause){if(!cancelled)setError(cause instanceof Error?cause.message:"Unable to verify access.");}finally{if(!cancelled)setLoading(false);}})();return()=>{cancelled=true;};},[]);
  const dailyActions:Action[]=[
    {label:"Register a new member",description:"Create a member and first plan after confirming a real payment.",href:"/management-standard-plan",icon:UserPlus,eyebrow:"New registration"},
    {label:"Add a standard plan",description:"Find an existing member and add a separate plan without overwriting their membership.",href:"/management-standard-plan",icon:CreditCard,eyebrow:"Existing members"},
    {label:"Create a Custom Plan",description:"Choose duration, price and optional registration fee for an existing member.",href:"/management-custom-plan",icon:CreditCard,eyebrow:"Flexible membership"},
    {label:"Open member profiles",description:"Review member details, memberships, individual payments and attendance.",href:"/management-profiles",icon:UserRound,eyebrow:"Member details"},
    {label:"Scan a member",description:"Member check-in and checkout using the QR scanner.",href:"/reception-checkin",icon:ScanLine,eyebrow:"Gym entrance"},
    {label:"Member directory",description:"Find registered members and review membership dates.",href:"/management-members",icon:Users,eyebrow:"Members"},
    {label:"Attendance history",description:"Review member visits and open check-ins by date.",href:"/management-attendance",icon:Activity,eyebrow:"Attendance"},
    {label:"Birthdays and expiry reminders",description:"Open WhatsApp messages with staff-confirmed sent status.",href:"/management-communications",icon:CalendarClock,eyebrow:"Communications"},
  ];
  const managementActions:Action[]=[
    {label:"Staff directory & QR attendance",description:"Manage employee records and check-ins.",href:"/management-staff",icon:Users,eyebrow:"Admin only"},
    {label:"Monthly staff attendance",description:"Monthly attendance and lateness overview.",href:"/management-staff-monthly",icon:CalendarClock,eyebrow:"Admin only"},
    {label:"Salary records",description:"View recorded salary payments and statuses.",href:"/management-payroll",icon:Wallet,eyebrow:"Admin only"},
    {label:"Administrator dashboard",description:"Private administrator tools for salary and staff oversight.",href:"/staff-admin",icon:ShieldCheck,eyebrow:"Admin only"},
    {label:"Revenue report",description:"View authorised membership revenue and transaction history.",href:"/management-revenue",icon:Wallet,eyebrow:"Admin only"},
  ];
  return <main className="min-h-screen min-w-0 bg-[#f4f6f1] px-3 py-6 text-[#16221c] sm:px-7 sm:py-9 lg:px-12"><div className="mx-auto w-full min-w-0 max-w-7xl">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><a href="/reception-workspace" className="text-sm font-bold text-[#356942]">← Reception 2.0</a><h1 className="mt-5 break-words text-3xl font-black sm:text-4xl lg:text-5xl">Operations</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#637469]">Reception 2.0 tools and separate administrator-only functions, organised for any screen.</p></div><a href="/reception-workspace" className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm font-bold sm:w-auto"><LayoutDashboard size={17}/> Reception workspace</a></header>
    {loading&&<p role="status" className="mt-8 flex items-center gap-3 rounded-2xl bg-white p-5 text-sm"><Loader2 size={20} className="animate-spin"/> Checking access…</p>}
    {!loading&&error&&<p role="alert" className="mt-8 break-words rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error} <a href="/portal" className="font-bold underline">Choose portal</a></p>}
    {!loading&&access&&<><p className="mt-7 flex flex-wrap items-center gap-2 rounded-2xl border bg-white p-4 text-sm"><CheckCircle2 size={17} className="text-[#32633c]"/><strong className="capitalize">{access.role} access</strong><span className="text-[#657568]">Payment forms require confirmation of funds actually received.</span></p>
      <section className="mt-8"><h2 className="text-2xl font-black">Front desk tools</h2><div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">{dailyActions.map(({label,description,href,icon:Icon,eyebrow})=><a key={label} href={href} className="group flex min-w-0 flex-col rounded-2xl border border-[#e1e8dd] bg-white p-5 transition hover:border-[#90b487] hover:shadow-md"><span className="flex justify-between"><Icon size={23} className="text-[#3b6b38]"/><ArrowRight size={18}/></span><span className="mt-5 break-words text-[10px] font-black uppercase tracking-wider text-[#65905c]">{eyebrow}</span><strong className="mt-1 break-words text-lg">{label}</strong><span className="mt-2 break-words text-sm leading-6 text-[#66766a]">{description}</span></a>)}</div></section>
      {access.management&&<section className="mt-10"><h2 className="text-2xl font-black">Admin tools</h2><div className="mt-4 grid min-w-0 gap-3 md:grid-cols-2">{managementActions.map(({label,description,href,icon:Icon,eyebrow})=><a key={label} href={href} className="group flex min-w-0 items-start gap-3 rounded-2xl bg-[#1a3226] p-5 text-white transition hover:bg-[#254332]"><span className="shrink-0 rounded-xl bg-[#b8ee73] p-3 text-[#193327]"><Icon size={20}/></span><span className="min-w-0 flex-1"><span className="block text-[10px] font-bold uppercase text-[#b8ee73]">{eyebrow}</span><strong className="mt-1 block break-words text-lg">{label}</strong><span className="mt-2 block break-words text-sm leading-6 text-[#c2d0c4]">{description}</span></span><ArrowRight size={16} className="shrink-0"/></a>)}</div></section>}
    </>}
  </div></main>;
}

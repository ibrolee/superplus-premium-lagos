import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, BriefcaseBusiness, ShieldCheck, UserRoundCheck } from "lucide-react";
export const Route = createFileRoute("/portal")({ component: PortalDirectory });
const entries = [
  { name: "Staff portal", detail: "Employee login, staff registration and individual employee information.", to: "/portal/staff", icon: BriefcaseBusiness },
  { name: "Reception portal", detail: "Dedicated front desk login and Reception 2.0 workspace.", to: "/portal/reception", icon: UserRoundCheck },
  { name: "Admin portal", detail: "Private administrator login, management and financial tools.", to: "/portal/admin", icon: ShieldCheck },
] as const;
function PortalDirectory() {
  return <main className="min-h-[72vh] bg-[#f4f6f1] px-4 py-12 text-[#183125] sm:px-7 sm:py-20"><div className="mx-auto max-w-5xl"><p className="text-xs font-black uppercase tracking-[.22em] text-[#4a7a4a]">Super Plus Fitness & Spa</p><h1 className="mt-3 text-4xl font-black sm:text-6xl">Choose your portal</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-[#607366] sm:text-base">Three distinct sign-in destinations. Each account can open only the workspace assigned to its role.</p><div className="mt-9 grid gap-4 md:grid-cols-3">{entries.map(({name,detail,to,icon:Icon}) => <Link key={to} to={to} className="group flex min-w-0 flex-col rounded-3xl border border-[#d9e7d5] bg-white p-6 shadow-sm transition hover:border-[#6d9b6b] hover:shadow-md"><span className="flex size-12 items-center justify-center rounded-2xl bg-[#193b2a] text-[#b8ee73]"><Icon size={24}/></span><h2 className="mt-6 text-xl font-black">{name}</h2><p className="mt-2 flex-1 text-sm leading-6 text-[#607366]">{detail}</p><span className="mt-7 inline-flex items-center gap-2 font-bold text-[#27643a]">Open portal <ArrowRight size={18} className="transition group-hover:translate-x-1"/></span></Link>)}</div></div></main>;
}

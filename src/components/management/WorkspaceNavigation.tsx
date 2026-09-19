import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Activity, AlertTriangle, Cake, CalendarDays, ClipboardList, CreditCard, Download, LayoutDashboard, ScanLine, Users, UserPlus, UserRound, Wallet } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ActionSearch } from "./ActionSearch";

const receptionPaths = new Set(["/reception-workspace", "/reception-checkin", "/management-preview", "/management-members", "/management-attendance", "/management-operations", "/management-custom-plan", "/management-standard-plan", "/management-profiles", "/management-communications", "/management-revenue", "/management-staff", "/management-staff-monthly", "/management-staff-review", "/management-payroll", "/management-attendance-export", "/management-payroll-export"]);
const staffPaths = new Set(["/staff", "/staff-attendance", "/staff-admin", "/staff-missed-scans"]);
export function WorkspaceNavigation() {
  const pathname = useRouterState({ select: state => state.location.pathname });
  const inWorkspace = receptionPaths.has(pathname) || staffPaths.has(pathname);
  const [role, setRole] = useState("");
  useEffect(() => { if (!inWorkspace) return; let cancelled = false; setRole(""); (async () => { const { data: auth } = await supabase.auth.getUser(); if (!auth.user) return; const { data, error } = await supabase.from("staff_users").select("role,active").eq("auth_user_id", auth.user.id).maybeSingle(); if (!cancelled && !error && data?.active) setRole(String(data.role || "").toLowerCase()); })(); return () => { cancelled = true; }; }, [inWorkspace, pathname]);
  if (!inWorkspace) return null;
  const management = ["admin", "owner", "manager"].includes(role);
  const reception = management || role === "reception";
  const admin = role === "admin";
  const staff = !reception && staffPaths.has(pathname);
  const pages = [
    { label: "Reception 2.0", href: "/reception-workspace", icon: LayoutDashboard },
    { label: "Members", href: "/management-members", icon: Users },
    { label: "Profiles", href: "/management-profiles", icon: UserRound },
    { label: "Attendance", href: "/management-attendance", icon: Activity },
    { label: "Operations", href: "/management-operations", icon: ClipboardList },
    { label: "Register / renew", href: "/management-standard-plan", icon: UserPlus },
    { label: "Custom Plan", href: "/management-custom-plan", icon: CreditCard },
    { label: "Birthdays & reminders", href: "/management-communications", icon: Cake },
    { label: "Member QR scanner", href: "/reception-checkin", icon: ScanLine },
  ];
  if (management) pages.push(...[
    { label: "Staff", href: "/management-staff", icon: Users },
    { label: "Monthly staff", href: "/management-staff-monthly", icon: CalendarDays },
    { label: "QR review", href: "/management-staff-review", icon: AlertTriangle },
    { label: "Export attendance", href: "/management-attendance-export", icon: Download },
    { label: "Salary records", href: "/management-payroll", icon: Wallet },
    { label: "Export salaries", href: "/management-payroll-export", icon: Download },
    { label: "Revenue", href: "/management-revenue", icon: Wallet },
    { label: "Admin", href: "/staff-admin", icon: LayoutDashboard },
  ]);
  if (admin) pages.push({ label: "Missed-scan reviews", href: "/staff-missed-scans", icon: ClipboardList });
  if (staff) return <nav aria-label="Staff tools" className="border-b border-[#365139] bg-[#173326] px-4 py-3 text-white"><div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3"><span className="text-xs font-black uppercase tracking-wider text-[#b8ee73]">Staff tools</span><div className="min-w-0 flex-1 sm:max-w-xs"><ActionSearch role={role || "staff"}/></div><div className="flex w-full flex-wrap gap-2 text-xs font-bold sm:w-auto"><a href="/staff" className="rounded-lg border border-white/25 px-3 py-2">My profile</a><a href="/staff-attendance" className="rounded-lg border border-white/25 px-3 py-2">Clock in / out</a><a href="/staff-missed-scans" className="rounded-lg border border-white/25 px-3 py-2">Missed scans</a></div></div></nav>;
  if (!reception) return null;
  return <nav aria-label="Reception and management pages" className="relative z-30 border-b border-[#263d31] bg-[#152820] px-3 py-3 text-white sm:px-6"><div className="mx-auto flex max-w-[1680px] flex-col gap-3 lg:flex-row lg:items-center"><div className="flex min-w-0 flex-wrap items-center justify-between gap-2"><span className="text-[10px] font-black uppercase tracking-[.16em] text-[#b8ee73]">{management ? "Management" : "Reception 2.0"}</span><a href="/portal" className="rounded-lg border border-white/25 px-3 py-2 text-xs font-bold">Portal</a></div><div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:flex-wrap">{pages.map(({label,href,icon:Icon}) => <a key={href} href={href} aria-current={pathname === href ? "page" : undefined} className={`flex min-w-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${pathname === href ? "bg-[#b8ee73] text-[#183125]" : "bg-white/5 text-[#d5e3d8] hover:bg-white/15"}`}><Icon size={15} className="shrink-0"/><span className="min-w-0 break-words">{label}</span></a>)}</div><div className="w-full min-w-0 lg:w-64"><ActionSearch role={role}/></div></div></nav>;
}

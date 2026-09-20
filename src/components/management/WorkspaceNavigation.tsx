import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Activity, AlertTriangle, ArrowUpRight, Cake, CalendarDays, ClipboardList, CreditCard, Download, LayoutDashboard, ScanLine, Users, UserPlus, UserRound, Wallet } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ActionSearch } from "./ActionSearch";

/** Shared management navigation, including role-aware search on staff and reception pages. */
export function WorkspaceNavigation() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const onReception = pathname === "/reception-workspace";
  const onStaff = ["/staff", "/staff-attendance", "/staff-admin", "/reception-checkin", "/staff-missed-scans"].includes(pathname);
  const inWorkspace = onReception || onStaff || ["/management-preview", "/management-members", "/management-attendance", "/management-operations", "/management-custom-plan", "/management-standard-plan", "/management-payment-desk", "/management-profiles", "/management-member-cards", "/management-communications", "/management-revenue", "/management-staff", "/management-staff-monthly", "/management-staff-review", "/management-payroll", "/management-attendance-export", "/management-payroll-export"].includes(pathname);
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setRole(null);
    if (!inWorkspace) return () => { cancelled = true; };
    async function loadRole() {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) return;
      const { data: staff, error: staffError } = await supabase.from("staff_users").select("role,active").eq("auth_user_id", auth.user.id).maybeSingle();
      if (staffError || !staff?.active || cancelled) return;
      setRole(String(staff.role || "").toLowerCase());
    }
    void loadRole();
    return () => { cancelled = true; };
  }, [inWorkspace]);
  if (!inWorkspace) return null;
  const management = ["admin", "owner", "manager"].includes(role || "");
  const admin = role === "admin";
  const reception = management || role === "reception";
  if (onReception || onStaff) return <nav aria-label="Staff and reception action navigation" className="relative z-30 border-b border-[#365139] bg-[#173326] px-4 py-3 text-white"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 flex-1 flex-wrap items-center gap-3"><span className="text-xs font-black uppercase tracking-wider text-[#b8ee73]">Staff tools</span>{role && <ActionSearch role={role}/>}</div><div className="flex flex-wrap gap-2 text-xs font-bold">{reception && <a href="/reception-workspace" aria-current={pathname === "/reception-workspace" ? "page" : undefined} className={`rounded-lg border px-3 py-2 ${pathname === "/reception-workspace" ? "border-[#b8ee73] bg-[#b8ee73] text-[#173326]" : "border-white/25 hover:bg-white/10"}`}>Reception 2.0</a>}{reception && <a href="/management-payment-desk" className="rounded-lg border border-[#b8ee73] px-3 py-2 text-[#b8ee73] hover:bg-white/10">Payment approvals</a>}<a href="/staff-attendance" className="rounded-lg border border-white/25 px-3 py-2 hover:bg-white/10">Clock in / out</a><a href="/staff-missed-scans" aria-current={pathname === "/staff-missed-scans" ? "page" : undefined} className={`rounded-lg border px-3 py-2 ${pathname === "/staff-missed-scans" ? "border-[#b8ee73] bg-[#b8ee73] text-[#173326]" : "border-white/25 hover:bg-white/10"}`}>Missed scan / requests</a>{admin && <a href="/management-staff-review" className="rounded-lg border border-white/25 px-3 py-2 hover:bg-white/10">QR review</a>}{admin && <a href="/management-member-cards" className="inline-flex items-center gap-1 rounded-lg border border-[#b8ee73] px-3 py-2 text-[#b8ee73] hover:bg-white/10"><CreditCard size={14}/> ID cards</a>}{reception && <a href="/management-operations" className="rounded-lg border border-white/25 px-3 py-2 hover:bg-white/10">Operations</a>}{reception && <a href="/management-communications" className="inline-flex items-center gap-1 rounded-lg bg-[#b8ee73] px-3 py-2 text-[#173326] hover:bg-[#c9f69c]"><Cake size={14}/> Reminders <ArrowUpRight size={13}/></a>}</div></div></nav>;
  if (!reception || !role) return null;
  const pages = [
    { label: "Overview", href: "/management-preview", icon: LayoutDashboard },
    { label: "Reception 2.0", href: "/reception-workspace", icon: UserPlus },
    { label: "Members", href: "/management-members", icon: Users },
    { label: "Profiles", href: "/management-profiles", icon: UserRound },
    { label: "Attendance", href: "/management-attendance", icon: Activity },
    { label: "Operations", href: "/management-operations", icon: ClipboardList },
    { label: "Payment approvals", href: "/management-payment-desk", icon: CreditCard },
    { label: "Birthdays & reminders", href: "/management-communications", icon: Cake },
  ];
  if (admin) pages.push({ label: "Membership ID Cards", href: "/management-member-cards", icon: CreditCard });
  if (management) {
    pages.push({ label: "Staff", href: "/management-staff", icon: Users });
    pages.push({ label: "Monthly staff", href: "/management-staff-monthly", icon: CalendarDays });
    pages.push({ label: "QR review", href: "/management-staff-review", icon: AlertTriangle });
    if (admin) pages.push({ label: "Missed-scan requests", href: "/staff-missed-scans", icon: ClipboardList });
    pages.push({ label: "Export attendance", href: "/management-attendance-export", icon: Download });
    pages.push({ label: "Salary records", href: "/management-payroll", icon: Wallet });
    pages.push({ label: "Export salaries", href: "/management-payroll-export", icon: Download });
    pages.push({ label: "Revenue", href: "/management-revenue", icon: Wallet });
  }
  return <nav aria-label="Super Plus management workspace" className="relative z-30 border-b border-[#263d31] bg-[#152820] px-3 py-3 text-white sm:px-6"><div className="mx-auto flex max-w-[1680px] flex-wrap items-center gap-x-5 gap-y-3"><span className="hidden shrink-0 text-[10px] font-black uppercase tracking-[.19em] text-[#b8ee73] sm:block">Management workspace</span><div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1" role="group" aria-label="Workspace pages">{pages.map(({ label, href, icon: Icon }) => <a key={href} href={href} aria-current={pathname === href ? "page" : undefined} className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${pathname === href ? "bg-[#b8ee73] text-[#183125]" : "bg-white/5 text-[#d5e3d8] hover:bg-white/15"}`}><Icon size={15}/>{label}</a>)}</div><div className="flex shrink-0 items-center gap-2 overflow-x-auto text-xs"><a href="/reception-checkin" className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-2 font-semibold hover:bg-white/10"><ScanLine size={15}/> Scanner <ArrowUpRight size={13}/></a>{management && <a href="/staff-admin" className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-2 font-semibold hover:bg-white/10"><Wallet size={15}/> Admin <ArrowUpRight size={13}/></a>}</div><div className="w-full sm:ml-auto sm:w-80"><ActionSearch role={role}/></div></div></nav>;
}
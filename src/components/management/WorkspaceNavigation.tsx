import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Activity, ArrowUpRight, Cake, ClipboardList, CreditCard, LayoutDashboard, ScanLine, Users, UserPlus, UserRound, Wallet } from "lucide-react";
import { supabase } from "@/lib/supabase";

/** Shared management navigation and a prominent shortcut on the original reception dashboard. */
export function WorkspaceNavigation() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const onReception = pathname === "/reception-dashboard";
  const inWorkspace = onReception || ["/management-preview", "/management-members", "/management-attendance", "/management-operations", "/management-custom-plan", "/management-standard-plan", "/management-profiles", "/management-communications", "/management-revenue", "/management-staff"].includes(pathname);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRole(null);
    if (!inWorkspace) return () => { cancelled = true; };
    async function loadRole() {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) return;
      const { data: staff, error: staffError } = await supabase.from("staff_users")
        .select("role,active").eq("auth_user_id", auth.user.id).maybeSingle();
      if (staffError || !staff?.active || cancelled) return;
      const nextRole = String(staff.role || "").toLowerCase();
      if (["reception", "admin", "owner", "manager"].includes(nextRole)) setRole(nextRole);
    }
    void loadRole();
    return () => { cancelled = true; };
  }, [inWorkspace]);

  if (!inWorkspace || !role) return null;
  if (onReception) return (
    <nav aria-label="Reception communications shortcut" className="border-b border-[#365139] bg-[#173326] px-4 py-3 text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3"><Cake size={22} className="shrink-0 text-[#b8ee73]"/><div><p className="text-sm font-black">Birthday wishes & expiry reminders</p><p className="text-xs text-[#c4d6c4]">See today's birthdays and open personalised WhatsApp messages for members.</p></div></div>
        <a href="/management-communications" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#b8ee73] px-4 py-3 text-sm font-black text-[#173326] hover:bg-[#c9f69c]">Open WhatsApp reminders <ArrowUpRight size={16}/></a>
      </div>
    </nav>
  );
  const management = ["admin", "owner", "manager"].includes(role);
  const pages = [
    { label: "Overview", href: "/management-preview", icon: LayoutDashboard },
    { label: "Members", href: "/management-members", icon: Users },
    { label: "Profiles", href: "/management-profiles", icon: UserRound },
    { label: "Attendance", href: "/management-attendance", icon: Activity },
    { label: "Operations", href: "/management-operations", icon: ClipboardList },
    { label: "Register / renew", href: "/management-standard-plan", icon: UserPlus },
    { label: "Custom Plan", href: "/management-custom-plan", icon: CreditCard },
    { label: "Birthdays & reminders", href: "/management-communications", icon: Cake },
  ];
  if (management) {
    pages.push({ label: "Staff", href: "/management-staff", icon: Users });
    pages.push({ label: "Revenue", href: "/management-revenue", icon: Wallet });
  }
  return (
    <nav aria-label="Super Plus management workspace" className="relative z-20 border-b border-[#263d31] bg-[#152820] px-3 py-3 text-white sm:px-6">
      <div className="mx-auto flex max-w-[1680px] flex-wrap items-center gap-x-5 gap-y-3">
        <span className="hidden shrink-0 text-[10px] font-black uppercase tracking-[.19em] text-[#b8ee73] sm:block">Management workspace</span>
        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1" role="group" aria-label="Workspace pages">
          {pages.map(({ label, href, icon: Icon }) => <a key={href} href={href} aria-current={pathname === href ? "page" : undefined}
            className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${pathname === href ? "bg-[#b8ee73] text-[#183125]" : "bg-white/5 text-[#d5e3d8] hover:bg-white/15"}`}><Icon size={15}/>{label}</a>)}
        </div>
        <div className="flex shrink-0 items-center gap-2 overflow-x-auto text-xs">
          <a href="/reception-dashboard" className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-2 font-semibold hover:bg-white/10"><UserPlus size={15}/> Original reception <ArrowUpRight size={13}/></a>
          <a href="/reception-checkin" className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-2 font-semibold hover:bg-white/10"><ScanLine size={15}/> Scanner <ArrowUpRight size={13}/></a>
          {management && <a href="/staff-admin" className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-2 font-semibold hover:bg-white/10"><Wallet size={15}/> Admin <ArrowUpRight size={13}/></a>}
        </div>
      </div>
    </nav>
  );
}

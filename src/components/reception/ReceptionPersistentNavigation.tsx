import { useEffect, useMemo, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CreditCard,
  Home,
  LayoutDashboard,
  Menu,
  Search,
  ScanLine,
  ShieldCheck,
  UserPlus,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import "./reception-persistent-navigation.css";

type Tool = { label: string; href: string; icon: LucideIcon; keywords: string };
type Group = { name: string; icon: LucideIcon; tools: Tool[] };
type Member = { id: string; full_name: string | null; phone: string | null; email: string | null };
/** Direct front-desk tasks only. No registration, renewal, payment or identity-approval queue. */
export const receptionGroups: Group[] = [
  {
    name: "Dashboard",
    icon: LayoutDashboard,
    tools: [
      {
        label: "Website homepage",
        href: "/",
        icon: Home,
        keywords: "public website home homepage visitor",
      },
      {
        label: "Reception overview",
        href: "/reception-workspace",
        icon: LayoutDashboard,
        keywords: "home daily summary",
      },
    ],
  },
  {
    name: "Members & payments",
    icon: Users,
    tools: [
      {
        label: "Register or renew",
        href: "/reception-register",
        icon: UserPlus,
        keywords: "new existing member registration renewal cash pos transfer coupon",
      },
      {
        label: "Member directory",
        href: "/management-members",
        icon: Search,
        keywords: "find search member",
      },
      {
        label: "Member profiles",
        href: "/management-profiles",
        icon: UserRound,
        keywords: "profile plan history",
      },
      {
        label: "Online member payment",
        href: "/login",
        icon: CreditCard,
        keywords: "self service pay online renew login",
      },
    ],
  },
  {
    name: "Check-in & reminders",
    icon: Activity,
    tools: [
      {
        label: "QR scanner",
        href: "/reception-checkin",
        icon: ScanLine,
        keywords: "attendance check in out",
      },
      {
        label: "Attendance history",
        href: "/management-attendance",
        icon: Activity,
        keywords: "visits",
      },
      {
        label: "Birthdays & expiry reminders",
        href: "/management-communications",
        icon: CalendarClock,
        keywords: "messages follow up",
      },
    ],
  },
  {
    name: "My staff tools",
    icon: UserRound,
    tools: [
      { label: "My staff profile", href: "/staff", icon: UserRound, keywords: "account" },
      {
        label: "Clock in / out",
        href: "/staff-attendance",
        icon: CalendarClock,
        keywords: "shift",
      },
      {
        label: "Missed scan",
        href: "/staff-missed-scans",
        icon: ClipboardList,
        keywords: "attendance correction",
      },
    ],
  },
];
const shared = new Set([
  "/management-preview",
  "/management-operations",
  "/management-members",
  "/management-profiles",
  "/management-standard-plan",
  "/management-custom-plan",
  "/management-new-member-intake",
  "/management-payment-desk",
  "/management-attendance",
  "/management-communications",
  "/staff-attendance",
  "/staff-missed-scans",
]);
const managementFrontDesk = new Set([
  "/reception-workspace",
  "/reception-register",
  "/reception-checkin",
  "/management-preview",
  "/management-operations",
  "/management-standard-plan",
  "/management-custom-plan",
  "/management-communications",
]);
const managementRoles = new Set(["admin", "owner", "manager"]);
const cleanSearch = (value: string) =>
  value
    .trim()
    .replace(/[%_,()\\]/g, " ")
    .trim();
const eligiblePath = (path: string) =>
  path === "/reception-workspace" ||
  path === "/reception-register" ||
  path === "/reception-checkin" ||
  path.startsWith("/reception-member/") ||
  shared.has(path);
/** Navigation visibility is not authorization; every destination retains its staff guard and Supabase RLS. */
export function ReceptionPersistentNavigation() {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const eligible = eligiblePath(path);
  const [role, setRole] = useState<string | null>(null);
  const [authRevision, setAuthRevision] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    Dashboard: true,
    "Members & payments": true,
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED"].includes(event))
        setAuthRevision((n) => n + 1);
    });
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    let cancelled = false;
    setRole(null);
    if (!eligible)
      return () => {
        cancelled = true;
      };
    void (async () => {
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) return;
        const { data: staff, error } = await supabase
          .from("staff_users")
          .select("role,active")
          .eq("auth_user_id", auth.user.id)
          .maybeSingle();
        if (error || !staff?.active || cancelled) return;
        const resolved = String(staff.role || "").toLowerCase();
        if (resolved === "reception" || managementRoles.has(resolved)) setRole(resolved);
      } catch {
        /* Destination handles authentication. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eligible, authRevision]);
  const visible = eligible && !!role && (role === "reception" || managementFrontDesk.has(path));
  useEffect(() => {
    if (!visible) return;
    document.body.classList.add("spf-reception-nav-active");
    return () => document.body.classList.remove("spf-reception-nav-active");
  }, [visible]);
  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
  }, [path]);
  const toolResults = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term
      ? receptionGroups
          .flatMap((group) =>
            group.tools.filter((tool) =>
              `${tool.label} ${tool.keywords} ${group.name}`.toLowerCase().includes(term),
            ),
          )
          .slice(0, 10)
      : [];
  }, [query]);
  useEffect(() => {
    const term = cleanSearch(query);
    if (!visible || !searchOpen || term.length < 2) {
      setMembers([]);
      setSearchError("");
      setSearching(false);
      return;
    }
    let cancelled = false;
    setMembers([]);
    setSearchError("");
    setSearching(true);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const { data, error } = await supabase
            .from("members")
            .select("id,full_name,phone,email")
            .or(`full_name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`)
            .order("full_name", { ascending: true })
            .limit(8);
          if (error) throw error;
          if (!cancelled) setMembers((data || []) as Member[]);
        } catch (cause) {
          if (!cancelled) {
            setMembers([]);
            setSearchError(cause instanceof Error ? cause.message : "Member search unavailable.");
          }
        } finally {
          if (!cancelled) setSearching(false);
        }
      })();
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, searchOpen, visible]);
  if (!visible) return null;
  const active = path.startsWith("/reception-member/") ? "/management-members" : path;
  const close = () => {
    setMobileOpen(false);
    setSearchOpen(false);
  };
  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close reception menu"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-[60] bg-black/50 lg:hidden"
        />
      )}
      <aside
        aria-label="Persistent reception sidebar"
        className={`fixed inset-y-0 left-0 z-[70] flex w-[min(85vw,300px)] flex-col overflow-y-auto bg-[#152820] p-5 text-white shadow-xl transition-transform lg:w-[270px] lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <button
          type="button"
          aria-label="Close reception menu"
          onClick={() => setMobileOpen(false)}
          className="absolute right-4 top-5 rounded-lg p-2 hover:bg-white/10 lg:hidden"
        >
          <X size={20} />
        </button>
        <a
          href="/reception-workspace"
          onClick={close}
          className="flex items-center gap-3 rounded-xl px-2 py-2"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#b8ee73] text-lg font-black text-[#193327]">
            S+
          </span>
          <span>
            <strong className="block text-sm tracking-wide">SUPER PLUS</strong>
            <span className="text-[11px] text-[#b9c9be]">Reception workspace</span>
          </span>
        </a>
        <nav
          aria-label="Reception navigation"
          className="mt-7 min-h-0 flex-1 space-y-2 overflow-y-auto pb-5"
        >
          {receptionGroups.map((group) => {
            const Icon = group.icon;
            const open = expanded[group.name] ?? group.tools.some((tool) => tool.href === active);
            return (
              <div key={group.name} className="rounded-xl border border-white/10">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setExpanded((previous) => ({ ...previous, [group.name]: !open }))}
                  className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-3 text-left text-sm font-bold hover:bg-white/10"
                >
                  <span className="flex items-center gap-3">
                    <Icon size={17} className="text-[#b8ee73]" />
                    {group.name}
                  </span>
                  <ChevronDown size={15} className={open ? "rotate-180" : ""} />
                </button>
                {open && (
                  <div className="space-y-0.5 px-2 pb-2">
                    {group.tools.map((tool) => {
                      const ToolIcon = tool.icon;
                      const current = tool.href === active;
                      return (
                        <a
                          key={`${tool.href}-${tool.label}`}
                          href={tool.href}
                          onClick={close}
                          aria-current={current ? "page" : undefined}
                          className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold ${current ? "bg-[#b8ee73] text-[#193327]" : "text-[#d5e3d8] hover:bg-white/10"}`}
                        >
                          <ToolIcon size={15} className="shrink-0" />
                          {tool.label}
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        {role && managementRoles.has(role) && (
          <a
            href="/admin-workspace"
            onClick={close}
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[#b8ee73]/55 px-4 py-3 text-xs font-bold text-[#b8ee73] hover:bg-white/10"
          >
            <ShieldCheck size={16} /> Switch to Admin Dashboard <ArrowRight size={14} />
          </a>
        )}
        <a
          href="/reception-workspace"
          onClick={close}
          className="mt-2 flex items-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-xs font-bold text-[#d5e3d8] hover:bg-white/10"
        >
          <LayoutDashboard size={16} /> Back to reception
        </a>
      </aside>
      <header className="sticky top-0 z-40 border-b border-[#e1e8dd] bg-[#f4f6f1]/95 px-4 py-3 backdrop-blur sm:px-7 lg:px-10">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3">
          <button
            type="button"
            aria-label="Open reception menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
            className="rounded-xl border border-[#d8e2d5] bg-white p-2.5 lg:hidden"
          >
            <Menu size={21} />
          </button>
          <a
            href="/reception-workspace"
            className="hidden min-w-0 flex-1 text-xs font-bold text-[#526b57] sm:block"
          >
            SUPER PLUS / RECEPTION
          </a>
          <button
            type="button"
            aria-expanded={searchOpen}
            onClick={() => setSearchOpen((open) => !open)}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#d8e2d5] bg-white px-3 py-2.5 text-left text-sm text-[#647468] sm:max-w-[450px]"
          >
            <Search size={17} />
            <span className="truncate">Search tools or members</span>
          </button>
          <span className="hidden rounded-full bg-[#edf6e7] px-3 py-2 text-xs font-bold capitalize text-[#356942] sm:block">
            {role}
          </span>
        </div>
        {searchOpen && (
          <div className="relative mx-auto mt-3 max-w-[1400px]">
            <div className="rounded-2xl border border-[#d8e2d5] bg-white p-3 shadow-lg">
              <label className="flex items-center gap-2 rounded-xl bg-[#f4f6f1] px-3">
                <Search size={18} />
                <span className="sr-only">Search reception tools and members</span>
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setSearchOpen(false);
                  }}
                  placeholder="Try registration, renewal, scanner, name or phone"
                  className="w-full min-w-0 bg-transparent py-3 text-sm outline-none"
                />
              </label>
              {!!query.trim() && (
                <div className="mt-3 max-h-[55vh] overflow-y-auto">
                  <p className="px-2 py-2 text-[11px] font-black uppercase tracking-wider text-[#6b806c]">
                    Tools & actions
                  </p>
                  {toolResults.map((tool) => (
                    <a
                      href={tool.href}
                      onClick={close}
                      key={`${tool.href}-${tool.label}`}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-[#edf6e7]"
                    >
                      <ChevronRight size={15} />
                      {tool.label}
                    </a>
                  ))}
                  {!toolResults.length && (
                    <p className="px-3 py-2 text-xs text-[#66766a]">No matching tool.</p>
                  )}
                  <p className="mt-2 px-2 py-2 text-[11px] font-black uppercase tracking-wider text-[#6b806c]">
                    Members
                  </p>
                  {searching && (
                    <p role="status" className="px-3 text-xs text-[#66766a]">
                      Searching members…
                    </p>
                  )}
                  {searchError && (
                    <p role="alert" className="px-3 text-xs text-red-700">
                      {searchError}
                    </p>
                  )}
                  {!searching &&
                    members.map((member) => (
                      <a
                        key={member.id}
                        href={`/reception-member/${encodeURIComponent(member.id)}`}
                        onClick={close}
                        className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm hover:bg-[#edf6e7]"
                      >
                        <span className="min-w-0">
                          <strong className="block truncate">
                            {member.full_name || "Unnamed member"}
                          </strong>
                          <span className="block truncate text-xs text-[#66766a]">
                            {member.phone || member.email || "No contact"}
                          </span>
                        </span>
                        <ChevronRight size={16} />
                      </a>
                    ))}
                  {!searching &&
                    cleanSearch(query).length >= 2 &&
                    !members.length &&
                    !searchError && (
                      <p className="px-3 text-xs text-[#66766a]">No matching members.</p>
                    )}
                  <a
                    href="/management-members"
                    onClick={close}
                    className="mt-2 block rounded-xl bg-[#edf6e7] px-3 py-3 text-xs font-bold text-[#356942]"
                  >
                    Open full directory →
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </header>
    </>
  );
}

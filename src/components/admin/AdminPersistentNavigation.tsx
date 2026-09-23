import { useEffect, useMemo, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, LayoutDashboard, Menu, Search, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { adminGroups, canSeeAdminTool } from "./AdminWorkspaceShell";
import "./admin-persistent-navigation.css";

type MemberHit = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
};
const managementRoles = ["admin", "owner", "manager"];
const cleanSearch = (value: string) =>
  value
    .trim()
    .replace(/[%_,()\\]/g, " ")
    .trim();

/** The receptionist's dedicated workspace and scanning/clock-in duties stay separate.
 * Admin management pages and protected member profiles share the persistent navigation.
 */
export function isAdminDestination(pathname: string): boolean {
  if (
    [
      "/management-operations",
      "/management-preview",
      "/management-standard-plan",
      "/management-custom-plan",
      "/management-communications",
    ].includes(pathname)
  )
    return false;
  return (
    pathname.startsWith("/management-") ||
    ["/staff-admin", "/staff-blog", "/staff-gallery", "/staff-missed-scans"].includes(pathname) ||
    pathname.startsWith("/reception-member/")
  );
}

/** Navigation visibility is not authorisation. Existing destination guards and RLS stay authoritative. */
export function AdminPersistentNavigation() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const eligible = isAdminDestination(pathname);
  const [role, setRole] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState<MemberHit[]>([]);
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);

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
        const nextRole = String(staff.role || "").toLowerCase();
        if (managementRoles.includes(nextRole)) setRole(nextRole);
      } catch {
        /* The protected destination handles authentication errors. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eligible]);

  useEffect(() => {
    if (!eligible || !role) return;
    document.body.classList.add("spf-admin-nav-active");
    return () => {
      document.body.classList.remove("spf-admin-nav-active");
    };
  }, [eligible, role]);

  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  const toolResults = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle || !role) return [];
    return adminGroups
      .flatMap((group) =>
        group.tools.filter(
          (tool) =>
            canSeeAdminTool(tool, role) &&
            `${tool.label} ${tool.keywords || ""} ${group.name}`.toLowerCase().includes(needle),
        ),
      )
      .slice(0, 12);
  }, [query, role]);

  useEffect(() => {
    const term = cleanSearch(query);
    if (!eligible || !role || !searchOpen || term.length < 2) {
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
          if (!cancelled) setMembers((data || []) as MemberHit[]);
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
  }, [eligible, role, query, searchOpen]);

  if (!eligible || !role) return null;
  const active = pathname.startsWith("/reception-member/") ? "/admin-members" : pathname;
  const closeNavigation = () => {
    setMobileOpen(false);
    setSearchOpen(false);
  };

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close admin menu"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-[60] bg-black/50 lg:hidden"
        />
      )}
      <aside
        aria-label="Persistent admin sidebar"
        className={`fixed inset-y-0 left-0 z-[70] flex w-[min(85vw,300px)] flex-col overflow-y-auto bg-[#152820] p-5 text-white shadow-xl transition-transform lg:w-[270px] lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <button
          type="button"
          aria-label="Close admin menu"
          onClick={() => setMobileOpen(false)}
          className="absolute right-4 top-5 rounded-lg p-2 hover:bg-white/10 lg:hidden"
        >
          <X size={20} />
        </button>
        <a
          href="/admin-workspace"
          onClick={closeNavigation}
          className="flex items-center gap-3 rounded-xl px-2 py-2"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#b8ee73] text-lg font-black text-[#193327]">
            S+
          </span>
          <span>
            <strong className="block text-sm tracking-wide">SUPER PLUS</strong>
            <span className="text-[11px] text-[#b9c9be]">Admin workspace</span>
          </span>
        </a>
        <nav
          aria-label="Admin navigation"
          className="mt-7 min-h-0 flex-1 space-y-2 overflow-y-auto pb-5"
        >
          {adminGroups.map((group) => {
            const Icon = group.icon;
            const tools = group.tools.filter((tool) => canSeeAdminTool(tool, role));
            const selected = tools.some((tool) => tool.href.split("#")[0] === active);
            const open = expanded[group.name] ?? selected;
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
                    {tools.map((tool) => {
                      const ToolIcon = tool.icon;
                      const isCurrent = tool.href.split("#")[0] === active;
                      return (
                        <a
                          key={`${tool.href}-${tool.label}`}
                          href={tool.href}
                          onClick={closeNavigation}
                          aria-current={isCurrent ? "page" : undefined}
                          className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition ${isCurrent ? "bg-[#b8ee73] text-[#193327]" : "text-[#d5e3d8] hover:bg-white/10"}`}
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
        <a
          href="/reception-workspace"
          onClick={closeNavigation}
          className="mt-3 rounded-xl border border-white/20 px-4 py-3 text-xs font-bold text-[#d5e3d8] hover:bg-white/10"
        >
          Switch to Reception Dashboard ↗
        </a>
        <a
          href="/admin-workspace"
          onClick={closeNavigation}
          className="mt-2 flex items-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-xs font-bold text-[#d5e3d8] hover:bg-white/10"
        >
          <LayoutDashboard size={16} /> Back to dashboard
        </a>
      </aside>
      <header className="sticky top-0 z-40 border-b border-[#e1e8dd] bg-[#f4f6f1]/95 px-4 py-3 backdrop-blur sm:px-7 lg:px-10">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3">
          <button
            type="button"
            aria-label="Open admin menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
            className="rounded-xl border border-[#d8e2d5] bg-white p-2.5 lg:hidden"
          >
            <Menu size={21} />
          </button>
          <a
            href="/admin-workspace"
            className="hidden min-w-0 flex-1 text-xs font-bold text-[#526b57] sm:block"
          >
            SUPER PLUS / ADMIN
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
                <span className="sr-only">Search admin tools, actions and members</span>
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Try revenue, approvals, member name or phone"
                  className="w-full min-w-0 bg-transparent py-3 text-sm outline-none"
                />
              </label>
              {query.trim() && (
                <div className="mt-3 max-h-[55vh] overflow-y-auto">
                  <p className="px-2 py-2 text-[11px] font-black uppercase tracking-wider text-[#6b806c]">
                    Tools & actions
                  </p>
                  {toolResults.map((tool) => (
                    <a
                      href={tool.href}
                      onClick={closeNavigation}
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
                        href={`/reception-member/${member.id}`}
                        onClick={closeNavigation}
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
                    href="/admin-members"
                    onClick={closeNavigation}
                    className="mt-2 block rounded-xl bg-[#edf6e7] px-3 py-3 text-xs font-bold text-[#356942]"
                  >
                    Open full members list →
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

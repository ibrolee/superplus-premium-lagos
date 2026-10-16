import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  Menu,
  Search,
  Users,
  Wallet,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { adminGroups, adminSearchTools, canSeeAdminTool } from "./admin-tools";
import "./admin-workspace.css";

type MemberHit = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
};
const cleanSearch = (value: string) =>
  value
    .trim()
    .replace(/[%_,()\\]/g, " ")
    .trim();

/** Shared presentation for the full workspace and older, independently guarded admin pages. */
export function AdminChrome({ role, active }: { role: string; active: string }) {
  const groups = useMemo(
    () =>
      adminGroups
        .map((group) => ({
          ...group,
          tools: group.tools.filter((tool) => canSeeAdminTool(tool, role)),
        }))
        .filter((group) => group.tools.length),
    [role],
  );
  const selectedGroup =
    groups.find((group) => group.tools.some((tool) => tool.href.split("#")[0] === active))?.name ||
    "";
  const [expanded, setExpanded] = useState(selectedGroup);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileGroup, setMobileGroup] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState<MemberHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [signOutError, setSignOutError] = useState("");
  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      setSignOutError("Unable to sign out. Please try again.");
      return;
    }
    window.location.assign("/portal/admin");
  }
  useEffect(() => {
    setExpanded(selectedGroup);
    setMobileOpen(false);
    setSearchOpen(false);
  }, [active, selectedGroup]);
  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const seen = new Set<string>();
    return adminSearchTools
      .filter((tool) => {
        if (
          !needle ||
          !canSeeAdminTool(tool, role) ||
          !`${tool.label} ${tool.keywords || ""}`.toLowerCase().includes(needle) ||
          seen.has(tool.href)
        )
          return false;
        seen.add(tool.href);
        return true;
      })
      .slice(0, 12);
  }, [query, role]);
  useEffect(() => {
    const term = cleanSearch(query);
    setMembers([]);
    setSearchError("");
    if (!searchOpen || term.length < 2) {
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const { data, error } = await supabase
            .from("members")
            .select("id,full_name,phone,email")
            .or(`full_name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`)
            .order("full_name")
            .limit(8);
          if (error) throw error;
          if (!cancelled) setMembers((data || []) as MemberHit[]);
        } catch {
          if (!cancelled) setSearchError("Member search is unavailable. Try the member directory.");
        } finally {
          if (!cancelled) setSearching(false);
        }
      })();
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, searchOpen]);
  const close = () => {
    setMobileOpen(false);
    setSearchOpen(false);
  };
  const openMenu = () => {
    setMobileGroup("");
    setMobileOpen(true);
  };
  const toolsFor = (group: (typeof groups)[number]) =>
    group.tools.map((tool) => {
      const Icon = tool.icon;
      return (
        <a
          key={tool.href}
          href={tool.href}
          onClick={close}
          aria-current={tool.href.split("#")[0] === active ? "page" : undefined}
          className="spf-admin-tool"
        >
          <Icon size={16} />
          <span>{tool.label}</span>
          <ChevronRight size={14} />
        </a>
      );
    });
  return (
    <>
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-white focus:p-3"
      >
        Skip to content
      </a>
      <aside className="spf-admin-sidebar" aria-label="Admin sidebar">
        <a href="/admin-workspace" className="spf-admin-brand">
          <img src="/footer-logo-circular.webp" alt="Super Plus Fitness" />
          <span>
            <strong>SUPER PLUS</strong>
            <small>Management workspace</small>
          </span>
        </a>
        <nav aria-label="Admin navigation" className="spf-admin-groups">
          {groups.map((group) => {
            const Icon = group.icon;
            if (group.name === "Dashboard")
              return (
                <a
                  key={group.name}
                  href="/admin-workspace"
                  className="spf-admin-group"
                  aria-current={active === "/admin-workspace" ? "page" : undefined}
                >
                  <Icon size={18} />
                  <span>Dashboard</span>
                </a>
              );
            const open = expanded === group.name;
            return (
              <div key={group.name}>
                <button
                  type="button"
                  className="spf-admin-group"
                  aria-expanded={open}
                  aria-controls={`admin-group-${group.name.replace(/\W/g, "")}`}
                  onClick={() => setExpanded(open ? "" : group.name)}
                >
                  <Icon size={18} />
                  <span>{group.name}</span>
                  <ChevronDown size={15} className={open ? "rotate-180" : ""} />
                </button>
                {open && (
                  <div
                    id={`admin-group-${group.name.replace(/\W/g, "")}`}
                    className="spf-admin-submenu"
                  >
                    {toolsFor(group)}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className="spf-admin-sidebar-footer">
          <a href="/reception-workspace">
            Reception workspace <ArrowUpRight size={15} />
          </a>
          <a href="/">
            View website <ArrowUpRight size={15} />
          </a>
          <button type="button" onClick={() => void signOut()}>
            Sign out
          </button>
          {signOutError && (
            <p role="alert" className="px-3 text-xs text-red-700">
              {signOutError}
            </p>
          )}
        </div>
      </aside>
      <header className="spf-admin-topbar">
        <a
          href="/admin-workspace"
          aria-label="Super Plus admin dashboard"
          className="spf-admin-topmark lg:hidden"
        >
          <img src="/footer-logo-circular.webp" alt="" />
        </a>
        <a href="/admin-workspace" className="spf-admin-topbrand">
          SPF <span>Management</span>
        </a>
        <button
          type="button"
          aria-label="Search tools or members"
          onClick={() => setSearchOpen(true)}
          className="spf-admin-search-trigger"
        >
          <Search size={18} />
          <span>Find a member or tool…</span>
          <kbd className="hidden sm:inline">Search</kbd>
        </button>
        <span className="spf-admin-role">{role}</span>
      </header>
      <nav aria-label="Quick admin navigation" className="spf-admin-bottom-nav">
        {[
          { label: "Home", href: "/admin-workspace", icon: LayoutDashboard },
          { label: "Members", href: "/admin-members", icon: Users },
          { label: "Finance", href: "/management-revenue", icon: Wallet },
        ].map((item) => (
          <a
            key={item.label}
            href={item.href}
            aria-current={active === item.href ? "page" : undefined}
          >
            <item.icon size={19} />
            <span>{item.label}</span>
          </a>
        ))}
        <button type="button" onClick={openMenu} aria-label="All admin functions">
          <Menu size={19} />
          <span>All tools</span>
        </button>
      </nav>
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent className="spf-logo-theme spf-admin-dialog spf-admin-mobile-menu">
          <DialogTitle>{mobileGroup || "All admin tools"}</DialogTitle>
          <DialogDescription>
            {mobileGroup ? "Choose a function to open." : "Everything you need, organised by task."}
          </DialogDescription>
          {mobileGroup ? (
            <>
              <button
                type="button"
                className="inline-flex min-h-11 items-center gap-2 text-sm font-bold"
                onClick={() => setMobileGroup("")}
              >
                <ArrowLeft size={16} />
                All sections
              </button>
              <nav aria-label={`${mobileGroup} tools`} className="space-y-1">
                {groups
                  .filter((group) => group.name === mobileGroup)
                  .map((group) => (
                    <div key={group.name}>{toolsFor(group)}</div>
                  ))}
              </nav>
            </>
          ) : (
            <nav aria-label="Admin sections" className="spf-admin-mobile-grid">
              {groups.map((group) => (
                <button
                  key={group.name}
                  type="button"
                  onClick={() => {
                    if (group.name === "Dashboard") {
                      window.location.assign("/admin-workspace");
                    } else setMobileGroup(group.name);
                  }}
                >
                  <group.icon size={23} />
                  <strong>{group.name}</strong>
                  <small>
                    {group.name === "Dashboard"
                      ? "Today at a glance"
                      : `${group.tools.length} tools`}
                  </small>
                </button>
              ))}
            </nav>
          )}
          <button
            type="button"
            onClick={() => void signOut()}
            className="min-h-11 rounded-xl border px-4 py-3 text-sm font-bold"
          >
            Sign out
          </button>
          {signOutError && (
            <p role="alert" className="text-xs text-red-700">
              {signOutError}
            </p>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="spf-logo-theme spf-admin-dialog spf-admin-search-dialog">
          <DialogTitle>Find a member or tool</DialogTitle>
          <DialogDescription>
            Search by name, phone, email or the task you want to do.
          </DialogDescription>
          <label className="flex min-w-0 items-center gap-2 rounded-xl border bg-[var(--portal-canvas)] px-3">
            <Search size={18} />
            <span className="sr-only">Search admin tools and members</span>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Try salary, family plan or member name"
              className="min-w-0 w-full bg-transparent py-3 text-base outline-none"
            />
          </label>
          <div className="min-h-0 overflow-y-auto overscroll-contain">
            {!query.trim() && (
              <div className="grid grid-cols-2 gap-2">
                {["Members", "Salary", "Family", "Bookings"].map((term) => (
                  <button
                    type="button"
                    key={term}
                    onClick={() => setQuery(term)}
                    className="min-h-11 rounded-xl border px-3 text-left text-sm"
                  >
                    {term}
                    <ChevronRight size={15} className="float-right" />
                  </button>
                ))}
              </div>
            )}
            {!!query.trim() && (
              <>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--portal-muted)]">
                  Tools & actions
                </p>
                {results.map((tool) => (
                  <a key={tool.href} href={tool.href} onClick={close} className="spf-admin-tool">
                    <tool.icon size={17} />
                    <span>{tool.label}</span>
                    <ChevronRight size={15} />
                  </a>
                ))}
                {!results.length && <p className="p-3 text-sm">No matching tools.</p>}
                <p className="mb-2 mt-4 text-xs font-bold uppercase tracking-wider text-[var(--portal-muted)]">
                  Members
                </p>
                {searching && (
                  <p role="status" className="p-3 text-sm">
                    Searching members…
                  </p>
                )}
                {searchError && (
                  <p role="alert" className="p-3 text-sm text-red-700">
                    {searchError}
                  </p>
                )}
                {members.map((member) => (
                  <a
                    key={member.id}
                    href={`/reception-member/${member.id}`}
                    onClick={close}
                    className="spf-admin-tool"
                  >
                    <Users size={17} />
                    <span>
                      <strong className="block break-words">
                        {member.full_name || "Unnamed member"}
                      </strong>
                      <small className="block break-all text-[var(--portal-muted)]">
                        {member.phone || member.email || "No contact"}
                      </small>
                    </span>
                    <ChevronRight size={15} />
                  </a>
                ))}
                {!searching &&
                  cleanSearch(query).length >= 2 &&
                  !members.length &&
                  !searchError && <p className="p-3 text-sm">No matching members.</p>}
              </>
            )}
          </div>
          <a
            href="/admin-members"
            className="min-h-11 rounded-xl bg-[var(--portal-surface)] px-3 py-3 text-sm font-bold text-[var(--portal-accent)]"
          >
            Open member directory →
          </a>
        </DialogContent>
      </Dialog>
    </>
  );
}

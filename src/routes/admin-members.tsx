import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, RefreshCw, Search, UserRound } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { AdminWorkspaceShell } from "@/components/admin/AdminWorkspaceShell";

export const Route = createFileRoute("/admin-members")({ component: AdminMembers });
type Member = { id: string; full_name: string | null; phone: string | null; email: string | null };
const PAGE_SIZE = 25;
async function loadMembers(): Promise<Member[]> {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error("Sign in through the admin portal first.");
  const { data: staff, error: staffError } = await supabase.from("staff_users").select("role,active").eq("auth_user_id", auth.user.id).maybeSingle();
  if (staffError) throw staffError;
  if (!staff?.active || !["admin", "owner", "manager"].includes(String(staff.role || "").toLowerCase())) throw new Error("Only active management accounts can use this list.");
  const all: Member[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from("members").select("id,full_name,phone,email").order("id", { ascending: true }).range(offset, offset + 499);
    if (error) throw error;
    const page = (data || []) as Member[];
    all.push(...page);
    if (page.length < 500) return all.sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
  }
}
function AdminMembers() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError("");
      try { const result = await loadMembers(); if (!cancelled) setMembers(result); }
      catch (cause) { if (!cancelled) { setMembers([]); setError(cause instanceof Error ? cause.message : "Unable to load members."); } }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [reload]);
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return members.filter((member) => !needle || [member.full_name, member.phone, member.email].some((value) => value?.toLowerCase().includes(needle)));
  }, [members, query]);
  const pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = matches.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  return <AdminWorkspaceShell title="Members list" subtitle="Find a member and open their profile." active="/admin-members">
    <section className="mt-7 rounded-[24px] border border-[#e1e8dd] bg-white p-4 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3"><label className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-[#d8e2d5] bg-[#f8faf6] px-4 sm:max-w-xl"><Search size={18} className="shrink-0 text-[#69816f]"/><span className="sr-only">Search member name, phone or email</span><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search name, phone or email" className="min-w-0 w-full bg-transparent py-3.5 text-sm outline-none"/></label><button type="button" disabled={loading} onClick={() => setReload((value) => value + 1)} className="inline-flex items-center gap-2 rounded-xl border border-[#d8e2d5] px-4 py-3 text-sm font-bold disabled:opacity-50"><RefreshCw size={16} className={loading ? "animate-spin" : ""}/> Refresh</button></div>
      {loading && <p role="status" className="mt-7 text-sm text-[#637469]">Loading member records…</p>}
      {!loading && error && <p role="alert" className="mt-7 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {!loading && !error && <><p className="mt-5 text-xs text-[#637469]">{matches.length.toLocaleString("en-NG")} member{matches.length === 1 ? "" : "s"} found</p>
        <div className="mt-4 divide-y divide-[#e7ede4]">{visible.map((member) => <article key={member.id} className="flex flex-wrap items-center gap-3 py-4 sm:flex-nowrap"><span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#edf5e7] font-black text-[#38673e]">{member.full_name?.trim().charAt(0).toUpperCase() || <UserRound size={19}/>}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{member.full_name || "Unnamed member"}</p><p className="mt-1 break-words text-xs text-[#637469]">{member.phone || "No phone"}{member.email ? ` · ${member.email}` : ""}</p></div><a href={`/reception-member/${member.id}`} className="ml-auto inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#193b2a] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#2c5737]">View Profile <ArrowRight size={15}/></a></article>)}
          {!visible.length && <p className="py-12 text-center text-sm text-[#637469]">No members match your search.</p>}
        </div>
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#e7ede4] pt-5"><button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="inline-flex items-center gap-1 rounded-xl border border-[#d8e2d5] px-3 py-2 text-xs font-bold disabled:opacity-40"><ChevronLeft size={16}/> Previous</button><span className="text-xs text-[#637469]">Page {currentPage} of {pageCount}</span><button type="button" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)} className="inline-flex items-center gap-1 rounded-xl border border-[#d8e2d5] px-3 py-2 text-xs font-bold disabled:opacity-40">Next <ChevronRight size={16}/></button></div>
      </>}
    </section>
  </AdminWorkspaceShell>;
}

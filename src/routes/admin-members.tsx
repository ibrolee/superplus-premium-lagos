import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
 ArrowRight,
 ChevronLeft,
 ChevronRight,
 RefreshCw,
 Search,
 Trash2,
 UserRound,
 X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { AdminWorkspaceShell } from "@/components/admin/AdminWorkspaceShell";
 
export const Route = createFileRoute("/admin-members")({ component: AdminMembers });
 
type Member = {
 id: string;
 full_name: string | null;
 phone: string | null;
 email: string | null;
};
 
type DeletePreview = {
 success: boolean;
 deleted: boolean;
 member_id: string;
 member_name: string;
 counts: Record<string, number>;
};
 
const PAGE_SIZE = 25;
const deletionCountLabels: Array<[string, string]> = [
 ["memberships", "Memberships"],
 ["payments", "Payments"],
 ["attendance", "Attendance records"],
 ["reception_transactions", "Reception transactions"],
 ["new_member_requests", "New-member requests"],
 ["payment_requests", "Payment requests"],
 ["returning_member_claims", "Returning-member claims"],
 ["card_reissues", "Card reissues"],
 ["qr_records", "QR records"],
 ["blog_comments", "Blog comments"],
 ["blog_likes", "Blog likes"],
];
 
async function loadMembers(): Promise<{ members: Member[]; isAdmin: boolean }> {
 const { data: auth, error: authError } = await supabase.auth.getUser();
 if (authError || !auth.user) {
   throw new Error("Sign in through the admin portal first.");
 }
 
 const { data: staff, error: staffError } = await supabase
   .from("staff_users")
   .select("role,active")
   .eq("auth_user_id", auth.user.id)
   .maybeSingle();
 
 if (staffError) throw staffError;
 const role = String(staff?.role || "").toLowerCase();
 if (!staff?.active || !["admin", "owner", "manager"].includes(role)) {
   throw new Error("Only active management accounts can use this list.");
 }
 
 const all: Member[] = [];
 for (let offset = 0; ; offset += 500) {
   const { data, error } = await supabase
     .from("members")
     .select("id,full_name,phone,email")
     .order("id", { ascending: true })
     .range(offset, offset + 499);
   if (error) throw error;
   const page = (data || []) as Member[];
   all.push(...page);
   if (page.length < 500) {
     return {
       members: all.sort((a, b) =>
         (a.full_name || "").localeCompare(b.full_name || ""),
       ),
       isAdmin: role === "admin",
     };
   }
 }
}
 
function AdminMembers() {
 const [members, setMembers] = useState<Member[]>([]);
 const [isAdmin, setIsAdmin] = useState(false);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState("");
 const [message, setMessage] = useState("");
 const [reload, setReload] = useState(0);
 const [query, setQuery] = useState("");
 const [page, setPage] = useState(1);
 const [preview, setPreview] = useState<DeletePreview | null>(null);
 const [openingMemberId, setOpeningMemberId] = useState<string | null>(null);
 const [confirmation, setConfirmation] = useState("");
 const [deleteError, setDeleteError] = useState("");
 const [deleting, setDeleting] = useState(false);
 
 useEffect(() => {
   let cancelled = false;
   (async () => {
     setLoading(true);
     setError("");
     try {
       const result = await loadMembers();
       if (!cancelled) {
         setMembers(result.members);
         setIsAdmin(result.isAdmin);
       }
     } catch (cause) {
       if (!cancelled) {
         setMembers([]);
         setIsAdmin(false);
         setError(
           cause instanceof Error ? cause.message : "Unable to load members.",
         );
       }
     } finally {
       if (!cancelled) setLoading(false);
     }
   })();
   return () => {
     cancelled = true;
   };
 }, [reload]);
 
 const matches = useMemo(() => {
   const needle = query.trim().toLowerCase();
   return members.filter(
     (member) =>
       !needle ||
       [member.full_name, member.phone, member.email].some((value) =>
         value?.toLowerCase().includes(needle),
       ),
   );
 }, [members, query]);
 const pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
 const currentPage = Math.min(page, pageCount);
 const visible = matches.slice(
   (currentPage - 1) * PAGE_SIZE,
   currentPage * PAGE_SIZE,
 );
 
 async function openDeletionPreview(member: Member) {
   if (!isAdmin || openingMemberId || deleting) return;
   setOpeningMemberId(member.id);
   setMessage("");
   setDeleteError("");
   setConfirmation("");
   setPreview(null);
   try {
     const { data, error: previewError } = await supabase.rpc(
       "admin_delete_member_profile",
       { p_member_id: member.id },
     );
     if (previewError) throw previewError;
     const result = data as DeletePreview | null;
     if (
       !result?.success ||
       result.deleted !== false ||
       result.member_id !== member.id ||
       result.member_name !== member.full_name ||
       !result.counts
     ) {
       throw new Error("Could not verify this member's deletion preview.");
     }
     setPreview(result);
   } catch (cause) {
     setMessage(
       cause instanceof Error
         ? `Delete preview failed: ${cause.message}`
         : "Could not load the deletion preview.",
     );
   } finally {
     setOpeningMemberId(null);
   }
 }
 
 async function deleteProfile() {
   if (!isAdmin || !preview || confirmation !== "DELETE" || deleting) return;
   setDeleting(true);
   setDeleteError("");
   try {
     const { data, error: deleteFailure } = await supabase.rpc(
       "admin_delete_member_profile",
       {
         p_member_id: preview.member_id,
         p_confirmation: "DELETE",
         p_expected_name: preview.member_name,
       },
     );
     if (deleteFailure) throw deleteFailure;
     if (
       !data?.success ||
       data.deleted !== true ||
       data.member_id !== preview.member_id ||
       data.login_deleted !== false
     ) {
       throw new Error("Deletion was not confirmed by the server.");
     }
     setMembers((previous) =>
       previous.filter((member) => member.id !== preview.member_id),
     );
     setMessage(`Deleted ${preview.member_name}'s website profile and linked records. The login account was kept.`);
     setPreview(null);
     setConfirmation("");
     setReload((value) => value + 1);
   } catch (cause) {
     setDeleteError(
       cause instanceof Error ? cause.message : "Unable to delete profile.",
     );
   } finally {
     setDeleting(false);
   }
 }
 
 return (
   <AdminWorkspaceShell
     title="Members list"
     subtitle="Find a member and open their profile."
     active="/admin-members"
   >
     <section className="mt-7 rounded-[24px] border border-[#e1e8dd] bg-white p-4 sm:p-7">
       <div className="flex flex-wrap items-center justify-between gap-3">
         <label className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-[#d8e2d5] bg-[#f8faf6] px-4 sm:max-w-xl">
           <Search size={18} className="shrink-0 text-[#69816f]" />
           <span className="sr-only">Search member name, phone or email</span>
           <input
             type="search"
             value={query}
             onChange={(event) => {
               setQuery(event.target.value);
               setPage(1);
             }}
             placeholder="Search name, phone or email"
             className="min-w-0 w-full bg-transparent py-3.5 text-sm outline-none"
           />
         </label>
         <button
           type="button"
           disabled={loading || deleting}
           onClick={() => setReload((value) => value + 1)}
           className="inline-flex items-center gap-2 rounded-xl border border-[#d8e2d5] px-4 py-3 text-sm font-bold disabled:opacity-50"
         >
           <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
           Refresh
         </button>
       </div>
 
       {message && (
         <p role="status" className="mt-5 rounded-xl border border-[#bdd7b8] bg-[#f2f8f0] p-4 text-sm text-[#254f2e]">
           {message}
         </p>
       )}
       {loading && (
         <p role="status" className="mt-7 text-sm text-[#637469]">
           Loading member records…
         </p>
       )}
       {!loading && error && (
         <p role="alert" className="mt-7 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
           {error}
         </p>
       )}
       {!loading && !error && (
         <>
           <p className="mt-5 text-xs text-[#637469]">
             {matches.length.toLocaleString("en-NG")} member
             {matches.length === 1 ? "" : "s"} found
           </p>
           <div className="mt-4 divide-y divide-[#e7ede4]">
             {visible.map((member) => (
               <article
                 key={member.id}
                 className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 py-4 lg:grid-cols-[auto_minmax(0,1fr)_auto]"
               >
                 <span
                   aria-hidden="true"
                   className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#edf5e7] font-black text-[#38673e]"
                 >
                   {member.full_name?.trim().charAt(0).toUpperCase() || (
                     <UserRound size={19} />
                   )}
                 </span>
                 <div className="min-w-0 flex-1">
                   <p className="break-words text-sm font-bold">
                     {member.full_name || "Unnamed member"}
                   </p>
                   <p className="mt-1 break-words text-xs text-[#637469]">
                     {member.phone || "No phone"}
                     {member.email ? ` · ${member.email}` : ""}
                   </p>
                 </div>
                 <div className="col-span-2 flex w-full flex-wrap items-center gap-2 lg:col-span-1 lg:ml-auto lg:w-auto">
                   <a
                     href={`/reception-member/${member.id}`}
                     className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#193b2a] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#2c5737]"
                   >
                     View Profile <ArrowRight size={15} />
                   </a>
                   {isAdmin && (
                     <button
                       type="button"
                       disabled={openingMemberId !== null || deleting}
                       onClick={() => openDeletionPreview(member)}
                       className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                     >
                       <Trash2 size={15} />
                       {openingMemberId === member.id
                         ? "Checking…"
                         : "Delete Profile"}
                     </button>
                   )}
                 </div>
               </article>
             ))}
             {!visible.length && (
               <p className="py-12 text-center text-sm text-[#637469]">
                 No members match your search.
               </p>
             )}
           </div>
           <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#e7ede4] pt-5">
             <button
               type="button"
               disabled={currentPage === 1}
               onClick={() => setPage(currentPage - 1)}
               className="inline-flex items-center gap-1 rounded-xl border border-[#d8e2d5] px-3 py-2 text-xs font-bold disabled:opacity-40"
             >
               <ChevronLeft size={16} /> Previous
             </button>
             <span className="text-xs text-[#637469]">
               Page {currentPage} of {pageCount}
             </span>
             <button
               type="button"
               disabled={currentPage >= pageCount}
               onClick={() => setPage(currentPage + 1)}
               className="inline-flex items-center gap-1 rounded-xl border border-[#d8e2d5] px-3 py-2 text-xs font-bold disabled:opacity-40"
             >
               Next <ChevronRight size={16} />
             </button>
           </div>
         </>
       )}
     </section>
 
     {isAdmin && preview && (
       <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/65 p-4">
         <section
           role="dialog"
           aria-modal="true"
           aria-labelledby="delete-member-title"
           className="my-auto w-full max-w-xl rounded-2xl border border-red-200 bg-white p-5 shadow-2xl sm:p-7"
         >
           <div className="flex items-start justify-between gap-4">
             <div>
               <h2 id="delete-member-title" className="text-xl font-black text-red-800">
                 Permanently delete member?
               </h2>
               <p className="mt-2 break-words text-sm font-bold text-[#193b2a]">
                 {preview.member_name}
               </p>
               <p className="mt-1 break-all text-xs text-[#637469]">
                 Member ID: {preview.member_id}
               </p>
             </div>
             <button
               type="button"
               aria-label="Close deletion confirmation"
               disabled={deleting}
               onClick={() => {
                 setPreview(null);
                 setConfirmation("");
               }}
               className="rounded-lg p-2 hover:bg-gray-100 disabled:opacity-50"
             >
               <X size={20} />
             </button>
           </div>
           <p className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
             This permanently deletes the website profile and its linked records,
             including payment history. Financial reports may change. This does
             not issue a refund, erase bank or Paystack records, or delete the
             member's login account.
           </p>
           <div className="mt-5 rounded-xl border border-[#e1e8dd] p-4">
             <h3 className="mb-3 text-sm font-black text-[#193b2a]">
               Records selected for deletion
             </h3>
             <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
               {deletionCountLabels.map(([key, label]) => (
                 <div key={key} className="flex items-center justify-between gap-3">
                   <dt className="text-[#637469]">{label}</dt>
                   <dd className="font-bold tabular-nums">
                     {Number(preview.counts[key] || 0).toLocaleString("en-NG")}
                   </dd>
                 </div>
               ))}
             </dl>
             <p className="mt-3 text-xs text-[#637469]">
               Related reminders and reconciliation records will also be removed.
             </p>
           </div>
           <label className="mt-5 block text-sm font-bold text-[#193b2a]">
             Type DELETE to confirm
             <input
               type="text"
               autoComplete="off"
               spellCheck={false}
               value={confirmation}
               disabled={deleting}
               onChange={(event) => setConfirmation(event.target.value)}
               placeholder="DELETE"
               className="mt-2 block w-full rounded-xl border border-[#cbd5c8] px-4 py-3 font-mono text-base outline-none focus:border-red-500 disabled:opacity-50"
             />
           </label>
           {deleteError && (
             <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
               {deleteError}
             </p>
           )}
           <div className="mt-5 flex flex-wrap justify-end gap-3">
             <button
               type="button"
               disabled={deleting}
               onClick={() => {
                 setPreview(null);
                 setConfirmation("");
               }}
               className="rounded-xl border border-[#cbd5c8] px-5 py-3 text-sm font-bold disabled:opacity-50"
             >
               Keep Profile
             </button>
             <button
               type="button"
               disabled={deleting || confirmation !== "DELETE"}
               onClick={deleteProfile}
               className="rounded-xl bg-red-700 px-5 py-3 text-sm font-black text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-40"
             >
               {deleting ? "Deleting…" : "Permanently Delete Profile"}
             </button>
           </div>
         </section>
       </div>
     )}
   </AdminWorkspaceShell>
 );
}
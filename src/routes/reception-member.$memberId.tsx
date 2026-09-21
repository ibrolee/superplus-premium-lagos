import "@/components/reception/reception-responsive.css";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
 ArrowLeft, ArrowRight, Cake, CheckCircle2, ChevronDown, CreditCard,
 Download, Loader2, LogIn, LogOut, Mail, Phone, QrCode, UserRound, XCircle,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
 
export const Route = createFileRoute("/reception-member/$memberId")({
 component: ReceptionMemberProfile,
});
 
type Member = {
 id: string;
 full_name: string | null;
 email: string | null;
 phone: string | null;
 birth_day: number | null;
 birth_month: number | null;
 qr_token: string | null;
};
 
type Membership = {
 id: string;
 member_id: string;
 plan_name: string | null;
 start_date: string | null;
 end_date: string | null;
 status: string | null;
 payment_status: string | null;
 source: string | null;
 created_at: string | null;
};
 
type Payment = {
 id: string;
 member_id: string | null;
 membership_id: string | null;
 amount: number | null;
 currency: string | null;
 status: string | null;
 payment_method: string | null;
 provider: string | null;
 paystack_reference: string | null;
 paid_at: string | null;
 created_at: string | null;
};
 
type Attendance = {
 id: string;
 member_id: string;
 checked_in_at: string | null;
 checked_out_at: string | null;
 created_at: string | null;
};
 
type MembershipAction = "pause" | "resume" | "extend" | "cancel";
 
function getLocalDateString() {
 const now = new Date();
 return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
 
function getDateOnly(value: unknown) {
 if (!value) return null;
 const valueString = String(value).trim();
 return valueString ? valueString.slice(0, 10) : null;
}
 
function formatDate(value: unknown) {
 const date = getDateOnly(value);
 if (!date) return "—";
 return new Intl.DateTimeFormat("en-NG", {
   day: "numeric", month: "long", year: "numeric",
 }).format(new Date(`${date}T00:00:00`));
}
 
function formatDateTime(value: unknown) {
 if (!value) return "—";
 const date = new Date(String(value));
 if (Number.isNaN(date.getTime())) return "—";
 return new Intl.DateTimeFormat("en-NG", {
   day: "numeric", month: "short", year: "numeric",
   hour: "numeric", hour12: true, minute: "2-digit",
 }).format(date);
}
 
function formatNaira(value: number | null) {
 if (value === null || value === undefined) return "₦0";
 return `₦${Number(value).toLocaleString("en-NG")}`;
}
 
function getBirthday(member: Member) {
 if (!member.birth_day || !member.birth_month) return "Not provided";
 const date = new Date(2000, member.birth_month - 1, member.birth_day);
 if (Number.isNaN(date.getTime())) return "Not provided";
 return new Intl.DateTimeFormat("en-NG", {
   day: "numeric", month: "long",
 }).format(date);
}
 
function isMembershipValidToday(membership: Membership) {
 if (
   String(membership.status || "").toLowerCase() !== "active" ||
   String(membership.payment_status || "").toLowerCase() !== "paid"
 ) return false;
 const startDate = getDateOnly(membership.start_date);
 const endDate = getDateOnly(membership.end_date);
 if (!startDate || !endDate) return false;
 const today = getLocalDateString();
 return startDate <= today && today <= endDate;
}
 
function daysRemaining(membership: Membership | null) {
 if (!membership?.end_date) return 0;
 const today = new Date(`${getLocalDateString()}T00:00:00`);
 const expiry = new Date(`${getDateOnly(membership.end_date)}T00:00:00`);
 return Math.max(0, Math.ceil((expiry.getTime() - today.getTime()) / 86400000));
}
 
function SectionSummary({ icon, title, summary }: {
 icon: ReactNode;
 title: string;
 summary?: string;
}) {
 return (
   <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 [&::-webkit-details-marker]:hidden">
     <div className="flex min-w-0 items-center gap-3">
       <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">{icon}</div>
       <div className="min-w-0">
         <h2 className="font-display text-lg font-bold uppercase">{title}</h2>
         {summary && <p className="truncate text-sm text-muted-foreground">{summary}</p>}
       </div>
     </div>
     <ChevronDown className="h-5 w-5 shrink-0 transition-transform duration-200 group-open:rotate-180" />
   </summary>
 );
}
 
function ReceptionMemberProfile() {
 const { memberId } = Route.useParams();
 const [member, setMember] = useState<Member | null>(null);
 const [memberships, setMemberships] = useState<Membership[]>([]);
 const [payments, setPayments] = useState<Payment[]>([]);
 const [attendance, setAttendance] = useState<Attendance[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState("");
 const [downloadingQr, setDownloadingQr] = useState(false);
 const [isAdmin, setIsAdmin] = useState(false);
 const [processingMembershipId, setProcessingMembershipId] = useState<string | null>(null);
 
 useEffect(() => {
   let mounted = true;
   async function loadProfile() {
     setLoading(true);
     setError("");
     const { data: { session } } = await supabase.auth.getSession();
     if (!session) {
       window.location.href = "/portal/reception";
       return;
     }
     const { data: staffUser, error: staffError } = await supabase
       .from("staff_users")
       .select("id, role")
       .eq("auth_user_id", session.user.id)
       .eq("active", true)
       .maybeSingle();
     if (!mounted) return;
     if (staffError || !staffUser) {
       window.location.href = "/";
       return;
     }
     setIsAdmin(String(staffUser.role || "").toLowerCase() === "admin");
     const [memberResult, membershipsResult, paymentsResult, attendanceResult] = await Promise.all([
       supabase.from("members")
         .select("id, full_name, email, phone, birth_day, birth_month, qr_token")
         .eq("id", memberId).maybeSingle(),
       supabase.from("memberships")
         .select("id, member_id, plan_name, start_date, end_date, status, payment_status, source, created_at")
         .eq("member_id", memberId).order("start_date", { ascending: false }),
       (async () => {
         const scoped = await supabase.rpc("reception_member_payment_history", { p_member_id: memberId });
         if (!scoped.error || !["PGRST202", "42883"].includes(scoped.error.code)) return scoped;
         // Before database cutover only: retain the existing member-filtered query.
         return supabase.from("payments")
           .select("id, member_id, membership_id, amount, currency, status, payment_method, provider, paystack_reference, paid_at, created_at")
           .eq("member_id", memberId).order("created_at", { ascending: false });
       })(),
       supabase.from("attendance")
         .select("id, member_id, checked_in_at, checked_out_at, created_at")
         .eq("member_id", memberId).order("checked_in_at", { ascending: false }),
     ]);
     if (!mounted) return;
     if (memberResult.error) {
       setError(memberResult.error.message);
       setLoading(false);
       return;
     }
     if (!memberResult.data) {
       setError("Member not found.");
       setLoading(false);
       return;
     }
     setMember(memberResult.data);
     setMemberships(membershipsResult.data ?? []);
     if (paymentsResult.error) {
       setError(`Unable to load payment history: ${paymentsResult.error.message}`);
       setLoading(false);
       return;
     }
     setPayments(paymentsResult.data ?? []);
     setAttendance(attendanceResult.data ?? []);
     setLoading(false);
   }
   loadProfile();
   return () => { mounted = false; };
 }, [memberId]);
 
 const currentMembership = useMemo(() => (
   memberships.filter(isMembershipValidToday).sort((a, b) => {
     const aDate = getDateOnly(a.end_date) ?? "";
     const bDate = getDateOnly(b.end_date) ?? "";
     return bDate.localeCompare(aDate);
   })[0] ?? null
 ), [memberships]);
 const latestMembership = memberships[0] ?? null;
 const isInside = attendance.some((record) => !record.checked_out_at);
 const successfulPayments = payments.filter((payment) => String(payment.status).toLowerCase() === "success");
 const totalPaid = successfulPayments.reduce((total, payment) => total + Number(payment.amount || 0), 0);
 const remainingDays = daysRemaining(currentMembership);
 
 async function manageMembership(membership: Membership, action: MembershipAction) {
   if (!isAdmin || processingMembershipId) return;
   let days: number | null = null;
   let pausedUntil: string | null = null;
 
   if (action === "extend") {
     const answer = window.prompt(
       `How many days should be added to ${membership.plan_name || "this membership"}?\n\nEnter a number from 1 to 365.`,
     );
     if (answer === null) return;
     if (!/^\d+$/.test(answer.trim())) {
       window.alert("Enter a whole number of days.");
       return;
     }
     days = Number(answer.trim());
     if (days < 1 || days > 365) {
       window.alert("Extension must be between 1 and 365 days.");
       return;
     }
   }
 
   if (action === "pause") {
     const answer = window.prompt(
       "Enter the pause-until date in YYYY-MM-DD format.\n\nThe administrator must resume the membership manually. It will not resume automatically.",
     );
     if (answer === null) return;
     pausedUntil = answer.trim();
     if (!/^\d{4}-\d{2}-\d{2}$/.test(pausedUntil) ||
         Number.isNaN(Date.parse(`${pausedUntil}T00:00:00`))) {
       window.alert("Enter a valid date in YYYY-MM-DD format.");
       return;
     }
   }
 
   if (action === "cancel") {
     const confirmation = window.prompt(
       `You are about to CANCEL ${membership.plan_name || "a membership"} for ${member?.full_name || "this member"}.\n\nPayment and attendance history will be preserved.\n\nType CANCEL to continue.`,
     );
     if (confirmation !== "CANCEL") return;
   } else {
     const confirmed = window.confirm(
       `Confirm ${action.toUpperCase()} for ${member?.full_name || "this member"}?\n\nPlan: ${membership.plan_name || "Membership"}\nCurrent expiry: ${formatDate(membership.end_date)}`,
     );
     if (!confirmed) return;
   }
 
   setProcessingMembershipId(membership.id);
   try {
     const { data, error: actionError } = await supabase.rpc("reception_manage_membership", {
       p_membership_id: membership.id,
       p_action: action,
       p_days: days,
       p_paused_until: pausedUntil,
     });
     if (actionError) throw new Error(actionError.message);
     if (!data?.success) throw new Error("The membership action was not confirmed.");
     window.alert(`Membership ${action === "extend" ? "extended" : action === "resume" ? "resumed" : action === "pause" ? "paused" : "cancelled"} successfully.`);
     window.location.reload();
   } catch (cause) {
     window.alert(cause instanceof Error ? cause.message : "Unable to update this membership.");
   } finally {
     setProcessingMembershipId(null);
   }
 }
 
 async function downloadQr() {
   if (!member?.qr_token) return;
   setDownloadingQr(true);
   try {
     const svg = document.getElementById("member-profile-qr") as SVGElement | null;
     if (!svg) return;
     const serializer = new XMLSerializer();
     const source = serializer.serializeToString(svg);
     const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
     const url = URL.createObjectURL(blob);
     const image = new Image();
     image.onload = () => {
       const canvas = document.createElement("canvas");
       canvas.width = 1000;
       canvas.height = 1000;
       const context = canvas.getContext("2d");
       if (!context) {
         URL.revokeObjectURL(url);
         setDownloadingQr(false);
         return;
       }
       context.fillStyle = "#ffffff";
       context.fillRect(0, 0, 1000, 1000);
       context.drawImage(image, 0, 0, 1000, 1000);
       URL.revokeObjectURL(url);
       const link = document.createElement("a");
       link.download = `${(member.full_name || "member").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-qr.png`;
       link.href = canvas.toDataURL("image/png");
       link.click();
       setDownloadingQr(false);
     };
     image.onerror = () => {
       URL.revokeObjectURL(url);
       setDownloadingQr(false);
     };
     image.src = url;
   } catch {
     setDownloadingQr(false);
   }
 }
 
 if (loading) {
   return <main className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></main>;
 }
 
 if (error || !member) {
   return (
     <main className="reception-responsive min-h-screen bg-background p-4 sm:p-6">
       <div className="mx-auto max-w-3xl">
         <Link to="/reception-workspace"><Button variant="ghost"><ArrowLeft />Back to Reception 2.0</Button></Link>
         <div className="mt-8 border border-destructive/30 bg-destructive/5 p-6">
           <h1 className="font-display text-2xl font-bold uppercase">Unable to Load Member</h1>
           <p className="mt-2 text-muted-foreground">{error || "Member not found."}</p>
         </div>
       </div>
     </main>
   );
 }
 
 const statusLabel = currentMembership
   ? isInside ? "Currently Inside" : "Active"
   : "Expired / Inactive";
 
 return (
   <main className="reception-responsive min-h-screen bg-background">
     <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
       <Link to="/reception-workspace"><Button variant="ghost" className="mb-6"><ArrowLeft />Back to Reception 2.0</Button></Link>
 
       {/* HEADER */}
       <section className="reception-profile-header mb-6 border border-border bg-card p-6">
         <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
           <div className="flex min-w-0 items-center gap-3 sm:gap-4">
             <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><UserRound className="h-8 w-8" /></div>
             <div className="min-w-0 flex-1">
               <h1 className="break-words font-display text-3xl font-black uppercase sm:text-4xl">{member.full_name || "Member"}</h1>
               <p className="mt-1 text-sm text-muted-foreground">Member Profile</p>
             </div>
           </div>
           <div className={`inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${currentMembership ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"}`}>
             {currentMembership ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
             {statusLabel}
           </div>
         </div>
         <div className="mt-5 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row">
           <a href={`/reception-register?memberId=${encodeURIComponent(member.id)}`} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#193b2a] px-5 py-3 text-sm font-black text-white hover:bg-[#2c5737]">
             {currentMembership ? "Add Membership / Renew" : "Add Membership"}<ArrowRight className="h-4 w-4" />
           </a>
           <a href="/reception-checkin" className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#ccd8cb] px-5 py-3 text-sm font-bold text-[#193b2a] hover:border-[#7fa06e]">
             Open QR Check-In<QrCode className="h-4 w-4" />
           </a>
         </div>
       </section>
 
       <div className="space-y-4">
         {/* PERSONAL */}
         <details className="group border border-border bg-card">
           <SectionSummary icon={<UserRound className="h-5 w-5" />} title="Personal Information" />
           <div className="grid gap-4 border-t border-border p-5 sm:grid-cols-2">
             <div><p className="text-xs font-semibold uppercase text-muted-foreground">Full Name</p><p className="mt-1 font-medium">{member.full_name || "—"}</p></div>
             <div><p className="text-xs font-semibold uppercase text-muted-foreground">Phone</p><p className="mt-1 flex items-center gap-2 font-medium"><Phone className="h-4 w-4 text-primary" />{member.phone || "—"}</p></div>
             <div><p className="text-xs font-semibold uppercase text-muted-foreground">Email</p><p className="mt-1 flex items-center gap-2 break-all font-medium"><Mail className="h-4 w-4 text-primary" />{member.email || "—"}</p></div>
             <div><p className="text-xs font-semibold uppercase text-muted-foreground">Birthday</p><p className="mt-1 flex items-center gap-2 font-medium"><Cake className="h-4 w-4 text-primary" />{getBirthday(member)}</p></div>
           </div>
         </details>
 
         {/* CURRENT MEMBERSHIP */}
         <details className="group border border-border bg-card" open>
           <SectionSummary icon={<CheckCircle2 className="h-5 w-5" />} title="Current Membership" summary={currentMembership?.plan_name || "No active membership"} />
           <div className="border-t border-border p-5">
             {currentMembership ? (
               <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                 <div><p className="text-xs font-semibold uppercase text-muted-foreground">Plan</p><p className="mt-1 font-display text-lg font-bold uppercase">{currentMembership.plan_name || "—"}</p></div>
                 <div><p className="text-xs font-semibold uppercase text-muted-foreground">Start Date</p><p className="mt-1 font-medium">{formatDate(currentMembership.start_date)}</p></div>
                 <div><p className="text-xs font-semibold uppercase text-muted-foreground">Expiry Date</p><p className="mt-1 font-medium">{formatDate(currentMembership.end_date)}</p></div>
                 <div><p className="text-xs font-semibold uppercase text-muted-foreground">Remaining</p><p className="mt-1 font-display text-lg font-bold">{remainingDays} {remainingDays === 1 ? "day" : "days"}</p></div>
               </div>
             ) : (
               <div className="flex items-center gap-3 rounded-lg bg-destructive/5 p-4 text-destructive"><XCircle className="h-5 w-5" /><p className="font-medium">This member currently has no valid membership.</p></div>
             )}
           </div>
         </details>
 
         {/* MEMBERSHIP HISTORY */}
         <details className="group border border-border bg-card">
           <SectionSummary icon={<CreditCard className="h-5 w-5" />} title="Membership History" summary={`${memberships.length} record${memberships.length === 1 ? "" : "s"}`} />
           <div className="border-t border-border">
             {memberships.length === 0 ? (
               <p className="p-5 text-muted-foreground">No membership history found.</p>
             ) : (
               <div className="divide-y divide-border">
                 {memberships.map((membership) => {
                   const active = isMembershipValidToday(membership);
                   const membershipStatus = String(membership.status || "").toLowerCase();
                   return (
                     <div key={membership.id} className="p-5">
                       <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                         <div>
                           <h3 className="font-display text-lg font-bold uppercase">{membership.plan_name || "Membership"}</h3>
                           <p className="mt-1 text-sm text-muted-foreground">{formatDate(membership.start_date)} → {formatDate(membership.end_date)}</p>
                         </div>
                         <div className="flex flex-wrap gap-2">
                           <span className={`rounded-full px-3 py-1 text-xs font-bold ${active ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"}`}>
                             {active ? "ACTIVE" : membershipStatus === "paused" ? "PAUSED" : membershipStatus === "cancelled" ? "CANCELLED" : "EXPIRED"}
                           </span>
                           {membership.payment_status && <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold uppercase">{membership.payment_status}</span>}
                         </div>
                       </div>
                       {isAdmin && (
                         <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                           {membershipStatus === "active" && membership.payment_status === "paid" && active && (
                             <Button type="button" variant="outline" disabled={processingMembershipId !== null} onClick={() => manageMembership(membership, "pause")}>Pause</Button>
                           )}
                           {membershipStatus === "paused" && (
                             <Button type="button" variant="outline" disabled={processingMembershipId !== null} onClick={() => manageMembership(membership, "resume")}>Resume</Button>
                           )}
                           {membership.payment_status === "paid" && membershipStatus !== "cancelled" && (
                             <Button type="button" variant="outline" disabled={processingMembershipId !== null} onClick={() => manageMembership(membership, "extend")}>Extend</Button>
                           )}
                           {membershipStatus !== "cancelled" && (
                             <Button type="button" variant="destructive" disabled={processingMembershipId !== null} onClick={() => manageMembership(membership, "cancel")}>Cancel Membership</Button>
                           )}
                         </div>
                       )}
                       <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                         <div><span className="text-muted-foreground">Status</span><p className="font-medium">{membership.status || "—"}</p></div>
                         <div><span className="text-muted-foreground">Source</span><p className="font-medium">{membership.source || "—"}</p></div>
                         <div><span className="text-muted-foreground">Created</span><p className="font-medium">{formatDateTime(membership.created_at)}</p></div>
                       </div>
                     </div>
                   );
                 })}
               </div>
             )}
           </div>
         </details>
 
         {/* PAYMENT HISTORY */}
         <details className="group border border-border bg-card">
           <SectionSummary icon={<CreditCard className="h-5 w-5" />} title="Payment History" summary={`${successfulPayments.length} successful payment${successfulPayments.length === 1 ? "" : "s"}`} />
           <div className="border-t border-border p-5">
             <div className="mb-5 rounded-lg bg-primary/5 p-4">
               <p className="text-xs font-semibold uppercase text-muted-foreground">Total Successful Payments</p>
               <p className="reception-money mt-1 break-words font-display text-2xl font-black">{formatNaira(totalPaid)}</p>
             </div>
             {payments.length === 0 ? (
               <p className="text-muted-foreground">No payment history found.</p>
             ) : (
               <div className="space-y-3">
                 {payments.map((payment) => (
                   <div key={payment.id} className="border border-border p-4">
                     <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                       <div>
                         <p className="font-display text-lg font-bold">{formatNaira(payment.amount)}</p>
                         <p className="text-sm text-muted-foreground">{formatDateTime(payment.paid_at || payment.created_at)}</p>
                       </div>
                       <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold uppercase ${String(payment.status).toLowerCase() === "success" ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"}`}>
                         {payment.status || "unknown"}
                       </span>
                     </div>
                     <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                       <div><span className="text-muted-foreground">Provider</span><p className="font-medium">{payment.provider || "—"}</p></div>
                       <div><span className="text-muted-foreground">Method</span><p className="font-medium">{payment.payment_method || "—"}</p></div>
                       <div><span className="text-muted-foreground">Reference</span><p className="break-all font-medium">{payment.paystack_reference || "—"}</p></div>
                     </div>
                   </div>
                 ))}
               </div>
             )}
           </div>
         </details>
 
         {/* ATTENDANCE HISTORY */}
         <details className="group border border-border bg-card">
           <SectionSummary icon={<LogIn className="h-5 w-5" />} title="Attendance History" summary={`${attendance.length} visit${attendance.length === 1 ? "" : "s"}`} />
           <div className="border-t border-border">
             {attendance.length === 0 ? (
               <p className="p-5 text-muted-foreground">No attendance history found.</p>
             ) : (
               <div className="divide-y divide-border">
                 {attendance.map((record) => (
                   <div key={record.id} className="p-5">
                     <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                       <div className="flex items-center gap-3">
                         <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary"><LogIn className="h-5 w-5" /></div>
                         <div><p className="font-bold">{formatDateTime(record.checked_in_at)}</p><p className="text-sm text-muted-foreground">Check-in</p></div>
                       </div>
                       <div className="flex items-center gap-3">
                         <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"><LogOut className="h-5 w-5" /></div>
                         <div><p className="font-bold">{record.checked_out_at ? formatDateTime(record.checked_out_at) : "Still inside"}</p><p className="text-sm text-muted-foreground">Check-out</p></div>
                       </div>
                     </div>
                   </div>
                 ))}
               </div>
             )}
           </div>
         </details>
 
         {/* QR */}
         <details className="group border border-border bg-card">
           <SectionSummary icon={<QrCode className="h-5 w-5" />} title="QR Code" />
           <div className="flex flex-col items-center border-t border-border p-6">
             {member.qr_token ? (
               <>
                 <div className="reception-profile-qr w-full max-w-[300px] rounded-xl bg-white p-5 shadow-sm">
                   <QRCodeSVG id="member-profile-qr" className="block h-auto max-w-full" value={member.qr_token} size={260} level="H" includeMargin />
                 </div>
                 <Button onClick={downloadQr} disabled={downloadingQr} className="mt-5">
                   {downloadingQr ? <Loader2 className="animate-spin" /> : <Download />}Download QR
                 </Button>
               </>
             ) : (
               <p className="text-muted-foreground">No QR code is assigned to this member.</p>
             )}
           </div>
         </details>
 
         {/* STATUS */}
         <details className="group border border-border bg-card" open>
           <SectionSummary icon={currentMembership ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />} title="Current Status" summary={statusLabel} />
           <div className="grid gap-4 border-t border-border p-5 sm:grid-cols-3">
             <div className="rounded-lg border border-border p-4">
               <p className="text-xs font-semibold uppercase text-muted-foreground">Membership</p>
               <p className={`mt-1 font-bold ${currentMembership ? "text-green-600" : "text-destructive"}`}>
                 {currentMembership ? "ACTIVE" : "EXPIRED / INACTIVE"}
               </p>
             </div>
             <div className="rounded-lg border border-border p-4">
               <p className="text-xs font-semibold uppercase text-muted-foreground">Gym Presence</p>
               <p className={`mt-1 font-bold ${isInside ? "text-green-600" : "text-muted-foreground"}`}>
                 {isInside ? "CURRENTLY INSIDE" : "NOT INSIDE"}
               </p>
             </div>
             <div className="rounded-lg border border-border p-4">
               <p className="text-xs font-semibold uppercase text-muted-foreground">Latest Membership</p>
               <p className="mt-1 font-bold">{latestMembership?.plan_name || "None"}</p>
             </div>
           </div>
         </details>
       </div>
     </div>
   </main>
 );
}

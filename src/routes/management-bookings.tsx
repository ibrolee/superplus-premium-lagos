import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { CalendarDays, CheckCircle2, Clock3, RefreshCw, XCircle } from "lucide-react";
import { AdminWorkspaceShell } from "@/components/admin/AdminWorkspaceShell";
import { supabase } from "@/lib/supabase";
import { spaStaff } from "../../supabase/functions/_shared/spa-services";
import { getFunctionErrorMessage } from "@/lib/user-error";

export const Route = createFileRoute("/management-bookings")({
  component: ManagementBookings,
});

type Booking = {
  id: string;
  member_id: string;
  spa?: boolean;
  amount?: number;
  reference?: string;
  assigned_staff?: string;
  service_type: string;
  service_name: string;
  preferred_at: string;
  notes: string;
  status: string;
  staff_note: string | null;
  created_at: string;
  member: {
    full_name: string | null;
    phone: string | null;
    email: string | null;
  } | null;
};

function dateTime(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: "Africa/Lagos",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function ManagementBookings() {
  const [rows, setRows] = useState<Booking[]>([]);
  const [status, setStatus] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    const query = supabase
      .from("member_bookings")
      .select(
        "id,member_id,service_type,service_name,preferred_at,notes,status,staff_note,created_at,member:members(full_name,phone,email)",
      )
      .order("preferred_at", { ascending: true });

    const spaQuery = supabase
      .from("spa_bookings")
      .select(
        "id,service_name,preferred_at,notes,status,staff_note,created_at,full_name,email,phone,amount,reference,assigned_staff",
      )
      .not("payment_id", "is", null)
      .order("preferred_at", { ascending: true });
    const [memberResult, spaResult] = await Promise.all([
      status === "all" ? query : query.eq("status", status),
      status === "all" ? spaQuery : spaQuery.eq("status", status),
    ]);
    const data = [
      ...(memberResult.data || []),
      ...(spaResult.data || []).map((b) => ({
        ...b,
        spa: true,
        service_type: "spa",
        member_id: "",
        member: { full_name: b.full_name, email: b.email, phone: b.phone },
      })),
    ].sort((a, b) => Date.parse(a.preferred_at) - Date.parse(b.preferred_at));
    const queryError = memberResult.error || spaResult.error;

    if (queryError) {
      setRows([]);
      setError(queryError.message);
    } else {
      setRows((data ?? []) as unknown as Booking[]);
    }

    setLoading(false);
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function assignSpaStaff(booking: Booking, person: string) {
    const { error: assignmentError } = await supabase
      .from("spa_bookings")
      .update({ assigned_staff: person || null, updated_at: new Date().toISOString() })
      .eq("id", booking.id);
    if (assignmentError) {
      window.alert(assignmentError.message);
      return;
    }
    await load();
  }

  async function setBookingStatus(booking: Booking, nextStatus: string) {
    if (booking.spa && nextStatus === "confirmed" && !booking.assigned_staff) {
      window.alert("Assign available spa staff before confirming this appointment.");
      return;
    }
    const promptLabel =
      nextStatus === "confirmed"
        ? "Optional note for the member (e.g. coach or room):"
        : nextStatus === "declined"
          ? "Optional reason for declining:"
          : "Optional staff note:";
    const note = window.prompt(promptLabel, booking.staff_note ?? "");
    if (note === null) return;

    if (
      booking.spa &&
      nextStatus === "declined" &&
      !window.confirm(
        "This booking is paid. Contact the customer to arrange an alternative or a Paystack refund. Declining does not refund the payment. Continue?",
      )
    )
      return;
    const { error: updateError } = await supabase
      .from(booking.spa ? "spa_bookings" : "member_bookings")
      .update({
        status: nextStatus,
        staff_note: note.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", booking.id);

    if (updateError) {
      window.alert(updateError.message);
      return;
    }

    let notificationError = "";
    if (!booking.spa && ["confirmed", "declined", "completed"].includes(nextStatus)) {
      const title =
        nextStatus === "confirmed"
          ? "Booking confirmed"
          : nextStatus === "declined"
            ? "Booking update"
            : "Session completed";
      const body =
        nextStatus === "confirmed"
          ? `${booking.service_name} is confirmed for ${dateTime(booking.preferred_at)}.${note.trim() ? ` ${note.trim()}` : ""}`
          : nextStatus === "declined"
            ? `Your ${booking.service_name} request could not be confirmed.${note.trim() ? ` ${note.trim()}` : ""}`
            : `Your ${booking.service_name} was marked completed. We hope you enjoyed it.`;

      const { error: pushError } = await supabase.functions.invoke("send-member-push", {
        body: {
          title,
          body,
          kind: "booking",
          deep_link: "/bookings",
          member_id: booking.member_id,
          send_push: true,
        },
      });
      if (pushError) {
        notificationError = `Booking updated, but member notification failed: ${await getFunctionErrorMessage(pushError, "Notification could not be sent.")}`;
      }
    }

    await load();
    if (notificationError) setError(notificationError);
  }

  return (
    <AdminWorkspaceShell
      title="Member & spa bookings"
      subtitle="Manage app requests and paid website spa bookings. Assign who performed the service; completed paid spa bookings automatically earn that worker a 30% commission."
      active="/management-bookings"
    >
      <section className="mt-7 rounded-[24px] border border-[var(--portal-border)] bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {["pending", "confirmed", "completed", "declined", "cancelled", "all"].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setStatus(item)}
                className={
                  "rounded-full px-4 py-2 text-xs font-black capitalize " +
                  (status === item
                    ? "bg-[var(--portal-ink)] text-white"
                    : "border border-[var(--portal-border)] bg-[var(--portal-canvas)] text-[color:var(--portal-muted)]")
                }
              >
                {item}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--portal-border)] px-4 py-2.5 text-xs font-bold"
          >
            <RefreshCw size={15} /> Refresh
          </button>
        </div>

        {loading && (
          <p role="status" className="mt-6 rounded-xl bg-[var(--portal-canvas)] p-5 text-sm">
            Loading booking requests…
          </p>
        )}

        {!loading && error && (
          <p
            role="alert"
            className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"
          >
            {error}
          </p>
        )}

        {!loading && !error && !rows.length && (
          <p className="mt-6 rounded-xl border border-dashed border-[var(--portal-border)] p-8 text-center text-sm text-[color:var(--portal-muted)]">
            No {status === "all" ? "" : status} booking requests.
          </p>
        )}

        {!loading && !error && !!rows.length && (
          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {rows.map((booking) => (
              <article
                key={booking.id}
                className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-canvas)] p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[.16em] text-[color:var(--portal-muted)]">
                      {booking.service_type.replaceAll("_", " ")}
                    </p>
                    <h2 className="mt-1 text-xl font-black">{booking.service_name}</h2>
                    <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--portal-muted)]">
                      <CalendarDays size={16} /> {dateTime(booking.preferred_at)}
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[color:var(--portal-muted)]">
                    {booking.status}
                  </span>
                </div>

                <div className="mt-4 rounded-xl bg-white p-4">
                  <p className="font-black">{booking.member?.full_name || "Member"}</p>
                  <p className="mt-1 text-xs text-[color:var(--portal-muted)]">
                    {booking.member?.phone || "No phone"} · {booking.member?.email || "No email"}
                  </p>
                </div>

                {booking.spa && (
                  <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm">
                    <strong>Paid · ₦{Number(booking.amount).toLocaleString("en-NG")}</strong>
                    <p className="mt-1 break-all text-xs">{booking.reference}</p>
                    <label className="mt-3 block text-xs font-bold">
                      Assign spa staff
                      <select
                        value={booking.assigned_staff || ""}
                        onChange={(e) => void assignSpaStaff(booking, e.target.value)}
                        disabled={["completed", "declined", "cancelled"].includes(booking.status)}
                        className="mt-2 min-h-11 w-full rounded-xl border bg-white px-3 text-sm"
                      >
                        <option value="">Unassigned</option>
                        {spaStaff.map((person) => (
                          <option key={person} value={person}>
                            {person}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="mt-2 text-xs">
                      Contact the customer using the details above to confirm the time. Declining
                      does not issue a refund.
                    </p>
                  </div>
                )}
                {!!booking.notes && (
                  <p className="mt-4 text-sm leading-6 text-[color:var(--portal-muted)]">
                    <strong>Member note:</strong> {booking.notes}
                  </p>
                )}
                {!!booking.staff_note && (
                  <p className="mt-2 text-sm leading-6 text-[color:var(--portal-muted)]">
                    <strong>Staff note:</strong> {booking.staff_note}
                  </p>
                )}

                <div className="mt-5 flex flex-wrap gap-2">
                  {booking.status === "pending" && (
                    <>
                      <button
                        type="button"
                        onClick={() => void setBookingStatus(booking, "confirmed")}
                        className="inline-flex items-center gap-2 rounded-xl bg-[var(--portal-ink)] px-4 py-2.5 text-xs font-bold text-white"
                      >
                        <CheckCircle2 size={15} /> Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => void setBookingStatus(booking, "declined")}
                        className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-xs font-bold text-red-700"
                      >
                        <XCircle size={15} /> Decline
                      </button>
                    </>
                  )}
                  {booking.status === "confirmed" && (
                    <button
                      type="button"
                      onClick={() => void setBookingStatus(booking, "completed")}
                      className="inline-flex items-center gap-2 rounded-xl bg-[var(--portal-ink)] px-4 py-2.5 text-xs font-bold text-white"
                    >
                      <CheckCircle2 size={15} /> Mark completed
                    </button>
                  )}
                  <span className="inline-flex items-center gap-2 rounded-xl border border-[var(--portal-border)] px-3 py-2 text-[11px] font-semibold text-[color:var(--portal-muted)]">
                    <Clock3 size={14} /> Requested {dateTime(booking.created_at)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </AdminWorkspaceShell>
  );
}

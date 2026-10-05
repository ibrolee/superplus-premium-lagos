import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { CalendarDays, CheckCircle2, Clock3, RefreshCw, XCircle } from "lucide-react";
import { AdminWorkspaceShell } from "@/components/admin/AdminWorkspaceShell";
import { supabase } from "@/lib/supabase";
import { getFunctionErrorMessage } from "@/lib/user-error";

export const Route = createFileRoute("/management-bookings")({
  component: ManagementBookings,
});

type Booking = {
  id: string;
  member_id: string;
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

    const { data, error: queryError } =
      status === "all" ? await query : await query.eq("status", status);

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

  async function setBookingStatus(booking: Booking, nextStatus: string) {
    const promptLabel =
      nextStatus === "confirmed"
        ? "Optional note for the member (e.g. coach or room):"
        : nextStatus === "declined"
          ? "Optional reason for declining:"
          : "Optional staff note:";
    const note = window.prompt(promptLabel, booking.staff_note ?? "");
    if (note === null) return;

    const { error: updateError } = await supabase
      .from("member_bookings")
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

    if (["confirmed", "declined", "completed"].includes(nextStatus)) {
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
        setError(`Booking updated, but member notification failed: ${await getFunctionErrorMessage(pushError, "Notification could not be sent.")}`);
      }
    }

    await load();
  }

  return (
    <AdminWorkspaceShell
      title="Member bookings"
      subtitle="Confirm and manage class, personal training and spa requests from the mobile app."
      active="/management-bookings"
    >
      <section className="mt-7 rounded-[24px] border border-[#e1e8dd] bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {["pending", "confirmed", "completed", "declined", "cancelled", "all"].map(
              (item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setStatus(item)}
                  className={
                    "rounded-full px-4 py-2 text-xs font-black capitalize " +
                    (status === item
                      ? "bg-[#193b2a] text-white"
                      : "border border-[#d8e2d5] bg-[#f8faf6] text-[#395844]")
                  }
                >
                  {item}
                </button>
              ),
            )}
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-xl border border-[#d8e2d5] px-4 py-2.5 text-xs font-bold"
          >
            <RefreshCw size={15} /> Refresh
          </button>
        </div>

        {loading && (
          <p role="status" className="mt-6 rounded-xl bg-[#f4f6f1] p-5 text-sm">
            Loading booking requests…
          </p>
        )}

        {!loading && error && (
          <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
            {error}
          </p>
        )}

        {!loading && !error && !rows.length && (
          <p className="mt-6 rounded-xl border border-dashed border-[#d8e2d5] p-8 text-center text-sm text-[#647468]">
            No {status === "all" ? "" : status} booking requests.
          </p>
        )}

        {!loading && !error && !!rows.length && (
          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {rows.map((booking) => (
              <article
                key={booking.id}
                className="rounded-2xl border border-[#dce8d9] bg-[#f8faf6] p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#65905c]">
                      {booking.service_type.replaceAll("_", " ")}
                    </p>
                    <h2 className="mt-1 text-xl font-black">{booking.service_name}</h2>
                    <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-[#47604d]">
                      <CalendarDays size={16} /> {dateTime(booking.preferred_at)}
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#395844]">
                    {booking.status}
                  </span>
                </div>

                <div className="mt-4 rounded-xl bg-white p-4">
                  <p className="font-black">{booking.member?.full_name || "Member"}</p>
                  <p className="mt-1 text-xs text-[#647468]">
                    {booking.member?.phone || booking.member?.email || "No contact"}
                  </p>
                </div>

                {!!booking.notes && (
                  <p className="mt-4 text-sm leading-6 text-[#586a5c]">
                    <strong>Member note:</strong> {booking.notes}
                  </p>
                )}
                {!!booking.staff_note && (
                  <p className="mt-2 text-sm leading-6 text-[#586a5c]">
                    <strong>Staff note:</strong> {booking.staff_note}
                  </p>
                )}

                <div className="mt-5 flex flex-wrap gap-2">
                  {booking.status === "pending" && (
                    <>
                      <button
                        type="button"
                        onClick={() => void setBookingStatus(booking, "confirmed")}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#193b2a] px-4 py-2.5 text-xs font-bold text-white"
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
                      className="inline-flex items-center gap-2 rounded-xl bg-[#193b2a] px-4 py-2.5 text-xs font-bold text-white"
                    >
                      <CheckCircle2 size={15} /> Mark completed
                    </button>
                  )}
                  <span className="inline-flex items-center gap-2 rounded-xl border border-[#d8e2d5] px-3 py-2 text-[11px] font-semibold text-[#647468]">
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

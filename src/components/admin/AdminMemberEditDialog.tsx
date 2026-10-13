import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Pencil, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

type MemberSummary = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
};

type Field =
  | "full_name" | "email" | "phone" | "date_of_birth" | "birth_day"
  | "birth_month" | "gender" | "address" | "address_street"
  | "address_city" | "address_state" | "address_zip"
  | "address_country" | "notes" | "labels";

type FormValues = Record<Field, string>;
type MemberDetails = MemberSummary & {
  auth_user_id: string | null;
  updated_at: string;
} & Partial<Record<Field, string | number | null>>;

const editableFields: Field[] = [
  "full_name", "email", "phone", "date_of_birth", "birth_day", "birth_month",
  "gender", "address", "address_street", "address_city", "address_state",
  "address_zip", "address_country", "notes", "labels",
];

function valuesFromMember(member: MemberDetails): FormValues {
  const values = {} as FormValues;
  for (const field of editableFields) values[field] = String(member[field] ?? "");
  return values;
}

const inputClass = "mt-1.5 w-full min-w-0 rounded-xl border border-[#ced9ca] bg-white px-3.5 py-3 text-sm text-[#193327] outline-none focus:border-[#4d824d] focus:ring-2 focus:ring-[#b8ee73]/30 disabled:bg-gray-100";

export function AdminMemberEditDialog({ member, onClose, onSaved }: {
  member: MemberSummary;
  onClose: () => void;
  onSaved: (updated: MemberSummary) => void;
}) {
  const [record, setRecord] = useState<MemberDetails | null>(null);
  const [form, setForm] = useState<FormValues | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setRecord(null);
    setForm(null);
    void (async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from("members")
          .select("id,full_name,email,phone,auth_user_id,updated_at,date_of_birth,birth_day,birth_month,gender,address,address_street,address_city,address_state,address_zip,address_country,notes,labels")
          .eq("id", member.id).maybeSingle();
        if (fetchError) throw fetchError;
        if (!data || data.id !== member.id) throw new Error("Member profile not found. Refresh the members list.");
        if (!cancelled) {
          const current = data as MemberDetails;
          setRecord(current);
          setForm(valuesFromMember(current));
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load member details.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [member.id]);

  function change(field: Field, value: string) {
    setForm((previous) => previous ? { ...previous, [field]: value } : previous);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || loading || !record || !form) return;
    setError("");
    if (form.full_name.trim().length < 2) { setError("Enter the member's full name."); return; }
    if (form.phone.trim()) {
      const digits = form.phone.replace(/\D/g, "");
      if (digits.length < 10 || digits.length > 15) {
        setError("The phone number must contain 10 to 15 digits."); return;
      }
    }
    if (!form.date_of_birth && Boolean(form.birth_day) !== Boolean(form.birth_month)) {
      setError("Enter both birthday day and month, or leave both blank."); return;
    }
    setSaving(true);
    try {
      const { data, error: saveError } = await supabase.rpc("admin_update_member_profile", {
        p_member_id: member.id,
        p_expected_updated_at: record.updated_at,
        p_profile: form,
      });
      if (saveError) throw saveError;
      if (!data?.success || data.member_id !== member.id || data.login_changed !== false) {
        throw new Error("The server did not confirm the profile update.");
      }
      onSaved({ id: member.id, full_name: data.profile?.full_name ?? null,
        email: data.profile?.email ?? null, phone: data.profile?.phone ?? null });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the profile.");
    } finally {
      setSaving(false);
    }
  }

  const field = (key: Field, label: string, type = "text", placeholder?: string) => (
    <label key={key} className="block min-w-0 text-xs font-bold text-[#304838]">
      {label}
      <input type={type} value={form?.[key] ?? ""}
        onChange={(event) => change(key, event.target.value)}
        disabled={saving || (Boolean(form?.date_of_birth) && (key === "birth_day" || key === "birth_month"))}
        placeholder={placeholder}
        maxLength={key === "address" ? 1000 : 250}
        min={key === "birth_day" || key === "birth_month" ? "1" : type === "date" ? "1900-01-01" : undefined}
        max={key === "birth_day" ? "31" : key === "birth_month" ? "12" : type === "date" ? new Date().toISOString().slice(0, 10) : undefined}
        className={inputClass} />
    </label>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/65 p-3 sm:p-5">
      <section role="dialog" aria-modal="true" aria-labelledby="edit-member-title"
        className="my-auto flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-[#f8faf6] shadow-2xl">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[#dfe7dc] bg-white px-5 py-4 sm:px-7">
          <div className="min-w-0">
            <h2 id="edit-member-title" className="flex items-center gap-2 text-xl font-black text-[#193327]">
              <Pencil size={20} className="text-[#518c43]" /> Edit Profile
            </h2>
            <p className="mt-1 break-words text-sm text-[#526b57]">{member.full_name || "Unnamed member"}</p>
            <p className="mt-1 break-all text-[11px] text-[#728374]">Member ID: {member.id}</p>
          </div>
          <button type="button" aria-label="Close edit profile" disabled={saving} onClick={onClose}
            className="rounded-lg p-2 hover:bg-[#f1f5ed] disabled:opacity-50"><X size={22} /></button>
        </header>
        {loading && <p role="status" className="flex items-center gap-2 px-6 py-10 text-sm text-[#637469]"><Loader2 className="animate-spin" size={18} /> Loading the latest profile…</p>}
        {!loading && !form && <div className="space-y-4 p-6"><p role="alert" className="text-sm text-red-700">{error || "Unable to load this profile."}</p><button type="button" onClick={onClose} className="rounded-xl border px-5 py-3 text-sm font-bold">Close</button></div>}
        {!loading && form && (
          <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-7">
              <p className="rounded-xl border border-[#d4e6c8] bg-[#eff8e9] p-3 text-xs text-[#38583c]">
                You are editing personal details only. Memberships, payments, attendance, QR codes, card numbers and login credentials will not change.
              </p>
              {record?.auth_user_id && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                This member has a login. Changing the profile email here does not change the email they use to sign in.
              </p>}
              <div>
                <h3 className="mb-3 text-sm font-black text-[#193327]">Identity and contact</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {field("full_name", "Full name *")}
                  {field("phone", "Phone number", "tel")}
                  {field("email", "Profile email", "email")}
                  {field("gender", "Gender (optional)")}
                  {field("date_of_birth", "Full date of birth", "date")}
                </div>
                <p className="mt-3 text-xs text-[#637469]">If the birth year is unknown, leave the full date blank and use birthday day and month below. A full date automatically sets the birthday.</p>
                <div className="mt-3 grid grid-cols-2 gap-4 sm:max-w-sm">
                  {field("birth_day", "Birthday day", "number", "1–31")}
                  {field("birth_month", "Birthday month", "number", "1–12")}
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-black text-[#193327]">Address</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {field("address", "Full address")}
                  {field("address_street", "Street")}
                  {field("address_city", "City")}
                  {field("address_state", "State")}
                  {field("address_zip", "Postal code")}
                  {field("address_country", "Country")}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {field("labels", "Labels")}
                <label className="block min-w-0 text-xs font-bold text-[#304838] sm:col-span-2">
                  Admin notes
                  <textarea value={form.notes} onChange={(event) => change("notes", event.target.value)} rows={4} maxLength={5000} disabled={saving} className={inputClass} />
                </label>
              </div>
              {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
            </div>
            <footer className="flex shrink-0 flex-wrap justify-end gap-3 border-t border-[#dfe7dc] bg-white px-5 py-4 sm:px-7">
              <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-[#d2ddd0] px-5 py-3 text-sm font-bold disabled:opacity-50">Cancel</button>
              <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#193b2a] px-5 py-3 text-sm font-black text-white disabled:opacity-50">
                {saving && <Loader2 size={16} className="animate-spin" />}
                {saving ? "Saving…" : "Save profile changes"}
              </button>
            </footer>
          </form>
        )}
      </section>
    </div>
  );
}

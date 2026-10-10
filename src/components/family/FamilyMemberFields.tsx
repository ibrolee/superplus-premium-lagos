export type FamilyMemberInput = {
  mode: "new" | "existing";
  fullName: string;
  email: string;
  phone: string;
  birthDay: string;
  birthMonth: string;
};

export const emptyFamilyMember = (mode: "new" | "existing" = "new"): FamilyMemberInput => ({
  mode,
  fullName: "",
  email: "",
  phone: "",
  birthDay: "",
  birthMonth: "",
});

export function familyMemberPayload(value: FamilyMemberInput) {
  if (value.mode === "existing") {
    return { mode: "existing", email: value.email.trim().toLowerCase(), phone: value.phone.trim() };
  }
  return {
    mode: "new",
    fullName: value.fullName.trim(),
    email: value.email.trim().toLowerCase(),
    phone: value.phone.trim(),
    birthDay: Number(value.birthDay),
    birthMonth: Number(value.birthMonth),
  };
}

export function familyMemberValid(value: FamilyMemberInput) {
  if (!value.email.trim().includes("@") || value.phone.replace(/\D/g, "").length < 7) return false;
  if (value.mode === "existing") return true;
  const day = Number(value.birthDay), month = Number(value.birthMonth);
  return value.fullName.trim().length >= 2 && Number.isInteger(day) && day >= 1 && day <= 31 &&
    Number.isInteger(month) && month >= 1 && month <= 12;
}

export function FamilyMemberFields({
  label,
  value,
  onChange,
  disabled = false,
  allowNew = true,
}: {
  label: string;
  value: FamilyMemberInput;
  onChange: (next: FamilyMemberInput) => void;
  disabled?: boolean;
  allowNew?: boolean;
}) {
  const set = (patch: Partial<FamilyMemberInput>) => onChange({ ...value, ...patch });
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-primary">{label}</p>
          <h2 className="mt-1 text-lg font-bold">{value.mode === "existing" ? "Existing gym member" : "New gym member"}</h2>
        </div>
        <div className="flex rounded-xl border bg-muted/30 p-1 text-xs font-bold">
          <button type="button" disabled={disabled} onClick={() => set({ mode: "existing", fullName: "", birthDay: "", birthMonth: "" })}
            className={`rounded-lg px-3 py-2 ${value.mode === "existing" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>Existing</button>
          {allowNew && <button type="button" disabled={disabled} onClick={() => set({ mode: "new" })}
            className={`rounded-lg px-3 py-2 ${value.mode === "new" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>New</button>}
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        {value.mode === "existing"
          ? "Use the same email and phone number already saved on the member's Super Plus profile."
          : "A new Super Plus member profile, QR identity and membership record will be created after verified payment."}
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {value.mode === "new" && <label className="sm:col-span-2 text-sm font-medium">Full name
          <input value={value.fullName} onChange={(e) => set({ fullName: e.target.value })} disabled={disabled} required
            className="mt-2 h-12 w-full rounded-xl border bg-background px-4 outline-none focus:border-primary" placeholder="Full name" />
        </label>}
        <label className="text-sm font-medium">Email address
          <input type="email" value={value.email} onChange={(e) => set({ email: e.target.value })} disabled={disabled} required
            className="mt-2 h-12 w-full rounded-xl border bg-background px-4 outline-none focus:border-primary" placeholder="name@example.com" />
        </label>
        <label className="text-sm font-medium">Phone number
          <input type="tel" value={value.phone} onChange={(e) => set({ phone: e.target.value })} disabled={disabled} required
            className="mt-2 h-12 w-full rounded-xl border bg-background px-4 outline-none focus:border-primary" placeholder="08012345678" />
        </label>
        {value.mode === "new" && <>
          <label className="text-sm font-medium">Birth day
            <select value={value.birthDay} onChange={(e) => set({ birthDay: e.target.value })} disabled={disabled} required
              className="mt-2 h-12 w-full rounded-xl border bg-background px-3">
              <option value="">Day</option>{Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Birth month
            <select value={value.birthMonth} onChange={(e) => set({ birthMonth: e.target.value })} disabled={disabled} required
              className="mt-2 h-12 w-full rounded-xl border bg-background px-3">
              <option value="">Month</option>
              {["January","February","March","April","May","June","July","August","September","October","November","December"].map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </label>
        </>}
      </div>
    </section>
  );
}

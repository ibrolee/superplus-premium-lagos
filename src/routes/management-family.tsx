import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FamilyMemberFields, emptyFamilyMember, familyMemberPayload, familyMemberValid, type FamilyMemberInput } from "@/components/family/FamilyMemberFields";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/management-family")({ component: ManagementFamily });

type Member = { id: string; full_name: string; email: string | null; phone: string | null; member_card_number: number | null };
type Staff = { role: string; active: boolean };

function ManagementFamily() {
  const [role, setRole] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [query, setQuery] = useState("");
  const [primary, setPrimary] = useState<Member | null>(null);
  const [slot2, setSlot2] = useState<FamilyMemberInput>(emptyFamilyMember("existing"));
  const [slot3, setSlot3] = useState<FamilyMemberInput>(emptyFamilyMember("existing"));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) throw new Error("Staff sign-in is required.");
        const { data: staff, error: staffError } = await supabase.from("staff_users").select("role,active").eq("auth_user_id", auth.user.id).maybeSingle();
        if (staffError) throw staffError;
        const access = String((staff as Staff | null)?.role || "").toLowerCase();
        if (!(staff as Staff | null)?.active || !["reception","admin","owner","manager"].includes(access)) throw new Error("Reception or management access is required.");
        const { data: people, error: peopleError } = await supabase.from("members").select("id,full_name,email,phone,member_card_number").order("full_name").limit(1000);
        if (peopleError) throw peopleError;
        if (!active) return;
        setRole(access);
        setMembers((people || []) as Member[]);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to load Family Plan setup.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length < 2) return [];
    return members.filter((m) => [m.full_name,m.email || "",m.phone || "",m.member_card_number ? `SPF-${String(m.member_card_number).padStart(6,"0")}` : ""].some((v) => v.toLowerCase().includes(needle))).slice(0, 12);
  }, [members, query]);

  async function configure() {
    if (!primary) { setError("Choose the primary member who already has the paid Family Plan."); return; }
    if (!familyMemberValid(slot2) || !familyMemberValid(slot3)) { setError("Complete valid details for family members 2 and 3."); return; }
    const emails = [primary.email || "",slot2.email,slot3.email].map((v) => v.trim().toLowerCase());
    if (new Set(emails).size !== 3) { setError("All three family members must use different email addresses."); return; }
    setBusy(true);setError("");setNotice("");
    try {
      const { data, error: rpcError } = await supabase.rpc("configure_paid_family_group", {
        p_primary_member_id: primary.id,
        p_member_2: familyMemberPayload(slot2),
        p_member_3: familyMemberPayload(slot3),
      });
      if (rpcError) throw rpcError;
      setNotice(data?.already_complete ? "This paid Family Plan already has all three members linked." : `Family Plan setup complete. All three members share ${data?.start_date || "the same start date"} to ${data?.end_date || "the same expiry date"}.`);
      setSlot2(emptyFamilyMember("existing"));setSlot3(emptyFamilyMember("existing"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to configure Family Plan.");
    } finally { setBusy(false); }
  }

  const allowNew = role !== "reception";
  return <main className="min-h-screen bg-[#f4f6f1] px-4 py-9 text-[#16221c] sm:px-8"><div className="mx-auto max-w-6xl">
    <a href="/management-operations" className="inline-flex items-center gap-2 text-sm font-bold text-[#356942]"><ArrowLeft size={17}/> Operations</a>
    <div className="mt-5"><p className="text-xs font-black uppercase tracking-[.2em] text-[#65905c]">Membership operations</p><h1 className="mt-2 text-3xl font-black sm:text-5xl">Family Plan setup</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-[#637469]">Use this after the primary member already has a verified paid Family Plan. It links the other two people to that exact paid period without taking another payment. Existing members are reused; management can also create new member profiles.</p></div>
    {loading && <div className="mt-8 flex items-center gap-3 rounded-2xl border bg-white p-6 text-sm"><Loader2 className="size-5 animate-spin"/> Loading members…</div>}
    {!loading && <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
      <section className="space-y-5">
        <div className="rounded-2xl border bg-white p-5 sm:p-6">
          <h2 className="text-lg font-black">1. Find the paid primary member</h2>
          <p className="mt-2 text-xs leading-5 text-[#657568]">Search by name, email, phone or permanent card number.</p>
          <label className="mt-4 block text-sm font-bold">Member search<div className="relative mt-2"><Search className="absolute left-3 top-3.5 size-4 text-[#728177]"/><input value={query} onChange={(e) => {setQuery(e.target.value);setPrimary(null);}} className="h-12 w-full rounded-xl border pl-10 pr-4 outline-none" placeholder="Start typing…"/></div></label>
          {filtered.length > 0 && <div className="mt-3 max-h-72 overflow-y-auto rounded-xl border">{filtered.map((m) => <button key={m.id} type="button" onClick={() => {setPrimary(m);setQuery(m.full_name);}} className={`block w-full border-b p-3 text-left text-sm last:border-b-0 ${primary?.id===m.id?"bg-[#eef6e9]":"bg-white hover:bg-[#f7faf5]"}`}><strong>{m.full_name}</strong><span className="mt-1 block text-xs text-[#718075]">{m.email || "No email"} · {m.phone || "No phone"}{m.member_card_number ? ` · SPF-${String(m.member_card_number).padStart(6,"0")}` : ""}</span></button>)}</div>}
          {primary && <div className="mt-4 rounded-xl bg-[#eef6e9] p-4 text-sm"><CheckCircle2 className="mr-2 inline size-4 text-[#356942]"/><strong>{primary.full_name}</strong> selected as primary Family Plan member.</div>}
        </div>
        <FamilyMemberFields label="2. Family member 2" value={slot2} onChange={setSlot2} disabled={busy} allowNew={allowNew}/>
        <FamilyMemberFields label="3. Family member 3" value={slot3} onChange={setSlot3} disabled={busy} allowNew={allowNew}/>
      </section>
      <aside className="rounded-2xl border bg-white p-6 lg:sticky lg:top-6">
        <div className="flex items-center gap-3"><Users className="size-5 text-[#356942]"/><h2 className="font-black">Complete family group</h2></div>
        <p className="mt-4 text-sm leading-6 text-[#657568]">The two added people receive their own membership rows with the <strong>same start and expiry dates</strong> as the already-paid primary Family Plan.</p>
        {role === "reception" && <p className="mt-4 rounded-xl bg-amber-50 p-4 text-xs leading-5 text-amber-900">Reception can attach existing members. Creating brand-new member profiles remains restricted to management/admin as part of the existing payment-control rules.</p>}
        {error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
        {notice && <div role="status" className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-900">{notice}</div>}
        <Button className="mt-5 w-full" size="lg" disabled={busy || !primary} onClick={() => void configure()}>{busy ? <><Loader2 className="mr-2 size-4 animate-spin"/>Saving…</> : "Link all 3 family members"}</Button>
      </aside>
    </div>}
  </div></main>;
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FamilyMemberFields, emptyFamilyMember, familyMemberPayload, familyMemberValid, type FamilyMemberInput } from "@/components/family/FamilyMemberFields";
import { formatNaira, membershipPlans } from "@/lib/site-data";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/member-family")({ component: MemberFamilyPage });

type Member = { id: string; full_name: string | null; email: string | null; phone: string | null };
type FamilySummary = {
  group_id: string;
  is_primary: boolean;
  primary_member_id: string;
  members: { slot: number; member_id: string; full_name: string | null; email: string | null }[];
  latest_end_date: string | null;
};

function MemberFamilyPage() {
  const navigate = useNavigate();
  const plan = membershipPlans.find((item) => item.id === "family");
  const [member, setMember] = useState<Member | null>(null);
  const [summary, setSummary] = useState<FamilySummary | null>(null);
  const [slot2, setSlot2] = useState<FamilyMemberInput>(emptyFamilyMember());
  const [slot3, setSlot3] = useState<FamilyMemberInput>(emptyFamilyMember());
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { navigate({ to: "/login" }); return; }
        const { data: person, error: memberError } = await supabase.from("members").select("id,full_name,email,phone").eq("auth_user_id", session.user.id).maybeSingle();
        if (memberError) throw memberError;
        if (!person) throw new Error("Your signed-in account is not linked to a gym member profile.");
        const { data: family, error: familyError } = await supabase.rpc("get_my_family_summary");
        if (familyError) throw familyError;
        if (!active) return;
        setMember(person as Member);
        setSummary((family || null) as FamilySummary | null);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to load Family Plan details.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [navigate]);

  async function pay() {
    if (!plan || !member) return;
    setError("");
    const completeExistingGroup = summary?.is_primary && summary.members?.length === 3;
    if (summary && !summary.is_primary) { setError("Only the primary family account can renew this Family Plan."); return; }
    if (summary && summary.members.length !== 3) { setError("This family group is incomplete. Reception must finish all three family slots before renewal."); return; }
    if (!summary) {
      if (!familyMemberValid(slot2) || !familyMemberValid(slot3)) { setError("Complete valid details for family members 2 and 3."); return; }
      const emails = [member.email || "", slot2.email, slot3.email].map((v) => v.trim().toLowerCase());
      if (!member.email || new Set(emails).size !== 3) { setError("All three family members must use different email addresses."); return; }
    }
    setPaying(true);
    try {
      const body: Record<string, unknown> = { planId: "family" };
      if (!completeExistingGroup) body.familyMembers = [familyMemberPayload(slot2), familyMemberPayload(slot3)];
      const { data, error: functionError } = await supabase.functions.invoke("initialize-payment", { body });
      if (functionError) throw new Error(data?.error || functionError.message || "Unable to start Family Plan payment.");
      if (!data?.authorization_url) throw new Error(data?.error || "Unable to start Paystack checkout.");
      window.location.href = data.authorization_url;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to start payment.");
      setPaying(false);
    }
  }

  if (!plan) return <main className="min-h-screen p-8">Family Plan is unavailable.</main>;
  return <main className="min-h-screen bg-background">
    <section className="border-b bg-card"><div className="mx-auto max-w-5xl px-5 py-5 sm:px-6"><Link to="/member" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4"/> Back to dashboard</Link></div></section>
    <section className="px-5 py-10 sm:px-6 sm:py-14"><div className="mx-auto max-w-5xl">
      <p className="text-sm font-bold uppercase tracking-[.18em] text-primary">Member Family Plan</p>
      <h1 className="mt-3 text-3xl font-black sm:text-5xl">Manage or renew your three-person Family Plan.</h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">The primary account pays once. All three people keep separate member profiles, QR/member cards and attendance histories, while sharing the same Family Plan dates.</p>
      {loading && <div className="mt-8 flex items-center gap-3 rounded-2xl border bg-card p-6 text-sm"><Loader2 className="size-5 animate-spin"/> Loading family membership…</div>}
      {!loading && member && <>
        <div className="mt-7 rounded-2xl border bg-card p-5">
          <p className="text-xs font-bold uppercase tracking-[.15em] text-muted-foreground">Primary signed-in member</p>
          <p className="mt-2 text-lg font-bold">{member.full_name || "Member"}</p><p className="text-sm text-muted-foreground">{member.email}</p>
        </div>

        {summary && !summary.is_primary && <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
          You are covered by a Family Plan, but this account is not the primary payer. Renewal must be started from the primary family member's account or through reception.
        </div>}

        {summary?.is_primary && summary.members.length === 3 && <section className="mt-6 rounded-2xl border bg-card p-6">
          <div className="flex items-center gap-3"><CheckCircle2 className="size-5 text-primary"/><h2 className="text-xl font-bold">Current family group</h2></div>
          <div className="mt-5 space-y-3">{summary.members.map((item) => <div key={item.member_id} className="flex items-center justify-between gap-4 rounded-xl bg-muted/30 p-4">
            <div><p className="text-xs font-bold uppercase text-muted-foreground">Family member {item.slot}</p><p className="font-bold">{item.full_name || "Member"}</p><p className="text-xs text-muted-foreground">{item.email}</p></div>
            {item.slot === 1 && <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">Primary</span>}
          </div>)}</div>
          {summary.latest_end_date && <p className="mt-4 text-sm text-muted-foreground">Latest recorded family expiry: <strong className="text-foreground">{summary.latest_end_date}</strong></p>}
        </section>}

        {!summary && <div className="mt-6 space-y-5">
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 text-sm leading-6"><div className="flex gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary"/><p>Add the other two family members below. Each can be new or existing. Existing profiles are reused. If one of the three still has paid access, the new family term starts after the latest current expiry so all three share the same dates.</p></div></div>
          <FamilyMemberFields label="Family member 2" value={slot2} onChange={setSlot2} disabled={paying}/>
          <FamilyMemberFields label="Family member 3" value={slot3} onChange={setSlot3} disabled={paying}/>
        </div>}

        {summary?.is_primary && summary.members.length !== 3 && <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950">This older Family Plan record has not yet been fully linked to three people. Please ask reception to complete the Family Plan setup before paying again.</div>}

        {error && <div role="alert" className="mt-6 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}
        {(!summary || (summary.is_primary && summary.members.length === 3)) && <div className="mt-7 rounded-2xl border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase text-muted-foreground">Family Plan</p><p className="mt-1 text-3xl font-black">{formatNaira(plan.price)}</p><p className="mt-1 text-xs text-muted-foreground">Existing member-account checkout. No new registration fee is added here.</p></div>
          <Button size="lg" onClick={() => void pay()} disabled={paying || Boolean(summary && !summary.is_primary)}>{paying ? <><Loader2 className="mr-2 size-4 animate-spin"/>Connecting…</> : <>Continue to Paystack <ArrowRight className="ml-2 size-4"/></>}</Button></div>
        </div>}
      </>}
      {!loading && !member && error && <div className="mt-8 rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">{error}</div>}
    </div></section>
  </main>;
}

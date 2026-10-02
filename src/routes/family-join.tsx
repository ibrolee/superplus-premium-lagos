import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Loader2, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FamilyMemberFields, emptyFamilyMember, familyMemberPayload, familyMemberValid, type FamilyMemberInput } from "@/components/family/FamilyMemberFields";
import { formatNaira, membershipPlans } from "@/lib/site-data";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/family-join")({ component: FamilyJoinPage });

function FamilyJoinPage() {
  const plan = useMemo(() => membershipPlans.find((item) => item.id === "family"), []);
  const [members, setMembers] = useState<FamilyMemberInput[]>([emptyFamilyMember(), emptyFamilyMember(), emptyFamilyMember()]);
  const [coupon, setCoupon] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function updateMember(index: number, next: FamilyMemberInput) {
    setMembers((current) => current.map((item, i) => i === index ? next : item));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!plan) { setError("Family Plan is unavailable right now."); return; }
    if (!members.every(familyMemberValid)) { setError("Complete valid details for all three family members."); return; }
    const emails = members.map((item) => item.email.trim().toLowerCase());
    if (new Set(emails).size !== 3) { setError("Each family member must use a different email address."); return; }
    setLoading(true);
    try {
      const { data, error: functionError } = await supabase.functions.invoke("initialize-public-payment", {
        body: { planId: "family", familyMembers: members.map(familyMemberPayload), ...(coupon.trim() ? { couponCode: coupon.trim().toUpperCase() } : {}) },
      });
      if (functionError) throw new Error(data?.error || functionError.message || "Unable to start payment.");
      if (!data?.authorization_url) throw new Error(data?.error || "Unable to start Family Plan payment.");
      window.location.href = data.authorization_url;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to start payment. No payment has been taken.");
      setLoading(false);
    }
  }

  if (!plan) return <main className="min-h-screen p-8">Family Plan is unavailable.</main>;

  return <main className="min-h-screen bg-background">
    <section className="border-b bg-card"><div className="mx-auto max-w-6xl px-5 py-5 sm:px-6">
      <Link to="/join" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4"/> Back to membership signup</Link>
    </div></section>
    <section className="px-5 py-10 sm:px-6 sm:py-14"><div className="mx-auto max-w-6xl">
      <div className="max-w-3xl">
        <p className="text-sm font-bold uppercase tracking-[.18em] text-primary">Family membership</p>
        <h1 className="mt-3 text-3xl font-black sm:text-5xl">One Family Plan. Three individual members.</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">All three people get their own member profile, QR/member card identity, attendance history and Family Plan membership. Each slot can be a new member or someone who already belongs to Super Plus.</p>
      </div>
      <div className="mt-7 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-5"><p className="text-xs font-bold uppercase text-muted-foreground">Monthly plan</p><p className="mt-2 text-2xl font-black">{formatNaira(plan.price)}</p></div>
        <div className="rounded-2xl border bg-card p-5"><p className="text-xs font-bold uppercase text-muted-foreground">Registration</p><p className="mt-2 text-2xl font-black">{formatNaira(plan.registration)}</p></div>
        <div className="rounded-2xl border bg-card p-5"><p className="text-xs font-bold uppercase text-muted-foreground">People covered</p><p className="mt-2 text-2xl font-black">3</p></div>
      </div>
      <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-5 text-sm leading-6">
        <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary"/><p><strong>Existing members are reused, not duplicated.</strong> Choose Existing and enter the email and phone already on that gym profile. If any selected person still has paid access, the new Family Plan starts after the latest current expiry so all three share exactly the same Family Plan dates.</p></div>
      </div>
      <form onSubmit={(e) => void submit(e)} className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
        <div className="space-y-5">
          {members.map((member, index) => <FamilyMemberFields key={index} label={index === 0 ? "Primary payer / Family member 1" : `Family member ${index + 1}`} value={member} onChange={(next) => updateMember(index, next)} disabled={loading}/>)}
        </div>
        <aside className="rounded-2xl border bg-card p-6 lg:sticky lg:top-6">
          <div className="flex items-center gap-3"><Users className="size-5 text-primary"/><h2 className="font-bold">Family Plan checkout</h2></div>
          <div className="mt-5 space-y-3 text-sm">
            <p className="flex justify-between"><span>Membership</span><strong>{formatNaira(plan.price)}</strong></p>
            <p className="flex justify-between"><span>Registration</span><strong>{formatNaira(plan.registration)}</strong></p>
            <p className="flex justify-between border-t pt-3 text-lg"><span>Total before coupon</span><strong>{formatNaira(plan.price + plan.registration)}</strong></p>
          </div>
          <label className="mt-5 block text-sm font-medium">Coupon code (optional)
            <input value={coupon} onChange={(e) => setCoupon(e.target.value)} disabled={loading} className="mt-2 h-12 w-full rounded-xl border bg-background px-4 uppercase outline-none focus:border-primary" placeholder="Coupon code"/>
          </label>
          {error && <div role="alert" className="mt-5 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}
          <Button type="submit" size="lg" className="mt-5 h-12 w-full" disabled={loading}>
            {loading ? <><Loader2 className="mr-2 size-4 animate-spin"/>Checking family details…</> : <>Continue to Paystack <ArrowRight className="ml-2 size-4"/></>}
          </Button>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">Payment is charged once to the primary member's email. Membership is activated for all three only after Paystack verification succeeds.</p>
        </aside>
      </form>
    </div></section>
  </main>;
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { contact } from "@/lib/site-data";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/delete-account")({
  head: () => ({
    meta: [
      { title: "Delete Account — Super Plus Fitness" },
      { name: "description", content: "Delete your Super Plus Fitness app account and associated app data." },
    ],
  }),
  component: DeleteAccountPage,
});

function DeleteAccountPage() {
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      setSignedIn(!!data.session);
      setEmail(data.session?.user.email ?? "");
      setLoading(false);
    })();
  }, []);

  async function deleteAccount() {
    if (deleting) return;
    if (!window.confirm("Delete your Super Plus Fitness account? This cannot be undone.")) return;
    setDeleting(true);
    setError("");

    const { error: fnError } = await supabase.functions.invoke("delete-member-account", {
      body: { requested_from: "website" },
    });

    if (fnError) {
      setError(fnError.message || "We could not delete the account. Please contact support.");
      setDeleting(false);
      return;
    }

    await supabase.auth.signOut();
    setDeleted(true);
    setSignedIn(false);
    setDeleting(false);
  }

  return (
    <main className="bg-muted px-6 py-12 sm:py-16 lg:px-8">
      <div className="mx-auto max-w-2xl rounded-3xl border bg-background p-7 shadow-sm sm:p-10">
        <p className="text-xs font-extrabold uppercase tracking-[.18em] text-primary">Account privacy</p>
        <h1 className="mt-3 font-display text-5xl font-bold uppercase sm:text-6xl">Delete your account</h1>
        <p className="mt-5 text-sm leading-7 text-muted-foreground">This page is the external account-deletion resource for the Super Plus Fitness mobile app. Deleting your account removes your login and deletes or anonymizes app-personalization data such as attendance activity, SP Points, challenges, rewards activity, bookings, workout entries, saved posts, likes, comments and push-notification tokens.</p>

        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
          Some payment, membership transaction, accounting, dispute-prevention or legally required business records may be retained where necessary. Retained records are not used to recreate your deleted app account.
        </div>

        {loading ? (
          <div className="mt-8 flex items-center gap-3 text-sm font-semibold"><Loader2 className="size-5 animate-spin" /> Checking your account…</div>
        ) : deleted ? (
          <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
            <ShieldCheck className="size-7 text-emerald-700" />
            <h2 className="mt-3 text-xl font-bold text-emerald-950">Account deleted</h2>
            <p className="mt-2 text-sm leading-6 text-emerald-900">Your Super Plus login has been removed and your app account data has been deleted or anonymized.</p>
          </div>
        ) : signedIn ? (
          <div className="mt-8">
            <p className="text-sm text-muted-foreground">Signed in as <strong className="text-foreground">{email || "member account"}</strong>.</p>
            {error && <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}
            <Button variant="destructive" size="lg" className="mt-5 w-full" disabled={deleting} onClick={() => void deleteAccount()}>
              {deleting ? <><Loader2 className="animate-spin" /> Deleting account…</> : <><Trash2 /> Permanently delete my account</>}
            </Button>
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border bg-card p-6">
            <h2 className="text-xl font-bold">Verify your account first</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Sign in with the member email connected to the account you want deleted. After signing in, return to this page and confirm deletion.</p>
            <Button asChild size="lg" className="mt-5 w-full"><a href="/login?redirect=/delete-account">Sign in to delete account</a></Button>
          </div>
        )}

        <div className="mt-8 border-t pt-6 text-sm leading-6 text-muted-foreground">
          Need help? Email <a href={`mailto:${contact.email}`} className="font-semibold text-primary underline">{contact.email}</a>, call <a href={`tel:${contact.phoneHref}`} className="font-semibold text-primary underline">{contact.phone}</a>, or visit our <Link to="/privacy-policy" className="font-semibold text-primary underline">Privacy Policy</Link>.
        </div>
      </div>
    </main>
  );
}

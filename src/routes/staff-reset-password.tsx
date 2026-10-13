import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/staff-reset-password")({ component: PortalPasswordReset });

function PortalPasswordReset() {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!cancelled && event === "PASSWORD_RECOVERY" && !!session) setReady(true);
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && !!data.session && window.location.hash.includes("type=recovery")) setReady(true);
    });
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (password.length < 8) { setError("Use at least eight characters."); return; }
    if (password !== confirm) { setError("The passwords do not match."); return; }
    setBusy(true);
    try {
      const { error: resetError } = await supabase.auth.updateUser({ password });
      if (resetError) throw resetError;
      await supabase.auth.signOut();
      setPassword(""); setConfirm(""); setSuccess(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update the password.");
    } finally { setBusy(false); }
  }

  return <main className="min-h-[70vh] bg-[#f4f6f1] px-4 py-12 text-[#183125]">
    <div className="mx-auto max-w-md rounded-3xl border bg-white p-6 shadow-sm sm:p-9">
      <KeyRound size={32} className="text-[#27643a]" />
      <h1 className="mt-5 text-3xl font-black">Reset your portal password</h1>
      {success ? <div role="status" className="mt-5"><p className="text-sm leading-6">Password updated. Sign in through your assigned portal.</p><Link to="/portal" className="mt-5 inline-flex rounded-xl bg-[#193b2a] px-5 py-3 text-sm font-bold text-white">Choose your portal</Link></div> :
        ready ? <form onSubmit={submit} className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm font-bold">New password<input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={event => setPassword(event.target.value)} className="min-w-0 rounded-xl border p-3" /></label>
          <label className="grid gap-2 text-sm font-bold">Confirm new password<input type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={event => setConfirm(event.target.value)} className="min-w-0 rounded-xl border p-3" /></label>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={busy} className="rounded-xl bg-[#193b2a] p-3 font-bold text-white disabled:opacity-60">{busy ? "Updating…" : "Update password"}</button>
        </form> : <div className="mt-5 text-sm leading-6"><p>Open the password-reset link from your email. If it has expired, request another from your login page.</p><Link to="/portal" className="mt-4 inline-flex font-bold text-[#27643a] underline">Choose your portal</Link></div>}
    </div>
  </main>;
}

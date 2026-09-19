import { useEffect, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, KeyRound, LogIn, LogOut, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Portal = "staff" | "reception" | "admin";
const destinations: Record<Portal, string> = { staff: "/staff", reception: "/reception-workspace", admin: "/staff-admin" };
const portalEmails: Partial<Record<Portal, string>> = { reception: "spfitnessandspa@gmail.com", admin: "admin@superplusfitness.com" };
const title: Record<Portal, string> = { staff: "Staff portal", reception: "Reception portal", admin: "Admin portal" };

async function permitted(userId: string, email: string | undefined, portal: Portal): Promise<boolean> {
  const { data: access, error } = await supabase.from("staff_users").select("role,active").eq("auth_user_id", userId).maybeSingle();
  if (error) throw error;
  if (portal !== "staff") return access?.active === true && String(access.role).toLowerCase() === portal && email?.toLowerCase() === portalEmails[portal];
  // A reception or admin account may never enter the employee portal, even if an
  // obsolete staff profile still references the same auth identity.
  if (access?.active && ["reception", "admin", "owner", "manager"].includes(String(access.role).toLowerCase())) return false;
  const { data: employee, error: employeeError } = await supabase.from("staff_profiles").select("id,status").eq("auth_user_id", userId).maybeSingle();
  if (employeeError) throw employeeError;
  return !!employee && ["approved", "pending"].includes(String(employee.status));
}

export function PortalAuth({ portal }: { portal: Portal }) {
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [register, setRegister] = useState(false);
  const [otherSession, setOtherSession] = useState(false);
  const [email, setEmail] = useState(portalEmails[portal] || "");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!data.user) return;
        const allowed = await permitted(data.user.id, data.user.email, portal);
        if (cancelled) return;
        if (allowed) { window.location.replace(destinations[portal]); return; }
        setOtherSession(true);
      } catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to check your session."); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [portal]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setChecking(true); setError(""); setNotice("");
    const clean = email.trim().toLowerCase();
    try {
      if (!clean) throw new Error("Enter your email address.");
      if (portalEmails[portal] && clean !== portalEmails[portal]) throw new Error(`This portal is reserved for ${portalEmails[portal]}.`);
      if (recovery) {
        const { error: failure } = await supabase.auth.resetPasswordForEmail(clean, { redirectTo: `${window.location.origin}/staff-reset-password` });
        if (failure) throw failure;
        setNotice("If this account exists, password-reset instructions will arrive by email.");
        return;
      }
      if (register) {
        if (portal !== "staff") throw new Error("Reception and admin accounts cannot be self-registered.");
        if (!name.trim() || !phone.trim() || password.length < 6) throw new Error("Enter your name, phone and a password of at least six characters.");
        const { error: failure } = await supabase.auth.signUp({ email: clean, password, options: { emailRedirectTo: `${window.location.origin}/portal/staff`, data: { account_type: "staff", full_name: name.trim(), phone: phone.trim() } } });
        if (failure) throw failure;
        setPassword("");
        setNotice("Application submitted. Verify your email if prompted; management must approve your staff account.");
        return;
      }
      const { data, error: failure } = await supabase.auth.signInWithPassword({ email: clean, password });
      if (failure || !data.user) throw failure || new Error("Unable to sign in.");
      if (!(await permitted(data.user.id, data.user.email, portal))) {
        await supabase.auth.signOut();
        throw new Error(`This account cannot access the ${title[portal].toLowerCase()}. Select the appropriate portal.`);
      }
      setPassword(""); window.location.replace(destinations[portal]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to complete the request."); }
    finally { setChecking(false); }
  }

  return <main className="min-h-[70vh] bg-[#f4f6f1] px-4 py-12 text-[#183125] sm:px-6"><div className="mx-auto w-full max-w-lg rounded-3xl border border-[#dce6d8] bg-white p-5 shadow-sm sm:p-9">
    <Link to="/portal" className="text-sm font-bold text-[#356942]">← All portals</Link>
    <div className="mt-7 flex size-12 items-center justify-center rounded-2xl bg-[#193b2a] text-[#b8ee73]">{portal === "admin" ? <ShieldCheck/> : <LogIn/>}</div>
    <p className="mt-5 text-xs font-black uppercase tracking-[.18em] text-[#527a59]">Super Plus Fitness & Spa</p>
    <h1 className="mt-2 text-3xl font-black sm:text-4xl">{title[portal]}</h1>
    <p className="mt-3 text-sm leading-6 text-[#617466]">{portal === "staff" ? "Employee sign-in and registration, separate from reception and management." : portal === "reception" ? "Dedicated front-desk access to Reception 2.0." : "Dedicated management access. No employee profile is needed."}</p>
    {loading && <p role="status" className="mt-6 text-sm">Checking your session…</p>}
    {!loading && <>
      {otherSession && <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"><p>Another portal account is signed in on this browser. Sign out before switching.</p><button type="button" onClick={async () => { await supabase.auth.signOut(); setOtherSession(false); setError(""); }} className="mt-3 inline-flex items-center gap-2 font-bold underline"><LogOut size={16}/> Sign out and switch</button></div>}
      {!otherSession && <>
        {portal === "staff" && !recovery && <div className="mt-6 grid grid-cols-2 gap-2"><button type="button" onClick={() => { setRegister(false); setError(""); }} className={`rounded-xl p-3 text-sm font-bold ${!register ? "bg-[#193b2a] text-white" : "bg-[#edf4e9]"}`}>Sign in</button><button type="button" onClick={() => { setRegister(true); setError(""); }} className={`rounded-xl p-3 text-sm font-bold ${register ? "bg-[#193b2a] text-white" : "bg-[#edf4e9]"}`}>Apply as staff</button></div>}
        {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        {notice && <p role="status" className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">{notice}</p>}
        <form onSubmit={submit} className="mt-6 grid gap-4">
          {register && !recovery && <><label className="grid gap-1.5 text-sm font-semibold">Full name<input required value={name} onChange={event => setName(event.target.value)} autoComplete="name" className="min-w-0 rounded-xl border p-3"/></label><label className="grid gap-1.5 text-sm font-semibold">Phone<input required value={phone} onChange={event => setPhone(event.target.value)} autoComplete="tel" className="min-w-0 rounded-xl border p-3"/></label></>}
          <label className="grid gap-1.5 text-sm font-semibold">Email<input type="email" required readOnly={portal !== "staff"} autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} className="min-w-0 rounded-xl border p-3 read-only:bg-[#f5f8f3]"/></label>
          {!recovery && <label className="grid gap-1.5 text-sm font-semibold">Password<input type="password" required minLength={register ? 6 : undefined} autoComplete={register ? "new-password" : "current-password"} value={password} onChange={event => setPassword(event.target.value)} className="min-w-0 rounded-xl border p-3"/></label>}
          <button type="submit" disabled={checking} className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-[#193b2a] p-3.5 font-bold text-white disabled:opacity-60">{checking ? "Please wait…" : recovery ? "Email reset link" : register ? "Submit staff application" : "Sign in"}<ArrowRight size={17}/></button>
        </form>
        <button type="button" onClick={() => { setRecovery(value => !value); setRegister(false); setError(""); setNotice(""); }} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#356942] underline"><KeyRound size={15}/>{recovery ? "Back to sign in" : "Forgot password?"}</button>
      </>}
      <p className="mt-7 text-xs text-[#657769]">Access is verified against your authenticated account and its assigned role; selecting a portal does not grant permissions.</p>
    </>}
  </div></main>;
}

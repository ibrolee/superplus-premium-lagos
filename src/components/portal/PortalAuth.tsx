import { Link } from "@tanstack/react-router";
import { ArrowRight, KeyRound, LogIn, LogOut, ShieldCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";

type Portal = "staff" | "reception" | "admin";
const destination: Record<Portal, string> = {
  staff: "/staff",
  reception: "/reception-workspace",
  admin: "/staff-admin",
};
const fixedEmail: Partial<Record<Portal, string>> = {
  reception: "spfitnessandspa@gmail.com",
  admin: "admin@superplusfitness.com",
};
const title: Record<Portal, string> = {
  staff: "Staff portal",
  reception: "Reception portal",
  admin: "Admin portal",
};

/** UI routing only. The existing database RLS and protected destination routes remain authoritative. */
async function isAllowed(
  userId: string,
  authenticatedEmail: string | undefined,
  portal: Portal,
): Promise<boolean> {
  const { data: account, error } = await supabase
    .from("staff_users")
    .select("role,active")
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (error) throw error;
  const role = String(account?.role || "").toLowerCase();
  if (portal !== "staff") {
    return (
      account?.active === true &&
      role === portal &&
      authenticatedEmail?.trim().toLowerCase() === fixedEmail[portal]
    );
  }
  // Employees may not use the staff entrance with a management/reception identity,
  // even while a historical employee profile still exists for that identity.
  if (["reception", "admin", "manager", "owner"].includes(role)) return false;
  const { data: profile, error: profileError } = await supabase
    .from("staff_profiles")
    .select("id,status")
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (profileError) throw profileError;
  return !!profile && ["approved", "pending"].includes(String(profile.status).toLowerCase());
}

export function PortalAuth({ portal }: { portal: Portal }) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [otherSession, setOtherSession] = useState(false);
  const [register, setRegister] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [email, setEmail] = useState(fixedEmail[portal] || "");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { data, error: authError } = await supabase.auth.getUser();
        if (authError || !data.user) return;
        const allowed = await isAllowed(data.user.id, data.user.email, portal);
        if (cancelled) return;
        if (allowed) {
          window.location.replace(destination[portal]);
          return;
        }
        setOtherSession(true);
      } catch (cause) {
        if (!cancelled)
          setError(cause instanceof Error ? cause.message : "Unable to verify this session.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [portal]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    const cleanEmail = email.trim().toLowerCase();
    let signedInHere = false;
    try {
      if (!cleanEmail) throw new Error("Enter your email address.");
      if (fixedEmail[portal] && cleanEmail !== fixedEmail[portal])
        throw new Error("This email is not assigned to this portal.");
      if (recovery) {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: `${window.location.origin}/staff-reset-password`,
        });
        if (resetError) throw resetError;
        setNotice("If this account exists, password-reset instructions will be sent to its email.");
        return;
      }
      if (register) {
        if (portal !== "staff")
          throw new Error("Reception and admin accounts cannot self-register.");
        if (!name.trim() || !phone.trim() || password.length < 6)
          throw new Error("Enter your name, phone and a password of at least six characters.");
        const { data, error: signupError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/portal/staff`,
            data: { account_type: "staff", full_name: name.trim(), phone: phone.trim() },
          },
        });
        if (signupError) throw signupError;
        setPassword("");
        setNotice(
          data.session
            ? "Application submitted. Management approval is required before work access."
            : "Application submitted. Check your email if verification is required; management approval is also required.",
        );
        return;
      }
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (signInError || !data.user) throw signInError || new Error("Unable to sign in.");
      signedInHere = true;
      if (!(await isAllowed(data.user.id, data.user.email, portal))) {
        throw new Error(
          `This account cannot enter the ${title[portal].toLowerCase()}. Choose the portal assigned to your account.`,
        );
      }
      setPassword("");
      window.location.replace(destination[portal]);
    } catch (cause) {
      if (signedInHere) {
        try {
          await supabase.auth.signOut();
        } catch {
          /* Keep the error visible; existing route guards remain active. */
        }
      }
      setPassword("");
      setError(cause instanceof Error ? cause.message : "Unable to complete this request.");
    } finally {
      setBusy(false);
    }
  }

  async function switchAccount() {
    setBusy(true);
    setError("");
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setError(signOutError.message);
    else {
      setOtherSession(false);
      setPassword("");
    }
    setBusy(false);
  }

  return (
    <main className="min-h-[70vh] bg-[#f4f6f1] px-4 py-12 text-[#183125] sm:px-6">
      <div className="mx-auto w-full max-w-lg rounded-3xl border border-[#dce6d8] bg-white p-5 shadow-sm sm:p-9">
        <Link to="/portal" className="text-sm font-bold text-[#356942]">
          ← Choose another portal
        </Link>
        <div className="mt-7 flex size-12 items-center justify-center rounded-2xl bg-[#193b2a] text-[#b8ee73]">
          {portal === "admin" ? <ShieldCheck /> : <LogIn />}
        </div>
        <p className="mt-5 text-xs font-black uppercase tracking-[.18em] text-[#527a59]">
          Super Plus Fitness &amp; Spa
        </p>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">{title[portal]}</h1>
        <p className="mt-3 text-sm leading-6 text-[#617466]">
          {portal === "staff"
            ? "Employee sign-in and registration."
            : portal === "reception"
              ? "Dedicated front-desk sign-in for Reception 2.0."
              : "Dedicated administrator sign-in for management tools."}
        </p>
        {loading ? (
          <p role="status" className="mt-6 text-sm">
            Checking your session…
          </p>
        ) : (
          <>
            {otherSession ? (
              <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
                <p>
                  Another portal account is signed in on this browser. Sign out before switching.
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void switchAccount()}
                  className="mt-3 inline-flex items-center gap-2 font-bold underline disabled:opacity-50"
                >
                  <LogOut size={16} /> Sign out and switch
                </button>
              </div>
            ) : (
              <>
                {portal === "staff" && !recovery && (
                  <div className="mt-6 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRegister(false);
                        setError("");
                        setNotice("");
                      }}
                      className={`rounded-xl p-3 text-sm font-bold ${!register ? "bg-[#193b2a] text-white" : "bg-[#edf4e9]"}`}
                    >
                      Sign in
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRegister(true);
                        setError("");
                        setNotice("");
                      }}
                      className={`rounded-xl p-3 text-sm font-bold ${register ? "bg-[#193b2a] text-white" : "bg-[#edf4e9]"}`}
                    >
                      Apply as staff
                    </button>
                  </div>
                )}
                <form onSubmit={submit} className="mt-6 grid gap-4">
                  {register && !recovery && (
                    <>
                      <label className="grid gap-1.5 text-sm font-semibold">
                        Full name
                        <input
                          required
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          autoComplete="name"
                          className="min-w-0 rounded-xl border p-3"
                        />
                      </label>
                      <label className="grid gap-1.5 text-sm font-semibold">
                        Phone
                        <input
                          required
                          value={phone}
                          onChange={(event) => setPhone(event.target.value)}
                          autoComplete="tel"
                          className="min-w-0 rounded-xl border p-3"
                        />
                      </label>
                    </>
                  )}
                  <label className="grid gap-1.5 text-sm font-semibold">
                    Email
                    <input
                      type="email"
                      required
                      readOnly={portal !== "staff"}
                      autoComplete="username"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="min-w-0 rounded-xl border p-3 read-only:bg-[#f5f8f3]"
                    />
                  </label>
                  {!recovery && (
                    <label className="grid gap-1.5 text-sm font-semibold">
                      Password
                      <input
                        type="password"
                        required
                        minLength={register ? 6 : undefined}
                        autoComplete={register ? "new-password" : "current-password"}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className="min-w-0 rounded-xl border p-3"
                      />
                    </label>
                  )}
                  <button
                    type="submit"
                    disabled={busy}
                    className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-[#193b2a] p-3.5 font-bold text-white disabled:opacity-60"
                  >
                    {busy
                      ? "Please wait…"
                      : recovery
                        ? "Email reset link"
                        : register
                          ? "Submit staff application"
                          : "Sign in"}
                    <ArrowRight size={17} />
                  </button>
                </form>
                <button
                  type="button"
                  onClick={() => {
                    setRecovery((value) => !value);
                    setRegister(false);
                    setError("");
                    setNotice("");
                  }}
                  className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#356942] underline"
                >
                  <KeyRound size={15} />
                  {recovery ? "Back to sign in" : "Forgot password?"}
                </button>
              </>
            )}
            {error && (
              <p
                role="alert"
                className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
              >
                {error}
              </p>
            )}
            {notice && (
              <p
                role="status"
                className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"
              >
                {notice}
              </p>
            )}
            <p className="mt-7 text-xs text-[#657769]">
              This portal checks your authenticated account and assigned role. The existing
              protected pages and database permissions still control access.
            </p>
          </>
        )}
      </div>
    </main>
  );
}

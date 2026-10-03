import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
  MessageCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      {
        title: "Member Login — Super Plus Fitness",
      },
      {
        name: "description",
        content: "Access your Super Plus Fitness member account.",
      },
    ],
  }),
  component: LoginRoute,
});

type LoginMode = "password" | "code";
type LoginStep = "login" | "code" | "new-password";
type CodePurpose = "login" | "set-password";

function LoginRoute() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mode, setMode] = useState<LoginMode>("password");
  const [step, setStep] = useState<LoginStep>("login");
  const [codePurpose, setCodePurpose] = useState<CodePurpose>("login");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [error, setError] = useState("");

  function continueAfterLogin() {
    const redirect =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("redirect")
        : null;
    window.location.replace(redirect === "/delete-account" ? "/delete-account" : "/member");
  }

  useEffect(() => {
    let active = true;

    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;

      if (session) {
        continueAfterLogin();
        return;
      }

      setLoading(false);
    }

    void checkSession();

    return () => {
      active = false;
    };
  }, []);

  function cleanEmail() {
    return email.trim().toLowerCase();
  }

  function validateEmail() {
    const value = cleanEmail();
    if (!value || !value.includes("@")) {
      setError("Please enter the email address registered with your membership.");
      return null;
    }
    return value;
  }

  async function handlePasswordLogin(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const value = validateEmail();
    if (!value) return;

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setVerifying(true);
    setError("");

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: value,
      password: password.toLowerCase(),
    });

    setVerifying(false);

    if (signInError) {
      setError(
        "Email or password not accepted. If you have never created a password, use “Create / reset password” below.",
      );
      return;
    }

    continueAfterLogin();
  }

  async function sendCode(purpose: CodePurpose) {
    const value = validateEmail();
    if (!value) return;

    setSending(true);
    setError("");

    const { error: authError } = await supabase.auth.signInWithOtp({
      email: value,
    });

    setSending(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    setEmail(value);
    setToken("");
    setCodePurpose(purpose);
    setStep("code");
  }

  async function handleSendLoginCode(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    await sendCode("login");
  }

  async function handleVerifyCode(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const value = cleanEmail();
    const cleanToken = token.replace(/\D/g, "");

    if (cleanToken.length !== 8) {
      setError("Please enter the 8-digit code from your email.");
      return;
    }

    setVerifying(true);
    setError("");

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: value,
      token: cleanToken,
      type: "email",
    });

    setVerifying(false);

    if (verifyError) {
      setError(
        "That code is invalid or has expired. Please request a new code.",
      );
      return;
    }

    if (codePurpose === "set-password") {
      setNewPassword("");
      setConfirmPassword("");
      setStep("new-password");
      return;
    }

    continueAfterLogin();
  }

  async function handleSavePassword(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (newPassword.length < 6) {
      setError("Your password must be at least 6 characters.");
      return;
    }

    if (newPassword.toLowerCase() !== confirmPassword.toLowerCase()) {
      setError("The two passwords do not match.");
      return;
    }

    setSavingPassword(true);
    setError("");

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword.toLowerCase(),
    });

    setSavingPassword(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    continueAfterLogin();
  }

  function chooseMode(nextMode: LoginMode) {
    setMode(nextMode);
    setStep("login");
    setToken("");
    setPassword("");
    setError("");
  }

  function handleBack() {
    setStep("login");
    setToken("");
    setError("");
  }

  if (loading) {
    return (
      <main className="min-h-[75vh] bg-muted py-20">
        <div className="section-shell flex min-h-[50vh] items-center justify-center">
          <div className="flex items-center gap-3 text-sm font-bold uppercase">
            <Loader2 className="size-5 animate-spin" />
            Loading...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[75vh] bg-muted py-16 sm:py-24">
      <div className="section-shell flex min-h-[60vh] items-center justify-center">
        <div className="w-full max-w-md border border-border bg-background p-7 shadow-sm sm:p-10">
          <div className="mb-8">
            <p className="mb-4 text-xs font-extrabold uppercase text-primary">
              Super Plus Fitness
            </p>

            <h1 className="display-title text-5xl sm:text-6xl">
              Member Login
            </h1>

            {step === "login" && (
              <p className="mt-5 text-sm leading-6 text-muted-foreground">
                Sign in with your password or use a secure one-time code sent
                to the email registered with your membership.
              </p>
            )}

            {step === "code" && (
              <p className="mt-5 text-sm leading-6 text-muted-foreground">
                Enter the 8-digit code we sent to your email address.
              </p>
            )}

            {step === "new-password" && (
              <p className="mt-5 text-sm leading-6 text-muted-foreground">
                Your email has been verified. Create a password you can use on
                both the website and Super Plus Fitness app.
              </p>
            )}
          </div>

          {step === "login" && (
            <>
              <div className="mb-6 grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
                <button
                  type="button"
                  onClick={() => chooseMode("password")}
                  className={`flex items-center justify-center gap-2 rounded-md px-3 py-3 text-xs font-extrabold uppercase transition ${
                    mode === "password"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground"
                  }`}
                >
                  <LockKeyhole className="size-4" />
                  Password
                </button>
                <button
                  type="button"
                  onClick={() => chooseMode("code")}
                  className={`flex items-center justify-center gap-2 rounded-md px-3 py-3 text-xs font-extrabold uppercase transition ${
                    mode === "code"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground"
                  }`}
                >
                  <Mail className="size-4" />
                  Login code
                </button>
              </div>

              {mode === "password" ? (
                <form onSubmit={handlePasswordLogin} className="grid gap-5">
                  <label className="grid gap-2 text-sm font-bold">
                    Email address
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      required
                      disabled={verifying || sending}
                      className="h-13 rounded-md border border-input bg-background px-4 font-normal outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                    />
                  </label>

                  <label className="grid gap-2 text-sm font-bold">
                    Password
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Your password"
                      autoComplete="current-password"
                      required
                      disabled={verifying || sending}
                      className="h-13 rounded-md border border-input bg-background px-4 font-normal outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                    />
                  </label>

                  {error && (
                    <div
                      role="alert"
                      className="border border-destructive/30 bg-destructive/10 p-4 text-sm leading-6 text-destructive"
                    >
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    disabled={verifying || sending}
                  >
                    {verifying ? (
                      <>
                        <Loader2 className="animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        Sign in with password
                        <ArrowRight />
                      </>
                    )}
                  </Button>

                  <button
                    type="button"
                    onClick={() => void sendCode("set-password")}
                    disabled={sending || verifying}
                    className="flex items-center justify-center gap-2 text-sm font-bold text-primary hover:underline disabled:opacity-50"
                  >
                    {sending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <KeyRound className="size-4" />
                    )}
                    Create / reset password
                  </button>

                  <p className="text-center text-xs leading-5 text-muted-foreground">
                    Never created a password before? We’ll verify your
                    registered email with a one-time code, then let you create
                    one.
                  </p>
                </form>
              ) : (
                <form onSubmit={handleSendLoginCode} className="grid gap-5">
                  <label className="grid gap-2 text-sm font-bold">
                    Email address
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      required
                      disabled={sending}
                      className="h-13 rounded-md border border-input bg-background px-4 font-normal outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                    />
                  </label>

                  {error && (
                    <div
                      role="alert"
                      className="border border-destructive/30 bg-destructive/10 p-4 text-sm leading-6 text-destructive"
                    >
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    disabled={sending}
                  >
                    {sending ? (
                      <>
                        <Loader2 className="animate-spin" />
                        Sending code...
                      </>
                    ) : (
                      <>
                        Send login code
                        <ArrowRight />
                      </>
                    )}
                  </Button>

                  <p className="text-center text-xs leading-5 text-muted-foreground">
                    You can always use an email code even after creating a
                    password.
                  </p>
                </form>
              )}
            </>
          )}

          {step === "code" && (
            <form onSubmit={handleVerifyCode} className="grid gap-5">
              <div className="border border-border bg-muted p-5">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="size-5 text-primary" />
                  <div>
                    <p className="text-xs font-extrabold uppercase">
                      Code sent to
                    </p>
                    <p className="mt-1 break-all text-sm font-bold">{email}</p>
                  </div>
                </div>
              </div>

              <label className="grid gap-2 text-sm font-bold">
                8-digit verification code
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  value={token}
                  onChange={(event) =>
                    setToken(event.target.value.replace(/\D/g, ""))
                  }
                  placeholder="00000000"
                  autoComplete="one-time-code"
                  autoFocus
                  required
                  disabled={verifying}
                  className="h-14 rounded-md border border-input bg-background px-4 text-center text-2xl font-bold tracking-[0.35em] outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                />
              </label>

              {error && (
                <div
                  role="alert"
                  className="border border-destructive/30 bg-destructive/10 p-4 text-sm leading-6 text-destructive"
                >
                  {error}
                </div>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={verifying}
              >
                {verifying ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    {codePurpose === "set-password"
                      ? "Verify & continue"
                      : "Sign in"}
                    <ArrowRight />
                  </>
                )}
              </Button>

              <button
                type="button"
                onClick={handleBack}
                disabled={verifying}
                className="text-sm font-bold uppercase text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                Back
              </button>
            </form>
          )}

          {step === "new-password" && (
            <form onSubmit={handleSavePassword} className="grid gap-5">
              <div className="border border-primary/20 bg-primary/5 p-5">
                <div className="flex items-center gap-3">
                  <KeyRound className="size-5 text-primary" />
                  <div>
                    <p className="text-xs font-extrabold uppercase">
                      Email verified
                    </p>
                    <p className="mt-1 break-all text-sm font-bold">{email}</p>
                  </div>
                </div>
              </div>

              <label className="grid gap-2 text-sm font-bold">
                New password
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                  minLength={6}
                  required
                  disabled={savingPassword}
                  className="h-13 rounded-md border border-input bg-background px-4 font-normal outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                />
              </label>

              <label className="grid gap-2 text-sm font-bold">
                Confirm new password
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Repeat your password"
                  autoComplete="new-password"
                  minLength={6}
                  required
                  disabled={savingPassword}
                  className="h-13 rounded-md border border-input bg-background px-4 font-normal outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                />
              </label>

              {error && (
                <div
                  role="alert"
                  className="border border-destructive/30 bg-destructive/10 p-4 text-sm leading-6 text-destructive"
                >
                  {error}
                </div>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={savingPassword}
              >
                {savingPassword ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Saving password...
                  </>
                ) : (
                  <>
                    Save password & continue
                    <ArrowRight />
                  </>
                )}
              </Button>

              <p className="text-center text-xs leading-5 text-muted-foreground">
                Your password will work on both superplusfitness.com and the
                Super Plus Fitness mobile app. Capital letters do not matter,
                and login codes remain available.
              </p>
            </form>
          )}

          <div className="mt-8 border-t border-border pt-6 text-center">
            <p className="text-xs text-muted-foreground">Not a member yet?</p>
            <a
              href="https://members.superplusfitness.com/pricing-plans/list"
              className="mt-2 inline-block text-sm font-bold uppercase text-primary hover:underline"
              rel="noopener noreferrer"
            >
              View membership plans
            </a>
          </div>

          <div className="mt-6 border-t border-border pt-6">
            <a
              href="https://chat.whatsapp.com/FysNYsQkx3rAqlB5WS4k6s?s=cl&p=i&mlu=4&ilr=4"
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Button
                type="button"
                size="lg"
                className="w-full bg-green-600 text-white hover:bg-green-700"
              >
                <MessageCircle />
                Join Super Plus Fitness WhatsApp Group
              </Button>
            </a>

            <p className="mt-3 text-center text-xs leading-5 text-muted-foreground">
              Join our official member group for gym updates, announcements,
              events and important information.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

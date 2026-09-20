import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2, MessageCircle } from "lucide-react";

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

function LoginRoute() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;

      if (session) {
        navigate({ to: "/member", replace: true });
        return;
      }

      setLoading(false);
    }

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;

      if (session) {
        navigate({ to: "/member", replace: true });
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  async function handleSendCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError("Please enter your email address.");
      return;
    }

    setSending(true);
    setError("");

    const { error: authError } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
    });

    setSending(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    setEmail(cleanEmail);
    setToken("");
    setStep("code");
  }

  async function handleVerifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanEmail = email.trim().toLowerCase();
    const cleanToken = token.replace(/\D/g, "");

    if (cleanToken.length !== 8) {
      setError("Please enter the 8-digit code from your email.");
      return;
    }

    setVerifying(true);
    setError("");

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: cleanEmail,
      token: cleanToken,
      type: "email",
    });

    setVerifying(false);

    if (verifyError) {
      setError("That code is invalid or has expired. Please request a new code.");
      return;
    }

    navigate({ to: "/member", replace: true });
  }

  async function handleBack() {
    setStep("email");
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
            <p className="mb-4 text-xs font-extrabold uppercase text-primary">Super Plus Fitness</p>

            <h1 className="display-title text-5xl sm:text-6xl">Member Login</h1>

            {step === "email" ? (
              <p className="mt-5 text-sm leading-6 text-muted-foreground">
                Enter the email address registered with your Super Plus Fitness membership. We'll
                send you a secure login code.
              </p>
            ) : (
              <p className="mt-5 text-sm leading-6 text-muted-foreground">
                Enter the 8-digit code we sent to your email address.
              </p>
            )}
          </div>

          {step === "email" ? (
            <form onSubmit={handleSendCode} className="grid gap-5">
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

              <Button type="submit" size="lg" className="w-full" disabled={sending}>
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
                No password required. We'll email you a secure one-time code.
              </p>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className="grid gap-5">
              <div className="border border-border bg-muted p-5">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="size-5 text-primary" />

                  <div>
                    <p className="text-xs font-extrabold uppercase">Code sent to</p>

                    <p className="mt-1 break-all text-sm font-bold">{email}</p>
                  </div>
                </div>
              </div>

              <label className="grid gap-2 text-sm font-bold">
                8-digit login code
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  value={token}
                  onChange={(event) => setToken(event.target.value.replace(/\D/g, ""))}
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

              <Button type="submit" size="lg" className="w-full" disabled={verifying}>
                {verifying ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight />
                  </>
                )}
              </Button>

              <div className="grid gap-3">
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={verifying}
                  className="text-sm font-bold uppercase text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  Use a different email
                </button>
              </div>
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

          {/* WhatsApp Group */}
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
              Join our official member group for gym updates, announcements, events and important
              information.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

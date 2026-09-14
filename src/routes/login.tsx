import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

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
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function handleAuthCallback() {
      setLoading(true);
      setError("");

      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");

        /*
         * Supabase may return a PKCE authorization code after
         * the user clicks the magic link.
         */
        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) {
            if (active) {
              setError(
                "This login link is invalid or has already been used. Please request a new login link.",
              );
              setLoading(false);
            }
            return;
          }

          if (active) {
            setLoading(false);
            navigate({ to: "/member", replace: true });
          }

          return;
        }

        /*
         * Check whether Supabase already restored the session.
         * This also handles other supported Supabase auth flows.
         */
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!active) return;

        if (session) {
          setLoading(false);
          navigate({ to: "/member", replace: true });
          return;
        }

        setLoading(false);
      } catch (callbackError) {
        console.error("Authentication callback error:", callbackError);

        if (active) {
          setError(
            "We couldn't complete your login. Please request a new login link.",
          );
          setLoading(false);
        }
      }
    }

    handleAuthCallback();

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

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError("Please enter your email address.");
      return;
    }

    setSending(true);
    setError("");
    setSent(false);

    const { error: authError } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });

    setSending(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    setSent(true);
  }

  if (loading) {
    return (
      <main className="min-h-[75vh] bg-muted py-20">
        <div className="section-shell flex min-h-[50vh] items-center justify-center">
          <div className="flex items-center gap-3 text-sm font-bold uppercase">
            <Loader2 className="size-5 animate-spin" />
            Signing you in...
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

            <p className="mt-5 text-sm leading-6 text-muted-foreground">
              Enter the email address registered with your Super Plus Fitness
              membership. We'll send you a secure login link.
            </p>
          </div>

          {sent ? (
            <div className="border border-border bg-muted p-6">
              <CheckCircle2 className="size-10 text-primary" />

              <h2 className="mt-5 font-display text-2xl font-bold uppercase">
                Check your email
              </h2>

              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                We sent a secure login link to:
              </p>

              <p className="mt-2 break-all font-bold">
                {email.trim().toLowerCase()}
              </p>

              <p className="mt-5 text-xs leading-5 text-muted-foreground">
                Open the new link in your email to continue to your member
                account.
              </p>

              <Button
                type="button"
                variant="outline"
                className="mt-6 w-full"
                onClick={() => {
                  setSent(false);
                  setError("");
                }}
              >
                Use a different email
              </Button>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="grid gap-5">
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
                    Sending login link...
                  </>
                ) : (
                  <>
                    Send login link
                    <ArrowRight />
                  </>
                )}
              </Button>

              <p className="text-center text-xs leading-5 text-muted-foreground">
                No password required. Your login link is secure and expires
                automatically.
              </p>
            </form>
          )}

          <div className="mt-8 border-t border-border pt-6 text-center">
            <p className="text-xs text-muted-foreground">
              Not a member yet?
            </p>

            <a
              href="https://members.superplusfitness.com/pricing-plans/list"
              className="mt-2 inline-block text-sm font-bold uppercase text-primary hover:underline"
              rel="noopener noreferrer"
            >
              View membership plans
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
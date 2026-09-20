import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/auth/confirm")({
  head: () => ({
    meta: [
      {
        title: "Signing In — Super Plus Fitness",
      },
    ],
  }),
  component: AuthConfirmPage,
});

function AuthConfirmPage() {
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function confirmLogin() {
      const url = new URL(window.location.href);
      const tokenHash = url.searchParams.get("token_hash");
      const type = url.searchParams.get("type");

      if (!tokenHash || type !== "email") {
        if (active) {
          setError("This login link is invalid or incomplete.");
        }
        return;
      }

      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: "email",
      });

      if (!active) return;

      if (verifyError) {
        setError(
          "This login link is invalid or has already been used. Please request a new login link.",
        );
        return;
      }

      navigate({ to: "/member", replace: true });
    }

    confirmLogin();

    return () => {
      active = false;
    };
  }, [navigate]);

  if (error) {
    return (
      <main className="min-h-[75vh] bg-muted py-20">
        <div className="section-shell flex min-h-[50vh] items-center justify-center">
          <div className="max-w-md border border-border bg-background p-8 text-center shadow-sm">
            <h1 className="font-display text-3xl font-bold uppercase">Login Problem</h1>

            <p className="mt-4 text-sm leading-6 text-muted-foreground">{error}</p>

            <a
              href="/login"
              className="mt-6 inline-block font-bold uppercase text-primary hover:underline"
            >
              Back to Login
            </a>
          </div>
        </div>
      </main>
    );
  }

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

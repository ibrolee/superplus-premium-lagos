import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type PaymentResult = {
  success?: boolean;
  already_processed?: boolean;
  error?: string;
  reference?: string;
  member?: {
    id?: string;
    full_name?: string;
    email?: string;
    phone?: string;
    auth_user_id?: string;
  };
  membership?: {
    id?: string;
    plan_name?: string;
    start_date?: string;
    end_date?: string;
    status?: string;
  };
  payment?: {
    id?: string;
    amount?: number;
    status?: string;
    reference?: string;
  };
};

export const Route = createFileRoute("/payment/public-callback")({
  component: PublicPaymentCallback,
});

function PublicPaymentCallback() {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<PaymentResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function verifyPayment() {
      try {
        const params = new URLSearchParams(window.location.search);

        const reference =
          params.get("reference") ||
          params.get("trxref");

        if (!reference) {
          if (!cancelled) {
            setResult({
              success: false,
              error: "No payment reference was found.",
            });
            setLoading(false);
          }
          return;
        }

        const supabaseUrl =
          import.meta.env.VITE_SUPABASE_URL;

        const supabaseAnonKey =
          import.meta.env.VITE_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseAnonKey) {
          throw new Error(
            "Payment system configuration is missing.",
          );
        }

        const response = await fetch(
          `${supabaseUrl}/functions/v1/verify-public-payment`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: supabaseAnonKey,
              Authorization: `Bearer ${supabaseAnonKey}`,
            },
            body: JSON.stringify({
              reference,
            }),
          },
        );

        const data = await response.json();

        if (!response.ok || !data?.success) {
          throw new Error(
            data?.error ||
              "We could not verify your payment.",
          );
        }

        if (!cancelled) {
          setResult(data);
          setLoading(false);
        }
      } catch (error) {
        console.error(
          "Public payment callback error:",
          error,
        );

        if (!cancelled) {
          setResult({
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "We could not verify your payment.",
          });
          setLoading(false);
        }
      }
    }

    verifyPayment();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>

          <h1 className="text-2xl font-semibold">
            Confirming your payment
          </h1>

          <p className="mt-3 text-muted-foreground">
            Please wait while we confirm your membership
            with Paystack.
          </p>
        </div>
      </main>
    );
  }

  if (!result?.success) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <XCircle className="h-8 w-8 text-destructive" />
          </div>

          <h1 className="text-2xl font-semibold">
            Payment could not be confirmed
          </h1>

          <p className="mt-3 text-muted-foreground">
            {result?.error ||
              "We were unable to confirm this payment."}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild>
              <Link to="/join">
                Try again
              </Link>
            </Button>

            <Button asChild variant="outline">
              <Link to="/">
                Back to website
              </Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  const memberName =
    result.member?.full_name || "Member";

  const email =
    result.member?.email || "";

  const planName =
    result.membership?.plan_name || "Membership";

  const startDate =
    result.membership?.start_date || "";

  const endDate =
    result.membership?.end_date || "";

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">
        <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <div className="text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-9 w-9 text-green-600" />
            </div>

            <h1 className="text-3xl font-bold">
              Payment Successful!
            </h1>

            <p className="mt-3 text-muted-foreground">
              Welcome to Super Plus Fitness & Spa,
              {" "}
              <span className="font-medium text-foreground">
                {memberName}
              </span>
              .
            </p>
          </div>

          <div className="mt-8 rounded-xl border bg-muted/30 p-5">
            <h2 className="font-semibold">
              Membership Details
            </h2>

            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">
                  Plan
                </span>

                <span className="font-medium text-right">
                  {planName}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">
                  Start date
                </span>

                <span className="font-medium">
                  {startDate}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">
                  Expiry date
                </span>

                <span className="font-medium">
                  {endDate}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-xl border p-5">
            <h2 className="font-semibold">
              Your Member Account
            </h2>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Your member account has been created using:
            </p>

            <p className="mt-3 break-all font-medium">
              {email}
            </p>

            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              You can now log in with your email using our
              secure OTP login. From your member dashboard,
              you can access your QR code and membership
              details.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-3">
            <Button asChild size="lg">
              <Link to="/login">
                Go to Member Login
              </Link>
            </Button>

            <Button asChild variant="outline" size="lg">
              <Link to="/">
                Back to Website
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
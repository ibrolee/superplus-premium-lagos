import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Loader2, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/payment/callback")({
  head: () => ({
    meta: [
      {
        title: "Payment Status — Super Plus Fitness",
      },
      {
        name: "description",
        content: "Confirm your Super Plus Fitness membership payment.",
      },
    ],
  }),
  component: PaymentCallback,
});

function PaymentCallback() {
  const navigate = useNavigate();

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  const [message, setMessage] = useState("Confirming your payment...");

  const [membershipDetails, setMembershipDetails] = useState<{
    planName?: string;
    startDate?: string;
    endDate?: string;
  } | null>(null);

  useEffect(() => {
    let active = true;

    async function verifyPayment() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!active) return;

        if (!session) {
          navigate({ to: "/login" });
          return;
        }

        const params = new URLSearchParams(window.location.search);

        const reference = params.get("reference") || params.get("trxref");

        if (!reference) {
          setStatus("error");
          setMessage(
            "We could not find the payment reference. Please contact Super Plus Fitness reception if money was deducted from your account.",
          );
          return;
        }

        setMessage("Verifying your payment with Paystack...");

        const { data, error } = await supabase.functions.invoke("verify-payment", {
          body: {
            reference,
          },
        });

        if (!active) return;

        if (error) {
          console.error("Payment verification error:", error);

          setStatus("error");
          setMessage(
            error.message ||
              "We could not verify your payment. If money was deducted, please contact reception.",
          );
          return;
        }

        if (!data?.success) {
          setStatus("error");
          setMessage(data?.message || data?.error || "Payment was not completed.");
          return;
        }

        setMembershipDetails({
          planName: data.plan_name,
          startDate: data.start_date,
          endDate: data.end_date,
        });

        setStatus("success");
        setMessage(
          data.already_processed
            ? "Your payment was already confirmed and your membership is active."
            : "Your payment has been confirmed and your membership has been updated.",
        );
      } catch (error) {
        console.error("Payment callback error:", error);

        if (!active) return;

        setStatus("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "Something went wrong while confirming your payment.",
        );
      }
    }

    verifyPayment();

    return () => {
      active = false;
    };
  }, [navigate]);

  function formatDate(value?: string) {
    if (!value) return "";

    const parts = value.slice(0, 10).split("-").map(Number);

    if (parts.length !== 3) return value;

    const date = new Date(parts[0]!, parts[1]! - 1, parts[2]!);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString("en-NG", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  if (status === "loading") {
    return (
      <main className="min-h-[75vh] bg-muted py-16 sm:py-24">
        <div className="section-shell">
          <div className="mx-auto max-w-xl border border-border bg-background p-8 text-center shadow-sm sm:p-12">
            <div className="mx-auto flex size-16 items-center justify-center bg-primary text-primary-foreground">
              <Loader2 className="size-8 animate-spin" />
            </div>

            <h1 className="display-title mt-7 text-4xl sm:text-5xl">Confirming Payment</h1>

            <p className="mt-5 text-sm leading-7 text-muted-foreground">{message}</p>

            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              Please don't close this page while we confirm your payment.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="min-h-[75vh] bg-muted py-16 sm:py-24">
        <div className="section-shell">
          <div className="mx-auto max-w-xl border border-border bg-background p-8 shadow-sm sm:p-12">
            <div className="flex size-16 items-center justify-center bg-destructive text-destructive-foreground">
              <AlertCircle className="size-8" />
            </div>

            <h1 className="display-title mt-7 text-4xl sm:text-5xl">Payment Issue</h1>

            <p className="mt-5 text-sm leading-7 text-muted-foreground">{message}</p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/member" className="flex-1">
                <Button className="w-full" size="lg">
                  Return to Dashboard
                </Button>
              </Link>

              <Link to="/" className="flex-1">
                <Button variant="outline" className="w-full" size="lg">
                  Back to Home
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[75vh] bg-muted py-16 sm:py-24">
      <div className="section-shell">
        <div className="mx-auto max-w-xl border border-border bg-background p-8 shadow-sm sm:p-12">
          <div className="flex size-16 items-center justify-center bg-green-600 text-white">
            <CheckCircle2 className="size-8" />
          </div>

          <h1 className="display-title mt-7 text-4xl sm:text-5xl">Payment Successful</h1>

          <p className="mt-5 text-sm leading-7 text-muted-foreground">{message}</p>

          {membershipDetails?.planName && (
            <div className="mt-7 border border-border p-5">
              <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-primary">
                Membership Updated
              </p>

              <h2 className="mt-3 font-display text-2xl font-bold uppercase">
                {membershipDetails.planName}
              </h2>

              {membershipDetails.startDate && (
                <div className="mt-5 flex justify-between gap-4 border-t border-border pt-4 text-sm">
                  <span className="text-muted-foreground">Start Date</span>

                  <span className="font-bold">{formatDate(membershipDetails.startDate)}</span>
                </div>
              )}

              {membershipDetails.endDate && (
                <div className="mt-3 flex justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">Expiry Date</span>

                  <span className="font-bold">{formatDate(membershipDetails.endDate)}</span>
                </div>
              )}
            </div>
          )}

          <Link to="/member" className="mt-8 block">
            <Button size="lg" className="w-full">
              Go to My Dashboard
              <ArrowRight />
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}

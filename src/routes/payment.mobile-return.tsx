import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/payment/mobile-return")({
  head: () => ({
    meta: [
      { title: "Return to Super Plus App" },
      {
        name: "description",
        content: "Return to the Super Plus Fitness mobile app after Paystack checkout.",
      },
    ],
  }),
  component: MobilePaymentReturn,
});

function MobilePaymentReturn() {
  return (
    <main className="flex min-h-[75vh] items-center justify-center bg-muted px-6 py-16">
      <div className="w-full max-w-lg border border-border bg-background p-8 text-center shadow-sm sm:p-12">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-green-100 text-green-700">
          <CheckCircle2 className="size-8" />
        </div>
        <p className="mt-6 text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
          Super Plus Fitness
        </p>
        <h1 className="display-title mt-3 text-4xl sm:text-5xl">
          Return to the app
        </h1>
        <p className="mt-5 text-sm leading-7 text-muted-foreground">
          Your Paystack checkout has finished. Close this browser and return to
          the Super Plus Fitness app. The app will verify the payment and update
          your membership.
        </p>
        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          If verification takes a moment, use “Verify completed payment” in the
          Membership tab. Do not make a second payment.
        </p>
        <Button asChild variant="outline" className="mt-8 w-full" size="lg">
          <Link to="/">Super Plus website</Link>
        </Button>
      </div>
    </main>
  );
}

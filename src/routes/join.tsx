import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { membershipPlans, formatNaira } from "@/lib/site-data";

export const Route = createFileRoute("/join")({
  component: JoinPage,
});

function JoinPage() {
  const [selectedPlanId, setSelectedPlanId] = useState("monthly");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /*
   * Read ?plan=... from the URL.
   *
   * This allows buttons such as:
   * /join?plan=monthly
   * to automatically select the correct plan.
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const planFromUrl = params.get("plan");

    if (
      planFromUrl &&
      membershipPlans.some((plan) => plan.id === planFromUrl)
    ) {
      setSelectedPlanId(planFromUrl);
    }
  }, []);

  const selectedPlan = useMemo(
    () =>
      membershipPlans.find(
        (plan) => plan.id === selectedPlanId,
      ) || membershipPlans[0],
    [selectedPlanId],
  );

  const totalAmount =
    selectedPlan.price + selectedPlan.registration;

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPhone = phone.trim();

    if (!trimmedName) {
      setError("Please enter your full name.");
      return;
    }

    if (
      !trimmedEmail ||
      !trimmedEmail.includes("@")
    ) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!trimmedPhone) {
      setError("Please enter your phone number.");
      return;
    }

    setLoading(true);

    try {
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
        `${supabaseUrl}/functions/v1/initialize-public-payment`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            planId: selectedPlan.id,
            fullName: trimmedName,
            email: trimmedEmail,
            phone: trimmedPhone,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok || !data?.authorization_url) {
        throw new Error(
          data?.error ||
            "Unable to start payment. Please try again.",
        );
      }

      /*
       * Send the customer directly to Paystack.
       */
      window.location.href = data.authorization_url;
    } catch (err) {
      console.error(
        "Public payment initialization error:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to start payment. Please try again.",
      );

      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <section className="border-b bg-card">
        <div className="mx-auto max-w-7xl px-6 py-5 lg:px-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Super Plus Fitness
          </Link>
        </div>
      </section>

      {/* Main */}
      <section className="px-6 py-10 sm:py-14 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              Membership
            </p>

            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              Join Super Plus Fitness
            </h1>

            <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">
              Choose your membership plan and complete
              your registration securely through Paystack.
            </p>
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_420px] lg:items-start">
            {/* Plans */}
            <div>
              <div className="mb-4">
                <h2 className="text-xl font-semibold">
                  Choose your plan
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Select the membership that works best
                  for you.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {membershipPlans.map((plan) => {
                  const isSelected =
                    selectedPlan.id === plan.id;

                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() =>
                        setSelectedPlanId(plan.id)
                      }
                      className={`relative rounded-2xl border p-5 text-left transition-all ${
                        isSelected
                          ? "border-primary ring-2 ring-primary/20"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      {plan.badge && (
                        <span className="absolute right-4 top-4 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                          {plan.badge}
                        </span>
                      )}

                      <div className="pr-16">
                        <h3 className="text-lg font-semibold">
                          {plan.name}
                        </h3>

                        <p className="mt-1 text-sm text-muted-foreground">
                          {plan.duration}
                        </p>
                      </div>

                      <div className="mt-5">
                        <span className="text-2xl font-bold">
                          {formatNaira(plan.price)}
                        </span>
                      </div>

                      <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                        <p>
                          Registration:{" "}
                          {formatNaira(
                            plan.registration,
                          )}
                        </p>

                        <p className="font-medium text-foreground">
                          Total:{" "}
                          {formatNaira(
                            plan.price +
                              plan.registration,
                          )}
                        </p>
                      </div>

                      <div className="mt-5 flex items-center gap-2 text-sm font-semibold">
                        <span>
                          {isSelected
                            ? "Selected"
                            : "Select plan"}
                        </span>

                        {isSelected && (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Checkout */}
            <div className="lg:sticky lg:top-6">
              <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-7">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Selected plan
                  </p>

                  <h2 className="mt-1 text-2xl font-bold">
                    {selectedPlan.name}
                  </h2>
                </div>

                <div className="my-6 border-t" />

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">
                      Membership
                    </span>

                    <span className="font-medium">
                      {formatNaira(
                        selectedPlan.price,
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">
                      Registration
                    </span>

                    <span className="font-medium">
                      {formatNaira(
                        selectedPlan.registration,
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between gap-4 border-t pt-3">
                    <span className="font-semibold">
                      Total
                    </span>

                    <span className="text-xl font-bold">
                      {formatNaira(totalAmount)}
                    </span>
                  </div>
                </div>

                <div className="my-6 border-t" />

                <form
                  onSubmit={handleSubmit}
                  className="space-y-4"
                >
                  <div>
                    <label
                      htmlFor="fullName"
                      className="mb-2 block text-sm font-medium"
                    >
                      Full name
                    </label>

                    <input
                      id="fullName"
                      type="text"
                      value={fullName}
                      onChange={(event) =>
                        setFullName(event.target.value)
                      }
                      placeholder="Enter your full name"
                      autoComplete="name"
                      disabled={loading}
                      className="h-12 w-full rounded-xl border bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="email"
                      className="mb-2 block text-sm font-medium"
                    >
                      Email address
                    </label>

                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(event) =>
                        setEmail(event.target.value)
                      }
                      placeholder="you@example.com"
                      autoComplete="email"
                      disabled={loading}
                      className="h-12 w-full rounded-xl border bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="phone"
                      className="mb-2 block text-sm font-medium"
                    >
                      Phone number
                    </label>

                    <input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(event) =>
                        setPhone(event.target.value)
                      }
                      placeholder="08012345678"
                      autoComplete="tel"
                      disabled={loading}
                      className="h-12 w-full rounded-xl border bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                    />
                  </div>

                  {error && (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    size="lg"
                    className="h-12 w-full"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Connecting to Paystack...
                      </>
                    ) :
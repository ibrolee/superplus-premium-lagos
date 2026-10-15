import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { contact, formatNaira } from "@/lib/site-data";
import { useLiveSpaServices, useWebsiteSetting, fallbackBooking, type BookingConfig } from "@/lib/website-settings";
import { supabase } from "@/lib/supabase";
import { getFunctionErrorMessage, getUserErrorMessage } from "@/lib/user-error";
import { pageHead } from "@/lib/seo";
import { validateSpaTime } from "../../supabase/functions/_shared/spa-services";

export const Route = createFileRoute("/spa-booking")({
  validateSearch: (search: Record<string, unknown>) => ({
    service: typeof search["service"] === "string" ? search["service"] : "",
    reference: typeof search["reference"] === "string" ? search["reference"] : "",
  }),
  head: () =>
    pageHead(
      "Book Spa & Recovery — Super Plus",
      "Choose a spa service, request your preferred appointment and pay securely.",
      "/spa-booking",
    ),
  component: SpaBooking,
});
type Receipt = {
  service_name: string;
  amount: number;
  preferred_at: string;
  reference: string;
  status: string;
};
const field =
  "mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 py-3 text-base";
function SpaBooking() {
  const search = Route.useSearch();
  const {services:recoveryServices,loading:spaLoading}=useLiveSpaServices();
  const {value:bookingConfig}=useWebsiteSetting<BookingConfig>("booking",fallbackBooking);
  const [serviceId, setServiceId] = useState(
    search["service"] || "vip-chair",
  );
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [phone, setPhone] = useState("");
  const [date, setDate] = useState(""),
    [time, setTime] = useState(""),
    [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [receipt, setReceipt] = useState<Receipt | null>(null);
  const service = recoveryServices.find((s) => s.id === serviceId);
  useEffect(() => {
    if (search["service"]) setServiceId(search["service"]);
  }, [search["service"]]);
  async function verify(reference: string) {
    setBusy(true);
    setError("");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("spa-checkout", {
        body: { action: "verify", reference },
      });
      if (fnError)
        throw Error(await getFunctionErrorMessage(fnError, "Payment verification is unavailable."));
      if (!data?.success) throw Error(data?.error || "Payment has not been confirmed.");
      setReceipt(data);
    } catch (e) {
      setError(getUserErrorMessage(e, "Unable to confirm payment. If charged, do not pay again."));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (search["reference"]) void verify(search["reference"]);
  }, [search["reference"]]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!service?.price) {
      setError("Please select a service.");
      return;
    }
    const preferredAt = `${date}T${time}:00+01:00`;
    try {
      // Checkout validates the exact currently published hours and booking capacity.
      validateSpaTime(preferredAt, Number(service.duration_minutes)||30);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    setBusy(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("spa-checkout", {
        body: {
          action: "initialize",
          serviceId: service.id,
          fullName: name,
          email,
          phone,
          preferredAt,
          notes,
        },
      });
      if (fnError) throw Error(await getFunctionErrorMessage(fnError, "Unable to start checkout."));
      if (!data?.authorization_url) throw Error(data?.error || "Unable to start checkout.");
      const url = new URL(data.authorization_url);
      if (url.protocol !== "https:" || url.hostname !== "checkout.paystack.com")
        throw Error("Invalid payment checkout URL.");
      window.location.assign(url.href);
    } catch (e) {
      setError(getUserErrorMessage(e, "Unable to start payment."));
      setBusy(false);
    }
  }
  const appointment = receipt
    ? new Intl.DateTimeFormat("en-NG", {
        timeZone: "Africa/Lagos",
        dateStyle: "full",
        timeStyle: "short",
      }).format(new Date(receipt.preferred_at))
    : "";
  if (search["reference"])
    return (
      <main className="section-shell py-12 sm:py-20">
        <section className="mx-auto max-w-xl rounded-3xl border bg-card p-6 sm:p-9">
          {busy ? (
            <>
              <Loader2 className="size-10 animate-spin text-primary" />
              <h1 className="mt-5 text-2xl font-bold">Confirming your payment</h1>
            </>
          ) : receipt ? (
            <>
              <CheckCircle2 className="size-12 text-green-600" />
              <h1 className="mt-5 font-display text-4xl font-bold uppercase">Payment received</h1>
              <p className="mt-4 text-muted-foreground">
                Your {receipt.service_name} booking request has been recorded. Reception will
                contact you to confirm your appointment time.
              </p>
              <dl className="mt-6 space-y-4 rounded-2xl bg-muted/40 p-5">
                <div>
                  <dt className="text-xs text-muted-foreground">Service</dt>
                  <dd className="font-bold">
                    {receipt.service_name} · {formatNaira(receipt.amount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Preferred time · Lagos</dt>
                  <dd className="font-bold">{appointment}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Booking status</dt>
                  <dd className="font-bold capitalize">{receipt.status}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Payment reference</dt>
                  <dd className="break-all text-sm">{receipt.reference}</dd>
                </div>
              </dl>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold">Payment needs verification</h1>
              <p className="mt-4 text-sm">
                If Paystack charged you, do not pay again. Retry verification or contact reception
                with this reference.
              </p>
              <p className="mt-4 break-all text-sm font-bold">{search["reference"]}</p>
              <Button className="mt-5" onClick={() => void verify(search["reference"])}>
                Retry verification
              </Button>
            </>
          )}
          {error && (
            <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">
              {error}
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link to="/spa-recovery">Spa & Recovery</Link>
            </Button>
            <Button asChild variant="outline">
              <a href={contact.whatsapp} target="_blank" rel="noopener noreferrer">
                Contact reception
              </a>
            </Button>
          </div>
        </section>
      </main>
    );
  return (
    <main className="section-shell py-12 sm:py-20">
      <div className="mx-auto max-w-4xl">
        <p className="text-xs font-extrabold uppercase tracking-widest text-primary">
          Spa & Recovery
        </p>
        <h1 className="mt-3 font-display text-5xl font-bold uppercase sm:text-6xl">
          Book your session.
        </h1>
        <p className="mt-4 max-w-xl text-muted-foreground">
          Choose a service and preferred time, then pay securely. No gym membership is required.
        </p>
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <form
            onSubmit={(event) => void submit(event)}
            className="space-y-5 rounded-3xl border bg-card p-5 sm:p-8"
          >
            <fieldset disabled={busy||spaLoading} className="space-y-5">
              <label className="block text-sm font-bold">
                Service
                <select
                  required
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  className={field}
                >
                  <option value="">Select service</option>
                  {recoveryServices.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {formatNaira(s.price || 0)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-bold">
                Full name
                <input
                  required
                  autoComplete="name"
                  minLength={2}
                  maxLength={120}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={field}
                />
              </label>
              <label className="block text-sm font-bold">
                Email address
                <input
                  required
                  autoComplete="email"
                  type="email"
                  maxLength={254}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={field}
                />
              </label>
              <label className="block text-sm font-bold">
                Phone number
                <input
                  required
                  autoComplete="tel"
                  type="tel"
                  minLength={7}
                  maxLength={30}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={field}
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block min-w-0 text-sm font-bold">
                  Preferred date
                  <input
                    required
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={field}
                  />
                </label>
                <label className="block min-w-0 text-sm font-bold">
                  Preferred time
                  <input
                    required
                    type="time"
                    step={900}
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className={field}
                  />
                </label>
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                All times are Lagos time. Monday–Saturday: 6 AM–8:30 PM. Sunday: 6:30 AM–7 PM.
                Choose a time that allows your session to finish before closing.
              </p>
              <label className="block text-sm font-bold">
                Booking note (optional)
                <textarea
                  maxLength={1000}
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={field}
                />
              </label>
              <label className="flex items-start gap-3 text-sm leading-6">
                <input required type="checkbox" className="mt-1.5 size-4 shrink-0" />
                <span>
                  I understand this is a preferred-time request. Reception will confirm availability
                  and contact me if another time is needed.
                </span>
              </label>
            </fieldset>
            {error && (
              <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">
                {error}
              </p>
            )}
            <Button size="lg" type="submit" disabled={busy || !service} className="min-h-12 w-full">
              {busy ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Connecting to Paystack…
                </>
              ) : (
                <>
                  Book & pay {formatNaira(service?.price || 0)}
                  <ArrowRight className="ml-2 size-4" />
                </>
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Secure payment through Paystack.
            </p>
          </form>
          <aside className="h-fit rounded-3xl border bg-card p-6 lg:sticky lg:top-28">
            <p className="text-xs font-bold uppercase text-primary">Your session</p>
            <h2 className="mt-3 font-display text-3xl font-bold uppercase">
              {service?.name || "Select a service"}
            </h2>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">{service?.description}</p>
            {service?.duration && <p className="mt-4 text-sm font-bold">{service.duration}</p>}
            <div className="mt-6 flex justify-between border-t pt-5">
              <span>Total</span>
              <strong className="text-2xl text-primary">{formatNaira(service?.price || 0)}</strong>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">No membership registration fee.</p>
            <p className="mt-6 text-sm leading-6 text-muted-foreground">{contact.address}</p>
            <a
              href={contact.whatsapp}
              className="mt-5 inline-block text-sm font-bold text-primary"
              target="_blank"
              rel="noopener noreferrer"
            >
              Need help? Chat with reception
            </a>
          </aside>
        </div>
      </div>
    </main>
  );
}

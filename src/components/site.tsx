import { Link, useRouterState } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  Clock3,
  Instagram,
  Mail,
  MapPin,
  Menu,
  Phone,
  ScanLine,
  X,
} from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  contact,
  facilities,
  formatNaira,
  membershipPlans,
  navItems,
  openingHours,
  type MembershipPlan,
  type RecoveryService,
} from "@/lib/site-data";

export function Logo({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link
      to="/"
      className="flex items-center"
      aria-label="Super Plus Fitness home"
    >
      <img
        src="/header-logo.png"
        alt="Super Plus Fitness"
        className="h-12 w-auto object-contain"
      />
    </Link>
  );
}

export function Navbar() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/95 backdrop-blur">
      <div className="section-shell grid h-18 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 lg:grid-cols-[auto_1fr_auto]">
        <Logo />

        <nav
          className="hidden justify-center gap-5 lg:flex"
          aria-label="Main navigation"
        >
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`text-[11px] font-bold uppercase transition-colors hover:text-primary ${
                pathname === item.to ? "text-primary" : "text-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button asChild size="lg" className="hidden sm:inline-flex">
            <Link to="/join">
              Join now <ArrowRight />
            </Link>
          </Button>

          <MobileNavbar />
        </div>
      </div>
    </header>
  );
}

export function MobileNavbar() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="lg:hidden"
          aria-label="Open menu"
        >
          <Menu />
        </Button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="w-[88vw] bg-secondary p-0 text-secondary-foreground"
      >
        <SheetTitle className="sr-only">Navigation</SheetTitle>

        <div className="flex h-full flex-col p-6">
          <div className="mb-8 flex items-center justify-between">
            <Logo inverse />

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            >
              <X />
            </Button>
          </div>

          <nav
            className="flex flex-col"
            aria-label="Mobile navigation"
          >
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="border-b border-primary-foreground/15 py-3 font-display text-3xl font-bold uppercase hover:text-primary"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-auto grid gap-3">
            <Link
              to="/login"
              onClick={() => setOpen(false)}
              className="text-sm font-bold uppercase"
            >
              Member login
            </Link>

            <Link
              to="/my-qr"
              onClick={() => setOpen(false)}
              className="text-sm font-bold uppercase"
            >
              My QR Code
            </Link>

            <Link
              to="/reception-dashboard"
              onClick={() => setOpen(false)}
              className="text-sm font-bold uppercase"
            >
              Reception Dashboard
            </Link>

            <Button asChild size="lg">
              <Link
                to="/join"
                onClick={() => setOpen(false)}
              >
                Join now
              </Link>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  copy,
  inverse = false,
}: {
  eyebrow?: string;
  title: ReactNode;
  copy?: string;
  inverse?: boolean;
}) {
  return (
    <div className="max-w-3xl">
      <div
        className={`mb-4 flex items-center gap-3 text-xs font-extrabold uppercase ${
          inverse ? "text-primary" : "text-primary"
        }`}
      >
        <span className="h-px w-8 bg-primary" />
        {eyebrow}
      </div>

      <h2
        className={`display-title text-5xl sm:text-7xl ${
          inverse ? "text-primary-foreground" : "text-foreground"
        }`}
      >
        {title}
      </h2>

      {copy && (
        <p
          className={`mt-6 max-w-2xl text-base leading-7 ${
            inverse
              ? "text-primary-foreground/70"
              : "text-muted-foreground"
          }`}
        >
          {copy}
        </p>
      )}
    </div>
  );
}

export function PageHero({
  eyebrow,
  title,
  copy,
  image,
}: {
  eyebrow: string;
  title: ReactNode;
  copy: string;
  image: string;
}) {
  return (
    <section className="relative min-h-[64vh] overflow-hidden bg-secondary text-secondary-foreground">
      <img
        src={image}
        alt="Super Plus Fitness experience in Lagos"
        width={1536}
        height={1024}
        className="absolute inset-0 h-full w-full object-cover opacity-55"
      />

      <div className="absolute inset-0 bg-secondary/55" />

      <div className="relative section-shell flex min-h-[64vh] items-end py-16 sm:py-20">
        <div className="max-w-4xl">
          <p className="mb-5 text-xs font-extrabold uppercase text-primary">
            {eyebrow}
          </p>

          <h1 className="display-title text-6xl sm:text-8xl lg:text-9xl">
            {title}
          </h1>

          <p className="mt-6 max-w-xl text-base leading-7 text-secondary-foreground/80 sm:text-lg">
            {copy}
          </p>
        </div>
      </div>
    </section>
  );
}

/* MEMBERSHIP CARD */
export function MembershipCard({
  plan,
}: {
  plan: MembershipPlan;
}) {
  return (
    <article
      className={`relative flex min-h-[29rem] flex-col border p-6 transition-transform hover:-translate-y-1 ${
        plan.badge
          ? "border-primary bg-secondary text-secondary-foreground"
          : "border-border bg-card text-card-foreground"
      }`}
    >
      {plan.badge && (
        <span className="absolute right-4 top-4 bg-primary px-3 py-1 text-[10px] font-extrabold uppercase text-primary-foreground">
          {plan.badge}
        </span>
      )}

      <p className="text-xs font-extrabold uppercase text-primary">
        {plan.group}
      </p>

      <h3 className="mt-5 font-display text-3xl font-bold uppercase">
        {plan.name}
      </h3>

      <div className="mt-5">
        <span className="font-display text-5xl font-bold">
          {formatNaira(plan.price)}
        </span>

        <p
          className={`mt-1 text-sm ${
            plan.badge
              ? "text-secondary-foreground/65"
              : "text-muted-foreground"
          }`}
        >
          {plan.duration} · {formatNaira(plan.registration)} registration
        </p>
      </div>

      <ul className="mt-7 space-y-3">
        {plan.benefits.map((benefit) => (
          <li key={benefit} className="flex gap-3 text-sm">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
            {benefit}
          </li>
        ))}
      </ul>

      <Button
        asChild
        variant={plan.badge ? "default" : "dark"}
        size="lg"
        className="mt-auto"
      >
        <Link to={`/join?plan=${plan.id}`}>
          Choose plan <ArrowRight />
        </Link>
      </Button>
    </article>
  );
}

/* SPA & RECOVERY SERVICE CARD */
export function ServiceCard({
  service,
}: {
  service: RecoveryService;
}) {
  return (
    <article className="group border border-border bg-card">
      <div className="p-6 sm:p-7">
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="text-xs font-extrabold uppercase text-primary">
              Spa & Recovery
            </p>

            <h3 className="mt-3 font-display text-2xl font-bold uppercase sm:text-3xl">
              {service.name}
            </h3>
          </div>

          <div className="shrink-0 text-right">
            <span className="font-display text-2xl font-bold text-primary sm:text-3xl">
              {service.price !== null
                ? formatNaira(service.price)
                : "Price coming soon"}
            </span>

            {service.duration && (
              <p className="mt-1 text-xs font-bold uppercase text-muted-foreground">
                {service.duration}
              </p>
            )}
          </div>
        </div>

        <p className="mt-5 max-w-xl text-sm leading-6 text-muted-foreground">
          {service.description}
        </p>

        <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
          <span className="text-xs font-bold uppercase text-muted-foreground">
            Available at Super Plus Fitness
          </span>

          <Button asChild variant="ghost" size="icon">
            <Link
              to="/contact"
              aria-label={`Enquire about ${service.name}`}
            >
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

export function FacilityGrid({ limit }: { limit?: number }) {
  const items = limit ? facilities.slice(0, limit) : facilities;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {items.map((item, index) => (
        <article
          key={item.name}
          className={`group relative min-h-[22rem] overflow-hidden ${
            index === 0 && !limit ? "lg:col-span-2" : ""
          }`}
        >
          <img
            src={item.image}
            alt={`${item.name} facilities at Super Plus Fitness`}
            loading="lazy"
            width={1536}
            height={1024}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />

          <div className="image-shade absolute inset-0" />

          <div className="absolute inset-x-0 bottom-0 p-6 text-primary-foreground">
            <span className="text-xs font-bold text-primary">
              0{index + 1}
            </span>

            <h3 className="mt-2 font-display text-3xl font-bold uppercase">
              {item.name}
            </h3>

            {!limit && (
              <p className="mt-2 max-w-md text-sm text-primary-foreground/70">
                {item.description}
              </p>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

export function ContactForm({
  partnership = false,
}: {
  partnership?: boolean;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    toast("Thanks — this form is ready to connect", {
      description:
        "Until delivery is connected, please call, email or WhatsApp our team directly.",
    });
  }

  return (
    <form
      onSubmit={submit}
      className="grid gap-4"
      aria-label={
        partnership ? "Partnership enquiry" : "Contact form"
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" name="name" />

        <Field
          label={partnership ? "Organization" : "Email"}
          name={partnership ? "organization" : "email"}
          type={partnership ? "text" : "email"}
        />
      </div>

      {partnership && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" name="email" type="email" />
          <Field label="Phone" name="phone" type="tel" />
        </div>
      )}

      {!partnership && (
        <Field label="Phone" name="phone" type="tel" />
      )}

      <label className="grid gap-2 text-sm font-bold">
        Message
        <textarea
          name="message"
          required
          rows={5}
          className="rounded-md border border-input bg-background p-3 font-normal focus:ring-2 focus:ring-ring"
        />
      </label>

      <Button type="submit" size="lg">
        Send enquiry <ArrowRight />
      </Button>

      <p className="text-xs text-muted-foreground">
        Online delivery is awaiting connection. For an immediate response,
        use WhatsApp or call us.
      </p>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
}: {
  label: string;
  name: string;
  type?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold">
      {label}

      <input
        name={name}
        type={type}
        required
        className="h-12 rounded-md border border-input bg-background px-3 font-normal focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}

export function LocationSection() {
  return (
    <section className="bg-muted py-20">
      <div className="section-shell grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <SectionHeader
            eyebrow="Visit us"
            title={
              <>
                Find us in
                <br />
                Shomolu.
              </>
            }
          />

          <div className="mt-8 space-y-4 text-sm">
            <p className="flex gap-3">
              <MapPin className="shrink-0 text-primary" />
              {contact.address}
            </p>

            <p className="flex gap-3">
              <Phone className="shrink-0 text-primary" />
              {contact.phone}
            </p>

            <p className="flex gap-3">
              <Mail className="shrink-0 text-primary" />
              {contact.email}
            </p>

            {openingHours.map((item) => (
              <p
                key={item.days}
                className="flex gap-3"
              >
                <Clock3 className="shrink-0 text-primary" />

                <span>
                  <strong>{item.days}</strong>
                  <br />
                  {item.hours}
                </span>
              </p>
            ))}
          </div>

          <div className="mt-7 flex flex-wrap gap-2">
            <Button asChild>
              <a href={`tel:${contact.phoneHref}`}>Call</a>
            </Button>

            <Button asChild variant="outline">
              <a
                href={contact.whatsapp}
                target="_blank"
                rel="noreferrer"
              >
                WhatsApp
              </a>
            </Button>

            <Button asChild variant="outline">
              <a
                href={contact.directions}
                target="_blank"
                rel="noreferrer"
              >
                Directions
              </a>
            </Button>
          </div>
        </div>

        <iframe
          title="Map showing Super Plus Fitness in Shomolu"
          src="https://www.google.com/maps?q=105%20Apata%20Street%20Shomolu%20Lagos&output=embed"
          loading="lazy"
          className="min-h-[28rem] w-full border-0 grayscale"
        />
      </div>
    </section>
  );
}

export function FinalCTA() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  if (pathname !== "/") {
    return null;
  }

  return (
    <section className="bg-primary py-16 text-primary-foreground">
      <div className="section-shell flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="display-title max-w-3xl text-6xl sm:text-8xl">
          Your next level starts here.
        </h2>

        <div className="flex shrink-0 flex-wrap gap-3">
          <Button asChild variant="dark" size="lg">
            <Link to="/join">
              Join now
            </Link>
          </Button>

          <Button asChild variant="inverse" size="lg">
            <Link to="/contact">Contact us</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="bg-secondary py-14 text-secondary-foreground">
      <div className="section-shell">
        <div className="grid gap-10 border-b border-primary-foreground/15 pb-12 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Logo inverse />

            <p className="mt-5 max-w-xs text-sm leading-6 text-secondary-foreground/60">
              Modern fitness, personal training, spa and recovery in
              Shomolu, Lagos.
            </p>
          </div>

          <FooterLinks
            title="Explore"
            links={navItems.slice(0, 8)}
          />

          <FooterLinks
            title="Member"
            links={[
              { label: "Member Login", to: "/login" },
              { label: "My QR Code", to: "/my-qr" },
              {
                label: "Reception Dashboard",
                to: "/reception-dashboard",
              },
            ]}
          />

          <div>
            <h3 className="text-xs font-extrabold uppercase text-primary">
              Contact
            </h3>

            <div className="mt-5 space-y-3 text-sm text-secondary-foreground/70">
              <a
                className="block hover:text-primary"
                href={`tel:${contact.phoneHref}`}
              >
                {contact.phone}
              </a>

              <a
                className="block break-all hover:text-primary"
                href={`mailto:${contact.email}`}
              >
                {contact.email}
              </a>

              <p>{contact.address}</p>

              <div className="mt-4 flex items-center gap-4">
                <a
                  href="https://www.instagram.com/superplusfitnessandspa/"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Instagram"
                  className="inline-flex hover:text-primary"
                >
                  <Instagram />
                </a>

                <a
                  href="https://www.tiktok.com/@superplusfitness"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="TikTok"
                  className="inline-flex hover:text-primary"
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-3.77A4.83 4.83 0 0 1 15.75 2h-3.1v13.67a2.72 2.72 0 1 1-1.92-2.61V9.9a5.83 5.83 0 1 0 5.09 5.77V8.72a7.9 7.9 0 0 0 4.62 1.48V7.11a4.85 4.85 0 0 1-.85-.42Z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>

        <p className="pt-6 text-xs text-secondary-foreground/45">
          © {new Date().getFullYear()} Super Plus Fitness & Spa. All rights
          reserved.
        </p>
      </div>
    </footer>
  );
}

function FooterLinks({
  title,
  links,
}: {
  title: string;
  links: readonly { label: string; to: string }[];
}) {
  return (
    <div>
      <h3 className="text-xs font-extrabold uppercase text-primary">
        {title}
      </h3>

      <nav className="mt-5 grid gap-2">
        {links.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="text-sm text-secondary-foreground/70 hover:text-primary"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function UtilityBar() {
  return (
    <div className="hidden bg-secondary py-2 text-secondary-foreground md:block">
      <div className="section-shell flex justify-end gap-5 text-[10px] font-bold uppercase">
        <Link to="/login">Member login</Link>
        <Link to="/my-qr">My QR Code</Link>
        <Link to="/reception-dashboard">
          Reception Dashboard
        </Link>
      </div>
    </div>
  );
}

export function IntegrationNotice({
  children,
}: {
  children?: ReactNode;
}) {
  return (
    <div className="border-l-4 border-primary bg-muted p-4 text-sm leading-6">
      <strong className="block uppercase">
        Integration ready
      </strong>

      {children ??
        "This screen is prepared for the existing Super Plus member system. Live account data will appear when that system is connected."}
    </div>
  );
}

export function QRPreview({ large = false }: { large?: boolean }) {
  return (
    <div
      className={`grid place-items-center bg-background p-6 ${
        large ? "min-h-[70vh]" : "aspect-square"
      }`}
    >
      <div className="grid size-56 place-items-center border-8 border-secondary bg-muted">
        <ScanLine className="size-24 text-secondary" />

        <span className="text-center text-xs font-bold uppercase">
          Member QR loads
          <br />
          after connection
        </span>
      </div>
    </div>
  );
}
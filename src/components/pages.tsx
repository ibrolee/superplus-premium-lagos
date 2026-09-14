import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Building2,
  Check,
  Dumbbell,
  HeartPulse,
  ScanLine,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  ContactForm,
  FacilityGrid,
  FinalCTA,
  IntegrationNotice,
  LocationSection,
  MembershipCard,
  PageHero,
  QRPreview,
  SectionHeader,
  ServiceCard,
} from "@/components/site";
import {
  facilities,
  images,
  membershipPlans,
  recoveryServices,
  testimonials,
} from "@/lib/site-data";

export function HomePage() {
  const preview = [
    membershipPlans[2],
    membershipPlans[3],
    membershipPlans[6],
    membershipPlans[9],
  ];

  return (
    <main>
      <section className="relative min-h-[calc(100svh-4.5rem)] overflow-hidden bg-secondary text-secondary-foreground">
        <img
          src={images.hero}
          alt="Members strength training at Super Plus Fitness in Lagos"
          width={1536}
          height={1024}
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-secondary/55" />
        <div className="relative section-shell flex min-h-[calc(100svh-4.5rem)] flex-col justify-end pb-12 pt-28 sm:pb-16">
          <div className="mb-5 flex gap-5 text-[10px] font-bold uppercase text-secondary-foreground/75">
            <span>Shomolu, Lagos</span>
            <span>Fitness • Spa • Recovery</span>
          </div>

          <h1 className="display-title max-w-5xl text-7xl sm:text-9xl lg:text-[9rem]">
            Build stronger.
            <br />
            <span className="text-primary">Live better.</span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-7 text-secondary-foreground/80 sm:text-lg">
            Modern fitness, personal training, spa and recovery — all under
            one roof in Shomolu, Lagos.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <a
                href="https://members.superplusfitness.com/pricing-plans/list"
                rel="noopener noreferrer"
              >
                Join now <ArrowRight />
              </a>
            </Button>

            <Button asChild size="lg" variant="inverse">
              <Link to="/membership">Explore membership</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-28">
        <div className="section-shell">
          <SectionHeader
            eyebrow="The complete experience"
            title="More than a gym."
            copy="Super Plus Fitness brings training, modern equipment, personal coaching, spa and recovery services together in one complete fitness and wellness destination."
          />

          <div className="mt-12 grid gap-px bg-border md:grid-cols-3">
            {[
              {
                title: "Fitness",
                icon: Dumbbell,
                text: "Modern equipment and spaces designed for strength, cardio and everyday fitness.",
              },
              {
                title: "Training",
                icon: Target,
                text: "Personal and group training designed around your goals.",
              },
              {
                title: "Recovery",
                icon: HeartPulse,
                text: "Massage, spa and therapy services to help you recover and recharge.",
              },
            ].map((item) => (
              <article
                key={item.title}
                className="bg-background p-7 sm:p-9"
              >
                <item.icon className="size-8 text-primary" />

                <h3 className="mt-16 font-display text-4xl font-bold uppercase">
                  {item.title}
                </h3>

                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {item.text}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-secondary py-20 text-secondary-foreground sm:py-28">
        <div className="section-shell">
          <div className="flex flex-col gap-7 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeader
              eyebrow="Facilities"
              title={
                <>
                  Your space to
                  <br />
                  get stronger.
                </>
              }
              inverse
            />

            <Button asChild variant="inverse" size="lg">
              <Link to="/facilities">
                View facilities <ArrowRight />
              </Link>
            </Button>
          </div>

          <div className="mt-12">
            <FacilityGrid limit={6} />
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-28">
        <div className="section-shell">
          <div className="flex flex-col gap-7 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeader
              eyebrow="Membership"
              title="Find your plan."
              copy="Flexible gym, long-term and premium options built around how you train."
            />

            <Button asChild variant="outline" size="lg">
              <Link to="/membership">View all memberships</Link>
            </Button>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {preview.map(
              (plan) =>
                plan && <MembershipCard key={plan.id} plan={plan} />,
            )}
          </div>
        </div>
      </section>

      <Split
        image={images.training}
        eyebrow="Personal training"
        title={
          <>
            Don’t just work out.
            <br />
            Train with purpose.
          </>
        }
        copy="Work with a personal coach for structured training, focused guidance and the accountability to keep moving forward."
        to="/personal-training"
        button="Start personal training"
      />

      <section className="bg-muted py-20 sm:py-28">
        <div className="section-shell">
          <SectionHeader
            eyebrow="Spa & recovery"
            title={
              <>
                Recover.
                <br />
                Reset. Recharge.
              </>
            }
            copy="A dedicated recovery experience that works alongside your training — because progress happens between sessions too."
          />

          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recoveryServices.slice(0, 3).map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>

          <Button asChild size="lg" className="mt-8">
            <Link to="/spa-recovery">Explore spa & recovery</Link>
          </Button>
        </div>
      </section>

      <section className="py-20 sm:py-28">
        <div className="section-shell">
          <SectionHeader
            eyebrow="Member stories"
            title={
              <>
                Real people.
                <br />
                Real progress.
              </>
            }
          />

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {testimonials.map((item, index) => (
              <blockquote
                key={item.name}
                className="border-t-4 border-primary bg-card p-7 shadow-sm"
              >
                <p className="font-display text-2xl font-semibold leading-tight">
                  “{item.quote}”
                </p>

                <footer className="mt-10 text-sm">
                  <strong>{item.name}</strong>
                  <span className="block text-muted-foreground">
                    {item.detail}
                  </span>
                </footer>

                <span className="mt-8 block text-xs font-bold text-primary">
                  0{index + 1}
                </span>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-secondary py-20 text-secondary-foreground">
        <div className="section-shell grid gap-10 lg:grid-cols-[1fr_0.7fr] lg:items-end">
          <SectionHeader
            eyebrow="HMO & corporate"
            title={
              <>
                Fitness benefits
                <br />
                for your members.
              </>
            }
            copy="Super Plus Fitness works with HMOs and organizations to provide accessible fitness and wellness services for their members and teams."
            inverse
          />

          <Button
            asChild
            size="lg"
            className="lg:justify-self-end"
          >
            <Link to="/hmo">
              HMO & corporate partnerships <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>

      <LocationSection />
      <FinalCTA />
    </main>
  );
}

function Split({
  image,
  eyebrow,
  title,
  copy,
  to,
  button,
}: {
  image: string;
  eyebrow: string;
  title: React.ReactNode;
  copy: string;
  to: "/personal-training" | "/facilities";
  button: string;
}) {
  return (
    <section className="grid bg-secondary text-secondary-foreground lg:grid-cols-2">
      <img
        src={image}
        alt="Personal training at Super Plus Fitness"
        loading="lazy"
        width={1536}
        height={1024}
        className="h-full min-h-[28rem] w-full object-cover"
      />

      <div className="flex items-center px-6 py-16 sm:px-12 lg:px-16">
        <div>
          <SectionHeader
            eyebrow={eyebrow}
            title={title}
            copy={copy}
            inverse
          />

          <Button asChild size="lg" className="mt-8">
            <Link to={to}>
              {button} <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

export function MembershipPage() {
  const [filter, setFilter] = useState("All");

  const filters = [
    "All",
    "Gym",
    "VIP",
    "Family",
    "Training",
    "Spa & Recovery",
  ];

  const plans =
    filter === "All"
      ? membershipPlans
      : membershipPlans.filter((plan) => plan.category === filter);

  return (
    <main>
      <PageHero
        eyebrow="Flexible access"
        title="Membership plans"
        copy="Choose the membership that fits your goals."
        image={images.facilities}
      />

      <section className="py-16 sm:py-24">
        <div className="section-shell">
          <div
            className="flex gap-2 overflow-x-auto pb-4"
            role="tablist"
            aria-label="Membership categories"
          >
            {filters.map((item) => (
              <Button
                key={item}
                variant={filter === item ? "default" : "outline"}
                onClick={() => setFilter(item)}
                role="tab"
                aria-selected={filter === item}
              >
                {item}
              </Button>
            ))}
          </div>

          {filter === "Spa & Recovery" ? (
            <div className="mt-10">
              <IntegrationNotice>
                Current spa and recovery prices are being confirmed. Contact
                our team for today’s rates.
              </IntegrationNotice>

              <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {recoveryServices.map((service) => (
                  <ServiceCard key={service.id} service={service} />
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {plans.map((plan) => (
                <MembershipCard key={plan.id} plan={plan} />
              ))}
            </div>
          )}
        </div>
      </section>

      <FinalCTA />
    </main>
  );
}

export function PersonalTrainingPage() {
  return (
    <main>
      <PageHero
        eyebrow="Personal coaching"
        title="Train with purpose."
        copy="Structured coaching, focused attention and a training plan that meets you where you are."
        image={images.training}
      />

      <InfoBand
        title="Why personal training"
        copy="A coach turns effort into a plan. We help you train with safer form, the right progression and accountability that lasts."
        items={[
          "Goal-led programming",
          "Technique and form",
          "Consistent accountability",
        ]}
      />

      <Process
        title="How it works"
        items={[
          "Talk goals",
          "Assess movement",
          "Build your plan",
          "Train and progress",
        ]}
      />

      <Split
        image={images.hero}
        eyebrow="What you get"
        title={
          <>
            Coaching built
            <br />
            around you.
          </>
        }
        copy="Your membership includes gym access, group classes and focused sessions with a personal coach."
        to="/personal-training"
        button="Start personal training"
      />

      <InfoBand
        title="Training experience"
        copy="Serious coaching without intimidation. Every session is clear, supportive and designed to move you forward."
        items={["Strength", "Conditioning", "Everyday fitness"]}
      />

      <FinalCTA />
    </main>
  );
}

export function FacilitiesPage() {
  return (
    <main>
      <PageHero
        eyebrow="Inside Super Plus"
        title="Built for your work."
        copy="Strength, cardio, movement, coaching and recovery spaces designed as one complete experience."
        image={images.facilities}
      />

      <section className="py-16 sm:py-24">
        <div className="section-shell">
          <SectionHeader
            eyebrow="Explore the floor"
            title="Everything in its place."
            copy="Every image can be updated centrally as the facility evolves, without changing this editorial layout."
          />

          <div className="mt-12">
            <FacilityGrid />
          </div>
        </div>
      </section>

      <FinalCTA />
    </main>
  );
}

export function SpaRecoveryPage() {
  return (
    <main>
      <PageHero
        eyebrow="Wellness at Super Plus"
        title="Recover better."
        copy="Premium spa, therapy and recovery services in the same place you train."
        image={images.recovery}
      />

      <section className="py-16 sm:py-24">
        <div className="section-shell">
          <SectionHeader
            eyebrow="Services"
            title="Restore your edge."
            copy="Build recovery into your routine with targeted services delivered in a calm, professional environment."
          />

          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recoveryServices.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        </div>
      </section>

      <FinalCTA />
    </main>
  );
}

export function AboutPage() {
  return (
    <main>
      <PageHero
        eyebrow="Our story"
        title="One complete experience."
        copy="Fitness, coaching and recovery brought together for the way Lagos lives and trains."
        image={images.hero}
      />

      <InfoBand
        title="Who we are"
        copy="Super Plus Fitness is a modern fitness and wellness destination in Shomolu — built for people who want strong training, expert support and better recovery under one roof."
        items={[
          "Local and welcoming",
          "Modern and professional",
          "Focused on real progress",
        ]}
      />

      <Split
        image={images.facilities}
        eyebrow="Our philosophy"
        title={
          <>
            Strong body.
            <br />
            Better life.
          </>
        }
        copy="We believe fitness should fit real life. That means an environment where beginners feel welcome, experienced members stay challenged and every person can train with purpose."
        to="/facilities"
        button="Explore facilities"
      />

      <Process
        title="The Super Plus experience"
        items={["Arrive", "Train", "Recover", "Return stronger"]}
      />

      <InfoBand
        title="Why members choose us"
        copy="A complete mix of equipment, coaching, classes, spa and therapy services — backed by a team that knows your progress matters."
        items={[
          "Complete facilities",
          "Personal support",
          "Recovery included",
        ]}
      />

      <FinalCTA />
    </main>
  );
}

export function HmoPage() {
  const directPartners = [
    {
      name: "PayGYM",
      logo: "/paygym-logo.PNG",
    },
    {
      name: "Bardge",
      logo: "/bardge-logo.JPG",
    },
    {
      name: "Reliance HMO",
      logo: "/reliance-hmo-logo.JPG",
    },
    {
      name: "Noor HMO",
      logo: "/noor-hmo-logo.JPG",
    },
  ];

  const bardgeNetworks = [
    {
      name: "Hygeia",
      logo: "/hygeia-logo.JPG",
    },
    {
      name: "NEM Health HMO",
      logo: "/nem-health-logo.JPG",
    },
    {
      name: "Bastion HMO",
      logo: "/bastion-hmo-logo.PNG",
    },
    {
      name: "Clearline HMO",
      logo: "/clearline-hmo-logo.JPG",
    },
    {
      name: "AXA Mansard",
      logo: "/axa-mansard-logo.PNG",
    },
  ];

  return (
    <main>
      <PageHero
        eyebrow="HMO & corporate partnerships"
        title={
          <>
            A better fitness benefit
            <br />
            for your members.
          </>
        }
        copy="Give your members and teams access to modern fitness, coaching, spa and recovery in Shomolu, Lagos."
        image={images.facilities}
      />

      {/* PARTNERS */}
      <section className="py-20 sm:py-28">
        <div className="section-shell">
          <SectionHeader
            eyebrow="Our healthcare network"
            title={
              <>
                Fitness benefits
                <br />
                through trusted partners.
              </>
            }
            copy="Super Plus Fitness works with wellness platforms and healthcare networks to make fitness and wellbeing benefits more accessible to members."
          />

          <div className="mt-12">
            <p className="mb-5 text-xs font-extrabold uppercase text-primary">
              Direct partners
            </p>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {directPartners.map((partner) => (
                <HmoPartnerLogo
                  key={partner.name}
                  name={partner.name}
                  logo={partner.logo}
                />
              ))}
            </div>
          </div>

          <div className="mt-14">
            <p className="mb-2 text-xs font-extrabold uppercase text-primary">
              Available through Bardge
            </p>

            <p className="mb-5 max-w-2xl text-sm leading-6 text-muted-foreground">
              Our Bardge partnership also gives members access to participating
              HMO networks.
            </p>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {bardgeNetworks.map((partner) => (
                <HmoPartnerLogo
                  key={partner.name}
                  name={partner.name}
                  logo={partner.logo}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <InfoBand
        title="Why partner with Super Plus"
        copy="A local, complete wellness partner makes fitness benefits easier to access and more valuable to the people you serve."
        items={[
          "One complete facility",
          "Flexible partnership structure",
          "Professional member experience",
        ]}
      />

      <Process
        title="How partnership works"
        items={[
          "Tell us your needs",
          "Design access",
          "Onboard members",
          "Support participation",
        ]}
      />

      <section className="bg-muted py-20">
        <div className="section-shell grid gap-12 lg:grid-cols-2">
          <div>
            <SectionHeader
              eyebrow="Become a partner"
              title="Start the conversation."
              copy="Tell us about your organization and the wellness benefit you want to create."
            />

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {[Dumbbell, Users, HeartPulse, Building2].map((Icon, i) => (
                <div
                  key={i}
                  className="border border-border bg-background p-5"
                >
                  <Icon className="text-primary" />

                  <p className="mt-8 font-bold">
                    {
                      [
                        "Gym access",
                        "Group sessions",
                        "Recovery services",
                        "Corporate wellness",
                      ][i]
                    }
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-background p-6 sm:p-8">
            <ContactForm partnership />
          </div>
        </div>
      </section>
    </main>
  );
}

function HmoPartnerLogo({
  name,
  logo,
}: {
  name: string;
  logo: string;
}) {
  return (
    <div className="flex min-h-[150px] flex-col items-center justify-center border border-border bg-background p-6 transition-transform hover:-translate-y-1">
      <div className="flex h-20 w-full items-center justify-center">
        <img
          src={logo}
          alt={`${name} logo`}
          loading="lazy"
          className="max-h-20 max-w-[85%] object-contain"
        />
      </div>

      <p className="mt-5 text-center text-xs font-extrabold uppercase tracking-wide">
        {name}
      </p>
    </div>
  );
}

export function ContactPage() {
  return (
    <main>
      <PageHero
        eyebrow="Visit or enquire"
        title="Let’s get you started."
        copy="Talk to the Super Plus team about membership, training, recovery or partnerships."
        image={images.hero}
      />

      <LocationSection />

      <section className="py-20">
        <div className="section-shell grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHeader
            eyebrow="Send a message"
            title="We’re here to help."
            copy="For the fastest response, call or message us on WhatsApp during opening hours."
          />

          <ContactForm />
        </div>
      </section>
    </main>
  );
}

function InfoBand({
  title,
  copy,
  items,
}: {
  title: string;
  copy: string;
  items: string[];
}) {
  return (
    <section className="py-20 sm:py-28">
      <div className="section-shell grid gap-12 lg:grid-cols-2">
        <SectionHeader eyebrow="Super Plus" title={title} copy={copy} />

        <div className="grid gap-px bg-border sm:grid-cols-3 lg:grid-cols-1">
          {items.map((item, index) => (
            <div
              key={item}
              className="flex items-center gap-5 bg-background p-6"
            >
              <span className="font-display text-4xl font-bold text-primary">
                0{index + 1}
              </span>

              <strong className="uppercase">{item}</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Process({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <section className="bg-muted py-20">
      <div className="section-shell">
        <SectionHeader eyebrow="The process" title={title} />

        <div className="mt-12 grid gap-px bg-border md:grid-cols-4">
          {items.map((item, index) => (
            <div key={item} className="bg-muted p-6">
              <span className="font-display text-5xl font-bold text-primary">
                0{index + 1}
              </span>

              <h3 className="mt-12 font-display text-2xl font-bold uppercase">
                {item}
              </h3>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* MEMBER LOGIN */
export function LoginPage() {
  return (
    <UtilityPage
      title="Member login"
      copy="Access your Super Plus Fitness membership account."
    >
      <div className="grid gap-4">
        <Button asChild size="lg">
          <a
            href="https://members.superplusfitness.com"
            rel="noopener noreferrer"
          >
            Continue to member login
          </a>
        </Button>

        <p className="text-sm text-muted-foreground">
          You will be securely redirected to the Super Plus Fitness member
          system.
        </p>
      </div>
    </UtilityPage>
  );
}

export function MemberPage() {
  return (
    <UtilityPage
      title="Welcome, member"
      copy="Your membership essentials will be immediately accessible here after login."
    >
      <IntegrationNotice />

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="bg-muted p-5">
          <span className="text-xs font-bold uppercase text-muted-foreground">
            Membership status
          </span>

          <p className="mt-2 font-display text-3xl font-bold uppercase">
            Awaiting connection
          </p>
        </div>

        <div className="bg-muted p-5">
          <span className="text-xs font-bold uppercase text-muted-foreground">
            Expiry date
          </span>

          <p className="mt-2 font-display text-3xl font-bold uppercase">
            —
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-[0.7fr_1fr]">
        <QRPreview />

        <div className="flex flex-col justify-center">
          <h2 className="font-display text-4xl font-bold uppercase">
            Your QR, ready when you are.
          </h2>

          <p className="mt-3 text-sm text-muted-foreground">
            Open your full-screen member code before you reach reception.
          </p>

          <Button asChild size="lg" className="mt-6">
            <Link to="/my-qr">
              Show QR code <ScanLine />
            </Link>
          </Button>
        </div>
      </div>
    </UtilityPage>
  );
}

/* MY QR CODE */
export function MyQrPage() {
  return (
    <UtilityPage
      title="My QR code"
      copy="Access your personal membership QR code for fast check-in at reception."
    >
      <div className="grid gap-4">
        <Button asChild size="lg">
          <a
            href="https://members.superplusfitness.com/membership-qr-code"
            rel="noopener noreferrer"
          >
            Open my QR code <ScanLine />
          </a>
        </Button>

        <p className="text-sm text-muted-foreground">
          You may be asked to log in before your personal QR code is displayed.
        </p>
      </div>
    </UtilityPage>
  );
}

/* RECEPTION CHECK-IN */
export function ReceptionPage() {
  return (
    <UtilityPage
      title="Reception check-in"
      copy="Scan a member QR code to verify access."
    >
      <div className="grid gap-4">
        <Button asChild size="lg">
          <a
            href="https://members.superplusfitness.com/reception-check-in"
            rel="noopener noreferrer"
          >
            Open reception check-in <ScanLine />
          </a>
        </Button>

        <p className="text-sm text-muted-foreground">
          Reception staff can use the existing Super Plus Fitness check-in
          system.
        </p>
      </div>
    </UtilityPage>
  );
}

function UtilityPage({
  title,
  copy,
  children,
}: {
  title: string;
  copy: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-[75vh] bg-secondary py-12 text-secondary-foreground sm:py-20">
      <div className="section-shell">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-bold uppercase text-primary">
            Super Plus member services
          </p>

          <h1 className="display-title mt-4 text-6xl sm:text-8xl">
            {title}
          </h1>

          <p className="mt-5 max-w-xl text-secondary-foreground/70">
            {copy}
          </p>

          <div className="mt-10 bg-background p-5 text-foreground sm:p-8">
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
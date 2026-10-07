import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDownToLine,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Dumbbell,
  ExternalLink,
  Flame,
  Info,
  Newspaper,
  Settings2,
  ShieldCheck,
  Smartphone,
  Trophy,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { pageHead } from "@/lib/seo";

const APK_URL =
  "https://github.com/ibrolee/superplus-premium-lagos/releases/download/spf-full-app-1.0.0-2026-10-07/Super-Plus-Fitness-1.0.0.apk";

const features = [
  {
    icon: Smartphone,
    title: "Membership",
    copy: "See your active plan, membership card, history and member information.",
  },
  {
    icon: Dumbbell,
    title: "Workouts & goals",
    copy: "Use workout tools, gym goals and activity features built for your routine.",
  },
  {
    icon: Trophy,
    title: "SP Points & rewards",
    copy: "Earn points, complete challenges and unlock member rewards.",
  },
  {
    icon: Flame,
    title: "Streaks & challenges",
    copy: "Keep your momentum going with app streaks and recurring challenges.",
  },
  {
    icon: CalendarDays,
    title: "Bookings",
    copy: "Request personal training, classes, spa and recovery services.",
  },
  {
    icon: Newspaper,
    title: "Blog & updates",
    copy: "Read fitness content, announcements and important Super Plus updates.",
  },
];

const installSteps = [
  {
    icon: ArrowDownToLine,
    number: "01",
    title: "Download the APK",
    copy: "Tap the Android download button on this page and wait for the file to finish downloading.",
  },
  {
    icon: Settings2,
    number: "02",
    title: "Allow installation if asked",
    copy: "Android may ask you to allow your browser to install apps from this source. Follow the on-screen Android prompt.",
  },
  {
    icon: ShieldCheck,
    number: "03",
    title: "Let Android check the file",
    copy: "Your phone may run a Play Protect security check because the app is installed directly rather than through Google Play.",
  },
  {
    icon: CheckCircle2,
    number: "04",
    title: "Install and sign in",
    copy: "Complete the installation, open Super Plus Fitness and sign in or create your member account.",
  },
];

function AppDownloadPage() {
  return (
    <main className="overflow-hidden bg-[#090909] text-white">
      <section className="relative isolate overflow-hidden border-b border-white/10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-32 -top-28 size-[30rem] rounded-full bg-primary/25 blur-[110px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-48 right-[-8rem] size-[34rem] rounded-full bg-orange-500/20 blur-[130px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.65) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.65) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <div className="section-shell relative grid min-h-[78vh] gap-12 py-16 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-primary">
              <Zap className="size-3.5" />
              Official Super Plus Fitness app
            </div>

            <h1 className="mt-6 font-display text-[clamp(4rem,9vw,8.5rem)] font-extrabold uppercase leading-[0.78] tracking-[-0.055em]">
              Your gym.
              <br />
              <span className="bg-gradient-to-r from-primary via-orange-400 to-[#ff7a18] bg-clip-text text-transparent">
                In your pocket.
              </span>
            </h1>

            <p className="mt-7 max-w-2xl text-base leading-7 text-white/65 sm:text-lg sm:leading-8">
              Membership, workouts, goals, bookings, SP Points, rewards, challenges and Super Plus
              updates — together in one member app.
            </p>

            <div className="mt-7 flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white/60">
              <span className="rounded-full border border-white/15 bg-white/[0.05] px-3 py-2">Android APK</span>
              <span className="rounded-full border border-white/15 bg-white/[0.05] px-3 py-2">Version 1.0.0</span>
              <span className="rounded-full border border-white/15 bg-white/[0.05] px-3 py-2">Approx. 48 MB</span>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-14 rounded-2xl px-6 text-sm font-extrabold">
                <a href={APK_URL}>
                  <ArrowDownToLine className="size-5" />
                  Download for Android
                </a>
              </Button>

              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-14 rounded-2xl border-white/20 bg-white/[0.04] px-6 text-white hover:bg-white/10 hover:text-white"
              >
                <a href="#how-to-install">
                  How to install
                  <ArrowRight className="size-4" />
                </a>
              </Button>
            </div>

            <p className="mt-4 flex max-w-xl gap-2 text-xs leading-5 text-white/45">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
              Download the app only from this official Super Plus Fitness page. Android may show an
              installation or Play Protect prompt because this version is distributed directly.
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-[430px]">
            <div
              aria-hidden="true"
              className="absolute inset-x-12 bottom-2 h-24 rounded-full bg-primary/25 blur-3xl"
            />

            <div className="relative rotate-[2deg] rounded-[3.3rem] border border-white/15 bg-[#151515] p-2.5 shadow-[0_45px_100px_rgba(0,0,0,.55)] transition-transform duration-500 hover:rotate-0">
              <div className="relative min-h-[680px] overflow-hidden rounded-[2.8rem] bg-[#f8f6f3] p-5 text-[#171717] sm:min-h-[720px]">
                <div className="mx-auto mb-5 h-5 w-28 rounded-full bg-black" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="grid size-12 place-items-center rounded-2xl bg-white shadow-sm">
                      <img
                        src="/footer-logo-circular.webp"
                        alt="Super Plus Fitness"
                        className="size-10 rounded-full object-contain"
                      />
                    </div>
                    <div>
                      <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#e44824]">
                        Member app
                      </p>
                      <p className="text-xs font-black">SUPER PLUS FITNESS</p>
                    </div>
                  </div>
                  <div className="size-10 rounded-2xl border border-black/10 bg-white" />
                </div>

                <p className="mt-8 text-[11px] font-bold text-black/45">GOOD AFTERNOON</p>
                <h2 className="mt-1 text-3xl font-black tracking-[-0.04em]">Welcome back.</h2>

                <div className="relative mt-5 overflow-hidden rounded-[1.7rem] bg-black p-5 text-white">
                  <div className="absolute -bottom-16 -right-10 size-36 rounded-full bg-gradient-to-br from-primary to-orange-400 opacity-90" />
                  <div className="relative">
                    <div className="flex items-center justify-between text-[9px] font-extrabold uppercase tracking-[0.12em] text-white/55">
                      <span>Membership</span>
                      <span className="text-green-400">● Active</span>
                    </div>
                    <p className="mt-4 text-2xl font-black">Monthly Gym</p>
                    <p className="mt-1 text-[10px] text-white/55">Your active membership at a glance</p>
                    <div className="mt-7 grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[8px] font-bold uppercase text-white/45">Status</p>
                        <p className="mt-1 text-xs font-extrabold">ACTIVE</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] font-bold uppercase text-white/45">Member</p>
                        <p className="mt-1 text-xs font-extrabold">SUPER PLUS</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-[1.4rem] border border-[#eadfd8] bg-[#fff0e8] p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#e44824]">
                        Your momentum
                      </p>
                      <p className="mt-1 text-lg font-black">SP Points & streaks</p>
                    </div>
                    <Trophy className="size-7 text-[#e44824]" />
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/10">
                    <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-[#e44824] to-orange-400" />
                  </div>
                </div>

                <p className="mb-3 mt-6 text-sm font-black">Quick access</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    [Dumbbell, "Workouts"],
                    [CalendarDays, "Bookings"],
                    [Trophy, "Rewards"],
                    [Newspaper, "Blog"],
                  ].map(([Icon, label]) => (
                    <div
                      key={label as string}
                      className="rounded-[1.3rem] border border-black/10 bg-white p-4 shadow-sm"
                    >
                      <div className="grid size-9 place-items-center rounded-xl bg-[#fff0e8]">
                        <Icon className="size-4 text-[#e44824]" />
                      </div>
                      <p className="mt-3 text-xs font-extrabold">{label as string}</p>
                    </div>
                  ))}
                </div>

                <div className="absolute inset-x-5 bottom-5 flex items-center justify-around rounded-[1.35rem] border border-black/10 bg-white/95 px-3 py-3 shadow-lg backdrop-blur">
                  <div className="grid place-items-center gap-1 text-[#e44824]">
                    <span className="size-2 rounded-full bg-[#e44824]" />
                    <span className="text-[8px] font-extrabold">HOME</span>
                  </div>
                  {["MEMBERSHIP", "BOOK", "REWARDS", "MORE"].map((item) => (
                    <span key={item} className="text-[7px] font-extrabold text-black/35">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="absolute -left-6 top-24 hidden rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-xs font-bold shadow-xl backdrop-blur md:block">
              <Check className="mr-2 inline size-4 text-primary" />
              Membership
            </div>
            <div className="absolute -right-8 bottom-32 hidden rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-xs font-bold shadow-xl backdrop-blur md:block">
              <Flame className="mr-2 inline size-4 text-primary" />
              Rewards & streaks
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#0d0d0d] py-16 sm:py-20">
        <div className="section-shell">
          <div className="max-w-3xl">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-primary">
              Everything together
            </p>
            <h2 className="mt-3 font-display text-5xl font-extrabold uppercase leading-[0.9] tracking-tight sm:text-7xl">
              Built for Super Plus members.
            </h2>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-white/55 sm:text-base">
              The app brings your membership experience, gym tools and rewards into one place.
            </p>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <article
                  key={feature.title}
                  className="group rounded-[1.7rem] border border-white/10 bg-white/[0.035] p-5 transition duration-300 hover:-translate-y-1 hover:border-primary/45 hover:bg-white/[0.06]"
                >
                  <div className="grid size-11 place-items-center rounded-2xl bg-primary/12 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="mt-5 font-display text-2xl font-bold uppercase">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/50">{feature.copy}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="how-to-install" className="relative py-16 sm:py-24">
        <div className="section-shell">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div className="lg:sticky lg:top-28">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-primary">
                Android installation
              </p>
              <h2 className="mt-3 font-display text-5xl font-extrabold uppercase leading-[0.88] tracking-tight sm:text-7xl">
                Download.
                <br />
                Install.
                <br />
                Start.
              </h2>
              <p className="mt-5 max-w-lg text-sm leading-7 text-white/55">
                Installing an APK directly is slightly different from installing an app from the
                Play Store. Follow these steps on your Android phone.
              </p>

              <Button asChild size="lg" className="mt-7 h-13 rounded-2xl">
                <a href={APK_URL}>
                  <ArrowDownToLine className="size-5" />
                  Download APK
                </a>
              </Button>
            </div>

            <div className="grid gap-4">
              {installSteps.map((step) => {
                const Icon = step.icon;
                return (
                  <article
                    key={step.number}
                    className="grid gap-4 rounded-[1.7rem] border border-white/10 bg-white/[0.035] p-5 sm:grid-cols-[auto_1fr] sm:items-start sm:p-6"
                  >
                    <div className="flex items-center gap-3 sm:block">
                      <div className="grid size-12 place-items-center rounded-2xl bg-primary text-white">
                        <Icon className="size-5" />
                      </div>
                      <span className="font-display text-2xl font-extrabold text-white/20 sm:mt-3 sm:block">
                        {step.number}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-display text-2xl font-bold uppercase">{step.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-white/55">{step.copy}</p>
                    </div>
                  </article>
                );
              })}

              <div className="mt-2 flex gap-3 rounded-[1.7rem] border border-primary/25 bg-primary/[0.08] p-5">
                <Info className="mt-0.5 size-5 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-extrabold">A security prompt can be normal.</p>
                  <p className="mt-1 text-xs leading-5 text-white/55">
                    Android may warn that the app came from outside Google Play or ask permission to
                    install from your browser. Confirm that you are on superplusfitness.com before
                    continuing. Never install an SPF APK sent from an unknown source.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-gradient-to-br from-[#17110f] via-[#111] to-[#090909] py-14 sm:py-16">
        <div className="section-shell">
          <div className="overflow-hidden rounded-[2.2rem] border border-white/10 bg-white/[0.04] p-6 sm:p-8 lg:flex lg:items-center lg:justify-between lg:gap-10">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-primary">
                Super Plus Fitness 1.0.0
              </p>
              <h2 className="mt-2 font-display text-4xl font-extrabold uppercase sm:text-5xl">
                Ready for your Android phone.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/50">
                Download the current official Android release. Future versions can be installed as
                updates when they are released.
              </p>
            </div>

            <div className="mt-6 flex shrink-0 flex-col gap-3 sm:flex-row lg:mt-0">
              <Button asChild size="lg" className="h-13 rounded-2xl">
                <a href={APK_URL}>
                  Download APK
                  <ArrowDownToLine className="size-5" />
                </a>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-13 rounded-2xl border-white/20 bg-white/[0.03] text-white hover:bg-white/10 hover:text-white"
              >
                <a href={APK_URL} target="_blank" rel="noopener noreferrer">
                  Release file
                  <ExternalLink className="size-4" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export const Route = createFileRoute("/app")({
  head: () =>
    pageHead(
      "Download the Super Plus Fitness Android App",
      "Download the official Super Plus Fitness Android app for memberships, workouts, bookings, SP Points, rewards, challenges and member updates.",
      "/app",
    ),
  component: AppDownloadPage,
});

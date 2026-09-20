import { Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight, BookOpen, Check, Clock3, MapPin, MessageCircle, Phone } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { contact, facilities, formatNaira, images, membershipPlans, openingHours, recoveryServices } from "@/lib/site-data";

type JournalPost = {
  id: string;
  title: string;
  slug: string;
  category: string;
  featured_image: string | null;
  excerpt: string | null;
};

const solidButton = "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-center text-xs font-extrabold uppercase text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";
const lightButton = "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/50 px-6 py-3 text-center text-xs font-extrabold uppercase text-white transition-colors hover:bg-white hover:text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white";
const darkButton = "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-secondary px-6 py-3 text-center text-xs font-extrabold uppercase text-secondary-foreground transition-colors hover:bg-secondary/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

function SectionHeading({ eyebrow, children, inverse = false, copy }: { eyebrow: string; children: ReactNode; inverse?: boolean; copy?: string }) {
  return <div className="max-w-2xl">
    <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
    <h2 className={`font-display text-[clamp(2.6rem,8vw,5.6rem)] font-extrabold uppercase leading-[0.96] ${inverse ? "text-white" : "text-foreground"}`}>{children}</h2>
    {copy && <p className={`mt-4 max-w-xl text-sm leading-7 sm:text-base ${inverse ? "text-white/70" : "text-muted-foreground"}`}>{copy}</p>}
  </div>;
}

function Journal() {
  const [posts, setPosts] = useState<JournalPost[]>([]);
  useEffect(() => {
    let cancelled = false;
    async function loadPosts() {
      try {
        const { data, error } = await supabase.from("blog_posts")
          .select("id,title,slug,category,featured_image,excerpt")
          .eq("status", "published")
          .not("published_at", "is", null)
          .lte("published_at", new Date().toISOString())
          .order("published_at", { ascending: false }).limit(3);
        if (!cancelled && !error && data) setPosts(data as JournalPost[]);
      } catch { /* The blog CTA remains available when the feed is unavailable. */ }
    }
    void loadPosts();
    return () => { cancelled = true; };
  }, []);

  return <section aria-labelledby="home-journal" className="bg-background py-14 sm:py-20">
    <div className="section-shell">
      <SectionHeading eyebrow="06 / The Fitness Journal" copy="Practical fitness, nutrition and recovery insights from our published articles.">Train smarter.<br />Live better.</SectionHeading>
      {posts.length > 0 && <div className="mt-7 grid gap-4 md:grid-cols-3">
        {posts.map((post, index) => <a key={post.id} href={`/blog/article?slug=${encodeURIComponent(post.slug)}`} className={`group overflow-hidden rounded-xl border border-border bg-card transition-transform hover:-translate-y-1 hover:shadow-lg ${index === 0 ? "md:col-span-1" : ""}`}>
          <div className="relative aspect-[16/10] overflow-hidden bg-muted">
            {post.featured_image ? <img src={post.featured_image} alt={post.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/20 via-muted to-background"><BookOpen className="size-12 text-primary/60" aria-hidden="true" /></div>}
          </div>
          <div className="p-5"><p className="text-[10px] font-extrabold uppercase tracking-wider text-primary">{post.category}</p><h3 className="mt-2 text-lg font-extrabold leading-snug">{post.title}</h3>{post.excerpt && <p className="mt-2 line-clamp-2 text-xs leading-6 text-muted-foreground">{post.excerpt}</p>}<span className="mt-4 inline-flex items-center gap-2 text-xs font-extrabold uppercase text-primary">Read article <ArrowUpRight className="size-4" /></span></div>
        </a>)}
      </div>}
      <Link to="/blog" className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-primary px-5 text-xs font-extrabold uppercase text-primary transition-colors hover:bg-primary hover:text-white sm:w-auto">Read all articles <ArrowRight className="size-4" /></Link>
    </div>
  </section>;
}

export function HomePageV2() {
  const featuredPlans = membershipPlans.filter(plan => plan.id === "monthly" || plan.id === "quarterly");
  const spaPreview = recoveryServices.filter(service => service.id === "full-body-massage" || service.id === "vip-chair");
  return <main className="overflow-x-clip">
    {/* Hero: keep the actual current homepage image. */}
    <section aria-label="Welcome to Super Plus Fitness" className="relative flex min-h-[min(760px,calc(100svh-3.5rem))] items-end overflow-hidden bg-secondary text-white sm:min-h-[750px]">
      <img src={images.hero} alt="Illustrative image of strength training" width={1536} height={1024} fetchPriority="high" className="absolute inset-0 h-full w-full object-cover object-[60%_center] sm:object-center" />
      <div className="absolute inset-0 bg-gradient-to-t from-secondary via-secondary/75 to-secondary/20" />
      <div className="section-shell relative w-full pb-10 pt-28 sm:pb-16">
        <p className="mb-5 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-white/85"><span className="size-2 rounded-full bg-primary" /> Shomolu, Lagos</p>
        <h1 className="max-w-5xl font-display text-[clamp(3.5rem,13vw,9rem)] font-extrabold uppercase leading-[0.92] tracking-tight">Build<br />stronger.<br /><span className="text-primary">Live better.</span></h1>
        <div className="mt-5 h-1 w-12 bg-primary" />
        <p className="mt-5 max-w-lg text-sm leading-7 text-white/85 sm:text-lg">Modern fitness, personal training, spa and recovery — all under one roof in Shomolu, Lagos.</p>
        <div className="mt-7 grid gap-3 sm:flex"><Link to="/join" className={solidButton}>Join now <ArrowUpRight className="size-4" /></Link><Link to="/membership" className={lightButton}>Explore membership <ArrowRight className="size-4" /></Link></div>
        <p className="mt-8 border-t border-white/20 pt-4 text-[10px] font-bold uppercase tracking-[0.17em] text-white/60">Fitness · Spa · Recovery</p>
      </div>
    </section>

    {/* Experience: image-led, without inventing photos of the actual gym. */}
    <section className="bg-background py-14 sm:py-20"><div className="section-shell">
      <SectionHeading eyebrow="01 / The Experience" copy="Fitness, personal coaching and recovery in one convenient destination.">More than<br />a gym.</SectionHeading>
      <div className="mt-7 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {[
          { title: "Fitness", label: "Build your strength", image: facilities[0]?.image ?? images.facilities, to: "/facilities" as const, index: "01" },
          { title: "Personal Training", label: "Train with purpose", image: images.training, to: "/personal-training" as const, index: "02" },
          { title: "Spa & Recovery", label: "Recover and recharge", image: images.recovery, to: "/spa-recovery" as const, index: "03" },
        ].map((card, index) => <Link key={card.title} to={card.to} className={`group relative flex min-h-56 items-end overflow-hidden rounded-xl bg-secondary text-white ${index === 0 ? "min-h-72 md:col-span-2 lg:col-span-1 lg:min-h-80" : "lg:min-h-80"}`}>
          <img src={card.image} alt={`${card.title} illustrative visual`} loading="lazy" width={1024} height={683} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-secondary via-secondary/20 to-transparent" />
          <div className="relative w-full p-5"><p className="text-[10px] font-bold text-primary">{card.index} / {card.title}</p><div className="mt-2 flex items-end justify-between gap-3"><div><h3 className="font-display text-3xl font-bold uppercase">{card.label}</h3><span className="mt-2 inline-block text-xs font-bold">Explore <ArrowUpRight className="inline size-4" /></span></div><ArrowUpRight className="size-6 shrink-0 text-primary" /></div></div>
        </Link>)}
      </div>
    </div></section>

    {/* Compact gallery: every existing facility remains present. */}
    <section className="bg-secondary py-14 text-white sm:py-20"><div className="section-shell">
      <div className="flex flex-wrap items-end justify-between gap-5"><SectionHeading eyebrow="02 / Our Facilities" inverse copy="Explore equipment and spaces for a complete workout.">Your space to<br />get stronger.</SectionHeading><Link to="/facilities" className="hidden text-xs font-extrabold uppercase text-primary hover:underline sm:inline-flex">View facilities <ArrowUpRight className="ml-2 size-4" /></Link></div>
      <div aria-label="Swipeable facilities gallery" className="-mr-4 mt-7 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-5 pr-4 [scrollbar-width:thin] md:mr-0 md:grid md:grid-cols-3 md:overflow-visible md:pr-0">
        {facilities.map((facility, index) => <Link key={facility.name} to="/facilities" className="group relative flex min-h-72 min-w-[76%] snap-start items-end overflow-hidden rounded-xl bg-black sm:min-w-[44%] md:min-w-0">
          <img src={facility.image} alt={`${facility.name} illustrative facilities image`} loading="lazy" width={1024} height={683} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent" />
          <div className="relative p-5"><span className="text-[10px] font-bold text-primary">0{index + 1} / 05</span><h3 className="mt-2 font-display text-3xl font-bold uppercase">{facility.name}</h3><p className="mt-2 line-clamp-2 text-xs leading-5 text-white/75">{facility.description}</p></div>
        </Link>)}
      </div><p className="mb-4 text-right text-[10px] font-extrabold uppercase tracking-widest text-white/50 md:hidden">Swipe to explore →</p>
      <Link to="/facilities" className={`${lightButton} w-full sm:hidden`}>View all facilities <ArrowRight className="size-4" /></Link>
    </div></section>

    {/* Pricing is always derived from the existing live site data. */}
    <section className="bg-[#faf7f3] py-14 sm:py-20"><div className="section-shell">
      <SectionHeading eyebrow="03 / Membership" copy="Flexible gym and longer-term memberships to match your routine.">Find your plan.</SectionHeading>
      <div className="mt-7 grid gap-4 lg:grid-cols-2">
        {featuredPlans.map((plan, index) => <article key={plan.id} className={`flex flex-col rounded-xl border p-6 sm:p-8 ${index === 1 ? "border-secondary bg-secondary text-white" : "border-primary/35 bg-white text-secondary"}`}>
          <div className="flex items-center justify-between gap-3"><span className="text-[11px] font-extrabold uppercase tracking-wider text-primary">{plan.group}</span>{plan.badge && <span className="rounded bg-primary px-2 py-1 text-[10px] font-extrabold uppercase text-white">{plan.badge}</span>}</div>
          <h3 className="mt-4 font-display text-3xl font-extrabold uppercase">{plan.name}</h3><p className="mt-3 font-display text-5xl font-extrabold">{formatNaira(plan.price)}</p><p className={`mt-2 text-xs ${index === 1 ? "text-white/65" : "text-muted-foreground"}`}>{plan.duration} · {formatNaira(plan.registration)} registration</p>
          <ul className="my-6 space-y-3 border-t border-current/10 pt-5">{plan.benefits.map(benefit => <li className="flex items-start gap-3 text-sm" key={benefit}><Check className="mt-0.5 size-4 shrink-0 text-primary" />{benefit}</li>)}</ul>
          <Link to="/join" search={{ plan: plan.id }} className={`${index === 1 ? solidButton : darkButton} mt-auto`}>Choose {plan.name} <ArrowRight className="size-4" /></Link>
        </article>)}
      </div><Link to="/membership" className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-primary px-6 text-xs font-extrabold uppercase text-primary transition-colors hover:bg-primary hover:text-white sm:w-auto">Explore all membership plans <ArrowRight className="size-4" /></Link>
    </div></section>

    {/* Full-width existing training photograph. */}
    <section className="grid bg-secondary text-white lg:grid-cols-2"><div className="relative min-h-[320px] overflow-hidden sm:min-h-[430px]"><img src={images.training} alt="Illustrative personal training image" loading="lazy" width={1536} height={1024} className="absolute inset-0 h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-secondary/70 to-transparent lg:hidden" /></div><div className="flex items-center px-5 py-10 sm:px-12 sm:py-16 lg:px-16"><div><SectionHeading eyebrow="04 / Personal Training" inverse copy="Work with a personal coach for structured guidance, focused training and accountability.">Don't just<br />work out.<br /><span className="text-primary">Train with purpose.</span></SectionHeading><Link to="/personal-training" className={`${solidButton} mt-6 w-full sm:w-auto`}>Start personal training <ArrowRight className="size-4" /></Link></div></div></section>

    {/* Recovery visual and real existing services, rather than invented offerings. */}
    <section className="bg-[#f8f5f1] pb-14 sm:pb-20"><div className="relative flex min-h-[275px] items-end overflow-hidden bg-secondary sm:min-h-[380px]"><img src={images.recovery} alt="Illustrative spa and recovery image" loading="lazy" width={1536} height={1024} className="absolute inset-0 h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-secondary/90 via-secondary/30 to-transparent" /><div className="section-shell relative w-full pb-7"><SectionHeading eyebrow="05 / Spa & Recovery" inverse>Recover.<br />Reset. Recharge.</SectionHeading></div></div><div className="section-shell pt-7"><p className="max-w-xl text-sm leading-7 text-muted-foreground">Explore massage, relaxation and wellness services alongside your training.</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{spaPreview.map(service => <Link key={service.id} to="/spa-recovery" className="flex items-center justify-between gap-4 rounded-xl border border-border bg-white p-5"><div><h3 className="font-display text-xl font-bold uppercase">{service.name}</h3><p className="mt-1 text-xs text-muted-foreground">{service.duration ?? "Ask for details"}</p></div><div className="text-right"><span className="font-display text-2xl font-bold text-primary">{service.price === null ? "Enquire" : formatNaira(service.price)}</span><ArrowUpRight className="ml-auto mt-1 size-4 text-primary" /></div></Link>)}</div><Link to="/spa-recovery" className={`${darkButton} mt-5 w-full sm:w-auto`}>Explore all spa services <ArrowRight className="size-4" /></Link></div></section>

    {/* No unverified reviews, ratings or invented member counts. */}
    <section className="grid bg-secondary text-white lg:grid-cols-2"><div className="relative min-h-[275px] lg:min-h-[410px]"><img src="/group-classes.png" alt="Illustrative group training image" loading="lazy" width={1536} height={1024} className="absolute inset-0 h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-secondary/70 via-transparent to-transparent" /></div><div className="flex items-center px-5 py-10 sm:px-12 lg:px-16"><div className="w-full"><SectionHeading eyebrow="Our Community" inverse copy="Stay connected for gym announcements, upcoming activities and membership information.">Train together.<br /><span className="text-primary">Grow together.</span></SectionHeading><a href={contact.whatsapp} target="_blank" rel="noreferrer" className={`${lightButton} mt-6 w-full sm:w-auto`}><MessageCircle className="size-4" /> Chat with our team <ArrowUpRight className="size-4" /></a></div></div></section>

    <Journal />

    <section className="relative overflow-hidden bg-secondary py-14 text-white sm:py-20"><img src="/modern-equipment.png" alt="Illustrative fitness equipment image" loading="lazy" width={1536} height={1024} className="absolute inset-0 h-full w-full object-cover opacity-20" /><div className="section-shell relative"><SectionHeading eyebrow="07 / HMO & Corporate" inverse copy="Explore fitness and wellness partnerships for HMOs, organisations and their members.">Fitness benefits<br />for your members.</SectionHeading><Link to="/hmo" className={`${solidButton} mt-6 w-full sm:w-auto`}>Explore partnerships <ArrowRight className="size-4" /></Link></div></section>

    <section className="bg-background py-14 sm:py-20"><div className="section-shell"><SectionHeading eyebrow="08 / Visit Us">Find us in<br />Shomolu.</SectionHeading><div className="mt-7 grid overflow-hidden rounded-xl border border-border lg:grid-cols-2"><div className="space-y-5 p-6 sm:p-8"><p className="flex items-start gap-3 text-sm"><MapPin className="size-5 shrink-0 text-primary" />{contact.address}</p><p className="flex items-center gap-3 text-sm"><Phone className="size-5 shrink-0 text-primary" />{contact.phone}</p>{openingHours.map(item => <p key={item.days} className="flex items-start gap-3 text-sm"><Clock3 className="size-5 shrink-0 text-primary" /><span><strong>{item.days}</strong><br />{item.hours}</span></p>)}<div className="grid grid-cols-2 gap-2 pt-2"><a href={contact.directions} target="_blank" rel="noreferrer" className={`${darkButton} col-span-2`}>Get directions <ArrowUpRight className="size-4" /></a><a href={`tel:${contact.phoneHref}`} className="flex min-h-12 items-center justify-center rounded-lg border border-border text-xs font-extrabold uppercase">Call us</a><a href={contact.whatsapp} target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-center rounded-lg border border-border text-xs font-extrabold uppercase">WhatsApp</a></div></div><iframe title="Map showing Super Plus Fitness in Shomolu" src="https://www.google.com/maps?q=105%20Apata%20Street%20Shomolu%20Lagos&output=embed" loading="lazy" className="min-h-[245px] w-full border-0 grayscale lg:min-h-full" /></div></div></section>

    <section className="bg-primary py-14 text-primary-foreground sm:py-20"><div className="section-shell flex flex-col justify-between gap-7 md:flex-row md:items-end"><div><p className="mb-3 text-[11px] font-extrabold uppercase tracking-wider text-white/80">Your next chapter</p><h2 className="max-w-3xl font-display text-[clamp(3rem,9vw,6rem)] font-extrabold uppercase leading-[0.94]">Your next level<br />starts here.</h2><p className="mt-4 max-w-md text-sm leading-7 text-white/85">Find a membership that fits your life and take the next step.</p></div><Link to="/join" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-7 py-3 text-xs font-extrabold uppercase text-primary transition-colors hover:bg-white/90">Join now <ArrowUpRight className="size-4" /></Link></div></section>
  </main>;
}

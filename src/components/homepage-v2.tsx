import { Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, Dumbbell, HeartPulse, Target } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  FinalCTA,
  LocationSection,
  MembershipCard,
  SectionHeader,
  ServiceCard,
} from "@/components/site";
import { supabase } from "@/lib/supabase";
import { facilities, images, membershipPlans, recoveryServices } from "@/lib/site-data";

type BlogPost = {
  id: string;
  title: string;
  slug: string;
  category: string;
  excerpt: string | null;
  featured_image: string | null;
};

/** The homepage uses the public published-post query; it never requests drafts or member records. */
function HomeJournal() {
  const [posts, setPosts] = useState<BlogPost[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data, error } = await supabase
          .from("blog_posts")
          .select("id,title,slug,category,excerpt,featured_image")
          .eq("status", "published")
          .not("published_at", "is", null)
          .lte("published_at", new Date().toISOString())
          .order("published_at", { ascending: false })
          .limit(3);
        if (!cancelled && !error && data) setPosts(data as BlogPost[]);
      } catch {
        // If the public blog feed is temporarily unavailable, retain the Blog link.
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="bg-background py-14 sm:py-20" aria-labelledby="home-journal-title">
      <div className="section-shell">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="mb-3 text-xs font-extrabold uppercase tracking-widest text-primary">
              The fitness journal
            </p>
            <h2 id="home-journal-title" className="display-title text-5xl sm:text-7xl">
              Train smarter. Live better.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
              Fitness, nutrition, recovery and wellness insights from our blog.
            </p>
          </div>
          <Button asChild variant="outline" size="lg" className="hidden sm:inline-flex">
            <Link to="/blog">
              Read our blog <ArrowRight />
            </Link>
          </Button>
        </div>

        {posts.length > 0 && (
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {posts.map((post) => (
              <a
                key={post.id}
                href={`/blog/article?slug=${encodeURIComponent(post.slug)}`}
                className="group overflow-hidden rounded-xl border border-border bg-card transition-all hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div className="aspect-[16/10] overflow-hidden bg-muted">
                  {post.featured_image ? (
                    <img
                      src={post.featured_image}
                      alt={post.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/15 to-muted">
                      <BookOpen className="size-12 text-primary/60" aria-hidden="true" />
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <p className="text-xs font-bold uppercase text-primary">{post.category}</p>
                  <h3 className="mt-2 text-xl font-extrabold leading-snug">{post.title}</h3>
                  {post.excerpt && (
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">
                      {post.excerpt}
                    </p>
                  )}
                  <span className="mt-5 inline-flex items-center gap-2 text-xs font-extrabold uppercase text-primary">
                    Read article <ArrowRight className="size-4" />
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
        <Button asChild variant="outline" size="lg" className="mt-6 w-full sm:hidden">
          <Link to="/blog">
            Read our blog <ArrowRight />
          </Link>
        </Button>
      </div>
    </section>
  );
}

/** Preserve the original homepage's identity, imagery, sections and four displayed plans. */
export function HomePageV2() {
  const featuredPlans = [
    membershipPlans[2],
    membershipPlans[3],
    membershipPlans[6],
    membershipPlans[9],
  ];
  const experience = [
    {
      name: "Fitness",
      description:
        "Modern equipment and spaces designed for strength, cardio and everyday fitness.",
      icon: Dumbbell,
    },
    {
      name: "Training",
      description: "Personal and group training designed around your goals.",
      icon: Target,
    },
    {
      name: "Recovery",
      description: "Massage, spa and therapy services to help you recover and recharge.",
      icon: HeartPulse,
    },
  ];

  return (
    <main className="overflow-x-clip">
      <section className="relative min-h-[calc(100svh-3.5rem)] overflow-hidden bg-secondary text-secondary-foreground sm:min-h-[calc(100svh-4rem)]">
        <img
          src={images.hero}
          alt="Illustrative strength-training scene"
          width={1536}
          height={1024}
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover object-[60%_center] sm:object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-secondary/95 via-secondary/60 to-secondary/30" />
        <div className="relative section-shell flex min-h-[calc(100svh-3.5rem)] flex-col justify-end pb-10 pt-24 sm:min-h-[calc(100svh-4rem)] sm:pb-16">
          <div className="mb-5 flex flex-wrap gap-x-5 gap-y-1 text-[10px] font-bold uppercase text-secondary-foreground/85">
            <span>Shomolu, Lagos</span>
            <span>Fitness • Spa • Recovery</span>
          </div>
          <h1 className="display-title max-w-5xl text-[clamp(3.8rem,14vw,9rem)] leading-[0.97]">
            Build stronger.
            <br />
            <span className="text-primary">Live better.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-secondary-foreground/85 sm:text-lg">
            Modern fitness, personal training, spa and recovery — all under one roof in Shomolu,
            Lagos.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/join">
                Join now <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="inverse">
              <Link to="/membership">Explore membership</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-20">
        <div className="section-shell">
          <SectionHeader
            eyebrow="The complete experience"
            title="More than a gym."
            copy="Super Plus Fitness brings training, modern equipment, personal coaching, spa and recovery services together in one complete fitness and wellness destination."
          />
          <div className="mt-8 grid gap-px overflow-hidden rounded-xl bg-border md:grid-cols-3">
            {experience.map((item) => (
              <article key={item.name} className="bg-background p-6 sm:p-8">
                <item.icon className="size-8 text-primary" aria-hidden="true" />
                <h3 className="mt-7 font-display text-4xl font-bold uppercase">{item.name}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-secondary py-14 text-secondary-foreground sm:py-20">
        <div className="section-shell">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
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
          <div className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {facilities.map((facility) => (
              <Link
                to="/facilities"
                key={facility.name}
                className="group relative flex min-h-64 items-end overflow-hidden rounded-lg bg-black text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <img
                  src={facility.image}
                  alt={`Illustrative ${facility.name.toLowerCase()} visual`}
                  loading="lazy"
                  width={1536}
                  height={1024}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
                <div className="relative p-5">
                  <h3 className="font-display text-3xl font-bold uppercase">{facility.name}</h3>
                  <p className="mt-2 text-xs leading-5 text-white/80">{facility.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-20">
        <div className="section-shell">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeader
              eyebrow="Membership"
              title="Find your plan."
              copy="Flexible gym, long-term and premium options built around how you train."
            />
            <Button asChild variant="outline" size="lg">
              <Link to="/membership">View all memberships</Link>
            </Button>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {featuredPlans.map((plan) => plan && <MembershipCard key={plan.id} plan={plan} />)}
          </div>
        </div>
      </section>

      <section className="grid bg-secondary text-secondary-foreground lg:grid-cols-2">
        <img
          src={images.training}
          alt="Illustrative personal-training scene"
          loading="lazy"
          width={1536}
          height={1024}
          className="h-full min-h-[22rem] w-full object-cover"
        />
        <div className="flex items-center px-6 py-12 sm:px-12 lg:px-16">
          <div>
            <SectionHeader
              eyebrow="Personal training"
              title={
                <>
                  Don’t just work out.
                  <br />
                  Train with purpose.
                </>
              }
              copy="Work with a personal coach for structured training, focused guidance and the accountability to keep moving forward."
              inverse
            />
            <Button asChild size="lg" className="mt-7">
              <Link to="/personal-training">
                Start personal training <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="bg-muted py-14 sm:py-20">
        <div className="section-shell">
          <div className="grid items-center gap-6 lg:grid-cols-[1fr_0.8fr]">
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
            <img
              src={images.recovery}
              alt="Illustrative spa and recovery scene"
              loading="lazy"
              width={1536}
              height={1024}
              className="h-56 w-full rounded-lg object-cover sm:h-72"
            />
          </div>
          <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recoveryServices.slice(0, 3).map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
          <Button asChild size="lg" className="mt-7">
            <Link to="/spa-recovery">Explore spa & recovery</Link>
          </Button>
        </div>
      </section>

      <HomeJournal />

      <section className="bg-secondary py-14 text-secondary-foreground sm:py-20">
        <div className="section-shell grid gap-8 lg:grid-cols-[1fr_0.7fr] lg:items-end">
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
          <Button asChild size="lg" className="lg:justify-self-end">
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

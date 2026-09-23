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
import { GalleryExperience } from "@/components/gallery/GalleryExperience";
import { supabase } from "@/lib/supabase";
import { images, membershipPlans, recoveryServices } from "@/lib/site-data";

type BlogPost = {
  id: string;
  title: string;
  slug: string;
  category: string;
  excerpt: string | null;
  featured_image: string | null;
};
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
        /* Retain blog link if feed unavailable. */
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <section className="bg-background py-10 sm:py-12" aria-labelledby="home-journal-title">
      <div className="section-shell">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-[10px] font-extrabold uppercase tracking-widest text-primary">
              The fitness journal
            </p>
            <h2 id="home-journal-title" className="display-title text-4xl sm:text-5xl lg:text-6xl">
              Train smarter. Live better.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
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
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {posts.map((post) => (
              <a
                key={post.id}
                href={`/blog/article?slug=${encodeURIComponent(post.slug)}`}
                className="group overflow-hidden rounded-lg border border-border bg-card transition-all hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div className="aspect-[16/9] overflow-hidden bg-muted">
                  {post.featured_image ? (
                    <img
                      src={post.featured_image}
                      alt={post.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/15 to-muted">
                      <BookOpen className="size-10 text-primary/60" aria-hidden="true" />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <p className="text-[10px] font-bold uppercase text-primary">{post.category}</p>
                  <h3 className="mt-1 text-lg font-extrabold leading-snug">{post.title}</h3>
                  {post.excerpt && (
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {post.excerpt}
                    </p>
                  )}
                  <span className="mt-4 inline-flex items-center gap-2 text-xs font-extrabold uppercase text-primary">
                    Read article <ArrowRight className="size-4" />
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
        <Button asChild variant="outline" size="lg" className="mt-5 w-full sm:hidden">
          <Link to="/blog">
            Read our blog <ArrowRight />
          </Link>
        </Button>
      </div>
    </section>
  );
}

/** Existing Homepage 2.0 retained; facilities cards replaced with the gallery showcase. */
export function HomePageGallery() {
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
      <section className="relative min-h-[76svh] overflow-hidden bg-secondary text-secondary-foreground sm:min-h-[82svh]">
        <img
          src={images.hero}
          alt="Illustrative strength-training scene"
          width={1536}
          height={1024}
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover object-[60%_center] sm:object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-secondary/95 via-secondary/60 to-secondary/30" />
        <div className="relative section-shell flex min-h-[76svh] flex-col justify-end pb-8 pt-20 sm:min-h-[82svh] sm:pb-10">
          <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-bold uppercase text-secondary-foreground/85">
            <span>Shomolu, Lagos</span>
            <span>Fitness • Spa • Recovery</span>
          </div>
          <h1 className="display-title max-w-4xl text-[clamp(3rem,10vw,6.8rem)] leading-[0.95]">
            Build stronger.
            <br />
            <span className="text-primary">Live better.</span>
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-secondary-foreground/85 sm:text-base">
            Modern fitness, personal training, spa and recovery — all under one roof in Shomolu,
            Lagos.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
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
      <section className="py-10 sm:py-12">
        <div className="section-shell">
          <SectionHeader
            eyebrow="The complete experience"
            title="More than a gym."
            copy="Super Plus Fitness brings training, modern equipment, personal coaching, spa and recovery services together in one complete fitness and wellness destination."
            compact
          />
          <div className="mt-5 grid gap-px overflow-hidden rounded-lg bg-border md:grid-cols-3">
            {experience.map((item) => (
              <article key={item.name} className="bg-background p-4 sm:p-5">
                <item.icon className="size-7 text-primary" aria-hidden="true" />
                <h3 className="mt-4 font-display text-2xl font-bold uppercase sm:text-3xl">
                  {item.name}
                </h3>
                <p className="mt-2 text-xs leading-5 text-muted-foreground sm:text-sm">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <GalleryExperience compact />
      <section className="py-10 sm:py-12">
        <div className="section-shell">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeader
              eyebrow="Membership"
              title="Find your plan."
              copy="Flexible gym, long-term and premium options built around how you train."
              compact
            />
            <Button asChild variant="outline" size="lg">
              <Link to="/membership">View all memberships</Link>
            </Button>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {featuredPlans.map(
              (plan) => plan && <MembershipCard key={plan.id} plan={plan} compact />,
            )}
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
          className="h-full min-h-[16rem] w-full object-cover sm:min-h-[18rem]"
        />
        <div className="flex items-center px-6 py-10 sm:px-10 lg:px-12">
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
              compact
            />
            <Button asChild size="lg" className="mt-5">
              <Link to="/personal-training">
                Start personal training <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </section>
      <section className="bg-muted py-10 sm:py-12">
        <div className="section-shell">
          <div className="grid items-center gap-5 lg:grid-cols-[1fr_0.8fr]">
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
              compact
            />
            <img
              src={images.recovery}
              alt="Illustrative spa and recovery scene"
              loading="lazy"
              width={1536}
              height={1024}
              className="h-44 w-full rounded-lg object-cover sm:h-56"
            />
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {recoveryServices.slice(0, 3).map((service) => (
              <ServiceCard key={service.id} service={service} compact />
            ))}
          </div>
          <Button asChild size="lg" className="mt-5">
            <Link to="/spa-recovery">Explore spa & recovery</Link>
          </Button>
        </div>
      </section>
      <HomeJournal />
      <section className="bg-secondary py-10 text-secondary-foreground sm:py-12">
        <div className="section-shell grid gap-5 lg:grid-cols-[1fr_0.7fr] lg:items-end">
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
            compact
          />
          <Button asChild size="lg" className="lg:justify-self-end">
            <Link to="/hmo">
              HMO & corporate partnerships <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>
      <LocationSection compact />
      <FinalCTA />
    </main>
  );
}

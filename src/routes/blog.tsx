import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  Dumbbell,
  HeartPulse,
  Search,
  Sparkles,
  Utensils,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/site";
import { supabase } from "@/lib/supabase";

type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  featured_image: string | null;
  category: string;
  author_name: string;
  status: "draft" | "scheduled" | "published";
  featured: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

const categories = [
  {
    name: "All",
    icon: BookOpen,
  },
  {
    name: "Fitness",
    icon: Dumbbell,
  },
  {
    name: "Nutrition",
    icon: Utensils,
  },
  {
    name: "Recovery",
    icon: HeartPulse,
  },
  {
    name: "Wellness",
    icon: Sparkles,
  },
];

export const Route = createFileRoute("/blog")({
  component: BlogPage,
});

function formatDate(date: string | null) {
  if (!date) return "";

  return new Date(date).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getReadingTime(content: string) {
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

function articleUrl(slug: string) {
  return `/blog/article?slug=${encodeURIComponent(slug)}`;
}

function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  useEffect(() => {
    loadPosts();
  }, []);

  async function loadPosts() {
    setLoading(true);

    const { data, error } = await supabase
      .from("blog_posts")
      .select(
        `
          id,
          title,
          slug,
          excerpt,
          content,
          featured_image,
          category,
          author_name,
          status,
          featured,
          published_at,
          created_at,
          updated_at
        `,
      )
      .eq("status", "published")
      .not("published_at", "is", null)
      .lte("published_at", new Date().toISOString())
      .order("featured", { ascending: false })
      .order("published_at", { ascending: false });

    if (!error && data) {
      setPosts(data as BlogPost[]);
    }

    setLoading(false);
  }

  const filteredPosts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return posts.filter((post) => {
      const matchesCategory =
        activeCategory === "All" ||
        post.category.toLowerCase() === activeCategory.toLowerCase();

      const matchesSearch =
        !query ||
        post.title.toLowerCase().includes(query) ||
        post.excerpt?.toLowerCase().includes(query) ||
        post.content.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [posts, search, activeCategory]);

  const featuredPost =
    filteredPosts.find((post) => post.featured) ||
    filteredPosts[0] ||
    null;

  const regularPosts = filteredPosts.filter(
    (post) => post.id !== featuredPost?.id,
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-20 items-center justify-between px-4">
          <Logo />

          <nav className="hidden items-center gap-6 md:flex">
            <Link
              to="/"
              className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              Home
            </Link>

            <Link
              to="/membership"
              className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              Membership
            </Link>

            <Link
              to="/personal-training"
              className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              Personal Training
            </Link>

            <Link
              to="/spa-recovery"
              className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              Spa & Recovery
            </Link>

            <Link
              to="/about"
              className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              About
            </Link>

            <Link
              to="/contact"
              className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              Contact
            </Link>

            <Link to="/join">
              <Button className="bg-primary text-primary-foreground">
                Join Now
              </Button>
            </Link>
          </nav>

          <Link to="/join" className="md:hidden">
            <Button size="sm">Join Now</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border bg-muted/30">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              <Sparkles className="h-4 w-4" />
              Super Plus Fitness Blog
            </div>

            <h1 className="text-4xl font-black tracking-tight sm:text-5xl md:text-6xl">
              Train smarter.
              <span className="block text-primary">
                Live stronger.
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              Practical fitness, nutrition, recovery and wellness advice
              to help you make better choices and get more from every
              workout.
            </p>
          </div>
        </div>
      </section>

      {/* Search + categories */}
      <section className="border-b border-border bg-background">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />

              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search fitness articles..."
                className="h-12 w-full rounded-xl border border-border bg-muted/30 pl-12 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {categories.map((category) => {
                const Icon = category.icon;
                const active = activeCategory === category.name;

                return (
                  <button
                    key={category.name}
                    type="button"
                    onClick={() => setActiveCategory(category.name)}
                    className={[
                      "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground hover:border-primary hover:text-foreground",
                    ].join(" ")}
                  >
                    <Icon className="h-4 w-4" />
                    {category.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Blog content */}
      <main className="container mx-auto px-4 py-12 md:py-16">
        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <div
                key={item}
                className="overflow-hidden rounded-2xl border border-border bg-card"
              >
                <div className="aspect-[16/9] animate-pulse bg-muted" />

                <div className="space-y-3 p-6">
                  <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                  <div className="h-6 w-full animate-pulse rounded bg-muted" />
                  <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="mx-auto max-w-2xl rounded-3xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <BookOpen className="h-8 w-8 text-primary" />
            </div>

            <h2 className="text-2xl font-bold">
              {posts.length === 0
                ? "Our fitness library is coming soon."
                : "No articles found."}
            </h2>

            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {posts.length === 0
                ? "We're preparing practical fitness, nutrition, recovery and wellness articles for the Super Plus community."
                : "Try another search term or choose a different category."}
            </p>

            {posts.length > 0 && (
              <Button
                type="button"
                variant="outline"
                className="mt-6"
                onClick={() => {
                  setSearch("");
                  setActiveCategory("All");
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Featured article */}
            {featuredPost && (
              <section className="mb-14">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                      Featured
                    </p>

                    <h2 className="mt-1 text-2xl font-bold sm:text-3xl">
                      Start here
                    </h2>
                  </div>
                </div>

                <a
                  href={articleUrl(featuredPost.slug)}
                  className="group block overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="grid lg:grid-cols-2">
                    <div className="relative aspect-[16/10] overflow-hidden bg-muted lg:aspect-auto lg:min-h-[380px]">
                      {featuredPost.featured_image ? (
                        <img
                          src={featuredPost.featured_image}
                          alt={featuredPost.title}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full min-h-[300px] items-center justify-center bg-gradient-to-br from-primary/20 via-muted to-background">
                          <Dumbbell className="h-20 w-20 text-primary/50" />
                        </div>
                      )}

                      <div className="absolute left-5 top-5 rounded-full bg-background/95 px-3 py-1.5 text-xs font-bold uppercase tracking-wider">
                        {featuredPost.category}
                      </div>
                    </div>

                    <div className="flex flex-col justify-center p-7 sm:p-10">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>
                          {formatDate(featuredPost.published_at)}
                        </span>

                        <span>•</span>

                        <span>
                          {getReadingTime(featuredPost.content)} min read
                        </span>
                      </div>

                      <h3 className="mt-4 text-3xl font-black leading-tight tracking-tight sm:text-4xl">
                        {featuredPost.title}
                      </h3>

                      {featuredPost.excerpt && (
                        <p className="mt-5 text-base leading-7 text-muted-foreground">
                          {featuredPost.excerpt}
                        </p>
                      )}

                      <div className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-primary">
                        Read Article
                        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                      </div>
                    </div>
                  </div>
                </a>
              </section>
            )}

            {/* Latest articles */}
            <section>
              <div className="mb-7 flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                    Latest
                  </p>

                  <h2 className="mt-1 text-2xl font-bold sm:text-3xl">
                    Latest from Super Plus
                  </h2>
                </div>

                <span className="hidden text-sm text-muted-foreground sm:block">
                  {filteredPosts.length}{" "}
                  {filteredPosts.length === 1
                    ? "article"
                    : "articles"}
                </span>
              </div>

              {regularPosts.length === 0 ? (
                <div className="rounded-2xl border border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                  This is currently the only article matching your
                  selection.
                </div>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {regularPosts.map((post) => (
                    <a
                      key={post.id}
                      href={articleUrl(post.slug)}
                      className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                    >
                      <div className="relative aspect-[16/9] overflow-hidden bg-muted">
                        {post.featured_image ? (
                          <img
                            src={post.featured_image}
                            alt={post.title}
                            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/15 via-muted to-background">
                            <Dumbbell className="h-12 w-12 text-primary/40" />
                          </div>
                        )}

                        <div className="absolute left-4 top-4 rounded-full bg-background/95 px-3 py-1.5 text-xs font-bold uppercase tracking-wider">
                          {post.category}
                        </div>
                      </div>

                      <div className="p-6">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{formatDate(post.published_at)}</span>

                          <span>•</span>

                          <span>
                            {getReadingTime(post.content)} min read
                          </span>
                        </div>

                        <h3 className="mt-3 line-clamp-2 text-xl font-bold leading-tight transition group-hover:text-primary">
                          {post.title}
                        </h3>

                        {post.excerpt && (
                          <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
                            {post.excerpt}
                          </p>
                        )}

                        <div className="mt-5 flex items-center gap-2 text-sm font-bold text-primary">
                          Read Article
                          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* CTA */}
      <section className="border-t border-border bg-muted/30">
        <div className="container mx-auto px-4 py-16 text-center">
          <div className="mx-auto max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
              Ready to put it into practice?
            </p>

            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              Your next workout starts here.
            </h2>

            <p className="mt-4 text-muted-foreground">
              Join Super Plus Fitness and turn what you learn into a
              consistent training routine.
            </p>

            <a href="/join" className="mt-7 inline-block">
              <Button size="lg" className="px-7">
                Join Super Plus Fitness
                <ArrowRight />
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
            <Logo />

            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Super Plus Fitness & Spa.
              All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}


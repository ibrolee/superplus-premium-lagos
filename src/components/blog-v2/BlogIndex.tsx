import { Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, Clock3, Dumbbell, HeartPulse, Search, Sparkles, Utensils, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
  featured: boolean;
  published_at: string | null;
};

const topicIcons: Record<string, typeof BookOpen> = {
  Fitness: Dumbbell,
  Nutrition: Utensils,
  Recovery: HeartPulse,
  Wellness: Sparkles,
};

function dateLabel(date: string | null) {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

function readTime(content: string) {
  return Math.max(1, Math.ceil(content.trim().split(/\s+/).length / 200));
}

function EditorialArtwork({ post, featured = false }: { post: BlogPost; featured?: boolean }) {
  if (post.featured_image) {
    return <img src={post.featured_image} alt="" loading={featured ? "eager" : "lazy"} decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04] motion-reduce:transition-none" />;
  }
  return <div className="relative flex h-full w-full items-end overflow-hidden bg-[#232321] p-3 text-white" aria-hidden="true">
    <div className="absolute -right-8 -top-10 size-28 rounded-full border-[22px] border-[#e74632]/90" />
    <p className="relative font-display text-lg font-extrabold uppercase leading-[.9] sm:text-3xl">MOVE<br /><span className="text-[#ef513e]">WITH</span> PURPOSE.</p>
  </div>;
}

function ArticleCard({ post, featured }: { post: BlogPost; featured: boolean }) {
  return <Link to="/blog/$slug" params={{ slug: post.slug }} className="group flex min-h-[120px] overflow-hidden border border-[#e0dbd3] bg-white outline-offset-2 transition-colors hover:border-[#df4c38] focus-visible:outline-2 focus-visible:outline-[#df4c38] motion-reduce:transition-none sm:flex-col">
    <div className="relative w-[112px] shrink-0 overflow-hidden sm:aspect-[16/10] sm:w-full">
      <EditorialArtwork post={post} featured={featured} />
      {featured && <span className="absolute bottom-1 left-1 bg-[#df4c38] px-1.5 py-1 text-[8px] font-extrabold uppercase tracking-wide text-white sm:bottom-2 sm:left-2 sm:px-2 sm:text-[9px]">Featured</span>}
    </div>
    <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-3 py-2.5 sm:justify-start sm:gap-2 sm:p-4">
      <span className="text-[9px] font-extrabold uppercase tracking-[.15em] text-[#ca4634]">{post.category}</span>
      <h3 className="line-clamp-2 font-display text-[17px] font-bold uppercase leading-[1.05] tracking-tight transition-colors group-hover:text-[#c7402e] sm:text-xl lg:text-[22px]">{post.title}</h3>
      <p className="hidden line-clamp-2 text-xs leading-5 text-[#716e67] sm:block">{post.excerpt || "Read the full article from Super Plus Fitness."}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-[#77736e] sm:mt-auto sm:pt-1"><span>{dateLabel(post.published_at)}</span><span className="inline-flex items-center gap-0.5"><Clock3 aria-hidden="true" className="size-3" />{readTime(post.content)} min</span><ArrowRight aria-hidden="true" className="ml-auto size-3.5 shrink-0 text-[#cf412e]" /></div>
    </div>
  </Link>;
}

export default function BlogIndexV2() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState("");
  const [topic, setTopic] = useState("All");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(false);
      const { data, error: fetchError } = await supabase.from("blog_posts")
        .select("id,title,slug,excerpt,content,featured_image,category,author_name,featured,published_at")
        .eq("status", "published").not("published_at", "is", null)
        .lte("published_at", new Date().toISOString())
        .order("featured", { ascending: false }).order("published_at", { ascending: false });
      if (!active) return;
      setError(!!fetchError);
      setPosts(fetchError ? [] : (data || []) as BlogPost[]);
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [attempt]);

  const topics = useMemo(() => ["All", ...new Set(posts.map(post => post.category).filter(Boolean))], [posts]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return posts.filter(post => (topic === "All" || post.category === topic) && (!q || post.title.toLowerCase().includes(q) || (post.excerpt || "").toLowerCase().includes(q) || post.content.toLowerCase().includes(q)));
  }, [posts, search, topic]);
  const lead = filtered.find(post => post.featured) || filtered[0] || null;
  const ordered = lead ? [lead, ...filtered.filter(post => post.id !== lead.id)] : [];
  const hasFilters = search.trim() !== "" || topic !== "All";

  return <div className="spf-blog-index min-h-screen bg-[#f7f5f0] text-[#262521]">
    <section className="relative overflow-hidden bg-[#20211e] text-white" aria-labelledby="blog-heading">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_95%_25%,rgba(227,72,51,0.2),transparent_48%)]" aria-hidden="true" />
      <div className="relative mx-auto flex max-w-[1280px] flex-col justify-center px-5 py-5 sm:px-10 sm:py-8 lg:py-10">
        <p className="text-[9px] font-extrabold uppercase tracking-[.19em] text-[#f16a56] sm:text-[11px]">The Super Plus Fitness Blog</p>
        <h1 id="blog-heading" className="mt-2 font-display text-[clamp(2.1rem,5vw,4.5rem)] font-extrabold uppercase leading-[.98] tracking-[-.03em]">Move <span className="text-[#f05a46]">better.</span> Live more.</h1>
        <p className="mt-2 max-w-2xl text-xs leading-5 text-white/70 sm:text-sm">Fitness, nutrition and recovery advice for everyday life.</p>
      </div>
    </section>

    <section id="articles" className="scroll-mt-20 border-b border-[#e5e1d9] bg-[#f7f5f0]" aria-label="Find articles">
      <div className="mx-auto max-w-[1280px] px-5 py-4 sm:px-10 sm:py-5">
        <div className="flex items-center gap-3"><h2 className="shrink-0 font-display text-xl font-bold uppercase leading-none sm:text-2xl">Articles<span className="text-[#df4c38]">.</span></h2>
          <div className="relative min-w-0 flex-1"><Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#77746e]" /><input type="search" aria-label="Search blog articles" placeholder="Search articles" value={search} onChange={event => setSearch(event.target.value)} className="h-10 w-full border border-[#dedbd3] bg-white pl-9 pr-9 text-sm outline-none focus:border-[#df4c38] focus:ring-2 focus:ring-[#df4c38]/15" />{search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center text-[#77746e] hover:text-[#df4c38]"><X className="size-4" /></button>}</div>
        </div>
        <div role="group" aria-label="Filter articles by topic" className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">{topics.map(name => { const Icon = topicIcons[name] || BookOpen; const active = topic === name; return <button key={name} type="button" aria-pressed={active} onClick={() => setTopic(name)} className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 border px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.05em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#df4c38] ${active ? "border-[#df4c38] bg-[#df4c38] text-white" : "border-[#dedbd3] bg-white text-[#57554f] hover:border-[#df4c38]"}`}><Icon aria-hidden="true" className="size-3.5" />{name}</button>; })}</div>
      </div>
    </section>

    <main className="mx-auto max-w-[1280px] px-5 pb-10 pt-4 sm:px-10 sm:pb-14 sm:pt-6">
      {loading ? <div role="status" aria-label="Loading articles" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map(n => <div key={n} className="h-28 animate-pulse bg-[#e8e3da] motion-reduce:animate-none sm:h-60" />)}</div>
      : error ? <div role="alert" className="mx-auto max-w-xl border border-[#e2d8d0] bg-white px-6 py-10 text-center"><BookOpen className="mx-auto size-8 text-[#db4d39]" /><h2 className="mt-3 font-display text-2xl font-bold uppercase">Couldn't load the articles</h2><p className="mt-2 text-sm text-[#716e67]">Please check your connection and try again.</p><button type="button" onClick={() => setAttempt(n => n + 1)} className="mt-4 min-h-11 bg-[#df4c38] px-6 text-xs font-bold uppercase text-white">Try again</button></div>
      : ordered.length === 0 ? <div className="mx-auto max-w-2xl border border-[#e4e0d8] bg-white px-6 py-10 text-center"><BookOpen className="mx-auto size-8 text-[#df4c38]" /><h2 className="mt-3 font-display text-2xl font-bold uppercase">{posts.length === 0 ? "New articles coming soon." : "No matching articles."}</h2><p className="mt-2 text-sm text-[#716e67]">{posts.length === 0 ? "We're preparing useful, practical articles for the Super Plus community." : "Try another search or explore all topics."}</p>{hasFilters && <button type="button" className="mt-4 min-h-11 border border-[#df4c38] px-6 text-xs font-extrabold uppercase text-[#df4c38]" onClick={() => { setSearch(""); setTopic("All"); }}>Clear filters</button>}</div>
      : <section aria-labelledby="article-list-heading">
        <div className="mb-3 flex items-center justify-between gap-3"><h2 id="article-list-heading" className="font-display text-xl font-bold uppercase sm:text-2xl">Browse posts<span className="text-[#df4c38]">.</span></h2><span className="text-xs text-[#817e77]">{ordered.length} {ordered.length === 1 ? "article" : "articles"}</span></div>
        <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">{ordered.map(post => <ArticleCard key={post.id} post={post} featured={post.id === lead?.id && post.featured} />)}</div>
      </section>}
    </main>
    <section className="relative overflow-hidden bg-[#232321] text-white"><div className="relative mx-auto flex max-w-[1280px] flex-col items-start justify-between gap-4 px-5 py-8 sm:px-10 sm:py-10 lg:flex-row lg:items-center"><div><p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-[#f16a56]">From reading to action</p><h2 className="mt-1 font-display text-2xl font-bold uppercase sm:text-3xl">Take your next step<span className="text-[#f05a46]">.</span></h2><p className="mt-1 text-xs leading-5 text-white/65 sm:text-sm">Turn what you read into a routine that works for you.</p></div><Link to="/membership" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-3 bg-[#e44b37] px-5 text-xs font-extrabold uppercase tracking-[.1em] text-white hover:bg-[#c93d2c] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">Explore membership <ArrowRight className="size-4" aria-hidden="true" /></Link></div></section>
  </div>;
}

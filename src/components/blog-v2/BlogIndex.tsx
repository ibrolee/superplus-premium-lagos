import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowRight, BookOpen, Clock3, Dumbbell, HeartPulse, Search, Sparkles, Utensils, X } from "lucide-react";
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

function AuthorChip({ light = false }: { light?: boolean }) {
  return <div className={`inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.12em] ${light ? "text-white/75" : "text-[#5f5b54]"}`}>
    <img src="/footer-logo-circular.webp" alt="Super Plus Fitness" className="size-7 rounded-full object-contain" loading="lazy" decoding="async" />
    <span>Super Plus Fitness</span>
  </div>;
}

function EditorialArtwork({ post, featured = false }: { post: BlogPost; featured?: boolean }) {
  if (post.featured_image) {
    return <img src={post.featured_image} alt="" loading={featured ? "eager" : "lazy"} className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04] motion-reduce:transition-none" />;
  }

  return (
    <div className="relative flex h-full w-full flex-col justify-between overflow-hidden bg-[#232321] p-6 text-white sm:p-8" aria-hidden="true">
      <div className="pointer-events-none absolute -right-12 -top-24 size-72 rounded-full border-[48px] border-[#e74632]/90 sm:size-96 sm:border-[66px]" />
      <div className="pointer-events-none absolute -bottom-28 -left-16 size-80 rounded-full border-[46px] border-white/10" />
      <div className="relative flex items-center justify-between text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/70"><span>Super Plus Fitness Blog</span><span>Shomolu, Lagos</span></div>
      <div className="relative z-10 max-w-xs">
        <div className="mb-4 h-1 w-12 bg-[#ef513e]" />
        <p className="font-display text-6xl font-extrabold uppercase leading-[0.79] tracking-[-0.035em] sm:text-7xl">MOVE<br /><span className="text-[#ef513e]">WITH</span><br />PURPOSE.</p>
      </div>
      <p className="relative z-10 text-[10px] font-extrabold uppercase tracking-[0.22em] text-white/70">{post.category} / Fitness articles</p>
    </div>
  );
}

function Meta({ post, light = false }: { post: BlogPost; light?: boolean }) {
  return <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold ${light ? "text-white/65" : "text-[#73716d]"}`}>
    <span>{dateLabel(post.published_at)}</span><span aria-hidden="true" className="size-1 rounded-full bg-current opacity-45" /><span className="inline-flex items-center gap-1"><Clock3 aria-hidden="true" className="size-3" /> {readTime(post.content)} min read</span>
  </div>;
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
  const remaining = filtered.filter(post => post.id !== lead?.id);
  const hasFilters = search.trim() !== "" || topic !== "All";

  return <div className="spf-blog-index min-h-screen bg-[#f7f5f0] text-[#262521]">
    <section className="relative isolate overflow-hidden bg-[#20211e] text-white" aria-labelledby="blog-heading">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_95%_25%,rgba(227,72,51,0.22),transparent_33%)]" aria-hidden="true" />
      <div className="mx-auto grid max-w-[1440px] lg:min-h-[560px] lg:grid-cols-[1.04fr_0.96fr]">
        <div className="relative z-10 flex flex-col justify-center px-5 pb-14 pt-16 sm:px-10 sm:py-20 lg:px-16 lg:py-24 xl:px-24">
          <div className="mb-9 flex items-center gap-3 text-[10px] font-extrabold uppercase tracking-[0.24em] text-[#f16a56]"><span className="h-px w-8 bg-[#f16a56]" /> The Super Plus Fitness Blog</div>
          <h1 id="blog-heading" className="max-w-[680px] font-display text-[clamp(4.2rem,10vw,8.8rem)] font-extrabold uppercase leading-[0.79] tracking-[-0.038em]">Move<br /><span className="text-[#f05a46]">better.</span><br />Live more.</h1>
          <p className="mt-9 max-w-[490px] text-sm leading-7 text-white/65 sm:text-base">Practical articles about training, recovery, nutrition and building a stronger everyday life.</p>
          <a href="#articles" className="mt-10 inline-flex w-fit items-center gap-3 border-b border-[#f05a46] pb-2 text-xs font-extrabold uppercase tracking-[0.15em] transition-colors hover:text-[#f05a46] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f05a46] motion-reduce:transition-none">Explore articles <ArrowDown className="size-4" aria-hidden="true" /></a>
        </div>
        <div className="relative hidden min-h-[450px] overflow-hidden lg:block" aria-hidden="true">
          <img src="/modern-equipment.png" alt="" className="absolute inset-0 h-full w-full object-cover grayscale-[.45]" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#20211e] via-[#20211e]/35 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#20211e]/60 via-transparent to-[#20211e]/10" />
          <div className="absolute bottom-10 right-10 border-l-2 border-[#f05a46] pl-4 text-right"><span className="block font-display text-4xl font-bold uppercase leading-none">Stronger<br />every day.</span><span className="mt-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-white/65">Shomolu · Lagos</span></div>
        </div>
      </div>
      <div className="relative z-10 border-t border-white/10 bg-[#171816]"><div className="mx-auto flex max-w-[1440px] items-center justify-between gap-6 overflow-x-auto px-5 py-4 text-[10px] font-bold uppercase tracking-[0.17em] text-white/55 sm:px-10 lg:px-16 xl:px-24"><span className="shrink-0 text-[#f05a46]">Explore blog topics</span><span className="shrink-0">Fitness</span><span className="shrink-0">Nutrition</span><span className="shrink-0">Recovery</span><span className="shrink-0">Wellness</span></div></div>
    </section>

    <section id="articles" className="scroll-mt-24 border-b border-[#e5e1d9] bg-[#f7f5f0]" aria-label="Find articles">
      <div className="mx-auto max-w-[1280px] px-5 py-9 sm:px-10 sm:py-11">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div><span className="text-[10px] font-extrabold uppercase tracking-[0.21em] text-[#db4d39]">Find your focus</span><h2 className="mt-1 font-display text-4xl font-bold uppercase tracking-tight sm:text-5xl">Browse articles<span className="text-[#df4c38]">.</span></h2></div>
          <div className="relative w-full lg:max-w-[380px]"><Search aria-hidden="true" className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#77746e]" /><input type="search" aria-label="Search blog articles" placeholder="Search articles" value={search} onChange={event => setSearch(event.target.value)} className="h-12 w-full rounded-none border border-[#dedbd3] bg-white pl-12 pr-12 text-sm outline-none transition-colors placeholder:text-[#99958d] focus:border-[#df4c38] focus:ring-2 focus:ring-[#df4c38]/15 motion-reduce:transition-none" />{search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center text-[#77746e] hover:text-[#df4c38]"><X className="size-4" /></button>}</div>
        </div>
        <div role="group" aria-label="Filter articles by topic" className="mt-7 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">{topics.map(name => { const Icon = topicIcons[name] || BookOpen; const active = topic === name; return <button key={name} type="button" aria-pressed={active} onClick={() => setTopic(name)} className={`inline-flex min-h-11 shrink-0 items-center gap-2 border px-4 py-2 text-xs font-extrabold uppercase tracking-[0.08em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#df4c38] motion-reduce:transition-none ${active ? "border-[#df4c38] bg-[#df4c38] text-white" : "border-[#dedbd3] bg-white text-[#57554f] hover:border-[#df4c38] hover:text-[#df4c38]"}`}><Icon aria-hidden="true" className="size-4" />{name}</button>; })}</div>
      </div>
    </section>

    <main className="mx-auto max-w-[1280px] px-5 pb-20 pt-12 sm:px-10 sm:pb-28 sm:pt-16">
      {loading ? <div role="status" aria-label="Loading articles" className="space-y-7"><div className="h-6 w-48 animate-pulse bg-[#e8e3da] motion-reduce:animate-none" /><div className="grid overflow-hidden border border-[#e8e3da] bg-white lg:grid-cols-2"><div className="aspect-[5/4] animate-pulse bg-[#e8e3da] motion-reduce:animate-none" /><div className="space-y-5 p-8"><div className="h-4 w-24 bg-[#e8e3da]" /><div className="h-14 w-4/5 bg-[#e8e3da]" /><div className="h-4 w-full bg-[#e8e3da]" /><div className="h-4 w-3/4 bg-[#e8e3da]" /></div></div></div>
      : error ? <div role="alert" className="mx-auto max-w-xl border border-[#e2d8d0] bg-white px-8 py-16 text-center"><BookOpen className="mx-auto size-10 text-[#db4d39]" /><h2 className="mt-5 font-display text-3xl font-bold uppercase">Couldn't load the articles</h2><p className="mt-3 text-sm text-[#716e67]">Please check your connection and try again.</p><button type="button" onClick={() => setAttempt(n => n + 1)} className="mt-7 min-h-11 bg-[#df4c38] px-6 text-xs font-bold uppercase tracking-widest text-white">Try again</button></div>
      : !lead ? <div className="mx-auto max-w-2xl border border-[#e4e0d8] bg-white px-6 py-20 text-center"><BookOpen className="mx-auto size-10 text-[#df4c38]" /><h2 className="mt-5 font-display text-4xl font-bold uppercase">{posts.length === 0 ? "New articles coming soon." : "No matching articles."}</h2><p className="mt-3 text-sm leading-7 text-[#716e67]">{posts.length === 0 ? "We're preparing useful, practical articles for the Super Plus community." : "Try a different search term or explore all topics."}</p>{hasFilters && <button type="button" className="mt-7 min-h-11 border border-[#df4c38] px-6 text-xs font-extrabold uppercase tracking-widest text-[#df4c38]" onClick={() => {setSearch(""); setTopic("All");}}>Clear filters</button>}</div>
      : <>
        <section aria-labelledby="featured-heading" className="mb-16 sm:mb-24">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-[#dedbd3] pb-4"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#db4d39]">Featured article</p><h2 id="featured-heading" className="mt-1 font-display text-4xl font-bold uppercase tracking-tight sm:text-5xl">Featured article<span className="text-[#df4c38]">.</span></h2></div><span className="text-[11px] font-semibold text-[#817e77]">{filtered.length} {filtered.length === 1 ? "article" : "articles"} available</span></div>
          <Link to="/blog/$slug" params={{ slug: lead.slug }} className="group grid overflow-hidden border border-[#dedbd3] bg-white shadow-[0_10px_35px_rgba(35,32,28,.04)] outline-offset-4 transition-all duration-300 hover:border-[#df4c38]/45 hover:shadow-[0_18px_50px_rgba(35,32,28,.12)] focus-visible:outline-2 focus-visible:outline-[#df4c38] motion-reduce:transition-none lg:min-h-[435px] lg:grid-cols-[1.08fr_0.92fr]">
            <div className="relative min-h-[320px] overflow-hidden sm:min-h-[400px] lg:min-h-full"><EditorialArtwork post={lead} featured /><span className="absolute bottom-4 right-4 z-10 bg-[#df4c38] px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-white">Featured article ↗</span></div>
            <div className="flex flex-col justify-center px-6 py-9 sm:px-10 sm:py-12 lg:px-12"><span className="mb-6 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#db4d39]"><span className="h-px w-6 bg-[#df4c38]" />{lead.category}</span><div className="space-y-3"><AuthorChip /><Meta post={lead} /></div><h3 className="mt-5 font-display text-[clamp(2.6rem,4.2vw,4.8rem)] font-bold uppercase leading-[0.92] tracking-[-0.025em] transition-colors group-hover:text-[#cf412e] motion-reduce:transition-none">{lead.title}</h3>{lead.excerpt && <p className="mt-6 line-clamp-3 text-sm leading-7 text-[#706d66] sm:text-base">{lead.excerpt}</p>}<div className="mt-9 inline-flex items-center gap-3 text-xs font-extrabold uppercase tracking-[0.15em] text-[#c7402e]">Read full article <span className="flex size-10 items-center justify-center rounded-full border border-[#df4c38]/35 transition-transform group-hover:translate-x-1 motion-reduce:transition-none"><ArrowRight className="size-4" /></span></div></div>
          </Link>
        </section>
        {remaining.length > 0 && <section aria-labelledby="latest-heading"><div className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-[#dedbd3] pb-4"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#db4d39]">More articles</p><h2 id="latest-heading" className="mt-1 font-display text-4xl font-bold uppercase sm:text-5xl">Latest articles<span className="text-[#df4c38]">.</span></h2></div><p className="text-xs text-[#817e77]">More from Super Plus Fitness</p></div><div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{remaining.map(post => <Link key={post.id} to="/blog/$slug" params={{ slug: post.slug }} className="group flex h-full flex-col overflow-hidden border border-[#dedbd3] bg-white outline-offset-4 transition-all duration-300 hover:-translate-y-1 hover:border-[#df4c38]/40 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-[#df4c38] motion-reduce:transform-none motion-reduce:transition-none"><div className="relative aspect-[16/10] overflow-hidden"><EditorialArtwork post={post} /><span className="absolute bottom-3 left-3 bg-white px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-[#cf412e]">{post.category}</span></div><div className="flex flex-1 flex-col p-6"><div className="space-y-3"><AuthorChip /><Meta post={post} /></div><h3 className="mt-4 font-display text-3xl font-bold uppercase leading-[1] tracking-tight transition-colors group-hover:text-[#cf412e]">{post.title}</h3>{post.excerpt && <p className="mt-4 line-clamp-3 text-sm leading-6 text-[#716e67]">{post.excerpt}</p>}<div className="mt-auto flex items-center justify-between border-t border-[#e9e5df] pt-5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#c7402e]"><span>Read article</span><ArrowRight className="size-5 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" /></div></div></Link>)}</div></section>}
      </>}
    </main>
    <section className="relative overflow-hidden bg-[#232321] text-white"><div className="pointer-events-none absolute -right-20 -top-24 size-80 rounded-full border-[55px] border-[#df4c38]/25" aria-hidden="true" /><div className="relative mx-auto flex max-w-[1280px] flex-col items-start justify-between gap-7 px-5 py-16 sm:px-10 sm:py-20 lg:flex-row lg:items-center"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.23em] text-[#f16a56]">From reading to action</p><h2 className="mt-3 font-display text-5xl font-bold uppercase leading-[0.95] sm:text-6xl">Take your next step<span className="text-[#f05a46]">.</span></h2><p className="mt-4 max-w-xl text-sm leading-7 text-white/60">Turn what you read into a routine that works for you. Explore our gym membership and training options.</p></div><Link to="/membership" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-4 bg-[#e44b37] px-7 text-xs font-extrabold uppercase tracking-[0.15em] text-white transition-colors hover:bg-[#c93d2c] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white motion-reduce:transition-none">Explore membership <ArrowRight className="size-4" aria-hidden="true" /></Link></div></section>
  </div>;
}

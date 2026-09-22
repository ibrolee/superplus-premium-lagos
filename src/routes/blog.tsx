import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, BookOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import "@/components/blog-v2/blog-article.css";

const SITE_URL = "https://www.superplusfitness.com";
const DEFAULT_PREVIEW_IMAGE = `${SITE_URL}/header-logo.png`;
const BLOG_DESCRIPTION = "Practical fitness, strength, nutrition and recovery articles from Super Plus Fitness & Spa in Lagos.";

type PublishedBlogPreview = {
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image: string | null;
  published_at: string | null;
};

// WhatsApp and other link crawlers do not wait for the article's client-side
// useEffect. Fetch only publicly published metadata during the initial SSR.
async function loadBlogPreview(pathname: string) {
  const match = /^\/blog\/([a-z0-9-]+)\/?$/.exec(pathname);
  if (!match) return { slug: null, post: null as PublishedBlogPreview | null };

  const slug = match[1];
  try {
    const { data, error } = await supabase
      .from("blog_posts")
      .select("title,slug,excerpt,featured_image,published_at")
      .eq("slug", slug)
      .eq("status", "published")
      .not("published_at", "is", null)
      .lte("published_at", new Date().toISOString())
      .maybeSingle();
    return { slug, post: error ? null : (data as PublishedBlogPreview | null) };
  } catch {
    // Never expose drafts or break the article when preview data is unavailable.
    return { slug, post: null as PublishedBlogPreview | null };
  }
}

function previewImage(image: string | null | undefined) {
  if (!image?.trim()) return DEFAULT_PREVIEW_IMAGE;
  try {
    const absolute = new URL(image.trim(), SITE_URL);
    return absolute.protocol === "https:" ? absolute.href : DEFAULT_PREVIEW_IMAGE;
  } catch {
    return DEFAULT_PREVIEW_IMAGE;
  }
}

export const Route = createFileRoute("/blog")({
  loader: ({ location }) => loadBlogPreview(location.pathname),
  // A visitor can navigate between article slugs while this parent stays mounted.
  shouldReload: true,
  head: ({ loaderData }) => {
    const post = loaderData?.post;
    const isArticle = Boolean(loaderData?.slug);
    const url = post ? `${SITE_URL}/blog/${encodeURIComponent(post.slug)}` : `${SITE_URL}/blog`;
    const title = post ? post.title : "Super Plus Fitness Blog";
    const description = post?.excerpt?.trim() || (post ? `Read ${post.title} on the Super Plus Fitness Blog.` : BLOG_DESCRIPTION);
    const image = previewImage(post?.featured_image);

    return {
      meta: [
        { title: post ? `${title} | Super Plus Fitness Blog` : title },
        { name: "description", content: description },
        { property: "og:type", content: post ? "article" : "website" },
        { property: "og:site_name", content: "Super Plus Fitness & Spa" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
        { property: "og:image", content: image },
        { property: "og:image:secure_url", content: image },
        { property: "og:image:alt", content: post ? `Cover image for ${post.title}` : "Super Plus Fitness & Spa" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: image },
        ...(post?.published_at ? [{ property: "article:published_time", content: post.published_at }] : []),
        ...(isArticle && !post ? [{ name: "robots", content: "noindex" }] : []),
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: BlogLayout,
});

function BlogLayout() {
  const pathname = useRouterState({ select: state => state.location.pathname });
  const isArticle = pathname.startsWith("/blog/") && pathname !== "/blog/" && pathname !== "/blog/article";
  const [readingProgress, setReadingProgress] = useState(0);

  useEffect(() => {
    if (!isArticle) return;
    const update = () => {
      const available = document.documentElement.scrollHeight - window.innerHeight;
      setReadingProgress(available > 0 ? Math.min(100, Math.max(0, (window.scrollY / available) * 100)) : 0);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [isArticle, pathname]);

  return <div className="spf-blog-v2">
    {isArticle && <>
      <div className="spf-blog-reading-progress" role="progressbar" aria-label="Article reading progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(readingProgress)}><div style={{ width: `${readingProgress}%` }} /></div>
      <div className="spf-blog-article-nav"><div><span className="inline-flex items-center gap-2"><BookOpen aria-hidden="true" className="size-4" /> Super Plus Fitness Blog</span><Link to="/blog"><ArrowLeft aria-hidden="true" className="size-4" /> All articles</Link></div></div>
    </>}
    <Outlet />
  </div>;
}

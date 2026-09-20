import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, BookOpen } from "lucide-react";
import { useEffect, useState } from "react";
import "@/components/blog-v2/blog-article.css";

export const Route = createFileRoute("/blog")({ component: BlogLayout });

function BlogLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isArticle =
    pathname.startsWith("/blog/") && pathname !== "/blog/" && pathname !== "/blog/article";
  const [readingProgress, setReadingProgress] = useState(0);

  useEffect(() => {
    if (!isArticle) return;
    const update = () => {
      const available = document.documentElement.scrollHeight - window.innerHeight;
      setReadingProgress(
        available > 0 ? Math.min(100, Math.max(0, (window.scrollY / available) * 100)) : 0,
      );
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [isArticle, pathname]);

  return (
    <div className="spf-blog-v2">
      {isArticle && (
        <>
          <div
            className="spf-blog-reading-progress"
            role="progressbar"
            aria-label="Article reading progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(readingProgress)}
          >
            <div style={{ width: `${readingProgress}%` }} />
          </div>
          <div className="spf-blog-article-nav">
            <div>
              <span className="inline-flex items-center gap-2">
                <BookOpen aria-hidden="true" className="size-4" /> Super Plus Fitness Blog
              </span>
              <Link to="/blog">
                <ArrowLeft aria-hidden="true" className="size-4" /> All articles
              </Link>
            </div>
          </div>
        </>
      )}
      <Outlet />
    </div>
  );
}

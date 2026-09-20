import { createFileRoute, redirect } from "@tanstack/react-router";

// Existing homepage, member dashboard and shared links use /blog/article?slug=... .
// Redirect them to the canonical /blog/$slug reader without touching article data.
export const Route = createFileRoute("/blog/article")({
  validateSearch: (search: Record<string, unknown>) => ({
    slug: typeof search.slug === "string" ? search.slug.trim() : "",
  }),
  beforeLoad: ({ search }) => {
    if (!search.slug) {
      throw redirect({ to: "/blog", replace: true });
    }
    throw redirect({ to: "/blog/$slug", params: { slug: search.slug }, replace: true });
  },
});

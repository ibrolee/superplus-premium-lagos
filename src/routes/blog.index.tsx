import { createFileRoute } from "@tanstack/react-router";
import { Route as ExistingBlogListing } from "@/components/blog-listing";

// Keep the existing listing unchanged and register it at the blog index route.
const BlogIndexComponent = ExistingBlogListing.options.component!;

export const Route = createFileRoute("/blog/")({
  component: BlogIndexComponent,
});

import { createFileRoute } from "@tanstack/react-router";
import { Route as ExistingBlogListing } from "@/components/blog-listing";

// Keep the existing blog listing unchanged while registering its proper index route.
export const Route = createFileRoute("/blog/")({
  component: ExistingBlogListing.options.component!,
});

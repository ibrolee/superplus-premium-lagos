import { createFileRoute } from "@tanstack/react-router";
import BlogIndexV2 from "@/components/blog-v2/BlogIndex";

export const Route = createFileRoute("/blog/")({
  component: BlogIndexV2,
});

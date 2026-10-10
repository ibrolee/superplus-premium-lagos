import { createFileRoute } from "@tanstack/react-router";
import { AboutPage } from "@/components/pages";
import { pageHead } from "@/lib/seo";
export const Route = createFileRoute("/about")({ head: () => pageHead("About Super Plus Fitness & Spa", "Meet Shomolu's complete destination for modern fitness, personal training, spa and recovery.", "/about"), component: AboutPage });
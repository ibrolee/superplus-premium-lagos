import { createFileRoute } from "@tanstack/react-router";
import { MembershipPage } from "@/components/pages";
import { pageHead } from "@/lib/seo";
export const Route = createFileRoute("/membership")({
  head: () =>
    pageHead(
      "Membership Plans — Super Plus Fitness",
      "Compare gym, VIP, family and personal training memberships at Super Plus Fitness in Shomolu, Lagos.",
      "/membership",
    ),
  component: MembershipPage,
});

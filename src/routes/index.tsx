import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/components/pages";
import { contact, openingHours } from "@/lib/site-data";
import { pageHead } from "@/lib/seo";

// No head() here: the home route inherits title/description/og/twitter from
// __root.tsx, and ships no og:image so serve-time hosting can inject the
// project's social preview (explicit og:image or latest screenshot).
export const Route = createFileRoute("/")({ head: () => ({ ...pageHead("Super Plus Fitness & Spa — Gym in Shomolu", "Modern gym, personal training, spa, massage and recovery services in Shomolu, Lagos.", "/"), scripts: [{ type: "application/ld+json", children: JSON.stringify({ "@context": "https://schema.org", "@type": "HealthClub", name: contact.name, description: "Modern fitness, personal training, spa and recovery center in Shomolu, Lagos.", telephone: contact.phoneHref, email: contact.email, address: { "@type": "PostalAddress", streetAddress: "105 Apata Street", addressLocality: "Shomolu", addressRegion: "Lagos", addressCountry: "NG" }, openingHours: openingHours.map((item) => `${item.days} ${item.hours}`) }) }] }), component: HomePage });

// IMPORTANT: Replace this placeholder. See ./README.md for routing conventions.

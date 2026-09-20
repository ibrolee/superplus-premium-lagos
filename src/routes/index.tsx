import { createFileRoute } from "@tanstack/react-router";
import { HomePageV2 } from "@/components/homepage-v2";
import { contact, openingHours } from "@/lib/site-data";
import { pageHead } from "@/lib/seo";

// Preserve existing homepage SEO and structured data. Only the rendered page component changes.
export const Route = createFileRoute("/")({ head: () => ({ ...pageHead("Super Plus Fitness & Spa — Gym in Shomolu", "Modern gym, personal training, spa, massage and recovery services in Shomolu, Lagos.", "/"), scripts: [{ type: "application/ld+json", children: JSON.stringify({ "@context": "https://schema.org", "@type": "HealthClub", name: contact.name, description: "Modern fitness, personal training, spa and recovery center in Shomolu, Lagos.", telephone: contact.phoneHref, email: contact.email, address: { "@type": "PostalAddress", streetAddress: "105 Apata Street", addressLocality: "Shomolu", addressRegion: "Lagos", addressCountry: "NG" }, openingHours: openingHours.map((item) => `${item.days} ${item.hours}`) }) }] }), component: HomePageV2 });

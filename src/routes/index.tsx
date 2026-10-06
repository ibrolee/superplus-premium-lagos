import { createFileRoute } from "@tanstack/react-router";
import { HomePageGallery } from "@/components/homepage-gallery";
import type { GalleryDisplayItem } from "@/components/gallery/GalleryExperience";
import { contact, openingHours } from "@/lib/site-data";
import { pageHead } from "@/lib/seo";
import { supabase } from "@/lib/supabase";

type GalleryRow = {
  id: string;
  title: string;
  category: string;
  media_type: "image" | "video";
  storage_path: string;
  thumbnail_path: string | null;
};

async function loadHomeGallery(): Promise<GalleryDisplayItem[] | null> {
  try {
    const { data, error } = await supabase
      .from("gallery_media")
      .select("id,title,category,media_type,storage_path,thumbnail_path")
      .eq("is_published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(4);

    if (error || !data) return null;

    const bucket = supabase.storage.from("gallery-media");
    return (data as GalleryRow[]).map((item) => {
      const url = bucket.getPublicUrl(item.storage_path).data.publicUrl;
      return {
        id: item.id,
        title: item.title,
        category: item.category,
        media_type: item.media_type,
        url,
        thumbnailUrl: item.thumbnail_path
          ? bucket.getPublicUrl(item.thumbnail_path).data.publicUrl
          : url,
      };
    });
  } catch {
    // Keep the homepage available even if the optional gallery feed is unavailable.
    return null;
  }
}

// Preserve existing homepage SEO and structured data while loading the first
// gallery row set during SSR so visitors do not wait for a client-side fetch.
export const Route = createFileRoute("/")({
  loader: loadHomeGallery,
  head: () => ({
    ...pageHead(
      "Super Plus Fitness & Spa — Gym in Shomolu",
      "Modern gym, personal training, spa, massage and recovery services in Shomolu, Lagos.",
      "/",
    ),
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "HealthClub",
          name: contact.name,
          description:
            "Modern fitness, personal training, spa and recovery center in Shomolu, Lagos.",
          telephone: contact.phoneHref,
          email: contact.email,
          address: {
            "@type": "PostalAddress",
            streetAddress: "105 Apata Street",
            addressLocality: "Shomolu",
            addressRegion: "Lagos",
            addressCountry: "NG",
          },
          openingHours: openingHours.map((item) => `${item.days} ${item.hours}`),
        }),
      },
    ],
  }),
  component: HomeRoute,
});

function HomeRoute() {
  const initialGalleryItems = Route.useLoaderData();
  return <HomePageGallery initialGalleryItems={initialGalleryItems ?? undefined} />;
}

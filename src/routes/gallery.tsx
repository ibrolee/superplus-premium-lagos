import { createFileRoute } from '@tanstack/react-router';
import { GalleryExperience } from '@/components/gallery/GalleryExperience';
import { pageHead } from '@/lib/seo';
export const Route = createFileRoute('/gallery')({ head: () => pageHead('Gym Photo & Video Gallery — Super Plus Fitness','Explore photos and videos of our gym, equipment, classes and fitness community in Shomolu, Lagos.','/gallery'), component: GalleryExperience });

import { createFileRoute } from "@tanstack/react-router";
import { FacilitiesPage } from "@/components/pages";
import { pageHead } from "@/lib/seo";
export const Route = createFileRoute("/facilities")({ head: () => pageHead("Modern Gym Facilities in Shomolu — Super Plus", "Explore strength, cardio, functional training, group class and recovery facilities in Shomolu.", "/facilities"), component: FacilitiesPage });
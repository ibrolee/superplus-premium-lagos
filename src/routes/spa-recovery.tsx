import { createFileRoute } from "@tanstack/react-router";
import { SpaRecoveryPage } from "@/components/pages";
import { pageHead } from "@/lib/seo";
export const Route = createFileRoute("/spa-recovery")({ head: () => pageHead("Spa & Massage in Shomolu — Super Plus", "Explore massage, spa machines and recovery services at Super Plus Fitness & Spa in Lagos.", "/spa-recovery"), component: SpaRecoveryPage });
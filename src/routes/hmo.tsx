import { createFileRoute } from "@tanstack/react-router";
import { HmoPage } from "@/components/pages";
import { pageHead } from "@/lib/seo";
export const Route = createFileRoute("/hmo")({ head: () => pageHead("HMO & Corporate Fitness Partnerships — Super Plus", "Create accessible fitness and wellness benefits for members and teams in Lagos.", "/hmo"), component: HmoPage });
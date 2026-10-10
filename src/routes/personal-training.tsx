import { createFileRoute } from "@tanstack/react-router";
import { PersonalTrainingPage } from "@/components/pages";
import { pageHead } from "@/lib/seo";
export const Route = createFileRoute("/personal-training")({ head: () => pageHead("Personal Training in Lagos — Super Plus", "Train with a personal coach at Super Plus Fitness in Shomolu, Lagos.", "/personal-training"), component: PersonalTrainingPage });
import { createFileRoute } from "@tanstack/react-router";
import { ContactPage } from "@/components/pages";
import { pageHead } from "@/lib/seo";
export const Route = createFileRoute("/contact")({ head: () => pageHead("Contact Super Plus Fitness in Shomolu", "Visit Super Plus Fitness at 105 Apata Street, Shomolu, Lagos or contact our team.", "/contact"), component: ContactPage });
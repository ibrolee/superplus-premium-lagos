import { createFileRoute } from "@tanstack/react-router";
import { ReceptionPage } from "@/components/pages";
import { pageHead } from "@/lib/seo";
export const Route = createFileRoute("/reception-checkin")({ head: () => pageHead("Reception Check-in — Super Plus Fitness", "Super Plus Fitness reception member check-in interface.", "/reception-checkin"), component: ReceptionPage });
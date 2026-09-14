import { createFileRoute } from "@tanstack/react-router";
import { MemberPage } from "@/components/pages";
import { pageHead } from "@/lib/seo";
export const Route = createFileRoute("/member")({ head: () => pageHead("Member Dashboard — Super Plus Fitness", "View membership status and access your member QR code.", "/member"), component: MemberPage });
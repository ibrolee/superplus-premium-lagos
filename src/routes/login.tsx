import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@/components/pages";
import { pageHead } from "@/lib/seo";
export const Route = createFileRoute("/login")({ head: () => pageHead("Member Login — Super Plus Fitness", "Access your Super Plus Fitness member account.", "/login"), component: LoginPage });
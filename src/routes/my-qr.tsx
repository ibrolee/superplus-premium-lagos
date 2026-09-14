import { createFileRoute } from "@tanstack/react-router";
import { MyQrPage } from "@/components/pages";
import { pageHead } from "@/lib/seo";
export const Route = createFileRoute("/my-qr")({ head: () => pageHead("My QR Code — Super Plus Fitness", "Open your Super Plus Fitness member QR code for reception check-in.", "/my-qr"), component: MyQrPage });
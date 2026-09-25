import { createFileRoute } from "@tanstack/react-router";
import { MemberDashboardV2 } from "@/components/member/MemberDashboardV2";

export const Route = createFileRoute("/member")({
  head: () => ({
    meta: [
      { title: "Member Dashboard — Super Plus Fitness" },
      { name: "description", content: "View your Super Plus Fitness membership, QR code, activity, achievements and community updates." },
    ],
  }),
  component: MemberDashboardV2,
});

import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Eye, ShieldCheck } from "lucide-react";
import { MemberDashboardV2 } from "@/components/member/MemberDashboardV2";

export const Route = createFileRoute("/management-member-preview/$memberId")({
  component: ManagementMemberDashboardPreview,
});

function ManagementMemberDashboardPreview() {
  const { memberId } = Route.useParams();

  return (
    <div className="min-h-[100dvh] bg-[#f3f6f0]">
      <div className="sticky top-0 z-[90] border-b border-[#bfd0bb] bg-[#193b2a] px-3 py-3 text-white shadow-lg sm:px-5">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#b8ee73] text-[#193b2a]">
              <Eye size={18} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[.15em] text-[#b8ee73]">
                <ShieldCheck size={13} />
                Read-only admin preview
              </div>
              <p className="mt-0.5 truncate text-sm font-black">
                Viewing this member dashboard exactly for inspection
              </p>
            </div>
          </div>
          <Link
            to="/admin-members"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-xs font-black text-white hover:bg-white/15"
          >
            <ArrowLeft size={15} />
            Exit preview
          </Link>
        </div>
        <p className="mx-auto mt-2 max-w-6xl text-[10px] leading-4 text-white/65">
          Member actions are disabled in preview mode. Nothing you tap inside the dashboard can renew, submit feedback, report an issue, change details or log the member out.
        </p>
      </div>

      <MemberDashboardV2 previewMemberId={memberId} readOnly />
    </div>
  );
}

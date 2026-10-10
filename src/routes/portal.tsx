import { Link, Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { ArrowRight, BriefcaseBusiness, Search, ShieldCheck, UserRoundCheck } from "lucide-react";

export const Route = createFileRoute("/portal")({ component: PortalLayout });

const entries = [
  {
    name: "Staff",
    label: "Employee account",
    description: "Profile, QR clock-in, attendance history and salary records.",
    to: "/portal/staff",
    icon: BriefcaseBusiness,
  },
  {
    name: "Reception",
    label: "Front desk",
    description: "Register, renew, search members, scan QR and handle reminders.",
    to: "/portal/reception",
    icon: UserRoundCheck,
  },
  {
    name: "Admin",
    label: "Management",
    description: "Revenue, staff, payroll, reports, website content and approvals.",
    to: "/portal/admin",
    icon: ShieldCheck,
  },
] as const;

function PortalLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  // TanStack's /portal/staff, /portal/reception and /portal/admin are nested under
  // /portal. Without Outlet they match but the sign-in forms cannot render.
  if (pathname.startsWith("/portal/")) return <Outlet />;
  return <PortalDirectory />;
}

function PortalDirectory() {
  return (
    <main className="min-h-dvh bg-[#f4f6f1] px-4 py-5 text-[#183125] sm:px-7 sm:py-8 lg:py-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dce8d7] bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-[#193b2a] font-black text-[#b8ee73]">
              S+
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#4a7a4a]">
                Super Plus Fitness &amp; Spa
              </p>
              <h1 className="text-xl font-black leading-tight sm:text-2xl">Portal access</h1>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 rounded-xl bg-[#edf6e7] px-3 py-2 text-xs font-bold text-[#356942]">
            <Search size={15} /> Search is inside each dashboard
          </span>
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-[#607366]">
          Choose the role assigned to the account. Each dashboard has its own menu, search, and
          mobile-friendly workspace.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {entries.map(({ name, label, description, to, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="group grid min-w-0 grid-cols-[2.5rem_minmax(0,1fr)_1.25rem] items-center gap-3 rounded-2xl border border-[#d9e7d5] bg-white p-3 shadow-sm transition hover:border-[#6d9b6b] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#27643a] sm:p-4 md:flex md:flex-col md:items-stretch"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-[#193b2a] text-[#b8ee73]">
                <Icon size={22} aria-hidden="true" />
              </span>
              <div className="min-w-0 md:flex md:flex-1 md:flex-col">
                <p className="text-[10px] font-black uppercase tracking-wider text-[#65905c]">
                  {label}
                </p>
                <h2 className="text-base font-black leading-tight md:mt-1 md:text-xl">
                  {name} portal
                </h2>
                <p className="mt-1 text-xs leading-5 text-[#607366] md:flex-1 md:text-sm">
                  {description}
                </p>
              </div>
              <span className="inline-flex items-center justify-center font-bold text-[#27643a] md:mt-3 md:justify-start md:gap-2">
                <span className="sr-only md:not-sr-only">Open</span>
                <ArrowRight
                  size={18}
                  className="shrink-0 transition group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}

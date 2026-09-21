import { Link, Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { ArrowRight, BriefcaseBusiness, ShieldCheck, UserRoundCheck } from "lucide-react";

export const Route = createFileRoute("/portal")({ component: PortalLayout });

const entries = [
  { name: "Staff", description: "Your employee login, application and individual staff profile.", to: "/portal/staff", icon: BriefcaseBusiness },
  { name: "Reception", description: "Sign in using the dedicated front-desk account to open Reception 2.0.", to: "/portal/reception", icon: UserRoundCheck },
  { name: "Admin", description: "Sign in using the dedicated administrator account for management tools.", to: "/portal/admin", icon: ShieldCheck },
] as const;

function PortalLayout() {
  const pathname = useRouterState({ select: state => state.location.pathname });
  // TanStack's /portal/staff, /portal/reception and /portal/admin are nested under
  // /portal. Without Outlet they match but the sign-in forms cannot render.
  if (pathname.startsWith("/portal/")) return <Outlet />;
  return <PortalDirectory />;
}

function PortalDirectory() {
  return <main className="bg-[#f4f6f1] px-4 py-5 text-[#183125] sm:min-h-[70vh] sm:px-7 sm:py-12 lg:py-20">
    <div className="mx-auto max-w-5xl">
      <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#4a7a4a] sm:text-xs">Super Plus Fitness &amp; Spa</p>
      <h1 className="mt-1 text-3xl font-black leading-tight sm:mt-3 sm:text-6xl">Choose your portal</h1>
      <p className="mt-1 max-w-2xl text-xs leading-5 text-[#607366] sm:mt-4 sm:text-sm sm:leading-7">Each portal has its own sign-in page and verifies the account assigned to it. Choose the one that matches your role.</p>
      <div className="mt-4 grid gap-2.5 sm:mt-9 sm:gap-4 md:grid-cols-3">
        {entries.map(({ name, description, to, icon: Icon }) => <Link key={to} to={to} className="group grid min-w-0 grid-cols-[2.5rem_minmax(0,1fr)_1.25rem] items-center gap-3 rounded-2xl border border-[#d9e7d5] bg-white p-3 shadow-sm transition hover:border-[#6d9b6b] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#27643a] sm:flex sm:flex-col sm:items-stretch sm:rounded-3xl sm:p-6">
          <span className="flex size-10 items-center justify-center rounded-xl bg-[#193b2a] text-[#b8ee73] sm:size-12 sm:rounded-2xl"><Icon size={22} className="sm:size-6" aria-hidden="true" /></span>
          <div className="min-w-0 sm:flex sm:flex-1 sm:flex-col">
            <h2 className="text-base font-black leading-tight sm:mt-6 sm:text-xl">{name} portal</h2>
            <p className="mt-1 text-xs leading-4 text-[#607366] sm:mt-2 sm:flex-1 sm:text-sm sm:leading-6">{description}</p>
          </div>
          <span className="inline-flex items-center justify-center font-bold text-[#27643a] sm:mt-7 sm:justify-start sm:gap-2"><span className="sr-only sm:not-sr-only">Open portal</span><ArrowRight size={18} className="shrink-0 transition group-hover:translate-x-1" aria-hidden="true" /></span>
        </Link>)}
      </div>
    </div>
  </main>;
}

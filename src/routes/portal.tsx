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
  return <main className="min-h-[70vh] bg-[#f4f6f1] px-4 py-12 text-[#183125] sm:px-7 sm:py-20">
    <div className="mx-auto max-w-5xl">
      <p className="text-xs font-black uppercase tracking-[.2em] text-[#4a7a4a]">Super Plus Fitness &amp; Spa</p>
      <h1 className="mt-3 text-4xl font-black sm:text-6xl">Choose your portal</h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-[#607366]">Each portal has its own sign-in page and verifies the account assigned to it. Choose the one that matches your role.</p>
      <div className="mt-9 grid gap-4 md:grid-cols-3">
        {entries.map(({ name, description, to, icon: Icon }) => <Link key={to} to={to} className="group flex min-w-0 flex-col rounded-3xl border border-[#d9e7d5] bg-white p-6 shadow-sm transition hover:border-[#6d9b6b] hover:shadow-md">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-[#193b2a] text-[#b8ee73]"><Icon size={24} /></span>
          <h2 className="mt-6 text-xl font-black">{name} portal</h2>
          <p className="mt-2 flex-1 text-sm leading-6 text-[#607366]">{description}</p>
          <span className="mt-7 inline-flex items-center gap-2 font-bold text-[#27643a]">Open portal <ArrowRight size={18} className="transition group-hover:translate-x-1" /></span>
        </Link>)}
      </div>
    </div>
  </main>;
}

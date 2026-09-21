import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Link, createRootRouteWithContext, useRouter, useRouterState, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Footer, Navbar, UtilityBar } from "@/components/portal/SiteChrome";
import { SiteMotion } from "@/components/site-motion";
import { WorkspaceNavigation } from "@/components/management/WorkspaceNavigation";
import { AdminPersistentNavigation } from "@/components/admin/AdminPersistentNavigation";
import { ReceptionPersistentNavigation } from "@/components/reception/ReceptionPersistentNavigation";
import { ReceptionRouteGate } from "@/components/reception/ReceptionRouteGate";
import { VisitorChat } from "@/components/visitor/VisitorChat";
import { Toaster } from "@/components/ui/sonner";
import { Analytics } from "@vercel/analytics/react";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return <div className="flex min-h-screen items-center justify-center bg-background px-4"><div className="max-w-md text-center"><h1 className="text-7xl font-bold text-foreground">404</h1><h2 className="mt-4 text-xl font-semibold">Page not found</h2><p className="mt-2 text-sm text-muted-foreground">The page you're looking for doesn't exist or has been moved.</p><Link to="/" className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Go home</Link></div></div>;
}
function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]);
  return <div className="flex min-h-screen items-center justify-center bg-background px-4"><div className="max-w-md text-center"><h1 className="text-xl font-semibold">This page didn't load</h1><p className="mt-2 text-sm text-muted-foreground">Something went wrong. Try refreshing or head home.</p><div className="mt-6 flex flex-wrap justify-center gap-2"><button type="button" onClick={() => { router.invalidate(); reset(); }} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Try again</button><a href="/" className="rounded-md border px-4 py-2 text-sm">Go home</a></div></div></div>;
}
const structuredData = { "@context": "https://schema.org", "@type": "HealthClub", "@id": "https://www.superplusfitness.com/#business", name: "Super Plus Fitness & Spa", url: "https://www.superplusfitness.com/", logo: "https://www.superplusfitness.com/header-logo.png", telephone: "+2347054263170", email: "spfitnessandspa@gmail.com", description: "Modern gym, personal training, spa and recovery centre in Shomolu, Lagos.", address: { "@type": "PostalAddress", streetAddress: "No. 105 Apata Street", addressLocality: "Shomolu", addressRegion: "Lagos", addressCountry: "NG" }, areaServed: { "@type": "Place", name: "Shomolu, Lagos, Nigeria" }, openingHoursSpecification: [{ "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], opens: "06:00", closes: "20:30" }, { "@type": "OpeningHoursSpecification", dayOfWeek: "Sunday", opens: "06:30", closes: "19:00" }] };
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [{ charSet: "utf-8" }, { name: "viewport", content: "width=device-width, initial-scale=1" }, { title: "Super Plus Fitness & Spa | Gym, Spa & Fitness Centre in Shomolu, Lagos" }, { name: "description", content: "Super Plus Fitness & Spa is a modern gym, spa and wellness centre in Shomolu, Lagos. Gym memberships, personal training, spa, massage and recovery services." }, { name: "author", content: "Super Plus Fitness & Spa" }, { name: "robots", content: "index, follow" }, { name: "google-site-verification", content: "dvLoiUjionw-0ABS1gIa7Fd0cPzWNVOPn4SiPTT8dfw" }, { property: "og:title", content: "Super Plus Fitness & Spa | Gym, Spa & Fitness Centre in Shomolu, Lagos" }, { property: "og:description", content: "A modern gym, spa and wellness centre in Shomolu, Lagos offering gym memberships, personal training, spa, massage and recovery services." }, { property: "og:type", content: "website" }, { property: "og:site_name", content: "Super Plus Fitness & Spa" }, { name: "twitter:card", content: "summary_large_image" }, { name: "twitter:title", content: "Super Plus Fitness & Spa | Gym, Spa & Fitness Centre in Shomolu, Lagos" }, { name: "twitter:description", content: "Modern gym, spa and wellness centre in Shomolu, Lagos. Memberships, personal training, massage and recovery services." }],
    links: [{ rel: "canonical", href: "https://www.superplusfitness.com/" }, { rel: "stylesheet", href: appCss }, { rel: "preconnect", href: "https://fonts.googleapis.com" }, { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" }, { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap" }, { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" }],
  }), shellComponent: RootShell, component: RootComponent, notFoundComponent: NotFoundComponent, errorComponent: ErrorComponent,
});
function RootShell({ children }: { children: ReactNode }) { return <html lang="en"><head><HeadContent /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} /></head><body>{children}<Scripts /><Analytics /></body></html>; }

// Keep account workspaces free of the public visitor guide and marketing footer.
function isInternalWorkspace(pathname: string): boolean {
  return pathname === "/portal" || pathname.startsWith("/portal/") ||
    pathname === "/staff" || pathname.startsWith("/staff-") || pathname.startsWith("/staff/") ||
    pathname === "/reception" || pathname.startsWith("/reception-") || pathname.startsWith("/reception/") ||
    pathname === "/management" || pathname.startsWith("/management-") || pathname.startsWith("/management/") ||
    pathname === "/admin-workspace" || pathname === "/admin-members" || pathname === "/admin-approvals";
}
function isVisitorPage(pathname: string): boolean {
  return ["/", "/membership", "/personal-training", "/facilities", "/gallery", "/spa-recovery", "/about", "/hmo", "/contact", "/blog", "/join"].includes(pathname) || /^\/blog\/[a-z0-9-]+\/?$/.test(pathname);
}
function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return <QueryClientProvider client={queryClient}><UtilityBar /><Navbar /><SiteMotion /><WorkspaceNavigation /><AdminPersistentNavigation /><ReceptionPersistentNavigation /><ReceptionRouteGate />{!isInternalWorkspace(pathname) && <Footer />}{isVisitorPage(pathname) && <VisitorChat />}<Toaster position="top-center" richColors /></QueryClientProvider>;
}

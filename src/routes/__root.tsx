import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Footer, Navbar, UtilityBar } from "@/components/site";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>

        <h2 className="mt-4 text-xl font-semibold text-foreground">
          Page not found
        </h2>

        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>

        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  console.error(error);

  const router = useRouter();

  useEffect(() => {
    reportLovableError(error, {
      boundary: "tanstack_root_error_component",
    });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back
          home.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>

          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

const structuredData = {
  "@context": "https://schema.org",
  "@type": "HealthClub",
  "@id": "https://www.superplusfitness.com/#business",
  name: "Super Plus Fitness & Spa",
  url: "https://www.superplusfitness.com/",
  logo: "https://www.superplusfitness.com/header-logo.png",
  telephone: "+2347054263170",
  email: "spfitnessandspa@gmail.com",
  description:
    "Modern gym, personal training, spa and recovery centre in Shomolu, Lagos.",
  address: {
    "@type": "PostalAddress",
    streetAddress: "No. 105 Apata Street",
    addressLocality: "Shomolu",
    addressRegion: "Lagos",
    addressCountry: "NG",
  },
  areaServed: {
    "@type": "Place",
    name: "Shomolu, Lagos, Nigeria",
  },
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ],
      opens: "06:00",
      closes: "20:30",
    },
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: "Sunday",
      opens: "06:30",
      closes: "19:00",
    },
  ],
};

export const Route =
  createRootRouteWithContext<{ queryClient: QueryClient }>()({
    head: () => ({
      meta: [
        { charSet: "utf-8" },

        {
          name: "viewport",
          content: "width=device-width, initial-scale=1",
        },

        {
          title:
            "Super Plus Fitness & Spa | Gym, Spa & Fitness Centre in Shomolu, Lagos",
        },

        {
          name: "description",
          content:
            "Super Plus Fitness & Spa is a modern gym, spa and wellness centre in Shomolu, Lagos. Gym memberships, personal training, spa, massage and recovery services.",
        },

        {
          name: "author",
          content: "Super Plus Fitness & Spa",
        },

        {
          name: "robots",
          content: "index, follow",
        },

        {
          property: "og:title",
          content:
            "Super Plus Fitness & Spa | Gym, Spa & Fitness Centre in Shomolu, Lagos",
        },

        {
          property: "og:description",
          content:
            "A modern gym, spa and wellness centre in Shomolu, Lagos offering gym memberships, personal training, spa, massage and recovery services.",
        },

        {
          property: "og:type",
          content: "website",
        },

        {
          property: "og:site_name",
          content: "Super Plus Fitness & Spa",
        },

        {
          name: "twitter:card",
          content: "summary_large_image",
        },

        {
          name: "twitter:title",
          content:
            "Super Plus Fitness & Spa | Gym, Spa & Fitness Centre in Shomolu, Lagos",
        },

        {
          name: "twitter:description",
          content:
            "Modern gym, spa and wellness centre in Shomolu, Lagos. Memberships, personal training, massage and recovery services.",
        },
      ],

      links: [
        {
          rel: "canonical",
          href: "https://www.superplusfitness.com/",
        },

        {
          rel: "stylesheet",
          href: appCss,
        },

        {
          rel: "preconnect",
          href: "https://fonts.googleapis.com",
        },

        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossOrigin: "anonymous",
        },

        {
          rel: "stylesheet",
          href:
            "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap",
        },

        {
          rel: "icon",
          href: "/favicon.svg",
          type: "image/svg+xml",
        },
      ],
    }),

    shellComponent: RootShell,

    component: RootComponent,

    notFoundComponent: NotFoundComponent,

    errorComponent: ErrorComponent,
  });

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData),
          }}
        />
      </head>

      <body>
        {children}

        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <UtilityBar />

      <Navbar />

      <Outlet />

      <Footer />

      <Toaster
        position="top-center"
        richColors
      />
    </QueryClientProvider>
  );
}
import { useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { navItems } from "@/lib/site-data";
import "./site-motion.css";

/** Keep motion away from member accounts, check-in, checkout, staff dashboards and the homepage. */
export function SiteMotion() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  useEffect(() => {
    // Homepage 2.0 shows all sections immediately, including full-page mobile captures.
    // Leave motion behaviour unchanged on all other public marketing pages.
    const isMarketingPage =
      pathname !== "/" && (
        pathname === "/join" ||
        navItems.some((item) => item.to === pathname) ||
        pathname.startsWith("/blog/")
      );

    if (!isMarketingPage || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let observer: IntersectionObserver | undefined;
    let main: HTMLElement | null = null;
    const frame = window.requestAnimationFrame(() => {
      main = document.querySelector<HTMLElement>("main");
      if (!main) return;

      main.setAttribute("data-site-motion-page", "");
      // If the browser cannot observe visibility, keep every element visible.
      if (!("IntersectionObserver" in window)) return;

      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const element = entry.target as HTMLElement;
            element.setAttribute("data-site-motion-visible", "");
            observer?.unobserve(element);
          }
        },
        { threshold: 0.08, rootMargin: "0px 0px -7% 0px" },
      );

      const targets = main.querySelectorAll<HTMLElement>(
        "section .section-shell, section article, section .grid > a, section .grid > div",
      );

      targets.forEach((element, index) => {
        const bounds = element.getBoundingClientRect();
        element.style.setProperty("--site-motion-delay", `${(index % 4) * 65}ms`);
        element.setAttribute("data-site-motion-reveal", "");
        if (bounds.top < window.innerHeight * 0.9 && bounds.bottom > 0) {
          element.setAttribute("data-site-motion-visible", "");
        } else {
          observer?.observe(element);
        }
      });
    });

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      if (main) {
        main.removeAttribute("data-site-motion-page");
        main.querySelectorAll<HTMLElement>("[data-site-motion-reveal]").forEach((element) => {
          element.removeAttribute("data-site-motion-reveal");
          element.removeAttribute("data-site-motion-visible");
          element.style.removeProperty("--site-motion-delay");
        });
      }
    };
  }, [pathname]);

  return null;
}

import { useRouterState } from "@tanstack/react-router";
import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";
import { navItems } from "@/lib/site-data";
import "./site-motion.css";
import "./compact-public-footer.css";

/** Keep motion away from member accounts, check-in, checkout, staff dashboards and the homepage. */
export function SiteMotion() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const isMarketingPage = pathname !== "/" && (
      pathname === "/join" || navItems.some((item) => item.to === pathname) || pathname.startsWith("/blog/")
    );
    if (!isMarketingPage || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let observer: IntersectionObserver | undefined;
    let main: HTMLElement | null = null;
    const frame = window.requestAnimationFrame(() => {
      main = document.querySelector<HTMLElement>("main");
      if (!main) return;
      main.setAttribute("data-site-motion-page", "");
      if (!("IntersectionObserver" in window)) return;
      observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const element = entry.target as HTMLElement;
          element.setAttribute("data-site-motion-visible", "");
          observer?.unobserve(element);
        }
      }, { threshold: 0.08, rootMargin: "0px 0px -7% 0px" });
      const targets = main.querySelectorAll<HTMLElement>("section .section-shell, section article, section .grid > a, section .grid > div");
      targets.forEach((element, index) => {
        const bounds = element.getBoundingClientRect();
        element.style.setProperty("--site-motion-delay", `${(index % 4) * 65}ms`);
        element.setAttribute("data-site-motion-reveal", "");
        if (bounds.top < window.innerHeight * 0.9 && bounds.bottom > 0) element.setAttribute("data-site-motion-visible", "");
        else observer?.observe(element);
      });
    });
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      if (main) {
        main.removeAttribute("data-site-motion-page");
        main.querySelectorAll<HTMLElement>("[data-site-motion-reveal]").forEach(element => {
          element.removeAttribute("data-site-motion-reveal");
          element.removeAttribute("data-site-motion-visible");
          element.style.removeProperty("--site-motion-delay");
        });
      }
    };
  }, [pathname]);

  useEffect(() => {
    if (pathname !== "/") { setShowBackToTop(false); return; }
    const updateVisibility = () => setShowBackToTop(window.scrollY > 480);
    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateVisibility);
  }, [pathname]);

  // Leave room beside the visitor-chat launcher, rather than hiding this existing control behind it.
  return pathname === "/" && showBackToTop ? <button
    type="button"
    aria-label="Back to top"
    title="Back to top"
    onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })}
    className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-[10.25rem] z-40 flex size-12 items-center justify-center rounded-full border border-white/20 bg-secondary text-white shadow-lg shadow-black/25 transition-colors hover:bg-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary sm:bottom-7 sm:right-[10.5rem]"
  ><ArrowUp aria-hidden="true" className="size-5" /></button> : null;
}

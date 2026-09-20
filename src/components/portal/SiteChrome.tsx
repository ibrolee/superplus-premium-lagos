import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowUpRight, Instagram, LayoutDashboard, Menu, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { contact, navItems } from "@/lib/site-data";
import { GmailIcon, TikTokIcon, WhatsAppIcon } from "./footer-brand-icons";

const links = [...navItems, { label: "Portal", to: "/portal" }] as const;
const mobileSections = [
  { heading: "Explore", items: navItems.slice(0, 5) },
  { heading: "Discover More", items: navItems.slice(5) },
  {
    heading: "Your Account",
    items: [
      { label: "Member Login", to: "/login" },
      { label: "Staff & Management Portal", to: "/portal" },
    ],
  },
] as const;

export function UtilityBar() {
  return <div className="hidden bg-secondary py-2 text-secondary-foreground md:block"><div className="section-shell flex justify-end gap-5 text-[10px] font-bold uppercase"><Link to="/login">Member login</Link><Link to="/my-qr">My QR Code</Link><Link to="/portal">Portal</Link></div></div>;
}

export function Navbar() {
  const pathname = useRouterState({ select: state => state.location.pathname });
  const [open, setOpen] = useState(false);
  // The protected reminders sections appear only after data loads; a normal URL hash can scroll too early.
  useEffect(() => {
    if (pathname !== "/management-communications") return;
    const id = window.location.hash.slice(1);
    if (id !== "birthday-messages" && id !== "renewal-messages") return;
    const scrollToSection = () => {
      const section = document.getElementById(id);
      if (!section) return false;
      window.scrollTo({ top: window.scrollY + section.getBoundingClientRect().top - 80, behavior: "auto" });
      return true;
    };
    if (scrollToSection()) return;
    const observer = new MutationObserver(() => { if (scrollToSection()) observer.disconnect(); });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);

  return <header className="sticky top-0 z-50 border-b border-border/70 bg-background/95 backdrop-blur"><div className="section-shell grid h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:h-16 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
    <Link to="/" aria-label="Super Plus Fitness home" className="inline-flex min-w-0 items-center"><img src="/header-logo-colour.svg" alt="Super Plus Fitness" width={1030} height={255} className="block h-11 w-auto max-w-[46vw] object-contain sm:h-12 lg:h-10 lg:max-w-40 xl:h-12 xl:max-w-52" /></Link>
    <nav className="hidden justify-center gap-5 lg:flex" aria-label="Main navigation">{links.map(item => <Link key={item.to} to={item.to} className={`text-[11px] font-bold uppercase transition-colors hover:text-primary ${pathname === item.to ? "text-primary" : "text-foreground"}`}>{item.label}</Link>)}</nav>
    <div className="flex items-center gap-2">
      <Button asChild size="lg" className="hidden sm:inline-flex"><Link to="/join">Join now</Link></Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild><Button variant="outline" size="icon" className="size-10 lg:hidden" aria-label="Open menu"><Menu /></Button></SheetTrigger>
        <SheetContent side="right" className="flex h-[100dvh] w-[82vw] max-w-sm flex-col gap-0 overflow-hidden border-l border-white/10 bg-secondary p-0 text-secondary-foreground shadow-2xl motion-reduce:!animate-none motion-reduce:!transition-none [&>button]:right-4 [&>button]:top-4 [&>button]:flex [&>button]:size-10 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-lg [&>button]:border [&>button]:border-white/20 [&>button]:bg-white/10 [&>button]:text-white [&>button]:opacity-100 [&>button]:transition-colors [&>button]:hover:bg-white/20 [&>button]:focus-visible:outline-none [&>button]:focus-visible:ring-2 [&>button]:focus-visible:ring-primary [&>button>svg]:size-5">
          <div className="shrink-0 border-b border-white/10 px-5 py-4 pr-16">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-primary">Super Plus Fitness</p>
            <SheetTitle className="mt-1 font-display text-2xl font-bold uppercase leading-none text-white">Menu</SheetTitle>
          </div>
          <nav aria-label="Mobile navigation" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 [scrollbar-width:thin]">
            {mobileSections.map(section => <section key={section.heading} aria-label={section.heading} className="mb-5 last:mb-0">
              <h3 className="mb-1 px-3 text-[10px] font-extrabold uppercase tracking-[0.16em] text-primary">{section.heading}</h3>
              <div className="flex flex-col">
                {section.items.map(item => <Link key={item.to} to={item.to} onClick={() => setOpen(false)} className={`relative flex min-h-11 items-center gap-3 border-b border-white/10 px-3 py-2.5 text-sm font-semibold transition-colors duration-200 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary motion-reduce:transition-none ${pathname === item.to ? "bg-primary/10 text-primary" : "text-white/90"}`}>
                  {pathname === item.to && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" />}
                  {item.to === "/login" && <UserRound aria-hidden="true" className="size-4 shrink-0" />}
                  {item.to === "/portal" && <LayoutDashboard aria-hidden="true" className="size-4 shrink-0" />}
                  <span>{item.label}</span>
                </Link>)}
              </div>
            </section>)}
          </nav>
          <div className="shrink-0 border-t border-white/10 bg-secondary px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
            <Button asChild size="lg" className="h-12 w-full rounded-xl text-sm"><Link to="/join" onClick={() => setOpen(false)}>Join now <ArrowUpRight aria-hidden="true" /></Link></Button>
            <p className="mt-3 text-center text-[10px] tracking-wide text-white/50">Fitness That Fits Your Life</p>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  </div></header>;
}

export function Footer() {
  return <footer className="bg-secondary py-14 text-secondary-foreground"><div className="section-shell"><div className="grid gap-10 border-b border-primary-foreground/15 pb-12 md:grid-cols-2 lg:grid-cols-4"><div><Link to="/" aria-label="Super Plus Fitness home" className="inline-flex items-center"><img src="/footer-logo-circular.webp" alt="Super Plus Fitness — Fitness That Fits Your Life" width={80} height={80} loading="lazy" decoding="async" className="block size-20 shrink-0 rounded-full object-contain" /></Link><p className="mt-5 max-w-xs text-sm leading-6 text-secondary-foreground/60">Modern fitness, personal training, spa and recovery in Shomolu, Lagos.</p></div><div><h3 className="text-xs font-extrabold uppercase text-primary">Explore</h3><nav className="mt-5 grid gap-2">{navItems.slice(0, 8).map(item => <Link key={item.to} to={item.to} className="text-sm text-secondary-foreground/70 hover:text-primary">{item.label}</Link>)}</nav></div><div><h3 className="text-xs font-extrabold uppercase text-primary">Member &amp; Portal</h3><nav className="mt-5 grid gap-2">{[{ label: "Member login", to: "/login" }, { label: "My QR Code", to: "/my-qr" }, { label: "Staff, reception & admin portal", to: "/portal" }].map(item => <Link key={item.to} to={item.to} className="text-sm text-secondary-foreground/70 hover:text-primary">{item.label}</Link>)}</nav></div><div><h3 className="text-xs font-extrabold uppercase text-primary">Contact</h3><div className="mt-5 grid gap-3 text-sm text-secondary-foreground/70"><div className="flex flex-wrap items-center gap-3"><a href={`tel:${contact.phoneHref}`} className="hover:text-primary">{contact.phone}</a><a href={contact.whatsapp} aria-label={`WhatsApp ${contact.phone}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-[#25D366] transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><WhatsAppIcon className="size-6" /></a></div><a href={`mailto:${contact.email}`} className="inline-flex items-center gap-2 break-all hover:text-primary"><GmailIcon className="size-5 shrink-0 text-[#EA4335]" /><span>{contact.email}</span></a><p>{contact.address}</p><div className="flex items-center gap-2"><a href="https://www.instagram.com/superplusfitnessandspa/" aria-label="Instagram" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Instagram className="size-6" aria-hidden="true" /></a><a href="https://www.tiktok.com/@superplusfitness" aria-label="TikTok" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><TikTokIcon className="size-6" /></a></div></div></div></div><p className="pt-6 text-xs text-secondary-foreground/45">© {new Date().getFullYear()} Super Plus Fitness &amp; Spa. All rights reserved.</p></div></footer>;
}

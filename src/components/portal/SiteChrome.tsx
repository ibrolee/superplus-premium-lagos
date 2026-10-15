import { Link, useRouterState } from '@tanstack/react-router';
import { ArrowUpRight, Instagram, LayoutDashboard, Menu, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { contact, navItems, openingHours } from '@/lib/site-data';
import { GmailIcon, TikTokIcon, WhatsAppIcon } from './footer-brand-icons';
import './public-navbar.css';

// One shared menu model for desktop and mobile. /portal is intentionally the
// Staff / Reception / Admin chooser rather than the employee sign-in page.
const primaryNav = navItems.map(item =>
  item.to === '/facilities' ? { label: 'Gallery', to: '/gallery' as const } : item
);
const portalNav = [
  { label: 'Member Portal', to: '/login' as const, icon: UserRound },
  { label: 'Staff Portal', to: '/portal' as const, icon: LayoutDashboard },
];
const galleryNavItems = primaryNav;

export function UtilityBar() {
  return (
    <div className="hidden border-b border-white/10 bg-secondary text-secondary-foreground lg:block">
      <div className="section-shell flex min-h-8 items-center justify-end gap-6">
        {portalNav.map(item => (
          <Link key={item.to} to={item.to}
            className="inline-flex items-center gap-1.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white/75 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <item.icon aria-hidden="true" className="size-3.5"/>
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function Navbar() {
  const pathname = useRouterState({ select: state => state.location.pathname });
  const [open, setOpen] = useState(false);

  // Close the sheet when a route changes (including browser back/forward).
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (pathname !== '/management-communications') return;
    const id = window.location.hash.slice(1);
    if (id !== 'birthday-messages' && id !== 'renewal-messages') return;
    const scrollToSection = () => {
      const section = document.getElementById(id);
      if (!section) return false;
      window.scrollTo({ top: window.scrollY + section.getBoundingClientRect().top - 80, behavior: 'auto' });
      return true;
    };
    if (scrollToSection()) return;
    const observer = new MutationObserver(() => {
      if (scrollToSection()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/95 shadow-sm shadow-black/[0.03] backdrop-blur-xl">
      <div className="section-shell flex min-h-14 items-center justify-between gap-3 py-2 sm:min-h-16 lg:flex-wrap lg:gap-y-0 lg:py-0 2xl:min-h-[76px] 2xl:flex-nowrap 2xl:gap-6">
        <Link to="/" aria-label="Super Plus Fitness home" className="inline-flex min-w-0 shrink-0 items-center">
          <img src="/header-logo-colour.svg" alt="Super Plus Fitness" width={1030} height={255}
            className="block h-10 w-auto max-w-[47vw] object-contain sm:h-12 lg:h-12 lg:max-w-48 2xl:h-13 2xl:max-w-52"/>
        </Link>

        {/* Desktop: dedicated spacious nav row on standard laptops; single row on wide desktops. */}
        <nav className="order-3 hidden w-full items-center justify-between gap-x-2 border-t border-border/50 py-3 lg:flex 2xl:order-none 2xl:w-auto 2xl:min-w-0 2xl:flex-1 2xl:justify-center 2xl:gap-x-5 2xl:border-0 2xl:py-0"
          aria-label="Main navigation">
          {primaryNav.map(item => (
            <Link key={item.to} to={item.to} aria-current={pathname === item.to ? 'page' : undefined}
              className={`relative whitespace-nowrap rounded-md px-1.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.015em] transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary xl:text-xs 2xl:px-0 ${pathname === item.to ? 'text-primary' : 'text-foreground/85'}`}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Button asChild size="lg" className="hidden h-10 rounded-xl px-5 text-xs font-extrabold uppercase sm:inline-flex lg:h-11">
            <Link to="/join">Join now <ArrowUpRight aria-hidden="true" className="size-4"/></Link>
          </Button>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="size-10 rounded-xl lg:hidden" aria-label="Open navigation menu" aria-expanded={open}>
                <Menu aria-hidden="true" className="size-5"/>
              </Button>
            </SheetTrigger>

            <SheetContent side="right" aria-describedby={undefined}
              className="spf-public-mobile-menu flex h-[100dvh] w-[92vw] max-w-[24rem] flex-col gap-0 overflow-hidden border-l border-white/10 bg-secondary p-0 text-secondary-foreground shadow-2xl sm:w-[22rem] sm:max-w-[24rem] motion-reduce:!animate-none motion-reduce:!transition-none [&>button]:right-3 [&>button]:top-3 [&>button]:flex [&>button]:size-9 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-lg [&>button]:border [&>button]:border-white/20 [&>button]:bg-white/10 [&>button]:text-white [&>button]:opacity-100 [&>button]:hover:bg-white/20 [&>button]:focus-visible:outline-none [&>button]:focus-visible:ring-2 [&>button]:focus-visible:ring-primary">
              <div className="spf-mobile-menu-head shrink-0 border-b border-white/10 px-4 py-3 pr-14">
                <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-primary">Super Plus Fitness</p>
                <SheetTitle className="mt-1 font-display text-xl font-extrabold uppercase leading-none text-white">Explore SPF</SheetTitle>
              </div>

              {/* Compact two-column grid: all public desktop links and the two
                  portal shortcuts remain visible without an inner scrolling list. */}
              <nav aria-label="Mobile navigation" className="spf-mobile-menu-body flex min-h-0 flex-1 flex-col justify-center gap-[clamp(0.5rem,2dvh,1rem)] overflow-hidden px-3 py-2.5 sm:px-4">
                <section aria-label="Explore the website" className="min-h-0">
                  <h3 className="mb-1.5 px-1 text-[9px] font-extrabold uppercase tracking-[0.15em] text-primary">Explore</h3>
                  <div className="spf-mobile-primary-grid grid grid-cols-2 gap-1.5">
                    {primaryNav.map(item => (
                      <Link key={item.to} to={item.to} onClick={() => setOpen(false)}
                        aria-current={pathname === item.to ? 'page' : undefined}
                        className={`flex min-h-[clamp(2.35rem,6dvh,3rem)] items-center rounded-lg border px-2.5 py-1.5 text-[clamp(0.68rem,2.8vw,0.81rem)] font-bold leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${pathname === item.to ? 'border-primary/60 bg-primary/15 text-white' : 'border-white/10 bg-white/[0.055] text-white/90 hover:border-white/20 hover:bg-white/10'}`}>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </section>

                <section aria-label="Member and staff portal links" className="shrink-0">
                  <h3 className="mb-1.5 px-1 text-[9px] font-extrabold uppercase tracking-[0.15em] text-primary">Portals</h3>
                  <div className="spf-mobile-portal-grid grid grid-cols-2 gap-1.5">
                    {portalNav.map(item => (
                      <Link key={item.to} to={item.to} onClick={() => setOpen(false)}
                        aria-current={pathname === item.to ? 'page' : undefined}
                        className={`flex min-h-[clamp(2.6rem,6dvh,3.1rem)] flex-col items-center justify-center gap-1 rounded-lg border px-1.5 py-1.5 text-center text-[10px] font-bold leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${pathname === item.to ? 'border-primary/60 bg-primary/15 text-white' : 'border-white/15 bg-white/[0.07] text-white/90 hover:bg-white/10'}`}>
                        <item.icon aria-hidden="true" className="size-3.5 shrink-0 text-primary"/>
                        <span>{item.label}</span>
                      </Link>
                    ))}
                  </div>
                </section>
              </nav>

              <div className="spf-mobile-menu-footer shrink-0 border-t border-white/10 px-3 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-2.5 sm:px-4">
                <Button asChild size="lg" className="h-11 w-full rounded-xl text-xs font-extrabold uppercase">
                  <Link to="/join" onClick={() => setOpen(false)}>Join now <ArrowUpRight aria-hidden="true" className="size-4"/></Link>
                </Button>
                <p className="mt-1.5 text-center text-[9px] tracking-wide text-white/50">Fitness That Fits Your Life</p>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
 const primaryLinks=galleryNavItems.filter(item=>['/','/app','/membership','/personal-training','/gallery','/spa-recovery','/blog'].includes(item.to));
 const businessLinks=galleryNavItems.filter(item=>['/about','/hmo','/faq','/contact'].includes(item.to));
 const accountLinks=[{label:'Member Portal',to:'/login'},{label:'Staff Portal',to:'/portal'}] as const;
 return <footer className="relative overflow-hidden bg-secondary text-secondary-foreground">
 <div className="pointer-events-none absolute -right-28 top-12 size-72 rounded-full border-[42px] border-primary/15" aria-hidden="true"/><div className="pointer-events-none absolute -left-20 bottom-10 size-56 rounded-full bg-primary/10 blur-3xl" aria-hidden="true"/>
 <div className="section-shell relative py-12 sm:py-16">
 <section className="mb-12 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20 sm:p-7 lg:p-8" aria-label="Footer call to action"><div className="grid gap-7 lg:grid-cols-[1.05fr_0.95fr] lg:items-center"><div className="flex gap-4"><Link to="/" aria-label="Super Plus Fitness home" className="inline-flex size-20 shrink-0 items-center justify-center rounded-full bg-white p-2 shadow-lg shadow-black/25 sm:size-24"><img src="/footer-logo-circular.webp" alt="Super Plus Fitness — Fitness That Fits Your Life" width={96} height={96} loading="lazy" decoding="async" className="block size-full rounded-full object-contain"/></Link><div><p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-primary">Super Plus Fitness & Spa</p><h2 className="mt-2 font-display text-4xl font-extrabold uppercase leading-[0.88] tracking-tight text-white sm:text-5xl">Train. Recover. Live better.</h2><p className="mt-4 max-w-xl text-sm leading-7 text-white/60">Modern gym access, personal training, spa and recovery services in Shomolu, Lagos.</p></div></div><div className="grid gap-3 sm:grid-cols-2 lg:justify-self-end"><Button asChild size="lg" className="h-12 rounded-xl text-sm"><Link to="/join">Become a member <ArrowUpRight aria-hidden="true"/></Link></Button><Button asChild size="lg" variant="outline" className="h-12 rounded-xl border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"><a href={contact.whatsapp} target="_blank" rel="noopener noreferrer">Chat on WhatsApp <WhatsAppIcon className="size-5"/></a></Button></div></div></section>
 <div className="grid gap-8 border-b border-white/10 pb-10 lg:grid-cols-[1.15fr_0.85fr_0.85fr_1.15fr]"><section aria-label="Visit Super Plus Fitness" className="rounded-3xl border border-white/10 bg-white/[0.035] p-5"><h3 className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">Visit us</h3><p className="mt-4 text-sm leading-6 text-white/70">{contact.address}</p><div className="mt-5 grid gap-2 text-xs text-white/55">{openingHours.map(item=><p key={item.days} className="flex justify-between gap-4 border-b border-white/10 pb-2 last:border-0 last:pb-0"><span>{item.days}</span><span className="text-right text-white/75">{item.hours}</span></p>)}</div><a href={contact.directions} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.14em] text-primary hover:text-white">Get directions <ArrowUpRight aria-hidden="true" className="size-4"/></a></section>
 <section aria-label="Explore" className="grid gap-3"><h3 className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">Explore</h3><nav className="grid gap-2.5">{primaryLinks.map(item=><Link key={item.to} to={item.to} className="text-sm font-medium text-white/65 transition-colors hover:text-primary">{item.label}</Link>)}</nav></section>
 <section aria-label="Business and portal links" className="grid gap-7"><div><h3 className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">Business</h3><nav className="mt-3 grid gap-2.5">{businessLinks.map(item=><Link key={item.to} to={item.to} className="text-sm font-medium text-white/65 transition-colors hover:text-primary">{item.label}</Link>)}</nav></div><div><h3 className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">PORTAL</h3><nav className="mt-3 grid gap-2.5">{accountLinks.map(item=><Link key={item.to} to={item.to} className="text-sm font-medium text-white/65 transition-colors hover:text-primary">{item.label}</Link>)}</nav></div></section>
 <section aria-label="Contact Super Plus Fitness" className="rounded-3xl border border-white/10 bg-white/[0.035] p-5"><h3 className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">Contact</h3><div className="mt-4 grid gap-3 text-sm text-white/70"><a href={`tel:${contact.phoneHref}`} className="inline-flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/15 px-4 py-3 hover:border-primary/60 hover:text-white"><span>{contact.phone}</span><span className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary">☎</span></a><a href={`mailto:${contact.email}`} className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-black/15 px-4 py-3 hover:border-primary/60 hover:text-white"><GmailIcon className="size-5 shrink-0 text-[#EA4335]"/><span>Send us a mail</span></a><div className="flex flex-wrap gap-2 pt-1"><a href={contact.whatsapp} aria-label={`WhatsApp ${contact.phone}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/15 text-[#25D366] transition-colors hover:border-[#25D366]/60 hover:bg-[#25D366]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><WhatsAppIcon className="size-6"/></a><a href="https://www.instagram.com/superplusfitnessandspa/" aria-label="Instagram" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/15 transition-colors hover:border-primary/60 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Instagram className="size-6" aria-hidden="true"/></a><a href="https://www.tiktok.com/@superplusfitness" aria-label="TikTok" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/15 transition-colors hover:border-primary/60 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><TikTokIcon className="size-6" aria-hidden="true"/></a></div></div></section></div>
 <div className="flex flex-col gap-4 pt-6 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between"><p>© {new Date().getFullYear()} Super Plus Fitness &amp; Spa. All rights reserved.</p><nav aria-label="Legal" className="flex flex-wrap gap-x-4 gap-y-2"><a href="/privacy-policy" className="hover:text-primary">Privacy Policy</a><a href="/terms" className="hover:text-primary">Terms</a><a href="/delete-account" className="hover:text-primary">Delete Account</a></nav></div>
 </div></footer>;
}

import { Link } from '@tanstack/react-router';
import { ArrowUpRight, Instagram } from 'lucide-react';
import { contact, openingHours } from '@/lib/site-data';
import { GmailIcon, TikTokIcon, WhatsAppIcon } from './footer-brand-icons';

// Keep the approved footer styling and its practical details, while removing
// the large promotional panel and the redundant Explore and Business link lists.
export function CompactFooter() {
  const accountLinks = [{ label: 'Member Portal', to: '/login' }, { label: 'Staff Portal', to: '/portal' }] as const;
  return <footer className="relative overflow-hidden bg-secondary text-secondary-foreground">
    <div className="pointer-events-none absolute -right-28 top-12 size-72 rounded-full border-[42px] border-primary/15" aria-hidden="true" />
    <div className="pointer-events-none absolute -left-20 bottom-10 size-56 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
    <div className="section-shell relative py-7 sm:py-12">
      <div className="grid gap-5 border-b border-white/10 pb-6 sm:gap-8 sm:pb-10 lg:grid-cols-[1.15fr_0.75fr_1.15fr]">
        <section aria-label="Visit Super Plus Fitness" className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
          <h3 className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">Visit us</h3>
          <p className="mt-3 text-sm leading-6 text-white/70">{contact.address}</p>
          <div className="mt-4 grid gap-2 text-xs text-white/55">{openingHours.map(item => <p key={item.days} className="flex justify-between gap-4 border-b border-white/10 pb-2 last:border-0 last:pb-0"><span>{item.days}</span><span className="text-right text-white/75">{item.hours}</span></p>)}</div>
          <a href={contact.directions} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.14em] text-primary hover:text-white">Get directions <ArrowUpRight aria-hidden="true" className="size-4" /></a>
        </section>
        <section aria-label="Portal links" className="grid content-start gap-3">
          <h3 className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">PORTAL</h3>
          <nav className="flex flex-wrap gap-x-5 gap-y-2 lg:flex-col">{accountLinks.map(item => <Link key={item.to} to={item.to} className="text-sm font-medium text-white/65 transition-colors hover:text-primary">{item.label}</Link>)}</nav>
        </section>
        <section aria-label="Contact Super Plus Fitness" className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
          <h3 className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">Contact</h3>
          <div className="mt-4 grid gap-3 text-sm text-white/70">
            <a href={`tel:${contact.phoneHref}`} className="inline-flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/15 px-4 py-3 hover:border-primary/60 hover:text-white"><span>{contact.phone}</span><span className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary">☎</span></a>
            <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-black/15 px-4 py-3 hover:border-primary/60 hover:text-white"><GmailIcon className="size-5 shrink-0 text-[#EA4335]" /><span>Send us a mail</span></a>
            <div className="flex flex-wrap gap-2 pt-1">
              <a href={contact.whatsapp} aria-label={`WhatsApp ${contact.phone}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/15 text-[#25D366] transition-colors hover:border-[#25D366]/60 hover:bg-[#25D366]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><WhatsAppIcon className="size-6" /></a>
              <a href="https://www.instagram.com/superplusfitnessandspa/" aria-label="Instagram" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/15 transition-colors hover:border-primary/60 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Instagram className="size-6" aria-hidden="true" /></a>
              <a href="https://www.tiktok.com/@superplusfitness" aria-label="TikTok" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/15 transition-colors hover:border-primary/60 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><TikTokIcon className="size-6" /></a>
            </div>
          </div>
        </section>
      </div>
      <div className="flex flex-col gap-2 pt-5 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between"><p>© {new Date().getFullYear()} Super Plus Fitness &amp; Spa. All rights reserved.</p><p className="font-semibold uppercase tracking-[0.14em] text-white/35">Fitness That Fits Your Life</p></div>
    </div>
  </footer>;
}

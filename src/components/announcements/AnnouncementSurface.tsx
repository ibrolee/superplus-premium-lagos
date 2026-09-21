import { useEffect, useState } from "react";
import { ArrowUpRight, Megaphone, X } from "lucide-react";
import {
  announcementImageUrl, isAnnouncementLive, loadActiveSiteAnnouncements,
  safeAnnouncementLink, type AnnouncementPlacement, type SiteAnnouncement,
} from "@/lib/site-announcements";

/** The image is always contained, never cropped: portrait event flyers remain legible. */
export function AnnouncementVisual({ item, variant = "banner", interactive = true }: {
  item: SiteAnnouncement;
  variant?: AnnouncementPlacement;
  interactive?: boolean;
}) {
  const image = announcementImageUrl(item.image_path);
  const href = safeAnnouncementLink(item.cta_url);
  const isPopup = variant === "popup";
  const isCard = variant === "dashboard";
  return (
    <article className={`overflow-hidden rounded-[24px] border shadow-sm ${isPopup ? "border-[#bdd7b5] bg-white text-[#193327]" : isCard ? "border-[#d3e6d0] bg-[#f0f8ed] text-[#193327]" : "border-[#426b44] bg-[#153d2a] text-white"}`}>
      <div className={`${isPopup ? "p-4 sm:p-6" : "p-5 sm:p-7"} ${image ? "grid items-center gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]" : ""}`}>
        <div className="min-w-0">
          <p className={`inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.17em] ${isPopup || isCard ? "text-[#286c3b]" : "text-[#c6efae]"}`}>
            <Megaphone className="size-4" aria-hidden="true" /> Super Plus announcement
          </p>
          <h2 className={`mt-3 break-words font-display font-extrabold uppercase leading-tight ${isPopup ? "text-3xl sm:text-4xl" : "text-2xl sm:text-4xl"}`}>{item.title}</h2>
          {item.body && <p className={`mt-3 whitespace-pre-line break-words text-sm leading-6 ${isPopup || isCard ? "text-[#4d6252]" : "text-white/85"}`}>{item.body}</p>}
          {href && item.cta_label && (interactive ? (
            <a href={href} target={href.startsWith("https://") ? "_blank" : undefined} rel={href.startsWith("https://") ? "noopener noreferrer" : undefined}
              className={`mt-5 inline-flex min-h-11 max-w-full items-center gap-2 rounded-xl px-5 py-3 text-xs font-extrabold ${isPopup || isCard ? "bg-[#1c5b32] text-white hover:bg-[#2d7644]" : "bg-[#b8ee73] text-[#193327] hover:bg-[#d6fca9]"}`}>
              <span className="break-words">{item.cta_label}</span><ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
            </a>
          ) : <span className="mt-5 inline-flex rounded-xl bg-[#d6eccb] px-4 py-2.5 text-xs font-bold text-[#1c5b32]">{item.cta_label} ↗</span>)}
        </div>
        {image && <div className={`flex items-center justify-center overflow-hidden rounded-xl ${isPopup ? "bg-[#f0f5ef]" : isCard ? "bg-white" : "bg-white/10"}`}>
          <img src={image} alt={`${item.title} announcement flyer`} loading={isPopup ? "eager" : "lazy"}
            className={`w-full max-w-full object-contain ${isPopup ? "max-h-[55dvh]" : isCard ? "max-h-64" : "max-h-80"}`} />
        </div>}
      </div>
    </article>
  );
}

const popupSeenKey = (item: SiteAnnouncement) => `spf-announcement-seen:${item.id}:${item.updated_at}`;
function alreadySeen(item: SiteAnnouncement): boolean {
  try { return window.sessionStorage.getItem(popupSeenKey(item)) === "1"; }
  catch { return false; }
}
function markSeen(item: SiteAnnouncement) {
  try { window.sessionStorage.setItem(popupSeenKey(item), "1"); }
  catch { /* Storage disabled: close still works for this page view. */ }
}

/** Read-only display. RLS checks publication, date window and member audience server-side. */
export function AnnouncementSurface({ placement }: { placement: AnnouncementPlacement }) {
  const [items, setItems] = useState<SiteAnnouncement[]>([]);
  const [popup, setPopup] = useState<SiteAnnouncement | null>(null);
  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      try {
        const all = await loadActiveSiteAnnouncements();
        if (!mounted) return;
        const matching = all.filter((item) => item[`show_${placement}`] && isAnnouncementLive(item));
        setItems(matching);
        if (placement === "popup") setPopup((previous) => {
          if (previous && matching.some((item) => item.id === previous.id)) return previous;
          const next = matching.find((item) => !alreadySeen(item)) || null;
          if (next) markSeen(next); // Once per browser tab/session, including page navigation.
          return next;
        });
      } catch {
        // Announcements are optional; a temporary read failure must not break the gym website.
      }
    };
    void refresh();
    const interval = window.setInterval(() => { void refresh(); }, 60_000);
    return () => { mounted = false; window.clearInterval(interval); };
  }, [placement]);

  useEffect(() => {
    if (!popup || placement !== "popup") return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setPopup(null); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [placement, popup]);

  if (placement === "popup") return popup && isAnnouncementLive(popup) ? (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-3 py-5 sm:p-8" role="presentation">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Dismiss announcement" onClick={() => setPopup(null)} />
      <section role="dialog" aria-modal="true" aria-label={`${popup.title} announcement`}
        className="relative z-10 w-full max-w-2xl overflow-y-auto rounded-[26px] bg-white p-2 shadow-2xl sm:p-3" style={{ maxHeight: "min(92dvh,900px)" }}>
        <button type="button" onClick={() => setPopup(null)} aria-label="Close announcement"
          className="absolute right-4 top-4 z-20 grid size-10 place-items-center rounded-full border border-[#d8e7d3] bg-white text-[#193327] shadow-sm hover:bg-[#eff7ed]">
          <X className="size-5" />
        </button>
        <AnnouncementVisual item={popup} variant="popup" />
        <p className="py-2 text-center text-[11px] text-[#617464]">This announcement is shown only once per visit. You can dismiss it at any time.</p>
      </section>
    </div>
  ) : null;

  if (!items.length) return null;
  if (placement === "banner") return (
    <section aria-label="Current Super Plus announcements" className="bg-[#eef6ea] px-4 py-4 sm:py-6">
      <div className="mx-auto max-w-6xl"><AnnouncementVisual item={items[0]} /></div>
    </section>
  );
  return (
    <section aria-label="Member announcements" className="bg-[#f5f7f2] px-4 py-5 sm:px-7">
      <div className="mx-auto max-w-6xl">
        <div className="mb-3 flex items-center justify-between gap-3"><h2 className="font-display text-2xl font-bold uppercase text-[#193327]">Gym announcements</h2><span className="text-xs text-[#536e58]">Latest updates</span></div>
        <div className="grid gap-4 md:grid-cols-2">{items.slice(0, 4).map((item) => <AnnouncementVisual key={item.id} item={item} variant="dashboard" />)}</div>
      </div>
    </section>
  );
}

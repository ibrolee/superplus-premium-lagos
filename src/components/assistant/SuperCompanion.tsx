import type { ReactNode } from "react";
import { contact } from "@/lib/site-data";

/** Reuse the light website asset rather than loading animation into dashboards. */
export function SuperPortrait({ size = 56 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, background: "linear-gradient(145deg,#fff0e2,#ffc48f)" }}
      className="relative block shrink-0 overflow-hidden rounded-full border-2 border-white shadow-sm"
    >
      <img
        src="/spf-digital-assistant.webp"
        alt=""
        width={768}
        height={768}
        decoding="async"
        loading="lazy"
        draggable={false}
        style={{
          position: "absolute",
          width: "200%",
          height: "200%",
          maxWidth: "none",
          top: 0,
          left: "-50%",
          objectFit: "contain",
        }}
      />
    </span>
  );
}

export function MemberCompanionWelcome({ firstName }: { firstName: string }) {
  const shortcut =
    "inline-flex min-h-10 min-w-0 items-center justify-center rounded-xl border border-[var(--portal-border)] bg-white/80 px-2 text-[11px] sm:px-3 sm:text-xs font-bold text-[color:var(--portal-accent)] transition hover:bg-[var(--portal-surface)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--portal-accent)]";
  return (
    <section aria-label="Welcome from Super" className="min-w-0 flex-1">
      <div className="flex min-w-0 items-center gap-3 pr-14">
        <SuperPortrait size={60} />
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[.12em] text-[color:var(--portal-accent)]">
            Your SPF companion
          </p>
          <h1 className="mt-1 break-words font-display text-3xl font-black uppercase sm:text-4xl">
            Hi, {firstName} 👋
          </h1>
          <p className="mt-1 text-xs text-[color:var(--portal-muted)]">
            Super here. Your next step is one tap away.
          </p>
        </div>
      </div>
      <nav aria-label="Member shortcuts" className="mt-3 grid grid-cols-3 gap-2">
        <a href="#member-membership" className={shortcut}>
          Membership
        </a>
        <a href="/spa-booking" className={shortcut}>
          Book spa
        </a>
        <a href={contact.whatsapp} target="_blank" rel="noopener noreferrer" className={shortcut}>
          Support
        </a>
      </nav>
    </section>
  );
}

export function CompanionEmptyState({
  title,
  children,
  action,
  onAction,
  href,
}: {
  title: string;
  children: ReactNode;
  action: string;
  onAction?: () => void;
  href?: string;
}) {
  const actionClass =
    "mt-3 inline-flex min-h-10 items-center justify-center rounded-xl border border-[var(--portal-border)] bg-white px-3 text-xs font-bold text-[color:var(--portal-accent)] hover:bg-[var(--portal-surface)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--portal-accent)]";
  return (
    <div className="mt-4 flex items-start gap-3 rounded-2xl bg-[var(--portal-canvas)] p-4">
      <SuperPortrait size={48} />
      <div className="min-w-0">
        <p className="text-sm font-bold text-[color:var(--portal-ink)]">{title}</p>
        <div className="mt-1 text-xs leading-5 text-[color:var(--portal-muted)]">{children}</div>
        {onAction ? (
          <button type="button" onClick={onAction} className={actionClass}>
            {action}
          </button>
        ) : (
          <a href={href} className={actionClass}>
            {action}
          </a>
        )}
      </div>
    </div>
  );
}

import { supabase } from "@/lib/supabase";

export const ANNOUNCEMENT_BUCKET = "announcement-images";
export const MAX_ANNOUNCEMENT_IMAGE_BYTES = 8 * 1024 * 1024;

export type SiteAnnouncement = {
  id: string;
  title: string;
  body: string;
  image_path: string | null;
  cta_label: string | null;
  cta_url: string | null;
  audience: "everyone" | "members";
  status: "draft" | "published";
  show_banner: boolean;
  show_popup: boolean;
  show_dashboard: boolean;
  starts_at: string;
  ends_at: string | null;
  priority: number;
  created_at: string;
  updated_at: string;
};

export type AnnouncementPlacement = "banner" | "popup" | "dashboard";

export function announcementImageUrl(path: string | null): string | null {
  if (!path || !/^announcements\/[0-9a-f-]{36}\.(png|jpe?g|webp)$/.test(path)) return null;
  return supabase.storage.from(ANNOUNCEMENT_BUCKET).getPublicUrl(path).data.publicUrl;
}

export function safeAnnouncementLink(value: string | null): string | null {
  if (!value) return null;
  const text = value.trim();
  if (text.startsWith("/") && !text.startsWith("//") && !/[\u0000-\u001f]/.test(text)) return text;
  if (/^https:\/\/[^\s/]+(?:\/[^\s]*)?$/i.test(text)) return text;
  return null;
}

export function isAnnouncementLive(item: SiteAnnouncement, now = Date.now()): boolean {
  return item.status === "published" && Date.parse(item.starts_at) <= now &&
    (!item.ends_at || Date.parse(item.ends_at) > now);
}

/** Site announcements are read-only here; database RLS also enforces visibility. */
export async function loadActiveSiteAnnouncements(): Promise<SiteAnnouncement[]> {
  const { data, error } = await supabase.from("site_announcements")
    .select("id,title,body,image_path,cta_label,cta_url,audience,status,show_banner,show_popup,show_dashboard,starts_at,ends_at,priority,created_at,updated_at")
    .eq("status", "published")
    .order("priority", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(150);
  if (error) throw error;
  const live = ((data || []) as SiteAnnouncement[]).filter((item) => isAnnouncementLive(item));
  if (!live.some((item) => item.audience === "members")) return live;

  // Admins can read drafts/member notices for management, but that must not
  // accidentally make a member-only announcement public on their browser.
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return live.filter((item) => item.audience === "everyone");
  const { data: member, error: memberError } = await supabase.from("members")
    .select("id").eq("auth_user_id", userId).maybeSingle();
  if (memberError || !member) return live.filter((item) => item.audience === "everyone");
  return live;
}

/** All scheduling inputs in the admin page are explicitly Lagos local time (UTC+1). */
export function lagosInputFromIso(iso: string | null): string {
  if (!iso) return "";
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return "";
  return new Date(time + 60 * 60 * 1000).toISOString().slice(0, 16);
}
export function lagosInputToIso(input: string): string {
  const parsed = new Date(`${input}:00+01:00`);
  if (!input || Number.isNaN(parsed.getTime())) throw new Error("Enter a valid Lagos date and time.");
  return parsed.toISOString();
}
export function formatAnnouncementDate(iso: string | null): string {
  if (!iso) return "No automatic expiry";
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: "Africa/Lagos", day: "numeric", month: "short", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  }).format(new Date(iso));
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { ArrowRight, CalendarDays, Edit3, ImagePlus, Megaphone, Plus, Save, ShieldCheck, Trash2, X } from "lucide-react";
import { AdminWorkspaceShell } from "@/components/admin/AdminWorkspaceShell";
import { AnnouncementVisual } from "@/components/announcements/AnnouncementSurface";
import { supabase } from "@/lib/supabase";
import {
  ANNOUNCEMENT_BUCKET, MAX_ANNOUNCEMENT_IMAGE_BYTES, announcementImageUrl,
  formatAnnouncementDate, isAnnouncementLive, lagosInputFromIso, lagosInputToIso,
  safeAnnouncementLink, type SiteAnnouncement,
} from "@/lib/site-announcements";

export const Route = createFileRoute("/admin-announcements")({ component: AdminAnnouncements });

type AnnouncementForm = {
  title: string; body: string; image_path: string | null;
  cta_label: string; cta_url: string;
  audience: "everyone" | "members"; status: "draft" | "published";
  show_banner: boolean; show_popup: boolean; show_dashboard: boolean;
  starts: string; ends: string; priority: number;
};

function emptyForm(): AnnouncementForm {
  return {
    title: "", body: "", image_path: null, cta_label: "", cta_url: "",
    audience: "everyone", status: "draft", show_banner: true, show_popup: false,
    show_dashboard: false, starts: lagosInputFromIso(new Date().toISOString()),
    ends: "", priority: 50,
  };
}
function fromAnnouncement(item: SiteAnnouncement): AnnouncementForm {
  return {
    title: item.title, body: item.body, image_path: item.image_path,
    cta_label: item.cta_label || "", cta_url: item.cta_url || "",
    audience: item.audience, status: item.status, show_banner: item.show_banner,
    show_popup: item.show_popup, show_dashboard: item.show_dashboard,
    starts: lagosInputFromIso(item.starts_at), ends: lagosInputFromIso(item.ends_at),
    priority: item.priority,
  };
}
function humanStatus(item: SiteAnnouncement): string {
  if (item.status === "draft") return "Draft";
  if (item.ends_at && Date.parse(item.ends_at) <= Date.now()) return "Expired";
  if (Date.parse(item.starts_at) > Date.now()) return "Scheduled";
  return "Live";
}
const inputStyle = "mt-1.5 w-full min-w-0 rounded-xl border border-[#d5e2d0] bg-white px-4 py-3 text-sm outline-none focus:border-[#478d4c] focus-visible:ring-2 focus-visible:ring-[#b8ee73]/40 disabled:opacity-60";

function AdminAnnouncements() {
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [items, setItems] = useState<SiteAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editing, setEditing] = useState<SiteAnnouncement | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<AnnouncementForm>(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) throw new Error("Sign in to the admin portal first.");
        const { data: staff, error: staffError } = await supabase.from("staff_users")
          .select("role,active").eq("auth_user_id", auth.user.id).maybeSingle();
        if (staffError) throw staffError;
        if (!staff?.active || String(staff.role || "").toLowerCase() !== "admin")
          throw new Error("Only an active administrator can manage announcements.");
        if (mounted) setAuthorized(true);
      } catch (cause) {
        if (mounted) setError(cause instanceof Error ? cause.message : "Access denied.");
      } finally { if (mounted) setChecking(false); }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => { if (authorized) void loadItems(); }, [authorized]);
  useEffect(() => {
    if (!file) { setLocalPreview(null); return; }
    const url = URL.createObjectURL(file);
    setLocalPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function loadItems() {
    setLoading(true);
    const { data, error: loadError } = await supabase.from("site_announcements")
      .select("*").order("created_at", { ascending: false }).limit(150);
    if (loadError) setError(loadError.message);
    else setItems((data || []) as SiteAnnouncement[]);
    setLoading(false);
  }
  function update<K extends keyof AnnouncementForm>(key: K, value: AnnouncementForm[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }
  function newAnnouncement() {
    setEditing(null); setForm(emptyForm()); setFile(null); setEditorOpen(true);
    setError(""); setSuccess("");
  }
  function openEdit(item: SiteAnnouncement) {
    setEditing(item); setForm(fromAnnouncement(item)); setFile(null); setEditorOpen(true);
    setError(""); setSuccess("");
  }
  function closeEditor() {
    if (saving) return;
    setEditorOpen(false); setEditing(null); setFile(null); setError("");
  }
  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0];
    event.target.value = "";
    if (!chosen) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(chosen.type)) {
      setError("Upload a JPG, PNG or WebP image."); return;
    }
    if (chosen.size > MAX_ANNOUNCEMENT_IMAGE_BYTES) {
      setError("The image must be 8 MB or smaller."); return;
    }
    setFile(chosen); setError("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authorized || saving) return;
    setError(""); setSuccess("");
    if (form.title.trim().length < 2 || form.title.trim().length > 140) {
      setError("Enter a title between 2 and 140 characters."); return;
    }
    if (!form.show_banner && !form.show_popup && !form.show_dashboard) {
      setError("Choose at least one display location."); return;
    }
    const label = form.cta_label.trim();
    const link = form.cta_url.trim();
    if (Boolean(label) !== Boolean(link) || (link && !safeAnnouncementLink(link))) {
      setError("Enter both a button label and a valid /website-path or https:// URL, or leave both blank."); return;
    }
    let startsAt: string;
    let endsAt: string | null;
    try { startsAt = lagosInputToIso(form.starts); endsAt = form.ends ? lagosInputToIso(form.ends) : null; }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Invalid date."); return; }
    if (endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) {
      setError("Expiry must be later than the start date and time."); return;
    }
    if (form.status === "published" && endsAt && Date.parse(endsAt) <= Date.now()) {
      setError("The expiry is already in the past. Choose a later expiry before publishing."); return;
    }
    setSaving(true);
    let uploadedPath: string | null = null;
    try {
      if (file) {
        const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
        uploadedPath = `announcements/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from(ANNOUNCEMENT_BUCKET)
          .upload(uploadedPath, file, { contentType: file.type, upsert: false, cacheControl: "31536000" });
        if (uploadError) throw uploadError;
      }
      const payload = {
        title: form.title.trim(), body: form.body.trim(),
        image_path: uploadedPath || form.image_path,
        cta_label: label || null, cta_url: link || null,
        audience: form.audience, status: form.status,
        show_banner: form.show_banner, show_popup: form.show_popup,
        show_dashboard: form.show_dashboard, starts_at: startsAt,
        ends_at: endsAt, priority: form.priority,
      };
      const { data, error: writeError } = editing
        ? await supabase.from("site_announcements").update(payload)
            .eq("id", editing.id).eq("updated_at", editing.updated_at).select("*").maybeSingle()
        : await supabase.from("site_announcements").insert(payload).select("*").single();
      if (writeError) throw writeError;
      if (!data) throw new Error("The announcement was modified elsewhere. Reopen it and try again.");
      setEditorOpen(false); setEditing(null); setFile(null);
      setSuccess(form.status === "draft" ? "Draft saved. It is not visible on the website." :
        Date.parse(startsAt) > Date.now() ? "Scheduled. It will appear automatically at the chosen Lagos time." :
          "Announcement published. It will appear on the selected website locations.");
      await loadItems();
      if (editing?.image_path && editing.image_path !== payload.image_path) {
        const { error: cleanupError } = await supabase.storage.from(ANNOUNCEMENT_BUCKET).remove([editing.image_path]);
        if (cleanupError) setSuccess("Saved, but the old image could not be removed from storage.");
      }
    } catch (cause) {
      if (uploadedPath) await supabase.storage.from(ANNOUNCEMENT_BUCKET).remove([uploadedPath]);
      setError(cause instanceof Error ? cause.message : "Could not save announcement.");
    } finally { setSaving(false); }
  }

  async function togglePublication(item: SiteAnnouncement) {
    if (!authorized || busyId) return;
    if (item.status === "draft" && item.ends_at && Date.parse(item.ends_at) <= Date.now()) {
      setError("This announcement has expired. Edit its dates before publishing."); return;
    }
    setBusyId(item.id); setError(""); setSuccess("");
    const next = item.status === "published" ? "draft" : "published";
    const { error: changeError } = await supabase.from("site_announcements")
      .update({ status: next }).eq("id", item.id).eq("updated_at", item.updated_at).select("id").maybeSingle();
    if (changeError) setError(changeError.message);
    else { setSuccess(next === "draft" ? "Announcement unpublished." : "Announcement enabled. Scheduling rules apply automatically."); await loadItems(); }
    setBusyId(null);
  }
  async function removeAnnouncement(item: SiteAnnouncement) {
    if (!authorized || busyId || !window.confirm(`Permanently delete the announcement “${item.title}”?`)) return;
    setBusyId(item.id); setError(""); setSuccess("");
    const { error: deleteError } = await supabase.from("site_announcements").delete().eq("id", item.id);
    if (deleteError) setError(deleteError.message);
    else {
      setSuccess("Announcement deleted."); await loadItems();
      if (item.image_path) {
        const { error: imageError } = await supabase.storage.from(ANNOUNCEMENT_BUCKET).remove([item.image_path]);
        if (imageError) setSuccess("Announcement deleted, but its old image remains in storage.");
      }
    }
    setBusyId(null);
  }

  const previewItem: SiteAnnouncement = {
    id: editing?.id || "preview", title: form.title || "Your announcement title", body: form.body,
    image_path: file ? null : form.image_path, cta_label: form.cta_label || null,
    cta_url: form.cta_url || null, audience: form.audience, status: form.status,
    show_banner: form.show_banner, show_popup: form.show_popup, show_dashboard: form.show_dashboard,
    starts_at: editing?.starts_at || new Date().toISOString(), ends_at: editing?.ends_at || null,
    priority: form.priority, created_at: editing?.created_at || new Date().toISOString(),
    updated_at: editing?.updated_at || new Date().toISOString(),
  };

  return <AdminWorkspaceShell title="Announcements" subtitle="Schedule notices and flyers without editing the website or redeploying." active="/admin-announcements">
    <div className="mt-7 space-y-5 text-[#193327]">
      {checking ? <p role="status" className="rounded-2xl bg-white p-6 text-sm">Checking administrator access…</p> :
        !authorized ? <p role="alert" className="rounded-2xl border border-red-200 bg-white p-6 text-sm text-red-700"><ShieldCheck className="mb-2 size-6" />{error || "Administrator access required."}</p> : <>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-[#dce8d9] bg-white p-5 sm:p-7">
          <div><p className="text-xs font-extrabold uppercase tracking-widest text-[#387c47]">Website communications</p>
            <h2 className="mt-1 text-2xl font-black">Manage temporary announcements</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5c7161]">Text, flyers, or both. All times are Lagos time (WAT). Drafts stay private; published announcements automatically appear and expire on schedule.</p>
          </div>
          <button type="button" onClick={newAnnouncement} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#193b2a] px-5 py-3 text-sm font-bold text-white hover:bg-[#2d6242]"><Plus size={18}/> New announcement</button>
        </div>
        {!editorOpen && error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        {!editorOpen && success && <p role="status" className="rounded-xl border border-[#bfdab8] bg-[#ecf8e8] p-4 text-sm text-[#285c33]">{success}</p>}
        {loading ? <p role="status" className="rounded-xl bg-white p-6 text-sm">Loading announcements…</p> : items.length === 0 ?
          <div className="rounded-[24px] border border-dashed border-[#bed6b6] bg-white px-5 py-12 text-center"><Megaphone className="mx-auto size-10 text-[#40804d]"/><h3 className="mt-3 text-xl font-black">No announcements yet</h3><p className="mt-2 text-sm text-[#64776a]">Create a draft to see it here. Nothing is published by default.</p></div> :
          <div className="grid gap-4">{items.map((item) => <article key={item.id} className="grid gap-4 rounded-2xl border border-[#dce8d9] bg-white p-4 sm:grid-cols-[100px_minmax(0,1fr)] sm:p-5">
            <div className="flex size-24 items-center justify-center overflow-hidden rounded-xl bg-[#eef6e9]">
              {announcementImageUrl(item.image_path) ? <img className="max-h-full w-full object-contain" src={announcementImageUrl(item.image_path) || ""} alt="" loading="lazy"/> : <Megaphone className="size-8 text-[#4a8a55]"/>}
            </div>
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="break-words text-lg font-black">{item.title}</h3><span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${isAnnouncementLive(item) ? "bg-green-100 text-green-800" : "bg-[#f0f2ec] text-[#5a6b5a]"}`}>{humanStatus(item)}</span></div>
              <p className="mt-1 line-clamp-2 text-sm text-[#607364]">{item.body || "Image / headline announcement"}</p>
              <p className="mt-3 text-xs leading-5 text-[#657669]">Audience: {item.audience === "everyone" ? "Everyone" : "Members only"} · Starts: {formatAnnouncementDate(item.starts_at)} · Ends: {formatAnnouncementDate(item.ends_at)}</p>
              <p className="mt-1 text-xs text-[#657669]">Displays: {[item.show_banner && "Homepage banner", item.show_popup && "Popup", item.show_dashboard && "Member dashboard"].filter(Boolean).join(" · ")}</p>
              <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={Boolean(busyId)} onClick={() => openEdit(item)} className="inline-flex items-center gap-2 rounded-xl border border-[#cdddc7] px-4 py-2.5 text-xs font-bold disabled:opacity-50"><Edit3 size={15}/> Edit / Preview</button>
                <button type="button" disabled={Boolean(busyId)} onClick={() => void togglePublication(item)} className="rounded-xl bg-[#193b2a] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{busyId === item.id ? "Working…" : item.status === "published" ? "Unpublish" : "Publish"}</button>
                <button type="button" disabled={Boolean(busyId)} onClick={() => void removeAnnouncement(item)} className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-4 py-2.5 text-xs font-bold text-red-700 disabled:opacity-50"><Trash2 size={15}/> Delete</button>
              </div>
            </div>
          </article>)}</div>}
        {editorOpen && <section aria-labelledby="announcement-editor-title" className="rounded-[24px] border border-[#bdd3b5] bg-white p-4 shadow-lg sm:p-7">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-[#44844b]">Announcement editor</p><h2 id="announcement-editor-title" className="mt-1 text-2xl font-black">{editing ? "Edit announcement" : "Create announcement"}</h2></div><button type="button" onClick={closeEditor} disabled={saving} aria-label="Close editor" className="rounded-xl border p-2.5 disabled:opacity-50"><X size={20}/></button></div>
          <form onSubmit={(event) => void save(event)} className="mt-6 grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(290px,0.85fr)]">
            <div className="min-w-0 space-y-5">
              <label className="block text-sm font-bold">Title *<input required maxLength={140} value={form.title} onChange={(event) => update("title", event.target.value)} className={inputStyle} placeholder="NO GYM WEAR DAY"/></label>
              <label className="block text-sm font-bold">Short message (optional)<textarea rows={4} maxLength={1200} value={form.body} onChange={(event) => update("body", event.target.value)} className={inputStyle} placeholder="One registered member can bring one guest free..."/></label>
              <div className="rounded-2xl border border-[#dce6d7] p-4"><h3 className="flex items-center gap-2 text-sm font-black"><ImagePlus size={18}/> Flyer / image (optional)</h3><p className="mt-1 text-xs leading-5 text-[#657568]">JPG, PNG or WebP, up to 8 MB. Portrait flyers are displayed in full without cropping.</p>
                <input type="file" accept="image/jpeg,image/png,image/webp" disabled={saving} onChange={selectFile} className="mt-3 block w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-[#edf6e7] file:px-3 file:py-2 file:font-bold file:text-[#285a36]"/>
                {(file || form.image_path) && <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-[#f2f7ee] p-3 text-xs"><span className="truncate">{file ? file.name : "Current image uploaded"}</span><button type="button" disabled={saving} onClick={() => { setFile(null); update("image_path", null); }} className="font-bold text-red-700">Remove image</button></div>}
              </div>
              <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">Button text (optional)<input maxLength={65} value={form.cta_label} onChange={(event) => update("cta_label", event.target.value)} className={inputStyle} placeholder="Learn more"/></label><label className="text-sm font-bold">Button link (optional)<input type="text" maxLength={700} value={form.cta_url} onChange={(event) => update("cta_url", event.target.value)} className={inputStyle} placeholder="/blog or https://..."/></label></div>
              <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">Who can see it?<select value={form.audience} onChange={(event) => update("audience", event.target.value as AnnouncementForm["audience"])} className={inputStyle}><option value="everyone">Everyone</option><option value="members">Logged-in members only</option></select></label><label className="text-sm font-bold">Publishing<select value={form.status} onChange={(event) => update("status", event.target.value as AnnouncementForm["status"])} className={inputStyle}><option value="draft">Save as private draft</option><option value="published">Publish / schedule</option></select></label></div>
              <fieldset className="rounded-xl border border-[#dce6d7] p-4"><legend className="px-1 text-sm font-black">Where should it appear?</legend>
                <div className="mt-1 grid gap-3 sm:grid-cols-2">{([["show_banner","Homepage banner"],["show_popup","Visitor/member popup"],["show_dashboard","Member dashboard card"]] as const).map(([key,label])=><label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form[key]} onChange={(event)=>update(key,event.target.checked)} className="size-4 accent-[#1b6c36]"/>{label}</label>)}</div>
              </fieldset>
              <div className="rounded-xl bg-[#f1f7ee] p-4"><h3 className="flex items-center gap-2 text-sm font-black"><CalendarDays size={17}/> Schedule — Lagos time (WAT)</h3><p className="mt-1 text-xs text-[#627367]">Choose when it starts and optionally when it disappears. You don't need to redeploy the website.</p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2"><label className="text-xs font-bold">Starts *<input type="datetime-local" required value={form.starts} onChange={(event)=>update("starts",event.target.value)} className={inputStyle}/></label><label className="text-xs font-bold">Expires (optional)<input type="datetime-local" value={form.ends} onChange={(event)=>update("ends",event.target.value)} className={inputStyle}/></label></div>
              </div>
              <label className="block text-sm font-bold">Priority (0 appears first; default 50)<input type="number" min={0} max={100} value={form.priority} onChange={(event)=>update("priority",Math.max(0,Math.min(100,Number(event.target.value)||0)))} className={inputStyle}/></label>
              {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
              <div className="flex flex-wrap gap-3"><button type="submit" disabled={saving} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#193b2a] px-6 py-3 text-sm font-black text-white disabled:opacity-50"><Save size={17}/>{saving ? "Saving…" : form.status === "draft" ? "Save private draft" : "Save and publish / schedule"}</button><button type="button" onClick={closeEditor} disabled={saving} className="rounded-xl border px-5 py-3 text-sm font-bold disabled:opacity-50">Cancel</button></div>
            </div>
            <div className="min-w-0 self-start lg:sticky lg:top-24"><p className="mb-3 text-xs font-black uppercase tracking-widest text-[#477c4d]">Live design preview</p>
              {localPreview ? <div className="overflow-hidden rounded-2xl border border-[#d8e4d0] bg-[#f0f7eb] p-4"><p className="mb-3 text-sm font-black">{form.title || "Announcement"}</p>{form.body && <p className="mb-3 whitespace-pre-line text-sm">{form.body}</p>}<img src={localPreview} alt="Selected flyer preview" className="max-h-[65dvh] w-full object-contain"/>{form.cta_label && <p className="mt-3 text-xs font-bold">{form.cta_label} →</p>}</div> : <AnnouncementVisual item={previewItem} variant={form.show_popup ? "popup" : form.show_dashboard && !form.show_banner ? "dashboard" : "banner"} interactive={false}/>}
              <p className="mt-3 text-xs leading-5 text-[#657568]">Preview is private. A draft will not appear on your live website until you publish it.</p>
            </div>
          </form>
        </section>}
        <a href="/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-[#377845]">View homepage <ArrowRight size={14}/></a>
      </>}
    </div>
  </AdminWorkspaceShell>;
}

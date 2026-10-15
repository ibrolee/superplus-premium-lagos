import { useId, useState, type ChangeEvent } from "react";
import { ImagePlus, Loader2, Trash2, UploadCloud } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { compressImageForWeb } from "@/lib/image-compression";

const BUCKET = "website-editor-images";
const MAX_ORIGINAL = 15 * 1024 * 1024;
const MAX_OPTIMIZED = 6 * 1024 * 1024;
const SUPPORTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const SUPPORTED_EXTENSIONS = /\.(jpe?g|png|webp|heic|heif)$/i;

export function WebsiteImageUploader({
  title, value, onChange, kind, disabled = false, onUploading,
}: {
  title: string;
  value: string;
  onChange: (url: string) => void;
  kind: "homepage" | "spa-services" | "content" | "branding";
  disabled?: boolean;
  onUploading: (uploading: boolean) => void;
}) {
  const inputId = useId();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [library, setLibrary] = useState<{path:string;title:string;alt_text:string}[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Permit selecting the same photo a second time after a failed upload.
    event.target.value = "";
    if (!file || uploading || disabled) return;
    setError("");
    setInfo("");
    const matchesType = SUPPORTED_TYPES.has(file.type.toLowerCase());
    if ((!matchesType && !(file.type === "" && SUPPORTED_EXTENSIONS.test(file.name))) || file.size > MAX_ORIGINAL || file.size === 0) {
      setError("Choose a JPG, PNG, WebP or supported iPhone photo under 15 MB.");
      return;
    }

    setUploading(true);
    onUploading(true);
    try {
      const { data: userResult, error: userError } = await supabase.auth.getUser();
      if (userError || !userResult.user) throw Error("Sign in as an admin or owner before uploading.");

      // Browser-optimized JPEGs are quick to load on mobile and strip source metadata.
      // JPEG does not support transparency; a white background is used for transparent art.
      const optimized = await compressImageForWeb(file, { maxDimension: kind === "homepage" ? 1920 : 1200, quality: 0.81 });
      if (!optimized.size || optimized.size > MAX_OPTIMIZED) throw Error("The optimized photo is still too large. Choose a smaller image.");
      const storagePath = `website/${userResult.user.id}/${kind}/${crypto.randomUUID()}.jpg`;
      const { error: storageError } = await supabase.storage.from(BUCKET).upload(storagePath, optimized, {
        contentType: "image/jpeg",
        cacheControl: "31536000",
        upsert: false,
      });
      if (storageError) throw storageError;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
      if (!data?.publicUrl) throw Error("The image uploaded, but its public URL could not be obtained.");

      const {error:assetError}=await supabase.from("wc_media").insert({
        path:storagePath,title:file.name.replace(/\.[^.]+$/,"").slice(0,120),
        alt_text:title.slice(0,180),category:kind,created_by:userResult.user.id
      });
      onChange(data.publicUrl);
      if(assetError)setInfo("Photo uploaded, but was not indexed in your shared media library.");
      if(!assetError)setInfo(`Uploaded and optimized (${Math.max(1, Math.round(optimized.size / 1024))} KB). Save your draft, then publish when ready.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Image upload failed. Please try again.");
    } finally {
      setUploading(false);
      onUploading(false);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--portal-border)] bg-[var(--portal-canvas)] p-4">
      <p className="text-xs font-bold">{title}</p>
      {value ? (
        <div className="mt-3 overflow-hidden rounded-xl border bg-white">
          <img src={value} loading="lazy" alt={title + " image preview"} className="h-44 w-full object-cover" />
        </div>
      ) : (
        <div className="mt-3 flex h-32 items-center justify-center rounded-xl border border-dashed bg-white text-[var(--portal-muted)]">
          <div className="text-center"><ImagePlus size={24} className="mx-auto" /><p className="mt-2 text-xs">No photo selected</p></div>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label htmlFor={inputId} className={`inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[var(--portal-ink)] px-4 py-3 text-xs font-black text-white ${disabled || uploading ? "pointer-events-none opacity-50" : ""}`}>
          {uploading ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
          {uploading ? "Uploading photo…" : value ? "Replace photo" : "Choose photo"}
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
          className="sr-only"
          aria-label={title + " image file"}
          disabled={disabled || uploading}
          onChange={event => void upload(event)}
        />
        {value && (
          <button type="button" disabled={disabled || uploading} onClick={() => { onChange(""); setInfo(""); setError(""); }}
            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-3 text-xs font-bold text-red-700 disabled:opacity-50">
            <Trash2 size={14} /> Remove photo
          </button>
        )}
      </div>
      <button type="button" disabled={disabled || uploading} className="mt-3 block text-xs font-bold text-[var(--portal-accent)] underline disabled:opacity-50"
        onClick={async()=>{
          if(libraryOpen){setLibraryOpen(false);return;}
          setLibraryOpen(true);setLibraryLoading(true);
          const {data,error}=await supabase.from("wc_media").select("path,title,alt_text").eq("archived",false).order("created_at",{ascending:false}).limit(120);
          if(error)setError(error.message);else setLibrary(data||[]);
          setLibraryLoading(false);
        }}>
        {libraryOpen?"Hide Media Library":"Choose an existing photo from Media Library"}
      </button>
      {libraryOpen&&<div className="mt-3 rounded-xl border bg-white p-3">
        {libraryLoading?<p className="text-xs">Loading saved photos…</p>:library.length===0?<p className="text-xs text-[var(--portal-muted)]">No saved photos yet.</p>:
          <div className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto">{library.map(asset=>{
            const url=supabase.storage.from(BUCKET).getPublicUrl(asset.path).data.publicUrl;
            return <button key={asset.path} type="button" disabled={disabled||uploading}
             onClick={()=>{onChange(url);setLibraryOpen(false);setInfo("Selected photo. Save draft and publish to update the website.");}}
             className="overflow-hidden rounded-lg border text-left disabled:opacity-50"
             title={asset.title||asset.alt_text||"Use this photo"}>
              <img src={url} alt={asset.alt_text||asset.title} loading="lazy" className="aspect-square w-full object-cover"/>
              <span className="block truncate p-1 text-[10px]">{asset.title||"Photo"}</span>
             </button>
          })}</div>}
      </div>}
      <p className="mt-2 text-xs leading-5 text-[var(--portal-muted)]">
        Choose from your phone or computer. JPG, PNG, WebP and supported iPhone photos; maximum original size 15 MB. Photos are optimized for the website.
      </p>
      {info && <p role="status" className="mt-2 rounded-lg bg-green-50 p-2 text-xs text-green-800">{info}</p>}
      {error && <p role="alert" className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">{error}</p>}
      <button type="button" className="mt-3 text-xs font-semibold text-[var(--portal-muted)] underline" onClick={() => setAdvanced(v => !v)}>
        {advanced ? "Hide link option" : "Have an image link instead?"}
      </button>
      {advanced && (
        <label className="mt-2 block text-xs font-bold">
          HTTPS image URL
          <input value={value} disabled={disabled || uploading} onChange={event => onChange(event.target.value)}
            placeholder="https://…" className="mt-2 w-full rounded-xl border bg-white px-3 py-3 text-sm font-normal" />
        </label>
      )}
    </div>
  );
}

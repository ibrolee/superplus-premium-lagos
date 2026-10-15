import {useCallback,useEffect,useState} from "react";
import {ArrowDown,ArrowUp,Copy,ImagePlus,Plus,RefreshCw,Save,Trash2,UploadCloud,Undo2} from "lucide-react";
import {supabase} from "@/lib/supabase";
import {WebsiteImageUploader} from "@/components/admin/WebsiteImageUploader";
import {type CmsNav,type CmsBrand,type CmsFacility,type CmsTestimonial,safeCmsHref} from "@/lib/stage1-cms";

type ConfigRow={key:string;draft:Record<string,any>;published:Record<string,any>;revision:number;published_revision:number};
type Version={id:string;key:string;version:number;created_at:string};
type Asset={path:string;title:string;alt_text:string;category:string;archived:boolean;created_at:string};
const tabs=[["navigation","Menus & Footer"],["facilities","Facilities"],["testimonials","Testimonials"],["branding","Branding"],["media","Media Library"]] as const;
const field="mt-1.5 w-full rounded-xl border bg-white px-3 py-2.5 text-sm";
const textLabel="block text-xs font-bold";
export function CmsConfigAdmin(){
 const [tab,setTab]=useState<string>("navigation");
 const [rows,setRows]=useState<ConfigRow[]>([]);
 const [versions,setVersions]=useState<Version[]>([]);
 const [assets,setAssets]=useState<Asset[]>([]);
 const [draft,setDraft]=useState<Record<string,any>>({});
 const [search,setSearch]=useState("");
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState("");
 const [uploading,setUploading]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [preview,setPreview]=useState(false);
 const [refresh,setRefresh]=useState(0);
 const load=useCallback(async()=>{
  setLoading(true);
  const [a,b,c]=await Promise.all([
   supabase.from("wc_config").select("key,draft,published,revision,published_revision").order("key"),
   supabase.from("wc_config_versions").select("id,key,version,created_at").order("created_at",{ascending:false}).limit(80),
   supabase.from("wc_media").select("path,title,alt_text,category,archived,created_at").order("created_at",{ascending:false}).limit(200)
  ]);
  if(a.error||b.error||c.error)setError(a.error?.message||b.error?.message||c.error?.message||"Could not load controls.");
  else{setRows((a.data||[]) as ConfigRow[]);setVersions((b.data||[]) as Version[]);setAssets((c.data||[]) as Asset[]);}
  setLoading(false);
 },[]);
 useEffect(()=>{void load();},[load,refresh]);
 const row=rows.find(x=>x.key===tab);
 useEffect(()=>{setDraft(row?.draft?structuredClone(row.draft):{});setPreview(false);},[tab,row?.revision]);
 const changed=!!row&&JSON.stringify(draft)!==JSON.stringify(row.draft);
 const pending=!!row&&JSON.stringify(row.published)!==JSON.stringify(row.draft);
 const disabled=loading||!!busy||uploading;
 function patch(next:Record<string,any>){setDraft(d=>({...d,...next}));setNotice("");}
 function updateList(key:string,index:number,change:Record<string,any>){setDraft(d=>({...d,[key]:(d[key]||[]).map((x:any,i:number)=>i===index?{...x,...change}:x)}));}
 function remove(key:string,index:number){patch({[key]:draft[key].filter((_:unknown,i:number)=>i!==index)});}
 function move(key:string,index:number,delta:number){
  const items=[...(draft[key]||[])];const to=index+delta;if(to<0||to>=items.length)return;
  const [item]=items.splice(index,1);items.splice(to,0,item);patch({[key]:items});
 }
 async function save(){
  if(!row||disabled)return;setBusy("save");setError("");setNotice("");
  const {error:e}=await supabase.rpc("wc_admin_save_config",{p_key:tab,p_data:draft,p_revision:row.revision});
  if(e)setError(e.message);else{setNotice("Draft saved. Preview or publish whenever you're ready.");setRefresh(x=>x+1);}
  setBusy("");
 }
 async function publish(){
  if(!row||changed||disabled)return;
  if(!window.confirm("Publish "+tab+" changes live to the public website?"))return;
  setBusy("publish");setError("");setNotice("");
  const {error:e}=await supabase.rpc("wc_admin_publish_config",{p_key:tab,p_revision:row.revision});
  if(e)setError(e.message);else{setNotice("Published successfully.");setRefresh(x=>x+1);}
  setBusy("");
 }
 async function restore(v:Version){
  if(!row||!window.confirm("Restore this previous version to a draft? Live website remains unchanged until you publish."))return;
  setBusy("restore");setError("");
  const {error:e}=await supabase.rpc("wc_admin_restore_config",{p_version_id:v.id,p_revision:row.revision});
  if(e)setError(e.message);else{setNotice("Restored version to private draft.");setRefresh(x=>x+1);}
  setBusy("");
 }
 async function editAsset(item:Asset,update:Record<string,unknown>){
  const {error:e}=await supabase.from("wc_media").update(update).eq("path",item.path);
  if(e)setError(e.message);else setAssets(xs=>xs.map(x=>x.path===item.path?{...x,...update}:x));
 }
 const library=assets.filter(a=>(a.title+" "+a.alt_text+" "+a.category).toLowerCase().includes(search.toLowerCase()));
 const renderLinks=(which:"header"|"footer")=><div className="rounded-xl border bg-white p-4">
  <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="font-black">{which==="header"?"Header navigation":"Footer links"}</h3>
   <button disabled={disabled} onClick={()=>patch({[which]:[...(draft[which]||[]),{label:"New link",href:"/"}]})} className="flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold"><Plus size={13}/>Add link</button>
  </div>
  <div className="space-y-2">{((draft[which]||[]) as CmsNav["header"]).map((x,i)=><div key={i} className="grid gap-2 rounded-xl bg-[var(--portal-canvas)] p-3 sm:grid-cols-[auto_1fr_1.3fr_auto] sm:items-end">
   <span className="self-center text-xs font-black">{i+1}</span>
   <label className={textLabel}>Menu label<input className={field} value={x.label} maxLength={45} onChange={e=>updateList(which,i,{label:e.target.value})}/></label>
   <label className={textLabel}>Link / URL<input className={field} value={x.href} onChange={e=>updateList(which,i,{href:e.target.value})}/></label>
   <div className="flex gap-1">
    <button title="Move up" disabled={i===0||disabled} onClick={()=>move(which,i,-1)} className="rounded-lg border bg-white p-2 disabled:opacity-30"><ArrowUp size={14}/></button>
    <button title="Move down" disabled={i===draft[which].length-1||disabled} onClick={()=>move(which,i,1)} className="rounded-lg border bg-white p-2 disabled:opacity-30"><ArrowDown size={14}/></button>
    <button title="Remove" disabled={disabled} onClick={()=>remove(which,i)} className="rounded-lg border border-red-200 bg-white p-2 text-red-700"><Trash2 size={14}/></button>
   </div>
  </div>)}</div>
 </div>;
 const renderContentItems=(which:"facilities"|"testimonials")=>{
  const items=(draft.items||[]) as (CmsFacility|CmsTestimonial)[];
  return <div className="space-y-3">
   <div className="flex items-center justify-between gap-2"><p className="text-xs text-[var(--portal-muted)]">Add, edit, hide or reorder content. Historic members and bookings are unaffected.</p>
     <button disabled={disabled} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold" onClick={()=>patch({items:[...items,which==="facilities"?{id:crypto.randomUUID(),name:"New facility",description:"",image:"",visible:false}:{id:crypto.randomUUID(),name:"Member",detail:"",quote:"",image:"",visible:false}]})}><Plus size={13}/>Add</button>
   </div>
   {items.map((item,i)=><article key={item.id} className="rounded-xl border bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
     <h3 className="font-black">{i+1}. {item.name}</h3><div className="flex gap-1">
      <button title="Move up" disabled={i===0||disabled} onClick={()=>move("items",i,-1)} className="rounded-lg border p-2 disabled:opacity-30"><ArrowUp size={14}/></button>
      <button title="Move down" disabled={i===items.length-1||disabled} onClick={()=>move("items",i,1)} className="rounded-lg border p-2 disabled:opacity-30"><ArrowDown size={14}/></button>
      <button title="Remove" disabled={disabled} onClick={()=>remove("items",i)} className="rounded-lg border border-red-200 p-2 text-red-700"><Trash2 size={14}/></button>
     </div></div>
    <label className="mt-3 flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={item.visible!==false} onChange={e=>updateList("items",i,{visible:e.target.checked})}/>Visible on website</label>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
     <label className={textLabel}>{which==="facilities"?"Facility name":"Customer name"}<input value={item.name} className={field} onChange={e=>updateList("items",i,{name:e.target.value})}/></label>
     {which==="testimonials"&&<label className={textLabel}>Member description<input value={(item as CmsTestimonial).detail||""} className={field} onChange={e=>updateList("items",i,{detail:e.target.value})}/></label>}
    </div>
    <label className="mt-3 block text-xs font-bold">{which==="facilities"?"Facility description":"Customer testimonial"}
     <textarea className={field+" min-h-24"} value={which==="facilities"?(item as CmsFacility).description:(item as CmsTestimonial).quote} onChange={e=>updateList("items",i,{[which==="facilities"?"description":"quote"]:e.target.value})}/>
    </label>
    <div className="mt-3"><WebsiteImageUploader title={which==="facilities"?"Facility photo":"Customer photo (optional)"} value={item.image||""} kind="content" disabled={disabled}
     onUploading={setUploading} onChange={image=>updateList("items",i,{image})}/></div>
   </article>)}
  </div>;
 };
 const configVersions=versions.filter(v=>v.key===tab).slice(0,8);
 return <section className="mt-5 space-y-5">
  <div><h2 className="text-xl font-black">Design & website content</h2><p className="mt-2 text-sm text-[var(--portal-muted)]">Manage public menus, facilities, testimonials, brand images and media. Changes require Save Draft then Publish Live.</p></div>
  <div className="flex flex-wrap gap-2">{tabs.map(([key,label])=><button type="button" key={key} onClick={()=>{setTab(key);setNotice("");setError("");}} className={`rounded-xl border px-4 py-2.5 text-xs font-black ${tab===key?"bg-[var(--portal-ink)] text-white":"bg-white"}`}>{label}</button>)}</div>
  {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
  {notice&&<p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
  {loading&&<p className="text-sm">Loading design controls…</p>}
  {tab==="media"&&!loading&&<div className="space-y-4">
   <div className="rounded-xl border bg-white p-4">
    <h3 className="text-lg font-black">Shared Media Library</h3><p className="mt-2 text-xs text-[var(--portal-muted)]">Upload once, then use the same photo in page sections, facilities, branding, homepage or spa services. Archiving hides it from selection but preserves published pages.</p>
    <div className="mt-4"><WebsiteImageUploader title="Upload a new website photo" value="" onChange={()=>setRefresh(x=>x+1)} kind="content" disabled={disabled} onUploading={setUploading}/></div>
    <label className="mt-5 block text-xs font-bold">Search images<input value={search} onChange={e=>setSearch(e.target.value)} className={field} placeholder="Search by name or category"/></label>
   </div>
   <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{library.map(a=>{
    const url=supabase.storage.from("website-editor-images").getPublicUrl(a.path).data.publicUrl;
    return <article key={a.path} className="overflow-hidden rounded-xl border bg-white"><img alt={a.alt_text||a.title} src={url} className="h-40 w-full object-cover" loading="lazy"/>
     <div className="space-y-2 p-3">
      <label className={textLabel}>Title<input className={field} defaultValue={a.title} onBlur={e=>void editAsset(a,{title:e.target.value.slice(0,120)})}/></label>
      <label className={textLabel}>Alt text<input className={field} defaultValue={a.alt_text} onBlur={e=>void editAsset(a,{alt_text:e.target.value.slice(0,180)})}/></label>
      <div className="flex flex-wrap gap-2">
       <button type="button" className="rounded-lg border px-3 py-2 text-xs font-bold" onClick={()=>{void navigator.clipboard.writeText(url);setNotice("Image URL copied.");}}><Copy size={13} className="mr-1 inline"/>Copy URL</button>
       <button type="button" className="rounded-lg border px-3 py-2 text-xs font-bold" onClick={()=>void editAsset(a,{archived:!a.archived})}>{a.archived?"Restore":"Archive"}</button>
      </div>
     </div>
    </article>
   })}</div>
   {library.length===0&&<p className="rounded-xl border bg-white p-5 text-sm text-[var(--portal-muted)]">No photos match your search yet.</p>}
  </div>}
  {row&&!loading&&tab!=="media"&&<div className="space-y-4">
   <p className="text-xs text-[var(--portal-muted)]">Published version {row.published_revision} · Draft revision {row.revision}</p>
   {tab==="navigation"&&<div className="space-y-4">{renderLinks("header")}{renderLinks("footer")}<p className="text-xs text-[var(--portal-muted)]">Always use /pages/your-page for custom page links. The member login and staff portals remain protected.</p></div>}
   {tab==="branding"&&<div className="rounded-xl border bg-white p-4">
      <h3 className="font-black">Global website branding</h3><p className="mt-1 text-xs text-[var(--portal-muted)]">Logo, favicon, signature colours and tagline. Only public website styling changes, not historical payment data.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
       {(["primary","accent"] as const).map(k=><label key={k} className={textLabel}>{k==="primary"?"Primary brand colour":"Accent colour"}
        <div className="mt-2 flex gap-2"><input type="color" value={(draft as CmsBrand)[k]||"#ed1027"} onChange={e=>patch({[k]:e.target.value})} className="h-11 w-16 cursor-pointer"/><input value={draft[k]||""} onChange={e=>patch({[k]:e.target.value})} className={field}/></div></label>)}
      </div>
      <label className="mt-4 block text-xs font-bold">Tagline<input value={draft.tagline||""} onChange={e=>patch({tagline:e.target.value})} className={field}/></label>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
       <WebsiteImageUploader title="Header and footer logo" kind="branding" value={draft.logo||""} disabled={disabled} onUploading={setUploading} onChange={logo=>patch({logo})}/>
       <WebsiteImageUploader title="Website favicon (browser icon)" kind="branding" value={draft.favicon||""} disabled={disabled} onUploading={setUploading} onChange={favicon=>patch({favicon})}/>
      </div>
    </div>}
   {tab==="facilities"&&renderContentItems("facilities")}
   {tab==="testimonials"&&renderContentItems("testimonials")}
   <div className="flex flex-wrap gap-2 rounded-xl border bg-white p-4">
    <button type="button" disabled={disabled||!changed} onClick={()=>void save()} className="rounded-xl bg-[var(--portal-ink)] px-4 py-3 text-xs font-bold text-white disabled:opacity-40"><Save size={14} className="mr-1 inline"/>Save Draft</button>
    <button type="button" disabled={disabled} onClick={()=>setPreview(x=>!x)} className="rounded-xl border px-4 py-3 text-xs font-bold">Preview changes</button>
    <button type="button" disabled={disabled||changed||!pending} onClick={()=>void publish()} className="rounded-xl bg-orange-600 px-4 py-3 text-xs font-black text-white disabled:opacity-40"><UploadCloud size={14} className="mr-1 inline"/>Publish Live</button>
    {changed&&<p className="w-full text-xs text-orange-700">Save your draft before publishing.</p>}
   </div>
   {preview&&<div className="rounded-xl border border-dashed bg-white p-4"><p className="text-xs font-black text-orange-700">PRIVATE PREVIEW</p>
    {tab==="navigation"?<div className="mt-3 flex flex-wrap gap-2">{(draft.header||[]).map((x:any,i:number)=><span key={i} className="rounded-lg border px-3 py-2 text-xs">{x.label}</span>)}</div>:
    tab==="branding"?<div className="mt-4 rounded-xl p-6 text-white" style={{backgroundColor:draft.primary}}>{draft.logo&&<img src={draft.logo} className="mb-3 max-h-16 max-w-40 object-contain" alt="Logo"/>}<h3 className="text-xl font-bold">Super Plus Fitness</h3><p className="mt-2 text-xs">{draft.tagline}</p></div>:
    <div className="mt-3 grid gap-3 sm:grid-cols-2">{(draft.items||[]).filter((x:any)=>x.visible!==false).map((x:any)=><div key={x.id} className="rounded-xl border p-3">{x.image&&<img src={x.image} className="mb-2 h-36 w-full rounded-lg object-cover" alt="Preview"/>}<b>{x.name}</b><p className="mt-2 text-sm">{x.description||x.quote}</p></div>)}</div>}
   </div>}
   <div className="rounded-xl border bg-white p-4"><h3 className="font-black">Restore previous version</h3><div className="mt-3 flex flex-wrap gap-2">{configVersions.map(v=><button type="button" key={v.id} disabled={disabled} onClick={()=>void restore(v)} className="rounded-lg border px-3 py-2 text-xs font-bold"><Undo2 size={13} className="mr-1 inline"/>Version {v.version}</button>)}</div></div>
  </div>}
 </section>;
}

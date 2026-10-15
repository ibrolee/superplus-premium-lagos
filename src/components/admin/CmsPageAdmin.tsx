import {useCallback,useEffect,useMemo,useState} from "react";
import {ArrowDown,ArrowUp,Copy,Eye,Plus,RefreshCw,Save,Trash2,UploadCloud,Undo2} from "lucide-react";
import {supabase} from "@/lib/supabase";
import {WebsiteImageUploader} from "@/components/admin/WebsiteImageUploader";
import {CmsPageBody} from "@/components/cms/CmsPublicPage";
import {blankCmsDoc,type CmsBlock,type CmsPageDoc} from "@/lib/stage1-cms";

type PageRow={slug:string;title:string;kind:"built_in"|"custom";draft:CmsPageDoc;published:CmsPageDoc|null;revision:number;published_revision:number;is_published:boolean};
type Version={id:string;slug:string;version:number;created_at:string};
const field="mt-1 block w-full rounded-lg border bg-white px-3 py-2.5 text-sm";
const types=["hero","text","image","split","cta","quote","video"] as const;
const makeBlock=(type:CmsBlock["type"]):CmsBlock=>({id:crypto.randomUUID(),type,heading:"New section",body:"Write your content here.",image:"",button_label:"",button_href:"",visible:true});
const blank=blankCmsDoc;
const validSlug=(s:string)=>/^[a-z][a-z0-9-]{1,55}$/.test(s);
const pageHref=(row:PageRow)=>row.kind==="custom"?"/pages/"+row.slug:row.slug==="home"?"/":"/"+row.slug;
export function CmsPageAdmin(){
 const [pages,setPages]=useState<PageRow[]>([]);
 const [versions,setVersions]=useState<Version[]>([]);
 const [selected,setSelected]=useState("home");
 const [draft,setDraft]=useState<CmsPageDoc>(blank);
 const [title,setTitle]=useState("");
 const [creating,setCreating]=useState(false);
 const [newName,setNewName]=useState("");
 const [newSlug,setNewSlug]=useState("");
 const [loading,setLoading]=useState(true);
 const [videos,setVideos]=useState<{title:string;storage_path:string}[]>([]);
 const [busy,setBusy]=useState("");
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");
 const [preview,setPreview]=useState(false);
 const [refresh,setRefresh]=useState(0);
 const [currentUpload,setCurrentUpload]=useState(false);
 const load=useCallback(async()=>{
  setLoading(true);
  const [a,b]=await Promise.all([
   supabase.from("wc_pages").select("slug,title,kind,draft,published,revision,published_revision,is_published").order("title"),
   supabase.from("wc_page_versions").select("id,slug,version,created_at").order("created_at",{ascending:false}).limit(100),
  ]);
  if(a.error||b.error)setError(a.error?.message||b.error?.message||"Unable to load pages.");
  else{setPages((a.data||[]) as PageRow[]);setVersions((b.data||[]) as Version[]);}
  setLoading(false);
 },[]);
 useEffect(()=>{void load()},[load,refresh]);
 useEffect(()=>{void supabase.from("gallery_media").select("title,storage_path")
   .eq("media_type","video").eq("is_published",true).order("created_at",{ascending:false}).limit(100)
   .then(({data})=>setVideos((data||[]) as {title:string;storage_path:string}[]));},[]);
 const current=pages.find(p=>p.slug===selected);
 useEffect(()=>{if(current){setDraft(structuredClone(current.draft));setTitle(current.title);setPreview(false);}},[selected,current?.revision]);
 const changed=!!current&&(JSON.stringify(current.draft)!==JSON.stringify(draft)||title!==current.title);
 const savedUnpublished=!!current&&(JSON.stringify(current.published)!==JSON.stringify(current.draft)||!current.is_published);
 function patch(values:Partial<CmsPageDoc>){setDraft(p=>({...p,...values}));setMessage("");}
 function mutateSection(id:string,values:Partial<CmsBlock>){setDraft(d=>({...d,sections:d.sections.map(x=>x.id===id?{...x,...values}:x)}));}
 function moveSection(index:number,to:number){
  if(to<0||to>=draft.sections.length)return;
  const next=[...draft.sections];const [item]=next.splice(index,1);next.splice(to,0,item);patch({sections:next});
 }
 async function create(){
  if(!validSlug(newSlug)||newName.trim().length<2){setError("Choose a title and a lowercase URL slug containing letters, numbers or hyphens.");return;}
  if(!window.confirm("Create new draft page at /pages/"+newSlug+"? It will not be public until you publish."))return;
  setBusy("create");setError("");setMessage("");
  const {error:e}=await supabase.rpc("wc_admin_save_page",{p_slug:newSlug,p_title:newName.trim(),p_doc:blank(),p_revision:0});
  if(e)setError(e.message);else{setCreating(false);setSelected(newSlug);setRefresh(v=>v+1);setMessage("Draft page created. Add sections, save and publish when ready.");}
  setBusy("");
 }
 async function save(){
  if(!current||currentUpload)return;
  setBusy("save");setError("");setMessage("");
  const {error:e}=await supabase.rpc("wc_admin_save_page",{p_slug:current.slug,p_title:title.trim(),p_doc:draft,p_revision:current.revision});
  if(e)setError(e.message);else{setMessage("Draft saved. Preview it, then Publish Live.");setRefresh(x=>x+1);}
  setBusy("");
 }
 async function publish(on:boolean){
  if(!current||changed||currentUpload)return;
  if(!window.confirm(on?"Publish this saved page and its sections on your public website?":"Unpublish this page or its custom sections?"))return;
  setBusy("publish");setError("");setMessage("");
  const {error:e}=await supabase.rpc("wc_admin_publish_page",{p_slug:current.slug,p_revision:current.revision,p_publish:on});
  if(e)setError(e.message);else{setMessage(on?"Published successfully.":"Unpublished successfully.");setRefresh(x=>x+1);}
  setBusy("");
 }
 async function restore(version:Version){
  if(!current||!window.confirm("Restore version "+version.version+" as an editable draft? Live content stays unchanged until you publish."))return;
  setBusy("restore");setError("");
  const {error:e}=await supabase.rpc("wc_admin_restore_page",{p_version_id:version.id,p_revision:current.revision});
  if(e)setError(e.message);else{setMessage("Version restored to draft. Review before publishing.");setRefresh(x=>x+1);}
  setBusy("");
 }
 const canReplace=!!current&&["about","hmo","personal-training"].includes(current.slug);
 const history=versions.filter(v=>v.slug===selected).slice(0,8);
 const disabled=!!busy||currentUpload||loading;
 return <section className="mt-4 space-y-5">
  <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-black">Page & section editor</h2><p className="mt-2 max-w-2xl text-sm text-[var(--portal-muted)]">Build new pages and design page sections using ready-made blocks. Existing membership, payment and booking functionality stays protected.</p></div>
   <button type="button" className="rounded-xl border bg-white px-4 py-3 text-xs font-bold" onClick={()=>setRefresh(x=>x+1)} disabled={disabled}><RefreshCw size={14} className="mr-1 inline"/> Refresh</button></div>
  <div className="flex flex-wrap items-end gap-3">
   <label className="min-w-52 flex-1 text-xs font-bold">Choose website page
    <select className={field} value={selected} disabled={disabled} onChange={e=>{setSelected(e.target.value);setError("");setMessage("");}}>{pages.map(p=><option key={p.slug} value={p.slug}>{p.title} · {p.kind==="custom"?"New page":"Existing page"}</option>)}</select>
   </label>
   <button className="rounded-xl bg-[var(--portal-ink)] px-4 py-3 text-xs font-black text-white" onClick={()=>setCreating(x=>!x)} disabled={disabled}><Plus size={14} className="mr-1 inline"/>Create page</button>
  </div>
  {creating&&<div className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-[1fr_1fr_auto]">
    <label className="text-xs font-bold">Page title<input className={field} value={newName} onChange={e=>{setNewName(e.target.value);setNewSlug(e.target.value.toLowerCase().trim().replace(/[^a-z0-9 -]/g,"").replace(/\s+/g,"-").slice(0,56));}} placeholder="Upcoming Events"/></label>
    <label className="text-xs font-bold">URL: /pages/<input className={field} value={newSlug} onChange={e=>setNewSlug(e.target.value.toLowerCase())} placeholder="upcoming-events"/></label>
    <button disabled={disabled} className="self-end rounded-xl bg-orange-600 px-4 py-3 text-xs font-bold text-white" onClick={()=>void create()}>Create draft</button>
   </div>}
  {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
  {message&&<p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">{message}</p>}
  {loading&&<p className="text-sm">Loading pages…</p>}
  {current&&!loading&&<div className="space-y-4">
   <div className="rounded-xl border bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold">{current.is_published?"Published":"Unpublished"} · Version {current.published_revision} · <a className="underline" href={pageHref(current)} target="_blank" rel="noopener noreferrer">View page</a></p><p className="text-xs text-[var(--portal-muted)]">Draft revision {current.revision}</p></div>
    <label className="mt-4 block text-xs font-bold">Page title<input className={field} value={title} disabled={disabled} onChange={e=>setTitle(e.target.value)}/></label>
    {canReplace&&<label className="mt-4 block text-xs font-bold">Page layout
     <select className={field} value={draft.mode||"extend"} disabled={disabled} onChange={e=>patch({mode:e.target.value as CmsPageDoc["mode"]})}>
      <option value="extend">Keep original content and add custom sections</option>
      <option value="replace">Replace original page content with this custom layout</option>
     </select>
    </label>}
    {!canReplace&&<p className="mt-3 text-xs text-[var(--portal-muted)]">{current.kind==="custom"?"This new page is built entirely from these blocks.":"Your custom content appears beneath the original page so core website functions remain intact."}</p>}
    <label className="mt-4 block text-xs font-bold">Custom page heading (optional)<input className={field} value={draft.heading||""} onChange={e=>patch({heading:e.target.value})} placeholder="Welcome to Super Plus"/></label>
    <label className="mt-4 block text-xs font-bold">Page introduction<textarea className={field+" min-h-24"} value={draft.intro||""} onChange={e=>patch({intro:e.target.value})} placeholder="Introduce this page…"/></label>
   </div>
   <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-black">Page sections ({draft.sections.length})</h3>
    <select value="" disabled={disabled||draft.sections.length>=30} className="rounded-xl border px-4 py-2.5 text-xs font-bold" onChange={e=>{const type=e.target.value as CmsBlock["type"];if(type)patch({sections:[...draft.sections,makeBlock(type)]});}}>
     <option value="">+ Add a section</option>{types.map(t=><option value={t} key={t}>{t[0].toUpperCase()+t.slice(1)} section</option>)}
    </select>
   </div>
   {draft.sections.length===0&&<div className="rounded-xl border border-dashed bg-white p-6 text-center text-sm text-[var(--portal-muted)]">No custom sections yet. Use “Add a section” to insert hero banners, text, image, split, button or quote blocks.</div>}
   {draft.sections.map((block,i)=><article key={block.id} className="rounded-xl border bg-white p-4">
     <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="font-black">{i+1}. {block.type.toUpperCase()} <span className="text-xs font-normal text-[var(--portal-muted)]">{block.visible===false?"Hidden":"Visible"}</span></h4>
      <div className="flex gap-2">
       <button type="button" title="Move up" disabled={i===0||disabled} onClick={()=>moveSection(i,i-1)} className="rounded-lg border p-2 disabled:opacity-30"><ArrowUp size={15}/></button>
       <button type="button" title="Move down" disabled={i===draft.sections.length-1||disabled} onClick={()=>moveSection(i,i+1)} className="rounded-lg border p-2 disabled:opacity-30"><ArrowDown size={15}/></button>
       <button type="button" title="Duplicate" disabled={disabled||draft.sections.length>=30} onClick={()=>patch({sections:[...draft.sections.slice(0,i+1),{...block,id:crypto.randomUUID()},...draft.sections.slice(i+1)]})} className="rounded-lg border p-2 disabled:opacity-30"><Copy size={15}/></button>
       <button type="button" title="Delete section" disabled={disabled} onClick={()=>patch({sections:draft.sections.filter(x=>x.id!==block.id)})} className="rounded-lg border border-red-200 p-2 text-red-700"><Trash2 size={15}/></button>
      </div>
     </div>
     <label className="mt-3 flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={block.visible!==false} onChange={e=>mutateSection(block.id,{visible:e.target.checked})}/>Display this section</label>
     <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="text-xs font-bold">Section style<select value={block.type} className={field} onChange={e=>mutateSection(block.id,{type:e.target.value as CmsBlock["type"]})}>{types.map(t=><option value={t} key={t}>{t}</option>)}</select></label>
      <label className="text-xs font-bold">Headline<input className={field} value={block.heading} onChange={e=>mutateSection(block.id,{heading:e.target.value})}/></label>
     </div>
     <label className="mt-3 block text-xs font-bold">Text content<textarea className={field+" min-h-28"} value={block.body} onChange={e=>mutateSection(block.id,{body:e.target.value})}/></label>
     {block.type==="video"&&<div className="mt-3 space-y-2">
       <label className="block text-xs font-bold">Choose a published gallery video
        <select className={field} value={block.image||""} onChange={e=>mutateSection(block.id,{image:e.target.value})}>
         <option value="">Select video</option>{videos.map(v=>{
          const url=supabase.storage.from("gallery-media").getPublicUrl(v.storage_path).data.publicUrl;
          return <option key={v.storage_path} value={url}>{v.title||v.storage_path}</option>;
         })}
        </select></label>
       <a href="/staff-gallery" target="_blank" rel="noopener noreferrer" className="inline-block text-xs font-bold text-orange-700 underline">Upload or publish a video in Media Gallery</a>
      </div>}
     {["hero","image","split"].includes(block.type)&&<div className="mt-3"><WebsiteImageUploader title="Section photo" value={block.image||""} kind="content" onChange={image=>mutateSection(block.id,{image})} disabled={disabled} onUploading={setCurrentUpload}/></div>}
     {block.type!=="quote"&&block.type!=="image"&&<div className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="text-xs font-bold">Button label (optional)<input className={field} value={block.button_label||""} onChange={e=>mutateSection(block.id,{button_label:e.target.value})}/></label>
      <label className="text-xs font-bold">Button URL /page or https://<input className={field} value={block.button_href||""} onChange={e=>mutateSection(block.id,{button_href:e.target.value})}/></label>
     </div>}
    </article>)}
   <div className="flex flex-wrap gap-2 rounded-xl border bg-white p-4">
     <button type="button" disabled={disabled||!changed} onClick={()=>void save()} className="rounded-xl bg-[var(--portal-ink)] px-4 py-3 text-xs font-black text-white disabled:opacity-40"><Save size={15} className="mr-1 inline"/>Save Draft</button>
     <button type="button" disabled={disabled} onClick={()=>setPreview(x=>!x)} className="rounded-xl border px-4 py-3 text-xs font-bold"><Eye size={15} className="mr-1 inline"/>Preview</button>
     <button type="button" disabled={disabled||changed||(!savedUnpublished&&current.is_published)} onClick={()=>void publish(true)} className="rounded-xl bg-orange-600 px-4 py-3 text-xs font-black text-white disabled:opacity-40"><UploadCloud size={15} className="mr-1 inline"/>Publish Live</button>
     {current.kind==="custom"&&current.is_published&&<button type="button" disabled={disabled||changed} onClick={()=>void publish(false)} className="rounded-xl border border-red-300 px-4 py-3 text-xs font-bold text-red-700">Unpublish Page</button>}
     {changed&&<p className="w-full text-xs text-orange-700">You have unsaved changes. Save the draft before publishing.</p>}
   </div>
   {preview&&<section className="overflow-hidden rounded-xl border-2 border-dashed"><p className="bg-orange-100 p-3 text-xs font-bold text-orange-800">PREVIEW · Your unpublished changes</p><CmsPageBody doc={draft} title={title} isStandalone={current.kind==="custom"||draft.mode==="replace"}/></section>}
   <div className="rounded-xl border bg-white p-4"><h3 className="font-black">Previous versions</h3><div className="mt-3 flex flex-wrap gap-2">{history.map(v=><button key={v.id} disabled={disabled} onClick={()=>void restore(v)} className="rounded-lg border px-3 py-2 text-xs font-bold"><Undo2 size={13} className="mr-1 inline"/>Version {v.version}</button>)}</div></div>
  </div>}
 </section>;
}

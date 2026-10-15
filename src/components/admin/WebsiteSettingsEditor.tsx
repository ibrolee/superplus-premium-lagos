import { useCallback,useEffect,useMemo,useState } from "react";
import { ArrowLeft, CheckCircle2, History, Plus, RefreshCw, Save, Trash2, UploadCloud } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { WebsiteImageUploader } from "@/components/admin/WebsiteImageUploader";
import type { BookingConfig, BusinessConfig, HomeConfig, SpaServiceEntry, WebsiteTextConfig } from "@/lib/website-settings";

type Entry={setting_key:string;draft:Record<string,any>;published:Record<string,any>;revision:number;published_revision:number;updated_at:string};
type Version={id:string;setting_key:string;version:number;published_at:string};
const sections=[
  {key:"spa_services",label:"Spa & recovery"},
  {key:"booking",label:"Booking rules"},
  {key:"homepage",label:"Homepage"},
  {key:"business",label:"Contact & hours"},
  {key:"website_content",label:"FAQs & gym rules"},
  {key:"membership_display",label:"Membership presentation"},
];
const input="mt-1.5 w-full rounded-xl border border-[var(--portal-border)] bg-white px-3 py-3 text-sm outline-none focus:border-[var(--portal-accent)]";
const label="block text-xs font-bold";
const title="mb-4 text-base font-black";
const isWebUrl=(value:string)=>!value||(/^https:\/\//.test(value)&&value.length<=800);
function ItemInput({label:heading,value,onChange,textarea=false,type="text"}:{label:string;value:string|number;onChange:(x:string)=>void;textarea?:boolean;type?:string}){
 return <label className={label}>{heading}{textarea?
  <textarea value={value} onChange={e=>onChange(e.target.value)} rows={3} className={input+" min-h-24"}/>:
  <input value={value} onChange={e=>onChange(e.target.value)} type={type} className={input}/>}</label>;
}

export function WebsiteSettingsEditor(){
 const [rows,setRows]=useState<Entry[]>([]);
 const [versions,setVersions]=useState<Version[]>([]);
 const [key,setKey]=useState("spa_services");
 const [draft,setDraft]=useState<Record<string,any>>({});
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState("");
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [preview,setPreview]=useState(false);
 const [reload,setReload]=useState(0);
 const load=useCallback(async()=>{
   setLoading(true);setError("");
   const [a,b]=await Promise.all([
     supabase.from("website_settings").select("setting_key,draft,published,revision,published_revision,updated_at").order("setting_key"),
     supabase.from("website_settings_history").select("id,setting_key,version,published_at").order("published_at",{ascending:false}).limit(75),
   ]);
   if(a.error||b.error)setError(a.error?.message||b.error?.message||"Settings unavailable.");
   else {setRows((a.data||[]) as Entry[]);setVersions((b.data||[]) as Version[]);}
   setLoading(false);
 },[]);
 useEffect(()=>{void load();},[load,reload]);
 const current=rows.find(x=>x.setting_key===key);
 useEffect(()=>{setDraft(current?.draft?structuredClone(current.draft):{});setPreview(false);},[current?.setting_key,current?.revision]);
 function patch(change:Record<string,any>){setDraft(x=>({...x,...change}));setNotice("");}
 function changeItem(index:number,change:Record<string,unknown>){
   setDraft(current=>({...current,items:(current.items||[]).map((item:SpaServiceEntry,i:number)=>i===index?{...item,...change}:item)}));
   setNotice("");
 }
 async function call(name:string,args:Record<string,unknown>,success:string){
   setBusy(name);setError("");setNotice("");
   const {error:err}=await supabase.rpc(name,args);
   if(err)setError(err.message);else{setNotice(success);setReload(x=>x+1);setPreview(false);}
   setBusy("");
 }
 const unchanged=JSON.stringify(draft)===JSON.stringify(current?.published);
 async function save(){
  if(!current||busy)return;
  if(key==="spa_services"&&(!Array.isArray(draft.items)||draft.items.some((x:SpaServiceEntry)=>!x.id||!x.name||Number(x.price)<100||!isWebUrl(x.image||"")))){
    setError("Check spa service names, prices (minimum ₦100) and HTTPS images.");return;}
  if(!window.confirm("Save your edited settings as a private draft? Customers will not see them until you publish."))return;
  await call("admin_website_save_draft",{p_key:key,p_value:draft,p_revision:current.revision},"Draft saved. Choose Preview or Publish when ready.");
 }
 async function publish(){
  if(!current||busy)return;
  if(!window.confirm("Publish the saved draft live? Customers will see this content and checkout will use any new spa prices or booking rules."))return;
  await call("admin_website_publish",{p_key:key,p_revision:current.revision},"Published successfully. Your live website now uses these settings.");
 }
 async function discard(){
  if(!current||busy||!window.confirm("Discard saved and unsaved draft changes? This restores the last published settings."))return;
  await call("admin_website_discard_draft",{p_key:key,p_revision:current.revision},"Draft discarded. Live settings unchanged.");
 }
 async function restore(h:Version){
  if(!current||busy)return;
  if(!window.confirm("Restore version "+h.version+" into a draft? Live settings stay unchanged until you publish."))return;
  await call("admin_website_restore",{p_history_id:h.id,p_revision:current.revision},"Old version loaded as a draft. Review, save changes if needed, then publish.");
 }
 const setStr=(field:string)=>(value:string)=>patch({[field]:value});
 const setNum=(field:string)=>(value:string)=>patch({[field]:Number(value)});
 const serviceItems=(draft.items||[]) as SpaServiceEntry[];
 const business=draft as BusinessConfig,booking=draft as BookingConfig,homepage=draft as HomeConfig,body=draft as WebsiteTextConfig;
 const dirtySaved=JSON.stringify(draft)!==JSON.stringify(current?.draft);
 const publishedVersions=versions.filter(x=>x.setting_key===key).slice(0,8);
 const displayValue=(text:string)=>text.length>250?text.slice(0,247)+"…":text;
 return <section className="mt-5 rounded-2xl border border-[var(--portal-border)] bg-white p-4 sm:p-6">
  <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">Editable website settings</h2>
    <p className="mt-1 text-sm text-[var(--portal-muted)]">Make edits, save a private draft, preview it and publish when ready. Restore previous published versions any time.</p></div>
    <button disabled={!!busy} onClick={()=>setReload(x=>x+1)} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold"><RefreshCw size={14}/>Refresh</button>
  </div>
  <div className="mt-4 flex flex-wrap gap-2" role="tablist">{sections.map(item=><button key={item.key} role="tab" aria-selected={key===item.key} type="button" disabled={!!busy}
   className={`rounded-xl px-3 py-2.5 text-xs font-black ${key===item.key?"bg-[var(--portal-ink)] text-white":"border"}`}
   onClick={()=>{setKey(item.key);setError("");setNotice("");}}>{item.label}</button>)}</div>
  {loading&&<p className="mt-4 text-sm">Loading settings…</p>}
  {error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-800">{error}</p>}
  {notice&&<p role="status" className="mt-4 rounded-xl bg-green-50 p-3 text-xs text-green-800">{notice}</p>}
  {current&&!loading&&<div className="mt-5">
   <p className="mb-3 text-xs text-[var(--portal-muted)]">Published version {current.published_revision} · Draft version {current.revision}</p>
   {key==="spa_services"&&<div>
      <p className="mb-4 text-xs leading-5 text-[var(--portal-muted)]">Edit name, price, duration, description and visibility. Hiding a service removes it from new bookings without deleting past purchases.</p>
      <div className="space-y-4">{serviceItems.map((item,index)=><div key={item.id} className="rounded-xl border p-4">
        <div className="flex flex-wrap justify-between gap-2"><h3 className={title}>{item.name||"New service"} <span className="ml-2 text-xs font-normal text-[var(--portal-muted)]">#{item.id}</span></h3>
          <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={item.active} onChange={e=>changeItem(index,{active:e.target.checked})}/>Visible / bookable</label>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
        <ItemInput label="Service name" value={item.name} onChange={name=>changeItem(index,{name})}/>
        <ItemInput label="Price in ₦" value={item.price||""} type="number" onChange={price=>changeItem(index,{price:Number(price)})}/>
        <label className={label}>Session duration<select className={input} value={item.duration_minutes} onChange={e=>changeItem(index,{duration_minutes:Number(e.target.value),duration:Number(e.target.value)>=60?`${Number(e.target.value)/60} hour(s)`:`${e.target.value} mins`})}>{[15,30,45,60,75,90,120,150,180,240].map(m=><option key={m} value={m}>{m} minutes</option>)}</select></label>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <ItemInput label="Description" value={item.description||""} textarea onChange={description=>changeItem(index,{description})}/>
        <WebsiteImageUploader
          title={`Photo for ${item.name||"spa service"}`}
          value={item.image||""}
          kind="spa-services"
          disabled={!!busy}
          onUploading={uploading=>setBusy(uploading?"image-upload":"")}
          onChange={image=>changeItem(index,{image})}
        />
        </div>
      </div>)}</div>
      <button type="button" onClick={()=>{
        const id="service-"+Math.random().toString(36).slice(2,10);
        patch({items:[...serviceItems,{id,name:"New spa service",description:"Describe the service",price:5000,duration_minutes:30,duration:"30 mins",active:false,image:""}]});
      }} className="mt-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-bold"><Plus size={15}/>Add new spa service (hidden until enabled)</button>
   </div>}
   {key==="booking"&&<div><p className="mb-4 text-xs text-[var(--portal-muted)]">Booking rules affect new spa requests. Sessions are still confirmed by reception.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {([["mon_sat_open","Monday–Saturday opening"],["mon_sat_close","Monday–Saturday closing"],["sun_open","Sunday opening"],["sun_close","Sunday closing"]] as const).map(([field,name])=>
          <label key={field} className={label}>{name}<input type="time" className={input} value={booking[field]||""} onChange={e=>patch({[field]:e.target.value})}/></label>)}
        {([["slot_minutes","Appointment intervals",[15,30,60]],["max_concurrent","Maximum bookings at one time",[1,2,3,4,5,6,7,8,9,10]],["lead_hours","Minimum advance hours",[0,1,2,3,4,6,12,24,48]],["advance_days","Days ahead",[7,14,30,60,90]]] as const).map(([field,name,choices])=>
          <label key={field} className={label}>{name}<select className={input} value={booking[field]} onChange={e=>patch({[field]:Number(e.target.value)})}>{choices.map(n=><option key={n} value={n}>{n}</option>)}</select></label>)}
      </div><p className="mt-4 text-xs text-[var(--portal-muted)]">Staff assignment remains under <a className="font-bold underline" href="/management-bookings">Member & Spa Bookings</a>. Customers do not choose their therapist.</p></div>}
   {key==="homepage"&&<div className="grid gap-4 sm:grid-cols-2">
     <ItemInput label="Hero headline" value={homepage.title||""} onChange={setStr("title")}/>
     <ItemInput label="Highlighted headline" value={homepage.highlight||""} onChange={setStr("highlight")}/>
     <div className="sm:col-span-2"><ItemInput label="Hero subtitle" value={homepage.subtitle||""} onChange={setStr("subtitle")} textarea/></div>
     <div className="sm:col-span-2">
       <WebsiteImageUploader
         title="Homepage hero photo"
         value={homepage.image||""}
         kind="homepage"
         disabled={!!busy}
         onUploading={uploading=>setBusy(uploading?"image-upload":"")}
         onChange={setStr("image")}
       />
       <p className="mt-2 text-xs text-[var(--portal-muted)]">Removing the uploaded hero photo restores the default homepage background after publishing.</p>
     </div>
     <div className="sm:col-span-2"><ItemInput label="Announcement banner text" value={homepage.announcement||""} onChange={setStr("announcement")} textarea/></div>
     <label className="flex items-center gap-3 text-xs font-bold"><input type="checkbox" checked={!!homepage.announcement_enabled} onChange={e=>patch({announcement_enabled:e.target.checked})}/>Show announcement bar on homepage</label>
   </div>}
   {key==="business"&&<div className="grid gap-3 sm:grid-cols-2">
      {([["phone","Telephone"],["email","Contact email"],["address","Full gym address"],["whatsapp","WhatsApp number (with country code)"],["mon_sat_hours","Mon–Sat public opening hours"],["sun_hours","Sunday public opening hours"],["instagram","Instagram URL"]] as const).map(([f,label])=>
       <ItemInput key={f} label={label} value={business[f]||""} onChange={setStr(f)}/>)}
      <p className="sm:col-span-2 text-xs text-[var(--portal-muted)]">These details appear on the homepage contact panel. Appointment availability is independently controlled in Booking rules.</p>
   </div>}
   {key==="website_content"&&<div>
      <h3 className={title}>Website frequently asked questions</h3>
      <div className="space-y-3">{(body.faq||[]).map((item,index)=><div key={index} className="rounded-xl border p-3">
      <div className="grid gap-2 sm:grid-cols-2"><ItemInput label="Question" value={item.question} onChange={question=>patch({faq:body.faq.map((x,i)=>i===index?{...x,question}:x)})}/>
      <ItemInput label="Answer" value={item.answer} textarea onChange={answer=>patch({faq:body.faq.map((x,i)=>i===index?{...x,answer}:x)})}/></div>
      <button className="mt-2 flex items-center gap-1 text-xs font-bold text-red-700" type="button" onClick={()=>patch({faq:body.faq.filter((_,i)=>i!==index)})}><Trash2 size={12}/>Remove FAQ</button>
      </div>)}</div>
      <button className="mt-3 flex gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold" type="button" onClick={()=>patch({faq:[...(body.faq||[]),{question:"New question?",answer:"Answer here."}]})}><Plus size={14}/>Add FAQ</button>
      <h3 className="mb-2 mt-6 text-base font-black">Gym rules</h3>
      <p className="mb-2 text-xs text-[var(--portal-muted)]">One gym rule per line. Empty lines are ignored.</p>
      <textarea className={input+" min-h-44"} value={(body.rules||[]).join("\n")} onChange={e=>patch({rules:e.target.value.split("\n").map(x=>x.trim()).filter(Boolean)})}/>
   </div>}
   {key==="membership_display"&&<div>
      <p className="rounded-xl bg-amber-50 p-4 text-xs text-amber-900">Registration fees currently require coordinated changes to multiple payment finalizers. For payment safety, the existing ₦7,000 individual / ₦20,000 family fees remain locked. Plan descriptions and benefits can be edited below and published without changing billing.</p>
      <div className="mt-5 space-y-4">{Object.entries((draft.plans||{}) as Record<string,{benefits?:string[];badge?:string}>).map(([plan,settings])=><div key={plan} className="rounded-xl border p-3"><h3 className="mb-2 text-sm font-black">{plan}</h3>
       <ItemInput label="Benefit bullets (one per line)" value={(settings.benefits||[]).join("\n")} textarea onChange={text=>patch({plans:{...draft.plans,[plan]:{...settings,benefits:text.split("\n").map(s=>s.trim()).filter(Boolean)}}})}/>
       <ItemInput label="Optional badge" value={settings.badge||""} onChange={badge=>patch({plans:{...draft.plans,[plan]:{...settings,badge}}})}/>
      </div>)}</div>
      <p className="mt-3 text-xs">To start editing a plan, select it from the list:</p>
      <select className={input} value="" onChange={e=>{const plan=e.target.value;if(plan)patch({plans:{...draft.plans,[plan]:{benefits:[],badge:""}}});}}>
       <option value="">Add plan description</option>
       {["Daily Plan","Weekly Plan","Monthly Plan","Quarterly","Semi-Annual","Yearly","Monthly VIP Silver","Monthly VIP Gold","Family Plan","Personal Training","Personal Training Only"].filter(x=>!draft.plans?.[x]).map(p=><option key={p} value={p}>{p}</option>)}
      </select>
   </div>}
   <div className="mt-6 flex flex-wrap gap-2 border-t pt-4">
      <button disabled={!!busy||!dirtySaved} onClick={()=>void save()} className="inline-flex items-center gap-2 rounded-xl bg-[var(--portal-ink)] px-4 py-3 text-xs font-black text-white disabled:opacity-40"><Save size={15}/>Save draft</button>
      <button disabled={!!busy} onClick={()=>setPreview(x=>!x)} className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-black"><CheckCircle2 size={15}/>{preview?"Hide preview":"Preview changes"}</button>
      <button disabled={!!busy||dirtySaved||unchanged} onClick={()=>void publish()} className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-3 text-xs font-black text-white disabled:opacity-40"><UploadCloud size={15}/>Publish live</button>
   </div>
         <button disabled={!!busy||(!dirtySaved&&unchanged)} onClick={()=>void discard()} className="inline-flex items-center gap-2 rounded-xl border border-red-300 px-4 py-3 text-xs font-black text-red-700 disabled:opacity-40"><Trash2 size={15}/>Discard draft</button>
     {dirtySaved&&<p className="mt-2 text-xs font-semibold text-orange-700">Unsaved edits — save your draft first to enable publishing.</p>}
   {preview&&<div className="mt-4 rounded-xl border border-dashed bg-[var(--portal-canvas)] p-4">
     <p className="text-xs font-bold uppercase tracking-wider text-[var(--portal-muted)]">Private draft preview — not live</p>
     {key==="homepage"?<><h2 className="mt-4 text-3xl font-black">{homepage.title} <span className="text-orange-600">{homepage.highlight}</span></h2><p className="mt-3 text-sm">{homepage.subtitle}</p>{homepage.image&&<img src={homepage.image} className="mt-3 max-h-48 rounded-xl object-cover" alt="New hero preview"/>}{homepage.announcement_enabled&&<p className="mt-2 rounded-xl bg-orange-100 p-2 text-xs">{homepage.announcement}</p>}</>:
     key==="spa_services"?<div className="mt-3 grid gap-2 sm:grid-cols-2">{serviceItems.filter(item=>item.active).map(s=><div key={s.id} className="rounded-xl bg-white p-3">{s.image&&<img src={s.image} alt={s.name} className="mb-2 h-28 w-full rounded-lg object-cover"/>}<strong>{s.name}</strong><p className="text-xs">{s.description}</p><p className="mt-2 text-sm font-bold">₦{Number(s.price).toLocaleString("en-NG")} · {s.duration_minutes} min</p></div>)}</div>:
     <pre className="mt-2 whitespace-pre-wrap break-words text-xs">{displayValue(JSON.stringify(draft,null,2))}</pre>}
   </div>}
   <div className="mt-6 border-t pt-4">
      <h3 className="flex items-center gap-2 text-sm font-black"><History size={16}/>Restore a previously published version</h3>
      <div className="mt-3 flex flex-wrap gap-2">{publishedVersions.map(h=><button key={h.id} disabled={!!busy} onClick={()=>void restore(h)}
       className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold">Version {h.version} · {new Date(h.published_at).toLocaleDateString("en-NG")} <ArrowLeft size={13}/></button>)}</div>
   </div>
  </div>}
 </section>;
}

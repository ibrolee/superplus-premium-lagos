import {useCallback,useEffect,useState} from "react";
import {ArrowUpRight,CalendarDays,Inbox,RefreshCw,Save,ShieldCheck,Ticket,Trash2} from "lucide-react";
import {supabase} from "@/lib/supabase";
import {WebsiteImageUploader} from "@/components/admin/WebsiteImageUploader";
export type SiteScope={pages:boolean;design:boolean;campaigns:boolean;enquiries:boolean;admin:boolean};
type Enquiry={id:string;kind:string;full_name:string;email:string;phone:string;organization:string;message:string;status:string;assigned_staff:string|null;internal_note:string;received_at:string};
type Campaign={id:string;kind:"event"|"promotion";title:string;description:string;image_url:string;button_label:string;button_url:string;starts_at:string;ends_at:string;published:boolean};
type Staff={auth_user_id:string;role:string;full_name:string|null;active:boolean};
type Permission={auth_user_id:string;can_pages:boolean;can_design:boolean;can_campaigns:boolean;can_enquiries:boolean};
const emptyCampaign=():Campaign=>({id:"",kind:"event",title:"",description:"",image_url:"",button_label:"",button_url:"",starts_at:"",ends_at:"",published:false});
const field="mt-1.5 w-full rounded-xl border bg-white px-3 py-2.5 text-sm";
const button="rounded-xl border bg-white px-4 py-2.5 text-xs font-bold";
const statusNames=["new","contacted","in_progress","resolved","spam"];
function localDate(value:string){return value?new Date(value).toLocaleString("en-NG",{dateStyle:"medium",timeStyle:"short",timeZone:"Africa/Lagos"}):"";}
function localInput(value:string){if(!value)return "";const date=new Date(value);if(isNaN(date.getTime()))return "";return new Date(date.getTime()+3600000).toISOString().slice(0,16);}
function toLagosIso(value:string){return value?new Date(value+":00+01:00").toISOString():"";}
export function WebsiteStage2({permissions}:{permissions:SiteScope}){
 const [section,setSection]=useState<"inbox"|"campaigns"|"permissions">(permissions.enquiries?"inbox":"campaigns");
 const [enquiries,setEnquiries]=useState<Enquiry[]>([]);
 const [campaigns,setCampaigns]=useState<Campaign[]>([]);
 const [staff,setStaff]=useState<Staff[]>([]);
 const [grants,setGrants]=useState<Permission[]>([]);
 const [selectedEnquiry,setSelectedEnquiry]=useState<string|null>(null);
 const [enquiryForm,setEnquiryForm]=useState<{status:string;assigned_staff:string;internal_note:string}>({status:"new",assigned_staff:"",internal_note:""});
 const [selectedCampaign,setSelectedCampaign]=useState<string|null>(null);
 const [campaignForm,setCampaignForm]=useState<Campaign>(emptyCampaign);
 const [permissionsForm,setPermissionsForm]=useState<Record<string,Permission>>({});
 const [statusFilter,setStatusFilter]=useState("all");
 const [busy,setBusy]=useState("");
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [revision,setRevision]=useState(0);
 const [uploading,setUploading]=useState(false);
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  const requests:PromiseLike<any>[]=[];
  if(permissions.enquiries)requests.push(supabase.from("wc_enquiries").select("id,kind,full_name,email,phone,organization,message,status,assigned_staff,internal_note,received_at").order("received_at",{ascending:false}).limit(250));
  if(permissions.campaigns)requests.push(supabase.from("wc_campaigns").select("id,kind,title,description,image_url,button_label,button_url,starts_at,ends_at,published").order("starts_at",{ascending:false}).limit(150));
  if(permissions.admin)requests.push(supabase.from("wc_editor_permissions").select("auth_user_id,can_pages,can_design,can_campaigns,can_enquiries"));
  requests.push(supabase.from("staff_users").select("auth_user_id,role,full_name,active").eq("active",true).order("full_name"));
  const responses=await Promise.all(requests);
  let i=0;
  for(const kind of [permissions.enquiries?"enquiries":"",permissions.campaigns?"campaigns":"",permissions.admin?"grants":"", "staff"].filter(Boolean)){
   const item=responses[i++];
   if(item.error){setError(item.error.message);continue;}
   if(kind==="enquiries")setEnquiries(item.data||[]);
   if(kind==="campaigns")setCampaigns(item.data||[]);
   if(kind==="grants"){
    const list=(item.data||[]) as Permission[];setGrants(list);
    setPermissionsForm(Object.fromEntries(list.map(x=>[x.auth_user_id,x])));
   }
   if(kind==="staff")setStaff(item.data||[]);
  }setLoading(false);
 },[permissions.enquiries,permissions.campaigns,permissions.admin]);
 useEffect(()=>{void load();},[load,revision]);
 const chosen=enquiries.find(x=>x.id===selectedEnquiry);
 const campaign=campaigns.find(x=>x.id===selectedCampaign);
 function chooseEnquiry(item:Enquiry){setSelectedEnquiry(item.id);setEnquiryForm({status:item.status,assigned_staff:item.assigned_staff||"",internal_note:item.internal_note||""});setError("");}
 function chooseCampaign(item?:Campaign){setSelectedCampaign(item?.id||"new");setCampaignForm(item?{...item}:emptyCampaign());setError("");}
 async function saveEnquiry(){
  if(!chosen||busy)return;setBusy("inbox");setError("");setNotice("");
  const {error:e}=await supabase.rpc("wc_admin_update_enquiry",{p_id:chosen.id,p_status:enquiryForm.status,p_assigned_staff:enquiryForm.assigned_staff||null,p_note:enquiryForm.internal_note});
  if(e)setError(e.message);else{setNotice("Enquiry updated.");setRevision(x=>x+1);}
  setBusy("");
 }
 async function saveCampaign(forceUnpublish=false){
  if(busy||uploading)return;
  if(!campaignForm.title.trim()||!campaignForm.starts_at||!campaignForm.ends_at){setError("Add the title and start/end dates.");return;}
  if(!window.confirm(forceUnpublish?"Stop showing this event or promotion?":"Save this event or promotion? Published items are shown only within their scheduled dates."))return;
  setBusy("campaign");setError("");setNotice("");
  const {error:e}=await supabase.rpc("wc_admin_save_campaign",{
   p_id:campaignForm.id||null,p_kind:campaignForm.kind,p_title:campaignForm.title.trim(),
   p_description:campaignForm.description.trim(),p_image_url:campaignForm.image_url||"",
   p_button_label:campaignForm.button_label.trim(),p_button_url:campaignForm.button_url.trim(),
   p_starts_at:toLagosIso(localInput(campaignForm.starts_at)||campaignForm.starts_at),
   p_ends_at:toLagosIso(localInput(campaignForm.ends_at)||campaignForm.ends_at),
   p_published:forceUnpublish?false:campaignForm.published,
  });
  if(e)setError(e.message);else{setNotice("Event or promotion saved.");setSelectedCampaign(null);setRevision(x=>x+1);}
  setBusy("");
 }
 async function savePermission(staffUser:Staff){
  if(busy)return;const p=permissionsForm[staffUser.auth_user_id]||{auth_user_id:staffUser.auth_user_id,can_pages:false,can_design:false,can_campaigns:false,can_enquiries:false};
  if(!window.confirm("Update website management permissions for "+(staffUser.full_name||"this manager")+"? These do not grant financial or payroll access."))return;
  setBusy(staffUser.auth_user_id);setError("");setNotice("");
  const {error:e}=await supabase.rpc("wc_admin_set_editor_permissions",{p_staff_id:staffUser.auth_user_id,
   p_pages:p.can_pages,p_design:p.can_design,p_campaigns:p.can_campaigns,p_enquiries:p.can_enquiries});
  if(e)setError(e.message);else{setNotice("Website permissions updated.");setRevision(x=>x+1);}
  setBusy("");
 }
 const disable=!!busy||uploading;
 return <section className="mt-5 space-y-4">
  <div><h2 className="text-xl font-black">Business & marketing controls</h2>
   <p className="mt-2 text-sm text-[var(--portal-muted)]">Handle website enquiries, schedule promotions and events, and grant restricted content-management permissions.</p></div>
  <div className="flex flex-wrap gap-2">
   {permissions.enquiries&&<button className={button} onClick={()=>setSection("inbox")} style={section==="inbox"?{background:"#202020",color:"white"}:{}}><Inbox size={15} className="mr-2 inline"/>Enquiries ({enquiries.filter(x=>x.status==="new").length} new)</button>}
   {permissions.campaigns&&<button className={button} onClick={()=>setSection("campaigns")} style={section==="campaigns"?{background:"#202020",color:"white"}:{}}><CalendarDays size={15} className="mr-2 inline"/>Events & promotions</button>}
   {permissions.admin&&<button className={button} onClick={()=>setSection("permissions")} style={section==="permissions"?{background:"#202020",color:"white"}:{}}><ShieldCheck size={15} className="mr-2 inline"/>Staff permissions</button>}
   <button className={button} disabled={disable} onClick={()=>setRevision(x=>x+1)}><RefreshCw size={15} className="inline"/> Refresh</button>
  </div>
  {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
  {notice&&<p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
  {loading&&<p className="text-xs text-[var(--portal-muted)]">Loading management tools…</p>}
  {!loading&&section==="inbox"&&permissions.enquiries&&<div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
   <div className="rounded-xl border bg-white p-4">
    <div className="flex items-center justify-between gap-2"><h3 className="font-black">Messages ({enquiries.length})</h3>
     <select className={field} value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">All statuses</option>{statusNames.map(s=><option key={s} value={s}>{s.replace("_"," ")}</option>)}</select>
    </div>
    <div className="mt-3 max-h-[620px] space-y-2 overflow-y-auto">{enquiries.filter(x=>statusFilter==="all"||x.status===statusFilter).map(item=>
     <button key={item.id} type="button" className={`w-full rounded-xl border p-3 text-left ${item.id===selectedEnquiry?"border-orange-400 bg-orange-50":""}`} onClick={()=>chooseEnquiry(item)}>
      <div className="flex justify-between gap-2"><strong className="text-sm">{item.full_name}</strong><span className="text-[10px] uppercase">{item.status.replace("_"," ")}</span></div>
      <p className="mt-1 text-xs text-[var(--portal-muted)]">{item.kind.toUpperCase()} · {localDate(item.received_at)}</p>
      <p className="mt-2 line-clamp-2 text-xs">{item.message}</p>
     </button>)}</div>
    {enquiries.length===0&&<p className="mt-4 text-xs text-[var(--portal-muted)]">No enquiries received yet.</p>}
   </div>
   <div className="rounded-xl border bg-white p-4">
    {chosen?<><h3 className="font-black">{chosen.full_name}</h3>
     <p className="mt-2 text-sm"><a className="text-orange-700 underline" href={"mailto:"+chosen.email}>{chosen.email}</a> · <a className="text-orange-700 underline" href={"tel:"+chosen.phone}>{chosen.phone||"No phone"}</a></p>
     {chosen.organization&&<p className="mt-2 text-sm">Organization: {chosen.organization}</p>}
     <p className="mt-4 whitespace-pre-wrap rounded-lg bg-[var(--portal-canvas)] p-4 text-sm leading-6">{chosen.message}</p>
     <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="text-xs font-bold">Status<select value={enquiryForm.status} onChange={e=>setEnquiryForm(p=>({...p,status:e.target.value}))} className={field}>{statusNames.map(s=><option key={s} value={s}>{s.replace("_"," ")}</option>)}</select></label>
      <label className="text-xs font-bold">Assign staff<select value={enquiryForm.assigned_staff} onChange={e=>setEnquiryForm(p=>({...p,assigned_staff:e.target.value}))} className={field}><option value="">Unassigned</option>{staff.map(u=><option key={u.auth_user_id} value={u.auth_user_id}>{u.full_name||u.role}</option>)}</select></label>
     </div>
     <label className="mt-3 block text-xs font-bold">Private management notes<textarea rows={5} className={field} value={enquiryForm.internal_note} onChange={e=>setEnquiryForm(p=>({...p,internal_note:e.target.value}))}/></label>
     <button disabled={disable} onClick={()=>void saveEnquiry()} className="mt-3 rounded-xl bg-[var(--portal-ink)] px-4 py-3 text-xs font-black text-white disabled:opacity-50"><Save size={14} className="mr-1 inline"/>Save enquiry</button>
     <p className="mt-3 text-xs text-[var(--portal-muted)]">Staff assignment is for management tracking; the assigned employee must still be contacted separately.</p>
    </>:<p className="text-sm text-[var(--portal-muted)]">Select a message to review and manage it.</p>}
   </div>
  </div>}
  {!loading&&section==="campaigns"&&permissions.campaigns&&<div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
   <div className="rounded-xl border bg-white p-4"><div className="flex justify-between gap-2"><h3 className="font-black">Scheduled content ({campaigns.length})</h3>
    <button type="button" className={button} onClick={()=>chooseCampaign()}><Ticket size={14} className="mr-1 inline"/>New</button></div>
    <div className="mt-3 space-y-2">{campaigns.map(item=><button key={item.id} onClick={()=>chooseCampaign(item)} className="w-full rounded-xl border p-3 text-left">
     <p className="text-sm font-bold">{item.title}</p><p className="mt-1 text-xs text-[var(--portal-muted)]">{item.kind} · {item.published?"Published":"Draft"} · {localDate(item.starts_at)} – {localDate(item.ends_at)}</p>
    </button>)}</div>{!campaigns.length&&<p className="mt-3 text-xs">No events or promotions created.</p>}
   </div>
   <div className="rounded-xl border bg-white p-4">
    {selectedCampaign!==null?<><h3 className="font-black">{campaignForm.id?"Edit":"Create"} event or promotion</h3>
     <label className="mt-3 block text-xs font-bold">Type<select value={campaignForm.kind} onChange={e=>setCampaignForm(p=>({...p,kind:e.target.value as Campaign["kind"]}))} className={field}><option value="event">Event</option><option value="promotion">Promotion</option></select></label>
     <label className="mt-3 block text-xs font-bold">Title<input className={field} maxLength={120} value={campaignForm.title} onChange={e=>setCampaignForm(p=>({...p,title:e.target.value}))}/></label>
     <label className="mt-3 block text-xs font-bold">Description<textarea rows={4} className={field} value={campaignForm.description} onChange={e=>setCampaignForm(p=>({...p,description:e.target.value}))}/></label>
     <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="text-xs font-bold">Starts (Lagos time)<input type="datetime-local" className={field} value={localInput(campaignForm.starts_at)} onChange={e=>setCampaignForm(p=>({...p,starts_at:toLagosIso(e.target.value)}))}/></label>
      <label className="text-xs font-bold">Ends (Lagos time)<input type="datetime-local" className={field} value={localInput(campaignForm.ends_at)} onChange={e=>setCampaignForm(p=>({...p,ends_at:toLagosIso(e.target.value)}))}/></label>
     </div>
     <div className="mt-3"><WebsiteImageUploader title="Event or promotion artwork" kind="content" value={campaignForm.image_url} onChange={image_url=>setCampaignForm(p=>({...p,image_url}))} disabled={disable} onUploading={setUploading}/></div>
     <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="text-xs font-bold">Button label<input className={field} maxLength={60} value={campaignForm.button_label} onChange={e=>setCampaignForm(p=>({...p,button_label:e.target.value}))}/></label>
      <label className="text-xs font-bold">Button link<input className={field} value={campaignForm.button_url} onChange={e=>setCampaignForm(p=>({...p,button_url:e.target.value}))} placeholder="/membership"/></label>
     </div>
     <label className="mt-3 flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={campaignForm.published} onChange={e=>setCampaignForm(p=>({...p,published:e.target.checked}))}/>Publish automatically during the date window</label>
     <button disabled={disable} onClick={()=>void saveCampaign()} className="mt-4 rounded-xl bg-[var(--portal-ink)] px-4 py-3 text-xs font-black text-white disabled:opacity-50"><Save size={14} className="mr-1 inline"/>Save campaign</button>
     {campaignForm.id&&campaignForm.published&&<button disabled={disable} className="ml-2 mt-3 rounded-xl border border-red-200 px-3 py-3 text-xs font-bold text-red-700" onClick={()=>void saveCampaign(true)}><Trash2 size={13} className="mr-1 inline"/>Unpublish</button>}
    </>:<p className="text-sm text-[var(--portal-muted)]">Choose a campaign or select New. Published campaigns show automatically during their start/end window. This does not alter checkout prices.</p>}
   </div>
  </div>}
  {!loading&&section==="permissions"&&permissions.admin&&<div className="rounded-xl border bg-white p-4">
   <h3 className="font-black">Delegated website access</h3><p className="mt-2 text-xs leading-6 text-[var(--portal-muted)]">Only active reception accounts can receive delegated content permissions. No access to membership prices, coupons, payroll or member payments is granted.</p>
   <div className="mt-4 space-y-3">{staff.filter(u=>u.role==="reception").map(user=>{
    const p=permissionsForm[user.auth_user_id]||{auth_user_id:user.auth_user_id,can_pages:false,can_design:false,can_campaigns:false,can_enquiries:false};
    return <div key={user.auth_user_id} className="rounded-xl border p-4"><h4 className="font-bold">{user.full_name||"Manager"}</h4>
     <div className="mt-3 flex flex-wrap gap-3">{([["can_pages","Pages"],["can_design","Design & media"],["can_campaigns","Events & promotions"],["can_enquiries","Enquiries"]] as const).map(([prop,label])=>
     <label key={prop} className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={p[prop]} onChange={e=>setPermissionsForm(prev=>({...prev,[user.auth_user_id]:{...p,[prop]:e.target.checked}}))}/>{label}</label>)}</div>
     <button disabled={disable} className="mt-3 rounded-lg bg-[var(--portal-ink)] px-4 py-2.5 text-xs font-bold text-white" onClick={()=>void savePermission(user)}>Save permissions</button>
    </div>
   })}</div>{!staff.some(x=>x.role==="reception")&&<p className="mt-4 text-xs">No active reception accounts are currently eligible. Owners and admins already have full website access.</p>}
  </div>}
 </section>;
}

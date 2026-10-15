import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowUpRight, CheckCircle2, Clock3, CreditCard, FileClock, Gift, Images, Megaphone, Pencil, RefreshCw, Settings2, ShieldCheck, Ticket, Trash2, Wallet } from "lucide-react";
import { AdminWorkspaceShell } from "@/components/admin/AdminWorkspaceShell";
import { WebsiteSettingsEditor } from "@/components/admin/WebsiteSettingsEditor";
import { CmsPageAdmin } from "@/components/admin/CmsPageAdmin";
import { CmsConfigAdmin } from "@/components/admin/CmsConfigAdmin";
import {WebsiteStage2,type SiteScope} from "@/components/admin/WebsiteStage2";
import {BulkPricing} from "@/components/admin/BulkPricing";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/management-website-controls")({ component: WebsiteControls });
type Plan = { id: string; name: string; price: number; duration_days: number; active: boolean };
type Coupon = { code: string; description: string; active: boolean; discount_type: string; starts_on: string | null; expires_on: string | null; updated_at: string };
type Audit = { id: string; changed_at: string; changed_by: string | null; kind: string; record_key: string; previous_value: Record<string,unknown>|null; next_value: Record<string,unknown>|null };
const money = (amount:number) => new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN",maximumFractionDigits:2}).format(amount);
const input = "mt-1.5 w-full rounded-xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm text-[var(--portal-ink)] outline-none focus:border-[var(--portal-accent)] disabled:opacity-50";
const tools = [
 { name:"Website announcements", description:"Create, schedule and remove messages, banners and notices.", href:"/admin-announcements", icon: Megaphone },
 { name:"Blog posts", description:"Create, edit, publish or remove fitness articles.", href:"/staff-blog", icon: Pencil },
 { name:"Media gallery", description:"Add, replace or remove website photos and media.", href:"/staff-gallery", icon: Images },
 { name:"Member and spa bookings", description:"Assign spa staff and manage completed services.", href:"/management-bookings", icon: CreditCard },
 { name:"App rewards & challenges", description:"Manage member points, reward options and app campaigns.", href:"/admin-engagement", icon: Gift },
 { name:"Staff & payroll", description:"Update staff settings, salaries and spa/PT payouts.", href:"/management-salary-payments", icon: Wallet },
 { name:"Operating expenses", description:"Track costs, payroll and monthly profit.", href:"/management-expenses", icon: FileClock },
];

function WebsiteControls(){
 const [verified,setVerified]=useState(false);
 const [scope,setScope]=useState<SiteScope>({pages:false,design:false,campaigns:false,enquiries:false,admin:false});
 const [loading,setLoading]=useState(true);
 const [reload,setReload]=useState(0);
 const [plans,setPlans]=useState<Plan[]>([]);
 const [coupons,setCoupons]=useState<Coupon[]>([]);
 const [audit,setAudit]=useState<Audit[]>([]);
 const [editingPrice,setEditingPrice]=useState<string|null>(null);
 const [priceDraft,setPriceDraft]=useState("");
 const [couponCode,setCouponCode]=useState("");
 const [couponDescription,setCouponDescription]=useState("");
 const [couponExpiry,setCouponExpiry]=useState("");
 const [couponStart,setCouponStart]=useState("");
 const [busy,setBusy]=useState("");
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [tab,setTab]=useState<"prices"|"coupons"|"site"|"pages"|"design"|"stage2"|"content"|"history">("pages");
 const load=useCallback(async()=>{
   setLoading(true);setError("");
   try{
     const { data:auth,error:authError }=await supabase.auth.getUser();
     if(authError||!auth.user)throw Error("Sign in to your admin account.");
     const {data:user,error:userError}=await supabase.from("staff_users").select("role,active").eq("auth_user_id",auth.user.id).maybeSingle();
     if(userError||!user?.active||!["admin","owner","manager"].includes(user.role))throw Error("An active management account is required.");
     const {data:permissions,error:permissionError}=await supabase.rpc("wc_staff_site_permissions");
     if(permissionError)throw permissionError;
     const permitted=permissions as SiteScope;
     if(!Object.values(permitted).some(Boolean))throw Error("Your account has not been granted Website Content permissions.");
     setScope(permitted);
     if(!permitted.admin){setPlans([]);setCoupons([]);setAudit([]);setVerified(true);setTab(permitted.pages?"pages":permitted.design?"design":"stage2");return;}
     const [p,c,h]=await Promise.all([
       supabase.from("membership_plans").select("id,name,price,duration_days,active").order("price"),
       supabase.from("website_coupons").select("code,description,active,discount_type,starts_on,expires_on,updated_at").order("code"),
       supabase.from("website_control_audit").select("id,changed_at,changed_by,kind,record_key,previous_value,next_value").order("changed_at",{ascending:false}).limit(40),
     ]);
     if(p.error)throw p.error;if(c.error)throw c.error;if(h.error)throw h.error;
     setPlans((p.data||[]) as Plan[]);setCoupons((c.data||[]) as Coupon[]);setAudit((h.data||[]) as Audit[]);
     setVerified(true);
   }catch(cause){setVerified(false);setError(cause instanceof Error?cause.message:"Unable to load website controls.");}
   finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load();},[load,reload]);
 const editable=useMemo(()=>plans.filter(p=>p.name!=="Custom Plan"&&Number(p.price)>0),[plans]);
 async function savePrice(plan:Plan,event:FormEvent<HTMLFormElement>){
   event.preventDefault();if(busy||!verified)return;
   const price=Number(priceDraft);
   if(!/^\d+(\.\d{1,2})?$/.test(priceDraft)||price<100||price>100000000){
     setError("Enter a price from ₦100 to ₦100,000,000 with no more than two decimal places.");return;
   }
   if(price===Number(plan.price)){setEditingPrice(null);return;}
   if(!window.confirm(`Update ${plan.name} price from ${money(Number(plan.price))} to ${money(price)}? New prices apply to the public website, reception and new Paystack checkouts. Existing paid memberships and completed payments are unchanged.`))return;
   setBusy(plan.id);setError("");setNotice("");
   const {error:saveError}=await supabase.rpc("admin_site_update_plan_price",{p_plan_id:plan.id,p_price:price});
   if(saveError)setError(saveError.message);else{
     setNotice(`${plan.name} updated to ${money(price)}. Live prices are refreshed on new visits and checkouts.`);
     setEditingPrice(null);setReload(v=>v+1);
   }
   setBusy("");
 }
 async function changePlanActive(plan:Plan){
   if(busy||!verified)return;
   const active=!plan.active;
   if(!window.confirm(`${active?"Show":"Hide"} ${plan.name} on the website and for new registrations? Existing memberships remain active and unchanged.`))return;
   setBusy(plan.id);setError("");setNotice("");
   const {error:saveError}=await supabase.rpc("admin_site_set_plan_active",{p_plan_id:plan.id,p_active:active});
   if(saveError)setError(saveError.message);
   else{setNotice(`${plan.name} is now ${active?"available":"hidden"} for new sign-ups.`);setReload(v=>v+1);}
   setBusy("");
 }
 async function saveCoupon(event:FormEvent<HTMLFormElement>){
   event.preventDefault();if(busy||!verified)return;
   const code=couponCode.trim().toUpperCase();
   if(!/^[A-Z0-9_-]{3,24}$/.test(code)){setError("Coupon must be 3–24 letters, numbers, hyphens or underscores.");return;}
   if(!window.confirm(`Save coupon ${code}? This coupon waives the one-time registration fee on eligible new sign-ups. It does not discount membership prices.`))return;
   setBusy("coupon");setError("");setNotice("");
   const {error:saveError}=await supabase.rpc("admin_site_save_coupon",{
     p_code:code,p_description:couponDescription.trim(),p_active:true,p_expires_on:couponExpiry||null,
   });
   if(saveError)setError(saveError.message);else{
     const {error:dateError}=await supabase.rpc("admin_site_schedule_coupon",{p_code:code,p_starts_on:couponStart||null});
     if(dateError)setError("Coupon saved, but its start date was not updated: "+dateError.message);
     else{setNotice(`Registration coupon ${code} saved.`);setCouponCode("");setCouponDescription("");setCouponExpiry("");setCouponStart("");setReload(v=>v+1);}
   }
   setBusy("");
 }
 async function changeCoupon(item:Coupon,enabled:boolean){
   if(busy)return;
   if(!window.confirm(`${enabled?"Activate":"Disable"} ${item.code}? ${enabled?"The code can be used for new eligible registrations.":"New customers cannot use it, but historic payments and already initiated checkouts are preserved."}`))return;
   setBusy(item.code);setError("");setNotice("");
   const {error:saveError}=await supabase.rpc("admin_site_save_coupon",{
     p_code:item.code,p_description:item.description,p_active:enabled,p_expires_on:item.expires_on,
   });
   if(saveError)setError(saveError.message);else{
     setNotice(`${item.code} ${enabled?"activated":"disabled"}.`);setReload(v=>v+1);
   }
   setBusy("");
 }
 const disabled=loading||!!busy||!verified;
 return <AdminWorkspaceShell title="Website Control Centre" subtitle="Manage page designs, photos, menus, prices, brand identity and business settings without editing code." active="/management-website-controls">
   <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
     <div><p className="text-xs font-black uppercase tracking-[.16em] text-[var(--portal-muted)]">{scope.admin?"Admin & owner controls":"Delegated website editor"}</p>
       <h1 className="mt-1 text-2xl font-black">Your website, your controls</h1>
       <p className="mt-2 text-sm leading-6 text-[var(--portal-muted)]">Update commercial settings safely. Financial updates are logged and do not rewrite historic payment records.</p></div>
     <button onClick={()=>setReload(v=>v+1)} disabled={disabled} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-3 text-xs font-black disabled:opacity-50"><RefreshCw size={16}/>Refresh</button>
   </div>
   <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Website control sections">
     {([["pages","Page builder",Pencil],["design","Design & media",Images],["stage2","Business & marketing",Megaphone],["prices","Membership prices",CreditCard],["coupons","Coupons",Ticket],["site","Business settings",Settings2],["content","Content & tools",Settings2],["history","Change history",Clock3]] as const)
       .filter(([id])=>id==="pages"?scope.pages:id==="design"?scope.design:id==="stage2"?(scope.campaigns||scope.enquiries||scope.admin):scope.admin)
       .map(([id,label,Icon])=><button key={id} type="button" role="tab" aria-selected={tab===id} onClick={()=>setTab(id)}
         className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-black ${tab===id?"bg-[var(--portal-ink)] text-white":"border border-[var(--portal-border)] bg-white"}`}>
         <Icon size={15}/>{label}</button>)}
   </div>
   {error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
   {notice&&<p role="status" className="mt-4 rounded-xl bg-green-50 p-4 text-sm text-green-800">{notice}</p>}
   {loading&&<p className="mt-5 text-sm">Loading live website settings…</p>}
   {verified&&scope.admin&&tab==="prices"&&<section className="mt-5 rounded-2xl border bg-white p-4 sm:p-6">
     <h2 className="text-xl font-black">Membership plan prices</h2>
     <p className="mt-2 text-sm leading-6 text-[var(--portal-muted)]">Prices come from the same official plan list used by reception and new online checkout. Change the price, not a member's active plan or payment history. Registration fees remain governed separately.</p>
     <div className="mt-5 grid gap-3 sm:grid-cols-2">
       {editable.map(plan=><article key={plan.id} className="rounded-xl border border-[var(--portal-border)] bg-[var(--portal-canvas)] p-4">
         <div className="flex items-start justify-between gap-2"><div><h3 className="font-black">{plan.name}</h3>
           <p className="mt-1 text-xs text-[var(--portal-muted)]">{plan.duration_days} days · {plan.active?"Active":"Not offered"}</p></div>
           <strong className="text-lg">{money(Number(plan.price))}</strong></div>
         {editingPrice===plan.id?<form className="mt-4" onSubmit={event=>void savePrice(plan,event)}>
           <label className="text-xs font-bold">New official price (₦)<input required type="number" min="100" max="100000000" step="0.01" value={priceDraft} disabled={disabled} onChange={e=>setPriceDraft(e.target.value)} className={input}/></label>
           <div className="mt-3 flex flex-wrap gap-2">
             <button disabled={disabled} className="rounded-xl bg-[var(--portal-ink)] px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">Save new price</button>
             <button type="button" onClick={()=>setEditingPrice(null)} className="rounded-xl border px-4 py-2.5 text-xs font-bold">Cancel</button>
           </div></form>:
           <button onClick={()=>{setEditingPrice(plan.id);setPriceDraft(String(plan.price));setError("");}} disabled={disabled}
             className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[var(--portal-border)] bg-white px-4 py-2.5 text-xs font-bold disabled:opacity-50">
             <Pencil size={14}/>Change price</button>}
           <button type="button" disabled={disabled} onClick={()=>void changePlanActive(plan)}
              className={`ml-2 mt-4 rounded-xl border px-3 py-2.5 text-xs font-bold disabled:opacity-50 ${plan.active?"border-red-200 text-red-700":"border-green-200 text-green-700"}`}>
              {plan.active?"Hide plan":"Show plan"}
           </button>
       </article>)}
     </div>
     <BulkPricing plans={editable} onSaved={()=>setReload(v=>v+1)}/>
     <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900"><ShieldCheck size={15} className="mr-1 inline"/>Plan names, durations and deleting plans are restricted here to protect existing member records. Contact developers only for new plan types or changes to how checkout works.</p>
   </section>}
   {verified&&scope.admin&&tab==="coupons"&&<section className="mt-5 rounded-2xl border bg-white p-4 sm:p-6">
     <h2 className="text-xl font-black">Registration coupons</h2>
     <p className="mt-2 text-sm leading-6 text-[var(--portal-muted)]">Create unlimited unique registration-fee waiver codes, set expiry dates and disable old codes. Disabled codes stay in history instead of being permanently deleted. This does not discount an existing member's renewal or membership price.</p>
     <form onSubmit={event=>void saveCoupon(event)} className="mt-5 rounded-2xl bg-[var(--portal-canvas)] p-4">
       <h3 className="font-black">Add or update coupon</h3>
       <div className="mt-3 grid gap-3 sm:grid-cols-3">
         <label className="text-xs font-bold">Code<input required maxLength={24} value={couponCode} disabled={disabled} onChange={e=>setCouponCode(e.target.value.toUpperCase())} placeholder="WELCOME26" className={input}/></label>
         <label className="text-xs font-bold">Description<input maxLength={250} value={couponDescription} disabled={disabled} onChange={e=>setCouponDescription(e.target.value)} placeholder="Welcome promotion" className={input}/></label>
         <label className="text-xs font-bold">Expires on (optional)<input type="date" value={couponExpiry} disabled={disabled} onChange={e=>setCouponExpiry(e.target.value)} className={input}/></label>
         <label className="text-xs font-bold">Starts on (optional)<input type="date" value={couponStart} disabled={disabled} onChange={e=>setCouponStart(e.target.value)} className={input}/></label>
       </div>
       <p className="mt-3 text-xs text-[var(--portal-muted)]">Coupon benefit: waive 100% of the new-member one-time registration fee only.</p>
       <button type="submit" disabled={disabled} className="mt-3 rounded-xl bg-[var(--portal-ink)] px-5 py-3 text-xs font-black text-white disabled:opacity-50">Save registration coupon</button>
     </form>
     <h3 className="mt-6 text-base font-black">All coupons ({coupons.length})</h3>
     <div className="mt-3 space-y-2">{coupons.map(coupon=>{
       const expired=!!coupon.expires_on&&coupon.expires_on<new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Lagos",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
       return <article key={coupon.code} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--portal-border)] p-4">
         <div><p className="font-black tracking-wider">{coupon.code} <span className="ml-2 rounded-lg bg-[var(--portal-canvas)] px-2 py-1 text-[10px] font-bold tracking-normal">{!coupon.active?"Disabled":expired?"Expired":"Active"}</span></p>
           <p className="mt-1 text-xs text-[var(--portal-muted)]">{coupon.description||"Registration fee waiver"} · {coupon.starts_on?`Starts ${coupon.starts_on} · `:""}{coupon.expires_on?`Expires ${coupon.expires_on}`:"No expiry"}</p></div>
         <div className="flex gap-2">
           <button type="button" disabled={disabled} onClick={()=>{setCouponCode(coupon.code);setCouponDescription(coupon.description);setCouponExpiry(coupon.expires_on||"");setCouponStart(coupon.starts_on||"");window.scrollTo({top:0,behavior:"smooth"});}} className="rounded-xl border px-3 py-2 text-xs font-bold disabled:opacity-50">Edit</button>
           <button type="button" disabled={disabled} onClick={()=>void changeCoupon(coupon,!coupon.active)} className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-black disabled:opacity-50 ${coupon.active?"border-red-200 text-red-700":"border-green-200 text-green-700"}`}>
             {coupon.active?<><Trash2 size={13}/>Disable</>:<><CheckCircle2 size={13}/>Enable</>}</button>
         </div>
       </article>;
     })}</div>
   </section>}
   {verified&&scope.pages&&tab==="pages"&&<CmsPageAdmin/>}
   {verified&&scope.design&&tab==="design"&&<CmsConfigAdmin/>}
   {verified&&tab==="stage2"&&(scope.campaigns||scope.enquiries||scope.admin)&&<WebsiteStage2 permissions={scope}/>}
   {verified&&scope.admin&&tab==="site"&&<WebsiteSettingsEditor/>}
   {verified&&scope.admin&&tab==="content"&&<section className="mt-5">
     <h2 className="mb-2 text-xl font-black">Content and business operations</h2>
     <p className="mb-5 text-sm text-[var(--portal-muted)]">These tools already exist. Open them from this central dashboard instead of asking anyone to edit website code.</p>
     <div className="grid gap-3 sm:grid-cols-2">{tools.map(({name,description,href,icon:Icon})=><a key={href} href={href} className="group rounded-2xl border bg-white p-5 hover:border-[var(--portal-accent)]">
       <div className="flex items-center justify-between"><Icon size={21} className="text-[var(--portal-accent)]"/><ArrowUpRight size={17}/></div>
       <h3 className="mt-4 font-black">{name}</h3><p className="mt-1 text-xs leading-5 text-[var(--portal-muted)]">{description}</p>
     </a>)}</div>
     <div className="mt-5 rounded-xl border border-dashed p-4 text-xs leading-6 text-[var(--portal-muted)]">
       <strong>Now under Website editor:</strong> spa services, booking times, homepage hero, contact information, FAQs, gym rules and membership descriptions. Registration fee changes and extra discount types require additional billing checks, so those remain protected.
     </div>
   </section>}
   {verified&&scope.admin&&tab==="history"&&<section className="mt-5 rounded-2xl border bg-white p-4 sm:p-6">
     <h2 className="text-xl font-black">Recent management changes</h2>
     <p className="mt-2 text-xs leading-5 text-[var(--portal-muted)]">Recorded change history for membership pricing and coupon settings. Kept even when a coupon is disabled.</p>
     <div className="mt-4 divide-y">{audit.map(item=><article key={item.id} className="py-3">
       <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><strong>{item.record_key}</strong><span className="text-xs text-[var(--portal-muted)]">{new Date(item.changed_at).toLocaleString("en-NG",{timeZone:"Africa/Lagos"})}</span></div>
       <p className="mt-1 text-xs text-[var(--portal-muted)]">{item.kind==="membership_price"?
       `Price: ${money(Number(item.previous_value?.price||0))} → ${money(Number(item.next_value?.price||0))}`:
       `Coupon: ${item.next_value?.active?"Active":"Disabled"}`}</p>
     </article>)}
     {audit.length===0&&<p className="py-5 text-sm text-[var(--portal-muted)]">No settings changed yet.</p>}
     </div>
   </section>}
 </AdminWorkspaceShell>;
}

import {useEffect,useMemo,useState} from "react";
import {supabase} from "@/lib/supabase";
type Plan={id:string;name:string;price:number;duration_days:number;active:boolean};
const money=(amount:number)=>new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN",maximumFractionDigits:0}).format(amount);
export function BulkPricing({plans,onSaved}:{plans:Plan[];onSaved:()=>void}){
 const [draft,setDraft]=useState<Record<string,string>>({});
 const [adjust,setAdjust]=useState("0");
 const [saving,setSaving]=useState(false);
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");
 const editable=useMemo(()=>plans.filter(p=>p.name!=="Custom Plan"&&p.duration_days>0),[plans]);
 useEffect(()=>{setDraft(Object.fromEntries(editable.map(p=>[p.id,String(p.price)])));},[editable]);
 const changed=editable.filter(p=>Number(draft[p.id])!==Number(p.price));
 function applyPercentage(){
  const percentage=Number(adjust);
  if(!Number.isFinite(percentage)||percentage< -90||percentage>500){setError("Enter a percentage from -90% to +500%.");return;}
  setDraft(Object.fromEntries(editable.map(plan=>[plan.id,String(Math.round(Number(plan.price)*(1+percentage/100)))])));
  setError("");
 }
 async function save(){
  if(!changed.length||saving)return;
  if(changed.some(p=>!/^\d+(\.\d{1,2})?$/.test(draft[p.id]||"")||Number(draft[p.id])<100||Number(draft[p.id])>100000000)){setError("Check all prices: minimum ₦100, maximum ₦100,000,000, up to 2 decimals.");return;}
  if(!window.confirm("Apply "+changed.length+" membership price changes immediately? New member checkouts and reception will use these prices. Existing paid memberships will not be changed."))return;
  setSaving(true);setError("");setMessage("");
  const {data,error:e}=await supabase.rpc("admin_site_bulk_update_prices",{p_updates:changed.map(p=>({id:p.id,price:Number(draft[p.id])}))});
  if(e)setError(e.message);else{setMessage((data?.updated??changed.length)+" official membership prices updated.");onSaved();}
  setSaving(false);
 }
 return <section className="mt-6 rounded-2xl border bg-white p-4 sm:p-6">
  <h3 className="text-lg font-black">Advanced price planner</h3>
  <p className="mt-2 text-xs leading-6 text-[var(--portal-muted)]">Preview a percentage increase or reduction across your existing membership plans, then edit individual amounts if needed. Nothing changes until you confirm and save.</p>
  <div className="mt-4 flex flex-wrap items-end gap-2">
   <label className="text-xs font-bold">Adjust all prices by %<input className="mt-1 block w-32 rounded-xl border p-3 text-sm" type="number" min="-90" max="500" step="0.5" value={adjust} onChange={e=>setAdjust(e.target.value)}/></label>
   <button type="button" onClick={applyPercentage} className="rounded-xl border px-4 py-3 text-xs font-bold">Calculate preview</button>
  </div>
  <div className="mt-4 max-h-[380px] space-y-2 overflow-auto">{editable.map(plan=><div key={plan.id} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border p-3">
   <div><p className="text-xs font-bold">{plan.name}</p><p className="mt-1 text-[11px] text-[var(--portal-muted)]">Current: {money(Number(plan.price))}</p></div>
   <label className="text-xs font-bold">New price (₦)<input className="mt-1 block w-32 rounded-lg border px-3 py-2 text-right text-sm" type="number" min="100" max="100000000" step="0.01" value={draft[plan.id]??String(plan.price)} onChange={e=>setDraft(p=>({...p,[plan.id]:e.target.value}))}/></label>
  </div>)}</div>
  {changed.length>0&&<p className="mt-4 rounded-lg bg-orange-50 p-3 text-xs font-semibold text-orange-900">{changed.length} prices would change. Old completed payments stay intact.</p>}
  {error&&<p role="alert" className="mt-3 text-xs text-red-700">{error}</p>}
  {message&&<p role="status" className="mt-3 text-xs text-green-800">{message}</p>}
  <button disabled={!changed.length||saving} onClick={()=>void save()} className="mt-4 rounded-xl bg-[var(--portal-ink)] px-5 py-3 text-xs font-black text-white disabled:opacity-40">{saving?"Saving…":"Apply reviewed prices"}</button>
  <p className="mt-3 text-xs text-[var(--portal-muted)]">Registration fees and the mechanics of percentage-off coupons are intentionally protected because they affect several payment finalizers.</p>
 </section>;
}

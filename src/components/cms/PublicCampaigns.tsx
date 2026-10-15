import {useEffect,useState} from "react";
import {ArrowUpRight,CalendarDays} from "lucide-react";
import {supabase} from "@/lib/supabase";
import {safeCmsHref} from "@/lib/stage1-cms";
export type PublicCampaign={id:string;kind:"event"|"promotion";title:string;description:string;image_url:string;button_label:string;button_url:string;starts_at:string;ends_at:string};
export function useLiveCampaigns(kind?:string){
 const [items,setItems]=useState<PublicCampaign[]>([]);
 useEffect(()=>{let alive=true;void supabase.rpc("wc_public_campaigns",{p_kind:kind||null}).then(({data,error})=>{if(alive&&!error&&Array.isArray(data))setItems(data as PublicCampaign[]);});return()=>{alive=false}},[kind]);
 return items;
}
export function PublicCampaigns({kind,compact=false}:{kind?:"event"|"promotion";compact?:boolean}){
 const items=useLiveCampaigns(kind);
 if(!items.length)return null;
 return <section className="py-10 sm:py-14" aria-label={kind==="promotion"?"Super Plus Fitness promotions":"SPF upcoming events"}>
  <div className="section-shell">
   <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-3xl font-black uppercase">{kind==="promotion"?"Current offers":kind==="event"?"Our events":"Events & offers"}</h2>
    {compact&&<a className="text-xs font-bold text-primary" href="/events">See all events <ArrowUpRight size={14} className="inline"/></a>}</div>
   <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.slice(0,compact?3:30).map(item=>
    <article key={item.id} className="overflow-hidden rounded-2xl border bg-card">
     {item.image_url&&<img src={item.image_url} alt={item.title} loading="lazy" className="aspect-[16/10] w-full object-cover"/>}
     <div className="p-5"><span className="text-[10px] font-black uppercase tracking-[.14em] text-primary">{item.kind}</span>
      <h3 className="mt-2 font-display text-2xl font-black uppercase">{item.title}</h3>
      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted-foreground">{item.description}</p>
      {item.button_url&&<a className="mt-4 inline-flex items-center gap-1 text-xs font-black text-primary" href={safeCmsHref(item.button_url)}>
       {item.button_label||"Learn more"} <ArrowUpRight size={15}/></a>}
     </div>
    </article>)}</div>
  </div>
 </section>;
}

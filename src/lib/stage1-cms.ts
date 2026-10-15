import {useEffect,useState} from "react";
import {supabase} from "@/lib/supabase";
import {facilities as originalFacilities, testimonials as originalTestimonials, navItems} from "@/lib/site-data";
export type CmsLink={label:string;href:string};
export type CmsBlock={id:string;type:"hero"|"text"|"image"|"split"|"cta"|"quote";heading:string;body:string;image:string;button_label:string;button_href:string;visible:boolean};
export type CmsPageDoc={mode:"extend"|"replace";heading:string;intro:string;sections:CmsBlock[]};
export type CmsPage={slug:string;title:string;kind:"custom"|"built_in";doc:CmsPageDoc};
export type CmsBrand={logo:string;favicon:string;primary:string;accent:string;tagline:string};
export type CmsFacility={id:string;name:string;description:string;image:string;visible:boolean};
export type CmsTestimonial={id:string;name:string;detail:string;quote:string;image:string;visible:boolean};
export type CmsNav={header:CmsLink[];footer:CmsLink[]};
export const standardNav:CmsNav={
 header:navItems.map(item=>({label:item.label==="Facilities"?"Gallery":item.label,href:item.to==="/facilities"?"/gallery":item.to})),
 footer:[{label:"Home",href:"/"},{label:"Membership",href:"/membership"},{label:"Spa & Recovery",href:"/spa-recovery"},{label:"Gallery",href:"/gallery"},{label:"About",href:"/about"},{label:"Contact",href:"/contact"}]
};
export const standardBrand:CmsBrand={logo:"",favicon:"",primary:"#ed1027",accent:"#f76c25",tagline:"Fitness That Fits Your Life"};
export const standardFacilities:{items:CmsFacility[]}={items:originalFacilities.map((x,i)=>({...x,id:"facility-"+i,visible:true}))};
export const standardTestimonials:{items:CmsTestimonial[]}={items:originalTestimonials.map((x,i)=>({...x,id:"review-"+i,visible:true,image:""}))};
export const blankCmsDoc=():CmsPageDoc=>({mode:"extend",heading:"",intro:"",sections:[]});
export function useCmsConfig<T>(key:string,fallback:T){
 const [value,setValue]=useState<T>(fallback);
 useEffect(()=>{let active=true;void supabase.rpc("wc_public_config",{p_key:key}).then(({data,error})=>{
   if(active&&!error&&data&&typeof data==="object"&&Object.keys(data).length)setValue(data as T);
 });return()=>{active=false};},[key]);
 return value;
}
export function useCmsPage(slug:string){
 const [page,setPage]=useState<CmsPage|null>(null);
 const [loading,setLoading]=useState(true);
 useEffect(()=>{let active=true;setPage(null);setLoading(true);
  void supabase.rpc("wc_public_page",{p_slug:slug}).then(({data,error})=>{
   if(active){setPage(!error&&data?.doc?data as CmsPage:null);setLoading(false);}
  });return()=>{active=false};},[slug]);
 return {page,loading};
}
export function safeCmsHref(href:string){
 if(href==="/" || (/^\/(?!\/)[a-zA-Z0-9/_#?&=.-]+$/.test(href) && !/^\/(admin|staff|portal|management|reception)(\/|-|$)/i.test(href)) || /^https:\/\/[a-zA-Z0-9.-]+(?:\/[^\s]*)?$/.test(href))return href;
 return "/";
}
export function visiblePageSlug(pathname:string){
 const slugs:Record<string,string>={"/":"home","/about":"about","/contact":"contact","/hmo":"hmo","/personal-training":"personal-training","/membership":"membership","/spa-recovery":"spa-recovery","/gallery":"gallery","/app":"app"};
 return slugs[pathname]||"";
}

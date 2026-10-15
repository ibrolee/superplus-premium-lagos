import {useEffect,type ReactNode} from "react";
import {useRouterState} from "@tanstack/react-router";
import {ArrowRight,Quote} from "lucide-react";
import {type CmsPageDoc,type CmsBlock,type CmsBrand,blankCmsDoc,safeCmsHref,useCmsPage,useCmsConfig,visiblePageSlug,standardBrand,standardTestimonials,type CmsTestimonial} from "@/lib/stage1-cms";

export function CmsBlockPreview({block}:{block:CmsBlock}){
 if(block.visible===false)return null;
 const callToAction=block.button_label&&block.button_href?
  <a className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground" href={safeCmsHref(block.button_href)}>{block.button_label}<ArrowRight size={16}/></a>:null;
 if(block.type==="video")return <section className="section-shell py-8"><figure className="mx-auto max-w-5xl overflow-hidden rounded-2xl border bg-secondary text-white">
   {block.image&&<video src={block.image} controls playsInline preload="metadata" className="max-h-[560px] w-full bg-black"/>}
   {(block.heading||block.body)&&<figcaption className="p-5">{block.heading&&<h2 className="text-2xl font-bold">{block.heading}</h2>}{block.body&&<p className="mt-2 whitespace-pre-line text-white/75">{block.body}</p>}</figcaption>}
  </figure></section>;
 if(block.type==="image")return <section className="section-shell py-8"><figure className="mx-auto max-w-5xl overflow-hidden rounded-2xl border">{block.image&&<img src={block.image} alt={block.heading||"SPF image"} loading="lazy" className="w-full max-h-[520px] object-cover"/>}{(block.heading||block.body)&&<figcaption className="p-5">{block.heading&&<h2 className="text-2xl font-bold">{block.heading}</h2>}{block.body&&<p className="mt-2 whitespace-pre-line text-muted-foreground">{block.body}</p>}</figcaption>}</figure></section>;
 if(block.type==="quote")return <section className="bg-muted py-10"><div className="section-shell max-w-4xl text-center"><Quote className="mx-auto" style={{color:"var(--cms-accent,var(--primary))"}} size={28}/><blockquote className="mt-4 whitespace-pre-line text-xl font-semibold italic">{block.body}</blockquote><p className="mt-3 font-bold">{block.heading}</p></div></section>;
 if(block.type==="hero")return <section className="relative overflow-hidden bg-secondary py-16 text-white sm:py-24">
   {block.image&&<img src={block.image} className="absolute inset-0 h-full w-full object-cover opacity-35" alt="" loading="lazy"/>}
   <div className="section-shell relative"><h2 className="max-w-4xl font-display text-4xl font-black uppercase sm:text-6xl">{block.heading}</h2><p className="mt-4 max-w-2xl whitespace-pre-line leading-7 text-white/85">{block.body}</p>{callToAction}</div>
 </section>;
 if(block.type==="split")return <section className="py-12 sm:py-16"><div className="section-shell grid items-center gap-8 md:grid-cols-2">
    <div><h2 className="font-display text-3xl font-black uppercase sm:text-4xl">{block.heading}</h2><p className="mt-4 whitespace-pre-line leading-7 text-muted-foreground">{block.body}</p>{callToAction}</div>
    {block.image&&<img src={block.image} loading="lazy" alt={block.heading} className="aspect-[4/3] w-full rounded-2xl object-cover"/>}
   </div></section>;
 if(block.type==="cta")return <section className="bg-primary/10 py-12"><div className="section-shell text-center">
   <h2 className="font-display text-3xl font-black uppercase">{block.heading}</h2><p className="mx-auto mt-3 max-w-2xl whitespace-pre-line">{block.body}</p>{callToAction}
  </div></section>;
 return <section className="py-12"><div className="section-shell max-w-4xl">
  <h2 className="font-display text-3xl font-black uppercase">{block.heading}</h2><p className="mt-4 whitespace-pre-line leading-7 text-muted-foreground">{block.body}</p>{callToAction}
 </div></section>;
}
export function CmsPageBody({doc,title="",isStandalone=false}:{doc:CmsPageDoc;title?:string;isStandalone?:boolean}){
 return <div data-cms-page-body>
  {(isStandalone||doc.heading||doc.intro)&&<header className="bg-muted py-12 sm:py-16"><div className="section-shell">
    <h1 className="font-display text-4xl font-black uppercase sm:text-5xl">{doc.heading||title}</h1>
    {doc.intro&&<p className="mt-4 max-w-3xl whitespace-pre-line text-base leading-7 text-muted-foreground">{doc.intro}</p>}
   </div></header>}
  {(doc.sections||[]).map(block=><CmsBlockPreview key={block.id} block={block}/>)}
 </div>;
}
export function CmsPublicSections(){
 const pathname=useRouterState({select:r=>r.location.pathname});
 const slug=visiblePageSlug(pathname);
 const {page}=useCmsPage(slug||"not-applicable");
 if(!slug||!page||page.doc.mode==="replace")return null;
 if(!page.doc.heading&&!page.doc.intro&&!page.doc.sections.some(s=>s.visible!==false))return null;
 return <CmsPageBody doc={page.doc}/>;
}
export function CmsExistingPage({slug,children}:{slug:string;children:ReactNode}){
 const {page}=useCmsPage(slug);
 return page?.doc.mode==="replace"?<main><CmsPageBody doc={page.doc} title={page.title} isStandalone/></main>:<>{children}</>;
}
export function CmsBrandingEffects(){
 const brand=useCmsConfig<CmsBrand>("branding",standardBrand);
 useEffect(()=>{
  const root=document.documentElement;
  root.style.setProperty("--primary",brand.primary||standardBrand.primary);
  root.style.setProperty("--cms-accent",brand.accent||standardBrand.accent);
  const favicon=document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if(favicon&&brand.favicon){favicon.href=brand.favicon;favicon.type=brand.favicon.toLowerCase().includes(".png")?"image/png":"image/jpeg";}
  return()=>{root.style.removeProperty("--primary");root.style.removeProperty("--cms-accent");};
 },[brand.primary,brand.favicon]);
 return null;
}
export function CmsTestimonials(){
 const data=useCmsConfig<{items:CmsTestimonial[]}>("testimonials",standardTestimonials);
 const entries=(data.items||[]).filter(x=>x.visible!==false);
 if(!entries.length)return null;
 return <section className="bg-muted py-12 sm:py-16" id="testimonials"><div className="section-shell">
  <h2 className="font-display text-3xl font-black uppercase">What our members say</h2>
  <div className="mt-7 grid gap-4 md:grid-cols-3">{entries.map(entry=><article key={entry.id} className="rounded-2xl border bg-card p-6">
   <Quote size={22} className="text-primary"/><p className="mt-3 text-sm leading-7">{entry.quote}</p>
   <div className="mt-5 flex items-center gap-3">{entry.image&&<img alt={entry.name} src={entry.image} className="size-12 rounded-full object-cover"/>}<div><p className="font-bold">{entry.name}</p><p className="text-xs text-muted-foreground">{entry.detail}</p></div></div>
  </article>)}</div>
 </div></section>;
}

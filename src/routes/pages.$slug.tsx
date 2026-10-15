import {createFileRoute,Link} from "@tanstack/react-router";
import {CmsPageBody} from "@/components/cms/CmsPublicPage";
import {useCmsPage} from "@/lib/stage1-cms";
import {pageHead} from "@/lib/seo";

export const Route=createFileRoute("/pages/$slug")({
 head:()=>pageHead("Explore Super Plus Fitness","More about Super Plus Fitness & Spa in Shomolu, Lagos.","/pages"),
 component:CmsPublishedInfoPage,
});
function CmsPublishedInfoPage(){
 const {slug}=Route.useParams();
 const {page,loading}=useCmsPage(slug);
 if(loading)return <main className="section-shell min-h-[45vh] py-16"><p className="text-muted-foreground">Loading page…</p></main>;
 if(!page||page.kind!=="custom")return <main className="section-shell min-h-[45vh] py-16"><h1 className="font-display text-4xl font-black">Page unavailable</h1><p className="mt-4 text-muted-foreground">This page may have been unpublished or its address changed.</p><Link to="/" className="mt-6 inline-block font-bold text-primary">Back to homepage</Link></main>;
 return <main><CmsPageBody doc={page.doc} title={page.title} isStandalone/></main>;
}

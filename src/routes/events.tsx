import {createFileRoute} from "@tanstack/react-router";
import {PublicCampaigns} from "@/components/cms/PublicCampaigns";
import {pageHead} from "@/lib/seo";
export const Route=createFileRoute("/events")({
 head:()=>pageHead("Events & Offers | Super Plus Fitness","Current gym events, community activities and offers at Super Plus Fitness.","/events"),
 component:EventsPage,
});
function EventsPage(){
 return <main className="min-h-[55vh]"><header className="bg-secondary py-12 text-white"><div className="section-shell"><h1 className="font-display text-4xl font-black uppercase">Events & Promotions</h1>
 <p className="mt-3 text-sm text-white/75">What's happening at Super Plus Fitness & Spa.</p></div></header>
 <PublicCampaigns kind="event"/><PublicCampaigns kind="promotion"/></main>;
}

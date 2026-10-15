import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { recoveryServices, type RecoveryService } from "@/lib/site-data";

export type SpaServiceEntry = RecoveryService & { duration_minutes: number; active: boolean; image: string };
export type BookingConfig = { mon_sat_open:string; mon_sat_close:string; sun_open:string; sun_close:string; slot_minutes:number; max_concurrent:number; lead_hours:number; advance_days:number };
export type HomeConfig = { title:string; highlight:string; subtitle:string; image:string; announcement:string; announcement_enabled:boolean };
export type BusinessConfig = { phone:string; email:string; address:string; whatsapp:string; mon_sat_hours:string; sun_hours:string; instagram:string };
export type WebsiteTextConfig = { faq: {question:string;answer:string}[]; rules:string[] };
export type MembershipDisplayConfig = { registration_individual:number; registration_family:number; plans: Record<string,{benefits?:string[]; badge?:string}> };
export const fallbackBooking:BookingConfig = {mon_sat_open:"06:00",mon_sat_close:"20:30",sun_open:"06:30",sun_close:"19:00",slot_minutes:30,max_concurrent:3,lead_hours:1,advance_days:90};
export const fallbackHome:HomeConfig={title:"Build stronger.",highlight:"Live better.",subtitle:"Modern fitness, personal training, spa and recovery — all under one roof in Shomolu, Lagos.",image:"",announcement:"",announcement_enabled:false};
export const fallbackBusiness:BusinessConfig={phone:"07054263170",email:"spfitnessandspa@gmail.com",address:"No. 105 Apata Street, Shomolu, Lagos, Nigeria",whatsapp:"+2347054263170",mon_sat_hours:"6:00 AM – 8:30 PM",sun_hours:"6:30 AM – 7:00 PM",instagram:"https://www.instagram.com/superplusfitnessandspa/"};
export const fallbackWebsiteContent:WebsiteTextConfig={faq:[],rules:[]};
export const fallbackMembershipDisplay:MembershipDisplayConfig={registration_individual:7000,registration_family:20000,plans:{}};
export const fallbackSpaServices:SpaServiceEntry[]=recoveryServices.map(item=>({...item,active:true,image:item.image||"",duration_minutes:item.id==="vip-chair"?60:30}));

export function useWebsiteSetting<T>(key:string,initial:T){
 const [value,setValue]=useState<T>(initial);
 const [loading,setLoading]=useState(true);
 useEffect(()=>{
  let live=true;
  void supabase.rpc("website_published_setting",{p_key:key})
    .then(({data,error})=>{
      if(live){
       if(!error&&data&&typeof data==="object"&&Object.keys(data).length>0)setValue(data as T);
       setLoading(false);
      }
    });
  return()=>{live=false};
 },[key]);
 return {value,loading};
}
export function useLiveSpaServices() {
 const {value,loading}=useWebsiteSetting<{items:SpaServiceEntry[]}>("spa_services",{items:fallbackSpaServices});
 return {services:(value.items||[]).filter(item=>item.active),loading};
}

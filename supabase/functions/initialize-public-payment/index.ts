import { createClient } from 'npm:@supabase/supabase-js@2';
import { plans, couponPricing } from '../_shared/public-join-pricing.ts';
// STAGED SOURCE ONLY. Deploy only alongside the paired verifier and SQL migration.
const corsHeaders = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type', 'Access-Control-Allow-Methods':'POST,OPTIONS' };
const respond = (body:Record<string,unknown>,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
 if(req.method!=='POST')return respond({error:'Method not allowed.'},405);
 try{
  const key=Deno.env.get('PAYSTACK_SECRET_KEY'),url=Deno.env.get('SUPABASE_URL'),serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!key||!url||!serviceKey)return respond({error:'Payment system is not configured.'},503);
  const body=await req.json();const planId=String(body?.planId||'').trim();const plan=plans[planId];
  if(!plan)return respond({error:'Invalid membership plan.'},400);
  const name=String(body?.fullName||'').trim(),email=String(body?.email||'').trim().toLowerCase(),phone=String(body?.phone||'').trim();
  const birthDay=Number(body?.birthDay),birthMonth=Number(body?.birthMonth);
  if(name.length<2||!email.includes('@')||!phone||!Number.isInteger(birthDay)||birthDay<1||birthDay>31||!Number.isInteger(birthMonth)||birthMonth<1||birthMonth>12)return respond({error:'Enter your name, valid email, phone and birth day/month.'},400);
  let pricing:ReturnType<typeof couponPricing>;
  try{pricing=couponPricing(plan,body?.couponCode);}catch{return respond({error:'Invalid coupon code.'},400);}
  // Some historic members share an email: never charge before the account mapping is unambiguous.
  // This server-side check does not reveal any member identity or provide a public lookup endpoint.
  const admin=createClient(url,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:matches,error:matchError}=await admin.rpc('public_join_email_matches',{p_email:email});
  if(matchError||typeof matches!=='number')return respond({error:'Member check is temporarily unavailable. No payment has started; try again later.'},503);
  if(matches>1)return respond({error:'Multiple gym profiles use this email. Ask reception to correct the duplicate email records before paying online. No payment has started.'},409);
  const reference=`SPF-${Date.now()}-${crypto.randomUUID()}`;
  const transaction=await fetch('https://api.paystack.co/transaction/initialize',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({email,amount:pricing.totalAmount*100,currency:'NGN',reference,callback_url:'https://superplusfitness.com/payment/public-callback',metadata:{source:'public_join',reference,plan_id:planId,plan_name:plan.name,membership_amount_naira:pricing.membershipAmount,registration_amount_naira:pricing.registrationAmount,total_amount_naira:pricing.totalAmount,coupon_code:pricing.couponCode,duration_days:plan.durationDays,full_name:name,email,phone,birth_day:birthDay,birth_month:birthMonth}})});
  const data=await transaction.json();if(!transaction.ok||!data?.status||!data?.data?.authorization_url)return respond({error:data?.message||'Paystack could not start the payment.'},400);
  return respond({authorization_url:data.data.authorization_url,access_code:data.data.access_code,reference:data.data.reference||reference,plan_name:plan.name,membership_amount:pricing.membershipAmount,registration_amount:pricing.registrationAmount,total_amount:pricing.totalAmount,coupon_code:pricing.couponCode});
 }catch(error){console.error('Public Paystack initialization failed',error);return respond({error:'Unable to start payment. Please try again.'},500);}
});

import { createClient } from 'npm:@supabase/supabase-js@2';
import { plans, couponPricing } from '../_shared/public-join-pricing.ts';
// STAGED SOURCE ONLY: requires the paired initializer and finalize_public_join_payment migration.
// All amounts are recomputed on the server after verifying the actual Paystack transaction.
const corsHeaders={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
const respond=(body:Record<string,unknown>,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
 if(req.method!=='POST')return respond({error:'Method not allowed.'},405);
 try{
  const url=Deno.env.get('SUPABASE_URL'),serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),paystackKey=Deno.env.get('PAYSTACK_SECRET_KEY');
  if(!url||!serviceKey||!paystackKey)return respond({error:'Payment verification is not configured.'},503);
  const body=await req.json();const reference=String(body?.reference||'').trim();if(!reference)return respond({error:'Payment reference is required.'},400);
  const paystack=await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,{headers:{Authorization:`Bearer ${paystackKey}`,'Content-Type':'application/json'}});
  const result=await paystack.json();
  if(!paystack.ok||!result?.status||result?.data?.status!=='success')return respond({error:'Payment could not be verified by Paystack.'},400);
  const txn=result.data,metadata=txn.metadata||{};
  if(txn.reference!==reference||metadata.source!=='public_join'||metadata.reference!==reference||txn.currency!=='NGN')return respond({error:'Paystack transaction details do not match this checkout.'},400);
  const planId=String(metadata.plan_id||'').trim(),plan=plans[planId];if(!plan)return respond({error:'Membership plan not found.'},400);
  let pricing:ReturnType<typeof couponPricing>;try{pricing=couponPricing(plan,metadata.coupon_code);}catch{return respond({error:'Invalid coupon in payment metadata.'},400);}
  // Reject tampered/old metadata, discounts on plan price, and incomplete payments.
  if(Number(txn.amount)!==pricing.totalAmount*100||Number(metadata.membership_amount_naira)!==pricing.membershipAmount||Number(metadata.registration_amount_naira)!==pricing.registrationAmount||Number(metadata.total_amount_naira)!==pricing.totalAmount||Number(metadata.duration_days)!==plan.durationDays)return respond({error:'Verified payment amount does not match the membership and registration fee.'},400);
  const email=String(metadata.email||'').trim().toLowerCase(),name=String(metadata.full_name||'').trim(),phone=String(metadata.phone||'').trim();
  const day=Number(metadata.birth_day),month=Number(metadata.birth_month);
  if(!email.includes('@')||!name||!phone||!Number.isInteger(day)||day<1||day>31||!Number.isInteger(month)||month<1||month>12||String(txn.customer?.email||'').trim().toLowerCase()!==email)return respond({error:'Customer details do not match the verified transaction.'},400);
  const admin=createClient(url,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data,error}=await admin.rpc('finalize_public_join_payment',{
   p_reference:reference,p_plan_id:planId,p_full_name:name,p_email:email,p_phone:phone,p_birth_day:day,p_birth_month:month,
   p_paid_at:txn.paid_at||null,p_channel:String(txn.channel||''),p_customer_code:String(txn.customer?.customer_code||''),
   p_coupon_code:pricing.couponCode||'',p_verified_amount_kobo:Number(txn.amount),
  });
  if(error){console.error('Verified Paystack payment could not be recorded',{reference,error});return respond({error:'Payment succeeded, but recording is not complete. Do not pay again. Contact the gym with your Paystack reference.'},503);}
  if(!data?.success)return respond({error:'Payment record is uncertain. Contact reception with your reference; do not pay again.'},503);
  return respond(data as Record<string,unknown>);
 }catch(error){console.error('Public Paystack verification failed',error);return respond({error:'Payment confirmation is unavailable. Do not pay again if Paystack already charged you; contact reception with the transaction reference.'},503);}
});

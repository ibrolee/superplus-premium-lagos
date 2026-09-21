import { createClient } from 'npm:@supabase/supabase-js@2';
const cors = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods':'POST, OPTIONS' };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type':'application/json' } });
const plans: Record<string, { name:string; price:number; duration:number }> = {
  daily:{name:'Daily Plan',price:4000,duration:1}, weekly:{name:'Weekly Plan',price:15000,duration:7},
  monthly:{name:'Monthly Plan',price:27000,duration:30}, quarterly:{name:'Quarterly',price:75000,duration:90},
  'semi-annual':{name:'Semi-Annual',price:150000,duration:180}, yearly:{name:'Yearly',price:285000,duration:365},
  'vip-silver':{name:'Monthly VIP Silver',price:55000,duration:30}, 'vip-gold':{name:'Monthly VIP Gold',price:85000,duration:30},
  family:{name:'Family Plan',price:75000,duration:30}, 'personal-training':{name:'Personal Training',price:57000,duration:30},
};
Deno.serve(async (request: Request) => {
  if (request.method==='OPTIONS') return response({ok:true});
  if (request.method!=='POST') return response({error:'Method not allowed.'},405);
  try {
    const url=Deno.env.get('SUPABASE_URL'), anon=Deno.env.get('SUPABASE_ANON_KEY');
    const secret=Deno.env.get('PAYSTACK_SECRET_KEY'), serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anon || !secret || !serviceKey) return response({error:'Payment system is not configured.'},503);
    const authorization=request.headers.get('Authorization');
    if (!authorization) return response({error:'Sign in to start your payment.'},401);
    const userClient=createClient(url,anon,{global:{headers:{Authorization:authorization}}});
    const {data:{user},error:userError}=await userClient.auth.getUser();
    if (userError || !user) return response({error:'Your session expired. Please sign in again.'},401);
    const {planId}=await request.json();
    const plan=plans[String(planId||'')];
    if (!plan) return response({error:'Invalid membership plan.'},400);
    const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:member,error:memberError}=await admin.from('members').select('id,email,auth_user_id').eq('auth_user_id',user.id).maybeSingle();
    if (memberError || !member || !member.email) return response({error:'Member account or email could not be located.'},404);
    const {data:databasePlan,error:planError}=await admin.from('membership_plans').select('price,duration_days,active').eq('name',plan.name).maybeSingle();
    if (planError || !databasePlan?.active || Number(databasePlan.price)!==plan.price || databasePlan.duration_days!==plan.duration) {
      return response({error:'Membership prices are being updated. Please contact reception before paying.'},503);
    }
    const reference=`SPF-${Date.now()}-${crypto.randomUUID()}`;
    const metadata={source:'member_dashboard',member_id:member.id,auth_user_id:user.id,plan_id:planId,
      plan_name:plan.name,amount_naira:plan.price,duration_days:plan.duration};
    const initialized=await fetch('https://api.paystack.co/transaction/initialize',{
      method:'POST',headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},
      body:JSON.stringify({email:member.email,amount:plan.price*100,currency:'NGN',reference,
        callback_url:'https://www.superplusfitness.com/payment/callback',metadata}),signal:AbortSignal.timeout(12000),
    });
    const result=await initialized.json();
    if (!initialized.ok || result?.status!==true || result.data?.reference!==reference || !result.data?.authorization_url) {
      return response({error:'Unable to start Paystack checkout. Please try again.'},503);
    }
    // Never hand a customer a checkout URL until its exact reference is durably recorded.
    const {error:pendingError}=await admin.from('payments').insert({
      member_id:member.id,amount:plan.price,currency:'NGN',status:'pending',source:'paystack',provider:'paystack',
      paystack_reference:reference,metadata,
    });
    if (pendingError) {
      console.error('Paystack pending checkout not recorded:',{reference,code:pendingError.code,message:pendingError.message});
      return response({error:'Checkout could not be recorded safely. Please retry. You have not been sent to payment.'},503);
    }
    return response({authorization_url:result.data.authorization_url,access_code:result.data.access_code,reference});
  } catch(error) {
    console.error('Initialize payment:',error instanceof Error?error.message:'unknown');
    return response({error:'Unable to start payment. Please retry.'},503);
  }
});

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
const registrationFeeCoupons = new Set(['REGOFF','REGSF']);
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
    const body=await request.json();
    const mobileClient=body?.client==='mobile';
    const planId=String(body?.planId||'');const plan=plans[planId];
    if (!plan) return response({error:'Invalid membership plan.'},400);
    const couponCode=String(body?.couponCode||'').trim().toUpperCase();
    if (couponCode && !registrationFeeCoupons.has(couponCode)) return response({error:'Invalid coupon code.'},400);
    const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:member,error:memberError}=await admin.from('members').select('id,email,phone,auth_user_id').eq('auth_user_id',user.id).maybeSingle();
    if (memberError || !member || !member.email) return response({error:'Member account or email could not be located.'},404);
    const {data:databasePlan,error:planError}=await admin.from('membership_plans').select('price,duration_days,active').eq('name',plan.name).maybeSingle();
    if (planError || !databasePlan?.active || Number(databasePlan.price)!==plan.price || databasePlan.duration_days!==plan.duration) {
      return response({error:'Membership prices are being updated. Please contact reception before paying.'},503);
    }

    const metadata:Record<string,unknown>={source:'member_dashboard',member_id:member.id,auth_user_id:user.id,plan_id:planId,
      plan_name:plan.name,amount_naira:plan.price,duration_days:plan.duration,coupon_code:couponCode||null,client:mobileClient?'mobile':'web'};
    if(planId==='personal-training'){
      let trainerId=String(body?.trainerStaffProfileId||'').trim();
      if(trainerId){
        const {data:trainer,error:trainerError}=await admin.from('pt_trainers').select('staff_profile_id').eq('staff_profile_id',trainerId).eq('active',true).maybeSingle();
        if(trainerError||!trainer)return response({error:'The selected personal trainer is not available. Choose another coach.'},409);
      }else{
        const {data:assignment}=await admin.from('pt_assignments').select('trainer_staff_profile_id').eq('member_id',member.id).order('updated_at',{ascending:false}).limit(1).maybeSingle();
        if(assignment?.trainer_staff_profile_id)trainerId=String(assignment.trainer_staff_profile_id);
      }
      if(!trainerId)return response({error:'Choose your personal trainer before starting PT payment.'},400);
      metadata.trainer_staff_profile_id=trainerId;
    }
    if(planId==='family'){
      const {data:groups,error:groupError}=await admin.from('family_groups').select('id').eq('primary_member_id',member.id).order('created_at',{ascending:false}).limit(1);
      if(groupError)return response({error:'Family membership check is temporarily unavailable. No payment has started.'},503);
      const group=groups?.[0];
      if(group){
        const {data:links,error:linksError}=await admin.from('family_group_members').select('member_id,slot').eq('group_id',group.id).order('slot');
        if(linksError)return response({error:'Family membership check is temporarily unavailable. No payment has started.'},503);
        if((links||[]).length!==3)return response({error:'This Family Plan setup is incomplete. Reception must fill all three family slots before renewal.'},409);
        metadata.family_group_id=group.id;
      }else{
        if(!member.phone)return response({error:'Your member profile needs a phone number before starting a Family Plan. Contact reception to update it.'},409);
        const familyMembers=Array.isArray(body?.familyMembers)?body.familyMembers:null;
        if(!familyMembers||familyMembers.length!==2)return response({error:'Starting a Family Plan requires two additional family members.'},400);
        const preflight=[{mode:'existing',email:member.email,phone:member.phone},...familyMembers];
        const {error:familyError}=await admin.rpc('validate_family_member_inputs',{p_members:preflight,p_expected_count:3});
        if(familyError)return response({error:familyError.message||'Family member details could not be verified. No payment has started.'},409);
        metadata.family_members=familyMembers;
      }
    }

    const reference=`SPF-${Date.now()}-${crypto.randomUUID()}`;
    const initialized=await fetch('https://api.paystack.co/transaction/initialize',{
      method:'POST',headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},
      body:JSON.stringify({email:member.email,amount:plan.price*100,currency:'NGN',reference,
        callback_url:mobileClient?'https://www.superplusfitness.com/payment/mobile-return':'https://www.superplusfitness.com/payment/callback',metadata}),signal:AbortSignal.timeout(12000),
    });
    const result=await initialized.json();
    if (!initialized.ok || result?.status!==true || result.data?.reference!==reference || !result.data?.authorization_url) {
      return response({error:'Unable to start Paystack checkout. Please try again.'},503);
    }
    const {error:pendingError}=await admin.from('payments').insert({
      member_id:member.id,amount:plan.price,currency:'NGN',status:'pending',source:'paystack',provider:'paystack',
      paystack_reference:reference,metadata,
    });
    if (pendingError) {
      console.error('Paystack pending checkout not recorded:',{reference,code:pendingError.code,message:pendingError.message});
      return response({error:'Checkout could not be recorded safely. Please retry. You have not been sent to payment.'},503);
    }
    return response({authorization_url:result.data.authorization_url,access_code:result.data.access_code,reference,amount:plan.price,coupon_code:couponCode||null});
  } catch(error) {
    console.error('Initialize payment:',error instanceof Error?error.message:'unknown');
    return response({error:'Unable to start payment. Please retry.'},503);
  }
});

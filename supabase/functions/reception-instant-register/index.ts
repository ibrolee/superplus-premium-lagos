import { createClient } from 'npm:@supabase/supabase-js@2';

// STAGED ONLY: never deploy to the live project until the SQL migration and workflows pass isolated testing.
// Requires verify_jwt=true; service-role credentials never leave the Edge runtime.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) return json({ error: 'Sign in through the reception portal.' }, 401);
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'Registration is not configured.' }, 503);
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  try {
    const { data: identity, error: identityError } = await admin.auth.getUser(token);
    if (identityError || !identity.user) return json({ error: 'Session expired. Sign in again.' }, 401);
    const { data: staff, error: staffError } = await admin.from('staff_users')
      .select('role,active').eq('auth_user_id', identity.user.id).maybeSingle();
    if (staffError || !staff?.active || !['reception','admin','owner','manager'].includes(String(staff.role || '').toLowerCase())) {
      return json({ error: 'Active reception account required.' }, 403);
    }
    const body = await req.json();
    const { data, error } = await admin.rpc('reception_complete_registration', {
      p_actor_id: identity.user.id,
      p_full_name: String(body?.fullName || ''),
      p_email: String(body?.email || ''),
      p_phone: String(body?.phone || ''),
      p_plan_id: body?.planId || null,
      p_start_date: String(body?.startDate || ''),
      p_duration_days: Number(body?.durationDays),
      p_plan_amount: Number(body?.planAmount),
      p_method: String(body?.method || ''),
      p_staff_note: String(body?.notes || ''),
      p_staff_reference: String(body?.reference || ''),
      p_funds_confirmed: body?.fundsConfirmed === true,
      p_idempotency_key: body?.idempotencyKey || null,
      p_member_id: body?.memberId || null,
      p_coupon_code: String(body?.couponCode || ''),
    });
    if (error) return json({ error: error.message || 'Payment could not be recorded. Check the member directory before retrying.' }, 400);
    if (!data?.success) return json({ error: 'Transaction status uncertain. Check the member directory before retrying.' }, 409);
    return json(data as Record<string, unknown>, 201);
  } catch {
    return json({ error: 'Transaction status uncertain. Check the member directory before retrying.' }, 503);
  }
});

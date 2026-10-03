import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function serviceKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!raw) return "";
  try {
    return JSON.parse(raw)?.default ?? "";
  } catch {
    return "";
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Authentication required" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const key = serviceKey();
  if (!supabaseUrl || !key) return json({ error: "Server configuration unavailable" }, 500);

  const admin = createClient(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userResult, error: userError } = await admin.auth.getUser(token);
  const user = userResult?.user;
  if (userError || !user) return json({ error: "Invalid session" }, 401);

  let requestedFrom = "app";
  try {
    const body = await req.json();
    if (typeof body?.requested_from === "string") {
      requestedFrom = body.requested_from.slice(0, 40);
    }
  } catch {
    // Body is optional.
  }

  const { error: anonymizeError } = await admin.rpc("anonymize_member_account", {
    p_auth_user_id: user.id,
    p_requested_from: requestedFrom,
  });

  if (anonymizeError) {
    return json({ error: "Could not remove member data. Please contact support." }, 500);
  }

  const { error: deleteUserError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteUserError) {
    return json({ error: "Member data was removed, but login deletion needs support follow-up." }, 500);
  }

  return json({ deleted: true });
});

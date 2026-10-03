import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type Payload = {
  title?: string;
  body?: string;
  kind?: string;
  deep_link?: string | null;
  published_at?: string | null;
  expires_at?: string | null;
  send_push?: boolean;
};

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
  if (!supabaseUrl || !key) {
    return json({ error: "Server configuration unavailable" }, 500);
  }

  const admin = createClient(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userResult, error: userError } = await admin.auth.getUser(token);
  const user = userResult?.user;
  if (userError || !user) return json({ error: "Invalid session" }, 401);

  const { data: staff, error: staffError } = await admin
    .from("staff_users")
    .select("role,active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const role = String(staff?.role ?? "").toLowerCase();
  if (
    staffError ||
    !staff?.active ||
    !["admin", "owner", "manager"].includes(role)
  ) {
    return json({ error: "Management access required" }, 403);
  }

  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const title = String(payload.title ?? "").trim();
  const body = String(payload.body ?? "").trim();
  const kind = String(payload.kind ?? "general").trim() || "general";
  const deepLink =
    typeof payload.deep_link === "string" && payload.deep_link.startsWith("/")
      ? payload.deep_link
      : null;

  if (!title || title.length > 140 || body.length > 1200) {
    return json({ error: "Invalid title or message length" }, 400);
  }

  const publishedAt = payload.published_at
    ? new Date(payload.published_at).toISOString()
    : new Date().toISOString();
  const expiresAt = payload.expires_at
    ? new Date(payload.expires_at).toISOString()
    : null;

  const { data: notification, error: notificationError } = await admin
    .from("app_notifications")
    .insert({
      title,
      body,
      kind,
      deep_link: deepLink,
      audience: "members",
      published_at: publishedAt,
      expires_at: expiresAt,
      created_by: user.id,
    })
    .select("id,title,body,kind,deep_link,published_at")
    .single();

  if (notificationError || !notification) {
    return json(
      { error: notificationError?.message ?? "Could not create notification" },
      500,
    );
  }

  const shouldPush =
    payload.send_push !== false &&
    new Date(publishedAt).getTime() <= Date.now() + 10_000;

  if (!shouldPush) {
    return json({ notification, push_sent: 0, scheduled_in_app: true });
  }

  const { data: tokenRows, error: tokenError } = await admin
    .from("member_push_tokens")
    .select("expo_push_token")
    .eq("enabled", true);

  if (tokenError) {
    return json({
      notification,
      push_sent: 0,
      push_error: tokenError.message,
    });
  }

  const tokens = [
    ...new Set(
      (tokenRows ?? [])
        .map((row) => String(row.expo_push_token ?? ""))
        .filter((value) => value.startsWith("ExponentPushToken[") || value.startsWith("ExpoPushToken[")),
    ),
  ];

  let sent = 0;
  let pushError = "";

  for (let index = 0; index < tokens.length; index += 100) {
    const batch = tokens.slice(index, index + 100).map((to) => ({
      to,
      title,
      body,
      sound: "default",
      data: {
        kind,
        deep_link: deepLink,
        notification_id: notification.id,
      },
    }));

    try {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        body: JSON.stringify(batch),
      });

      if (!response.ok) {
        pushError = `Expo push returned ${response.status}`;
        continue;
      }

      sent += batch.length;
    } catch (error) {
      pushError = error instanceof Error ? error.message : "Push delivery failed";
    }
  }

  return json({
    notification,
    push_sent: sent,
    token_count: tokens.length,
    ...(pushError ? { push_error: pushError } : {}),
  });
});

import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { supabase } from "./supabase";

export async function registerMemberPushToken(memberId: string) {
  if (Platform.OS === "web") return null;

  try {
    const current = await Notifications.getPermissionsAsync();
    const permission =
      current.status === "granted"
        ? current
        : await Notifications.requestPermissionsAsync();

    if (permission.status !== "granted") return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) return null;

    const result = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = result.data;
    if (!token) return null;

    await supabase.from("member_push_tokens").upsert(
      {
        member_id: memberId,
        expo_push_token: token,
        platform: Platform.OS,
        enabled: true,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "member_id,expo_push_token" },
    );

    return token;
  } catch {
    return null;
  }
}

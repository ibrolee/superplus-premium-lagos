import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { supabase } from "./supabase";

function projectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    null
  );
}

async function currentExpoToken() {
  if (Platform.OS === "web") return null;
  const id = projectId();
  if (!id) return null;

  const permission = await Notifications.getPermissionsAsync();
  if (permission.status !== "granted") return null;

  try {
    return (await Notifications.getExpoPushTokenAsync({ projectId: id })).data || null;
  } catch {
    return null;
  }
}

export async function disableCurrentMemberPushToken() {
  const token = await currentExpoToken();
  if (!token) return;

  await supabase.rpc("disable_my_push_token", {
    p_expo_push_token: token,
  });
}

export async function registerMemberPushToken(memberId: string) {
  if (Platform.OS === "web") return null;

  try {
    const current = await Notifications.getPermissionsAsync();
    const permission =
      current.status === "granted"
        ? current
        : await Notifications.requestPermissionsAsync();

    if (permission.status !== "granted") return null;

    const id = projectId();
    if (!id) return null;

    const result = await Notifications.getExpoPushTokenAsync({ projectId: id });
    const token = result.data;
    if (!token) return null;

    const { error } = await supabase.rpc("register_my_push_token", {
      p_expo_push_token: token,
      p_platform: Platform.OS,
    });

    if (error) return null;
    return token;
  } catch {
    return null;
  }
}

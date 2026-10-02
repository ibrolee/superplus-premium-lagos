import { Redirect } from "expo-router";
import { useApp } from "../lib/AppContext";
import { LoadingView } from "../lib/ui";

export default function IndexScreen() {
  const { authLoading, session } = useApp();

  if (authLoading) return <LoadingView label="Opening Super Plus…" />;

  return <Redirect href={session ? "/(tabs)" : "/login"} />;
}

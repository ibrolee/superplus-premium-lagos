import { createFileRoute, redirect } from "@tanstack/react-router";

const APK_URL =
  "https://github.com/ibrolee/superplus-premium-lagos/releases/download/spf-android-build8-2026-10-22/SP-Fitness-1.0.0-2026-10-22.apk";

export const Route = createFileRoute("/app/android")({
  beforeLoad: () => {
    throw redirect({ href: APK_URL });
  },
});

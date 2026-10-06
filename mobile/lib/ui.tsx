import type { PropsWithChildren, ReactNode, Ref } from "react";
import {
  ActivityIndicator,
  DynamicColorIOS,
  Linking,
  Platform,
  PlatformColor,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BrandLogo } from "./BrandLogo";

function adaptiveColor(light: string, dark: string, androidAttribute: string) {
  if (Platform.OS === "ios") return DynamicColorIOS({ light, dark });
  if (Platform.OS === "android") return PlatformColor(androidAttribute);
  return light;
}

export const colors: Record<string, any> = {
  background: adaptiveColor("#F8F6F3", "#0F1011", "?android:attr/colorBackground"),
  surface: adaptiveColor("#FFFFFF", "#1A1C1E", "?android:attr/colorBackgroundFloating"),
  surfaceMuted: adaptiveColor("#FFF1EA", "#2A211E", "?android:attr/colorBackgroundFloating"),
  green: "#111111",
  green2: "#E44824",
  ink: adaptiveColor("#161616", "#F5F2EF", "?android:attr/textColorPrimary"),
  muted: adaptiveColor("#6F6A66", "#B6B0AB", "?android:attr/textColorSecondary"),
  line: adaptiveColor("#EEE3DC", "#36393C", "?android:attr/textColorTertiary"),
  success: "#287A45",
  amber: "#A96500",
  danger: "#C13228",
};

export const iconPalette = {
  orange: { bg: "#FFF0E8", fg: "#E44824" },
  red: { bg: "#FDEBEC", fg: "#C92A36" },
  blue: { bg: "#EAF3FF", fg: "#2F6FDB" },
  purple: { bg: "#F3ECFF", fg: "#7950C7" },
  gold: { bg: "#FFF5D8", fg: "#A96500" },
  teal: { bg: "#E7F7F4", fg: "#167A6C" },
  green: { bg: "#EAF7ED", fg: "#287A45" },
  pink: { bg: "#FDEBF4", fg: "#B83A78" },
};

export function lagosToday() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function dateLabel(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function dateTimeLabel(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function money(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

export function daysUntil(date?: string | null) {
  if (!date) return null;
  const today = new Date(`${lagosToday()}T12:00:00Z`);
  const target = new Date(`${date}T12:00:00Z`);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

export function Screen({
  children,
  refreshing = false,
  onRefresh,
  scrollRef,
}: PropsWithChildren<{ refreshing?: boolean; onRefresh?: () => void; scrollRef?: Ref<ScrollView> }>) {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.green}
            />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({
  children,
  style,
}: PropsWithChildren<{ style?: object }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: PropsWithChildren<{ tone?: "neutral" | "success" | "amber" | "danger" }>) {
  const bg =
    tone === "success"
      ? "#E4F4E8"
      : tone === "amber"
        ? "#FFF3D9"
        : tone === "danger"
          ? "#FCE9E6"
          : colors.surfaceMuted;
  const text =
    tone === "success"
      ? colors.success
      : tone === "amber"
        ? colors.amber
        : tone === "danger"
          ? colors.danger
          : colors.green2;
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color: text }]}>{children}</Text>
    </View>
  );
}

export function LoadingView({ label = "Loading your account…" }: { label?: string }) {
  return (
    <SafeAreaView style={styles.loading}>
      <BrandLogo size={200} style={styles.loadingLogo} />
      <ActivityIndicator size="small" color={colors.green2} />
      <Text style={styles.loadingText}>{label}</Text>
    </SafeAreaView>
  );
}

export function EmptyState({ children }: PropsWithChildren) {
  return (
    <Card>
      <Text style={styles.empty}>{children}</Text>
    </Card>
  );
}

export function AccountLinkRequired({ email }: { email?: string | null }) {
  return (
    <View style={styles.linkWrap}>
      <BrandLogo size={120} />
      <Text style={styles.kicker}>MEMBER ACCOUNT</Text>
      <Text style={styles.linkTitle}>We couldn’t link this login yet.</Text>
      <Text style={styles.linkBody}>
        Your app login must use the same email address saved on your Super Plus
        member profile at reception.
      </Text>
      {!!email && <Text style={styles.linkEmail}>{email}</Text>}
      <Pressable
        style={styles.primaryButton}
        onPress={() => void Linking.openURL("https://www.superplusfitness.com")}
      >
        <Text style={styles.primaryButtonText}>Open Super Plus Website</Text>
      </Pressable>
    </View>
  );
}

export const sharedStyles = StyleSheet.create({
  kicker: {
    color: colors.green2,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  title: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.green,
    borderRadius: 14,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { padding: 18, paddingBottom: 34, gap: 16 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
  },
  sectionHeading: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
  },
  pill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pillText: { fontSize: 10, fontWeight: "900", letterSpacing: 0.6 },
  loading: {
    alignItems: "center",
    backgroundColor: colors.surface,
    paddingHorizontal: 24,
    flex: 1,
    gap: 14,
    justifyContent: "center",
  },
  loadingLogo: { marginBottom: 8 },
  loadingText: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  empty: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: "center" },
  linkWrap: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    padding: 22,
  },
  kicker: {
    color: colors.green2,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  linkTitle: { color: colors.ink, fontSize: 25, fontWeight: "900", lineHeight: 30 },
  linkBody: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  linkEmail: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800",
    padding: 12,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.green,
    borderRadius: 14,
    justifyContent: "center",
    minHeight: 52,
    marginTop: 4,
    paddingHorizontal: 18,
  },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
});

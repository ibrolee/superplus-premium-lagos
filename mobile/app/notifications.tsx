import { Ionicons } from "@expo/vector-icons";
import { Redirect, router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useApp } from "../lib/AppContext";
import { supabase } from "../lib/supabase";
import { Card, colors, dateTimeLabel, iconPalette, Screen, sharedStyles } from "../lib/ui";

type AppNotification = {
  id: string;
  title: string;
  body: string;
  kind: string;
  deep_link: string | null;
  published_at: string;
};

export default function NotificationsScreen() {
  const { session, member, refreshing, refresh, refreshNotificationCount } = useApp();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    if (!member?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const [notificationsResult, readsResult] = await Promise.all([
      supabase
        .from("app_notifications")
        .select("id,title,body,kind,deep_link,published_at")
        .order("published_at", { ascending: false })
        .limit(80),
      supabase
        .from("member_notification_reads")
        .select("notification_id")
        .eq("member_id", member.id),
    ]);

    setItems((notificationsResult.data ?? []) as AppNotification[]);
    setReadIds(
      new Set((readsResult.data ?? []).map((row) => String(row.notification_id))),
    );
    setLoading(false);
  }, [member?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const unread = useMemo(
    () => items.filter((item) => !readIds.has(item.id)).length,
    [items, readIds],
  );

  async function markRead(id: string) {
    if (!member?.id || readIds.has(id)) return;

    const { error } = await supabase.from("member_notification_reads").upsert(
      {
        member_id: member.id,
        notification_id: id,
        read_at: new Date().toISOString(),
      },
      { onConflict: "notification_id,member_id" },
    );

    if (!error) {
      setReadIds((current) => new Set([...current, id]));
      await refreshNotificationCount();
    }
  }

  async function markAllRead() {
    if (!member?.id || unread === 0 || markingAll) return;
    setMarkingAll(true);

    const rows = items
      .filter((item) => !readIds.has(item.id))
      .map((item) => ({
        member_id: member.id,
        notification_id: item.id,
        read_at: new Date().toISOString(),
      }));

    if (rows.length) {
      const { error } = await supabase
        .from("member_notification_reads")
        .upsert(rows, { onConflict: "notification_id,member_id" });

      if (!error) {
        setReadIds(new Set(items.map((item) => item.id)));
        await refreshNotificationCount();
      }
    }

    setMarkingAll(false);
  }

  async function openItem(item: AppNotification) {
    await markRead(item.id);
    if (item.deep_link?.startsWith("/")) {
      router.push(item.deep_link as never);
    }
  }

  if (!session) return <Redirect href="/login" />;

  return (
    <Screen refreshing={refreshing} onRefresh={() => { void refresh(); void load(); }}>
      <View style={styles.topRow}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={21} color={colors.ink} />
        </Pressable>
        <View style={styles.headingCopy}>
          <Text style={sharedStyles.kicker}>UPDATES</Text>
          <Text style={styles.title}>Notifications</Text>
          <Text style={sharedStyles.subtitle}>
            Gym updates, new articles, challenges, bookings and important member notices.
          </Text>
        </View>
      </View>

      <View style={styles.toolbar}>
        <Text style={styles.unreadText}>{unread} unread</Text>
        <Pressable
          disabled={!unread || markingAll}
          onPress={() => void markAllRead()}
          style={[styles.markAllButton, (!unread || markingAll) && styles.disabled]}
        >
          {markingAll ? (
            <ActivityIndicator size="small" color={colors.green} />
          ) : (
            <Text style={styles.markAllText}>Mark all read</Text>
          )}
        </Pressable>
      </View>

      {loading ? (
        <Card style={styles.loadingCard}>
          <ActivityIndicator color={colors.green} />
        </Card>
      ) : items.length ? (
        <View style={styles.list}>
          {items.map((item) => {
            const isUnread = !readIds.has(item.id);
            const tone =
              item.kind === "blog"
                ? iconPalette.purple
                : item.kind === "challenge"
                  ? iconPalette.gold
                  : item.kind === "booking"
                    ? iconPalette.blue
                    : iconPalette.orange;
            return (
              <Pressable
                key={item.id}
                onPress={() => void openItem(item)}
                style={[styles.item, isUnread && styles.itemUnread]}
              >
                <View style={[styles.iconWrap, { backgroundColor: tone.bg }, isUnread && styles.iconWrapUnread]}>
                  <Ionicons
                    name={
                      item.kind === "blog"
                        ? "newspaper-outline"
                        : item.kind === "challenge"
                          ? "trophy-outline"
                          : item.kind === "booking"
                            ? "calendar-outline"
                            : "notifications-outline"
                    }
                    size={20}
                    color={tone.fg}
                  />
                </View>
                <View style={styles.itemCopy}>
                  <View style={styles.itemTitleRow}>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    {isUnread && <View style={styles.unreadDot} />}
                  </View>
                  {!!item.body && <Text style={styles.itemBody}>{item.body}</Text>}
                  <Text style={styles.itemDate}>{dateTimeLabel(item.published_at)}</Text>
                </View>
                {!!item.deep_link && (
                  <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                )}
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Card>
          <Text style={styles.emptyTitle}>You're all caught up.</Text>
          <Text style={styles.emptyText}>New Super Plus updates will appear here.</Text>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { alignItems: "flex-start", flexDirection: "row", gap: 12 },
  backButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  headingCopy: { flex: 1, gap: 5 },
  title: { color: colors.ink, fontSize: 29, fontWeight: "900", letterSpacing: -0.8, lineHeight: 34 },
  toolbar: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", gap: 10 },
  unreadText: { color: colors.muted, fontSize: 11, fontWeight: "800" },
  markAllButton: { minHeight: 38, justifyContent: "center", paddingHorizontal: 8 },
  markAllText: { color: colors.green2, fontSize: 11, fontWeight: "900" },
  disabled: { opacity: 0.45 },
  loadingCard: { alignItems: "center", paddingVertical: 32 },
  list: { gap: 10 },
  item: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 11,
    padding: 14,
  },
  itemUnread: { backgroundColor: "#FFF9F6", borderColor: "#F1CFC0" },
  iconWrap: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  iconWrapUnread: { borderColor: "rgba(0,0,0,0.04)", borderWidth: 1 },
  itemCopy: { flex: 1 },
  itemTitleRow: { alignItems: "center", flexDirection: "row", gap: 7 },
  itemTitle: { color: colors.ink, flex: 1, fontSize: 13, fontWeight: "900" },
  unreadDot: { backgroundColor: colors.green2, borderRadius: 99, height: 7, width: 7 },
  itemBody: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 4 },
  itemDate: { color: colors.muted, fontSize: 9, marginTop: 6 },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: "900", textAlign: "center" },
  emptyText: { color: colors.muted, fontSize: 12, marginTop: 5, textAlign: "center" },
});

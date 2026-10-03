import { Ionicons } from "@expo/vector-icons";
import { Redirect, router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useApp } from "../../lib/AppContext";
import { supabase } from "../../lib/supabase";
import { Card, colors, dateLabel, Screen, sharedStyles } from "../../lib/ui";

type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image: string | null;
  category: string;
  author_name: string;
  published_at: string | null;
};

export default function BlogIndexScreen() {
  const { session } = useApp();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadPosts = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    const { data, error: queryError } = await supabase
      .from("blog_posts")
      .select(
        "id,title,slug,excerpt,featured_image,category,author_name,published_at",
      )
      .eq("status", "published")
      .not("published_at", "is", null)
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false });

    if (queryError) {
      setError("Unable to load the blog right now. Pull down to try again.");
      setPosts([]);
    } else {
      setPosts((data ?? []) as BlogPost[]);
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  if (!session) return <Redirect href="/login" />;

  return (
    <Screen refreshing={refreshing} onRefresh={() => void loadPosts(true)}>
      <View style={styles.topRow}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={21} color={colors.ink} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={sharedStyles.kicker}>SUPER PLUS JOURNAL</Text>
          <Text style={styles.title}>Fitness, recovery & gym life.</Text>
          <Text style={sharedStyles.subtitle}>
            Read the latest Super Plus articles without leaving the app.
          </Text>
        </View>
      </View>

      {loading ? (
        <Card style={styles.loadingCard}>
          <ActivityIndicator color={colors.green} />
          <Text style={styles.loadingText}>Loading articles…</Text>
        </Card>
      ) : error ? (
        <Card style={styles.errorCard}>
          <Ionicons name="cloud-offline-outline" size={24} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      ) : posts.length === 0 ? (
        <Card>
          <Text style={styles.emptyTitle}>No articles yet</Text>
          <Text style={styles.emptyText}>
            New Super Plus posts will appear here as soon as they are published.
          </Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {posts.map((post) => (
            <Pressable
              key={post.id}
              style={({ pressed }) => [styles.postCard, pressed && styles.pressed]}
              onPress={() =>
                router.push({
                  pathname: "/blog/[slug]",
                  params: { slug: post.slug },
                })
              }
            >
              {post.featured_image ? (
                <Image source={{ uri: post.featured_image }} style={styles.cover} />
              ) : (
                <View style={styles.coverFallback}>
                  <Ionicons name="barbell-outline" size={34} color={colors.green2} />
                </View>
              )}

              <View style={styles.postBody}>
                <View style={styles.metaRow}>
                  <Text style={styles.category}>{post.category}</Text>
                  <Text style={styles.date}>{dateLabel(post.published_at)}</Text>
                </View>
                <Text style={styles.postTitle}>{post.title}</Text>
                {!!post.excerpt && (
                  <Text style={styles.excerpt} numberOfLines={3}>
                    {post.excerpt}
                  </Text>
                )}
                <View style={styles.readRow}>
                  <Text style={styles.readText}>Read article</Text>
                  <Ionicons name="arrow-forward" size={16} color={colors.green2} />
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
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
  headerCopy: { flex: 1, gap: 6 },
  title: {
    color: colors.ink,
    fontSize: 29,
    fontWeight: "900",
    letterSpacing: -0.8,
    lineHeight: 34,
  },
  loadingCard: { alignItems: "center", gap: 10, paddingVertical: 30 },
  loadingText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  errorCard: { alignItems: "center", gap: 10, backgroundColor: "#FFF3F1" },
  errorText: { color: colors.danger, fontSize: 13, fontWeight: "700", textAlign: "center" },
  emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: "900", textAlign: "center" },
  emptyText: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 6, textAlign: "center" },
  list: { gap: 16 },
  postCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
  },
  pressed: { opacity: 0.84 },
  cover: { width: "100%", height: 190, backgroundColor: colors.surfaceMuted },
  coverFallback: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    height: 150,
    justifyContent: "center",
  },
  postBody: { padding: 17 },
  metaRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", gap: 10 },
  category: { color: colors.green2, fontSize: 10, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" },
  date: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  postTitle: { color: colors.ink, fontSize: 20, fontWeight: "900", lineHeight: 25, marginTop: 9 },
  excerpt: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 8 },
  readRow: { alignItems: "center", flexDirection: "row", gap: 5, marginTop: 14 },
  readText: { color: colors.green2, fontSize: 12, fontWeight: "900" },
});

import { Ionicons } from "@expo/vector-icons";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
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
  content: string;
  featured_image: string | null;
  category: string;
  author_name: string;
  published_at: string | null;
};

type BlogComment = {
  id: string;
  post_id: string;
  member_id: string;
  parent_id: string | null;
  comment: string;
  created_at: string;
  member_name: string;
};

function readingTime(content: string) {
  const count = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(count / 200));
}

export default function BlogArticleScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { session, member } = useApp();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [comments, setComments] = useState<BlogComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [liking, setLiking] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadComments = useCallback(async (postId: string) => {
    setCommentsLoading(true);

    const { data, error: commentsError } = await supabase
      .from("blog_comments")
      .select("id,post_id,member_id,parent_id,comment,created_at,status")
      .eq("post_id", postId)
      .eq("status", "visible")
      .order("created_at", { ascending: true });

    if (commentsError || !data) {
      setComments([]);
      setCommentsLoading(false);
      return;
    }

    const memberIds = [...new Set(data.map((item) => item.member_id))];
    let memberNames: Record<string, string> = {};

    if (memberIds.length) {
      const { data: members } = await supabase
        .from("members")
        .select("id,full_name")
        .in("id", memberIds);

      memberNames = Object.fromEntries(
        (members ?? []).map((item) => [item.id, item.full_name || "Member"]),
      );
    }

    setComments(
      data.map((item) => ({
        id: item.id,
        post_id: item.post_id,
        member_id: item.member_id,
        parent_id: item.parent_id,
        comment: item.comment,
        created_at: item.created_at,
        member_name: memberNames[item.member_id] || "Member",
      })),
    );
    setCommentsLoading(false);
  }, []);

  const loadLikes = useCallback(
    async (postId: string) => {
      const { count } = await supabase
        .from("blog_likes")
        .select("id", { count: "exact", head: true })
        .eq("post_id", postId);

      setLikeCount(count ?? 0);

      if (!member?.id) {
        setLiked(false);
        return;
      }

      const { data } = await supabase
        .from("blog_likes")
        .select("id")
        .eq("post_id", postId)
        .eq("member_id", member.id)
        .maybeSingle();

      setLiked(!!data);
    },
    [member?.id],
  );

  const loadArticle = useCallback(
    async (isRefresh = false) => {
      if (!slug) return;

      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError("");

      const { data, error: queryError } = await supabase
        .from("blog_posts")
        .select(
          "id,title,slug,excerpt,content,featured_image,category,author_name,published_at",
        )
        .eq("slug", slug)
        .eq("status", "published")
        .not("published_at", "is", null)
        .lte("published_at", new Date().toISOString())
        .maybeSingle();

      if (queryError || !data) {
        setPost(null);
        setError("This article is unavailable.");
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const typedPost = data as BlogPost;
      setPost(typedPost);
      await Promise.all([loadComments(typedPost.id), loadLikes(typedPost.id)]);

      setLoading(false);
      setRefreshing(false);
    },
    [loadComments, loadLikes, slug],
  );

  useEffect(() => {
    void loadArticle();
  }, [loadArticle]);

  const topLevelComments = useMemo(
    () => comments.filter((item) => !item.parent_id),
    [comments],
  );

  function repliesFor(commentId: string) {
    return comments.filter((item) => item.parent_id === commentId);
  }

  async function toggleLike() {
    if (!post || !member?.id || liking) return;

    setLiking(true);

    if (liked) {
      const { error: deleteError } = await supabase
        .from("blog_likes")
        .delete()
        .eq("post_id", post.id)
        .eq("member_id", member.id);

      if (!deleteError) {
        setLiked(false);
        setLikeCount((value) => Math.max(0, value - 1));
      }
    } else {
      const { error: insertError } = await supabase.from("blog_likes").insert({
        post_id: post.id,
        member_id: member.id,
      });

      if (!insertError) {
        setLiked(true);
        setLikeCount((value) => value + 1);
      }
    }

    setLiking(false);
  }

  async function submitComment() {
    if (!post || !member?.id || submitting) return;

    const text = commentText.trim();
    if (!text) return;
    if (text.length > 2000) {
      Alert.alert("Comment too long", "Please keep your comment under 2,000 characters.");
      return;
    }

    setSubmitting(true);
    const { error: insertError } = await supabase.from("blog_comments").insert({
      post_id: post.id,
      member_id: member.id,
      comment: text,
    });

    if (insertError) {
      Alert.alert("Could not post comment", "Please try again.");
    } else {
      setCommentText("");
      await loadComments(post.id);
    }

    setSubmitting(false);
  }

  function requestDeleteComment(commentId: string) {
    if (!member?.id || !post) return;

    Alert.alert("Delete comment?", "This will remove your comment from the article.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void (async () => {
            const { error: deleteError } = await supabase
              .from("blog_comments")
              .delete()
              .eq("id", commentId)
              .eq("member_id", member.id);

            if (!deleteError) await loadComments(post.id);
          })();
        },
      },
    ]);
  }

  async function shareArticle() {
    if (!post) return;

    const url = `https://www.superplusfitness.com/blog/${post.slug}`;
    await Share.share({
      title: post.title,
      message: `${post.title}\n${url}`,
      url,
    });
  }

  if (!session) return <Redirect href="/login" />;

  if (loading) {
    return (
      <Screen>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.green} />
          <Text style={styles.loadingText}>Opening article…</Text>
        </View>
      </Screen>
    );
  }

  if (!post) {
    return (
      <Screen>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={21} color={colors.ink} />
        </Pressable>
        <Card style={styles.errorCard}>
          <Text style={styles.errorTitle}>Article unavailable</Text>
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen refreshing={refreshing} onRefresh={() => void loadArticle(true)}>
      <View style={styles.actionRow}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={21} color={colors.ink} />
        </Pressable>
        <Pressable style={styles.shareButton} onPress={() => void shareArticle()}>
          <Ionicons name="share-outline" size={20} color={colors.green} />
          <Text style={styles.shareText}>Share</Text>
        </Pressable>
      </View>

      <View style={styles.articleHeader}>
        <Text style={sharedStyles.kicker}>{post.category.toUpperCase()}</Text>
        <Text style={styles.title}>{post.title}</Text>
        {!!post.excerpt && <Text style={styles.excerpt}>{post.excerpt}</Text>}
        <Text style={styles.byline}>
          {post.author_name} · {dateLabel(post.published_at)} · {readingTime(post.content)} min read
        </Text>
      </View>

      {post.featured_image ? (
        <Image source={{ uri: post.featured_image }} style={styles.hero} />
      ) : (
        <View style={styles.heroFallback}>
          <Ionicons name="barbell-outline" size={44} color={colors.green2} />
        </View>
      )}

      <View style={styles.interactions}>
        <Pressable
          style={[styles.interactionButton, liked && styles.interactionButtonActive]}
          disabled={liking || !member}
          onPress={() => void toggleLike()}
        >
          <Ionicons
            name={liked ? "heart" : "heart-outline"}
            size={20}
            color={liked ? "#FFFFFF" : colors.green}
          />
          <Text style={[styles.interactionText, liked && styles.interactionTextActive]}>
            {likeCount} {likeCount === 1 ? "Like" : "Likes"}
          </Text>
        </Pressable>

        <View style={styles.interactionButton}>
          <Ionicons name="chatbubble-outline" size={19} color={colors.green} />
          <Text style={styles.interactionText}>
            {comments.length} {comments.length === 1 ? "Comment" : "Comments"}
          </Text>
        </View>
      </View>

      <Card style={styles.articleBodyCard}>
        <Text style={styles.articleBody}>{post.content}</Text>
      </Card>

      <View style={styles.commentsHeader}>
        <Text style={sharedStyles.kicker}>COMMUNITY</Text>
        <Text style={styles.commentsTitle}>Join the conversation</Text>
      </View>

      <Card>
        <Text style={styles.commentingAs}>
          Commenting as {member?.full_name || "Super Plus member"}
        </Text>
        <TextInput
          style={styles.commentInput}
          value={commentText}
          onChangeText={setCommentText}
          placeholder="Write a comment…"
          placeholderTextColor={colors.muted}
          multiline
          maxLength={2000}
          textAlignVertical="top"
        />
        <View style={styles.commentFooter}>
          <Text style={styles.counter}>{commentText.length}/2000</Text>
          <Pressable
            style={[
              styles.postButton,
              (!commentText.trim() || submitting || !member) && styles.postButtonDisabled,
            ]}
            disabled={!commentText.trim() || submitting || !member}
            onPress={() => void submitComment()}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="send" size={15} color="#FFFFFF" />
                <Text style={styles.postButtonText}>Post</Text>
              </>
            )}
          </Pressable>
        </View>
      </Card>

      {commentsLoading ? (
        <Card style={styles.loadingCard}>
          <ActivityIndicator color={colors.green} />
        </Card>
      ) : topLevelComments.length === 0 ? (
        <Card>
          <Text style={styles.noComments}>No comments yet. Be the first to share your thoughts.</Text>
        </Card>
      ) : (
        <View style={styles.commentsList}>
          {topLevelComments.map((comment) => (
            <View key={comment.id} style={styles.commentCard}>
              <CommentItem
                item={comment}
                mine={comment.member_id === member?.id}
                onDelete={requestDeleteComment}
              />
              {repliesFor(comment.id).map((reply) => (
                <View key={reply.id} style={styles.replyWrap}>
                  <CommentItem
                    item={reply}
                    mine={reply.member_id === member?.id}
                    onDelete={requestDeleteComment}
                  />
                </View>
              ))}
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

function CommentItem({
  item,
  mine,
  onDelete,
}: {
  item: BlogComment;
  mine: boolean;
  onDelete: (id: string) => void;
}) {
  return (
    <View>
      <View style={styles.commentTop}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={15} color={colors.green2} />
        </View>
        <View style={styles.commentNameWrap}>
          <Text style={styles.commentName}>{item.member_name}</Text>
          <Text style={styles.commentDate}>{dateLabel(item.created_at)}</Text>
        </View>
        {mine && (
          <Pressable style={styles.deleteButton} onPress={() => onDelete(item.id)}>
            <Ionicons name="trash-outline" size={17} color={colors.danger} />
          </Pressable>
        )}
      </View>
      <Text style={styles.commentBody}>{item.comment}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingWrap: { alignItems: "center", gap: 10, paddingVertical: 90 },
  loadingText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  actionRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
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
  shareButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
  },
  shareText: { color: colors.green, fontSize: 12, fontWeight: "900" },
  articleHeader: { gap: 9 },
  title: { color: colors.ink, fontSize: 31, fontWeight: "900", letterSpacing: -0.9, lineHeight: 36 },
  excerpt: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  byline: { color: colors.muted, fontSize: 11, fontWeight: "700", lineHeight: 17 },
  hero: { backgroundColor: colors.surfaceMuted, borderRadius: 22, height: 220, width: "100%" },
  heroFallback: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 22,
    height: 180,
    justifyContent: "center",
  },
  interactions: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  interactionButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    minHeight: 42,
    paddingHorizontal: 14,
  },
  interactionButtonActive: { backgroundColor: colors.green, borderColor: colors.green },
  interactionText: { color: colors.green, fontSize: 12, fontWeight: "900" },
  interactionTextActive: { color: "#FFFFFF" },
  articleBodyCard: { paddingVertical: 22 },
  articleBody: { color: colors.ink, fontSize: 15, lineHeight: 26 },
  commentsHeader: { gap: 4, marginTop: 5 },
  commentsTitle: { color: colors.ink, fontSize: 24, fontWeight: "900", letterSpacing: -0.5 },
  commentingAs: { color: colors.ink, fontSize: 12, fontWeight: "800", marginBottom: 10 },
  commentInput: {
    backgroundColor: colors.background,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 14,
    lineHeight: 21,
    minHeight: 110,
    padding: 13,
  },
  commentFooter: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  counter: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  postButton: {
    alignItems: "center",
    backgroundColor: colors.green,
    borderRadius: 12,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 40,
    minWidth: 86,
    paddingHorizontal: 14,
  },
  postButtonDisabled: { opacity: 0.45 },
  postButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  loadingCard: { alignItems: "center" },
  noComments: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: "center" },
  commentsList: { gap: 12 },
  commentCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    padding: 15,
  },
  commentTop: { alignItems: "center", flexDirection: "row", gap: 9 },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  commentNameWrap: { flex: 1 },
  commentName: { color: colors.ink, fontSize: 12, fontWeight: "900" },
  commentDate: { color: colors.muted, fontSize: 10, marginTop: 2 },
  deleteButton: { padding: 6 },
  commentBody: { color: colors.ink, fontSize: 13, lineHeight: 20, marginTop: 10 },
  replyWrap: { borderLeftColor: colors.line, borderLeftWidth: 2, marginLeft: 16, marginTop: 14, paddingLeft: 13 },
  errorCard: { alignItems: "center", gap: 6, marginTop: 16 },
  errorTitle: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  errorText: { color: colors.muted, fontSize: 13, textAlign: "center" },
});

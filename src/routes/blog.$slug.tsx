import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Dumbbell,
  Heart,
  MessageCircle,
  Send,
  Share2,
  Trash2,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/site";
import { supabase } from "@/lib/supabase";

type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  featured_image: string | null;
  category: string;
  author_name: string;
  status: "draft" | "scheduled" | "published";
  featured: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type BlogComment = {
  id: string;
  post_id: string;
  member_id: string;
  parent_id: string | null;
  comment: string;
  status: "visible" | "hidden" | "reported";
  created_at: string;
  updated_at: string;
  member?: {
    full_name: string | null;
  } | null;
};

type Member = {
  id: string;
  auth_user_id: string | null;
  full_name: string;
};

const BLOG_AUTHOR_IMAGE = "data:image/webp;base64,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";

export const Route = createFileRoute("/blog/$slug")({
  component: BlogArticlePage,
});

function formatDate(date: string | null) {
  if (!date) return "";

  return new Date(date).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getReadingTime(content: string) {
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

function BlogArticlePage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();

  const [post, setPost] = useState<BlogPost | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<BlogPost[]>([]);
  const [comments, setComments] = useState<BlogComment[]>([]);
  const [member, setMember] = useState<Member | null>(null);

  const [loading, setLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(true);

  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  const [liking, setLiking] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  const [shareMessage, setShareMessage] = useState("");

  useEffect(() => {
    loadCurrentMember();
  }, []);

  useEffect(() => {
    loadArticle();
  }, [slug]);

  async function loadCurrentMember() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      setMember(null);
      return null;
    }

    const { data } = await supabase
      .from("members")
      .select("id, auth_user_id, full_name")
      .eq("auth_user_id", session.user.id)
      .maybeSingle();

    const currentMember = data || null;

    setMember(currentMember);

    return currentMember;
  }

  async function loadArticle() {
    setLoading(true);

    const { data, error } = await supabase
      .from("blog_posts")
      .select(
        `
          id,
          title,
          slug,
          excerpt,
          content,
          featured_image,
          category,
          author_name,
          status,
          featured,
          published_at,
          created_at,
          updated_at
        `,
      )
      .eq("slug", slug)
      .eq("status", "published")
      .not("published_at", "is", null)
      .lte("published_at", new Date().toISOString())
      .maybeSingle();

    if (error || !data) {
      setPost(null);
      setLoading(false);
      return;
    }

    const loadedPost = data as BlogPost;

    setPost(loadedPost);

    await Promise.all([
      loadComments(loadedPost.id),
      loadLikes(loadedPost.id),
      loadRelatedPosts(loadedPost),
    ]);

    setLoading(false);
  }

  async function loadComments(postId: string) {
    setCommentsLoading(true);

    const { data } = await supabase
      .from("blog_comments")
      .select(
        `
          id,
          post_id,
          member_id,
          parent_id,
          comment,
          status,
          created_at,
          updated_at
        `,
      )
      .eq("post_id", postId)
      .eq("status", "visible")
      .order("created_at", {
        ascending: true,
      });

    if (!data) {
      setComments([]);
      setCommentsLoading(false);
      return;
    }

    const memberIds = [
      ...new Set(data.map((comment) => comment.member_id)),
    ];

    let memberMap: Record<string, string> = {};

    if (memberIds.length > 0) {
      const { data: members } = await supabase
        .from("members")
        .select("id, full_name")
        .in("id", memberIds);

      if (members) {
        memberMap = Object.fromEntries(
          members.map((item) => [
            item.id,
            item.full_name || "Member",
          ]),
        );
      }
    }

    setComments(
      data.map((comment) => ({
        ...comment,
        member: {
          full_name:
            memberMap[comment.member_id] || "Member",
        },
      })) as BlogComment[],
    );

    setCommentsLoading(false);
  }

  async function loadLikes(postId: string) {
    const { count } = await supabase
      .from("blog_likes")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("post_id", postId);

    setLikeCount(count || 0);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      setLiked(false);
      return;
    }

    const { data: currentMember } = await supabase
      .from("members")
      .select("id")
      .eq("auth_user_id", session.user.id)
      .maybeSingle();

    if (!currentMember) {
      setLiked(false);
      return;
    }

    const { data: like } = await supabase
      .from("blog_likes")
      .select("id")
      .eq("post_id", postId)
      .eq("member_id", currentMember.id)
      .maybeSingle();

    setLiked(!!like);
  }

  async function loadRelatedPosts(currentPost: BlogPost) {
    const { data } = await supabase
      .from("blog_posts")
      .select(
        `
          id,
          title,
          slug,
          excerpt,
          content,
          featured_image,
          category,
          author_name,
          status,
          featured,
          published_at,
          created_at,
          updated_at
        `,
      )
      .eq("status", "published")
      .not("published_at", "is", null)
      .lte("published_at", new Date().toISOString())
      .eq("category", currentPost.category)
      .neq("id", currentPost.id)
      .order("published_at", {
        ascending: false,
      })
      .limit(3);

    setRelatedPosts((data || []) as BlogPost[]);
  }

  const commentCount = comments.length;

  const topLevelComments = useMemo(
    () =>
      comments.filter(
        (comment) => !comment.parent_id,
      ),
    [comments],
  );

  function repliesFor(commentId: string) {
    return comments.filter(
      (comment) => comment.parent_id === commentId,
    );
  }

  async function handleLike() {
    if (!post) return;

    if (!member) {
      navigate({
        to: "/login",
      });
      return;
    }

    if (liking) return;

    setLiking(true);

    if (liked) {
      const { error } = await supabase
        .from("blog_likes")
        .delete()
        .eq("post_id", post.id)
        .eq("member_id", member.id);

      if (!error) {
        setLiked(false);
        setLikeCount((count) =>
          Math.max(0, count - 1),
        );
      }
    } else {
      const { error } = await supabase
        .from("blog_likes")
        .insert({
          post_id: post.id,
          member_id: member.id,
        });

      if (!error) {
        setLiked(true);
        setLikeCount((count) => count + 1);
      }
    }

    setLiking(false);
  }

  async function handleCommentSubmit() {
    if (!post) return;

    if (!member) {
      navigate({
        to: "/login",
      });
      return;
    }

    const text = commentText.trim();

    if (!text) return;

    if (text.length > 2000) return;

    setSubmittingComment(true);

    const { error } = await supabase
      .from("blog_comments")
      .insert({
        post_id: post.id,
        member_id: member.id,
        comment: text,
      });

    if (!error) {
      setCommentText("");
      await loadComments(post.id);
    }

    setSubmittingComment(false);
  }

  async function handleDeleteComment(commentId: string) {
    if (!member) return;

    const confirmed = window.confirm(
      "Delete this comment?",
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("blog_comments")
      .delete()
      .eq("id", commentId)
      .eq("member_id", member.id);

    if (!error && post) {
      await loadComments(post.id);
    }
  }

  async function handleShare() {
    if (!post) return;

    const url = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({
          title: post.title,
          text:
            post.excerpt ||
            "Read this article from Super Plus Fitness.",
          url,
        });

        return;
      }

      await navigator.clipboard.writeText(url);

      setShareMessage("Link copied!");

      window.setTimeout(() => {
        setShareMessage("");
      }, 2500);
    } catch {
      // User cancelled sharing.
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border">
          <div className="container mx-auto flex h-20 items-center px-4">
            <Logo />
          </div>
        </header>

        <main className="container mx-auto max-w-5xl px-4 py-12">
          <div className="animate-pulse space-y-6">
            <div className="h-5 w-32 rounded bg-muted" />
            <div className="h-12 w-4/5 rounded bg-muted" />
            <div className="h-5 w-1/3 rounded bg-muted" />
            <div className="aspect-[16/8] rounded-3xl bg-muted" />

            <div className="space-y-3">
              <div className="h-4 rounded bg-muted" />
              <div className="h-4 rounded bg-muted" />
              <div className="h-4 w-4/5 rounded bg-muted" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border">
          <div className="container mx-auto flex h-20 items-center justify-between px-4">
            <Logo />

            <Link to="/blog">
              <Button variant="outline">
                <ArrowLeft />
                Back to Blog
              </Button>
            </Link>
          </div>
        </header>

        <main className="container mx-auto px-4 py-20 text-center">
          <BookOpen className="mx-auto h-14 w-14 text-muted-foreground" />

          <h1 className="mt-6 text-3xl font-black">
            Article not found
          </h1>

          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            This article may have been removed or is no longer
            available.
          </p>

          <Link
            to="/blog"
            className="mt-7 inline-block"
          >
            <Button>
              <ArrowLeft />
              Back to Blog
            </Button>
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-20 items-center justify-between px-4">
          <Logo />

          <div className="flex items-center gap-3">
            <Link
              to="/blog"
              className="hidden sm:block"
            >
              <Button variant="ghost">
                <ArrowLeft />
                Blog
              </Button>
            </Link>

            <Link to="/join">
              <Button>Join Now</Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Article */}
        <article>
          <div className="container mx-auto max-w-5xl px-4 pt-10 md:pt-14">
            <Link
              to="/blog"
              className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to all articles
            </Link>

            <div className="mt-8">
              <div className="flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-wider text-primary">
                <span>{post.category}</span>

                <span className="text-muted-foreground">
                  •
                </span>

                <span className="text-muted-foreground">
                  {getReadingTime(post.content)} min read
                </span>
              </div>

              <h1 className="mt-4 max-w-4xl text-4xl font-black leading-tight tracking-tight sm:text-5xl md:text-6xl">
                {post.title}
              </h1>

              {post.excerpt && (
                <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground sm:text-xl">
                  {post.excerpt}
                </p>
              )}

              <div className="mt-7 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <img
                    src={BLOG_AUTHOR_IMAGE}
                    alt="Super Plus Fitness"
                    className="h-9 w-9 rounded-full border border-border bg-white object-cover"
                  />

                  <div>
                    <p className="font-semibold text-foreground">
                      {post.author_name}
                    </p>

                    <p>
                      {formatDate(post.published_at)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Hero image */}
            <div className="mt-10 overflow-hidden rounded-3xl bg-muted">
              {post.featured_image ? (
                <img
                  src={post.featured_image}
                  alt={post.title}
                  className="max-h-[600px] w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[16/8] items-center justify-center bg-gradient-to-br from-primary/20 via-muted to-background">
                  <div className="rounded-full bg-primary/10 p-8">
                    <Dumbbell className="h-16 w-16 text-primary/50" />
                  </div>
                </div>
              )}
            </div>

            {/* Interaction bar */}
            <div className="mt-7 flex flex-wrap items-center gap-3 border-b border-border pb-7">
              <Button
                type="button"
                variant={liked ? "default" : "outline"}
                onClick={handleLike}
                disabled={liking}
              >
                <Heart
                  className={
                    liked ? "fill-current" : ""
                  }
                />

                {likeCount}
                {likeCount === 1
                  ? " Like"
                  : " Likes"}
              </Button>

              <a href="#comments">
                <Button
                  type="button"
                  variant="outline"
                >
                  <MessageCircle />

                  {commentCount}
                  {commentCount === 1
                    ? " Comment"
                    : " Comments"}
                </Button>
              </a>

              <Button
                type="button"
                variant="outline"
                onClick={handleShare}
              >
                <Share2 />
                Share
              </Button>

              {shareMessage && (
                <span className="text-sm font-semibold text-primary">
                  {shareMessage}
                </span>
              )}
            </div>

            {/* Article body */}
            <div className="mx-auto max-w-3xl py-10">
              <div className="whitespace-pre-wrap text-base leading-8 text-foreground/90 sm:text-lg">
                {post.content}
              </div>
            </div>
          </div>
        </article>

        {/* Comments */}
        <section
          id="comments"
          className="border-t border-border bg-muted/20"
        >
          <div className="container mx-auto max-w-5xl px-4 py-12 md:py-16">
            <div className="mx-auto max-w-3xl">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                    Community
                  </p>

                  <h2 className="mt-1 text-3xl font-black">
                    Join the conversation
                  </h2>
                </div>

                <div className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
                  <MessageCircle className="h-4 w-4" />
                  {commentCount}
                </div>
              </div>

              {/* Comment form */}
              <div className="mt-8 rounded-2xl border border-border bg-background p-5 sm:p-6">
                {member ? (
                  <>
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <UserRound className="h-5 w-5 text-primary" />
                      </div>

                      <div>
                        <p className="text-sm font-bold">
                          {member.full_name}
                        </p>

                        <p className="text-xs text-muted-foreground">
                          Share your thoughts with the community.
                        </p>
                      </div>
                    </div>

                    <textarea
                      value={commentText}
                      onChange={(event) =>
                        setCommentText(
                          event.target.value,
                        )
                      }
                      placeholder="Write a comment..."
                      maxLength={2000}
                      rows={4}
                      className="w-full resize-none rounded-xl border border-border bg-muted/20 p-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="text-xs text-muted-foreground">
                        {commentText.length}/2000
                      </span>

                      <Button
                        type="button"
                        onClick={handleCommentSubmit}
                        disabled={
                          submittingComment ||
                          !commentText.trim()
                        }
                      >
                        <Send />

                        {submittingComment
                          ? "Posting..."
                          : "Post Comment"}
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center">
                    <h3 className="text-lg font-bold">
                      Want to join the conversation?
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Log in to your Super Plus Fitness member
                      account to like articles and post comments.
                    </p>

                    <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
                      <Link to="/login">
                        <Button className="w-full sm:w-auto">
                          Member Login
                        </Button>
                      </Link>

                      <Link to="/join">
                        <Button
                          variant="outline"
                          className="w-full sm:w-auto"
                        >
                          Become a Member
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Comments list */}
              <div className="mt-8">
                {commentsLoading ? (
                  <div className="space-y-5">
                    {[1, 2, 3].map((item) => (
                      <div
                        key={item}
                        className="animate-pulse rounded-2xl border border-border bg-background p-5"
                      >
                        <div className="h-4 w-32 rounded bg-muted" />

                        <div className="mt-4 h-4 rounded bg-muted" />

                        <div className="mt-2 h-4 w-4/5 rounded bg-muted" />
                      </div>
                    ))}
                  </div>
                ) : topLevelComments.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-background p-10 text-center">
                    <MessageCircle className="mx-auto h-10 w-10 text-muted-foreground" />

                    <h3 className="mt-4 text-lg font-bold">
                      No comments yet
                    </h3>

                    <p className="mt-2 text-sm text-muted-foreground">
                      Be the first Super Plus member to share your
                      thoughts.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {topLevelComments.map((comment) => (
                      <CommentCard
                        key={comment.id}
                        comment={comment}
                        replies={repliesFor(comment.id)}
                        currentMember={member}
                        onDelete={handleDeleteComment}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Related articles */}
        {relatedPosts.length > 0 && (
          <section className="border-t border-border">
            <div className="container mx-auto max-w-6xl px-4 py-12 md:py-16">
              <div className="mb-7">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                  Keep Reading
                </p>

                <h2 className="mt-1 text-3xl font-black">
                  More from {post.category}
                </h2>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                {relatedPosts.map((related) => (
                  <Link
                    key={related.id}
                    to="/blog/$slug"
                    params={{
                      slug: related.slug,
                    }}
                    className="group overflow-hidden rounded-2xl border border-border bg-card transition hover:-translate-y-1 hover:shadow-lg"
                  >
                    <div className="aspect-[16/9] overflow-hidden bg-muted">
                      {related.featured_image ? (
                        <img
                          src={related.featured_image}
                          alt={related.title}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <BookOpen className="h-10 w-10 text-primary/40" />
                        </div>
                      )}
                    </div>

                    <div className="p-5">
                      <p className="text-xs font-bold uppercase tracking-wider text-primary">
                        {related.category}
                      </p>

                      <h3 className="mt-2 line-clamp-2 text-lg font-bold group-hover:text-primary">
                        {related.title}
                      </h3>

                      <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-primary">
                        Read Article
                        <ArrowRight className="h-4 w-4" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
            <Logo />

            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Super Plus Fitness & Spa.
              All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function CommentCard({
  comment,
  replies,
  currentMember,
  onDelete,
}: {
  comment: BlogComment;
  replies: BlogComment[];
  currentMember: Member | null;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <UserRound className="h-5 w-5 text-primary" />
          </div>

          <div>
            <p className="text-sm font-bold">
              {comment.member?.full_name || "Member"}
            </p>

            <p className="text-xs text-muted-foreground">
              {new Date(
                comment.created_at,
              ).toLocaleDateString("en-NG", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>
        </div>

        {currentMember?.id === comment.member_id && (
          <button
            type="button"
            onClick={() => onDelete(comment.id)}
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
            aria-label="Delete comment"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-foreground/90">
        {comment.comment}
      </p>

      {replies.length > 0 && (
        <div className="mt-5 space-y-4 border-l-2 border-border pl-5">
          {replies.map((reply) => (
            <div key={reply.id}>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                  <UserRound className="h-4 w-4 text-muted-foreground" />
                </div>

                <div>
                  <p className="text-xs font-bold">
                    {reply.member?.full_name || "Member"}
                  </p>

                  <p className="text-[11px] text-muted-foreground">
                    {new Date(
                      reply.created_at,
                    ).toLocaleDateString("en-NG", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>

              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                {reply.comment}
              </p>

              {currentMember?.id === reply.member_id && (
                <button
                  type="button"
                  onClick={() => onDelete(reply.id)}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
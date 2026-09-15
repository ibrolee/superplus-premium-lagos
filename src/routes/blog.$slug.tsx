import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
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
    loadArticle();
    loadCurrentMember();
  }, [slug]);

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

  async function loadCurrentMember() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      setMember(null);
      return;
    }

    const { data } = await supabase
      .from("members")
      .select("id, auth_user_id, full_name")
      .eq("auth_user_id", session.user.id)
      .maybeSingle();

    setMember(data || null);
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
      .order("created_at", { ascending: true });

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

    if (!member) return;

    const { data } = await supabase
      .from("blog_likes")
      .select("id")
      .eq("post_id", postId)
      .eq("member_id", member.id)
      .maybeSingle();

    setLiked(!!data);
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
      .order("published_at", { ascending: false })
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
        setLikeCount((count) => Math.max(0, count - 1));
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

    if (text.length > 2000) {
      return;
    }

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

  async function handleDeleteComment(
    commentId: string,
  ) {
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
            `Read this article from Super Plus Fitness.`,
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
            This article may have been removed or is no
            longer available.
          </p>

          <Link to="/blog" className="mt-7 inline-block">
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

      {/* Article */}
      <main>
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
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                    <UserRound className="h-4 w-4 text-primary" />
                  </div>

                  <div>
                    <p className="font-semibold text-foreground">
                      {post.author_name}
                    </p>
                    <p>{formatDate(post.published_at)}</p>
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
                  <DumbbellIcon />
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
                    liked
                      ? "fill-current"
                      : ""
                  }
                />
                {likeCount}
                {likeCount === 1 ? " Like" : " Likes"}
              </Button>

              <a href="#comments">
                <Button type="button" variant="outline">
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
                        setCommentText(event.target.value)
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

        {/* Related */}
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
                    params={{ slug: related.slug }}
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

function DumbbellIcon() {
  return (
    <div className="flex h-full min-h-[300px] items-center justify-center">
      <div className="rounded-full bg-primary/10 p-8">
        <BookOpen className="h-16 w-16 text-primary/50" />
      </div>
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
import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Edit3,
  FileText,
  Loader2,
  LogOut,
  Plus,
  Save,
  ShieldCheck,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
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

type StaffUser = {
  id: string;
  auth_user_id: string;
  role: string;
  active: boolean;
};

const categories = [
  "Fitness",
  "Nutrition",
  "Recovery",
  "Wellness",
  "Weight Loss",
  "Muscle Building",
  "Training",
  "Gym Tips",
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function formatDate(date: string | null) {
  if (!date) return "Not scheduled";

  return new Date(date).toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    hour12: true,
    minute: "2-digit",
  });
}

function getStatusLabel(post: BlogPost) {
  if (
    post.status === "scheduled" &&
    post.published_at &&
    new Date(post.published_at) <= new Date()
  ) {
    return "published";
  }

  return post.status;
}

export const Route = createFileRoute("/staff-blog")({
  component: StaffBlogPage,
});

function StaffBlogPage() {
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [selectedPost, setSelectedPost] =
    useState<BlogPost | null>(null);

  const [showEditor, setShowEditor] = useState(false);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [featuredImage, setFeaturedImage] =
    useState("");
  const [category, setCategory] = useState("Fitness");
  const [authorName, setAuthorName] =
    useState("Super Plus Fitness");
  const [featured, setFeatured] = useState(false);
  const [publishMode, setPublishMode] = useState<
    "draft" | "published" | "scheduled"
  >("draft");
  const [scheduledDate, setScheduledDate] =
    useState("");

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(
    null,
  );
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    checkAccess();
  }, []);

  async function checkAccess() {
    setCheckingAccess(true);
    setError("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
  window.location.href = "/staff";
  return;
}

    const { data: staff, error: staffError } =
      await supabase
        .from("staff_users")
        .select(
          "id, auth_user_id, role, active",
        )
        .eq("auth_user_id", session.user.id)
        .eq("active", true)
        .maybeSingle();

    if (
      staffError ||
      !staff ||
      !["admin", "owner", "manager"].includes(
        String(staff.role).toLowerCase(),
      )
    ) {
      setAuthorized(false);
      setCheckingAccess(false);
      return;
    }

    setAuthorized(true);
    setCheckingAccess(false);

    await loadPosts();
  }

  async function loadPosts() {
    setLoading(true);

    const { data, error: loadError } =
      await supabase
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
        .order("created_at", {
          ascending: false,
        });

    if (loadError) {
      setError(loadError.message);
      setPosts([]);
    } else {
      setPosts((data || []) as BlogPost[]);
    }

    setLoading(false);
  }

  function resetEditor() {
    setSelectedPost(null);
    setTitle("");
    setSlug("");
    setExcerpt("");
    setContent("");
    setFeaturedImage("");
    setCategory("Fitness");
    setAuthorName("Super Plus Fitness");
    setFeatured(false);
    setPublishMode("draft");
    setScheduledDate("");
    setError("");
    setSuccess("");
  }

  function openNewPost() {
    resetEditor();
    setShowEditor(true);
  }

  function openEditPost(post: BlogPost) {
    setSelectedPost(post);
    setTitle(post.title);
    setSlug(post.slug);
    setExcerpt(post.excerpt || "");
    setContent(post.content);
    setFeaturedImage(post.featured_image || "");
    setCategory(post.category);
    setAuthorName(post.author_name);
    setFeatured(post.featured);

    if (
      post.status === "scheduled" &&
      post.published_at
    ) {
      setPublishMode("scheduled");

      const date = new Date(post.published_at);

      const localDate = new Date(
        date.getTime() -
          date.getTimezoneOffset() * 60000,
      )
        .toISOString()
        .slice(0, 16);

      setScheduledDate(localDate);
    } else {
      setPublishMode(post.status);
      setScheduledDate("");
    }

    setError("");
    setSuccess("");
    setShowEditor(true);
  }

  function handleTitleChange(value: string) {
    setTitle(value);

    if (!selectedPost) {
      setSlug(slugify(value));
    }
  }

  function validatePost() {
    if (!title.trim()) {
      return "Please enter a blog title.";
    }

    if (!content.trim()) {
      return "Please enter the article content.";
    }

    if (!slug.trim()) {
      return "Please enter a URL slug.";
    }

    if (
      publishMode === "scheduled" &&
      !scheduledDate
    ) {
      return "Please choose a date and time for the scheduled post.";
    }

    if (
      publishMode === "scheduled" &&
      scheduledDate &&
      new Date(scheduledDate) <= new Date()
    ) {
      return "Scheduled date and time must be in the future.";
    }

    return "";
  }

  async function savePost() {
    setError("");
    setSuccess("");

    const validationError = validatePost();

    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);

    const finalSlug = slugify(slug);

    let status:
      | "draft"
      | "published"
      | "scheduled" = publishMode;

    let publishedAt: string | null = null;

    if (publishMode === "published") {
      status = "published";
      publishedAt = new Date().toISOString();
    }

    if (publishMode === "scheduled") {
      status = "scheduled";
      publishedAt = new Date(
        scheduledDate,
      ).toISOString();
    }

    const payload = {
      title: title.trim(),
      slug: finalSlug,
      excerpt: excerpt.trim() || null,
      content: content.trim(),
      featured_image:
        featuredImage.trim() || null,
      category,
      author_name:
        authorName.trim() || "Super Plus Fitness",
      status,
      featured,
      published_at: publishedAt,
    };

    if (selectedPost) {
      const { error: updateError } =
        await supabase
          .from("blog_posts")
          .update(payload)
          .eq("id", selectedPost.id);

      if (updateError) {
        if (
          updateError.message
            .toLowerCase()
            .includes("duplicate")
        ) {
          setError(
            "That URL slug is already being used. Please choose another one.",
          );
        } else {
          setError(updateError.message);
        }

        setSaving(false);
        return;
      }

      setSuccess("Blog post updated successfully.");
    } else {
      const { error: insertError } =
        await supabase
          .from("blog_posts")
          .insert(payload);

      if (insertError) {
        if (
          insertError.message
            .toLowerCase()
            .includes("duplicate")
        ) {
          setError(
            "That URL slug is already being used. Please choose another one.",
          );
        } else {
          setError(insertError.message);
        }

        setSaving(false);
        return;
      }

      setSuccess("Blog post created successfully.");
    }

    await loadPosts();
    setSaving(false);

    window.setTimeout(() => {
      setShowEditor(false);
      resetEditor();
    }, 700);
  }

  async function deletePost(post: BlogPost) {
    const confirmed = window.confirm(
      `Delete "${post.title}"? This cannot be undone.`,
    );

    if (!confirmed) return;

    setDeleting(post.id);
    setError("");

    const { error: deleteError } =
      await supabase
        .from("blog_posts")
        .delete()
        .eq("id", post.id);

    if (deleteError) {
      setError(deleteError.message);
    } else {
      setSuccess("Blog post deleted.");
      await loadPosts();
    }

    setDeleting(null);
  }

  async function toggleFeatured(post: BlogPost) {
    const { error: updateError } =
      await supabase
        .from("blog_posts")
        .update({
          featured: !post.featured,
        })
        .eq("id", post.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await loadPosts();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const counts = useMemo(() => {
    return {
      all: posts.length,
      published: posts.filter(
        (post) =>
          getStatusLabel(post) === "published",
      ).length,
      scheduled: posts.filter(
        (post) => post.status === "scheduled",
      ).length,
      drafts: posts.filter(
        (post) => post.status === "draft",
      ).length,
    };
  }, [posts]);

  if (checkingAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Checking admin access...
        </div>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-destructive" />

          <h1 className="mt-5 text-2xl font-black">
            Access Restricted
          </h1>

          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            You do not have permission to manage the Super Plus
            Fitness blog.
          </p>

          <Button
            className="mt-6"
            onClick={() => {
              window.location.href = "/staff";
            }}
          >
            Back to Staff
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
              Super Plus Fitness
            </p>

            <h1 className="text-xl font-black">
              Blog Management
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={openNewPost}
            >
              <Plus />
              New Post
            </Button>

            <Button
              variant="ghost"
              onClick={handleLogout}
              title="Log out"
            >
              <LogOut />
              <span className="hidden sm:inline">
                Logout
              </span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        {/* Page intro */}
        <div className="mb-8">
          <p className="text-sm font-medium text-muted-foreground">
            Create, schedule and manage your fitness content.
          </p>

          <h2 className="mt-1 text-3xl font-black tracking-tight">
            Your Fitness Blog
          </h2>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <span>{error}</span>

            <button
              type="button"
              onClick={() => setError("")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-700 dark:text-green-400">
            <CheckCircle2 className="h-5 w-5" />
            {success}
          </div>
        )}

        {/* Stats */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="All Posts"
            value={counts.all}
            icon={<FileText />}
          />

          <StatCard
            label="Published"
            value={counts.published}
            icon={<CheckCircle2 />}
          />

          <StatCard
            label="Scheduled"
            value={counts.scheduled}
            icon={<CalendarDays />}
          />

          <StatCard
            label="Drafts"
            value={counts.drafts}
            icon={<Edit3 />}
          />
        </div>

        {/* Posts */}
        <section className="overflow-hidden rounded-2xl border border-border bg-background">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h3 className="font-bold">
                Blog Posts
              </h3>

              <p className="text-xs text-muted-foreground">
                Manage your articles and publishing schedule.
              </p>
            </div>

            <Button
              size="sm"
              onClick={openNewPost}
            >
              <Plus />
              New Post
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center px-6 py-16 text-muted-foreground">
              <Loader2 className="mr-3 h-5 w-5 animate-spin" />
              Loading blog posts...
            </div>
          ) : posts.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />

              <h3 className="mt-4 text-xl font-bold">
                No blog posts yet
              </h3>

              <p className="mt-2 text-sm text-muted-foreground">
                Create your first fitness article to start building
                the Super Plus Fitness blog.
              </p>

              <Button
                className="mt-6"
                onClick={openNewPost}
              >
                <Plus />
                Create First Post
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {posts.map((post) => {
                const status = getStatusLabel(post);

                return (
                  <div
                    key={post.id}
                    className="flex flex-col gap-5 px-5 py-5 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="flex min-w-0 gap-4">
                      <div className="hidden h-20 w-28 shrink-0 overflow-hidden rounded-xl bg-muted sm:block">
                        {post.featured_image ? (
                          <img
                            src={post.featured_image}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <FileText className="h-7 w-7 text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
                            {post.category}
                          </span>

                          <span
                            className={[
                              "rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider",
                              status === "published"
                                ? "bg-green-500/10 text-green-700 dark:text-green-400"
                                : status === "scheduled"
                                  ? "bg-blue-500/10 text-blue-700 dark:text-blue-400"
                                  : "bg-muted text-muted-foreground",
                            ].join(" ")}
                          >
                            {status}
                          </span>

                          {post.featured && (
                            <span className="flex items-center gap-1 rounded-full bg-yellow-500/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-yellow-700 dark:text-yellow-400">
                              <Star className="h-3 w-3 fill-current" />
                              Featured
                            </span>
                          )}
                        </div>

                        <h4 className="mt-2 line-clamp-2 text-lg font-bold">
                          {post.title}
                        </h4>

                        <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                          {post.excerpt ||
                            "No excerpt added."}
                        </p>

                        <p className="mt-2 text-xs text-muted-foreground">
                          {status === "scheduled"
                            ? `Scheduled: ${formatDate(post.published_at)}`
                            : status === "published"
                              ? `Published: ${formatDate(post.published_at)}`
                              : `Created: ${formatDate(post.created_at)}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          toggleFeatured(post)
                        }
                        title={
                          post.featured
                            ? "Remove featured status"
                            : "Make featured"
                        }
                      >
                        <Star
                          className={
                            post.featured
                              ? "fill-current"
                              : ""
                          }
                        />
                        <span className="hidden sm:inline">
                          {post.featured
                            ? "Featured"
                            : "Feature"}
                        </span>
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          openEditPost(post)
                        }
                      >
                        <Edit3 />
                        Edit
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          deletePost(post)
                        }
                        disabled={
                          deleting === post.id
                        }
                      >
                        {deleting === post.id ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <Trash2 />
                        )}
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Editor modal */}
      {showEditor && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-4">
          <div className="mx-auto my-6 max-w-4xl overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                  Blog Editor
                </p>

                <h2 className="mt-1 text-xl font-black">
                  {selectedPost
                    ? "Edit Blog Post"
                    : "Create Blog Post"}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowEditor(false);
                  resetEditor();
                }}
                className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <X />
              </button>
            </div>

            <div className="space-y-6 p-5 sm:p-7">
              {/* Title */}
              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Article Title
                </label>

                <input
                  type="text"
                  value={title}
                  onChange={(event) =>
                    handleTitleChange(
                      event.target.value,
                    )
                  }
                  placeholder="e.g. 5 Mistakes That Are Slowing Your Muscle Growth"
                  className="h-12 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Slug */}
              <div>
                <label className="mb-2 block text-sm font-semibold">
                  URL Slug
                </label>

                <div className="flex overflow-hidden rounded-xl border border-border">
                  <span className="flex items-center bg-muted px-3 text-xs text-muted-foreground">
                    /blog/
                  </span>

                  <input
                    type="text"
                    value={slug}
                    onChange={(event) =>
                      setSlug(
                        slugify(
                          event.target.value,
                        ),
                      )
                    }
                    className="h-12 min-w-0 flex-1 bg-background px-3 text-sm outline-none"
                  />
                </div>
              </div>

              {/* Category + author */}
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold">
                    Category
                  </label>

                  <div className="relative">
                    <select
                      value={category}
                      onChange={(event) =>
                        setCategory(
                          event.target.value,
                        )
                      }
                      className="h-12 w-full appearance-none rounded-xl border border-border bg-background px-4 pr-10 text-sm outline-none focus:border-primary"
                    >
                      {categories.map(
                        (item) => (
                          <option
                            key={item}
                            value={item}
                          >
                            {item}
                          </option>
                        ),
                      )}
                    </select>

                    <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold">
                    Author
                  </label>

                  <input
                    type="text"
                    value={authorName}
                    onChange={(event) =>
                      setAuthorName(
                        event.target.value,
                      )
                    }
                    className="h-12 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Image */}
              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Featured Image URL
                </label>

                <input
                  type="url"
                  value={featuredImage}
                  onChange={(event) =>
                    setFeaturedImage(
                      event.target.value,
                    )
                  }
                  placeholder="https://..."
                  className="h-12 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                />

                <p className="mt-2 text-xs text-muted-foreground">
                  You can leave this empty for now. We'll add proper
                  image uploading later.
                </p>
              </div>

              {/* Excerpt */}
              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Short Excerpt
                </label>

                <textarea
                  value={excerpt}
                  onChange={(event) =>
                    setExcerpt(
                      event.target.value,
                    )
                  }
                  rows={3}
                  placeholder="A short summary that appears on the blog cards..."
                  className="w-full resize-none rounded-xl border border-border bg-background p-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Content */}
              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Article Content
                </label>

                <textarea
                  value={content}
                  onChange={(event) =>
                    setContent(
                      event.target.value,
                    )
                  }
                  rows={16}
                  placeholder={`Write your article here...

You can use paragraphs separated by blank lines.

Example:

Getting stronger doesn't happen overnight. It comes from consistent training, proper nutrition and enough recovery.

Here are five simple things you can start doing today...`}
                  className="w-full resize-y rounded-xl border border-border bg-background p-4 text-sm leading-7 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />

                <p className="mt-2 text-xs text-muted-foreground">
                  For now, plain text is supported. We'll upgrade this
                  to a proper rich-text editor later.
                </p>
              </div>

              {/* Featured */}
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/20 p-4">
                <input
                  type="checkbox"
                  checked={featured}
                  onChange={(event) =>
                    setFeatured(
                      event.target.checked,
                    )
                  }
                  className="mt-1 h-4 w-4"
                />

                <span>
                  <span className="block text-sm font-bold">
                    Feature this article
                  </span>

                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    Featured articles appear prominently at the top
                    of the public blog.
                  </span>
                </span>
              </label>

              {/* Publishing */}
              <div className="rounded-2xl border border-border bg-muted/20 p-5">
                <h3 className="font-bold">
                  Publishing
                </h3>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <PublishOption
                    active={
                      publishMode === "draft"
                    }
                    title="Save Draft"
                    description="Keep private"
                    onClick={() =>
                      setPublishMode("draft")
                    }
                  />

                  <PublishOption
                    active={
                      publishMode === "published"
                    }
                    title="Publish Now"
                    description="Visible immediately"
                    onClick={() =>
                      setPublishMode("published")
                    }
                  />

                  <PublishOption
                    active={
                      publishMode === "scheduled"
                    }
                    title="Schedule"
                    description="Publish later"
                    onClick={() =>
                      setPublishMode("scheduled")
                    }
                  />
                </div>

                {publishMode === "scheduled" && (
                  <div className="mt-4">
                    <label className="mb-2 block text-sm font-semibold">
                      Publish Date & Time
                    </label>

                    <input
                      type="datetime-local"
                      value={scheduledDate}
                      onChange={(event) =>
                        setScheduledDate(
                          event.target.value,
                        )
                      }
                      className="h-12 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-primary sm:max-w-sm"
                    />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowEditor(false);
                    resetEditor();
                  }}
                >
                  Cancel
                </Button>

                <Button
                  type="button"
                  onClick={savePost}
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Save />
                  )}

                  {saving
                    ? "Saving..."
                    : selectedPost
                      ? "Update Post"
                      : "Save Post"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>

          <p className="mt-2 text-3xl font-black">
            {value}
          </p>
        </div>

        <div className="rounded-xl bg-primary/10 p-3 text-primary">
          {icon}
        </div>
      </div>
    </div>
  );
}

function PublishOption({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-xl border p-4 text-left transition",
        active
          ? "border-primary bg-primary/10"
          : "border-border bg-background hover:border-primary/50",
      ].join(" ")}
    >
      <div className="flex items-center gap-2">
        <div
          className={[
            "h-3 w-3 rounded-full border-2",
            active
              ? "border-primary bg-primary"
              : "border-muted-foreground",
          ].join(" ")}
        />

        <span className="text-sm font-bold">
          {title}
        </span>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        {description}
      </p>
    </button>
  );
}

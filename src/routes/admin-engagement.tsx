import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Dumbbell,
  Gift,
  Megaphone,
  RefreshCw,
  Send,
  Settings2,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { AdminWorkspaceShell } from "@/components/admin/AdminWorkspaceShell";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/admin-engagement")({
  component: AdminEngagement,
});

type EngagementSettings = {
  id: string;
  visit_points: number;
};

type AchievementDefinition = {
  code: string;
  title: string;
  description: string;
  visit_threshold: number;
  points_reward: number;
  active: boolean;
};

type Challenge = {
  id: string;
  title: string;
  description: string;
  starts_on: string;
  ends_on: string;
  target_visits: number;
  points_reward: number;
  active: boolean;
};

type Reward = {
  id: string;
  name: string;
  description: string;
  points_cost: number;
  active: boolean;
  inventory: number | null;
};

type Redemption = {
  id: string;
  member_id: string;
  points_cost: number;
  status: string;
  staff_note: string | null;
  created_at: string;
  member: {
    full_name: string | null;
    phone: string | null;
    email: string | null;
  } | null;
  reward: { name: string | null } | null;
};

type Booking = {
  id: string;
  member_id: string;
  service_type: string;
  service_name: string;
  preferred_at: string;
  notes: string;
  status: string;
  staff_note: string | null;
  created_at: string;
  member: {
    full_name: string | null;
    phone: string | null;
    email: string | null;
  } | null;
};

type AppNotification = {
  id: string;
  title: string;
  body: string;
  kind: string;
  deep_link: string | null;
  published_at: string;
  created_at: string;
};

const inputClass =
  "mt-1 w-full rounded-xl border border-[#d8e2d5] bg-white px-3 py-3 text-sm outline-none focus:border-[#79a56e]";

const buttonClass =
  "rounded-xl bg-[#193b2a] px-4 py-2.5 text-xs font-black text-white disabled:opacity-50";

function dateTime(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(new Date(value));
}

function makeCode(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

function AdminEngagement() {
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [settings, setSettings] = useState<EngagementSettings | null>(null);
  const [visitPoints, setVisitPoints] = useState(1);
  const [badges, setBadges] = useState<AchievementDefinition[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const [badgeTitle, setBadgeTitle] = useState("");
  const [badgeDescription, setBadgeDescription] = useState("");
  const [badgeThreshold, setBadgeThreshold] = useState(10);
  const [badgePoints, setBadgePoints] = useState(3);

  const [challengeTitle, setChallengeTitle] = useState("");
  const [challengeDescription, setChallengeDescription] = useState("");
  const [challengeStart, setChallengeStart] = useState("");
  const [challengeEnd, setChallengeEnd] = useState("");
  const [challengeTarget, setChallengeTarget] = useState(12);
  const [challengePoints, setChallengePoints] = useState(10);

  const [rewardName, setRewardName] = useState("");
  const [rewardDescription, setRewardDescription] = useState("");
  const [rewardCost, setRewardCost] = useState(10);
  const [rewardInventory, setRewardInventory] = useState("");

  const [pushTitle, setPushTitle] = useState("");
  const [pushBody, setPushBody] = useState("");
  const [pushKind, setPushKind] = useState("general");
  const [pushLink, setPushLink] = useState("");

  useEffect(() => {
    let live = true;

    void (async () => {
      setChecking(true);

      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) {
        if (live) {
          setError("Sign in through the admin portal.");
          setChecking(false);
        }
        return;
      }

      const { data: staff, error: staffError } = await supabase
        .from("staff_users")
        .select("role,active")
        .eq("auth_user_id", auth.user.id)
        .maybeSingle();

      const role = String(staff?.role ?? "").toLowerCase();
      const ok =
        !staffError &&
        !!staff?.active &&
        ["admin", "owner", "manager"].includes(role);

      if (live) {
        setAuthorized(ok);
        setChecking(false);
        if (!ok) setError("Management access required.");
      }
    })();

    return () => {
      live = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!authorized) return;

    setLoading(true);
    setError("");

    const [
      settingsResult,
      badgesResult,
      challengeResult,
      rewardResult,
      redemptionResult,
      bookingResult,
      notificationResult,
    ] = await Promise.all([
      supabase
        .from("app_engagement_settings")
        .select("id,visit_points")
        .eq("id", "default")
        .maybeSingle(),
      supabase
        .from("achievement_definitions")
        .select("code,title,description,visit_threshold,points_reward,active")
        .order("visit_threshold", { ascending: true }),
      supabase
        .from("fitness_challenges")
        .select("id,title,description,starts_on,ends_on,target_visits,points_reward,active")
        .order("starts_on", { ascending: false }),
      supabase
        .from("reward_catalog")
        .select("id,name,description,points_cost,active,inventory")
        .order("created_at", { ascending: false }),
      supabase
        .from("reward_redemptions")
        .select(
          "id,member_id,points_cost,status,staff_note,created_at,member:members(full_name,phone,email),reward:reward_catalog(name)",
        )
        .order("created_at", { ascending: false })
        .limit(80),
      supabase
        .from("member_bookings")
        .select(
          "id,member_id,service_type,service_name,preferred_at,notes,status,staff_note,created_at,member:members(full_name,phone,email)",
        )
        .order("preferred_at", { ascending: true })
        .limit(100),
      supabase
        .from("app_notifications")
        .select("id,title,body,kind,deep_link,published_at,created_at")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const firstError =
      settingsResult.error ||
      badgesResult.error ||
      challengeResult.error ||
      rewardResult.error ||
      redemptionResult.error ||
      bookingResult.error ||
      notificationResult.error;

    if (firstError) {
      setError(firstError.message);
    } else {
      const nextSettings = (settingsResult.data ?? null) as EngagementSettings | null;
      setSettings(nextSettings);
      setVisitPoints(nextSettings?.visit_points ?? 1);
      setBadges((badgesResult.data ?? []) as AchievementDefinition[]);
      setChallenges((challengeResult.data ?? []) as Challenge[]);
      setRewards((rewardResult.data ?? []) as Reward[]);
      setRedemptions((redemptionResult.data ?? []) as unknown as Redemption[]);
      setBookings((bookingResult.data ?? []) as unknown as Booking[]);
      setNotifications((notificationResult.data ?? []) as AppNotification[]);
    }

    setLoading(false);
  }, [authorized]);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingBookings = useMemo(
    () => bookings.filter((item) => item.status === "pending").length,
    [bookings],
  );
  const activeBadges = useMemo(
    () => badges.filter((item) => item.active).length,
    [badges],
  );
  const activeChallenges = useMemo(
    () => challenges.filter((item) => item.active).length,
    [challenges],
  );
  const activeRewards = useMemo(
    () => rewards.filter((item) => item.active).length,
    [rewards],
  );

  async function saveVisitPoints() {
    setBusy("visit-points");
    setError("");
    setSuccess("");

    const safePoints = Math.max(1, Math.min(20, Math.round(visitPoints)));
    const { error: updateError } = await supabase
      .from("app_engagement_settings")
      .upsert(
        {
          id: "default",
          visit_points: safePoints,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );

    if (updateError) setError(updateError.message);
    else {
      setVisitPoints(safePoints);
      setSuccess(`SP Points updated: each recorded gym visit now earns ${safePoints} point${safePoints === 1 ? "" : "s"}.`);
      await load();
    }

    setBusy("");
  }

  async function createBadge() {
    setError("");
    setSuccess("");

    const title = badgeTitle.trim();
    const code = makeCode(title);

    if (!title || !code) {
      setError("Badge title is required.");
      return;
    }

    setBusy("badge-create");

    const { error: insertError } = await supabase
      .from("achievement_definitions")
      .insert({
        code,
        title,
        description: badgeDescription.trim() || `Completed ${Math.max(1, badgeThreshold)} recorded gym visits.`,
        visit_threshold: Math.max(1, Math.round(badgeThreshold)),
        points_reward: Math.max(0, Math.round(badgePoints)),
        active: true,
        updated_at: new Date().toISOString(),
      });

    if (insertError) {
      setError(
        insertError.message.toLowerCase().includes("duplicate")
          ? "A badge with that name already exists."
          : insertError.message,
      );
    } else {
      setBadgeTitle("");
      setBadgeDescription("");
      setBadgeThreshold(10);
      setBadgePoints(3);
      setSuccess("Badge added to the member app.");
      await load();
    }

    setBusy("");
  }

  async function editBadge(item: AchievementDefinition) {
    const title = window.prompt("Badge title:", item.title);
    if (title === null || !title.trim()) return;

    const description = window.prompt("Badge description:", item.description);
    if (description === null) return;

    const thresholdText = window.prompt(
      "Visits needed to unlock:",
      String(item.visit_threshold),
    );
    if (thresholdText === null) return;

    const pointsText = window.prompt(
      "SP Points awarded:",
      String(item.points_reward),
    );
    if (pointsText === null) return;

    const threshold = Number.parseInt(thresholdText, 10);
    const points = Number.parseInt(pointsText, 10);

    if (!Number.isFinite(threshold) || threshold < 1 || !Number.isFinite(points) || points < 0) {
      setError("Badge visits must be at least 1 and points cannot be negative.");
      return;
    }

    setBusy(item.code);
    const { error: updateError } = await supabase
      .from("achievement_definitions")
      .update({
        title: title.trim(),
        description: description.trim(),
        visit_threshold: threshold,
        points_reward: points,
        updated_at: new Date().toISOString(),
      })
      .eq("code", item.code);

    if (updateError) setError(updateError.message);
    else {
      setSuccess("Badge updated.");
      await load();
    }
    setBusy("");
  }

  async function toggleBadge(item: AchievementDefinition) {
    setBusy(item.code);
    const { error: updateError } = await supabase
      .from("achievement_definitions")
      .update({
        active: !item.active,
        updated_at: new Date().toISOString(),
      })
      .eq("code", item.code);

    if (updateError) setError(updateError.message);
    else await load();

    setBusy("");
  }

  async function createChallenge() {
    setError("");
    setSuccess("");

    if (!challengeTitle.trim() || !challengeStart || !challengeEnd) {
      setError("Challenge title, start date and end date are required.");
      return;
    }

    if (challengeEnd < challengeStart) {
      setError("Challenge end date must be on or after its start date.");
      return;
    }

    setBusy("challenge-create");

    const { error: insertError } = await supabase
      .from("fitness_challenges")
      .insert({
        title: challengeTitle.trim(),
        description: challengeDescription.trim(),
        starts_on: challengeStart,
        ends_on: challengeEnd,
        target_visits: Math.max(1, Math.round(challengeTarget)),
        points_reward: Math.max(0, Math.round(challengePoints)),
        active: true,
      });

    if (insertError) {
      setError(insertError.message);
      setBusy("");
      return;
    }

    const { error: pushError } = await supabase.functions.invoke(
      "send-member-push",
      {
        body: {
          title: `New challenge: ${challengeTitle.trim()}`,
          body:
            challengeDescription.trim() ||
            `Complete ${Math.max(1, challengeTarget)} gym visits to finish this challenge.`,
          kind: "challenge",
          deep_link: "/rewards",
          send_push: true,
        },
      },
    );

    setChallengeTitle("");
    setChallengeDescription("");
    setChallengeStart("");
    setChallengeEnd("");
    setChallengeTarget(12);
    setChallengePoints(10);
    setSuccess(
      pushError
        ? "Challenge created. Push notification could not be sent."
        : "Challenge created and members were notified.",
    );
    setBusy("");
    await load();
  }

  async function editChallenge(item: Challenge) {
    const targetText = window.prompt("Visit target:", String(item.target_visits));
    if (targetText === null) return;

    const pointsText = window.prompt("SP Points reward:", String(item.points_reward));
    if (pointsText === null) return;

    const target = Number.parseInt(targetText, 10);
    const points = Number.parseInt(pointsText, 10);

    if (!Number.isFinite(target) || target < 1 || !Number.isFinite(points) || points < 0) {
      setError("Challenge target must be at least 1 and points cannot be negative.");
      return;
    }

    setBusy(item.id);
    const { error: updateError } = await supabase
      .from("fitness_challenges")
      .update({ target_visits: target, points_reward: points })
      .eq("id", item.id);

    if (updateError) setError(updateError.message);
    else {
      setSuccess("Challenge updated.");
      await load();
    }
    setBusy("");
  }

  async function toggleChallenge(item: Challenge) {
    setBusy(item.id);
    const { error: updateError } = await supabase
      .from("fitness_challenges")
      .update({ active: !item.active })
      .eq("id", item.id);

    if (updateError) setError(updateError.message);
    else await load();

    setBusy("");
  }

  async function createReward() {
    setError("");
    setSuccess("");

    if (!rewardName.trim()) {
      setError("Reward name is required.");
      return;
    }

    const inventory =
      rewardInventory.trim() === ""
        ? null
        : Math.max(0, Number.parseInt(rewardInventory, 10) || 0);

    setBusy("reward-create");

    const { error: insertError } = await supabase.from("reward_catalog").insert({
      name: rewardName.trim(),
      description: rewardDescription.trim(),
      points_cost: Math.max(1, Math.round(rewardCost)),
      inventory,
      active: true,
    });

    if (insertError) {
      setError(insertError.message);
    } else {
      setRewardName("");
      setRewardDescription("");
      setRewardCost(10);
      setRewardInventory("");
      setSuccess("Reward added to the member app.");
      await load();
    }

    setBusy("");
  }

  async function editReward(item: Reward) {
    const costText = window.prompt("SP Points cost:", String(item.points_cost));
    if (costText === null) return;

    const inventoryText = window.prompt(
      "Inventory (leave blank for unlimited):",
      item.inventory === null ? "" : String(item.inventory),
    );
    if (inventoryText === null) return;

    const cost = Number.parseInt(costText, 10);
    const inventory =
      inventoryText.trim() === ""
        ? null
        : Number.parseInt(inventoryText, 10);

    if (!Number.isFinite(cost) || cost < 1) {
      setError("Reward cost must be at least 1 point.");
      return;
    }

    if (inventory !== null && (!Number.isFinite(inventory) || inventory < 0)) {
      setError("Inventory cannot be negative.");
      return;
    }

    setBusy(item.id);
    const { error: updateError } = await supabase
      .from("reward_catalog")
      .update({
        points_cost: cost,
        inventory,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    if (updateError) setError(updateError.message);
    else {
      setSuccess("Reward updated.");
      await load();
    }

    setBusy("");
  }

  async function toggleReward(item: Reward) {
    setBusy(item.id);
    const { error: updateError } = await supabase
      .from("reward_catalog")
      .update({
        active: !item.active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    if (updateError) setError(updateError.message);
    else await load();

    setBusy("");
  }

  async function updateRedemption(item: Redemption, status: string) {
    const note = window.prompt("Optional staff note:", item.staff_note ?? "");
    if (note === null) return;

    setBusy(item.id);

    const { error: updateError } = await supabase
      .from("reward_redemptions")
      .update({
        status,
        staff_note: note.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    if (updateError) {
      setError(updateError.message);
    } else {
      const rewardName = item.reward?.name || "reward";
      await supabase.functions.invoke("send-member-push", {
        body: {
          title:
            status === "approved"
              ? "Reward approved"
              : status === "fulfilled"
                ? "Reward ready"
                : "Reward update",
          body:
            status === "approved"
              ? `Your ${rewardName} redemption has been approved.`
              : status === "fulfilled"
                ? `Your ${rewardName} has been marked fulfilled.`
                : `Your ${rewardName} redemption was not approved.${note.trim() ? ` ${note.trim()}` : ""}`,
          kind: "reward",
          deep_link: "/rewards",
          member_id: item.member_id,
          send_push: true,
        },
      });

      setSuccess(`Redemption marked ${status}.`);
      await load();
    }

    setBusy("");
  }

  async function updateBooking(item: Booking, status: string) {
    const note = window.prompt("Optional staff note:", item.staff_note ?? "");
    if (note === null) return;

    setBusy(item.id);

    const { error: updateError } = await supabase
      .from("member_bookings")
      .update({
        status,
        staff_note: note.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    if (updateError) {
      setError(updateError.message);
      setBusy("");
      return;
    }

    if (["confirmed", "declined", "completed"].includes(status)) {
      const title =
        status === "confirmed"
          ? "Booking confirmed"
          : status === "declined"
            ? "Booking update"
            : "Session completed";

      const body =
        status === "confirmed"
          ? `${item.service_name} is confirmed for ${dateTime(item.preferred_at)}.${note.trim() ? ` ${note.trim()}` : ""}`
          : status === "declined"
            ? `Your ${item.service_name} request could not be confirmed.${note.trim() ? ` ${note.trim()}` : ""}`
            : `Your ${item.service_name} was marked completed. We hope you enjoyed it.`;

      await supabase.functions.invoke("send-member-push", {
        body: {
          title,
          body,
          kind: "booking",
          deep_link: "/bookings",
          member_id: item.member_id,
          send_push: true,
        },
      });
    }

    setSuccess(`Session request marked ${status}.`);
    await load();
    setBusy("");
  }

  async function sendBroadcast() {
    setError("");
    setSuccess("");

    if (!pushTitle.trim()) {
      setError("Notification title is required.");
      return;
    }

    if (pushLink && !pushLink.startsWith("/")) {
      setError("App link must start with /, for example /blog or /rewards.");
      return;
    }

    setBusy("push");

    const { data, error: invokeError } = await supabase.functions.invoke(
      "send-member-push",
      {
        body: {
          title: pushTitle.trim(),
          body: pushBody.trim(),
          kind: pushKind,
          deep_link: pushLink.trim() || null,
          send_push: true,
        },
      },
    );

    if (invokeError) {
      setError(invokeError.message);
    } else {
      const sent = Number(
        (data as { push_sent?: number } | null)?.push_sent ?? 0,
      );
      setPushTitle("");
      setPushBody("");
      setPushKind("general");
      setPushLink("");
      setSuccess(
        `Notification published. Push sent to ${sent.toLocaleString()} registered device(s).`,
      );
      await load();
    }

    setBusy("");
  }

  if (checking) {
    return (
      <AdminWorkspaceShell title="App management" active="/admin-engagement">
        <p className="mt-7 rounded-2xl bg-white p-6 text-sm">
          Checking management access…
        </p>
      </AdminWorkspaceShell>
    );
  }

  if (!authorized) {
    return (
      <AdminWorkspaceShell title="App management" active="/admin-engagement">
        <p
          role="alert"
          className="mt-7 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800"
        >
          {error || "Management access required."}
        </p>
      </AdminWorkspaceShell>
    );
  }

  return (
    <AdminWorkspaceShell
      title="App management"
      subtitle="Control member-app points, badges, rewards, challenges, session requests and notifications."
      active="/admin-engagement"
    >
      <div className="mt-7 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[.15em] text-[#65905c]">
              Super Plus member app
            </p>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[#637469]">
              This is the central control room for the member app. Changes to
              badges, rewards, challenges and SP Points feed directly into the app.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-[#d8e2d5] bg-white px-4 py-2.5 text-xs font-bold disabled:opacity-50"
          >
            <RefreshCw size={16} /> Refresh
          </button>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            {error}
          </p>
        )}

        {success && (
          <p
            role="status"
            className="rounded-xl border border-[#bfdab8] bg-[#ecf8e8] p-4 text-sm text-[#285c33]"
          >
            {success}
          </p>
        )}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Points per visit",
              value: String(settings?.visit_points ?? visitPoints),
              note: "Current member earning rate",
              icon: Sparkles,
            },
            {
              label: "Active badges",
              value: String(activeBadges),
              note: `${badges.length} configured`,
              icon: Trophy,
            },
            {
              label: "Pending sessions",
              value: String(pendingBookings),
              note: "Member requests needing action",
              icon: CalendarDays,
            },
            {
              label: "Active rewards",
              value: String(activeRewards),
              note: `${activeChallenges} active challenge${activeChallenges === 1 ? "" : "s"}`,
              icon: Gift,
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <article
                key={item.label}
                className="rounded-[20px] border border-[#e1e8dd] bg-white p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-xl bg-[#edf6e7] p-2.5 text-[#38673e]">
                    <Icon size={19} />
                  </span>
                  <span className="text-2xl font-black tabular-nums">
                    {item.value}
                  </span>
                </div>
                <p className="mt-4 text-sm font-black">{item.label}</p>
                <p className="mt-1 text-xs text-[#657568]">{item.note}</p>
              </article>
            );
          })}
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <a
            href="/staff-blog"
            className="flex items-center gap-3 rounded-[18px] border border-[#e1e8dd] bg-white p-4 hover:border-[#9cbb92]"
          >
            <BookOpen size={20} className="text-[#38673e]" />
            <span>
              <strong className="block text-sm">Manage blog</strong>
              <span className="text-xs text-[#657568]">Posts shown inside the app</span>
            </span>
          </a>
          <a
            href="/admin-announcements"
            className="flex items-center gap-3 rounded-[18px] border border-[#e1e8dd] bg-white p-4 hover:border-[#9cbb92]"
          >
            <Megaphone size={20} className="text-[#38673e]" />
            <span>
              <strong className="block text-sm">Announcements</strong>
              <span className="text-xs text-[#657568]">Website and member notices</span>
            </span>
          </a>
          <a
            href="/management-bookings"
            className="flex items-center gap-3 rounded-[18px] border border-[#e1e8dd] bg-white p-4 hover:border-[#9cbb92]"
          >
            <Users size={20} className="text-[#38673e]" />
            <span>
              <strong className="block text-sm">Full session queue</strong>
              <span className="text-xs text-[#657568]">Dedicated booking workspace</span>
            </span>
          </a>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <div className="rounded-[24px] border border-[#e1e8dd] bg-white p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-xl font-black">
              <Settings2 size={20} /> SP Points
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#657568]">
              Keep points small and easy to understand. Existing visit points are
              recalculated when the new settings are deployed.
            </p>
            <label className="mt-5 block text-sm font-bold">
              Points earned per recorded gym visit
              <input
                type="number"
                min={1}
                max={20}
                value={visitPoints}
                onChange={(event) =>
                  setVisitPoints(Number(event.target.value) || 1)
                }
                className={inputClass}
              />
            </label>
            <button
              type="button"
              disabled={busy === "visit-points"}
              onClick={() => void saveVisitPoints()}
              className={`${buttonClass} mt-4`}
            >
              {busy === "visit-points" ? "Saving…" : "Save point rule"}
            </button>
          </div>

          <div className="rounded-[24px] border border-[#e1e8dd] bg-white p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-xl font-black">
              <Trophy size={20} /> Add badge
            </h2>
            <div className="mt-5 grid gap-4">
              <label className="text-sm font-bold">
                Badge title
                <input
                  value={badgeTitle}
                  onChange={(event) => setBadgeTitle(event.target.value)}
                  className={inputClass}
                  placeholder="Morning Regular"
                />
              </label>
              <label className="text-sm font-bold">
                Description
                <textarea
                  value={badgeDescription}
                  onChange={(event) => setBadgeDescription(event.target.value)}
                  className={inputClass}
                  rows={3}
                  placeholder="A short explanation members will see."
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-bold">
                  Visits required
                  <input
                    type="number"
                    min={1}
                    value={badgeThreshold}
                    onChange={(event) =>
                      setBadgeThreshold(Number(event.target.value) || 1)
                    }
                    className={inputClass}
                  />
                </label>
                <label className="text-sm font-bold">
                  Bonus SP Points
                  <input
                    type="number"
                    min={0}
                    value={badgePoints}
                    onChange={(event) =>
                      setBadgePoints(Number(event.target.value) || 0)
                    }
                    className={inputClass}
                  />
                </label>
              </div>
              <button
                type="button"
                disabled={busy === "badge-create"}
                onClick={() => void createBadge()}
                className={buttonClass}
              >
                {busy === "badge-create" ? "Adding…" : "Add badge"}
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-[24px] border border-[#e1e8dd] bg-white p-5 sm:p-6">
          <h2 className="text-xl font-black">Badges & achievements</h2>
          <p className="mt-1 text-sm text-[#657568]">
            Edit the badge name, visit target and bonus points or hide a badge from members.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {badges.map((item) => (
              <article
                key={item.code}
                className="rounded-2xl border border-[#e4ebe1] bg-[#f8faf6] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="rounded-xl bg-[#edf6e7] p-2 text-[#38673e]">
                    <Trophy size={18} />
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                      item.active
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {item.active ? "ACTIVE" : "HIDDEN"}
                  </span>
                </div>
                <p className="mt-3 font-black">{item.title}</p>
                <p className="mt-1 text-xs leading-5 text-[#657568]">
                  {item.description}
                </p>
                <p className="mt-3 text-xs font-bold text-[#45634b]">
                  {item.visit_threshold} visits · +{item.points_reward} pts
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy === item.code}
                    onClick={() => void editBadge(item)}
                    className="rounded-xl border border-[#cfdaca] px-3 py-2 text-xs font-bold disabled:opacity-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={busy === item.code}
                    onClick={() => void toggleBadge(item)}
                    className="rounded-xl border border-[#cfdaca] px-3 py-2 text-xs font-bold disabled:opacity-50"
                  >
                    {item.active ? "Hide" : "Publish"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <div className="rounded-[24px] border border-[#e1e8dd] bg-white p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-xl font-black">
              <Dumbbell size={20} /> Create challenge
            </h2>
            <div className="mt-5 grid gap-4">
              <label className="text-sm font-bold">
                Title
                <input
                  value={challengeTitle}
                  onChange={(event) => setChallengeTitle(event.target.value)}
                  className={inputClass}
                  placeholder="November Consistency"
                />
              </label>
              <label className="text-sm font-bold">
                Description
                <textarea
                  value={challengeDescription}
                  onChange={(event) => setChallengeDescription(event.target.value)}
                  className={inputClass}
                  rows={3}
                  placeholder="Complete 12 gym visits this month."
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-bold">
                  Starts
                  <input
                    type="date"
                    value={challengeStart}
                    onChange={(event) => setChallengeStart(event.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="text-sm font-bold">
                  Ends
                  <input
                    type="date"
                    value={challengeEnd}
                    onChange={(event) => setChallengeEnd(event.target.value)}
                    className={inputClass}
                  />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-bold">
                  Visit target
                  <input
                    type="number"
                    min={1}
                    value={challengeTarget}
                    onChange={(event) =>
                      setChallengeTarget(Number(event.target.value) || 1)
                    }
                    className={inputClass}
                  />
                </label>
                <label className="text-sm font-bold">
                  Bonus SP Points
                  <input
                    type="number"
                    min={0}
                    value={challengePoints}
                    onChange={(event) =>
                      setChallengePoints(Number(event.target.value) || 0)
                    }
                    className={inputClass}
                  />
                </label>
              </div>
              <button
                type="button"
                disabled={busy === "challenge-create"}
                onClick={() => void createChallenge()}
                className={buttonClass}
              >
                {busy === "challenge-create"
                  ? "Creating…"
                  : "Create challenge & notify members"}
              </button>
            </div>
          </div>

          <div className="rounded-[24px] border border-[#e1e8dd] bg-white p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-xl font-black">
              <Gift size={20} /> Add reward
            </h2>
            <div className="mt-5 grid gap-4">
              <label className="text-sm font-bold">
                Reward name
                <input
                  value={rewardName}
                  onChange={(event) => setRewardName(event.target.value)}
                  className={inputClass}
                  placeholder="Free guest pass"
                />
              </label>
              <label className="text-sm font-bold">
                Description
                <textarea
                  value={rewardDescription}
                  onChange={(event) => setRewardDescription(event.target.value)}
                  className={inputClass}
                  rows={3}
                  placeholder="One guest visit for a friend or family member."
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-bold">
                  SP Points cost
                  <input
                    type="number"
                    min={1}
                    value={rewardCost}
                    onChange={(event) =>
                      setRewardCost(Number(event.target.value) || 1)
                    }
                    className={inputClass}
                  />
                </label>
                <label className="text-sm font-bold">
                  Inventory
                  <input
                    value={rewardInventory}
                    onChange={(event) => setRewardInventory(event.target.value)}
                    className={inputClass}
                    placeholder="Blank = unlimited"
                  />
                </label>
              </div>
              <button
                type="button"
                disabled={busy === "reward-create"}
                onClick={() => void createReward()}
                className={buttonClass}
              >
                {busy === "reward-create" ? "Adding…" : "Add reward"}
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <div className="rounded-[24px] border border-[#e1e8dd] bg-white p-5 sm:p-6">
            <h2 className="text-xl font-black">Challenges</h2>
            <div className="mt-4 space-y-3">
              {challenges.map((item) => (
                <article
                  key={item.id}
                  className="rounded-2xl border border-[#e4ebe1] bg-[#f8faf6] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black">{item.title}</p>
                      <p className="mt-1 text-xs leading-5 text-[#657568]">
                        {item.description}
                      </p>
                      <p className="mt-2 text-xs font-bold text-[#45634b]">
                        {item.target_visits} visits · +{item.points_reward} pts ·{" "}
                        {item.starts_on} → {item.ends_on}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                        item.active
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {item.active ? "ACTIVE" : "OFF"}
                    </span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={busy === item.id}
                      onClick={() => void editChallenge(item)}
                      className="rounded-xl border border-[#cfdaca] px-3 py-2 text-xs font-bold disabled:opacity-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={busy === item.id}
                      onClick={() => void toggleChallenge(item)}
                      className="rounded-xl border border-[#cfdaca] px-3 py-2 text-xs font-bold disabled:opacity-50"
                    >
                      {item.active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </article>
              ))}
              {!challenges.length && (
                <p className="text-sm text-[#657568]">No challenges yet.</p>
              )}
            </div>
          </div>

          <div className="rounded-[24px] border border-[#e1e8dd] bg-white p-5 sm:p-6">
            <h2 className="text-xl font-black">Rewards catalogue</h2>
            <div className="mt-4 space-y-3">
              {rewards.map((item) => (
                <article
                  key={item.id}
                  className="rounded-2xl border border-[#e4ebe1] bg-[#f8faf6] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black">{item.name}</p>
                      <p className="mt-1 text-xs leading-5 text-[#657568]">
                        {item.description}
                      </p>
                      <p className="mt-2 text-xs font-bold text-[#45634b]">
                        {item.points_cost} pts ·{" "}
                        {item.inventory === null
                          ? "Unlimited"
                          : `${item.inventory} left`}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                        item.active
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {item.active ? "ACTIVE" : "OFF"}
                    </span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={busy === item.id}
                      onClick={() => void editReward(item)}
                      className="rounded-xl border border-[#cfdaca] px-3 py-2 text-xs font-bold disabled:opacity-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={busy === item.id}
                      onClick={() => void toggleReward(item)}
                      className="rounded-xl border border-[#cfdaca] px-3 py-2 text-xs font-bold disabled:opacity-50"
                    >
                      {item.active ? "Hide reward" : "Publish reward"}
                    </button>
                  </div>
                </article>
              ))}
              {!rewards.length && (
                <p className="text-sm text-[#657568]">
                  No rewards published yet.
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-[24px] border border-[#e1e8dd] bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-black">
                <CalendarDays size={20} /> Session requests
              </h2>
              <p className="mt-1 text-sm text-[#657568]">
                Group classes, personal training, massage, pedicure and spa requests from the app.
              </p>
            </div>
            <span className="rounded-full bg-[#edf6e7] px-3 py-1.5 text-xs font-black text-[#356942]">
              {pendingBookings} pending
            </span>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {bookings.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-[#e4ebe1] bg-[#f8faf6] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black">{item.service_name}</p>
                    <p className="mt-1 text-xs text-[#657568]">
                      {item.member?.full_name || "Member"} ·{" "}
                      {item.member?.phone ||
                        item.member?.email ||
                        "No contact"}
                    </p>
                    <p className="mt-2 text-xs font-bold text-[#45634b]">
                      {dateTime(item.preferred_at)}
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase">
                    {item.status}
                  </span>
                </div>
                {item.notes && (
                  <p className="mt-3 text-xs leading-5 text-[#657568]">
                    Member note: {item.notes}
                  </p>
                )}
                {item.staff_note && (
                  <p className="mt-2 text-xs leading-5 text-[#657568]">
                    Staff note: {item.staff_note}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {item.status === "pending" && (
                    <>
                      <button
                        type="button"
                        disabled={busy === item.id}
                        onClick={() => void updateBooking(item, "confirmed")}
                        className={buttonClass}
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        disabled={busy === item.id}
                        onClick={() => void updateBooking(item, "declined")}
                        className="rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-700"
                      >
                        Decline
                      </button>
                    </>
                  )}
                  {item.status === "confirmed" && (
                    <button
                      type="button"
                      disabled={busy === item.id}
                      onClick={() => void updateBooking(item, "completed")}
                      className={buttonClass}
                    >
                      Mark completed
                    </button>
                  )}
                </div>
              </article>
            ))}
            {!bookings.length && (
              <p className="text-sm text-[#657568]">
                No member session requests yet.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-[24px] border border-[#e1e8dd] bg-white p-5 sm:p-6">
          <h2 className="text-xl font-black">Reward redemptions</h2>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {redemptions.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-[#e4ebe1] bg-[#f8faf6] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black">
                      {item.reward?.name || "Reward"}
                    </p>
                    <p className="mt-1 text-xs text-[#657568]">
                      {item.member?.full_name || "Member"} ·{" "}
                      {item.member?.phone ||
                        item.member?.email ||
                        "No contact"}
                    </p>
                    <p className="mt-2 text-xs font-bold">
                      {item.points_cost} points
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase">
                    {item.status}
                  </span>
                </div>
                {item.staff_note && (
                  <p className="mt-3 text-xs text-[#657568]">
                    Staff: {item.staff_note}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {item.status === "pending" && (
                    <>
                      <button
                        type="button"
                        disabled={busy === item.id}
                        onClick={() =>
                          void updateRedemption(item, "approved")
                        }
                        className={buttonClass}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={busy === item.id}
                        onClick={() =>
                          void updateRedemption(item, "rejected")
                        }
                        className="rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-700"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {item.status === "approved" && (
                    <button
                      type="button"
                      disabled={busy === item.id}
                      onClick={() =>
                        void updateRedemption(item, "fulfilled")
                      }
                      className={`inline-flex items-center gap-2 ${buttonClass}`}
                    >
                      <CheckCircle2 size={14} /> Mark fulfilled
                    </button>
                  )}
                </div>
              </article>
            ))}
            {!redemptions.length && (
              <p className="text-sm text-[#657568]">
                No reward redemptions yet.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-[24px] border border-[#e1e8dd] bg-white p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-xl font-black">
            <Bell size={20} /> Send member notification
          </h2>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <label className="text-sm font-bold">
              Title
              <input
                value={pushTitle}
                onChange={(event) => setPushTitle(event.target.value)}
                className={inputClass}
                placeholder="Saturday group class update"
              />
            </label>
            <label className="text-sm font-bold">
              App destination
              <input
                value={pushLink}
                onChange={(event) => setPushLink(event.target.value)}
                className={inputClass}
                placeholder="/rewards, /blog, /bookings…"
              />
            </label>
            <label className="text-sm font-bold">
              Type
              <select
                value={pushKind}
                onChange={(event) => setPushKind(event.target.value)}
                className={inputClass}
              >
                <option value="general">General</option>
                <option value="blog">Blog</option>
                <option value="challenge">Challenge</option>
                <option value="booking">Booking</option>
                <option value="reward">Reward</option>
                <option value="announcement">Announcement</option>
              </select>
            </label>
            <label className="text-sm font-bold lg:row-span-2">
              Message
              <textarea
                value={pushBody}
                onChange={(event) => setPushBody(event.target.value)}
                className={inputClass}
                rows={4}
                placeholder="Short, useful message for members."
              />
            </label>
            <button
              type="button"
              disabled={busy === "push"}
              onClick={() => void sendBroadcast()}
              className={`inline-flex items-center justify-center gap-2 ${buttonClass}`}
            >
              <Send size={17} />{" "}
              {busy === "push" ? "Sending…" : "Publish & send push"}
            </button>
          </div>
        </section>

        <section className="rounded-[24px] border border-[#e1e8dd] bg-white p-5 sm:p-6">
          <h2 className="text-xl font-black">Recent app notifications</h2>
          <div className="mt-4 space-y-2">
            {notifications.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border border-[#e4ebe1] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black">{item.title}</p>
                    <p className="mt-1 text-xs leading-5 text-[#657568]">
                      {item.body}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#edf6e7] px-2.5 py-1 text-[10px] font-black uppercase text-[#356942]">
                    {item.kind}
                  </span>
                </div>
              </article>
            ))}
            {!notifications.length && (
              <p className="text-sm text-[#657568]">
                No app notifications yet.
              </p>
            )}
          </div>
        </section>
      </div>
    </AdminWorkspaceShell>
  );
}

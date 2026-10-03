import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  CheckCircle2,
  Gift,
  RefreshCw,
  Send,
  Trophy,
} from "lucide-react";
import { AdminWorkspaceShell } from "@/components/admin/AdminWorkspaceShell";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/admin-engagement")({
  component: AdminEngagement,
});

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
  points_cost: number;
  status: string;
  staff_note: string | null;
  created_at: string;
  member: { full_name: string | null; phone: string | null; email: string | null } | null;
  reward: { name: string | null } | null;
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

function AdminEngagement() {
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const [challengeTitle, setChallengeTitle] = useState("");
  const [challengeDescription, setChallengeDescription] = useState("");
  const [challengeStart, setChallengeStart] = useState("");
  const [challengeEnd, setChallengeEnd] = useState("");
  const [challengeTarget, setChallengeTarget] = useState(12);
  const [challengePoints, setChallengePoints] = useState(200);

  const [rewardName, setRewardName] = useState("");
  const [rewardDescription, setRewardDescription] = useState("");
  const [rewardCost, setRewardCost] = useState(500);
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

    const [challengeResult, rewardResult, redemptionResult, notificationResult] =
      await Promise.all([
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
            "id,points_cost,status,staff_note,created_at,member:members(full_name,phone,email),reward:reward_catalog(name)",
          )
          .order("created_at", { ascending: false })
          .limit(80),
        supabase
          .from("app_notifications")
          .select("id,title,body,kind,deep_link,published_at,created_at")
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

    const firstError =
      challengeResult.error ||
      rewardResult.error ||
      redemptionResult.error ||
      notificationResult.error;

    if (firstError) {
      setError(firstError.message);
    } else {
      setChallenges((challengeResult.data ?? []) as Challenge[]);
      setRewards((rewardResult.data ?? []) as Reward[]);
      setRedemptions((redemptionResult.data ?? []) as unknown as Redemption[]);
      setNotifications((notificationResult.data ?? []) as AppNotification[]);
    }

    setLoading(false);
  }, [authorized]);

  useEffect(() => {
    void load();
  }, [load]);

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

    setBusy("challenge");
    const { error: insertError } = await supabase.from("fitness_challenges").insert({
      title: challengeTitle.trim(),
      description: challengeDescription.trim(),
      starts_on: challengeStart,
      ends_on: challengeEnd,
      target_visits: Math.max(1, challengeTarget),
      points_reward: Math.max(0, challengePoints),
      active: true,
    });

    if (insertError) {
      setError(insertError.message);
      setBusy("");
      return;
    }

    const { error: pushError } = await supabase.functions.invoke("send-member-push", {
      body: {
        title: `New challenge: ${challengeTitle.trim()}`,
        body:
          challengeDescription.trim() ||
          `Complete ${Math.max(1, challengeTarget)} gym visits to finish this challenge.`,
        kind: "challenge",
        deep_link: "/rewards",
        send_push: true,
      },
    });

    setChallengeTitle("");
    setChallengeDescription("");
    setChallengeStart("");
    setChallengeEnd("");
    setChallengeTarget(12);
    setChallengePoints(200);
    setSuccess(
      pushError
        ? "Challenge created. Push notification could not be sent."
        : "Challenge created and members were notified.",
    );
    setBusy("");
    await load();
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

    setBusy("reward");
    const { error: insertError } = await supabase.from("reward_catalog").insert({
      name: rewardName.trim(),
      description: rewardDescription.trim(),
      points_cost: Math.max(1, rewardCost),
      inventory,
      active: true,
    });

    if (insertError) {
      setError(insertError.message);
    } else {
      setRewardName("");
      setRewardDescription("");
      setRewardCost(500);
      setRewardInventory("");
      setSuccess("Reward added to the member catalogue.");
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

  async function toggleReward(item: Reward) {
    setBusy(item.id);
    const { error: updateError } = await supabase
      .from("reward_catalog")
      .update({ active: !item.active, updated_at: new Date().toISOString() })
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

    if (updateError) setError(updateError.message);
    else {
      setSuccess(`Redemption marked ${status}.`);
      await load();
    }
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
      const sent = Number((data as { push_sent?: number } | null)?.push_sent ?? 0);
      setPushTitle("");
      setPushBody("");
      setPushKind("general");
      setPushLink("");
      setSuccess(`Notification published. Push sent to ${sent.toLocaleString()} registered device(s).`);
      await load();
    }
    setBusy("");
  }

  if (checking) {
    return (
      <AdminWorkspaceShell title="Member engagement" active="/admin-engagement">
        <p className="mt-7 rounded-2xl bg-white p-6 text-sm">Checking management access…</p>
      </AdminWorkspaceShell>
    );
  }

  if (!authorized) {
    return (
      <AdminWorkspaceShell title="Member engagement" active="/admin-engagement">
        <p role="alert" className="mt-7 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
          {error || "Management access required."}
        </p>
      </AdminWorkspaceShell>
    );
  }

  return (
    <AdminWorkspaceShell
      title="Member engagement"
      subtitle="Manage challenges, rewards, redemptions and mobile notifications."
      active="/admin-engagement"
    >
      <div className="mt-7 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[.15em] text-[#65905c]">
              Mobile engagement controls
            </p>
            <p className="mt-1 text-sm text-[#637469]">
              Everything here feeds the Super Plus member app.
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
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </p>
        )}
        {success && (
          <p role="status" className="rounded-xl border border-[#bfdab8] bg-[#ecf8e8] p-4 text-sm text-[#285c33]">
            {success}
          </p>
        )}

        <section className="grid gap-5 xl:grid-cols-2">
          <div className="rounded-[24px] border border-[#e1e8dd] bg-white p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-xl font-black">
              <Trophy size={20} /> Create challenge
            </h2>
            <div className="mt-5 grid gap-4">
              <label className="text-sm font-bold">
                Title
                <input value={challengeTitle} onChange={(e) => setChallengeTitle(e.target.value)} className={inputClass} placeholder="November Consistency" />
              </label>
              <label className="text-sm font-bold">
                Description
                <textarea value={challengeDescription} onChange={(e) => setChallengeDescription(e.target.value)} className={inputClass} rows={3} placeholder="Complete 12 gym visits this month." />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-bold">
                  Starts
                  <input type="date" value={challengeStart} onChange={(e) => setChallengeStart(e.target.value)} className={inputClass} />
                </label>
                <label className="text-sm font-bold">
                  Ends
                  <input type="date" value={challengeEnd} onChange={(e) => setChallengeEnd(e.target.value)} className={inputClass} />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-bold">
                  Visit target
                  <input type="number" min={1} max={100} value={challengeTarget} onChange={(e) => setChallengeTarget(Number(e.target.value))} className={inputClass} />
                </label>
                <label className="text-sm font-bold">
                  Bonus SP Points
                  <input type="number" min={0} max={100000} value={challengePoints} onChange={(e) => setChallengePoints(Number(e.target.value))} className={inputClass} />
                </label>
              </div>
              <button type="button" disabled={busy === "challenge"} onClick={() => void createChallenge()} className="rounded-xl bg-[#193b2a] px-5 py-3 text-sm font-black text-white disabled:opacity-50">
                {busy === "challenge" ? "Creating…" : "Create challenge & notify members"}
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
                <input value={rewardName} onChange={(e) => setRewardName(e.target.value)} className={inputClass} placeholder="Free guest pass" />
              </label>
              <label className="text-sm font-bold">
                Description
                <textarea value={rewardDescription} onChange={(e) => setRewardDescription(e.target.value)} className={inputClass} rows={3} placeholder="One guest visit for a friend or family member." />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-bold">
                  SP Points cost
                  <input type="number" min={1} value={rewardCost} onChange={(e) => setRewardCost(Number(e.target.value))} className={inputClass} />
                </label>
                <label className="text-sm font-bold">
                  Inventory
                  <input value={rewardInventory} onChange={(e) => setRewardInventory(e.target.value)} className={inputClass} placeholder="Blank = unlimited" />
                </label>
              </div>
              <button type="button" disabled={busy === "reward"} onClick={() => void createReward()} className="rounded-xl bg-[#193b2a] px-5 py-3 text-sm font-black text-white disabled:opacity-50">
                {busy === "reward" ? "Adding…" : "Add reward"}
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-[24px] border border-[#e1e8dd] bg-white p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-xl font-black">
            <Bell size={20} /> Send member notification
          </h2>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <label className="text-sm font-bold">
              Title
              <input value={pushTitle} onChange={(e) => setPushTitle(e.target.value)} className={inputClass} placeholder="Saturday group class update" />
            </label>
            <label className="text-sm font-bold">
              App destination
              <input value={pushLink} onChange={(e) => setPushLink(e.target.value)} className={inputClass} placeholder="/rewards, /blog, /bookings…" />
            </label>
            <label className="text-sm font-bold">
              Type
              <select value={pushKind} onChange={(e) => setPushKind(e.target.value)} className={inputClass}>
                <option value="general">General</option>
                <option value="blog">Blog</option>
                <option value="challenge">Challenge</option>
                <option value="booking">Booking</option>
                <option value="announcement">Announcement</option>
              </select>
            </label>
            <label className="text-sm font-bold lg:row-span-2">
              Message
              <textarea value={pushBody} onChange={(e) => setPushBody(e.target.value)} className={inputClass} rows={4} placeholder="Short, useful message for members." />
            </label>
            <button type="button" disabled={busy === "push"} onClick={() => void sendBroadcast()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#193b2a] px-5 py-3 text-sm font-black text-white disabled:opacity-50">
              <Send size={17} /> {busy === "push" ? "Sending…" : "Publish & send push"}
            </button>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <div className="rounded-[24px] border border-[#e1e8dd] bg-white p-5 sm:p-6">
            <h2 className="text-xl font-black">Challenges</h2>
            <div className="mt-4 space-y-3">
              {challenges.map((item) => (
                <article key={item.id} className="rounded-2xl border border-[#e4ebe1] bg-[#f8faf6] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black">{item.title}</p>
                      <p className="mt-1 text-xs leading-5 text-[#657568]">{item.description}</p>
                      <p className="mt-2 text-xs font-bold text-[#45634b]">
                        {item.target_visits} visits · +{item.points_reward} pts · {item.starts_on} → {item.ends_on}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${item.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                      {item.active ? "ACTIVE" : "OFF"}
                    </span>
                  </div>
                  <button type="button" disabled={busy === item.id} onClick={() => void toggleChallenge(item)} className="mt-3 rounded-xl border border-[#cfdaca] px-3 py-2 text-xs font-bold disabled:opacity-50">
                    {item.active ? "Deactivate" : "Activate"}
                  </button>
                </article>
              ))}
              {!challenges.length && <p className="text-sm text-[#657568]">No challenges yet.</p>}
            </div>
          </div>

          <div className="rounded-[24px] border border-[#e1e8dd] bg-white p-5 sm:p-6">
            <h2 className="text-xl font-black">Rewards catalogue</h2>
            <div className="mt-4 space-y-3">
              {rewards.map((item) => (
                <article key={item.id} className="rounded-2xl border border-[#e4ebe1] bg-[#f8faf6] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black">{item.name}</p>
                      <p className="mt-1 text-xs leading-5 text-[#657568]">{item.description}</p>
                      <p className="mt-2 text-xs font-bold text-[#45634b]">
                        {item.points_cost.toLocaleString()} pts · {item.inventory === null ? "Unlimited" : `${item.inventory} left`}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${item.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                      {item.active ? "ACTIVE" : "OFF"}
                    </span>
                  </div>
                  <button type="button" disabled={busy === item.id} onClick={() => void toggleReward(item)} className="mt-3 rounded-xl border border-[#cfdaca] px-3 py-2 text-xs font-bold disabled:opacity-50">
                    {item.active ? "Hide reward" : "Publish reward"}
                  </button>
                </article>
              ))}
              {!rewards.length && <p className="text-sm text-[#657568]">No rewards published yet.</p>}
            </div>
          </div>
        </section>

        <section className="rounded-[24px] border border-[#e1e8dd] bg-white p-5 sm:p-6">
          <h2 className="text-xl font-black">Reward redemptions</h2>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {redemptions.map((item) => (
              <article key={item.id} className="rounded-2xl border border-[#e4ebe1] bg-[#f8faf6] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black">{item.reward?.name || "Reward"}</p>
                    <p className="mt-1 text-xs text-[#657568]">
                      {item.member?.full_name || "Member"} · {item.member?.phone || item.member?.email || "No contact"}
                    </p>
                    <p className="mt-2 text-xs font-bold">{item.points_cost.toLocaleString()} points</p>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase">
                    {item.status}
                  </span>
                </div>
                {item.staff_note && <p className="mt-3 text-xs text-[#657568]">Staff: {item.staff_note}</p>}
                <div className="mt-4 flex flex-wrap gap-2">
                  {item.status === "pending" && (
                    <>
                      <button type="button" disabled={busy === item.id} onClick={() => void updateRedemption(item, "approved")} className="rounded-xl bg-[#193b2a] px-3 py-2 text-xs font-bold text-white">
                        Approve
                      </button>
                      <button type="button" disabled={busy === item.id} onClick={() => void updateRedemption(item, "rejected")} className="rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-700">
                        Reject
                      </button>
                    </>
                  )}
                  {item.status === "approved" && (
                    <button type="button" disabled={busy === item.id} onClick={() => void updateRedemption(item, "fulfilled")} className="inline-flex items-center gap-2 rounded-xl bg-[#193b2a] px-3 py-2 text-xs font-bold text-white">
                      <CheckCircle2 size={14} /> Mark fulfilled
                    </button>
                  )}
                </div>
              </article>
            ))}
            {!redemptions.length && <p className="text-sm text-[#657568]">No reward redemptions yet.</p>}
          </div>
        </section>

        <section className="rounded-[24px] border border-[#e1e8dd] bg-white p-5 sm:p-6">
          <h2 className="text-xl font-black">Recent app notifications</h2>
          <div className="mt-4 space-y-2">
            {notifications.map((item) => (
              <article key={item.id} className="rounded-xl border border-[#e4ebe1] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black">{item.title}</p>
                    <p className="mt-1 text-xs leading-5 text-[#657568]">{item.body}</p>
                  </div>
                  <span className="rounded-full bg-[#edf6e7] px-2.5 py-1 text-[10px] font-black uppercase text-[#356942]">
                    {item.kind}
                  </span>
                </div>
              </article>
            ))}
            {!notifications.length && <p className="text-sm text-[#657568]">No app notifications yet.</p>}
          </div>
        </section>
      </div>
    </AdminWorkspaceShell>
  );
}

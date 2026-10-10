import { supabase } from "./supabase";
import { lagosToday } from "./ui";
import { uniqueVisitDates } from "./visit-goals";

export type HomeHighlight = {
  points: number;
  achievement: {
    title: string;
    description: string;
  } | null;
  challenge: {
    id: string;
    title: string;
    description: string;
    starts_on: string;
    ends_on: string;
    target_visits: number;
    points_reward: number;
    visits: number;
    percentage: number;
  } | null;
  latestPost: {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    category: string;
    featured_image: string | null;
  } | null;
};

export async function loadHomeHighlights(
  memberId: string,
  attendance: Array<{ checked_in_at: string }>,
): Promise<HomeHighlight> {
  await supabase.rpc("sync_my_engagement");

  const today = lagosToday();
  const [ledgerResult, achievementResult, challengeResult, postResult, settingsResult] =
    await Promise.all([
      supabase
        .from("member_points_ledger")
        .select("points")
        .eq("member_id", memberId),
      supabase
        .from("member_achievements")
        .select("achievement_code,awarded_at")
        .eq("member_id", memberId)
        .order("awarded_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("fitness_challenges")
        .select("id,title,description,starts_on,ends_on,target_visits,points_reward")
        .eq("active", true)
        .lte("starts_on", today)
        .gte("ends_on", today)
        .order("ends_on", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("blog_posts")
        .select("id,title,slug,excerpt,category,featured_image")
        .in("status", ["published", "scheduled"])
        .not("published_at", "is", null)
        .lte("published_at", new Date().toISOString())
        .order("published_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("app_engagement_settings")
        .select("program_started_at")
        .eq("id", "default")
        .maybeSingle(),
    ]);

  const points = (ledgerResult.data ?? []).reduce(
    (sum, row) => sum + Number(row.points || 0),
    0,
  );

  let achievement: HomeHighlight["achievement"] = null;
  const achievementCode = achievementResult.data?.achievement_code;
  if (achievementCode) {
    const { data } = await supabase
      .from("achievement_definitions")
      .select("title,description")
      .eq("code", achievementCode)
      .maybeSingle();

    if (data) {
      achievement = {
        title: String(data.title),
        description: String(data.description),
      };
    }
  }

  let challenge: HomeHighlight["challenge"] = null;
  if (challengeResult.data) {
    const row = challengeResult.data;
    const programStartedAt = settingsResult.data?.program_started_at
      ? new Date(settingsResult.data.program_started_at).getTime()
      : null;
    const eligibleAttendance = programStartedAt
      ? attendance.filter(
          (item) => new Date(item.checked_in_at).getTime() >= programStartedAt,
        )
      : attendance;
    const visits = uniqueVisitDates(eligibleAttendance).filter(
      (day) => day >= row.starts_on && day <= row.ends_on,
    ).length;
    const target = Math.max(1, Number(row.target_visits));
    challenge = {
      id: row.id,
      title: row.title,
      description: row.description,
      starts_on: row.starts_on,
      ends_on: row.ends_on,
      target_visits: target,
      points_reward: Number(row.points_reward || 0),
      visits,
      percentage: Math.min(100, Math.round((visits / target) * 100)),
    };
  }

  return {
    points,
    achievement,
    challenge,
    latestPost: postResult.data
      ? {
          id: postResult.data.id,
          title: postResult.data.title,
          slug: postResult.data.slug,
          excerpt: postResult.data.excerpt,
          category: postResult.data.category,
          featured_image: postResult.data.featured_image,
        }
      : null,
  };
}

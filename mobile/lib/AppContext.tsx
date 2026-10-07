import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { memberDisplayName } from "./member-name";
import { registerMemberPushToken } from "./push-notifications";
import { lagosToday } from "./ui";
import { supabase } from "./supabase";

export type Member = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  member_card_number: number;
};

export type Membership = {
  id: string;
  plan_name: string | null;
  start_date: string;
  end_date: string;
  status: string;
  payment_status: string | null;
  family_group_id: string | null;
  created_at: string;
};

export type Attendance = {
  id: string;
  checked_in_at: string;
  checked_out_at: string | null;
};

export type Payment = {
  id: string;
  amount: number;
  currency: string;
  payment_method: string | null;
  paid_at: string | null;
  created_at: string;
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
  cta_label: string | null;
  cta_url: string | null;
  priority: number;
  starts_at: string;
};

export type FamilySummary = {
  group_id: string;
  is_primary: boolean;
  primary_member_id: string;
  latest_end_date: string | null;
  members: Array<{
    slot: number;
    member_id: string;
    full_name: string;
    email: string | null;
  }>;
};

type AppValue = {
  session: Session | null;
  authLoading: boolean;
  dataLoading: boolean;
  refreshing: boolean;
  error: string;
  member: Member | null;
  memberships: Membership[];
  currentMembership: Membership | null;
  attendance: Attendance[];
  payments: Payment[];
  announcements: Announcement[];
  family: FamilySummary | null;
  notificationUnreadCount: number;
  refreshNotificationCount: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AppContext = createContext<AppValue | undefined>(undefined);

function chooseMembership(items: Membership[]) {
  const today = lagosToday();
  const paid = items.filter((item) => item.payment_status === "paid");
  const current = paid.find(
    (item) => item.start_date <= today && item.end_date >= today,
  );
  if (current) return current;

  const upcoming = paid
    .filter((item) => item.start_date > today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
  if (upcoming) return upcoming;

  return paid[0] ?? items[0] ?? null;
}

export function AppProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [member, setMember] = useState<Member | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [family, setFamily] = useState<FamilySummary | null>(null);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);

  const clearMemberData = useCallback(() => {
    setMember(null);
    setMemberships([]);
    setAttendance([]);
    setPayments([]);
    setAnnouncements([]);
    setFamily(null);
    setNotificationUnreadCount(0);
    setError("");
  }, []);

  const load = useCallback(
    async (showFullLoader: boolean) => {
      if (!session?.user) {
        clearMemberData();
        return;
      }

      if (showFullLoader) setDataLoading(true);
      setError("");

      try {
        const { data: memberRow, error: memberError } = await supabase
          .from("members")
          .select("id,full_name,email,phone,member_card_number")
          .eq("auth_user_id", session.user.id)
          .maybeSingle();

        if (memberError) throw memberError;

        const { data: announcementRows, error: announcementError } = await supabase
          .from("site_announcements")
          .select("id,title,body,cta_label,cta_url,priority,starts_at")
          .eq("show_dashboard", true)
          .order("priority", { ascending: false })
          .order("starts_at", { ascending: false })
          .limit(8);

        if (announcementError) throw announcementError;
        setAnnouncements((announcementRows ?? []) as Announcement[]);

        if (!memberRow) {
          setMember(null);
          setMemberships([]);
          setAttendance([]);
          setPayments([]);
          setFamily(null);
          setNotificationUnreadCount(0);
          return;
        }

        const typedMember = { ...memberRow, full_name: memberDisplayName(memberRow.full_name, session.user.user_metadata) } as Member;
        setMember(typedMember);
        void registerMemberPushToken(typedMember.id);

        const [
          membershipsResult,
          attendanceResult,
          paymentsResult,
          familyResult,
          notificationsResult,
          notificationReadsResult,
        ] = await Promise.all([
          supabase
            .from("memberships")
            .select(
              "id,plan_name,start_date,end_date,status,payment_status,family_group_id,created_at",
            )
            .eq("member_id", typedMember.id)
            .order("end_date", { ascending: false })
            .limit(24),
          supabase
            .from("attendance")
            .select("id,checked_in_at,checked_out_at")
            .eq("member_id", typedMember.id)
            .order("checked_in_at", { ascending: false })
            .limit(400),
          supabase
            .from("payments")
            .select("id,amount,currency,payment_method,paid_at,created_at")
            .eq("member_id", typedMember.id)
            .eq("status", "success")
            .order("created_at", { ascending: false })
            .limit(20),
          supabase.rpc("get_my_family_summary"),
          supabase
            .from("app_notifications")
            .select("id")
            .order("published_at", { ascending: false })
            .limit(100),
          supabase
            .from("member_notification_reads")
            .select("notification_id")
            .eq("member_id", typedMember.id),
        ]);

        if (membershipsResult.error) throw membershipsResult.error;
        if (attendanceResult.error) throw attendanceResult.error;
        if (paymentsResult.error) throw paymentsResult.error;
        if (familyResult.error) throw familyResult.error;

        setMemberships((membershipsResult.data ?? []) as Membership[]);
        setAttendance((attendanceResult.data ?? []) as Attendance[]);
        setPayments((paymentsResult.data ?? []) as Payment[]);
        setFamily((familyResult.data ?? null) as FamilySummary | null);
        const readIds = new Set(
          (notificationReadsResult.data ?? []).map((row) => String(row.notification_id)),
        );
        setNotificationUnreadCount(
          (notificationsResult.data ?? []).filter((row) => !readIds.has(String(row.id))).length,
        );
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Unable to load your member account.");
      } finally {
        setDataLoading(false);
        setRefreshing(false);
      }
    },
    [clearMemberData, session?.user],
  );

  const refreshNotificationCount = useCallback(async () => {
    if (!member?.id) {
      setNotificationUnreadCount(0);
      return;
    }

    const [notificationsResult, readsResult] = await Promise.all([
      supabase
        .from("app_notifications")
        .select("id")
        .order("published_at", { ascending: false })
        .limit(100),
      supabase
        .from("member_notification_reads")
        .select("notification_id")
        .eq("member_id", member.id),
    ]);

    const readIds = new Set(
      (readsResult.data ?? []).map((row) => String(row.notification_id)),
    );
    setNotificationUnreadCount(
      (notificationsResult.data ?? []).filter((row) => !readIds.has(String(row.id))).length,
    );
  }, [member?.id]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load(false);
  }, [load]);

  useEffect(() => {
    let live = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!live) return;
      setSession(data.session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });

    return () => {
      live = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authLoading) {
      if (session) {
        void load(true);
      } else {
        clearMemberData();
        setDataLoading(false);
      }
    }
  }, [authLoading, clearMemberData, load, session]);

  const currentMembership = useMemo(
    () => chooseMembership(memberships),
    [memberships],
  );

  const value = useMemo<AppValue>(
    () => ({
      session,
      authLoading,
      dataLoading,
      refreshing,
      error,
      member,
      memberships,
      currentMembership,
      attendance,
      payments,
      announcements,
      family,
      notificationUnreadCount,
      refreshNotificationCount,
      refresh,
    }),
    [
      session,
      authLoading,
      dataLoading,
      refreshing,
      error,
      member,
      memberships,
      currentMembership,
      attendance,
      payments,
      announcements,
      family,
      notificationUnreadCount,
      refreshNotificationCount,
      refresh,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used inside AppProvider.");
  return value;
}

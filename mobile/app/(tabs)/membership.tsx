import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useApp } from "../../lib/AppContext";
import {
  cancelMembershipExpiryReminders,
  membershipExpiryRemindersEnabled,
  scheduleMembershipExpiryReminders,
} from "../../lib/membership-reminders";
import { supabase } from "../../lib/supabase";
import {
  AccountLinkRequired,
  Card,
  colors,
  dateLabel,
  EmptyState,
  lagosToday,
  LoadingView,
  money,
  Pill,
  Screen,
  SectionTitle,
  sharedStyles,
} from "../../lib/ui";

type PlanOption = {
  id: string;
  name: string;
  price: number;
  durationDays: number;
};

const planIdByName: Record<string, string> = {
  "Daily Plan": "daily",
  "Weekly Plan": "weekly",
  "Monthly Plan": "monthly",
  Quarterly: "quarterly",
  "Semi-Annual": "semi-annual",
  Yearly: "yearly",
  "Monthly VIP Silver": "vip-silver",
  "Monthly VIP Gold": "vip-gold",
  "Family Plan": "family",
  "Personal Training": "personal-training",
};

export default function MembershipScreen() {
  const {
    session,
    member,
    dataLoading,
    currentMembership,
    memberships,
    family,
    refreshing,
    refresh,
  } = useApp();

  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [coupon, setCoupon] = useState("");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [pendingReference, setPendingReference] = useState("");
  const [paymentMessage, setPaymentMessage] = useState("");
  const [reminderBusy, setReminderBusy] = useState(false);
  const [remindersEnabled, setRemindersEnabled] = useState(false);

  useEffect(() => {
    let active = true;

    void (async () => {
      setPlansLoading(true);
      const { data, error } = await supabase
        .from("membership_plans")
        .select("name,price,duration_days")
        .eq("active", true)
        .in("name", Object.keys(planIdByName))
        .order("price", { ascending: true });

      if (!active) return;

      if (error) {
        console.error("Unable to load membership plans:", error);
        setPlans([]);
      } else {
        const next = (data ?? [])
          .map((row) => {
            const id = planIdByName[String(row.name)];
            if (!id) return null;
            return {
              id,
              name: String(row.name),
              price: Number(row.price ?? 0),
              durationDays: Number(row.duration_days ?? 0),
            } satisfies PlanOption;
          })
          .filter((item): item is PlanOption => Boolean(item && item.price > 0));

        setPlans(next);
      }

      setPlansLoading(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void membershipExpiryRemindersEnabled(currentMembership?.end_date).then(
      (enabled) => {
        if (active) setRemindersEnabled(enabled);
      },
    );
    return () => {
      active = false;
    };
  }, [currentMembership?.end_date]);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  );

  if (dataLoading) return <LoadingView />;
  if (!member) {
    return (
      <Screen refreshing={refreshing} onRefresh={() => void refresh()}>
        <AccountLinkRequired email={session?.user.email} />
      </Screen>
    );
  }

  const today = lagosToday();
  const currentPhase = currentMembership
    ? currentMembership.start_date > today
      ? "UPCOMING"
      : currentMembership.end_date >= today
        ? "ACTIVE"
        : "EXPIRED"
    : "NO PLAN";

  async function verifyPayment(reference: string, automatic = false) {
    setPaymentBusy(true);
    setPaymentMessage("Confirming your payment with Paystack…");

    try {
      const { data, error } = await supabase.functions.invoke("verify-payment", {
        body: { reference },
      });

      if (error || !data?.success) {
        const message =
          data?.error ||
          data?.message ||
          error?.message ||
          "Payment has not been confirmed yet.";

        setPendingReference(reference);
        setPaymentMessage(
          automatic
            ? "If you completed payment, tap Verify payment below. Do not pay a second time."
            : message,
        );

        if (!automatic) {
          Alert.alert("Payment not confirmed", message);
        }
        return false;
      }

      setPendingReference("");
      setPaymentMessage("");
      setCoupon("");
      setSelectedPlanId("");
      await refresh();

      Alert.alert(
        data?.already_processed ? "Payment already confirmed" : "Payment successful",
        `${data?.plan_name ?? "Your membership"} is now updated through ${dateLabel(data?.end_date)}.`,
      );
      return true;
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Unable to verify payment right now.";

      setPendingReference(reference);
      setPaymentMessage(
        "Verification could not finish. Keep this reference and try again; do not pay again.",
      );

      if (!automatic) Alert.alert("Verification issue", message);
      return false;
    } finally {
      setPaymentBusy(false);
    }
  }

  async function startPayment() {
    if (!selectedPlan) {
      Alert.alert("Choose a plan", "Select the membership plan you want to pay for.");
      return;
    }

    if (selectedPlan.id === "family") {
      if (!family) {
        Alert.alert(
          "Family Plan setup required",
          "Starting a new Family Plan requires the three family members to be linked first. Reception can complete that setup before payment.",
        );
        return;
      }

      if (!family.is_primary) {
        Alert.alert(
          "Primary member renewal",
          "Only the primary Family Plan member should make the renewal payment.",
        );
        return;
      }
    }

    setPaymentBusy(true);
    setPaymentMessage("Preparing secure Paystack checkout…");

    try {
      const cleanCoupon = coupon.trim().toUpperCase();
      const { data, error } = await supabase.functions.invoke(
        "initialize-payment",
        {
          body: {
            planId: selectedPlan.id,
            client: "mobile",
            ...(cleanCoupon ? { couponCode: cleanCoupon } : {}),
          },
        },
      );

      if (error || !data?.authorization_url || !data?.reference) {
        throw new Error(
          data?.error ||
            error?.message ||
            "Unable to create Paystack checkout.",
        );
      }

      const reference = String(data.reference);
      setPendingReference(reference);
      setPaymentMessage(
        "Complete payment in Paystack, then close the browser and return here.",
      );

      await WebBrowser.openBrowserAsync(String(data.authorization_url));

      await verifyPayment(reference, true);
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Unable to start payment.";
      setPaymentMessage("");
      Alert.alert("Payment could not start", message);
    } finally {
      setPaymentBusy(false);
    }
  }

  async function enableReminders() {
    if (!currentMembership?.end_date) {
      Alert.alert(
        "No expiry date",
        "There is no membership expiry date available to schedule reminders for.",
      );
      return;
    }

    setReminderBusy(true);
    try {
      const result = await scheduleMembershipExpiryReminders(
        currentMembership.end_date,
        currentMembership.plan_name ?? "membership",
      );

      setRemindersEnabled(result.enabled);

      if (!result.enabled) {
        Alert.alert(
          "Notifications not enabled",
          result.scheduled === 0
            ? "Allow notifications in iPhone Settings, or the current plan is too close to expiry for a future reminder."
            : "Notifications could not be enabled.",
        );
        return;
      }

      Alert.alert(
        "Expiry reminders enabled",
        `${result.scheduled} reminder${result.scheduled === 1 ? "" : "s"} scheduled for this membership.`,
      );
    } catch (cause) {
      Alert.alert(
        "Could not schedule reminders",
        cause instanceof Error ? cause.message : "Please try again.",
      );
    } finally {
      setReminderBusy(false);
    }
  }

  async function disableReminders() {
    setReminderBusy(true);
    try {
      await cancelMembershipExpiryReminders();
      setRemindersEnabled(false);
      Alert.alert("Expiry reminders off", "Scheduled membership reminders were removed.");
    } finally {
      setReminderBusy(false);
    }
  }

  return (
    <Screen refreshing={refreshing} onRefresh={() => void refresh()}>
      <Text style={sharedStyles.kicker}>MEMBERSHIP</Text>
      <Text style={sharedStyles.title}>Your plan.</Text>
      <Text style={sharedStyles.subtitle}>
        Your dates here are the same dates held by reception.
      </Text>

      {currentMembership ? (
        <Card style={styles.hero}>
          <View style={sharedStyles.row}>
            <Pill tone={currentPhase === "ACTIVE" ? "success" : currentPhase === "UPCOMING" ? "amber" : "danger"}>
              {currentPhase}
            </Pill>
            {!!currentMembership.family_group_id && <Pill>FAMILY PLAN</Pill>}
          </View>
          <Text style={styles.heroPlan}>{currentMembership.plan_name ?? "Membership"}</Text>
          <View style={styles.dateGrid}>
            <View style={styles.dateCell}>
              <Text style={styles.dateLabel}>START DATE</Text>
              <Text style={styles.dateValue}>{dateLabel(currentMembership.start_date)}</Text>
            </View>
            <View style={styles.dateCell}>
              <Text style={styles.dateLabel}>END DATE</Text>
              <Text style={styles.dateValue}>{dateLabel(currentMembership.end_date)}</Text>
            </View>
          </View>
        </Card>
      ) : (
        <EmptyState>No membership is attached to this account yet.</EmptyState>
      )}

      {!!currentMembership?.end_date && (
        <Card>
          <View style={styles.reminderRow}>
            <View style={styles.reminderIcon}>
              <Ionicons
                name={remindersEnabled ? "notifications" : "notifications-outline"}
                size={21}
                color={colors.green}
              />
            </View>
            <View style={styles.grow}>
              <Text style={styles.reminderTitle}>Membership expiry reminders</Text>
              <Text style={styles.reminderText}>
                {remindersEnabled
                  ? "This phone will remind you before the current plan expires."
                  : "Get reminders at 7 days, 3 days, 1 day and expiry day when those dates are still ahead."}
              </Text>
            </View>
          </View>
          <Pressable
            style={[styles.secondaryButton, reminderBusy && styles.disabled]}
            disabled={reminderBusy}
            onPress={() =>
              void (remindersEnabled ? disableReminders() : enableReminders())
            }
          >
            <Text style={styles.secondaryButtonText}>
              {reminderBusy
                ? "Please wait…"
                : remindersEnabled
                  ? "Turn reminders off"
                  : "Enable expiry reminders"}
            </Text>
          </Pressable>
        </Card>
      )}

      {!!family && (
        <>
          <SectionTitle title="Family Plan" />
          <Card>
            <View style={sharedStyles.row}>
              <View>
                <Text style={styles.familyLabel}>
                  {family.is_primary ? "PRIMARY MEMBER" : "FAMILY MEMBER"}
                </Text>
                <Text style={styles.familyExpiry}>
                  Group expiry: {dateLabel(family.latest_end_date)}
                </Text>
              </View>
              <Ionicons name="people" size={24} color={colors.green2} />
            </View>
            <View style={styles.familyList}>
              {family.members.map((person) => (
                <View key={person.member_id} style={styles.familyRow}>
                  <View style={styles.slot}>
                    <Text style={styles.slotText}>{person.slot}</Text>
                  </View>
                  <View style={styles.grow}>
                    <Text style={styles.familyName}>{person.full_name}</Text>
                    <Text style={styles.familyEmail}>{person.email ?? "No email"}</Text>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        </>
      )}

      <SectionTitle title="Renew or change plan" />
      <Card>
        <Text style={styles.paymentIntro}>
          Choose a plan and pay securely through Paystack. Existing members do not
          pay a new registration fee.
        </Text>

        {plansLoading ? (
          <Text style={styles.loadingText}>Loading current gym prices…</Text>
        ) : plans.length ? (
          <View style={styles.planList}>
            {plans.map((plan) => {
              const selected = selectedPlanId === plan.id;
              const familyUnavailable =
                plan.id === "family" && (!family || !family.is_primary);

              return (
                <Pressable
                  key={plan.id}
                  disabled={paymentBusy}
                  onPress={() => setSelectedPlanId(plan.id)}
                  style={[
                    styles.planOption,
                    selected && styles.planOptionSelected,
                    familyUnavailable && styles.planOptionMuted,
                  ]}
                >
                  <View style={styles.grow}>
                    <Text style={styles.planOptionName}>{plan.name}</Text>
                    <Text style={styles.planOptionMeta}>
                      {plan.durationDays} day{plan.durationDays === 1 ? "" : "s"}
                      {familyUnavailable ? " · setup/primary member required" : ""}
                    </Text>
                  </View>
                  <Text style={styles.planPrice}>{money(plan.price)}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Text style={styles.loadingText}>
            Current membership prices could not be loaded. Pull down to retry.
          </Text>
        )}

        <Text style={styles.inputLabel}>Coupon code (optional)</Text>
        <TextInput
          value={coupon}
          onChangeText={(value) => setCoupon(value.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!paymentBusy}
          placeholder="Enter coupon code"
          placeholderTextColor="#95A098"
          style={styles.input}
        />

        {!!paymentMessage && (
          <View style={styles.paymentMessage}>
            <Ionicons name="information-circle-outline" size={18} color={colors.green2} />
            <Text style={styles.paymentMessageText}>{paymentMessage}</Text>
          </View>
        )}

        <Pressable
          style={[
            sharedStyles.primaryButton,
            (!selectedPlan || paymentBusy) && styles.disabled,
          ]}
          disabled={!selectedPlan || paymentBusy}
          onPress={() => void startPayment()}
        >
          <Text style={sharedStyles.primaryButtonText}>
            {paymentBusy
              ? "Please wait…"
              : selectedPlan
                ? `Pay ${money(selectedPlan.price)} with Paystack`
                : "Choose a plan"}
          </Text>
        </Pressable>

        {!!pendingReference && (
          <Pressable
            style={[styles.secondaryButton, paymentBusy && styles.disabled]}
            disabled={paymentBusy}
            onPress={() => void verifyPayment(pendingReference)}
          >
            <Text style={styles.secondaryButtonText}>Verify completed payment</Text>
          </Pressable>
        )}

        <Text style={styles.paymentSafety}>
          If Paystack charges you but verification is delayed, do not pay again.
          Return here and use Verify completed payment.
        </Text>
      </Card>

      <SectionTitle title="Membership history" />
      {memberships.length ? (
        <Card>
          {memberships.map((item, index) => (
            <View
              key={item.id}
              style={[styles.historyRow, index > 0 && styles.historyBorder]}
            >
              <View style={styles.grow}>
                <Text style={styles.historyPlan}>{item.plan_name ?? "Membership"}</Text>
                <Text style={styles.historyDates}>
                  {dateLabel(item.start_date)} — {dateLabel(item.end_date)}
                </Text>
              </View>
              <Pill
                tone={
                  item.payment_status === "paid" && item.end_date >= today
                    ? "success"
                    : "neutral"
                }
              >
                {item.payment_status?.toUpperCase() ?? item.status.toUpperCase()}
              </Pill>
            </View>
          ))}
        </Card>
      ) : (
        <EmptyState>Your previous memberships will appear here.</EmptyState>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 16 },
  heroPlan: { color: colors.ink, fontSize: 27, fontWeight: "900", letterSpacing: -0.7 },
  dateGrid: { flexDirection: "row", gap: 10 },
  dateCell: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    flex: 1,
    padding: 13,
  },
  dateLabel: { color: colors.muted, fontSize: 9, fontWeight: "900", letterSpacing: 0.9 },
  dateValue: { color: colors.ink, fontSize: 13, fontWeight: "900", marginTop: 4 },
  familyLabel: { color: colors.green2, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  familyExpiry: { color: colors.muted, fontSize: 12, marginTop: 4 },
  familyList: { borderTopColor: colors.line, borderTopWidth: 1, gap: 12, marginTop: 16, paddingTop: 16 },
  familyRow: { alignItems: "center", flexDirection: "row", gap: 11 },
  slot: {
    alignItems: "center",
    backgroundColor: colors.green,
    borderRadius: 999,
    height: 29,
    justifyContent: "center",
    width: 29,
  },
  slotText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  grow: { flex: 1 },
  familyName: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  familyEmail: { color: colors.muted, fontSize: 11, marginTop: 2 },
  reminderRow: { alignItems: "center", flexDirection: "row", gap: 12 },
  reminderIcon: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  reminderTitle: { color: colors.ink, fontSize: 14, fontWeight: "900" },
  reminderText: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 3 },
  paymentIntro: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  loadingText: { color: colors.muted, fontSize: 12, paddingVertical: 12, textAlign: "center" },
  planList: { gap: 8, marginTop: 14 },
  planOption: {
    alignItems: "center",
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 13,
  },
  planOptionSelected: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.green2,
    borderWidth: 2,
  },
  planOptionMuted: { opacity: 0.62 },
  planOptionName: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  planOptionMeta: { color: colors.muted, fontSize: 10, marginTop: 3 },
  planPrice: { color: colors.green, fontSize: 13, fontWeight: "900" },
  inputLabel: { color: colors.ink, fontSize: 11, fontWeight: "900", marginTop: 17 },
  input: {
    backgroundColor: "#FAFCF9",
    borderColor: colors.line,
    borderRadius: 13,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 14,
    marginBottom: 13,
    marginTop: 6,
    minHeight: 48,
    paddingHorizontal: 13,
  },
  paymentMessage: {
    alignItems: "flex-start",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
    padding: 11,
  },
  paymentMessageText: { color: colors.ink, flex: 1, fontSize: 11, lineHeight: 17 },
  secondaryButton: {
    alignItems: "center",
    borderColor: colors.green2,
    borderRadius: 13,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: 10,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  secondaryButtonText: { color: colors.green2, fontSize: 12, fontWeight: "900" },
  disabled: { opacity: 0.55 },
  paymentSafety: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 16,
    marginTop: 11,
    textAlign: "center",
  },
  historyRow: { alignItems: "center", flexDirection: "row", gap: 10, paddingVertical: 8 },
  historyBorder: { borderTopColor: colors.line, borderTopWidth: 1, marginTop: 5, paddingTop: 13 },
  historyPlan: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  historyDates: { color: colors.muted, fontSize: 11, marginTop: 3 },
});

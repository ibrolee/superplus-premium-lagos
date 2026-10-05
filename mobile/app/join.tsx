import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useApp } from "../lib/AppContext";
import { publicMembershipPlans } from "../lib/public-site";
import { supabase } from "../lib/supabase";
import { Card, colors, money, Screen, sharedStyles } from "../lib/ui";

export default function PublicJoinScreen() {
  const { member, session } = useApp();
  const params = useLocalSearchParams<{ planId?: string }>();
  const requestedPlanId =
    typeof params.planId === "string" &&
    publicMembershipPlans.some((plan) => plan.id === params.planId)
      ? params.planId
      : "monthly";
  const [selectedPlanId, setSelectedPlanId] = useState(requestedPlanId);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [coupon, setCoupon] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedPlan = useMemo(
    () =>
      publicMembershipPlans.find((plan) => plan.id === selectedPlanId) ??
      publicMembershipPlans[0]!,
    [selectedPlanId],
  );

  useEffect(() => {
    setFullName((current) => current || member?.full_name || "");
    setEmail((current) => current || member?.email || session?.user.email || "");
    setPhone((current) => current || member?.phone || "");
  }, [member?.email, member?.full_name, member?.phone, session?.user.email]);

  async function continueToPayment() {
    const name = fullName.trim();
    const mail = email.trim().toLowerCase();
    const mobile = phone.trim();
    const day = Number(birthDay);
    const month = Number(birthMonth);
    const cleanCoupon = coupon.trim().toUpperCase();

    if (selectedPlan.id === "family") {
      await WebBrowser.openBrowserAsync("https://www.superplusfitness.com/family-join");
      return;
    }

    if (
      name.length < 2 ||
      !mail.includes("@") ||
      mobile.length < 7 ||
      !Number.isInteger(day) ||
      day < 1 ||
      day > 31 ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12
    ) {
      Alert.alert(
        "Check your details",
        "Enter your full name, email, phone number, birth day and birth month.",
      );
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "initialize-public-payment",
        {
          body: {
            planId: selectedPlan.id,
            fullName: name,
            email: mail,
            phone: mobile,
            birthDay: day,
            birthMonth: month,
            ...(cleanCoupon ? { couponCode: cleanCoupon } : {}),
          },
        },
      );

      if (error) throw new Error(error.message || "Unable to start payment.");
      if (!data?.authorization_url) {
        throw new Error(data?.error || "Unable to start payment.");
      }

      const membershipAmount = Number(data.membership_amount);
      const registrationAmount = Number(data.registration_amount);
      const totalAmount = Number(data.total_amount);

      if (
        membershipAmount !== selectedPlan.price ||
        totalAmount !== membershipAmount + registrationAmount ||
        (!cleanCoupon && registrationAmount !== selectedPlan.registration)
      ) {
        throw new Error("Checkout total did not match the selected plan.");
      }

      await WebBrowser.openBrowserAsync(data.authorization_url);

      Alert.alert(
        "Payment window closed",
        "If you completed payment, your member profile is ready. Tap Member login and use your registered email to sign in or create a password.",
        [
          { text: "Stay here", style: "cancel" },
          { text: "Member login", onPress: () => router.replace("/login") },
        ],
      );
    } catch (cause) {
      Alert.alert(
        "Could not start payment",
        cause instanceof Error ? cause.message : "Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View style={styles.topRow}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={21} color={colors.ink} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={sharedStyles.kicker}>JOIN SUPER PLUS</Text>
          <Text style={styles.title}>Choose your membership.</Text>
          <Text style={sharedStyles.subtitle}>
            Register as a new member and pay securely through Paystack.
          </Text>
        </View>
      </View>

      <View style={styles.planList}>
        {publicMembershipPlans.map((plan) => {
          const selected = plan.id === selectedPlanId;
          return (
            <Pressable
              key={plan.id}
              style={[styles.planCard, selected && styles.planCardSelected]}
              onPress={() => setSelectedPlanId(plan.id)}
            >
              <View style={styles.planTop}>
                <View style={styles.grow}>
                  <Text style={styles.planName}>{plan.name}</Text>
                  <Text style={styles.planDuration}>{plan.duration}</Text>
                </View>
                {!!plan.badge && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{plan.badge}</Text>
                  </View>
                )}
                {selected && (
                  <Ionicons name="checkmark-circle" size={22} color={colors.green} />
                )}
              </View>
              <Text style={styles.planPrice}>{money(plan.price)}</Text>
              <Text style={styles.planRegistration}>
                Registration: {money(plan.registration)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Card>
        <Text style={styles.formTitle}>{selectedPlan.name}</Text>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total before coupon</Text>
          <Text style={styles.totalValue}>
            {money(selectedPlan.price + selectedPlan.registration)}
          </Text>
        </View>

        {selectedPlan.id === "family" ? (
          <>
            <Text style={styles.familyNote}>
              The Family Plan registers three people together. We’ll open the
              dedicated Super Plus family registration flow inside the app.
            </Text>
            <Pressable
              style={styles.primaryButton}
              onPress={() => void continueToPayment()}
            >
              <Text style={styles.primaryButtonText}>Continue with Family Plan</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.label}>Full name</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter your full name"
              placeholderTextColor="#95A098"
              autoComplete="name"
            />

            <Text style={styles.label}>Email address</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#95A098"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
            />

            <Text style={styles.label}>Phone number</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="08012345678"
              placeholderTextColor="#95A098"
              keyboardType="phone-pad"
              autoComplete="tel"
            />

            <Text style={styles.label}>Birthday</Text>
            <View style={styles.inlineInputs}>
              <TextInput
                style={[styles.input, styles.halfInput]}
                value={birthDay}
                onChangeText={(value) => setBirthDay(value.replace(/\D/g, "").slice(0, 2))}
                placeholder="Day"
                placeholderTextColor="#95A098"
                keyboardType="number-pad"
                maxLength={2}
              />
              <TextInput
                style={[styles.input, styles.halfInput]}
                value={birthMonth}
                onChangeText={(value) => setBirthMonth(value.replace(/\D/g, "").slice(0, 2))}
                placeholder="Month"
                placeholderTextColor="#95A098"
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>
            <Text style={styles.helper}>
              We only need the day and month for birthday benefits.
            </Text>

            <Text style={styles.label}>Coupon code (optional)</Text>
            <TextInput
              style={styles.input}
              value={coupon}
              onChangeText={setCoupon}
              placeholder="Enter coupon code"
              placeholderTextColor="#95A098"
              autoCapitalize="characters"
              autoCorrect={false}
            />

            <Pressable
              style={[styles.primaryButton, loading && styles.disabled]}
              disabled={loading}
              onPress={() => void continueToPayment()}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>Continue to payment</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                </>
              )}
            </Pressable>

            <Text style={styles.securityNote}>
              Paystack handles the payment securely. Your gym membership
              activates only after the payment is successfully verified.
            </Text>
          </>
        )}
      </Card>

      <Pressable style={styles.memberLogin} onPress={() => router.push("/login")}>
        <Text style={styles.memberLoginText}>Already have an account? Sign in instead</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { alignItems: "flex-start", flexDirection: "row", gap: 12 },
  backButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, height: 44, justifyContent: "center", width: 44 },
  headerCopy: { flex: 1, gap: 6 },
  title: { color: colors.ink, fontSize: 29, fontWeight: "900", letterSpacing: -0.8, lineHeight: 34 },
  planList: { gap: 9 },
  planCard: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 17, borderWidth: 1, padding: 15 },
  planCardSelected: { backgroundColor: colors.surfaceMuted, borderColor: colors.green2, borderWidth: 2 },
  planTop: { alignItems: "center", flexDirection: "row", gap: 8 },
  grow: { flex: 1 },
  planName: { color: colors.ink, fontSize: 14, fontWeight: "900" },
  planDuration: { color: colors.muted, fontSize: 10, marginTop: 3 },
  badge: { backgroundColor: colors.green, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  badgeText: { color: "#FFFFFF", fontSize: 8, fontWeight: "900", textTransform: "uppercase" },
  planPrice: { color: colors.green, fontSize: 20, fontWeight: "900", marginTop: 12 },
  planRegistration: { color: colors.muted, fontSize: 10, marginTop: 3 },
  formTitle: { color: colors.ink, fontSize: 20, fontWeight: "900" },
  totalRow: { alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", marginBottom: 8, paddingBottom: 14, paddingTop: 7 },
  totalLabel: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  totalValue: { color: colors.green, fontSize: 16, fontWeight: "900" },
  label: { color: colors.ink, fontSize: 11, fontWeight: "900", marginTop: 10 },
  input: { backgroundColor: "#FAFCF9", borderColor: colors.line, borderRadius: 13, borderWidth: 1, color: colors.ink, fontSize: 14, marginTop: 6, minHeight: 50, paddingHorizontal: 13 },
  inlineInputs: { flexDirection: "row", gap: 10 },
  halfInput: { flex: 1 },
  helper: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 5 },
  familyNote: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 10 },
  primaryButton: { alignItems: "center", backgroundColor: colors.green, borderRadius: 14, flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 18, minHeight: 54, paddingHorizontal: 16 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  disabled: { opacity: 0.55 },
  securityNote: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 11, textAlign: "center" },
  memberLogin: { alignItems: "center", minHeight: 44, justifyContent: "center" },
  memberLoginText: { color: colors.green2, fontSize: 12, fontWeight: "900" },
});

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp } from "../lib/AppContext";
import { BrandLogo } from "../lib/BrandLogo";
import { supabase } from "../lib/supabase";
import { colors } from "../lib/ui";

type Step = "details" | "verify";

export default function CreateAccountScreen() {
  const { refresh } = useApp();
  const [step, setStep] = useState<Step>("details");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);

  function cleanEmail() {
    return email.trim().toLowerCase();
  }

  function validateDetails() {
    const name = fullName.trim().replace(/\s+/g, " ");
    const mobile = phone.trim();
    const mail = cleanEmail();

    if (name.length < 2) {
      Alert.alert("Enter your name", "Please enter your full name.");
      return null;
    }

    if (!mail.includes("@")) {
      Alert.alert("Enter your email", "Please enter a valid email address.");
      return null;
    }

    if (mobile.length < 7) {
      Alert.alert("Enter your phone number", "Please enter a valid phone number.");
      return null;
    }

    if (password.length < 6) {
      Alert.alert("Password too short", "Use at least 6 characters.");
      return null;
    }

    if (password.toLowerCase() !== confirmPassword.toLowerCase()) {
      Alert.alert("Passwords do not match", "Please enter the same password twice.");
      return null;
    }

    return { name, mobile, mail };
  }

  async function sendVerificationCode() {
    const details = validateDetails();
    if (!details) return;

    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: details.mail,
        options: {
          shouldCreateUser: true,
          data: {
            signup_source: "mobile_free_account",
            full_name: details.name,
            phone: details.mobile,
          },
        },
      });

      if (error) throw error;

      setEmail(details.mail);
      setToken("");
      setStep("verify");
    } catch (cause) {
      Alert.alert(
        "Could not send verification code",
        cause instanceof Error ? cause.message : "Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function verifyAndCreateAccount() {
    const cleanToken = token.replace(/\D/g, "");
    if (cleanToken.length !== 8) {
      Alert.alert("Check the code", "Please enter the 8-digit code from your email.");
      return;
    }

    setBusy(true);
    try {
      const { data: authData, error: verifyError } = await supabase.auth.verifyOtp({
        email: cleanEmail(),
        token: cleanToken,
        type: "email",
      });
      if (verifyError) throw verifyError;
      if (!authData.session) throw new Error("Email verification did not create a session.");

      const { data: profileData, error: profileError } = await supabase.rpc(
        "ensure_app_member_profile",
        {
          p_full_name: fullName.trim().replace(/\s+/g, " "),
          p_phone: phone.trim(),
        },
      );

      if (profileError) throw profileError;

      const profile = profileData as {
        success?: boolean;
        reason?: string;
      } | null;

      if (!profile?.success) {
        await supabase.auth.signOut();
        Alert.alert(
          "Account could not be linked",
          profile?.reason || "Please contact Super Plus reception for help.",
        );
        return;
      }

      const { error: passwordError } = await supabase.auth.updateUser({
        password: password.toLowerCase(),
        data: { full_name: fullName.trim().replace(/\s+/g, " "), phone: phone.trim() },
      });
      if (passwordError) throw passwordError;

      await refresh();
      router.replace("/(tabs)");
    } catch (cause) {
      Alert.alert(
        "Could not create account",
        cause instanceof Error ? cause.message : "Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={21} color={colors.ink} />
          </Pressable>

          <BrandLogo size={154} style={styles.brandLogo} />
          <Text style={styles.eyebrow}>FREE SUPER PLUS ACCOUNT</Text>
          <Text style={styles.title}>
            {step === "details" ? "Create your account." : "Verify your email."}
          </Text>
          <Text style={styles.copy}>
            {step === "details"
              ? "No membership payment is required. Create an account now, explore the app, and choose a gym plan whenever you’re ready."
              : `Enter the 8-digit code sent to ${email}. Your account will be ready immediately after verification.`}
          </Text>

          <View style={styles.form}>
            {step === "details" ? (
              <>
                <Text style={styles.label}>Full name</Text>
                <TextInput
                  style={styles.input}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Your full name"
                  placeholderTextColor="#95A098"
                  autoComplete="name"
                  editable={!busy}
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
                  editable={!busy}
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
                  editable={!busy}
                />

                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 6 characters"
                  placeholderTextColor="#95A098"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  editable={!busy}
                />

                <Text style={styles.label}>Confirm password</Text>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Repeat your password"
                  placeholderTextColor="#95A098"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  editable={!busy}
                  onSubmitEditing={() => void sendVerificationCode()}
                />

                <Pressable
                  style={({ pressed }) => [
                    styles.button,
                    pressed && styles.buttonPressed,
                    busy && styles.buttonDisabled,
                  ]}
                  disabled={busy}
                  onPress={() => void sendVerificationCode()}
                >
                  <Text style={styles.buttonText}>
                    {busy ? "Sending code…" : "Create free account"}
                  </Text>
                </Pressable>

                <Text style={styles.note}>
                  Creating an account does not activate a gym membership or charge you.
                  Your first membership can be purchased later from the Membership tab.
                </Text>
              </>
            ) : (
              <>
                <View style={styles.sentBox}>
                  <Text style={styles.sentLabel}>CODE SENT TO</Text>
                  <Text style={styles.sentEmail}>{email}</Text>
                </View>

                <Text style={styles.label}>8-digit verification code</Text>
                <TextInput
                  style={[styles.input, styles.codeInput]}
                  value={token}
                  onChangeText={(value) =>
                    setToken(value.replace(/\D/g, "").slice(0, 8))
                  }
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                  placeholder="00000000"
                  placeholderTextColor="#95A098"
                  maxLength={8}
                  autoFocus
                  editable={!busy}
                  onSubmitEditing={() => void verifyAndCreateAccount()}
                />

                <Pressable
                  style={({ pressed }) => [
                    styles.button,
                    pressed && styles.buttonPressed,
                    busy && styles.buttonDisabled,
                  ]}
                  disabled={busy}
                  onPress={() => void verifyAndCreateAccount()}
                >
                  <Text style={styles.buttonText}>
                    {busy ? "Creating account…" : "Verify & enter app"}
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.secondaryAction}
                  disabled={busy}
                  onPress={() => setStep("details")}
                >
                  <Text style={styles.secondaryActionText}>Change details</Text>
                </Pressable>
              </>
            )}
          </View>

          <Pressable
            style={styles.signInAction}
            disabled={busy}
            onPress={() => router.replace("/login")}
          >
            <Text style={styles.signInText}>Already have an account? Sign in</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: "center", padding: 24, paddingBottom: 40 },
  backButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    marginBottom: 18,
    width: 44,
  },
  brandLogo: { marginBottom: 20 },
  eyebrow: { color: colors.green2, fontSize: 11, fontWeight: "900", letterSpacing: 1.5 },
  title: {
    color: colors.ink,
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: -1.1,
    lineHeight: 41,
    marginTop: 9,
  },
  copy: { color: colors.muted, fontSize: 14, lineHeight: 22, marginTop: 12, maxWidth: 390 },
  form: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 22,
    borderWidth: 1,
    gap: 8,
    marginTop: 24,
    padding: 18,
  },
  label: { color: colors.ink, fontSize: 12, fontWeight: "900", marginTop: 5 },
  input: {
    backgroundColor: "#FAFCF9",
    borderColor: colors.line,
    borderRadius: 13,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  codeInput: {
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 5,
    textAlign: "center",
  },
  button: {
    alignItems: "center",
    backgroundColor: colors.green,
    borderRadius: 14,
    justifyContent: "center",
    marginTop: 12,
    minHeight: 54,
  },
  buttonPressed: { opacity: 0.88 },
  buttonDisabled: { opacity: 0.55 },
  buttonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  note: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
    marginHorizontal: 8,
    marginTop: 11,
    textAlign: "center",
  },
  sentBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 13,
    marginBottom: 8,
    padding: 13,
  },
  sentLabel: {
    color: colors.green2,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
  },
  sentEmail: { color: colors.ink, fontSize: 13, fontWeight: "900", marginTop: 4 },
  secondaryAction: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    minHeight: 40,
  },
  secondaryActionText: {
    color: colors.green2,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  signInAction: { alignItems: "center", justifyContent: "center", marginTop: 17, minHeight: 44 },
  signInText: { color: colors.green2, fontSize: 12, fontWeight: "900" },
});

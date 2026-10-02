import { useEffect, useState } from "react";
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
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp } from "../lib/AppContext";
import { supabase } from "../lib/supabase";
import { colors } from "../lib/ui";

export default function LoginScreen() {
  const { session } = useApp();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (session) router.replace("/(tabs)");
  }, [session]);

  async function sendCode() {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      Alert.alert("Enter your email", "Please enter the email address registered with your Super Plus membership.");
      return;
    }

    setSending(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
      });

      if (error) throw error;

      setEmail(cleanEmail);
      setToken("");
      setStep("code");
    } catch (cause) {
      Alert.alert(
        "Could not send code",
        cause instanceof Error ? cause.message : "Please try again.",
      );
    } finally {
      setSending(false);
    }
  }

  async function verifyCode() {
    const cleanEmail = email.trim().toLowerCase();
    const cleanToken = token.replace(/\D/g, "");

    if (cleanToken.length !== 8) {
      Alert.alert("Check the code", "Please enter the 8-digit code from your email.");
      return;
    }

    setVerifying(true);

    try {
      const { error } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanToken,
        type: "email",
      });

      if (error) throw error;

      router.replace("/(tabs)");
    } catch {
      Alert.alert(
        "Code not accepted",
        "That code is invalid or has expired. Please request a new code.",
      );
    } finally {
      setVerifying(false);
    }
  }

  function useDifferentEmail() {
    setStep("email");
    setToken("");
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
          <View style={styles.brandMark}>
            <Text style={styles.brandPlus}>+</Text>
          </View>

          <Text style={styles.eyebrow}>SUPER PLUS FITNESS & SPA</Text>

          <Text style={styles.title}>
            {step === "email" ? "Your gym, in your pocket." : "Check your email."}
          </Text>

          <Text style={styles.copy}>
            {step === "email"
              ? "Enter the email address registered with your Super Plus membership. We’ll send you a secure login code."
              : `Enter the 8-digit login code sent to ${email}.`}
          </Text>

          <View style={styles.form}>
            {step === "email" ? (
              <>
                <Text style={styles.label}>Email address</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  placeholder="you@example.com"
                  placeholderTextColor="#95A098"
                  editable={!sending}
                  onSubmitEditing={() => void sendCode()}
                />

                <Pressable
                  style={({ pressed }) => [
                    styles.button,
                    pressed && styles.buttonPressed,
                    sending && styles.buttonDisabled,
                  ]}
                  disabled={sending}
                  onPress={() => void sendCode()}
                >
                  <Text style={styles.buttonText}>
                    {sending ? "Sending code…" : "Send login code"}
                  </Text>
                </Pressable>

                <Text style={styles.note}>
                  No password required. We’ll email you a secure one-time code.
                </Text>
              </>
            ) : (
              <>
                <View style={styles.sentBox}>
                  <Text style={styles.sentLabel}>CODE SENT TO</Text>
                  <Text style={styles.sentEmail}>{email}</Text>
                </View>

                <Text style={styles.label}>8-digit login code</Text>
                <TextInput
                  style={[styles.input, styles.codeInput]}
                  value={token}
                  onChangeText={(value) =>
                    setToken(value.replace(/\D/g, "").slice(0, 8))
                  }
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  placeholder="00000000"
                  placeholderTextColor="#95A098"
                  maxLength={8}
                  autoFocus
                  editable={!verifying}
                  onSubmitEditing={() => void verifyCode()}
                />

                <Pressable
                  style={({ pressed }) => [
                    styles.button,
                    pressed && styles.buttonPressed,
                    verifying && styles.buttonDisabled,
                  ]}
                  disabled={verifying}
                  onPress={() => void verifyCode()}
                >
                  <Text style={styles.buttonText}>
                    {verifying ? "Verifying…" : "Sign in"}
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.secondaryAction}
                  disabled={verifying}
                  onPress={useDifferentEmail}
                >
                  <Text style={styles.secondaryActionText}>Use a different email</Text>
                </Pressable>
              </>
            )}
          </View>

          <Text style={styles.noteBottom}>
            Your app uses the same member login and account as superplusfitness.com.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: "center", padding: 24, paddingBottom: 40 },
  brandMark: {
    alignItems: "center",
    backgroundColor: colors.green,
    borderRadius: 18,
    height: 54,
    justifyContent: "center",
    marginBottom: 20,
    width: 54,
  },
  brandPlus: { color: "#FFFFFF", fontSize: 34, fontWeight: "300", marginTop: -3 },
  eyebrow: { color: colors.green2, fontSize: 11, fontWeight: "900", letterSpacing: 1.7 },
  title: {
    color: colors.ink,
    fontSize: 37,
    fontWeight: "900",
    letterSpacing: -1.2,
    lineHeight: 42,
    marginTop: 10,
    maxWidth: 340,
  },
  copy: { color: colors.muted, fontSize: 15, lineHeight: 23, marginTop: 13, maxWidth: 380 },
  form: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 22,
    borderWidth: 1,
    gap: 8,
    marginTop: 28,
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
    marginTop: 10,
    minHeight: 54,
  },
  buttonPressed: { opacity: 0.88 },
  buttonDisabled: { opacity: 0.55 },
  buttonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
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
  note: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
    marginHorizontal: 10,
    marginTop: 12,
    textAlign: "center",
  },
  noteBottom: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
    marginHorizontal: 10,
    marginTop: 18,
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
  sentEmail: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
    marginTop: 4,
  },
});

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
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) router.replace("/(tabs)");
  }, [session]);

  async function submit() {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes("@") || password.length < 6) {
      Alert.alert("Check your details", "Enter a valid email and a password of at least 6 characters.");
      return;
    }

    setBusy(true);
    try {
      if (creating) {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
        });
        if (error) throw error;
        if (!data.session) {
          Alert.alert(
            "Check your email",
            "Your login was created. Confirm the email if Supabase asks you to, then sign in.",
          );
          setCreating(false);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (error) throw error;
      }
      router.replace("/(tabs)");
    } catch (cause) {
      Alert.alert(
        creating ? "Could not create login" : "Could not sign in",
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
          <View style={styles.brandMark}>
            <Text style={styles.brandPlus}>+</Text>
          </View>
          <Text style={styles.eyebrow}>SUPER PLUS FITNESS & SPA</Text>
          <Text style={styles.title}>
            {creating ? "Create your member login." : "Your gym, in your pocket."}
          </Text>
          <Text style={styles.copy}>
            {creating
              ? "Use the exact email address saved on your membership profile at reception so the app can link to your existing gym record."
              : "Sign in to see your membership, permanent QR card, attendance and payment history."}
          </Text>

          <View style={styles.form}>
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
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType={creating ? "newPassword" : "password"}
              placeholder="At least 6 characters"
              placeholderTextColor="#95A098"
            />

            <Pressable
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                busy && styles.buttonDisabled,
              ]}
              disabled={busy}
              onPress={() => void submit()}
            >
              <Text style={styles.buttonText}>
                {busy ? "Please wait…" : creating ? "Create member login" : "Sign in"}
              </Text>
            </Pressable>
          </View>

          <Pressable onPress={() => setCreating((value) => !value)}>
            <Text style={styles.switchText}>
              {creating
                ? "Already have a login? Sign in"
                : "First time using the app? Create a member login"}
            </Text>
          </Pressable>

          <Text style={styles.note}>
            Creating an app login does not create or charge a new gym membership.
            Your email is matched to the membership already held by Super Plus.
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
  switchText: {
    color: colors.green2,
    fontSize: 13,
    fontWeight: "900",
    marginTop: 20,
    textAlign: "center",
  },
  note: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
    marginHorizontal: 10,
    marginTop: 18,
    textAlign: "center",
  },
});

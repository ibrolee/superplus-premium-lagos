import { Ionicons } from "@expo/vector-icons";
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
import { BrandLogo } from "../lib/BrandLogo";

type LoginMode = "password" | "code";
type LoginStep = "login" | "code" | "new-password";
type CodePurpose = "login" | "set-password";

export default function LoginScreen() {
  const { session } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [mode, setMode] = useState<LoginMode>("password");
  const [step, setStep] = useState<LoginStep>("login");
  const [codePurpose, setCodePurpose] = useState<CodePurpose>("login");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (
      session &&
      !(codePurpose === "set-password" && (step === "code" || step === "new-password"))
    ) {
      router.replace("/(tabs)");
    }
  }, [codePurpose, session, step]);

  function normalizedEmail() {
    return email.trim().toLowerCase();
  }

  function validEmail() {
    const value = normalizedEmail();
    if (!value || !value.includes("@")) {
      Alert.alert(
        "Enter your email",
        "Please enter the email address registered with your Super Plus membership.",
      );
      return null;
    }
    return value;
  }

  async function signInWithPassword() {
    const cleanEmail = validEmail();
    if (!cleanEmail) return;

    if (!password) {
      Alert.alert("Enter your password", "Please enter your Super Plus password.");
      return;
    }

    setVerifying(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password.toLowerCase(),
      });

      if (error) {
        Alert.alert(
          "Could not sign in",
          "Email or password not accepted. If you have never created a password, tap Create / reset password.",
        );
        return;
      }

      router.replace("/(tabs)");
    } finally {
      setVerifying(false);
    }
  }

  async function sendCode(purpose: CodePurpose) {
    const cleanEmail = validEmail();
    if (!cleanEmail) return;

    setSending(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
      });

      if (error) throw error;

      setEmail(cleanEmail);
      setToken("");
      setCodePurpose(purpose);
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
    const cleanEmail = normalizedEmail();
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

      if (codePurpose === "set-password") {
        setNewPassword("");
        setConfirmPassword("");
        setStep("new-password");
        return;
      }

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

  async function savePassword() {
    if (newPassword.length < 6) {
      Alert.alert("Password too short", "Use at least 6 characters.");
      return;
    }

    if (newPassword.toLowerCase() !== confirmPassword.toLowerCase()) {
      Alert.alert("Passwords do not match", "Please enter the same password twice.");
      return;
    }

    setSavingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword.toLowerCase(),
      });

      if (error) throw error;

      Alert.alert(
        "Password created",
        "You can now use this password on the app and website. Login codes will still work.",
        [{ text: "Continue", onPress: () => router.replace("/(tabs)") }],
      );
    } catch (cause) {
      Alert.alert(
        "Could not save password",
        cause instanceof Error ? cause.message : "Please try again.",
      );
    } finally {
      setSavingPassword(false);
    }
  }

  function chooseMode(nextMode: LoginMode) {
    setMode(nextMode);
    setStep("login");
    setToken("");
    setPassword("");
  }

  function goBack() {
    setStep("login");
    setToken("");
  }

  const isPasswordSetup =
    codePurpose === "set-password" && step !== "login";

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
          <BrandLogo size={192} style={styles.brandLogo} />

          <Text style={styles.eyebrow}>MEMBER APP</Text>

          <Text style={styles.title}>
            {step === "login"
              ? "Welcome back."
              : step === "new-password"
                ? "Create your password."
                : isPasswordSetup
                  ? "Verify your email."
                  : "Check your email."}
          </Text>

          <Text style={styles.copy}>
            {step === "login"
              ? "Sign in with your password or use a secure one-time code sent to your registered email."
              : step === "new-password"
                ? "Your email is verified. Choose a password you can use on both the app and website."
                : `Enter the 8-digit code sent to ${email}.`}
          </Text>

          <View style={styles.form}>
            {step === "login" && (
              <>
                <View style={styles.modeTabs}>
                  <Pressable
                    style={[
                      styles.modeTab,
                      mode === "password" && styles.modeTabActive,
                    ]}
                    onPress={() => chooseMode("password")}
                  >
                    <Text
                      style={[
                        styles.modeTabText,
                        mode === "password" && styles.modeTabTextActive,
                      ]}
                    >
                      PASSWORD
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.modeTab,
                      mode === "code" && styles.modeTabActive,
                    ]}
                    onPress={() => chooseMode("code")}
                  >
                    <Text
                      style={[
                        styles.modeTabText,
                        mode === "code" && styles.modeTabTextActive,
                      ]}
                    >
                      LOGIN CODE
                    </Text>
                  </Pressable>
                </View>

                <Text style={styles.label}>Email address</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  autoComplete="email"
                  placeholder="you@example.com"
                  placeholderTextColor={colors.muted}
                  editable={!sending && !verifying}
                />

                {mode === "password" ? (
                  <>
                    <Text style={styles.label}>Password</Text>
                    <View style={styles.passwordWrap}>
                      <TextInput
                        style={styles.passwordInput}
                        value={password}
                        onChangeText={setPassword}
                        autoCapitalize="none"
                        autoCorrect={false}
                        secureTextEntry={!showPassword}
                        textContentType="password"
                        autoComplete="current-password"
                        placeholder="Your password"
                        placeholderTextColor={colors.muted}
                        editable={!sending && !verifying}
                        onSubmitEditing={() => void signInWithPassword()}
                      />
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                        style={styles.eyeButton}
                        onPress={() => setShowPassword((value) => !value)}
                      >
                        <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={21} color="#7950C7" />
                      </Pressable>
                    </View>

                    <Pressable
                      style={({ pressed }) => [
                        styles.button,
                        pressed && styles.buttonPressed,
                        verifying && styles.buttonDisabled,
                      ]}
                      disabled={verifying || sending}
                      onPress={() => void signInWithPassword()}
                    >
                      <Text style={styles.buttonText}>
                        {verifying ? "Signing in…" : "Sign in with password"}
                      </Text>
                    </Pressable>

                    <Pressable
                      style={styles.secondaryAction}
                      disabled={sending || verifying}
                      onPress={() => void sendCode("set-password")}
                    >
                      <Text style={styles.secondaryActionText}>
                        {sending ? "Sending verification code…" : "Create / reset password"}
                      </Text>
                    </Pressable>

                    <Text style={styles.note}>
                      Never created a password before? We’ll verify your
                      registered email first, then let you create one.
                    </Text>
                  </>
                ) : (
                  <>
                    <Pressable
                      style={({ pressed }) => [
                        styles.button,
                        pressed && styles.buttonPressed,
                        sending && styles.buttonDisabled,
                      ]}
                      disabled={sending}
                      onPress={() => void sendCode("login")}
                    >
                      <Text style={styles.buttonText}>
                        {sending ? "Sending code…" : "Send login code"}
                      </Text>
                    </Pressable>

                    <Text style={styles.note}>
                      Login codes remain available even after you create a password.
                    </Text>
                  </>
                )}
              </>
            )}

            {step === "code" && (
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
                  placeholderTextColor={colors.muted}
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
                    {verifying
                      ? "Verifying…"
                      : codePurpose === "set-password"
                        ? "Verify & continue"
                        : "Sign in"}
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.secondaryAction}
                  disabled={verifying}
                  onPress={goBack}
                >
                  <Text style={styles.secondaryActionText}>Back</Text>
                </Pressable>
              </>
            )}

            {step === "new-password" && (
              <>
                <View style={styles.sentBox}>
                  <Text style={styles.sentLabel}>EMAIL VERIFIED</Text>
                  <Text style={styles.sentEmail}>{email}</Text>
                </View>

                <Text style={styles.label}>New password</Text>
                <View style={styles.passwordWrap}>
                  <TextInput
                    style={styles.passwordInput}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry={!showNewPassword}
                    textContentType="newPassword"
                    autoComplete="new-password"
                    placeholder="At least 6 characters"
                    placeholderTextColor={colors.muted}
                    editable={!savingPassword}
                  />
                  <Pressable style={styles.eyeButton} onPress={() => setShowNewPassword((value) => !value)}>
                    <Ionicons name={showNewPassword ? "eye-off-outline" : "eye-outline"} size={21} color="#7950C7" />
                  </Pressable>
                </View>

                <Text style={styles.label}>Confirm new password</Text>
                <View style={styles.passwordWrap}>
                  <TextInput
                    style={styles.passwordInput}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry={!showConfirmPassword}
                    textContentType="newPassword"
                    autoComplete="new-password"
                    placeholder="Repeat your password"
                    placeholderTextColor={colors.muted}
                    editable={!savingPassword}
                    onSubmitEditing={() => void savePassword()}
                  />
                  <Pressable style={styles.eyeButton} onPress={() => setShowConfirmPassword((value) => !value)}>
                    <Ionicons name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} size={21} color="#7950C7" />
                  </Pressable>
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.button,
                    pressed && styles.buttonPressed,
                    savingPassword && styles.buttonDisabled,
                  ]}
                  disabled={savingPassword}
                  onPress={() => void savePassword()}
                >
                  <Text style={styles.buttonText}>
                    {savingPassword ? "Saving password…" : "Save password & continue"}
                  </Text>
                </Pressable>

                <Text style={styles.note}>
                  This password works on both the Super Plus Fitness app and website.
                  Capital letters do not matter. You can still choose Login code whenever you prefer.
                </Text>
              </>
            )}
          </View>

          <Text style={styles.noteBottom}>
            Your app uses the same member account as superplusfitness.com.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: "#FFF7F2" },
  content: { flexGrow: 1, justifyContent: "center", padding: 24, paddingBottom: 40 },
  brandLogo: { marginBottom: 24 },
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
    backgroundColor: "#FFFFFF",
    borderColor: "#F2D9CD",
    borderRadius: 26,
    borderWidth: 1,
    gap: 8,
    marginTop: 28,
    padding: 18,
  },
  modeTabs: {
    backgroundColor: "#F3ECFF",
    borderRadius: 13,
    flexDirection: "row",
    marginBottom: 8,
    padding: 4,
  },
  modeTab: {
    alignItems: "center",
    borderRadius: 10,
    flex: 1,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 8,
  },
  modeTabActive: {
    backgroundColor: "#FFFFFF",
  },
  modeTabText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  modeTabTextActive: {
    color: colors.ink,
  },
  label: { color: colors.ink, fontSize: 12, fontWeight: "900", marginTop: 5 },
  input: {
    backgroundColor: colors.background,
    borderColor: colors.line,
    borderRadius: 13,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  passwordWrap: {
    alignItems: "center",
    backgroundColor: colors.background,
    borderColor: colors.line,
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 52,
  },
  passwordInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 14,
    paddingRight: 4,
  },
  eyeButton: {
    alignItems: "center",
    height: 50,
    justifyContent: "center",
    width: 50,
  },
  codeInput: {
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 5,
    textAlign: "center",
  },
  button: {
    alignItems: "center",
    backgroundColor: colors.green2,
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
    textAlign: "center",
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

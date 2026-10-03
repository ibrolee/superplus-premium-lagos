import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { BrandLogo } from "../lib/BrandLogo";
import {
  publicContact,
  publicFacilities,
  publicHours,
} from "../lib/public-site";
import { Card, colors, Screen, sharedStyles } from "../lib/ui";

async function openSite(path: string) {
  await WebBrowser.openBrowserAsync(`https://www.superplusfitness.com${path}`);
}

export default function WelcomeScreen() {
  return (
    <Screen>
      <View style={styles.brandRow}>
        <BrandLogo size={116} />
        <View style={styles.brandCopy}>
          <Text style={sharedStyles.kicker}>SUPER PLUS FITNESS</Text>
          <Text style={styles.tagline}>Train. Recover. Belong.</Text>
          <Text style={sharedStyles.subtitle}>
            Discover the gym, join a membership, read our latest articles or
            sign in to your member account.
          </Text>
        </View>
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>SHOMOLU · LAGOS</Text>
        <Text style={styles.heroTitle}>Your fitness journey can start here.</Text>
        <Text style={styles.heroText}>
          Join Super Plus directly from the app, then use the same account for
          membership, attendance, rewards, bookings and more.
        </Text>

        <Pressable style={styles.primaryButton} onPress={() => router.push("/join")}>
          <Text style={styles.primaryButtonText}>Join Super Plus Fitness</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </Pressable>

        <Pressable style={styles.loginButton} onPress={() => router.push("/login")}>
          <Ionicons name="person-circle-outline" size={19} color={colors.green} />
          <Text style={styles.loginButtonText}>Already a member? Sign in</Text>
        </Pressable>
      </View>

      <View style={styles.quickGrid}>
        <Pressable style={styles.quickCard} onPress={() => router.push("/blog")}>
          <Ionicons name="newspaper-outline" size={24} color={colors.green} />
          <Text style={styles.quickTitle}>Blog</Text>
          <Text style={styles.quickText}>Fitness, recovery and gym life.</Text>
        </Pressable>

        <Pressable style={styles.quickCard} onPress={() => void openSite("/membership")}>
          <Ionicons name="card-outline" size={24} color={colors.green} />
          <Text style={styles.quickTitle}>Memberships</Text>
          <Text style={styles.quickText}>Compare plans and benefits.</Text>
        </Pressable>

        <Pressable style={styles.quickCard} onPress={() => void openSite("/spa-recovery")}>
          <Ionicons name="sparkles-outline" size={24} color={colors.green} />
          <Text style={styles.quickTitle}>Spa & recovery</Text>
          <Text style={styles.quickText}>Massage and wellness services.</Text>
        </Pressable>

        <Pressable style={styles.quickCard} onPress={() => void openSite("/contact")}>
          <Ionicons name="chatbubble-ellipses-outline" size={24} color={colors.green} />
          <Text style={styles.quickTitle}>Contact</Text>
          <Text style={styles.quickText}>Questions? Reach the gym team.</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>What you’ll find here</Text>
      <View style={styles.facilityList}>
        {publicFacilities.map((item) => (
          <Card key={item.title} style={styles.facilityCard}>
            <View style={styles.facilityIcon}>
              <Ionicons name={item.icon} size={22} color={colors.green} />
            </View>
            <View style={styles.grow}>
              <Text style={styles.facilityTitle}>{item.title}</Text>
              <Text style={styles.facilityText}>{item.text}</Text>
            </View>
          </Card>
        ))}
      </View>

      <Card>
        <Text style={styles.sectionKicker}>VISIT SUPER PLUS</Text>
        <Text style={styles.address}>{publicContact.address}</Text>
        {publicHours.map((item) => (
          <View key={item.days} style={styles.hoursRow}>
            <Text style={styles.hoursDays}>{item.days}</Text>
            <Text style={styles.hoursTime}>{item.hours}</Text>
          </View>
        ))}

        <View style={styles.contactActions}>
          <Pressable
            style={styles.smallAction}
            onPress={() => void Linking.openURL(publicContact.directions)}
          >
            <Ionicons name="navigate-outline" size={18} color={colors.green} />
            <Text style={styles.smallActionText}>Directions</Text>
          </Pressable>
          <Pressable
            style={styles.smallAction}
            onPress={() => void Linking.openURL(publicContact.whatsapp)}
          >
            <Ionicons name="logo-whatsapp" size={18} color={colors.green} />
            <Text style={styles.smallActionText}>WhatsApp</Text>
          </Pressable>
          <Pressable
            style={styles.smallAction}
            onPress={() => void Linking.openURL(`tel:${publicContact.phone}`)}
          >
            <Ionicons name="call-outline" size={18} color={colors.green} />
            <Text style={styles.smallActionText}>Call</Text>
          </Pressable>
        </View>
      </Card>

      <View style={styles.legalRow}>
        <Pressable onPress={() => void openSite("/privacy-policy")}>
          <Text style={styles.legalLink}>Privacy Policy</Text>
        </Pressable>
        <Text style={styles.legalDot}>•</Text>
        <Pressable onPress={() => void openSite("/terms")}>
          <Text style={styles.legalLink}>Terms</Text>
        </Pressable>
        <Text style={styles.legalDot}>•</Text>
        <Pressable onPress={() => void openSite("/contact")}>
          <Text style={styles.legalLink}>Help & Support</Text>
        </Pressable>
      </View>

      <Text style={styles.footerNote}>
        Staff and admin operations remain on the secure Super Plus website.
        This app is designed for guests and members.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandRow: { alignItems: "center", flexDirection: "row", gap: 16, paddingTop: 4 },
  brandCopy: { flex: 1, gap: 6 },
  tagline: { color: colors.ink, fontSize: 25, fontWeight: "900", letterSpacing: -0.6, lineHeight: 29 },
  hero: { backgroundColor: colors.green, borderRadius: 26, padding: 22 },
  heroEyebrow: { color: "#BFD3C3", fontSize: 10, fontWeight: "900", letterSpacing: 1.4 },
  heroTitle: { color: "#FFFFFF", fontSize: 31, fontWeight: "900", letterSpacing: -0.9, lineHeight: 36, marginTop: 9 },
  heroText: { color: "#D7E4D9", fontSize: 14, lineHeight: 21, marginTop: 10 },
  primaryButton: { alignItems: "center", backgroundColor: "#EF2B2D", borderRadius: 14, flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 20, minHeight: 54, paddingHorizontal: 16 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  loginButton: { alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 14, flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 10, minHeight: 50, paddingHorizontal: 16 },
  loginButtonText: { color: colors.green, fontSize: 13, fontWeight: "900" },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickCard: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 18, borderWidth: 1, minHeight: 142, padding: 15, width: "48.5%" },
  quickTitle: { color: colors.ink, fontSize: 14, fontWeight: "900", marginTop: 12 },
  quickText: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 4 },
  sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: "900", marginTop: 2 },
  facilityList: { gap: 10 },
  facilityCard: { alignItems: "center", flexDirection: "row", gap: 13 },
  facilityIcon: { alignItems: "center", backgroundColor: colors.surfaceMuted, borderRadius: 13, height: 44, justifyContent: "center", width: 44 },
  grow: { flex: 1 },
  facilityTitle: { color: colors.ink, fontSize: 14, fontWeight: "900" },
  facilityText: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 3 },
  sectionKicker: { color: colors.green2, fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  address: { color: colors.ink, fontSize: 17, fontWeight: "900", lineHeight: 23, marginBottom: 12, marginTop: 5 },
  hoursRow: { alignItems: "center", borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingVertical: 10 },
  hoursDays: { color: colors.ink, fontSize: 11, fontWeight: "800" },
  hoursTime: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  contactActions: { flexDirection: "row", gap: 8, marginTop: 12 },
  smallAction: { alignItems: "center", backgroundColor: colors.surfaceMuted, borderRadius: 12, flex: 1, gap: 5, justifyContent: "center", minHeight: 58, paddingHorizontal: 8 },
  smallActionText: { color: colors.green, fontSize: 10, fontWeight: "900" },
  legalRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 2 },
  legalLink: { color: colors.green, fontSize: 10, fontWeight: "900" },
  legalDot: { color: colors.muted, fontSize: 10 },
  footerNote: { color: colors.muted, fontSize: 10, lineHeight: 16, paddingHorizontal: 8, textAlign: "center" },
});

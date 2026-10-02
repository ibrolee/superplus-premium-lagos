import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import { StyleSheet, Text, View } from "react-native";
import { useApp } from "../../lib/AppContext";
import {
  AccountLinkRequired,
  Card,
  colors,
  LoadingView,
  Screen,
  sharedStyles,
} from "../../lib/ui";

export default function QrScreen() {
  const { session, member, dataLoading, refreshing, refresh } = useApp();

  if (dataLoading) return <LoadingView label="Loading your QR card…" />;
  if (!member) {
    return (
      <Screen refreshing={refreshing} onRefresh={() => void refresh()}>
        <AccountLinkRequired email={session?.user.email} />
      </Screen>
    );
  }

  return (
    <Screen refreshing={refreshing} onRefresh={() => void refresh()}>
      <Text style={sharedStyles.kicker}>GYM ACCESS</Text>
      <Text style={sharedStyles.title}>Your QR card.</Text>
      <Text style={sharedStyles.subtitle}>
        Show this screen at reception when entering and leaving the gym.
      </Text>

      <Card style={styles.qrCard}>
        <View style={styles.logoMark}>
          <Ionicons name="fitness" size={24} color="#FFFFFF" />
        </View>
        <Text style={styles.gym}>SUPER PLUS FITNESS & SPA</Text>
        <Text style={styles.memberName}>{member.full_name}</Text>

        <View style={styles.qrWrap}>
          {member.qr_token ? (
            <QRCode
              value={member.qr_token}
              size={245}
              color={colors.ink}
              backgroundColor="#FFFFFF"
              ecl="H"
            />
          ) : (
            <Text style={styles.unavailable}>
              QR code unavailable. Please contact reception.
            </Text>
          )}
        </View>

        <View style={styles.cardNumberBox}>
          <Text style={styles.cardNumberLabel}>MEMBER CARD NUMBER</Text>
          <Text style={styles.cardNumber}>{member.member_card_number}</Text>
        </View>

        <Text style={styles.securityNote}>
          This is your permanent Super Plus member QR identity. Do not share it
          with another person.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  qrCard: { alignItems: "center", paddingVertical: 24 },
  logoMark: {
    alignItems: "center",
    backgroundColor: colors.green,
    borderRadius: 15,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  gym: { color: colors.green2, fontSize: 10, fontWeight: "900", letterSpacing: 1.4, marginTop: 15 },
  memberName: { color: colors.ink, fontSize: 23, fontWeight: "900", marginTop: 7, textAlign: "center" },
  qrWrap: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: 22,
    minHeight: 285,
    padding: 18,
    width: "100%",
  },
  unavailable: { color: colors.danger, fontSize: 13, fontWeight: "800", textAlign: "center" },
  cardNumberBox: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    marginTop: 18,
    padding: 13,
    width: "100%",
  },
  cardNumberLabel: { color: colors.muted, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  cardNumber: { color: colors.ink, fontSize: 18, fontWeight: "900", marginTop: 4 },
  securityNote: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 16, paddingHorizontal: 8, textAlign: "center" },
});

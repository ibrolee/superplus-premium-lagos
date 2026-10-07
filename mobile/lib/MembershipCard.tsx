import { Ionicons } from "@expo/vector-icons";
import { useId, useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop, Circle } from "react-native-svg";
import { BrandLogo } from "./BrandLogo";
import type { Member, Membership } from "./AppContext";
import { colors, dateLabel, daysUntil } from "./ui";

// Presentation only: callers retain the existing membership/status selection.
export function MembershipCard({ member, membership, phase, onChoosePlan }: {
  member: Member;
  membership: Membership | null;
  phase: string;
  onChoosePlan: () => void;
}) {
  const gradientId = useId().replace(/:/g, "");
  const [size, setSize] = useState({ width: 320, height: 280 });
  const { fontScale } = useWindowDimensions();
  const stackDetails = size.width < 290 || fontScale > 1.3;
  const active = phase.toLowerCase() === "active";
  const upcoming = phase.toLowerCase() === "upcoming";
  const status = active ? "ACTIVE" : upcoming ? "UPCOMING" : "EXPIRED";
  const statusColor = active ? "#B9F7CB" : upcoming ? "#FFE3A0" : "#FFD0C7";
  const remaining = daysUntil(membership?.end_date);

  if (!membership) return (
    <View style={styles.shadow}>
      <View style={styles.emptyCard}>
        <View style={styles.emptyTop}>
          <View style={styles.welcomeIcon}><Ionicons name="barbell" size={32} color="#E44824" /></View>
          <View style={styles.ready}><Ionicons name="checkmark-circle" size={16} color="#287A45" /><Text style={styles.readyText}>ACCOUNT READY</Text></View>
        </View>
        <Text style={styles.emptyTitle}>No active membership yet</Text>
        <Text style={styles.emptyText}>Your account is ready. Choose a membership plan anytime to activate member access, check in, earn SP Points and enjoy the full Super Plus experience.</Text>
        <View style={styles.perks}>
          {([['fitness', 'Train'], ['qr-code', 'Check in'], ['sparkles', 'SP Points']] as const).map(([icon, label], index) => (
            <View key={label} style={[styles.perk, { backgroundColor: ['#EEE6FF', '#E3F4FF', '#FFF0CB'][index] }]}>
              <Ionicons name={icon} size={15} color={['#6942B6', '#2466A8', '#8C5900'][index]} />
              <Text style={styles.perkText}>{label}</Text>
            </View>
          ))}
        </View>
        <Pressable accessibilityRole="button" onPress={onChoosePlan} style={({ pressed }) => [styles.cta, pressed && { opacity: 0.8 }]}>
          <Text style={styles.ctaText}>Choose a plan</Text><Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={styles.shadow}>
      <View style={styles.card} onLayout={({ nativeEvent }) => setSize({ width: nativeEvent.layout.width, height: nativeEvent.layout.height })}>
        <Svg width={size.width} height={size.height} viewBox={`0 0 ${size.width} ${size.height}`} style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Defs><LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%"><Stop offset="0" stopColor="#15151B" /><Stop offset="0.6" stopColor="#29232D" /><Stop offset="1" stopColor="#813421" /></LinearGradient></Defs>
          <Rect width={size.width} height={size.height} fill={`url(#${gradientId})`} />
          <Circle cx={size.width - 8} cy={12} r={82} fill="#F77843" opacity="0.12" />
          <Circle cx={size.width - 8} cy={12} r={58} fill="none" stroke="#FFBC94" strokeWidth="1" opacity="0.22" />
        </Svg>
        <View style={styles.top}>
          <View style={styles.identity}><View style={styles.logo}><BrandLogo variant="mark" size={30} /></View><Text style={styles.brand}>SUPER PLUS FITNESS</Text></View>
          <View style={[styles.status, { backgroundColor: statusColor }]}><Ionicons name={active ? "checkmark-circle" : upcoming ? "time" : "alert-circle"} size={14} color="#242024" /><Text style={styles.statusText}>{status}</Text></View>
        </View>
        <Text style={styles.eyebrow}>MEMBERSHIP CARD</Text>
        <Text style={styles.memberName}>{member.full_name}</Text>
        <Text style={styles.plan}>{membership.plan_name ?? "Membership"}</Text>
        {!!membership.family_group_id && <Text style={styles.family}>FAMILY PLAN</Text>}
        <View style={[styles.dates, stackDetails && styles.stacked]}>
          <View style={[styles.date, stackDetails && styles.stackedCell]}><Text style={styles.label}>START DATE</Text><Text style={styles.value}>{dateLabel(membership.start_date)}</Text></View>
          <View style={[styles.date, stackDetails && styles.stackedCell]}><Text style={styles.label}>EXPIRY DATE</Text><Text style={styles.value}>{dateLabel(membership.end_date)}</Text></View>
        </View>
        <View style={[styles.footer, stackDetails && styles.stacked]}>
          <View style={[styles.footerCell, stackDetails && styles.stackedCell]}><Text style={styles.label}>{upcoming ? "STARTS" : "TIME LEFT"}</Text><Text style={styles.value}>{upcoming ? dateLabel(membership.start_date) : remaining !== null && remaining >= 0 ? `${remaining} days` : "Expired"}</Text></View>
          {member.member_card_number != null && <View style={[styles.footerCell, stackDetails && styles.stackedCell]}><Text style={styles.label}>MEMBER CARD NO.</Text><Text style={styles.value}>#{member.member_card_number}</Text></View>}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: { width: "100%", maxWidth: 480, alignSelf: "center", borderRadius: 22, backgroundColor: colors.surface, shadowColor: '#482319', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 6 },
  card: { borderRadius: 22, overflow: 'hidden', padding: 18, backgroundColor: '#211A25', gap: 5 },
  stacked: { flexDirection: "column" },
  stackedCell: { flex: 0, alignSelf: "stretch" },
  logo: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#FFF5EF", alignItems: "center", justifyContent: "center" },
  top: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brand: { color: '#FFFFFF', fontSize: 10, lineHeight: 14, fontWeight: '900', letterSpacing: 1 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 999 },
  statusText: { color: '#242024', fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  eyebrow: { color: '#FFC9AF', fontSize: 9, fontWeight: '800', letterSpacing: 1.8 },
  memberName: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', letterSpacing: -0.6 },
  plan: { color: '#FFD5BE', fontSize: 14, fontWeight: '700' },
  family: { color: '#D9CCFF', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  dates: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  date: { flex: 1, minWidth: 0, backgroundColor: 'rgba(255,255,255,0.09)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 16, padding: 10, gap: 5 },
  label: { color: '#E9CFCD', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  value: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  footer: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.18)', paddingTop: 12, marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  footerCell: { flex: 1, minWidth: 0, gap: 5 },
  emptyCard: { backgroundColor: colors.surface, borderRadius: 22, borderWidth: 1, borderColor: colors.line, padding: 18, gap: 12 },
  emptyTop: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  welcomeIcon: { width: 64, height: 64, borderRadius: 22, backgroundColor: '#FFE1D0', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }] },
  ready: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, padding: 9, backgroundColor: '#E7F5E9' },
  readyText: { fontSize: 9, fontWeight: '900', color: '#23643B', letterSpacing: 0.6 },
  emptyTitle: { color: colors.ink, fontSize: 22, fontWeight: '900', letterSpacing: -0.6 },
  emptyText: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  perks: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12 },
  perkText: { color: '#38303F', fontSize: 11, fontWeight: '700' },
  cta: { backgroundColor: '#D63E1D', borderRadius: 16, minHeight: 54, padding: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  ctaText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
});

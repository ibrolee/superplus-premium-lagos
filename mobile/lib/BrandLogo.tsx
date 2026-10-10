import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

function BrandMark({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" accessibilityLabel="Super Plus Fitness">
      <Defs>
        <LinearGradient id="brandHeat" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#E71321" />
          <Stop offset="1" stopColor="#FF7A16" />
        </LinearGradient>
      </Defs>
      <Rect x="10" y="48" width="8" height="26" rx="4" fill="url(#brandHeat)" />
      <Rect x="22" y="42" width="10" height="38" rx="5" fill="url(#brandHeat)" />
      <Rect x="36" y="34" width="11" height="54" rx="5.5" fill="url(#brandHeat)" />
      <Path d="M49 50h26l-7 11H49z" fill="url(#brandHeat)" />
      <Path d="M49 65h18l-6 9H49z" fill="url(#brandHeat)" />
      <Circle cx="84" cy="25" r="10" fill="#111111" />
      <Path
        d="M52 28c12 11 24 8 34 13 10 5 13 13 9 24-3 8-10 16-18 23l-11-10c8-8 12-14 13-20 1-7-4-10-10-12-8-3-17-5-25-10z"
        fill="#111111"
      />
      <Path
        d="M73 55c-4 13-10 24-20 33-8 7-18 13-31 18 14-1 26-4 37-9 13-6 23-14 30-24z"
        fill="#111111"
      />
      <Path
        d="M73 68c8 4 16 9 22 16 6 7 8 14 5 24 8-7 12-16 10-25-2-10-10-18-25-24z"
        fill="#111111"
      />
    </Svg>
  );
}

/** Shared brand component used across the native member app. */
export function BrandLogo({
  size = 176,
  variant = "full",
  style,
}: {
  size?: number;
  variant?: "full" | "mark";
  style?: StyleProp<ViewStyle>;
}) {
  if (variant === "mark") {
    return (
      <View style={[styles.markWrap, { width: size, height: size, borderRadius: size * 0.2 }, style]}>
        <BrandMark size={size * 0.86} />
      </View>
    );
  }

  return (
    <View style={[styles.fullWrap, { width: size }, style]}>
      <BrandMark size={size * 0.72} />
      <Text style={[styles.superPlus, { fontSize: Math.max(15, size * 0.13) }]}>SUPER PLUS</Text>
      <Text style={[styles.fitness, { fontSize: Math.max(17, size * 0.15) }]}>FITNESS</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  markWrap: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    overflow: "hidden",
  },
  fullWrap: {
    alignItems: "center",
    alignSelf: "center",
  },
  superPlus: {
    color: "#111111",
    fontWeight: "900",
    letterSpacing: 1.1,
    lineHeight: undefined,
    marginTop: -6,
  },
  fitness: {
    color: "#E44824",
    fontWeight: "900",
    letterSpacing: 2.4,
    lineHeight: undefined,
    marginTop: -2,
  },
});

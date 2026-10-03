import { Image, StyleSheet, type ImageStyle, type StyleProp } from "react-native";

/** Local assets work offline and in both Expo Go and standalone builds. */
export function BrandLogo({
  size = 176,
  variant = "full",
  style,
}: {
  size?: number;
  variant?: "full" | "mark";
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      source={
        variant === "mark"
          ? require("../assets/icon.png")
          : require("../assets/splash-logo.png")
      }
      accessibilityLabel="Super Plus Fitness"
      accessibilityRole="image"
      resizeMode="contain"
      style={[styles.logo, { width: size, borderRadius: size / 2 }, style]}
    />
  );
}

const styles = StyleSheet.create({
  logo: {
    alignSelf: "center",
    aspectRatio: 1,
    // Override the bundled asset's intrinsic height so width controls both axes.
    height: undefined,
    maxWidth: "100%",
    backgroundColor: "#FFFFFF",
  },
});

const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

function resourceFile({
  background,
  surface,
  surfaceMuted,
  ink,
  muted,
  line,
}) {
  return `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <color name="spf_background">${background}</color>
  <color name="spf_surface">${surface}</color>
  <color name="spf_surface_muted">${surfaceMuted}</color>
  <color name="spf_ink">${ink}</color>
  <color name="spf_muted">${muted}</color>
  <color name="spf_line">${line}</color>
</resources>
`;
}

module.exports = function withSpfThemeColors(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const resRoot = path.join(
        config.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "res",
      );
      const valuesDir = path.join(resRoot, "values");
      const nightDir = path.join(resRoot, "values-night");

      fs.mkdirSync(valuesDir, { recursive: true });
      fs.mkdirSync(nightDir, { recursive: true });

      fs.writeFileSync(
        path.join(valuesDir, "spf_theme_colors.xml"),
        resourceFile({
          background: "#F8F6F3",
          surface: "#FFFFFF",
          surfaceMuted: "#FFF1EA",
          ink: "#161616",
          muted: "#6F6A66",
          line: "#EEE3DC",
        }),
      );

      fs.writeFileSync(
        path.join(nightDir, "spf_theme_colors.xml"),
        resourceFile({
          background: "#0F1011",
          surface: "#1A1C1E",
          surfaceMuted: "#2A211E",
          ink: "#F5F2EF",
          muted: "#B6B0AB",
          line: "#36393C",
        }),
      );

      return config;
    },
  ]);
};

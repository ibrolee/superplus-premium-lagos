// Exercise the Expo/Jimp decoder that previously failed on the native app icon.
// Resolve Expo's own image-utils so this check follows the installed SDK version.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");

const expoRequire = createRequire(require.resolve("expo/package.json"));
const { jimpAsync } = expoRequire("@expo/image-utils");
const root = path.resolve(__dirname, "..");
const { expo } = require("../app.json");
const splash = expo.plugins.find((plugin) => plugin[0] === "expo-splash-screen")[1];
const notifications = expo.plugins.find((plugin) => plugin[0] === "expo-notifications")[1];

async function check() {
  for (const [name, asset, size, colorType] of [
    ["App icon", expo.icon, 1024, 2],
    ["Adaptive foreground", expo.android.adaptiveIcon.foregroundImage, 1024, 6],
    ["Official logo / splash", splash.image, 1024, 2],
    ["Notification symbol", notifications.icon, 96, 6],
  ]) {
    const input = path.resolve(root, asset);
    const png = fs.readFileSync(input);
    assert.deepEqual(png.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), `${name}: PNG signature`);
    assert.equal(png.toString("ascii", 12, 16), "IHDR", `${name}: PNG header`);
    assert.equal(png.readUInt32BE(16), size, `${name}: width`);
    assert.equal(png.readUInt32BE(20), size, `${name}: height`);
    assert.equal(png[24], 8, `${name}: 8-bit color`);
    assert.equal(png[25], colorType, `${name}: RGB/RGBA, no indexed palette`);
    assert.equal(png[28], 0, `${name}: non-interlaced`);
    // Decodes every scanline, checks PNG integrity, then exercises native resizing.
    await jimpAsync({ input }, [{ operation: "resize", width: 48, height: 48, fit: "contain" }]);
    console.log(`${name}: valid ${size} × ${size} PNG; Expo/Jimp decode and resize passed`);
  }
}

check().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

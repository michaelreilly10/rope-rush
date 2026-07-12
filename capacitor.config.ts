import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.roperush.app",
  appName: "Rope Rush",
  webDir: "dist/capacitor",
  backgroundColor: "#0d0b1a",
  ios: {
    // Allow the game to draw edge-to-edge and handle the safe area in CSS/JS.
    contentInset: "always",
    // Prefer the dark status bar to match the game's theme.
    preferredContentMode: "mobile",
  },
  plugins: {
    StatusBar: {
      style: "Dark",
      backgroundColor: "#0d0b1a",
    },
  },
};

export default config;

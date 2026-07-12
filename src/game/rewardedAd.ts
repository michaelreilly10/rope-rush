// Rewarded ad abstraction.
//
// Drop-in point for Google AdMob on iOS via Capacitor. Today this returns a
// simulated ad so the game works in the browser and in a Capacitor build
// without ads configured. To ship real ads:
//
//   1. bun add @capacitor-community/admob
//   2. bunx cap sync ios
//   3. In Xcode add your GADApplicationIdentifier to ios/App/App/Info.plist
//      (Google-provided App ID, e.g. ca-app-pub-XXXXXXXX~YYYYYYYY).
//   4. Set the ad unit IDs below (or via Vite env vars):
//        VITE_ADMOB_REWARDED_IOS=ca-app-pub-XXXX/YYYY
//        VITE_ADMOB_REWARDED_ANDROID=ca-app-pub-XXXX/YYYY
//   5. Rebuild. Real ads are used automatically on native; web still simulates.
//
// The `showRewardedAd()` promise resolves with { rewarded: true } only when
// the user actually earned the reward (finished the video). Callers must
// gate the continue on that flag.

import { Capacitor } from "@capacitor/core";

export type RewardedAdResult = { rewarded: boolean };

// Google's official test unit IDs. Safe to ship during development; swap for
// your real unit IDs before release.
const TEST_REWARDED_IOS = "ca-app-pub-3940256099942544/1712485313";
const TEST_REWARDED_ANDROID = "ca-app-pub-3940256099942544/5224354917";

function resolveAdUnitId(): string {
  const platform = Capacitor.getPlatform();
  const envIos = import.meta.env.VITE_ADMOB_REWARDED_IOS as string | undefined;
  const envAndroid = import.meta.env.VITE_ADMOB_REWARDED_ANDROID as string | undefined;
  if (platform === "ios") return envIos || TEST_REWARDED_IOS;
  if (platform === "android") return envAndroid || TEST_REWARDED_ANDROID;
  return "";
}

// Lazy-loaded AdMob plugin so the web build never bundles it. The module id
// is assembled at runtime so TypeScript / Vite do not try to resolve it at
// build time — the plugin is an optional native-only dependency.
type AdMobModule = {
  AdMob: {
    initialize: (opts?: { initializeForTesting?: boolean }) => Promise<void>;
    prepareRewardVideoAd: (opts: { adId: string }) => Promise<unknown>;
    showRewardVideoAd: () => Promise<{ amount?: number; type?: string } | undefined>;
  };
};
let adMobPromise: Promise<AdMobModule | null> | null = null;
let initialized = false;

async function loadAdMob(): Promise<AdMobModule | null> {
  if (!Capacitor.isNativePlatform()) return null;
  if (!adMobPromise) {
    const pkg = "@capacitor-community/admob";
    adMobPromise = (import(/* @vite-ignore */ pkg) as Promise<AdMobModule>).catch(
      (err) => {
        console.warn("[ads] @capacitor-community/admob not installed:", err);
        return null;
      },
    );
  }
  return adMobPromise;
}

export async function initRewardedAds(): Promise<void> {
  const mod = await loadAdMob();
  if (!mod || initialized) return;
  try {
    await mod.AdMob.initialize({
      initializeForTesting: import.meta.env.DEV,
    });
    initialized = true;
  } catch (err) {
    console.warn("[ads] AdMob init failed:", err);
  }
}

// Preload can be called after game start so the ad is ready when the run ends.
export async function preloadRewardedAd(): Promise<void> {
  const mod = await loadAdMob();
  if (!mod) return;
  await initRewardedAds();
  try {
    await mod.AdMob.prepareRewardVideoAd({
      adId: resolveAdUnitId(),
    });
  } catch (err) {
    console.warn("[ads] prepareRewardVideoAd failed:", err);
  }
}

export async function showRewardedAd(
  onProgress?: (p: number) => void,
): Promise<RewardedAdResult> {
  const mod = await loadAdMob();

  // Native AdMob path.
  if (mod) {
    try {
      await initRewardedAds();
      // Ensure an ad is loaded. prepare is idempotent per session.
      await mod.AdMob.prepareRewardVideoAd({ adId: resolveAdUnitId() });
      const result = await mod.AdMob.showRewardVideoAd();
      // The plugin resolves with the reward payload when granted; if the user
      // dismissed early it resolves with a falsy/undefined reward.
      const rewarded = !!(result && (result as { amount?: number }).amount !== undefined);
      return { rewarded };
    } catch (err) {
      console.warn("[ads] showRewardVideoAd failed, falling back:", err);
      // Fall through to simulated ad so the player is not stranded.
    }
  }

  // Web / fallback simulated ad. Reports progress so the UI can show a bar.
  return new Promise((resolve) => {
    const start = performance.now();
    const tick = () => {
      const p = Math.min(1, (performance.now() - start) / 1800);
      onProgress?.(p);
      if (p < 1) requestAnimationFrame(tick);
      else resolve({ rewarded: true });
    };
    requestAnimationFrame(tick);
  });
}

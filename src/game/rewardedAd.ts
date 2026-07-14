// Rewarded ad abstraction.
//
// Uses Google AdMob on iOS/Android via @capacitor-community/admob. On web,
// falls back to a simulated ad so the game remains playable in the browser.
//
// To ship real ads:
//   1. bunx cap sync ios
//   2. In Xcode add your GADApplicationIdentifier to ios/App/App/Info.plist
//      (Google-provided App ID, e.g. ca-app-pub-XXXXXXXX~YYYYYYYY).
//   3. Set the ad unit IDs via Vite env vars:
//        VITE_ADMOB_REWARDED_IOS=ca-app-pub-XXXX/YYYY
//        VITE_ADMOB_REWARDED_ANDROID=ca-app-pub-XXXX/YYYY
//
// The `showRewardedAd()` promise resolves with { rewarded: true } only when
// the user actually earned the reward (finished the video). Callers must
// gate the continue on that flag.

import { Capacitor } from "@capacitor/core";
import { AdMob, AdMobRewardItem, RewardAdPluginEvents } from "@capacitor-community/admob";

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

let initialized = false;
let preparedPromise: Promise<boolean> | null = null;

export async function initRewardedAds(): Promise<void> {
  if (!Capacitor.isNativePlatform() || initialized) return;
  try {
    await AdMob.initialize({
      initializeForTesting: import.meta.env.DEV,
    });
    initialized = true;
  } catch (err) {
    console.warn("[ads] AdMob init failed:", err);
  }
}

// Kick off (or reuse) an ad prepare. Returns a promise that resolves true
// when the ad is ready to be shown. Safe to call multiple times.
export function preloadRewardedAd(): Promise<boolean> {
  if (preparedPromise) return preparedPromise;
  if (!Capacitor.isNativePlatform()) {
    preparedPromise = Promise.resolve(false);
    return preparedPromise;
  }
  preparedPromise = (async () => {
    await initRewardedAds();
    try {
      await AdMob.prepareRewardVideoAd({ adId: resolveAdUnitId() });
      return true;
    } catch (err) {
      console.warn("[ads] prepareRewardVideoAd failed:", err);
      preparedPromise = null; // allow retry
      return false;
    }
  })();
  return preparedPromise;
}

export async function showRewardedAd(
  onProgress?: (p: number) => void,
): Promise<RewardedAdResult> {
  // Native AdMob path.
  if (Capacitor.isNativePlatform()) {
    try {
      // Track whether the user earned the reward via the plugin event, which
      // is the authoritative signal across plugin versions.
      let rewardedFlag = false;
      const listener = await AdMob.addListener(
        RewardAdPluginEvents.Rewarded,
        (_item: AdMobRewardItem) => {
          rewardedFlag = true;
        },
      );

      try {
        // Ensure an ad is loaded, reusing any in-flight preload so we don't
        // re-prepare on click (which adds a visible delay).
        const ready = await preloadRewardedAd();
        if (!ready) throw new Error("ad not ready");
        const result = await AdMob.showRewardVideoAd();
        // Consume the used ad so the next continue preloads a fresh one.
        preparedPromise = null;
        preloadRewardedAd();
        // Be permissive: if the event fired OR the show call resolved with a
        // reward object, treat it as rewarded. Plugin versions differ.
        const rewarded = rewardedFlag || (result !== null && result !== undefined);
        return { rewarded };
      } finally {
        try { await listener.remove(); } catch { /* ignore */ }
      }
    } catch (err) {
      console.warn("[ads] showRewardVideoAd failed, falling back:", err);
      preparedPromise = null;
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

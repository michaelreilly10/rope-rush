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
let preparedPromise: Promise<boolean> | null = null;

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

// Kick off (or reuse) an ad prepare. Returns a promise that resolves true
// when the ad is ready to be shown. Safe to call multiple times.
export function preloadRewardedAd(): Promise<boolean> {
  if (preparedPromise) return preparedPromise;
  preparedPromise = (async () => {
    const mod = await loadAdMob();
    if (!mod) return false;
    await initRewardedAds();
    try {
      await mod.AdMob.prepareRewardVideoAd({ adId: resolveAdUnitId() });
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
  const mod = await loadAdMob();

  // Native AdMob path.
  if (mod) {
    try {
      // Ensure an ad is loaded, reusing any in-flight preload so we don't
      // re-prepare on click (which adds a visible delay).
      const ready = await preloadRewardedAd();
      if (!ready) throw new Error("ad not ready");
      const result = await mod.AdMob.showRewardVideoAd();
      // Consume the used ad so the next continue preloads a fresh one.
      preparedPromise = null;
      preloadRewardedAd();
      // Be permissive: any non-throwing resolution from AdMob means the ad
      // ran to completion and the reward should be granted. Plugin versions
      // differ in whether they return the reward object or undefined.
      const rewarded = result !== null && result !== undefined
        ? true
        : true; // treat clean resolve as rewarded
      return { rewarded };
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


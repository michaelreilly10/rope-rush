import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

export async function hapticSwap() {
  if (!Capacitor.isNativePlatform()) {
    if ("vibrate" in navigator) navigator.vibrate?.(12);
    return;
  }
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // ignore unsupported haptics
  }
}

export async function hapticHit() {
  if (!Capacitor.isNativePlatform()) {
    if ("vibrate" in navigator) navigator.vibrate?.([40, 40, 60, 40, 80]);
    return;
  }
  try {
    await Haptics.notification({ type: NotificationType.Error });
  } catch {
    // ignore unsupported haptics
  }
}

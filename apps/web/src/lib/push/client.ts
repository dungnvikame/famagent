"use client";

// Browser side of "sắp hết" reminders: service worker registration and the Web Push subscription (phase 4).
const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

/** Push works only with a VAPID key, a service worker and the Push API (iOS: after "Thêm vào MH chính"). */
export const pushConfigured = () => Boolean(PUBLIC_KEY);
export const pushSupported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
export const isStandalone = () => typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
export const isIos = () => typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);

const toKey = (base64: string) => { const padded = (base64 + "=".repeat((4 - base64.length % 4) % 4)).replace(/-/g, "+").replace(/_/g, "/"); return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0)); };
const registration = () => navigator.serviceWorker.register("/sw.js").then(() => navigator.serviceWorker.ready);

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  return (await registration()).pushManager.getSubscription();
}

/** Asks for permission, subscribes this device and stores it on the account. */
export async function enablePush(): Promise<void> {
  if (!pushSupported() || !pushConfigured()) throw new Error("Thiết bị này chưa hỗ trợ thông báo.");
  if (await Notification.requestPermission() !== "granted") throw new Error("Bạn chưa cho phép thông báo trong trình duyệt.");
  const reg = await registration();
  const subscription = await reg.pushManager.getSubscription() ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(PUBLIC_KEY) });
  const response = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: subscription.toJSON() }) });
  if (!response.ok) { const failure = await response.json().catch(() => ({})) as { error?: string }; throw new Error(failure.error || "Chưa lưu được đăng ký thông báo."); }
}

export async function disablePush(): Promise<void> {
  const subscription = await currentSubscription();
  if (!subscription) return;
  await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }) }).catch(() => {});
  await subscription.unsubscribe();
}

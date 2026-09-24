"use client";

import { useEffect, useState } from "react";
import { trackEvent } from "@/lib/experience/storage";
import { currentSubscription, disablePush, enablePush, isIos, isStandalone, pushConfigured, pushSupported } from "@/lib/push/client";

/** "Nhắc khi đồ sắp hết" on this device. Hidden when the server has no VAPID key; on iOS it first asks to install. */
export function PushToggle({ cloud }: { cloud: boolean }) {
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const available = cloud && pushConfigured();
  useEffect(() => { if (available && pushSupported()) currentSubscription().then((sub) => setOn(Boolean(sub))).catch(() => setOn(false)); else setOn(false); }, [available]);
  if (!available) return null;
  const needsInstall = isIos() && !isStandalone();

  async function toggle(value: boolean) {
    setBusy(true); setError("");
    try { if (value) await enablePush(); else await disablePush(); setOn(value); trackEvent(value ? "push_enabled" : "push_disabled"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa đổi được."); }
    finally { setBusy(false); }
  }

  return <div>
    <label className="account-toggle" htmlFor="push-toggle"><b>Nhắc khi đồ sắp hết</b><small>{needsInstall ? "Trên iPhone: bấm Chia sẻ → “Thêm vào MH chính”, mở FamAgent từ màn hình chính rồi bật ở đây." : !pushSupported() ? "Trình duyệt này chưa hỗ trợ thông báo." : "Mỗi sáng, FamAgent báo món còn ≤ 3 ngày trên thiết bị này. Tối đa 2 nhắc mỗi ngày."}</small>{error && <small className="form-error" role="alert">{error}</small>}</label>
    <input id="push-toggle" type="checkbox" checked={Boolean(on)} disabled={busy || on === null || needsInstall || !pushSupported()} onChange={(event) => void toggle(event.target.checked)} />
  </div>;
}

// Cloudflare Turnstile token for Supabase Auth CAPTCHA protection (plan D5/P8): anonymous sign-in and
// magic-link sign-in. Off unless NEXT_PUBLIC_TURNSTILE_SITE_KEY is set (and CAPTCHA is enabled in the
// Supabase project with the matching secret). The widget only shows itself if Cloudflare needs interaction.

interface Turnstile {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  remove(widgetId: string): void;
}
declare global { interface Window { turnstile?: Turnstile } }

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptLoading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  scriptLoading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT; script.async = true;
    script.onload = () => resolve();
    // Remove the failed tag so a retry does not stack scripts.
    script.onerror = () => { script.remove(); scriptLoading = null; reject(new Error("turnstile_load")); };
    document.head.appendChild(script);
  });
  return scriptLoading;
}

export const captchaEnabled = () => Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

/**
 * Resolves a one-time token, or undefined when CAPTCHA is not configured. Rejects on load failure,
 * challenge error/expiry, or when the whole flow (script load + possible interaction) exceeds the deadline.
 */
export async function getCaptchaToken(deadlineMs = 60_000): Promise<string | undefined> {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey || typeof window === "undefined") return undefined;
  const container = document.createElement("div");
  container.className = "captcha-slot";
  let widgetId = "";
  let timer = 0;
  let settled = false;
  try {
    return await new Promise<string>((resolve, reject) => {
      timer = window.setTimeout(() => reject(new Error("turnstile_timeout")), deadlineMs);
      loadScript().then(() => {
        if (settled) return; // deadline already passed: do not render an orphan widget
        document.body.appendChild(container);
        widgetId = window.turnstile!.render(container, {
          sitekey: siteKey, appearance: "interaction-only", language: "vi",
          callback: (token: string) => resolve(token),
          "error-callback": () => reject(new Error("turnstile_error")),
          "expired-callback": () => reject(new Error("turnstile_expired")),
          "timeout-callback": () => reject(new Error("turnstile_timeout")),
        });
      }, reject);
    });
  } finally {
    settled = true;
    window.clearTimeout(timer);
    if (widgetId) window.turnstile?.remove(widgetId);
    container.remove();
  }
}

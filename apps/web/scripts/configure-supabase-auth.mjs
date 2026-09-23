// Configure Supabase Auth for Family AI through the Management API (plan P8, docs/DEPLOYMENT.md §3.3).
//   node --env-file=.env.local scripts/configure-supabase-auth.mjs [--dry-run]
// Needs NEXT_PUBLIC_SUPABASE_URL (project ref), APP_URL and SUPABASE_ACCESS_TOKEN (personal token; revoke after).
// Sets: Site URL, redirect allow-list (/auth/confirm), email sign-in, anonymous sign-ins, and the three email
// templates pointing to /auth/confirm with the right type. SMTP and CAPTCHA are left to the dashboard.
const dryRun = process.argv.includes("--dry-run");
const { NEXT_PUBLIC_SUPABASE_URL: supabaseUrl, APP_URL: rawAppUrl, SUPABASE_ACCESS_TOKEN: token } = process.env;
const missing = Object.entries({ NEXT_PUBLIC_SUPABASE_URL: supabaseUrl, APP_URL: rawAppUrl, SUPABASE_ACCESS_TOKEN: token }).filter(([, value]) => !value).map(([key]) => key);
if (missing.length) { console.error(`Thiếu trong .env.local: ${missing.join(", ")}`); process.exit(1); }

const ref = new URL(supabaseUrl).hostname.split(".")[0];
const appUrl = rawAppUrl.replace(/\/+$/, "");
if (!/^https:\/\/[^/]+$/.test(appUrl)) { console.error("APP_URL phải có dạng https://<domain>, không có đường dẫn."); process.exit(1); }

const button = (label, type) => `<p style="font-family:Arial,sans-serif;font-size:15px;color:#244e34">${label}</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=${type}" style="display:inline-block;background:#2c6d45;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-family:Arial,sans-serif;font-weight:bold">Xác nhận</a></p>
<p style="font-family:Arial,sans-serif;font-size:12px;color:#6f8574">Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>`;

const config = {
  site_url: appUrl,
  uri_allow_list: `${appUrl}/auth/confirm,${appUrl}/**`,
  external_email_enabled: true,
  external_anonymous_users_enabled: true,
  mailer_subjects_magic_link: "Đăng nhập Family AI",
  mailer_templates_magic_link_content: button("Bấm nút dưới đây để đăng nhập Family AI.", "email"),
  mailer_subjects_confirmation: "Xác nhận email Family AI",
  mailer_templates_confirmation_content: button("Bấm nút dưới đây để xác nhận email và lưu hồ sơ gia đình.", "email"),
  mailer_subjects_email_change: "Xác nhận email để lưu hồ sơ Family AI",
  mailer_templates_email_change_content: button("Bấm nút dưới đây để liên kết email này với hồ sơ gia đình của bạn.", "email_change"),
};

console.log(`Project ${ref}: site_url=${appUrl}, anonymous=on, email=on, 3 mẫu email → /auth/confirm.`);
if (dryRun) process.exit(0);
const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(config),
});
if (!response.ok) {
  // Error bodies do not contain the token; print status and message only.
  const body = await response.json().catch(() => ({}));
  console.error(`Supabase API lỗi ${response.status}: ${body.message ?? "không rõ"}`);
  process.exit(1);
}
const saved = await response.json();
console.log(`Đã lưu. Kiểm tra: site_url=${saved.site_url}, anonymous=${saved.external_anonymous_users_enabled}, redirect=${saved.uri_allow_list}.`);

# Triển khai: GitHub → Vercel, Supabase, Gemini

Thứ tự khuyến nghị: GitHub → Vercel (chạy ở chế độ demo) → Supabase → Gemini → Turnstile → kiểm tra theo cổng phát hành trong [OPERATIONS.md](OPERATIONS.md). Mỗi bước sau đều có thể bật riêng; thiếu cấu hình thì ứng dụng tự lùi về demo/quy tắc.

Không bao giờ commit key thật. File `.env*` đã nằm trong `.gitignore` (trừ `.env.example`). Biến có tiền tố `NEXT_PUBLIC_` được gửi xuống trình duyệt nên chỉ đặt giá trị công khai ở đó.

## 1. GitHub

1. Tạo repository **private** rỗng trên github.com (không tạo README/.gitignore/license để tránh xung đột lịch sử).
2. Trong thư mục dự án:
   ```bash
   git remote add origin https://github.com/<tài-khoản>/<repo>.git
   git push -u origin main
   ```
   Windows sẽ mở cửa sổ đăng nhập GitHub (Git Credential Manager) ở lần push đầu.
3. CI (`.github/workflows/ci.yml`) tự chạy typecheck, lint, test (gồm eval 44 tình huống) và build cho mỗi push/PR. Nên bật **Settings → Branches → Branch protection** cho `main`: yêu cầu job `verify` xanh trước khi merge.

## 2. Vercel (CD)

1. vercel.com → **Add New… → Project → Import Git Repository** → chọn repo.
2. **Root Directory: `apps/web`** (bắt buộc — đây là monorepo pnpm). Framework tự nhận Next.js; để mặc định Install/Build command.
3. Chưa cần biến môi trường: bấm Deploy, ứng dụng chạy với 6 sản phẩm minh họa và agent theo quy tắc.
4. Từ đây: mỗi push lên `main` → deploy production; mỗi PR → preview URL riêng. Có thể bật **Settings → Git → Deployment Protection** hoặc chỉ merge khi CI xanh.
5. Biến môi trường thêm ở **Settings → Environment Variables** (chọn Production/Preview), sau đó **Redeploy** để có hiệu lực. Bảng đầy đủ ở mục 6.

## 3. Supabase

### 3.1 Tạo project
1. supabase.com → New project, region **Singapore (ap-southeast-1)** cho gần người dùng Việt Nam. Lưu mật khẩu DB vào trình quản lý mật khẩu.
2. **Project Settings → API**: lấy `Project URL` và **Publishable key** (hoặc anon key cho project cũ). Không dùng service_role/secret key trong ứng dụng.
3. **Project Settings → Database → Connection string → URI, chế độ Transaction pooler (cổng 6543)**: dùng làm `DATABASE_URL` trên Vercel (ghi click `/go`) và khi chạy script nhập catalog từ máy.

### 3.2 Chạy migration
Project mới chưa có dữ liệu nên chưa cần sao lưu; với project đã có dữ liệu luôn chạy lệnh `pg_dump` ghi ở đầu mỗi file trước.

**Cách nhanh:** sao chép `apps/web/.env.example` thành `apps/web/.env.local`, điền `DATABASE_URL`, rồi `pnpm --filter @family-ai/web db:migrate` — chạy các file chưa chạy theo thứ tự (mỗi file một transaction, ghi lịch sử ở schema `ops`), sau đó kiểm tra RLS. `db:migrate -- --status` để xem file đang chờ.

**Cách thủ công:** mở **SQL Editor**, chạy lần lượt từng file trong `supabase/migrations/` theo đúng thứ tự tên file (dán nội dung → Run), không bỏ file nào:

```
202609230001_catalog.sql
202609230002_experience.sql
202609230003_account_api.sql
202609240001_family_profile_v2.sql
202609240002_request_quota.sql
202609240003_agent_trace.sql
202609240004_catalog_provenance.sql
202609240005_offer_snapshots_analytics.sql
```

Kiểm tra: **Table Editor** có các bảng `family_profiles`, `children`, `conversations`, `offer_snapshots`…; **Authentication → Policies** thấy RLS bật trên các bảng người dùng. Luôn chạy migration **trước** khi deploy code cần nó.

### 3.3 Cấu hình Auth
Có thể làm tự động các mục 1–3 bằng `pnpm --filter @family-ai/web setup:auth` (cần `SUPABASE_ACCESS_TOKEN` và `APP_URL` trong `.env.local`; xóa token sau khi xong). Hoặc làm tay:

1. **Authentication → URL Configuration**: Site URL = domain production (vd `https://<app>.vercel.app`); Redirect URLs thêm `https://<app>.vercel.app/auth/confirm` và, nếu dùng preview, `https://*-<team>.vercel.app/auth/confirm`.
2. **Authentication → Sign In / Providers**: bật Email; bật **Allow anonymous sign-ins** (khách dùng thử không cần đăng ký).
3. **Authentication → Emails → Templates**, sửa liên kết trong nút:
   - *Magic Link* và *Confirm signup*: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`
   - *Change email address* (khách ẩn danh liên kết email): `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change`
4. **SMTP**: email mặc định của Supabase bị giới hạn vài email/giờ, chỉ đủ tự thử. Trước khi mời người dùng, cấu hình **Authentication → Emails → SMTP Settings** (Resend, Brevo, SES…).

### 3.4 Nối với Vercel
Thêm `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `DATABASE_URL` → Redeploy. Từ lúc này catalog đọc từ Supabase (rỗng cho tới khi nhập dữ liệu thật — ứng dụng không tự quay về demo), và người dùng có tài khoản ẩn danh/email.

### 3.5 Nhập catalog
Trên máy, tạo `apps/web/.env.local` chứa `DATABASE_URL=...` (không commit), rồi:
```bash
pnpm import-products -- data/products.csv --dry-run
pnpm import-products -- data/products.csv
```
Chi tiết cột và quy tắc: [DATA.md](DATA.md).

Để thử luồng trên staging trước khi có dữ liệu thật: `data/staging-test-products.csv` (7 sản phẩm hư cấu, tên có tiền tố “[THỬ NGHIỆM]”, link tới example.com). Gỡ khỏi hiển thị bằng SQL `update public.products set published = false where id like 'test-%';` — không dùng cho môi trường công khai.

## 4. Gemini AI

1. aistudio.google.com → **Get API key** → Create API key (gắn với một Google Cloud project).
2. Trên Vercel thêm:
   | Biến | Giá trị |
   |---|---|
   | `AI_ENABLED` | `true` |
   | `LLM_PROVIDERS` | `gemini` (hoặc `gemini,groq` nếu có thêm key Groq làm dự phòng) |
   | `GEMINI_API_KEY` | key vừa tạo |
   | `GEMINI_MODEL` | tên model Flash đang có trong AI Studio, vd `gemini-2.5-flash` |
3. Redeploy. AI chỉ được gọi khi người dùng tích ô đồng ý gửi nội dung tới nhà cung cấp AI; lỗi, hết hạn mức hoặc timeout → tự dùng quy tắc. Mỗi tài khoản có hạn mức giờ: chat 60, onboarding 20, so sánh 30.
4. Kiểm tra: đăng nhập, bật đồng ý AI, hỏi “Tìm bỉm ban đêm cho bé 10kg dưới 400k” → trạng thái trên đầu hiện “AI đang hỗ trợ”. Nếu vẫn “Agent đang sẵn sàng”, xem **Vercel → Logs** (key sai, model sai tên, hết quota).

**Lưu ý dữ liệu:** gói miễn phí của Gemini API có thể dùng nội dung gửi lên để cải thiện sản phẩm của Google. Tên bé đã được thay bằng mã trước khi gửi, nhưng trước khi mở công khai cần chuyển sang gói trả phí (bật billing) hoặc provider có điều khoản không dùng dữ liệu để huấn luyện — mục “AI provider” trong cổng phát hành.

## 5. Cloudflare Turnstile (chống bot cho đăng nhập)

1. dash.cloudflare.com → **Turnstile → Add widget**, thêm domain Vercel; lấy **Site key** và **Secret key**.
2. Supabase **Authentication → Attack Protection → CAPTCHA**: bật, chọn Turnstile, dán **Secret key**.
3. Vercel: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = Site key → Redeploy. Làm bước 2 và 3 cùng lúc: bật CAPTCHA ở Supabase mà thiếu site key thì mọi đăng nhập bị từ chối.

## 6. Bảng biến môi trường (Vercel)

| Biến | Bắt buộc | Công khai | Ghi chú |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Khi dùng Supabase | Có | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Khi dùng Supabase | Có | Publishable/anon key |
| `DATABASE_URL` | Khi có offer thật | **Không** | Transaction pooler URI; chỉ server |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Trước khi mở rộng thử nghiệm | Có | Secret key đặt ở Supabase |
| `AI_ENABLED` | Không | Không | `true` để bật AI |
| `LLM_PROVIDERS` | Không | Không | vd `gemini,groq` |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Khi dùng Gemini | **Không** | |
| `GROQ_API_KEY`, `GROQ_MODEL` | Tùy chọn | **Không** | Dự phòng khi Gemini lỗi/hết quota |

## 7. Việc định kỳ

Chạy từ máy có `DATABASE_URL` (hoặc GitHub Actions có secret, khi cần tự động hóa): `pnpm verify-offers` mỗi ngày, `pnpm cleanup-anonymous` mỗi tuần — xem [OPERATIONS.md](OPERATIONS.md).

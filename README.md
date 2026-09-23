# Family AI

AI Shopping Agent cho đồ dùng em bé và gia đình. Bản hiện tại cho phép thử trọn luồng **onboarding → tư vấn bỉm → xem gợi ý → so sánh → bước mở nơi bán** với dữ liệu minh họa. Kế hoạch phát hành và giới hạn được ghi trong [docs/MVP_PLAN.md](docs/MVP_PLAN.md).

## Chạy trên máy

Yêu cầu Node.js 22.18+ và pnpm 11:

```bash
pnpm install
pnpm dev
```

Mở URL do Next.js in ra, thường là `http://localhost:3000`. Nếu cổng 3000 đang dùng, Next.js chọn cổng tiếp theo. Trang chủ là onboarding; sau khi trả lời, ứng dụng mở `/shop`.

Để thử tình huống trong spec, chọn câu mẫu **“Bé Gold, 10kg, 14 tháng, size L”**, tiếp theo **“Ưu tiên chống tràn, dưới 400k”**, rồi hỏi **“Tôi cần mua bỉm ban đêm cho Gold, dưới 400k”**. Sản phẩm và giá trong bản này là **dữ liệu hư cấu để thử luồng**.

## Cấu hình dữ liệu và AI

1. Chạy các migration trong `supabase/migrations` trên Supabase dev.
2. Sao chép `apps/web/.env.example` thành `apps/web/.env.local`. Điền URL và publishable key của Supabase. Khi có cả hai, ứng dụng yêu cầu đăng nhập qua email và lưu hồ sơ, lịch sử, sản phẩm đã lưu trên server.
3. Điền `DATABASE_URL` vào môi trường server khi nhập CSV hoặc bật redirect merchant thật. Không dùng tiền tố `NEXT_PUBLIC_` cho thông tin bí mật.
4. Nhập dữ liệu đã xác minh theo `data/products.template.csv` bằng `pnpm import-products -- data/products.csv`. URL offer phải thuộc `merchant_domain` đã duyệt.
5. Để bật agent AI, đặt `AI_ENABLED=true` và cấu hình ít nhất một provider phía server. `LLM_PROVIDERS` là thứ tự dự phòng (mặc định trong `.env.example`: `gemini,groq` — đều có free tier để thử nghiệm); mỗi provider cần `<TÊN>_API_KEY` và `<TÊN>_MODEL`. Mọi provider dùng API OpenAI-compatible nên đổi provider chỉ cần sửa env. Người dùng phải bật đồng ý trong onboarding. Khi thiếu cấu hình, chưa đồng ý, lỗi hoặc hết quota, ứng dụng dùng quy tắc. Free tier có thể dùng dữ liệu gửi lên để cải thiện dịch vụ — chỉ dùng cho thử nghiệm kín, chuyển gói phù hợp trước khi phát hành công khai.

Trong Supabase Auth, đặt Site URL thành domain ứng dụng, thêm `https://<domain>/auth/confirm` vào Redirect URLs và sửa mẫu email Magic Link/Confirm signup để nút đăng nhập trỏ tới `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`. Sau đó cấu hình SMTP trước khi mời người dùng thật. Cách trao đổi token hash theo [hướng dẫn Supabase](https://supabase.com/docs/guides/auth/auth-email-passwordless). Khi chưa cấu hình Supabase, catalog dùng 6 sản phẩm demo. `/go/demo-offer-*` chỉ mở trang giải thích, không chuyển tới merchant. Khi kết nối DB và offer thật, `/go/:offerId` kiểm tra HTTPS/domain, ghi click rồi redirect.

## Kiểm tra

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Khi ứng dụng đang chạy, kiểm tra 50 tình huống cân nặng, ngân sách và dùng ban đêm:

```bash
EVAL_BASE_URL=http://localhost:3000 pnpm eval
```

Trong PowerShell: `$env:EVAL_BASE_URL='http://localhost:3000'; pnpm eval`.

## Cấu trúc

- `apps/web/src/app`: trang onboarding, shop, catalog, so sánh, gia đình, đã lưu và API.
- `apps/web/src/lib/ai`: Onboarding Agent, Intent Agent, ghép bối cảnh, giải thích và lớp LLM đa provider (`llm/`).
- `apps/web/src/lib/catalog`: catalog, dữ liệu demo, lọc, giá mỗi miếng.
- `apps/web/src/lib/ranking`: điểm gợi ý deterministic; không dùng hoa hồng.
- `supabase/migrations`: catalog và schema cho hồ sơ, hội thoại, gợi ý, click, analytics.
- `docs`: tài liệu sản phẩm, kế hoạch MVP, dữ liệu, vận hành và quyết định kỹ thuật.

## Giới hạn của bản chạy thử

Không có Supabase, hồ sơ, lịch sử và sản phẩm đã lưu ở trình duyệt để thử luồng. Có Supabase, các dữ liệu này đi qua API có xác thực và RLS; chưa thể kiểm thử tích hợp với Supabase nếu chưa có project và dữ liệu thực. Vẫn thiếu merchant feed, ảnh và giá thật, SMTP, kiểm thử tải và kiểm thử quyền trên staging. Không dùng dữ liệu demo để quyết định mua thật.

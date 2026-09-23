# Quyết định kỹ thuật ban đầu

- **Next.js App Router + TypeScript:** phù hợp web responsive và route trang/API trong một ứng dụng. Next.js yêu cầu tối thiểu Node.js 20.9 theo [hướng dẫn chính thức](https://nextjs.org/docs/app/getting-started/installation); project dùng Node.js 22.18+ để chạy bài kiểm tra TypeScript bằng Node test runner.
- **PostgreSQL qua Supabase:** migration nằm trong Git; dùng RLS cho dữ liệu catalog public và tách quyền ghi. Cách quản lý migration và seed dựa trên [Supabase CLI workflow](https://supabase.com/docs/guides/local-development/cli-workflows).
- **Server đọc catalog, browser không giữ khóa đặc quyền:** public anon key chỉ dùng đọc những cột được cấp quyền. Import dùng `DATABASE_URL` phía server.
- **Tách dữ liệu và logic:** `src/lib/catalog` xử lý ánh xạ, lọc, giá; `src/lib/ai` xử lý onboarding, hiểu yêu cầu, ghép bối cảnh và lời giải thích; `src/lib/ranking` tính điểm bằng code.
- **Agent dùng Structured Outputs khi có cấu hình:** API key và model chỉ ở server; schema đầu ra dựa trên [hướng dẫn OpenAI Responses API](https://developers.openai.com/api/docs/guides/structured-outputs). Khi chưa có khóa hoặc người dùng chưa đồng ý, ứng dụng dùng parser theo quy tắc và hiển thị chế độ thử nghiệm.
- **Auth có hai chế độ:** khi chưa cấu hình Supabase, trình duyệt lưu dữ liệu thử. Khi đã cấu hình, `@supabase/ssr` dùng cookie, middleware xác thực người dùng và API lưu hồ sơ/hội thoại/đã lưu qua RLS. Magic link dùng PKCE callback. Quy trình dựa trên [hướng dẫn Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs).
- **Giới hạn gọi agent:** khi có tài khoản, API chat cho tối đa 60 yêu cầu trong một giờ theo user ID và ghi vào PostgreSQL. Onboarding trước đăng nhập dùng parser quy tắc để tránh phát sinh phí AI không kiểm soát.
- **Chưa dùng vector database:** với 50–100 variant bỉm, lọc điều kiện rõ ràng đủ cho vòng đầu. Khi dữ liệu tăng, chuyển bộ lọc xuống SQL/truy vấn tìm kiếm mà giữ hợp đồng API.

Giới hạn hiện tại: catalog đọc toàn bộ sản phẩm bỉm đã publish rồi lọc trong server. Phù hợp dataset MVP; cần phân trang và lọc tại PostgreSQL khi tăng số lượng. Chưa có dữ liệu merchant thật hoặc môi trường Supabase để kiểm thử auth/RLS tích hợp. Redirect thật chỉ chạy khi có `DATABASE_URL` và offer thuộc domain đã duyệt.

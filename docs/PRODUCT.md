# Family AI — tài liệu sản phẩm gốc

**Phiên bản:** 0.2 · **Ngày cập nhật:** 23/09/2026 · **Trạng thái:** Đang xây MVP

Tài liệu này là nguồn chuẩn cho các quyết định sản phẩm từ lúc bắt đầu phát triển. [Spec đầu vào MVP](SOURCE_SPEC.md) và [spec v1 Household Purchasing Agent](SPEC_V1_PURCHASING_AGENT.md) được giữ nguyên để đối chiếu. Khi thay đổi phạm vi, hành vi hoặc cách đo, cập nhật tài liệu này và ghi vào mục Nhật ký quyết định.

## 1. Mục tiêu

Family AI giúp bố mẹ có con 0–3 tuổi tìm, so sánh và chọn sản phẩm phù hợp nhanh hơn việc tự tìm trên marketplace. MVP cần kiểm chứng: người dùng có chọn nhanh hơn và tự tin hơn hay không.

Trong hành trình hoàn chỉnh, agent hỏi và ghi nhớ bối cảnh gia đình → người dùng mô tả nhu cầu → hệ thống hiểu yêu cầu → lọc catalog → đề xuất 3–5 sản phẩm → giải thích điểm phù hợp và đánh đổi → người dùng so sánh và mở nơi bán. Mua hàng diễn ra tại merchant.

## 2. Người dùng và tình huống chính

**Người dùng:** Bố/mẹ 25–38 tuổi, mua đồ online thường xuyên, có con 0–3 tuổi.

**Tình huống đầu tiên:** Người dùng cần bỉm ban đêm cho bé 10 kg, giá dưới 400.000đ. Họ muốn loại đúng cân nặng, xem giá mỗi miếng, biết điểm khác nhau giữa các lựa chọn rồi mở nơi bán.

**Điểm vào đầu tiên:** Agent onboarding hỏi tên gọi, cân nặng/size của bé và ưu tiên mua sắm qua hội thoại ngắn. Người dùng có thể bỏ qua thông tin chưa biết và sửa sau. Agent tóm tắt thông tin trước khi mở màn tư vấn.

## 3. Phạm vi MVP

- Tư vấn mua sắm qua chat, hiểu yêu cầu tiếng Việt và hỏi tối đa 1–3 câu khi thiếu thông tin quan trọng.
- Catalog nội bộ, lọc bắt buộc theo cân nặng, size, ngân sách, tình trạng còn hàng và các thuộc tính từng danh mục.
- Xếp hạng bằng code theo độ phù hợp, chất lượng, giá trị, độ tin cậy nơi bán, tình trạng hàng, giao hàng và sở thích. Hoa hồng không tham gia điểm.
- Hiển thị 3–5 gợi ý, lý do và điểm đánh đổi; xem chi tiết, so sánh và mở liên kết merchant có ghi nhận lượt bấm.
- Lưu lịch sử hội thoại và thông tin gia đình tối thiểu để dùng lại trong tư vấn.
- Onboarding trước phiên tư vấn, cho phép sửa/xóa bối cảnh và hỏi lại khi thông tin không đủ để tránh chọn sai size.

**Tám danh mục dự kiến:** bỉm, khăn ướt, nước giặt đồ em bé, nước rửa bình, nước giặt gia đình, nước rửa bát, khăn giấy và túi rác. Bắt đầu bằng bỉm; chỉ mở danh mục tiếp theo sau khi luồng bỉm đạt tiêu chí nghiệm thu.

**Ngoài MVP:** giỏ hàng, thanh toán, checkout, quản lý đơn, giao vận, dropshipping, tự động mua lại, app di động và dashboard merchant. Không đưa thuốc, sữa công thức, thực phẩm chức năng, thiết bị y tế hoặc sản phẩm có claim điều trị vào catalog MVP.

## 4. Tính năng và kết quả cần đạt

### Thu thập bối cảnh gia đình trước khi tư vấn

**Cách dùng:** Người dùng vào trang chủ, trả lời agent về bé và ưu tiên mua sắm bằng câu tự nhiên hoặc lựa chọn nhanh. Agent hỏi hai nhóm thông tin: bé đang dùng bỉm và điều quan trọng khi mua. Người dùng xem lại rồi bắt đầu tư vấn.

**Kết quả:** Màn `/shop` nhận được cân nặng, size, ngân sách và ưu tiên đã cung cấp; người dùng không cần lặp lại trong câu hỏi đầu tiên.

**Nghiệm thu:** Không tự đoán thông tin trẻ; cho phép bỏ qua, sửa và xóa. Chỉ gửi nội dung người dùng nhập tới nhà cung cấp AI nếu họ bật lựa chọn đồng ý. Bản demo lưu trên trình duyệt; lưu theo tài khoản cần hoàn tất trước phát hành công khai.

### Tìm sản phẩm bỉm phù hợp

**Cách dùng:** Người dùng mở catalog và lọc theo cân nặng của bé, size, giá tối đa và thương hiệu. Hệ thống chỉ hiển thị sản phẩm còn hàng, có variant và offer thỏa tất cả điều kiện.

**Kết quả:** Người dùng thấy giá gói, số miếng và giá mỗi miếng từ cùng một variant/offer.

**Nghiệm thu:** Không hiển thị sản phẩm ngoài khoảng cân nặng hoặc vượt giá trần; trường hợp không có kết quả có hướng dẫn bỏ bớt bộ lọc.

### Nhận gợi ý qua chat

**Cách dùng:** Người dùng nhập nhu cầu bằng tiếng Việt ở trang chủ hoặc `/shop`. Hệ thống rút thông tin có cấu trúc, ghép với thông tin gia đình đã lưu và hỏi lại khi thiếu điều kiện bắt buộc.

**Kết quả:** Người dùng nhận tối đa 3–5 lựa chọn từ catalog nội bộ, kèm lý do phù hợp và điểm đánh đổi ngắn gọn.

**Nghiệm thu:** Mọi mức giá, thông số, nhận xét và claim trong câu trả lời đều có nguồn từ catalog; không đề xuất sản phẩm sai điều kiện bắt buộc.

Khi thiếu cả cân nặng và size bỉm, agent hỏi lại trước khi gợi ý. Nếu người dùng hỏi danh mục chưa có dữ liệu đã kiểm tra, agent nói rõ giới hạn và không tạo sản phẩm giả.

### So sánh sản phẩm

**Cách dùng:** Người dùng chọn 2–3 sản phẩm từ gợi ý để xem tại `/compare`.

**Kết quả:** Bảng hiển thị các thuộc tính có cùng cách tính, gồm size, khoảng cân nặng, giá, giá mỗi miếng và thông tin nơi bán. Phần tóm tắt nêu khác biệt gắn với nhu cầu hiện tại.

**Nghiệm thu:** Giá mỗi miếng dùng đúng variant và offer; chỗ thiếu dữ liệu hiển thị “Chưa có thông tin”, không suy đoán.

### Lưu thông tin gia đình cần thiết

**Cách dùng:** Người dùng cung cấp tên gọi của bé, ngày sinh hoặc cân nặng, size bỉm và ưu tiên mua sắm tại `/family`.

**Kết quả:** Câu “Mua bỉm cho Gold” có thể dùng cân nặng của Gold khi người dùng đã lưu thông tin này.

**Nghiệm thu:** Người dùng sửa/xóa được thông tin; không yêu cầu dữ liệu thanh toán hoặc thông tin sức khỏe không phục vụ việc chọn hàng.

### Mở nơi bán và ghi nhận lượt bấm

**Cách dùng:** Người dùng chọn offer tại trang chi tiết hoặc gợi ý. `/go/:offerId` ghi nhận lượt bấm rồi chuyển đến URL đã kiểm tra.

**Kết quả:** Người dùng đến đúng nơi bán; hệ thống đo được recommendation → outbound click.

**Nghiệm thu:** URL affiliate không xuất hiện trực tiếp trong API public; có thông báo hoa hồng rõ ràng và không ảnh hưởng thứ tự đề xuất.

## 5. Nguyên tắc dữ liệu và gợi ý

Pipeline dự kiến: hiểu yêu cầu → ghép bối cảnh → lập truy vấn → lấy sản phẩm → lọc bắt buộc → xếp hạng bằng code → tạo lời giải thích từ dữ liệu đã lấy. LLM dùng để hiểu và diễn đạt; code quyết định lọc, tính toán, xếp hạng và xác thực.

Điểm xếp hạng ban đầu: phù hợp 35%, chất lượng 20%, giá trị 20%, nơi bán 10%, còn hàng 5%, giao hàng 5%, sở thích 5%. Các trọng số là giả thuyết để thử nghiệm, không phải cam kết về chất lượng. “Family Match” là điểm tương đối theo nhu cầu hiện tại; giao diện không gọi là “sản phẩm tốt nhất”.

Mỗi lượt gợi ý cần lưu yêu cầu đã hiểu, tập ứng viên, sản phẩm bị loại, điểm thành phần, kết quả và phiên bản quy tắc. Đánh giá offline tối thiểu 50 tình huống trước khi phát hành chat công khai.

## 6. Dữ liệu sản phẩm

Một sản phẩm có thể có nhiều variant; mỗi variant có thể có nhiều offer. Thuộc tính riêng của bỉm gồm khoảng cân nặng, kiểu bỉm và các điểm chất lượng nếu có nguồn xác thực. Giá mỗi miếng = giá offer ÷ số miếng của variant đó.

Chỉ publish khi có tên, thương hiệu, danh mục, ảnh, variant, giá, merchant, URL, tình trạng hàng và thuộc tính bắt buộc. Không dùng dữ liệu demo cho đề xuất thật. Chi tiết quy trình tại [DATA.md](DATA.md).

## 7. Đo hiệu quả

**Câu hỏi nghiên cứu:** Người dùng hoàn thành lựa chọn nhanh hơn và tự tin hơn so với tự tìm trên marketplace? Đo bằng thử nghiệm có cùng tình huống mua, ghi thời gian tới quyết định và hỏi mức tự tin 1–5 sau khi chọn. So sánh nhóm Family AI với nhóm dùng marketplace; ghi lý do không chọn sản phẩm.

**North Star proxy:** Số phiên có gợi ý và ít nhất một lượt mở merchant. Đây là tín hiệu quan tâm, chưa chứng minh đã mua hàng.

**Chỉ số phụ:** bắt đầu chat, tạo gợi ý, xem chi tiết, dùng so sánh, mở offer, quay lại sử dụng, độ trễ tạo gợi ý và tỷ lệ điều kiện bắt buộc được tuân thủ.

**Onboarding:** tỷ lệ hoàn tất, thời gian hoàn tất, số câu phải hỏi lại, tỷ lệ người dùng sửa hồ sơ và tỷ lệ đi tiếp tới lượt hỏi mua đầu tiên.

## 8. Nhật ký quyết định

| Ngày | Quyết định | Lý do / tác động |
|---|---|---|
| 23/09/2026 | Chỉ xây catalog bỉm trong vòng đầu | Tuân theo mục 70–73 của spec; kiểm tra dữ liệu và bộ lọc trước AI. |
| 23/09/2026 | Dữ liệu demo tách khỏi Supabase | Cho phép chạy UI ngay mà không tạo sản phẩm hoặc offer giả trong catalog thật. |
| 23/09/2026 | Catalog vòng đầu chưa có nút mua | Chờ luồng redirect và URL merchant được xác minh; bản demo hiện có bước mua thử, không mở liên kết giả. |
| 24/09/2026 | Tên hiển thị: FamAgent | Thay “Family AI” trên toàn giao diện; repo và tài liệu nội bộ giữ tên dự án. |
| 24/09/2026 | Luồng chuẩn: landing `/` → onboarding trắc nghiệm `/onboarding` → bước tạo tài khoản (`/sign-in?after=onboarding`, **bắt buộc** — middleware chặn khách ẩn danh khỏi `/shop` và các trang catalog cho tới khi xác nhận email) → `/shop` | Người dùng cần biết sản phẩm là gì trước khi trả lời; chạm chọn nhanh hơn gõ; hồ sơ được gắn vào tài khoản ngay sau khi tạo (thay quyết định D6 “mời email sau”). Onboarding bằng chat bị gỡ khỏi UI; `/api/onboarding` giữ lại cho cập nhật qua chat. |
| 23/09/2026 | Onboarding là điểm vào chính | Người dùng cần chia sẻ bối cảnh trước khi trải nghiệm tư vấn; thay trang giới thiệu đơn thuần bằng hội thoại agent. |
| 23/09/2026 | Hoàn thiện luồng demo bỉm từ đầu đến cuối | Cho phép kiểm tra onboarding → tư vấn → so sánh → bước mở nơi bán trước khi có dữ liệu thương mại thật. |
| 23/09/2026 | Bản demo lưu hồ sơ và lịch sử trong trình duyệt | Chưa có đăng nhập; dữ liệu có thể mất khi đổi thiết bị hoặc xóa dữ liệu trình duyệt. |
| 23/09/2026 | Nhận [spec v1 Household Purchasing Agent](SPEC_V1_PURCHASING_AGENT.md) làm định hướng | MVP vẫn là tìm–so sánh–đề xuất; mua lại, dự báo tiêu thụ, nhắc mua và giỏ tháng làm sau khi MVP đạt tiêu chí. Khi hai spec mâu thuẫn, spec v1 thắng. |
| 23/09/2026 | Hồ sơ chỉ chứa giá trị đã xác nhận, kèm nguồn gốc | Agent hỏi xác nhận trước khi ghi giá trị mơ hồ (vd "chắc tầm 10kg"); mỗi trường có source, thời điểm quan sát và xác nhận. |
| 23/09/2026 | MVP giữ 1 tài khoản = 1 hộ gia đình | Chia sẻ hồ sơ giữa nhiều thành viên (households/permissions) làm khi có nhu cầu thật. |
| 23/09/2026 | Không hiển thị "Family Match %" | Điểm chưa được hiệu chuẩn; dùng "Phù hợp với nhu cầu đã nêu" (spec v1 §11.5). |

## 9. Cần xác nhận khi chuẩn bị phát hành

- Nguồn catalog và quyền dùng ảnh, giá, mô tả, liên kết của từng merchant.
- Cách xác thực điểm chất lượng của bỉm; nếu thiếu nguồn, không hiển thị điểm hoặc claim đó.
- Mức giá được coi là còn mới và cách kiểm tra link; ngưỡng đề xuất nằm trong [MVP_PLAN.md](MVP_PLAN.md).
- Thiết kế đăng nhập và cách xóa dữ liệu gia đình trước khi lưu thông tin người dùng thật.

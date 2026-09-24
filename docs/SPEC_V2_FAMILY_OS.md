# FamAgents — AI Operating System for Family Life (Spec v2, 24/09/2026)

Bản gốc do chủ sản phẩm cung cấp ngày 24/09/2026. Khi mâu thuẫn với `SOURCE_SPEC.md` hay `SPEC_V1_PURCHASING_AGENT.md`, **spec này thắng về định hướng sản phẩm và điều hướng**; spec v1 vẫn thắng về chi tiết kỹ thuật của Shopping Agent (intent, lọc cứng, xếp hạng, provenance).

## Product thesis
FamAgents giúp một gia đình: **biết mình đang ở đâu → biết điều gì cần chú ý → biết nên làm gì tiếp theo → hỗ trợ thực hiện nó.** Không phải chatbot, không phải app ghi chi tiêu, không phải shopping app, không phải family calendar — mà là **shared intelligence layer cho cả gia đình**.

## 1–2. Bài toán: mental load
Gia đình vận hành bằng nhiều hệ thống rời rạc (tiền, mua sắm, lịch, con cái, việc nhà, giấy tờ, ăn uống, mục tiêu). Không hệ thống nào hiểu toàn bộ trạng thái gia đình. Cognitive household labor = *anticipating → planning → remembering → monitoring → coordinating*. Job: không chỉ “giúp tôi làm task” mà **“đừng bắt tôi phải nhớ rằng task đó tồn tại”**.

## 3. North star: 4 cấp độ
Record → Understand → Advise → Act. Ví dụ Act: “Merries có thể còn khoảng 4 ngày. Tôi đã tìm được nơi mua phù hợp. Anh muốn thêm vào basket tháng này không?”

## 4–5. Core architecture & Family Graph
Family Brain (Members · Household · Context) → **Family Graph** → Finance Agent / Shopping Agent / Planning Agent → Family Orchestrator → Actions. Family Graph là asset trung tâm: Family (members: age, weight, needs) · Home (location, appliances, bills, products) · Finance (income, expenses, assets, debt, budgets, goals) · Shopping (purchases, products, merchants, preferences, consumption) · Planning (events, tasks, routines, responsibilities). Mọi agent đọc cùng graph.

## 6. Điểm khác biệt
Finance thấy Baby Care tăng 600K → Shopping giải thích mua bỉm hai lần → Consumption thấy usage tăng → một câu trả lời có cả ba góc nhìn. Finance + Shopping là hai module MVP hợp nhau.

## 7–12. MVP Module 01 — Family Finance Agent
Không cạnh tranh bookkeeping với Monarch/YNAB/Money Lover. Trả lời 5 câu: nhà tôi có bao nhiêu tiền; tiền đi đâu; có vấn đề gì; tương lai thế nào; tôi nên làm gì. MVP: manual transaction, CSV/Google Sheet import, recurring income/expenses, budget, goals, debt, assets, household members; bank integration để sau. Financial Home: tháng hiện tại (Income, Spent, Remaining, Expected month-end) + AI Insight (chi cao hơn pace, lý do theo nhóm) + CTA “Ask Finance Agent”. Goals có dự báo thời gian đạt. Money conversation là insight layer.

## 13–15. MVP Module 02 — Shopping Agent
Tiếp tục kiến trúc đã xây: Discover → Compare → Decide → Buy → Remember → Replenish. Shopping + Finance: quyết định mua có ngữ cảnh tài chính (“khoản này làm discretionary vượt budget 4,5M — mua ngay / đợi tháng sau / xem lựa chọn dưới 5M”); chiều ngược lại: từ financial insight → actionable shopping decision.

## 16–17. Family Home & Family Brief (killer feature)
Không mở app vào chatbot. Home = “What needs attention”: Money (chi tháng này / plan, lệch), Shopping (bỉm còn ~4 ngày → Reorder), Upcoming (bill đến hạn), Agent Insight. Family Brief hằng ngày/tuần tổng hợp Money, Shopping, Schedule, Tasks, Important changes.

## 18–19. Family Coordinator
User không chọn agent; Coordinator route intent → Finance / Shopping (/Schedule…) → một câu trả lời. User chỉ thấy **FamAgents**.

## 20–24. Module sau MVP
Planner (calendar, tasks, responsibilities; detect obligation → assign → monitor → escalate), Meals & Groceries (meal plan → inventory → shopping list → budget impact), Home Operations (utilities, appliances, maintenance, subscriptions), Documents (insurance, warranty, contracts), Care coordination (appointments, vaccination, routines — không phải medical app).

## 25–28. Landscape, khoảng trống, category
Cozi/FamilyWall (breadth, AI chưa core), Ohai (AI orchestration, finance/commerce chưa deep), Monarch/YNAB (finance, không vận hành household), shopping agents (không hiểu household), generic AI (thiếu structured household state). Khoảng trống: Deep Family Finance + Commerce + Household Ops + Shared Context + Proactive AI. Category: **Family Operating System / AI Operating System for Family Life**. Tagline: *Run your family with less effort* — **Gia đình vận hành nhẹ nhàng hơn.** Value: giảm những thứ phải nhớ, phải kiểm tra, phải tự quản lý mỗi ngày (Remembers · Monitors · Connects · Recommends · Acts).

## 29–31. Zero extra work, Event Stream, Shared Memory
Một sự kiện cập nhật nhiều module: `PURCHASE_COMPLETED {product, merchant, amount, quantity, member, timestamp}` → Finance (expense), Shopping (purchase history), Consumption (stock), Home (inventory). Memory không phải chat history mà là structured state: Family Identity, Financial, Purchase, Consumption, Schedule, Task, Preference State; agent chỉ dùng phần cần thiết.

## 32. Privacy
Dữ liệu tài chính + gia đình + trẻ em cực nhạy cảm. Scope hiển thị: Tom / Partner / Whole family / Private. Shared (budget, bills, groceries) vs Private (personal account, notes).

## 33–39. MVP
**FamAgents Alpha** = Family Finance Agent + Family Shopping Agent; shared: Family Profile, Family Dashboard, Agent Chat, Event Stream. **Navigation: Home · Money · Shopping · Agent · Family.** Home sections: Money, Needs Attention, Shopping, Upcoming, AI Insights. Money P0: income, expenses, categories, budgets, recurring, assets, debt, savings goals, monthly cash flow, shared household; AI: categorization, anomaly detection, summary, forecast, Q&A. Shopping P0: search, compare, recommendation, offers, purchase history, mark purchased, price/unit, family fit; then consumption, running low, reorder. Cross-module MVP (ưu tiên rất cao): một purchase 350K Merries L64 tự tạo Purchase + Expense (Baby Care) + Estimated stock 64. Family Brief hằng tuần.

## 40–47. Magic moment, business, economics, roadmap, metric
Magic moment: FamAgents phát hiện việc quan trọng trước khi tôi nhớ ra. Subscription theo household (Free / Plus 79K–149K/tháng) + affiliate + supplier margin + partnerships + B2B. Economics AI: Rules → Analytics → Small model → Large model chỉ khi cần. Roadmap: Family State → Intelligence → Prediction → Coordination → Household Automation → Agentic Family. North-star metric: **Family Tasks Proactively Resolved**. Success: “Tôi không còn phải nhớ nhiều thứ như trước vì FamAgents nhớ và theo dõi giúp gia đình tôi.”

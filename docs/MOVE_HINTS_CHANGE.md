# Gợi ý nước đi — thay đổi yêu cầu 2026-10-29

Yêu cầu mới của người dùng thay thế quy định không gợi ý trong Word gốc ở P2-019, P2-020, P2-021 và P2-082. Nội dung Word và catalog trích xuất `qa-cases.json` giữ nguyên để truy nguyên. `QA_REQUIREMENT_CHANGES.json` ghi rõ nội dung áp dụng mới; bộ tạo báo cáo QA áp dụng các thay đổi này khi tạo ma trận lần sau và lưu cả nguyên văn yêu cầu cũ. Báo cáo QA đã có là bằng chứng lịch sử, không tự đổi thành kết quả kiểm thử của phiên này.

Khi chọn quân đang đến lượt, frontend gọi `getLegalDestinations()` trong shared engine, cùng bộ luật được server dùng. Chấm xanh viền vàng biểu thị ô trống; vòng đỏ viền vàng biểu thị quân có thể ăn. Marker không nhận pointer events, không thay kích thước bàn cờ và dùng cùng phép xoay tọa độ với quân Đen. Quân được chọn giữ highlight. Chọn quân khác cập nhật marker; bấm lại hoặc Escape bỏ chọn.

Marker ẩn trong lúc pending, mất kết nối, chưa vào playing, không đúng lượt, spectator, lượt AI, kết thúc và replay. Sau khi server từ chối, marker được tính lại trên board chính thức; sau thành công hoặc reconnect không giữ dấu cũ. Người chơi vẫn có thể chọn một ô không có marker, nhưng server tiếp tục từ chối nước không hợp lệ như trước.

## Lịch sử nguyên nhân

- Phần render marker đã tồn tại trước QA, còn trong mốc `5e1d12f` tại `src/client/main.js`.
- `c1d85cd` bỏ import/call `getLegalDestinations()` và vòng tạo marker trong `renderPieces()` theo yêu cầu Word khi đó. Không xóa engine.
- `44f1327` bỏ hai rule `.legal-move`/`.legal-move.capture` không còn DOM producer trong **`src/client/styles/main.css`**. `arena.css` chỉ bố trí scene, không phải file từng chứa CSS marker bị xóa. Migration không làm mất luật cờ.
- Test cũ yêu cầu zero marker khi đã chọn quân: `e2e/game.spec.js`, `e2e/qa/acceptance.spec.js`, `e2e/qa/account-computer.spec.js`, `e2e/qa/navigation.spec.js`. Nay so sánh đầy đủ tọa độ và capture marker với engine; assertion zero marker trong **lượt AI** ở `completeness.spec.js` được giữ vì vẫn đúng quyền thao tác.

## Kiểm thử

`test/acceptance-rules.test.js` kiểm tra thêm enumerator gợi ý cho toàn bộ bảy loại quân/hai màu, capture, quân cùng màu và self-check; bộ luật không thay đổi. Các bài Edge cũ vẫn giữ gameplay/account/chat/video/replay assertions. Hai bài `e2e/move-hints.spec.js` kiểm tra marker trên cả bảy loại quân, hai màu, tọa độ xoay, capture click xuyên vòng, đổi/bỏ chọn, pending, server reject, spectator, reconnect, finish, replay và mobile touch PvE.

Chạy `npm.cmd test`, `npm.cmd run test:e2e`, `npm.cmd run test:qa:e2e`, `npm.cmd run build`, `npm.cmd run check:architecture`. Không đổi backend, schema, persistence hoặc dependency; SQL suite không bị thay đổi bởi tính năng frontend. Kết quả thực tế của phiên này được ghi riêng tại `artifacts/move-hints/REPORT.md` sau khi chạy; không dùng số PASS lịch sử để thay bằng chứng mới.

Thực hiện trên nhánh riêng từ integration `244e923`; không merge hoặc push GitHub, không đổi main/Phase, không đưa 24 deleted paths của người dùng vào commit và không sửa dữ liệu thật để test.

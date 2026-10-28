# Báo cáo nghiệm thu hệ thống Cờ tướng — 28/10/2026

**Kết luận: CHƯA ĐẠT NGHIỆM THU.** Các kiểm thử local/file/SQL/realtime/UI đã đạt sau sửa lỗi, nhưng chức năng gửi email SMTP thật chưa triển khai và hai kiểm tra thiết bị/mạng thật còn BLOCKED. Không tuyên bố ứng dụng hoạt động 100% hoặc đủ điều kiện triển khai production trên mọi mạng.

## Nguồn, phiên bản và phạm vi

- Source đã sửa và kiểm thử: commit `c1d85cd`; kiểm thử khôi phục PvE bổ sung tại `c93ed5b`. Nhánh `qa/system-acceptance-20261028` tách từ `integration` tại `a7b9718`. Mốc tích hợp `6da0a47` vẫn thuộc lịch sử; nhánh backup của mốc này được giữ.
- Đọc đủ 495 đoạn của file người dùng cung cấp `C:\Users\Acer\Downloads\Cờ Tướng.docx`; bản nguyên byte được lưu tại [KICH_BAN_CHUC_NANG.docx](KICH_BAN_CHUC_NANG.docx). [QA_REQUIREMENTS.md](QA_REQUIREMENTS.md) chứa nội dung trích xuất và SHA-256; không dùng transcript cũ làm nguồn chính.
- 389 bullet yêu cầu Word (có các yêu cầu lặp), cộng 20 kiểm tra bổ sung từ yêu cầu người dùng → **409 test case đối chiếu**. Điều kiện con được giữ cùng case. Ma trận được lập trước baseline, sau đó cập nhật bằng assertion/log thực thi.
- Có mâu thuẫn ở Phase 1 ¶195 cho spectator xem chat; theo chỉ dẫn người dùng và Phase 4 ¶438, áp dụng **spectator không nhận/xem/gửi chat; cặp mới không đọc chat cũ**. Auto-accept lời mời kết bạn hai chiều là lựa chọn “có thể” trong Word; ứng dụng giữ một Pending và chờ người nhận xử lý.

## Kết quả đối chiếu yêu cầu

| Phase | Số test | PASS | FAIL | BLOCKED | NOT IMPLEMENTED | NOT TESTED |
|---|---:|---:|---:|---:|---:|---:|
| Phase 1 | 195 | 194 | 0 | 0 | 1 | 0 |
| Phase 2 | 84 | 84 | 0 | 0 | 0 | 0 |
| Phase 3 | 58 | 58 | 0 | 0 | 0 | 0 |
| Phase 4 | 52 | 52 | 0 | 0 | 0 | 0 |
| Database | 7 | 7 | 0 | 0 | 0 | 0 |
| Security/ổn định | 7 | 7 | 0 | 0 | 0 | 0 |
| Môi trường/UI | 6 | 3 | 0 | 2 | 1 | 0 |
| **Tổng** | **409** | **405** | **0** | **2** | **2** | **0** |

**405 hàng được thực thi và đạt đủ điều kiện trong phạm vi ghi tại bằng chứng.** Hai hàng NOT IMPLEMENTED cùng phản ánh một chức năng SMTP còn thiếu; hai hàng BLOCKED là thiết bị thật và NAT/TURN. Các hàng Phase 4 về WebRTC mô tả kiểm tra local/signaling/fake media, không đại diện cho camera vật lý hay hai mạng khác nhau.

Số hàng yêu cầu khác số bài tự động: đã chạy **200 bài có kết quả PASS riêng biệt** = 177 Node + 7 SQL + 16 Edge. Một bài có nhiều assertion có thể chứng minh nhiều yêu cầu; không cộng lại các lần rerun vào tổng này.

Chi tiết điều kiện, bước, input, expected/actual, mã lỗi và bằng chứng của từng hàng: [QA_TEST_MATRIX.md](QA_TEST_MATRIX.md). Kết quả máy đọc được: [qa-results.json](qa-results.json).

## Baseline và hồi quy sau sửa

| Suite / lệnh | Baseline thực tế tại a7b9718 | Sau sửa |
|---|---|---|
| `npm.cmd test` | 68 PASS, 3 SQL skip | **177 PASS**, 7 SQL skip |
| SQL Server thật | 3/3 PASS | **7/7 PASS**, không skip trong lượt SQL riêng |
| `npm.cmd run test:e2e` | 4/4 PASS | **4/4 PASS** |
| `npm.cmd run test:qa:e2e` | Chưa có suite QA | **12/12 PASS**, cùng một lượt khoảng 3,4 phút |
| `npm.cmd run build` | PASS | **PASS**, kiểm tra backend và build Vite |

Bảy SQL test được skip trong lệnh Node mặc định để tránh ghi nhầm database. Cả bảy được bật và chạy thật bằng `test:qa:sql`; không bỏ test để lấy PASS. Những log `Simulated ... failure` và `Max payload size exceeded` là tình huống âm có assertion rollback/denial; không phải lỗi bị che hoặc test bị xóa.

Môi trường thực thi: Windows, Node.js v24.15.0, npm 11.12.1, Microsoft Edge headless qua Playwright; SQL Server Express `.\SQLEXPRESS`, Windows Authentication qua `sqlcmd`. Python chỉ dùng trích xuất Word bằng thư viện chuẩn, không phải runtime/test ứng dụng.

## Các luồng đã kiểm chứng thực tế

- Bốn browser context A/B/C/D có cookie riêng: tài khoản → kết bạn → invite → join → ready/countdown → nhiều nước/capture → spectator mobile → chat riêng → offline/reconnect → kết thúc → rematch → lịch sử/replay → logout/Back.
- Ba browser đổi Đối thủ/Chủ Room trước trận: public list cập nhật không refresh; người mới không kế thừa ready; host mới và đối thủ phải ready lại; trước Match không tạo thắng/thua.
- Tám nước chơi từ bàn chuẩn để tạo/thoát Chiếu Tướng, thử nước không thoát chiếu, không có gợi ý ô đích. Thêm 77 bài luật cho cả hai màu, nước đúng/sai/ăn quân/tự chiếu của mọi loại quân. Chiếu bí/hết nước dùng fixture thế cờ cuối minh bạch, sau đó đi qua handler server và persistence thật.
- File persistence: tài khoản, phiên, board/capture/history giữ qua restart. Trận chơi máy được kiểm tra qua cả FilePersistence mới và SQL Server sau restart: giữ cookie, ID, board, màu, lịch sử và deadline; sau đó đầu hàng và replay. SQL xác nhận PvE với máy Đỏ, người Đen vẫn là người tạo. Snapshot thiếu board bị từ chối khởi động, không tạo bàn mới để tiếp tục trận cũ.
- Thời gian thực: countdown 3s; turn/AI-human AFK 60s; reconnect 60s; invite/call 60s. Có bài cấu hình rút ngắn cho biên/cạnh tranh, song song với bài xác nhận thời gian production. Machine delay 800ms chỉ ở server Edge QA để quan sát trạng thái; production vẫn 180ms.
- Raw HTTP/WS: unauth/Origin sai, giả ID, spectator thao tác, private chat/call, Room isolation, repeated request, concurrent seat claim, cap 10, kick ban, body/frame >16KiB, rate limit, generic error và log không lộ input nhạy cảm.
- 40 vòng join/leave và 12 socket mới: peer/membership/listener về mức nền, call/computer maps không còn dư, không tăng tài nguyên vô hạn trong bài kiểm tra giới hạn này.
- Local WebRTC fake media: reject/accept/timeout/recall, permission denied, camera unavailable → audio-only, camera/mic toggle, đóng Room dừng cả hai MediaStream. Chơi máy cả hai màu đến kết quả/đầu hàng, reload giữ ID và replay riêng.

## SQL Server và dữ liệu

Database duy nhất dùng cho lượt QA SQL: **`CoTuongIntegrationTest_QA_20261028`**. Đã kiểm tra 24 bảng nền, 5 view, chạy query các view, kiểm tra FK enabled/trusted và thực sự từ chối FK/UNIQUE/CHECK sai. Setup lặp không tạo trùng. Không DROP/TRUNCATE/rebuild DB thật.

Các bảng nghiệp vụ runtime được kiểm tra gồm tài khoản/phiên/token, lời mời kết bạn và `ban_be`, Room/thành viên, Match/quân/nước đi; cùng 7 bảng integration cho mapping/snapshot. SQL trực tiếp xác nhận capture/result/move count, một request lặp chỉ một dòng, host Đen vẫn là người tạo, stale writer rollback không chèn user một phần, state/history còn sau restart.

Không khẳng định cả 24 bảng đều được runtime sử dụng. Notifications, room invites và chat vẫn nằm trong payload account/Room theo thiết kế integration; các bảng phụ tương ứng chưa phải nguồn đọc của ứng dụng. Presence/call đang sống trong process. `DB_DRIVER=mssql` với SQL login chưa được xác minh kết nối thật; driver SQL đã nghiệm thu là `sqlcmd`/Windows Authentication.

## Sửa lỗi và thay đổi mã nguồn

[QA_BUG_REPORT.md](QA_BUG_REPORT.md) ghi 19 mục đã khắc phục, nguyên nhân, mức P1/P2/P3, test trước/sau và ba mục chưa đóng. Điểm chính: phân màu/ngừng gợi ý, invite không giữ ghế, quyền/ready/đổi ghế, validation/reset, private channel/media, offline/reconnect/snapshot, projection bạn bè và người tạo Match.

- Runtime: `src/client/main.js`, `account-ui.js`, `styles/arena.css`; `src/server/game-server.js`, `http/account-routes.js`, `services/accounts.js`, `services/snapshot.js`, `realtime/transport.js`, `persistence/integration-sql-persistence.js`.
- Regression: giữ toàn bộ bài cũ; cập nhật expectation màu/ngừng gợi ý/opt-in theo Word; thêm `test/acceptance*.test.js`, `test/qa-sql.test.js`, `test/helpers/qa.js`, `e2e/qa/`, config/server QA.
- Tooling/tài liệu: scripts QA, npm scripts, Word/cases/matrix/report/checklist/screenshots. Không thêm dependency; không đổi schema nền, shared engine, C# tham khảo, `main` hoặc năm remote branch nguồn.

Frontend vẫn JavaScript/Vite, backend Node.js, WebSocket/WebRTC, engine JavaScript dùng lại, database giữ T-SQL. Không có runtime .NET trong luồng chính.

## Bằng chứng và giới hạn

- Logs cuối: `artifacts/qa/final-node.log`, `sql.log`, `browser.log`, `regression-edge.log`, `build.log`.
- Log tái hiện và trace trước sửa: xem [QA_BUG_REPORT.md](QA_BUG_REPORT.md). Playwright giữ screenshot/trace khi lỗi; thư mục `artifacts/qa/browser/` được tạo lại mỗi lượt. Bản điều tra ban đầu đã được giữ riêng.
- Ảnh bàn giao: [Desktop](screenshots/qa-desktop.png), [Mobile spectator](screenshots/qa-mobile.png), [Mobile chơi máy](screenshots/qa-mobile-computer.png). Raw ảnh/check-escape/call còn tại `artifacts/qa/`.
- Raw logs/trace/outbox không commit; các tài khoản test dùng `@example.test`. Kết quả/tài liệu và ảnh tổng hợp không chứa cookie/reset token.
- Đây là kiểm thử chức năng và ổn định có giới hạn trên một process/local. Không thay thế soak/load dài hạn, vận hành nhiều worker, camera thật, mạng thực hoặc kiểm tra mọi OS/browser. Các bước thủ công còn lại nằm trong [QA_MANUAL_CHECKLIST.md](QA_MANUAL_CHECKLIST.md).

## Chạy lại trên Windows

Trong thư mục dự án, dùng PowerShell. Nếu `node_modules` chưa có, cài theo lockfile bằng `npm.cmd ci`.

```powershell
New-Item -ItemType Directory -Force artifacts/qa | Out-Null
npm.cmd run build *> artifacts/qa/build.log
npm.cmd test *> artifacts/qa/final-node.log
npm.cmd run test:e2e *> artifacts/qa/regression-edge.log
npm.cmd run test:qa:e2e *> artifacts/qa/browser.log
```

Chỉ dùng DB test tên chính xác bên dưới cho suite QA SQL:

```powershell
sqlcmd -S '.\SQLEXPRESS' -d master -E -C -b -Q "IF DB_ID(N'CoTuongIntegrationTest_QA_20261028') IS NULL CREATE DATABASE CoTuongIntegrationTest_QA_20261028;"
$env:DB_DRIVER = 'sqlcmd'
$env:DB_SERVER = '.\SQLEXPRESS'
$env:DB_DATABASE = 'CoTuongIntegrationTest_QA_20261028'
$env:RUN_SQL_TESTS = 'true'
npm.cmd run test:qa:sql *> artifacts/qa/sql.log
Remove-Item Env:RUN_SQL_TESTS,Env:DB_SERVER,Env:DB_DATABASE,Env:DB_DRIVER
node scripts/qa/collect.js
npm.cmd run qa:report
```

`collect.js` kiểm tra các log hiện tại đều đạt trước khi thêm mapping assertion; không dùng báo cáo cũ làm kết quả của lượt mới. Để nghiệm thu một lượt độc lập, có thể đặt thư mục artifacts cũ sang vị trí lưu điều tra rồi chạy các suite trên; không sửa/xóa dữ liệu ứng dụng. Nếu code/test count đổi, cần cập nhật mapping/gate cho lượt nghiệm thu mới.

Chạy ứng dụng để test tay: `npm.cmd run dev`, mở `http://localhost:5173`; backend `3001`. Mặc định file persistence giữ `data/integration.json`. SQL runtime có hướng dẫn tại [README](../README.md); không trỏ lượt kiểm thử vào DB sử dụng thực tế.

**CHƯA ĐẠT NGHIỆM THU** cho đến khi QA-018/019/020 được đóng bằng bằng chứng môi trường phù hợp, rồi chạy lại regression liên quan.

# Xác minh dọn source an toàn

## Mốc và kết luận

Baseline thực tế chạy lại tại `d92474d20a155904274dd93ff87975a325a74580` trên `qa/system-acceptance-20261028`, không lấy kết quả QA cũ làm bằng chứng cho lượt này. Môi trường Windows, Node v24.15.0, npm 11.12.1, Vite 5.4.21, Microsoft Edge headless/Playwright; SQL Server Express `.\SQLEXPRESS`, Windows Authentication/sqlcmd.

Nhánh dọn: `refactor/safe-cleanup`; backup nguyên mốc: `backup/safe-cleanup-d92474d`. Hai nhóm source đã qua kiểm thử rồi commit riêng. **Dọn source đạt trong phạm vi local/file/SQL/Edge đã kiểm chứng, không phát hiện hồi quy.** Đây không phải nghiệm thu ứng dụng 100%: SMTP thật chưa triển khai, camera/micro vật lý và NAT/TURN vẫn chưa được xác minh.

## Kiểm thử trước và sau

| Kiểm tra | Baseline d92474d | Sau nhóm 1: hai demo | Sau toàn bộ / nhóm CSS |
|---|---|---|---|
| Node unit/integration `npm.cmd test` | 177 PASS, 7 SQL skip, 0 FAIL | 177 PASS, 7 skip, 0 FAIL | **177 PASS, 7 skip, 0 FAIL** |
| SQL Server thật `test:qa:sql` | 7/7 PASS, 0 skip | Không chạy riêng: không đổi SQL; chạy đủ ở cuối | **7/7 PASS**, 0 skip |
| Edge nền `test:e2e` | 4/4 PASS | Không chạy riêng: không đổi frontend; chạy đủ ở cuối | **4/4 PASS** |
| Edge QA `test:qa:e2e` | 12/12 PASS | Chạy đủ ở cuối | **12/12 PASS** |
| Build backend + Vite | PASS | PASS | **PASS** |
| Kiến trúc/cú pháp/import | Backend kiểm tra trong build | PASS cả check:architecture và build | **PASS** check:architecture trên workspace chính và bản cài sạch; backend trong build cũng PASS |
| Cài sạch bằng lockfile | Chưa thực hiện trong baseline | — | **npm ci --offline PASS**, 109 package; architecture/build + 177 Node PASS |
| CLI trên bản cài sạch | — | — | **PASS** static host, hai tài khoản/WS/PvP, AI, replay và cookie/history sau restart |
| localhost:5173 đang chạy | Đã lưu hash dữ liệu | Không khởi động lại ứng dụng người dùng | **HTTP/UI/health PASS**, CSS marker cũ vắng; tài khoản/lịch sử cùng hash; 0 pageerror |

184 test được node:test phát hiện: 177 PASS, 7 SQL skip mặc định để bảo vệ database. Cả bảy SQL test đều bật và chạy thật riêng, không bỏ test để đạt PASS. Số bài PASS độc lập trong bộ gốc vẫn **200 = 177 Node + 7 SQL + 16 Edge**; không cộng các lượt rerun/bản cài sạch vào số đó. Không sửa bất kỳ test/fixture/config Playwright hoặc tiêu chí PASS nào trong cleanup.

Thời gian tham khảo: baseline Node ~68,8s, SQL ~147,5s, Edge nền ~37,3s, QA ~3,2 phút; sau dọn Node ~67,8s, SQL ~161,2s, Edge nền ~36,6s, QA ~3,3 phút. SQL có IO/transaction thật nên thời gian dao động; không đặt mục tiêu hiệu năng từ số này.

## Chức năng đã kiểm chứng

- HTTP/API + cookie độc lập: đăng ký/đăng nhập/đăng xuất, validation, reset token/outbox, bạn bè/invite/notification, quyền và realtime lobby.
- Hai người chơi qua WS thật: create/join/ready/snapshot/countdown, phân màu, nhiều nước và capture, luật/chiếu, clock/AFK, hòa/đầu hàng, rematch, spectator/đổi host/ghế, disconnect/reconnect, history/replay.
- Chat riêng và room isolation; WebRTC local/fake media, permission denial, audio fallback, toggle/recall/stop tracks. Không coi fake media là kiểm chứng camera vật lý hay kết nối qua hai mạng.
- Chơi máy cả hai màu, thinking/lock, AFK, result/history/replay, reload và khôi phục snapshot FilePersistence/SQL sau restart.
- SQL thật trên **CoTuongIntegrationTest_QA_20261028**: 24 bảng nền, 5 view, FK/UNIQUE/CHECK, schema setup lặp, friendship projection, host Đen vẫn là creator, idempotent move, accounts/board/capture/history/result bền sau restart và stale writer rollback. Không DROP/TRUNCATE hoặc dọn database thật.
- Desktop/mobile và layout vẫn qua đủ 16 Edge tests. `.piece.selected` và engine legal moves còn nguyên, chỉ bỏ hai rule marker không có DOM producer.

## Kiểm tra cài mới và dữ liệu

Tạo thư mục mới `artifacts/cleanup/fresh-install` bằng các file source/config/test của working tree đã dọn. Không sao chép `.env`, `data`, `.git`, `dist` hoặc `node_modules` cũ. Manifest hash riêng tại `artifacts/cleanup/fresh-manifest.json`. Đây là bản sao cài sạch dependencies trong cùng máy/OS/cache, không phải một máy Windows mới hay chứng minh mọi OS đều chạy.

Chạy `npm.cmd ci --offline --cache C:\Users\Acer\Downloads\cotuong\.npm-cache`: cài 109 package thành công, không cần mạng. Sau đó chạy check:architecture, build, toàn bộ Node suite từ thư mục mới; kết quả đều PASS. Hai bundle CSS/JS build ra có cùng tên/hash với bản chính sau cleanup. Không sửa lockfile hoặc dùng lại node_modules của workspace chính.

Harness CLI riêng chạy `node --env-file-if-exists=.env server.js` trên 127.0.0.1:3112, DB_MODE=file, file `data/cleanup-smoke.json` **bên trong bản sao**. Tạo hai người dùng giả, ready/countdown, đi một nước, đầu hàng; bắt đầu trận máy với người Đen, máy đi mở đầu, đầu hàng; xác nhận hai history/replay. Dừng CLI riêng rồi chạy lại: cookie vẫn nhận đúng người dùng, danh sách lịch sử giống trước restart và hai replay đều còn một nước. Bằng chứng: fresh-smoke.log, fresh-cli.log. Không chạy các thao tác này vào `data/integration.json` của người dùng.

Ứng dụng chính tiếp tục chạy ở `http://localhost:5173` / backend 3001. Kiểm tra Edge mới ở trạng thái chưa đăng nhập: trang login hiện, health file/ok, CSS cũ không còn và không có pageerror. Hash toàn bộ accounts và matches trước/sau không đổi: 3 người dùng, 2 Room, 1 lịch sử. Không restart ứng dụng chính hoặc đưa tài khoản thử vào dữ liệu đó. Chức năng restart được chứng minh trên file/SQL test và CLI cô lập.

## Bằng chứng và các lỗi công cụ đã xử lý

| Vị trí local (ignored, không chứa trong commit) | Nội dung |
|---|---|
| `artifacts/cleanup/baseline/{node,sql,build,edge,edge-qa}.log` | Lượt baseline thực tế; browser-results.json giữ riêng |
| `artifacts/cleanup/group1/{node,architecture,build}.log` | Sau nhóm xóa hai demo |
| `artifacts/cleanup/final/{node,sql,build,edge,edge-qa}.log` | Hồi quy cuối sau CSS; output browser được chuyển sang thư mục riêng để giữ baseline |
| `artifacts/cleanup/fresh-{install,architecture,build,node,smoke,cli}.log` | Cài mới và smoke CLI thật |
| `artifacts/cleanup/final/live-check.json`, `live-login.png`, `live.log` | Kiểm tra read-only localhost và hash dữ liệu không đổi |
| `artifacts/cleanup/ignored-metadata.json`, `dotnet-symbols.json`, `original-refs.txt` | Metadata kiểm kê, nhận diện .NET và mốc Git |

Scanner import hiện hữu ban đầu nhận nhãn chuỗi `js-import` trong script audit mới thành câu lệnh import, báo dependency giả. Đã đổi nhãn dữ liệu thành `esm-reference`, giữ nguyên scanner/tests, rồi chạy lại architecture/build PASS; log gốc ở group1/architecture-tooling-before.log. Không phải lỗi do xóa demo.

Hai harness mới ngoài Git ban đầu dùng nhầm event `room-left` thay vì contract `left-room`, và APIRequestContext thiếu baseURL. Đã sửa harness theo contract hiện hành rồi chạy lại PASS; giữ log fresh-smoke-harness-before.log và final/live-harness-before.log. Không sửa ứng dụng hoặc bài test gốc để né lỗi.

PowerShell ghi dòng stderr “.env not found. Continuing without it.” thành NativeCommandError trong một số log, dù native command đã hoàn tất. Các lệnh sau ghi/propagate `$LASTEXITCODE` rõ ràng; build baseline đã chạy lại xác nhận native exit 0. Dựa trên summary/exit native, không coi cảnh báo đó là test ứng dụng FAIL. Các lỗi mô phỏng trong Node tests vẫn có assertion tương ứng, không bị bỏ qua.

## Phạm vi Git và cách phục hồi

- Nhóm 1: `9d9c805` — hai demo + README archive; Node/architecture/build PASS trước commit.
- Nhóm 2: `44f1327` — chỉ hai khối CSS; Node/SQL/16 Edge/build PASS trước commit.
- Tài liệu/kiểm kê là commit riêng sau hai nhóm. Commit HEAD cuối được báo trong bàn giao; tra chính xác bằng `git log -3 --oneline refactor/safe-cleanup` / `git rev-parse refactor/safe-cleanup`.
- Diff bảo vệ: package.json/lock, `.env.example`, server và toàn bộ JavaScript runtime, SQL schema, tests/e2e/fixtures, shared engine, Word và QA matrix/results không thay đổi so với baseline.
- 238 file gốc: xóa 2, giữ 236. Thêm 6 file kiểm toán (3 báo cáo bắt buộc, inventory JSON, dependency map, script audit) → **242 file hiện tại**; tổng 244 path gốc/mới đã xem xét, gồm cả hai path đã xóa. Các file mới thuộc nhóm B, nên danh mục hiện tại A=28/B=143/C=65/D=0/E=6. Không xóa file ngoài Git, không git clean/reset/force-push.

Nếu cần phục hồi hai demo, chỉ restore **đúng hai path** từ `backup/safe-cleanup-d92474d` sau khi kiểm tra không có sửa mới ở các path đó. CSS có commit độc lập để hoàn nguyên đúng hunk/commit khi cần; không reset toàn working tree. Backup Git là bản gốc, không phụ thuộc các artifact cài thử.

Giữ nguyên kết luận QA **405/409** tại [QA_FINAL_REPORT.md](QA_FINAL_REPORT.md): cleanup không tự đóng SMTP, thiết bị thật hoặc NAT/TURN. Sáu file E và toàn bộ legacy nghiệp vụ vẫn giữ theo [CODE_AUDIT_REPORT.md](CODE_AUDIT_REPORT.md); không tuyên bố repository sạch 100%.

# Bản đồ phụ thuộc phục vụ dọn source

Mốc đọc: `d92474d20a155904274dd93ff87975a325a74580`. Sinh bằng `node scripts/cleanup/audit.js`. Đây là đồ thị import literal + URL filesystem + HTML; không dùng riêng đồ thị để kết luận xóa. Danh mục từng file và ProjectReference C# nằm trong [CODE_AUDIT_INVENTORY.json](CODE_AUDIT_INVENTORY.json).

## Các entrypoint và tham chiếu gián tiếp đã rà soát

| Luồng | Chuỗi phụ thuộc / quyết định |
|---|---|
| Dev | package.json → scripts/dev.js → concurrently → node server.js + vite; Vite → index.html → hai CSS + client/main.js |
| Production | start/server/preview → server.js → game-server → HTTP/WS/services/persistence/shared; HTTP staticDir mặc định dist; giữ tất cả |
| SQL | db:setup → setup-db.js → database/01_schema_phase1.sql + 03_integration.sql; integration adapter đọc 03 bằng URL; giữ cả seed 02 và SQL nguồn tham khảo |
| SQL driver | sql-connection.js dynamic import('mssql') hoặc execFile sqlcmd; SQL tạm dưới data/sql-temp; không phải dependency .NET |
| Unit/integration | npm test discovery test/*.test.js → helpers; persistence.test.js → reference/phase4/sql-server-persistence.js; giữ adapter/bridge |
| Edge | hai Playwright config → scripts/e2e-server.js hoặc scripts/qa/browser-server.js → dist + API/WS thật trên 3107/3108 |
| QA tooling | Word → extract-requirements.py → catalog/transcript; evidence.jsonl + assessment → report.js; collect.js đọc logs; giữ Python như công cụ tài liệu |
| Cấu hình động | DB_MODE/DB_DRIVER, DATA_FILE/MAIL_OUTBOX/STATIC_DIR, TLS files, BROWSER_PATH, WS override, socket actions, ?room/?reset, storage và getUserMedia/RTCPeerConnection; giữ các file tương ứng |
| Asset/CSS | SVG/data URI/gradient/canvas được nhúng, class động piece/color/selected/mine/theirs/clock/panels; giữ CSS còn lại. Chỉ hai rule legal-move không có producer HTML/JS, test xác nhận 0 marker |
| Legacy Blazor | CoTuong.slnx → 4 csproj → Core/Infrastructure/Web/Tests; Razor SDK tự khám phá @page. Xóa Counter/Weather sẽ bỏ hai route demo nếu ai chạy riêng ứng dụng C#; không ảnh hưởng game Node, auth hay SMTP |
| Deployment/CI | Không có Dockerfile, compose hoặc pipeline CI/CD trong snapshot/working root. README yêu cầu deploy runtime Node + dist + package/lock, không reference; không suy đoán cấu hình bên ngoài repo |
| Ngoài Git | node_modules/cache/dist/artifacts/data và 44 Bootstrap assets ignored: chỉ thống kê metadata, giữ nguyên; không lấy thiếu import làm bằng chứng xóa |

## Cạnh literal của JavaScript/HTML/SQL hiện có tại mốc gốc

| Từ | Tới | Loại | Tồn tại ở mốc gốc |
|---|---|---|---|
| `e2e/qa/account-computer.spec.js` | `src/shared/game/xiangqi.js` | esm-reference | yes |
| `e2e/qa/completeness.spec.js` | `src/shared/game/xiangqi.js` | esm-reference | yes |
| `index.html` | `src/client/styles/main.css` | html-entry | yes |
| `index.html` | `src/client/styles/arena.css` | html-entry | yes |
| `index.html` | `src/client/main.js` | html-entry | yes |
| `reference/phase4/sql-server-persistence.js` | `src/server/persistence/persistence-port.js` | esm-reference | yes |
| `scripts/check-architecture.js` | `src/server/config.js` | esm-reference | yes |
| `scripts/e2e-server.js` | `server.js` | esm-reference | yes |
| `scripts/e2e-server.js` | `src/server/persistence/memory-persistence.js` | esm-reference | yes |
| `scripts/qa/browser-server.js` | `server.js` | esm-reference | yes |
| `scripts/qa/browser-server.js` | `src/server/persistence/memory-persistence.js` | esm-reference | yes |
| `scripts/setup-db.js` | `src/server/persistence/sql-connection.js` | esm-reference | yes |
| `scripts/setup-db.js` | `database/01_schema_phase1.sql` | filesystem-url | yes |
| `scripts/setup-db.js` | `database/03_integration.sql` | filesystem-url | yes |
| `server.js` | `src/server/game-server.js` | esm-reference | yes |
| `src/client/main.js` | `src/shared/game/xiangqi.js` | esm-reference | yes |
| `src/client/main.js` | `src/shared/game/constants.js` | esm-reference | yes |
| `src/client/main.js` | `src/client/account-ui.js` | esm-reference | yes |
| `src/client/main.js` | `src/client/utils.js` | esm-reference | yes |
| `src/server/config.js` | `./` | filesystem-url | directory |
| `src/server/game-server.js` | `src/shared/game/xiangqi.js` | esm-reference | yes |
| `src/server/game-server.js` | `src/shared/game/constants.js` | esm-reference | yes |
| `src/server/game-server.js` | `src/server/services/history-store.js` | esm-reference | yes |
| `src/server/game-server.js` | `src/server/persistence/index.js` | esm-reference | yes |
| `src/server/game-server.js` | `src/server/persistence/memory-persistence.js` | esm-reference | yes |
| `src/server/game-server.js` | `src/server/services/accounts.js` | esm-reference | yes |
| `src/server/game-server.js` | `src/server/services/snapshot.js` | esm-reference | yes |
| `src/server/game-server.js` | `src/server/http/account-routes.js` | esm-reference | yes |
| `src/server/game-server.js` | `src/server/http/handler.js` | esm-reference | yes |
| `src/server/game-server.js` | `src/server/http/responses.js` | esm-reference | yes |
| `src/server/game-server.js` | `src/server/realtime/transport.js` | esm-reference | yes |
| `src/server/game-server.js` | `src/server/config.js` | esm-reference | yes |
| `src/server/http/account-routes.js` | `src/server/services/accounts.js` | esm-reference | yes |
| `src/server/http/account-routes.js` | `src/server/errors.js` | esm-reference | yes |
| `src/server/http/account-routes.js` | `src/server/http/request.js` | esm-reference | yes |
| `src/server/http/handler.js` | `src/server/errors.js` | esm-reference | yes |
| `src/server/http/handler.js` | `src/server/http/request.js` | esm-reference | yes |
| `src/server/http/handler.js` | `src/server/http/responses.js` | esm-reference | yes |
| `src/server/http/request.js` | `src/server/errors.js` | esm-reference | yes |
| `src/server/persistence/index.js` | `src/server/persistence/memory-persistence.js` | esm-reference | yes |
| `src/server/persistence/index.js` | `src/server/persistence/file-persistence.js` | esm-reference | yes |
| `src/server/persistence/index.js` | `src/server/persistence/integration-sql-persistence.js` | esm-reference | yes |
| `src/server/persistence/index.js` | `src/server/config.js` | esm-reference | yes |
| `src/server/persistence/index.js` | `src/server/persistence/memory-persistence.js` | esm-reference | yes |
| `src/server/persistence/index.js` | `src/server/persistence/integration-sql-persistence.js` | esm-reference | yes |
| `src/server/persistence/integration-sql-persistence.js` | `src/server/persistence/sql-connection.js` | esm-reference | yes |
| `src/server/persistence/integration-sql-persistence.js` | `src/server/config.js` | esm-reference | yes |
| `src/server/persistence/integration-sql-persistence.js` | `database/03_integration.sql` | filesystem-url | yes |
| `src/server/persistence/memory-persistence.js` | `src/server/persistence/persistence-port.js` | esm-reference | yes |
| `src/server/persistence/sql-connection.js` | `src/server/config.js` | esm-reference | yes |
| `src/server/realtime/transport.js` | `src/server/http/request.js` | esm-reference | yes |
| `src/server/realtime/transport.js` | `src/server/errors.js` | esm-reference | yes |
| `src/server/services/accounts.js` | `src/server/errors.js` | esm-reference | yes |
| `src/server/services/history-store.js` | `src/shared/game/constants.js` | esm-reference | yes |
| `test/acceptance-completeness.test.js` | `test/helpers/qa.js` | esm-reference | yes |
| `test/acceptance-completeness.test.js` | `src/shared/game/xiangqi.js` | esm-reference | yes |
| `test/acceptance-file-ai.test.js` | `server.js` | esm-reference | yes |
| `test/acceptance-file-ai.test.js` | `src/server/persistence/file-persistence.js` | esm-reference | yes |
| `test/acceptance-file-ai.test.js` | `test/helpers/qa.js` | esm-reference | yes |
| `test/acceptance-invites.test.js` | `test/helpers/qa.js` | esm-reference | yes |
| `test/acceptance-lifecycle.test.js` | `test/helpers/qa.js` | esm-reference | yes |
| `test/acceptance-results.test.js` | `server.js` | esm-reference | yes |
| `test/acceptance-results.test.js` | `src/server/persistence/memory-persistence.js` | esm-reference | yes |
| `test/acceptance-results.test.js` | `test/helpers/qa.js` | esm-reference | yes |
| `test/acceptance-rules.test.js` | `src/shared/game/xiangqi.js` | esm-reference | yes |
| `test/acceptance-rules.test.js` | `test/helpers/qa.js` | esm-reference | yes |
| `test/acceptance-security.test.js` | `test/helpers/qa.js` | esm-reference | yes |
| `test/acceptance-time.test.js` | `test/helpers/qa.js` | esm-reference | yes |
| `test/acceptance-validation.test.js` | `test/helpers/qa.js` | esm-reference | yes |
| `test/acceptance.test.js` | `src/server/services/accounts.js` | esm-reference | yes |
| `test/acceptance.test.js` | `src/server/persistence/memory-persistence.js` | esm-reference | yes |
| `test/acceptance.test.js` | `test/helpers/qa.js` | esm-reference | yes |
| `test/acceptance.test.js` | `test/helpers/authenticated-game.js` | esm-reference | yes |
| `test/client-utils.test.js` | `src/client/utils.js` | esm-reference | yes |
| `test/computer.test.js` | `server.js` | esm-reference | yes |
| `test/computer.test.js` | `src/server/persistence/index.js` | esm-reference | yes |
| `test/computer.test.js` | `src/shared/game/xiangqi.js` | esm-reference | yes |
| `test/computer.test.js` | `src/shared/game/constants.js` | esm-reference | yes |
| `test/helpers/authenticated-game.js` | `server.js` | esm-reference | yes |
| `test/helpers/qa.js` | `server.js` | esm-reference | yes |
| `test/helpers/qa.js` | `src/server/persistence/memory-persistence.js` | esm-reference | yes |
| `test/helpers/qa.js` | `test/helpers/authenticated-game.js` | esm-reference | yes |
| `test/integration.test.js` | `server.js` | esm-reference | yes |
| `test/integration.test.js` | `src/server/persistence/memory-persistence.js` | esm-reference | yes |
| `test/integration.test.js` | `src/server/persistence/file-persistence.js` | esm-reference | yes |
| `test/integration.test.js` | `test/helpers/authenticated-game.js` | esm-reference | yes |
| `test/normalization.test.js` | `server.js` | esm-reference | yes |
| `test/normalization.test.js` | `src/server/persistence/memory-persistence.js` | esm-reference | yes |
| `test/normalization.test.js` | `src/server/config.js` | esm-reference | yes |
| `test/normalization.test.js` | `src/client/utils.js` | esm-reference | yes |
| `test/normalization.test.js` | `src/server/services/accounts.js` | esm-reference | yes |
| `test/normalization.test.js` | `test/helpers/authenticated-game.js` | esm-reference | yes |
| `test/persistence.test.js` | `reference/phase4/sql-server-persistence.js` | esm-reference | yes |
| `test/phase3.test.js` | `server.js` | esm-reference | yes |
| `test/phase3.test.js` | `src/server/persistence/index.js` | esm-reference | yes |
| `test/qa-sql.test.js` | `scripts/setup-db.js` | esm-reference | yes |
| `test/qa-sql.test.js` | `src/server/persistence/integration-sql-persistence.js` | esm-reference | yes |
| `test/qa-sql.test.js` | `src/server/persistence/sql-connection.js` | esm-reference | yes |
| `test/qa-sql.test.js` | `test/helpers/qa.js` | esm-reference | yes |
| `test/qa-sql.test.js` | `test/helpers/authenticated-game.js` | esm-reference | yes |
| `test/qa-sql.test.js` | `server.js` | esm-reference | yes |
| `test/realtime.test.js` | `server.js` | esm-reference | yes |
| `test/realtime.test.js` | `src/server/persistence/index.js` | esm-reference | yes |
| `test/server.test.js` | `server.js` | esm-reference | yes |
| `test/server.test.js` | `src/server/persistence/index.js` | esm-reference | yes |
| `test/sql-integration.test.js` | `scripts/setup-db.js` | esm-reference | yes |
| `test/sql-integration.test.js` | `src/server/persistence/integration-sql-persistence.js` | esm-reference | yes |
| `test/sql-integration.test.js` | `src/server/persistence/sql-connection.js` | esm-reference | yes |
| `test/sql-integration.test.js` | `test/helpers/authenticated-game.js` | esm-reference | yes |
| `test/sql-integration.test.js` | `src/server/services/accounts.js` | esm-reference | yes |
| `test/xiangqi.test.js` | `src/shared/game/xiangqi.js` | esm-reference | yes |
| `vite.config.js` | `src/server/config.js` | esm-reference | yes |

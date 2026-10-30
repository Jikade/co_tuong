# Kiến trúc integration

Runtime chung là Node.js + Vite + WebSocket/WebRTC. Root `server.js` là CLI và export tương thích; `src/server/game-server.js` là chủ sở hữu duy nhất của phòng, đồng hồ và trận đấu; `src/shared/game/xiangqi.js` là bộ luật dùng chung trên server/client. Nhánh ứng dụng không chứa source/project .NET; không có backend phòng hay cơ chế realtime thứ hai.

Phase 2 là một lịch sử Git độc lập, Phase 3–4 phát triển tiếp trên đó. Phase 1 trước đây dùng Blazor/JWT/SignalR/EF; sản phẩm mới giữ một định danh và một chủ sở hữu state trong Node. Không cần SDK .NET để cài/build/test/deploy.

Nguồn C# gốc được bảo toàn trên nhánh Git `archive/phase1-dotnet-original` tại `d92474d`, đã loại khỏi cây ứng dụng. Nghiệp vụ tài khoản/xã hội nằm trong `src/server/services/accounts.js`, API trong `src/server/http/account-routes.js`, giao diện trong `src/client/account-ui.js`. RoomService được thay bằng các thao tác trên duy nhất Map phòng của server. Đối chiếu từng phần và kết quả mới tại [PHASE1_PARITY_MATRIX.md](PHASE1_PARITY_MATRIX.md), [MIGRATION_VALIDATION.md](MIGRATION_VALIDATION.md).

`passwords.js` giữ định dạng scrypt hiện tại và xác minh hash ASP.NET Identity V2/V3 để nâng an toàn khi login. Công cụ import offline map tài khoản SQL cũ vào đúng BIGINT gốc; mặc định chỉ đọc, không nhập tự động. Cơ chế credential duy nhất của sản phẩm vẫn là opaque session cookie, không nhận JWT/refresh token cũ.

`reset-mailer.js` cung cấp file outbox hoặc SMTP Node theo cùng config môi trường. SMTP hỗ trợ STARTTLS/implicit TLS, xác minh certificate/auth, timeout/retry có giới hạn; quên mật khẩu vẫn generic response, token một lần/15 phút/rate limit và session revocation. Không log transport errors chứa token/credentials. Mail thất bại sau retry làm token đó mất hiệu lực; chưa có durable background queue hoặc bằng chứng hộp thư thật.

Schema gốc database gồm 24 bảng và 5 view. `database/01_schema_phase1.sql` giữ nguyên chúng và thêm `yeu_cau_chong_lap`; `04_phase1_compat.sql` chuyển DDL cần thiết từ EF cũ thành migration idempotent, giữ dữ liệu. Phase 4 từng dùng hai bảng JSON bridge; adapter tham khảo có test vẫn giữ. Runtime dùng UUID hoặc ID import ổn định và mapping sang BIGINT gốc; snapshot/projection được ghi cùng transaction. Chi tiết trách nhiệm từng bảng trong INTEGRATION.md.

Xác thực dùng opaque session cookie có hash trong repository thay JWT/SignalR của Phase 1. HTTP và WebSocket cùng kiểm tra phiên ở server; client không tự chọn định danh hoặc tên hiển thị khi gửi action. Cookie dùng cùng origin qua Vite proxy khi dev và qua Node static hosting sau build. Đăng xuất/thu hồi phiên đóng socket ngay; hết hạn kiểm tra lại trên action và cleanup định kỳ.

HTTP framing/static hosting được tách vào `src/server/http/handler.js`; cookie/body/origin ở `http/request.js`; WebSocket handshake, JSON và xác thực socket ở `realtime/transport.js`. Các lớp transport chuyển action vào hàng đợi của game server, không giữ bản sao state phòng. `errors.js` giữ response HTTP `{error}` và WS `{type:'error',message,requestId?}`; lỗi nghiệp vụ như `invalid-move`, `chat-error`, `call-error` giữ nguyên contract.

Node, Vite và SQL adapters dùng `src/server/config.js`. Frontend chỉ import `src/client` hoặc `src/shared`; shared game không import Node/SQL/browser DOM. `scripts/check-architecture.js` xác minh ranh giới và link entrypoint; backend JavaScript chạy trực tiếp, không bundle kèm source tham khảo.

Phạm vi vận hành: một tiến trình game server cho một database. Nhiều worker cần cơ chế sở hữu phòng phân tán trước khi triển khai.

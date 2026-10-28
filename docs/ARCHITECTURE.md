# Kiến trúc integration

Runtime chung là Node.js + Vite + WebSocket. `server.js` là chủ sở hữu duy nhất của phòng, đồng hồ và trận đấu; `src/xiangqi.js` là bộ luật dùng chung trên server/client. Không chạy đồng thời RoomHub/RoomService của .NET.

Lý do: Phase 2 là một lịch sử Git độc lập, Phase 3–4 phát triển tiếp trên đó. Phase 4 đã có kiểm thử luật, reconnect, lịch sử, máy chơi, chat và signaling video. Phase 1 có một backend Blazor riêng với JWT/refresh cookie, EF Core và các API phòng riêng; giữ cả hai runtime sẽ cần đồng bộ hai chủ sở hữu phòng. Máy hiện có .NET 9, chưa có SDK 10 theo target của Phase 1. Chuyển nghiệp vụ tài khoản/xã hội sang Node giúp giữ một luồng realtime và một định danh người chơi, không phụ thuộc SDK thứ hai.

Nguồn C# gốc được bảo toàn trong `reference/phase1/` để đối chiếu; không nằm trong build/runtime Node. Nghiệp vụ tài khoản/xã hội được chuyển sang `src/accounts.js`, API trong `src/account-http.js`, giao diện trong `src/account-ui.js`. RoomService được thay bằng các thao tác trên duy nhất Map phòng của server, không khởi tạo lại một service phòng độc lập. Bằng chứng kiểm thử trong VALIDATION.md.

Schema gốc database gồm 24 bảng và 5 view. `database/01_schema_phase1.sql` giữ nguyên các bảng/view đó và thêm `yeu_cau_chong_lap`. Hai migration EF cuối chủ yếu sửa metadata quan hệ và đăng ký index; không tạo một schema game khác. Phase 4 dùng hai bảng JSON bridge vì playerId là chuỗi khách. Runtime integration dùng UUID tài khoản do server cấp và mapping sang BIGINT của schema gốc; snapshot phục hồi và projection bảng quan hệ được ghi cùng transaction. Chi tiết trách nhiệm từng bảng trong INTEGRATION.md.

Xác thực dùng opaque session cookie có hash trong repository thay JWT/SignalR của Phase 1. HTTP và WebSocket cùng kiểm tra phiên ở server; client không tự chọn định danh hoặc tên hiển thị khi gửi action. Cookie dùng cùng origin qua Vite proxy khi dev và qua Node static hosting sau build. Đăng xuất/thu hồi phiên đóng socket ngay; hết hạn kiểm tra lại trên action và cleanup định kỳ.

Phạm vi vận hành: một tiến trình game server cho một database. Nhiều worker cần cơ chế sở hữu phòng phân tán trước khi triển khai.

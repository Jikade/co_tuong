# Kiến trúc integration

Runtime chung là Node.js + Vite + WebSocket. `server.js` là chủ sở hữu duy nhất của phòng, đồng hồ và trận đấu; `src/xiangqi.js` là bộ luật dùng chung trên server/client. Không chạy đồng thời RoomHub/RoomService của .NET.

Lý do: Phase 2 là một lịch sử Git độc lập, Phase 3–4 phát triển tiếp trên đó. Phase 4 đã có kiểm thử luật, reconnect, lịch sử, máy chơi, chat và signaling video. Phase 1 có một backend Blazor riêng với JWT/refresh cookie, EF Core và các API phòng riêng; giữ cả hai runtime sẽ cần đồng bộ hai chủ sở hữu phòng. Máy hiện có .NET 9, chưa có SDK 10 theo target của Phase 1. Chuyển nghiệp vụ tài khoản/xã hội sang Node giúp giữ một luồng realtime và một định danh người chơi, không phụ thuộc SDK thứ hai.

Nguồn C# gốc được bảo toàn trong `reference/phase1/` để đối chiếu; không nằm trong build/runtime Node. Việc import nguồn này chưa đồng nghĩa nghiệp vụ đã được port. Các bước port và bằng chứng kiểm thử được ghi trong INTEGRATION.md khi hoàn tất.

Schema gốc database gồm 24 bảng và 5 view. `database/01_schema_phase1.sql` giữ nguyên các bảng/view đó và thêm `yeu_cau_chong_lap`. Hai migration EF cuối chủ yếu sửa metadata quan hệ và đăng ký index; không tạo một schema game khác. Phase 4 dùng hai bảng JSON bridge vì playerId là chuỗi khách. Runtime integration sẽ dùng định danh tài khoản đã xác thực và adapter dữ liệu thống nhất; snapshot phục hồi không được coi là hệ thống phòng thứ hai.

Phạm vi vận hành: một tiến trình game server cho một database. Nhiều worker cần cơ chế sở hữu phòng phân tán trước khi triển khai.

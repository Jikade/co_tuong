# Kết quả xác minh — 28/10/2026

Các kết quả dưới đây là mốc tích hợp `6da0a47`. Kết quả chạy lại trước/sau đợt chuẩn hóa JavaScript (68 Node + 3 SQL + 2 Edge) được ghi riêng trong [NORMALIZATION.md](NORMALIZATION.md).

Môi trường: Windows, Node.js v24.15.0, npm 11.12.1; SQL Server Express `.\SQLEXPRESS` với Windows Authentication qua sqlcmd; Microsoft Edge headless qua Playwright 1.64.1.

| Bước | Kết quả thực tế |
|---|---|
| Sau merge Phase 2 | 7/7 Node test; Vite build thành công |
| Sau merge Phase 3 | 18/18 Node test; Vite build thành công |
| Sau merge Phase 4 | 55/55 Node test; Vite build thành công |
| Runtime tích hợp, `npm.cmd test` | 61 test đạt, 3 SQL test được bỏ qua trong lệnh mặc định và chạy riêng bên dưới |
| `npm.cmd run test:sql` với RUN_SQL_TESTS=true | 3/3 đạt trên SQL Server thật |
| `npm.cmd run build` | Thành công: 8 module; frontend JS khoảng 59 kB, CSS khoảng 42 kB trước gzip |
| `npm.cmd run test:e2e` | 2/2 đạt bằng Edge; không có pageerror trong hai bài |
| Bootstrap schema chạy lặp | 24 bảng nền và 5 view, không tạo trùng; 1 bảng bổ sung Phase 1 và 7 bảng integration |
| `npm.cmd run dev` | Node 3001 và Vite 5173 khởi động; HTML/health proxy đạt; API chưa login trả 401; login cookie và WS có Origin qua Vite tạo phòng đúng tài khoản |

Các test deliberate persistence failure có in lỗi `Simulated ... failure`; assertion xác minh rollback và retry vẫn đạt, không phải lỗi test bị bỏ qua.

## Kịch bản đã chạy

- Hai tài khoản thật trên HTTP, cookie riêng, WebSocket riêng: tạo/join cùng mã, ready/start, board/deadline giống nhau; từ chối nước ngoài lượt; ba nước đi có một lần ăn quân.
- Ngắt socket A → paused → nối lại → tiếp tục đúng state; đóng và tạo lại server/persistence → giữ tài khoản/phiên, bàn cờ, lịch sử; B đầu hàng → RedWin; lịch sử và replay đọc qua HTTP có kiểm tra quyền.
- SQL query trực tiếp xác minh `tran_dau.ket_qua=RedWin`, `so_nuoc_di=3`, 3 dòng `nuoc_di_tran_dau`, một quân `da_bi_an=1`, tên Unicode tài khoản không lỗi.
- SQL stale writer bị từ chối bằng version, không để lại tài khoản insert một phần; friend request Accepted và reset một lần được lưu đúng, session cũ vô hiệu.
- Bảo vệ HTTP/WS chưa đăng nhập; từ chối giả playerId, Origin khác; outsider không xem replay của người khác; phiên hết hạn/thu hồi/logout/reset không tiếp tục dùng được.
- Kết bạn hai chiều không tạo duplicate pending; accept đúng người nhận; online presence; invite vào phòng private, thông báo và logout đóng socket.
- Chat chỉ hai người chơi nhận; khán giả bị từ chối; đổi cặp không lộ chat cũ; lấy ghế đối thủ; kick và cấm quay lại.
- Các test gốc về luật cờ, đồng hồ/hết giờ, hòa, disconnect timeout, cả hai disconnect, rematch, máy đi hợp lệ, phục hồi máy và lỗi lưu đều tiếp tục chạy.
- Edge desktop: đăng ký/login hai browser context, tạo/join/start, chọn quân/gợi ý/đi quân, nhận nước ở browser kia; chat; từ chối cuộc gọi rồi chấp nhận cuộc gọi WebRTC với media giả lập, trạng thái connected hai phía, bật/tắt micro, kết thúc cuộc gọi; reload trong trận, resign/replay/logout.
- Edge mobile 390×844: đăng ký/login, chơi với máy cầm Đen, máy Đỏ đi trước, gợi ý nước đi và không tràn ngang viewport.

Ảnh sau E2E: `test-results/integration-desktop.png`, `test-results/integration-mobile.png`. Trace lỗi được Playwright giữ nếu lần chạy có lỗi; artifacts không commit để tránh chứa cookie/phiên thử.

## Chưa xác minh

SMTP/email thật, camera vật lý, NAT/TURN ngoài Internet, adapter mssql bằng SQL login, build/test runtime .NET tham chiếu và vận hành nhiều worker. Đây không nằm trong các kết quả đạt bên trên.

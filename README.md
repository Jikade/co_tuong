# Cờ Tướng Trực Tuyến

Ứng dụng cờ tướng trực tuyến với máy chủ giữ trạng thái trận, đồng bộ WebSocket, khán giả chỉ xem, tự lưu nước đi và kiểm tra luật cờ tướng.

## Chạy trong môi trường phát triển

Cần Node.js 20 trở lên. Cài các gói phụ thuộc và chạy cả giao diện Vite lẫn máy chủ WebSocket:

```powershell
npm.cmd install
npm.cmd run dev
```

Mở địa chỉ Vite hiển thị trong terminal (mặc định `http://localhost:5173`). Máy chủ game chạy ở cổng `3001`.

Nhập tên hiển thị để tạo Room hoặc tham gia bằng mã 6 chữ số. Chủ Room và Đối thủ cần cùng chọn **Sẵn sàng**; Chủ Room chọn **Bắt đầu**. Sau khi hai đấu thủ nhận trạng thái bàn cờ ban đầu, hệ thống đếm ngược 3 giây rồi bắt đầu với bên Đỏ đi trước. Người thứ ba trở đi chỉ có thể xem trận.

Trạng thái Room và Match được tự động lưu trong `data/rooms.json`. Nước đi chỉ được lưu sau khi máy chủ xác nhận hợp lệ. Tải lại trang hoặc kết nối lại bằng cùng trình duyệt sẽ khôi phục Room gần nhất. Lịch sử, quân bị ăn, lượt, trạng thái chiếu và đồng hồ được đồng bộ cho cả hai đấu thủ và khán giả.

## Phase 3 – thời gian, mất kết nối và kết quả

- Mỗi lượt có 60 giây; cảnh báo khi còn 10 giây; hết giờ thì người đang đi thua do `timeout`. Nước đi sai không làm mới đồng hồ.
- Đầu hàng (`surrender`) và rời trận (`left-match`) đều cần xác nhận và tính thua ngay; quyền Chủ Room chuyển cho Đối thủ sau khi đã chốt kết quả.
- Xin hòa: chỉ tồn tại một yêu cầu chờ xử lý; đối thủ Chấp nhận thì trận hòa (`draw-agreed`), Từ chối thì trận tiếp tục.
- Mất kết nối ngoài ý muốn: trận chuyển sang `paused`, đồng hồ dừng và giữ nguyên số giây còn lại, giao diện hiển thị bộ đếm chờ 60 giây. Kết nối lại trong thời hạn thì trận tiếp tục từ đúng thời điểm dừng; quá hạn thì người mất kết nối thua (`disconnect-timeout`); cả hai cùng mất kết nối thì trận bị hủy kết quả (`system-error`, `Voided`).
- Sau khi trận kết thúc, kết quả được lưu thành một bản ghi riêng trong `data/matches.json`, trạng thái Sẵn sàng của hai người chơi được đặt lại và có thể bắt đầu trận mới với mã Match mới trong cùng Room. Lịch sử trận cũ không bị ghi đè.
- Giao diện có mục **Xem lại trận đã chơi**: danh sách trận (đối thủ, màu quân, kết quả, lý do, thời gian) và chế độ xem lại từng nước với các nút nước đầu, nước trước, nước tiếp theo, nước cuối. Bàn cờ ở chế độ xem lại chỉ đọc.

Máy chủ cung cấp thêm hai endpoint đọc dữ liệu lịch sử:

```text
GET /api/history?playerId=<id>   -> { matches: [...] }
GET /api/matches/<matchId>       -> chi tiết trận kèm thế cờ ban đầu và danh sách nước đi
```

## Kiểm tra

```powershell
npm.cmd test
npm.cmd run build
```

## Triển khai

Build giao diện bằng `npm.cmd run build`; chạy giao diện build bằng `npm.cmd run preview` và máy chủ bằng `npm.cmd run server`. Khi giao diện và máy chủ không cùng host/cổng, đặt `VITE_WS_URL` thành địa chỉ WebSocket công khai (ví dụ `wss://game.example.com/ws`) trước khi build, đồng thời cấu hình reverse proxy TLS tới cổng `3001`.

Phiên bản này dùng tên hiển thị khách và mã Room; đăng ký/đăng nhập, danh sách Room công khai và mời bạn bè thuộc phạm vi Phase 1 chưa được triển khai.

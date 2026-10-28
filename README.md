
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

## Kiểm tra

```powershell
npm.cmd test
npm.cmd run build
```

## Triển khai

Build giao diện bằng `npm.cmd run build`; chạy giao diện build bằng `npm.cmd run preview` và máy chủ bằng `npm.cmd run server`. Khi giao diện và máy chủ không cùng host/cổng, đặt `VITE_WS_URL` thành địa chỉ WebSocket công khai (ví dụ `wss://game.example.com/ws`) trước khi build, đồng thời cấu hình reverse proxy TLS tới cổng `3001`.

Phiên bản này dùng tên hiển thị khách và mã Room; đăng ký/đăng nhập, danh sách Room công khai và mời bạn bè thuộc phạm vi Phase 1 chưa được triển khai.

Yêu cầu chức năng gốc: [docs/ORIGINAL_REQUIREMENTS.md](docs/ORIGINAL_REQUIREMENTS.md).

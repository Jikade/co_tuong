# Bố cục màn chơi theo ảnh tham chiếu

## Thay đổi

- Bỏ card phòng ngang toàn màn hình và bỏ JavaScript chuyển hai ghế vào header.
- Dùng Grid cho năm vùng Desktop: người chơi trái, scene cờ, đối thủ thấp bên phải, thanh icon, dock panel. `play-column`/`room-panel` giữ ID và vai trò tổ chức DOM, không tạo thêm hàng/card.
- Mã phòng/copy/chia sẻ, trạng thái kết nối và các nút ready/start/settings/leave ở góc phải. Tên phòng nhỏ dưới người chơi trái. Tài khoản/bạn bè/đăng xuất vẫn truy cập được ở góc trái.
- `arena.css` là module bố cục màn chơi mới; xóa 338 dòng bố cục ghi đè cũ và rule tablet ép chiều cao Chat `!important`.
- `fitScene()` scale toàn bộ scene 740×740 theo chiều rộng và chiều cao khả dụng, không thay kích thước riêng canvas/quân. Desktop dành cột dock cố định, mở/đóng Chat/Video không làm bàn cờ co lại hoặc đổi vị trí.
- Chat trên, Video dưới khi mở đồng thời. Chỉ danh sách tin nhắn cuộn; dock không có scrollbar lồng nhau. Video đủ chỗ cho camera/micro/end, kể cả đang kết nối.
- Tablet đưa panel xuống dưới; mobile dùng hàng người chơi gọn, bàn cờ rộng gần toàn viewport và thanh công cụ ngang. Mobile cho cuộn dọc tự nhiên, chỉ cắt phần trang trí thừa theo chiều ngang.

## Đo trực tiếp trong Edge

| Chỉ số | Trước (1824×862) | Sau (1824×862) |
|---|---:|---:|
| Chiều rộng khung bàn cờ | 347.24 px | 477.34 px (**+37.5%**) |
| Chiều rộng scene đồng bộ | 551.41 px | 758 px |
| Khung thông tin phòng | 1776×164.59 px, trải ngang | 460×82 px, góc phải |
| Vị trí avatar | Cùng header | Hai bên bàn, đối thủ thấp hơn |
| Trang Desktop | Header đẩy scene xuống | Scroll width/height = 1824×862 |

Ở 1694×900, khung bàn cờ rộng 496.23 px, chiều cao trang đúng 900 px, không tràn ngang. Test xác nhận kích thước và vị trí bàn không đổi giữa đóng panel, chỉ Chat, chỉ Video và Chat + Video. Khung hình/quân cờ có cùng hệ số scale.

## Ảnh thực tế

- [Desktop 1824×862, đang chơi, Chat + Video](screenshots/room-desktop.png)
- [Mobile 390×844, ảnh full page 390×971](screenshots/room-mobile.png)

Các ảnh bổ sung do E2E tạo tại `artifacts/layout/`: waiting/playing/finished/chat/video/call ở cả 1824×862 và 1694×900, tablet 1024×768, mobile có panel. Thư mục artifacts được ignore; hai ảnh bàn giao trên được lưu trong repository.

Đã mở và so sánh trực quan ảnh chờ đối thủ, đang chơi, kết thúc, chỉ Chat, chỉ Video, cả Chat/Video, tablet và mobile với ảnh tham chiếu. Avatar dùng chữ cái/placeholder hiện có và tên từ tài khoản thật của phiên test; không chèn ảnh chân dung hoặc tên giả vào code ứng dụng.

## Kiểm thử

- `npm.cmd test`: **68 PASS**, 3 SQL test skip theo cấu hình mặc định hiện có.
- `npm.cmd run build`: kiểm tra backend và build Vite **PASS**; frontend build lại sau điều chỉnh cuối **PASS**.
- `npm.cmd run test:e2e`: **4/4 PASS**. Hai bài chức năng gốc không bị sửa, hai bài layout mới kiểm tra cả hai viewport tham chiếu, các trạng thái/panel, WebRTC với camera/micro giả lập khi Chat và Video cùng mở, không cắt controls, mobile/tablet.
- Các bài gốc vẫn kiểm tra hai người chơi, click tọa độ canvas sau scale, gợi ý nước đi, chat, cuộc gọi/reject/accept/micro, reload/reconnect, resign, history/replay/logout, AI cầm Đen và không tràn ngang mobile.
- So sánh ID trong HTML: giữ toàn bộ ID gốc, không trùng ID. CSS native scene/moon/frame/canvas/pieces giữ nguyên nội dung. Backend, engine shared, schema và dependencies không đổi; không chạy migration hay sửa dữ liệu SQL cho tác vụ bố cục.
- Dev đang phục vụ bản mới tại http://localhost:5173; HTML/CSS/backend health đều HTTP 200. Không khởi động lại backend hoặc sửa tài khoản của người đang test.

## File sửa

`index.html`, `src/client/main.js`, `src/client/styles/main.css`, `src/client/styles/arena.css` (mới), `e2e/layout.spec.js` (mới), `.gitignore`, tài liệu này và hai screenshot.

## Khác biệt còn lại so với ảnh mẫu

- Dùng avatar chữ cái/placeholder có sẵn; ảnh mẫu có chân dung minh họa và họa tiết mây riêng. Không tạo/ghép asset mới hoặc hard-code ảnh/tên người chơi.
- Dùng icon Khán giả đang có; không thêm Bảng xếp hạng giả vì ứng dụng chưa hỗ trợ chức năng đó.
- Giữ thêm nút tài khoản/đăng xuất nhỏ để không mất chức năng. Kích thước scene phụ thuộc chiều cao thực tế; tại 1824×862 ưu tiên giữ cả bàn/nền/pedestal và trạng thái trong viewport thay vì ép đúng hệ số 1.5.
- Mobile/tablet ưu tiên tương tác và cho panel nằm dưới; không giữ năm cột trên điện thoại. Camera vật lý/NAT/TURN chưa được xác minh trong tác vụ layout.

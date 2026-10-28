
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

## HTTPS development on an iPhone over the LAN

Camera and microphone access requires a secure browser context. For local development, use `mkcert` to create a certificate trusted by your development PC and install its root certificate on the iPhone. Do not proceed through a browser certificate warning.

1. Install `mkcert` from [its official project](https://github.com/FiloSottile/mkcert) and connect the PC and iPhone to the same trusted Wi-Fi network. Allow inbound connections to ports 5173 and 3001 in the PC firewall.
2. In PowerShell at the project root, create a certificate for the PC's current LAN IP (replace `192.168.1.10` if the IP changes):

   ```powershell
   New-Item -ItemType Directory -Force certs
   mkcert -install
   mkcert -cert-file certs/lan.pem -key-file certs/lan-key.pem 192.168.1.10 localhost 127.0.0.1 ::1
   $env:TLS_CERT_FILE = (Resolve-Path certs/lan.pem).Path
   $env:TLS_KEY_FILE = (Resolve-Path certs/lan-key.pem).Path
   npm.cmd run dev
   ```

   Vite serves HTTPS on port 5173 and the Node API/WebSocket server serves HTTPS/WSS on port 3001 using the same certificate. The `certs/` folder is git-ignored. If only one TLS environment variable is set, startup fails with a clear error. Without these variables, the existing HTTP development mode remains available.
3. On the iPhone, transfer **only** `rootCA.pem` from the folder printed by `mkcert -CAROOT` (AirDrop is supported). Never transfer `rootCA-key.pem`. Open the CA certificate on the iPhone, install its downloaded configuration profile in Settings, then go to **Settings > General > About > Certificate Trust Settings** and enable full trust for that root certificate. iOS does not automatically trust a manually installed root certificate; follow [Apple's certificate trust steps](https://support.apple.com/en-us/102390).
4. Open `https://192.168.1.10:5173/` on iPhone Safari and `https://localhost:5173/` on the development PC. The app derives `wss://<current-hostname>:3001/ws` (and HTTPS API URLs) from the page hostname. If `VITE_WS_URL` is set, it still overrides the default; for an HTTPS page, configure it with a `wss://` URL.

If camera or microphone access fails, the app now distinguishes an insecure page, unsupported media API, denied permission, unavailable/busy device, and WebRTC negotiation/connection failure. A successful local HTTPS setup does not verify that camera permissions or peer connectivity work on a particular iPhone; test a call with two actual devices.

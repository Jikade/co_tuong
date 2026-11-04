# PHASE 4 — Bản đồ code Chat, Video Call và Chơi với máy

Bản đồ này phản ánh source hiện tại. Số dòng là số dòng trong file lúc lập báo cáo. Chỉ tạo báo cáo này; không sửa source.

## Tóm tắt kiến trúc

- Client JavaScript ở `src/client`; Node.js sở hữu state phòng và trận ở `src/server/game-server.js`.
- WebSocket JSON chở actions/events; cùng kênh chuyển signaling WebRTC. Media truyền trực tiếp giữa trình duyệt.
- Luật cờ ở `src/shared/game/xiangqi.js`, được dùng chung phía browser/server.
- Match history đi qua `services/history-store.js`; room snapshot lưu room và chat.

## A. Chat Realtime

### Cấu trúc thư mục

- `src/client/main.js` — UI/state, gửi action, nhận `chat-message` và `chat-history` (85–86, 137, 453–730, 759–820, 1461–1471).
- `index.html` — panel và form chat (165–174).
- `src/server/game-server.js` — phân quyền, recipient, lịch sử, persistence (1081–1090, 1204–1237, 1338–1390, 1604, 1717, 1772, 1853–1854).
- `src/server/realtime/transport.js` — nhận JSON WS và gọi handler (24–68).
- `src/server/persistence/*` — adapters room snapshot; `src/server/persistence/index.js` chọn adapter.

### Bảng chức năng

| File | Hàm/Event | Vai trò | Mức độ quan trọng |
| --- | --- | --- | --- |
| `index.html` | `#chat-form`, `#chat-messages`, `#chat-status` | Khung giao diện và input tối đa 1000 ký tự | Hỗ trợ |
| `src/client/main.js` | submit (1461–1471), `sendAction` (389–397), `handleServerMessage` (453–730) | Chỉ gửi với role người chơi; nhận tin/lịch sử và chỉ render nếu room code còn khớp | Chính/Giao tiếp |
| `src/client/main.js` | `getMyRole/privateRole` (731–758), `appendChatMessage/renderPrivatePanels` (759–820) | Xác định host/opponent/spectator; spectator không gửi chat | Chính |
| `src/server/realtime/transport.js` | socket message (56–68) | Parse JSON, chuyển lỗi framing/action; không xử lý nghiệp vụ chat | Giao tiếp |
| `src/server/game-server.js` | `privatePlayerSockets` (1081–1090), dispatch (1775–1875) | Chỉ chấp nhận kết nối hiện hành trong room và hai ghế chơi | Chính/Bảo vệ truy cập |
| `src/server/game-server.js` | `chatSend/sendChatHistory` (1204–1237) | Validate, gắn sender và cặp ID, giữ 100 tin, persist trước khi gửi cho đúng hai socket | Chính/Lưu trữ |
| `src/server/game-server.js` | join/leave/changeSeat/removeParticipant (1147–1159, 1343–1390, 1689–1772) | Tải history khi join/đổi ghế; lọc theo cặp người chơi hiện tại | Chính |
| `src/server/game-server.js` | `serializeRoom/persistRooms/loadRooms` (226–238, 764–817) | Nhúng chat vào room snapshot và phục hồi lúc khởi động | Lưu trữ |
| `src/server/persistence/*` | `rooms.loadAll/saveAll` | Snapshot file hoặc SQL | Lưu trữ |

### Luồng hoạt động

Submit form → `sendAction('chat-send',{text})` → transport parse WS JSON, đưa vào `dispatch` → `chatSend` tra room từ socket (không nhận room do client chỉ định), xác minh bằng `privatePlayerSockets`; spectator, socket cũ hoặc thiếu đối thủ bị từ chối → trim và kiểm tra độ dài 1000 → tạo payload gồm sender, timestamp và cặp participant IDs → append buffer tối đa 100, `persistRooms()` rồi mới gửi cho sender và opponent → client nhận `chat-message`, xác minh room code và render; tăng unread khi panel đóng.

Khi join hoặc đổi ghế, `sendChatHistory` chỉ gửi history gắn với đúng cặp ID hiện tại; spectator nhận mảng rỗng. Khi phòng đóng/hết hạn/rời hoặc đổi phòng, client xóa chat hiển thị. Disconnect không xóa history; reconnect/join lấy lại phần history của cặp ghế hiện tại.

### Thứ tự nên học

1. `index.html` 165–174
2. `src/client/main.js` 389–397, 731–820, 1461–1471, sau đó 453–730
3. `src/server/realtime/transport.js` 24–68
4. `src/server/game-server.js` 1081–1090, 1204–1237, 1343–1390, 1689–1875
5. `serializeRoom/loadRooms` và persistence adapter

### Công nghệ

DOM/HTML form và WebSocket JSON ở client; package `ws` ở transport; Map RAM, room snapshot adapter file/SQL ở backend.

## B. Video Call

### Cấu trúc thư mục

- `index.html` 94, 159, 176–190 — incoming call, panel, video và controls.
- `src/client/main.js` 91–103, 136, 675–730, 773–926, 1473–1511 — state, WS events, PeerConnection và actions.
- `src/client/call-media.js` 1–84 — quyền thiết bị, toggle track, cleanup.
- `src/server/game-server.js` 1081–1138, 1239–1313, 1856–1872 — quyền, call lifecycle, signaling relay.
- `src/server/realtime/transport.js` 24–68 — WebSocket.

### Bảng chức năng

| File | Hàm/Event | Vai trò | Mức độ quan trọng |
| --- | --- | --- | --- |
| `index.html` | incoming-call, `#call-panel`, video/control | UI nhận/từ chối/kết thúc cuộc gọi | Hỗ trợ |
| `src/client/main.js` | handlers 1473–1511; `renderPrivatePanels` 773–820 | Trạng thái gọi/nhận/kết nối, enable theo đối thủ online | Chính |
| `src/client/call-media.js` | `acquireCallMedia` (1–37) | Xin getUserMedia cho audio/video riêng; tiếp tục nếu một loại thiết bị hoạt động | Chính |
| `src/client/call-media.js` | toggle/render/release (39–84) | Bật tắt track, đóng PC, dừng stream và gỡ video srcObject | Hỗ trợ |
| `src/client/main.js` | `ensurePeerConnection/flushIceCandidates/handleCallSignal` (858–925) | Tạo PC, trao đổi SDP và queue ICE trước remote description | Chính/Giao tiếp |
| `src/server/game-server.js` | `privatePlayerSockets/startCall/acceptCall/timeoutCall/clearCall/endCall` (1081–1112, 1239–1313) | Chỉ hai ghế; tối đa call đơn theo room; timeout mặc định 60 giây; Map RAM | Chính |
| `src/server/game-server.js` | `forwardSignal` (1117–1138), dispatch (1856–1872) | Kiểm tra callId, thành viên, payload/kích thước rồi relay đến peer | Giao tiếp |
| `src/server/realtime/transport.js` | WS JSON (24–68) | Kênh signaling, không chở media | Giao tiếp |

### Luồng hoạt động

Caller gửi `call-start` → backend xác thực room/ghế; nếu room chưa có call, tạo trạng thái ringing, timer 60s, trả `call-started` và gửi `call-incoming` đến đối thủ. Callee chấp nhận → client xin quyền media rồi gửi `call-accept`; server chuyển active và báo cả hai. Caller tạo `RTCPeerConnection`, offer và gửi `call-offer`. Callee đặt remote description, flush ICE đang chờ, tạo answer và gửi `call-answer`. ICE candidates gửi bằng `call-ice-candidate`; server relay WebSocket. Media kết nối trực tiếp peer-to-peer.

Từ chối, timeout khi đang ringing, kết thúc hoặc disconnect người chơi đều clear call và thông báo peer nếu còn socket. Client cleanup đóng PC và dừng tracks. Mỗi room chỉ giữ một call trong Map. Call state không persistent nên mất khi server restart. Không thấy timeout call sau khi đã active.

### Thứ tự nên học

1. `index.html` 94, 176–190
2. `src/client/main.js` 773–925, 1473–1511
3. `src/client/call-media.js` 1–84
4. `src/server/realtime/transport.js` 24–68
5. `src/server/game-server.js` 1081–1138, 1239–1313, dispatch 1856–1872

### Công nghệ

`navigator.mediaDevices.getUserMedia`, `MediaStream` tracks, `RTCPeerConnection`, SDP offer/answer, ICE ở client; WebSocket JSON qua package `ws` làm signaling. Không thấy SFU/TURN/media server trong source.

## C. Chơi cờ với máy

### Cấu trúc thư mục

- `index.html` 48–58, 80 — chọn bên và thoát.
- `src/client/main.js` 97–100, 453–490, 1031–1058, 1230–1250, 1435–1449, 1569–1580 — UI/state/move.
- `src/server/game-server.js` 240–378, 412–764, 1775–1875, 1900–1910 — logic máy, persistence/recovery, dispatch.
- `src/shared/game/xiangqi.js` 13–162 — luật cờ.
- `src/server/services/history-store.js` 1–90 — lưu/truy vấn records.
- `src/server/http/handler.js` 23–40 — history/replay HTTP.
- `src/server/persistence/persistence-port.js`, `file-persistence.js`, `integration-sql-persistence.js`, `index.js` — adapters.

### Bảng chức năng

| File | Hàm/Event | Vai trò | Mức độ quan trọng |
| --- | --- | --- | --- |
| `src/client/main.js` | `startComputerGame` (1435–1449), click handlers (1569–1580) | Gửi `computer-start` với lựa chọn red/black | Chính/Giao tiếp |
| `src/client/main.js` | handler 453–490; `renderComputerRoom` 1031–1058; `handleCell` 1230–1250 | Nhận state/move, hiển thị máy đang đi, gửi human move | Chính |
| `src/server/game-server.js` | `startComputerMatch/resumeComputerMatch/computerMove` (520–719) | Tạo/resume trận, xác thực lượt/deadline/nước đi và xác nhận move | Chính |
| `src/server/game-server.js` | `scheduleComputerTurn/playComputerTurn` (437–518) | Sinh legal moves, chọn ngẫu nhiên bằng `randomInt(length)`, áp dụng và broadcast | Chính |
| `src/shared/game/xiangqi.js` | `createInitialPieces/applyLegalMove/getLegalMoves/hasLegalMove/getTurnStatus/isInCheck` (13–162) | Luật chung, legal move, chiếu tướng và chiếu bí | Chính/Hỗ trợ |
| `src/server/game-server.js` | `scheduleComputerHumanTurn/finishComputerMatch` (377–436) | Đồng hồ lượt người mặc định 60s, timeout và kết quả | Chính |
| `src/server/game-server.js` | record/persist/snapshot/restore (240–378, 740–762) | Lưu trạng thái và khôi phục ván active sau restart | Lưu trữ |
| `src/server/services/history-store.js` | `append/save/load/list/findActiveComputerMatch/find` (37–90) | Match records, lịch sử và ván máy active | Lưu trữ |
| `src/server/http/handler.js`, `main.js` | `GET /api/history`, open/load replay (handler 23–40; client 1374–1428) | Tải danh sách và record để replay | Giao tiếp/Lưu trữ |
| `src/server/persistence/*` | rooms/matches load/save/upsert | Backend persistence tùy cấu hình | Lưu trữ |

### Luồng hoạt động

Chọn màu → client gửi `computer-start` → backend xác thực identity/side và tình trạng socket; nếu đã có ván active thì resume → tạo board, đỏ đi trước, persist snapshot. Nếu người đi trước, khởi động timer 60 giây; nếu máy đi trước, schedule máy.

Người chọn ô đích → client gửi `computer-move` → server xác minh socket/match, lượt, deadline và luật bằng shared `applyLegalMove` → ghi history, persist, broadcast state → sau delay mặc định 180ms máy gọi `getLegalMoves`, chọn ngẫu nhiên, áp luật, persist và broadcast. `getTurnStatus` phát hiện check/checkmate hoặc hết legal move. Hết timer thì người thua; resign cũng kết thúc trận.

Client giữ `xiangqi.computerMatchId` trong localStorage. Server lưu mode, pieces, history và deadline; lúc khởi động `restoreComputerMatches` phục hồi record đang chơi rồi lên lịch lượt tương ứng. Khi kết thúc, lịch sử qua `GET /api/history`; client tải record replay qua `GET /api/matches/:id` và tái dựng từ initial pieces/moves.

### Thứ tự nên học

1. `index.html` 48–58
2. `src/client/main.js` 1435–1449, 1230–1250, 453–490, 1031–1058
3. `src/shared/game/xiangqi.js` 13–162
4. `src/server/game-server.js` 520–719
5. `src/server/game-server.js` 377–518
6. `computerMatchRecord/restore`, `history-store.js`, adapter
7. `src/server/http/handler.js` và client 1374–1428

### Công nghệ

JavaScript ES modules; `node:crypto` `randomUUID/randomInt`; Node timers; shared Xiangqi rules; WebSocket JSON; localStorage chỉ giữ match ID; HTTP JSON API; file JSON hoặc SQL Server adapter. `turnSeconds` mặc định 60 và `computerMoveDelayMs` mặc định 180 ở `game-server.js` dòng 120–140.

## Phân loại file tổng hợp

| Nhóm | File | Chức năng |
| --- | --- | --- |
| Chính | `src/client/main.js` | UI/state và ba luồng ở browser |
| Chính | `src/server/game-server.js` | Chủ sở hữu room/chat/call/computer match |
| Chính/Hỗ trợ | `src/shared/game/xiangqi.js` | Luật cờ dùng chung |
| Hỗ trợ | `index.html`, `src/client/call-media.js` | Markup và media helper |
| Giao tiếp | `src/server/realtime/transport.js` | WS JSON cho chat, signaling, actions |
| Giao tiếp | `src/server/http/handler.js` | HTTP history/replay |
| Lưu trữ | `src/server/services/history-store.js` | Match record/history queries |
| Lưu trữ | `src/server/persistence/persistence-port.js`, `file-persistence.js`, `integration-sql-persistence.js`, `index.js` | Adapters; room snapshot chứa chat, match record chứa ván máy |

## Ghi chú về mức độ triển khai

- Chat persistence theo room snapshot, tối đa 100 tin; chỉ trả tin có đúng cặp participant đang ngồi hai ghế. Khi thay người, tin của cặp cũ bị lọc khỏi history hiện tại.
- Call timeout 60 giây chỉ cho lúc ringing; active call không có giới hạn thời lượng trong source. Call metadata/signaling state không bền qua restart.
- Máy chọn ngẫu nhiên trong tập nước hợp lệ; không thấy thuật toán tìm kiếm/đánh giá chiến thuật.
- Đồng hồ 60 giây là mặc định server, có thể thay bằng option `createGameServer`.

## Danh sách học nhanh

- **Chat Realtime:** `index.html` → `src/client/main.js` → `src/server/realtime/transport.js` → `src/server/game-server.js` → room persistence adapter.
- **Video Call:** `index.html` → `src/client/main.js` → `src/client/call-media.js` → `src/server/realtime/transport.js` → `src/server/game-server.js`.
- **Chơi với máy:** `index.html` → `src/client/main.js` → `src/shared/game/xiangqi.js` → `src/server/game-server.js` → `src/server/services/history-store.js` → persistence adapter → `src/server/http/handler.js`.
- **Thứ tự toàn Phase 4:** UI và `sendAction/handleServerMessage` → WS transport → nghiệp vụ backend và quyền → shared rules → persistence/history → media/replay helpers.

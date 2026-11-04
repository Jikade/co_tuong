# Hướng dẫn luồng code Phase 4

Tài liệu này mô tả luồng đang có trong source. WebSocket vận chuyển JSON cho action và event; phần xác thực nghiệp vụ nằm trong game server. Với video, WebSocket chỉ chuyển tín hiệu WebRTC, còn media do hai trình duyệt trao đổi qua `RTCPeerConnection`.

## A. Chat Realtime

### Luồng gửi tin

```text
Người chơi nhập và submit
  → src/client/main.js: chatForm submit
  → sendAction('chat-send', { text })
  → src/server/realtime/transport.js: socket message, JSON.parse
  → src/server/game-server.js: dispatch action chat-send → chatSend(socket, message)
  → kiểm tra socket/room/ghế người chơi, nội dung và giới hạn 1000 ký tự
  → thêm senderId, senderName, sentAt, participantIds vào payload
  → chatHistoryByRoom (tối đa 100 tin) → persistRooms()
  → gửi chat-message cho socket người gửi và socket đối thủ
  → src/client/main.js: handleServerMessage → appendChatMessage
```

`sendAction` chỉ vận chuyển action; server xác định phòng từ socket hiện tại và dùng `privatePlayerSockets` để chỉ cho hai ghế người chơi gửi. Tin được persist trước khi gửi cho hai bên; nếu persistence lỗi, history trong bộ nhớ được khôi phục về danh sách trước đó.

### Tải lại lịch sử

```text
Join / đổi ghế / kết nối lại
  → game-server.js: sendChatHistory(room)
  → lọc theo participantIds khớp đúng hai người đang ở hai ghế
  → WebSocket event chat-history
  → main.js: thay nội dung danh sách chat
```

Khán giả không được nhận lịch sử chat. `serializeRoom` đưa lịch sử chat vào room snapshot; `src/server/persistence/index.js` chọn memory, file hoặc SQL adapter. File adapter ghi snapshot JSON thay thế file cũ; SQL adapter lưu trạng thái theo cấu hình SQL Server. Client chỉ hiển thị event nếu room code còn khớp với phòng hiện hành.

### Các điểm nên đọc

- `src/client/main.js`: `chatForm` submit, `sendAction`, `handleServerMessage`, `appendChatMessage`.
- `src/server/realtime/transport.js`: listener `socket.on('message')`.
- `src/server/game-server.js`: dispatch `chat-send`, `chatSend`, `sendChatHistory`, `serializeRoom`/`persistRooms`.
- `src/server/persistence/index.js` và adapter đang chọn: lưu/đọc room snapshot.

## B. Video Call

### Luồng thiết lập cuộc gọi

```text
Caller bấm gọi
  → main.js: callStartButton
  → sendAction('call-start') qua WebSocket
  → transport.js parse JSON → game-server.js: startCall
  → kiểm tra caller là người chơi trong phòng, tạo callId + trạng thái ringing + timer
  → gửi call-incoming cho callee
  → Callee bấm nhận
  → main.js: acquireCallMedia (call-media.js)
  → getUserMedia(audio), getUserMedia(video) → ghép MediaStream
  → ensurePeerConnection: tạo RTCPeerConnection, addTrack(localStream)
  → call-accept → server chuyển call sang active và báo call-accepted cho hai phía
  → Caller tạo SDP Offer, setLocalDescription, gửi call-offer qua WebSocket
  → Server forwardSignal chuyển description đến callee
  → Callee setRemoteDescription(Offer), tạo SDP Answer, setLocalDescription
  → call-answer qua WebSocket → Server chuyển đến caller → caller setRemoteDescription(Answer)
```

`getUserMedia` yêu cầu trình duyệt cấp quyền thiết bị. Audio và video được xin riêng; nếu một loại không hoạt động nhưng loại kia có track thì cuộc gọi vẫn có thể tiếp tục. `MediaStream` cục bộ vừa gắn vào video preview vừa cung cấp track cho `RTCPeerConnection`.

### ICE và media

```text
RTCPeerConnection.onicecandidate
  → call-ice-candidate qua sendAction/WebSocket
  → game-server.js: forwardSignal kiểm tra callId/quyền/kích thước rồi relay đến peer
  → handleCallSignal → addIceCandidate
  → ICE thương lượng đường kết nối; ontrack gắn stream đối phương vào remoteVideo
```

ICE Candidate mô tả thông tin đường mạng mà WebRTC cần để kết nối. Candidate đến trước SDP remote được giữ trong `pendingCandidates`; `flushIceCandidates` thêm chúng sau khi `remoteDescription` đã có. Source cấu hình STUN Google trong `ensurePeerConnection`; signaling đi qua WebSocket của server, còn audio/video không đi qua server ứng dụng.

### Từ chối, timeout, kết thúc

- Lời mời có thể bị từ chối hoặc hết thời hạn phía server; server xóa trạng thái call và gửi event kết thúc tương ứng.
- Khi một người kết thúc, client gửi `call-end`; `endCall` kiểm tra quyền rồi clear call và báo peer.
- Client gọi `releaseCallResources`: đóng peer connection, dừng các `MediaStreamTrack`, xóa `srcObject` và UI call.
- Trạng thái call/signaling nằm trong bộ nhớ server; source không ghi call vào persistence.

### Các điểm nên đọc

- `src/client/main.js`: call button handlers, nhánh `call-*` của `handleServerMessage`, `ensurePeerConnection`, `handleCallSignal`, `cleanupCall`.
- `src/client/call-media.js`: `acquireCallMedia`, `releaseCallResources`, bật/tắt track.
- `src/server/realtime/transport.js`: WebSocket message handler.
- `src/server/game-server.js`: `startCall`, `acceptCall`, `endCall`, `forwardSignal` và dispatch `call-*`.

## C. Chơi với máy

### Khởi tạo trận và lượt người chơi

```text
Chọn màu ở giao diện
  → main.js: startComputerGame(side)
  → sendAction('computer-start', { playerId, displayName, side })
  → transport.js parse JSON → game-server.js: startComputerMatch
  → resume ván active nếu HistoryStore có; nếu không, tạo match mới
  → createInitialPieces + chọn humanSide/computerSide + đặt lượt/thời gian
  → persistComputerMatch / history store → gửi computer-state
  → người chơi chọn quân và ô đích: main.js handleCell
  → gửi computer-move { matchId, playerId, requestId, pieceId, to }
  → game-server.js: computerMove kiểm tra match, chủ sở hữu, lượt, deadline và request
  → shared/game/xiangqi.js: applyLegalMove kiểm tra luật
  → ghi move, cập nhật quân/lượt/trạng thái, persist và broadcast computer-state
```

Trạng thái trận máy do server làm chủ. Client gửi ý định nước đi, còn server mới là nơi xác nhận tính hợp lệ. `applyLegalMove` trả về trạng thái quân mới hoặc `null`; hàm này được chia sẻ giữa client và server để áp dụng cùng một bộ luật Xiangqi.

### Lượt máy, đồng hồ và kết thúc

```text
Sau nước người chơi, lượt chuyển sang máy
  → scheduleComputerTurn đặt Timer và token theo match + số nước
  → playComputerTurn lấy getLegalMoves(pieces, computerSide)
  → randomInt(length) chọn một nước trong tập hợp hợp lệ
  → applyLegalMove → ghi lịch sử → persist → broadcast computer-state
  → đặt lại thời gian lượt người chơi và scheduleComputerHumanTurn
```

`getLegalMoves` thử các đích bằng `applyLegalMove`, do đó lựa chọn ngẫu nhiên bị giới hạn trong các nước hợp lệ. Timer lượt người chơi và timer máy được quản lý phía server; trạng thái nước đi/thời gian được lưu trong record. Khi hết giờ, chiếu bí hoặc không còn nước hợp lệ, server kết thúc trận và lưu kết quả.

### Lưu, khôi phục và replay

```text
Kết quả/lượt đi
  → game-server.js persistComputerMatch
  → HistoryStore (services/history-store.js)
  → match repository được persistence adapter cung cấp

Server khởi động
  → restoreComputerMatches đọc activeComputerMatches
  → nạp lại Map trận máy và đặt timer theo currentSide

Người chơi mở lịch sử
  → main.js openHistory → GET /api/history
  → http/handler.js gọi history.list(playerId) và trả danh sách tóm tắt
  → chọn trận → GET /api/matches/:id → history.find(id) trả record
  → main.js loadReplay/enterReplay/replayPieces dựng bàn cờ từ initialPieces + moves
```

`HistoryStore` tuần tự hóa upsert qua một Promise queue và cung cấp truy vấn lịch sử, ván máy active, record theo ID. `src/server/persistence/index.js` chọn memory/file/SQL; vì vậy độ bền sau restart tùy backend đang cấu hình. Phía client lưu ID ván đang chơi trong localStorage để nhận diện phiên, còn nội dung trạng thái ván được server/history lưu.

### Các điểm nên đọc

- `src/client/main.js`: `startComputerGame`, `handleCell`, nhánh `computer-state`, `openHistory`, `loadReplay`.
- `src/shared/game/xiangqi.js`: `createInitialPieces`, `applyLegalMove`, `getLegalMoves`, `getTurnStatus`.
- `src/server/game-server.js`: `startComputerMatch`, `computerMove`, `scheduleComputerTurn`, `playComputerTurn`, `restoreComputerMatches`.
- `src/server/services/history-store.js`, `src/server/persistence/*`, `src/server/http/handler.js`: record, backend lưu và API history/replay.

# Bàn giao integration

Tài liệu này ghi quyết định tích hợp 5 phase. Sau chuẩn hóa JavaScript, đường dẫn nội bộ được chuyển sang client/server/shared; xem [NORMALIZATION.md](NORMALIZATION.md) và [SOURCE_AUDIT.md](SOURCE_AUDIT.md). Schema, API contracts và shape dữ liệu integration giữ nguyên.

Ghi chú sau nghiệm thu: các mô tả “gợi ý nước đi” bên dưới là quyết định của mốc tích hợp ban đầu. Nhánh QA đã bỏ marker trên UI, phân màu ngẫu nhiên từng Match và sửa các khoảng thiếu theo Word; engine legal-move vẫn dùng để kiểm tra và cho AI. Kết quả hiện hành tại [QA_FINAL_REPORT.md](QA_FINAL_REPORT.md); các nhánh nguồn vẫn được bảo toàn.

## Nguồn và chức năng

| Nhánh | Commit nguồn | Phần dùng trong runtime |
|---|---|---|
| hieu_phase2 | f0823b7 | Bàn cờ chuẩn, luật server, room/membership, realtime, gợi ý nước đi |
| Phase3_Tien | 80f4ad4 | Đồng hồ, hòa, đầu hàng/rời trận, pause/reconnect, lưu kết quả và replay |
| Phase4_Sonvo | 3fa6166 | Chat, signaling video/WebRTC, máy chơi, góc nhìn Đen, giao diện icon/panel, persistence port |
| database | 4bb2b74 | Schema 24 bảng/5 view, FK/CHECK/UNIQUE cho tài khoản/phòng/trận/quân/nước đi |
| feature/son_phase1 | e75b122 | Validation tài khoản, phiên/thu hồi/reset mật khẩu; hồ sơ; bạn bè/lời mời/thông báo; room public/private; đổi ghế/kick/chuyển chủ. Port sang Node, nguồn C# giữ tham chiếu |

`main` giữ tại `f647ae2`. Năm remote ref nguồn không bị thay đổi. Nhánh integration có đủ năm nhánh nguồn trong ancestry; không force-push, không merge main, không push/PR trong phiên này.

## Conflict và khác biệt đã xử lý

1. Phase 2, database, Phase 1 có lịch sử độc lập với main: merge có `--allow-unrelated-histories` sau kiểm tra, giữ cả các parent.
2. README add/add giữa main và Phase 2: giữ yêu cầu main trong ORIGINAL_REQUIREMENTS.md; README chuyển thành hướng dẫn ứng dụng.
3. Phase 3 xóa README và thay import frontend: kết hợp constants/match flows với gợi ý nước đi Phase 2.
4. Phase 4 trùng `.gitignore` và README: hợp nhất ignore cache, data, env, chứng chỉ, .NET build, browser artifacts; viết lại README theo runtime cuối.
5. Hai `getLegalMoves` không cùng hợp đồng: tách `getLegalDestinations(pieces,pieceId)` cho gợi ý và `getLegalMoves(pieces,color)` cho AI. Gợi ý dùng tọa độ xoay đúng phía Đen và hỗ trợ cả PvP/PvE.
6. Phase 1 `.gitignore` add/add: hợp nhất; chuyển toàn bộ solution C# vào reference/phase1, không chạy hai backend quản lý phòng.
7. Phase 1 JWT + SignalR và guest UUID Phase 2–4: thay bằng cùng cookie phiên HttpOnly, định danh tài khoản server cấp, kiểm tra cả HTTP/WS và quyền replay; giữ nguyên một engine cờ.
8. Phase 4 gửi chat tới khán giả trái schema chat riêng: giới hạn cặp đấu thủ, lưu participantIds, lọc lịch sử theo cặp, không lộ chat khi đổi ghế.
9. Adapter bridge Phase 4 chỉ lưu memory/JSON runtime không có tài khoản chuẩn: default chuyển sang file bền vững hoặc integration SQL, không đọc/ghi hai bảng phase4 cũ. Adapter cũ chỉ giữ cho regression test nguồn.
10. UI cũ ẩn topbar khi vào phòng: giữ tài khoản/đăng xuất, gom đối thủ và room controls vào một header, ưu tiên diện tích bàn cờ, panel/icon bên phải.
11. Online save failure có thể để lại nước đi chưa xác nhận trong memory: thêm rollback, giữ requestId để retry một lần, serialize WS actions và clock/reconnect callbacks. Khi snapshot phòng chưa ghi nhưng kết quả trận đã lưu, phục hồi từ bản kết quả bền vững lúc startup.
12. Script SQL có GO và yêu cầu SET options theo phiên: bootstrap thực thi batch động trong một transaction, cấu hình SET options cho mỗi connection, sửa chế độ output sqlcmd để đọc Unicode không bị cắt chuỗi.
13. CLI concurrently 10 nằm ở `dist/bin/index.js`: sửa script dev, xác minh startup Node/Vite và HTTP/WS proxy thật. Lỗi lưu nước đi trả lại requestId để frontend thoát trạng thái chờ và có thể thử lại.

## Mô hình lưu trữ

Runtime luôn dùng cùng shape account/room/match. File adapter ghi snapshot atomically; memory dành cho test. SQL adapter ghi snapshot và các projection sau trong transaction:

| Dữ liệu | Bảng SQL đang ghi/đọc |
|---|---|
| Tài khoản, password hash | nguoi_dung, integration_user_map, integration_account_state |
| Phiên, hạn và thu hồi | phien_dang_nhap, integration_session_map |
| Reset token hash/hạn/đã dùng | token_dat_lai_mat_khau, integration_reset_map |
| Lời mời kết bạn/trạng thái | loi_moi_ket_ban, integration_friend_request_map |
| Phòng, trạng thái, thành viên/vai trò | phong, thanh_vien_phong, integration_room_state |
| Trận, trạng thái, kết quả, số nước | tran_dau, integration_match_state |
| 32 quân, vị trí, quân bị ăn | quan_co_tran_dau |
| Nước đi có thứ tự, bên đi, tọa độ/ăn quân | nuoc_di_tran_dau |
| Danh sách bạn hiện tại, thông báo/read, mời phòng, audit reset requests | Các field của integration_account_state |
| Chat riêng và quyền nhận theo cặp | chatHistory trong integration_room_state |

7 bảng integration là lớp mapping/snapshot, không tạo engine phòng hoặc luật cờ thứ hai. UUID dùng bởi HTTP/WS được map tới BIGINT của schema. `integration_account_state.version` dùng optimistic concurrency, từ chối account writer có phiên bản cũ.

Các bảng còn lại của schema được bảo toàn nhưng không giả vờ đã sử dụng: ban_be/thong_bao/loi_moi_vao_phong/tin_nhan_phong... chưa được project từ social/chat snapshot. API đọc dữ liệu này từ snapshot, không lấy từ các view tương ứng. Các view lịch sử/thống kê có thể sử dụng dữ liệu trận quan hệ. Không chạy EF migrations lên runtime integration và không tự nhập tài khoản ASP.NET hay dữ liệu bridge cũ.

Schema Phase 1 so với database gốc chỉ khác chú thích/format và thêm yeu_cau_chong_lap. Migration CorrectPhase1RelationshipCardinality có Up/Down rỗng (sửa metadata); RegisterIdempotencyIndex thêm index. Không cần hai schema cạnh tranh. Idempotency game dùng requestId/matchId; đăng ký tránh lặp bằng validation/unique + serialize commit.

## Giới hạn còn lại

- Chưa có SMTP adapter: forgot-password ghi outbox cục bộ; reset token một lần đã kiểm thử memory và SQL. Không tuyên bố email Internet đã được gửi.
- WebRTC đã xác minh trên Edge với media giả lập; chưa có TURN, chưa xác minh camera thật hoặc nhiều NAT khác nhau.
- SQL kết nối thật dùng Windows/sqlcmd. Đường mssql/SQL login có triển khai nhưng chưa có credentials để xác minh kết nối thật.
- Chỉ một tiến trình server/database; room state chưa có cơ chế distributed ownership. Không triển khai cluster.
- .NET source được giữ nguyên để tham chiếu; không build/test riêng bằng SDK 10 trong phiên này. Các bài test .NET không được tính vào số test runtime Node.
- Không áp dụng luật giải đấu về lặp nước/chiếu dai ngoài engine nguồn; phạm vi luật đã kiểm thử là di chuyển/cản quân/sông/cung, bảo vệ tướng, chiếu, chiếu bí và hết nước.
- Snapshot account/social nằm trong SQL ngoài các projection đã nêu. Quy mô lớn cần repository theo từng entity thay vì tải toàn bộ state lên một process.

## Database kiểm thử trong phiên

Đã tạo mới `CoTuongIntegrationTest_20261028_v2` trên `.\SQLEXPRESS`, chạy test tại đây. Database thử đầu `CoTuongIntegrationTest_20261028` có schema khởi tạo một phần do lỗi SET options trước khi bootstrap được sửa; giữ lại, không xóa theo yêu cầu bảo toàn dữ liệu. Không ghi vào các database có sẵn từ trước phiên tích hợp. Không tự dọn tài khoản/trận test để giữ bằng chứng.

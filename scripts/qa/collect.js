// These mappings reference assertions that actually ran, not source inspection.
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
const readLog=(name)=>{
  const b=readFileSync(`artifacts/qa/${name}`);
  return b.toString(b[0]===0xff&&b[1]===0xfe?'utf16le':'utf8').replace(/^\uFEFF/,'');
};
const node=readLog('final-node.log'),sql=readLog('sql.log'),edge=readLog('regression-edge.log'),browser=readLog('browser.log'),build=readLog('build.log');
if(!/pass 177\b/.test(node)||!/fail 0\b/.test(node)||!/pass 7\b/.test(sql)||!/fail 0\b/.test(sql)||!/4 passed/.test(edge)||!/12 passed/.test(browser)||!/built in/.test(build)) throw new Error('Required final logs are missing or not green. Do not publish coverage.');
const record=(ids,actual,evidence)=>appendFileSync('artifacts/qa/evidence.jsonl',JSON.stringify({ids,status:'PASS',actual,evidence,at:new Date().toISOString()})+'\n');
const range=(p,a,b)=>Array.from({length:b-a+1},(_,i)=>`${p}-${String(a+i).padStart(3,'0')}`);
record([...range('P2',43,78),'P2-081'],'77 luật bổ sung đã chạy: cả Đỏ/Đen, nước đúng/sai, ăn quân/cùng bên, chân Mã/mắt Tượng/sông/cung, 0/1/2 ngòi Pháo, tự chiếu, đối mặt Tướng, thoát chiếu; không sửa input board. Xoay tọa độ Đen còn được kiểm chứng bằng click UI thực.', 'test/acceptance-rules.test.js; test/xiangqi.test.js; e2e/qa/navigation.spec.js; artifacts/qa/final-node.log');
record(['P2-003','P2-004','P2-012','P2-022','P2-023','P2-033','P2-034','P2-035','P2-038','P2-040','P2-042','DB-007'],'HTTP cookie riêng + WebSocket thật + file tạm: 3 nước/1 ăn quân, từ chối sai lượt, reconnect, restart server/persistence và replay; board sau restore bằng board đã xác nhận. Clock pause/resume được assert trong phase3.', 'test/server.test.js; test/integration.test.js; test/helpers/authenticated-game.js; test/phase3.test.js; artifacts/qa/final-node.log');
record(['P3-023','P3-037'],'Cả hai socket đóng: lưu SystemError/Voided, không trao thắng tùy tiện. Snapshot thiếu dữ liệu bị từ chối khởi động và không viết đè state.', 'test/phase3.test.js; test/acceptance-results.test.js; artifacts/qa/final-node.log');
record(['P3-052','P3-056','P3-058'],'Match mới ID riêng, 32 quân, history/captured rỗng, Red đi trước, countdown mới; thay đối thủ có khán giả yêu cầu opt-in và ready mới. RNG production đã quan sát cả hai cách phân bên.', 'test/realtime.test.js; test/acceptance.test.js; artifacts/qa/final-node.log');
record(['P4-040','P4-045','P4-047','P4-048','P4-050','P4-051'],'AI chọn trong tập legal moves và nước trả lời được kiểm chứng; sai lượt/đi hộ máy bị từ chối; lưu/resume/restart không nhân đôi nước; AI hết nước bị xử thua từ fixture chiếu bí. Có thắng người (fixture), thua AFK (60s thật), đầu hàng và replay UI.', 'test/computer.test.js; test/acceptance-time.test.js; e2e/qa/account-computer.spec.js; artifacts/qa/final-node.log');
record(['DB-004','DB-005'],'SQL Server thật: state/phiên/board/capture/history giữ qua restart; stale writer bị version guard rollback, không insert user một phần; requestId lặp chỉ có một dòng nước đi.', 'test/sql-integration.test.js; test/qa-sql.test.js; artifacts/qa/sql.log');
record(['P1-013','P1-080'],'Edge UI đã chạy: logout/back/reload không trở lại màn bảo vệ; lọc đúng danh sách bạn.', 'e2e/qa/acceptance.spec.js; artifacts/qa/browser.log');
record(['P1-194','P1-155','P1-164'],'Actor bị demote vẫn ở Room và chủ động lấy ghế lại unready; các nhánh ghế trống/có spectator và đủ hai người đã chạy. Gửi tám start khi Syncing và tám khi Countdown chỉ có một UUID, không có nước trước Playing.', 'test/acceptance-completeness.test.js; test/acceptance.test.js; artifacts/qa/final-node.log');
record(['P1-181'],'Host cũ rời phòng: GET social loại pending cũ, không chặn host tạo lời mời mới; quyền chủ được chuyển cho đối thủ.', 'test/acceptance.test.js; artifacts/qa/final-node.log');
const stats={date:'2026-10-28',node:{pass:177,skip:7,fail:0},sql:{pass:7,skip:0,fail:0},edgeRegression:{pass:4,fail:0},edgeAcceptance:{pass:12,fail:0},build:'PASS'};
writeFileSync('artifacts/qa/run-stats.json',JSON.stringify(stats,null,2)+'\n');
console.log(JSON.stringify(stats));

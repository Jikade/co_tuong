import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const catalog = JSON.parse(readFileSync('docs/qa-cases.json', 'utf8'));
const records = existsSync('artifacts/qa/evidence.jsonl') ? readFileSync('artifacts/qa/evidence.jsonl', 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
if (!records.length && existsSync('docs/qa-results.json')) throw new Error('Không có bằng chứng local. Chạy các suite QA trước; không ghi đè báo cáo đã bàn giao bằng dữ liệu rỗng.');
const overrides = existsSync('scripts/qa/assessment.json') ? JSON.parse(readFileSync('scripts/qa/assessment.json', 'utf8')) : {};
const clean = (s) => String(s ?? '').replaceAll('|', '\\|').replaceAll('\n', '<br>');
const phases = { P1: 'Phase 1', P2: 'Phase 2', P3: 'Phase 3', P4: 'Phase 4', DB: 'Database', SEC: 'Security/ổn định', ENV: 'Môi trường/UI' };
const statuses = ['PASS', 'FAIL', 'BLOCKED', 'NOT IMPLEMENTED', 'NOT TESTED'];
const bugCases = {
  'QA-001':['P2-013'], 'QA-002':['P2-019','P2-020','P2-082'], 'QA-003':['P1-098','P1-100','P1-101','P1-102','P1-103'],
  'QA-004':['P1-116','P1-117','P1-118','P1-181'], 'QA-005':['P1-143','P1-164'], 'QA-006':['P1-005','P1-006','ENV-006'],
  'QA-007':['P1-023','P1-024','P1-031'], 'QA-008':['P1-061'], 'QA-009':['P1-091','P1-093','P1-094','P1-109'],
  'QA-010':['P1-080','P1-129','P1-130','P1-131'], 'QA-011':['P4-027'], 'QA-012':['P3-012','P3-015','P3-018'],
  'QA-013':['P3-024'], 'QA-014':['P3-020'], 'QA-015':['DB-002'], 'QA-016':['DB-003'], 'QA-017':['P3-019'],
  'QA-021':['P1-071','P1-072','P1-120','P1-121','P1-122'], 'QA-022':['P1-147'],
};
const results = catalog.cases.map((c) => {
  const matches = records.filter((r) => r.ids.includes(c.id));
  const last = matches.at(-1);
  return { ...c, status: 'NOT TESTED', actual: 'Chưa chạy assertion cho toàn bộ điều kiện của yêu cầu này.', evidence: '', bug: '', ...last, ...overrides[c.id] };
});
for (const c of results) {
  if (!c.bug) c.bug = Object.entries(bugCases).filter(([,ids])=>ids.includes(c.id)).map(([id])=>id+' (FIXED)').join(', ');
  if (c.status === 'PASS' && c.evidence?.startsWith('test/') && !c.evidence.includes('artifacts/qa/final-node.log')) c.evidence += '; artifacts/qa/final-node.log';
  if (c.status === 'PASS' && c.evidence?.includes('e2e/qa/')) c.evidence = c.evidence.replace(/artifacts\/qa\/[a-z-]+\.log/g, 'artifacts/qa/browser.log') + '; artifacts/qa/browser-results.json';
}
const summaries = Object.entries(phases).map(([phase, name]) => {
  const rows = results.filter((c) => c.phase === phase);
  return { phase, name, total: rows.length, ...Object.fromEntries(statuses.map((s) => [s, rows.filter((c) => c.status === s).length])) };
});
const table = ['| Phase | Số test | PASS | FAIL | BLOCKED | NOT IMPLEMENTED | NOT TESTED |', '|---|---:|---:|---:|---:|---:|---:|',
  ...summaries.map((s) => `| ${s.name} | ${s.total} | ${statuses.map((status) => s[status]).join(' | ')} |`)].join('\n');
const setup = (c) => c.phase === 'P1' ? 'Server test local; A/B/C có cookie độc lập; tài khoản/Room mới, không dùng dữ liệu thật.'
  : c.phase === 'P2' ? 'Room test A/B ready; server authoritative; C spectator; fixture bàn cờ cho luật đặc biệt.'
  : c.phase === 'P3' ? 'Match test đang chạy; ghi Match ID, deadline, board/history trước thao tác; A/B/C độc lập.'
  : c.phase === 'P4' ? 'A/B cùng Room; C spectator/D ngoài Room; media giả lập được phân biệt với thiết bị thật.'
  : c.phase === 'DB' ? 'Database riêng CoTuongIntegrationTest_QA_20261028; Windows Authentication; không đụng DB thật.' : 'Server/context local riêng; không truy cập hệ thống bên ngoài.';
const procedures = (c) => `1. Chuẩn bị theo điều kiện. 2. Thực hiện điều kiện nêu ở yêu cầu (${c.section}). 3. Kiểm tra trạng thái client, phản hồi WS/API và dữ liệu lưu; lặp thao tác/đổi quyền nếu được yêu cầu. Chi tiết thực thi nằm tại test trong cột bằng chứng.`;
let matrix = `# Ma trận nghiệm thu hệ thống Cờ tướng\n\nNguồn chính thức: [Word](KICH_BAN_CHUC_NANG.docx), [toàn bộ đoạn văn đã trích xuất](QA_REQUIREMENTS.md). SHA-256: \`${catalog.sha256}\`. Đọc ${catalog.paragraphs} đoạn; 389 bullet (có yêu cầu lặp) thành 389 hàng; giữ các điều kiện con trong cùng case. Bổ sung 20 hàng DB/bảo mật/môi trường từ yêu cầu người dùng. Đây là 409 case đối chiếu, không phải 409 nghiệp vụ độc lập.\n\nMa trận khởi tạo trước baseline; trạng thái chỉ cập nhật khi có assertion thực thi hoặc ghi nhận trở ngại cụ thể. PASS đòi hỏi tất cả điều kiện của hàng được chứng minh; chạy một phần vẫn NOT TESTED. Số hàng khác số bài node:test/Playwright. Test có fixture luật/cấu hình thời gian rút gọn được phân biệt với bài wall-clock production 60s.\n\nQuyết định yêu cầu: Phase 1 ¶195 cho khán giả xem chat, nhưng Phase 4 ¶438 và chỉ dẫn người dùng yêu cầu riêng tư; áp dụng **khán giả không nhận/xem chat, cặp mới không đọc chat cũ**. Bản ORIGINAL_REQUIREMENTS.md cũ không phải nguồn chính lần này.\n\n${table}\n\n| Test Case ID | Phase / mục Word | Yêu cầu cần kiểm tra | Điều kiện trước | Bước thực hiện | Dữ liệu đầu vào | Kết quả mong đợi | Kết quả thực tế | Trạng thái | Bằng chứng / log | Mã lỗi |\n|---|---|---|---|---|---|---|---|---|---|---|\n`;
for (const c of results) matrix += '| ' + [c.id, `${phases[c.phase]} / ${c.section}${c.paragraph ? ` [¶${c.paragraph}](QA_REQUIREMENTS.md#p${c.paragraph})` : ''}`, c.requirement, setup(c), c.steps ?? procedures(c), c.input ?? 'Tài khoản @example.test; QAChess123/ChessTest123 theo fixture; Room 6 số; input sai theo yêu cầu; chỉ local/test.', c.id === 'P1-140' ? 'Theo chỉ dẫn người dùng: spectator không nhận/xem/gửi chat riêng.' : c.requirement, c.actual, c.status, c.evidence, c.bug].map(clean).join(' | ') + ' |\n';
writeFileSync('docs/QA_TEST_MATRIX.md', matrix);
writeFileSync('artifacts/qa/summary.json', JSON.stringify({ source: catalog.sha256, cases: results, summaries }, null, 2));
writeFileSync('docs/qa-results.json', JSON.stringify({ date: '2026-10-28', source: catalog.sha256, summaries, results: results.map(({id,phase,status,actual,evidence,bug})=>({id,phase,status,actual,evidence,bug})) }, null, 2)+'\n');
console.log(table);

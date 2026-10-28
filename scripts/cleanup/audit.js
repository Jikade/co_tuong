// Read-only analysis of a pinned Git snapshot. Never decides or deletes files.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const base = 'd92474d20a155904274dd93ff87975a325a74580';
const git = (...args) => execFileSync('git', args, { maxBuffer: 32 * 1024 * 1024, windowsHide: true });
const paths = git('ls-tree', '-r', '--name-only', '-z', base).toString().split('\0').filter(Boolean);
const source = new Map(paths.map((file) => [file, git('show', `${base}:${file}`)]));
const deleted = [
  'reference/phase1/src/CoTuong.Web/Components/Pages/Counter.razor',
  'reference/phase1/src/CoTuong.Web/Components/Pages/Weather.razor',
];
const uncertain = {
  'CoTuong.Core/Abstractions/IEmailSender.cs': 'SMTP message contract: actual mail delivery has not been ported/tested.',
  'CoTuong.Infrastructure/Services/SmtpEmailSender.cs': 'No Node SMTP adapter; retain implementation for future work.',
  'CoTuong.Infrastructure/Services/AspNetPasswordHasher.cs': 'ASP.NET password hash differs from Node scrypt; old account import not verified.',
  'CoTuong.Infrastructure/Services/AuthService.cs': 'JWT/refresh and legacy account compatibility are not equivalent to opaque Node sessions.',
  'CoTuong.Infrastructure/Services/DatabaseRoomLockProvider.cs': 'Database/distributed lock has no proven multi-worker Node equivalent.',
  'CoTuong.Infrastructure/Services/RoomInvitationService.cs': 'Legacy invitation-token/API semantics differ from the integrated room-code contract.',
};
function classify(file) {
  if (deleted.includes(file)) return ['D', 'Blazor SDK counter/weather demo, no chess requirement/caller; remove only these two demo routes.'];
  if (file.startsWith('reference/phase1/')) {
    const old = file.slice('reference/phase1/src/'.length);
    if (uncertain[old]) return ['E', uncertain[old]];
    if (/\.(md|slnx|props|csproj|json|sql|ps1)$/.test(file) || /\/(Entities|Persistence|CoTuong.Tests)\//.test(file)) {
      return ['B', 'Keep legacy handover, EF schema/migrations, tests, configuration and their dependency chain. Not in Node runtime.'];
    }
    return ['C', 'Integrated business/UI path replaced by Node; retain original reference/dependency chain because exact legacy contracts are not all proven equivalent.'];
  }
  if (file.startsWith('src/') || ['server.js', 'index.html', 'database/01_schema_phase1.sql', 'database/03_integration.sql'].includes(file)) {
    return ['A', 'Current frontend/backend/engine/persistence or database bootstrap; keep.'];
  }
  return ['B', 'Keep build/test/tooling/configuration, lockfile, SQL seed, documentation, QA evidence or tested reference adapter.'];
}
const edges = [], packages = [];
function edge(from, target, kind) {
  const resolved = target.startsWith('/') ? target.slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(from), target));
  const directory = [...source.keys()].some((f) => resolved === './' || f.startsWith(resolved.replace(/\/$/, '') + '/'));
  edges.push({ from, to: resolved, kind, existsAtBase: source.has(resolved), directoryAtBase: !source.has(resolved) && directory });
}
for (const [file, bytes] of source) {
  const text = bytes.toString('utf8');
  if (file.endsWith('.js')) for (const m of text.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)['"]([^'"]+)['"]/g)) {
    if (m[1].startsWith('.')) edge(file, m[1], 'esm-reference');
    else packages.push({ from: file, specifier: m[1] });
  }
  if (/\.(js|py)$/.test(file)) for (const m of text.matchAll(/new URL\(['"]([^'"]+)['"],\s*import\.meta\.url\)/g)) edge(file, m[1], 'filesystem-url');
  if (file === 'index.html') for (const m of text.matchAll(/(?:src|href)="(\/src\/[^"?#]+)"/g)) edge(file, m[1], 'html-entry');
  if (file.endsWith('.csproj')) for (const m of text.matchAll(/ProjectReference Include="([^"]+)"/g)) edge(file, m[1].replaceAll('\\', '/'), 'legacy-project');
}
const files = paths.map((file) => {
  const [group, reason] = classify(file), bytes = source.get(file);
  return { file, group, decision: group === 'D' ? 'DELETE' : 'KEEP', reason,
    bytesAtBase: bytes.length, sha256AtBase: createHash('sha256').update(bytes).digest('hex'),
    incomingLiteralEdges: edges.filter((e) => e.to === file),
    // Implicit Razor SDK discovery, config, routing and dynamic usages need manual review.
  };
});
const counts = Object.fromEntries(['A', 'B', 'C', 'D', 'E'].map((g) => [g, files.filter((f) => f.group === g).length]));
const pkg = JSON.parse(source.get('package.json').toString());
const duplicates = [...new Set(files.map((f) => f.sha256AtBase))].map((hash) => files.filter((f) => f.sha256AtBase === hash).map((f) => f.file)).filter((v) => v.length > 1);
writeFileSync('docs/CODE_AUDIT_INVENTORY.json', JSON.stringify({ base, scope: 'All 238 tracked files at the pinned QA commit; generated audit files excluded from these counts.',
  counts, deleted, keptOriginalFiles: files.length - deleted.length, files, edges, packages, npmScripts: pkg.scripts, byteIdenticalGroups: duplicates,
  limitations: ['Literal edges are discovery aids, not an unused-file proof.', 'C# compiler-generated routing/dependencies reviewed separately.', 'Ignored dependency/cache/data/artifact contents are not source-deletion candidates.'] }, null, 2) + '\n');
const table = edges.filter((e) => !e.kind.startsWith('legacy')).map((e) => `| \`${e.from}\` | \`${e.to}\` | ${e.kind} | ${e.existsAtBase ? 'yes' : e.directoryAtBase ? 'directory' : 'review'} |`).join('\n');
writeFileSync('docs/CODE_DEPENDENCY_MAP.md', `# Bản đồ phụ thuộc phục vụ dọn source\n\nMốc đọc: \`${base}\`. Sinh bằng \`node scripts/cleanup/audit.js\`. Đây là đồ thị import literal + URL filesystem + HTML; không dùng riêng đồ thị để kết luận xóa. Danh mục từng file và ProjectReference C# nằm trong [CODE_AUDIT_INVENTORY.json](CODE_AUDIT_INVENTORY.json).\n\n## Các entrypoint và tham chiếu gián tiếp đã rà soát\n\n| Luồng | Chuỗi phụ thuộc / quyết định |\n|---|---|\n| Dev | package.json → scripts/dev.js → concurrently → node server.js + vite; Vite → index.html → hai CSS + client/main.js |\n| Production | start/server/preview → server.js → game-server → HTTP/WS/services/persistence/shared; HTTP staticDir mặc định dist; giữ tất cả |\n| SQL | db:setup → setup-db.js → database/01_schema_phase1.sql + 03_integration.sql; integration adapter đọc 03 bằng URL; giữ cả seed 02 và SQL nguồn tham khảo |\n| SQL driver | sql-connection.js dynamic import('mssql') hoặc execFile sqlcmd; SQL tạm dưới data/sql-temp; không phải dependency .NET |\n| Unit/integration | npm test discovery test/*.test.js → helpers; persistence.test.js → reference/phase4/sql-server-persistence.js; giữ adapter/bridge |\n| Edge | hai Playwright config → scripts/e2e-server.js hoặc scripts/qa/browser-server.js → dist + API/WS thật trên 3107/3108 |\n| QA tooling | Word → extract-requirements.py → catalog/transcript; evidence.jsonl + assessment → report.js; collect.js đọc logs; giữ Python như công cụ tài liệu |\n| Cấu hình động | DB_MODE/DB_DRIVER, DATA_FILE/MAIL_OUTBOX/STATIC_DIR, TLS files, BROWSER_PATH, WS override, socket actions, ?room/?reset, storage và getUserMedia/RTCPeerConnection; giữ các file tương ứng |\n| Asset/CSS | SVG/data URI/gradient/canvas được nhúng, class động piece/color/selected/mine/theirs/clock/panels; giữ CSS còn lại. Chỉ hai rule legal-move không có producer HTML/JS, test xác nhận 0 marker |\n| Legacy Blazor | CoTuong.slnx → 4 csproj → Core/Infrastructure/Web/Tests; Razor SDK tự khám phá @page. Xóa Counter/Weather sẽ bỏ hai route demo nếu ai chạy riêng ứng dụng C#; không ảnh hưởng game Node, auth hay SMTP |\n| Deployment/CI | Không có Dockerfile, compose hoặc pipeline CI/CD trong snapshot/working root. README yêu cầu deploy runtime Node + dist + package/lock, không reference; không suy đoán cấu hình bên ngoài repo |\n| Ngoài Git | node_modules/cache/dist/artifacts/data và 44 Bootstrap assets ignored: chỉ thống kê metadata, giữ nguyên; không lấy thiếu import làm bằng chứng xóa |\n\n## Cạnh literal của JavaScript/HTML/SQL hiện có tại mốc gốc\n\n| Từ | Tới | Loại | Tồn tại ở mốc gốc |\n|---|---|---|---|\n${table}\n`);
console.log(JSON.stringify({ base, total: files.length, counts, deleteFiles: deleted.length, keepOriginalFiles: files.length - deleted.length, edges: edges.length, duplicates: duplicates.length }));

const escape = (s) => String(s).replaceAll('|', '\\|').replaceAll('\n', ' ');
const rows = files.map((f) => {
  const phase1 = f.file.startsWith('reference/phase1/');
  const purpose = f.group === 'D' ? 'Demo SDK Blazor: bộ đếm hoặc dự báo thời tiết giả' : phase1 ? 'Phase 1 cũ: ' + f.file.split('/').at(-1) : f.group === 'A' ? 'Ứng dụng/schema hiện hành' : 'Build/test/cấu hình/tài liệu/SQL/tham khảo';
  const refs = f.incomingLiteralEdges.length ? f.incomingLiteralEdges.map((e) => e.from).join('; ') : phase1 ? 'Không từ runtime Node; còn quan hệ nội bộ C#/Razor SDK hoặc bàn giao' : 'Entry/config/discovery/tài liệu hoặc tải động; giữ';
  const replacement = f.group === 'D' ? 'Không có nghiệp vụ game cần thay; chỉ bỏ route demo trong archive' : ['C', 'E'].includes(f.group) ? 'accounts/account-ui, game-server + HTTP/WS; xem bảng tương đương và giới hạn CODE_AUDIT_REPORT' : 'Không thay trong đợt này';
  return '| ' + [f.file, purpose, f.group === 'D' ? 'Chỉ @page qua SDK Blazor; không caller game/test/config hiện hành' : refs, replacement, f.group + ' — ' + (f.group === 'D' ? 'XÓA' : 'GIỮ'), f.reason + ' SHA256/edges: CODE_AUDIT_INVENTORY.json; kiểm thử: CLEANUP_VALIDATION.md'].map(escape).join(' | ') + ' |';
});
writeFileSync('docs/UNUSED_FILES_REPORT.md', `# Quyết định giữ/xóa file\n\nMốc gốc \`${base}\`: **238 file**, A=28, B=137, C=65, D=2, E=6. Xóa **2 file được Git theo dõi**, giữ **236 file gốc**; bỏ thêm 2 khối CSS trong một file vẫn giữ. Các tài liệu/script kiểm toán mới không cộng vào mẫu 238 file gốc. Phân loại C chỉ nói luồng game đã được thay trong integration, không phải chứng nhận mọi contract C# giống Node; vì vậy cả 65 file C vẫn giữ. E chưa đủ bằng chứng xóa, giữ cả 6.\n\n## Nhóm xóa và chứng minh an toàn\n\n| Ứng viên | Kiểm tra trước xóa | Tác động được chấp nhận / khôi phục | Kiểm thử trước/sau |\n|---|---|---|---|\n| Counter.razor | Đọc đủ: @page /counter, tăng biến currentCount; không DB/API/game; không reference ngoài chính file. SDK Razor vẫn tự phát hiện page | Bỏ route demo của ứng dụng Blazor tham khảo; không đụng trang tài khoản/Room. Khôi phục từng file từ backup/safe-cleanup-d92474d | Baseline toàn bộ; group1 Node + architecture + build; cuối toàn bộ SQL/Edge |\n| Weather.razor | Đọc đủ: @page /weather, random nhiệt độ sau Task.Delay; không DB/API/game; không reference ngoài chính file | Bỏ route thời tiết demo của archive; không liên quan đồng hồ trận. Khôi phục từng file từ backup | Cùng nhóm Counter; không dùng test Node để tuyên bố C# compile PASS |\n| main.css: .legal-move và .legal-move.capture | Đọc renderPieces/handleCell, class động và index; không producer tạo marker; chỉ còn CSS và test assert marker=0. Không lazy loader hay tải selector từ server | Bỏ 2 rule (không xóa file). Giữ .piece.selected, board/capture/engine/AI. Có diff chính xác để phục hồi hunk | Baseline 16 Edge; group2 + cuối build, 16 Edge, Node, SQL |\n\nMỗi ứng viên đã xét đủ 12 mặt: ESM/require; dynamic loading; đọc filesystem/URL; HTML/CSS/config; npm scripts; tests; bootstrap/migrations; deployment; CI; tài nguyên/bàn giao; chức năng đã PASS; phần thay thế. Hai demo không có giá trị nghiệp vụ bàn giao, bản gốc vẫn ở Git/backup và nhánh nguồn. Không xóa cha Pages, không xóa thành phần phụ thuộc của SMTP/EF. Không chạy .NET hoặc test C#; không nghiệm thu ứng dụng Blazor độc lập.\n\n## Những nghi ngờ không dẫn đến xóa\n\n- C# nghiệp vụ/UI/SignalR: giữ toàn bộ còn lại, vì SMTP, hash/JWT, link/token và multi-worker chưa tương đương hoàn toàn. Migrations/DbContext/Entities/tests và project/config giữ như chuỗi tham khảo.\n- reference/phase4: adapter đang được persistence.test.js gọi trực tiếp; giữ cả SQL bridge để đối chiếu dữ liệu cũ.\n- database: giữ 01/02/03, SQL nguồn 24 bảng/5 view, EF migrations và scaffold. Seed 02 dùng ASP.NET hash, không phải seed đăng nhập Node; không tự chạy.\n- utils.getWebSocketUrl chỉ còn caller test: vẫn là export có regression, giữ. Các file src đều có cạnh tới; không có module src mồ côi ở mức file.\n- CSS khác có cascade/responsive/JS-generated class; không chứng minh unused bằng coverage của một màn hình. Giữ SVG/data URI/canvas, tài liệu và mọi screenshot QA.\n- 44 Bootstrap assets dưới reference bị Git ignore, một CSS được App.razor gọi; giữ toàn bộ vì không được phép xóa file ngoài Git.\n- node_modules, .npm-cache, dist, data, artifacts, test-results: giữ; build/Playwright chỉ tạo lại đầu ra theo script hiện có, không chạy lệnh dọn hàng loạt.\n- Không có duplicate byte trong 238 file gốc. Hai adapter SQL khác chức năng/contract; hai schema là provenance + migration, không phải duplicate để xóa.\n- Cả 5 dependency trực tiếp có caller hoặc script: ws, mssql (dynamic), Vite, concurrently, Playwright. Không gỡ dependency/không sửa lockfile.\n\n## Danh mục từng file gốc\n\nHash, kích thước, phân loại và cạnh tham chiếu: [CODE_AUDIT_INVENTORY.json](CODE_AUDIT_INVENTORY.json). Đồ thị/entrypoint gián tiếp: [CODE_DEPENDENCY_MAP.md](CODE_DEPENDENCY_MAP.md). Bằng chứng kiểm thử có giới hạn: [CLEANUP_VALIDATION.md](CLEANUP_VALIDATION.md). Bảng dưới mô tả quyết định bảo thủ, không coi ô thiếu cạnh literal là bằng chứng file thừa.\n\n| File/thư mục | Công dụng trước đây | Có còn được tham chiếu? | Chức năng thay thế | Quyết định | Bằng chứng |\n|---|---|---|---|---|---|\n${rows.join('\n')}\n`);

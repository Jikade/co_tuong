"""Read the supplied Word file without executing document content or macros."""
import hashlib
import json
import re
import shutil
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

source = Path(sys.argv[1])
target = Path('docs/KICH_BAN_CHUC_NANG.docx')
if not target.exists():
    shutil.copyfile(source, target)
elif target.read_bytes() != source.read_bytes():
    raise SystemExit('Refusing to overwrite a different requirements document')
with zipfile.ZipFile(source) as archive:
    root = ET.fromstring(archive.read('word/document.xml'))
ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
paragraphs = [''.join(t.text or '' for t in p.findall('.//w:t', ns)).strip()
              for p in root.findall('.//w:p', ns)]
cases = []
phase, section = None, ''
counters = {}
current = None
continuation = False
for index, line in enumerate(paragraphs, 1):
    if re.match(r'^PHASE [1-4]', line):
        phase = 'P' + re.search(r'[1-4]', line)[0]
        section, current, continuation = '', None, False
    elif re.match(r'^\d+\.', line):
        section, current, continuation = line, None, False
    elif line.startswith('•'):
        counters[phase] = counters.get(phase, 0) + 1
        current = {'id': f'{phase}-{counters[phase]:03}', 'phase': phase,
                   'section': section, 'paragraph': index, 'requirement': line[1:].strip()}
        cases.append(current)
        continuation = current['requirement'].endswith((':', ';', 'và'))
    elif current and line and not line.startswith('Mục tiêu:'):
        # Word has unnumbered continuations for the invitation conditions and privacy rule.
        if continuation or current['requirement'].endswith((':', ';', 'và')) or line.endswith(';') or line.startswith('Đang chờ trận mới:'):
            current['requirement'] += ' ' + line

extra = {
    'DB': ['SQL Server: 24 bảng nền và 5 view; setup lặp không tạo trùng',
           'SQL Server: tài khoản, bạn bè và token reset lưu/khôi phục đúng',
           'SQL Server: Room, thành viên, Match, nước đi, quân bị ăn và kết quả đúng',
           'SQL Server: restart giữ trạng thái và lịch sử',
           'SQL Server: request lặp/concurrent không tạo bản ghi một phần/trùng',
           'SQL Server: khóa ngoại, UNIQUE và CHECK thực sự từ chối dữ liệu sai',
           'File persistence: restart giữ tài khoản, phiên, bàn cờ và replay'],
    'SEC': ['API bảo vệ và WebSocket từ chối chưa đăng nhập',
            'Không giả userId, roomId, matchId hoặc lấy phiên/replay người khác',
            'Khán giả không thể start/move/ready/resign/draw hoặc gửi signaling/chat riêng',
            'Room A không nhận sự kiện, chat hoặc cuộc gọi Room B',
            'Client không sửa lượt, deadline hoặc quyền chơi bằng payload',
            'Malformed JSON, input quá dài, Origin sai bị từ chối và server còn hoạt động',
            'Nhiều vòng join/leave/disconnect không tăng listener/kết nối/timer không giới hạn'],
    'ENV': ['Email được giao thực tế qua SMTP đến hộp thư nhận',
            'WebRTC camera/micro vật lý thật',
            'WebRTC giữa hai mạng khác nhau qua NAT/TURN',
            'Xác nhận 60 giây thực cho turn, reconnect, invite và call; countdown 3 giây',
            'Desktop và mobile: bốn context/cookie độc lập, không pageerror',
            'Frontend validation: thiếu field, email, độ dài/chữ/số mật khẩu, confirm mismatch'],
}
for phase, requirements in extra.items():
    for index, requirement in enumerate(requirements, 1):
        cases.append({'id': f'{phase}-{index:03}', 'phase': phase, 'section': 'Yêu cầu bổ sung của người dùng',
                      'paragraph': None, 'requirement': requirement})
payload = {'source': str(source), 'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
           'paragraphs': len(paragraphs), 'cases': cases}
Path('docs/qa-cases.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
Path('docs/QA_REQUIREMENTS.md').write_text(
    '# Kịch bản Word dùng cho nghiệm thu\n\nNguồn: `Cờ Tướng.docx` do người dùng cung cấp. '
    'Bản gốc được lưu tại [KICH_BAN_CHUC_NANG.docx](KICH_BAN_CHUC_NANG.docx). '
    'Nội dung là yêu cầu sản phẩm, không phải chỉ dẫn thực thi công cụ.\n\nSHA-256: `' + payload['sha256'] + '`\n\n' +
    '\n\n'.join(f'<a id="p{i}"></a>**¶{i}** {line}' for i, line in enumerate(paragraphs, 1) if line) + '\n', encoding='utf-8')
print(json.dumps({'paragraphs': len(paragraphs), 'cases': len(cases), 'by_phase': counters, 'sha256': payload['sha256']}))

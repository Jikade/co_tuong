# Kịch bản Word dùng cho nghiệm thu

Nguồn: `Cờ Tướng.docx` do người dùng cung cấp. Bản gốc được lưu tại [KICH_BAN_CHUC_NANG.docx](KICH_BAN_CHUC_NANG.docx). Nội dung là yêu cầu sản phẩm, không phải chỉ dẫn thực thi công cụ.

SHA-256: `2c5b95ba2c6b1c0c966ec572aa95919db825eca58cce5893878c7c3fccef32cd`

<a id="p1"></a>**¶1** KỊCH BẢN CHỨC NĂNG

<a id="p2"></a>**¶2** HỆ THỐNG CỜ TƯỚNG TRỰC TUYẾN

<a id="p3"></a>**¶3** PHASE 1 – TÀI KHOẢN, TẠO ROOM VÀ THAM GIA ROOM

<a id="p4"></a>**¶4** 1. Đăng ký tài khoản

<a id="p5"></a>**¶5** Mục tiêu: người dùng tạo được một tài khoản hợp lệ để tham gia các trận cờ trực tuyến.

<a id="p6"></a>**¶6** • Người dùng mở màn hình Đăng ký và nhập: tên đăng nhập, tên hiển thị, email, mật khẩu và xác nhận mật khẩu.

<a id="p7"></a>**¶7** • Email không được để trống, phải đúng định dạng và không được trùng với email của tài khoản đã tồn tại.

<a id="p8"></a>**¶8** • Email được sử dụng để xác minh tài khoản trong trường hợp người dùng quên mật khẩu và cần đặt lại mật khẩu.

<a id="p9"></a>**¶9** • Tên đăng nhập không được để trống và không được trùng với tài khoản đã tồn tại. Nếu trùng, hệ thống thông báo rõ để người dùng chọn tên khác.

<a id="p10"></a>**¶10** • Mật khẩu tối thiểu 8 ký tự, có ít nhất chữ và số. Hai ô Mật khẩu và Xác nhận mật khẩu phải giống nhau.

<a id="p11"></a>**¶11** • Nếu còn trường bắt buộc chưa nhập, định dạng không hợp lệ hoặc hai mật khẩu không khớp, hệ thống không tạo tài khoản và hiển thị lỗi ngay tại nội dung cần sửa.

<a id="p12"></a>**¶12** • Khi toàn bộ dữ liệu hợp lệ, hệ thống tạo tài khoản, thông báo đăng ký thành công và chuyển người dùng sang màn hình Đăng nhập.

<a id="p13"></a>**¶13** • Nhấn nút Đăng ký nhiều lần liên tiếp không được tạo ra nhiều tài khoản giống nhau.

<a id="p14"></a>**¶14** 2. Đăng nhập, duy trì phiên và đăng xuất

<a id="p15"></a>**¶15** Mục tiêu: người dùng vào hệ thống bằng tài khoản đã tạo và duy trì trạng thái đăng nhập ổn định trong quá trình sử dụng.

<a id="p16"></a>**¶16** • Người dùng nhập tên đăng nhập và mật khẩu rồi chọn Đăng nhập.

<a id="p17"></a>**¶17** • Nếu thông tin đúng và tài khoản đang hoạt động, hệ thống đăng nhập thành công, hiển thị tên người chơi và đưa người dùng tới màn hình chính.

<a id="p18"></a>**¶18** • Nếu sai tên đăng nhập hoặc mật khẩu, hệ thống từ chối đăng nhập và hiển thị thông báo phù hợp; không tiết lộ thông tin nhạy cảm của tài khoản.

<a id="p19"></a>**¶19** • Nếu phiên đăng nhập còn hiệu lực khi người dùng mở lại hệ thống, người dùng được tiếp tục sử dụng mà không phải đăng nhập lại. Khi phiên hết hiệu lực, hệ thống yêu cầu đăng nhập lại.

<a id="p20"></a>**¶20** • Khi người dùng chọn Đăng xuất, hệ thống kết thúc phiên hiện tại và đưa về màn hình Đăng nhập. Các màn hình yêu cầu tài khoản không còn truy cập được bằng nút quay lại.

<a id="p21"></a>**¶21** • Nếu người dùng mở link mời Room nhưng chưa đăng nhập, hệ thống chuyển tới màn hình Đăng nhập. Sau khi đăng nhập thành công, người dùng được đưa trở lại đúng Room đã mở từ link nếu Room vẫn còn hợp lệ.

<a id="p22"></a>**¶22** 2.1. Quên mật khẩu và đặt lại mật khẩu

<a id="p23"></a>**¶23** Mục tiêu: người dùng quên mật khẩu có thể xác minh quyền sở hữu tài khoản qua email đã đăng ký và thiết lập mật khẩu mới mà không cần biết mật khẩu cũ.

<a id="p24"></a>**¶24** • Tại màn hình Đăng nhập, người dùng có thể chọn Quên mật khẩu.

<a id="p25"></a>**¶25** • Hệ thống hiển thị màn hình yêu cầu người dùng nhập email đã đăng ký với tài khoản.

<a id="p26"></a>**¶26** • Người dùng nhập email và chọn Gửi yêu cầu đặt lại mật khẩu.

<a id="p27"></a>**¶27** • Nếu email để trống hoặc sai định dạng, hệ thống không gửi yêu cầu và hiển thị thông báo yêu cầu nhập lại.

<a id="p28"></a>**¶28** • Hệ thống kiểm tra email có thuộc một tài khoản đang tồn tại và còn hoạt động hay không.

<a id="p29"></a>**¶29** • Để tránh làm lộ thông tin tài khoản, sau khi người dùng gửi yêu cầu, hệ thống hiển thị thông báo chung như: “Nếu email này được đăng ký trong hệ thống, hướng dẫn đặt lại mật khẩu sẽ được gửi tới email.”

<a id="p30"></a>**¶30** • Nếu email hợp lệ và thuộc một tài khoản, hệ thống tạo mã/token đặt lại mật khẩu có thời hạn và gửi đường link đặt lại mật khẩu tới email đó.

<a id="p31"></a>**¶31** • Token đặt lại mật khẩu chỉ được sử dụng cho đúng tài khoản đã yêu cầu và chỉ có hiệu lực trong một khoảng thời gian xác định, ví dụ 15 phút.

<a id="p32"></a>**¶32** • Người dùng mở đường link trong email. Hệ thống kiểm tra token còn tồn tại, chưa được sử dụng và chưa hết hạn.

<a id="p33"></a>**¶33** • Nếu token hợp lệ, hệ thống hiển thị màn hình Đặt lại mật khẩu gồm hai ô: Mật khẩu mới và Xác nhận mật khẩu mới.

<a id="p34"></a>**¶34** • Mật khẩu mới phải đáp ứng cùng quy tắc mật khẩu của chức năng Đăng ký: tối thiểu 8 ký tự, có ít nhất chữ và số.

<a id="p35"></a>**¶35** • Hai ô Mật khẩu mới và Xác nhận mật khẩu mới phải giống nhau.

<a id="p36"></a>**¶36** • Nếu dữ liệu không hợp lệ, hệ thống không thay đổi mật khẩu và hiển thị lỗi để người dùng sửa lại.

<a id="p37"></a>**¶37** • Nếu hợp lệ, hệ thống cập nhật mật khẩu mới cho tài khoản và đánh dấu token đặt lại mật khẩu là đã sử dụng.

<a id="p38"></a>**¶38** • Một token đã được sử dụng không được sử dụng lại lần thứ hai.

<a id="p39"></a>**¶39** • Nếu token đã hết hạn, không tồn tại hoặc đã được sử dụng, hệ thống từ chối yêu cầu và thông báo “Liên kết đặt lại mật khẩu không còn hiệu lực.”

<a id="p40"></a>**¶40** • Sau khi đặt lại mật khẩu thành công, hệ thống thông báo “Đặt lại mật khẩu thành công” và đưa người dùng về màn hình Đăng nhập.

<a id="p41"></a>**¶41** • Từ thời điểm đó, mật khẩu cũ không còn được sử dụng để đăng nhập; người dùng phải đăng nhập bằng mật khẩu mới.

<a id="p42"></a>**¶42** • Nếu người dùng gửi nhiều yêu cầu Quên mật khẩu liên tiếp, hệ thống có thể vô hiệu hóa các token cũ và chỉ giữ token mới nhất còn hiệu lực để tránh tồn tại nhiều đường link đặt lại mật khẩu cùng lúc.

<a id="p43"></a>**¶43** • Hệ thống cần giới hạn số lần gửi yêu cầu trong một khoảng thời gian để tránh người dùng bấm liên tục hoặc bị lạm dụng chức năng gửi email.

<a id="p44"></a>**¶44** 2.2. Kết bạn và quản lý bạn bè trong game

<a id="p45"></a>**¶45** Mục tiêu: người dùng có thể tìm người chơi khác, gửi lời mời kết bạn, quản lý danh sách bạn bè và sử dụng danh sách này để mời bạn vào Room chơi cờ.

<a id="p46"></a>**¶46** • Sau khi đăng nhập, người dùng có thể mở mục Bạn bè từ màn hình chính.

<a id="p47"></a>**¶47** • Màn hình Bạn bè hiển thị danh sách những tài khoản đã kết bạn với người dùng.

<a id="p48"></a>**¶48** • Mỗi người trong danh sách hiển thị tối thiểu: tên hiển thị, tên đăng nhập và trạng thái Online/Offline.

<a id="p49"></a>**¶49** • Người dùng có thể nhập tên đăng nhập hoặc tên hiển thị vào ô tìm kiếm để tìm tài khoản khác trong hệ thống.

<a id="p50"></a>**¶50** • Hệ thống chỉ hiển thị những tài khoản phù hợp với nội dung tìm kiếm và không hiển thị tài khoản của chính người đang tìm như một đối tượng có thể kết bạn.

<a id="p51"></a>**¶51** • Với một tài khoản chưa phải bạn bè và chưa có lời mời kết bạn đang chờ xử lý, người dùng có thể chọn Kết bạn.

<a id="p52"></a>**¶52** • Khi người dùng chọn Kết bạn, hệ thống kiểm tra hai tài khoản vẫn còn tồn tại và giữa hai tài khoản chưa có quan hệ bạn bè.

<a id="p53"></a>**¶53** • Người dùng không được tự gửi lời mời kết bạn cho chính mình.

<a id="p54"></a>**¶54** • Nếu hai người đã là bạn bè, hệ thống không tạo thêm lời mời kết bạn trùng lặp và hiển thị trạng thái Đã là bạn bè.

<a id="p55"></a>**¶55** • Nếu đã tồn tại một lời mời kết bạn đang chờ xử lý giữa hai tài khoản, hệ thống không tạo thêm lời mời giống nhau.

<a id="p56"></a>**¶56** • Nếu hợp lệ, hệ thống tạo lời mời kết bạn và người nhận nhận được thông báo có người muốn kết bạn.

<a id="p57"></a>**¶57** Xử lý lời mời kết bạn

<a id="p58"></a>**¶58** • Người nhận có thể mở danh sách Lời mời kết bạn để xem các yêu cầu đang chờ.

<a id="p59"></a>**¶59** • Mỗi lời mời hiển thị tối thiểu tên hiển thị và tên đăng nhập của người gửi.

<a id="p60"></a>**¶60** • Người nhận có hai lựa chọn: Chấp nhận hoặc Từ chối.

<a id="p61"></a>**¶61** • Nếu người nhận chọn Chấp nhận, hệ thống tạo quan hệ bạn bè giữa hai tài khoản.

<a id="p62"></a>**¶62** • Sau khi kết bạn thành công, cả hai người đều xuất hiện trong danh sách Bạn bè của nhau.

<a id="p63"></a>**¶63** • Lời mời kết bạn đã được Chấp nhận chuyển sang trạng thái hoàn thành và không được xử lý lại lần thứ hai.

<a id="p64"></a>**¶64** • Nếu người nhận chọn Từ chối, lời mời kết bạn kết thúc và hai tài khoản không trở thành bạn bè.

<a id="p65"></a>**¶65** • Người gửi nhận được trạng thái phù hợp sau khi lời mời được Chấp nhận hoặc Từ chối.

<a id="p66"></a>**¶66** • Nếu một lời mời đã bị xử lý nhưng người dùng bấm Chấp nhận/Từ chối nhiều lần do thao tác nhanh hoặc lỗi mạng, hệ thống chỉ xử lý một lần.

<a id="p67"></a>**¶67** Trường hợp hai người gửi lời mời cho nhau cùng lúc

<a id="p68"></a>**¶68** Nên ghi rõ trường hợp này vì sau này rất dễ phát sinh bug:

<a id="p69"></a>**¶69** • Nếu A đã gửi lời mời kết bạn cho B nhưng trước khi B xử lý, B cũng thực hiện thao tác Kết bạn với A, hệ thống không tạo hai lời mời song song.

<a id="p70"></a>**¶70** • Trong trường hợp đã tồn tại lời mời từ A → B, thao tác Kết bạn từ B có thể được hiểu là Chấp nhận lời mời hiện tại

<a id="p71"></a>**¶71** Hủy lời mời kết bạn

<a id="p72"></a>**¶72** • Khi lời mời kết bạn vẫn đang ở trạng thái chờ xử lý, người gửi có thể chọn Hủy lời mời.

<a id="p73"></a>**¶73** • Sau khi hủy, lời mời không còn xuất hiện trong danh sách chờ của người nhận.

<a id="p74"></a>**¶74** • Nếu người nhận cố xử lý một lời mời đã bị hủy, hệ thống thông báo lời mời không còn hiệu lực.

<a id="p75"></a>**¶75** Hủy kết bạn

<a id="p76"></a>**¶76** • Với một tài khoản đã là bạn bè, người dùng có thể chọn Hủy kết bạn.

<a id="p77"></a>**¶77** • Trước khi thực hiện, hệ thống hiển thị xác nhận để tránh thao tác nhầm.

<a id="p78"></a>**¶78** • Nếu xác nhận, quan hệ bạn bè bị xóa khỏi cả hai tài khoản.

<a id="p79"></a>**¶79** • Sau khi hủy kết bạn, hai người không còn xuất hiện trong danh sách Bạn bè của nhau nhưng tài khoản và lịch sử các trận đã chơi trước đó không bị xóa.

<a id="p80"></a>**¶80** • Việc hủy kết bạn không ảnh hưởng tới một Match đang diễn ra giữa hai người.

<a id="p81"></a>**¶81** • Nếu hai người đang ở cùng Room khi hủy kết bạn, vai trò Chủ Room/Đối thủ/Khán giả hiện tại không tự thay đổi; việc hủy kết bạn chỉ ảnh hưởng đến quan hệ bạn bè sau đó.

<a id="p84"></a>**¶84** 3. Tạo Room chơi cờ

<a id="p85"></a>**¶85** Mục tiêu: người chơi tạo một Room để chờ Đối thủ, mời người khác và cho Khán giả theo dõi khi Room đã đủ người chơi.

<a id="p86"></a>**¶86** • Người chơi đã đăng nhập chọn Tạo Room, nhập tên Room và chọn loại Công khai hoặc Riêng tư.

<a id="p87"></a>**¶87** • Nếu tên Room để trống hoặc dữ liệu không hợp lệ, hệ thống không tạo Room và yêu cầu người dùng sửa lại.

<a id="p88"></a>**¶88** • Khi tạo Room thành công, người tạo mặc định trở thành Chủ Room và Room chuyển sang trạng thái Đang chờ Đối thủ.

<a id="p89"></a>**¶89** • Hệ thống tự động sinh một mã Room và một đường link mời gắn với Room vừa tạo.

<a id="p90"></a>**¶90** • Mã Room có 6 chữ số để người dùng có thể nhập thủ công và không được trùng với mã của một Room đang hoạt động khác.

<a id="p91"></a>**¶91** • Trong màn hình Room, hệ thống hiển thị tên Room, mã Room, đường link mời, thông tin Chủ Room, ô Đối thủ và danh sách Khán giả tối đa 10 người.

<a id="p92"></a>**¶92** • Chủ Room có thể chọn Sao chép mã Room hoặc Sao chép link để gửi cho người khác.

<a id="p93"></a>**¶93** • Room Công khai xuất hiện trong danh sách Room để người dùng khác có thể nhìn thấy và tham gia trực tiếp.

<a id="p94"></a>**¶94** • Room Riêng tư không xuất hiện trong danh sách công khai. Người khác chỉ có thể truy cập bằng mã Room, đường link hoặc lời mời trực tiếp.

<a id="p95"></a>**¶95** • Khi Room bị đóng hoặc không còn tồn tại, mã Room và đường link của Room đó hết hiệu lực.

<a id="p96"></a>**¶96** • Nếu người dùng mở link của một Room đã đóng hoặc không còn tồn tại, hệ thống thông báo “Room không còn tồn tại hoặc không còn khả dụng”.

<a id="p97"></a>**¶97** • Nếu người dùng bấm Tạo Room nhiều lần liên tiếp từ cùng một thao tác, hệ thống chỉ tạo một Room.

<a id="p98"></a>**¶98** 4. Mời bạn trong game – chờ phản hồi 60 giây

<a id="p99"></a>**¶99** Mục tiêu: Chủ Room có thể mời một người trong danh sách Bạn bè vào Room. Lời mời trực tiếp chỉ được gửi cho bạn bè đang Online và có hiệu lực trong 60 giây để chờ phản hồi. Lời mời không giữ hoặc khóa trước vị trí Đối thủ.

<a id="p100"></a>**¶100** • Trong Room, Chủ Room chọn Mời bạn.

<a id="p101"></a>**¶101** • Hệ thống mở danh sách Bạn bè của Chủ Room, hiển thị tối thiểu tên hiển thị, tên đăng nhập và trạng thái Online/Offline của từng người.

<a id="p102"></a>**¶102** • Chủ Room có thể tìm nhanh một người trong danh sách Bạn bè bằng tên đăng nhập hoặc tên hiển thị.

<a id="p103"></a>**¶103** • Chỉ những tài khoản đã là bạn bè với Chủ Room mới xuất hiện trong danh sách Mời bạn. Người chưa kết bạn không được mời trực tiếp bằng chức năng này.

<a id="p104"></a>**¶104** • Nếu Chủ Room muốn mời một người chưa phải bạn bè, Chủ Room phải kết bạn với người đó trước hoặc sử dụng mã Room/đường link Room để gửi qua ứng dụng bên ngoài.

<a id="p105"></a>**¶105** • Chức năng mời trực tiếp trong game chỉ khả dụng với bạn bè đang Online.

<a id="p106"></a>**¶106** • Với người đang Offline, nút Mời không khả dụng hoặc hệ thống thông báo “Người chơi hiện đang Offline”.

<a id="p107"></a>**¶107** • Đối với bạn bè Offline, Chủ Room có thể sao chép mã Room hoặc đường link Room và tự gửi qua Zalo, Messenger, Facebook hoặc ứng dụng khác.

<a id="p108"></a>**¶108** • Chủ Room chọn một người bạn đang Online và nhấn Mời.

<a id="p109"></a>**¶109** • Trước khi tạo lời mời, hệ thống kiểm tra lại:

<a id="p110"></a>**¶110** Chủ Room vẫn còn ở trong Room;

<a id="p111"></a>**¶111** Room vẫn còn hoạt động;

<a id="p112"></a>**¶112** hai tài khoản vẫn còn là bạn bè;

<a id="p113"></a>**¶113** người nhận vẫn đang Online;

<a id="p114"></a>**¶114** lời mời trực tiếp khác của Chủ Room không còn ở trạng thái chờ xử lý.

<a id="p115"></a>**¶115** • Nếu người được chọn đã chuyển sang Offline trước khi lời mời được gửi, hệ thống không tạo lời mời và thông báo người chơi hiện không còn Online.

<a id="p116"></a>**¶116** • Nếu hai người đã hủy kết bạn trước thời điểm gửi lời mời, hệ thống không cho phép gửi lời mời trực tiếp và yêu cầu Chủ Room cập nhật lại danh sách Bạn bè.

<a id="p117"></a>**¶117** • Nếu các điều kiện hợp lệ, hệ thống tạo một lời mời vào Room gắn với:

<a id="p118"></a>**¶118** Room hiện tại;

<a id="p119"></a>**¶119** Chủ Room;

<a id="p120"></a>**¶120** người bạn được mời;

<a id="p121"></a>**¶121** thời điểm gửi;

<a id="p122"></a>**¶122** trạng thái lời mời.

<a id="p123"></a>**¶123** • Người được mời nhận thông báo trong game, tối thiểu hiển thị:

<a id="p124"></a>**¶124** tên người mời;

<a id="p125"></a>**¶125** tên Room;

<a id="p126"></a>**¶126** hai lựa chọn Tham gia và Từ chối.

<a id="p127"></a>**¶127** • Ngay khi lời mời được gửi thành công, hệ thống bắt đầu bộ đếm 60 giây.

<a id="p128"></a>**¶128** • Trên màn hình Chủ Room hiển thị trạng thái: Đang chờ phản hồi – 60s và thời gian giảm dần.

<a id="p129"></a>**¶129** • Người được mời cũng nhìn thấy thời gian còn lại của lời mời để biết yêu cầu còn hiệu lực hay không.

<a id="p130"></a>**¶130** • Bộ đếm 60 giây chỉ là thời hạn phản hồi của lời mời, hoàn toàn không giữ trước hoặc khóa ô Đối thủ.

<a id="p131"></a>**¶131** • Trong thời gian chờ phản hồi, Room vẫn hoạt động bình thường.

<a id="p132"></a>**¶132** • Nếu là Room công khai và ô Đối thủ đang trống, một người dùng khác vẫn có thể tham gia Room và trở thành Đối thủ trước khi người được mời phản hồi.

<a id="p133"></a>**¶133** Khi người được mời chọn Tham gia

<a id="p134"></a>**¶134** • Nếu người được mời chọn Tham gia trong thời hạn 60 giây, hệ thống kiểm tra lại:

<a id="p135"></a>**¶135** lời mời vẫn còn hiệu lực;

<a id="p136"></a>**¶136** Room vẫn tồn tại;

<a id="p137"></a>**¶137** người dùng chưa bị Chủ Room đá khỏi Room;

<a id="p138"></a>**¶138** Room chưa vượt quá giới hạn người tham gia;

<a id="p139"></a>**¶139** trạng thái hiện tại của ô Đối thủ.

<a id="p140"></a>**¶140** • Nếu ô Đối thủ vẫn đang Trống và Match chưa bắt đầu, người được mời vào Room và trở thành Đối thủ.

<a id="p141"></a>**¶141** • Nếu ô Đối thủ đã có người, người được mời không được thay thế Đối thủ hiện tại mà vào Room với vai trò Khán giả, nếu Room vẫn còn chỗ cho Khán giả.

<a id="p142"></a>**¶142** • Nếu Room đã đủ số Khán giả tối đa, hệ thống từ chối tham gia và thông báo Room hiện đã đầy.

<a id="p143"></a>**¶143** • Nếu Match đã bắt đầu, người được mời chỉ được vào với vai trò Khán giả và không được thay thế một trong hai người đang thi đấu.

<a id="p144"></a>**¶144** • Sau khi người được mời tham gia Room thành công, bộ đếm 60 giây dừng và lời mời được chuyển sang trạng thái Đã hoàn thành.

<a id="p145"></a>**¶145** Khi người được mời Từ chối

<a id="p146"></a>**¶146** • Nếu người được mời chọn Từ chối, lời mời kết thúc ngay.

<a id="p147"></a>**¶147** • Chủ Room nhận được thông báo:

<a id="p148"></a>**¶148** “Người chơi đã từ chối lời mời.”

<a id="p149"></a>**¶149** • Việc từ chối không làm thay đổi trạng thái Room hoặc ô Đối thủ.

<a id="p150"></a>**¶150** • Sau đó Chủ Room có thể gửi lời mời mới cho một người bạn khác.

<a id="p151"></a>**¶151** Khi hết 60 giây

<a id="p152"></a>**¶152** • Nếu hết 60 giây mà người được mời chưa chọn Tham gia hoặc Từ chối, lời mời tự động chuyển sang trạng thái Hết hạn.

<a id="p153"></a>**¶153** • Hệ thống xóa trạng thái Đang chờ phản hồi khỏi màn hình Chủ Room.

<a id="p154"></a>**¶154** • Room tiếp tục hoạt động theo trạng thái hiện tại và không thay đổi vai trò của bất kỳ người nào.

<a id="p155"></a>**¶155** • Người được mời không thể sử dụng lại lời mời đã hết hạn để tham gia Room.

<a id="p156"></a>**¶156** • Nếu muốn mời lại cùng người đó, Chủ Room phải tạo một lời mời mới.

<a id="p157"></a>**¶157** Hủy lời mời

<a id="p158"></a>**¶158** • Trong thời gian lời mời còn hiệu lực, Chủ Room có thể chọn Hủy lời mời.

<a id="p159"></a>**¶159** • Khi Chủ Room hủy, lời mời hết hiệu lực ngay và người được mời không còn có thể sử dụng lời mời đó để tham gia.

<a id="p160"></a>**¶160** • Người được mời nhận thông báo rằng lời mời đã bị hủy nếu thông báo lời mời vẫn đang hiển thị.

<a id="p161"></a>**¶161** Các trường hợp lời mời tự mất hiệu lực

<a id="p162"></a>**¶162** • Lời mời tự động hết hiệu lực nếu Room bị đóng.

<a id="p163"></a>**¶163** • Nếu Chủ Room rời Room và quyền Chủ Room được chuyển cho người khác, các lời mời đang chờ do Chủ Room cũ gửi hết hiệu lực. Chủ Room mới phải tạo lời mời mới nếu muốn mời người khác.

<a id="p164"></a>**¶164** • Nếu người được mời bị Chủ Room đá khỏi Room và đang bị chặn tham gia lại Room đó, lời mời cũ không được sử dụng để vượt qua quyền chặn.

<a id="p165"></a>**¶165** • Tại một thời điểm, một Chủ Room chỉ có một lời mời vào Room đang chờ phản hồi để tránh nhiều lời mời song song gây khó xác định trạng thái.

<a id="p167"></a>**¶167** 5. Mời bằng đường link và mạng xã hội

<a id="p168"></a>**¶168** Mục tiêu: Chủ Room có thể chia sẻ đường link Room qua ứng dụng bên thứ ba để người nhận truy cập đúng Room.

<a id="p169"></a>**¶169** • Trong Room, Chủ Room chọn Mời bạn và chọn Chia sẻ link.

<a id="p170"></a>**¶170** • Hệ thống hiển thị đường link của Room hiện tại và cho phép Chủ Room chọn Sao chép link.

<a id="p171"></a>**¶171** • Sau khi sao chép, Chủ Room có thể tự gửi link qua Zalo, Messenger, Facebook hoặc ứng dụng khác. Hệ thống game chỉ cung cấp link, không tự gửi tin nhắn thay người dùng.

<a id="p172"></a>**¶172** • Khi người nhận mở link, hệ thống xác định Room tương ứng.

<a id="p173"></a>**¶173** • Nếu người nhận chưa đăng nhập, hệ thống xử lý đăng nhập theo mục 2 rồi đưa người dùng trở lại đúng Room.

<a id="p174"></a>**¶174** • Nếu Room không còn tồn tại hoặc đã bị đóng, hệ thống thông báo Room không còn khả dụng.

<a id="p175"></a>**¶175** • Nếu Room còn hoạt động, người dùng được đưa vào Room và vai trò được xác định theo trạng thái hiện tại: nếu ô Đối thủ đang trống và người đó là người được xử lý đầu tiên thì có thể trở thành Đối thủ; nếu Room đã có Đối thủ thì vào với vai trò Khán giả.

<a id="p176"></a>**¶176** • Nếu trận đã bắt đầu, người mở link chỉ được vào với vai trò Khán giả và không được thay thế người đang thi đấu.

<a id="p177"></a>**¶177** 6. Tham gia Room và xác định vai trò

<a id="p178"></a>**¶178** 6.1. Tham gia Room công khai

<a id="p179"></a>**¶179** Mục tiêu: xác định rõ cách người dùng trở thành Đối thủ hoặc Khán giả trong Room công khai.

<a id="p180"></a>**¶180** • Room công khai được hiển thị trong danh sách để những người dùng khác nhìn thấy. Người dùng phải đăng nhập trước khi vào bên trong Room.

<a id="p181"></a>**¶181** • Mỗi Room trong danh sách công khai hiển thị tối thiểu tên Room, tên Chủ Room và trạng thái hiện tại của Room để người dùng biết tình trạng trước khi tham gia.

<a id="p182"></a>**¶182** • Trạng thái Room được hiển thị theo các trường hợp chính:

<a id="p183"></a>**¶183** Đang chờ Đối thủ: Room đã có Chủ Room nhưng ô Đối thủ đang trống.

<a id="p184"></a>**¶184** Đã đủ hai người: Room đã có Chủ Room và Đối thủ nhưng Match chưa bắt đầu.

<a id="p185"></a>**¶185** Đang diễn ra: Chủ Room và Đối thủ đã bắt đầu Match.

<a id="p186"></a>**¶186** • Khi trạng thái Room thay đổi, thông tin trong danh sách Room công khai phải được cập nhật để người dùng không nhìn thấy trạng thái cũ.

<a id="p187"></a>**¶187** • Người dùng có thể chọn một Room từ danh sách để tham gia. Vai trò sau khi vào vẫn được xác định theo quy tắc của Room: Room đang chờ Đối thủ thì người đủ điều kiện có thể trở thành Đối thủ; Room đã có đủ hai người hoặc đang diễn ra thì người vào sau trở thành Khán giả.

<a id="p188"></a>**¶188** • Room đã bị đóng hoặc không còn hoạt động phải được loại khỏi danh sách Room công khai.

<a id="p189"></a>**¶189** • Người tạo Room là Chủ Room.

<a id="p190"></a>**¶190** • Nếu Room chỉ có Chủ Room và ô Đối thủ đang trống, người dùng đầu tiên tham gia sau Chủ Room tự động trở thành Đối thủ.

<a id="p191"></a>**¶191** • Khi trở thành Đối thủ, thông tin của người đó được hiển thị tại ô Đối thủ và chức năng Sẵn sàng được kích hoạt.

<a id="p192"></a>**¶192** • Sau khi Room đã có Chủ Room và Đối thủ, những người vào sau được xác định là Khán giả.

<a id="p193"></a>**¶193** • Nếu nhiều người cùng tham gia gần như đồng thời khi ô Đối thủ đang trống, máy chủ chỉ xác nhận một người đầu tiên trở thành Đối thủ; những người còn lại vào Room với vai trò Khán giả.

<a id="p194"></a>**¶194** • Khán giả được xem trạng thái Room và theo dõi bàn cờ khi trận diễn ra nhưng không được điều khiển quân cờ, thay đổi lượt, bấm Sẵn sàng, bắt đầu trận, gửi nước đi hoặc tác động đến kết quả.

<a id="p195"></a>**¶195** • Khán giả tuyệt đối không được sử dụng khung Chat của hai người chơi và

<a id="p196"></a>**¶196** được nhìn thấy tin nhắn giữa Chủ Room và Đối thủ.

<a id="p197"></a>**¶197** • Khán giả không được tham gia hoặc xem Video Call của hai người chơi.

<a id="p198"></a>**¶198** Khi ô Đối thủ trống nhưng trong Room đã có Khán giả

<a id="p199"></a>**¶199** • Nếu Đối thủ rời Room trước khi trận bắt đầu hoặc bị Chủ Room loại khỏi vị trí Đối thủ, ô Đối thủ trở lại trạng thái Trống.

<a id="p200"></a>**¶200** • Hệ thống không tự động kéo một Khán giả lên làm Đối thủ.

<a id="p201"></a>**¶201** • Ô Đối thủ trống được hiển thị cho tất cả Khán giả đang ở trong Room.

<a id="p202"></a>**¶202** • Bất kỳ Khán giả nào muốn chơi có thể chủ động bấm vào ô Đối thủ để chuyển từ Khán giả thành Đối thủ; không cần gửi yêu cầu xin phép Chủ Room.

<a id="p203"></a>**¶203** • Khi Khán giả bấm vào ô Đối thủ, hệ thống kiểm tra ô vẫn còn trống, người đó vẫn đang ở Room và trận chưa bắt đầu.

<a id="p204"></a>**¶204** • Nếu hợp lệ, người đầu tiên được máy chủ xác nhận thành công trở thành Đối thủ. Người đó nhận thông báo “Bạn đã trở thành Đối thủ”, giao diện chuyển sang chế độ người chơi và nút Sẵn sàng được kích hoạt.

<a id="p205"></a>**¶205** • Nếu nhiều Khán giả cùng bấm vào ô Đối thủ gần như đồng thời, hệ thống chỉ cho phép một người đầu tiên được xử lý thành công; những người còn lại nhận thông báo vị trí đã có người và vẫn là Khán giả.

<a id="p206"></a>**¶206** • Nếu không có Khán giả nào chủ động vào vị trí Đối thủ, Room tiếp tục ở trạng thái Đang chờ người chơi.

<a id="p207"></a>**¶207** Quyền quản lý Đối thủ của Chủ Room trước trận

<a id="p208"></a>**¶208** • Trước khi Match được tạo, Chủ Room có quyền quản lý người đang giữ vị trí Đối thủ.

<a id="p209"></a>**¶209** • Nếu Chủ Room không muốn người hiện tại làm Đối thủ, Chủ Room có thể chọn Loại khỏi vị trí Đối thủ. Người đó được chuyển về vai trò Khán giả và ô Đối thủ trở lại Trống.

<a id="p210"></a>**¶210** • Nếu Chủ Room không muốn người đó tiếp tục ở trong Room, Chủ Room có thể chọn Mời rời Room/Đá khỏi Room. Người đó bị đưa ra khỏi Room và không còn thuộc danh sách người tham gia hiện tại.

<a id="p211"></a>**¶211** • Sau khi ô Đối thủ trống trở lại, Khán giả khác có thể chủ động bấm vào ô Đối thủ theo quy tắc phía trên.

<a id="p212"></a>**¶212** • Khi Match đã bắt đầu, Chủ Room không được dùng quyền quản lý Room để loại Đối thủ giữa trận hoặc thay người chơi nhằm thay đổi kết quả. Từ thời điểm đó việc rời trận và mất kết nối được xử lý theo Phase 3.

<a id="p213"></a>**¶213** • Người bị Loại khỏi vị trí Đối thủ vẫn được ở lại Room với vai trò Khán giả và sau này có thể trở lại vị trí Đối thủ nếu ô trống.

<a id="p214"></a>**¶214** • Người bị Đá khỏi Room không được tham gia lại chính Room đó trong thời gian Room còn tồn tại, kể cả bằng danh sách công khai, mã Room hoặc link mời.

<a id="p215"></a>**¶215** • Khi Room bị đóng, quyền chặn theo Room hết hiệu lực.

<a id="p216"></a>**¶216** 6.2. Tham gia Room bằng mã Room

<a id="p217"></a>**¶217** • Tại màn hình chính, người dùng chọn Tham gia bằng mã Room.

<a id="p218"></a>**¶218** • Hệ thống hiển thị ô nhập mã. Người dùng nhập mã và chọn Tham gia.

<a id="p219"></a>**¶219** • Nếu để trống hoặc mã sai định dạng, hệ thống không gửi yêu cầu và yêu cầu người dùng nhập lại.

<a id="p220"></a>**¶220** • Hệ thống kiểm tra mã có tương ứng với một Room đang hoạt động hay không.

<a id="p221"></a>**¶221** • Nếu không tìm thấy, hệ thống thông báo “Không tìm thấy Room”. Nếu Room đã bị đóng hoặc không còn hoạt động, hệ thống thông báo “Room không còn khả dụng”.

<a id="p222"></a>**¶222** • Nếu mã hợp lệ, hệ thống đưa người dùng vào đúng Room.

<a id="p223"></a>**¶223** • Sau khi vào Room, vai trò được xác định theo cùng quy tắc: nếu chỉ có Chủ Room và ô Đối thủ đang trống thì người dùng được xử lý đầu tiên có thể trở thành Đối thủ; nếu đã có Đối thủ thì người dùng trở thành Khán giả; nếu ô Đối thủ trống nhưng Room đã có Khán giả thì người dùng vào với vai trò Khán giả và có thể chủ động bấm vào ô Đối thủ.

<a id="p224"></a>**¶224** • Nếu người dùng bấm Tham gia nhiều lần liên tiếp, hệ thống chỉ xử lý một yêu cầu.

<a id="p225"></a>**¶225** 6.3. Chuyển quyền Chủ Room và quản lý người trong Room

<a id="p226"></a>**¶226** Mục tiêu: Room vẫn có người quản lý khi Chủ Room rời đi, theo đúng thứ tự ưu tiên Đối thủ trước rồi đến Khán giả theo thời điểm tham gia.

<a id="p227"></a>**¶227** • Khi Chủ Room chủ động rời Room trước khi trận bắt đầu, hệ thống không đóng Room ngay nếu vẫn còn người khác trong Room.

<a id="p228"></a>**¶228** • Quyền Chủ Room được chuyển theo thứ tự ưu tiên: Đối thủ hiện tại trước; nếu không có Đối thủ thì chuyển cho Khán giả vào Room sớm nhất; tiếp theo là Khán giả thứ 2, Khán giả thứ 3 và tiếp tục theo thứ tự thời điểm tham gia.

<a id="p229"></a>**¶229** • Nếu Đối thủ được chuyển thành Chủ Room, người đó chuyển từ ô Đối thủ sang vị trí Chủ Room; ô Đối thủ trở thành Trống. Các Khán giả còn lại có thể chủ động bấm vào ô Đối thủ để trở thành người chơi mới.

<a id="p230"></a>**¶230** • Nếu không có Đối thủ và một Khán giả được chuyển thành Chủ Room, người đó rời danh sách Khán giả và đảm nhận quyền quản lý Room; ô Đối thủ vẫn giữ trạng thái Trống.

<a id="p231"></a>**¶231** • Hệ thống thông báo cho toàn bộ người còn lại biết ai là Chủ Room mới và cập nhật ngay quyền quản lý trên giao diện.

<a id="p232"></a>**¶232** • Khi quyền Chủ Room được chuyển cho một người mới trước khi Match bắt đầu, toàn bộ trạng thái Sẵn sàng hiện tại của Room được đặt lại về Chưa sẵn sàng.

<a id="p233"></a>**¶233** • Nếu Đối thủ cũ được chuyển thành Chủ Room, trạng thái Sẵn sàng trước đó của người này trong vai trò Đối thủ không được giữ lại.

<a id="p234"></a>**¶234** • Sau khi trở thành Chủ Room, người đó phải tự xác nhận Sẵn sàng lại với vai trò mới.

<a id="p235"></a>**¶235** • Nếu sau đó một Khán giả chủ động vào ô Đối thủ, Đối thủ mới cũng phải tự bấm Sẵn sàng.

<a id="p236"></a>**¶236** • Chỉ khi Chủ Room mới và Đối thủ hiện tại đều xác nhận Sẵn sàng sau quá trình chuyển quyền thì hệ thống mới cho phép tạo Match.

<a id="p237"></a>**¶237** • Việc reset Sẵn sàng khi chuyển Chủ Room chỉ áp dụng khi Match chưa được tạo. Nếu Match đang diễn ra thì việc rời hoặc mất kết nối được xử lý theo Phase 3 và không thay đổi người chơi giữa Match.

<a id="p238"></a>**¶238** • Nếu Room không còn bất kỳ người dùng nào sau khi Chủ Room rời, Room bị đóng và mã/link của Room hết hiệu lực.

<a id="p239"></a>**¶239** • Trong trường hợp Chủ Room mất kết nối ngoài ý muốn khi trận đang diễn ra, hệ thống chưa chuyển quyền Chủ Room ngay mà chờ theo cơ chế kết nối lại 60 giây ở Phase 3.

<a id="p240"></a>**¶240** • Nếu Chủ Room quay lại trong thời gian chờ, quyền Chủ Room được giữ nguyên.

<a id="p241"></a>**¶241** • Nếu hết thời gian kết nối lại và người đó bị xác định rời trận, hệ thống chốt kết quả trận trước rồi mới chuyển quyền Chủ Room cho người còn lại theo thứ tự ưu tiên: Đối thủ trước, sau đó tới Khán giả theo thứ tự tham gia.

<a id="p242"></a>**¶242** • Khi quyền Chủ Room đã chuyển sang người mới, các lời mời trực tiếp đang chờ phản hồi do Chủ Room cũ tạo ra hết hiệu lực; Chủ Room mới có thể gửi lời mời mới nếu cần.

<a id="p243"></a>**¶243** 7. Sẵn sàng, bắt đầu và rời Room trước trận

<a id="p244"></a>**¶244** Mục tiêu: trận chỉ được tạo khi Room có đúng Chủ Room và Đối thủ, cả hai đều đang ở trong Room và đã Sẵn sàng.

<a id="p245"></a>**¶245** • Khi Room có đủ Chủ Room và Đối thủ, hệ thống cho phép hai người sử dụng chức năng Sẵn sàng.

<a id="p246"></a>**¶246** • Hệ thống duy trì kết nối Real-time để trạng thái Sẵn sàng của một người được cập nhật ngay cho người còn lại.

<a id="p247"></a>**¶247** • Khi một người bấm Sẵn sàng, hệ thống cập nhật trạng thái tương ứng trên cả hai màn hình.

<a id="p248"></a>**¶248** • Chỉ khi cả Chủ Room và Đối thủ đều Sẵn sàng, Chủ Room mới được phép chọn Bắt đầu.

<a id="p249"></a>**¶249** • Nếu một trong hai người bỏ trạng thái Sẵn sàng trước khi Match được tạo, nút Bắt đầu không còn khả dụng cho đến khi cả hai Sẵn sàng trở lại.

<a id="p250"></a>**¶250** • Nếu Đối thủ rời hoặc bị Chủ Room loại khỏi vị trí trước trận, Match chưa được tạo và ô Đối thủ trở lại Trống.

<a id="p251"></a>**¶251** • Khi Đối thủ rời Room, bị Chủ Room loại khỏi vị trí Đối thủ hoặc được thay bằng một người khác trước khi Match được tạo, trạng thái Sẵn sàng của Đối thủ cũ lập tức hết hiệu lực.

<a id="p252"></a>**¶252** • Người mới trở thành Đối thủ không được kế thừa trạng thái Sẵn sàng của người trước đó và phải tự bấm Sẵn sàng.

<a id="p253"></a>**¶253** • Hệ thống chỉ sử dụng trạng thái Sẵn sàng của đúng hai tài khoản hiện đang giữ vai trò Chủ Room và Đối thủ để quyết định có cho phép Bắt đầu Match hay không.

<a id="p254"></a>**¶254** • Nếu thành phần hai người chơi thay đổi trước trận, hệ thống tuyệt đối không sử dụng trạng thái Sẵn sàng đã lưu của người chơi cũ để tạo Match.

<a id="p255"></a>**¶255** • Vì vậy, việc Đối thủ cũ đã từng Sẵn sàng không làm cho Đối thủ mới vừa vào Room tự động ở trạng thái Sẵn sàng.

<a id="p256"></a>**¶256** • Nếu Chủ Room rời trước trận, hệ thống chuyển quyền Chủ Room theo mục 6.3 thay vì đóng Room nếu vẫn còn người.

<a id="p257"></a>**¶257** • Nếu Chủ Room nhấn Bắt đầu nhiều lần liên tiếp, hệ thống chỉ tạo một Match duy nhất.

<a id="p258"></a>**¶258** • Khi Match được tạo, hai vị trí người chơi được khóa cho Match hiện tại. Khán giả không thể thay thế một trong hai người giữa trận.

<a id="p260"></a>**¶260** PHASE 2 – KHỞI TẠO TRẬN VÀ CHƠI CỜ TRỰC TUYẾN

<a id="p261"></a>**¶261** 1. Khởi tạo trận đấu và đồng bộ Real-time

<a id="p262"></a>**¶262** Mục tiêu: cả hai người chơi nhìn thấy cùng một trạng thái bàn cờ, biết rõ ai đi trước và mọi thay đổi được đồng bộ từ máy chủ.

<a id="p263"></a>**¶263** • Sau khi Chủ Room bấm Bắt đầu hợp lệ, hệ thống tạo trận với đúng hai người đang giữ vị trí Chủ Room và Đối thủ.

<a id="p264"></a>**¶264** • Hệ thống sinh một định danh Match riêng để phân biệt trận hiện tại với các trận khác và gắn hai người chơi vào Match đó.

<a id="p265"></a>**¶265** • Hai người chơi được đưa vào cùng một nhóm kết nối Real-time của Match.

<a id="p266"></a>**¶266** • Trong phiên bản này, kết nối Real-time được triển khai bằng SignalR/WebSocket hoặc công nghệ tương đương, giúp các thay đổi trong Room và Match được gửi ngay tới các client liên quan mà không cần tải lại trang.

<a id="p267"></a>**¶267** • Các sự kiện như nước đi, thay đổi lượt, trạng thái bàn cờ, thời gian và kết quả trận chỉ được đồng bộ tới đúng Match liên quan.

<a id="p268"></a>**¶268** • Khán giả đang theo dõi Room cũng được kết nối vào luồng cập nhật Real-time của Match nhưng chỉ với quyền xem.

<a id="p269"></a>**¶269** • Khi trạng thái Match thay đổi, Khán giả nhận các thông tin cần thiết để theo dõi như vị trí quân cờ, quân đã bị ăn, bên đang tới lượt, thời gian còn lại, trạng thái Chiếu Tướng và kết quả trận.

<a id="p270"></a>**¶270** • Khán giả chỉ được nhận dữ liệu từ Match, không được gửi yêu cầu di chuyển quân, thay đổi lượt, Sẵn sàng, bắt đầu trận hoặc thay đổi bất kỳ trạng thái thi đấu nào.

<a id="p271"></a>**¶271** • Nếu một Khán giả vào Room sau khi Match đã bắt đầu, hệ thống trước tiên tải trạng thái bàn cờ hiện tại của Match cho người đó, sau đó mới tiếp tục gửi các thay đổi mới qua kết nối Real-time.

<a id="p272"></a>**¶272** • Vì vậy Khán giả vào giữa trận phải nhìn thấy trạng thái bàn cờ hiện tại, không được nhìn thấy bàn cờ khởi đầu rồi chờ nước đi tiếp theo mới đồng bộ.

<a id="p273"></a>**¶273** • Nếu nhiều Khán giả cùng theo dõi, việc gửi trạng thái cho Khán giả không được làm thay đổi trạng thái chính thức của Match hoặc quyền thao tác của hai người chơi.

<a id="p274"></a>**¶274** • Người chơi chỉ gửi yêu cầu thao tác. Máy chủ kiểm tra và xác nhận trạng thái chính thức trước khi gửi kết quả lại cho hai bên; client không tự quyết định một nước đi đã hợp lệ.

<a id="p275"></a>**¶275** • Hệ thống phân ngẫu nhiên một lần bên Đỏ và bên Đen. Kết quả được giữ nguyên trong suốt trận; bên Đỏ luôn đi trước.

<a id="p276"></a>**¶276** • Bàn cờ xuất hiện ở vị trí bắt đầu chuẩn, hiển thị tên hai người, màu quân của mỗi bên và đồng hồ lượt.

<a id="p277"></a>**¶277** • Trạng thái bàn cờ ban đầu và kết quả phân bên được máy chủ gửi cho cả hai người chơi. Hai client phải nhận cùng một trạng thái.

<a id="p278"></a>**¶278** • Chỉ sau khi trạng thái khởi đầu của Match đã được thiết lập cho cả hai bên, hệ thống mới thực hiện đếm ngược 3 - 2 - 1.

<a id="p279"></a>**¶279** • Trong thời gian đếm ngược, cả hai người đều không thể di chuyển quân. Khi đếm ngược kết thúc, trận chuyển sang Đang diễn ra và lượt đầu tiên thuộc bên Đỏ.

<a id="p280"></a>**¶280** 2. Luồng của một lượt đi

<a id="p281"></a>**¶281** Mục tiêu: mỗi nước đi được xử lý thống nhất và hai người không thấy hai trạng thái bàn cờ khác nhau.

<a id="p282"></a>**¶282** • Chỉ người đang tới lượt mới có thể chọn quân của mình. Người không tới lượt bấm vào quân sẽ không tạo ra nước đi.

<a id="p283"></a>**¶283** • Khi người chơi chọn một quân, hệ thống chỉ làm nổi bật quân đang được chọn; không hiển thị, đánh dấu hay gợi ý các ô mà quân có thể đi.

<a id="p284"></a>**¶284** • Người chơi tự quan sát bàn cờ, tự xác định nước đi và tự chọn ô đích. Hệ thống chỉ kiểm tra tính hợp lệ sau khi người chơi đã chọn nước đi.

<a id="p285"></a>**¶285** • Nếu người chơi chọn một nước không hợp lệ nhưng trên bàn cờ vẫn còn ít nhất một nước hợp lệ khác, hệ thống thông báo “Nước đi không hợp lệ”, giữ nguyên bàn cờ, không đổi lượt và không gợi ý nước thay thế.

<a id="p286"></a>**¶286** • Khi người chơi chọn ô đích, hệ thống kiểm tra toàn bộ điều kiện của nước đi trước khi thay đổi bàn cờ.

<a id="p287"></a>**¶287** • Nếu nước đi hợp lệ, quân được di chuyển tới ô đích; nếu ô đích có quân đối phương thì quân đó bị ăn; lịch sử nước đi được ghi lại; sau đó chuyển lượt cho đối thủ nếu trận chưa kết thúc.

<a id="p288"></a>**¶288** • Khi một quân bị ăn hợp lệ, quân bị ăn phải được loại khỏi bàn cờ ngay trên cả hai màn hình và không còn được chọn ở các lượt sau.

<a id="p289"></a>**¶289** • Hệ thống có thể hiển thị khu vực Quân đã bị ăn để người chơi theo dõi các quân đã rời khỏi bàn cờ; khi xem lại lịch sử, quân bị ăn cũng phải biến mất đúng tại nước ăn tương ứng.

<a id="p290"></a>**¶290** • Nếu nước đi không hợp lệ, bàn cờ giữ nguyên, lượt không đổi và thời gian của người đang đi vẫn tiếp tục chạy.

<a id="p291"></a>**¶291** • Nếu cùng một thao tác bị gửi lặp do người dùng bấm nhanh hoặc lỗi mạng, một nước đi chỉ được áp dụng một lần.

<a id="p292"></a>**¶292** • Sau mỗi nước đi hợp lệ, cả hai người phải nhìn thấy cùng vị trí quân cờ, cùng lượt chơi và cùng trạng thái trận.

<a id="p293"></a>**¶293** 3. Tự động lưu trạng thái bàn cờ – Auto Save

<a id="p294"></a>**¶294** Mục tiêu: hệ thống tự động lưu trạng thái hiện tại của Match để có thể khôi phục đúng bàn cờ khi người chơi tải lại trang, mất kết nối hoặc cần xem lại lịch sử; người chơi không cần thực hiện thao tác Lưu thủ công.

<a id="p295"></a>**¶295** • Khi trận được tạo, hệ thống lưu trạng thái bàn cờ ban đầu cùng Match, hai người chơi và bên đang được quyền đi.

<a id="p296"></a>**¶296** • Sau mỗi nước đi hợp lệ, hệ thống cập nhật trạng thái bàn cờ mới.

<a id="p297"></a>**¶297** • Việc lưu được thực hiện tự động bởi hệ thống. Trong phiên bản này không có nút Lưu bàn cờ thủ công và người chơi không cần chủ động lưu sau mỗi nước đi.

<a id="p298"></a>**¶298** • Auto Save chỉ xảy ra sau khi nước đi đã được máy chủ xác nhận hợp lệ; nước đi bị từ chối không tạo một trạng thái lưu mới.

<a id="p299"></a>**¶299** • Mỗi lần Auto Save, trạng thái mới nhất của Match được cập nhật để khi người chơi tải lại trang hoặc reconnect, hệ thống có thể lấy đúng trạng thái gần nhất đã được xác nhận.

<a id="p300"></a>**¶300** • Auto Save của Match hiện tại không thay thế lịch sử của các Match đã kết thúc. Khi Match kết thúc, trạng thái cuối và toàn bộ lịch sử nước đi được lưu thành dữ liệu lịch sử của Match đó.

<a id="p301"></a>**¶301** • Khi người chơi tải lại trang hoặc kết nối lại, hệ thống tự động thực hiện Load trạng thái gần nhất theo quy tắc tại Phase 3; người chơi không phải chọn một nút Load thủ công.

<a id="p302"></a>**¶302** • Trạng thái lưu phải xác định được vị trí của tất cả quân còn trên bàn, các quân đã bị ăn, người đang tới lượt và trạng thái của trận.

<a id="p303"></a>**¶303** • Trạng thái Match phải lưu đủ thông tin để khôi phục đồng hồ lượt, bao gồm thời gian còn lại của lượt hoặc thời điểm bắt đầu lượt gần nhất.

<a id="p304"></a>**¶304** • Khi Match chuyển sang trạng thái Tạm chờ kết nối lại, thời gian đang còn lại được giữ nguyên để khi người chơi quay lại hệ thống tiếp tục từ đúng số giây đó.

<a id="p305"></a>**¶305** • Hệ thống đồng thời lưu lịch sử nước đi theo đúng thứ tự để có thể dựng lại diễn biến trận.

<a id="p306"></a>**¶306** • Nếu người chơi tải lại trang ngay sau một nước đi hợp lệ, trạng thái được tải lại phải bao gồm nước đi đó; không được quay về trạng thái cũ trước nước đi.

<a id="p307"></a>**¶307** • Nếu cùng một nước đi bị gửi lặp, hệ thống không được lưu thành nhiều nước đi khác nhau.

<a id="p308"></a>**¶308** • Khi trận kết thúc, trạng thái cuối cùng của bàn cờ và kết quả trận được lưu cùng lịch sử.

<a id="p309"></a>**¶309** 4. Quy tắc chung khi ăn quân và bảo vệ Tướng

<a id="p310"></a>**¶310** • Một quân chỉ ăn được quân đối phương nếu bản thân nước đi tới ô đó là hợp lệ theo luật của quân.

<a id="p311"></a>**¶311** • Không quân nào được dừng tại vị trí đang có quân cùng bên.

<a id="p312"></a>**¶312** • Người chơi không được thực hiện nước đi khiến Tướng của chính mình rơi vào trạng thái bị chiếu.

<a id="p313"></a>**¶313** • Nếu Tướng đang bị chiếu, nước tiếp theo bắt buộc phải đưa Tướng thoát chiếu. Nước đi không giải quyết được tình trạng chiếu bị từ chối.

<a id="p314"></a>**¶314** 5. Luật quân Xe

<a id="p315"></a>**¶315** • Xe đi theo hàng ngang hoặc cột dọc, có thể đi nhiều giao điểm trong một lượt.

<a id="p316"></a>**¶316** • Tất cả vị trí nằm giữa Xe và ô đích phải trống. Xe không được nhảy qua bất kỳ quân nào.

<a id="p317"></a>**¶317** • Xe ăn quân đối phương bằng cách đi tới đúng ô quân đó đang đứng, với điều kiện đường đi không bị cản.

<a id="p318"></a>**¶318** • Nước Xe bị từ chối nếu đi chéo, nhảy qua quân, dừng trên quân cùng bên hoặc làm Tướng của mình bị chiếu.

<a id="p319"></a>**¶319** 6. Luật quân Mã

<a id="p320"></a>**¶320** • Mã đi theo hình chữ L: một bước theo hàng/cột rồi một bước chéo ra ngoài.

<a id="p321"></a>**¶321** • Vị trí kề Mã theo hướng xuất phát được gọi là chân Mã. Nếu chân Mã có quân đứng chặn thì Mã không được đi theo hướng bị chặn đó.

<a id="p322"></a>**¶322** • Mã ăn quân khi ô đích đúng hình chữ L, chân Mã không bị chặn và ô đích có quân đối phương.

<a id="p323"></a>**¶323** • Nước Mã bị từ chối nếu sai hình chữ L, chân Mã bị chặn, ô đích có quân cùng bên hoặc làm Tướng của mình bị chiếu.

<a id="p324"></a>**¶324** 7. Luật quân Tượng

<a id="p325"></a>**¶325** • Tượng đi chéo đúng hai giao điểm trong một lượt.

<a id="p326"></a>**¶326** • Điểm chéo ở giữa đường đi là mắt Tượng. Nếu mắt Tượng có quân đứng chặn thì Tượng không đi qua được.

<a id="p327"></a>**¶327** • Tượng không được qua sông; Tượng của mỗi bên chỉ hoạt động ở nửa bàn cờ thuộc phía mình.

<a id="p328"></a>**¶328** • Tượng ăn quân đối phương khi ô đích đúng hai đường chéo, mắt Tượng trống, chưa vượt sông và ô đích có quân đối phương.

<a id="p329"></a>**¶329** • Nước Tượng bị từ chối nếu qua sông, mắt Tượng bị chặn, đi sai khoảng cách, ô đích có quân mình hoặc làm Tướng mình bị chiếu.

<a id="p330"></a>**¶330** 8. Luật quân Sĩ

<a id="p331"></a>**¶331** • Sĩ đi chéo đúng một giao điểm trong một lượt.

<a id="p332"></a>**¶332** • Sĩ luôn phải nằm trong phạm vi cung của bên mình.

<a id="p333"></a>**¶333** • Sĩ ăn quân đối phương nếu quân đó nằm ở ô chéo kề bên trong cung và nước đi không làm Tướng bị chiếu.

<a id="p334"></a>**¶334** • Sĩ không được đi ngang, đi dọc hoặc ra ngoài cung.

<a id="p335"></a>**¶335** 9. Luật quân Tướng

<a id="p336"></a>**¶336** • Tướng đi ngang hoặc dọc đúng một giao điểm và luôn phải ở trong cung của mình.

<a id="p337"></a>**¶337** • Tướng không được đi vào vị trí đang bị quân đối phương khống chế.

<a id="p338"></a>**¶338** • Hai Tướng không được đứng đối mặt trực tiếp trên cùng một cột nếu giữa hai Tướng không còn quân cản.

<a id="p339"></a>**¶339** • Nếu một nước đi của bất kỳ quân nào làm mất quân cản và khiến hai Tướng nhìn thẳng nhau, nước đi đó bị từ chối.

<a id="p340"></a>**¶340** • Tướng chỉ được ăn quân đối phương ở ô kề hợp lệ khi sau nước ăn Tướng vẫn an toàn.

<a id="p341"></a>**¶341** 10. Luật quân Pháo

<a id="p342"></a>**¶342** • Khi không ăn quân, Pháo đi ngang hoặc dọc như Xe và toàn bộ đường đi phải trống.

<a id="p343"></a>**¶343** • Khi ăn quân, giữa Pháo và quân bị ăn phải có đúng một quân làm ngòi. Quân làm ngòi có thể thuộc bất kỳ bên nào.

<a id="p344"></a>**¶344** • Pháo không được ăn quân nếu không có ngòi hoặc có từ hai quân trở lên nằm giữa Pháo và quân đích.

<a id="p345"></a>**¶345** • Pháo không đi chéo và không được dừng tại ô có quân cùng bên.

<a id="p346"></a>**¶346** 11. Luật quân Tốt

<a id="p347"></a>**¶347** • Tốt Đỏ di chuyển từ phía quân Đỏ về phía quân Đen. Trước khi qua sông, Tốt Đỏ chỉ được tiến thẳng một giao điểm và không được đi ngang.

<a id="p348"></a>**¶348** • Sau khi qua sông, Tốt Đỏ được tiến thẳng một giao điểm hoặc đi ngang trái/phải một giao điểm; Tốt Đỏ không bao giờ được đi lùi.

<a id="p349"></a>**¶349** • Tốt Đen di chuyển từ phía quân Đen về phía quân Đỏ theo hướng hoàn toàn ngược lại. Trước khi qua sông chỉ được tiến thẳng một giao điểm; sau khi qua sông được tiến thẳng hoặc đi ngang trái/phải một giao điểm và không được đi lùi.

<a id="p350"></a>**¶350** • Tốt ăn quân theo đúng hướng mà nó được phép di chuyển ở thời điểm đó; không có cách ăn riêng.

<a id="p351"></a>**¶351** • Nước Tốt bị từ chối nếu đi sai hướng, đi quá một giao điểm, vào ô có quân cùng bên hoặc làm Tướng của mình bị chiếu.

<a id="p352"></a>**¶352** • Dù giao diện có xoay bàn cờ cho người chơi nhìn từ phía của mình, hướng đi thực tế của Tốt Đỏ và Tốt Đen vẫn phải đúng theo hai phía của bàn cờ.

<a id="p353"></a>**¶353** 12. Chiếu Tướng, chiếu bí và hết nước đi hợp lệ

<a id="p354"></a>**¶354** • Sau mỗi nước đi hợp lệ, hệ thống kiểm tra Tướng của bên sắp tới lượt có đang bị tấn công hay không.

<a id="p355"></a>**¶355** • Nếu bị tấn công, hệ thống hiển thị trạng thái Chiếu Tướng.

<a id="p356"></a>**¶356** • Bên đang bị chiếu chỉ được thực hiện nước đi giúp thoát khỏi tình trạng chiếu.

<a id="p357"></a>**¶357** • Hệ thống không gợi ý nước thoát chiếu. Nếu người chơi chọn một nước không giải quyết được tình trạng chiếu nhưng vẫn còn nước hợp lệ khác, nước đó bị từ chối và người chơi tiếp tục tự chọn nước khác trong thời gian còn lại.

<a id="p358"></a>**¶358** • Nếu đang bị chiếu và không còn bất kỳ nước đi hợp lệ nào để thoát, trận kết thúc do Chiếu bí: bên bị chiếu thua và bên còn lại thắng.

<a id="p359"></a>**¶359** • Chỉ khi đến lượt mà hệ thống xác định người chơi không còn bất kỳ nước đi hợp lệ nào thì người đó mới bị xử thua, dù Tướng có đang bị chiếu hay không. Nếu vẫn còn ít nhất một nước hợp lệ thì không được xử thua chỉ vì vừa chọn sai.

<a id="p361"></a>**¶361** PHASE 3 – THỜI GIAN, MẤT KẾT NỐI VÀ KẾT QUẢ

<a id="p362"></a>**¶362** 1. Đồng hồ lượt và AFK

<a id="p363"></a>**¶363** Mục tiêu: mỗi lượt có giới hạn rõ ràng để trận không bị treo vì một người bỏ máy.

<a id="p364"></a>**¶364** • Mỗi lượt có 60 giây. Khi tới lượt ai, đồng hồ của người đó bắt đầu giảm; người còn lại không bị tính thời gian.

<a id="p365"></a>**¶365** • Khi còn 10 giây, hệ thống hiển thị cảnh báo thời gian sắp hết.

<a id="p366"></a>**¶366** • Nếu một nước đi hợp lệ được máy chủ ghi nhận trước khi đồng hồ về 0, nước đi được chấp nhận và trận tiếp tục.

<a id="p367"></a>**¶367** • Nếu đồng hồ về 0 trước khi có nước đi hợp lệ, người đang tới lượt bị xử thua do hết thời gian/AFK và đối thủ được xử thắng.

<a id="p368"></a>**¶368** • Đi nước sai không làm đồng hồ quay lại từ đầu. Người chơi không thể liên tục thử nước sai để kéo dài lượt.

<a id="p369"></a>**¶369** • AFK khi trận chưa bắt đầu không tạo thắng/thua vì lúc đó chưa có Match chính thức.

<a id="p370"></a>**¶370** 2. Rời trận chủ động

<a id="p371"></a>**¶371** • Trong khi trận đang diễn ra, người chơi chọn Rời trận/Thoát trận thì hệ thống hiển thị xác nhận rằng hành động này sẽ được tính là thua.

<a id="p372"></a>**¶372** • Nếu người chơi hủy xác nhận, trận tiếp tục bình thường.

<a id="p373"></a>**¶373** • Nếu người chơi xác nhận rời, trận kết thúc ngay: người rời bị xử thua và đối thủ thắng. Không áp dụng thời gian chờ kết nối lại cho trường hợp rời chủ động.

<a id="p374"></a>**¶374** • Sau khi Match kết thúc vì một người rời, hệ thống cập nhật kết quả trước rồi mới xử lý việc chuyển quyền Chủ Room nếu người rời là Chủ Room.

<a id="p375"></a>**¶375** • Nếu người rời là Chủ Room, quyền Chủ Room được chuyển cho Đối thủ còn lại; nếu Đối thủ cũng không còn trong Room thì chuyển tiếp cho Khán giả theo thứ tự tham gia.

<a id="p376"></a>**¶376** 3. Mất kết nối ngoài ý muốn, Load bàn cờ và kết nối lại

<a id="p377"></a>**¶377** Mục tiêu: người chơi không bị xử thua ngay chỉ vì mạng chập chờn, đóng tab hoặc tải lại trang.

<a id="p378"></a>**¶378** • Khi một người mất mạng, đóng tab đột ngột, tải lại trang hoặc mất kết nối với trận ngoài ý muốn, trận chuyển sang trạng thái Tạm chờ kết nối lại.

<a id="p379"></a>**¶379** • Người còn lại nhìn thấy thông báo đối thủ đang mất kết nối và bộ đếm chờ 60 giây.

<a id="p380"></a>**¶380** • Trong thời gian chờ kết nối lại, trận tạm dừng để không đồng thời tính cả lỗi mất mạng và AFK.

<a id="p381"></a>**¶381** • Nếu người chơi quay lại trong 60 giây, hệ thống xác định Match mà tài khoản đang tham gia và kiểm tra quyền của tài khoản trong Match.

<a id="p382"></a>**¶382** • Hệ thống lấy trạng thái bàn cờ mới nhất đã lưu, bao gồm vị trí quân, quân đã bị ăn, bên đang tới lượt, thời gian còn lại và trạng thái trận.

<a id="p383"></a>**¶383** • Bàn cờ được dựng lại đúng theo trạng thái đã lưu; việc Load không tự thay đổi lượt, vị trí quân hoặc kết quả.

<a id="p384"></a>**¶384** • Sau khi Load thành công, người chơi được đưa trở lại nhóm kết nối Real-time của Match và trận tiếp tục từ trạng thái trước khi mất kết nối.

<a id="p385"></a>**¶385** • Nếu Match đã kết thúc trong thời gian người chơi mất kết nối, hệ thống hiển thị kết quả đã ghi nhận và không cho đi quân tiếp.

<a id="p386"></a>**¶386** • Nếu không tìm thấy trạng thái Match hợp lệ, hệ thống không tự tạo bàn cờ ban đầu để tiếp tục một trận cũ mà phải thông báo lỗi.

<a id="p387"></a>**¶387** • Nếu quá 60 giây mà người chơi không quay lại, người mất kết nối bị xử thua và người còn kết nối được xử thắng.

<a id="p388"></a>**¶388** • Nếu người mất kết nối quá 60 giây là Chủ Room, hệ thống chốt kết quả trước rồi chuyển quyền Chủ Room theo mục 6.3 của Phase 1.

<a id="p389"></a>**¶389** • Nếu cả hai cùng mất kết nối do lỗi toàn hệ thống hoặc không thể xác định bên gây gián đoạn, hệ thống không tự trao thắng cho một bên.

<a id="p390"></a>**¶390** • Nếu một người mất kết nối trước rồi người còn lại cũng mất kết nối sau đó, hệ thống không tự suy đoán người thắng; kết quả chỉ được chốt khi đủ căn cứ theo thời gian kết nối lại của từng người.

<a id="p391"></a>**¶391** 4. Đầu hàng và xin hòa

<a id="p392"></a>**¶392** • Đầu hàng: người chơi chọn Đầu hàng → hệ thống yêu cầu xác nhận → xác nhận xong người đó thua, đối thủ thắng và bàn cờ bị khóa.

<a id="p393"></a>**¶393** • Xin hòa: một người gửi yêu cầu hòa → đối thủ nhận thông báo → Chấp nhận thì trận kết thúc Hòa; Từ chối thì trận tiếp tục.

<a id="p394"></a>**¶394** • Tại một thời điểm chỉ tồn tại một yêu cầu hòa đang chờ xử lý. Không cho gửi liên tục nhiều yêu cầu hòa cùng lúc.

<a id="p395"></a>**¶395** • Yêu cầu hòa tự hết hiệu lực nếu trận kết thúc bởi một lý do khác trước khi đối thủ phản hồi.

<a id="p396"></a>**¶396** 5. Các trường hợp kết thúc trận

<a id="p397"></a>**¶397** • Chiếu bí → bên bị chiếu thua, bên còn lại thắng.

<a id="p398"></a>**¶398** • Không còn nước đi hợp lệ khi đến lượt → bên không còn nước hợp lệ thua, đối thủ thắng.

<a id="p399"></a>**¶399** • Hết 60 giây của lượt → người đang tới lượt thua do hết thời gian/AFK.

<a id="p400"></a>**¶400** • Rời trận chủ động sau khi xác nhận → người rời thua ngay.

<a id="p401"></a>**¶401** • Mất kết nối ngoài ý muốn quá 60 giây → người mất kết nối thua.

<a id="p402"></a>**¶402** • Đầu hàng → người đầu hàng thua.

<a id="p403"></a>**¶403** • Hai bên đồng ý hòa → kết quả Hòa.

<a id="p404"></a>**¶404** • Room chưa tạo Match mà thay đổi Chủ Room hoặc Đối thủ → không ghi nhận thắng/thua.

<a id="p405"></a>**¶405** • Lỗi toàn hệ thống hoặc dữ liệu trận không đủ căn cứ để xác định bên gây lỗi → không tự phân thắng.

<a id="p406"></a>**¶406** 6. Lịch sử trận và xem lại

<a id="p407"></a>**¶407** • Người chơi mở mục Lịch sử để xem các trận đã hoàn thành.

<a id="p408"></a>**¶408** • Mỗi trận hiển thị tối thiểu: đối thủ, màu quân, kết quả Thắng/Thua/Hòa, lý do kết thúc và thời gian chơi.

<a id="p409"></a>**¶409** • Người chơi có thể mở một trận đã lưu để xem lại từ trạng thái ban đầu.

<a id="p410"></a>**¶410** • Khi xem lại, người dùng có thể chuyển tới nước đầu, nước trước, nước tiếp theo và nước cuối. Bàn cờ chỉ dùng để xem, không cho đi quân mới.

<a id="p411"></a>**¶411** • Lịch sử phải phản ánh đúng thứ tự nước đi và các quân đã bị ăn trong trận.

<a id="p412"></a>**¶412** 7. Xử lý Room sau khi Match kết thúc và chơi lại

<a id="p413"></a>**¶413** Mục tiêu: sau khi một Match kết thúc, kết quả của Match được lưu riêng vào lịch sử nhưng Room vẫn có thể tiếp tục tồn tại để những người đang ở trong Room chơi trận mới mà không phải tạo lại Room.

<a id="p414"></a>**¶414** • Khi một Match kết thúc hợp lệ, hệ thống chốt kết quả Thắng/Thua/Hòa và lưu toàn bộ thông tin của Match vào Lịch sử.

<a id="p415"></a>**¶415** • Mỗi Match được lưu thành một bản ghi lịch sử riêng. Việc hai người tiếp tục chơi trận mới trong cùng Room không được ghi đè lên lịch sử của Match vừa kết thúc.

<a id="p416"></a>**¶416** • Sau khi hoàn tất việc lưu kết quả, Room không tự động bị đóng mà chuyển từ trạng thái Đang diễn ra sang Đang chờ trận mới.

<a id="p417"></a>**¶417** Đang chờ trận mới: Match trước đã kết thúc, Chủ Room và Đối thủ vẫn ở trong Room và đang chờ Sẵn sàng để bắt đầu Match mới.

<a id="p418"></a>**¶418** • Room ở trạng thái Đang chờ trận mới vẫn được hiển thị trong danh sách công khai. Người vào sau tham gia với vai trò Khán giả nếu ô Đối thủ vẫn có người; nếu ô Đối thủ đã Trống thì xử lý theo quy tắc tham gia Đối thủ hiện tại.

<a id="p419"></a>**¶419** • Chủ Room vẫn giữ vai trò Chủ Room và Đối thủ vẫn giữ vai trò Đối thủ nếu cả hai vẫn còn ở trong Room.

<a id="p420"></a>**¶420** • Những Khán giả đang có mặt trong Room vẫn tiếp tục ở lại với vai trò Khán giả; hệ thống không tự động đưa Khán giả vào vị trí Đối thủ chỉ vì Match vừa kết thúc.

<a id="p421"></a>**¶421** • Sau khi Match kết thúc, trạng thái Sẵn sàng của cả Chủ Room và Đối thủ được đặt lại về Chưa sẵn sàng.

<a id="p422"></a>**¶422** • Hai người không được tự động bắt đầu một Match mới chỉ vì vừa hoàn thành Match trước.

<a id="p423"></a>**¶423** • Nếu muốn chơi lại, Chủ Room và Đối thủ phải bấm Sẵn sàng lại. Chỉ khi cả hai cùng Sẵn sàng thì Chủ Room mới được chọn Bắt đầu.

<a id="p424"></a>**¶424** • Khi Chủ Room chọn Bắt đầu cho trận tiếp theo, hệ thống tạo một Match mới với định danh Match mới, thực hiện lại việc phân bên Đỏ/Đen, khởi tạo bàn cờ và countdown 3-2-1 như quy trình Khởi tạo trận đấu.

<a id="p425"></a>**¶425** • Match mới có lịch sử nước đi và kết quả riêng; không sử dụng lịch sử nước đi của Match trước.

<a id="p426"></a>**¶426** • Nếu một người rời Room sau khi Match đã kết thúc nhưng trước khi Match mới được tạo, hệ thống xử lý theo quy tắc quản lý Room trước trận, không coi việc rời Room đó là thua một Match mới chưa tồn tại.

<a id="p427"></a>**¶427** • Nếu người rời là Chủ Room, hệ thống chuyển quyền Chủ Room theo quy tắc tại mục 6.3. Chuyển quyền Chủ Room và quản lý người trong Room.

<a id="p428"></a>**¶428** • Nếu Đối thủ rời Room sau trận, ô Đối thủ trở lại trạng thái Trống và Khán giả có thể chủ động bấm vào ô Đối thủ theo quy tắc đã mô tả ở mục 6.1.

<a id="p429"></a>**¶429** • Trong thời gian Room đang ở trạng thái Đang chờ trận mới, nếu Chủ Room và Đối thủ cũ vẫn còn giữ vị trí thì người tham gia mới chỉ vào với vai trò Khán giả.

<a id="p430"></a>**¶430** • Chỉ khi ô Đối thủ trở thành Trống do Đối thủ cũ rời Room hoặc bị loại khỏi vị trí thì Khán giả mới được phép chủ động bấm vào ô Đối thủ.

<a id="p434"></a>**¶434** PHASE 4 – GIAO TIẾP VÀ CHƠI VỚI MÁY

<a id="p435"></a>**¶435** 1. Chat riêng giữa hai người chơi

<a id="p436"></a>**¶436** Mục tiêu: Chủ Room và Đối thủ có thể trao đổi trong Room nhưng Khán giả tuyệt đối không được làm gián đoạn hoặc nhìn thấy nội dung trao đổi của hai người chơi.

<a id="p437"></a>**¶437** • Chỉ hai người đang giữ vai trò Chủ Room và Đối thủ được sử dụng khung Chat dành cho người chơi.

<a id="p438"></a>**¶438** • Khán giả tuyệt đối không có quyền gửi tin nhắn trong khung Chat của người chơi và không được nhận hoặc nhìn thấy tin nhắn giữa Chủ Room và Đối thủ.

<a id="p439"></a>**¶439** • Trong phiên bản này không triển khai Chat Khán giả. Nếu sau này bổ sung, Chat Khán giả phải là một kênh tách biệt chỉ giữa Khán giả với nhau; Chủ Room và Đối thủ không được nhận hoặc nhìn thấy kênh đó để tránh bị phân tâm.

<a id="p440"></a>**¶440** • Người chơi nhập nội dung vào ô tin nhắn và chọn Gửi. Hệ thống không cho gửi tin nhắn rỗng hoặc chỉ chứa khoảng trắng.

<a id="p441"></a>**¶441** • Khi tin nhắn hợp lệ được gửi, hệ thống chuyển tin nhắn Real-time chỉ tới hai người chơi của Room hiện tại.

<a id="p442"></a>**¶442** • Tin nhắn hiển thị tối thiểu tên người gửi, nội dung và thời gian gửi.

<a id="p443"></a>**¶443** • Tin nhắn của Room này không được gửi nhầm sang Room khác.

<a id="p444"></a>**¶444** • Người không còn giữ vai trò Chủ Room hoặc Đối thủ không được tiếp tục gửi hoặc nhận Chat của hai người chơi.

<a id="p445"></a>**¶445** • Nếu người chơi mất kết nối tại thời điểm gửi, hệ thống không hiển thị tin nhắn như đã gửi thành công khi máy chủ chưa nhận được.

<a id="p446"></a>**¶446** • Chat hoạt động độc lập với bàn cờ; gửi hoặc nhận tin nhắn không làm dừng đồng hồ lượt, thay đổi lượt hoặc kết quả.

<a id="p447"></a>**¶447** • Nếu Đối thủ bị Chủ Room loại khỏi vị trí trước trận, người đó lập tức mất quyền truy cập Chat của hai người chơi. Đối thủ mới không được xem lại nội dung Chat riêng đã diễn ra với Đối thủ trước đó.

<a id="p448"></a>**¶448** • Khi một người rời Room, người đó không còn gửi hoặc nhận tin nhắn mới trong Chat của Room.

<a id="p449"></a>**¶449** • Mỗi khi thành phần hai người chơi trong Room thay đổi, người vừa trở thành Chủ Room hoặc Đối thủ chỉ được nhận các tin nhắn phát sinh sau khi họ giữ vai trò người chơi; họ không được tải lại nội dung Chat riêng của cặp người chơi trước đó.

<a id="p450"></a>**¶450** 2. Video Call trực tiếp giữa hai người chơi trong Room

<a id="p451"></a>**¶451** Mục tiêu: Chủ Room và Đối thủ có thể gọi video trực tiếp với nhau trong cùng Room mà không cần tạo hoặc chia sẻ link cuộc gọi.

<a id="p452"></a>**¶452** • Khi Chủ Room và Đối thủ đều có mặt trong Room, giao diện hiển thị chức năng Video Call cho hai người chơi.

<a id="p453"></a>**¶453** • Chỉ Chủ Room và Đối thủ được bắt đầu hoặc tham gia Video Call. Khán giả không được sử dụng và không được xem cuộc gọi.

<a id="p454"></a>**¶454** • Một trong hai người chọn Video Call để gửi yêu cầu gọi tới người còn lại.

<a id="p455"></a>**¶455** • Hệ thống kiểm tra người gọi và người nhận vẫn đang thuộc cùng một Room trước khi gửi yêu cầu.

<a id="p456"></a>**¶456** • Nếu hợp lệ, người nhận thấy thông báo cuộc gọi đến với tên người gọi và hai lựa chọn Chấp nhận hoặc Từ chối.

<a id="p457"></a>**¶457** • Nếu người nhận không Chấp nhận hoặc Từ chối trong vòng 60 giây, yêu cầu Video Call tự động hết hiệu lực. Hệ thống kết thúc yêu cầu và người gọi nhận thông báo “Cuộc gọi không được trả lời”

<a id="p458"></a>**¶458** • Sau khi yêu cầu kết thúc, một trong hai người có thể thực hiện yêu cầu Video Call mới nếu cả hai vẫn còn giữ vai trò người chơi trong Room.

<a id="p459"></a>**¶459** • Nếu người nhận chọn Từ chối, yêu cầu Video Call kết thúc ngay, người gọi nhận thông báo “Đối phương đã từ chối cuộc gọi”. Hai người vẫn ở trong Room và trận cờ không bị ảnh hưởng.

<a id="p460"></a>**¶460** • Trong thời gian chờ phản hồi, người gọi thấy trạng thái Đang gọi. Hệ thống không tạo nhiều yêu cầu trùng nhau nếu người gọi bấm liên tiếp.

<a id="p461"></a>**¶461** • Nếu người nhận Chấp nhận, hệ thống thiết lập cuộc gọi video giữa đúng hai người chơi.

<a id="p462"></a>**¶462** • Trước khi tham gia, hệ thống yêu cầu quyền camera và micro nếu chưa được cấp.

<a id="p463"></a>**¶463** • Nếu người dùng từ chối quyền Camera hoặc Micro, hệ thống thông báo thiết bị tương ứng chưa được cấp quyền và cho phép người dùng thử cấp quyền lại.

<a id="p464"></a>**¶464** • Việc từ chối quyền Camera/Micro không được làm kết thúc hoặc tạm dừng Match.

<a id="p465"></a>**¶465** • Người dùng có thể bật/tắt camera hoặc micro trong khi gọi. Nếu camera không khả dụng nhưng micro vẫn hoạt động, cuộc gọi có thể tiếp tục bằng âm thanh.

<a id="p466"></a>**¶466** • Khi cả hai đã kết nối thành công, video của hai người được hiển thị trong khu vực Video Call của Room.

<a id="p467"></a>**¶467** • Trong khi Video Call đang hoạt động, mỗi người có thể chọn Rời cuộc gọi.

<a id="p468"></a>**¶468** • Khi một người rời cuộc gọi, kết nối video/audio của người đó kết thúc và người còn lại nhận thông báo đối phương đã rời cuộc gọi.

<a id="p469"></a>**¶469** • Rời Video Call không làm người dùng rời Room, không tính thua và không làm Match kết thúc.

<a id="p470"></a>**¶470** • Sau khi cuộc gọi kết thúc, hai người có thể thực hiện một yêu cầu Video Call mới nếu vẫn còn giữ vai trò Chủ Room và Đối thủ.

<a id="p471"></a>**¶471** • Tại một thời điểm, mỗi Room chỉ có tối đa một Video Call đang hoạt động giữa hai người chơi.

<a id="p472"></a>**¶472** • Video Call và trận cờ hoạt động độc lập. Lỗi, rời hoặc kết thúc cuộc gọi không làm thay đổi lượt, đồng hồ, AFK hay kết quả trận.

<a id="p473"></a>**¶473** • Nếu một người rời Room hoặc không còn giữ vai trò Chủ Room/Đối thủ, người đó bị ngắt khỏi Video Call hiện tại.

<a id="p474"></a>**¶474** • Khi Room không còn hai người chơi hợp lệ hoặc Room bị đóng, Video Call đang hoạt động kết thúc.

<a id="p475"></a>**¶475** 3. Bắt đầu trận với máy

<a id="p476"></a>**¶476** Mục tiêu: người chơi có thể luyện cờ với máy; máy chỉ cần tự thực hiện nước đi hợp lệ, không có lựa chọn độ khó.

<a id="p477"></a>**¶477** • Người chơi chọn Chơi với máy và chọn bên Đỏ hoặc Đen.

<a id="p478"></a>**¶478** • Hệ thống tạo một Match riêng thuộc loại Người chơi - Máy và khởi tạo bàn cờ ở trạng thái bắt đầu chuẩn.

<a id="p479"></a>**¶479** • Nếu người chơi chọn Đỏ, người chơi đi trước. Nếu chọn Đen, máy là bên Đỏ và tự thực hiện nước đầu tiên.

<a id="p480"></a>**¶480** • Trận với máy sử dụng cùng luật di chuyển, ăn quân, chiếu Tướng, chiếu bí và hết nước hợp lệ như trận trực tuyến.

<a id="p481"></a>**¶481** • Trận với máy cũng sử dụng giới hạn 60 giây cho lượt của người chơi; lượt của máy được hệ thống xử lý tự động trong 60 giây

<a id="p482"></a>**¶482** • Nếu người chơi không thực hiện được nước đi hợp lệ trước khi đồng hồ 60 giây kết thúc, người chơi bị xử thua do hết thời gian; máy được xử thắng.

<a id="p483"></a>**¶483** • Máy không áp dụng xử thua AFK theo đồng hồ như người chơi vì lượt máy do hệ thống tự động xử lý.

<a id="p484"></a>**¶484** 4. Cách máy thực hiện lượt

<a id="p485"></a>**¶485** • Khi đến lượt máy, giao diện hiển thị trạng thái “Máy đang đi...” và tạm thời không cho người chơi di chuyển quân.

<a id="p486"></a>**¶486** • Hệ thống lấy trạng thái bàn cờ hiện tại và xác định tập hợp tất cả nước đi hợp lệ của bên máy.

<a id="p487"></a>**¶487** • Máy lựa chọn ngẫu nhiên một nước trong số các nước hợp lệ.

<a id="p488"></a>**¶488** • Máy không được tạo nước đi sai luật, bỏ qua quy tắc bảo vệ Tướng hoặc đi khi chưa tới lượt.

<a id="p489"></a>**¶489** • Sau khi máy thực hiện nước đi, hệ thống cập nhật và lưu trạng thái bàn cờ mới. Nếu trận chưa kết thúc, quyền đi chuyển lại cho người chơi; nếu nước đi làm trận kết thúc thì hệ thống xử lý kết quả ngay và không tạo lượt mới.

<a id="p490"></a>**¶490** • Nếu người chơi tải lại trang trong khi trận với máy chưa kết thúc và trạng thái còn hợp lệ, hệ thống tải lại trạng thái bàn cờ đã lưu thay vì tạo một trận mới.

<a id="p491"></a>**¶491** • Nếu máy không còn nước đi hợp lệ, máy bị xử thua theo cùng quy tắc áp dụng cho người chơi.

<a id="p492"></a>**¶492** 5. Kết thúc và lưu trận với máy

<a id="p493"></a>**¶493** • Người chơi có thể thắng, thua, đầu hàng hoặc kết thúc do các điều kiện luật cờ giống trận trực tuyến.

<a id="p494"></a>**¶494** • Trận với máy được lưu vào lịch sử để người chơi xem lại.

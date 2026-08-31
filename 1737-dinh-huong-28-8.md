# Định hướng thiết kế — bàn tối 28/8

Không phải sổ nợ kỹ thuật (cái đó Claude Code đang giữ riêng ở `1737-gd2-debt.md`,
chứa bug và quyết định hoãn cụ thể — vẫn đọc file đó song song với file này).
Đây là **định hướng**: những nguyên tắc và quyết định lớn bàn tối nay, chưa đụng
code, cần biết trước khi giao việc tiếp.

Đọc cùng `BRIEF_1737.md`. File này bổ sung, không thay thế.

---

## Việc đã xong tính tới giờ (không đụng lại)

T2.2 (gộp Person), T2.1 (ghế thành thực thể, mở rộng ra 27 xã Quảng Oai), T2.3
(địa lý Quảng Oai viết tay) — commit sạch, kiểm bằng mắt.

Track T3 (kinh tế + kỹ năng thật), tính tới 29/8:
- **T3.0** — khoá spawn về Quảng Oai. Xong.
- **T3.1a/b/c** — dòng họ cục bộ theo xã (67 clan, `localClanIds`, tranh ghế
  thiên vị thế). Xong cả 3 bước, kiểm bằng mắt rồi.
- **T3.2, T3.3, T3.4, T3.5** — chưa bắt đầu. Xem thêm bổ sung 29/8 bên dưới
  trước khi mở T3.2 (nó phóng to ra thành "vốn + cửa hàng", không còn hẹp
  như bản đầu).

Sau T3: còn GĐ2b (item/vận chuyển/cướp đường — đang treo, cần bàn lại sau
T3.1 vì dòng họ đổi câu trả lời "ai sở hữu cái gì"), "AI dùng ghế thật", rồi
mới tới GĐ3 (server) và GĐ4 (UI feed).

**Không có việc nào đang dở dang trong code lúc này.**

---

## Khối việc tiếp theo — ưu tiên cao nhất, làm trước mọi ý khác trong file này

### Vấn đề gốc, ba cuộc bàn hoá ra cùng chỉ vào một chỗ

**Từ góc kinh tế:** 13 hành động sinh kế (`actions/livelihood.js`) hiện cô lập —
bấm nút, ra tài nguyên, mang bán, auto giàu. "Vải bán một buổi đã đủ xây nhà" —
đúng nguyên văn phản ứng khi test.

**Từ góc kỹ năng:** 5 chỉ số (`models.js`) tăng theo nút bấm riêng biệt kiểu CK3.
Đúng hướng phải là kiểu KDC: chỉ số là dấu vết của hành động đã làm.

**Từ góc "còn sơ sài" (bàn lần 2):** hỏi sâu vào một nghề cụ thể (ruộng) thì lộ
ra câu hỏi kéo theo không tránh được — ruộng của ai, ai thu tô — và câu trả lời
tự nhiên nhất ("dòng họ lớn nhất làng đó") đòi dòng họ phải cục bộ theo làng,
không phải 3 cái dùng chung toàn bản đồ như hiện tại.

Ba cuộc bàn cùng chạm một vùng code: `actions/livelihood.js`, `court.js`,
`models.js`, `PropertyDb`/`holdings`, `lifestyle.js`, và giờ thêm `state.clans`
(hiện chỉ 3 clan phẳng, cần thêm scope). **Gộp làm một khối, đừng tách** — tách
ra sẽ phải sửa `actions/livelihood.js` nhiều lần.

### Ruộng đất — ví dụ đào sâu nhất, làm khuôn cho các nghề còn lại

Ba loại ruộng, khác hẳn nhau, không phải một khái niệm "ruộng" chung chung:

- **Ruộng công** — thuộc về làng, chia lại định kỳ theo suất đinh, người cày nộp
  tô cho làng (không phải cho cá nhân). Có hạn suất — làng đông thì không phải
  ai cũng có phần. Đây là ruộng mặc định một dân đen mới sinh có cơ hội được
  chia, nếu làng còn suất.
- **Ruộng tư** — sở hữu riêng, mua bán thừa kế cầm cố được. Ai không có ruộng
  tư, không đủ suất công điền, phải chọn: **cày thuê** (ăn công theo ngày, an
  toàn, trần thấp) hoặc **cấy rẽ** (mượn ruộng người khác, thu hoạch chia phần
  đã hẹn — rủi ro hơn, trần cao hơn nếu được mùa).
- **Ruộng lộc** — đi kèm chức vụ, mất ghế thì mất đất theo. Lý do lịch sử thật
  "làm quan giàu nhanh".

**Trâu** là hình hài cụ thể của "vốn": nhà có trâu tự cày nhanh + cho thuê kiếm
thêm; không trâu thì cày tay chậm hoặc phải thuê, phụ thuộc lịch người khác. Mua
một con trâu là đầu tư một lần, đổi hẳn năng suất dài hạn.

**Quy trình có thời gian thật**: làm đất (cần trâu) → gieo mạ → cấy (tốn công,
truyền thống đổi công với hàng xóm) → chờ 3-4 tháng, ruộng "đang có lúa" là
trạng thái treo, dễ bị thời tiết/phá hoại → gặt. Không cần cơ chế mới:
`planActivity`/`tickActivity` đã dùng đúng khuôn này cho thi cử. Cày cấy nên
dùng lại, không phải nút bấm tức thì.

**Áp phương pháp này cho 12 nghề còn lại, không chỉ ruộng.** Mỗi nghề cần bộ câu
hỏi tương tự (nguyên liệu từ đâu, công cụ gì, ai mua, có ai kiểm soát nguồn
không) — nhưng câu trả lời cụ thể của từng nghề nên lộ ra lúc dò đúng code hiện
tại, không đoán trước bằng trí tưởng tượng. Đưa việc này thành yêu cầu tường
minh trong lệnh dò bên dưới, không viết sẵn 12 câu trả lời ở đây.

### Dòng họ cục bộ theo làng — không phải sửa số 3, sửa phạm vi

Nguyễn/Trần/Phạm không sai (ba họ phổ biến nhất thật, hợp lý làm họ lớn). Sai là
dùng CHUNG một bộ 3 cho toàn bản đồ. Thực tế mỗi làng có dòng họ của riêng nó —
và đã vô tình viết đúng hướng này trong `quang_oai.md` rồi, chỉ chưa có code
theo kịp: "họ Trần nắm hết bến" (Phú Cường), "họ Lê thầu hết việc kết bè" (Cần
Kiệm) — mỗi làng một họ thống trị khác nhau.

Sửa: dòng họ có **scope** (thuộc làng/xã cụ thể), sinh theo từng làng, số lượng
không cố định, **vị thế thay đổi được** qua thời gian (đỗ đạt nhiều thì lên,
thua kiện đất hay tuyệt tự thì xuống).

Cái ra miễn phí: làng có 2-3 dòng họ thật thì chúng tự động tranh ghế lý trưởng
(chỉ 1 suất) — kịch tính từ chính khan hiếm đã có, không thiết kế thêm gì.

### Hàng xóm láng giềng — làng là đơn vị sống, xã là đơn vị hành chính

Quảng Oai: mỗi xã 2-3 làng. Sống chung làng mới là hàng xóm thật — cùng đình,
cùng chợ phiên, cùng đổi công lúc cấy gặt, tin đồn lan nhanh và chi tiết hơn.
Cùng xã khác làng thì chỉ biết mặt. Khi nhiều người chơi cùng làng, nên có
tương tác riêng cấp đó (mời đổi công, thấy chuyện nội bộ làng mà xã khác không
thấy) — ghi nhận hướng, chưa cần thiết kế chi tiết bây giờ.

### Ràng buộc kỹ năng, giữ nguyên như bản trước

Xuất thân chỉ quyết định điểm bắt đầu và cửa nào mở sẵn, không quyết định tốc độ
tăng về sau. Con nhà nghèo vào được cửa thi cử thì tăng Học Vấn theo đúng công
thức như con nhà quan — không có hệ số "sinh nghèo học chậm mãi mãi".

### Cách bắt đầu — đúng nhịp đã chạy cả ngày, một lượt dò bao trùm cả ba mảnh

```
Đọc BRIEF_1737.md, quang_oai.md, và file định hướng này (toàn bộ mục
"Khối việc tiếp theo").

Dò hiện trạng, CHƯA VIẾT CODE:
1. actions/livelihood.js — cả 13 hàm. Với MỖI hàm, áp bộ câu hỏi: nguyên liệu
   lấy từ đâu, cần công cụ/vốn gì, ai mua kết quả, có giới hạn nguồn không.
   Không chỉ làm actionCayRuong, làm đủ 13.
2. court.js — cách hocVan/voThuat/quanLy tăng hiện tại, đối chiếu nguyên tắc
   "chỉ tăng qua hành động thật".
3. models.js — định nghĩa 5 chỉ số, shape hiện tại.
4. PropertyDb/holdings — có sẵn gì dùng làm "vốn" được (trâu, khung cửi...).
5. lifestyle.js — birth trait nào ảnh hưởng tay nghề nền.
6. state.clans — cấu trúc 3 clan hiện tại, có field nào cho scope theo
   làng/xã chưa, NPC.clanId trỏ vào đâu.
7. weather.js, planActivity/tickActivity (dùng cho thi cử) — xem tái dùng
   được cho một vụ mùa nhiều giai đoạn không.

Báo cáo: hiện trạng từng phần, khoảng trống so với thiết kế trong file này,
đề xuất shape, câu hỏi cần chốt. Đặc biệt: đề xuất cách chia bước nhỏ (dự
đoán sẽ cần chia như T2.1 đã chia 2.1a/b/c, nhưng tự đề xuất theo đúng code
thật, đừng chia trước khi biết).
```

---

## Việc chưa cần làm bây giờ, nhưng cần biết hình dạng trước

### Hai lớp đồng hồ (GĐ3, khi có server — không code ở GĐ2)

Tách hẳn hai đồng hồ, không gộp:

- **Lịch** (ngày/tháng/năm) — vẫn tua nhanh như đang có (~4h thật = 1 ngày
  game), giữ nhịp lịch sử, mùa giải.
- **Canh** (sáng/trưa/chiều/tối/đêm) — đồng bộ 1:1 với giờ thật ngoài đời,
  không phụ thuộc lịch game đang ở đâu. 7h tối ngoài đời thì trong game hiện
  đúng canh tối, luôn luôn. Chợ đóng cửa, nha môn hết giờ, AI giữ ghế đổi chỗ
  (nha môn ban ngày, quán trà buổi tối) đều theo canh, không theo lịch.

Đặt tên "canh", không dùng "buổi" (chữ đó đã dùng cho ngân sách thể lực, trùng
tên dễ lẫn). Timezone mặc định Việt Nam.

Đây là quyết định kiến trúc cho `core/time.js`, chưa cần viết bây giờ vì "canh"
chỉ có nghĩa khi có server thật (GĐ3). Ghi lại để không phải nghĩ lại từ đầu.

### Player-generated events qua inbox (GĐ2b)

`state.inbox` (xây ở bước 9 hôm qua) hiện chỉ nhận sự kiện hệ thống/NPC. Cần
thêm loại mới: sự kiện **do người chơi khác gây ra** (bị cướp, bị tố cáo, nhận
đề nghị) — "ting ting" như tin nhắn. Đường ống đã có, thiếu loại nội dung.

Kèm cơ chế "có ai nhìn thấy không" (tham khảo KCD: bị thấy làm bậy mà không bắt
được thì vẫn bị nhớ mặt, quay lại vẫn bị để ý) — nên là một roll riêng trước khi
tính thành/bại của hành động phi pháp, không phải nhị phân bắt/không bắt.

### Dòng họ tách khỏi tổ chức (GĐ2b, khi thiết kế item/vận chuyển)

Hai lớp xã hội độc lập, đừng gộp:
- **Dòng họ** — sinh ra đã có, khó bỏ, khó chọn lại (Nguyễn/Trần/Phạm đã có).
- **Tổ chức** — tự chọn, tự bỏ được, tự phản được. Vẫn đúng quyết định cũ:
  một thực thể tham số hoá bằng tình trạng pháp lý (được công nhận/trung
  lập/ngoài vòng pháp luật), không làm 4 loại riêng.

Kịch tính nằm ở chỗ hai lớp có thể xung đột: dòng họ theo triều, bản thân theo
nghĩa quân — họ hàng vạ lây vì lựa chọn cá nhân. Khi code hoá, một Person nên có
`clanId` (dòng họ) và tư cách tổ chức riêng, độc lập nhau, không gộp một field.

Danh tiếng nên biểu diễn bằng **giấy tờ và lời đồn** (đã có sẵn hướng: lệnh truy
nã, bản án, sắc phong), không phải một con số ẩn. Người khác đọc tờ giấy hoặc
nghe kể lại, không đọc chỉ số.

### AI giữ ghế có lịch trình (khi làm "AI dùng ghế thật")

Lý trưởng AI nên có khung giờ theo canh: sáng ở nha môn, tối ở quán trà. Muốn
hối lộ nó phải biết *lúc nào* tìm, không chỉ *ở đâu*. Rẻ để làm (bảng giờ theo
buổi), tạo cảm giác NPC đang sống.

### Hàng ngoại thương (GĐ2b, thiết kế item)

**Đính chính 31/8**: KHÔNG phải Bồ Đào Nha/Hà Lan thường xuyên — thương điếm Hà
Lan đã đóng cửa từ năm 1700. Năm 1737 chủ lực cảng Đàng Ngoài là **Hoa kiều và
Nhật Bản**. Tàu Bồ Đào Nha thi thoảng mới liều ghé, hiếm và nguy hiểm (bị tháo
bánh lái/tước vũ khí, "khám tàu" trấn lột, nghi chở giáo sĩ). Dùng Hoa kiều/
Nhật Bản làm nguồn hàng ngoại thường xuyên; tàu Tây hiếm hoi là một SỰ KIỆN đặc
biệt, không phải quan hệ buôn bán đều đặn. Chi tiết đầy đủ + cấu trúc cảng
(Domea → Phố Hiến → Kẻ Chợ) trong `1737-suLieu-gd2b-31-8.md`.

---

## Bổ sung 29/8 — sau khi T3.1 xong, bàn tiếp

Ba ý này cùng một nguyên tắc: tầng xã đã có "người thật, tên thật, lịch sử
thật" (27 lý trưởng, dòng họ cục bộ) — kéo dài nguyên tắc đó lên trên (huyện,
phủ) và sang ngang (đồ vật, cửa hàng). Không phải phình phạm vi, là nhất quán.

### Trần vật phẩm: cấp phủ trở xuống, không thần thoại

Giá trị đồ vật đến từ **lai lịch** (ai làm, ai từng giữ, gắn sự kiện gì) và độ
hiếm-thật-trong-đời (vàng/ngọc/gốm quý), tuyệt đối không phải hiệu ứng phép
thuật hay chỉ số cộng thêm bịa ra. Đây là nhắc lại nguyên tắc "bảo vật có tên
riêng" đã chốt từ đầu, giờ đóng chặt thêm ranh giới trên (không vượt quá cấp
phủ). Áp dụng khi thiết kế item ở GĐ2b: món nào đòi bịa ra thuộc tính thần kỳ
mới có giá trị thì loại ngay từ đầu, không đưa vào bàn.

### Xuất thân ngoài làng: tách hai trục, đừng gộp

"Con quan" và "con đồ tể/lái thuyền" là hai loại khác nhau:

- **Con quan** = sinh vào **dòng họ có vị thế cao** trong xã (dùng
  `clan.status` đã có ở T3.1), KHÔNG PHẢI con ruột của người đang giữ ghế lúc
  đó — ghế có thể đang do một người chơi khác giữ, random ra quan hệ máu mủ
  với nhân vật người khác là vô lý. An toàn: gắn với dòng họ, không gắn với
  occupant cụ thể.
- **Con đồ tể / lái thuyền / thợ rèn...** = gắn với **nghề nghiệp gia truyền**,
  tức là gắn với việc gia đình có đang nắm một cơ nghiệp hay không (xem mục
  "cửa hàng" ngay dưới) — cho tay nghề nền hoặc quyền thừa kế một phần.

Không cần dựng lại hệ địa lý (vẫn sinh ở một làng cụ thể như hiện tại) — chỉ
cần làm giàu **gia đình m sinh ra là ai**, đắp thêm lên nền đã có.

Kéo theo: ghế huyện/phủ (đã có từ T2.1, mới 3 ghế huyện, chưa ai "sống" trong
đó như 27 lý trưởng xã) cần được đắp chi tiết tương đương, nếu không "con quan
huyện" sẽ là một xuất thân rỗng.

### Cửa hàng mở được (tửu lâu, lò rèn, phường thêu, bến đò...) — T3.2 phóng to

Không phải hệ thống mới cạnh T3.2, mà **là** T3.2 ở quy mô lớn hơn. Một cửa
hàng = vốn (nồi rượu, khung dệt...) + một chỗ đứng khan hiếm (không phải xã
nào cũng có chỗ cho vô số tửu lâu, giống khan hiếm ghế) + có thể thuê người +
thu nhập đều khi còn giữ (giống ruộng lộc).

**Khi T3.2 mở lại: nghĩ ở khung "vốn + cửa hàng" ngay từ đầu**, đừng thiết kế
hẹp "chỉ công cụ cá nhân" rồi mở rộng sau — tránh sửa hai lần.

**Làm thuê nên là cơ chế lao động chung**, không phải riêng cho ruộng. T3.3
đang định nghĩa "cày thuê"/"cấy rẽ" cho nông nghiệp — nhưng chủ tửu lâu cần
thuê người rót rượu, chủ lò rèn cần thợ phụ. Thiết kế "làm thuê" tổng quát
ngay từ T3.3, để nông nghiệp chỉ là ứng dụng đầu tiên, không phải xây riêng
cho ruộng rồi tổng quát hoá lại sau.

### Birth trait cần sống lại — dependency mới cho T3.5

Recon 27/8 tìm ra: 8/10 tính cách + 7/8 đặc điểm bẩm sinh chỉ gắn cờ, không ai
đọc (chỉ 2 cái có tác dụng thật). Nếu mở rộng xuất thân (con quan/đồ tể/lái
thuyền) thì đây chính là chỗ gốc gác phải thể hiện thành lợi thế thật — nhưng
hệ thống thể hiện đang gần như chết. Đã nằm trong T3.5 ("dọn hoặc hiện thực
hoá cờ chết"), giờ quan trọng hơn hẳn, đừng để rơi khỏi phạm vi khi làm T3.5.

---

## Bổ sung 30/8 — kiến trúc kỹ năng, chốt sau khi bàn kỹ (dừng hẳn code để bàn)

Ha chỉ ra: 5 chỉ số hiện tại (`ngoaiGiao/voThuat/quanLy/muuMeo/hocVan`) là
khối chỉ số kiểu CK3 (rộng, tăng qua nút bấm riêng biệt), trong khi hướng
muốn là kiểu KDC — tra thật thì đúng: KDC có nhiều kỹ năng **hẹp**, mỗi cái
chỉ tăng qua đúng một loại hành động, và ở mốc nhất định thì mở khoá **một
năng lực mới cụ thể** (không phải chỉ +số) — vd Lén Lút đủ mức mở "Giết Lén",
Ăn Nói đủ mức mở "Lời Đề Nghị Cuối", và một perk khớp gần nguyên văn ví dụ
Ha đưa: nhánh Ăn Nói ở mức cao giảm hẳn khả năng bị phát hiện khi bán đồ ăn
trộm. Quy mô thật của KDC: ~180 perk trên ~15 nhánh, một studio làm nhiều
năm — không nên nhắm 1:1, chỉ lấy nguyên tắc cấu trúc.

**Đếm thử (bản gốc trước GĐ0, số current cần đếm lại khi thật sự làm):**
`muuMeo` 31 lần + `ngoaiGiao` 33 lần chỉ riêng trong `events.js` — cao ngang
hoặc hơn `hocVan`/`voThuat`. Hai chỉ số này KHÔNG phải ít dùng như cảm giác
ban đầu — chúng là cổng kiểm tra dày đặc cho sự kiện. Sửa/định nghĩa lại
chúng sẽ là việc lớn, không tương xứng lợi ích.

**Quyết định:** KHÔNG sửa 5 chỉ số hiện có, dù chỉ số nào. Giữ nguyên làm
tầng dưới, tiếp tục phục vụ mọi công thức đang đọc chúng (sự kiện, thi cử,
ghế). Thêm một **tầng kỹ năng hẹp mới, thuần cộng dồn** — không xoá, không
định nghĩa lại gì ở tầng dưới. Công thức cũ đọc `muuMeo` thì vẫn đọc `muuMeo`
y nguyên; kỹ năng hẹp mới muốn ảnh hưởng cùng hành động thì CỘNG THÊM một số
hạng vào công thức, không THAY.

**Neo thật đã có sẵn, không phải bịa trên giấy trắng:**
- Mặc cả → `actionMarketHaggle` (đã có)
- Lén lút → `actionBuonLauMuoi` — **đã có sẵn `catchRate` giảm theo `muuMeo`**,
  đúng tinh thần "trộm nhiều thì ít bị phát hiện". Kỹ năng hẹp mới chỉ cộng
  thêm một số hạng vào công thức catchRate có sẵn, không viết lại.
- Võ nghệ → `actionLuyenVo` (đã đúng khuôn tích luỹ từ trước, là chỉ số duy
  nhất trong 5 cái đang tăng qua hành động thật)
- Cai quản → giữ ghế (T2.1) **hoặc** giữ cửa hàng (T3.2, xong 30/8) — cả hai
  chỗ neo đều mới xuất hiện trong 2 ngày qua
- Học vấn → `actionDiHoc` viết lại (đã có trong kế hoạch T3.5 từ đầu)
- Nông tang → chờ T3.3 dựng xong mới có chỗ neo

**Quy mô đề xuất:** 5-6 domain, mỗi domain 2-3 mốc mở khoá — không phải 180
perk. Vì là tầng cộng dồn thuần tuý (không đụng tầng dưới), rủi ro sửa thấp
hơn hẳn so với hình dung ban đầu ("sửa 5 chỉ số cũ").

T3.5 vẫn xếp cuối track T3 — giờ có lý do rõ hơn: chỗ neo "cai quản" (ghế +
cửa hàng) chỉ vừa đủ hai cái hôm nay, và "nông tang" còn chờ T3.3.

---

## Bổ sung 30/8 (2) — chức tước phải phản chiếu ghế thật, không phải cache tự xưng

Ha đưa ví dụ: dân đen có tiền, xây được nhà kiểu "nhà đại quan" (`actionXayNha`
chỉ kiểm `minRank`/tiền) — mà `p.rank` lại lên được tới "Tri Huyện" hoàn toàn
qua `court.js` (`actionThangTienVo`/`actionXinChucBoNhiem`/
`actionLuanChuyenKhaoKhoa` ghi thẳng vào `rank`), **không cần chạm ghế thật
(`state.seats`) lần nào**. Vậy "quan" đó thu tô của ai, dựa thẩm quyền gì?

**Chẩn đoán:** ba quyết định đúng-lý-lúc-đó, giờ cộng lại thành một lỗ:
- T2.1c: đồng bộ **một chiều** (seat→rank), 24 chỗ ghi rank cũ không đụng — cố
  tình, để tránh sửa 24 chỗ cùng lúc với việc dựng schema ghế.
- T2.1: không siết khan hiếm ở `actionAssumeOfficeHere` — cố tình, vì lúc đó
  chưa có AI thật ngồi ghế để mà chặn.
- `PropertyDb`: có từ trước khi ghế tồn tại, viết `minRank` vì lúc đó chưa có
  ghế để kiểm — chưa ai quay lại nối.

→ `p.rank` hiện là **cache tự xưng**, có thể đổi độc lập với ghế thật. Không
phải lỗi một chỗ, là thiếu một luật chung: *cái gì ngụ ý quyền lực hành chính
thật phải phản chiếu một quan hệ kiểm tra được (ghế), không được là số đứng
riêng.* Kỹ năng cá nhân (mặc cả, lén lút, võ nghệ — mục trên) thì ngược lại,
được phép là số trừu tượng vì không tuyên bố quan hệ với ai.

**Quyết định thứ tự (Ha giao chủ động, chốt theo hướng "giả lập 1737 y thật"):**
- **KHÔNG chen vào giữa track T3.2 đang chạy.** T3.2c-2 xong trước.
- **Sau khi T3.2 đóng hẳn** — sửa nhỏ, cô lập: `actionXayNha`, nhà nào ngụ ý
  cấp quan thì đổi gate từ `minRank` sang kiểm `state.seats[...].occupantId
  === player.id` (ghế thật). Không đụng `court.js`.
- **Việc lớn (viết lại 3 hàm `court.js` đi qua tiến cử/bổ nhiệm thật, không
  tự ghi rank) để đúng chỗ đã có tên sẵn: "AI dùng ghế thật", SAU khi cả track
  T3 (3.2→3.5) đóng.** Lý do để sau: sửa bây giờ là sửa trên nền chưa đủ dữ
  liệu (T3.3/T3.4/T3.5 chưa tồn tại) — dễ phải sửa lại lần hai khi các track
  đó lộ thêm cách rank bị dùng.

**Luật đứng, áp dụng ngay từ T3.3 dù việc lớn chưa sửa:** mọi gate mới ngụ ý
"đang thật sự nắm quyền hành chính" phải kiểm ghế thật (`occupantId`), không
được kiểm `rank` cache. Ruộng lộc (T3.3) vốn đã thiết kế đúng hướng này từ
đầu — chỉ cần đảm bảo lúc code thật sự kiểm ghế, không lỡ kiểm rank cho tiện.
Giữ luật này thì lỗ không phình to thêm trong lúc chờ sửa gốc.

---

## Bổ sung 30/8 (4) — nghèo đi vẫn vô hại, nửa còn thiếu của "kinh tế thật"

Sau khi track T3.3 đóng (ruộng đất thật, rủi ro thật, mất mùa thật), dò lại
câu hỏi "0 tiền 0 thóc thì sao" — phát hiện: **gần như vô hại tuyệt đối.**

- Đói khi đứng yên: `thocCaNhan` kẹp sàn 0, không mất HP, không ốm, không
  event. Chỉ khi hành quân mới mất quân/máu.
- Thuế: không có nợ tích luỹ, không có hạn. Chỉ 1 cú quyết toán/năm — không
  đủ tiền → mất sạch tiền + uy tín −20 + thể lực −40 (dẫn ốm) → hết, không
  giam, không truy nã, không mất ruộng, không dồn năm sau.
- `uyTinCong -= 20` (chỗ phạt thuế) là **chỗ trừ uy tín DUY NHẤT không kẹp
  sàn** trong toàn engine (~20 chỗ khác đều kẹp 0). **Quyết định: giữ
  nguyên, không kẹp sàn — uy tín âm mang nghĩa thật (mang tiếng xấu thật,
  khác "chưa có tiếng" = 0). Chủ ý, cần comment trong code giải thích, không
  phải ngoại lệ mồ côi.**

**Đây là nửa còn thiếu của lý do làm cả track T3 kinh tế thật** — làm giàu
khó hơn nhiều rồi, nhưng nghèo vẫn không có giá gì phải trả.

**Quyết định tách làm hai:**
- **Đói khi đứng yên** — việc nhỏ, độc lập, không phụ thuộc gì, làm được
  sớm bất cứ lúc nào (0 thóc kéo dài → phạt tăng dần: HP, có thể ốm).
- **Nợ thuế có răng thật** (hạn, dồn nợ, có thể mất ghế nếu là chức dịch
  không trả nổi) — GỘP vào "AI dùng ghế thật" (đã hoãn), vì cần đúng máy
  gỡ occupant khỏi ghế mà mục nợ `seat-occupant-xa` (T3.1) đã treo từ trước.
  Không làm riêng lẻ, sẽ phải sửa lại khi máy gỡ ghế thật ra đời.

---

## Bổ sung 30/8 (3) — nhãn hiển thị cần giọng, không chỉ đặc tả cơ chế

Phát hiện: 5 nhãn vốn cá nhân T3.2b ("con trâu cày", "chiếc thuyền nan"...)
đều thêm loại từ (con/chiếc/bộ) máy móc — đúng ngữ pháp nhưng đọc như sách
giáo khoa, không tự nhiên. Lộ ra vì đứng cạnh "quán trọ" (không loại từ) đọc
tự nhiên hơn hẳn. Đã sửa (bỏ loại từ, "nấu rượu"→"cất rượu" cho đúng kỹ
thuật).

**Nguyên nhân:** giao việc T3.2b chỉ có đặc tả cơ chế (loại, giá, hao mòn),
không có hướng dẫn giọng văn cho nhãn hiển thị. Agent tự điền, mặc định về
lối viết đúng-ngữ-pháp-nhưng-cứng thay vì tự nhiên.

**Luật rút ra, áp dụng mọi lần giao việc có sinh text hiển thị sau này:**
kèm theo đặc tả cơ chế, LUÔN kèm hướng dẫn giọng — ít nhất là "khớp giọng đã
dùng ở [chỗ nào đó đã viết tay, ví dụ quang_oai.md hoặc nhãn UI có sẵn]",
không để agent tự đoán giọng.

**Nợ chưa làm:** chưa audit các nhãn khác sinh ra trong T3.2/T3.3 (loại cửa
hàng, tên nút...) xem có dính cùng bệnh không. Để dành lúc dọn nợ chung, không
chặn T3.3-3.

---

## Bổ sung 30/8 (5) — GĐ2b sẵn sàng mở, kích hoạt bởi câu hỏi "chợ đen"

Lúc gần đóng T3.4, Ha hỏi "có chợ đen chưa" — hoá ra ý định rộng hơn nhiều so
với người mua muối lậu đang làm ở T3.4-3b: **chợ đen chung cho nhiều hàng
cấm/đồ trộm**, không phải riêng muối.

**Quyết định:** T3.4-3b giữ hẹp (chỉ muối, đúng kế hoạch cũ). Chợ đen tổng
quát = đúng nội dung **GĐ2b**, không nhét vào T3.4. GĐ2b cần những thứ chưa
tồn tại: khái niệm hàng cấm nói chung, cơ chế trộm cắp sinh "đồ trộm", cơ
chế "có ai nhìn thấy không" (đã có trong mục "Player-generated events qua
inbox" phía trên, chưa code), chỗ tiêu thụ hàng (có thể tái dùng shop theo
hướng tham nhũng, chưa quyết).

**Tin quan trọng: GĐ2b giờ mới thực sự SẴN SÀNG để bàn**, không phải tiếp
tục hoãn. Lý do nó phải chờ tới giờ: cần biết "ai sở hữu cái gì" trước khi
thiết kế item/vận chuyển — mà dòng họ cục bộ (T3.1), ruộng đất (T3.3), cửa
hàng (T3.2) giờ đều đã tồn tại và đã test kỹ. Trước đây bàn GĐ2b chỉ là bàn
trên giấy trắng; giờ bàn trên nền đã có thật.

**Kế hoạch:** đóng nốt T3.4 (chỉ còn 3b) → mở buổi bàn riêng cho GĐ2b, KHÔNG
code trước, đúng cách đã làm với mọi hệ lớn khác trong track T3. Các mảnh
đã ghi rải rác trong file này (player-events/witness, dòng họ tách tổ chức,
hàng ngoại thương — xem các mục "Bổ sung" phía trên) là điểm khởi đầu cho
buổi bàn đó, không cần tìm lại từ đầu.

---

## Nguyên tắc, không phải việc — nhớ khi thiết kế mọi thứ sau này

**Mọi hành động mới, tự hỏi: ai sẽ biết chuyện này xảy ra?** Không ai biết thì
nó không làm thế giới thật hơn, chỉ làm màn hình dày hơn thôi.

**Công khai, có tên, chụp được.** Bạn bè ngoài đời kéo nhau vào chơi rồi thấy
thứ hạng đảo lộn (công an xã ngoài đời thành lính lệ, trưởng xã thành thư lại
dưới quyền bạn mình) là chất liệu virality mạnh nhất game này có. Muốn nó xảy ra
thì mọi ghế, mọi chức, mọi vụ án phải công khai và dễ chụp màn hình mang lên
group — Sổ Quan Chức, giấy tờ có triện đã đi đúng hướng này.

**Từ cổ đứng cạnh giọng hiện đại mới buồn cười.** Chức danh, tên chợ, đơn vị
hành chính phải đúng thời kỳ (lý do đáng tra lại Quảng Oai hôm qua). Người chơi
tự mang giọng chửi thề hiện đại của họ vào đóng lên trên cái nền đó — không cần
viết NPC nói tục, chỉ cần nền đủ nghiêm trang để giọng thật của người chơi bật
lên tương phản.

**Không bao giờ bán thứ chạm vào "sống".** Free hoàn toàn cho người chơi khả thi
thật — chi phí server gần như bằng không với quy mô này, cái duy nhất tốn là
thời gian của Ha. Sau này có thu phí thì tuyệt đối chỉ cosmetic (triện, khung
giấy tờ, khắc sử ký) — không bao giờ bán chức, quân, slot nhân vật. Đam mê hơn
tiền, khoá cứng ranh giới này ngay từ đầu để không phải tự hỏi lại lúc có tiền
thật.

**Chia nhỏ + tự kiểm là bắt buộc, không phải tuỳ chọn.** Bài học từ cách làm cũ
(giao ý tưởng chung chung cho Antigravity/Cursor, tự test bằng cách vào chơi rồi
báo lỗi) — sai không phải vì công cụ dở, mà vì ý tưởng mơ hồ thì agent không có
gì để tự kiểm theo. Cách đã chạy đúng cả ngày nay: dò trước → chốt thiết kế → giao
kèm lệnh kiểm chứng cụ thể → dừng kiểm từng bước nhỏ. Giữ nguyên cách này cho mọi
việc sau, kể cả khi không có ai ngồi cạnh nhắc.

---

## Bug đã biết, sẵn sàng giao khi quay lại code — audio.js

Gốc rễ chắc chắn: `playBg()` đặt `audio.loop = true`, nên `onended` không bao
giờ bắn, và code không hề có đường "hết bài → chuyển bài kế" — chỉ có đường
lỗi tải (`onerror`). Kết quả: mãi mãi lặp track index 0, hai track kia không
bao giờ được gọi tới.

Việc cần làm: bỏ `loop = true`, gắn `onended` → chọn ngẫu nhiên bài kế (tránh
lặp lại đúng bài vừa nghe); dọn thư mục nhạc (xoá bản trùng hậu tố "(1)"/"-2",
giữ đúng 3 file gốc); đồng bộ lại `TRACKS` trong `audio.js` với tên file thật
và sửa `readme.txt` đang hướng dẫn sai tên (`bgm1/2/3.mp3` trong khi code đọc
`track1/2/3.mp3`).

Hiện tượng "chưa hết bài đã lặp lại" chưa chắc chắn nguyên nhân (có thể do
đoạn cuối file có khoảng lặng, có thể do file bị cụt lúc copy — dấu hiệu là
file "(1)" hậu tố, kinh điển của việc copy đè trùng tên) — không đoán thêm,
nhưng sửa xong lỗi gốc thì vấn đề này gần như hết quan trọng: dù file có cụt
sớm, giờ sẽ chuyển bài khác thay vì kẹt lặp mãi một bài lỗi.

---

## Việc kế tiếp khi quay lại code

**Track T3.2 gần xong:** T3.2a (seed shop), T3.2b (vốn cá nhân), T3.2c-1 (mở
quán trọ + countdown), T3.2c-3 (UI Cơ Nghiệp, kiểm bằng mắt trên trình duyệt
0 lỗi) — cả 4 xong. Chỉ còn **T3.2c-2** (vacancy: `shop.vacantSinceDay` + tick
tháng "họ mạnh nhất xã lấp" sau 45 ngày bỏ trống, ghép `pickXaSeatSuccessorClan`
+ template spawn T3.2a). Làm nốt cái này là đóng hẳn T3.2.

**Ngay sau khi T3.2 đóng, trước khi mở T3.3:** làm việc nhỏ ở "Bổ sung 30/8
(2)" — sửa gate `actionXayNha` sang kiểm ghế thật thay vì `minRank`. Việc lớn
(viết lại court.js) để dành cho "AI dùng ghế thật" sau cả track T3.

**Đừng làm cùng lúc:** hai lớp đồng hồ (chờ GĐ3), player-events qua inbox (chờ
GĐ2b), dòng họ/tổ chức (chờ GĐ2b), AI có lịch trình (chờ AI dùng ghế thật),
quân số ×10 (đã hoãn, sổ nợ kỹ thuật), audio (nhỏ, độc lập, làm lúc nào tiện,
không cần gộp chung một khối với T3.2). Một khối, làm cho xong, kiểm cho
sạch, rồi mới mở khối tiếp theo.

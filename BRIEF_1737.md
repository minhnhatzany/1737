# 1737 — Brief bàn giao

Dự án: chuyển game text offline `1737` thành **xã hội online dạng text**.
Repo: `~/Documents/GitHub/1737`. Vanilla JS, ES modules, không framework.

Đọc hết file này trước khi chạy lệnh đầu tiên.

---

# PHẦN A — TRẠNG THÁI REPO

## A.1 Lịch sử commit

```
789d6e0  fix: Bo sung day du cac import tu module ngoai va noi bo sau buoc 5  ← MỐC HIỆN TẠI
d4dd566  3-5: Tach cac khoi actions va quests (chuan hoa CRLF)
c7e070d  2: Tach actions/clan.js
68f95c3  moc truoc GD0
15b9903  Init game source                                                      ← bản gốc sạch
```

Có một commit `0fcaf30 "6: Tach main.js..."` đã bị **reset bỏ**. Bước đó hỏng: agent
cũ không cắt dán mà tự viết lại một phần UI (chế lại `PERSONALITY_TRAITS`,
`TUTORIAL_PAGES`, `openTab`, khối boot `DOMContentLoaded`), và có lúc làm mất hẳn
hàm `render()` rồi phải nhét lại từ git history. **Không khôi phục commit đó.**

## A.2 Cấu trúc file hiện tại

```
engine.js            4243  luật game, state, tick, geo, hành động còn lại
main.js              5267  toàn bộ UI (CHƯA chẻ, và sẽ KHÔNG chẻ — xem D.0)
war/legacy.js        1039  33 hàm AI chiến tranh — sẽ XOÁ ở GĐ1
actions/clan.js       531
actions/livelihood.js 238
actions/market.js     189
actions/office.js     184
actions/rebel.js      156
actions/property.js   105
quests.js             491
models.js  events.js  map_data.js  court.js  warfare.js
lifestyle.js  weather.js  history.js  log.js  audio.js
index.html  style.css
eslint.config.js     (agent cũ tạo, giữ lại, có ích)
```

Tầng luật (`engine.js`, `actions/*`, `events.js`, `models.js`, `map_data.js`,
`quests.js`, `lifestyle.js`, `court.js`, `warfare.js`) **không đụng DOM một chỗ nào**.
Toàn bộ DOM nằm trong `main.js` + 24 `onclick` trong `index.html`.
Đây là tài sản lớn nhất của repo: tầng luật bê lên server được gần như nguyên.

51 hàm `actionXxx(state, args)` đều trả về cùng một hình dạng
`{ ok, msg, feedback[], sfx }` — gần như là chữ ký RPC sẵn.

## A.3 Nợ kỹ thuật đã biết, KHÔNG sửa bây giờ

- **Circular import** giữa `engine.js` và `actions/*.js`. Chạy được nhờ ESM hoisting
  khai báo `function`. Dọn ở GĐ2 khi tách helper sang `core/`.
- **Bề mặt export quá rộng**: agent cũ export hàng loạt hàm nội bộ (engine.js từ 90
  export gốc lên 120; `actions/clan.js` bị `perl -pi -e 's/^function /export function /'`
  export sạch cả file). Dọn cùng lúc với circular import.
- **Branch phân nhánh với origin**: 2 commit ở local, 1 trên GitHub.
  **CẤM `git pull`, `git push`, `git merge`, `git rebase`** cho tới khi xong GĐ1.
- `models.js`: class `Player` thiếu khởi tạo `wantedLevel` (chạy được nhờ `|| 0`
  rải khắp nơi). Sửa khi gộp Person ở GĐ2.

## A.4 Cách test

Không mở bằng `file://` (ES modules chặn). Chạy:
```bash
cd ~/Documents/GitHub/1737 && python3 -m http.server 8000
```
rồi mở `http://localhost:8000`.

**Đừng test bằng `1737.thuongluongmini.workers.dev`** — đó là bản deploy cũ trên
Cloudflare, không phản ánh code ở máy.

Game có sẵn khung báo lỗi đỏ "Loi khoi dong game" ở đầu trang, hiện mọi
ReferenceError khi khởi động. Không cần mở console cũng thấy.

---

# PHẦN B — LUẬT LÀM VIỆC

Rút ra từ nhiều lần agent làm hỏng. Áp dụng cho mọi bước.

## B.1 Trung thực
- Mọi bước phải **chạy lệnh nghiệm thu và dán output thật**.
- Không chạy được → báo `KHÔNG CHẠY ĐƯỢC` + dán nguyên lỗi → **DỪNG**.
- **TUYỆT ĐỐI không suy ra kết quả từ việc đọc source code.**
- Nếu phải đọc source để trả lời câu hỏi đáng lẽ do lệnh trả lời → DỪNG, báo cáo.

## B.2 Phạm vi
- Chỉ làm đúng việc của bước đang chạy.
- **CẤM** refactor kèm, đổi tên biến, "cải tiến", format lại code không liên quan,
  tối ưu, sửa bug tiện tay, tạo file cho việc chưa được giao.
- **CẤM** đổi bất kỳ con số gameplay nào (giá, tỉ lệ, chi phí, phần thưởng) trừ khi
  bước đó nói rõ.
- Thấy code xấu hoặc bug → **ghi vào cuối báo cáo**, không tự sửa.

## B.3 Thao tác cơ học
- Di chuyển code = **CẮT và DÁN nguyên văn**. Không gõ lại, không tự chế lại nội dung.
  Nếu thấy mình đang gõ lại một hằng số hoặc một hàm từ trí nhớ → sai, dừng lại.
- Bulk rename phải dùng regex có **biên từ** (`\bfoo\b`). Cấm `String.replace` hoặc
  `sed` với chuỗi con.
- **CẤM** export hàng loạt kiểu `s/^function /export function /`. Chỉ export đúng
  hàm thực sự được file khác gọi.
- Script tách file phải dò **cả tên import từ module thứ ba** (`weather.js`,
  `court.js`, `map_data.js`, `lifestyle.js`, `log.js`), không chỉ dò khai báo nội bộ.
  Bỏ sót chỗ này đã từng làm mất `rollPersonalHarvestThoc` và vỡ game.

## B.4 Định dạng
- File dùng **CRLF**. Không convert sang LF.
- Sau mỗi thay đổi, `git diff --stat` chỉ được hiện số dòng thực sự sửa.
  Hiện cả file = đã nuốt CRLF = DỪNG.
- Kiểm: `perl -ne 'print if /[^\r]\n$/' <file> | wc -l` phải ra `0`.

## B.5 Git
- Commit sau **mỗi** bước. **CẤM `git commit --amend`.**
- **CẤM `git pull`, `git push`, `git merge`, `git rebase`.**
- Kết thúc mỗi bước: dán `git diff --stat`.

## B.6 Điều kiện DỪNG bắt buộc
Gặp bất kỳ điều nào sau đây → DỪNG, báo cáo, chờ người:
- Một lệnh nghiệm thu không đạt
- Circular import mới
- Tên hàm trong spec không tồn tại trong source
- Phải quyết định một thứ spec không nói rõ

**Không tự vá để đi tiếp.** Sai một bước mà đi tiếp là hỏng toàn bộ.

## B.7 Tự động đi tiếp
Nếu **tất cả** nghiệm thu của một bước đều đạt:
1. `git add -A && git commit -m "<mã bước>: <mô tả>"`
2. In `=== BƯỚC <n> XONG, ĐI TIẾP ===`
3. Chạy bước kế tiếp, không hỏi lại.

---

# PHẦN C — GAME NÀY LÀ GÌ

Phần này quyết định mọi lựa chọn kỹ thuật. Đọc kỹ.

## C.1 Một câu

**Social sandbox MMO dạng text, bối cảnh Đàng Ngoài 1737 (Lê Trung Hưng, chúa Trịnh
Giang), vài trăm người chơi trong một phủ.** Tham chiếu gần nhất: Torn City, MUD kiểu
Achaea. Không phải CK3, không phải EU5.

Bản offline hiện tại chán vì nó là **dashboard**: 51 nút, nút nào cũng "+tài nguyên",
không nút nào có thể làm mất gì. Chính tác giả phải làm nút "Tua tới 1740" và "God Mode"
— dấu hiệu khúc giữa rỗng.

## C.2 Nguyên tắc gốc

**Hệ thống cố tình KHÔNG làm hộ người chơi.** Mục tiêu không phải giải trí cho một
người, mà là **đẻ ra tình huống buộc người chơi phải nhờ người khác giải**.

Cảnh cần đạt được — người chơi lên group Facebook đăng:

> "Bác nào cho e xin mấy đồng với, nghèo quá không có tiền nộp sưu"
> → cmt: "sang xã anh cho làm hầu 3 tháng rồi chú té"
> → cmt: "đi bán muối lậu không?"

> "Bác nào đang đánh mạn Thái Nguyên cho e ké với, ít quân công quá,
> thằng A nó làm thống lĩnh dìm e cho e làm giám quân"
> → cmt: "lên c.mày lên đây bố tiếp, đừng đùa với quân Hoàng Công Chất"

> "Ông nào quan phủ Lạng Giang bảo thằng quan huyện thả tôi ra cái,
> ăn trộm mỗi bao gạo nó giam tôi cả tuần rồi"

Mỗi câu đó là một chỗ hệ thống chừa trống có chủ đích.

## C.3 Sáu trụ cột

### 1. Ghế là thực thể, người ngồi chỉ là thuộc tính

```
seats: {
  seat_lytruong_lac_tu: {
    id, title: "Lý trưởng", scope: "xa", scopeId: "xa_lac_tu",
    occupantId,              // trỏ tới person BẤT KỲ: người thật HOẶC AI
    appointedBy,             // ai bổ nhiệm → ai có quyền cách chức
    appointedDay,
    legitimacy: "mua" | "thi" | "tien_cu" | "the_tap",
    subSeats: []             // ghế phụ do chính người này bổ nhiệm
  }
}
```

- **Không có bảng riêng cho chức của NPC và chức của player.**
- **Không gắn nhãn `[BOT]` ở bất kỳ đâu trong UI.** AI và người hiện y hệt nhau.
- Người chơi vắng lâu → "bỏ nhiệm sở" → AI lấp vào. Chết thì mất người, không mất ghế.
- Quyền phải **chia nhỏ được**: người giữ chức tự bổ nhiệm ghế phụ, và tiến cử lên trên.
  Quan phủ phải lật được quyết định của quan huyện.
- **Giới hạn suất**: mỗi khoa chỉ 3 Tiến Sĩ, mỗi làng chỉ 1 Lý trưởng. Khan hiếm mới
  đẻ ra hối lộ, kết bè, tố cáo.
- Cần một trang **Sổ Quan Chức công khai**: chức này ai giữ, ai bổ nhiệm, dưới có ai.
  Không có nó thì không ai post được gì.

Codebase đã có `state.officials = { lyTruong: npcId, ... }` và NPC dùng chung enum
`PlayerRank` với player — đúng hình dạng, chỉ cần nâng cấp.

### 2. AI là nguồn cầu, không phải đối thủ

Giải bài toán "mới có 20 người thì chơi với ai".

Lý trưởng AI cần thư lại. Phú hộ AI cần người chở thóc. Đồ tể AI cần phụ mổ. Lái buôn
AI cần người gánh muối chuyến này. Ngày đầu bảng tin đã đầy việc, đầy tên.

**AI giữ chỗ, người tạo chuyện.** AI biết mua bán, trả công, nhận hối lộ, bổ nhiệm.
Nhưng AI **không mưu, không kết bè, không nói dối, không chủ động gạ ai**. Một người
thật bước vào huyện toàn AI là thống trị chỗ đó trong một tuần. Đó là phần thưởng.

### 3. Kinh tế vật lý

- **Item phải mất được và di chuyển vật lý được.**
- Trade chỉ khi **cùng huyện**, hoặc thuê phu gánh/thuyền → **đoàn hàng bị cướp được**.
  Một luật đó đẻ ra: tuyến buôn, cướp phục kích, thuê hộ tống, bảo kê mãi lộ.
- Loại item:
  - **Cồng kềnh**: thóc, muối, gỗ, vải, cá khô. Nuôi quân phải có thóc.
  - **Hàng cấm**: muối lậu, vũ khí, hoả mai. Quan có quyền **khám xét người chơi khác**.
  - **Giấy tờ**: ấn tín, sắc phong, văn bằng, **giấy thông hành**, **sổ đinh/sổ điền**.
    Không thông hành thì qua trạm bị chặn → trộm phải mua giấy giả.
    Đốt sổ đinh một huyện thì thuế huyện đó sập.
  - **Xa xỉ**: vàng, ngọc, trầm hương. Chức năng chính là **hối lộ**.
  - **Bảo vật có tên riêng**: duy nhất, có **lịch sử chủ sở hữu công khai**.
    "Ô Long Đao — Trần Văn B rèn 1737, Lê C cướp 12/3, quan tịch thu 5/4."
    Đây là thứ người ta chụp mang lên group.
- **Chợ đen**: đồ ăn trộm bán chợ thường bị nhận diện, phải qua tay buôn lậu, mất 30%.
  Trộm buộc phải quen thương nhân.
- **Đừng làm chợ tự động, bảng tuyển quân tự động, auction house.** Tiện một cái là
  cả group im. Bất tiện có kiểm soát chính là thiết kế.

### 4. Đường lên quan không đi qua thi cử

Năm 1737 chúa Trịnh Giang nổi tiếng bán quan bán tước (file `history.js` đã ghi
"chìm đắm trong yến tiệc và hoang phí"). Nên **mua chức là con đường chính danh**,
không phải cửa sau.

Năm đường lên, đều nhanh hơn thi:
- Mua thẳng từ người đang có quyền bổ nhiệm
- Chạy chọt cấp trên của thằng đang giữ ghế
- Bôi nhọ cho nó mất chức rồi vào thay
- Lấy con gái nhà nó
- Được nhận làm đàn em, chờ nó lên rồi kéo theo

Thi cử vẫn còn, làm **đường chậm nhưng sạch**: chức mua thì ai cũng biết là mua, uy tín
thấp, dễ bị lật. Đỗ thật thì khó lật hơn.

### 5. Quân công do người chia, không do máy tính

Nếu hệ thống tự cộng công theo sát thương thì không ai bị dìm, mà không bị dìm thì
không có cái post "thằng A nó dìm e". **Thống lĩnh cầm cả rổ công và tự chia.**
Toàn bộ chính trị nội bộ nở ra từ đúng một dòng luật đó.

### 6. Nghèo và bị giam vẫn phải nói được

Trạng thái kẹt **khoá hành động vật lý nhưng chừa hành động xã hội**. Bị giam vẫn nhắn
được, vẫn nhận tiếp tế, vẫn hối lộ cai ngục được. Giam mà mất luôn khả năng tương tác
là giết đúng người đang tạo nội dung hay nhất.

## C.4 Các quyết định thiết kế đã chốt

**Khai sinh**: random xuất thân, người chơi chọn tính cách.
- Tỉ lệ: 60% bần cố, 25% trung nông có chữ, 12% khá giả, 3% con quan.
- Cho reroll 2-3 lần rồi khoá.
- **Nghèo phải sướng**, không phải bản yếu hơn của giàu: đi lại không ai để ý, không
  có gì để bị tống tiền, **vào được băng nhóm mà con quan không vào được**. Con quan
  thì có sẵn chức nhưng bị theo dõi, cả họ chịu vạ lây.
- Công khai kết quả roll lên feed: "Nguyễn Văn A, con nhà bần cố xã Lạc Tứ, vừa nhập thế."
- Tính cách: cho chọn 2, và nó **mở khoá hành động** chứ không cộng chỉ số. Hiện công
  khai một phần trên hồ sơ ("thằng này nổi tiếng phản trắc" là thông tin đắt).
- **Random quan hệ có sẵn**: ông chú làm lý trưởng, món nợ 5 quan bố để lại, mối thù
  giữa họ nhà mình với một dòng họ khác.

**Chết**: giáng cấp, không xoá sổ.
- Vào lại làm con cháu trong họ, **cùng phủ**, giữ tên họ và quan hệ cũ, mất sạch chức
  tước tài sản. Kẻ thù cũ vẫn nhớ mặt.
- **Giết người phải qua quy trình**: bắt → giam → xử → hành hình, và **ngày hành hình
  công bố trước 2-3 ngày thật**. Có thời gian cho hối lộ, chạy án, kêu oan, cướp pháp
  trường. Cái chết thành sự kiện cả server hóng.

**Thể lực**: giữ cơ chế, đổi phạm vi.
- Hành động **xã hội tốn 0 vĩnh viễn**: chat, đăng việc, nhận việc, trả giá, hối lộ,
  bổ nhiệm, tố cáo, kêu oan, đọc feed, thăm tù.
- Hết thể lực = "hôm nay hết việc tay chân, đi nói chuyện với người đi", không phải
  "hết chơi". Ngân sách là vô lăng lái sang tầng xã hội.
- Hiển thị đổi từ thanh `⚡ 100%` sang **số buổi** (sáng/chiều/tối). Đọc như thời gian,
  không như pin game mobile.
- Trần tích luỹ ~9 buổi (1.5 ngày). Đi vắng 1 tuần về không càn quét được, ngủ 8 tiếng
  không mất gì.

**Thời gian**:
- 1 ngày trong game ≈ **4 tiếng thật** (6 buổi/ngày, hồi ~1 buổi/40 phút).
  Để thành **một hằng số duy nhất** trong `core/time.js` để chỉnh được.
- **Deadline đếm bằng ngày THẬT**, không phải phút. Hạn nộp sưu 3 ngày thật thì mới
  kịp post, kịp có người cmt, kịp gặp nhau. Tick nhanh là mọi khủng hoảng tự giải
  quyết trước khi ai kịp trả lời, và cái group chết.
- **Thế giới chạy khi người chơi đóng tab.** Mở lại thấy thuế đã tăng, thấy có người
  nhắn tìm mình.

**Phạm vi**: **1 phủ, 3-4 huyện**, mỗi huyện vài xã. Không phải 1 huyện — cần tầng trên
để kêu, không thì mảng "nhờ quan phủ lật quan huyện" chết. Thăng Long để NPC ở xa,
làm đích chạy chọt. Mở server sau = mở thêm phủ, và **liên phủ mới có cướp đường dài,
buôn xa, chiến tranh**.

**Mùa**: 4-8 tuần. Hết mùa một triều đại sụp, reset thế giới, giữ danh hiệu và bảo vật
vào "sử sách" hiển thị vĩnh viễn. Không có mùa thì sau 2 tháng mấy người đầu có 5 vạn
quân, người mới bị nghiền, server thành ma.

**Một tài khoản một nhân vật.** Cho nuôi alt là người ta tự làm quan cho chính mình,
tự thuê chính mình, và toàn bộ nhu cầu nhờ vả biến mất.

**Công thành** (làm sau, ghi để không quên): trận = phòng có đồng hồ, ~40 vòng × 90 giây,
mọi người chọn lệnh đồng thời rồi nổ cùng lúc. 87 giây trống là để chat, gọi cứu viện,
cãi nhau — coordination chính là gameplay. Nhiều cửa (Đông/Nam/Tây), **chỉ thấy cửa
mình đang đứng**, muốn biết cửa khác phải có người báo → nên **nói dối được**. Điều quân
giữa cửa mất 2 vòng. Thua vì **vỡ sĩ khí** chứ không phải hết máu → có khoảnh khắc sụp
đổ dây chuyền. 60% kết quả quyết ở khâu chuẩn bị (thóc, vũ khí, trinh sát, nội ứng,
viện binh) → thằng lái buôn và thằng ăn trộm cũng dự phần. **Tuyên chiến trước 24 tiếng
thật** — không có hẹn giờ thì không có gáy nhau, không có kèo. Cho đặt lệnh mặc định để
rời đi 5 phút không bị phạt.

## C.5 Giao diện

**Bỏ dashboard, làm feed.** Màn chính là dòng chảy văn bản như group chat:

```
Lý trưởng xã Lạc Tứ vừa tăng thuế lên 4 quan.
Trần Văn B bị bắt tại chợ Kẻ Sặt, tang vật 2 bao gạo.
Quan huyện Đường An treo giá 20 quan bắt Lê C.
```

Hành động hiện **ngay trong dòng đó**, không nằm ở lưới nút cố định. Đọc tin B bị bắt
thì ngay dưới có "Thăm nuôi / Bảo lãnh / Kệ mẹ nó".

Bottom nav **4 tab**: **Chốn** (đang ở đâu, thấy ai) · **Thân** (bản thân) ·
**Tin** (feed + chat) · **Việc** (deadline đang treo).

**Giấy tờ có triện** — đây là thứ làm text hết chán, không phải thêm hình:
lệnh truy nã, sắc phong/bổ nhiệm, bản án, bảng công sau trận. Làm trông như giấy thật:
nền giấy dó, chữ đứng, con dấu triện, viền mộc. Toàn bộ chỉ là CSS + typography.
Mỗi người một **con triện** thay avatar, đổi màu theo phe.

Đây là thứ người chơi chụp mang lên group. Không cần pixel art, không cần minh hoạ.

**Nền tảng: web, không phải app store, không phải Steam.** Vòng lan truyền là
thấy post → bấm link → 10 giây sau đang chơi; store giết đúng chỗ đó. Và server đang
chạy mà sửa lỗi phải chờ Apple duyệt 1-3 ngày là án tử. Làm **PWA** (manifest + icon),
**push notification** ("còn 1 tiếng nữa đánh Quảng Oai", "m bị treo giá 20 quan",
"ngày mai xử chém"), và **deep link** mở thẳng vào trang lệnh truy nã kèm ảnh preview.

## C.6 Kiếm tiền và chống gian lận

**Tiền**: quy mô vài trăm người thì không kiếm được, và cũng gần như không tốn.
Mục tiêu là đừng lỗ. Không thu phí vào cửa.

Bán được (toàn bộ là cosmetic, và may mắn là thứ đáng chụp nhất):
con triện riêng · khung giấy tờ (giấy dó, sắc phong, viền, lối chữ) · gia huy cho dòng
họ · khắc tên vào sử sách khi chết kèm văn bia tự viết · dấu người ủng hộ cạnh tên.

**Không bao giờ bán**: chức tước, quân, tiền trong game, tài nguyên, hồi sinh, thoát tù,
và nhất là **thêm slot nhân vật** (= bán alt, phá nát nhu cầu nhờ vả).

**Chống gian lận**: client chỉ là màn hình, mọi thứ tính ở server.
- Luật viết thành Postgres function, bật RLS, client chỉ gọi RPC.
- Thời gian và thể lực tính lại từ timestamp trong DB, không tin giờ client gửi lên.
- **Thông tin ẩn: server chỉ gửi đúng phần người đó nhìn thấy.** Gửi cả 3 cửa rồi để
  UI giấu là mở devtools thấy hết, và mù thông tin biến mất.
- Nhân bản đồ: bọc transaction, thêm mã chống lặp mỗi lệnh.
- **Chống alt bằng thiết kế, không chỉ bằng kỹ thuật**: mọi bổ nhiệm, chuyển đồ, tha
  bổng đều **hiện công khai trên feed có tên hai bên**. Thằng tự phong cho nick phụ thì
  cả server thấy trong 5 phút.
- **Log mọi thứ và để log công khai.** Vừa chống cheat, vừa là nội dung, vừa là bằng
  chứng khi tranh cãi. `state.log` (Biên Niên Sử) đã có sẵn, nâng thành sổ cái server.
- **Chủ game không chơi nghiêm túc.** Tài khoản admin riêng, công bố rõ.
- `pg_dump` tự động hằng ngày, giữ 7 bản.

---

# PHẦN D — LỘ TRÌNH

| GĐ | Nội dung | Offline chạy được? | Trạng thái |
|----|----------|--------------------|------------|
| 0 | Dọn nền, chẻ file | Có | **Gần xong** — còn bước 7 |
| 1 | Cắt giả định single-player | Có | Chưa |
| 2 | Đổi mô hình dữ liệu | Có | Chưa, cần chốt thiết kế |
| 3 | Lên server | Không | Sau GĐ2 |
| 4 | UI feed | Không | Sau GĐ3 |

**GĐ 0–2 xong mà game vẫn chạy offline được.** Không đụng server cho tới khi bản
offline đã sạch. Dựng backend trên luật game còn hỏng là làm hai lần.

## D.0 Bước 6 (chẻ main.js) — ĐÃ HUỶ, KHÔNG LÀM

Lý do: GĐ1 sắp tới sẽ xoá rất nhiều trong `main.js` (save/load slot, điều khiển tốc độ,
độ khó, God Mode, tutorial modal chặn giờ). Chẻ bây giờ rồi tuần sau xoá một nửa là làm
hai lần. Và mục đích chẻ file (để agent làm việc được) đã đạt: engine.js từ 7090 xuống
4243.

Chẻ `main.js` sẽ làm ở GĐ4 khi viết lại UI thành feed.

**Nếu sau này có chẻ**: `state` trong main.js là biến `let`, ESM **không hoisting** biến
`let`. `ui/*` import ngược `state` từ `main.js` sẽ ra `undefined` lúc chạy mà **không
báo lỗi lúc load** — mọi lệnh kiểm tra đều xanh. Phải tách `state` ra `ui/context.js`
hoặc truyền vào làm tham số.

## D.1 GĐ0 — còn đúng một bước

### BƯỚC 7 — RNG có seed

`engine.js` có ~146 chỗ `Math.random()`, `map_data.js` 7, `events.js` 2.
Lên server bắt buộc phải seed được: không thì không replay được trận đánh, không debug
được, và người chơi kêu ăn gian thì không có gì chứng minh.

Tạo `core/rng.js`:
```js
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let _rng = makeRng(1737);
export function seedRng(seed) { _rng = makeRng(seed); }
export function rng() { return _rng(); }
export function randInt(a, b) { return a + Math.floor(rng() * (b - a + 1)); }
```

Thay **toàn bộ** `Math.random()` bằng `rng()` trong: `engine.js`, `actions/*.js`,
`war/legacy.js`, `quests.js`, `events.js`, `lifestyle.js`, `map_data.js`, `warfare.js`,
`court.js`.
**KHÔNG đụng `main.js`** — random ở tầng UI chỉ để làm hiệu ứng.

Nhiều file tự khai báo `randInt`/`rng` cục bộ — xoá bản cục bộ, import từ `core/rng.js`.
Lưu `state.rngSeed`.

Nghiệm thu:
```bash
grep -rn "Math\.random" engine.js core/ actions/ war/ quests.js events.js lifestyle.js map_data.js warfare.js court.js
#   → RỖNG
grep -c "Math\.random" main.js
#   → còn nguyên
```
Tạo `test/rng_determinism.mjs`: `seedRng(12345)` hai lần, sinh 100 số, so sánh phải
giống hệt → in `PASS`. Chạy `node test/rng_determinism.mjs`, dán output thật.

## D.2 GĐ1 — cắt giả định single-player

Vẫn chạy offline sau mỗi bước.

### BƯỚC 8 — Xoá điều khiển thời gian
Thế giới chung không dừng cho một người, một thế giới thì một luật.

Xoá: nút `⏸` và `x1/x2/x3` (index.html ~134-138: `timeStatus`, `btnSpeed1..3`);
khối "Preset Tốc Độ" (~544); "Độ Khó Campaign" và `state.difficulty`
(engine.js 976/3201/3261, main.js 167/172-181 — giữ nhánh `"normal"`, xoá easy/hardcore);
God Mode và "Tua Tới 1740"; biến `paused` (15 chỗ trong main.js).

Nghiệm thu: `grep -rn "\bpaused\b\|state\.difficulty\|setDifficulty\|btnSpeed" *.js core/ actions/ index.html` → rỗng.

### BƯỚC 9 — Đồng hồ không bao giờ dừng
**Bước quan trọng nhất GĐ1. Làm riêng, không gộp.**

`tickGame()` hiện có:
```js
if (state.pendingEvent) { openEventModal(state.pendingEvent); return; }
if (isGameClockFrozenModal()) return;
```
Mở modal sự kiện = thời gian đứng. Online không được.

- `state.pendingEvent` → `state.inbox: []`, mỗi mục
  `{ id, title, narrative, choices, receivedDay, deadlineDay }`
- `rollDailyEvent` đẩy vào inbox thay vì gán `pendingEvent`
- `tickGame()` **không bao giờ return sớm** vì sự kiện
- Quá hạn (`gameDay > deadlineDay`) → áp lựa chọn cuối cùng trong `choices` (thường là
  làm ngơ) → `logLine` → xoá khỏi inbox. Hạn mặc định `receivedDay + 5`.
- Xoá `isGameClockFrozenModal` và mọi chỗ gọi
- UI: modal chặn → danh sách thư mở/đóng được, không dừng giờ

Nghiệm thu: `grep -rn "isGameClockFrozenModal\|pendingEvent"` → rỗng.
Test `test/clock_never_stops.mjs`: chạy 200 `gameTick`, `gameDay` phải tăng đúng 200.

### BƯỚC 10 — Xoá save/load
Online thì không load lại. Mọi quyết định là thật.

Xoá slot 1-5, đổi tên slot, autosave meta, `SAVE_KEY`, `SAVE_KEY_OLD`,
`getSaveSlotKey`, `getAutoSaveKey`, `getAutoSaveMetaKey`, `actionSaveGame`,
`actionLoadGame`, `autoSaveMonthly`, khối "💾 Save / Load" trong index.html.
Tạm giữ state trong memory + **một** key localStorage (GĐ3 thay bằng DB).

Nghiệm thu: `grep -c localStorage main.js` → ≤ 3.

### BƯỚC 11 — Thể lực đổi cách hiển thị
**KHÔNG xoá cơ chế.** Chỉ đổi trình bày và thêm trần.
- Thanh `⚡ 100%` → số nguyên **"Buổi"** (0–9). Quy đổi `1 buổi = 16 theLuc`.
  Chỉ đổi chỗ **hiển thị**, **không đổi chi phí action nào**.
- `theLucMax`: 100 → **144** (9 buổi).
- Câu báo hết: `"Hết sức hôm nay. Nhưng miệng thì chưa mỏi — ra chợ xem ai đang cần gì."`
- Luật thường trực cho mọi action sau này: **hành động xã hội chi phí 0**.

### BƯỚC 12 — Xoá tầng AI chiến tranh
Xoá nguyên `war/legacy.js` (1039 dòng, 33 hàm).
Xoá khỏi `createInitialState`: `_warAi`, `_warLogistics`, `_warEconomy`,
`_warObjectives`, `_warAnnualStats`, `_warRegionalScratch`, `_battleChaos`,
`_battleContrib`, `_battleSim`, `_battleLedger`.
Xoá re-export war/legacy trong engine.js, các chỗ gọi `tickStrategicWarAi`,
`tickLiveBattles`, `processMonthlyWarEconomyAI`.
Trong main.js/index.html: xoá import `ensureBattleLedgerAndSimCompat`, `getWarHudIntel`,
`getWarCouncilBrief`, panel "Binh Pháp Đài".

**GIỮ LẠI** (GĐ2 dùng, đây là data model của cướp đường và chiếm đất):
```
_huyenControl, _huyenGarrisons
getHuyenControl, setHuyenControl, getHuyenGarrisonTroops, getHuyenGarrisonPower
actionAssignGarrison, actionRecallGarrison, actionUpgradeGarrison
siegeHuyen, actionJoinBattle
processMonthlyPropertyAndArmy       ← CHỨA LOGIC THU NHẬP BẤT ĐỘNG SẢN, đừng xoá nhầm
processMonthlyGarrisonUpkeep
```

Nghiệm thu:
```bash
ls war/ 2>/dev/null                                    # không còn legacy.js
grep -rn "_warAi\|_battleSim\|tickLiveBattles"         # rỗng
grep -rn "processMonthlyPropertyAndArmy" engine.js     # PHẢI CÒN
node test/clock_never_stops.mjs                        # vẫn PASS
```
Tổng dòng giảm ≥ 900.

## D.3 GĐ2 — đổi mô hình dữ liệu (chưa giao, cần chốt thiết kế)

- **T2.1** Ghế thành thực thể (schema ở C.3 mục 1)
- **T2.2** Gộp `Player` và `NPC` thành `Person` với cờ `isAI`. Khai báo đủ field trong
  constructor (`wantedLevel` đang thiếu).
- **T2.3** Dựng tầng xã cho 1 phủ. Hiện `map_data.js` có 13 phủ / 27 huyện nhưng
  tổng/xã chỉ sinh procedural tại chỗ người chơi đứng. Mà toàn bộ xã hội sống ở tầng xã.
  Chọn 1 phủ, viết tay 3-4 huyện × 3-4 xã × vài làng, cố định, có tên thật.
  **Đây là việc mới, không phải cắt bớt.**
- **T2.4** Item, kho, vận chuyển, chợ đen (thiết kế ở C.3 mục 3)
- Dọn nợ ở A.3: circular import, bề mặt export

## D.4 GĐ3 — server

- **Supabase free tier**: Postgres + Auth + Realtime. Frontend giữ nguyên trên Netlify/CF.
- **Đăng ký**: anonymous sign-in, vào là chơi luôn, chỉ gõ tên nhân vật. Chơi 15-20 phút,
  có chức hoặc tài sản rồi mới hiện "gắn email để không mất nhân vật".
- Mọi action → Postgres function, client chỉ gọi RPC, bật RLS toàn bộ.
- `pg_cron` tick 15–30 phút.
- Đừng poll mỗi 2 giây — dùng Realtime. Đừng tải cả feed từ đầu — phân trang.
- Project thứ hai làm bản thử. **Không sửa thẳng bản đang chạy.**

## D.5 GĐ4 — UI feed

Theo C.5. Chẻ `main.js` ở giai đoạn này (xem cảnh báo `let state` ở D.0).

---

# PHẦN E — VIỆC NGAY BÂY GIỜ

1. Xác nhận repo sạch ở mốc `789d6e0`:
```bash
cd ~/Documents/GitHub/1737
git log --oneline -n 5
git status
wc -l main.js engine.js          # kỳ vọng 5267 và 4243
ls ui/ 2>/dev/null || echo "khong con thu muc ui"
node -e "import('./engine.js').then(m=>console.log('exports:',Object.keys(m).length))"   # kỳ vọng 120
```

2. Nếu đạt → chạy **BƯỚC 7**, rồi tự đi tiếp **BƯỚC 8 → 12** theo luật B.7.

3. Sau BƯỚC 12: dừng, báo cáo, để người mở `localhost:8000` chơi thử.

Báo cáo cuối cần có: bảng `wc -l` toàn bộ file js, tổng dòng trước/sau, danh sách bước
xong / bước bị DỪNG và lý do, và mục **"Ghi nhận, chưa sửa"** liệt kê mọi bug hoặc code
xấu phát hiện dọc đường mà luật B.2 không cho phép sửa.

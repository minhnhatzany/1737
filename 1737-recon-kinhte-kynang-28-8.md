# Dò hiện trạng — Kinh tế + Kỹ năng thật (28/8)

Lượt dò trước khi giao khối "Kinh tế + Kỹ năng thật" (`1737-dinh-huong-28-8.md`,
mục "Khối việc tiếp theo"). **Chỉ dò, không viết code.** Đọc cùng `BRIEF_1737.md`.

Chốt bàn tối 28/8: 10 câu hỏi đã trả lời + cấu trúc track ở cuối file.

---

## 1. `actions/livelihood.js` — 12 action + 1 helper

File có **12 hàm `actionXxx` + `collapseFromExhaustion`** (helper), không phải 13
action. `actionNghiAnCom` (dòng 48-50) đã bị vô hiệu hoá.

Bộ 4 câu hỏi cho từng hàm:

| Hàm | Nguyên liệu từ đâu | Công cụ / vốn | Ai mua kết quả | Giới hạn nguồn |
|---|---|---|---|---|
| **actionCayRuong** :17 | Không có input. `rollPersonalHarvestThoc(thoiTiet)` → 10-25 × hệ số thời tiết, đổ thẳng `p.thocCaNhan` | **Không** — chỉ 20 thể lực. Không trâu, không thửa ruộng, không giống | Không ai — thóc vào kho cá nhân, bán ở `market.js` cho lái buôn ẩn danh (`marketPriceThoc` 1.5) | **Không.** Bấm tới khi hết thể lực. Chỉ modifier dòng họ (patron ×`patronHarvestBoost`, hostile `sabotageChance` −2) — chỉ ±sản lượng, không chặn |
| **actionKhaiThacDacSan** :51 | Theo `p.currentRegion`: SON_NAM→lụa, HAI_DUONG→muối, SON_TAY→gỗ, AN_QUANG→**tiền thẳng +20q**. Vùng khác: từ chối | Không — 25 thể lực | Item vào `inventory`; nhánh AN_QUANG bán cá ẩn danh cho tiền luôn | Chỉ region-gate |
| **actionChatGo** :85 | Rừng ẩn `1+randInt(0,2)`; SON_TAY ×1.35; LU/BAO ×0.82 | Không — 22 thể lực | `inventory.go` → market | Không |
| **actionDetVai** :99 | Sinh `1+randInt(0,1)` lụa; SON_NAM/KINH_BAC ×1.25 | **Không khung cửi, không bông/tơ** — 20 thể lực | `inventory.lua` → market | Không |
| **actionChanNuoiLon** :112 | Giống/cám trừu tượng hoá thành 8 quan | **8 quan tiền** + 18 thể lực (hàm sản xuất duy nhất tốn vốn tiền) | `inventory.thit_lon` → market; +uyTinCong nhỏ ngẫu nhiên | Không |
| **actionNauRuou** :127 | **2 thóc** (`p.thocCaNhan`) → 1-2 rượu. Hàm duy nhất tiêu tài nguyên game khác làm input | Không nồi/men — 16 thể lực | `inventory.ruou` → market (basePrice 15) | Chỉ giới hạn bởi thóc đang có |
| **actionCauCaSong** :141 | Sông ẩn; whitelist 8 trấn; thời tiết ±20% | Không cần câu/lưới — 16 thể lực | `inventory.ca` → market | Region whitelist; số lần không giới hạn |
| **actionDanhBatVenBien** :156 | Biển ẩn; AN_QUANG/HAI_DUONG; AN_QUANG ×1.25; BAO ×0.65 | Không thuyền — 24 thể lực | `inventory.ca` | 2 trấn |
| **actionBuonLauMuoi** :172 | Muối trừu tượng hoá thành 10 quan vốn | **10 quan** + 15 thể lực. `catchRate` (giảm theo `muuMeo`, tăng theo `smuggleCatchMul` patron). Bị bắt → `trongSoDenLy=true`, mất vốn | **Tiền thẳng** `randInt(20,45)` × `_quanLyBonus` — không qua chợ | **Không.** Chỗ duy nhất một livelihood action tự tăng chỉ số: `p.quanLy += 0.5` |
| **actionMoBinh** :197 | **20 thóc + 30 quan** → 10 lính | Thóc + tiền | Không bán — `p.quanSo += 10`, `p.binhQuyen += 15` | **CÓ** — `totalPops(village)/5 − village.drafted ≥ 10`. Hàm **duy nhất** có giới hạn nguồn thật (suất đinh). Nhưng `state.village` là 1 làng toàn cục, `drafted` không hồi |
| **actionLuyenVo** :220 | Không | 3 quan + 30 thể lực | `p._voTrainAccum`, mỗi 4 điểm → +1 `voThuat` (18% phiên "tốt" +2). **Mô hình "chỉ số là dấu vết hành động" đúng hướng KDC** | Chỉ thể lực |
| actionNghiAnCom :48 | — | — | disabled stub | — |
| collapseFromExhaustion :8 | helper: thể lực về 0, −15 tiền, `dangOm`, −10 hp | | | |

**Mẫu chung:**
- Nghề = (input: 16-25 thể lực) → (output: 1-2 đơn vị item + `logLine`). Ngoại lệ có
  input tài nguyên: nấu rượu (2 thóc), chăn lợn (8q), buôn lậu (10q), mộ binh (20 thóc+30q).
- **Không hàm nào cần công cụ/tài sản.** `PropertyDb` chỉ ảnh hưởng gián tiếp qua
  `_quanLyBonus` (lifestyle focus) và `hoc_duong/van_mieu` cho `actionDiHoc`.
- **Không hàm nào có người mua cụ thể.** Bán qua `market.js` cho lái buôn ẩn danh +
  `_marketScene` roll hàng tháng (1 hợp đồng/tháng, người giao "thương hội").
- **Giới hạn nguồn duy nhất trong toàn file:** suất đinh cho mộ binh.
- Clan modifier chỉ chạm 3 hàm: cayRuong, khaiThacDacSan, buonLauMuoi.

---

## 2. `court.js` — cách hocVan / voThuat / quanLy tăng

| Kênh | Cơ chế | Có phải "hành động thật"? |
|---|---|---|
| `actionDiHoc` :19 | 5 quan + 30 thể lực → `rng() < 0.40` (+0.15 nếu có holding `hoc_duong`/`van_mieu`) → **+1 hocVan**. Nút bấm xác suất, **không** qua `planActivity` | Có, nhưng là nút "+chỉ số" trực tiếp kiểu CK3 — khác accumulator của `actionLuyenVo` |
| `actionThiHuong/ThiHoi/ThiDinh` :44 | Gate `hocVan ≥ 20/40/60` + `hocVi`. Gọi `planActivity`. `resolveExam` (engine :1681): điểm = `hocVan + randInt(0,35) + bribe − fatigue`; đỗ → thăng `hocVi` + danhVong, **không +hocVan** | Thi = tiêu thụ chỉ số, không sinh |
| `actionBacCu` :86 | Gate `voThuat ≥ 20`. `planActivity`. `resolveBacCu` bracket 8 người; thắng → rank `DOI_TRUONG` + quân, **không +voThuat** | Tiêu thụ |
| `actionThangTienVo` / `actionXinChucBoNhiem` / `actionLuanChuyenKhaoKhoa` :103 | Chuỗi rank, tốn tiền lo lót, `rng` theo `uyTinCong`/`danhVong`. Gate `quanLy ≥ 30/50/80` nhưng **không tăng quanLy** | Không đụng chỉ số |

**Đối chiếu "chỉ tăng qua hành động thật":**
- **hocVan** — (a) `actionDiHoc` nút xác suất; (b) **lifestyle HOC_THUAT focus** +1/4 tháng
  *thụ động*; (c) holding `hocVanAccum` (`thu_phong`/`van_chi`) *thụ động*; (d) ~6 nhánh
  event (+1…+8); (e) perk `ht_*` (+5…+20 tức thời). → có kênh thụ động (b, c), **lệch nguyên tắc**.
- **voThuat** — (a) `actionLuyenVo` accumulator (đúng hướng); (b) `rebel.js` +0.5; (c) holding
  `lo_ren` `voThuatAccum` *thụ động*; (d) event; (e) perk `qs_*`.
- **quanLy** — **chỉ** `actionBuonLauMuoi` +0.5 + 2 event + perk. **Gần như không tăng qua hành động.**
- **ngoaiGiao / muuMeo** — hầu như chỉ perk + vài event; `AM_MUU` focus cho `muuMeo` +2/tháng thụ động.
- Buff `hocVanMon` (`hoc_duong`/`van_mieu`/`thai_hoc_vien` quảng cáo "+Học Vấn/tháng")
  **khai báo nhưng KHÔNG có handler** → chết.

---

## 3. `models.js` — 5 chỉ số

- 5 chỉ số: **`ngoaiGiao, voThuat, quanLy, muuMeo, hocVan`**. Số nguyên 0-100, `Math.min(100, …)`
  rải rác, **không getter, không XP→level**.
- Player khởi tạo `5 / 10 / 5 / 5 / 5` (:267-271).
- Person `isAI` dùng `core()`: 90% ra 9-20, 10% ra 20-48 (:231-238). Lý trưởng Quảng Oai
  truyền sẵn 5 chỉ số từ `rollLyTruongProfile` (stream RNG riêng, `core/seats.js` :86).
- **Lệch shape 2 nhánh cùng class `Person`**: nhánh AI có `intelligence`/`stamina`
  (mặc định 5); nhánh player không có, đổi lại có `danhVong, hocVi, diSan, perks,
  lifestyleXP{}, holdings[], inventory{}, properties{}, _voTrainAccum` (ngầm).
- `wantedLevel` **đã có** khởi tạo (:273/308) — nợ A.3 đã trả ở T2.2.
- Sót: `p.properties = { ruongDat: 1, tuuLau: 0 }` (:330) — **0 use-site**.

---

## 4. `PropertyDb` / `holdings` — có gì làm "vốn"

- `p.holdings[]` = `{ typeId, regionId, level }`. Xây qua `actionXayNha`
  (`property.js` :6) → `p.buildQueue`, hoàn thành theo **daily tick countdown**.
  Tốn `cost`, có `unlockCondition`. Mỗi region 1 cái / typeId.
- Buff áp dụng hàng tháng `processMonthlyPropertyAndArmy` (engine :3342) — **chỉ 8 key
  có handler**: `theLucRegen` (daily), `tienMon, thocMon, uyTinMon, hocVanAccum,
  voThuatAccum, unrestGiam, luongGiam`.
- **~12 key khai báo trong `PropertyDb` nhưng KHÔNG có handler** (dead): `quanBuff,
  hocVanMon, ngoaiGiaoMon, danhVongMon, khoBonus, thocPriceBuff, luaMonth, goMonth,
  npcOpinionMon, baoveTTGian, thuyQuanMon, phongThuBuff`.
- **Không có gì đóng vai "trâu / khung cửi / thuyền / nồi rượu"** — tư liệu sản xuất
  tăng năng suất **một nghề cụ thể**.
- `models.HoldingType` (`DIEN_TRANG/LO_REN/TUU_LAU/HOC_VIEN` :145) là **enum mồ côi** —
  khác `engine.PropertyDb`, `baseYield` không ai đọc.
- **Tiền lệ dùng được:** `hoc_duong`/`van_mieu` +0.15 xác suất cho `actionDiHoc` (công cụ
  đổi năng suất một nghề). Và `p.buildQueue` (job + daily countdown, nhiều job song song)
  gần với "vụ mùa nhiều giai đoạn" hơn `state.activity`.

---

## 5. `lifestyle.js` + birth trait

**`lifestyle.js` KHÔNG phải birth trait** — là hệ Lối Sống XP (5 cây: NGOAI_GIAO /
HOC_THUAT / QUAN_SU / QUAN_LY / AM_MUU).
- XP **hoàn toàn thụ động**: `tickLifestyle` +4/tháng cho cây focus, +1 cho các cây khác;
  perk point +1 mỗi 3 tháng. `addLifestyleXP()` tồn tại nhưng **không có caller**.
- Focus effect (:38): `QUAN_LY` → `_quanLyBonus = 1.10`; `AM_MUU` → `_amMuuBonus = 1.20`
  + `muuMeo += 2/tháng`; `HOC_THUAT` → +1 hocVan mỗi 4 tháng. Reset mỗi tháng ở
  `gameTick` :2739, re-apply ở `tickLifestyle`.

**Birth/personality trait thật ở `main.js`** (:180-202): `PERSONALITY_TRAITS` (10, chọn ≤2)
+ `BIRTH_TRAITS` (8, chọn 1). **Người chơi tự chọn** — chưa random như C.4, chưa reroll.

Ảnh hưởng "tay nghề nền" hiện tại **chỉ là cú +chỉ số một lần** trong `apply()`:
`thien_tai` +15 hocVan · `cuong_trang` +10 voThuat + theLucMax 176 · `ky_tuong` +10 quanLy
· `dung_cam` +10 voThuat · `gian_xao` +10 muuMeo · `hao_hoa` +10 ngoaiGiao · `linh_cam`
+8 muuMeo · `dep_trai` +5 ngoaiGiao.

Phần "hiệu ứng lâu dài" trong mô tả UI ("+25% sản xuất", "học nhanh 50%", "hồi thể lực
gấp đôi", "chi tiêu ít 20%", "+15% thăng chức"…) — đặt cờ `p._traitXxx`/`p._birthXxx`
nhưng **grep 0 use-site**. Chỉ `_traitGianXao` (events :1791/1800) và `_birthCuongTrang`
(events :1730) có tác dụng runtime.

→ **"Tay nghề nền từ xuất thân" hiện gần như không tồn tại** ngoài 1 lần cộng chỉ số.

---

## 6. `state.clans` — 3 clan phẳng

- `state.clans` = 3 `Clan` (engine :393): Nguyễn / Trần / Phạm. Field:
  `{ id, name, quyenLuc, ruongDat, trungThanh, attitude, memberIds }`. `nextClanId()` → `clan_1..3`.
- **Không có field `scope` / `scopeId` / `xaId` / `huyenId`.** `Clan` constructor
  (`models.js` :349) không nhận scope.
- `NPC.clanId` (:189/219) trỏ `clan.id`. **Chỉ 2-4 NPC/họ** sinh trong `clans.forEach`
  có `clanId`. NPC lý trưởng Quảng Oai (`rollLyTruongProfile`) tạo với `disposition: []`,
  **`clanId` = null**. NPC procedural khác cũng null.
- "Địa phương" = `state.village.clanIds` = `clans.map(c => c.id)` (**cả 3, hardcode** engine :552).
  `localClanIds()` (`clan.js` :96) = `village.clanIds.slice(0,6)`. → **mọi làng "có" đúng
  3 họ giống nhau.**
- Ghế lý trưởng (`core/seats.js`) **không liên kết clan**. `maybeAddClanRivalryCase`
  (`clan.js` :134) tạo "vụ án tranh chấp" nhưng random giữa 2 trong 3 họ toàn cục — **không
  gắn ghế, không tranh suất lý trưởng.**
- `map_data.js` đã có `lyTruong` (tên) cho 27 xã nhưng **chưa có dòng họ theo xã.**

---

## 7. `weather.js` + `planActivity` / `tickActivity`

**`weather.js`**: `Weather` 5 loại, `rollWeather()` chạy **1 lần/tháng** (`gameTick` :2750).
`rollPersonalHarvestThoc(weather)` base 10-25 × hệ số (MUA 1.3 … HAN 0.2). `_weatherForecast`
cho tháng tới. **Không có "vụ mùa", không trạng thái ruộng, không sự kiện phá hoại mùa màng.**

**`planActivity` / `tickActivity`** (engine :994 / :1738): state machine **1 slot**
(`state.activity`; `if active → từ chối`). Phase: `travel → waiting → ready → running →
returning → await_result`.
- Có sẵn: đăng ký + phí, đích đến cấp huyện, auto `startTravel`, cửa sổ nhắc 30 ngày,
  phạt lỡ kỳ, roster đối thủ + hối lộ/doạ, kết quả trễ (`resultsDueTotalDays`), archive + modal.
- 4 `kind` hardcode; title/fee/duration/region switch cứng (:1008-1011).

**Tái dùng cho vụ mùa nhiều giai đoạn:**

| Khớp | Lệch |
|---|---|
| Khuôn "đăng ký → đếm ngày **thật** → tick chuyển phase → sự kiện treo giữa chừng → kết quả trễ" đúng ý | **Chỉ 1 slot** — không thể vừa thi cử vừa làm mùa |
| Road events giữa chừng ≈ "ruộng đang có lúa dễ bị thời tiết/phá hoại" | Phase cứng gắn với "đi tới quan trường" — vụ mùa không đi đâu |
| `resultsDueTotalDays` ≈ "chờ 3-4 tháng rồi gặt" | Activity chỉ 1 "start + duration + 1 result", **không có N giai đoạn lặp** |
| | Không có **đối tượng bền** (thửa ruộng) sống qua nhiều tick, mang trạng thái riêng |

→ **`p.buildQueue` + daily countdown (`property.js` :46) là khuôn tốt hơn `state.activity`**
cho vụ mùa. Vụ mùa nên là `state.player.farmPlots[]` kiểu tương tự, KHÔNG nhét vào `state.activity`.

---

## Khoảng trống so với thiết kế

| Thiết kế muốn | Hiện trạng | Khoảng cách |
|---|---|---|
| 13 nghề: nguyên liệu thật, công cụ, người mua, giới hạn nguồn | Nghề = thể lực → item; không nguyên liệu, không công cụ, người mua ẩn danh, không giới hạn (trừ mộ binh) | **Rất lớn** |
| 3 loại ruộng (công/tư/lộc), cày thuê / cấy rẽ | 1 `actionCayRuong` không khái niệm thửa/sở hữu; `properties.ruongDat` chết | Toàn bộ |
| Trâu = "vốn"; mua 1 lần, đổi năng suất dài hạn | Không có tư liệu sản xuất theo nghề | Toàn bộ |
| Vụ mùa nhiều giai đoạn, ruộng "đang có lúa" là trạng thái treo | Không có; `planActivity` 1 slot + phase du lịch | Cần cơ chế job riêng (khuôn `buildQueue`) |
| Chỉ số = dấu vết hành động (KDC) | Chỉ `actionLuyenVo` đúng; hocVan/quanLy còn kênh thụ động | Trung bình — có tiền lệ tốt |
| Dòng họ có scope theo làng/xã, số lượng động, vị thế thay đổi | 3 họ phẳng toàn cục, không scope, `village.clanIds` hardcode | Lớn |
| Làng tự tranh ghế lý trưởng (1 suất) | Seat không gắn clan; rivalry case không gắn ghế | Lớn |
| Xuất thân chỉ quyết điểm đầu + cửa mở | Đúng tinh thần (cờ hiệu ứng lâu dài đều chết) nhưng vì **bug**, không phải thiết kế | Nhỏ |
| Người mua là AI | `_marketScene`: 1 hợp đồng ẩn danh/tháng | Trung bình |

---

## Đề xuất shape

**A. Vốn / công cụ — shape mới, KHÔNG nhồi vào `PropertyDb`:**
```js
p.capital = [
  { id, kind: "trau" | "khung_cui" | "thuyen_nan" | "noi_ruou" | "cay_bua",
    cond: 0..100,          // hao mòn
    acquiredDay,
    forHire: false }       // cho AI/người khác thuê → nguồn cầu
]
```
Lý do tách: `PropertyDb` nặng (region-lock + `buildQueue` + `unlockCondition` +
dispatcher buff 8-key, 12 key chết). Công cụ nghề là đồ mua-một-lần, không gắn region, hao mòn.

**B. Thửa ruộng — đối tượng bền, tách khỏi `state.activity`:**
```js
p.farmPlots = [
  { id, xaId,
    tenure: "cong" | "tu" | "lo" | "thue" | "re",
    landlordId,            // null nếu ruộng công (nộp làng) ; clanId/personId nếu tư/rẽ
    phase: "lam_dat" | "gieo_ma" | "cay" | "cho" | "gat",
    phaseDaysLeft,
    hasTrau: bool,         // đọc từ p.capital lúc "lam_dat"
    weatherHits: [],       // sự kiện thời tiết/phá hoại tích trong phase "cho"
    expectedYield }
]
```
Tick trong daily loop (khuôn `buildQueue`), song song được với `state.activity` (thi cử).

**C. Dòng họ có scope:**
```js
new Clan({ name, scope: "xa", scopeId: xaId,
           status: 0..100,           // vị thế, thay đổi được
           dominantSeatIds: [] })    // ghế họ đang nắm
// generator: 2-3 họ/xã cho 27 xã Quảng Oai, stream RNG riêng theo hash xaId
//            (đúng khuôn rollLyTruongProfile) → không lệch world-gen
// giữ 3 họ cũ làm fallback cho huyện procedural
// localClanIds(state) đọc theo p.currentXa, không phải village.clanIds
```
Seat lý trưởng thêm `contestingClanIds` + `locFields` (ruộng lộc mất theo ghế).

**D. Người mua AI:** mở rộng `_marketScene` từ "1 hợp đồng ẩn danh" → danh sách người mua
có tên + nghề + nhu cầu (`{ traderId, name, wantsItem, qty, priceMul, xaId }`).

**E. Chỉ số:** dùng lại pattern `_voTrainAccum` — mỗi hành động nghề bồi `p._skillAccum[stat]`,
đủ ngưỡng → +1. Gọi `addLifestyleXP()` từ action thật. Cắt kênh cộng điểm thẳng thụ động.

---

## 10 câu hỏi — đã chốt (bàn tối 28/8)

**Q1 — Khoá spawn về Quảng Oai:** Có. Quyết định đã chốt tối 28/8 (lúc bàn UI/UX), chỉ chưa
giao việc. Không khoá thì 26/27 xã viết tay chỉ có ý nghĩa với ai may mắn rơi đúng seed.
Thành **T3.0**, làm trước T3.1, nhỏ và độc lập.

**Q2 — Vụ mùa dùng `buildQueue`, không dùng `state.activity`:** Xác nhận. `activity` chỉ 1
slot, không thể vừa thi vừa cày.

**Q3 — `p.capital[]` tách riêng, không nhồi vào `PropertyDb`:** Xác nhận. `PropertyDb` đã
nặng và đã có 12 khoá buff chết — nhồi thêm là chồng rác lên rác.

**Q4 — Nhả suất công điền + gộp sửa luôn `village.drafted` không hồi:** Gộp sửa luôn. Cùng
một bệnh — "suất cấp ra rồi không có đường thu hồi" — ở cả mộ binh (đã có, đang lỗi) và
công điền (sắp có). Làm **một cơ chế thu hồi suất dùng chung** cho cả hai, không sửa hai lần.

**Q5 — Gộp bớt 12 nghề?** Không gộp cá sông/biển — để riêng, "vốn" (thuyền) sẽ tự phân biệt
khi làm T3.2. `actionKhaiThacDacSan` đúng là có vấn đề (chồng gỗ/muối/lụa; nhánh An Quảng
cho tiền thẳng là **bug bất đối xứng**, không phải thiết kế) — cách sửa để quyết lúc làm
T3.4b, không chốt trước. `actionMoBinh`/`actionLuyenVo` **loại khỏi khối cải cách kinh tế**
— không phải sinh kế, và `actionLuyenVo` là **mẫu để copy, không phải đối tượng để sửa.**

**Q6 — Cắt hẳn chỉ số thụ động hay giữ mức nhỏ?** Cắt hẳn phần **cộng thẳng điểm**
(`HOC_THUAT` +hocVan/4 tháng, holding `*Accum`). Giữ lại phần **nhân hệ số theo tình huống**
(`_quanLyBonus`, `_amMuuBonus`) — hai loại khác bản chất: một loại "tự nhiên có điểm dù
không làm gì" (vi phạm), loại kia "đang tập trung vào X nên làm việc liên quan X tốt hơn
ngay lúc đó" (không vi phạm).

**Q7 — `actionDiHoc` chuyển sang accumulator:** Có, đồng bộ với `actionLuyenVo`. hocVan
dùng một khuôn, voThuat dùng khuôn khác là không nhất quán.

**Q8 — Ruộng lộc gắn seat, tương tác treasury:** Ruộng lộc chảy thẳng vào `tien` cá nhân
của người đang giữ ghế (AI hay người), **tách biệt khỏi treasury cấp huyện** (tiền thuế nhà
nước, khác nguồn). Hệ quả phụ hay: NPC lý trưởng giữ ghế lâu giàu dần lên thấy rõ — `Person.tien`
đã có sẵn, không cần code thêm.

**Q9 — Dừng ở xã, không xuống làng:** Đúng, dừng ở xã. `state.village` (cấp làng) là một cục
toàn cục riêng, đổi nó là việc khác hẳn, không nhét vào khối này.

**Q10 — Mở rộng người mua có tên:** Giữ trong khối này, đúng vị trí **3.4c** — làm sau cùng
trong track 3.4, sau khi các nghề khác đã có đầu vào/đầu ra thật để người mua có ý nghĩa.

**Hai điểm thêm (chưa hỏi nhưng chốt):**
- Gộp sửa `village.drafted` cùng lúc với nhả suất công điền — đầu **T3.3a**.
- Phân biệt rõ "cộng điểm thẳng" (cắt) và "nhân hệ số tình huống" (giữ) khi làm **T3.5**.

---

## Cấu trúc track — chốt

`T3.0 → T3.1 → T3.2 → T3.3 → T3.4 → T3.5`. Dừng sau mỗi bước nhỏ (a/b/c) để kiểm, đúng
nhịp T2.1 đã chạy. `livelihood.js` chỉ bị đụng ở **T3.3b** và **T3.4** — thoả yêu cầu
"đừng sửa livelihood nhiều lần".

### T3.0 — Khoá spawn về Quảng Oai
Sửa `createInitialState`: random `homeRegion/homePhu/homeHuyen` (13 trấn/44 huyện) → giới
hạn còn 3 huyện Quảng Oai (`bat_bat`, `tien_phong`, `minh_nghia`). Không xoá dữ liệu 41
huyện khác, chỉ giới hạn nguồn random.
*Nghiệm thu:* tạo 50 nhân vật liên tiếp → `homeHuyen` luôn thuộc 1 trong 3. Test hồi quy PASS.

### T3.1 — Dòng họ cục bộ (nền, làm trước)
- **3.1a** `Clan` + generator nhận `scope/scopeId`; sinh 2-3 họ/xã cho 27 xã QO từ stream
  RNG riêng (hash xaId); giữ 3 họ cũ fallback cho huyện procedural. Chưa đụng gameplay.
- **3.1b** `localClanIds` đọc theo `p.currentXa`; gán `clanId` cho lý trưởng QO + dân
  procedural; `_patronClanId` vẫn chạy.
- **3.1c** Seat lý trưởng ↔ clan: `seat.contestingClanIds`; vị thế `clan.status` thay đổi
  (đỗ đạt +, thua kiện/tuyệt tự −); tranh ghế thành case/event.

### T3.2 — Vốn & công cụ
- **3.2a** Shape `p.capital[]` + `actionMuaCongCu` + hao mòn hàng tháng. Chưa nghề nào đọc.
- **3.2b** `actionCayRuong` đọc `hasTrau` (nhanh hơn / khỏi thuê); cho thuê trâu
  (`forHire`) → AI/người khác thuê = nguồn cầu.

### T3.3 — Ruộng đất làm khuôn
- **3.3a** `p.farmPlots[]` + 3 tenure (công/tư/lộc) + 2 action `actionCayThue` /
  `actionCayRe`; suất công điền lấy từ `xa.suatDinh`. **Gộp sửa `village.drafted` không hồi
  vào chung cơ chế thu hồi suất.**
- **3.3b** Vụ mùa nhiều giai đoạn: tick `farmPlots` trong daily loop (KHÔNG `state.activity`),
  phase làm-đất→mạ→cấy→chờ→gặt, phase "chờ" chịu thời tiết + phá hoại (hostile clan).
  `actionCayRuong` cũ trở thành "khởi vụ trên một thửa".
- **3.3c** Thu tô: ruộng công nộp `village.khoThoc`/seat; ruộng tư/rẽ nộp `landlordId`.

### T3.4 — Áp khuôn cho 11 nghề còn lại (chia theo nhóm)
- **3.4a** Chế biến (nấu rượu, dệt vải, chăn lợn): nguyên liệu thật, công cụ từ `p.capital`,
  người mua có tên.
- **3.4b** Khai thác (chặt gỗ, câu cá sông, đánh bắt biển, đặc sản): giới hạn nguồn theo xã.
  Quyết cách sửa `actionKhaiThacDacSan` ở đây.
- **3.4c** Buôn (`actionBuonLauMuoi` + market rework): mua muối thật ở nguồn, người mua chợ
  đen, `_marketScene` → N người mua có tên.

### T3.5 — Chỉ số là dấu vết hành động (nguyên tắc xuyên suốt 3.3/3.4)
- **3.5a** `p._skillAccum{}` + helper chung (khuôn `_voTrainAccum`); `addLifestyleXP()` gọi
  từ action thật.
- **3.5b** Mỗi nghề/hành động bồi đúng chỉ số qua accumulator; `actionDiHoc` chuyển sang
  cùng cơ chế.
- **3.5c** Xuất thân: giữ +điểm đầu + cửa mở; **cắt phần cộng điểm thẳng thụ động**, giữ
  phần nhân hệ số tình huống. Dọn hoặc hiện thực hoá các cờ `_traitXxx`/`_birthXxx` chết.

---

## Ghi nhận, chưa sửa (bug / code xấu dọc đường)

- **~12 buff key trong `PropertyDb` không có handler** (`quanBuff, hocVanMon, ngoaiGiaoMon,
  danhVongMon, khoBonus, thocPriceBuff, luaMonth, goMonth, npcOpinionMon, baoveTTGian,
  thuyQuanMon, phongThuBuff`). `hoc_duong`/`van_mieu`/`thai_hoc_vien` quảng cáo "+Học
  Vấn/tháng" nhưng **vô hiệu**. `kho_vu_khi`/`giap_tru` "+% sức chiến đấu" cũng vô hiệu.
- **`PERSONALITY_TRAITS` / `BIRTH_TRAITS`**: 8/10 + 7/8 cờ `_traitXxx`/`_birthXxx` **không
  có use-site**. Mô tả hiệu ứng lâu dài là chữ suông. Chỉ `_traitGianXao` và
  `_birthCuongTrang` có tác dụng runtime.
- **`addLifestyleXP()` không có caller** — XP lối sống 100% thụ động dù có API để action bồi.
- **`models.HoldingType`** (`DIEN_TRANG/LO_REN/TUU_LAU/HOC_VIEN`) enum mồ côi, khác
  `engine.PropertyDb`, `baseYield` không đọc.
- **`p.properties = { ruongDat: 1, tuuLau: 0 }`** (`models.js` :330) — 0 use-site.
- **`actionKhaiThacDacSan`** nhánh `AN_QUANG` cho tiền thẳng trong khi các vùng khác cho
  item — bất đối xứng.
- **`court.monthsAheadTo`** (`court.js` :12-14) có 2 dòng `if (delta === 0 && …) delta = 12;`
  **trùng hệt nhau**.
- **`actionBuonLauMuoi`** là livelihood action **duy nhất** tự tăng chỉ số (`quanLy += 0.5`)
  — không nhất quán.
- **`Person`** 2 nhánh cùng class lệch shape: AI có `intelligence`/`stamina`, player không.
- **`state.village`** là một làng toàn cục; `drafted` (suất đinh đã mộ) không hồi bao giờ.

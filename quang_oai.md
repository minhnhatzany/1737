# Phủ Quảng Oai — địa lý viết tay

Thay cho `getLowerRegions()` sinh ngẫu nhiên. 3 huyện × 3 tổng × 3 xã = **27 xã, 71 làng**.

Cấp trên đã có sẵn trong `map_data.js`, không đổi:

```
Trấn Sơn Tây — Đốc trấn Hoàng Công Kỳ, 3000 quân
  Phủ Quảng Oai — Tri phủ Đinh Văn Nhân, 400 quân
```

**Đính chính (28/8):** Bản đầu dùng "Mỹ Lương" và "Tích Giang" — lấy theo tên có
sẵn trong `map_data.js` mà không kiểm lại năm cụ thể. Tra Wikipedia thì phủ Quảng
Oai năm Cảnh Hưng thứ 3 (1742, sát mốc game 1737) gồm 4 huyện: Tiên Phong, Minh
Nghĩa, Bất Bạt, Phúc Lộc. Đã đổi "Mỹ Lương" → "Minh Nghĩa", "Tích Giang" →
"Tiên Phong". "Bất Bạt" đúng từ đầu, không đổi. Xã lỵ sở huyện Tiên Phong đổi
tên chữ thành "Tây Đằng" (tên thật của lỵ sở phủ Quảng Oai ngoài đời, tránh trùng
tên với chính huyện). Nội dung khác (dân số, tổng xã làng, tính cách từng huyện,
cốt truyện Vạn Xuân/Lạc Tứ) giữ nguyên — chỉ đổi nhãn, không đổi thiết kế.

## Quy ước

**Tên chữ / tên nôm.** Mỗi xã và làng có hai tên. Tên chữ dùng trong sổ đinh, lệnh
truy nã, sắc phong, mọi giấy tờ quan. Tên nôm là cái dân gọi. Người mới tới chỉ biết
tên chữ, người trong vùng dùng tên nôm — dùng được cho việc nhận diện người lạ.

**Suất đinh** = `pop / 5`, giữ như code cũ.

**Lý trưởng** ghi ở đây là người giữ ghế lúc khai cuộc (1737). Toàn bộ là AI, và
đều thay được — đây chính là chỗ GĐ2 gắn `seats`.

---

# HUYỆN BẤT BẠT

> Tri huyện **Lê Văn Tú** · 35 quân · quân ô hợp
> Ngã ba sông Đà đổ vào sông Hồng. Biên giới Sơn Tây – Hưng Hoá.

**Tính chất**: đất biên. Bến đò, tuần ty thu thuế qua sông, thuyền buôn ngược xuôi.
Trên núi là người Mường, triều đình với tay không tới. Muối, thuốc, sắt qua đây
không sổ sách. **Đây là huyện của buôn lậu và của kẻ cần biến mất.**

## Tổng Cổ Đô

Bến chính, có tuần ty. Mọi thứ vào ra phủ đều qua đây.

| Xã | Tên nôm | Dân | Lý trưởng | Đặc điểm |
|---|---|---|---|---|
| **Cổ Đô** | Kẻ Đô | 2.400 | Nguyễn Đình Quýnh | Lỵ sở tổng. Chợ phiên ngày 2 và ngày 7. Có điếm tuần ty, lính canh thu thuế qua đò. |
| **Phú Cường** | Kẻ Cường | 1.700 | Trần Văn Bảng | Nhà đò lớn nhất bến. Họ Trần nắm hết bến, ai qua sông cũng phải qua tay. |
| **Vĩnh Phệ** | Làng Bến Dưới | 1.100 | Đỗ Văn Miện | Bãi bồi, ruộng năm được năm mất. Dân làm phu gánh thuê ở bến. |

Làng: Đô Thượng (800) · Đô Hạ (700) · Kẻ Chài (500) — thuộc Cổ Đô
Cường Xá (900) · Bến Nứa (450) — thuộc Phú Cường
Vĩnh Trung (600) · Cồn Vẹt (300) — thuộc Vĩnh Phệ

## Tổng Vân Sa

Đồng bãi ven sông, dâu tằm và ngô. Yên hơn, nhưng hay lụt.

| Xã | Tên nôm | Dân | Lý trưởng | Đặc điểm |
|---|---|---|---|---|
| **Vân Sa** | Kẻ Sa | 1.900 | Phạm Công Đĩnh | Dâu tằm, dệt lụa thô bán về Thăng Long. |
| **Thanh Chiểu** | Làng Đầm | 1.300 | Lê Văn Trực | Đầm lầy, cá và rươi. Tháng chín rươi lên, cả tổng kéo về. |
| **Tân Hội** | Làng Mới | 900 | Hoàng Văn Nhu | Lập chưa lâu, dân tứ xứ dồn về. Không ai biết rõ gốc ai. |

Làng: Sa Đông (700) · Sa Đoài (650) · Tằm Xá (550) — thuộc Vân Sa
Chiểu Thượng (750) · Ao Sen (550) — thuộc Thanh Chiểu
Hội Nội (500) · Hội Ngoại (400) — thuộc Tân Hội

## Tổng Thượng Lâm

Chân núi Ba Vì. Giáp đất Mường. Quan huyện một năm lên được đôi lần.

| Xã | Tên nôm | Dân | Lý trưởng | Đặc điểm |
|---|---|---|---|---|
| **Thượng Lâm** | Kẻ Rừng | 1.200 | Đinh Công Lệ | Họ Đinh gốc Mường, giữ ghế lý trưởng ba đời. Nói được cả hai thứ tiếng. |
| **Khê Thượng** | Làng Suối | 800 | Bùi Văn Chấn | Đãi vàng sa khoáng. Triều đình cấm, dân vẫn làm. |
| **Minh Quang** | Kẻ Ngái | 600 | Quách Văn Đôi | Xa nhất, đường lên phải qua ba con suối. Trốn lên đây là mất tích. |

Làng: Lâm Nội (500) · Lâm Ngoại (400) · Bãi Sậy (300) — thuộc Thượng Lâm
Khê Trên (450) · Khê Dưới (350) — thuộc Khê Thượng
Quang Sơn (350) · Hang Đá (250) — thuộc Minh Quang

---

# HUYỆN TIÊN PHONG

> Tri huyện **Phạm Quốc Nhân** · 45 quân · quân thường
> Đồi gò. Dân làm gỗ và than củi.

**Tính chất**: huyện có tiền. Gỗ từ rừng đổ về, kết bè xuôi sông Hồng bán Thăng Long.
Phú hộ ở đây giàu nhất phủ. **Đây là chỗ để làm ăn, và là chỗ đáng cướp.**

## Tổng Tiên Phong

Lỵ sở huyện. Chợ lớn nhất phủ ngoài Cổ Đô.

| Xã | Tên nôm | Dân | Lý trưởng | Đặc điểm |
|---|---|---|---|---|
| **Tây Đằng** | Kẻ Tích | 2.600 | Ngô Văn Hoạch | Lỵ sở huyện, cũng là lỵ sở cả phủ. Nha môn đóng ở đây. Chợ phiên ngày 4 và ngày 9. |
| **Trạch Mỹ Lộc** | Kẻ Trạch | 2.100 | Nguyễn Bá Đôn | Nhà họ Nguyễn có ba đời đỗ hương cống. Coi thường bọn buôn gỗ mới giàu. |
| **Phúc Hoà** | Làng Vôi | 1.400 | Vũ Đình Xán | Lò vôi, lò gạch. Khói quanh năm. |

Làng: Tích Nội (900) · Tích Ngoại (850) · Cầu Đá (850) — thuộc Tây Đằng
Trạch Thượng (800) · Trạch Hạ (700) · Văn Chỉ (600) — thuộc Trạch Mỹ Lộc
Hoà Thôn (750) · Lò Vôi (650) — thuộc Phúc Hoà

## Tổng Hạ Bằng

Rừng và than. Nghề nặng, dân dữ.

| Xã | Tên nôm | Dân | Lý trưởng | Đặc điểm |
|---|---|---|---|---|
| **Hạ Bằng** | Kẻ Hạ | 1.800 | Trịnh Văn Cẩn | Đầu mối than củi cả huyện. Phường thợ than có luật riêng, quan ít xen vào. |
| **Đồng Trúc** | Làng Tre | 1.200 | Kiều Văn Thịnh | Tre nứa, đan lát. Nghề nhẹ, người hiền. |
| **Bình Yên** | Kẻ Nghèn | 1.000 | Đỗ Văn Rưỡi | Tên đẹp mà đất xấu. Ruộng cao, năm nào cũng thiếu ăn ba tháng. |

Làng: Bằng Thượng (700) · Bằng Hạ (600) · Lò Than (500) — thuộc Hạ Bằng
Trúc Lâm (650) · Cầu Tre (550) — thuộc Đồng Trúc
Yên Nội (550) · Đồng Chó Ngáp (450) — thuộc Bình Yên

## Tổng Cần Kiệm

Bến bè. Gỗ tập kết ở đây rồi mới xuôi.

| Xã | Tên nôm | Dân | Lý trưởng | Đặc điểm |
|---|---|---|---|---|
| **Cần Kiệm** | Kẻ Cần | 1.600 | Lê Đình Đót | Bến bè lớn. Nhà họ Lê thầu hết việc kết bè, ăn hoa hồng mỗi chuyến. |
| **Tuy Lai** | Làng Gỗ | 1.300 | Hoàng Văn Nghiên | Xưởng cưa. Thợ mộc giỏi nhất vùng, nhưng hay đánh nhau. |
| **An Sơn** | Kẻ Trên | 900 | Phùng Văn Tá | Trên đồi, nhìn xuống cả khúc sông. Ai đi thuyền qua đều bị nhìn thấy. |

Làng: Cần Nội (700) · Bến Bè (550) · Vạn Chài (350) — thuộc Cần Kiệm
Lai Xá (700) · Xưởng Cưa (600) — thuộc Tuy Lai
Sơn Thượng (500) · Sơn Hạ (400) — thuộc An Sơn

---

# HUYỆN MINH NGHĨA

> Tri huyện **Nguyễn Hữu Khiêm** · 60 quân · quân ô hợp
> Thung lũng hẹp, đất ít người thưa.

**Tính chất**: nghèo nhất phủ, mà **đóng quân nhiều nhất** — 60 quân cho huyện ít
dân nhất. Triều đình biết đây là chỗ dễ loạn. Ruộng ít, đói giáp hạt, trai tráng bỏ
làng đi làm thuê hoặc đi làm cướp. **Đây là đất đẻ nghĩa quân.**

## Tổng Lạc Tứ

Đáy thung lũng. Đông người nhất huyện mà cũng đói nhất.

| Xã | Tên nôm | Dân | Lý trưởng | Đặc điểm |
|---|---|---|---|---|
| **Lạc Tứ** | Kẻ Lạc | 1.500 | Trần Văn Ổn | Ruộng công bị nhà họ Trần lấn dần ba đời. Đơn kiện lên huyện bốn lần, chìm cả bốn. |
| **Hưng Đạo** | Làng Đình | 1.100 | Nguyễn Văn Thảo | Đình làng to nhất tổng, dân góp xây từ đời trước, giờ không ai sửa nổi. |
| **Đại Đồng** | Kẻ Cùng | 800 | Lê Văn Đắc | Nghèo rớt. Nửa số hộ đang cầm ruộng cho nhà giàu bên Tiên Phong. |

Làng: Lạc Thượng (600) · Lạc Hạ (550) · Đồng Chằm (350) — thuộc Lạc Tứ
Đạo Nội (600) · Cầu Đình (500) — thuộc Hưng Đạo
Đại Thôn (450) · Xóm Trại (350) — thuộc Đại Đồng

## Tổng Yên Duyệt

Sườn thung lũng. Đường độc đạo ra vào huyện đi qua đây.

| Xã | Tên nôm | Dân | Lý trưởng | Đặc điểm |
|---|---|---|---|---|
| **Yên Duyệt** | Kẻ Duyệt | 1.200 | Phạm Văn Kỳ | Cửa ngõ huyện. Có điếm canh, nhưng lính bỏ về ăn cơm là ai qua cũng được. |
| **Hoà Thạch** | Làng Đá | 900 | Đinh Văn Lự | Đục đá làm cối, làm bia. Nghề độc, ai cũng phải mua. |
| **Phú Mãn** | Kẻ Mãn | 700 | Bạch Văn Tôn | Dân gốc Mường xuống định cư. Bị làng dưới coi là người ngoài. |

Làng: Duyệt Nội (500) · Duyệt Ngoại (400) · Điếm Canh (300) — thuộc Yên Duyệt
Thạch Thượng (500) · Bãi Đá (400) — thuộc Hoà Thạch
Mãn Sơn (400) · Xóm Mường (300) — thuộc Phú Mãn

## Tổng Thượng Tiết

Cuối thung lũng, dựa vào núi. Quan không mấy khi vào.

| Xã | Tên nôm | Dân | Lý trưởng | Đặc điểm |
|---|---|---|---|---|
| **Thượng Tiết** | Kẻ Tiết | 900 | Ngô Văn Rậu | Cuối đường. Sau lưng là rừng, đi tiếp là sang đất Hưng Hoá. |
| **Tân Phong** | Làng Nứa | 700 | Đào Văn Chắt | Bốn năm trước mất mùa, một nửa số đinh bỏ đi, chưa về. |
| **Vạn Xuân** | Kẻ Vắng | 500 | *khuyết* | **Không có lý trưởng.** Người cũ chết năm ngoái, chưa ai chịu nhận. Sổ đinh bỏ trống. |

Làng: Tiết Nội (450) · Hang Chàng (300) · Trại Nứa (150) — thuộc Thượng Tiết
Phong Thôn (400) · Xóm Bỏ (300) — thuộc Tân Phong
Vạn Thôn (300) · Đồng Hoang (200) — thuộc Vạn Xuân

---

# TỔNG KẾT

| Huyện | Tổng | Xã | Làng | Dân |
|---|---:|---:|---:|---:|
| Bất Bạt | 3 | 9 | 23 | 11.900 |
| Tiên Phong | 3 | 9 | 24 | 14.900 |
| Minh Nghĩa | 3 | 9 | 24 | 8.300 |
| **Phủ Quảng Oai** | **9** | **27** | **71** | **35.100** |

---

# GHI CHÚ CHO NGƯỜI CODE

## Việc cần làm

1. Thêm `tong` viết tay vào 3 huyện của `quang_oai` trong `map_data.js`.
2. `getLowerRegions(state, huyenId)`: nếu huyện có dữ liệu viết tay thì trả về luôn,
   không sinh ngẫu nhiên. Các huyện khác vẫn sinh như cũ.
3. Mỗi xã thêm hai trường mới: `tenNom` và `lyTruong`.
4. Mỗi làng thêm `tenNom`.

## Sửa luôn một lỗi có sẵn

`map_data.js` dòng ~164: khoá là `"bất_bat"` (có dấu) nhưng `id` bên trong là
`"bat_bat"` (không dấu). Lệch nhau. Đổi khoá thành `"bat_bat"` và grep toàn dự án
xem có chỗ nào tra bằng khoá cũ không.

## Ba thứ đã cài sẵn cho gameplay sau này

**Vạn Xuân không có lý trưởng.** Đây là cái ghế trống ngay từ ngày đầu, ở chỗ hẻo
lánh nhất, xã nghèo nhất. Người chơi mới có một mục tiêu cụ thể trong tầm với.

**Xã Lạc Tứ có sẵn mối bất bình.** Ruộng công bị họ Trần lấn ba đời, kiện bốn lần
đều chìm. Đủ để làm điểm bắt đầu cho cả đường kiện tụng lẫn đường làm phản.

**Ba huyện ba nghề khác nhau** nên giá cả tự chênh mà không cần bịa:
Bất Bạt có muối và hàng lậu qua sông · Tiên Phong có gỗ, than, vôi ·
Minh Nghĩa có đá và sức người rẻ. Trấn Sơn Tây vốn đã có `go: 0.5` trong `pm`,
tức gỗ rẻ bằng nửa nơi khác — tuyến buôn gỗ xuôi Thăng Long đã có cơ sở sẵn.

## Chưa làm, để sau

- Chợ phiên mới ghi ngày, chưa có cơ chế.
- Chưa gán dòng họ cho từng xã (hiện `state.clans` chỉ có 3 họ chung).
- Tuần ty ở Cổ Đô và điếm canh ở Yên Duyệt mới là mô tả, chưa thành trạm thu thuế
  hay chốt chặn thật. Đó là việc của GĐ2b khi làm vận chuyển.

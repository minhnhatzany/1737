/**
 * core/capital.js — Vốn / công cụ cá nhân (T3.2b).
 *
 * p.capital[] = tư liệu sản xuất mua-MỘT-LẦN của người chơi: trâu, thuyền nan,
 * khung cửi, nồi rượu, cày bừa. KHÁC cửa hàng (core/shops.js): nhỏ, KHÔNG khan
 * hiếm, ai đủ tiền cũng mua, không chỗ đứng trong xã, không occupant. KHÁC
 * PropertyDb/holdings: không gắn region, không buildQueue, hao mòn theo tháng.
 *
 * T3.2b chỉ dựng SHAPE + actionMuaCongCu + hao mòn. CHƯA nghề nào đọc cond/kind:
 *   - actions/livelihood.js đọc hasTrau: T3.3
 *   - cho thuê (forHire) + AI thuê: T3.2d
 *   - sửa chữa (actionSuaCongCu): hoãn — chưa ai dùng cond thì chưa cần sửa
 *
 * Mua tức thời (không đếm ngày dựng). Id qua state._capitalSeq (khuôn _prisonerSeq),
 * KHÔNG dùng Date.now().
 */

// Loại công cụ — ENUM ĐÓNG (nhất quán ShopType / PlayerRank / SeatLegitimacy).
export const CapitalKind = Object.freeze({
  TRAU:       "trau",       // trâu cày — tác động năng suất lớn nhất
  THUYEN_NAN: "thuyen_nan", // thuyền nan — câu/đánh bắt/chở
  KHUNG_CUI:  "khung_cui",  // khung cửi — dệt vải/lụa
  NOI_RUOU:   "noi_ruou",   // nồi (chõ) nấu rượu
  CAY_BUA:    "cay_bua",    // cày + bừa — công cụ ruộng cơ bản
});

// Giá cố định (Quan). Thứ tự theo mức tác động năng suất: trâu > thuyền > khung > nồi > cày.
export const CAPITAL_PRICE = Object.freeze({
  [CapitalKind.TRAU]:       120,
  [CapitalKind.THUYEN_NAN]: 80,
  [CapitalKind.KHUNG_CUI]:  45,
  [CapitalKind.NOI_RUOU]:   40,
  [CapitalKind.CAY_BUA]:    20,
});

// Nhãn hiển thị / log.
export const CAPITAL_LABEL = Object.freeze({
  [CapitalKind.TRAU]:       "trâu",
  [CapitalKind.THUYEN_NAN]: "thuyền nan",
  [CapitalKind.KHUNG_CUI]:  "khung cửi",
  [CapitalKind.NOI_RUOU]:   "nồi cất rượu",
  [CapitalKind.CAY_BUA]:    "cày bừa",
});

// Hao mòn mỗi tháng (điểm cond). cond 100 -> 0 trong ~50 tháng nếu không sửa.
export const CAPITAL_WEAR_PER_MONTH = 2;

// T3.4-2a: thuyền nan hao THEO LẦN DÙNG (mỗi chuyến ra khơi) — bằng đúng 1 tháng nằm
// không. cond 100 -> ~50 chuyến hưởng lợi đầy đủ. Chạy SONG SONG với hao mòn tháng.
// Chỉ thuyền hao kiểu này; nồi/khung (chế biến tại nhà) vẫn chỉ hao theo tháng.
export const THUYEN_WEAR_PER_TRIP = 2;

/**
 * Dựng một mục capital. Nơi gọi tự tăng state._capitalSeq và truyền vào seq + day.
 * @param {{ kind: string, seq: number, day: number }} p
 */
export function makeCapital({ kind, seq, day }) {
  return {
    id: "cap_" + seq,
    kind,
    cond: 100,          // 0..100 — hao mòn; 0 = hỏng, nằm im trong list (T3.2b không xử lý)
    acquiredDay: day,   // totalDaysAbs(state) lúc mua
    forHire: false,     // T3.2d — mới chỉ là field, chưa cơ chế
  };
}

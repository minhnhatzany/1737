/**
 * core/farm.js — Ruộng đất (T3.3-2).
 *
 * p.farmPlots[] : thửa ruộng người chơi NẮM GIỮ. 3 tenure lưu ở đây:
 *   cong — ruộng công của làng, chia theo suất (khan hiếm), tô nộp làng/ghế (T3.3-4)
 *   tu   — ruộng tư, mua đứt, giữ hết
 *   re   — cấy rẽ: mượn ruộng landlordId, chia tô theo reShare
 * tenure "loc" (ruộng lộc theo ghế) KHÔNG lưu ở đây — đọc dẫn xuất từ state.seats
 *   qua engine.locPlotsForPlayer (mất ghế -> mất lộc, không cần teardown).
 *
 * T3.3-2a: chỉ dựng SHAPE + xin công điền + mua ruộng tư. Thửa TRƠ — chưa có cơ chế
 * sản lượng (vụ mùa nhiều giai đoạn: T3.3-3; thu tô: T3.3-4). actionCayThue/CayRe
 * (tenure "re" + job kind="farm"): T3.3-2b.
 */

export const FarmTenure = Object.freeze({
  CONG: "cong",
  TU:   "tu",
  RE:   "re",
  LOC:  "loc",   // chỉ dùng ở locPlotsForPlayer — KHÔNG bao giờ có trong p.farmPlots
});

/**
 * Số thửa ruộng lộc theo title ghế đang giữ. BẤT ĐỐI XỨNG có chủ ý: lý trưởng +
 * chánh tổng (chức dịch làng xã, chưa phải quan thật) gần nhau; nhảy vọt ở tri huyện
 * (quan triều đình chính thức — "làm quan giàu nhanh" chỉ áp cho quan thật).
 */
export const LOC_PLOTS_BY_TITLE = Object.freeze({
  ly_truong:  2,
  chanh_tong: 3,
  tri_huyen:  6,
});

/** Tỉ lệ đinh trong xã có phần công điền -> số suất công điền của xã. SỐ HẠT GIỐNG. */
export const CONG_DIEN_RATIO = 0.6;

/** Giá mua 1 thửa ruộng tư (Quan) — giữa trâu (120) và quán trọ (300). SỐ HẠT GIỐNG. */
export const RUONG_TU_GIA = 200;

/**
 * Cấy rẽ: phần hoa lợi landlord lấy (người cấy giữ 1 - reShare). = 0.5 — đúng nghĩa
 * đen "cấy rẽ" (rẽ = chia đôi) và đúng mức phát canh thu tô phổ biến ở Đàng Ngoài
 * (chủ ruộng lấy một nửa). Cao hơn tô ruộng công (T3.3-4, "an toàn trần thấp"),
 * thấp hơn ruộng tư giữ hết. Thửa trơ ở 2b — số này chỉ được đọc ở T3.3-4.
 */
export const RE_SHARE_TO_LANDLORD = 0.5;

export function congDienSlots(xaSuatDinh) {
  return Math.max(0, Math.floor((xaSuatDinh || 0) * CONG_DIEN_RATIO));
}

export function makeFarmPlot({ seq, xaId, tenure, landlordId = null, reShare = null, day }) {
  return { id: "plot_" + seq, xaId, tenure, landlordId, reShare, acquiredDay: day };
}

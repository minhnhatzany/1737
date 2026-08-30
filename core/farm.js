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
 * T3.3-2a: chỉ dựng SHAPE + xin công điền + mua ruộng tư. T3.3-3: state machine vụ mùa.
 * actionCayThue/CayRe (tenure "re" + job kind="farm"): T3.3-2b.
 */

import { Weather } from "../weather.js";

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
  return {
    id: "plot_" + seq, xaId, tenure, landlordId, reShare, acquiredDay: day,
    // T3.3-3: state machine vụ mùa. phase=null -> thửa NHÀN.
    phase: null, phaseDaysLeft: 0, hasTrau: false, weatherHits: [], vuStartedDay: null, lastYield: null,
  };
}

// ── T3.3-3: vụ mùa nhiều giai đoạn ──────────────────────────────────────────

/** Chuỗi giai đoạn một vụ lúa, nối tiếp nhau. */
export const VU_PHASES = Object.freeze(["lam_dat", "gieo_ma", "cay", "cho", "gat"]);

/** Số ngày (game-day) mỗi giai đoạn. Theo brief "3-4 tháng" seed→gặt (10+6+5+75+3≈99).
 *  lam_dat: bằng TAY; có trâu -> LAM_DAT_DAYS_TRAU. SỐ HẠT GIỐNG (tinh chỉnh sau chơi thử). */
export const PHASE_DAYS = Object.freeze({ lam_dat: 10, gieo_ma: 6, cay: 5, cho: 75, gat: 3 });
export const LAM_DAT_DAYS_TRAU = 4;

export const PHASE_LABEL = Object.freeze({
  lam_dat: "làm đất", gieo_ma: "gieo mạ", cay: "cấy", cho: "chờ lúa", gat: "gặt",
});

/** Thóc GỘP một vụ trước khi tách tô (T3.3-4). Hằng số thật, tinh chỉnh sau. */
export const BASE_VU_YIELD = 60;

/** Hệ số thời tiết cho yield vụ — khớp rollPersonalHarvestThoc NHƯNG là lookup thuần
 *  (rollPersonalHarvestThoc dùng rng() fallback stream, không replay-safe). */
export const VU_WEATHER_FACTOR = Object.freeze({
  [Weather.MUA]: 1.3, [Weather.NANG]: 0.9, [Weather.BAO]: 0.5, [Weather.LU]: 0.4, [Weather.HAN]: 0.2,
});
export function vuWeatherFactor(weather) {
  return VU_WEATHER_FACTOR[weather] ?? 1.0;
}

/**
 * core/seats.js — Ghế là thực thể (T2.1).
 *
 * Một 'ghế' (seat) là một chức vụ có phạm vi (scope) và một người ngồi (occupantId).
 * occupantId trỏ tới một Person BẤT KỲ — người thật hoặc AI, không phân biệt.
 * Không có bảng riêng cho chức của player và chức của NPC.
 *
 * state.seats        : { [seatId]: seat }
 * state.seatsByScope : { ['<scope>:<scopeId>']: seatId }   — index tra ngược
 *
 * T2.1 chỉ dựng schema + seed 4 ghế + đồng bộ MỘT CHIỀU seat.title -> person.rank.
 * Bổ nhiệm/cách chức/tiến cử/ghế phụ/giới hạn suất/AI lấp chỗ trống: các bước sau.
 */

import { rng, rngInt, initSeed } from "./rng.js";

// 6 nguồn hợp pháp của một ghế. Xem brief C.3 mục 4.
export const SeatLegitimacy = Object.freeze({
  MUA:      "mua",       // mua thẳng từ người có quyền bổ nhiệm
  THI:      "thi",       // đỗ khoa cử
  TIEN_CU:  "tien_cu",   // được tiến cử lên trên
  THE_TAP:  "the_tap",   // có sẵn / cha truyền con nối
  TU_PHONG: "tu_phong",  // nghĩa quân tự xưng
  BO_NHIEM: "bo_nhiem",  // xin bổ nhiệm / luân chuyển qua nha môn
});

/** Khoá index tra ngược theo phạm vi. */
export function scopeKey(scope, scopeId) {
  return scope + ":" + scopeId;
}

/**
 * Tạo một seat. Chưa đăng ký vào state — nơi gọi tự gắn vào
 * state.seats[seat.id] và state.seatsByScope[scopeKey(...)].
 */
export function makeSeat({
  id,
  title,
  scope,
  scopeId,
  occupantId = null,
  appointedById = null,
  appointedDay = null,
  legitimacy = SeatLegitimacy.THE_TAP,
}) {
  return {
    id,
    title,
    scope,
    scopeId,
    occupantId,
    appointedById,
    appointedDay,
    legitimacy,
    subSeatIds: [],
    lastActiveDay: appointedDay,
  };
}

/**
 * Đồng bộ MỘT CHIỀU: nếu person đang giữ một ghế thì person.rank = ghế.title.
 * Person không giữ ghế nào -> KHÔNG đụng person.rank (24 đường ghi rank cũ vẫn chạy
 * y nguyên; cache chỉ được kéo theo khi ghế có occupant, không ép ngược lại).
 */
export function syncRankFromSeats(state, person) {
  if (!state || !state.seats || !person) return;
  for (const id of Object.keys(state.seats)) {
    const seat = state.seats[id];
    if (seat && seat.occupantId === person.id) {
      person.rank = seat.title;
      return;
    }
  }
}

/** Id ghế cấp xã sinh từ id xã (khớp scopeId dùng ở seatsByScope). */
export function seatIdForXa(xaId) {
  return "seat_xa_" + xaId;
}

/**
 * Roll hồ sơ một lý trưởng xã từ STREAM RNG RIÊNG (seed = hash id xã).
 * KHÔNG đụng state.rngState -> world-gen mọi seed không lệch. Tất định theo xaId.
 * Công thức 5 chỉ số khớp core() trong Person isAI (models.js): đa số 9–20, hiếm ~48.
 */
export function rollLyTruongProfile(xaId) {
  const s = { rngState: initSeed("lytruong:" + xaId) };
  const core = () => (rng(s) < 0.9)
    ? 9 + Math.floor(rng(s) * 12)
    : Math.min(48, 20 + Math.floor(rng(s) * 28));
  return {
    age:       rngInt(s, 35, 60),
    tien:      rngInt(s, 5, 50),
    opinion:   rngInt(s, -10, 10),
    ngoaiGiao: core(),
    voThuat:   core(),
    quanLy:    core(),
    muuMeo:    core(),
    hocVan:    core(),
  };
}

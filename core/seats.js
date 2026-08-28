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

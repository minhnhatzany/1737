/**
 * core/clans.js — Dòng họ cục bộ theo xã (T3.1a).
 *
 * T3.1a chỉ dựng GENERATOR: mỗi xã phủ Quảng Oai sinh 2-3 dòng họ từ một
 * STREAM RNG RIÊNG (seed = hash id xã). KHÔNG đụng state.rngState -> world-gen
 * mọi seed không lệch, đúng khuôn rollLyTruongProfile (core/seats.js) và T3.0.
 *
 * Chưa gán clanId cho ai, chưa đụng gameplay. 3 họ toàn cục cũ (Nguyễn/Trần/Phạm)
 * giữ nguyên làm fallback cho 41 huyện procedural khác — đường cũ không đổi.
 *
 * Đấu nối localClanIds theo p.currentXa: T3.1b. Seat lý trưởng ↔ clan: T3.1c.
 */

import { rng, rngInt, initSeed } from "./rng.js";

// Pool họ người Việt cho generator cấp xã. Không trùng danh sách nào ở nơi khác —
// chỉ dùng để bốc tên họ; số lượng đủ để 27 xã không cạn.
const HO_POOL = Object.freeze([
  "Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Phan", "Vũ", "Đặng", "Bùi", "Đỗ",
  "Hồ", "Ngô", "Dương", "Lý", "Đinh", "Trương", "Đoàn", "Tạ", "Mai", "Cao",
  "Lương", "Vương", "Đàm", "Tô", "Kiều",
]);

/** Id clan cấp xã sinh từ id xã + số thứ tự (không đụng bộ đếm nextClanId toàn cục). */
export function clanIdForXa(xaId, idx) {
  return "clan_xa_" + xaId + "_" + idx;
}

/**
 * Roll 2-3 dòng họ cho một xã từ STREAM RNG RIÊNG (seed = hash "clan:" + id xã).
 * KHÔNG đụng state.rngState. Tất định theo xaId.
 * Trả về mảng plain object; nơi gọi tự dựng new Clan({ ..., scope:"xa", scopeId:xaId }).
 * quyenLuc/ruongDat/trungThanh cùng dải với 3 họ cũ; status = vị thế khởi điểm.
 */
export function rollXaClans(xaId) {
  const s = { rngState: initSeed("clan:" + xaId) };
  const nHo = 2 + Math.floor(rng(s) * 2); // 2 hoặc 3
  const pool = HO_POOL.slice();
  const out = [];
  for (let i = 0; i < nHo; i++) {
    const ho = pool.splice(Math.floor(rng(s) * pool.length), 1)[0];
    out.push({
      name: "Họ " + ho,
      quyenLuc: rngInt(s, 25, 75),
      ruongDat: rngInt(s, 8, 24),
      trungThanh: rngInt(s, 40, 68),
      status: rngInt(s, 30, 70),
    });
  }
  return out;
}

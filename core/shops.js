/**
 * core/shops.js — Cửa hàng / cơ ngơi kinh doanh (T3.2a).
 *
 * Một 'cửa hàng' (shop) là một cơ ngơi có chỗ đứng KHAN HIẾM trong xã, một chủ
 * (occupantId — Person BẤT KỲ, người thật hoặc AI), sinh thu nhập đều khi còn giữ.
 * KHÁC ghế (core/seats.js): không phải chức hành chính, không sync rank, chứa vốn
 * (T3.2b), thuê người (T3.2d), mua/bán/thừa kế được như tài sản.
 *
 * T3.2a chỉ dựng SCHEMA + GENERATOR + SEED. CHƯA action nào đọc:
 *   state.shops     : { [shopId]: shop }
 *   state.shopsByXa : { [xaId]: [shopId, ...] }
 * Mua/mở/giữ/mất cửa hàng: T3.2c. Vốn cá nhân p.capital[]: T3.2b. Thuê người: T3.2d.
 *
 * Generator dùng STREAM RNG RIÊNG (seed = hash "shop:" + id xã) — KHÔNG đụng
 * state.rngState, world-gen mọi seed không lệch. Đúng khuôn rollXaClans (core/clans.js)
 * và rollLyTruongProfile (core/seats.js).
 */

import { rng, rngInt, initSeed } from "./rng.js";

/**
 * Loại cửa hàng — ENUM ĐÓNG (nhất quán với PlayerRank / SeatLegitimacy, tránh phình
 * tên gọi không kiểm soát). 7 loại "cơ ngơi" gắn flavor 7 xã nhóm A trong quang_oai.md
 * + 1 loại generic sinh theo dân số cho mọi xã.
 */
export const ShopType = Object.freeze({
  BEN_DO:      "ben_do",      // bến đò — Phú Cường ("họ Trần nắm hết bến")
  BEN_BE:      "ben_be",      // bến bè kết mảng — Cần Kiệm ("họ Lê thầu hết việc kết bè")
  LO_VOI:      "lo_voi",      // lò vôi / lò gạch — Phúc Hoà ("khói quanh năm")
  XUONG_CUA:   "xuong_cua",   // xưởng cưa / mộc — Tuy Lai
  PHUONG_THAN: "phuong_than", // phường than củi / đầu mối — Hạ Bằng
  XUONG_DA:    "xuong_da",    // xưởng đục đá (cối, bia) — Hoà Thạch
  XUONG_DET:   "xuong_det",   // xưởng dệt lụa thô — Vân Sa
  QUAN_TRO:    "quan_tro",    // quán trọ / tửu lâu cấp thấp — generic, mọi xã theo dân số
});

/** Loại dùng cho slot generic sinh theo dân số (mọi xã, kể cả xã chưa có flavor). */
export const SHOP_GENERIC_TYPE = ShopType.QUAN_TRO;

/**
 * Thu nhập nền / tháng (Quan) theo loại. SỐ HẠT GIỐNG — CHƯA ai đọc ở T3.2a;
 * T3.2c mới tính vào thu nhập của chủ. Dải nhỏ, cố ý: cơ ngơi > quán trọ.
 */
export const SHOP_INCOME_BASE = Object.freeze({
  [ShopType.BEN_DO]:      40,
  [ShopType.BEN_BE]:      40,
  [ShopType.LO_VOI]:      30,
  [ShopType.XUONG_CUA]:   30,
  [ShopType.PHUONG_THAN]: 35,
  [ShopType.XUONG_DA]:    25,
  [ShopType.XUONG_DET]:   25,
  [ShopType.QUAN_TRO]:    15,
});

/** Nhãn hiển thị / log theo loại. */
export const SHOP_LABEL = Object.freeze({
  [ShopType.BEN_DO]:      "bến đò",
  [ShopType.BEN_BE]:      "bến bè",
  [ShopType.LO_VOI]:      "lò vôi",
  [ShopType.XUONG_CUA]:   "xưởng cưa",
  [ShopType.PHUONG_THAN]: "phường than",
  [ShopType.XUONG_DA]:    "xưởng đá",
  [ShopType.XUONG_DET]:   "xưởng dệt",
  [ShopType.QUAN_TRO]:    "quán trọ",
});

/**
 * T3.2c: chi phí mở + số ngày dựng, theo loại. CHỈ quan_tro mở mới được ở T3.2c —
 * 7 loại cơ ngơi nhóm A phải GIÀNH từ chủ hiện tại (track "tranh cửa hàng" sau này),
 * nên không có entry ở đây. Số hạt giống, chỉnh 1 dòng nếu chơi thử thấy lệch.
 */
export const SHOP_OPEN_COST = Object.freeze({
  [ShopType.QUAN_TRO]: 300,
});
export const SHOP_FOUND_DAYS = Object.freeze({
  [ShopType.QUAN_TRO]: 7,
});

/** T3.2c: mỗi người chơi chỉ giữ 1 cơ nghiệp (chưa thuê được người làm — T3.2d nới). */
export const SHOP_MAX_PER_PLAYER = 1;

// ── T3.4-3a: người mua có tên — occupant shop là đầu mối thu mua 3 mặt hàng ───
// Loại shop nào tự nhiên mua mặt hàng nào (dò T3.4-3a). ca/muoi/thit_lon/thoc:
// KHÔNG có shop khớp -> giữ bán qua chợ ẩn danh (sổ nợ), chưa làm state.buyers.
export const SHOP_BUYS = Object.freeze({
  go:   [ShopType.XUONG_CUA, ShopType.PHUONG_THAN, ShopType.BEN_BE],
  lua:  [ShopType.XUONG_DET],
  ruou: [ShopType.QUAN_TRO],
});

/** Vốn kinh doanh MUA HÀNG/tháng của một shop — TÁCH khỏi tien cá nhân occupant.
 *  = max(300, incomeBase × 20). Sàn 300 để quán trọ vẫn là người mua rượu có nghĩa.
 *  Reset CỨNG mỗi tháng (khuôn processMonthlyExtractionReset). SỐ HẠT GIỐNG. */
export function shopBuyBudget(incomeBase) {
  return Math.max(300, (incomeBase | 0) * 20);
}

/** Giá qua shop-buyer so với chợ ẩn danh: +15% (đủ để đáng chọn, đã bị buyBudget
 *  chặn trần nên không phá cân bằng). SỐ HẠT GIỐNG. */
export const SHOP_BUYER_PREMIUM = 1.15;

/**
 * T3.2c-2: cửa hàng TỪNG có chủ mà bỏ trống quá ngần này ngày game -> dòng họ mạnh
 * nhất xã đưa người vào tiếp quản. Slot quán trọ nguyên trinh (chưa ai từng giữ)
 * KHÔNG bị đụng. 45 ngày ~ 1.5 tháng game — nới cửa sổ an toàn cho người chơi
 * không toàn thời gian (đi vắng/bận vài ngày không mất cơ nghiệp).
 */
export const SHOP_VACANT_FILL_DAYS = 45;

// Tên đệm + tên cho chủ cửa hàng AI (nam). Bốc từ stream riêng — KHÔNG dùng bảng tên
// toàn cục trong engine.js (tránh tiêu draw fallback -> lệch world-gen). Họ lấy theo
// dòng họ sở hữu, nơi gọi tự ghép.
const OWNER_DEM = Object.freeze(["Văn", "Đình", "Hữu", "Bá", "Công", "Đức", "Trọng", "Quang"]);
const OWNER_TEN = Object.freeze(["Lộc", "Phát", "Tài", "Thịnh", "Quý", "Hoà", "Lãm", "Cẩn", "Đạt", "Sung"]);

/** Id cửa hàng sinh từ id xã + số thứ tự. Ổn định theo thứ tự generator. */
export function shopIdForXa(xaId, idx) {
  return "shop_" + xaId + "_" + idx;
}

/** Số slot cửa hàng generic theo dân số xã. Tối thiểu 1 — không xã nào là sa mạc thương mại. */
export function genericShopSlots(pop) {
  return Math.max(1, 1 + Math.floor((pop || 0) / 1200));
}

/**
 * Roll danh sách cửa hàng cho MỘT xã từ STREAM RNG RIÊNG (seed = hash "shop:"+xaId).
 * KHÔNG đụng state.rngState. Tất định theo xaId.
 *
 * @param {string} xaId
 * @param {{ pop?: number, cuaHangSeed?: string[] }} opts
 *        cuaHangSeed: loại cơ ngơi viết tay của xã (nhóm A) — mỗi loại 1 cửa hàng CÓ CHỦ AI.
 * @returns {Array<object>} spec cửa hàng; nơi gọi tự dựng vào state.shops, gán
 *          ownerClanId + spawn chủ cho spec.wantsOwner.
 */
export function rollXaShops(xaId, opts = {}) {
  const s = { rngState: initSeed("shop:" + xaId) };
  const pop = opts.pop || 0;
  const hand = Array.isArray(opts.cuaHangSeed) ? opts.cuaHangSeed : [];
  const known = new Set(Object.values(ShopType));
  const out = [];
  let idx = 0;

  // 1. Cơ ngơi viết tay (nhóm A): mỗi loại 1 cửa hàng, CÓ CHỦ AI thuộc dòng họ mạnh nhất xã.
  for (const loai of hand) {
    if (!known.has(loai)) continue;
    out.push(makeSpec(s, xaId, idx++, loai, true));
  }

  // 2. Slot generic theo dân số: quán trọ / tửu lâu cấp thấp, BỎ TRỐNG (đáng chiếm).
  const nGeneric = genericShopSlots(pop);
  for (let i = 0; i < nGeneric; i++) {
    out.push(makeSpec(s, xaId, idx++, SHOP_GENERIC_TYPE, false));
  }
  return out;
}

/**
 * T3.2c-2: hồ sơ một chủ cửa hàng AI MỚI (khi dòng họ đưa người tiếp quản cửa hàng
 * bỏ trống). STREAM RNG RIÊNG theo seedStr — KHÔNG đụng state.rngState, tất định.
 * Cùng shape với ownerProfile trong makeSpec (T3.2a); nơi gọi tự ghép họ + givenName.
 */
export function rollShopOwner(seedStr) {
  const s = { rngState: initSeed(String(seedStr)) };
  const core = () => (rng(s) < 0.9)
    ? 9 + Math.floor(rng(s) * 12)
    : Math.min(48, 20 + Math.floor(rng(s) * 28));
  return {
    givenName: OWNER_DEM[Math.floor(rng(s) * OWNER_DEM.length)] + " " +
               OWNER_TEN[Math.floor(rng(s) * OWNER_TEN.length)],
    age:       rngInt(s, 30, 58),
    tien:      rngInt(s, 20, 120),
    opinion:   rngInt(s, -10, 10),
    ngoaiGiao: core(),
    voThuat:   core(),
    quanLy:    core(),
    muuMeo:    core(),
    hocVan:    core(),
  };
}

function makeSpec(s, xaId, idx, loai, wantsOwner) {
  const incomeBase = SHOP_INCOME_BASE[loai] || 0;
  const spec = {
    id: shopIdForXa(xaId, idx),
    loai,
    xaId,
    scope: "xa",
    seeded: true,
    wantsOwner,
    level: 1,
    incomeBase,
    buyBudget: shopBuyBudget(incomeBase), // T3.4-3a: vốn mua hàng/tháng, reset cứng
  };
  if (wantsOwner) {
    spec.ownerGivenName =
      OWNER_DEM[Math.floor(rng(s) * OWNER_DEM.length)] + " " +
      OWNER_TEN[Math.floor(rng(s) * OWNER_TEN.length)];
    // Hồ sơ chủ — khớp core() trong Person isAI (đa số 9–20, hiếm ~48).
    const core = () => (rng(s) < 0.9)
      ? 9 + Math.floor(rng(s) * 12)
      : Math.min(48, 20 + Math.floor(rng(s) * 28));
    spec.ownerProfile = {
      age:       rngInt(s, 30, 58),
      tien:      rngInt(s, 20, 120),
      opinion:   rngInt(s, -10, 10),
      ngoaiGiao: core(),
      voThuat:   core(),
      quanLy:    core(),
      muuMeo:    core(),
      hocVan:    core(),
    };
  }
  return spec;
}

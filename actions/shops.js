import {
  ShopType, SHOP_OPEN_COST, SHOP_FOUND_DAYS, SHOP_LABEL, SHOP_MAX_PER_PLAYER,
  SHOP_BUYS, SHOP_BUYER_PREMIUM, shopBuyBudget,
} from "../core/shops.js";
import { totalDaysAbs, ItemsDb } from "../engine.js";
import { getTradeQuote } from "./market.js";
import { Faction } from "../models.js";
import { logLine } from "../log.js";

/**
 * T3.2c-1 — mở một cửa hàng trên slot đã seed (T3.2a) đang bỏ trống.
 *
 * CHỈ quan_tro: 7 loại cơ ngơi nhóm A seed sẵn chủ AI -> muốn có phải GIÀNH
 * (track "tranh cửa hàng" riêng, chưa làm). Chỉ gate tiền (300), KHÔNG rank/uyTín/
 * region. Countdown dựng sống trên chính shop entity (shop.foundingById/foundDaysLeft),
 * KHÔNG đụng p.buildQueue. Trần 1 cơ nghiệp/người (SHOP_MAX_PER_PLAYER).
 */
export function actionMoCuaHang(state, xaId, loai = ShopType.QUAN_TRO) {
  const p = state.player;

  if (loai !== ShopType.QUAN_TRO) {
    return { ok: false, msg: "Loại cơ ngơi này phải giành từ chủ hiện tại, chưa mở mới được." };
  }
  const cost = SHOP_OPEN_COST[loai];
  const days = SHOP_FOUND_DAYS[loai];
  const label = SHOP_LABEL[loai];

  const ids = state.shopsByXa?.[xaId] || [];
  if (ids.length === 0) return { ok: false, msg: "Không tìm thấy xã này." };

  // Trần 1 cơ nghiệp/người: tính cả shop đang giữ lẫn shop đang dựng dở.
  const held = Object.values(state.shops || {}).filter(
    s => s.occupantId === p.id || s.foundingById === p.id
  );
  if (held.length >= SHOP_MAX_PER_PLAYER) {
    return { ok: false, msg: "Mỗi người chỉ giữ được 1 cơ nghiệp (chưa thuê được người làm)." };
  }

  // Slot mở được: đúng loại, chưa ai giữ, chưa ai đang dựng, và NGUYÊN TRINH
  // (vacantSinceDay == null) — slot từng có chủ rồi mất là việc của cơ chế AI lấp.
  const slot = ids
    .map(id => state.shops[id])
    .find(s => s && s.loai === loai && !s.occupantId && !s.foundingById && s.vacantSinceDay == null);
  if (!slot) {
    return { ok: false, msg: `Xã này không còn suất ${label} trống để mở.` };
  }

  if (p.tien < cost) {
    return { ok: false, msg: `Mở ${label} cần ${cost} Quan. Ngươi có ${p.tien}.` };
  }

  p.tien -= cost;
  slot.foundingById = p.id;
  slot.foundDaysLeft = days;
  slot.foundStartedDay = totalDaysAbs(state);

  logLine(state, `Khởi công ${label} (bỏ ra ${cost} Quan, dự kiến ${days} ngày).`, true);
  return {
    ok: true,
    feedback: [
      { text: `Khởi công ${label}`, tone: "good" },
      { text: `-${cost} Quan`, tone: "bad" },
      { text: `${days} ngày`, tone: "bad" },
    ],
    sfx: "murmur",
  };
}

/**
 * T3.4-3a — bán hàng THẲNG cho một cửa hàng đầu mối ở xã đang đứng (người mua có
 * TÊN, giá tốt hơn chợ ẩn danh ×SHOP_BUYER_PREMIUM, nhưng có HẠN MỨC shop.buyBudget/
 * tháng). Chỉ 3 mặt hàng có shop khớp: go / lua / ruou (SHOP_BUYS). ca/muoi/thit_lon/
 * thoc vẫn bán qua chợ ẩn danh (actionTradeItem) — chưa làm state.buyers.
 *
 * Tiền trả TỪ shop.buyBudget (vốn kinh doanh cửa hàng, tự nạp mỗi tháng) — KHÔNG
 * đụng tien cá nhân occupant. Kẹp qty theo ngân sách còn lại.
 */
export function actionBanChoShop(state, itemKey, qty) {
  const p = state.player;
  if (p.faction === Faction.NGHIA_QUAN) return { ok: false, msg: "Đã tạo phản thì không còn buôn bán chợ búa." };
  qty = Math.floor(qty || 0);
  if (qty <= 0) return { ok: false, msg: "Số lượng không hợp lệ." };

  const loais = SHOP_BUYS[itemKey];
  const itemName = ItemsDb[itemKey]?.name || itemKey;
  if (!loais) return { ok: false, msg: `${itemName} không cửa hàng nào thu mua — bán ở Chợ.` };

  const have = p.inventory?.[itemKey] || 0;
  if (have < qty) return { ok: false, msg: `Chỉ có ${have} ${itemName}.` };

  const ids = state.shopsByXa?.[p.currentXa] || [];
  const shop = ids
    .map(id => state.shops?.[id])
    .find(s => s && s.occupantId && loais.includes(s.loai));
  if (!shop) return { ok: false, msg: `Xã này không có cửa hàng nào thu mua ${itemName}.` };
  if (typeof shop.buyBudget !== "number") shop.buyBudget = shopBuyBudget(shop.incomeBase | 0); // save cũ

  const label = SHOP_LABEL[shop.loai] || "cửa hàng";
  const unit = Math.round((getTradeQuote(state, itemKey, false).unitPrice || 0) * SHOP_BUYER_PREMIUM);
  if (unit <= 0) return { ok: false, msg: "Không định được giá mặt hàng này." };
  if (shop.buyBudget < unit) {
    return { ok: false, msg: `${label} đã hết vốn mua tháng này. Bán ở Chợ, hoặc chờ tháng sau.` };
  }

  const soldQty = Math.min(qty, Math.floor(shop.buyBudget / unit));
  const total = unit * soldQty;
  p.inventory[itemKey] -= soldQty;
  p.tien += total;
  shop.buyBudget -= total;

  const boss = state.npcById?.[shop.occupantId];
  logLine(state, `Bán ${soldQty} ${itemName} cho ${label}${boss ? ` (${boss.name})` : ""}: +${total} Quan (giá xưởng cao hơn chợ).`, true);
  const feedback = [
    { text: `+${total} Quan`, tone: "good" },
    { text: `-${soldQty} ${itemName}`, tone: "bad" },
  ];
  if (soldQty < qty) feedback.push({ text: `${label} chỉ mua nổi ${soldQty}/${qty} (hết vốn tháng)`, tone: "neutral" });
  return { ok: true, feedback, sfx: "coin" };
}

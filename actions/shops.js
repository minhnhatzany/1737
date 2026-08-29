import {
  ShopType, SHOP_OPEN_COST, SHOP_FOUND_DAYS, SHOP_LABEL, SHOP_MAX_PER_PLAYER,
} from "../core/shops.js";
import { totalDaysAbs } from "../engine.js";
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

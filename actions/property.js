import { rng, rngInt, rngChance, rngChoice } from "../core/rng.js";
import { MaaDb, PropertyDb, RegionsDb, hasPerk } from "../engine.js";
import { Faction, PlayerRank, RankLabel } from "../models.js";
import { logLine } from "../log.js";

export function actionXayNha(state, propId) {
  const p = state.player;
  const propKey = Object.keys(PropertyDb).find(k => PropertyDb[k].id === propId);
  const prop = propKey ? PropertyDb[propKey] : null;
  if (!prop) return { ok: false, msg: "Không tìm thấy loại công trình." };

  if (!p.homeRegion) p.homeRegion = p.currentRegion;

  // Kiểm tra điều kiện mở khoá
  const cond = prop.unlockCondition || {};
  if (cond.minRank) {
    const rankOrder = Object.values(PlayerRank);
    const playerRankIdx = rankOrder.indexOf(p.rank);
    const reqRankIdx    = rankOrder.indexOf(cond.minRank);
    if (playerRankIdx < reqRankIdx) {
      return { ok: false, msg: `Chức vụ chưa đủ để xây ${prop.name} (cần: ${RankLabel[cond.minRank]}).` };
    }
  }
  if (cond.minUyTin && p.uyTinCong < cond.minUyTin) {
    return { ok: false, msg: `Cần tối thiểu ${cond.minUyTin} Uy Tín để xây.` };
  }
  if (p.currentRegion !== p.homeRegion) {
    return { ok: false, msg: `Chỉ được xây kiến trúc tại nơi lập nghiệp (${RegionsDb[p.homeRegion]?.name || p.homeRegion}). Ngươi đang ở ${RegionsDb[p.currentRegion]?.name || p.currentRegion}!` };
  }

  if (!p.holdings) p.holdings = [];
  let existing = p.holdings.find(h => h.typeId === propId && h.regionId === p.currentRegion);

  if (existing) {
    if (existing.level >= prop.maxLevel) return { ok: false, msg: `${prop.name} đã ở cấp tối đa (${prop.maxLevel}).` };
    let cost = prop.upgradeCost * existing.level;
    if (p.tien < cost) return { ok: false, msg: `Nâng cấp ${prop.name} cần ${cost} Quan. Bạn có ${p.tien}.` };
    p.tien -= cost;
    existing.level++;
    logLine(state, `Đại tu ${prop.name} lên Cấp ${existing.level}! Hiệu ứng tăng mạnh.`);
    return { ok: true, feedback: [{ text: `${prop.name} ↑ Cấp ${existing.level}`, tone: "good" }], sfx: "coin" };
  } else {
    if (p.tien < prop.cost) return { ok: false, msg: `Xây ${prop.name} cần ${prop.cost} Quan. Bạn có ${p.tien}.` };
    p.tien -= prop.cost;
    // Build now takes time. Queue job; completion handled in daily tick.
    if (!p.buildQueue) p.buildQueue = [];
    const baseDays = Math.max(2, Math.min(40, Math.ceil((prop.cost || 0) / 1200)));
    const days = baseDays + (prop.maxLevel >= 3 ? 2 : 0);
    p.buildQueue.push({
      id: `bq_${Date.now()}_${Math.floor(rng(state) * 10000)}`,
      typeId: propId,
      regionId: p.currentRegion,
      daysLeft: days,
      startedAt: { ban: state.ban, monthIndex: state.monthIndex, gameDay: state.gameDay }
    });
    logLine(state, `🏗 Khởi công ${prop.name} (dự kiến ${days} ngày).`, true);
    return { ok: true, feedback: [{ text: `Khởi công ${prop.name}`, tone: "good" }, { text: `${days} ngày`, tone: "bad" }], sfx: "murmur" };
  }
}
export function actionRecruitMaa(state, maaId) {
  const p = state.player;
  const maa = MaaDb[maaId];
  if (!maa) return { ok: false, msg: "Binh chủng không hợp lệ." };

  // Rebel tech limits: no firearms/artillery/elephants/imperial guards by default.
  if (p.faction === Faction.NGHIA_QUAN) {
    const allowed = new Set(["nhat_binh","uu_binh","khinh_ky","trong_ky","bo_binh_nhe","cung_no","thuy_quan","dan_binh"]);
    if (!allowed.has(maaId)) {
      return { ok: false, msg: "Nghĩa quân không đủ công nghệ để tự tuyển binh chủng này. Chỉ có thể cướp được (nếu có)." };
    }
  }

  let cost = maa.cost;
  if (hasPerk(state, "qs_04")) cost = Math.floor(cost * 0.85);
  if (p.tien < cost) return { ok: false, msg: `Cần ${cost} Quan.` };

  // Check if property is built
  const propBuilt = p.holdings?.some(h => PropertyDb[Object.keys(PropertyDb).find(k => PropertyDb[k].id === h.typeId)]?.id === maa.unlock);
  if (!propBuilt) return { ok: false, msg: `Cần xây dựng ${PropertyDb[Object.keys(PropertyDb).find(k=>PropertyDb[k].id===maa.unlock)]?.name} trước!` };

  // Limit Men-at-Arms (max 5 đạo)
  if (!p.maa) p.maa = [];
  if (p.maa.length >= 5) return { ok: false, msg: "Chỉ được chỉ huy tối đa 5 đạo Binh Chủng Đặc Biệt!" };

  p.tien -= cost;
  p.maa.push({ ...maa, curQuanSo: maa.quanSo });
  p.quanSo += maa.quanSo; // Add to total
  
  logLine(state, `Chiêu mộ thành công 1 đạo ${maa.name} (${maa.quanSo} quân).`);
  return { ok: true, feedback: [{ text: `+${maa.quanSo} ${maa.name}`, tone: "good" }, { text: `-${cost} Quan`, tone: "bad" }], sfx: "coin" };
}
export function actionDemolishNha(state, propId) {
  const p = state.player;
  const propKey = Object.keys(PropertyDb).find(k => PropertyDb[k].id === propId);
  const prop = propKey ? PropertyDb[propKey] : null;
  if (!prop) return { ok: false, msg: "Không tìm thấy." };
  if (!p.holdings) return { ok: false, msg: "Không sở hữu gì." };
  const idx = p.holdings.findIndex(h => h.typeId === propId);
  if (idx < 0) return { ok: false, msg: `Chưa xây ${prop.name}.` };
  const level = p.holdings[idx].level;
  const refund = Math.floor(prop.cost * 0.5 + (level > 1 ? prop.upgradeCost * (level - 1) * 0.4 : 0));
  p.holdings.splice(idx, 1);
  p.tien += refund;
  logLine(state, `Phá dỡ ${prop.name}. Hoàn lại ${refund} quan (50% phí xây).`);
  return { ok: true, feedback: [{ text: `+${refund} Quan hoàn lại`, tone: "good" }], sfx: "coin" };
}

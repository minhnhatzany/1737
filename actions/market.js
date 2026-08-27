import { ItemsDb, MARKET_MOODS, MARKET_TRADER_NAMES, RegionsDb, randInt } from "../engine.js";
import { Faction } from "../models.js";
import { logLine } from "../log.js";

export function actionTradeItem(state, itemKey, isBuying, qty) {
  const p = state.player;
  if (p.faction === Faction.NGHIA_QUAN) return { ok: false, msg: "Đã tạo phản thì không còn giao dịch chợ búa như dân thường." };
  if (!qty || qty <= 0) return { ok: false, msg: "Số lượng giao dịch không hợp lệ." };
  const item = ItemsDb[itemKey];
  if (!item) return { ok: false, msg: "Mặt hàng chưa được hỗ trợ." };
  if (typeof p.merchantXp !== "number") p.merchantXp = 0;
  if (typeof p.merchantTier !== "number") p.merchantTier = 0;
  const quote = getTradeQuote(state, itemKey, isBuying);
  let unitPrice = quote.unitPrice;
  let totalCost = unitPrice * qty;
  let getBal = () => {
    if (itemKey === 'thoc') return p.thocCaNhan;
    if (!p.inventory) p.inventory = {};
    return p.inventory[itemKey] || 0;
  };
  let editBal = (delta) => {
    if (itemKey === 'thoc') {
      p.thocCaNhan += delta;
    } else {
      if (!p.inventory) p.inventory = {};
      p.inventory[itemKey] = (p.inventory[itemKey] || 0) + delta;
    }
  };
  if (isBuying) {
    if (p.tien < totalCost) return { ok: false, msg: `Cần ${totalCost} quan để mua ${qty} ${item.name}.` };
    p.tien -= totalCost;
    editBal(qty);
    const xp = Math.max(1, Math.floor(totalCost / 30));
    p.merchantXp += xp;
    logLine(state, `Mua ${qty} ${item.name} giá ${totalCost} quan. (+${xp} XP Thương nhân)`);
    return { ok: true, feedback: [{ text: `-${totalCost} Quan`, tone: "bad" }, { text: `+${qty} ${item.name}`, tone: "good" }, { text: `+${xp} XP Chợ`, tone: "good" }], sfx: "coin" };
  } else {
    if (getBal() < qty) return { ok: false, msg: `Chỉ có ${getBal()} ${item.name}.` };
    editBal(-qty);
    const revenue = Math.floor(totalCost * (state._quanLyBonus || 1.0));
    p.tien += revenue;
    const contract = state._marketScene?.contract;
    if (contract && contract.accepted && !contract.completed && contract.itemKey === itemKey) {
      contract.delivered = Math.min(contract.qtyRequired, (contract.delivered || 0) + qty);
      if (contract.delivered >= contract.qtyRequired) {
        contract.completed = true;
        const bonus = Math.max(10, Math.floor((contract.reward || 0) * (1 + (p.merchantTier || 0) * 0.04)));
        p.tien += bonus;
        p.merchantXp = (p.merchantXp || 0) + Math.max(8, Math.floor(bonus / 20));
        logLine(state, `📦 Hoàn tất kèo chợ ${ItemsDb[itemKey]?.name}: thưởng thêm ${bonus} quan từ ${state._marketScene?.trader || "thương hội"}.`, true);
      }
    }
    const xp = Math.max(1, Math.floor(revenue / 24));
    p.merchantXp += xp;
    const oldTier = p.merchantTier || 0;
    const tierByXp = (xpVal) => xpVal >= 1200 ? 5 : xpVal >= 760 ? 4 : xpVal >= 430 ? 3 : xpVal >= 200 ? 2 : xpVal >= 70 ? 1 : 0;
    p.merchantTier = tierByXp(p.merchantXp || 0);
    if (p.merchantTier > oldTier) logLine(state, `📈 Danh tiếng thương nhân tăng lên Cấp ${p.merchantTier}.`, true);
    logLine(state, `Bán ${qty} ${item.name} thu được ${revenue} quan. (+${xp} XP Thương nhân)`);
    return { ok: true, feedback: [{ text: `+${revenue} Quan`, tone: "good" }, { text: `+${xp} XP Chợ`, tone: "good" }], sfx: "coin" };
  }
}
export function getTradeQuote(state, itemKey, isBuying) {
  const p = state?.player || {};
  const item = ItemsDb[itemKey];
  if (!item) {
    return { ok: false, msg: "Mặt hàng không hợp lệ.", unitPrice: 0, rawPrice: 0, margin: 0, marketScene: null, haggle: null };
  }
  const pm = RegionsDb[p.currentRegion]?.pm?.[itemKey] ?? 1.0;
  if (!state._marketHaggle) state._marketHaggle = {};
  const marketScene = getMarketSceneBrief(state);
  const basePrice = itemKey === "thoc" ? state.marketPriceThoc : item.basePrice;
  let rawPrice = basePrice * pm;
  if (itemKey === marketScene.focusItem) rawPrice *= 1.08;
  rawPrice *= isBuying ? (marketScene.buyMul || 1.0) : (marketScene.sellMul || 1.0);

  let margin = Math.max(0.05, 0.20 - ((p.quanLy || 0) * 0.01) - Math.min(0.06, (p.merchantTier || 0) * 0.012));
  if (state._quanLyBonus && state._quanLyBonus > 1) margin *= 0.8;
  let unitPrice = isBuying ? Math.ceil(rawPrice * (1 + margin)) : Math.floor(rawPrice * (1 - margin));

  const ym = `${state.ban}-${state.monthIndex}`;
  const hag = state._marketHaggle[itemKey];
  if (hag && hag.ym === ym) {
    if (isBuying) unitPrice = Math.max(1, Math.floor(unitPrice * (hag.buyMul || 1)));
    else unitPrice = Math.max(1, Math.floor(unitPrice * (hag.sellMul || 1)));
  }
  return {
    ok: true,
    unitPrice,
    rawPrice,
    margin,
    marketScene,
    haggle: (hag && hag.ym === ym) ? hag : null
  };
}
export function actionMarketHaggle(state, itemKey) {
  const p = state.player;
  if (p.faction === Faction.NGHIA_QUAN) return { ok: false, msg: "Đang thời chiến, không thể đi mặc cả dân sự." };
  if (!ItemsDb[itemKey]) return { ok: false, msg: "Mặt hàng không hợp lệ." };
  if (!state._marketHaggle) state._marketHaggle = {};
  const ym = `${state.ban}-${state.monthIndex}`;
  const cur = state._marketHaggle[itemKey];
  if (cur && cur.ym === ym) return { ok: false, msg: "Tháng này đã mặc cả mặt hàng này rồi." };
  const chance = Math.max(0.2, Math.min(0.9, 0.26 + (p.ngoaiGiao || 0) * 0.007 + (p.muuMeo || 0) * 0.002 + (p.merchantTier || 0) * 0.045));
  if (Math.random() < chance) {
    const buyMul = 0.90 - Math.min(0.05, (p.merchantTier || 0) * 0.01);
    const sellMul = 1.06 + Math.min(0.05, (p.merchantTier || 0) * 0.01);
    state._marketHaggle[itemKey] = { ym, buyMul, sellMul, success: true };
    logLine(state, `🧮 Mặc cả thành công với lái buôn ${ItemsDb[itemKey].name}: giá mua giảm, giá bán tăng trong tháng.`, true);
    return { ok: true, feedback: [{ text: "Mặc cả thành công", tone: "good" }, { text: "Dựa trên Ngoại Giao", tone: "good" }], sfx: "coin" };
  }
  state._marketHaggle[itemKey] = { ym, buyMul: 1.04, sellMul: 0.96, success: false };
  logLine(state, `🗣️ Mặc cả hỏng với lái buôn ${ItemsDb[itemKey].name}: giá tạm thời bất lợi.`, false);
  return { ok: true, feedback: [{ text: "Mặc cả hỏng", tone: "bad" }, { text: "Ngoại Giao chưa đủ sắc", tone: "bad" }], sfx: "caiVa" };
}
export function getMerchantProgress(state) {
  const p = state?.player || {};
  const xp = Math.max(0, Math.floor(p.merchantXp || 0));
  const tier = Math.max(0, Math.floor(p.merchantTier || 0));
  const nextByTier = { 0: 70, 1: 200, 2: 430, 3: 760, 4: 1200 };
  const next = nextByTier[tier] || null;
  const pct = next ? Math.max(0, Math.min(100, Math.round((xp / next) * 100))) : 100;
  return { xp, tier, nextXp: next, pct };
}
export function ensureMarketSceneState(state) {
  if (!state._marketScene) state._marketScene = {};
  if (!state._marketScene.contract) state._marketScene.contract = null;
}
export function rollMonthlyMarketScene(state) {
  ensureMarketSceneState(state);
  const ym = `${state.ban}-${state.monthIndex}`;
  if (state._marketScene.ym === ym) return;
  const itemKeys = Object.keys(ItemsDb);
  const focusItem = itemKeys[randInt(0, itemKeys.length - 1)];
  const mood = MARKET_MOODS[randInt(0, MARKET_MOODS.length - 1)];
  const trader = MARKET_TRADER_NAMES[randInt(0, MARKET_TRADER_NAMES.length - 1)];
  const qty = 6 + randInt(0, 10) + Math.max(0, Math.floor((state.player?.merchantTier || 0) * 1.5));
  const price = Math.max(30, Math.floor((ItemsDb[focusItem]?.basePrice || 10) * qty * (1.2 + Math.random() * 0.5)));
  state._marketScene = {
    ym,
    trader,
    mood,
    focusItem,
    contract: {
      id: `mc_${state.ban}_${state.monthIndex}_${focusItem}`,
      itemKey: focusItem,
      qtyRequired: qty,
      delivered: 0,
      reward: price,
      accepted: false,
      completed: false,
      expiresYm: ym
    }
  };
  logLine(state, `🏮 ${trader} mở ${mood.label.toLowerCase()} tháng này, chuộng ${ItemsDb[focusItem]?.name || focusItem}.`, false);
}
export function actionAcceptMarketContract(state) {
  const p = state.player;
  if (p.faction === Faction.NGHIA_QUAN) return { ok: false, msg: "Nghĩa quân không ký kèo thương vụ dân sự." };
  rollMonthlyMarketScene(state);
  const c = state._marketScene?.contract;
  if (!c) return { ok: false, msg: "Tháng này chưa có hợp đồng." };
  if (c.completed) return { ok: false, msg: "Kèo đã hoàn tất." };
  if (c.accepted) return { ok: false, msg: "Đã nhận kèo tháng này." };
  c.accepted = true;
  logLine(state, `🧾 Nhận hợp đồng: giao ${c.qtyRequired} ${ItemsDb[c.itemKey]?.name || c.itemKey} trước khi hết tháng.`, false);
  return { ok: true, feedback: [{ text: "Đã nhận hợp đồng", tone: "good" }, { text: `${c.qtyRequired} đơn vị`, tone: "good" }], sfx: "murmur" };
}
export function getMarketSceneBrief(state) {
  rollMonthlyMarketScene(state);
  const ms = state._marketScene || {};
  const c = ms.contract || null;
  return {
    trader: ms.trader || "Phiên chợ địa phương",
    moodLabel: ms.mood?.label || "Phiên chợ thường",
    moodKey: ms.mood?.key || "fair",
    focusItem: ms.focusItem || null,
    buyMul: ms.mood?.buyMul || 1.0,
    sellMul: ms.mood?.sellMul || 1.0,
    contract: c ? {
      itemKey: c.itemKey,
      qtyRequired: c.qtyRequired,
      delivered: c.delivered || 0,
      reward: c.reward || 0,
      accepted: !!c.accepted,
      completed: !!c.completed,
    } : null
  };
}

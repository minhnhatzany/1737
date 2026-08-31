import { rng, rngInt, rngChance, rngChoice } from "../core/rng.js";
import { clanAvgOpinionToPlayer, getClanPressurePreset, isClanHostile, localClanIds } from "./clan.js";
import { randInt } from "../engine.js";
import { Faction, PlayerRank, RegionId, totalPops, takeFromExtraction } from "../models.js";
import { Weather, rollPersonalHarvestThoc } from "../weather.js";
import { CapitalKind, THUYEN_WEAR_PER_TRIP } from "../core/capital.js";
import { getTradeQuote } from "./market.js";
import { bumpSkill } from "../lifestyle.js";
import { logLine } from "../log.js";

/** T3.4-1a: MÓN công cụ CÒN DÙNG ĐƯỢC (cond>0), hoặc null. cond=0 = hỏng -> coi như
 *  không có (khớp cách actionKhoiVu đọc hasTrau — KHÔNG chỉ some(kind===...) hời hợt). */
function getWorkingCapital(p, kind) {
  return (p.capital || []).find(c => c.kind === kind && (c.cond | 0) > 0) || null;
}
/** Bản boolean của getWorkingCapital — 1a dùng cho nồi/khung. */
function hasWorkingCapital(p, kind) {
  return getWorkingCapital(p, kind) !== null;
}
/** T3.4-1a: sợi/tơ cho buổi dệt — trừu tượng thành tiền (khuôn actionChanNuoiLon).
 *  Bông/tơ thành hàng hoá thật có chuỗi cung ứng: để dành GĐ2b. */
const DET_VAI_SOI_COST = 6;

/**
 * T3.4-1b: dòng họ đối nghịch CỤC BỘ phá việc làm ăn tại xã đang đứng (nghề chế biến /
 * chặt gỗ). Khuôn giống nhánh sabotage của actionCayRuong + processMonthlyFarmRisk:
 * chỉ rank dân / phú hộ; localHostile = họ cục bộ thù địch (không tính họ bảo trợ);
 * rng(state) < sabotageChance (preset). KHÔNG patron boost — chốt lượt dò: chỉ đặc sản
 * giữ patron, tránh "có patron là mọi nghề +15%". Trả true -> nơi gọi tự giảm sản lượng.
 */
function localClanSabotage(state) {
  const p = state.player;
  if (p.rank !== PlayerRank.DAN_THUONG && p.rank !== PlayerRank.PHU_HO) return false;
  const localHostile = (localClanIds(state) || []).some(cid => {
    if (cid === p._patronClanId) return false;
    const c = state.clans?.find(x => x.id === cid);
    return c && (isClanHostile(c) || clanAvgOpinionToPlayer(state, cid) < -20);
  });
  if (!localHostile) return false;
  return rng(state) < (getClanPressurePreset(state).sabotageChance || 0);
}

export function collapseFromExhaustion(state, tuChonLog) {
  const p = state.player;
  // T3.5-3.5d: Thiên Y (_birthThienY) — nửa số lần kiệt sức KHÔNG ngã bệnh, chỉ cạn
  // thể lực (không mất 15 tiền, không dangOm, không −10 HP).
  if (p._birthThienY && rng(state) < 0.5) {
    p.theLuc = 0;
    logLine(state, "Kiệt sức nhưng thể trạng tốt — chỉ cần nghỉ, không ngã bệnh.");
    return;
  }
  p.tien = Math.max(0, p.tien - 15);
  p.dangOm = true;
  p.theLuc = 0;
  // Kiệt sức có thể làm suy sinh mệnh
  if (typeof p.hp === "number") p.hp = Math.max(1, p.hp - 10);
  logLine(state, tuChonLog || "Làm việc kiệt sức ngã gục. Nằm liệt giường, mất bộn tiền thuốc.");
}
/** T3.4-0: cày công nhật là ĐẮP ĐỔI QUA NGÀY, không tích sản. Sản lượng nền ×0.4 so
 *  với vụ mùa thật (actionKhoiVu, BASE_VU_YIELD 60/vụ) + trần buổi/ngày để không spam
 *  tới kiệt thể lực. Có ruộng thật (khởi vụ) mới là đường làm giàu. */
const CAY_RUONG_FACTOR = 0.4;
const CAY_RUONG_MAX_PER_DAY = 3;

export function actionCayRuong(state) {
  const p = state.player;
  if (p.faction === Faction.NGHIA_QUAN) return { ok: false, msg: "Đã tạo phản thì không còn cày ruộng như dân thường." };
  if (p.dangOm) return { ok: false, msg: "Đang ốm liệt giường." };
  if (p.theLuc < 20) return { ok: false, msg: "Hết thể lực." };
  if ((p._cayRuongToday || 0) >= CAY_RUONG_MAX_PER_DAY) {
    return { ok: false, msg: `Cày công nhật cả ngày rồi, lưng còng gối mỏi. Mai làm tiếp (tối đa ${CAY_RUONG_MAX_PER_DAY} buổi/ngày).` };
  }
  p.theLuc -= 20;
  p._cayRuongToday = (p._cayRuongToday || 0) + 1;
  // rng(state) — replay-safe; KHÔNG dùng fallback stream của rollPersonalHarvestThoc.
  let thoc = Math.max(1, Math.floor(rollPersonalHarvestThoc(state.thoiTiet, state) * CAY_RUONG_FACTOR));
  // Clan influence (commoner phase): patron helps, hostile clans sabotage. (giữ nguyên)
  if (p.rank === PlayerRank.DAN_THUONG || p.rank === PlayerRank.PHU_HO) {
    const preset = getClanPressurePreset(state);
    const patron = state.clans?.find(c => c.id === p._patronClanId);
    if (patron) thoc = Math.floor(thoc * preset.patronHarvestBoost);
    const localHostile = (localClanIds(state) || []).some(cid => { // T3.1c: theo xã đang đứng
      if (cid === p._patronClanId) return false;
      const c = state.clans?.find(x => x.id === cid);
      return c && (isClanHostile(c) || clanAvgOpinionToPlayer(state, cid) < -20);
    });
    if (localHostile && rng(state) < preset.sabotageChance) {
      thoc = Math.max(0, thoc - 2); // giữ nguyên: dòng họ phá có thể làm trắng một buổi xấu
      logLine(state, "Bị dòng họ đối nghịch phá việc đồng áng, mất bớt sản lượng.", true);
    }
  }
  // Áp dụng bonus Quản Lý TRƯỚC khi cộng vào, để số thực tế khớp feedback
  const bonus = state._quanLyBonus || 1.0;
  if (bonus > 1) thoc = Math.floor(thoc * bonus);
  p.thocCaNhan += thoc;
  let feedback = [{ text: "-20 Thể lực", tone: "bad" }, { text: `+${thoc} thóc (bữa qua ngày)`, tone: "neutral" }];
  if (p.theLuc <= 0) { collapseFromExhaustion(state); return { ok: true, feedback, shake: true, sfx: "cay" }; }
  logLine(state, "Đi cày công nhật, kiếm bữa qua ngày.");
  return { ok: true, feedback, sfx: "cay" };
}
export function actionNghiAnCom(state) {
  return { ok: false, msg: "Đã bỏ hành động này. Thể lực tự hồi theo ngày (trừ khi ốm)." };
}
export function actionKhaiThacDacSan(state) {
  const p = state.player;
  if (p.faction === Faction.NGHIA_QUAN) return { ok: false, msg: "Đã tạo phản thì không còn đi làm đặc sản vùng như dân thường." };
  if (p.theLuc < 25) return { ok: false, msg: "Không đủ thể lực (< 25)." };
  // T3.4-2b: guard latent throw — 3 nghề kia đều init inventory, hàm này thiếu.
  if (!p.inventory) p.inventory = { ruou: 0, tra: 0, lua: 0, muoi: 0, go: 0, ca: 0, thit_lon: 0 };
  p.theLuc -= 25;
  const bonus = (state._quanLyBonus || 1.0) * (p._traitChamChi ? 1.25 : 1.0); // T3.5-3.5d: Chăm Chỉ +25%
  const preset = getClanPressurePreset(state);
  const patronBoost = (p._patronClanId && (p.rank === PlayerRank.DAN_THUONG || p.rank === PlayerRank.PHU_HO)) ? preset.specialtyBoost : 1.0;
  // T3.4-2b: mọi nhánh rút từ hồ khai thác chung của xã (bucket theo mặt hàng). GIỮ tất
  // định (không randInt) — đúng bản chất "đặc sản vùng".
  if (p.currentRegion === RegionId.SON_NAM) {
    const qty = takeFromExtraction(state.village, "dacSan", Math.ceil(1 * bonus * patronBoost));
    p.inventory.lua = (p.inventory.lua || 0) + qty;
    logLine(state, `Dệt lanh kéo tơ, thu được ${qty} Tấm Lụa.`);
    return { ok: true, feedback: [{ text: `+${qty} Tấm Lụa`, tone: "good" }], sfx: "cay" };
  }
  if (p.currentRegion === RegionId.HAI_DUONG) {
    const qty = takeFromExtraction(state.village, "dacSan", Math.ceil(2 * bonus * patronBoost));
    p.inventory.muoi = (p.inventory.muoi || 0) + qty;
    logLine(state, `Cào rong nấu muối, thu được ${qty} Gánh Muối.`);
    return { ok: true, feedback: [{ text: `+${qty} Gánh Muối`, tone: "good" }], sfx: "cay" };
  }
  if (p.currentRegion === RegionId.SON_TAY) {
    const qty = takeFromExtraction(state.village, "go", Math.ceil(1 * bonus * patronBoost));
    p.inventory.go = (p.inventory.go || 0) + qty;
    logLine(state, `Lên mạn ngược phạt rừng, thu được ${qty} Khối Gỗ.`);
    return { ok: true, feedback: [{ text: `+${qty} Khối Gỗ`, tone: "good" }], sfx: "cay" };
  }
  if (p.currentRegion === RegionId.AN_QUANG) {
    // T3.4-2b: sửa bất đối xứng — cho GIỎ CÁ (như các vùng khác cho item), không tiền
    // thẳng. Base 2 = đúng base muối HẢI_DƯƠNG (không đẻ số mới).
    const qty = takeFromExtraction(state.village, "ca", Math.ceil(2 * bonus * patronBoost));
    p.inventory.ca = (p.inventory.ca || 0) + qty;
    logLine(state, `Ra biển kéo lưới, được ${qty} Giỏ Cá.`);
    return { ok: true, feedback: [{ text: `+${qty} Giỏ Cá`, tone: "good" }], sfx: "cay" };
  }
  return { ok: false, msg: "Vùng này không có đặc sản khai thác." };
}
export function actionChatGo(state) {
  const p = state.player;
  if (p.faction === Faction.NGHIA_QUAN) return { ok: false, msg: "Đã tạo phản thì không đi làm lâm nghiệp dân sinh kiểu cũ." };
  if (p.dangOm) return { ok: false, msg: "Đang ốm liệt giường." };
  if (p.theLuc < 22) return { ok: false, msg: "Cần 22 thể lực." };
  if (!p.inventory) p.inventory = { ruou: 0, tra: 0, lua: 0, muoi: 0, go: 0, ca: 0, thit_lon: 0 };
  p.theLuc -= 22;
  const regionBoost = p.currentRegion === RegionId.SON_TAY ? 1.35 : 1.0;
  const weatherCut = (state.thoiTiet === Weather.LU || state.thoiTiet === Weather.BAO) ? 0.82 : 1.0;
  let qty = Math.max(1, Math.floor((1 + randInt(state, 0, 2)) * regionBoost * weatherCut * (state._quanLyBonus || 1)));
  if (p._traitChamChi) qty = Math.max(1, Math.round(qty * 1.25)); // T3.5-3.5d: Chăm Chỉ +25%
  if (localClanSabotage(state)) {
    qty = Math.max(1, qty - 1);
    logLine(state, "Dòng họ đối nghịch chặn cửa rừng, chuyến gỗ hụt đi.", true);
  }
  qty = takeFromExtraction(state.village, "go", qty); // T3.4-2b: hồ gỗ chung của xã
  p.inventory.go = (p.inventory.go || 0) + qty;
  logLine(state, `🪵 Vào rừng đốn gỗ, gom được ${qty} tấm gỗ.`);
  return { ok: true, feedback: [{ text: `+${qty} Gỗ`, tone: "good" }, { text: "-22 TL", tone: "bad" }], sfx: "cay" };
}
export function actionDetVai(state) {
  const p = state.player;
  if (p.faction === Faction.NGHIA_QUAN) return { ok: false, msg: "Đã tạo phản thì không ở phường dệt như dân thường." };
  if (p.dangOm) return { ok: false, msg: "Đang ốm liệt giường." };
  if (p.theLuc < 20) return { ok: false, msg: "Cần 20 thể lực." };
  if (p.tien < DET_VAI_SOI_COST) return { ok: false, msg: `Cần ${DET_VAI_SOI_COST} quan mua sợi/tơ cho buổi dệt.` };
  if (!p.inventory) p.inventory = { ruou: 0, tra: 0, lua: 0, muoi: 0, go: 0, ca: 0, thit_lon: 0 };
  p.theLuc -= 20;
  p.tien -= DET_VAI_SOI_COST;
  const coKhung = hasWorkingCapital(p, CapitalKind.KHUNG_CUI);
  const regionBoost = (p.currentRegion === RegionId.SON_NAM || p.currentRegion === RegionId.KINH_BAC) ? 1.25 : 1.0;
  // Không khung -> dệt tay, 1 tấm thô/buổi. Có khung -> năng suất đầy đủ (vùng + focus).
  let qty = coKhung
    ? Math.max(1, Math.floor((1 + randInt(state, 0, 1)) * regionBoost * (state._quanLyBonus || 1)))
    : 1;
  if (p._traitChamChi) qty = Math.max(1, Math.round(qty * 1.25)); // T3.5-3.5d: Chăm Chỉ +25%
  if (localClanSabotage(state)) {
    qty = Math.max(1, qty - 1);
    logLine(state, "Dòng họ đối nghịch phá khung, buổi dệt hụt đi.", true);
  }
  p.inventory.lua = (p.inventory.lua || 0) + qty;
  bumpSkill(state, "quanLy", 1); // T3.5-3.5b: chế biến có công cụ = quản lý quy trình
  logLine(state, coKhung
    ? `🧵 Dệt khung cửi cả buổi, được ${qty} tấm vải.`
    : `🧵 Dệt tay lần hồi, được ${qty} tấm vải thô.`);
  return { ok: true, feedback: [{ text: `+${qty} Lụa`, tone: "good" }, { text: `-${DET_VAI_SOI_COST} Quan sợi`, tone: "bad" }, { text: "-20 TL", tone: "bad" }], sfx: "coin" };
}
export function actionChanNuoiLon(state) {
  const p = state.player;
  if (p.faction === Faction.NGHIA_QUAN) return { ok: false, msg: "Nghĩa quân không tiện ở yên chăn nuôi như dân thường." };
  if (p.dangOm) return { ok: false, msg: "Đang ốm liệt giường." };
  if (p.theLuc < 18) return { ok: false, msg: "Cần 18 thể lực." };
  if (p.tien < 8) return { ok: false, msg: "Cần 8 quan tiền giống/cám." };
  if (!p.inventory) p.inventory = { ruou: 0, tra: 0, lua: 0, muoi: 0, go: 0, ca: 0, thit_lon: 0 };
  p.theLuc -= 18;
  p.tien -= 8;
  let qty = Math.max(1, Math.floor((1 + randInt(state, 0, 2)) * (state._quanLyBonus || 1)));
  if (p._traitChamChi) qty = Math.max(1, Math.round(qty * 1.25)); // T3.5-3.5d: Chăm Chỉ +25%
  if (localClanSabotage(state)) {
    qty = Math.max(1, qty - 1);
    logLine(state, "Dòng họ đối nghịch thả chó cắn đàn lợn, xuất chuồng hụt đi.", true);
  }
  p.inventory.thit_lon = (p.inventory.thit_lon || 0) + qty;
  p.uyTinCong = Math.min(9999, (p.uyTinCong || 0) + (rng(state) < 0.35 ? 1 : 0));
  bumpSkill(state, "quanLy", 1); // T3.5-3.5b: quản đàn/vốn/cám theo lứa = quản lý
  logLine(state, `🐖 Xuất chuồng lợn, thu được ${qty} mẻ thịt. Mang ra chợ bán sẽ lời hơn.`);
  return { ok: true, feedback: [{ text: `+${qty} Thịt lợn`, tone: "good" }, { text: "-8 Quan vốn", tone: "bad" }, { text: "-18 TL", tone: "bad" }], sfx: "coin" };
}
export function actionNauRuou(state) {
  const p = state.player;
  if (p.faction === Faction.NGHIA_QUAN) return { ok: false, msg: "Nghĩa quân không mở lò rượu dân sự lúc này." };
  if (p.dangOm) return { ok: false, msg: "Đang ốm liệt giường." };
  if (p.theLuc < 16) return { ok: false, msg: "Cần 16 thể lực." };
  if ((p.thocCaNhan || 0) < 2) return { ok: false, msg: "Cần 2 thóc để nấu rượu." };
  if (!p.inventory) p.inventory = { ruou: 0, tra: 0, lua: 0, muoi: 0, go: 0, ca: 0, thit_lon: 0 };
  p.theLuc -= 16;
  p.thocCaNhan = Math.max(0, (p.thocCaNhan || 0) - 2);
  const coNoi = hasWorkingCapital(p, CapitalKind.NOI_RUOU);
  // Không nồi -> cất chõ tay, 1 hũ/buổi. Có nồi -> mẻ khá hơn, tỉ lệ ra 2 tăng.
  let qty = coNoi ? (1 + (rng(state) < 0.55 ? 1 : 0)) : 1;
  if (p._traitChamChi) qty = Math.max(1, Math.round(qty * 1.25)); // T3.5-3.5d: Chăm Chỉ +25%
  if (localClanSabotage(state)) {
    qty = Math.max(1, qty - 1);
    logLine(state, "Dòng họ đối nghịch đổ mẻ rượu đang ủ, hụt mất một phần.", true);
  }
  p.inventory.ruou = (p.inventory.ruou || 0) + qty;
  bumpSkill(state, "quanLy", 1); // T3.5-3.5b: ủ men/canh lửa/canh mẻ = quản lý quy trình
  logLine(state, coNoi
    ? `🍶 Cất rượu bằng nồi, ủ được ${qty} hũ.`
    : `🍶 Cất rượu chõ tay, được ${qty} hũ.`);
  return { ok: true, feedback: [{ text: `+${qty} Rượu`, tone: "good" }, { text: "-2 Thóc", tone: "bad" }, { text: "-16 TL", tone: "bad" }], sfx: "murmur" };
}
export function actionCauCaSong(state) {
  const p = state.player;
  if (p.faction === Faction.NGHIA_QUAN) return { ok: false, msg: "Nghĩa quân không thong thả câu cá sinh nhai lúc này." };
  if (p.dangOm) return { ok: false, msg: "Đang ốm liệt giường." };
  if (p.theLuc < 16) return { ok: false, msg: "Cần 16 thể lực." };
  const riverRegions = new Set([RegionId.THANG_LONG, RegionId.SON_NAM, RegionId.HAI_DUONG, RegionId.SON_TAY, RegionId.KINH_BAC, RegionId.THANH_HOA, RegionId.NGHE_AN, RegionId.TUYEN_QUANG]);
  if (!riverRegions.has(p.currentRegion)) return { ok: false, msg: "Vùng này không thuận câu cá sông." };
  if (!p.inventory) p.inventory = { ruou: 0, tra: 0, lua: 0, muoi: 0, go: 0, ca: 0, thit_lon: 0 };
  p.theLuc -= 16;
  const weatherMul = (state.thoiTiet === Weather.LU || state.thoiTiet === Weather.MUA) ? 1.2 : (state.thoiTiet === Weather.HAN ? 0.8 : 1.0);
  const boat = getWorkingCapital(p, CapitalKind.THUYEN_NAN);
  // Không thuyền -> câu tay mép bờ, 1 giỏ/buổi. Có thuyền -> ra sông giăng lưới đầy đủ.
  let qty = boat
    ? Math.max(1, Math.floor((1 + randInt(state, 0, 2)) * weatherMul * (state._quanLyBonus || 1.0)))
    : 1;
  if (p._traitChamChi) qty = Math.max(1, Math.round(qty * 1.25)); // T3.5-3.5d: Chăm Chỉ +25%
  qty = takeFromExtraction(state.village, "ca", qty); // T3.4-2b: hồ cá chung của xã
  p.inventory.ca = (p.inventory.ca || 0) + qty;
  if (boat) boat.cond = Math.max(0, (boat.cond | 0) - THUYEN_WEAR_PER_TRIP);
  logLine(state, boat
    ? `🎣 Chèo thuyền ra sông câu cá, thu được ${qty} giỏ cá.`
    : `🎣 Ngồi mép sông câu tay, được ${qty} giỏ cá.`);
  return { ok: true, feedback: [{ text: `+${qty} Cá`, tone: "good" }, { text: "-16 TL", tone: "bad" }], sfx: "murmur" };
}
export function actionDanhBatVenBien(state) {
  const p = state.player;
  if (p.faction === Faction.NGHIA_QUAN) return { ok: false, msg: "Nghĩa quân không mở thuyền đánh bắt dân sinh lúc này." };
  if (p.dangOm) return { ok: false, msg: "Đang ốm liệt giường." };
  if (p.theLuc < 24) return { ok: false, msg: "Cần 24 thể lực." };
  const coastalRegions = new Set([RegionId.AN_QUANG, RegionId.HAI_DUONG]);
  if (!coastalRegions.has(p.currentRegion)) return { ok: false, msg: "Phải ở vùng ven biển mới tổ chức đánh bắt." };
  if (!p.inventory) p.inventory = { ruou: 0, tra: 0, lua: 0, muoi: 0, go: 0, ca: 0, thit_lon: 0 };
  p.theLuc -= 24;
  const seaMul = p.currentRegion === RegionId.AN_QUANG ? 1.25 : 1.0;
  const weatherMul = (state.thoiTiet === Weather.BAO) ? 0.65 : (state.thoiTiet === Weather.MUA ? 1.1 : 1.0);
  const boat = getWorkingCapital(p, CapitalKind.THUYEN_NAN);
  // Không thuyền -> lội ven bờ mò sò bắt cua, 1 giỏ/buổi. Có thuyền -> dong khơi đánh lưới.
  let qty = boat
    ? Math.max(1, Math.floor((2 + randInt(state, 0, 3)) * seaMul * weatherMul * (state._quanLyBonus || 1.0)))
    : 1;
  if (p._traitChamChi) qty = Math.max(1, Math.round(qty * 1.25)); // T3.5-3.5d: Chăm Chỉ +25%
  qty = takeFromExtraction(state.village, "ca", qty); // T3.4-2b: hồ cá chung của xã
  p.inventory.ca = (p.inventory.ca || 0) + qty;
  if (boat) boat.cond = Math.max(0, (boat.cond | 0) - THUYEN_WEAR_PER_TRIP);
  logLine(state, boat
    ? `🚣 Dong thuyền ra cửa biển đánh lưới, mang về ${qty} giỏ cá.`
    : `🚣 Lội ven bờ mò sò bắt cua, được ${qty} giỏ cá.`);
  return { ok: true, feedback: [{ text: `+${qty} Cá`, tone: "good" }, { text: "-24 TL", tone: "bad" }], sfx: "battle" };
}
/**
 * T3.4-3b — buôn lậu muối. Input là ITEM `muoi` THẬT trong inventory (không còn vốn
 * 10Q trừu tượng): người chơi tự kiếm muối (KhaiThacDacSan ở HẢI_DƯƠNG, hoặc mua nơi
 * khác) rồi đưa qua đây. Trót lọt -> bán chợ đen giá theo VÙNG (giá người mua sẵn trả
 * = quote phía MUA, cao hơn giá lái buôn ép) × _quanLyBonus. Bị bắt -> mất số muối
 * đang mang + cờ trongSoDenLy (hậu quả phạm pháp THẬT — wantedLevel/witness — để dành
 * GĐ2b, đã ghi sổ nợ). Region-gate tối thiểu: không buôn lậu ngay tại vùng muối rẻ.
 * KHÔNG người mua có tên (chợ đen chung cho mọi hàng cấm: thiết kế ở GĐ2b).
 */
export function actionBuonLauMuoi(state, qty) {
  const p = state.player;
  if (p.faction === Faction.NGHIA_QUAN) return { ok: false, msg: "Đã tạo phản thì không đi buôn bán chợ búa nữa." };
  if (p.dangOm) return { ok: false, msg: "Đang ốm." };
  qty = Math.floor(qty || 0);
  if (qty <= 0) return { ok: false, msg: "Không có muối để đưa đi buôn lậu." };
  const have = p.inventory?.muoi || 0;
  if (have < qty) return { ok: false, msg: `Chỉ có ${have} gánh muối để đưa đi.` };
  if (p.currentRegion === RegionId.HAI_DUONG || p.currentRegion === RegionId.AN_QUANG) {
    return { ok: false, msg: "Vùng muối rẻ đầy chợ — phải đem muối đi nơi khác mới có lãi buôn lậu." };
  }

  p.theLuc -= 15;
  const amMuuBonus = state._amMuuBonus || 1.0;
  let catchRate = Math.max(0.05, 0.30 - p.muuMeo * 0.01) / amMuuBonus;
  if (p._patronClanId && (p.rank === PlayerRank.DAN_THUONG || p.rank === PlayerRank.PHU_HO)) {
    catchRate *= getClanPressurePreset(state).smuggleCatchMul;
  }
  if (rng(state) < catchRate) {
    p.inventory.muoi -= qty;             // mất số muối đang mang (thay cho "mất 10Q" cũ)
    p.trongSoDenLy = true;
    logLine(state, `Bị tuần tráng phát hiện! Tịch thu ${qty} gánh muối, ghi vào sổ bìa đen.`, true);
    return { ok: true, shake: true, sfx: "caiVa", feedback: [{ text: `-${qty} Muối (bị tịch thu)`, tone: "bad" }] };
  }

  // Giá chợ đen = quote phía MUA của vùng đang đứng (người mua sẵn trả, không bị lái
  // buôn ép giá bán). rng(state) qua getTradeQuote's marketScene — replay-safe.
  const unit = Math.max(1, getTradeQuote(state, "muoi", true).unitPrice || 0);
  const gained = Math.floor(unit * qty * (state._quanLyBonus || 1.0));
  p.inventory.muoi -= qty;
  p.tien += gained;
  bumpSkill(state, "muuMeo", 1); // T3.5-3.5b: né tuần tráng, tính đường đi = mưu mẹo (thay quanLy+=0.5 cũ)
  logLine(state, `Chuyến buôn lậu ${qty} gánh muối trót lọt, thu về ${gained} quan.`);
  return { ok: true, feedback: [{ text: `+${gained} Quan`, tone: "good" }, { text: `-${qty} Muối`, tone: "bad" }], sfx: "coin" };
}
export function actionMoBinh(state) {
  const p = state.player;
  if (p.faction === Faction.NGHIA_QUAN) return { ok: false, msg: "Đã tạo phản thì phải mộ binh theo địa bàn chiếm đóng (mục Nghĩa Quân)." };
  if (p.tien < 30) return { ok: false, msg: "Không có tiền mộ lính (cần 30 quan/10 lính)." };
  if (p.thocCaNhan < 20) return { ok: false, msg: "Không có thóc nuôi binh (cần 20 thóc)." };
  
  let maxSuatDinh = Math.floor(totalPops(state.village) / 5);
  let currentlyDrafted = state.village.drafted || 0;
  let suatDinhRanhRoi = maxSuatDinh - currentlyDrafted;
  
  if (suatDinhRanhRoi < 10) {
      return { ok: false, msg: `Làng ${state.village.name} đã cạn kiệt trai tráng! Chỉ còn lại ${suatDinhRanhRoi} suất đinh rảnh rỗi.` };
  }
  
  p.tien -= 30;
  p.thocCaNhan -= 20;
  p.quanSo += 10;
  p.binhQuyen += 15;
  state.village.drafted = currentlyDrafted + 10;
  
  logLine(state, `Xuất lúa tiền mộ lính. 10 trai tráng làng ${state.village.name} tòng quân. Làng rầu rĩ vì mất đi nhân lực.`);
  return { ok: true, feedback: [{ text: "+10 Lính", tone: "good" }], sfx: "battle" };
}
export function actionLuyenVo(state) {
  const p = state.player;
  if (p.faction === Faction.NGHIA_QUAN) return { ok: false, msg: "Đã tạo phản thì không còn luyện võ ở võ đường triều đình." };
  if (p.theLuc < 30) return { ok: false, msg: "Thể lực âm qué (cần 30+). Nghỉ ngơi trước." };
  if (p.tien < 3) return { ok: false, msg: "Cần 3 Quan mã bóng thuốc xương khớp cho buổi tập." };
  p.tien -= 3;
  p.theLuc -= 30;
  // T3.5-3.5a: tích luỹ qua bumpSkill chung (khuôn cũ _voTrainAccum, ngưỡng 4).
  // T3.5-3.5c-hotfix: lò rèn (lo_ren, 4000Q) -> "buổi tốt" 0.30 thay 0.18 — khuôn
  // hoc_duong/van_mieu ở actionDiHoc (3.5b), trả tác dụng cho công trình sau khi
  // 3.5c cắt passive voThuatAccum. Không lo_ren -> 0.18 như cũ (hành vi không đổi).
  const hasForge = (p.holdings || []).some(h => h.typeId === "lo_ren");
  const gain = (rng(state) < (hasForge ? 0.30 : 0.18)) ? 2 : 1; // "great session"
  const ups = bumpSkill(state, "voThuat", gain);
  if (ups > 0) {
    logLine(state, `Khổ luyện có ngày. Võ Thuật +${ups}.`);
    return { ok: true, feedback: [{ text: `+${ups} Võ Thuật`, tone: "good" }, { text: "-30 TL", tone: "bad" }], sfx: "battle" };
  }
  logLine(state, "Mồ hôi đổ xuống đất. Võ đạo tiến rất chậm, cần tích lũy lâu dài.");
  return { ok: true, feedback: [{ text: "Tiến bộ (tích lũy)", tone: "good" }, { text: "-30 TL", tone: "bad" }], sfx: "murmur" };
}

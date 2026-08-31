import { rng, rngInt, rngChance, rngChoice } from "../core/rng.js";
import { clanAvgOpinionToPlayer, getClanPressurePreset, isClanHostile, localClanIds } from "./clan.js";
import { randInt } from "../engine.js";
import { Faction, PlayerRank, RegionId, totalPops } from "../models.js";
import { Weather, rollPersonalHarvestThoc } from "../weather.js";
import { CapitalKind } from "../core/capital.js";
import { logLine } from "../log.js";

/** T3.4-1a: có công cụ chế biến CÒN DÙNG ĐƯỢC (cond>0). cond=0 = hỏng -> coi như không
 *  có (khớp cách actionKhoiVu đọc hasTrau — KHÔNG chỉ some(kind===...) hời hợt). */
function hasWorkingCapital(p, kind) {
  return (p.capital || []).some(c => c.kind === kind && (c.cond | 0) > 0);
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
  p.theLuc -= 25;
  const bonus = state._quanLyBonus || 1.0;
  const preset = getClanPressurePreset(state);
  const patronBoost = (p._patronClanId && (p.rank === PlayerRank.DAN_THUONG || p.rank === PlayerRank.PHU_HO)) ? preset.specialtyBoost : 1.0;
  if (p.currentRegion === RegionId.SON_NAM) {
    let qty = Math.ceil(1 * bonus * patronBoost);
    p.inventory.lua += qty;
    logLine(state, `Dệt lanh kéo tơ, thu được ${qty} Tấm Lụa.`);
    return { ok: true, feedback: [{ text: `+${qty} Tấm Lụa`, tone: "good" }], sfx: "cay" };
  }
  if (p.currentRegion === RegionId.HAI_DUONG) {
    let qty = Math.ceil(2 * bonus * patronBoost);
    p.inventory.muoi += qty;
    logLine(state, `Cào rong nấu muối, thu được ${qty} Gánh Muối.`);
    return { ok: true, feedback: [{ text: `+${qty} Gánh Muối`, tone: "good" }], sfx: "cay" };
  }
  if (p.currentRegion === RegionId.SON_TAY) {
    let qty = Math.ceil(1 * bonus * patronBoost);
    p.inventory.go += qty;
    logLine(state, `Lên mạn ngược phạt rừng, thu được ${qty} Khối Gỗ.`);
    return { ok: true, feedback: [{ text: `+${qty} Khối Gỗ`, tone: "good" }], sfx: "cay" };
  }
  if (p.currentRegion === RegionId.AN_QUANG) {
    let gain = Math.ceil(20 * bonus * patronBoost);
    p.tien += gain;
    logLine(state, `Ra biển đánh cá, bán được ${gain} quan.`);
    return { ok: true, feedback: [{ text: `+${gain} Quan`, tone: "good" }], sfx: "cay" };
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
  if (localClanSabotage(state)) {
    qty = Math.max(1, qty - 1);
    logLine(state, "Dòng họ đối nghịch chặn cửa rừng, chuyến gỗ hụt đi.", true);
  }
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
  if (localClanSabotage(state)) {
    qty = Math.max(1, qty - 1);
    logLine(state, "Dòng họ đối nghịch phá khung, buổi dệt hụt đi.", true);
  }
  p.inventory.lua = (p.inventory.lua || 0) + qty;
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
  if (localClanSabotage(state)) {
    qty = Math.max(1, qty - 1);
    logLine(state, "Dòng họ đối nghịch thả chó cắn đàn lợn, xuất chuồng hụt đi.", true);
  }
  p.inventory.thit_lon = (p.inventory.thit_lon || 0) + qty;
  p.uyTinCong = Math.min(9999, (p.uyTinCong || 0) + (rng(state) < 0.35 ? 1 : 0));
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
  if (localClanSabotage(state)) {
    qty = Math.max(1, qty - 1);
    logLine(state, "Dòng họ đối nghịch đổ mẻ rượu đang ủ, hụt mất một phần.", true);
  }
  p.inventory.ruou = (p.inventory.ruou || 0) + qty;
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
  const qty = Math.max(1, Math.floor((1 + randInt(0, 2)) * weatherMul * (state._quanLyBonus || 1.0)));
  p.inventory.ca = (p.inventory.ca || 0) + qty;
  logLine(state, `🎣 Ngồi mép sông câu cá, thu được ${qty} giỏ cá.`);
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
  const qty = Math.max(1, Math.floor((2 + randInt(0, 3)) * seaMul * weatherMul * (state._quanLyBonus || 1.0)));
  p.inventory.ca = (p.inventory.ca || 0) + qty;
  logLine(state, `🚣 Ra cửa biển đánh lưới, mang về ${qty} giỏ cá.`);
  return { ok: true, feedback: [{ text: `+${qty} Cá`, tone: "good" }, { text: "-24 TL", tone: "bad" }], sfx: "battle" };
}
export function actionBuonLauMuoi(state) {
  const p = state.player;
  if (p.faction === Faction.NGHIA_QUAN) return { ok: false, msg: "Đã tạo phản thì không đi buôn bán chợ búa nữa." };
  if (p.dangOm) return { ok: false, msg: "Đang ốm." };
  if (p.tien < 10) return { ok: false, msg: "Cần ít nhất 10 quan làm vốn." };
  p.tien -= 10;
  p.theLuc -= 15;
  const amMuuBonus = state._amMuuBonus || 1.0;
  let catchRate = Math.max(0.05, 0.30 - p.muuMeo * 0.01) / amMuuBonus;
  if (p._patronClanId && (p.rank === PlayerRank.DAN_THUONG || p.rank === PlayerRank.PHU_HO)) {
    const preset = getClanPressurePreset(state);
    catchRate *= preset.smuggleCatchMul;
  }
  if (rng(state) < catchRate) {
    p.trongSoDenLy = true;
    logLine(state, "Bị tuần tráng phát hiện! Bị tịch thu tiền muối và ghi vào sổ bìa đen.");
    return { ok: true, shake: true, sfx: "caiVa" };
  }
  let gained = randInt(20, 45);
  gained = Math.floor(gained * (state._quanLyBonus || 1.0));
  p.tien += gained;
  p.quanLy = Math.min(100, p.quanLy + 0.5);
  logLine(state, `Chuyến buôn muối trót lọt, thu về ${gained} quan.`);
  return { ok: true, feedback: [{ text: `+${gained} Quan`, tone: "good" }], sfx: "coin" };
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
  // Slow stat progression: accumulate training; only occasionally convert to +1
  if (typeof p._voTrainAccum !== "number") p._voTrainAccum = 0;
  const gain = (rng(state) < 0.18) ? 2 : 1; // rarely "great session"
  p._voTrainAccum += gain;
  let ups = 0;
  while (p._voTrainAccum >= 4) { p._voTrainAccum -= 4; ups++; }
  if (ups > 0) {
    p.voThuat = Math.min(100, (p.voThuat || 0) + ups);
    logLine(state, `Khổ luyện có ngày. Võ Thuật +${ups}.`);
    return { ok: true, feedback: [{ text: `+${ups} Võ Thuật`, tone: "good" }, { text: "-30 TL", tone: "bad" }], sfx: "battle" };
  }
  logLine(state, "Mồ hôi đổ xuống đất. Võ đạo tiến rất chậm, cần tích lũy lâu dài.");
  return { ok: true, feedback: [{ text: "Tiến bộ (tích lũy)", tone: "good" }, { text: "-30 TL", tone: "bad" }], sfx: "murmur" };
}

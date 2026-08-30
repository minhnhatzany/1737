import { initSeed, seedRng, rng, rngInt, randInt, rngChance, rngChoice } from "./core/rng.js";
import { expireInbox, inboxFull } from "./core/inbox.js";
import { makeSeat, scopeKey, SeatLegitimacy, seatIdForXa, rollLyTruongProfile, syncRankFromSeats } from "./core/seats.js";
import { rollXaClans, clanIdForXa } from "./core/clans.js";
import { rollXaShops, SHOP_LABEL, rollShopOwner, SHOP_VACANT_FILL_DAYS } from "./core/shops.js";
import { actionMoCuaHang } from "./actions/shops.js";
import { detachJob } from "./core/employment.js";
import { actionThueNguoi, actionSaThai } from "./actions/employment.js";
import { LOC_PLOTS_BY_TITLE } from "./core/farm.js";
import { actionXinCongDien, actionMuaRuongTu } from "./actions/farm.js";
export { initSeed, seedRng, rng, rngInt, randInt, rngChance, rngChoice } from "./core/rng.js";
import { actionDemolishNha, actionRecruitMaa, actionXayNha } from "./actions/property.js";
import { actionMuaCongCu } from "./actions/capital.js";
import { CAPITAL_WEAR_PER_MONTH } from "./core/capital.js";
import { completeQuest, ensureQuestState, initQuestsIfNeeded, makeQuestStarterPack, questProgressText, refreshQuestsYearly, tickQuests } from "./quests.js";
import { actionPrisonerExecute, actionPrisonerRansom, actionPrisonerRelease, actionRebelAidPeople, actionRebelBurnYamen, actionRebelRaidSupply, actionRebelRecruitLocal, actionRebelTrain, addPrisoner } from "./actions/rebel.js";
import { actionAssumeOfficeHere, actionLocalBribeSuperior, actionLocalCollectTax, actionLocalEmbezzle, actionLocalFund, actionLocalLevy, actionLocalPacify, actionLocalPatrol, actionLocalRecruitMaa, actionPostingBuild, resolveCase } from "./actions/office.js";
import { actionAcceptMarketContract, actionMarketHaggle, actionTradeItem, ensureMarketSceneState, getMarketSceneBrief, getMerchantProgress, getTradeQuote, rollMonthlyMarketScene } from "./actions/market.js";
import { actionBuonLauMuoi, actionCauCaSong, actionCayRuong, actionChanNuoiLon, actionChatGo, actionDanhBatVenBien, actionDetVai, actionKhaiThacDacSan, actionLuyenVo, actionMoBinh, actionNauRuou, actionNghiAnCom, collapseFromExhaustion } from "./actions/livelihood.js";
import { actionAdvanceClanMissionIntel, actionBeginClanMission, actionChooseClanPatron, actionClanMediate, actionClanMischief, actionDropClanPatron, actionExecuteClanMission, actionSetClanPressureMode, adjustClanMembersOpinion, adjustClanStatus, clanSurname, localClanIds, maybeAddClanRivalryCase, maybeAddSeatContestCase, pickXaSeatSuccessorClan, syncSeatContestants, tickClanPressureForCommoner, tickLocalClansMonthly, tickXaClanStatusMonthly, xaClanIds } from "./actions/clan.js";
import {
  Person, Clan, Village,
  PlayerRank, Gender, ClanAttitude, Faction, NpcTrait, RegionId, MenAtArmType,
  HoldingType, LangNames, getDynastyInfo, RankLabel, totalPops
} from "./models.js";
import { Weather, rollWeather, rollPersonalHarvestThoc } from "./weather.js";
import { checkHistoricalEvents } from "./history.js";
import { tickLifestyle } from "./lifestyle.js";
import { logLine } from "./log.js";
import { getLowerRegions, getRegion, getBattleState, getAllRegions, getPhu, getHuyen } from "./map_data.js";
import { simulateBattle } from "./warfare.js";
export { logLine };

export { RegionId };

/** Chuẩn hóa cờ phe trên xã/tổng (save cũ, clone JSON, hoặc chuỗi lệch khiến so sánh với Faction sai). */
function normalizeLowerGeoFaction(raw) {
  const s = String(raw == null ? "" : raw).trim().toLowerCase();
  if (s === Faction.NGHIA_QUAN) return Faction.NGHIA_QUAN;
  if (s === Faction.TRUNG_LAP) return Faction.TRUNG_LAP;
  if (s === Faction.TRIEU_DINH) return Faction.TRIEU_DINH;
  return Faction.TRIEU_DINH;
}

export function repairGeoCacheFactionFlagsForHuyen(state, huyenId) {
  if (!state?._geoCache || !huyenId) return;
  const geo = state._geoCache[huyenId];
  if (!geo?.tong) return;
  for (const t of Object.values(geo.tong)) {
    t.control = normalizeLowerGeoFaction(t.control);
    for (const x of Object.values(t.xa || {})) {
      x.control = normalizeLowerGeoFaction(x.control);
    }
  }
}

/** Gọi sau load save: sửa mọi xã/tổng trong cache địa lý cấp dưới. */
export function repairGeoCacheFactionFlags(state) {
  if (!state?._geoCache || typeof state._geoCache !== "object") return;
  for (const hid of Object.keys(state._geoCache)) {
    repairGeoCacheFactionFlagsForHuyen(state, hid);
  }
}

function hasPerk(state, perkId) {
  return !!state?.player?.lifestylePerks?.[perkId];
}
function perkFx(state, key, fallback = null) {
  const fx = state?.player?.perkFx;
  if (!fx) return fallback;
  return (key in fx) ? fx[key] : fallback;
}

// ================= QUESTS ================= //
function ymKey(state) {
  return `${state.ban}-${state.monthIndex}`;
}

function pushCelebration(state, title, body, sfx = "coin", extra = null) {
  ensureQuestState(state);
  const tone = extra && typeof extra === "object" && extra.tone ? extra.tone : null;
  state.uiCelebrations.push({ title, body, sfx, tone });
}

export const RegionsDb = {
  [RegionId.THANG_LONG]: { name: "Kinh thành Thăng Long", spec: "Giao Thương",       pm: { thoc: 3.0, muoi: 2.0, go: 2.5, lua: 3.0, ruou: 2.0, ca: 1.8, thit_lon: 2.2 } },
  [RegionId.SON_NAM]:    { name: "Trấn Sơn Nam",        spec: "Lụa / Lúa Gạo",    pm: { thoc: 0.8, muoi: 1.2, go: 1.5, lua: 0.5, ruou: 1.0, ca: 1.1, thit_lon: 0.9 } },
  [RegionId.HAI_DUONG]:  { name: "Trấn Hải Dương",      spec: "Muối Biển",         pm: { thoc: 1.3, muoi: 0.4, go: 1.2, lua: 1.2, ruou: 1.0, ca: 0.7, thit_lon: 1.2 } },
  [RegionId.SON_TAY]:    { name: "Trấn Sơn Tây",        spec: "Quặng / Gỗ",        pm: { thoc: 1.5, muoi: 1.5, go: 0.5, lua: 1.5, ruou: 1.5, ca: 1.4, thit_lon: 1.3 } },
  [RegionId.KINH_BAC]:   { name: "Trấn Kinh Bắc",       spec: "Nho Giáo / Lụa",   pm: { thoc: 1.2, muoi: 1.2, go: 1.0, lua: 1.0, ruou: 1.0, ca: 1.0, thit_lon: 1.0 } },
  [RegionId.AN_QUANG]:   { name: "Trấn An Quảng",       spec: "Hải Sản / Than",    pm: { thoc: 1.8, muoi: 0.6, go: 0.8, lua: 2.0, ruou: 1.3, ca: 0.45, thit_lon: 1.35 } },
  [RegionId.TUYEN_QUANG]:{ name: "Trấn Tuyên Quang",     spec: "Thủy Lô / Biên",    pm: { thoc: 1.4, muoi: 1.3, go: 1.1, lua: 1.2, ruou: 1.4, ca: 1.2, thit_lon: 1.1 } },
  [RegionId.HUNG_HOA]:   { name: "Trấn Hưng Hóa",       spec: "Sơn Cước / Thổ Ty", pm: { thoc: 1.2, muoi: 1.4, go: 1.3, lua: 1.0, ruou: 1.2, ca: 1.0, thit_lon: 1.0 } },
  [RegionId.LANG_SON]:   { name: "Trấn Lạng Sơn",       spec: "Ải Quan / Mậu",     pm: { thoc: 1.5, muoi: 1.1, go: 1.0, lua: 1.1, ruou: 1.0, ca: 1.0, thit_lon: 1.0 } },
  [RegionId.THAI_NGUYEN]:{ name: "Trấn Thái Nguyên",    spec: "Ninh Sóc / Than",   pm: { thoc: 1.6, muoi: 1.2, go: 1.4, lua: 1.3, ruou: 1.1, ca: 1.0, thit_lon: 1.0 } },
  [RegionId.CAO_BINH]:   { name: "Trấn Cao Bình",       spec: "Biên Thùy",         pm: { thoc: 1.1, muoi: 1.3, go: 1.0, lua: 1.0, ruou: 1.0, ca: 0.9, thit_lon: 0.95 } },
  [RegionId.THANH_HOA]:  { name: "Trấn Thanh Hóa",      spec: "Thanh Địa / Võ",    pm: { thoc: 1.0, muoi: 1.0, go: 1.2, lua: 0.9, ruou: 1.1, ca: 1.0, thit_lon: 1.0 } },
  [RegionId.NGHE_AN]:    { name: "Trấn Nghệ An",        spec: "Thanh – Nghệ",      pm: { thoc: 1.1, muoi: 1.0, go: 1.1, lua: 1.0, ruou: 1.2, ca: 1.1, thit_lon: 1.0 } },
};

export const ItemsDb = {
  thoc: { name: "Thùng Thóc",       basePrice: 1.5  },
  ruou: { name: "Bầu Nếp Đào",      basePrice: 15.0 },
  muoi: { name: "Gánh Muối",        basePrice: 10.0 },
  go:   { name: "Khối Gỗ",          basePrice: 20.0 },
  lua:  { name: "Tấm Lụa",          basePrice: 35.0 },
  ca:   { name: "Giỏ Cá",           basePrice: 12.0 },
  thit_lon: { name: "Mẻ Thịt Lợn",  basePrice: 24.0 },
};

export const DAYS_PER_MONTH = 30;

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

/** Chuẩn hoá save cũ: ledger + snap morale/lương. */


const HO_NAMES  = ["Nguyễn","Trần","Lê","Phạm","Hoàng","Phan","Vũ","Đặng","Bùi","Đỗ"];
const TEN_DEM   = ["Văn","Công","Minh","Quốc","Hữu","Đình","Thế","Kim"];
const TEN_DEM_NU= ["Thị","Ngọc","Kiều","Diệu"];
const TEN       = ["Khiêm","Nhân","Trung","Thành","Lợi","Tuấn","Dũng","Tú","Hùng","An"];
const TEN_NU    = ["Yến","Lan","Hoa","Cúc","Quỳnh","Thương","Ngân","Mai","Linh"];

function randomVietName(isMale) {
  const ho  = HO_NAMES[randInt(0,HO_NAMES.length-1)];
  const dem = isMale ? TEN_DEM[randInt(0,TEN_DEM.length-1)] : TEN_DEM_NU[randInt(0,TEN_DEM_NU.length-1)];
  const ten = isMale ? TEN[randInt(0,TEN.length-1)] : TEN_NU[randInt(0,TEN_NU.length-1)];
  return `${ho} ${dem} ${ten}`;
}

function randomVietNameByHo(ho, isMale) {
  const safeHo = (ho && String(ho).trim()) || HO_NAMES[randInt(0, HO_NAMES.length - 1)];
  const dem = isMale ? TEN_DEM[randInt(0, TEN_DEM.length - 1)] : TEN_DEM_NU[randInt(0, TEN_DEM_NU.length - 1)];
  const ten = isMale ? TEN[randInt(0, TEN.length - 1)] : TEN_NU[randInt(0, TEN_NU.length - 1)];
  return `${safeHo} ${dem} ${ten}`;
}

// =============================================
// DANH MỤC BẤT ĐỘNG SẢN ĐẠI TU (40+ loại)
// =============================================
export const PropertyCategories = [
  { id: "nha_o",      name: "🏠 Nhà Ở",           icon: "🏠" },
  { id: "thuong_mai", name: "🏪 Thương Mại",       icon: "🏪" },
  { id: "hoc_thuat",  name: "🎓 Học Thuật",        icon: "🎓" },
  { id: "quan_su",    name: "⚔️ Quân Sự",          icon: "⚔️" },
  { id: "nong_nghiep",name: "🌾 Nông Nghiệp",      icon: "🌾" },
  { id: "thu_cong",   name: "🔧 Thủ Công Nghiệp",  icon: "🔧" },
  { id: "tam_linh",   name: "🛕 Tâm Linh",         icon: "🛕" },
];

export const PropertyDb = {
  // ── NHÀ Ở ─────────────────────────────────────────────────────────
  LEU_CO: {
    id:"leu_co", category:"nha_o", name:"Lều Cỏ", cost:500, upgradeCost:1000, maxLevel:1,
    desc:"Mái lá che đơn sơ.",
    effectDesc: "Mỗi tháng hồi +5 Thể lực khi ngủ tại nhà.",
    buffs:[[["theLucRegen",5]]],
    unlockCondition: {},
  },
  NHA_TRANH: {
    id:"nha_tranh", category:"nha_o", name:"Nhà Tranh Vách Đất", cost:1500, upgradeCost:3000, maxLevel:2,
    desc:"Che mưa che nắng tốt hơn lều cỏ.",
    effectDesc: "Cấp 1: +8 TL/tháng. Cấp 2: +8 TL + +5 Uy tín/tháng.",
    buffs:[[["theLucRegen",8]], [["theLucRegen",8],["uyTinMon",5]]],
    unlockCondition: { require: "leu_co" },
  },
  NHA_NGOI: {
    id:"nha_ngoi", category:"nha_o", name:"Nhà Ngói Ba Gian", cost:5000, upgradeCost:8000, maxLevel:3,
    desc:"Nhà ngói đàng hoàng, nâng uy tín làng xã.",
    effectDesc: "+10 TL/tháng, +mức uy tín hàng tháng tăng dần theo cấp.",
    buffs:[[["theLucRegen",10],["uyTinMon",10]], [["theLucRegen",12],["uyTinMon",20]], [["theLucRegen",15],["uyTinMon",30]]],
    unlockCondition: { require: "nha_tranh" },
  },
  BIET_THU: {
    id:"biet_thu", category:"nha_o", name:"Biệt Thự Quan Lại", cost:20000, upgradeCost:40000, maxLevel:2,
    desc:"Sân rộng tường cao, phòng khách sang trọng.",
    effectDesc: "Mỗi tháng: +15 TL, +30 Uy tín, +50 Danh Vọng.",
    buffs:[[["theLucRegen",15],["uyTinMon",30],["danhVongMon",50]], [["theLucRegen",20],["uyTinMon",50],["danhVongMon",100]]],
    unlockCondition: { minSeatRank: PlayerRank.TRI_HUYEN }, // gate kiểm GHẾ thật (occupantId), không kiểm p.rank cache
  },
  PHU_DE: {
    id:"phu_de", category:"nha_o", name:"Phủ Đệ Đại Quan", cost:80000, upgradeCost:150000, maxLevel:2,
    desc:"Phủ đệ uy nghiêm, đại quan mới xứng.",
    effectDesc: "+25 TL/tháng, +100 Uy tín, +200 Quan/tháng từ tô thuế.",
    buffs:[[["theLucRegen",25],["uyTinMon",100],["tienMon",200]], [["theLucRegen",30],["uyTinMon",150],["tienMon",500]]],
    unlockCondition: { minRank: PlayerRank.HIEN_SAT_SU }, // minRank: bậc chưa có ghế thực thể — chuyển kiểm ghế khi "AI dùng ghế thật"
  },

  // ── THƯƠNG MẠI ─────────────────────────────────────────────────────
  QUAN_HANG: {
    id:"quan_hang", category:"thuong_mai", name:"Quán Hàng Nhỏ", cost:1000, upgradeCost:2000, maxLevel:2,
    desc:"Bày biện hàng hóa bán lẻ.",
    effectDesc: "+10 Quan/tháng (cấp 1), +20 Quan (cấp 2).",
    buffs:[[["tienMon",10]], [["tienMon",20]]],
    unlockCondition: {},
  },
  TUU_LAU: {
    id:"tuu_lau", category:"thuong_mai", name:"Tửu Lâu Tầng Đôi", cost:8000, upgradeCost:15000, maxLevel:3,
    desc:"Quán nhậu sang, thương nhân tụ hội.",
    effectDesc: "+30/+70/+120 Quan/tháng và +5 Ngoại Giao mỗi cấp.",
    buffs:[[["tienMon",30]], [["tienMon",70]], [["tienMon",120],["ngoaiGiaoMon",1]]],
    unlockCondition: {},
  },
  KHO_HANG: {
    id:"kho_hang", category:"thuong_mai", name:"Nhà Kho Hàng Hóa", cost:3000, upgradeCost:6000, maxLevel:3,
    desc:"Kho dự trữ tăng sức chứa hàng hóa.",
    effectDesc: "Tăng tối đa hàng tồn kho lên 50/100/200 mỗi loại.",
    buffs:[[["khoBonus",50]], [["khoBonus",100]], [["khoBonus",200]]],
    unlockCondition: {},
  },
  VUA_THOC: {
    id:"vua_thoc", category:"thuong_mai", name:"Vựa Thóc Dự Trữ", cost:4000, upgradeCost:8000, maxLevel:3,
    desc:"Kho chứa thóc lớn, bán khi giá cao.",
    effectDesc: "+15 Thóc/tháng và bán thóc giá tốt hơn 10% mỗi cấp.",
    buffs:[[["thocMon",15]], [["thocMon",30]], [["thocMon",50]]],
    unlockCondition: {},
  },
  THUONG_DIEM: {
    id:"thuong_diem", category:"thuong_mai", name:"Thương Điếm Lớn", cost:30000, upgradeCost:60000, maxLevel:2,
    desc:"Cơ sở buôn bán quy mô lớn giữa các trấn.",
    effectDesc: "+200 Quan/tháng và mở rộng mạng lưới thương mại.",
    buffs:[[["tienMon",200]], [["tienMon",400]]],
    unlockCondition: { minRank: PlayerRank.PHU_HO, lifestylePoints: 3 }, // PHU_HO = dân giàu, KHÔNG phải quan — cố ý, không đổi
  },

  // ── HỌC THUẬT ──────────────────────────────────────────────────────
  THU_PHONG: {
    id:"thu_phong", category:"hoc_thuat", name:"Thư Phòng Nhỏ", cost:1000, upgradeCost:2000, maxLevel:2,
    desc:"Căn phòng có giá sách và đèn đọc.",
    effectDesc: "+1 Học Vấn mỗi 3 tháng tự động.",
    buffs:[[["hocVanAccum",1]], [["hocVanAccum",2]]],
    unlockCondition: {},
  },
  HOC_DUONG: {
    id:"hoc_duong", category:"hoc_thuat", name:"Học Đường Địa Phương", cost:5000, upgradeCost:10000, maxLevel:3,
    desc:"Trường học nhỏ trong làng, đào tạo học trò.",
    effectDesc: "+1 Học Vấn/tháng + +10 Uy tín/tháng từ giáo dục.",
    buffs:[[["hocVanMon",1],["uyTinMon",10]], [["hocVanMon",1],["uyTinMon",20]], [["hocVanMon",2],["uyTinMon",30]]],
    unlockCondition: {},
  },
  VAN_MIEU: {
    id:"van_mieu", category:"hoc_thuat", name:"Văn Miếu Gia Thờ", cost:20000, upgradeCost:40000, maxLevel:2,
    desc:"Thờ Khổng Tử và tiên hiền, học thuật đỉnh cao.",
    effectDesc: "+15 Uy tín/tháng, +2 Học Vấn/tháng, thi cử tỉ lệ cao hơn.",
    buffs:[[["uyTinMon",15],["hocVanMon",2]], [["uyTinMon",30],["hocVanMon",3]]],
    unlockCondition: { minSeatRank: PlayerRank.TRI_HUYEN }, // gate kiểm GHẾ thật (occupantId), không kiểm p.rank cache
  },
  THAI_HOC_VIEN: {
    id:"thai_hoc_vien", category:"hoc_thuat", name:"Thái Học Viện Riêng", cost:100000, upgradeCost:0, maxLevel:1,
    desc:"Học viện bậc cao ngang ngửa Quốc Tử Giám.",
    effectDesc: "+3 Học Vấn/tháng, +50 Uy tín/tháng, thu học phí 100 Quan/tháng.",
    buffs:[[["hocVanMon",3],["uyTinMon",50],["tienMon",100]]],
    unlockCondition: { minRank: PlayerRank.THUONG_THU }, // minRank: bậc chưa có ghế thực thể — chuyển kiểm ghế khi "AI dùng ghế thật"
  },

  // ── QUÂN SỰ ────────────────────────────────────────────────────────
  KHO_VU_KHI: {
    id:"kho_vu_khi", category:"quan_su", name:"Kho Vũ Khí Nhỏ", cost:2000, upgradeCost:4000, maxLevel:2,
    desc:"Cất giữ vũ khí và giáp trụ.",
    effectDesc: "Quân đội của bạn +5% sức chiến đấu mỗi cấp.",
    buffs:[[["quanBuff",0.05]], [["quanBuff",0.10]]],
    unlockCondition: { minRank: PlayerRank.DOI_TRUONG }, // minRank: bậc chưa có ghế thực thể — chuyển kiểm ghế khi "AI dùng ghế thật"
  },
  DOANH_TRAI: {
    id:"doanh_trai", category:"quan_su", name:"Doanh Trại Hương Dũng", cost:5000, upgradeCost:10000, maxLevel:3,
    desc:"Trại binh giữ quân kỷ luật.",
    effectDesc: "Giảm 10/20/30% chi phí lương lính hàng tháng.",
    buffs:[[["luongGiam",0.10]], [["luongGiam",0.20]], [["luongGiam",0.30]]],
    unlockCondition: { minRank: PlayerRank.DOI_TRUONG }, // minRank: bậc chưa có ghế thực thể — chuyển kiểm ghế khi "AI dùng ghế thật"
  },
  LUYEN_BINH_TRUONG: {
    id:"luyen_binh_truong", category:"quan_su", name:"Điểm Luyện Binh", cost:8000, upgradeCost:15000, maxLevel:3,
    desc:"Thao trường luyện binh ngày ngày.",
    effectDesc: "+1 Võ Thuật tự động mỗi 2 tháng.",
    buffs:[[["voThuatAccum",1]], [["voThuatAccum",2]], [["voThuatAccum",3]]],
    unlockCondition: { minRank: PlayerRank.CAI_CO }, // minRank: bậc chưa có ghế thực thể — chuyển kiểm ghế khi "AI dùng ghế thật"
  },
  PHAO_DAI: {
    id:"phao_dai", category:"quan_su", name:"Pháo Đài Tường Thành", cost:30000, upgradeCost:60000, maxLevel:2,
    desc:"Công sự phòng thủ vững chắc.",
    effectDesc: "Phòng thủ khi bị tấn công gấp đôi, NPC địch không dám dễ dàng đột kích.",
    buffs:[[["phongThuBuff",2.0]], [["phongThuBuff",3.0]]],
    unlockCondition: { minRank: PlayerRank.BACH_HO }, // minRank: bậc chưa có ghế thực thể — chuyển kiểm ghế khi "AI dùng ghế thật"
  },
  DAI_DOANH: {
    id:"dai_doanh", category:"quan_su", name:"Đại Doanh Tổng Lĩnh", cost:80000, upgradeCost:150000, maxLevel:2,
    desc:"Đại bản doanh chỉ huy toàn quân — chỉ dành cho Đô Đốc trở lên.",
    effectDesc: "Tất cả Quân đội +20% chiến lực, bổ nhậm tướng tá dễ dàng hơn.",
    buffs:[[["quanBuff",0.20]], [["quanBuff",0.35]]],
    unlockCondition: { minRank: PlayerRank.DO_DOC }, // minRank: bậc chưa có ghế thực thể — chuyển kiểm ghế khi "AI dùng ghế thật"
  },
  THUY_DOANH: {
    id:"thuy_doanh", category:"quan_su", name:"Thủy Doanh Ven Sông", cost:40000, upgradeCost:80000, maxLevel:2,
    desc:"Căn cứ thủy quân, tàu thuyền sẵn chiến.",
    effectDesc: "+Thủy Quân hàng tháng, di chuyển giữa trấn ven sông không tốn thể lực.",
    buffs:[[["thuyQuanMon",10]], [["thuyQuanMon",25]]],
    unlockCondition: { minRank: PlayerRank.TONG_LINH }, // minRank: bậc chưa có ghế thực thể — chuyển kiểm ghế khi "AI dùng ghế thật"
  },

  // ── NÔNG NGHIỆP ─────────────────────────────────────────────────────
  MANG_NUOC: {
    id:"mang_nuoc", category:"nong_nghiep", name:"Máng Nước Tưới Ruộng", cost:800, upgradeCost:1500, maxLevel:2,
    desc:"Kênh mương dẫn nước vào ruộng.",
    effectDesc: "+10 Thóc/tháng (cấp 1), +20 Thóc/tháng (cấp 2).",
    buffs:[[["thocMon",10]], [["thocMon",20]]],
    unlockCondition: {},
  },
  DONG_RUONG: {
    id:"dong_ruong", category:"nong_nghiep", name:"Mở Rộng Đồng Ruộng", cost:2000, upgradeCost:4000, maxLevel:3,
    desc:"Khai phá đất hoang thêm ruộng cấy.",
    effectDesc: "+15/+25/+40 Thóc/tháng.",
    buffs:[[["thocMon",15]], [["thocMon",25]], [["thocMon",40]]],
    unlockCondition: {},
  },
  KHO_THOC: {
    id:"kho_thoc", category:"nong_nghiep", name:"Kho Thóc Kiên Cố", cost:3000, upgradeCost:6000, maxLevel:3,
    desc:"Kho chứa thóc an toàn khỏi chuột và mưa.",
    effectDesc: "Bảo quản tốt hơn, không bị mất thóc do thiên tai.",
    buffs:[[["baoveTTGian",1]], [["baoveTTGian",2]], [["baoveTTGian",3]]],
    unlockCondition: {},
  },
  LO_XAY: {
    id:"lo_xay", category:"nong_nghiep", name:"Lò Xay Lúa", cost:5000, upgradeCost:10000, maxLevel:2,
    desc:"Xay thóc thành gạo bán được giá cao hơn.",
    effectDesc: "+20% giá bán thóc trên chợ.",
    buffs:[[["thocPriceBuff",1.20]], [["thocPriceBuff",1.40]]],
    unlockCondition: {},
  },
  AO_CA: {
    id:"ao_ca", category:"nong_nghiep", name:"Ao Cá Tôm", cost:1500, upgradeCost:3000, maxLevel:3,
    desc:"Ao nuôi cá tôm thêm nguồn thực phẩm.",
    effectDesc: "+5/+10/+15 Quan/tháng từ bán cá.",
    buffs:[[["tienMon",5]], [["tienMon",10]], [["tienMon",15]]],
    unlockCondition: {},
  },

  // ── THỦ CÔNG NGHIỆP ─────────────────────────────────────────────────
  LO_REN: {
    id:"lo_ren", category:"thu_cong", name:"Lò Rèn Vũ Khí", cost:4000, upgradeCost:8000, maxLevel:3,
    desc:"Rèn đao kiếm và giáp trụ, bán được giá tốt.",
    effectDesc: "+20/+40/+70 Quan/tháng, quân ta dùng vũ khí tốt +5% sức chiến đấu.",
    buffs:[[["tienMon",20]], [["tienMon",40]], [["tienMon",70],["quanBuff",0.05]]],
    unlockCondition: {},
  },
  XUONG_DET: {
    id:"xuong_det", category:"thu_cong", name:"Xưởng Dệt Lụa", cost:6000, upgradeCost:12000, maxLevel:3,
    desc:"Kéo tơ dệt lụa Sơn Nam chất lượng.",
    effectDesc: "+1/+2/+3 Tấm Lụa/tháng tự động.",
    buffs:[[["luaMonth",1]], [["luaMonth",2]], [["luaMonth",3]]],
    unlockCondition: { region: RegionId.SON_NAM },
  },
  XUONG_GO: {
    id:"xuong_go", category:"thu_cong", name:"Xưởng Gỗ Mộc", cost:3500, upgradeCost:7000, maxLevel:3,
    desc:"Xẻ gỗ đóng bàn ghế và thuyền bè.",
    effectDesc: "+1/+2/+3 Khối Gỗ/tháng tự động.",
    buffs:[[["goMonth",1]], [["goMonth",2]], [["goMonth",3]]],
    unlockCondition: { region: RegionId.SON_TAY },
  },
  LO_GON: {
    id:"lo_gon", category:"thu_cong", name:"Lò Gốm Sứ", cost:4500, upgradeCost:9000, maxLevel:2,
    desc:"Nung gốm sứ bán cho thương nhân.",
    effectDesc: "+25/+50 Quan/tháng, tặng tác phẩm cho quan lại tăng cảm tình.",
    buffs:[[["tienMon",25]], [["tienMon",50],["npcOpinionMon",5]]],
    unlockCondition: {},
  },

  // ── TÂM LINH ─────────────────────────────────────────────────────────
  MIEU_THO: {
    id:"mieu_tho", category:"tam_linh", name:"Miếu Thờ Thổ Địa", cost:1000, upgradeCost:2000, maxLevel:2,
    desc:"Thờ thổ địa cầu bình an.",
    effectDesc: "+5/+10 Uy tín/tháng, thiên tai giảm 10% tác hại.",
    buffs:[[["uyTinMon",5]], [["uyTinMon",10]]],
    unlockCondition: {},
  },
  CHUA_PHAT: {
    id:"chua_phat", category:"tam_linh", name:"Am Phật Cầu Phúc", cost:5000, upgradeCost:10000, maxLevel:3,
    desc:"Chùa nhỏ dựng trên đất gia tộc.",
    effectDesc: "+15/+25/+40 Uy tín/tháng và giảm bất ổn làng.",
    buffs:[[["uyTinMon",15]], [["uyTinMon",25],["unrestGiam",3]], [["uyTinMon",40],["unrestGiam",5]]],
    unlockCondition: {},
  },
  TU_DUONG: {
    id:"tu_duong", category:"tam_linh", name:"Từ Đường Gia Tộc", cost:15000, upgradeCost:30000, maxLevel:2,
    desc:"Nhà thờ họ uy nghi, tôn vinh tổ tiên.",
    effectDesc: "+25/+50 Danh Vọng/tháng và con cái kế thừa +5 Học Vấn.",
    buffs:[[["danhVongMon",25]], [["danhVongMon",50]]],
    unlockCondition: {},
  },
  VAN_CHI: {
    id:"van_chi", category:"tam_linh", name:"Văn Chỉ Tế Lễ Thánh Hiền", cost:25000, upgradeCost:0, maxLevel:1,
    desc:"Tế lễ sĩ phu địa phương, thờ Khổng Mạnh.",
    effectDesc: "+30 Uy tín/tháng, Học Vấn tăng +1 mỗi học kỳ tế lễ.",
    buffs:[[["uyTinMon",30],["hocVanAccum",1]]],
    unlockCondition: { minRank: PlayerRank.TRI_PHU }, // minRank: bậc chưa có ghế thực thể — chuyển kiểm ghế khi "AI dùng ghế thật"
  },
};

export function createInitialState(playerName = "Vô Danh", seed = null) {
  const rngSeed = initSeed(seed !== null ? seed : Date.now());
  const rngState = rngSeed;
  seedRng(rngSeed);
  const clans = [
    new Clan({ name: "Họ Nguyễn", quyenLuc: 80, ruongDat: 24, trungThanh: 55 }),
    new Clan({ name: "Họ Trần",   quyenLuc: 65, ruongDat: 18, trungThanh: 48 }),
    new Clan({ name: "Họ Phạm",   quyenLuc: 45, ruongDat: 12, trungThanh: 62 }),
  ];

  const npcs = [];
  clans.forEach(clan => {
    let n = randInt(2, 4);
    for (let i = 0; i < n; i++) {
      let isMale = rng() < 0.6;
      let traitList = Object.values(NpcTrait);
      let npcTraits = [traitList[randInt(0, traitList.length-1)]];
      const npc = new Person({
        name: randomVietNameByHo(clanSurname(clan.name), isMale),
        gender: isMale ? Gender.NAM : Gender.NU,
        age: randInt(16, 50),
        clanId: clan.id,
        disposition: npcTraits,
        uyTinCong: randInt(2, 20),
        isAI: true,
        tien: randInt(5, 50),
        currentRegion: RegionId.SON_NAM,
      });
      npcs.push(npc);
      clan.memberIds.push(npc.id);
    }
  });

  const player = new Person({ name: playerName, isAI: false, id: "player" });
  // T3.0: khoá spawn về phủ Quảng Oai (trấn Sơn Tây) — 3 huyện viết tay.
  // Chọn huyện khởi điểm bằng STREAM RNG RIÊNG (seed = hash "spawn:<rngSeed>"),
  // không tiêu draw của state.rngState / fallback chính -> việc CHỌN huyện không
  // làm lệch world-gen. Dữ liệu 41 huyện khác trong map_data giữ nguyên, chỉ giới
  // hạn nguồn random ở đây.
  const QUANG_OAI_HUYEN = ["bat_bat", "tien_phong", "minh_nghia"];
  const spawnRngState = { rngState: initSeed("spawn:" + rngSeed) };
  const spawnRegion = getRegion(RegionId.SON_TAY);
  const spawnPhu = spawnRegion?.phu?.quang_oai;
  const spawnHuyenId = QUANG_OAI_HUYEN[rngInt(spawnRngState, 0, QUANG_OAI_HUYEN.length - 1)];
  const spawnHuyen = spawnPhu?.huyen?.[spawnHuyenId];
  if (spawnRegion?.id && spawnPhu?.id && spawnHuyen?.id) {
    player.homeRegion = spawnRegion.id;
    player.homePhu = spawnPhu.id;
    player.homeHuyen = spawnHuyen.id;
    player.currentRegion = spawnRegion.id;
    player.currentPhu = spawnPhu.id;
    player.currentHuyen = spawnHuyen.id;
  }

  const npcList = npcs.slice();
  const lyTruong  = npcList.splice(randInt(0, npcList.length-1), 1)[0];
  const chanhTong = npcList.splice(randInt(0, npcList.length-1), 1)[0];
  const triHuyen  = npcList.splice(randInt(0, npcList.length-1), 1)[0];

  if (lyTruong)  lyTruong.rank  = PlayerRank.LY_TRUONG;
  if (chanhTong) chanhTong.rank = PlayerRank.CHANH_TONG;
  if (triHuyen)  triHuyen.rank  = PlayerRank.TRI_HUYEN;

  // NOTE: Đại tu state (2026-04): bổ sung các namespace mới (factions/armies/scoreboards/location)
  // nhưng vẫn giữ các field cũ để UI hiện tại không vỡ ngay.
  let state = {
    ban: 1737, monthIndex: 1, gameDay: 1,
    rngSeed, rngState,
    thoiTiet: rollWeather(),
    _weatherForecast: null,
    marketPriceThoc: 1.5,
    uiShakeProfile: false,
    player, clans, npcs,
    npcById:   Object.fromEntries(npcs.map(n => [n.id, n])),
    clanById:  Object.fromEntries(clans.map(c => [c.id, c])),
    officials: {
      lyTruong:  lyTruong  ? lyTruong.id  : null,
      chanhTong: chanhTong ? chanhTong.id : null,
      triHuyen:  triHuyen  ? triHuyen.id  : null,
    },
    seats: {},
    seatsByScope: {},
    shops: {},          // T3.2a: cửa hàng/cơ ngơi — { [shopId]: shop }
    shopsByXa: {},      // T3.2a: index tra ngược — { [xaId]: [shopId, ...] }
    villagesByXa: {},   // T3.3-0: một Village per xã QO — { [xaId]: Village }; state.village trỏ vào đây
    _fallbackVillage: null, // T3.3-0: village dùng chung cho xã ngoài QO (huyện procedural)
    log: [],
    logDirty: false,
    thueDinh: 8, suuDich: 4, trieuThangNop: 15,
    extraVillages: [],
    pendingEvent: null, inbox: [], gameOver: false, gameOverReason: "",
    gameOverType: "lose",
    recentEventIds: [],
    onceDoneEventIds: [],
    marqueeQueue: [],
    _huyenControl: {},
    _huyenGarrisons: {}, // huyenId -> { faction, quan } — quân tách ra giữ đất
    _quanLyBonus: 1.0,
    _quanSuFocus: false,
    _amMuuBonus: 1.0,
    wantedLevel: 0,
    crimeHuyen: null,
    firstRun: true,
    uxFirstPlay: true,
    travel: { active: false, daysLeft: 0, totalDays: 0, dest: null, reason: "" },
    tutorial: { completed: false, track: null, step: 0 },
    prisoners: [],
    _prisonerSeq: 1,
    _capitalSeq: 1,     // T3.2b: bộ đếm id p.capital[] (khuôn _prisonerSeq, không Date.now())
    _buildSeq: 1,       // T3.2c-pre: bộ đếm id p.buildQueue[] (thay Date.now() cũ ở actionXayNha)
    _plotSeq: 1,        // T3.3-2: bộ đếm id p.farmPlots[]
    activity: null,
    _activityUiPulse: 0,
    lastActivityReport: null,
    lastBacCuArchive: null,
    lastVanExamArchive: null,
    _pendingExamResultModal: null,
    postingsByHuyen: {}, // huyenId -> posting (treasury/armies/corruption/tax)
    postingId: null, // current posting huyenId (the jurisdiction you govern)
    postingOrder: null, // active imperial transfer/order (if any)
    reinforcements: [],
    jailDays: 0,
    _campaignYm: null,
    uiSeenTabs: { tabActions: true },
    onboarding: { firstResourceActionDone: false, firstTradeDone: false, firstTravelDone: false, firstFocusDone: false },
    _uxHintsSeen: {},
    _clanQuestStats: { total: 0, trom_ga: 0, pha_vuon: 0, boi_ban: 0, mediate: 0 },
    clanPressureMode: "standard",
    clanFavor: {},
    _delayedEffects: [],
    _clanMission: null,
    victory: { offered: false, chosen: null, nextOfferYm: null },
  };
  for (const c of clans) state.clanFavor[c.id] = 0;

  // Setup Geography
  const geoData = getLowerRegions(state, player.homeHuyen);
  const tongIds = Object.keys(geoData.tong || {});
  const firstTongId = tongIds[randInt(0, Math.max(0, tongIds.length - 1))];
  const firstTong = geoData.tong[firstTongId];
  const xaIds = Object.keys(firstTong?.xa || {});
  const firstXaId = xaIds[randInt(0, Math.max(0, xaIds.length - 1))];
  const firstXa = firstTong.xa[firstXaId];
  const langIds = Object.keys(firstXa?.lang || {});
  const firstLangId = langIds[randInt(0, Math.max(0, langIds.length - 1))];

  // Set Player Geography
  player.homeTong = firstTongId;
  player.homeXa = firstXaId;
  player.homeLang = firstLangId;
  player.currentTong = firstTongId;
  player.currentXa = firstXaId;
  player.currentLang = firstLangId;

  // Canonical location object (keeps exact place down to làng).
  // Adapter: keep old current* fields in sync for existing UI/actions.
  player.location = {
    regionId: player.currentRegion,
    phuId: player.currentPhu,
    huyenId: player.currentHuyen,
    tongId: player.currentTong,
    xaId: player.currentXa,
    langId: player.currentLang,
  };

  // Personal food adapter (future: tách khỏi hậu cần quân chiến dịch).
  if (typeof player.personalFood !== "number") player.personalFood = player.thocCaNhan;

  // T3.3-0: state.village KHÔNG còn là 1 object toàn cục — seed 1 Village per xã QO
  // ở block bên dưới (sau khi có dòng họ cục bộ), rồi trỏ state.village vào xã hiện tại.

  // 2.1d: mở rộng seats ra 27 xã phủ Quảng Oai (địa lý viết tay T2.3).
  // Đọc lyTruong từ map_data; tạo Person(isAI) cho xã có người — chỉ số roll từ
  // stream RNG riêng (rollLyTruongProfile) nên KHÔNG lệch world-gen; xã Vạn Xuân
  // occupantId=null (ghế trống cố ý). Hand-data ở đây chạy TRƯỚC 3 ghế state.officials.
  for (const huyenId of ["bat_bat", "tien_phong", "minh_nghia"]) {
    const geoQO = getLowerRegions(state, huyenId);
    for (const tongQO of Object.values(geoQO.tong || {})) {
      for (const xaQO of Object.values(tongQO.xa || {})) {
        const seatId = seatIdForXa(xaQO.id);
        let occupantId = null;
        if (xaQO.lyTruong) {
          const pf = rollLyTruongProfile(xaQO.id);
          const person = new Person({
            isAI: true, name: xaQO.lyTruong, gender: Gender.NAM, disposition: [],
            age: pf.age, tien: pf.tien, opinion: pf.opinion,
            ngoaiGiao: pf.ngoaiGiao, voThuat: pf.voThuat, quanLy: pf.quanLy,
            muuMeo: pf.muuMeo, hocVan: pf.hocVan,
            currentRegion: RegionId.SON_TAY, currentPhu: "quang_oai",
            currentHuyen: huyenId, currentTong: tongQO.id, currentXa: xaQO.id,
            seatId,
          });
          state.npcs.push(person);
          state.npcById[person.id] = person;
          occupantId = person.id;
        }
        const seat = makeSeat({
          id: seatId, title: PlayerRank.LY_TRUONG, scope: "xa", scopeId: xaQO.id,
          occupantId, appointedDay: 1, legitimacy: SeatLegitimacy.THE_TAP,
        });
        state.seats[seatId] = seat;
        state.seatsByScope[scopeKey("xa", xaQO.id)] = seatId;
        if (occupantId) syncRankFromSeats(state, state.npcById[occupantId]);
      }
    }
  }

  // T3.1a: sinh 2-3 dòng họ cục bộ cho mỗi xã phủ Quảng Oai (nền cho T3.1b/c).
  // Mỗi xã dùng STREAM RNG RIÊNG (rollXaClans, seed = hash "clan:"+xaId) nên KHÔNG
  // lệch world-gen — đúng khuôn rollLyTruongProfile ở trên và T3.0. 3 họ toàn cục
  // (clan_1..3) giữ nguyên làm fallback cho 41 huyện procedural khác. Gán clanId:
  // T3.1b ngay bên dưới.
  for (const huyenId of ["bat_bat", "tien_phong", "minh_nghia"]) {
    const geoQO = getLowerRegions(state, huyenId);
    for (const tongQO of Object.values(geoQO.tong || {})) {
      for (const xaQO of Object.values(tongQO.xa || {})) {
        rollXaClans(xaQO.id).forEach((c, i) => {
          const clan = new Clan({
            id: clanIdForXa(xaQO.id, i), name: c.name,
            quyenLuc: c.quyenLuc, ruongDat: c.ruongDat, trungThanh: c.trungThanh,
            scope: "xa", scopeId: xaQO.id, status: c.status,
          });
          state.clans.push(clan);
          state.clanById[clan.id] = clan;
          state.clanFavor[clan.id] = 0;
        });
      }
    }
  }

  // T3.1b: gán clanId cho lý trưởng đã ngồi ghế cấp xã — thuộc dòng họ mạnh nhất
  // (quyenLuc cao nhất) trong ĐÚNG xã người đó đứng. Chỉ đụng ghế scope="xa" có
  // occupant => đúng 26 lý trưởng Quảng Oai (ghế officials lý trưởng đã bị dedupe;
  // chanh_tong/tri_huyen scope tổng/huyện nên không dính). Không spawn thêm NPC.
  for (const seatId of Object.keys(state.seats)) {
    const seat = state.seats[seatId];
    if (seat.scope !== "xa" || !seat.occupantId) continue;
    const xaClans = state.clans.filter(c => c.scope === "xa" && c.scopeId === seat.scopeId);
    if (xaClans.length === 0) continue;
    const top = xaClans.reduce((a, b) => ((b.quyenLuc || 0) > (a.quyenLuc || 0) ? b : a));
    const occ = state.npcById[seat.occupantId];
    if (occ && occ.clanId == null) {
      occ.clanId = top.id;
      top.memberIds.push(occ.id);
    }
  }

  // T3.1c: điền seat.contestingClanIds cho MỌI ghế xã = dòng họ trong xã đó (status desc).
  // Ghế trống (Vạn Xuân) cũng điền -> pickXaSeatSuccessorClan dùng được ngay để test.
  for (const seatId of Object.keys(state.seats)) {
    if (state.seats[seatId].scope === "xa") syncSeatContestants(state, seatId);
  }

  // T3.3-0: seed 1 Village per xã QO (27). Dữ liệu tất định từ geo (xa.pop) — KHÔNG rng.
  // quyLang/khoThoc scale theo dân (công thức trùng default cũ ~1700 dân: 120/600).
  // clanIds = dòng họ cục bộ xã đó (xaClanIds). state.village trỏ vào xã hiện tại.
  for (const huyenId of ["bat_bat", "tien_phong", "minh_nghia"]) {
    const geoQO = getLowerRegions(state, huyenId);
    for (const tongQO of Object.values(geoQO.tong || {})) {
      for (const xaQO of Object.values(tongQO.xa || {})) {
        const pop = xaQO.pop || 0;
        state.villagesByXa[xaQO.id] = new Village({
          name: xaQO.name, xaId: xaQO.id,
          quyLang: Math.max(40, Math.round(pop * 0.07)),
          khoThoc: Math.max(120, Math.round(pop * 0.35)),
          unrest: 12,
          pops: { nong: Math.max(10, pop), tho: 20, thuong: 5 },
          clanIds: xaClanIds(state, xaQO.id) || [],
          suatDinh: xaQO.suatDinh || Math.floor(pop / 5), // T3.3-2: dùng tính suất công điền
        });
      }
    }
  }
  state.village = villageForXa(state, player.currentXa);

  // T3.2a: seed cửa hàng / cơ ngơi cho 27 xã phủ Quảng Oai (schema + generator, CHƯA
  // action nào đọc). Mỗi xã: slot generic "quán trọ" theo dân số (bỏ trống) + cơ ngơi
  // viết tay nhóm A (xa.cuaHangSeed) có CHỦ AI thuộc dòng họ quyền lực nhất xã. Generator
  // dùng STREAM RNG RIÊNG (rollXaShops, seed = hash "shop:"+xaId) -> KHÔNG lệch world-gen,
  // đúng khuôn rollXaClans / rollLyTruongProfile ở trên. shop.occupantId trỏ Person BẤT KỲ
  // như ghế. Mua/mở/giữ/mất cửa hàng: T3.2c. 41 huyện procedural khác chưa có cửa hàng.
  for (const huyenId of ["bat_bat", "tien_phong", "minh_nghia"]) {
    const geoQO = getLowerRegions(state, huyenId);
    for (const tongQO of Object.values(geoQO.tong || {})) {
      for (const xaQO of Object.values(tongQO.xa || {})) {
        const xaClansHere = state.clans.filter(c => c.scope === "xa" && c.scopeId === xaQO.id);
        const ownerClan = xaClansHere.length
          ? xaClansHere.reduce((a, b) => ((b.quyenLuc || 0) > (a.quyenLuc || 0) ? b : a))
          : null;
        const contestingClanIds = xaClansHere.slice()
          .sort((a, b) => (b.status ?? 0) - (a.status ?? 0))
          .map(c => c.id);
        const specs = rollXaShops(xaQO.id, { pop: xaQO.pop, cuaHangSeed: xaQO.cuaHangSeed });
        const ids = [];
        for (const spec of specs) {
          const shop = {
            id: spec.id, loai: spec.loai, xaId: xaQO.id, scope: "xa",
            seeded: true, level: spec.level,
            occupantId: null, ownerClanId: null,
            incomeBase: spec.incomeBase,
            capitalIds: [],                              // T3.2b
            workerIds: [],                              // T3.2d
            contestingClanIds: contestingClanIds.slice(),
            lastPaidYm: null,                           // T3.2c-1: kỳ trả tô gần nhất
            foundedDay: 1,
            foundingById: null,                        // T3.2c-1: player đang dựng slot này
            foundDaysLeft: 0,                          // T3.2c-1: ngày dựng còn lại
            foundStartedDay: null,
            vacantSinceDay: null,                      // T3.2c-2: mốc bỏ trống (AI lấp)
          };
          if (spec.wantsOwner && ownerClan) {
            const pf = spec.ownerProfile;
            const person = new Person({
              isAI: true, name: clanSurname(ownerClan.name) + " " + spec.ownerGivenName,
              gender: Gender.NAM, disposition: [],
              age: pf.age, tien: pf.tien, opinion: pf.opinion,
              ngoaiGiao: pf.ngoaiGiao, voThuat: pf.voThuat, quanLy: pf.quanLy,
              muuMeo: pf.muuMeo, hocVan: pf.hocVan,
              clanId: ownerClan.id,
              currentRegion: RegionId.SON_TAY, currentPhu: "quang_oai",
              currentHuyen: huyenId, currentTong: tongQO.id, currentXa: xaQO.id,
              shopId: shop.id,
            });
            state.npcs.push(person);
            state.npcById[person.id] = person;
            ownerClan.memberIds.push(person.id);
            shop.occupantId = person.id;
            shop.ownerClanId = ownerClan.id;
          }
          state.shops[shop.id] = shop;
          ids.push(shop.id);
        }
        state.shopsByXa[xaQO.id] = ids;
      }
    }
  }

  // T2.1: dựng 3 ghế từ 3 slot state.officials (officials vẫn sống song song).
  // occupantId trỏ NPC đang giữ (hoặc null). scopeId cấp xã/tổng là id procedural,
  // ổn định trong phiên chơi. Chưa có đường bổ nhiệm/cách chức — bước 2.1c mới đấu nối.
  for (const spec of [
    { id: "seat_ly_truong",  title: PlayerRank.LY_TRUONG,  scope: "xa",    scopeId: player.homeXa,    occupantId: state.officials.lyTruong  },
    { id: "seat_chanh_tong", title: PlayerRank.CHANH_TONG, scope: "tong",  scopeId: player.homeTong,  occupantId: state.officials.chanhTong },
    { id: "seat_tri_huyen",  title: PlayerRank.TRI_HUYEN,  scope: "huyen", scopeId: player.homeHuyen, occupantId: state.officials.triHuyen  },
  ]) {
    // Đã có ghế ở scope này (vd xã Quảng Oai vừa dựng ở trên) -> hand-data thắng, bỏ qua.
    if (state.seatsByScope[scopeKey(spec.scope, spec.scopeId)]) continue;
    const seat = makeSeat({ ...spec, appointedDay: 1, legitimacy: SeatLegitimacy.THE_TAP });
    state.seats[seat.id] = seat;
    state.seatsByScope[scopeKey(seat.scope, seat.scopeId)] = seat.id;
  }

  // New namespaces (hard reset save is acceptable).
  state.factions = {
    trieuDinh: {
      id: Faction.TRIEU_DINH,
      treasury: 250000,
      granary:  200000,
      armies: [],
      leaders: [],
      contribLedger: {}, // actorId -> { merit, kills, intel, sabotage, pacify }
    },
    nghiaQuan: {
      id: Faction.NGHIA_QUAN,
      treasury: 60000,
      granary:  50000,
      armies: [],
      leaders: [],
      contribLedger: {},
    }
  };
  state.armies = []; // Army entities will be introduced in later refactor steps
  state.scoreboards = {
    yearlyMerit: { year: state.ban, entries: [] }, // entries: [{ id, name, faction, merit }]
  };

  initQuestsIfNeeded(state);

  return state;
}

// ================= MERIT / YEARLY TOP 50 ================= //
function ensureYearlyMerit(state) {
  if (!state.scoreboards) state.scoreboards = {};
  if (!state.scoreboards.yearlyMerit) state.scoreboards.yearlyMerit = { year: state.ban || 1737, entries: [] };
  if (state.scoreboards.yearlyMerit.year !== (state.ban || 1737)) {
    state.scoreboards.yearlyMerit = { year: state.ban || 1737, entries: [] };
  }
}

function addMerit(state, actorId, actorName, factionId, delta) {
  ensureYearlyMerit(state);
  const board = state.scoreboards.yearlyMerit;
  const d = Math.max(0, Math.floor(delta || 0));
  if (d <= 0) return;
  const key = `${actorId || actorName || "unknown"}`;
  const ex = board.entries.find(e => e.id === key);
  if (ex) ex.merit += d;
  else board.entries.push({ id: key, name: actorName || key, faction: factionId || "unknown", merit: d });
  board.entries.sort((a, b) => (b.merit || 0) - (a.merit || 0));
  if (board.entries.length > 50) board.entries.length = 50;
}

function resolveYearlyMeritAndReset(state, prevYear) {
  if (!state?.scoreboards?.yearlyMerit) return;
  const board = state.scoreboards.yearlyMerit;
  if (board.year !== prevYear) return;
  const p = state.player;
  const myId = p?.name ? `player:${p.name}` : "player";
  const idx = board.entries.findIndex(e => e.id === myId || e.name === p.name);
  if (idx >= 0) {
    const rank = idx + 1;
    const wanted = (p.wantedLevel || 0) > 0;
    const fac = p.faction;
    if (fac === Faction.TRIEU_DINH && !wanted) {
      const baseQ = Math.max(50, Math.floor(1200 / rank));
      const uy = Math.max(10, Math.floor(220 / rank));
      p.tien += baseQ;
      p.uyTinCong += uy;
      logLine(state, `🏯 LUẬN CÔNG BAN THƯỞNG (${prevYear}): bạn xếp hạng #${rank} (Top 50), thưởng +${baseQ}Q và +${uy} Uy tín.`, true);
      pushCelebration(state, "LUẬN CÔNG BAN THƯỞNG", `Năm ${prevYear}: bạn đứng <strong>#${rank}</strong> công trạng. Thưởng: <strong>+${baseQ}Q</strong> · <strong>+${uy} Uy tín</strong>.`, "coin");
    } else if (fac === Faction.NGHIA_QUAN) {
      const baseQ = Math.max(25, Math.floor(650 / rank));
      const dv = Math.max(8, Math.floor(140 / rank));
      p.tien += baseQ;
      p.danhVong += dv;
      p.uyTinCong += Math.max(5, Math.floor(dv * 0.45));
      logLine(state, `🏴 KHEN CÔNG DOANH (${prevYear}): bạn xếp hạng #${rank} trong nghĩa quân — lương chung +${baseQ}Q, +${dv} Danh vọng.`, true);
      pushCelebration(state, "KHEN CÔNG NGHĨA QUÂN", `Năm ${prevYear}: xếp <strong>#${rank}</strong> · +${baseQ}Q · +${dv} Danh vọng.`, "coin");
    } else {
      const baseQ = Math.max(15, Math.floor(380 / rank));
      p.tien += baseQ;
      logLine(state, `🎖 Thưởng công xếp hạng #${rank} (${prevYear}): +${baseQ}Q.`, false);
    }
  } else if (board.entries.length > 0) {
    // light flavor log only
    const top = board.entries[0];
    logLine(state, `🏯 LUẬN CÔNG (${prevYear}): đứng đầu là ${top.name} (${top.merit} công).`, false);
  }
  // Reset for new year (new board created by ensureYearlyMerit)
  state.scoreboards.yearlyMerit = { year: state.ban || (prevYear + 1), entries: [] };
}

// ================= TRAVEL / MARCHING ================= //
function travelDaysEstimate(from, to, quanSo = 0) {
  // Heuristic: farther administrative jump = more days.
  let days = 1;
  if (!from || !to) return 3;
  if (from.currentRegion !== to.regionId) days += 6;
  if (from.currentPhu !== to.phuId) days += 3;
  if (from.currentHuyen !== to.huyenId) days += 2;
  if (from.currentTong !== to.tongId) days += 1;
  if (from.currentXa !== to.xaId) days += 1;
  // Big armies march slower
  days += Math.floor(Math.max(0, (quanSo || 0) - 500) / 2500);
  return Math.max(1, days);
}

function travelThocPerDay(quanSo = 0) {
  // Very simple logistics. Larger armies consume more.
  return Math.max(1, Math.ceil((quanSo || 0) / 250));
}

export function isTraveling(state) {
  return !!state?.travel?.active;
}

export function startTravel(state, dest, reason = "Hành quân", opts = null) {
  const p = state.player;
  if (p.dangOm) return { ok: false, msg: "Đang ốm liệt giường." };
  if (!dest?.regionId || !dest?.phuId || !dest?.huyenId || !dest?.tongId || !dest?.xaId || !dest?.langId) {
    return { ok: false, msg: "Đích đến không hợp lệ." };
  }
  if (state.travel?.active) return { ok: false, msg: "Đang hành quân rồi." };
  const days = travelDaysEstimate(p, dest, p.quanSo);
  state.travel = {
    active: true,
    daysLeft: days,
    totalDays: days,
    dest,
    reason,
    opts: opts || null,
  };
  logLine(state, `🛤 Bắt đầu hành quân (${days} ngày): ${reason}.`, true);
  return { ok: true, feedback: [{ text: `Hành quân: ${days} ngày`, tone: "good" }], sfx: "murmur" };
}

function arriveTravel(state) {
  const p = state.player;
  const d = state.travel?.dest;
  if (!d) return;
  p.currentRegion = d.regionId;
  p.currentPhu = d.phuId;
  p.currentHuyen = d.huyenId;
  p.currentTong = d.tongId;
  p.currentXa = d.xaId;
  p.currentLang = d.langId;

  // Keep canonical location in sync
  if (!p.location) p.location = {};
  p.location.regionId = p.currentRegion;
  p.location.phuId = p.currentPhu;
  p.location.huyenId = p.currentHuyen;
  p.location.tongId = p.currentTong;
  p.location.xaId = p.currentXa;
  p.location.langId = p.currentLang;

  // T3.3-0: TRỎ state.village sang Village của xã đích — KHÔNG ghi đè field (state xã
  // cũ: unrest/khoThoc/drafted... giữ nguyên, quay lại là còn). Xã ngoài QO -> fallback.
  state.village = villageForXa(state, d.xaId);

  const geoData = getLowerRegions(state, d.huyenId);
  const langObj = geoData?.tong?.[d.tongId]?.xa?.[d.xaId]?.lang?.[d.langId];
  logLine(state, `📍 Đã tới nơi: ${langObj?.name || d.langId}.`, true);

  // If arriving due to an imperial transfer order, switch active posting
  if (state.postingOrder?.active && state.postingOrder?.to?.huyenId === p.currentHuyen && p.faction === Faction.TRIEU_DINH) {
    const to = state.postingOrder.to;
    const h = getHuyen(to.regionId, to.phuId, to.huyenId);
    const targetName = h?.name || to.huyenId;
    state.postingId = to.huyenId;
    ensurePostingIfNeeded(state);
    state.postingOrder.active = false;
    state.postingOrder.status = "completed";
    logLine(state, `🏛 Đã nhận nhiệm sở: ${targetName}.`, true);
    pushCelebration(state, "CHIẾU CHỈ", `Đã tới nhiệm sở mới: <strong>${targetName}</strong>.`, "murmur");
  }

  // Arrive to battle staging area: prompt to join (no teleport join)
  if (state._pendingJoinBattle?.battleId && state._pendingJoinBattle?.huyenId === p.currentHuyen) {
    const pj = state._pendingJoinBattle;
    state._pendingJoinBattle = null;
    state.pendingEvent = {
      id: "arrive_battlefield",
      title: "⚔️ Tới chiến trường",
      narrative: `Bạn đã tới chiến trường. Có nhập ngũ ngay không?`,
      choices: [
        { label: "Tham chiến ngay", impact:[{label:"Nhập ngũ",color:"#ffd43b"}], apply(s){ actionJoinBattle(s, pj.battleId, pj.side); } },
        { label: "Chưa (thăm dò)", impact:[], apply(s){ logLine(s, "Bạn tạm thời quan sát thế trận."); } },
      ]
    };
  }
}

function tickTravel(state) {
  if (!state.travel?.active) return;
  const p = state.player;
  const perDay = travelThocPerDay(p.quanSo);

  // Road events (for special trips like exams/tournaments)
  if (state.travel?.opts?.roadEvents && !state.pendingEvent && rng(state) < 0.06) {
    const kind = ["bandit", "scholar", "broker", "inn"][randInt(0, 3)];
    if (kind === "bandit") {
      state.pendingEvent = {
        id: "road_bandit",
        title: "🗡 Bị cướp chặn đường",
        narrative: "Một toán cướp rừng chặn lối. Chúng nhìn túi tiền của ngươi mà cười nham hiểm.",
        choices: [
          { label: "Nộp tiền qua ải", impact:[{label:"-Tiền",color:"#ff6b6b"}], apply(s){
            const lost = Math.min(s.player.tien, 60 + randInt(0, 120));
            s.player.tien -= lost;
            logLine(s, `Nộp ${lost} quan để thoát nạn trên đường.`);
          }},
          { label: "Đánh mở đường (thử Võ)", impact:[{label:"Nguy hiểm",color:"#ffd43b"}], apply(s){
            const ok = rng(state) < (0.35 + (s.player.voThuat||0)*0.006);
            if (ok) { logLine(s, "Đánh bật bọn cướp, đoàn người thoát nạn!"); s.player.danhVong += 10; }
            else { const loss = Math.min(s.player.tien, 40 + randInt(0, 80)); s.player.tien -= loss; s.player.theLuc = Math.max(0, s.player.theLuc - 25); logLine(s, `Bị thương và mất ${loss} quan.`, true); }
          }},
          { label: "Lén vòng đường rừng (thử Mưu)", impact:[{label:"+trễ",color:"#ffd43b"}], apply(s){
            s.travel.daysLeft += 1;
            logLine(s, "Vòng đường rừng tránh cướp, nhưng trễ thêm 1 ngày.");
          }},
        ]
      };
    } else if (kind === "scholar") {
      state.pendingEvent = {
        id: "road_scholar",
        title: "📚 Gặp sĩ tử trên đường",
        narrative: "Một sĩ tử cùng đường bàn luận kinh nghĩa. Hắn thách ngươi đối đáp vài câu.",
        choices: [
          { label: "Đối đáp", impact:[{label:"+Học Vấn",color:"#51cf66"}], apply(s){
            s.player.hocVan = Math.min(100, (s.player.hocVan||0) + 1);
            logLine(s, "Đối đáp trôi chảy, hiểu thêm một tầng nghĩa lý.");
          }},
          { label: "Cho ít lộ phí", impact:[{label:"+Uy tín",color:"#74c0fc"}], apply(s){
            const g = Math.min(s.player.tien, 20);
            s.player.tien -= g;
            s.player.uyTinCong += 5;
            logLine(s, `Cho sĩ tử ${g} quan, danh tiếng lan ra.`);
          }},
          { label: "Bỏ qua", impact:[], apply(s){ logLine(s, "Không dừng lại."); } },
        ]
      };
    } else if (kind === "broker") {
      state.pendingEvent = {
        id: "road_broker",
        title: "🧾 Gặp cò chạy chọt",
        narrative: "Một kẻ xưng là 'cò' ghé sát tai: “Muốn thi/đấu trót lọt không? Có đường đây…”",
        choices: [
          { label: "Đưa 80Q nhờ lo", impact:[{label:"Tăng tỉ lệ",color:"#51cf66"}], apply(s){
            if (s.player.tien >= 80) { s.player.tien -= 80; s.activity = s.activity || null; if (s.activity) s.activity.bribe = (s.activity.bribe||0) + 80; logLine(s, "Đưa tiền cho cò. Hắn hứa sắp xếp."); }
            else logLine(s, "Không đủ tiền.");
          }},
          { label: "Từ chối", impact:[], apply(s){ logLine(s, "Ngươi gạt đi, không muốn dính bẩn."); } },
        ]
      };
    } else {
      state.pendingEvent = {
        id: "road_inn",
        title: "🏮 Trú quán ven đường",
        narrative: "Đêm xuống, ngươi trú tại quán trọ. Có thể nghỉ thêm để hồi sức, nhưng sẽ trễ.",
        choices: [
          { label: "Nghỉ thêm 1 đêm (trễ +1 ngày)", impact:[{label:"+TL",color:"#51cf66"}], apply(s){
            s.travel.daysLeft += 1;
            s.player.theLuc = Math.min((s.player.theLucMax||144), s.player.theLuc + 18);
            if (typeof s.player.hp === "number") s.player.hp = Math.min((s.player.hpMax||100), s.player.hp + 2);
            logLine(s, "Ngủ thêm 1 đêm. Thân thể hồi lại, nhưng lịch bị trễ.");
          }},
          { label: "Lên đường ngay", impact:[], apply(s){ logLine(s, "Siết áo, tiếp tục lên đường."); } },
        ]
      };
    }
  }

  // Consume supplies daily
  if (p.thocCaNhan >= perDay) {
    p.thocCaNhan -= perDay;
  } else {
    // Attrition when no supplies
    const missing = perDay - p.thocCaNhan;
    p.thocCaNhan = 0;
    const loss = Math.min(p.quanSo, Math.ceil((missing + 1) * (10 + rng(state) * 25)));
    p.quanSo = Math.max(0, p.quanSo - loss);
    if (typeof p.hp === "number") p.hp = Math.max(1, p.hp - 2);
    logLine(state, `🥀 Thiếu lương hành quân: mất ${loss} quân vì rã ngũ/kiệt sức.`, true);
  }

  state.travel.daysLeft--;
  if (state.travel.daysLeft <= 0) {
    state.travel.active = false;
    arriveTravel(state);
    state.travel.dest = null;
    state.travel.reason = "";
  }
}

// ================= SCHEDULED ACTIVITIES (EXAMS / TOURNAMENT) ================= //
function escActivityHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function totalDaysAbs(state) {
  return (state.ban - 1737) * 360 + state.monthIndex * 30 + (state.gameDay || 1);
}

/** Đích hành quân (cần làng để khớp engine), nhưng địa điểm thi quan phủ là cấp Phủ/Huyện/Trấn — không thi tại làng xã. */
function pickExamDestination(state, regionId, kind) {
  const p = state.player;
  const region = getRegion(regionId);
  if (!region?.phu) return null;

  let phuId = Object.keys(region.phu)[0] || null;
  let huyenId = phuId ? Object.keys(region.phu[phuId]?.huyen || {})[0] : null;
  let venueShort = "";
  let venueLabel = "";

  if (kind === "thi_dinh") {
    phuId = "phung_thien";
    huyenId = "tho_xuong";
    venueShort = "Kinh thành Thăng Long";
    venueLabel = "Kinh thành Thăng Long — Điện thí (Thi Đình), không thi tại làng xã";
  } else if (kind === "thi_hoi" || kind === "bac_cu") {
    if (p.currentRegion === regionId && p.currentPhu && getPhu(regionId, p.currentPhu)) {
      phuId = p.currentPhu;
    }
    const phuObj = getPhu(regionId, phuId);
    huyenId = Object.keys(phuObj?.huyen || {})[0] || null;
    const tranName = region.name || regionId;
    venueShort = kind === "bac_cu" ? `Võ đài trung tâm ${tranName}` : `Trung tâm ${tranName}`;
    venueLabel = kind === "bac_cu"
      ? `${venueShort} — Lôi đài cấp Trấn (yêu cầu võ thuật từ 20, không tổ chức ở làng xã)`
      : `${venueShort} — Trường thi Hội cấp Trấn (không tổ chức ở làng xã)`;
  } else if (kind === "thi_huong") {
    if (p.currentRegion === regionId && p.currentPhu && getPhu(regionId, p.currentPhu)) {
      phuId = p.currentPhu;
    }
    const phuObj = getPhu(regionId, phuId);
    huyenId = Object.keys(phuObj?.huyen || {})[0] || null;
    const phuName = phuObj?.name || phuId;
    venueShort = `Trung tâm ${phuName}`;
    venueLabel = `${venueShort} — Trường thi Hương cấp Phủ (không tổ chức ở làng xã)`;
  }
  if (!phuId || !huyenId) return null;

  const geo = getLowerRegions(state, huyenId);
  const tongId = Object.keys(geo?.tong || {})[0];
  const xaId = tongId ? Object.keys(geo.tong[tongId].xa || {})[0] : null;
  const langId = xaId ? Object.keys(geo.tong[tongId].xa[xaId].lang || {})[0] : null;
  if (!tongId || !xaId || !langId) return null;

  if (!venueShort || !venueLabel) {
    const phuObj = getPhu(regionId, phuId);
    const huyenObj = getHuyen(regionId, phuId, huyenId);
    const phuName = phuObj?.name || phuId;
    const huyenName = huyenObj?.name || huyenId;
    venueShort = `${phuName} · ${huyenName}`;
    venueLabel = `${venueShort} — địa điểm trung tâm (không tổ chức ở làng xã)`;
  }

  return {
    dest: { regionId, phuId, huyenId, tongId, xaId, langId },
    venueShort,
    venueLabel,
  };
}

function playerAtExamDest(p, dest) {
  if (!dest?.regionId || !dest.phuId || !dest.huyenId) return false;
  return p.currentRegion === dest.regionId && p.currentPhu === dest.phuId && p.currentHuyen === dest.huyenId;
}

function buildVenueLabelFromDest(state, dest, kind) {
  if (!dest?.regionId) return "";
  const phuObj = getPhu(dest.regionId, dest.phuId);
  const regionObj = getRegion(dest.regionId);
  if (kind === "thi_dinh") return "Kinh thành Thăng Long — Điện thí (Thi Đình)";
  if (kind === "thi_hoi") return `Trung tâm ${regionObj?.name || dest.regionId} — Trường thi Hội cấp Trấn`;
  if (kind === "bac_cu") return `Võ đài trung tâm ${regionObj?.name || dest.regionId} — Lôi đài cấp Trấn`;
  if (kind === "thi_huong") return `Trung tâm ${phuObj?.name || dest.phuId} — Trường thi Hương cấp Phủ`;
  const huyenObj = getHuyen(dest.regionId, dest.phuId, dest.huyenId);
  return `${phuObj?.name || dest.phuId} · ${huyenObj?.name || dest.huyenId}`;
}

export function planActivity(state, kind, options = {}) {
  const p = state.player;
  if (state.activity?.active) return { ok: false, msg: "Đang có một hoạt động đã đăng ký." };
  // Basic restrictions (rebel/wanted already blocked elsewhere, but keep safe)
  if (p.faction === Faction.NGHIA_QUAN || (p.wantedLevel || 0) > 0) return { ok: false, msg: "Đang bị truy nã / làm phản." };

  const now = totalDaysAbs(state);
  const monthsAhead = options.monthsAhead ?? (2 + randInt(2, 5)); // 4-7 months default
  const start = now + monthsAhead * 30;

  let title = "";
  let fee = 0;
  let regionId = p.currentRegion;
  let durationDays = 5;
  if (kind === "thi_huong") { title = "Thi Hương"; fee = 100; durationDays = 6; }
  else if (kind === "thi_hoi") { title = "Thi Hội"; fee = 300; durationDays = 7; }
  else if (kind === "thi_dinh") { title = "Thi Đình"; fee = 0; durationDays = 4; regionId = RegionId.THANG_LONG; }
  else if (kind === "bac_cu") { title = "Lôi Đài Bác Cử"; fee = 100; durationDays = 2; }
  else return { ok: false, msg: "Hoạt động không hợp lệ." };
  if (kind === "bac_cu" && (p.voThuat || 0) < 20) return { ok: false, msg: "Lôi đài cấp Trấn yêu cầu Võ Thuật từ 20." };

  if (p.tien < fee) return { ok: false, msg: `Cần ${fee} quan để ghi danh.` };
  p.tien -= fee;

  const picked = pickExamDestination(state, regionId, kind);
  const dest = picked?.dest || { regionId: p.currentRegion, phuId: p.currentPhu, huyenId: p.currentHuyen, tongId: p.currentTong, xaId: p.currentXa, langId: p.currentLang };
  const venueShort = picked?.venueShort || buildVenueLabelFromDest(state, dest, kind).split(" —")[0] || "";
  const venueLabel = picked?.venueLabel || buildVenueLabelFromDest(state, dest, kind);

  state.activity = {
    active: true,
    kind,
    title,
    fee,
    bribe: 0,
    startTotalDays: start,
    durationDays,
    dest,
    venueShort,
    venueLabel,
    phase: "travel",
    resultsDueTotalDays: null,
    bracket: null,
    logs: [],
    _warned30DayWindow: false,
  };

  // auto travel now (road events enabled)
  startTravel(state, dest, `Lên đường: ${title}`, { roadEvents: true });
  logLine(state, `🗓 Ghi danh ${title}. Còn ${monthsAhead} tháng nữa khai mạc. Địa điểm: ${venueShort}.`, true);
  return { ok: true, feedback: [{ text: `Đã ghi danh: ${title}`, tone: "good" }, { text: `-${fee} Quan`, tone: "bad" }], sfx: "coin" };
}

export function cancelActivity(state) {
  if (!state.activity?.active) return { ok: false, msg: "Không có hoạt động đang đăng ký." };
  const a = state.activity;
  state.activity = null;
  logLine(state, `Hủy đăng ký ${a.title}.`);
  return { ok: true, feedback: [{ text: "Đã hủy", tone: "bad" }], sfx: "caiVa" };
}

export function activityStatus(state) {
  const a = state.activity;
  if (!a?.active) return null;
  const now = totalDaysAbs(state);
  const daysToStart = Math.max(0, (a.startTotalDays || now) - now);
  let venueLabel = a.venueLabel;
  let venueShort = a.venueShort;
  if ((!venueLabel || !venueShort) && a.dest) {
    venueLabel = venueLabel || buildVenueLabelFromDest(state, a.dest, a.kind);
    if (!venueShort && a.dest) {
      const phuObj = getPhu(a.dest.regionId, a.dest.phuId);
      const huyenObj = getHuyen(a.dest.regionId, a.dest.phuId, a.dest.huyenId);
      venueShort = `${phuObj?.name || a.dest.phuId} · ${huyenObj?.name || a.dest.huyenId}`;
    }
  }
  return { ...a, nowTotalDays: now, daysToStart, venueLabel, venueShort };
}

// ================= POSTING / GOVERNANCE ================= //
function isOfficialRank(rank) {
  return [
    // Civil
    PlayerRank.TRI_HUYEN, PlayerRank.TRI_PHU, PlayerRank.HIEN_SAT_SU, PlayerRank.THUA_CHINH_SU, PlayerRank.DOC_TRAN,
    PlayerRank.THUONG_THU, PlayerRank.THAM_TUNG, PlayerRank.BOI_TUNG,
    // Military
    PlayerRank.DOI_TRUONG, PlayerRank.CAI_DOI, PlayerRank.CAI_CO, PlayerRank.CHUONG_CO, PlayerRank.BACH_HO, PlayerRank.TONG_LINH,
    PlayerRank.DO_DOC, PlayerRank.DO_CHI_HUY_SU, PlayerRank.DAI_TUONG
  ].includes(rank);
}

/**
 * Người chơi ĐANG giữ một ghế thật (state.seats) có title >= minTitle, so theo
 * thứ tự Object.values(PlayerRank) — cùng thứ tự actionXayNha vốn dùng cho minRank.
 * Chặt hơn kiểm p.rank: p.rank là cache tự xưng, court.js ghi thẳng được mà không
 * chạm ghế. Lúc này chỉ có ghế xã/tổng/huyện tồn tại -> minTitle > TRI_HUYEN luôn
 * false tới khi "AI dùng ghế thật" dựng thêm bậc ghế.
 */
function playerHoldsSeatAtLeast(state, minTitle) {
  const order = Object.values(PlayerRank);
  const need = order.indexOf(minTitle);
  if (need < 0) return false;
  const pid = state?.player?.id;
  if (!pid || !state.seats) return false;
  for (const seat of Object.values(state.seats)) {
    if (seat && seat.occupantId === pid && order.indexOf(seat.title) >= need) return true;
  }
  return false;
}

/**
 * T3.3-0: Village của một xã. QO: 27 xã seed sẵn trong state.villagesByXa (createInitialState).
 * Ngoài QO (huyện procedural): dùng chung state._fallbackVillage, tạo một lần.
 * state.village LUÔN là con trỏ tới object trả về đây — KHÔNG bao giờ copy field.
 */
/**
 * T3.3-2: ruộng LỘC của người chơi — DẪN XUẤT từ ghế đang giữ, KHÔNG lưu field.
 * Mất ghế (occupantId đổi) -> mất lộc ngay, không cần teardown. Tô lộc chảy thẳng
 * Person.tien occupant (T3.3-4). Số thửa theo LOC_PLOTS_BY_TITLE (2/3/6).
 */
export function locPlotsForPlayer(state) {
  const pid = state.player?.id;
  if (!pid || !state.seats) return [];
  const out = [];
  for (const seat of Object.values(state.seats)) {
    if (!seat || seat.occupantId !== pid) continue;
    const n = LOC_PLOTS_BY_TITLE[seat.title] || 0;
    for (let i = 0; i < n; i++) {
      out.push({ id: `loc_${seat.id}_${i}`, xaId: seat.scopeId, tenure: "loc", seatId: seat.id, landlordId: null });
    }
  }
  return out;
}

export function villageForXa(state, xaId) {
  if (xaId && state.villagesByXa && state.villagesByXa[xaId]) return state.villagesByXa[xaId];
  if (!state._fallbackVillage) {
    const globalClanIds = (state.clans || []).filter(c => c.scope == null).map(c => c.id);
    state._fallbackVillage = new Village({
      name: "Làng", xaId: null, quyLang: 120, khoThoc: 600, unrest: 12,
      pops: { nong: 400, tho: 20, thuong: 5 }, clanIds: globalClanIds, suatDinh: 80,
    });
  }
  return state._fallbackVillage;
}

function ensurePostingIfNeeded(state) {
  const p = state.player;
  if (p.faction !== Faction.TRIEU_DINH) return;
  if (!isOfficialRank(p.rank)) return;
  if (!state.postingsByHuyen) state.postingsByHuyen = {};
  if (!state.postingId) state.postingId = p.currentHuyen;
  if (!state.postingsByHuyen[state.postingId]) {
    state.postingsByHuyen[state.postingId] = {
      regionId: p.currentRegion,
      phuId: p.currentPhu,
      huyenId: state.postingId,
      treasury: 800,
      garrison: 180 + randInt(0, 120),
      corruption: 0,
      armies: [],
      taxCollectedYear: 0,
      lastAuditYear: 0,
      buildings: {}, // posting-local buildings
    };
    logLine(state, `🏛 Nhậm chức tại ${state.postingId}. Kho bạc địa phương bắt đầu được giao quản.`, true);
  }
}

const PostingBuildingDb = {
  granary: {
    id: "granary",
    name: "Kho Thóc Huyện",
    maxLevel: 3,
    costs: [0, 300, 700, 1300],
    desc: "Dự trữ thóc, giảm nạn đói và chết đói khi mất mùa.",
  },
  yamen: {
    id: "yamen",
    name: "Mở Rộng Phủ Nha",
    maxLevel: 3,
    costs: [0, 450, 900, 1600],
    desc: "Tăng năng lực nha lại: giảm án tồn, giảm bất ổn do kiện tụng.",
  },
  barracks: {
    id: "barracks",
    name: "Doanh Trại Địa Phương",
    maxLevel: 3,
    costs: [0, 500, 1100, 2000],
    desc: "Kỷ luật quân nha tốt hơn: tăng garrison và giảm tỉ lệ 'unfit' của suất đinh.",
  },
  river_patrol: {
    id: "river_patrol",
    name: "Trạm Tuần Sông",
    maxLevel: 2,
    costs: [0, 600, 1400],
    desc: "Giảm thiệt hại do thủy chiến/đạo tặc ven sông; tăng khả năng bắt cướp.",
  },
};

function applyPostingBuildingMonthly(state, po) {
  if (!po?.buildings) return;
  const v = state.village;
  const lvlG = po.buildings.granary || 0;
  const lvlY = po.buildings.yamen || 0;
  const lvlB = po.buildings.barracks || 0;

  if (lvlG > 0) {
    const add = 40 * lvlG;
    v.khoThoc = Math.min(999999, (v.khoThoc || 0) + add);
    if (state.thoiTiet === Weather.HAN || state.thoiTiet === Weather.LU) {
      v.unrest = Math.max(0, (v.unrest || 0) - 2 * lvlG);
    }
  }
  if (lvlY > 0) {
    v.unrest = Math.max(0, (v.unrest || 0) - 1 * lvlY);
    // Slightly reduce new case pressure by lowering unrest drift (cases generator uses unrest)
  }
  if (lvlB > 0) {
    po.garrison = (po.garrison || 0) + (10 * lvlB);
    // Reduce unfit in levy pools
    if (v._eligibleLevy) v._eligibleLevy = Math.floor(v._eligibleLevy * (1.0 + 0.03 * lvlB));
    if (v._eligibleLevyWide) v._eligibleLevyWide = Math.floor(v._eligibleLevyWide * (1.0 + 0.03 * lvlB));
  }
}

function getPosting(state) {
  if (!state.postingsByHuyen || !state.postingId) return null;
  return state.postingsByHuyen[state.postingId] || null;
}

function ymKeyShort(state) { return `${state.ban}-${state.monthIndex}`; }

function pickFirstLangInHuyen(state, regionId, huyenId) {
  if (!regionId || !huyenId) return null;
  const region = getRegion(regionId);
  if (!region) return null;
  let phuId = null;
  for (const pid of Object.keys(region.phu || {})) {
    if (region.phu?.[pid]?.huyen?.[huyenId]) { phuId = pid; break; }
  }
  if (!phuId) return null;
  const geo = getLowerRegions(state, huyenId);
  const tongId = Object.keys(geo?.tong || {})[0];
  const xaId = tongId ? Object.keys(geo.tong[tongId].xa || {})[0] : null;
  const langId = xaId ? Object.keys(geo.tong[tongId].xa[xaId].lang || {})[0] : null;
  if (!tongId || !xaId || !langId) return null;
  return { regionId, phuId, huyenId, tongId, xaId, langId };
}

function pickRandomHuyenSameRegion(state) {
  const p = state.player;
  const region = getRegion(p.currentRegion);
  if (!region) return null;
  const huyens = [];
  for (const phuId of Object.keys(region.phu || {})) {
    const phu = region.phu?.[phuId];
    for (const huyenId of Object.keys(phu?.huyen || {})) {
      huyens.push({ regionId: p.currentRegion, phuId, huyenId });
    }
  }
  const filtered = huyens.filter(x => x.huyenId && x.huyenId !== state.postingId);
  if (filtered.length === 0) return null;
  return filtered[randInt(0, filtered.length - 1)];
}

function ensurePostingOrderState(state) {
  if (!("postingOrder" in state)) state.postingOrder = null;
}

function tryGenerateTransferEdict(state) {
  ensurePostingOrderState(state);
  const p = state.player;
  if (p.faction !== Faction.TRIEU_DINH) return;
  if (!isOfficialRank(p.rank)) return;
  if (!state.postingId) return;
  if (state.pendingEvent || inboxFull(state)) return;
  if (state.travel?.active) return;
  if ((state.jailDays || 0) > 0) return;
  if (state.postingOrder?.active) return;

  // Low monthly chance; higher if corruption/unrest is high (court "stirs the pot")
  const po = getPosting(state);
  const risk = 0.02 + Math.min(0.03, (po?.corruption || 0) * 0.00025) + Math.min(0.02, Math.max(0, (state.village.unrest - 35)) * 0.00025);
  if (rng(state) >= risk) return;

  const pick = pickRandomHuyenSameRegion(state);
  if (!pick) return;
  const huyen = getHuyen(pick.regionId, pick.phuId, pick.huyenId);
  const targetName = huyen?.name || pick.huyenId;
  const due = totalDaysAbs(state) + (25 + randInt(0, 25));

  state.pendingEvent = {
    id: "imperial_transfer_edict",
    onExpire(s){
      ensurePostingOrderState(s);
      // Làm ngơ chỉ dụ: triều đình vẫn ghi lệnh điều nhiệm (việc BÊN NGOÀI vẫn xảy ra).
      s.postingOrder = { active: true, kind: "transfer", issuedYm: ymKeyShort(s), dueTotalDays: due, to: { regionId: pick.regionId, phuId: pick.phuId, huyenId: pick.huyenId }, status: "accepted" };
      logLine(s, `📜 Ngươi làm ngơ chỉ dụ điều nhiệm. Triều vẫn ghi lệnh — phải tới ${targetName} trước hạn, không thì bị tra xét.`, true);
    },
    title: "📜 Chỉ dụ điều nhiệm",
    narrative: `Triều đình ban chỉ: ngươi phải lập tức lên đường nhận nhiệm sở mới tại <strong>${targetName}</strong>. Kháng lệnh là tội lớn.`,
    choices: [
      { label: "Tuân chỉ (lên đường)", impact:[{label:"Điều nhiệm",color:"#51cf66"}], apply(s){
        ensurePostingOrderState(s);
        const p = s.player;
        s.postingOrder = {
          active: true,
          kind: "transfer",
          issuedYm: ymKeyShort(s),
          dueTotalDays: due,
          to: { regionId: pick.regionId, phuId: pick.phuId, huyenId: pick.huyenId },
          status: "accepted"
        };
        const dest = pickFirstLangInHuyen(s, pick.regionId, pick.huyenId) || { regionId: p.currentRegion, phuId: p.currentPhu, huyenId: pick.huyenId, tongId: p.currentTong, xaId: p.currentXa, langId: p.currentLang };
        startTravel(s, dest, `Chỉ dụ: nhận nhiệm sở ${targetName}`, { roadEvents: true });
        logLine(s, `📜 Tuân chỉ điều nhiệm tới ${targetName}.`, true);
      }},
      { label: "Dâng lễ xin hoãn (−120Q)", impact:[{label:"Hoãn hạn",color:"#ffd43b"}], apply(s){
        ensurePostingOrderState(s);
        if (s.player.tien < 120) { logLine(s, "Không đủ tiền dâng lễ xin hoãn.", true); return; }
        s.player.tien -= 120;
        s.postingOrder = {
          active: true,
          kind: "transfer",
          issuedYm: ymKeyShort(s),
          dueTotalDays: due + 30,
          to: { regionId: pick.regionId, phuId: pick.phuId, huyenId: pick.huyenId },
          status: "delayed"
        };
        logLine(s, `🎁 Dâng lễ xin hoãn. Triều cho thêm hạn, nhưng vẫn phải đi ${targetName}.`, true);
      }},
      { label: "Kháng lệnh (liều)", impact:[{label:"Nguy hiểm",color:"#ff6b6b"}], apply(s){
        ensurePostingOrderState(s);
        const p = s.player;
        const ok = rng(state) < (0.18 + (p.ngoaiGiao||0)*0.002 + (p.muuMeo||0)*0.002);
        if (ok) {
          p.uyTinCong = Math.max(0, p.uyTinCong - 20);
          logLine(s, "Ngươi khéo lời lảng tránh, tạm thoát lần này... nhưng triều đã để mắt.", true);
        } else {
          p.uyTinCong = Math.max(0, p.uyTinCong - 50);
          s.jailDays = Math.max(s.jailDays || 0, 12 + randInt(0, 12));
          // demote hard
          p.rank = PlayerRank.DAN_THUONG;
          s.postingId = null;
          s.postingOrder = null;
          logLine(s, "Kháng lệnh thất bại! Bị bắt giam, giáng làm dân thường, tước chức.", true);
        }
      }},
    ]
  };
}

function ensureCaseList(po) {
  if (!po.cases) po.cases = [];
}

function addCase(po, c) {
  ensureCaseList(po);
  po._caseSeq = (po._caseSeq || 1) + 1;
  const id = `case_${po.huyenId}_${po._caseSeq}_${Math.floor(rng() * 9999)}`;
  po.cases.push({ id, ...c });
}

function daySerial(state) {
  return (state.ban - 1737) * 360 + state.monthIndex * 30 + (state.gameDay || 1);
}

function scheduleDelayedEffect(state, effect) {
  if (!state._delayedEffects) state._delayedEffects = [];
  state._delayedEffects.push(effect);
}

function processDelayedEffects(state) {
  if (!state._delayedEffects || state._delayedEffects.length === 0) return;
  const now = daySerial(state);
  const keep = [];
  for (const ef of state._delayedEffects) {
    if (!ef || (ef.dueDay || 0) > now) {
      keep.push(ef);
      continue;
    }
    const clan = state.clans?.find(c => c.id === ef.clanId);
    if (ef.type === "clan_retaliation") {
      const loss = Math.max(5, ef.lossQ || 12);
      state.player.tien = Math.max(0, state.player.tien - loss);
      state.player.uyTinCong = Math.max(0, (state.player.uyTinCong || 0) - 3);
      if (clan) adjustClanMembersOpinion(state, clan.id, -4, +4);
      logLine(state, `⏱️ Hậu quả trễ: ${clan?.name || "Dòng họ đối nghịch"} trả đũa muộn, bạn mất ${loss}Q.`, true);
      continue;
    }
    if (ef.type === "clan_favor_callin") {
      const pay = Math.max(6, ef.payQ || 10);
      state.player.tien = Math.max(0, state.player.tien - pay);
      if (clan) adjustClanMembersOpinion(state, clan.id, +2, 0);
      logLine(state, `⏱️ Ân tình phải trả: ${clan?.name || "Dòng họ"} gọi bạn "đáp lễ", mất ${pay}Q.`, false);
      continue;
    }
    keep.push(ef);
  }
  state._delayedEffects = keep;
}

function generateMonthlyCases(state, po) {
  ensureCaseList(po);
  if (po.lastCaseYm === ymKeyShort(state)) return;
  po.lastCaseYm = ymKeyShort(state);
  // Generate 1-2 cases per month, more if unrest high
  const n = (state.village.unrest >= 70) ? 2 : (rng(state) < 0.55 ? 1 : 0);
  // Clan rivalry is a core local politics driver for officials
  if (rng(state) < 0.70) maybeAddClanRivalryCase(state, po);
  for (let i = 0; i < n; i++) {
    const r = randInt(1, 5);
    if (r === 1) {
      addCase(po, {
        type: "petty_theft",
        severity: "nhẹ",
        title: "Trộm gà bắt chó",
        desc: "Dân báo mất gia súc. Có kẻ bị nghi ăn trộm đem bán.",
        due: `trong tháng ${state.monthIndex}`,
        choices: [
          { label: "Phạt tiền + tha", apply(s){ const po=getPosting(s); if(!po) return; po.treasury += 30; s.village.unrest = Math.max(0, s.village.unrest-4); s.player.uyTinCong += 4; logLine(s, "Xử phạt tiền, an dân."); } },
          { label: "Đánh roi (nghiêm)", apply(s){ s.village.unrest = Math.max(0, s.village.unrest-6); s.player.uyTinCong += 2; logLine(s, "Đánh roi thị uy. Dân sợ nhưng cũng oán."); } },
          { label: "Nhận hối lộ (bẩn)", apply(s){ const po=getPosting(s); if(!po) return; po.corruption = Math.min(100,(po.corruption||0)+6); s.player.tien += 40; s.village.unrest = Math.min(100, s.village.unrest+6); logLine(s, "Nhận hối lộ, thả người. Tin đồn lan ra.", true); } },
        ]
      });
    } else if (r === 2) {
      addCase(po, {
        type: "assault",
        severity: "vừa",
        title: "Đánh lộn ngoài chợ",
        desc: "Hai họ xô xát, có người gãy tay. Nếu xử sai sẽ sinh thù.",
        due: `trong tháng ${state.monthIndex}`,
        choices: [
          { label: "Dàn hòa (thử Ngoại Giao)", apply(s){ const ok=rng(state)<(0.35+(s.player.ngoaiGiao||0)*0.006); if(ok){ s.village.unrest=Math.max(0,s.village.unrest-7); s.player.uyTinCong+=8; logLine(s,"Dàn hòa thành công, dân phục."); } else { s.village.unrest=Math.min(100,s.village.unrest+5); logLine(s,"Dàn hòa thất bại, họ hàng kéo đến gây sức ép.", true);} } },
          { label: "Phạt mỗi bên (thu tiền)", apply(s){ const po=getPosting(s); if(!po) return; po.treasury += 60; s.village.unrest=Math.max(0,s.village.unrest-3); logLine(s,"Phạt tiền cả hai. Im chuyện tạm thời."); } },
          { label: "Thiên vị (tham ô)", apply(s){ const po=getPosting(s); if(!po) return; po.corruption=Math.min(100,(po.corruption||0)+8); s.player.tien += 70; s.village.unrest=Math.min(100,s.village.unrest+10); logLine(s,"Thiên vị nhận lót tay. Dân oán tăng.", true);} },
        ]
      });
    } else if (r === 3) {
      addCase(po, {
        type: "murder",
        severity: "nặng",
        title: "Án mạng trong đêm",
        desc: "Có người chết bên bờ ruộng. Dân hoang mang. Nếu không tìm ra hung thủ, bất ổn tăng.",
        due: `trong tháng ${state.monthIndex}`,
        choices: [
          { label: "Tra án (thử Mưu Mẹo)", apply(s){ const ok=rng(state)<(0.25+(s.player.muuMeo||0)*0.006); if(ok){ s.village.unrest=Math.max(0,s.village.unrest-10); s.player.uyTinCong+=12; logLine(s,"Tìm ra hung thủ, xử nghiêm. Dân yên."); } else { s.village.unrest=Math.min(100,s.village.unrest+12); logLine(s,"Tra án bế tắc. Dân đồn ma quỷ, loạn tăng!", true);} } },
          { label: "Giới nghiêm (tuần nhiều)", apply(s){ const po=getPosting(s); if(!po) return; po.garrison += 20; s.village.unrest=Math.max(0,s.village.unrest-6); s.player.uyTinCong-=3; logLine(s,"Giới nghiêm ban đêm. Dân khó chịu nhưng đỡ sợ."); } },
          { label: "Bịt miệng (tham ô)", apply(s){ const po=getPosting(s); if(!po) return; po.corruption=Math.min(100,(po.corruption||0)+12); s.player.tien += 120; s.village.unrest=Math.min(100,s.village.unrest+15); logLine(s,"Bịt miệng, làm ngơ. Oán khí dâng.", true);} },
        ]
      });
    } else if (r === 4) {
      addCase(po, {
        type: "tax_petition",
        severity: "vừa",
        title: "Dân xin giảm sưu",
        desc: "Mùa này đói kém. Dân kéo tới xin giảm suất nộp.",
        due: `trong tháng ${state.monthIndex}`,
        choices: [
          { label: "Giảm (tốn kho)", apply(s){ const po=getPosting(s); if(!po) return; const cost=80; if(po.treasury>=cost){ po.treasury-=cost; s.village.unrest=Math.max(0,s.village.unrest-12); s.player.uyTinCong+=10; logLine(s,"Giảm sưu, phát chẩn nhẹ. Dân cảm kích.", true);} else { logLine(s,"Kho không đủ để giảm sưu.", true);} } },
          { label: "Giữ đúng luật", apply(s){ s.village.unrest=Math.min(100,s.village.unrest+6); s.player.uyTinCong=Math.max(0,s.player.uyTinCong-5); logLine(s,"Giữ đúng luật, dân thất vọng."); } },
          { label: "Tăng thêm (tham)", apply(s){ const po=getPosting(s); if(!po) return; po.corruption=Math.min(100,(po.corruption||0)+10); po.treasury += 70; s.village.unrest=Math.min(100,s.village.unrest+14); logLine(s,"Tăng sưu, dân oán nổi lên.", true);} },
        ]
      });
    } else {
      addCase(po, {
        type: "land_dispute",
        severity: "nhẹ",
        title: "Kiện ruộng bờ ao",
        desc: "Hai nhà tranh ranh giới. Nếu xử sai sẽ sinh thù dai.",
        due: `trong tháng ${state.monthIndex}`,
        choices: [
          { label: "Đo đạc lại (tốn TL)", apply(s){ s.player.theLuc=Math.max(0,s.player.theLuc-10); s.village.unrest=Math.max(0,s.village.unrest-4); s.player.uyTinCong+=6; logLine(s,"Đo đạc phân xử. Dân nể phục."); } },
          { label: "Bắt hòa giải", apply(s){ s.village.unrest=Math.max(0,s.village.unrest-2); logLine(s,"Bắt hai bên hòa giải."); } },
          { label: "Nhận lót tay", apply(s){ const po=getPosting(s); if(!po) return; po.corruption=Math.min(100,(po.corruption||0)+6); s.player.tien+=50; s.village.unrest=Math.min(100,s.village.unrest+6); logLine(s,"Nhận lót tay, xử lệch. Thù oán âm ỉ.", true);} },
        ]
      });
    }
  }
  // T3.1c: xã player đứng có ghế lý trưởng TRỐNG + >=2 dòng họ -> có thể sinh vụ tranh ghế.
  maybeAddSeatContestCase(state, po);
}

function postingHere(state) {
  const p = state.player;
  const po = getPosting(state);
  if (!po) return false;
  return p.currentRegion === po.regionId && p.currentHuyen === po.huyenId;
}

export function actionRequestReinforcements(state) {
  ensurePostingIfNeeded(state);
  const p = state.player;
  const po = getPosting(state);
  if (!po) return { ok: false, msg: "Chưa có địa bàn nhậm chức." };
  if (p.faction !== Faction.TRIEU_DINH) return { ok: false, msg: "Chỉ quan triều đình mới xin cứu viện." };
  const cd = po._reinforceCd || 0;
  const now = totalDaysAbs(state);
  if (cd > now) return { ok: false, msg: "Vừa xin cứu viện rồi, hãy chờ." };
  po._reinforceCd = now + 45;
  const troops = 200 + randInt(0, 350);
  const eta = 6 + randInt(0, 8);
  if (!state.reinforcements) state.reinforcements = [];
  state.reinforcements.push({ etaDays: eta, troops, toHuyen: po.huyenId });
  logLine(state, `📨 Gửi thư về triều xin cứu viện. Dự kiến ${eta} ngày sẽ tới (${troops} quân).`, true);
  return { ok: true, feedback: [{ text: `Cứu viện: ${eta} ngày`, tone: "good" }], sfx: "murmur" };
}

const EXAM_PERSONALITIES = [
  "Cầu toàn, dễ căng thẳng trước giờ phát đề.",
  "Tự tin ngạo mạn, hay châm chọc khách buôn.",
  "Rụt rè nhưng học thuộc lòng kinh truyện.",
  "Thích khoe tiền mua được đề cố.",
  "Nóng như lửa, dễ va chạm trong sảnh.",
  "Trầm tĩnh, ít nói — nhưng bút lực rất cứng.",
  "Hay bàn chính luận, coi võ sinh là phường thô lỗ.",
  "Nghiện cờ bạc nhỏ trong lúc chờ trọng tài.",
  "Sợ quyền thế, nhưng cũng sợ mất danh.",
  "Thích làm thơ tứ tuyệt khoe trước đám đông.",
  "Hay dò hỏi lai lịch người khác để tìm điểm yếu.",
  "Tính cương trực, không ưa chuyện lót tay.",
];

function playerHomeLabel(state) {
  const p = state.player;
  try {
    const r = getRegion(p.homeRegion)?.name || "";
    const phu = getPhu(p.homeRegion, p.homePhu);
    const hy = getHuyen(p.homeRegion, p.homePhu, p.homeHuyen);
    const bits = [r, phu?.name, hy?.name].filter(Boolean);
    return bits.join(" · ") || "Quê nhà";
  } catch {
    return "Quê nhà";
  }
}

function randomHomelandLabel(state) {
  try {
    const regs = getAllRegions();
    if (!regs.length) return "Đất tha hương";
    const r = regs[randInt(0, regs.length - 1)];
    const phuList = Object.values(r.phu || {});
    if (!phuList.length) return r.name || "Ngoại tỉnh";
    const phu = phuList[randInt(0, phuList.length - 1)];
    const hyList = Object.values(phu.huyen || {});
    if (!hyList.length) return `${r.name} · ${phu.name || ""}`.trim();
    const hy = hyList[randInt(0, hyList.length - 1)];
    return [r.name, phu.name, hy.name].filter(Boolean).join(" · ");
  } catch {
    return "Ngoại hương";
  }
}

function rosterNpcCount(kind) {
  if (kind === "bac_cu") return 7;
  if (kind === "thi_huong") return 12;
  if (kind === "thi_hoi") return 10;
  if (kind === "thi_dinh") return 6;
  return 6;
}

function buildActivityPlayerEntry(state, kind) {
  const p = state.player;
  const isVo = kind === "bac_cu";
  const skill = Math.min(98, Math.max(0, isVo ? (p.voThuat || 0) : (p.hocVan || 0)));
  return {
    id: "player",
    isPlayer: true,
    name: p.name,
    skill,
    hocVan: Math.min(100, p.hocVan || 0),
    voThuat: Math.min(100, p.voThuat || 0),
    muuMeo: Math.min(100, p.muuMeo || 0),
    tuoi: p.age ?? null,
    homeLabel: playerHomeLabel(state),
    personality: "Tự chủ trương — không cam chịu làm nền cho ai.",
    withdrawn: false,
  };
}

function buildActivityNpcRival(state, kind, index, seedStr, baseSkill) {
  const male = rng() > 0.1;
  const name = randomVietName(male);
  const minSkill = kind === "bac_cu" ? 20 : 5;
  const cap = kind === "bac_cu" ? 50 : kind === "thi_huong" ? 52 : kind === "thi_hoi" ? 72 : 88;
  const s = Math.floor(baseSkill + randInt(-8, 18) + (index % 3 === 0 ? randInt(0, 10) : 0));
  const skill = Math.min(cap, Math.max(minSkill, s));
  const hocVan = kind === "bac_cu"
    ? randInt(10, 40)
    : Math.min(95, skill + randInt(-6, 15));
  const voThuat = kind === "bac_cu"
    ? Math.min(100, Math.max(1, skill + randInt(-4, 8)))
    : randInt(12, 48);
  return {
    id: `${kind}_npc_${seedStr}_${index}`,
    isPlayer: false,
    name,
    skill,
    hocVan: Math.min(100, hocVan),
    voThuat: Math.min(100, Math.max(1, voThuat)),
    muuMeo: randInt(8, 48),
    tuoi: 18 + randInt(0, 34),
    homeLabel: randomHomelandLabel(state),
    personality: EXAM_PERSONALITIES[randInt(0, EXAM_PERSONALITIES.length - 1)],
    greed: randInt(25, 92),
    spine: randInt(20, 90),
    withdrawn: false,
  };
}

export function ensureActivityRoster(state) {
  const a = state.activity;
  if (!a?.active) return;
  if (a.roster?.length) return;
  const seedStr = `${a.kind}-${a.startTotalDays}-${state.ban}`;
  const kind = a.kind;
  const baseSkill = kind === "bac_cu" ? 30 : kind === "thi_huong" ? 28 : kind === "thi_hoi" ? 48 : 65;
  const n = rosterNpcCount(kind);
  const roster = [buildActivityPlayerEntry(state, kind)];
  for (let i = 0; i < n; i++) {
    roster.push(buildActivityNpcRival(state, kind, i, seedStr, baseSkill));
  }
  a.roster = roster;
}

function padBacCuPoolToEight(headList) {
  const need = 8;
  const arr = headList.filter(Boolean).slice(0, need);
  let k = 0;
  while (arr.length < need) {
    k++;
    arr.push({
      id: `khuyet_${k}`,
      name: `Võ sinh khuyết (${k})`,
      skill: randInt(18, 28),
      hocVan: randInt(10, 28),
      voThuat: randInt(20, 34),
      muuMeo: randInt(10, 24),
      homeLabel: "Gần trường — nghèo nhưng có gan lên đài",
      personality: "Hay đánh đường gậy, không kỳ vọng đỗ cao.",
      isPlayer: false,
      filler: true,
      withdrawn: false,
    });
  }
  return arr;
}

export function activityBribeOpponent(state, oppId) {
  const a = state.activity;
  if (!a?.active || a.phase !== "ready") return { ok: false, msg: "Chưa trong sảnh chờ khai mạc." };
  const o = a.roster?.find(x => x.id === oppId);
  if (!o || o.isPlayer || o.withdrawn) return { ok: false, msg: "Không tìm thấy người đó trong danh sách." };
  const p = state.player;
  const cost = 45 + randInt(0, 85);
  if (p.tien < cost) return { ok: false, msg: `Cần ít nhất ${cost} quan để dụ ý (có thể thử số nhỏ hơn vẫn rủi ro).` };
  const chance = Math.min(0.78, 0.12 + (p.muuMeo || 0) * 0.0035 + (p.ngoaiGiao || 0) * 0.0022 - (o.greed || 55) * 0.0011);
  if (rng() > chance) {
    const lost = Math.max(8, Math.floor(cost * 0.38));
    p.tien = Math.max(0, p.tien - lost);
    p.uyTinCong = Math.max(0, (p.uyTinCong || 0) - randInt(3, 9));
    logLine(state, `🧧 ${o.name} trả lại tiền vừa đủ để “không nhớ mặt”, nhưng khẩu vẫn rỉ khắp sảnh.`, true);
    return { ok: false, msg: "Lót tay thất bại — danh tiếng hơi xấu đi.", sfx: "caiVa" };
  }
  p.tien -= cost;
  o.withdrawn = true;
  a.bribe = (a.bribe || 0) + randInt(8, 18);
  logLine(state, `🧧 ${o.name} nhận tiền, viện cớ cảm mạo lui kỳ.`, true);
  return { ok: true, feedback: [{ text: `-${cost}Q`, tone: "bad" }, { text: "Đối thủ lui sảnh", tone: "good" }], sfx: "coin" };
}

export function activityThreatenOpponent(state, oppId) {
  const a = state.activity;
  if (!a?.active || a.phase !== "ready") return { ok: false, msg: "Chưa trong sảnh chờ khai mạc." };
  const o = a.roster?.find(x => x.id === oppId);
  if (!o || o.isPlayer || o.withdrawn) return { ok: false, msg: "Không tìm thấy người đó trong danh sách." };
  const p = state.player;
  const chance = Math.min(0.72, 0.1 + (p.voThuat || 0) * 0.0035 + (p.muuMeo || 0) * 0.0015 - (o.spine || 55) * 0.0013);
  if (rng() > chance) {
    p.uyTinCong = Math.max(0, (p.uyTinCong || 0) - randInt(6, 16));
    if (rng() < 0.35) p.theLuc = Math.max(0, (p.theLuc || 0) - randInt(5, 14));
    logLine(state, `⚠️ ${o.name} la làng khiếu nại — trọng tài chú ý tới bạn.`, true);
    return { ok: false, msg: "Đe dọa bất thành — sĩ tử kêu oan.", sfx: "caiVa" };
  }
  o.withdrawn = true;
  logLine(state, `🗡 ${o.name} cắn răng xin lui (sợ thân bại danh liệt).`, true);
  return { ok: true, feedback: [{ text: "Đối thủ lui sảnh", tone: "good" }], sfx: "murmur" };
}

function resolveBacCu(state) {
  const p = state.player;
  const a = state.activity;
  ensureActivityRoster(state);
  const roster = (a.roster || []).filter(x => !x.withdrawn);
  const playerEntry = roster.find(x => x.isPlayer) || { id: "player", name: p.name, skill: p.voThuat || 0, isPlayer: true };
  const others = roster.filter(x => !x.isPlayer);
  const pool = padBacCuPoolToEight([playerEntry, ...others]);
  const bracket = [{ round: 1, matches: [] }, { round: 2, matches: [] }, { round: 3, matches: [] }];

  function winProb(me, opp) {
    const diff = (me.skill - opp.skill);
    const br = (a.bribe || 0) >= 80 ? 0.12 : 0;
    return Math.max(0.08, Math.min(0.92, 0.52 + diff * 0.012 + br));
  }

  let current = pool;
  let logs = [];
  for (let r = 1; r <= 3; r++) {
    let next = [];
    let matches = [];
    for (let i = 0; i < current.length; i += 2) {
      const A = current[i], B = current[i + 1];
      const aWin = (A.isPlayer ? (rng(state) < winProb(A, B)) : (!B.isPlayer ? (A.skill + randInt(0, 20) >= B.skill + randInt(0, 20)) : (rng(state) >= winProb(B, A))));
      const winner = aWin ? A : B;
      matches.push({ a: A, b: B, winner });
      logs.push(`Vòng ${r}: ${A.name} vs ${B.name} → thắng: ${winner.name}`);
      next.push(winner);
    }
    bracket[r - 1].matches = matches;
    current = next;
  }
  const champ = current[0];
  a.bracket = { kind: "bac_cu", bracket, champ: champ.name };
  a.logs = logs;
  const playerWon = champ.isPlayer;
  if (playerWon) {
    // Apply reward similar to old actionBacCu but not guaranteed
    p.danhVong += 100;
    p.rank = PlayerRank.DOI_TRUONG;
    p.quanSo += 100;
    if (!p.armies) p.armies = [];
    p.armies.push({ type: "khinh_ky", count: 10, morale: 100 });
    p.uyTinCong += 50;
    logLine(state, "🥊 UY MÃNH LÔI ĐÀI: Đoạt quán quân Bác Cử!", true);
    return { ok: true, msg: "WIN" };
  } else {
    p.theLuc = Math.max(0, p.theLuc - 40);
    if (rng(state) < 0.25) { p.dangOm = true; p.theLuc = 0; }
    logLine(state, "🥊 Thất bại ở lôi đài. Bị đánh vỡ mặt mũi!", true);
    return { ok: true, msg: "LOSE" };
  }
}

function resolveExam(state, kind) {
  const p = state.player;
  const a = state.activity;
  const seed = `${state.ban}-${state.monthIndex}-${state.gameDay}`;
  const tierBase = kind === "thi_huong" ? 28 : kind === "thi_hoi" ? 48 : 65;
  const n = kind === "thi_huong" ? 12 : kind === "thi_hoi" ? 10 : 6;
  ensureActivityRoster(state);
  const rosterFiltered = (a.roster || []).filter(x => !x.withdrawn);
  let ops = rosterFiltered.filter(x => !x.isPlayer).slice(0, n);
  while (ops.length < n) {
    ops.push(buildActivityNpcRival(state, kind, 400 + ops.length, `${seed}_pad`, tierBase));
  }

  const br = (a.bribe || 0) >= 80 ? 8 : (a.bribe || 0) >= 40 ? 4 : 0;
  const travelFatigue = Math.max(0, 12 - (p.theLuc || 0) * 0.08);
  const myScore = (p.hocVan || 0) + randInt(0, 35) + br - Math.floor(travelFatigue);
  const scores = ops.map(o => ({
    id: o.id,
    name: o.name,
    score: o.skill + randInt(0, 35),
    isPlayer: false,
    homeLabel: o.homeLabel,
    personality: o.personality,
    hocVan: o.hocVan,
    voThuat: o.voThuat,
    muuMeo: o.muuMeo,
    tuoi: o.tuoi,
  }));
  scores.push({
    id: "player",
    name: p.name,
    score: myScore,
    isPlayer: true,
    homeLabel: playerHomeLabel(state),
    personality: "Chính mình — không ai biết rõ bằng bạn.",
    hocVan: p.hocVan,
    voThuat: p.voThuat,
    muuMeo: p.muuMeo,
    tuoi: p.age ?? null,
  });
  scores.sort((a, b) => b.score - a.score);
  a.bracket = { kind, scoreboard: scores.slice(0, Math.min(scores.length, 10)) };
  a.logs = scores.slice(0, 8).map((s, i) => `${i + 1}. ${s.name}: ${s.score}`);

  const passLine = kind === "thi_huong" ? 0.55 : kind === "thi_hoi" ? 0.50 : 0.40;
  const rankPos = scores.findIndex(x => x.isPlayer) + 1;
  const posFactor = 1 - (rankPos - 1) / Math.max(1, scores.length);
  const baseChance = (p.hocVan || 0) / (kind === "thi_huong" ? 55 : kind === "thi_hoi" ? 85 : 125);
  const chance = Math.max(0.03, Math.min(0.92, baseChance * 0.65 + posFactor * 0.35));
  const passed = chance > passLine;

  // Results are delayed (return home + wait)
  a.resultsDueTotalDays = totalDaysAbs(state) + (kind === "thi_huong" ? 20 : kind === "thi_hoi" ? 26 : 18);
  a._passed = passed;
  return passed;
}

function tickActivity(state) {
  const a = state.activity;
  if (!a?.active) return;
  const now = totalDaysAbs(state);
  const p = state.player;

  // If traveling, we wait for arrival
  if (a.phase === "travel") {
    if (!state.travel?.active) {
      a.phase = "waiting";
    }
    return;
  }

  // Waiting until start date
  if (a.phase === "waiting") {
    if (now < a.startTotalDays) {
      const daysLeft = (a.startTotalDays || now) - now;
      if (!a._warned30DayWindow && daysLeft <= 30 && daysLeft > 0 && a.dest) {
        if (!playerAtExamDest(p, a.dest)) {
          a._warned30DayWindow = true;
          const v = a.venueLabel || buildVenueLabelFromDest(state, a.dest, a.kind);
          pushCelebration(
            state,
            "⚠️ NHẮC LỊCH THI",
            `Còn khoảng <strong>1 tháng</strong> tới kỳ <strong>${escActivityHtml(a.title)}</strong>.<br><br>Địa điểm quan trường: <strong>${escActivityHtml(v)}</strong>.<br><br>Hãy <strong>hành quân</strong> tới đúng <strong>địa điểm trung tâm</strong> trước ngày khai mạc — không thi tại làng xã.`,
            "murmur",
            { tone: "warn" }
          );
        }
      }
      return;
    }
    if (!playerAtExamDest(p, a.dest)) {
      const v = a.venueLabel || buildVenueLabelFromDest(state, a.dest, a.kind);
      logLine(state, `⏳ LỠ KỲ ${a.title}: không có mặt tại ${a.venueShort || v}.`, true);
      pushCelebration(
        state,
        "❌ LỠ KỲ THI / LÔI ĐÀI",
        `Bạn <strong>không có mặt</strong> tại địa điểm quan trường đúng ngày khai mạc.<br><br>Phải tới: <strong>${escActivityHtml(v)}</strong><br><br>Kỳ <strong>${escActivityHtml(a.title)}</strong> đã bỏ lỡ.`,
        "caiVa",
        { tone: "danger" }
      );
      state.activity = null;
      return;
    }
    a.phase = "ready";
    ensureActivityRoster(state);
    state._activityUiPulse = (state._activityUiPulse || 0) + 1;
    return;
  }

  // Ready: waits for user to enter via UI
  if (a.phase === "ready") return;

  if (a.phase === "returning") {
    if (state.travel?.active) return;
    a.phase = "await_result";
    return;
  }

  if (a.phase === "await_result") {
    if (a.resultsDueTotalDays && now < a.resultsDueTotalDays) return;
    const passed = !!a._passed;
    // Determine your position for "jackpot" moments
    let myPos = 0;
    try {
      myPos = (a.bracket?.scoreboard || []).findIndex(x => x.isPlayer) + 1;
    } catch { myPos = 0; }
    if (a.kind === "thi_huong") {
      if (passed) {
        p.danhVong += 50; p.hocVi = "Hương Cống"; p.uyTinCong += 30; p.ngoaiGiao = Math.min(100, p.ngoaiGiao + 3);
        logLine(state, "🏮 BẢNG VÀNG: Đỗ Hương Cống!", true);
        pushCelebration(state, "BẢNG VÀNG", `Bạn đỗ <strong>Hương Cống</strong>${myPos ? ` · xếp hạng <strong>#${myPos}</strong>` : ""}.`, "coin");
      }
      else { p.uyTinCong = Math.max(0, p.uyTinCong - 5); logLine(state, "TỦI NHỤC: Thi Hương rớt.", true); }
    } else if (a.kind === "thi_hoi") {
      if (passed) {
        p.danhVong += 150; p.hocVi = "Trúng Cách"; p.uyTinCong += 50;
        logLine(state, "🏯 VƯỢT VŨ MÔN: Đỗ Thi Hội (Trúng Cách)!", true);
        pushCelebration(state, "VƯỢT VŨ MÔN", `Bạn đỗ <strong>Thi Hội</strong>${myPos ? ` · xếp hạng <strong>#${myPos}</strong>` : ""}.`, "coin");
      }
      else { logLine(state, "Thi Hội rớt, mất mặt sĩ tử.", true); }
    } else if (a.kind === "thi_dinh") {
      if (passed) {
        p.danhVong += 500; p.hocVi = "Tiến Sĩ"; p.quyenLuc += 50; p.rank = PlayerRank.TRI_HUYEN; p.tien += 1000; p.uyTinCong += 200;
        logLine(state, "👑 TRẠNG NGUYÊN ĐĂNG KHOA! Đỗ Thi Đình!", true);
        const title = (myPos === 1) ? "TRẠNG NGUYÊN" : (myPos === 2) ? "BẢNG NHÃN" : (myPos === 3) ? "THÁM HOA" : "TIẾN SĨ";
        pushCelebration(state, "VINH QUY", `Bạn đỗ <strong>${title}</strong>${myPos ? ` · xếp hạng <strong>#${myPos}</strong>` : ""}!<br><br>Thưởng: +Uy Tín · +Danh Vọng · +1000Q · Bổ nhiệm Tri Huyện.`, "battle");
      }
      else { p.uyTinCong = Math.max(0, p.uyTinCong - 20); logLine(state, "Phạm húy nơi điện thí, bị đuổi!", true); }
    }
    // T3.1c: đỗ đạt -> dòng họ bảo trợ (nếu là họ cấp xã) nở mày nở mặt, vị thế tăng.
    if (passed && p._patronClanId) {
      const pc = state.clanById?.[p._patronClanId];
      if (pc && pc.scope === "xa") {
        adjustClanStatus(state, pc.id, a.kind === "thi_dinh" ? 12 : a.kind === "thi_hoi" ? 8 : 5);
        logLine(state, `🏮 ${pc.name} vẻ vang lây: người mình bảo trợ đỗ đạt, vị thế trong xã tăng.`, false);
      }
    }
    let rankTitle = null;
    if (a.kind === "thi_dinh" && passed && myPos > 0) {
      rankTitle = myPos === 1 ? "Trạng Nguyên" : myPos === 2 ? "Bảng Nhãn" : myPos === 3 ? "Thám Hoa" : "Tiến Sĩ";
    }
    try {
      state.lastVanExamArchive = {
        ban: state.ban,
        monthIndex: state.monthIndex,
        gameDay: state.gameDay,
        passed,
        rankPos: myPos,
        rankTitle,
        report: {
          title: a.title,
          kind: a.kind,
          bracket: JSON.parse(JSON.stringify(a.bracket || {})),
          logs: [...(a.logs || [])],
          pendingResult: false,
          roster: JSON.parse(JSON.stringify(a.roster || [])),
        },
      };
    } catch {
      state.lastVanExamArchive = {
        ban: state.ban,
        monthIndex: state.monthIndex,
        gameDay: state.gameDay,
        passed,
        rankPos: myPos,
        rankTitle,
        report: {
          title: a.title,
          kind: a.kind,
          bracket: a.bracket,
          logs: [...(a.logs || [])],
          pendingResult: false,
          roster: JSON.parse(JSON.stringify(a.roster || [])),
        },
      };
    }
    state._pendingExamResultModal = {
      passed,
      kind: a.kind,
      rankPos: myPos,
      rankTitle,
      report: state.lastVanExamArchive.report,
    };
    state.activity = null;
  }
}

export function runPlannedActivity(state) {
  const a = state.activity;
  if (!a?.active) return { ok: false, msg: "Không có hoạt động." };
  const now = totalDaysAbs(state);
  const p = state.player;
  if (a.phase !== "ready") return { ok: false, msg: "Chưa đến lúc hoặc đang trên đường." };
  if (now < a.startTotalDays) return { ok: false, msg: "Chưa đến ngày khai mạc." };
  if (!playerAtExamDest(p, a.dest)) {
    const v = a.venueShort || a.venueLabel || buildVenueLabelFromDest(state, a.dest, a.kind);
    return { ok: false, msg: `Chưa tới đúng địa điểm trung tâm. Phải có mặt tại: ${v} (không thi tại làng xã).` };
  }

  a.phase = "running";
  state.lastActivityReport = null;

  if (a.kind === "bac_cu") {
    const rosterSnap = JSON.parse(JSON.stringify(a.roster || []));
    resolveBacCu(state);
    state.lastActivityReport = { title: a.title, kind: a.kind, bracket: a.bracket, logs: a.logs, roster: rosterSnap };
    state.lastBacCuArchive = {
      ban: state.ban,
      monthIndex: state.monthIndex,
      gameDay: state.gameDay,
      report: state.lastActivityReport,
    };
    state.activity = null;
    return { ok: true, feedback: [{ text: "Lôi đài kết thúc", tone: "good" }], sfx: "battle" };
  }

  // Exams: resolve score now but announce later
  const passed = resolveExam(state, a.kind);
  state.lastActivityReport = {
    title: a.title,
    kind: a.kind,
    bracket: a.bracket,
    logs: a.logs,
    pendingResult: true,
    roster: JSON.parse(JSON.stringify(a.roster || [])),
  };
  logLine(state, `✍️ Kỳ ${a.title} kết thúc. Kết quả sẽ công bố sau.`, true);
  const homeDest = { regionId: p.homeRegion || p.currentRegion, phuId: p.homePhu || p.currentPhu, huyenId: p.homeHuyen || p.currentHuyen, tongId: p.homeTong || p.currentTong, xaId: p.homeXa || p.currentXa, langId: p.homeLang || p.currentLang };
  startTravel(state, homeDest, `Hồi hương chờ kết quả ${a.title}`, { roadEvents: true });
  a.phase = "returning";
  a._passed = passed;
  return { ok: true, feedback: [{ text: "Đã nộp bài", tone: "good" }], sfx: "murmur" };
}

// ================= WAR CONTROL (Huyện-level) ================= //
export function getHuyenControl(state, huyenId) {
  if (!state._huyenControl) state._huyenControl = {};
  return state._huyenControl[huyenId] || Faction.TRIEU_DINH;
}

/** Điều động đồn trú chiến lược (chia / thu / nâng cấp) — cần thực quyền chỉ huy trấn, không phải thứ dân. */
/** Chỉ quan văn trấn thủ / võ tướng cao — không giao quyền điều động đồn chiến lược cho bách hộ / chưởng cơ / cai cơ. */
const STRATEGIC_GARRISON_RANKS = new Set([
  PlayerRank.DOC_TRAN,
  PlayerRank.THAM_TUNG,
  PlayerRank.BOI_TUNG,
  PlayerRank.DO_DOC,
  PlayerRank.DO_CHI_HUY_SU,
  PlayerRank.DAI_TUONG,
  PlayerRank.TONG_LINH,
  PlayerRank.THU_LINH,
  PlayerRank.VUONG,
]);

export function canPlayerCommandStrategicGarrison(state) {
  return STRATEGIC_GARRISON_RANKS.has(state?.player?.rank);
}

function syncHuyenBannerFromXaBalance(state, huyenId) {
  if (!state._huyenControl) state._huyenControl = {};
  const geo = getLowerRegions(state, huyenId);
  if (!geo?.tong) return;
  let nq = 0;
  let td = 0;
  for (const t of Object.values(geo.tong)) {
    for (const x of Object.values(t.xa || {})) {
      if (x.control === Faction.NGHIA_QUAN) nq++;
      else td++;
    }
  }
  const tot = nq + td;
  if (!tot) return;
  if (nq / tot >= 0.55) state._huyenControl[huyenId] = Faction.NGHIA_QUAN;
  else if (td / tot >= 0.55) state._huyenControl[huyenId] = Faction.TRIEU_DINH;
}

/** Tuần phu / hương dân đoàn tái chiếm dần xã — không cần mũi chủ lực vạn người. */

function applyPartialLowerControl(state, huyenId, faction, captureMode = "contest") {
  const geo = getLowerRegions(state, huyenId);
  if (!geo?.tong) return;
  const allXa = [];
  for (const t of Object.values(geo.tong)) {
    for (const x of Object.values(t.xa || {})) allXa.push(x);
  }
  if (allXa.length === 0) return;
  let minShare = 0.14;
  let maxShare = 0.36;
  if (captureMode === "major") { minShare = 0.40; maxShare = 0.62; }
  if (captureMode === "soft") { minShare = 0.16; maxShare = 0.40; }
  if (captureMode === "insurgent") { minShare = 0.05; maxShare = 0.22; }
  const share = minShare + rng(state) * (maxShare - minShare);
  const want = Math.max(1, Math.min(allXa.length, Math.floor(allXa.length * share)));
  const picked = new Set();
  while (picked.size < want) picked.add(allXa[randInt(0, allXa.length - 1)]);
  for (const x of allXa) {
    x.control = picked.has(x) ? faction : (faction === Faction.NGHIA_QUAN ? Faction.TRIEU_DINH : Faction.NGHIA_QUAN);
  }
  // Derive tong control from majority of xa controls.
  for (const t of Object.values(geo.tong)) {
    const xaArr = Object.values(t.xa || {});
    const own = xaArr.filter(x => x.control === faction).length;
    t.control = own >= Math.ceil(xaArr.length / 2) ? faction : (faction === Faction.NGHIA_QUAN ? Faction.TRIEU_DINH : Faction.NGHIA_QUAN);
  }
}

export function setHuyenControl(state, huyenId, faction, captureMode = "contest") {
  if (!state._huyenControl) state._huyenControl = {};
  state._huyenControl[huyenId] = faction;
  // County control means dominance, not necessarily 100% communes.
  try { applyPartialLowerControl(state, huyenId, faction, captureMode); } catch {}
  if (state._huyenGarrisons?.[huyenId]) {
    const g = state._huyenGarrisons[huyenId];
    if (g.faction !== faction) delete state._huyenGarrisons[huyenId];
  }
}

function ensureVictoryState(state) {
  if (!state.victory || typeof state.victory !== "object") {
    state.victory = { offered: false, chosen: null, nextOfferYm: null };
  }
  if (!("offered" in state.victory)) state.victory.offered = false;
  if (!("chosen" in state.victory)) state.victory.chosen = null;
  if (!("nextOfferYm" in state.victory)) state.victory.nextOfferYm = null;
}

function currentYmSerial(state) {
  return (state.ban || 1737) * 12 + (state.monthIndex || 1);
}

/** Theo cờ huyện (có bias: huyện chưa từng đánh vẫn mặc định triều đình). Dùng cho phe nghĩa quân / ngưỡng đất rộng. */

/** Thực địa từng xã — tránh “huyện chưa chạm vẫn tính triều đình” khiến kết cục Trung Hưng ảo. */
function collectXaFactionStats(state) {
  const regions = getAllRegions();
  let td = 0, nq = 0;
  for (const r of regions) {
    for (const ph of Object.values(r.phu || {})) {
      for (const h of Object.values(ph.huyen || {})) {
        const hid = h.id;
        if (!hid) continue;
        const geo = getLowerRegions(state, hid);
        if (!geo?.tong) continue;
        for (const t of Object.values(geo.tong)) {
          for (const x of Object.values(t.xa || {})) {
            if (x.control === Faction.NGHIA_QUAN) nq++;
            else td++;
          }
        }
      }
    }
  }
  const total = Math.max(1, td + nq);
  return { total, td, nq };
}

// --- Chiến báo gộp theo trấn (khu vực), tránh spam log / marquee --- //

/**
 * Ghi một “mũi đánh” vào buffer theo trấn; sau vài ngày game sẽ gộp thành một dòng trong tab Sự kiện.
 * incident: { kind, scale, place, attackers, defenders, winner:'nq'|'td'|'draw', atkCas, defCas, note? }
 */

/** Gộp buffer chiến sự theo năm game (mỗi trấn một dòng + chi tiết bấm mở). */

/** Giành giật xã/tổng trong huyện mặt trận — bổ sung “đánh liên tục” cấp thấp. */

/** Vừa có tập kích / đổi chủ huyện trên bản đồ chiến lược — tin “Quốc cục đã định” sẽ mâu thuẫn. */

/** Còn huyện mặt trận lịch sử đang nằm trong tay nghĩa quân — chưa thể tuyên “khép loạn toàn cõi”. */

/** Còn mặt trận đang hỗn chiến hoặc vừa có biến động tiền tuyến — không mở kết cục “Trung Hưng” ảo. */

function tryOfferVictoryChoice(state) {
  if (state.gameOver || state.pendingEvent || inboxFull(state)) return;
  ensureVictoryState(state);
  if (state.victory.chosen) return;
  const ym = currentYmSerial(state);
  if (state.victory.nextOfferYm && ym < state.victory.nextOfferYm) return;
  const p = state.player;
  if (!p) return;

  // (bước 12) đếm huyện theo phe — thay collectWarControlStats() đã xoá cùng war/legacy.js
  const controlHuyen = (() => {
    let nq = 0, td = 0;
    for (const r of getAllRegions()) for (const ph of Object.values(r.phu || {})) for (const h of Object.values(ph.huyen || {})) {
      if (getHuyenControl(state, h.id) === Faction.NGHIA_QUAN) nq++; else td++;
    }
    return { nq, td, total: Math.max(1, nq + td) };
  })();
  const ratioNq = controlHuyen.nq / controlHuyen.total;
  const controlsKinhKy = getHuyenControl(state, "tho_xuong") === Faction.NGHIA_QUAN
    || getHuyenControl(state, "quang_duc") === Faction.NGHIA_QUAN
    || getHuyenControl(state, "gia_lam") === Faction.NGHIA_QUAN;

  if (p.faction === Faction.NGHIA_QUAN) {
    const fac = 1.0;
    const canPhoLe = ratioNq >= (0.42 * fac) && controlsKinhKy && (p.danhVong || 0) >= Math.floor(380 * fac);
    const canXungVuong = ratioNq >= (0.55 * fac) && (p.quanSo || 0) >= Math.floor(1800 * fac) && (p.tien || 0) >= Math.floor(2500 * fac) && (p.danhVong || 0) >= Math.floor(520 * fac);
    const canLapTanChua = ratioNq >= (0.48 * fac) && controlsKinhKy && (p.quanSo || 0) >= Math.floor(1200 * fac) && (p.danhVong || 0) >= Math.floor(430 * fac);
    if (!canPhoLe && !canXungVuong && !canLapTanChua) return;
    state.victory.offered = true;
    state.pendingEvent = {
      id: "ending_rebel_choice",
      blocking: true,
      title: "🏴 Thiên Hạ Đã Nghiêng",
      narrative: "Nghĩa quân của ngươi đã thành thế lớn. Nay là lúc chọn đại cục: phò Lê diệt Trịnh hay tự lập vương quyền.",
      choices: [
        ...(canPhoLe ? [{
          label: "Phò Lê diệt Trịnh, dựng lại chính thống",
          impact: [{ label: "Kết thúc: Trung hưng", color: "#74c0fc" }],
          apply(s) {
            s.victory.chosen = "rebel_restore_le";
            s.gameOver = true;
            s.gameOverType = "win";
            s.gameOverReason = "Đại nghiệp thành: bạn phò Lê diệt Trịnh, trở thành công thần khai quốc.";
            logLine(s, "🏁 ĐẠI KẾT CỤC: Nghĩa quân thắng thế, bạn chọn con đường phò Lê phục quốc.", true);
          }
        }] : []),
        ...(canXungVuong ? [{
          label: "Tự lập làm Vương, mở triều mới",
          impact: [{ label: "Kết thúc: Xưng vương", color: "#ffd43b" }],
          apply(s) {
            s.victory.chosen = "rebel_crown_self";
            s.gameOver = true;
            s.gameOverType = "win";
            s.gameOverReason = "Đại nghiệp thành: bạn xưng Vương, tự lập cơ nghiệp mới ở Đàng Ngoài.";
            logLine(s, "🏁 ĐẠI KẾT CỤC: Bạn xưng Vương, khai mở triều đại mới.", true);
          }
        }] : []),
        ...(canLapTanChua ? [{
          label: "Phế họ Trịnh, tự lập Tân Chúa (kiểu Chúa Vương)",
          impact: [{ label: "Kết thúc: Tân Chúa", color: "#ffa94d" }],
          apply(s) {
            s.victory.chosen = "rebel_new_lord";
            s.gameOver = true;
            s.gameOverType = "win";
            s.gameOverReason = "Đại nghiệp thành: bạn phế quyền họ Trịnh, tự lập Tân Chúa thống lĩnh Đàng Ngoài.";
            logLine(s, "🏁 ĐẠI KẾT CỤC: Bạn trở thành Tân Chúa, nắm thực quyền thay họ Trịnh.", true);
          }
        }] : []),
        {
          label: "Chưa vội, tiếp tục chinh chiến",
          impact: [{ label: "Trì hoãn", color: "#aaa" }],
          apply(s) {
            ensureVictoryState(s);
            s.victory.nextOfferYm = currentYmSerial(s) + 6;
            logLine(s, "Bạn tạm gác đại kết cục, tiếp tục chinh chiến thêm một thời gian.", false);
          }
        }
      ]
    };
    return;
  }

  if (p.faction === Faction.TRIEU_DINH) {
    const fac = 1.0;
    const xaC = collectXaFactionStats(state);
    const ratioTdXa = xaC.td / xaC.total;
    const ratioNqXa = xaC.nq / xaC.total;
    // (bước 12) "chiến sự đang sôi" = còn huyện phe đối lập với người chơi kiểm soát trong phủ nhà.
    const warRaging = (() => {
      const hp = getRegion(state.player.homeRegion)?.phu?.[state.player.homePhu];
      const opp = state.player.faction === Faction.NGHIA_QUAN ? Faction.TRIEU_DINH : Faction.NGHIA_QUAN;
      for (const h of Object.values(hp?.huyen || {})) if (getHuyenControl(state, h.id) === opp) return true;
      return false;
    })();
    const highRank = [PlayerRank.HIEN_SAT_SU, PlayerRank.THUONG_THU, PlayerRank.THUA_CHINH_SU, PlayerRank.DOC_TRAN, PlayerRank.THAM_TUNG, PlayerRank.BOI_TUNG].includes(p.rank);
    // Không dùng tỉ lệ huyện (mặc định triều nếu chưa ghi) — theo xã + không tiền tuyến nóng + không còn huyện cối nghĩa quân.
    // (bước 12) còn huyện trận-lịch-sử nào do nghĩa quân giữ?
    const majorFrontClear = !(() => {
      for (const r of getAllRegions()) for (const ph of Object.values(r.phu || {})) for (const h of Object.values(ph.huyen || {})) {
        if (h.historicalBattle && getHuyenControl(state, h.id) === Faction.NGHIA_QUAN) return true;
      }
      return false;
    })();
    const canTrungHung = !warRaging
      && majorFrontClear
      && ratioNqXa <= (0.055 / fac)
      && ratioTdXa >= (0.83 * fac)
      && (p.uyTinCong || 0) >= Math.floor(280 * fac);
    const po = getPosting(state);
    const canCaiCach = !warRaging
      && majorFrontClear
      && ratioNqXa <= (0.095 / fac)
      && ratioTdXa >= (0.74 * fac)
      && highRank
      && (po ? (po.corruption || 0) <= Math.ceil(20 / fac) : true)
      && (state.village?.unrest || 0) <= Math.ceil(35 / fac);
    if (!canTrungHung && !canCaiCach) return;
    state.victory.offered = true;
    state.pendingEvent = {
      id: "ending_court_choice",
      blocking: true,
      title: "🏯 Quốc Cục Đã Định",
      narrative: "Theo sổ xã và cờ huyện mặt trận lịch sử: không còn tiền tuyến đang đổi màu gần đây, nghĩa quân cũng đã lui khỏi các cứ điểm lớn. Khi ấy mới hợp để chốt đại nghiệp (bình định hay cải cách).",
      choices: [
        ...(canTrungHung ? [{
          label: "Tuyên cáo Trung Hưng, khép loạn toàn cõi",
          impact: [{ label: "Kết thúc: Trung hưng", color: "#74c0fc" }],
          apply(s) {
            s.victory.chosen = "court_pacified";
            s.gameOver = true;
            s.gameOverType = "win";
            s.gameOverReason = "Đại nghiệp thành: bạn giúp triều đình bình định loạn cục, tái lập kỷ cương quốc gia.";
            logLine(s, "🏁 ĐẠI KẾT CỤC: Triều đình trung hưng thành công dưới tay bạn.", true);
          }
        }] : []),
        ...(canCaiCach ? [{
          label: "Đẩy cải cách phủ-trấn, chấn hưng quốc chính",
          impact: [{ label: "Kết thúc: Cải cách", color: "#51cf66" }],
          apply(s) {
            s.victory.chosen = "court_reform";
            s.gameOver = true;
            s.gameOverType = "win";
            s.gameOverReason = "Đại nghiệp thành: bạn chấn chỉnh phủ-trấn, mở thời kỳ cải cách ổn định lâu dài.";
            logLine(s, "🏁 ĐẠI KẾT CỤC: Quốc chính được cải cách, dân sinh hồi phục.", true);
          }
        }] : []),
        {
          label: "Chưa kết cục, tiếp tục trị quốc",
          impact: [{ label: "Trì hoãn", color: "#aaa" }],
          apply(s) {
            ensureVictoryState(s);
            s.victory.nextOfferYm = currentYmSerial(s) + 6;
            logLine(s, "Bạn tạm chưa chốt kết cục, tiếp tục trị quốc thêm một thời gian.", false);
          }
        }
      ]
    };
  }
}

function getHuyenGarrisonTroops(state, huyenId, faction) {
  if (!state._huyenGarrisons?.[huyenId]) return 0;
  const g = state._huyenGarrisons[huyenId];
  if (g.faction !== faction) return 0;
  return Math.max(0, Math.floor(g.quan || 0));
}

function getHuyenGarrisonPower(state, huyenId, faction) {
  if (!state._huyenGarrisons?.[huyenId]) return 0;
  const g = state._huyenGarrisons[huyenId];
  if (g.faction !== faction) return 0;
  const q = Math.max(0, Math.floor(g.quan || 0));
  const lvl = Math.max(1, Math.min(3, Math.floor(g.level || 1)));
  const morale = Math.max(0, Math.min(100, Math.floor(g.morale ?? 70)));
  const lvlMult = 1 + (lvl - 1) * 0.35;
  const morMult = 0.70 + morale / 200; // 0.70 → 1.20
  return Math.floor(q * lvlMult * morMult);
}

/** Để lại bộ phận quân giữ huyện đang làm chủ (chia quân đồn trú). */
export function actionAssignGarrison(state, amount) {
  const p = state.player;
  if (!canPlayerCommandStrategicGarrison(state)) {
    return { ok: false, msg: "Chỉ quan trấn thủ (Đốc trấn trở lên) hoặc võ tướng cao được triều công nhận mới điều động đồn trú phe — không phải bách hộ / chưởng cơ / cai cơ." };
  }
  if (p.dangOm) return { ok: false, msg: "Đang ốm liệt giường." };
  if (isTraveling(state)) return { ok: false, msg: "Đang hành quân." };
  const hid = p.currentHuyen;
  if (getHuyenControl(state, hid) !== p.faction) return { ok: false, msg: "Chưa làm chủ huyện này — không thể đồn trú." };
  const n = Math.max(0, Math.floor(Number(amount)));
  if (n < 40) return { ok: false, msg: "Tối thiểu 40 quân để lại đồn trú." };
  const minField = 30;
  if (p.quanSo < n + minField) return { ok: false, msg: `Cần giữ ít nhất ${minField} quân trong đội thân binh.` };
  if (!state._huyenGarrisons) state._huyenGarrisons = {};
  const prev = state._huyenGarrisons[hid];
  const prevQ = (prev && prev.faction === p.faction) ? (prev.quan || 0) : 0;
  p.quanSo -= n;
  const prevLvl = (prev && prev.faction === p.faction) ? (prev.level || 1) : 1;
  const prevMor = (prev && prev.faction === p.faction) ? (prev.morale ?? 70) : 70;
  state._huyenGarrisons[hid] = { faction: p.faction, quan: prevQ + n, level: prevLvl, morale: prevMor };
  logLine(state, `🪖 Đồn trú ${n} quân tại ${hid}. Tổng trấn thủ: ${prevQ + n}.`, true);
  return { ok: true, feedback: [{ text: `Đồn trú +${n}`, tone: "good" }, { text: `−${n} quân chủ lực`, tone: "bad" }], sfx: "battle" };
}

/** Thu toàn bộ quân đồn trú tại huyện đang đứng. */
export function actionRecallGarrison(state) {
  const p = state.player;
  if (!canPlayerCommandStrategicGarrison(state)) {
    return { ok: false, msg: "Chỉ quan trấn thủ (Đốc trấn trở lên) hoặc võ tướng cao được triều công nhận mới điều động đồn trú phe — không phải bách hộ / chưởng cơ / cai cơ." };
  }
  if (p.dangOm) return { ok: false, msg: "Đang ốm liệt giường." };
  if (isTraveling(state)) return { ok: false, msg: "Đang hành quân." };
  const hid = p.currentHuyen;
  if (!state._huyenGarrisons?.[hid]) return { ok: false, msg: "Không có quân đồn trú ở đây." };
  const g = state._huyenGarrisons[hid];
  if (g.faction !== p.faction) return { ok: false, msg: "Đồn trú không thuộc phe bạn." };
  if (getHuyenControl(state, hid) !== p.faction) return { ok: false, msg: "Huyện không còn trong tay bạn — không thu hồi được." };
  const q = Math.max(0, Math.floor(g.quan || 0));
  if (q <= 0) return { ok: false, msg: "Không có quân để thu hồi." };
  p.quanSo += q;
  delete state._huyenGarrisons[hid];
  logLine(state, `📣 Thu hồi ${q} quân đồn trú vào đội chủ lực.`, true);
  return { ok: true, feedback: [{ text: `+${q} quân`, tone: "good" }], sfx: "murmur" };
}

/** Nâng cấp chất lượng đồn trú tại huyện đang đứng (cấp 1→3). */
export function actionUpgradeGarrison(state) {
  const p = state.player;
  if (!canPlayerCommandStrategicGarrison(state)) {
    return { ok: false, msg: "Chỉ quan trấn thủ (Đốc trấn trở lên) hoặc võ tướng cao được triều công nhận mới điều động đồn trú phe — không phải bách hộ / chưởng cơ / cai cơ." };
  }
  if (p.dangOm) return { ok: false, msg: "Đang ốm liệt giường." };
  if (isTraveling(state)) return { ok: false, msg: "Đang hành quân." };
  const hid = p.currentHuyen;
  const g = state._huyenGarrisons?.[hid];
  if (!g || g.faction !== p.faction) return { ok: false, msg: "Không có đồn trú của phe bạn ở đây." };
  if (getHuyenControl(state, hid) !== p.faction) return { ok: false, msg: "Huyện không còn trong tay bạn." };
  const cur = Math.max(1, Math.min(3, Math.floor(g.level || 1)));
  if (cur >= 3) return { ok: false, msg: "Đồn trú đã tối đa (cấp 3)." };

  const store = state.factions?.[(p.faction === Faction.NGHIA_QUAN) ? "nghiaQuan" : "trieuDinh"];
  if (!store) return { ok: false, msg: "Không có kho phe để nâng cấp." };

  const next = cur + 1;
  const q = Math.max(0, Math.floor(g.quan || 0));
  const costQ = Math.max(120, Math.floor((q / 12) * next * 1.35)); // tiền vật tư
  const costG = Math.max(45,  Math.floor((q / 18) * next * 1.25)); // thóc vận tải

  if ((store.treasury || 0) < costQ) return { ok: false, msg: `Kho bạc phe không đủ (cần ${costQ}Q).` };
  if ((store.granary || 0) < costG) return { ok: false, msg: `Kho thóc phe không đủ (cần ${costG} thóc).` };

  store.treasury -= costQ;
  store.granary -= costG;
  g.level = next;
  g.morale = Math.min(100, Math.floor((g.morale ?? 70) + 14 + next * 2));

  logLine(state, `🏗️ Nâng cấp đồn trú ${hid} lên cấp ${next}. (−${costQ}Q, −${costG} thóc)`, true);
  return { ok: true, feedback: [{ text: `Đồn trú cấp ${next}`, tone: "good" }, { text: `-${costQ}Q`, tone: "bad" }, { text: `-${costG} thóc`, tone: "bad" }], sfx: "coin" };
}

export function siegeHuyen(state, regionId, phuId, huyenId) {
  const p = state.player;
  if (p.dangOm) return { ok: false, msg: "Đang ốm liệt giường." };
  if (p.theLuc < 50) return { ok: false, msg: "Cần 50 Thể lực để công thành." };
  if (p.quanSo < 50) return { ok: false, msg: "Cần ít nhất 50 quân để công huyện." };

  const current = getHuyenControl(state, huyenId);
  const mySide = p.faction === Faction.NGHIA_QUAN ? Faction.NGHIA_QUAN : Faction.TRIEU_DINH;
  const enemy = mySide === Faction.NGHIA_QUAN ? Faction.TRIEU_DINH : Faction.NGHIA_QUAN;
  if (current === mySide) return { ok: false, msg: "Huyện này đã nằm trong tay phe bạn." };

  p.theLuc -= 50;

  // Defender: quân triều đình thủ ải mạnh hơn; cộng thêm đồn trú của phe thủ thành.
  let defCount = Math.max(80, Math.floor(p.quanSo * 0.65));
  if (enemy === Faction.TRIEU_DINH) {
    defCount = Math.max(150, Math.floor(p.quanSo * 0.78) + 95);
  }
  defCount += getHuyenGarrisonPower(state, huyenId, enemy);
  const attacker = {
    name: mySide === Faction.NGHIA_QUAN ? p.name : `Quân Triều Đình của ${p.name}`,
    armies: [{ type: "dan_binh", count: p.quanSo, morale: 85 }],
    martial: p.voThuat || 10,
    qualityMult: mySide === Faction.TRIEU_DINH ? 1.05 : 0.9,
    isSiegeAtk: true,
    isPlayer: true,
    knights: Math.floor((p.danhVong || 0) / 200),
  };
  const defender = {
    name: enemy === Faction.NGHIA_QUAN ? "Nghĩa quân thủ huyện" : "Quân triều đình thủ huyện",
    armies: [{ type: "dan_binh", count: defCount, morale: enemy === Faction.TRIEU_DINH ? 78 : 75 }],
    martial: enemy === Faction.TRIEU_DINH ? 18 : 15,
    qualityMult: enemy === Faction.TRIEU_DINH ? 1.08 : 0.85,
    knights: enemy === Faction.TRIEU_DINH ? 2 : 1,
  };

  const sim = simulateBattle(attacker, defender, state);
  const win = sim.winner === attacker.name;

  const lost = Math.max(0, p.quanSo - (sim.remainingAttacker || 0));
  p.quanSo = Math.max(0, sim.remainingAttacker || 0);

  if (win) {
    setHuyenControl(state, huyenId, mySide, "major");
    // Auto-leave a small occupying force so newly captured land is not instantly empty.
    let autoHold = 0;
    if (p.quanSo >= 80) {
      autoHold = Math.min(180, Math.max(40, Math.floor(p.quanSo * 0.18)));
      if (p.quanSo - autoHold >= 30) {
        if (!state._huyenGarrisons) state._huyenGarrisons = {};
        const prev = state._huyenGarrisons[huyenId];
        const prevQ = (prev && prev.faction === mySide) ? (prev.quan || 0) : 0;
        state._huyenGarrisons[huyenId] = { faction: mySide, quan: prevQ + autoHold, level: 1, morale: 72 };
        p.quanSo -= autoHold;
      } else {
        autoHold = 0;
      }
    }
    logLine(state, `🏰 CHIẾN THẮNG: Công huyện thành công. ${huyenId} đã đổi cờ! (Tổn thất ${lost}${autoHold > 0 ? `, để lại đồn trú ${autoHold}` : ""})`, true);
    return { ok: true, feedback: [{ text: `🏰 Công huyện thắng`, tone: "good" }, { text: `-${lost} Quân`, tone: "bad" }, ...(autoHold > 0 ? [{ text: `Đồn trú ${autoHold}`, tone: "bad" }] : [])], sfx: "battle", battleLogs: sim.battleLogs };
  } else {
    logLine(state, `🏰 THẤT BẠI: Công huyện thất bại. Tổn thất ${lost} quân, phải rút lui.`, true);
    return { ok: true, feedback: [{ text: `Công huyện thất bại`, tone: "bad" }, { text: `-${lost} Quân`, tone: "bad" }], sfx: "caiVa", battleLogs: sim.battleLogs };
  }
}

// ================= DYNAMIC ACTIONS ================= //

// ================= REBEL-ONLY ACTIONS ================= //
function ensureRebel(state) {
  const p = state.player;
  if (p.dangOm) return { ok: false, msg: "Đang ốm liệt giường." };
  if (p.faction !== Faction.NGHIA_QUAN) return { ok: false, msg: "Chỉ nghĩa quân mới làm được việc này." };
  return null;
}

function isControlledByRebelsHere(state) {
  const p = state.player;
  const hCtrl = getHuyenControl(state, p.currentHuyen);
  if (hCtrl === Faction.NGHIA_QUAN) return true;
  const geo = getLowerRegions(state, p.currentHuyen);
  const xaObj = geo?.tong?.[p.currentTong]?.xa?.[p.currentXa];
  return xaObj?.control === Faction.NGHIA_QUAN;
}

// ================= PRISONERS ================= //
function nextPrisonerId(state) {
  state._prisonerSeq = (state._prisonerSeq || 1) + 1;
  return `pr_${state._prisonerSeq}_${Math.floor(rng(state) * 9999)}`;
}

export const MaaDb = {
  dan_binh:    { id:"dan_binh",    name:"Dân binh cơ bản",       type:"Pháo Hôi", quanSo: 500, cost: 500,  unlock:"doanh_trai" },
  nhat_binh:   { id:"nhat_binh",   name:"Nhất Binh (Ngoại binh)",type:"Bộ Binh",  quanSo: 500, cost: 1000, unlock:"doanh_trai" },
  bo_binh_nang:{ id:"bo_binh_nang",name:"Bộ Binh Tráng Khảm",    type:"Bộ Binh Nặng", quanSo: 300, cost: 1500, unlock:"luyen_binh_truong" },
  thuong_binh: { id:"thuong_binh", name:"Trường Thương Binh",    type:"Thương Binh", quanSo: 400, cost: 1200, unlock:"luyen_binh_truong" },
  cung_no:     { id:"cung_no",     name:"Cung Nỏ Trận",          type:"Cung Nỏ",  quanSo: 400, cost: 1500, unlock:"kho_vu_khi" },
  dieu_thuong: { id:"dieu_thuong", name:"Súng Điểu Thương",      type:"Hỏa Khí",  quanSo: 300, cost: 2500, unlock:"kho_vu_khi" },
  khinh_ky:    { id:"khinh_ky",    name:"Khinh Kỵ Do Thám",      type:"Khinh Kỵ", quanSo: 200, cost: 2000, unlock:"luyen_binh_truong" },
  trong_ky:    { id:"trong_ky",    name:"Thiết Kỵ Xuyên Trận",   type:"Trọng Kỵ", quanSo: 200, cost: 4000, unlock:"dai_doanh" },
  tuong_binh:  { id:"tuong_binh",  name:"Tượng Binh Càn Quét",   type:"Voi Chiến",quanSo: 50,  cost: 5000, unlock:"dai_doanh" },
  phao_binh:   { id:"phao_binh",   name:"Đại Bác Thần Công",     type:"Pháo Binh",quanSo: 50,  cost: 8000, unlock:"dai_doanh" },
  thuy_quan:   { id:"thuy_quan",   name:"Chiến Thuyền Giao Châu",type:"Thủy Quân", quanSo: 400, cost: 2500, unlock:"thuy_doanh" },
};

const MARKET_TRADER_NAMES = [
  "Lái buôn Phúc Lộc", "Gánh hàng Hồng Vân", "Phường thương Đông Kỳ", "Thuyền chủ Cẩm Hải", "Trùm nậu Vạn Xuân"
];
const MARKET_MOODS = [
  { key: "boom", label: "Phiên chợ đông", buyMul: 1.06, sellMul: 1.10 },
  { key: "fair", label: "Phiên chợ thường", buyMul: 1.0, sellMul: 1.0 },
  { key: "slump", label: "Phiên chợ ế", buyMul: 0.94, sellMul: 0.90 },
];

export function actionTangRuouNPC(state, npcId) {
  const p = state.player;
  const npc = state.npcById[npcId];
  if (p.inventory.ruou < 1) return { ok: false, msg: "Không có rượu trong hành trang!" };
  p.inventory.ruou -= 1;
  const mult = perkFx(state, "ruouMult", 1.0) || 1.0;
  npc.opinion += Math.floor(randInt(10, 20) * mult);
  npc.opinion = Math.min(100, npc.opinion);
  p.ngoaiGiao = Math.min(100, p.ngoaiGiao + 0.5);
  logLine(state, `Mời ${npc.name} chén rượu, tình cảm đi lên.`);
  return { ok: true, feedback: [{ text: "Tình cảm tăng", tone: "good" }], sfx: "murmur" };
}

// ================= AI LOOP ================= //

function simulateConquest(state, npc, flag) {
  const region = getRegion(npc.currentRegion);
  if (!region || !region.phu) return;
  const phuKeys = Object.keys(region.phu);
  if (phuKeys.length === 0) return;
  const randPhuId = phuKeys[randInt(0, phuKeys.length - 1)];
  const phu = region.phu[randPhuId];
  if (!phu || !phu.huyen) return;
  const huyenKeys = Object.keys(phu.huyen);
  if (huyenKeys.length === 0) return;
  const randHuyenId = huyenKeys[randInt(0, huyenKeys.length - 1)];

  const geoData = getLowerRegions(state, randHuyenId);
  if (!geoData || !geoData.tong) return;

  const tongKeys = Object.keys(geoData.tong);
  if (tongKeys.length === 0) return;
  const tongObj = geoData.tong[tongKeys[randInt(0, tongKeys.length - 1)]];

  const xaKeys = Object.keys(tongObj.xa);
  if (xaKeys.length === 0) return;

  // Chỉ chọn Xã mà mình chưa kiểm soát (tránh lãng phí action vào đất sẵn của mình)
  const enemyFlag = flag === "nghia_quan" ? "trieu_dinh" : "nghia_quan";
  const eligibleXaKeys = xaKeys.filter(k => tongObj.xa[k].control === enemyFlag);
  if (eligibleXaKeys.length === 0) return; // Không có đất của địch để chiếm

  const targetXaKey = eligibleXaKeys[randInt(0, eligibleXaKeys.length - 1)];
  const xaObj = tongObj.xa[targetXaKey];

  xaObj.control = flag;

  // Kiểm tra nếu đạt ≥ 80% Xã trong Tổng thì Tổng đổi cờ
  let controlledXa = 0;
  for (let xk of xaKeys) {
    if (tongObj.xa[xk].control === flag) controlledXa++;
  }
  if (controlledXa / xaKeys.length >= 0.8) {
    tongObj.control = flag;
  }

  const actionStr = flag === "nghia_quan" ? "đánh chiếm" : "thu phục";
  if (rng(state) < 0.3) {
    logLine(state, `Cấp báo: Đạo quân của ${npc.name} vừa ${actionStr} ${xaObj.name} (${tongObj.name}, ${phu.huyen[randHuyenId]?.name || ""}).`);
  }
  if (flag === "nghia_quan") {
    state.village.unrest = Math.min(100, state.village.unrest + 2);
  } else {
    // Thu phục lại đất thì giảm bất ổn nhẹ
    state.village.unrest = Math.max(0, state.village.unrest - 1);
  }
}

function updateEconomy(state) {
  let weatherMult = 1.0;
  if (state.thoiTiet === Weather.HAN) weatherMult = 0.5;
  else if (state.thoiTiet === Weather.LU) weatherMult = 0.6;

  if (weatherMult < 1.0) {
    state.marketPriceThoc += 0.5;
    state.village.unrest += 5;
  } else {
    state.marketPriceThoc = Math.max(1.0, state.marketPriceThoc - 0.2);
  }

  let need = Math.floor(totalPops(state.village) * 0.2);
  if (state.village.khoThoc >= need) {
    state.village.khoThoc -= need;
    state.village.unrest = Math.max(0, state.village.unrest - 2);
  } else {
    state.village.khoThoc = 0;
    state.village.unrest += 10;
    state.village.pops.nong = Math.max(10, state.village.pops.nong - randInt(2, 5));
    if (rng(state) < 0.3) logLine(state, "Dân đói, lúa cạn. Có kẻ bỏ xứ mà đi.");
  }
  
  // Biến động giá hàng ngày mô phỏng cung cầu (tăng giảm 10%)
  state.marketPriceFluctuation = 0.9 + rng(state) * 0.2;
}

function updateNPCs(state) {
  const p = state.player;
  for (let npc of state.npcs) {
    npc.tien += randInt(0, 3);

    // If player is rebel: all court NPCs hate you to the max
    if (p.faction === Faction.NGHIA_QUAN && npc.faction === Faction.TRIEU_DINH) {
      npc.opinion = -100;
    }

    if (npc.disposition.includes(NpcTrait.THAM_LAM) && npc.tien > 50) {
      npc.tien -= 40;
      npc.uyTinCong += 15;
      let clan = state.clanById[npc.clanId];
      if (clan) clan.quyenLuc += 10;
      if (rng(state) < 0.05) logLine(state, `${npc.name} mới đút lót lên quan phủ.`);
    }

    if (npc.opinion < -20 && Object.values(state.officials).includes(npc.id)) {
      if (rng(state) < 0.05 && state.player.tien > 0) {
        let phat = randInt(5, 15);
        state.player.tien = Math.max(0, state.player.tien - phat);
        logLine(state, `${npc.name} kiếm cớ phạt vạ bạn ${phat} quan vì tư thù!`);
      }
    }

    // NPC thù địch chủ động (dopamine = kịch tính): mỗi tháng có cơ hội gây hại thật sự
    // When player is rebel, court NPCs cannot easily sabotage you directly; betrayal comes from spies / same-side rivals.
    const canSabotage =
      (p.faction !== Faction.NGHIA_QUAN) ||
      (p.faction === Faction.NGHIA_QUAN && npc.faction === Faction.NGHIA_QUAN);
    if (canSabotage && npc.opinion <= -50 && rng(state) < 0.05) {
      const roll = randInt(1, 4);
      if (roll === 1) {
        // Đầu độc nhẹ
        p.theLuc = Math.max(0, p.theLuc - randInt(20, 45));
        if (p.theLuc === 0) p.dangOm = true;
        logLine(state, `⚠️ ÂM MƯU: ${npc.name} thuê người bỏ thuốc vào đồ ăn. Thể lực suy sụp!`, true);
        state.marqueeQueue.push(`Âm mưu ám hại: ${npc.name} ra tay!`);
      } else if (roll === 2) {
        // Trộm tiền
        const lost = Math.min(p.tien, randInt(20, 120));
        p.tien -= lost;
        logLine(state, `⚠️ BỊ HÃM HẠI: Gia nhân báo mất ${lost} quan. Dấu vết chỉ về ${npc.name}...`, true);
      } else if (roll === 3) {
        // Đốt kho thóc
        const lost = Math.min(p.thocCaNhan, randInt(10, 60));
        p.thocCaNhan -= lost;
        logLine(state, `🔥 PHÓNG HỎA: Kho thóc cháy đen. Mất ${lost} thóc. Có kẻ muốn bạn kiệt quệ!`, true);
      } else {
        // Dằn mặt: tụt uy tín
        const uy = randInt(10, 25);
        p.uyTinCong = Math.max(0, p.uyTinCong - uy);
        logLine(state, `⚠️ BÔI NHỌ: Tin đồn độc địa lan ra từ miệng ${npc.name}. Uy tín -${uy}.`, true);
      }
    }

    // World activity: NPCs live without you (low-frequency headlines)
    if (rng(state) < 0.02) {
      const r = randInt(1, 5);
      if (r === 1) logLine(state, `Tin đồn: ${npc.name} vừa gả cưới kết thân với một nhà giàu có.`);
      else if (r === 2) logLine(state, `Chợ phiên: ${npc.name} gom hàng tích trữ, giá cả xôn xao.`);
      else if (r === 3) logLine(state, `Quán rượu: ${npc.name} gây sự đánh nhau, danh tiếng lan truyền.`);
      else if (r === 4) logLine(state, `Trên đường quan: đoàn người của ${npc.name} đi nhậm chức/đi buôn qua vùng khác.`);
      else logLine(state, `Nha môn: ${npc.name} bị tố tham ô, bị điều tra lặng lẽ.`);
    }

    // Khởi nghĩa từ dân
    if (state.village.unrest > 70 && npc.disposition.includes(NpcTrait.HIEP_NGHIA) && npc.quanSo === 0 && npc.tien > 30) {
      npc.tien -= 30;
      npc.quanSo += 15;
      npc.rank = PlayerRank.THU_LINH;
      npc.faction = Faction.NGHIA_QUAN;
      npc.armies = [{ type: "dan_binh", count: 15, morale: 80 }];
      logLine(state, `TIN DỮ! ${npc.name} thấy dân oan khuất, đã chiêu mộ nổi dậy!`, true);
    }

    // AI Warfare: Khởi nghĩa và Quân Triều Đình
    if (npc.quanSo > 0) {
      if (!npc.armies) npc.armies = [{ type: npc.faction === Faction.TRIEU_DINH ? "nhat_binh" : "dan_binh", count: npc.quanSo, morale: 60, level: 1 }];
      
      // NPC Economy & Upgrading
      npc.tien += randInt(2, 10); // Thu nhập cơ bản
      if (npc.faction === Faction.TRIEU_DINH) npc.tien += 20; // Triều đình thu thuế nhanh giàu
      
      // Upgrade MAA for NPCs
      if (rng(state) < 0.1 && npc.armies.length < 5 && npc.tien > 1000) {
         let newType = npc.faction === Faction.TRIEU_DINH 
              ? ["nhat_binh", "uu_binh", "trong_ky", "phao_binh"][randInt(0,3)] 
              : ["dan_binh", "thuong_binh", "cung_no", "khinh_ky"][randInt(0,3)];
         if (!npc.armies.find(a => a.type === newType)) {
             npc.armies.push({ type: newType, count: 200, morale: 70, level: 1 });
             npc.quanSo += 200;
             npc.tien -= 1000;
         }
      }
      // Upgrade existing NPC MAA
      if (rng(state) < 0.2 && npc.tien >= 1500 && npc.armies.length > 0) {
         let targetMaa = npc.armies[randInt(0, npc.armies.length - 1)];
         if ((targetMaa.level || 1) < 10) {
             let bonusCount = targetMaa.type === "phao_binh" ? 20 : 300;
             targetMaa.count += bonusCount;
             targetMaa.level = (targetMaa.level || 1) + 1;
             npc.quanSo += bonusCount;
             npc.tien -= 1500;
         }
      }

      if (npc.faction === Faction.NGHIA_QUAN) {
        if (rng(state) < 0.2) { // 20% mỗi tháng hành động
           let recruit = randInt(20, 50);
           npc.quanSo += recruit; // Levy / dân binh tụ tập
           npc.armies[0].count += recruit;
           let p = state.player;
           // 50% di chuyển sang vùng của người chơi nếu đang ở gần
           if (rng(state) < 0.5 && npc.currentRegion !== p.currentRegion) {
              npc.currentRegion = p.currentRegion;
              logLine(state, `Cấp báo: Khởi nghĩa của ${npc.name} (${npc.quanSo} quân) đang tràn qua các vùng!`);
              if (!state._battleChaos) state._battleChaos = {};
              state._battleChaos["dyn_" + npc.id] = 1.0; 
              state.village.unrest += 5;
           }
        }
        // AI Conquering Nodes (Vết dầu loang)
        if (rng(state) < 0.3 && npc.quanSo >= 50) {
           simulateConquest(state, npc, "nghia_quan");
        }
      } else if (npc.faction === Faction.TRIEU_DINH && npc.quanSo >= 50) {
        if (rng(state) < 0.2) {
           if (state.village.unrest > 40) {
             state.village.unrest = Math.max(0, state.village.unrest - 15);
             if (rng(state) < 0.5) logLine(state, `Chấn chỉnh: Quan quân của ${npc.name} vừa càn quét dẹp loạn khu vực!`);
           }
        }
        // AI Reconquering Nodes (Vết dầu loang ngược)
        if (rng(state) < 0.3) {
           simulateConquest(state, npc, "trieu_dinh");
        }
      }
    }

    // NPC cảm tình cao → tự sinh event nhỏ (được quà/thông tin)
    if (npc.opinion >= 80 && rng(state) < 0.02) {
      let gift = randInt(10, 30);
      state.player.tien += gift;
      logLine(state, `${npc.name} (cảm tình: ${npc.opinion}) gửi tặng ${gift} quan bày tỏ lòng biết ơn.`);
    }
  }
}

export function gameTick(state) {
  if (state.gameOver) return;
  state.uiShakeProfile = false;
  ensureVictoryState(state);
  expireInbox(state);

  // Adapters for new state shape (keep old UI working)
  if (state.player && typeof state.player.personalFood !== "number") {
    state.player.personalFood = state.player.thocCaNhan;
  }
  if (state.player && !state.player.location) {
    state.player.location = {
      regionId: state.player.currentRegion,
      phuId: state.player.currentPhu,
      huyenId: state.player.currentHuyen,
      tongId: state.player.currentTong,
      xaId: state.player.currentXa,
      langId: state.player.currentLang,
    };
  }

  // Adapter: garrisons store (huyenId -> { faction, quan, level, morale })
  if (!state._huyenGarrisons) state._huyenGarrisons = {};
  for (const hid of Object.keys(state._huyenGarrisons)) {
    const g = state._huyenGarrisons[hid];
    if (!g || typeof g !== "object") { delete state._huyenGarrisons[hid]; continue; }
    if (!g.faction || !Number.isFinite(Number(g.quan))) { delete state._huyenGarrisons[hid]; continue; }
    g.quan = Math.max(0, Math.floor(Number(g.quan)));
    if (g.quan <= 0) { delete state._huyenGarrisons[hid]; continue; }
    g.level = Math.max(1, Math.min(3, Math.floor(Number(g.level || 1))));
    g.morale = Math.max(0, Math.min(100, Math.floor(Number(g.morale ?? 70))));
  }

  // Jail time: you cannot act while jailed
  if (state.jailDays && state.jailDays > 0) {
    state.jailDays--;
    if (state.jailDays === 0) logLine(state, "⛓ Hết hạn giam. Được thả ra.");
  }

  // Chốt tháng (Logic chạy vào ngày 31 hàng tháng)
  if (state.gameDay >= 31) {
    state.gameDay = 1;
    state.monthIndex++;
    if (state.monthIndex > 12) {
      state.monthIndex = 1;
      const prevYear = state.ban;
      state.ban++;
      state.player.age++;
      state.npcs.forEach(n => n.age++);
      // Yearly merit reset + rewards (Top 50)
      try { resolveYearlyMeritAndReset(state, prevYear); } catch {}
    }

    // Reset các buff/focus tháng
    state._quanLyBonus = 1.0;
    state._quanSuFocus = false;
    state._amMuuBonus  = 1.0;

    if (state.player.dangOm) {
      state.player.dangOm = false;
      state.player.theLuc = clamp(state.player.theLuc + 38, 0, state.player.theLucMax || 144);
      logLine(state, "Tháng ốm qua đi; cơ thể hồi phục.");
    }

    // Roll weather once per month (stable season feel)
    state.thoiTiet = rollWeather();
    // Forecast next month for perks/UI
    state._weatherForecast = rollWeather();
    if ((perkFx(state, "weatherForecast", 0) || 0) > 0 && state._weatherForecast && state._weatherForecast !== state.thoiTiet) {
      logLine(state, `🔭 Thiên văn: bạn đoán trước tháng tới có "${state._weatherForecast}".`, false);
    }

    // Demography + hardship (Trịnh Giang: nặng; Trịnh Doanh: đỡ hơn)
    {
      const v = state.village;
      const year = state.ban || 1737;
      const giangEra = year < 1740;
      const pressure = giangEra ? 1.25 : 0.95;

      // --- Cohort demography (suất đinh logic) ---
      // children: 0-15
      // men: 16-55 (pool, not all fit)
      // women: 16-55
      // elderly: 56+
      if (!v.demo) {
        const total = Math.max(50, totalPops(v) || 0);
        // crude init: ~30% children, ~34% adult men, ~28% adult women, ~8% elderly
        v.demo = {
          children: Math.floor(total * 0.30),
          men:      Math.floor(total * 0.34),
          women:    Math.floor(total * 0.28),
          elderly:  Math.max(0, total - Math.floor(total * 0.30) - Math.floor(total * 0.34) - Math.floor(total * 0.28)),
        };
      }
      // keep non-negative
      v.demo.children = Math.max(0, v.demo.children|0);
      v.demo.men      = Math.max(0, v.demo.men|0);
      v.demo.women    = Math.max(0, v.demo.women|0);
      v.demo.elderly  = Math.max(0, v.demo.elderly|0);

      // births based on women of childbearing age (very rough)
      const births = Math.max(0, Math.floor(v.demo.women * (0.0030 + (giangEra ? 0.00015 : 0.00005))));
      v.demo.children += births;

      // baseline deaths per cohort (monthly)
      let dChildren = Math.floor(v.demo.children * (0.0008 + (giangEra ? 0.00010 : 0)));
      let dMen      = Math.floor(v.demo.men      * (0.0005 + (giangEra ? 0.00008 : 0)));
      let dWomen    = Math.floor(v.demo.women    * (0.0005 + (giangEra ? 0.00006 : 0)));
      let dElderly  = Math.floor(v.demo.elderly  * (0.0018 + (giangEra ? 0.00020 : 0.00005)));

      // Weather hardship
      if (state.thoiTiet === Weather.HAN) { dChildren += Math.floor(v.demo.children * 0.0008); dElderly += Math.floor(v.demo.elderly * 0.0007); }
      if (state.thoiTiet === Weather.LU)  { dChildren += Math.floor(v.demo.children * 0.0007); dElderly += Math.floor(v.demo.elderly * 0.0006); }

      // Random disasters: locust/famine/plague/flood (affects pops, thóc, unrest)
      const dRoll = rng(state);
      if (dRoll < 0.035 * pressure) {
        // locusts / crop failure
        const loss = 80 + randInt(0, 180);
        v.khoThoc = Math.max(0, v.khoThoc - loss);
        v.unrest = Math.min(100, v.unrest + 10 + randInt(0, 8));
        logLine(state, `🦗 Châu chấu phá hoại. Kho thóc hao hụt (${loss}). Dân kêu trời.`, true);
      } else if (dRoll < 0.060 * pressure) {
        // plague
        const extra = Math.floor((v.demo.children + v.demo.men + v.demo.women + v.demo.elderly) * (0.0012 + rng(state) * 0.0018));
        dChildren += Math.floor(extra * 0.35);
        dMen      += Math.floor(extra * 0.25);
        dWomen    += Math.floor(extra * 0.20);
        dElderly  += Math.floor(extra * 0.20);
        v.unrest = Math.min(100, v.unrest + 6);
        logLine(state, `🦠 Dịch bệnh lan trong làng. Chết thêm ${extra} người.`, true);
      } else if (dRoll < 0.085 * pressure && state.thoiTiet === Weather.LU) {
        // flood
        const loss = 60 + randInt(0, 150);
        v.khoThoc = Math.max(0, v.khoThoc - loss);
        v.unrest = Math.min(100, v.unrest + 8);
        logLine(state, `🌊 Lụt lớn. Lúa trôi, kho thóc giảm (${loss}).`, true);
      }

      // Sưu cao, lao dịch (nặng thời Trịnh Giang)
      const corvee = giangEra ? (2 + randInt(0, 4)) : (1 + (rng(state) < 0.5 ? 1 : 0));
      v.unrest = Math.min(100, v.unrest + Math.floor(corvee * 2.2));
      if (giangEra && rng(state) < 0.45) {
        const skim = 10 + randInt(0, 25);
        v.quyLang = Math.max(0, v.quyLang - skim);
        logLine(state, `📜 Lao dịch & sưu dịch tăng. Nha lại vơ vét thêm (${skim}Q).`, false);
      }

      // Apply deaths
      v.demo.children = Math.max(0, v.demo.children - dChildren);
      v.demo.men      = Math.max(0, v.demo.men - dMen);
      v.demo.women    = Math.max(0, v.demo.women - dWomen);
      v.demo.elderly  = Math.max(0, v.demo.elderly - dElderly);

      // Aging (monthly flow)
      const toAdult = Math.max(0, Math.floor(v.demo.children / 192)); // 16 years -> 192 months
      const boys = Math.floor(toAdult * 0.52);
      const girls = Math.max(0, toAdult - boys);
      v.demo.children = Math.max(0, v.demo.children - toAdult);
      v.demo.men += boys;
      v.demo.women += girls;

      const menToOld = Math.max(0, Math.floor(v.demo.men / 480));     // 40 years -> 480 months
      const womenToOld = Math.max(0, Math.floor(v.demo.women / 480));
      v.demo.men = Math.max(0, v.demo.men - menToOld);
      v.demo.women = Math.max(0, v.demo.women - womenToOld);
      v.demo.elderly += (menToOld + womenToOld);

      // Update "pops.nong" to roughly track total population (keep other pops unchanged)
      const totalNow = v.demo.children + v.demo.men + v.demo.women + v.demo.elderly;
      v.pops.nong = Math.max(20, totalNow - (v.pops.tho || 0) - (v.pops.thuong || 0));

      // Eligible levy: suất đinh (16-45) plus wider pool when unrest high (16-55)
      const strictFrac = 0.75; // approx 16-45 out of 16-55 pool
      const strictPool = Math.floor(v.demo.men * strictFrac);
      const widePool = v.demo.men;
      // unfit excludes dặt dẹo/ốm/yếu: baseline + hardship/unrest
      const unfit = Math.max(0.10, Math.min(0.35, 0.14 + (v.unrest || 0) * 0.0012 + (state.thoiTiet === Weather.HAN ? 0.05 : 0) + (state.thoiTiet === Weather.LU ? 0.03 : 0)));
      v._eligibleLevy = Math.max(8, Math.floor(strictPool * (1 - unfit)));
      v._eligibleLevyWide = Math.max(10, Math.floor(widePool * (1 - unfit)));
      // Refill a portion of levy pool each month: wounded return, men rotate from hậu quân.
      if (!state._warLevySpent) state._warLevySpent = { strict: 0, wide: 0 };
      state._warLevySpent.strict = Math.max(0, Math.floor((state._warLevySpent.strict || 0) * 0.72));
      state._warLevySpent.wide = Math.max(0, Math.floor((state._warLevySpent.wide || 0) * 0.72));
    }

    // Apply posting-local buildings monthly (only for current posting)
    ensurePostingIfNeeded(state);
    {
      const po = getPosting(state);
      if (po) applyPostingBuildingMonthly(state, po);
    }

    checkHistoricalEvents(state);
    updateEconomy(state);
    updateNPCs(state);
    processMonthlyPropertyAndArmy(state);
    processMonthlyCapitalWear(state);
    processMonthlyShopIncome(state);
    processMonthlyShopVacancy(state);
    processMonthlyWages(state);
    processMonthlyDraftReclaim(state);
    processMonthlyDebts(state);
    processMonthlyTaxes(state);
    processMonthlySalary(state);
    processMonthlyGarrisonUpkeep(state);
    rollMonthlyMarketScene(state);
    tickLifestyle(state);
    // Quests: refresh and tick at month start
    initQuestsIfNeeded(state);
    if (state.monthIndex === 1) refreshQuestsYearly(state);
    tickQuests(state);
    tryOfferVictoryChoice(state);

    // Intel perk: surface 1 short "tin mật" monthly
    if ((perkFx(state, "intelPerMonth", 0) || 0) > 0) {
      const p = state.player;
      const po = getPosting(state);
      const hints = [];
      if ((p.wantedLevel || 0) > 0) hints.push("Tuần binh đang siết truy nã — tránh về đúng huyện phạm tội.");
      if (po && (po.corruption || 0) > 35) hints.push("Sổ sách mờ ám — thanh tra có thể ghé bất kỳ lúc nào.");
      if ((state.village.unrest || 0) > 65) hints.push("Dân oán cao — loạn có thể bùng lên, nghĩa quân hút người nhanh.");
      if (state.thoiTiet === Weather.HAN || state.thoiTiet === Weather.LU) hints.push("Thời tiết xấu — kho thóc và phủ dụ sẽ quan trọng.");
      if (hints.length > 0 && rng(state) < 0.75) {
        logLine(state, `🕯️ Tin mật: ${hints[randInt(0, hints.length - 1)]}`, false);
      }
    }

    // Governance cases: generate monthly cases for current posting
    ensurePostingIfNeeded(state);
    const po = getPosting(state);
    if (po) {
      // Local clan politics: support/obstruction + rivalry cases
      try { tickLocalClansMonthly(state, po); } catch {}
      generateMonthlyCases(state, po);
    }
    try { tickClanPressureForCommoner(state); } catch {}
    try { tickXaClanStatusMonthly(state); } catch {}
    // Imperial transfers / posting orders
    tryGenerateTransferEdict(state);

    // Kiểm tra cái chết tự nhiên (mỗi tháng)
    if (state.player.age > 50 && rng(state) < ((state.player.age - 50) * 0.005)) {
      if (state.player.giaDinh.con > 0) {
        logLine(state, `ĐỜI NGƯỜI CHẤM DỨT Ở TUỔI ${state.player.age}! Con trai nối dõi tiếp quản.`, true);
        state.player.age = 18;
        state.player.giaDinh.con -= 1;
        state.player.theLuc = state.player.theLucMax || 144;
        state.player.dangOm = false;
        state.player.rank = PlayerRank.DAN_THUONG;
        state.player.faction = Faction.TRIEU_DINH;
        state.player.quanSo = 0;
      } else {
        state.gameOver = true;
        state.gameOverReason = `Chết già tuổi ${state.player.age} không có con nối dõi.`;
      }
    }
  }

  // Logic hàng ngày
  // Marching happens before anything else (prevents "teleport gameplay")
  tickTravel(state);
  tickActivity(state);
  processDelayedEffects(state);

  // Build queue (daily)
  {
    const p = state.player;
    if (p?.buildQueue && p.buildQueue.length > 0) {
      for (const job of p.buildQueue) {
        if (!job || (job.daysLeft | 0) <= 0) continue;
        job.daysLeft = (job.daysLeft | 0) - 1;
      }
      const done = p.buildQueue.filter(j => (j?.daysLeft | 0) <= 0);
      if (done.length > 0) {
        if (!p.holdings) p.holdings = [];
        for (const j of done) {
          const already = p.holdings.find(h => h.typeId === j.typeId && h.regionId === j.regionId);
          if (!already) {
            p.holdings.push({ typeId: j.typeId, level: 1, regionId: j.regionId });
            const propKey = Object.keys(PropertyDb).find(k => PropertyDb[k].id === j.typeId);
            const prop = propKey ? PropertyDb[propKey] : null;
            logLine(state, `✅ Hoàn công: ${prop?.name || j.typeId} (Cấp 1).`, true);
          }
        }
        p.buildQueue = p.buildQueue.filter(j => (j?.daysLeft | 0) > 0);
      }
    }
  }

  // T3.2c-1: dựng cửa hàng (daily) — countdown sống trên shop entity, không p.buildQueue.
  {
    for (const shop of Object.values(state.shops || {})) {
      if (!shop || (shop.foundDaysLeft | 0) <= 0 || !shop.foundingById) continue;
      shop.foundDaysLeft = (shop.foundDaysLeft | 0) - 1;
      if ((shop.foundDaysLeft | 0) <= 0) {
        shop.occupantId = shop.foundingById;
        shop.foundingById = null;
        shop.foundStartedDay = null;
        shop.foundDaysLeft = 0;
        shop.foundedDay = totalDaysAbs(state);
        const mine = shop.occupantId === state.player?.id;
        if (mine) logLine(state, `✅ ${SHOP_LABEL[shop.loai] || "cửa hàng"} đã dựng xong — nay là cơ nghiệp của ngươi.`, true);
      }
    }
  }

  // Personal daily consumption (requested: ít nhất 1/ngày)
  // NOTE: Campaign/army supply will be separated later; for now only personal food.
  {
    const p = state.player;
    if (p && !state.travel?.active && !p?._attached?.battleId) {
      // Only consume when not marching (march already consumes travel thóc via tickTravel)
      p.thocCaNhan = Math.max(0, (p.thocCaNhan || 0) - 1);
      p.personalFood = p.thocCaNhan;
    }
  }
  // Overdue posting order => punishment event (if not traveling and not jailed)
  if (state.postingOrder?.active && !state.pendingEvent && !inboxFull(state) && !state.travel?.active && (state.jailDays || 0) <= 0) {
    const now = totalDaysAbs(state);
    if (now > (state.postingOrder.dueTotalDays || 0)) {
      const to = state.postingOrder.to;
      const h = (to?.regionId && to?.phuId && to?.huyenId) ? getHuyen(to.regionId, to.phuId, to.huyenId) : null;
      const targetName = h?.name || to?.huyenId || "nhiệm sở";
      state.pendingEvent = {
        id: "imperial_transfer_overdue",
        title: "⛓ Kháng chỉ bị tra xét",
        narrative: `Ngươi đã quá hạn nhận nhiệm sở tại <strong>${targetName}</strong>. Ty lại tâu về phủ. Lệnh bắt giam và giáng chức đã tới.`,
        choices: [
          { label: "Nộp phạt xin tha (−250Q)", impact:[{label:"Tổn tiền",color:"#ff6b6b"}], apply(s){
            const p = s.player;
            if (p.tien < 250) { logLine(s, "Không đủ tiền nộp phạt.", true); return; }
            p.tien -= 250;
            p.uyTinCong = Math.max(0, p.uyTinCong - 25);
            // extend deadline slightly; still must go
            s.postingOrder.dueTotalDays = totalDaysAbs(s) + 20;
            s.postingOrder.status = "warned";
            logLine(s, "Nộp phạt xin tha. Triều tạm cho gia hạn, nhưng vẫn phải lên đường ngay.", true);
          }},
          { label: "Bị bắt giam, giáng chức", impact:[{label:"Tổn uy",color:"#ff6b6b"}], apply(s){
            const p = s.player;
            p.uyTinCong = Math.max(0, p.uyTinCong - 60);
            s.jailDays = Math.max(s.jailDays || 0, 15 + randInt(0, 20));
            p.rank = PlayerRank.DAN_THUONG;
            s.postingId = null;
            s.postingOrder = null;
            logLine(s, "Bị bắt giam vì kháng chỉ. Tước chức, giáng dân.", true);
          }},
        ]
      };
    }
  }
  // Court audit / inspection event (not more than once per year per posting)
  ensurePostingIfNeeded(state);
  {
    const po = getPosting(state);
    if (!state.pendingEvent && !inboxFull(state) && po && postingHere(state) && state.player.faction === Faction.TRIEU_DINH) {
      const yearGate = (po.lastAuditYear || 0) !== state.ban;
      const risk = 0.006 + (po.corruption || 0) * 0.00020 + Math.max(0, (state.village.unrest - 35)) * 0.00014;
      if (yearGate && rng(state) < risk) {
        po.lastAuditYear = state.ban;
        const p = state.player;
        const fine = 200 + Math.floor((po.corruption || 0) * 6) + Math.floor(state.village.unrest * 2);
        state.pendingEvent = {
          id: "court_audit",
          title: "🏯 Thanh tra từ Phủ Chúa",
          narrative: "Quan trên và ty lại về địa phương tra sổ. Dân chúng kéo tới kêu oan. Nếu phát hiện tham ô hoặc dân oán, ngươi khó thoát.",
          onExpire(s){
            const p = s.player; const poX = getPosting(s);
            if (!poX) { logLine(s, "🏯 Thanh tra tới nhưng ngươi đã rời nhiệm sở, việc bỏ lửng."); return; }
            const harsh = (poX.corruption||0) > 35 || s.village.unrest > 70;
            if (harsh) {
              const take = Math.min(p.tien, fine);
              p.tien -= take;
              p.uyTinCong = Math.max(0, p.uyTinCong - 40);
              poX.corruption = Math.max(0, (poX.corruption||0) - 10);
              logLine(s, `🏯 Vắng mặt khi thanh tra. Ty lại tự tra sổ: phạt ${take}Q, ghi sổ đen, uy tín giảm.`, true);
            } else {
              p.uyTinCong = Math.max(0, p.uyTinCong - 10);
              logLine(s, "🏯 Thanh tra tự tra sổ rồi rút. Ngươi bị khiển trách nhẹ vì vắng mặt.", false);
            }
          },
          choices: [
            { label: `Hối lộ để êm chuyện (${fine}Q)`, impact:[{label:"Thoát",color:"#51cf66"}], apply(s){
              const p = s.player;
              const po = getPosting(s);
              if (!po) return;
              if (p.tien >= fine) {
                p.tien -= fine;
                po.corruption = Math.max(0, (po.corruption||0) - 15);
                s.village.unrest = Math.max(0, s.village.unrest - 6);
                logLine(s, `Đút lót ${fine}Q. Thanh tra nhắm mắt cho qua.`, true);
                pushCelebration(s, "THOÁT THANH TRA", `Đút lót <strong>${fine}Q</strong>. Sổ sách tạm yên, quan trên quay lưng đi.`, "coin");
              } else {
                logLine(s, "Không đủ tiền hối lộ. Bị lôi ra xét tội!", true);
                s.jailDays = 40;
                p.rank = PlayerRank.DAN_THUONG;
                p.uyTinCong = Math.max(0, p.uyTinCong - 80);
                po.corruption = 0;
                s.postingId = null;
                pushCelebration(s, "BỊ BẮT", "Không đủ tiền hối lộ. Bị giam và tước chức.", "caiVa");
              }
            }},
            { label: "Trình bày đúng luật (chịu phạt)", impact:[{label:"Có thể bị giáng",color:"#ffd43b"}], apply(s){
              const p = s.player;
              const po = getPosting(s);
              if (!po) return;
              const harsh = (po.corruption||0) > 35 || s.village.unrest > 70;
              if (harsh) {
                p.rank = PlayerRank.DAN_THUONG;
                p.uyTinCong = Math.max(0, p.uyTinCong - 60);
                s.jailDays = 30;
                s.postingId = null;
                logLine(s, "Bị cách chức và giam vì trị dân bất lực / sổ sách mờ ám.", true);
                pushCelebration(s, "CÁCH CHỨC", "Thanh tra kết tội. Bị giáng làm dân, mất nhiệm sở.", "caiVa");
              } else {
                p.uyTinCong = Math.max(0, p.uyTinCong - 25);
                po.corruption = Math.max(0, (po.corruption||0) - 10);
                logLine(s, "Bị khiển trách và phạt. Uy tín giảm.", true);
                pushCelebration(s, "KHIỂN TRÁCH", "Bị phạt vì sổ sách/địa phương có vấn đề. Uy tín giảm.", "murmur");
              }
            }},
            { label: "Chống lệnh thanh tra (liều)", impact:[{label:"Cực nguy hiểm",color:"#ff6b6b"}], apply(s){
              const p = s.player;
              const po = getPosting(s);
              if (!po) return;
              const ok = rng(state) < (0.12 + (p.muuMeo||0)*0.002);
              if (ok) {
                logLine(s, "Dùng mưu che mắt thanh tra. Thoát trong gang tấc!", true);
                po.corruption = Math.min(100, (po.corruption||0) + 8);
                pushCelebration(s, "THOÁT TRONG GANG TẤC", "Mưu kế thành công. Thanh tra bị che mắt — nhưng nợ máu tăng.", "battle");
              } else {
                s.gameOver = true;
                s.gameOverReason = "Bị xử trảm vì chống lệnh thanh tra.";
                logLine(s, "☠️ Chống lệnh thanh tra. Bị kết tội phản nghịch và xử trảm!", true);
              }
            }},
          ]
        };
      }
    }
  }
  // Reinforcements tick (court relief forces)
  if (state.reinforcements && state.reinforcements.length > 0) {
    for (const r of state.reinforcements) r.etaDays--;
    const arrived = state.reinforcements.filter(r => r.etaDays <= 0);
    state.reinforcements = state.reinforcements.filter(r => r.etaDays > 0);
    if (arrived.length > 0) {
      ensurePostingIfNeeded(state);
      for (const a of arrived) {
        const po = getPosting(state);
        if (po && po.huyenId === a.toHuyen) {
          po.garrison = (po.garrison || 0) + a.troops;
          logLine(state, `🚩 Cứu viện tới nơi! ${a.troops} quân nhập doanh địa phương.`, true);
        } else {
          logLine(state, `Cứu viện (${a.troops}) tới vùng khác, không kịp nhập doanh bạn.`, false);
        }
      }
    }
  }
  // Mandatory local uprising response when posted
  ensurePostingIfNeeded(state);
  const poNow = getPosting(state);
  if (!state.pendingEvent && !inboxFull(state) && poNow && postingHere(state)) {
    const ctrl = getHuyenControl(state, poNow.huyenId);
    const danger = (ctrl === Faction.NGHIA_QUAN) || (state.village.unrest >= 75);
    if (danger && rng(state) < 0.12) {
      state.pendingEvent = {
        id: "local_uprising",
        title: "⚔️ Loạn bùng tại địa phương",
        narrative: "Tin cấp báo: nghĩa quân nổi lên/quân phản loạn đánh phá. Nếu ngươi là quan tại nhiệm, không thể ngó lơ.",
        onExpire(s){
          s.village.unrest = Math.min(100, (s.village.unrest||0) + 25);
          logLine(s, "⚔️ Không ai đứng ra xử loạn. Nghĩa quân hoành hành, bất ổn lan rộng khắp vùng.", true);
        },
        choices: [
          { label: "Dẫn quân dẹp loạn ngay", impact:[{label:"Chiến đấu",color:"#ffd43b"}], apply(s){
            const p = s.player;
            const po = getPosting(s);
            const g = (po?.garrison || 0);
            const def = Math.max(80, Math.floor((g + p.quanSo) * 0.35));
            const attacker = { name:`Quân triều đình (${p.name})`, armies:[{type:"nhat_binh", count: Math.max(50, p.quanSo + Math.floor(g*0.6)), morale: 75}], martial: (p.voThuat||10), qualityMult:1.05, isPlayer:true, knights: Math.floor((p.danhVong||0)/250) };
            const defender = { name:"Nghĩa quân", armies:[{type:"dan_binh", count: def, morale: 70}], martial: 18, qualityMult:0.85, knights: 1 };
            const sim = simulateBattle(attacker, defender, s);
            const win = sim.winner === attacker.name;
            const remain = sim.remainingAttacker || attacker.armies[0].count;
            const lost = Math.max(0, attacker.armies[0].count - remain);
            p.quanSo = Math.max(0, p.quanSo - Math.floor(lost * 0.65));
            if (po) po.garrison = Math.max(0, g - Math.floor(lost * 0.35));
            if (win) {
              if (po) setHuyenControl(s, po.huyenId, Faction.TRIEU_DINH);
              s.village.unrest = Math.max(0, s.village.unrest - 18);
              logLine(s, `Dẹp loạn thành công. Tổn thất ${lost} quân.`, true);
            } else {
              s.village.unrest = Math.min(100, s.village.unrest + 8);
              logLine(s, `Vỡ trận, phải rút lui. Địa phương hỗn loạn.`, true);
            }
            s.uiCelebrations = s.uiCelebrations || [];
            s.uiCelebrations.unshift({ title:"CHIẾN BÁO — DẸP LOẠN", body: (sim.battleLogs||[]).slice(0,18).join("<br>"), sfx: win ? "battle" : "caiVa" });
          }},
          { label: "Gửi thư cầu viện", impact:[{label:"Cứu viện",color:"#74c0fc"}], apply(s){ actionRequestReinforcements(s); } },
          { label: "Bỏ trốn (mất chức)", impact:[{label:"Nhục",color:"#ff6b6b"}], apply(s){
            s.player.rank = PlayerRank.DAN_THUONG;
            s.player.uyTinCong = Math.max(0, s.player.uyTinCong - 40);
            s.postingId = null;
            logLine(s, "Ngươi bỏ trốn khỏi địa phương. Bị cách chức, mang tiếng hèn.", true);
          }},
        ]
      };
    }
  }
  // After a rout, remnants regroup over days (CK3-like)
  {
    const p = state.player;
    if (p._routRecover?.daysLeft > 0) {
      p._routRecover.daysLeft--;
      const cap = p._routRecover.cap || p.quanSo;
      const regain = Math.max(0, Math.floor((cap - p.quanSo) * 0.08));
      if (regain > 0 && p.thocCaNhan >= 2) {
        p.thocCaNhan -= 2;
        p.quanSo = Math.min(cap, p.quanSo + regain);
        if (p._routRecover.daysLeft % 4 === 0) logLine(state, `Tàn quân dần tụ lại: +${regain} quân.`);
      }
      if (p._routRecover.daysLeft <= 0) p._routRecover = null;
    }
  }
  checkWantedArrest(state);
  // Hồi thể lực theo ngày (trừ khi ốm). Có thể được buff bởi nhà ở.
  {
    const p = state.player;
    if (!p.dangOm) {
      let regen = 10;
      // Bonus từ nhà ở
      if (p.holdings && p.holdings.length > 0) {
        p.holdings.forEach(h => {
          const key = Object.keys(PropertyDb).find(k => PropertyDb[k].id === h.typeId);
          const pt = key ? PropertyDb[key] : null;
          if (pt?.buffs?.[h.level - 1]) {
            const lb = pt.buffs[h.level - 1];
            for (const [buffKey, buffVal] of lb) {
              if (buffKey === "theLucRegen") regen += buffVal;
            }
          }
        });
      }
      const maxTL = p.theLucMax || 144;
      p.theLuc = clamp(p.theLuc + regen, 0, maxTL);
      // HP hồi rất chậm
      if (typeof p.hp === "number" && p.hp < (p.hpMax || 100)) {
        p.hp = Math.min((p.hpMax || 100), p.hp + 1);
      }
    }
  }
  // Weather is rolled at month change (not daily) to avoid chaotic flicker.
}


function processMonthlyDebts(state) {
  if (state.player.noVayConLai > 0) {
    if (state.player.tien >= state.player.noVayConLai + 5) {
      state.player.tien -= (state.player.noVayConLai + 5);
      state.player.noVayConLai = 0;
      logLine(state, "Cuối tháng: trả sạch nợ gốc lẫn lãi.");
    } else {
      state.player.theLuc = 0;
      state.player.dangOm = true;
      state.player.tien = 0;
      logLine(state, "Quá hạn không trả nợ! Bọn đòi nợ ập đến, đánh dập xương, liếm cạn tiền.", true);
    }
  }
}

function processMonthlyTaxes(state) {
  if (state.monthIndex === 6) {
    let baseTax = 0;
    if (state.player.rank === PlayerRank.DAN_THUONG) baseTax = 20;
    else if (state.player.rank === PlayerRank.PHU_HO) baseTax = 50;
    else if (state.player.rank === PlayerRank.LY_TRUONG || state.player.rank === PlayerRank.CHANH_TONG) baseTax = 100;

    let propertyTax = (state.player.holdings?.length || 0) * 15;
    let tax = baseTax + propertyTax;

    if (tax > 0) {
      let lyTruong = state.npcById[state.officials.lyTruong];
      if (lyTruong && lyTruong.opinion > 60 && rng(state) < 0.4) {
        logLine(state, `Lý trưởng ${lyTruong.name} nể mặt, lén gạch tên bạn khỏi sổ thuế dư. Miễn thuế!`);
      } else {
        if (state.player.tien >= tax) {
          state.player.tien -= tax;
          logLine(state, `Nộp ${tax} quan tiền thuế định kỳ.`);
        } else {
          // Bóc lột hết tiền nhưng chừa đường sống
          const noc = tax - state.player.tien;
          state.player.tien = 0;
          state.player.uyTinCong -= 20;
          state.player.theLuc = Math.max(0, state.player.theLuc - 40);
          if (state.player.theLuc === 0) state.player.dangOm = true;
          logLine(state, `Không đủ ${tax} quan nộp thuế! Bị vơ vét sạch sành sanh và đánh đập nhừ tử.`, true);
        }
      }
    }
  }
}

/** Lương thực đồn trú theo phe (granary → treasury → đào ngũ nhẹ). */
function processMonthlyGarrisonUpkeep(state) {
  if (!state._huyenGarrisons) return;
  const tri = state.factions?.trieuDinh;
  const nq = state.factions?.nghiaQuan;
  for (const huyenId of Object.keys(state._huyenGarrisons)) {
    const g = state._huyenGarrisons[huyenId];
    const q = Math.floor(g?.quan || 0);
    if (q <= 0 || !g?.faction) {
      delete state._huyenGarrisons[huyenId];
      continue;
    }
    if (getHuyenControl(state, huyenId) !== g.faction) {
      delete state._huyenGarrisons[huyenId];
      continue;
    }
    const lvl = Math.max(1, Math.min(3, Math.floor(g.level || 1)));
    const morale = Math.max(0, Math.min(100, Math.floor(g.morale ?? 70)));
    // Better garrison = more supplies, but more stable defense.
    const need = Math.max(1, Math.ceil((q / 10) * (1 + (lvl - 1) * 0.22)));
    const store = g.faction === Faction.NGHIA_QUAN ? nq : tri;
    if (!store) continue;
    let needLeft = need;
    const gr = store.granary || 0;
    if (gr >= needLeft) {
      store.granary = gr - needLeft;
      g.morale = Math.min(100, morale + 6 + lvl);
      continue;
    }
    needLeft -= gr;
    store.granary = 0;
    const payTreasury = needLeft * 2;
    if ((store.treasury || 0) >= payTreasury) {
      store.treasury -= payTreasury;
      g.morale = Math.min(100, morale + 4 + lvl);
      continue;
    }
    g.morale = Math.max(0, morale - (18 + lvl * 2));
    const deserMult = (g.morale <= 25) ? 1.8 : (g.morale <= 45) ? 1.35 : 1.0;
    const loss = Math.max(1, Math.floor(q * 0.09 * deserMult));
    g.quan = q - loss;
    if (g.quan <= 0) delete state._huyenGarrisons[huyenId];
    logLine(state, `⚠️ Thiếu lương đồn trú tại ${huyenId}, ${loss} quân bỏ trốn khỏi trấn.`, true);
  }
}


function processMonthlySalary(state) {
  const p = state.player;
  if (!p || p.faction !== Faction.TRIEU_DINH) return;
  // Salary scale (rough, will be balanced later)
  const salaryByRank = {
    [PlayerRank.DOI_TRUONG]: 80,
    [PlayerRank.CAI_DOI]: 90,
    [PlayerRank.CAI_CO]: 150,
    [PlayerRank.CHUONG_CO]: 260,
    [PlayerRank.BACH_HO]: 350,
    [PlayerRank.TONG_LINH]: 550,
    [PlayerRank.DO_DOC]: 900,
    [PlayerRank.DO_CHI_HUY_SU]: 950,
    [PlayerRank.DAI_TUONG]: 1400,
    [PlayerRank.TRI_HUYEN]: 120,
    [PlayerRank.TRI_PHU]: 250,
    [PlayerRank.HIEN_SAT_SU]: 420,
    [PlayerRank.THUA_CHINH_SU]: 620,
    [PlayerRank.DOC_TRAN]: 820,
    [PlayerRank.THUONG_THU]: 1200,
    [PlayerRank.THAM_TUNG]: 1600,
    [PlayerRank.BOI_TUNG]: 1600,
  };
  const sal = salaryByRank[p.rank] || 0;
  if (sal <= 0) return;
  p.tien += sal;
  logLine(state, `🪙 Lương bổng: +${sal}Q theo chức tước (${RankLabel[p.rank] || p.rank}).`, false);
}

function processMonthlyPropertyAndArmy(state) {
  // Lợi tức từ bất động sản
  if (state.player.holdings && state.player.holdings.length > 0) {
    let tienKiem = 0, thocKiem = 0, uyTinKiem = 0;

    state.player.holdings.forEach(h => {
      const key = Object.keys(PropertyDb).find(k => PropertyDb[k].id === h.typeId);
      const pt = key ? PropertyDb[key] : null;
      if (pt?.buffs?.[h.level - 1]) {
        const lb = pt.buffs[h.level - 1];
        for (const [buffKey, buffVal] of lb) {
          if (buffKey === "tienMon")    tienKiem += buffVal;
          if (buffKey === "thocMon")    thocKiem += buffVal;
          if (buffKey === "uyTinMon")   uyTinKiem += buffVal;
          if (buffKey === "hocVanAccum") {
            state.player._hocThuatAccum = (state.player._hocThuatAccum || 0) + buffVal;
            if (state.player._hocThuatAccum >= 4) {
              state.player.hocVan = Math.min(100, state.player.hocVan + 1);
              state.player._hocThuatAccum -= 4;
            }
          }
          if (buffKey === "voThuatAccum") {
            state.player._voThuatAccum = (state.player._voThuatAccum || 0) + buffVal;
            if (state.player._voThuatAccum >= 4) {
              state.player.voThuat = Math.min(100, state.player.voThuat + 1);
              state.player._voThuatAccum -= 4;
            }
          }
          if (buffKey === "unrestGiam") state.village.unrest = Math.max(0, state.village.unrest - buffVal);
        }
      }
    });

    const qb = state._quanLyBonus || 1.0;
    tienKiem = Math.floor(tienKiem * qb);
    thocKiem = Math.floor(thocKiem * qb);

    // Perks should matter: property income multipliers
    let propMult = 1.0;
    propMult *= (perkFx(state, "propertyIncomeMult", 1.0) || 1.0);
    tienKiem = Math.floor(tienKiem * propMult);
    thocKiem = Math.floor(thocKiem * propMult);

    if (tienKiem > 0) state.player.tien += tienKiem;
    if (thocKiem > 0) state.player.thocCaNhan += thocKiem;
    if (uyTinKiem > 0) state.player.uyTinCong += uyTinKiem;

    if (tienKiem > 0 || thocKiem > 0 || uyTinKiem > 0) {
      logLine(state, `Tô lợi từ bất động sản: +${tienKiem} Quan, +${thocKiem} Thóc.`);
    }
  }

  // Quân đội trừ lương
  // Nếu đang thuộc quân chiến dịch (join battle/army) thì lương quân do chủ soái/phe gánh.
  const attached = state.player?._attached?.battleId ? state.player._attached : null;
  if (state.player.quanSo > 0 && !attached) {
    const luongGiamMult = state._quanSuFocus ? 0.9 : 1.0;
    let an = Math.ceil(state.player.quanSo * 2 * luongGiamMult);
    an = Math.ceil(an * (perkFx(state, "armyUpkeepMult", 1.0) || 1.0));

    state.player.holdings?.forEach(h => {
      const key = Object.keys(PropertyDb).find(k => PropertyDb[k].id === h.typeId);
      const pt = key ? PropertyDb[key] : null;
      if (pt?.buffs?.[h.level - 1]) {
        const lb = pt.buffs[h.level - 1];
        for (const [buffKey, buffVal] of lb) {
          if (buffKey === "luongGiam") an = Math.ceil(an * (1 - buffVal));
        }
      }
    });

    if (state.player.thocCaNhan >= an) {
      state.player.thocCaNhan -= an;
    } else {
      state.player.thocCaNhan = 0;
      state.player.tien -= an;
      if (state.player.tien < 0) {
        state.player.tien = 0;
        let loss = Math.ceil(state.player.quanSo * 0.3);
        state.player.quanSo -= loss;
        logLine(state, `Thiếu lương, ${loss} binh sĩ đã đào ngũ!`, true);
      }
    }
  } else if (state.player.quanSo > 0 && attached) {
    // Campaign upkeep is paid by faction granary first, then treasury; if both fail => deserters.
    const sideFaction = (attached.side === "atk") ? Faction.NGHIA_QUAN : Faction.TRIEU_DINH;
    const store = state.factions?.[(sideFaction === Faction.NGHIA_QUAN) ? "nghiaQuan" : "trieuDinh"];
    const luongGiamMult = state._quanSuFocus ? 0.9 : 1.0;
    let an = Math.ceil(state.player.quanSo * 2 * luongGiamMult);
    an = Math.ceil(an * (perkFx(state, "armyUpkeepMult", 1.0) || 1.0));
    if (store) {
      if ((store.granary || 0) >= an) {
        store.granary -= an;
      } else {
        const miss = an - (store.granary || 0);
        store.granary = 0;
        store.treasury = Math.max(0, (store.treasury || 0) - miss);
        if ((store.treasury || 0) === 0 && miss > 0) {
          const loss = Math.max(1, Math.ceil(state.player.quanSo * 0.12));
          state.player.quanSo = Math.max(0, state.player.quanSo - loss);
          logLine(state, `Thiếu quân lương chiến dịch, ${loss} binh sĩ bỏ trốn khỏi doanh!`, true);
        }
      }
    }
  }
}

// T3.2b: hao mòn vốn/công cụ cá nhân — mỗi tháng cond -CAPITAL_WEAR_PER_MONTH, sàn 0.
// Món hỏng (cond 0) nằm im trong p.capital[], KHÔNG xoá, KHÔNG log (chưa nghề nào đọc).
// Tách riêng khỏi processMonthlyPropertyAndArmy (hàm đó chứa logic thu nhập BĐS).
function processMonthlyCapitalWear(state) {
  const cap = state.player?.capital;
  if (!Array.isArray(cap) || cap.length === 0) return;
  for (const it of cap) {
    it.cond = Math.max(0, (it.cond ?? 100) - CAPITAL_WEAR_PER_MONTH);
  }
}

// T3.2c-1: tô cửa hàng hàng tháng — chảy vào tien của occupant (player HOẶC AI, như
// ruộng lộc). Đủ khi occupant CÓ MẶT ở xã cửa hàng HOẶC có người làm; thiếu cả hai -> nửa.
// occupant AI luôn coi như có mặt. T3.3-1: shop.workerIds được nối dây thật (actionThueNguoi)
// -> nhánh "có người làm" hết stub. Tách riêng khỏi processMonthlyPropertyAndArmy.
function processMonthlyShopIncome(state) {
  const ym = ymKey(state);
  const player = state.player;
  for (const shop of Object.values(state.shops || {})) {
    if (!shop || !shop.occupantId) continue;
    if (shop.lastPaidYm === ym) continue;
    const isPlayer = shop.occupantId === player?.id;
    const occ = isPlayer ? player : state.npcById?.[shop.occupantId];
    if (!occ) continue;
    const present = isPlayer ? (player.currentXa === shop.xaId) : true;
    const hasWorkers = (shop.workerIds?.length || 0) > 0; // T3.3-1: actionThueNguoi đẩy vào đây
    const gain = (present || hasWorkers)
      ? (shop.incomeBase | 0)
      : Math.floor((shop.incomeBase | 0) / 2);
    occ.tien = (occ.tien || 0) + gain;
    shop.lastPaidYm = ym;
    if (isPlayer && gain > 0) {
      logLine(state, `Tô ${SHOP_LABEL[shop.loai] || "cửa hàng"}: +${gain} Quan${present ? "" : " (vắng mặt, thu nửa)"}.`);
    }
  }
}

/**
 * T3.2c-2: đánh dấu một cửa hàng bỏ trống (occupant chết / bỏ đi). Chỉ tác dụng khi
 * shop ĐANG có occupant. Giữ ownerClanId làm dấu vết. Nơi gọi: hệ thống cái chết /
 * bỏ nghề sau này. HIỆN CHƯA có đường tự nhiên nào khiến occupant mất khi game còn
 * chạy (chết người chơi = gameOver, NPC danh tính không chết) — đây là hook sẵn.
 */
export function markShopVacant(state, shopId) {
  const shop = state.shops?.[shopId];
  if (!shop || !shop.occupantId) return false;
  const occ = state.npcById?.[shop.occupantId];
  if (occ && occ.shopId === shopId) occ.shopId = null;
  // T3.3-1: mất chủ -> người làm mất việc (không còn ai trả công).
  for (const wid of (shop.workerIds || []).slice()) {
    const w = wid === state.player?.id ? state.player : state.npcById?.[wid];
    if (w) detachJob(w, shopId);
  }
  shop.workerIds = [];
  shop.occupantId = null;
  shop.vacantSinceDay = totalDaysAbs(state);
  return true;
}

// T3.2c-2: cửa hàng TỪNG có chủ mà bỏ trống > SHOP_VACANT_FILL_DAYS -> dòng họ mạnh
// nhất xã (pickXaSeatSuccessorClan qua ghế xã) đưa người AI vào tiếp quản. Template
// spawn khớp block seed T3.2a. Slot quán trọ NGUYÊN TRINH (vacantSinceDay == null)
// KHÔNG bị đụng — giữ chỗ cho người chơi. Tách riêng khỏi processMonthlyShopIncome.
function processMonthlyShopVacancy(state) {
  const now = totalDaysAbs(state);
  for (const shop of Object.values(state.shops || {})) {
    if (!shop || shop.occupantId || shop.foundingById) continue;
    if (shop.vacantSinceDay == null) continue;                       // slot nguyên trinh
    if (now - shop.vacantSinceDay < SHOP_VACANT_FILL_DAYS) continue;

    const clanId = pickXaSeatSuccessorClan(state, seatIdForXa(shop.xaId));
    const clan = clanId ? state.clanById?.[clanId] : null;
    if (!clan) continue;   // xã không có dòng họ cục bộ (huyện procedural) -> để trống

    const huyenId = shop.xaId.replace(/_t\d+_x\d+$/, "");
    const tongId  = shop.xaId.replace(/_x\d+$/, "");
    const pf = rollShopOwner("shopfill:" + shop.id + ":" + shop.vacantSinceDay);
    const person = new Person({
      isAI: true, name: clanSurname(clan.name) + " " + pf.givenName,
      gender: Gender.NAM, disposition: [],
      age: pf.age, tien: pf.tien, opinion: pf.opinion,
      ngoaiGiao: pf.ngoaiGiao, voThuat: pf.voThuat, quanLy: pf.quanLy,
      muuMeo: pf.muuMeo, hocVan: pf.hocVan,
      clanId: clan.id,
      currentRegion: RegionId.SON_TAY, currentPhu: "quang_oai",
      currentHuyen: huyenId, currentTong: tongId, currentXa: shop.xaId,
      shopId: shop.id,
    });
    state.npcs.push(person);
    state.npcById[person.id] = person;
    clan.memberIds.push(person.id);
    shop.occupantId = person.id;
    shop.ownerClanId = clan.id;
    shop.vacantSinceDay = null;
    logLine(state, `${clan.name} đưa người vào tiếp quản ${SHOP_LABEL[shop.loai] || "cửa hàng"} bỏ trống — nay là ${person.name}.`, true);
  }
}

// T3.3-1: trả lương người làm hàng tháng. Chủ −wage, người làm +wage vào .tien.
// Chủ không đủ tiền -> việc chấm dứt (người làm bỏ), gỡ khỏi shop.workerIds + _jobs.
// Cơ chế CHUNG: job.kind="farm" (T3.3-2) chạy qua đây y nguyên, chỉ khác ref là plotId.
function processMonthlyWages(state) {
  const player = state.player;
  const people = [player, ...(state.npcs || [])];
  for (const worker of people) {
    if (!worker || !Array.isArray(worker._jobs) || worker._jobs.length === 0) continue;
    for (const job of worker._jobs.slice()) {          // slice: detach có thể sửa _jobs
      const wage = job.wagePerMonth | 0;
      if (wage <= 0) continue;
      const employer = job.employerId === player?.id ? player : state.npcById?.[job.employerId];
      if (!employer) { detachJob(worker, job.ref); continue; }
      if ((employer.tien || 0) < wage) {
        detachJob(worker, job.ref);
        const shop = job.kind === "shop" ? state.shops?.[job.ref] : null;
        if (shop && Array.isArray(shop.workerIds)) {
          shop.workerIds = shop.workerIds.filter(id => id !== worker.id);
        }
        if (employer === player) logLine(state, `Không đủ tiền trả công, ${worker.name} bỏ việc.`, true);
        else if (worker === player) logLine(state, `${employer.name || "Chủ"} hết tiền trả công — ngươi nghỉ việc.`, true);
        continue;
      }
      employer.tien -= wage;
      worker.tien = (worker.tien || 0) + wage;
      if (employer === player) logLine(state, `Trả công ${worker.name}: −${wage} Quan.`);
      else if (worker === player) logLine(state, `Nhận công từ ${employer.name || "chủ"}: +${wage} Quan.`);
    }
  }
}

// T3.3-0: thu hồi suất đinh đã trưng — trai tráng lớn lên / giải ngũ dần. ~5%/tháng
// (min 1) cho MỌI village per-xã + fallback. Chữa bệnh "village.drafted không hồi bao giờ"
// (recon 28/8). SỐ HẠT GIỐNG.
function processMonthlyDraftReclaim(state) {
  const all = [...Object.values(state.villagesByXa || {}), state._fallbackVillage].filter(Boolean);
  for (const v of all) {
    const d = v.drafted | 0;
    if (d <= 0) continue;
    v.drafted = Math.max(0, d - Math.max(1, Math.ceil(d * 0.05)));
  }
}

export function actionJoinBattle(state, battleId, side = "def") {
  const p = state.player;
  if (p.dangOm) return { ok: false, msg: "Đang ốm liệt giường." };
  if (p.theLuc < 30) return { ok: false, msg: "Thể lực quá thấp (cần 30)." };
  if (p.quanSo < 20) return { ok: false, msg: "Quân số quá ít (cần ít nhất 20 người)." };
  if (p.voThuat < 15) return { ok: false, msg: "Võ thuật chưa đủ (cần 15) để tham chiến." };

  const battleState = getBattleState(state, battleId);
  if (!battleState) return { ok: false, msg: "Trận chiến này đã kết thúc hoặc không tồn tại." };

  // Hard lock: can't freely switch sides. Only via special events (defection/chiêu an).
  const totalDays = (state.ban - 1737) * 360 + state.monthIndex * 30 + (state.gameDay || 1);
  const canSwitchTo = (toFaction) => {
    const w = state._defectWindow;
    return !!w && w.to === toFaction && (w.untilTotalDays || 0) >= totalDays;
  };
  if (p.faction === Faction.NGHIA_QUAN && side === "def" && !canSwitchTo(Faction.TRIEU_DINH)) {
    return { ok: false, msg: "Đã là nghĩa quân thì không thể tự ý về triều. Chờ chiêu an/đầu thú." };
  }
  if (p.faction !== Faction.NGHIA_QUAN && side === "atk" && !canSwitchTo(Faction.NGHIA_QUAN)) {
    return { ok: false, msg: "Không thể tự ý theo phản loạn. Chờ gian tế thuyết phục hoặc biến cố lớn." };
  }

  // Kiểm tra nếu đã tham gia hiệp này rồi
  if (!state._playerJoinedBattles) state._playerJoinedBattles = {};
  if (state._playerJoinedBattles[battleId] === side) {
      return { ok: false, msg: "Ngươi đang ở trong hàng ngũ chiến đấu, hãy chờ kết quả hiệp tới." };
  }

  // Logic chọn phe (UI đã quy ước sẵn): atk = Nghĩa quân, def = Triều đình
  let isRebel = side === "atk";
  if (isRebel && p.faction !== Faction.NGHIA_QUAN) {
    p.faction = Faction.NGHIA_QUAN;
    p.rank = PlayerRank.THU_LINH;
    setWanted(state, 3, "Tham gia phiến loạn lật đổ triều đình", p.currentHuyen);
  }
  if (!isRebel && p.faction === Faction.NGHIA_QUAN && canSwitchTo(Faction.TRIEU_DINH)) {
    // chiêu an window used: surrender back to court
    p.faction = Faction.TRIEU_DINH;
    p.rank = PlayerRank.DAN_THUONG;
    p.wantedLevel = 0;
    p.crimeHuyen = null;
  }
  // consume window if used
  if ((isRebel && p.faction === Faction.NGHIA_QUAN) || (!isRebel && p.faction === Faction.TRIEU_DINH)) {
    if (state._defectWindow) state._defectWindow = null;
  }

  // Attach to commander/battle: when you join an army, you no longer roam freely.
  p._attached = {
    battleId,
    side,
    commander: isRebel ? battleState.atkCommander : battleState.defCommander,
    armyName: isRebel ? battleState.atkName : battleState.defName,
  };
  logLine(state, `🪖 Nhập ngũ dưới quyền ${p._attached.commander} (${p._attached.armyName}).`, true);

  // Cập nhật lực lượng trận chiến (cộng quân của player vào)
  if (!state._battleChaos) state._battleChaos = {};
  if (!state._battleContrib) state._battleContrib = {};
  if (!state._battleContrib[battleId]) state._battleContrib[battleId] = { atk: 0, def: 0 };
  // Tham chiến sẽ được cộng lực lượng hiển thị cho phe đã chọn (tạo cảm giác "mình có mặt trên chiến trường")
  if (side === "atk") state._battleContrib[battleId].atk = Math.max(state._battleContrib[battleId].atk, p.quanSo);
  else state._battleContrib[battleId].def = Math.max(state._battleContrib[battleId].def, p.quanSo);

  let currentChaos = state._battleChaos[battleId] || 0.5;
  
  // Player tham chiến làm thay đổi cán cân (chaos) nhưng không được "lật kèo tức thì".
  // Scale down heavily so big armies don't instantly end a historical front.
  const impact = (p.quanSo / 1000) * 0.010;
  state._battleChaos[battleId] = isRebel ? Math.min(0.95, currentChaos + impact) : Math.max(0.05, currentChaos - impact);
  state._playerJoinedBattles[battleId] = side;

  p.theLuc -= 30;

  // Sử dụng simulateBattle để tính toán kết quả hiệp này
  const attacker = {
      name: battleState.atkName,
      armies: isRebel ? [...(battleState.atkArmies || []), { type: "dan_binh", count: p.quanSo, morale: 80 }] : (battleState.atkArmies || []),
      martial: isRebel ? p.voThuat : 10,
      qualityMult: isRebel ? 1.0 : 0.8,
      maaCombatMult: isRebel ? (perkFx(state, "maaCombatMult", 1.0) || 1.0) : 1.0,
      isPlayer: isRebel
  };
  const defender = {
      name: battleState.defName,
      armies: !isRebel ? [...(battleState.defArmies || []), { type: "dan_binh", count: p.quanSo, morale: 80 }] : (battleState.defArmies || []),
      martial: !isRebel ? p.voThuat : 10,
      qualityMult: !isRebel ? 1.0 : 0.8,
      maaCombatMult: !isRebel ? (perkFx(state, "maaCombatMult", 1.0) || 1.0) : 1.0,
      isPlayer: !isRebel
  };

  const result = simulateBattle(attacker, defender, state);
  const playerSideName = isRebel ? attacker.name : defender.name;
  const win = result.winner === playerSideName;
  const remaining = isRebel ? (result.remainingAttacker ?? p.quanSo) : (result.remainingDefender ?? p.quanSo);
  const beforeQuan = p.quanSo;
  p.quanSo = Math.max(0, Math.min(beforeQuan, remaining));

  let feedback = [{ text: "-30 Thể lực", tone: "bad" }];

  if (win) {
    if (isRebel) {
      const loot = 200 + Math.floor(rng(state) * 300);
      p.tien += loot;
      p.uyTinCong += 50;
      setWanted(state, p.wantedLevel + 1, "Cướp bóc quân lương");
      feedback.push({ text: `+${loot} Quan (Chiến lợi phẩm)`, tone: "good" });
      feedback.push({ text: `+50 Uy tín nghĩa quân`, tone: "good" });
      logLine(state, `Cùng nghĩa quân chiến thắng tại ${battleState.name}, thu được bộn tiền lương.`);
    } else {
      const prestigeGain = 100;
      const fameGain = 50;
      p.uyTinCong += prestigeGain;
      p.danhVong += fameGain;
      feedback.push({ text: `+${prestigeGain} Uy tín`, tone: "good" });
      feedback.push({ text: `+${fameGain} Danh vọng`, tone: "good" });
      logLine(state, `Phò trợ triều đình dẹp loạn thắng lợi tại ${battleState.name}, được ban thưởng hậu hĩnh.`);
    }
    // Merit tracking (Top 50). Use a rough proxy: win bonus + surviving force.
    const meritGain = 60 + Math.floor((beforeQuan || 0) / 20);
    addMerit(state, `player:${p.name}`, p.name, p.faction, meritGain);
    const casualties = Math.max(0, beforeQuan - p.quanSo);
    if (casualties > 0) feedback.push({ text: `-${casualties} Quân số`, tone: "bad" });
  } else {
    const casualties = Math.max(0, beforeQuan - p.quanSo);
    if (isRebel) {
      setWanted(state, p.wantedLevel + 2, "Bại binh phản loạn bị tầm nã");
      feedback.push({ text: `+Tăng truy nã`, tone: "bad" });
    } else {
      p.uyTinCong = Math.max(0, p.uyTinCong - 20);
      feedback.push({ text: `-20 Uy tín`, tone: "bad" });
    }
    if (casualties > 0) feedback.push({ text: `-${casualties} Quân số`, tone: "bad" });
    addMerit(state, `player:${p.name}`, p.name, p.faction, 12 + Math.floor((beforeQuan || 0) / 80));
    logLine(state, `Trận ${battleState.name} thất lợi, quân ta tan tác. Vỡ trận phải tháo chạy.`, true);
    // Routed remnants slowly regroup over days (CK3-like)
    if (result.outcome?.type === "rout") {
      const cap = Math.min(beforeQuan, Math.max(p.quanSo, Math.floor(beforeQuan * 0.65)));
      p._routRecover = { daysLeft: 18, cap };
    }
  }

  // If we routed the enemy, sometimes we capture their commander (CK3-ish)
  if (win && result.capture?.victim === "commander" && result.capture.kind === "captured") {
    const prisoner = addPrisoner(state, { name: result.capture.victimName, side: isRebel ? "trieu_dinh" : "nghia_quan", value: 250 + Math.floor(rng(state) * 400) });
    pushCelebration(state, "BẮT TƯỚNG", `Bắt sống <strong>${prisoner.name}</strong>. Có thể giam/chuộc/chém/thả.`, "battle");
    state.pendingEvent = {
      id: "captured_commander",
      blocking: true,
      title: "⛓ Bắt được tướng địch",
      narrative: `Tàn quân tan vỡ. Quân lính lôi tới một tù binh quan trọng: <strong>${prisoner.name}</strong>. Ngươi định xử trí ra sao?`,
      choices: [
        { label: "Giam lại làm con tin", impact:[{label:"Có tù binh",color:"#74c0fc"}], apply(s){ logLine(s, `Giam ${prisoner.name} trong ngục doanh.`); } },
        { label: `Đòi chuộc (${prisoner.value}Q)`, impact:[{label:"+Tiền",color:"#51cf66"}], apply(s){ actionPrisonerRansom(s, prisoner.id); } },
        { label: "Chém", impact:[{label:"+Danh vọng",color:"#ffd43b"},{label:"-Uy tín",color:"#ff6b6b"}], apply(s){ actionPrisonerExecute(s, prisoner.id); } },
        { label: "Thả để lấy lòng dân", impact:[{label:"+Uy tín",color:"#51cf66"}], apply(s){ actionPrisonerRelease(s, prisoner.id); } },
      ]
    };
  }

  // Capture / killed consequences (creates interactive choices)
  if (result.capture?.victim === "player") {
    if (result.capture.kind === "killed") {
      state.gameOver = true;
      state.gameOverReason = "Tử trận — bị chém khi vỡ trận.";
      logLine(state, "☠️ Bị chém khi vỡ trận. Danh tính chìm vào bùn đất.", true);
    } else {
      const ransom = Math.max(120, Math.floor((p.quanSo + 100) * 2));
      state.pendingEvent = {
        id: "battle_captured",
        blocking: true,
        title: "⛓ Bị bắt làm tù binh",
        narrative: `Ngươi bị bắt sống sau khi vỡ trận. Địch đòi chuộc ${ransom} quan.`,
        choices: [
          { label: `Nộp chuộc (${ransom}Q)`, impact:[{label:"Thoát",color:"#51cf66"}], apply(s){
            if (s.player.tien >= ransom) { s.player.tien -= ransom; logLine(s, `Nộp chuộc ${ransom} quan, được thả về.`); }
            else { logLine(s, "Không đủ tiền chuộc! Bị giam thêm, sức khỏe suy kiệt.", true); s.player.theLuc = Math.max(0, s.player.theLuc - 40); if (typeof s.player.hp==="number") s.player.hp = Math.max(1, s.player.hp - 8); }
          }},
          { label: "Trốn ngục (thử Mưu Mẹo)", impact:[{label:"Nguy hiểm",color:"#ffd43b"}], apply(s){
            const ok = rng(state) < (0.25 + (s.player.muuMeo||0)*0.006);
            if (ok) { logLine(s, "Thoát ngục trong đêm! Nhưng tàn quân tán loạn.", true); s.player.theLuc = Math.max(0, s.player.theLuc - 25); }
            else { logLine(s, "Trốn thất bại, bị đánh đập.", true); s.player.theLuc = 0; s.player.dangOm = true; if (typeof s.player.hp==="number") s.player.hp = Math.max(1, s.player.hp - 12); }
          }},
          { label: "Xin chiêu an (mở đường đổi phe)", impact:[{label:"Đổi phe",color:"#74c0fc"}], apply(s){
            const until = (s.ban - 1737) * 360 + s.monthIndex * 30 + (s.gameDay || 1) + 15;
            s._defectWindow = { to: Faction.TRIEU_DINH, untilTotalDays: until };
            logLine(s, "Địch hứa chiêu an nếu ngươi chịu quay về triều.");
          }},
        ]
      };
    }
  }

  return { ok: true, feedback, sfx: win ? "battle" : "caiVa", battleLogs: result.battleLogs };
}

/**
 * Hành động chủ động tấn công chiếm Xã/Làng
 */
export function actionAttackVillage(state, targetLangId, focusHuyenId = null) {
    const p = state.player;
    if (p.dangOm) return { ok: false, msg: "Đang ốm liệt giường." };
    if (p.theLuc < 40) return { ok: false, msg: "Thể lực không đủ để hành quân chiến đấu (cần 40)." };
    if (p.quanSo < 30) return { ok: false, msg: "Quân số quá ít để công thành chiếm đất (cần ít nhất 30 người)." };
    if (p.faction !== Faction.TRIEU_DINH && p.faction !== Faction.NGHIA_QUAN) {
      return { ok: false, msg: "Chỉ phe triều đình hoặc nghĩa quân mới chủ động tấn công chiếm xã được." };
    }

    // Bản đồ có thể đang drill huyện khác với vị trí nhân vật — phải tra làng trong đúng huyện đang xem.
    const huyenKey = focusHuyenId || p.currentHuyen;
    repairGeoCacheFactionFlagsForHuyen(state, huyenKey);
    const geoData = getLowerRegions(state, huyenKey);
    // Find target village and its parent Xa/Tong
    let targetXa = null;
    let targetTong = null;
    let targetLang = null;

    for (let tid in geoData.tong) {
        for (let xid in geoData.tong[tid].xa) {
            if (geoData.tong[tid].xa[xid].lang[targetLangId]) {
                targetTong = geoData.tong[tid];
                targetXa = geoData.tong[tid].xa[xid];
                targetLang = targetXa.lang[targetLangId];
                break;
            }
        }
    }

    if (!targetLang) return { ok: false, msg: "Không tìm thấy địa điểm mục tiêu — có thể đang xem huyện khác với làng bấm (thử mở lại bản đồ cấp làng)." };
    
    const isRebel = p.faction === Faction.NGHIA_QUAN;
    const enemyFlag = isRebel ? Faction.TRIEU_DINH : Faction.NGHIA_QUAN;
    const ownFlag = isRebel ? Faction.NGHIA_QUAN : Faction.TRIEU_DINH;
    const xaCtrl = normalizeLowerGeoFaction(targetXa.control);
    targetXa.control = xaCtrl;

    if (xaCtrl !== enemyFlag) {
      if (xaCtrl === ownFlag) {
        return { ok: false, msg: "Xã này đang do phe ta kiểm soát — không thể tự tấn công đất của mình." };
      }
      if (xaCtrl === Faction.TRUNG_LAP) {
        return { ok: false, msg: "Vùng trung lập — không phải mục tiêu tấn công chính quy trong luật hiện tại." };
      }
      const need = isRebel ? "triều đình" : "nghĩa quân";
      const cur = xaCtrl === Faction.NGHIA_QUAN ? "nghĩa quân" : "triều đình";
      return { ok: false, msg: `Chỉ có thể tấn công xã đang do ${need} giữ. Hiện xã thuộc ${cur}.` };
    }

    p.theLuc -= 40;

    // Simulate Battle
    const attacker = {
        name: p.name + " (Tiền quân)",
        armies: [{ type: "dan_binh", count: p.quanSo, morale: 90 }],
        martial: p.voThuat,
        qualityMult: 1.0,
        isPlayer: true
    };
    
    // Lực lượng phòng thủ xã (dựa trên dân số); vùng triều đình kiểm soát có thêm dân binh trang
    let defCount = Math.floor(targetXa.pop / 10);
    if (xaCtrl === Faction.TRIEU_DINH) {
      defCount += 110 + Math.floor(rng(state) * 70);
    }
    const defender = {
        name: "Dân binh " + targetXa.name,
        armies: [{ type: "dan_binh", count: defCount, morale: xaCtrl === Faction.TRIEU_DINH ? 74 : 70 }],
        martial: xaCtrl === Faction.TRIEU_DINH ? 14 : 10,
        qualityMult: xaCtrl === Faction.TRIEU_DINH ? 0.82 : 0.7
    };

    const result = simulateBattle(attacker, defender, state);
    const win = result.winner === attacker.name;

    let feedback = [{ text: "-40 Thể lực", tone: "bad" }];

    if (win) {
        targetXa.control = isRebel ? Faction.NGHIA_QUAN : Faction.TRIEU_DINH;
        p.uyTinCong += 80;
        p.danhVong += 30;
        feedback.push({ text: `🚩 Đã chiếm ${targetXa.name}!`, tone: "good" });
        feedback.push({ text: `+80 Uy tín`, tone: "good" });
        logLine(state, `Công thành thắng lợi! Cắm cờ ${isRebel ? "Nghĩa Quân" : "Triều Đình"} lên ${targetXa.name}.`);
        
        // Thưởng thêm nếu chiếm được cả Tổng
        const allXa = Object.values(targetTong.xa);
        const winFlag = isRebel ? Faction.NGHIA_QUAN : Faction.TRIEU_DINH;
        const controlled = allXa.filter(x => normalizeLowerGeoFaction(x.control) === winFlag).length;
        if (controlled / allXa.length >= 0.8 && normalizeLowerGeoFaction(targetTong.control) !== winFlag) {
            targetTong.control = winFlag;
            logLine(state, `🚩 CHIẾN CÔNG HIỂN HÁCH: Toàn bộ ${targetTong.name} đã quy phục dưới trướng quân ta!`);
            p.uyTinCong += 200;
        }

        const casualties = Math.ceil(p.quanSo * 0.1);
        p.quanSo -= casualties;
        feedback.push({ text: `-${casualties} Quân số`, tone: "bad" });
    } else {
        const casualties = Math.ceil(p.quanSo * 0.3);
        p.quanSo -= casualties;
        feedback.push({ text: `-${casualties} Quân số`, tone: "bad" });
        logLine(state, `Công kích ${targetXa.name} thất bại. Quân ta bị đánh lui, tổn thất nặng nề.`);
    }

    return { ok: true, feedback, sfx: win ? "battle" : "caiVa" };
}

export function setWanted(state, level, reason, huyenId = null) {
  const p = state.player;
  p.wantedLevel = Math.max(p.wantedLevel || 0, level);
  if (huyenId) p.crimeHuyen = huyenId;
  
  if (level > 0) {
    logLine(state, `🚩 HÀNH VI PHẠM TỘI: ${reason} (Mức ${p.wantedLevel})`, true);
    state.marqueeQueue.push(`Lệnh truy nã: ${p.name} bị quan phủ tầm nã vì ${reason}!`);
  }
}

export function checkWantedArrest(state) {
  const p = state.player;
  if (!p.wantedLevel || p.wantedLevel <= 0) return;

  // Phân biệt: Bắt tại chỗ vs Truy nã toàn quốc
  let arrestChance = 0;
  let isLocalArrest = false;

  if (p.currentHuyen === p.crimeHuyen) {
    // Nếu vẫn ở địa phương nơi gây án -> Tỉ lệ bị bắt rất cao
    arrestChance = 0.50; 
    isLocalArrest = true;
  } else {
    // Nếu đã bỏ trốn sang huyện khác -> Trở thành đối tượng truy nã
    arrestChance = [0, 0.05, 0.15, 0.30][p.wantedLevel] || 0;
  }

  // Võ thuật cao giúp giảm tỉ lệ bị bắt (tối đa giảm 50% nếu voThuat=100)
  const evasionMult = 1 - (Math.min(100, p.voThuat || 0) / 200);
  arrestChance *= evasionMult;

  if (rng(state) < arrestChance) {
    // Perk: amnesty once per year (Âm mưu)
    const amnesty = (perkFx(state, "amnestyPerYear", 0) || 0) > 0;
    if (amnesty && state._amnestyYear !== state.ban) {
      state._amnestyYear = state.ban;
      logLine(state, "🕳️ BÓNG TỐI: Bạn thoát một lần vây bắt trong năm nay nhờ mạng lưới che chở.", true);
      return;
    }
    const arrestMsg = isLocalArrest ? "Bị nha lại và binh lính bắt giữ ngay tại địa phương nơi gây án!" : "Bị tuần binh nhận dạng và vây bắt khi đang lẩn trốn!";
    
    if (p.wantedLevel === 1) {
      logLine(state, `${arrestMsg} Quan phủ triệu tập tra hỏi. Mất 20 Uy tín.`, true);
      p.uyTinCong = Math.max(0, p.uyTinCong - 20);
      p.wantedLevel = 0;
      p.crimeHuyen = null;
    } else if (p.wantedLevel === 2) {
      logLine(state, `${arrestMsg} Bạn bị tống vào ngục tối, tước bỏ quan chức và tịch thu một phần tài sản.`, true);
      p.rank = PlayerRank.DAN_THUONG;
      p.tien = Math.floor(p.tien * 0.5);
      p.thocCaNhan = Math.floor(p.thocCaNhan * 0.5);
      p.wantedLevel = 1; 
      p.crimeHuyen = null;
      if (p.tien >= 500) {
        p.tien -= 500;
        logLine(state, "Nộp 500 quan tiền chạy chọt, bạn được thả tự do sớm.");
      } else {
        p.theLuc = 10;
        logLine(state, "Chịu cực hình trong ngục, thể lực suy kiệt.");
      }
    } else if (p.wantedLevel === 3) {
      logLine(state, `TRẢM QUYẾT: ${arrestMsg} Bạn bị giải ra pháp trường vì tội phản nghịch!`, true);
      if (p.giaDinh.con > 0) {
        logLine(state, `May thay, con cái của bạn đã kịp kế thừa một phần gia sản (30%) và tiếp tục sự nghiệp của cha. Phần còn lại đã bị triều đình tịch biên.`, true);
        p.name = p.name + " Hậu Duệ";
        p.age = 18;
        // Kế thừa 30% (tịch biên gia sản)
        p.tien = Math.floor(p.tien * 0.3);
        p.thocCaNhan = Math.floor(p.thocCaNhan * 0.3);
        p.quanSo = 0; 
        p.rank = PlayerRank.DAN_THUONG;
        p.faction = Faction.TRIEU_DINH;
        p.wantedLevel = 0;
        p.crimeHuyen = null;
      } else {
        state.gameOver = true;
        state.gameOverReason = "Bị triều đình xử trảm vì tội phản nghịch. Gia tộc tuyệt tự.";
      }
    }
  }
}

// Internal helpers exported for other modules
export { clamp, currentYmSerial, ensurePostingIfNeeded, getHuyenGarrisonTroops, getPosting, postingHere, pushCelebration, syncHuyenBannerFromXaBalance, totalDaysAbs, ymKey };
export { processMonthlyShopIncome, processMonthlyShopVacancy, processMonthlyWages, processMonthlyDraftReclaim }; // T3.2c/T3.3: export riêng để test cô lập (gameTick tháng đụng rất nhiều state)
// markShopVacant: đã `export function` tại chỗ (T3.2c-2 hook cho hệ thống cái chết/bỏ nghề + test)


export { actionChooseClanPatron, actionDropClanPatron, actionClanMediate, actionSetClanPressureMode, actionClanMischief, actionBeginClanMission, actionAdvanceClanMissionIntel, actionExecuteClanMission, localClanIds, xaClanIds, pickXaSeatSuccessorClan, adjustClanStatus, syncSeatContestants, tickXaClanStatusMonthly };

export { addCase, daySerial, scheduleDelayedEffect };

export { collapseFromExhaustion, actionCayRuong, actionNghiAnCom, actionKhaiThacDacSan, actionChatGo, actionDetVai, actionChanNuoiLon, actionNauRuou, actionCauCaSong, actionDanhBatVenBien, actionBuonLauMuoi, actionMoBinh, actionLuyenVo };

export { actionTradeItem, getTradeQuote, actionMarketHaggle, getMerchantProgress, actionAcceptMarketContract, getMarketSceneBrief };

export { MARKET_MOODS, MARKET_TRADER_NAMES };

export { actionPostingBuild, resolveCase, actionAssumeOfficeHere, actionLocalLevy, actionLocalFund, actionLocalEmbezzle, actionLocalRecruitMaa, actionLocalCollectTax, actionLocalPatrol, actionLocalPacify, actionLocalBribeSuperior };

export { PostingBuildingDb, ensureCaseList, isOfficialRank, perkFx, playerHoldsSeatAtLeast };

export { actionRebelTrain, actionRebelRaidSupply, actionRebelAidPeople, actionRebelBurnYamen, actionRebelRecruitLocal, addPrisoner, actionPrisonerRelease, actionPrisonerExecute, actionPrisonerRansom };

export { ensureRebel, isControlledByRebelsHere, nextPrisonerId };

export { initQuestsIfNeeded, refreshQuestsYearly, tickQuests };

export { actionXayNha, actionRecruitMaa, actionDemolishNha };
export { actionMuaCongCu };
export { actionMoCuaHang };
export { actionThueNguoi, actionSaThai };
export { actionXinCongDien, actionMuaRuongTu };

export { hasPerk };

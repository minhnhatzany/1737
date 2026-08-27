/**
 * models.js — Mô hình dữ liệu Sandbox Đại Việt thế kỷ 18 (Lê–Trịnh)
 * Đại tu: Thêm tất cả rank võ quan, dynasty table, và lifecycle mới
 */

export const Faction = {
  TRIEU_DINH: "trieu_dinh",
  NGHIA_QUAN: "nghia_quan",
  TRUNG_LAP:  "trung_lap",
  CUOP:       "cuop",
};

export const RegionId = {
  THANG_LONG:  "thang_long",
  SON_NAM:     "son_nam",
  HAI_DUONG:   "hai_duong",
  SON_TAY:     "son_tay",
  KINH_BAC:    "kinh_bac",
  AN_QUANG:    "an_quang",
  TUYEN_QUANG: "tuyen_quang",
  HUNG_HOA:    "hung_hoa",
  LANG_SON:    "lang_son",
  THAI_NGUYEN: "thai_nguyen",
  CAO_BINH:    "cao_binh",
  THANH_HOA:   "thanh_hoa",
  NGHE_AN:     "nghe_an",
};

export const PlayerRank = {
  // Dân thường
  DAN_THUONG:   "dan_thuong",
  PHU_HO:       "phu_ho",
  // Chức dịch làng xã
  LY_TRUONG:    "ly_truong",
  CHANH_TONG:   "chanh_tong",
  // Văn quan
  TRI_HUYEN:    "tri_huyen",
  TRI_PHU:      "tri_phu",
  HIEN_SAT_SU:  "hien_sat_su",
  THUONG_THU:   "thuong_thu",
  // Văn quan (đại tu 2026-04): nhánh trấn & phủ chúa/triều (giữ tương thích rank cũ)
  THUA_CHINH_SU:"thua_chinh_su", // quản lý hành chính thuế má cấp trấn (tương đương Thừa ty)
  DOC_TRAN:     "doc_tran",      // đứng đầu trấn (đốc trấn / trấn thủ)
  THAM_TUNG:    "tham_tung",     // phụ chính phủ chúa (siêu cao)
  BOI_TUNG:     "boi_tung",      // phụ chính (siêu cao)
  // Võ quan — thứ bậc đầy đủ
  DOI_TRUONG:   "doi_truong",    // Đội trưởng (sau Bác Cử)
  CAI_DOI:      "cai_doi",       // (mới) cai đội cấp huyện (tương đương đội trưởng nhưng đúng danh xưng)
  CAI_CO:       "cai_co",        // Cai cơ (dẫn đội 50-100)
  CHUONG_CO:    "chuong_co",     // (mới) chưởng cơ cấp phủ
  BACH_HO:      "bach_ho",       // Bách hộ (100+ quân)
  TONG_LINH:    "tong_linh",     // Tổng lĩnh (500+ quân)
  DO_DOC:       "do_doc",        // Đô đốc trấn (1000+ quân)
  DO_CHI_HUY_SU:"do_chi_huy_su", // (mới) đô chỉ huy sứ cấp trấn
  DAI_TUONG:    "dai_tuong",     // Đại tướng (5000+ quân, gần đỉnh)
  // Thủ lĩnh / Phản loạn
  THU_LINH:     "thu_linh_nghia_quan",
  VUONG:        "vuong",          // Xưng vương
};

export const RankLabel = {
  [PlayerRank.DAN_THUONG]:  "Thứ dân",
  [PlayerRank.PHU_HO]:      "Phú hộ",
  [PlayerRank.LY_TRUONG]:   "Lý trưởng",
  [PlayerRank.CHANH_TONG]:  "Chánh tổng",
  [PlayerRank.TRI_HUYEN]:   "Tri huyện",
  [PlayerRank.TRI_PHU]:     "Tri phủ",
  [PlayerRank.HIEN_SAT_SU]: "Hiến sát sứ",
  [PlayerRank.THUONG_THU]:  "Thượng thư",
  [PlayerRank.THUA_CHINH_SU]:"Thừa chính sứ",
  [PlayerRank.DOC_TRAN]:    "Đốc trấn",
  [PlayerRank.THAM_TUNG]:   "Tham tụng",
  [PlayerRank.BOI_TUNG]:    "Bồi tụng",
  [PlayerRank.DOI_TRUONG]:  "Đội trưởng Hoàng Gia",
  [PlayerRank.CAI_DOI]:     "Cai đội (huyện)",
  [PlayerRank.CAI_CO]:      "Cai cơ",
  [PlayerRank.CHUONG_CO]:   "Chưởng cơ (phủ)",
  [PlayerRank.BACH_HO]:     "Bách hộ",
  [PlayerRank.TONG_LINH]:   "Tổng lĩnh nha môn",
  [PlayerRank.DO_DOC]:      "Đô đốc trấn sở",
  [PlayerRank.DO_CHI_HUY_SU]:"Đô chỉ huy sứ (trấn)",
  [PlayerRank.DAI_TUONG]:   "Đại tướng quân",
  [PlayerRank.THU_LINH]:    "Thủ lĩnh nghĩa quân",
  [PlayerRank.VUONG]:       "Vương",
};

// Bảng Vua Lê & Chúa Trịnh theo năm
export const DynastyTable = [
  { fromYear: 1729, toYear: 1732, vua: "Lê Duy Phường (Lê Đế Duy Phường)", chua: "Trịnh Cương" },
  { fromYear: 1732, toYear: 1735, vua: "Lê Thuần Tông (Duy Tường)", chua: "Trịnh Giang" },
  { fromYear: 1735, toYear: 1740, vua: "Lê Ý Tông (Duy Thận)", chua: "Trịnh Giang" },
  { fromYear: 1740, toYear: 1786, vua: "Lê Hiển Tông (Duy Diêu)", chua: "Trịnh Doanh (1740–1767)" },
];

export function getDynastyInfo(year) {
  for (const d of DynastyTable) {
    if (year >= d.fromYear && year < d.toYear) return d;
  }
  return DynastyTable[DynastyTable.length - 1];
}

export const NpcTrait = {
  THAM_LAM:   "Tham lam",
  CHINH_TRUC: "Chính trực",
  HIEU_CHIEN: "Hiếu chiến",
  HIEP_NGHIA: "Hiệp nghĩa",
  KHO_THELUC: "Khỏe mạnh",
  MUU_ĐO:     "Mưu đồ",
  SANG_TROC:  "Sang trọc",
  TU_SI:      "Từ sĩ",
};

export const Gender = {
  NAM: "Nam",
  NU:  "Nữ",
};

export const ClanAttitude = {
  THU:       "Thù ghét",
  TRUNG_LAP: "Trung lập",
  KINH:      "Kính trọng",
  LIEN_MINH: "Đồng minh",
};

export const MenAtArmType = {
  DAN_BINH:    { id: "dan_binh",    name: "Dân binh",           atk: 10, def: 10,  cost: 2,   maint: 1,  type: "infantry", counter: [] },
  NHAT_BINH:   { id: "nhat_binh",   name: "Nhất Binh",          atk: 20, def: 25,  cost: 10,  maint: 2,  type: "infantry", counter: ["pikeman"] },
  BO_BINH_NANG:{ id: "bo_binh_nang",name: "Bộ Binh Tráng Khảm", atk: 35, def: 50,  cost: 25,  maint: 4,  type: "heavy_inf",counter: ["pikeman", "ranged"] },
  THUONG_BINH: { id: "thuong_binh", name: "Trường Thương Binh", atk: 25, def: 35,  cost: 15,  maint: 3,  type: "pikeman",  counter: ["cavalry_light", "cavalry_heavy", "elephant"] },
  CUNG_NO:     { id: "cung_no",     name: "Cung Nỏ",            atk: 30, def: 15,  cost: 20,  maint: 3,  type: "ranged",   counter: ["infantry"] },
  DIEU_THUONG: { id: "dieu_thuong", name: "Súng Điểu Thương",   atk: 50, def: 15,  cost: 45,  maint: 5,  type: "gunner",   counter: ["heavy_inf", "elephant"] },
  KHINH_KY:    { id: "khinh_ky",    name: "Khinh Kỵ Binh",      atk: 40, def: 20,  cost: 50,  maint: 6,  type: "cavalry_light",  counter: ["ranged", "gunner"] },
  TRONG_KY:    { id: "trong_ky",    name: "Thiết Kỵ (Trọng Kỵ)",atk: 65, def: 40,  cost: 100, maint: 10, type: "cavalry_heavy",  counter: ["infantry", "heavy_inf"] },
  TUONG_BINH:  { id: "tuong_binh",  name: "Tượng Binh",         atk: 90, def: 60,  cost: 200, maint: 20, type: "elephant", counter: ["infantry", "cavalry_light", "cavalry_heavy"] },
  UU_BINH:     { id: "uu_binh",     name: "Ưu Binh (Kiêu Binh)",atk: 60, def: 60,  cost: 80,  maint: 12, type: "elite",    counter: ["infantry", "pikeman", "ranged"] },
  CAM_QUAN:    { id: "cam_quan",    name: "Cấm Quân",           atk: 80, def: 80,  cost: 150, maint: 15, type: "elite",    counter: ["infantry", "heavy_inf", "cavalry_light"] },
  PHAO_BINH:   { id: "phao_binh",   name: "Đại Bác Thần Công",  atk: 150,def: 20,  cost: 300, maint: 25, type: "artillery",counter: ["elephant", "elite", "heavy_inf"] },
  THUY_QUAN:   { id: "thuy_quan",   name: "Thủy Quân Ven Sông", atk: 35, def: 25,  cost: 50,  maint: 6,  type: "naval",    counter: [] },
  // Rebel generic MAA (no guns/artillery/elephants by default)
  BO_BINH_NHE: { id: "bo_binh_nhe", name: "Bộ Binh Nhẹ",         atk: 22, def: 14,  cost: 18,  maint: 3,  type: "infantry_light", counter: ["ranged"] },
};

export const HoldingType = {
  DIEN_TRANG: { id: "dien_trang", name: "Điền Trang",       cost: 100, buff: "thoc",         baseYield: 25, maxLevel: 3 },
  LO_REN:     { id: "lo_ren",     name: "Lò Rèn",            cost: 150, buff: "vo_thuat_army", baseYield: 0,  maxLevel: 3 },
  TUU_LAU:    { id: "tuu_lau",    name: "Tửu Lâu",           cost: 200, buff: "tien",          baseYield: 15, maxLevel: 3 },
  HOC_VIEN:   { id: "hoc_vien",   name: "Sảnh Sĩ Phu",      cost: 250, buff: "hoc_van_xp",    baseYield: 0,  maxLevel: 3 },
};

export const DanhVongLevel = [
  "Vô danh tiểu tốt", "Kẻ có tiền của", "Hào trưởng địa phương",
  "Danh gia vọng tộc", "Hùng bá một phương", "Huyền thoại lịch sử"
];

// Tên làng Đàng Ngoài thời Lê-Trịnh
export const LangNames = [
  "Yên Sơn", "Ninh Xá", "Hương Canh", "Tam Đảo", "Bình Giang",
  "Đoài Lộc", "An Khánh", "Tứ Kỳ", "Phủ Cừ", "Gia Lộc",
  "Kim Bảng", "Lập Thạch", "Vũ Giang", "Quế Dương", "Mỹ Lộc",
  "Giao Thủy", "Đông Ngàn", "Lang Tài", "Bảo Lộc", "Tán Lâm",
  "Thiên Lộc", "Thanh Trì", "Phú Xuyên", "Ý Yên", "Hoa Lư",
  "Văn Giang", "La Khê", "Ngọc Tĩnh", "Thượng Nguyên", "Đại Bái",
];

let npcIdSeq = 1;
export function nextNpcId() { return `npc_${npcIdSeq++}`; }

export class NPC {
  constructor({
    id = nextNpcId(),
    name,
    age,
    gender,
    intelligence = 5,
    stamina = 5,
    uyTin = 0,
    tien = randInt(0, 5),
    quanSo = 0,
    rank = PlayerRank.DAN_THUONG,
    traits = [],
    relationships = [],
    clanId = null,
    opinion = randInt(-10, 10),
    faction = Faction.TRUNG_LAP,
    currentRegion = RegionId.SON_NAM,
    currentPhu = null,
    currentHuyen = null,
    currentTong = null,
    currentXa = null,
    currentLang = null,
  }) {
    this.id = id;
    this.name = name;
    this.age = age;
    this.gender = gender;
    this.intelligence = intelligence;
    this.stamina = stamina;
    this.uyTin = uyTin;
    this.tien = tien;
    this.quanSo = quanSo;
    this.rank = rank;
    this.traits = traits;
    this.relationships = relationships;
    this.clanId = clanId;
    this.opinion = opinion;
    this.faction = faction;
    this.currentRegion = currentRegion;
    this.currentPhu = currentPhu;
    this.currentHuyen = currentHuyen;
    this.currentTong = currentTong;
    this.currentXa = currentXa;
    this.currentLang = currentLang;
    // 5 chỉ số — đa số 9–20, hiếm khi tới ~48 (không spam cao thủ)
    const core = () => (Math.random() < 0.9)
      ? 9 + Math.floor(Math.random() * 12)
      : Math.min(48, 20 + Math.floor(Math.random() * 28));
    this.ngoaiGiao = core();
    this.voThuat   = core();
    this.quanLy    = core();
    this.muuMeo    = core();
    this.hocVan    = core();
  }
}

let clanIdSeq = 1;
export function nextClanId() { return `clan_${clanIdSeq++}`; }

export class Clan {
  constructor({
    id = nextClanId(),
    name,
    quyenLuc = 20,
    ruongDat = 10,
    trungThanh = 50,
    attitude = ClanAttitude.TRUNG_LAP,
    memberIds = [],
  }) {
    this.id = id;
    this.name = name;
    this.quyenLuc = quyenLuc;
    this.ruongDat = ruongDat;
    this.trungThanh = trungThanh;
    this.attitude = attitude;
    this.memberIds = memberIds.slice();
  }
}

export class Village {
  constructor({
    name,
    quyLang = 100,
    khoThoc = 500,
    unrest = 10,
    pops = { nong: 100, tho: 10, thuong: 5 },
    clanIds = [],
  }) {
    this.name = name;
    this.quyLang = quyLang;
    this.khoThoc = khoThoc;
    this.unrest = unrest;
    this.pops = pops;
    this.clanIds = clanIds.slice();
  }
}

export function totalPops(v) {
  const p = v?.pops || {};
  return (p.nong || 0) + (p.tho || 0) + (p.thuong || 0);
}

export class Player {
  constructor({
    ten,
    tien = 10,
    thocCaNhan = 15,
    uyTinCong = 0,
    rank = PlayerRank.DAN_THUONG,
    villageId = "v1",
    quyenLuc = 0,
    binhQuyen = 0,
    quanSo = 0,
    faction = Faction.TRIEU_DINH,
    homeRegion = RegionId.SON_NAM,
    homePhu = "thien_truong",
    homeHuyen = "my_loc",
    homeTong = null,   // Will be populated dynamically
    homeXa = null,
    homeLang = null,
    currentRegion = RegionId.SON_NAM,
    currentPhu = "thien_truong",
    currentHuyen = "my_loc",
    currentTong = null,
    currentXa = null,
    currentLang = null,
    ngoaiGiao = 5,
    voThuat = 10,
    quanLy = 5,
    muuMeo = 5,
    hocVan = 5,
  }) {
    this.ten = ten;
    this.tien = tien;
    this.thocCaNhan = thocCaNhan;
    this.uyTinCong = uyTinCong;
    this.rank = rank;
    this.villageId = villageId;
    this.quyenLuc = quyenLuc;
    this.binhQuyen = binhQuyen;
    this.quanSo = quanSo;
    this.faction = faction;
    this.homeRegion = homeRegion;
    this.homePhu = homePhu;
    this.homeHuyen = homeHuyen;
    this.homeTong = homeTong;
    this.homeXa = homeXa;
    this.homeLang = homeLang;
    this.currentRegion = currentRegion;
    this.currentPhu = currentPhu;
    this.currentHuyen = currentHuyen;
    this.currentTong = currentTong;
    this.currentXa = currentXa;
    this.currentLang = currentLang;


    this.ngoaiGiao = ngoaiGiao;
    this.voThuat   = voThuat;
    this.quanLy    = quanLy;
    this.muuMeo    = muuMeo;
    this.hocVan    = hocVan;

    this.age = 18;
    this.danhVong = 0;
    this.diSan = [];
    this.perks = [];
    this.hocVi = "Vô Danh";

    // Lối sống
    this.lifestyleFocus = null;
    this.lifestylePerks = {};
    this.lifestyleXP = {};
    this.lifestylePoints = 0;
    this._hocThuatAccum = 0;

    this.giaDinh = { vo: "", con: 0 };
    this.holdings = [];
    this.armies = [];
    this.maa = [];
    this.inventory = {
      ruou: 0, tra: 0, lua: 0, muoi: 0, go: 0,
    };
    this.properties = { ruongDat: 1, tuuLau: 0 };

    // Sinh mệnh & Thể lực (tách riêng)
    this.hpMax = 100;
    this.hp = 100;
    this.theLucMax = 100;
    this.theLuc = 100;
    this.dangOm = false;
    this.noVayConLai = 0;
    this.managedVillageIds = [];
    this.trieuNopTichLuy = 0;
    this.trongSoDenLy = false;
    this.camCoRuongThang = 0;
  }
}

function randInt(a, b) {
  return a + Math.floor(Math.random() * (b - a + 1));
}

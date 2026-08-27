import { PlayerRank, RegionId, RankLabel } from "./models.js";
import { logLine } from "./log.js";
import { planActivity, activityStatus } from "./engine.js";

function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function rng() { return Math.random(); }

function monthsAheadTo(monthIndexNow, dayNow, targetMonthIndex, latestRegisterDay = 10) {
  // monthIndex: 1..12
  // If we are already in target month and past register day => schedule next year.
  let delta = (targetMonthIndex - monthIndexNow);
  if (delta < 0) delta += 12;
  if (delta === 0 && (dayNow || 1) > latestRegisterDay) delta = 12;
  // If too close and already past latest register day in the prior month window, push next cycle.
  if (delta === 0 && (dayNow || 1) > latestRegisterDay) delta = 12;
  return Math.max(1, delta);
}

// === DÙI MÀI KINH SỬ ===
export function actionDiHoc(state) {
  const p = state.player;
  if (p.faction === "nghia_quan" || (p.wantedLevel || 0) > 0) return { ok: false, msg: "Đã tạo phản / bị truy nã, không còn đường dùi mài kinh sử." };
  if (p.tien < 5) return { ok: false, msg: "Không có 5 Quan mua bút nghiên." };
  if (p.theLuc < 30) return { ok: false, msg: "Mệt mỏi đứt hơi, không thể đọc sách." };

  p.tien -= 5;
  p.theLuc -= 30;

  // Số học đường nâng cao bonus
  const hasSchool = (p.holdings || []).find(h => h.typeId === "hoc_duong" || h.typeId === "van_mieu");
  let baseChance = 0.40 + (hasSchool ? 0.15 : 0);

  if (rng() < baseChance) {
    p.hocVan = Math.min(100, p.hocVan + 1);
    logLine(state, `Cày quyển Tứ Thư Ngũ Kinh thâu đêm. Học Vấn +1!`);
    return { ok: true, feedback: [{ text: "+1 Học Vấn", tone: "good" }], sfx: "murmur" };
  } else {
    logLine(state, `Đọc đi đọc lại vẫn chưa ngộ thêm điều gì. Tiếp tục kiên trì!`);
    return { ok: true, feedback: [{ text: "-30 TL", tone: "bad" }], sfx: "cay" };
  }
}

// === KHOA CỬ VĂN ===

export function actionThiHuong(state) {
  const p = state.player;
  if (p.faction === "nghia_quan" || (p.wantedLevel || 0) > 0) return { ok: false, msg: "Đang bị truy nã / làm phản, cấm dự khoa cử." };
  if (p.hocVi === "Hương Cống" || p.hocVi === "Tiến Sĩ") return { ok: false, msg: "Đã qua kỳ Hương cống rồi!" };
  if (p.hocVan < 20) return { ok: false, msg: "Học Vấn < 20. Quan trường đuổi về." };
  // New flow: register into scheduled activity (engine.js handles countdown + travel + result day)
  // Default calendar: Thi Hương mở vào Tháng 3 hằng năm tại địa phương (không bắt buộc Thăng Long)
  const monthsAhead = monthsAheadTo(state.monthIndex, state.gameDay, 3, 12);
  const res = planActivity(state, "thi_huong", { monthsAhead });
  if (!res.ok) return res;
  logLine(state, `📜 Ghi danh Thi Hương. Khai mạc vào tháng 3 (còn ~${monthsAhead} tháng).`, true);
  return res;
}

export function actionThiHoi(state) {
  const p = state.player;
  if (p.faction === "nghia_quan" || (p.wantedLevel || 0) > 0) return { ok: false, msg: "Đang bị truy nã / làm phản, cấm dự khoa cử." };
  if (p.hocVi !== "Hương Cống") return { ok: false, msg: "Chỉ người có bằng Hương Cống mới được thi Hội." };
  if (p.hocVan < 40) return { ok: false, msg: "Học Vấn < 40, rớt ngay vòng đầu." };
  // Default calendar: Thi Hội mở vào Tháng 7 tại Thăng Long
  const monthsAhead = monthsAheadTo(state.monthIndex, state.gameDay, 7, 12);
  const res = planActivity(state, "thi_hoi", { monthsAhead });
  if (!res.ok) return res;
  logLine(state, `🏯 Ghi danh Thi Hội (Thăng Long). Khai mạc vào tháng 7.`, true);
  return res;
}

export function actionThiDinh(state) {
  const p = state.player;
  if (p.faction === "nghia_quan" || (p.wantedLevel || 0) > 0) return { ok: false, msg: "Đang bị truy nã / làm phản, cấm dự khoa cử." };
  if (p.hocVi !== "Trúng Cách") return { ok: false, msg: "Chỉ Trúng Cách thi Hội mới được dự Điện Thí." };
  if (p.hocVan < 60) return { ok: false, msg: "Học thức < 60. Không đủ bản lĩnh bệ kiến Vương gia." };
  // Default calendar: Thi Đình mở vào Tháng 8 tại Thăng Long (sau Thi Hội)
  const monthsAhead = monthsAheadTo(state.monthIndex, state.gameDay, 8, 18);
  const res = planActivity(state, "thi_dinh", { monthsAhead });
  if (!res.ok) return res;
  logLine(state, `👑 Ghi danh Thi Đình (Thăng Long). Khai mạc vào tháng 8.`, true);
  return res;
}

// === KHOA CỬ VÕ ===

export function actionBacCu(state) {
  const p = state.player;
  if (p.faction === "nghia_quan" || (p.wantedLevel || 0) > 0) return { ok: false, msg: "Đang bị truy nã / làm phản, cấm dự khoa võ." };
  if (![PlayerRank.DAN_THUONG, PlayerRank.PHU_HO, PlayerRank.LY_TRUONG].includes(p.rank)) {
    return { ok: false, msg: "Đã có danh phận lớn, cấm tỷ thí nơi trường võ." };
  }
  if (p.voThuat < 20) return { ok: false, msg: "Võ Thuật < 20. Lên lôi đài nạp mạng à?" };
  // New flow: schedule Bác Cử as activity (monthly-ish)
  const monthsAhead = Math.max(1, (state.gameDay || 1) > 12 ? 2 : 1);
  const res = planActivity(state, "bac_cu", { monthsAhead });
  if (!res.ok) return res;
  logLine(state, `🥁 Ghi danh Bác Cử. Khai mạc sớm nhất tháng tới.`, true);
  return res;
}

// === THĂNG TIẾN VÕ QUAN ===

export function actionThangTienVo(state) {
  const p = state.player;
  if (p.faction === "nghia_quan" || (p.wantedLevel || 0) > 0) return { ok: false, msg: "Đã tạo phản / bị truy nã, không thể thăng tiến võ quan triều đình." };
  const voRankChain = [
    { from: PlayerRank.DOI_TRUONG, to: PlayerRank.CAI_CO,   label: "Cai Cơ",    voReq: 35, danVongReq: 50,  quanReq: 50,   tienReq: 200  },
    { from: PlayerRank.CAI_CO,     to: PlayerRank.BACH_HO,  label: "Bách Hộ",   voReq: 50, danVongReq: 150, quanReq: 150,  tienReq: 500  },
    { from: PlayerRank.BACH_HO,    to: PlayerRank.TONG_LINH,label: "Tổng Lĩnh", voReq: 65, danVongReq: 300, quanReq: 500,  tienReq: 2000 },
    { from: PlayerRank.TONG_LINH,  to: PlayerRank.DO_DOC,   label: "Đô Đốc",    voReq: 80, danVongReq: 600, quanReq: 1000, tienReq: 5000 },
    { from: PlayerRank.DO_DOC,     to: PlayerRank.DAI_TUONG,label: "Đại Tướng", voReq: 95, danVongReq: 1200,quanReq: 5000, tienReq: 15000},
  ];

  const step = voRankChain.find(s => s.from === p.rank);
  if (!step) {
    if (p.rank === PlayerRank.DAI_TUONG) return { ok: false, msg: "Ngài đã là Đại Tướng — tột đỉnh võ quan triều Lê! Chỉ có chiếu chỉ Chúa Trịnh mới có thể tiến xa hơn." };
    return { ok: false, msg: "Không thể thăng tiến từ cấp bậc hiện tại qua đường Võ Quan. Hãy thử Khoa Bảng Văn hoặc lập công trận." };
  }

  if (p.voThuat < step.voReq)   return { ok: false, msg: `Cần Võ Thuật ≥ ${step.voReq} (hiện có ${p.voThuat}).` };
  if (p.danhVong < step.danVongReq) return { ok: false, msg: `Cần Danh Vọng ≥ ${step.danVongReq} (đang có ${p.danhVong}).` };
  if (p.quanSo < step.quanReq)  return { ok: false, msg: `Cần ≥ ${step.quanReq} quân dưới trướng.` };
  if (p.tien < step.tienReq)   return { ok: false, msg: `Cần ${step.tienReq} Quan lo lót Lục Phiên.` };

  p.tien -= step.tienReq;
  p.theLuc -= 20;

  const successRate = Math.min(0.9, 0.3 + p.uyTinCong / 200 + p.danhVong / 2000);
  if (rng() < successRate) {
    p.rank = step.to;
    p.danhVong += 200;
    p.uyTinCong += 80;
    logLine(state, `CHIẾU CHỈ PHỦ CHÚA: Thăng phong ${step.label}! Toàn quân hoan hô, Danh Vọng +200!`);
    return { ok: true, feedback: [{ text: `↑ ${step.label}`, tone: "good" }], sfx: "battle" };
  } else {
    logLine(state, `Phủ Chúa thu tiền nhưng bác đơn thăng chức. Mất tiền lót tay không đơm trái!`);
    return { ok: false, feedback: [{ text: "Bị Lờ", tone: "bad" }], sfx: "caiVa" };
  }
}

// === VÕ QUAN BỔ NHẬM VĂN QUAN (hoặc ngược lại) ===

export function actionXinChucBoNhiem(state) {
  const p = state.player;
  if (p.faction === "nghia_quan" || (p.wantedLevel || 0) > 0) return { ok: false, msg: "Đã tạo phản / bị truy nã, không thể xin bổ nhậm triều đình." };

  // Cần ít nhất có rank đáng kể
  const eligibleRanks = [
    PlayerRank.DOI_TRUONG, PlayerRank.CAI_CO, PlayerRank.BACH_HO,
    PlayerRank.TONG_LINH, PlayerRank.DO_DOC, PlayerRank.DAI_TUONG,
    PlayerRank.TRI_HUYEN, PlayerRank.TRI_PHU, PlayerRank.HIEN_SAT_SU,
  ];

  if (!eligibleRanks.includes(p.rank)) {
    return { ok: false, msg: "Cần có chức tước tối thiểu (Đội Trưởng hoặc Tri Huyện) để nộp đơn xin bổ nhậm." };
  }
  if (p.tien < 500) return { ok: false, msg: "Cần ít nhất 500 Quan lo lót Lục Phiên nộp đơn." };
  if (p.uyTinCong < 30) return { ok: false, msg: "Uy tín quá thấp. Quan trên không để mắt tới." };

  p.tien -= 500;
  p.theLuc -= 20;

  const regions = ["Sơn Nam", "Hải Dương", "Kinh Bắc", "Sơn Tây"];
  const region  = regions[randInt(0, regions.length - 1)];

  const isVo = [PlayerRank.DOI_TRUONG, PlayerRank.CAI_CO, PlayerRank.BACH_HO, PlayerRank.TONG_LINH, PlayerRank.DO_DOC, PlayerRank.DAI_TUONG].includes(p.rank);

  let newRank, label;
  if (isVo) {
    // Võ quan được bổ làm văn quan địa phương
    newRank = PlayerRank.TRI_HUYEN;
    label = "Tri Huyện";
  } else {
    newRank = PlayerRank.CAI_CO;
    label = "Cai Cơ";
  }

  if (rng() < 0.5 + p.uyTinCong / 300) {
    const oldRank = p.rank;
    p.rank = newRank;
    p.uyTinCong += 40;
    p.danhVong += 80;
    p.tien += 300; // Ban bổng
    logLine(state, `CHIẾU CHỈ PHỦ CHÚA: Xuất chiếu bổ nhậm làm ${label} tại ${region}! Lộc ban 300 Quan. (Ghi chú: di chuyển tới ${region} bằng tab Bản Đồ để nhậm chức.)`);
    return { ok: true, feedback: [{ text: `Bổ Nhậm ${label}`, tone: "good" }], sfx: "battle" };
  } else {
    logLine(state, `Nộp đơn nhưng Phủ Chúa chưa duyệt lần này. Thử lại khi Uy Tín cao hơn.`);
    return { ok: false, feedback: [{ text: "Bị Bỏ Qua", tone: "bad" }], sfx: "murmur" };
  }
}

// === LUÂN CHUYỂN PHỦ CHÚA (Văn Quan) ===
export function actionLuanChuyenKhaoKhoa(state) {
  const p = state.player;
  if (p.faction === "nghia_quan" || (p.wantedLevel || 0) > 0) return { ok: false, msg: "Đã tạo phản / bị truy nã, không thể đệ đơn phủ chúa." };

  if (p.rank === PlayerRank.THUONG_THU) return { ok: false, msg: "Đã tột đỉnh Lục Phiên, không thể thăng thêm!" };

  let requiredTien = 0, requiredQuanLy = 0, nextRank = null, nextRankLabel = "";

  if (p.rank === PlayerRank.TRI_HUYEN) {
    requiredTien = 1000; requiredQuanLy = 30; nextRank = PlayerRank.TRI_PHU; nextRankLabel = "Tri Phủ";
  } else if (p.rank === PlayerRank.TRI_PHU) {
    requiredTien = 3000; requiredQuanLy = 50; nextRank = PlayerRank.HIEN_SAT_SU; nextRankLabel = "Hiến Sát Sứ";
  } else if (p.rank === PlayerRank.HIEN_SAT_SU) {
    requiredTien = 10000; requiredQuanLy = 80; nextRank = PlayerRank.THUONG_THU; nextRankLabel = "Thượng Thư Lục Phiên";
  } else {
    return { ok: false, msg: "Bạn chưa làm Quan Hành Chính (Tri Huyện+). Thi Đình hoặc nhờ Bổ Nhậm trước." };
  }

  if (p.tien < requiredTien) return { ok: false, msg: `Cần ${requiredTien} Quan lo lót Lục Phiên.` };
  if (p.quanLy < requiredQuanLy) return { ok: false, msg: `Cần ${requiredQuanLy} Quản Lý để chứng minh tài năng.` };

  p.tien -= requiredTien;
  p.theLuc -= 30;

  if (rng() < (p.uyTinCong / 100) + 0.3) {
    p.rank = nextRank;
    p.danhVong += 500;
    p.uyTinCong += 100;
    logLine(state, `BÁO TIN ĐẠI HỈ: Lục Phiên chuẩn tấu thăng chức ${nextRankLabel}!`);
    return { ok: true, feedback: [{ text: `↑ ${nextRankLabel}`, tone: "good" }], sfx: "coin" };
  } else {
    logLine(state, `Phủ Chúa bác bỏ: thu tiền nhưng chê thiếu uy tín. Dậm chân tại chỗ!`);
    return { ok: false, feedback: [{ text: "Chạy Chức Bị Lừa", tone: "bad" }], sfx: "caiVa" };
  }
}

// Hiển thị trạng thái thăng tiến hiện tại
export function getRankProgressInfo(state) {
  const p = state.player;
  const voChain = [
    { from: PlayerRank.DOI_TRUONG, to: PlayerRank.CAI_CO,   label: "Cai Cơ",    voReq: 35, danVongReq: 50,  quanReq: 50,   tienReq: 200  },
    { from: PlayerRank.CAI_CO,     to: PlayerRank.BACH_HO,  label: "Bách Hộ",   voReq: 50, danVongReq: 150, quanReq: 150,  tienReq: 500  },
    { from: PlayerRank.BACH_HO,    to: PlayerRank.TONG_LINH,label: "Tổng Lĩnh", voReq: 65, danVongReq: 300, quanReq: 500,  tienReq: 2000 },
    { from: PlayerRank.TONG_LINH,  to: PlayerRank.DO_DOC,   label: "Đô Đốc",    voReq: 80, danVongReq: 600, quanReq: 1000, tienReq: 5000 },
    { from: PlayerRank.DO_DOC,     to: PlayerRank.DAI_TUONG,label: "Đại Tướng", voReq: 95, danVongReq: 1200,quanReq: 5000, tienReq: 15000},
  ];
  return voChain.find(s => s.from === p.rank) || null;
}

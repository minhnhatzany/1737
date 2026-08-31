import { FarmTenure, congDienSlots, RUONG_TU_GIA, RE_SHARE_TO_LANDLORD, makeFarmPlot,
  PHASE_DAYS, LAM_DAT_DAYS_TRAU, PHASE_LABEL } from "../core/farm.js";
import { JobKind, JOB_WAGE_BASE, attachJob, detachJob } from "../core/employment.js";
import { seatIdForXa } from "../core/seats.js";
import { Faction } from "../models.js";
import { totalDaysAbs } from "../engine.js";
import { collapseFromExhaustion } from "./livelihood.js";
import { bumpSkill } from "../lifestyle.js";
import { logLine } from "../log.js";

/** Lý trưởng xã đang đứng = "địa chủ" cho cày thuê/cấy rẽ. null nếu ghế trống (Vạn Xuân
 *  cố ý không có lý trưởng — thiết kế Quảng Oai; đây KHÔNG phải lỗ hổng cần vá). */
function xaLandlordId(state, xaId) {
  const seat = state.seats?.[seatIdForXa(xaId)];
  return seat?.occupantId || null;
}

/**
 * T3.3-2a — xin một phần ruộng công của làng (xã đang đứng). KHAN HIẾM: xã chỉ có
 * congDienSlots(suatDinh) thửa; hết suất -> từ chối (đúng tinh thần "làng đông thì
 * không phải ai cũng có phần"). Ruộng công KHÔNG có landlord; tô nộp làng: T3.3-4.
 */
export function actionXinCongDien(state) {
  const p = state.player;
  const v = state.village;
  if (!v || !v.xaId) return { ok: false, msg: "Nơi này không có ruộng công của làng." };
  if (!Array.isArray(p.farmPlots)) p.farmPlots = [];
  if (p.farmPlots.some(f => f.tenure === FarmTenure.CONG && f.xaId === v.xaId)) {
    return { ok: false, msg: "Ngươi đã có phần ruộng công ở xã này rồi." };
  }
  const slots = congDienSlots(v.suatDinh);
  const taken = v.congDienTaken || 0;
  if (taken >= slots) {
    return { ok: false, msg: `Xã ${v.name} đã chia hết ${slots} suất ruộng công. Không còn phần cho ngươi.` };
  }
  state._plotSeq = (state._plotSeq || 1) + 1;
  p.farmPlots.push(makeFarmPlot({ seq: state._plotSeq, xaId: v.xaId, tenure: FarmTenure.CONG, day: totalDaysAbs(state) }));
  v.congDienTaken = taken + 1;
  logLine(state, `Được làng ${v.name} chia một phần ruộng công (còn ${slots - v.congDienTaken}/${slots} suất).`, true);
  return { ok: true, feedback: [{ text: `+1 thửa ruộng công · ${v.name}`, tone: "good" }], sfx: "coin" };
}

/**
 * T3.3-2a — mua một thửa ruộng tư của làng. RUONG_TU_GIA Quan, KHÔNG giới hạn suất
 * (tư nhân — ai đủ tiền). Giữ hết hoa lợi (không landlord). Làng thu một phần lệ phí.
 */
export function actionMuaRuongTu(state) {
  const p = state.player;
  const v = state.village;
  if (!v || !v.xaId) return { ok: false, msg: "Nơi này không có ruộng để mua." };
  if (p.tien < RUONG_TU_GIA) return { ok: false, msg: `Mua ruộng tư cần ${RUONG_TU_GIA} Quan. Ngươi có ${p.tien}.` };
  if (!Array.isArray(p.farmPlots)) p.farmPlots = [];
  p.tien -= RUONG_TU_GIA;
  v.quyLang = (v.quyLang || 0) + Math.round(RUONG_TU_GIA * 0.15);
  state._plotSeq = (state._plotSeq || 1) + 1;
  p.farmPlots.push(makeFarmPlot({ seq: state._plotSeq, xaId: v.xaId, tenure: FarmTenure.TU, day: totalDaysAbs(state) }));
  logLine(state, `Bỏ ${RUONG_TU_GIA} Quan tậu một thửa ruộng tư ở ${v.name}.`, true);
  return {
    ok: true,
    feedback: [{ text: `+1 thửa ruộng tư · ${v.name}`, tone: "good" }, { text: `-${RUONG_TU_GIA} Quan`, tone: "bad" }],
    sfx: "coin",
  };
}

/**
 * T3.3-2b — làm thuê cày ruộng cho lý trưởng xã (cơ chế lao động chung T3.3-1,
 * kind="farm"). Ăn công cố định JOB_WAGE_BASE.farm/tháng, an toàn, trần thấp.
 * Xã không có lý trưởng (Vạn Xuân) -> từ chối: đúng câu chuyện ghế trống, KHÔNG lỗi.
 */
export function actionCayThue(state) {
  const p = state.player;
  const v = state.village;
  if (!v || !v.xaId) return { ok: false, msg: "Nơi này không có ruộng để cày thuê." };
  const landlordId = xaLandlordId(state, v.xaId);
  if (!landlordId) return { ok: false, msg: `Xã ${v.name} chưa có ai đứng đầu để nhận người làm thuê.` };
  if (landlordId === p.id) return { ok: false, msg: "Ngươi là lý trưởng xã này — không đi cày thuê cho chính mình." };
  if (Array.isArray(p._jobs) && p._jobs.length > 0) {
    return { ok: false, msg: "Ngươi đang có việc làm rồi. Nghỉ việc cũ trước đã." };
  }
  if (Array.isArray(p.farmPlots) && p.farmPlots.some(f => f.tenure === FarmTenure.RE && f.xaId === v.xaId)) {
    return { ok: false, msg: "Ngươi đang cấy rẽ ở xã này, không nhận thêm việc cày thuê." };
  }
  const wage = JOB_WAGE_BASE[JobKind.FARM];
  attachJob(p, { employerId: landlordId, kind: JobKind.FARM, ref: landlordId, wagePerMonth: wage, day: totalDaysAbs(state) });
  const boss = state.npcById?.[landlordId];
  logLine(state, `Xin vào cày thuê cho ${boss?.name || "lý trưởng"} xã ${v.name} (công ${wage} Quan/tháng).`, true);
  return { ok: true, feedback: [{ text: `Cày thuê · ${v.name}`, tone: "good" }, { text: `${wage} Quan/tháng`, tone: "bad" }], sfx: "coin" };
}

/**
 * T3.3-2b — cấy rẽ: mượn ruộng lý trưởng xã, thu hoạch chia landlord RE_SHARE_TO_LANDLORD.
 * Tạo farmPlot tenure="re" + landlordId + reShare. Rủi ro hơn cày thuê (T3.3-3/4),
 * trần cao hơn nếu được mùa. Vạn Xuân: cùng bị chặn như actionCayThue.
 */
export function actionCayRe(state) {
  const p = state.player;
  const v = state.village;
  if (!v || !v.xaId) return { ok: false, msg: "Nơi này không có ruộng để cấy rẽ." };
  const landlordId = xaLandlordId(state, v.xaId);
  if (!landlordId) return { ok: false, msg: `Xã ${v.name} chưa có ai đứng đầu để cho cấy rẽ.` };
  if (landlordId === p.id) return { ok: false, msg: "Ngươi là lý trưởng xã này — ruộng lộc đã có phần, không cấy rẽ." };
  if (Array.isArray(p._jobs) && p._jobs.some(j => j.kind === JobKind.FARM)) {
    return { ok: false, msg: "Ngươi đang cày thuê rồi. Cày thuê và cấy rẽ không làm cùng lúc." };
  }
  if (!Array.isArray(p.farmPlots)) p.farmPlots = [];
  if (p.farmPlots.some(f => f.tenure === FarmTenure.RE && f.xaId === v.xaId)) {
    return { ok: false, msg: "Ngươi đã cấy rẽ một thửa ở xã này rồi." };
  }
  state._plotSeq = (state._plotSeq || 1) + 1;
  p.farmPlots.push(makeFarmPlot({
    seq: state._plotSeq, xaId: v.xaId, tenure: FarmTenure.RE,
    landlordId, reShare: RE_SHARE_TO_LANDLORD, day: totalDaysAbs(state),
  }));
  bumpSkill(state, "quanLy", 1); // T3.5-3.5b: nhận rủi ro sản lượng + chia phần = quản lý một tài sản
  const boss = state.npcById?.[landlordId];
  logLine(state, `Nhận cấy rẽ một thửa của ${boss?.name || "lý trưởng"} xã ${v.name} (chia ${Math.round(RE_SHARE_TO_LANDLORD * 100)}% hoa lợi).`, true);
  return { ok: true, feedback: [{ text: `+1 thửa cấy rẽ · ${v.name}`, tone: "good" }, { text: `chia ${Math.round(RE_SHARE_TO_LANDLORD * 100)}%`, tone: "bad" }], sfx: "coin" };
}

/** T3.3-2b — người chơi tự nghỉ việc làm thuê đang giữ (nông hoặc cửa hàng). */
export function actionNghiViec(state) {
  const p = state.player;
  if (!Array.isArray(p._jobs) || p._jobs.length === 0) return { ok: false, msg: "Ngươi không có việc làm thuê nào." };
  for (const job of p._jobs.slice()) {
    detachJob(p, job.ref);
    if (job.kind === "shop") {
      const shop = state.shops?.[job.ref];
      if (shop && Array.isArray(shop.workerIds)) shop.workerIds = shop.workerIds.filter(id => id !== p.id);
    }
  }
  logLine(state, "Xin nghỉ việc làm thuê.", true);
  return { ok: true, feedback: [{ text: "Đã nghỉ việc", tone: "bad" }], sfx: "murmur" };
}

/**
 * T3.3-3a — KHỞI VỤ trên một thửa NHÀN (phase==null). Đưa thửa vào chuỗi
 * lam_dat→gieo_ma→cay→cho→gat (daily tick trong engine tự chuyển phase). hasTrau
 * đọc từ p.capital lúc này -> làm đất nhanh hơn. −20 theLuc (như actionCayRuong).
 * KHÔNG tạo thửa: không có thửa thì làm actionCayRuong (làm công nhật) như cũ.
 */
export function actionKhoiVu(state, plotId) {
  const p = state.player;
  if (p.faction === Faction.NGHIA_QUAN) return { ok: false, msg: "Đã tạo phản thì không còn lo mùa màng như dân thường." };
  if (p.dangOm) return { ok: false, msg: "Đang ốm liệt giường." };
  const plot = (p.farmPlots || []).find(f => f.id === plotId);
  if (!plot) return { ok: false, msg: "Không tìm thấy thửa ruộng này." };
  if (plot.phase) return { ok: false, msg: `Thửa này đang trong vụ (${PHASE_LABEL[plot.phase] || plot.phase}). Chờ gặt xong đã.` };
  if (p.theLuc < 20) return { ok: false, msg: "Hết thể lực để làm đất." };

  p.theLuc -= 20;
  plot.hasTrau = (p.capital || []).some(c => c.kind === "trau" && (c.cond | 0) > 0);
  plot.phase = "lam_dat";
  plot.phaseDaysLeft = plot.hasTrau ? LAM_DAT_DAYS_TRAU : PHASE_DAYS.lam_dat;
  plot.weatherHits = [];
  plot.vuStartedDay = totalDaysAbs(state);
  plot.lastYield = null;
  bumpSkill(state, "quanLy", 1); // T3.5-3.5b: quản một thửa qua trọn vụ 99 ngày = quản lý quy trình

  logLine(state, `Khởi vụ trên một thửa ruộng — làm đất ${plot.hasTrau ? "bằng trâu" : "bằng tay"} (${plot.phaseDaysLeft} ngày).`, true);
  const feedback = [{ text: "-20 Thể lực", tone: "bad" }, { text: `Khởi vụ (${plot.hasTrau ? "có trâu" : "cày tay"})`, tone: "good" }];
  if (p.theLuc <= 0) { collapseFromExhaustion(state); return { ok: true, feedback, shake: true, sfx: "cay" }; }
  return { ok: true, feedback, sfx: "cay" };
}

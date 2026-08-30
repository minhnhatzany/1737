import { FarmTenure, congDienSlots, RUONG_TU_GIA, makeFarmPlot } from "../core/farm.js";
import { totalDaysAbs } from "../engine.js";
import { logLine } from "../log.js";

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

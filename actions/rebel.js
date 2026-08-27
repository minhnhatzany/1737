import { rng, rngInt, rngChance, rngChoice } from "../core/rng.js";
import { getBattleState, getHuyen } from "../map_data.js";
import { ensureRebel, getHuyenControl, isControlledByRebelsHere, nextPrisonerId } from "../engine.js";
import { Faction, totalPops } from "../models.js";
import { logLine } from "../log.js";

export function actionRebelTrain(state) {
  const gate = ensureRebel(state); if (gate) return gate;
  const p = state.player;
  if (p.theLuc < 25) return { ok: false, msg: "Thể lực không đủ (cần 25)." };
  if (p.thocCaNhan < 8) return { ok: false, msg: "Thiếu lương để luyện quân (cần 8 thóc)." };
  p.theLuc -= 25;
  p.thocCaNhan -= 8;
  const gain = Math.max(5, Math.floor(p.quanSo * (0.01 + rng(state) * 0.02)));
  p.quanSo += gain;
  p.voThuat = Math.min(100, p.voThuat + 0.5);
  logLine(state, `🥁 Luyện binh suốt ngày. Quân nhuệ tăng, tàn quân tụ về thêm ${gain} người.`);
  return { ok: true, feedback: [{ text: `+${gain} Quân`, tone: "good" }, { text: "-8 Thóc", tone: "bad" }], sfx: "battle" };
}
export function actionRebelRaidSupply(state) {
  const gate = ensureRebel(state); if (gate) return gate;
  const p = state.player;
  if (p.theLuc < 35) return { ok: false, msg: "Thể lực không đủ (cần 35)." };
  if (p.quanSo < 30) return { ok: false, msg: "Quân quá ít để tập kích (cần 30+)." };
  p.theLuc -= 35;
  const risk = 0.22 + Math.max(0, (p.wantedLevel || 0) * 0.02);
  const success = rng(state) > risk;
  if (success) {
    const thoc = 30 + Math.floor(rng(state) * 60) + Math.floor(p.quanSo * 0.01);
    const tien = 20 + Math.floor(rng(state) * 80);
    p.thocCaNhan += thoc;
    p.tien += tien;
    p.wantedLevel = Math.min(10, (p.wantedLevel || 0) + 1);
    logLine(state, `🥷 Tập kích kho lương địch. Cướp được ${thoc} thóc và ${tien} quan!`, true);
    return { ok: true, feedback: [{ text: `+${thoc} Thóc`, tone: "good" }, { text: `+${tien} Quan`, tone: "good" }, { text: "+Truy nã", tone: "bad" }], sfx: "coin" };
  } else {
    const loss = Math.ceil(p.quanSo * (0.06 + rng(state) * 0.12));
    p.quanSo = Math.max(0, p.quanSo - loss);
    p.wantedLevel = Math.min(10, (p.wantedLevel || 0) + 2);
    if (typeof p.hp === "number") p.hp = Math.max(1, p.hp - 6);
    logLine(state, `🚨 Tập kích thất bại. Bị phục kích, mất ${loss} quân rồi tháo chạy!`, true);
    return { ok: true, feedback: [{ text: `-${loss} Quân`, tone: "bad" }, { text: "+Truy nã", tone: "bad" }], sfx: "caiVa" };
  }
}
export function actionRebelAidPeople(state) {
  const gate = ensureRebel(state); if (gate) return gate;
  const p = state.player;
  if (p.theLuc < 20) return { ok: false, msg: "Thể lực không đủ (cần 20)." };
  if (!isControlledByRebelsHere(state)) return { ok: false, msg: "Chưa kiểm soát địa bàn này — khó mà 'giúp dân' công khai." };
  if (p.thocCaNhan < 15) return { ok: false, msg: "Cần 15 thóc để cứu tế." };
  p.theLuc -= 20;
  p.thocCaNhan -= 15;
  const uy = 12 + Math.floor(rng(state) * 10);
  p.uyTinCong += uy;
  state.village.unrest = Math.max(0, state.village.unrest - 8);
  logLine(state, `🤝 Phát chẩn cứu tế. Dân vùng chiếm đóng cảm kích, bất ổn giảm mạnh.`, true);
  return { ok: true, feedback: [{ text: `+${uy} Uy tín`, tone: "good" }, { text: "-15 Thóc", tone: "bad" }], sfx: "murmur" };
}
export function actionRebelBurnYamen(state) {
  const gate = ensureRebel(state); if (gate) return gate;
  const p = state.player;
  if (p.theLuc < 45) return { ok: false, msg: "Thể lực không đủ (cần 45)." };
  if (p.quanSo < 60) return { ok: false, msg: "Quân quá ít để đốt phủ nha (cần 60+)." };
  // Must be in enemy-controlled huyen for meaningful sabotage
  const ctrl = getHuyenControl(state, p.currentHuyen);
  if (ctrl !== Faction.TRIEU_DINH) return { ok: false, msg: "Ở đất đã kiểm soát rồi, đốt phủ nha làm gì?" };
  p.theLuc -= 45;
  const success = rng(state) < (0.35 + (p.muuMeo || 0) * 0.004);
  if (success) {
    const dmg = 6 + Math.floor(rng(state) * 10);
    state.village.unrest = Math.min(100, state.village.unrest + 10);
    p.danhVong += 20;
    p.wantedLevel = Math.min(10, (p.wantedLevel || 0) + 2);
    // Push the warfront a bit towards rebels
    state._battleChaos = state._battleChaos || {};
    const bs = getBattleState(state, getHuyen(p.currentRegion, p.currentPhu, p.currentHuyen)?.historicalBattle);
    logLine(state, `🔥 Đốt phủ nha, phá sổ sách thuế. Quan quân rối loạn, thế trận nghiêng về nghĩa quân!`, true);
    return { ok: true, feedback: [{ text: "+Danh vọng", tone: "good" }, { text: "+Truy nã", tone: "bad" }], sfx: "battle" };
  } else {
    const loss = Math.ceil(p.quanSo * (0.10 + rng(state) * 0.12));
    p.quanSo = Math.max(0, p.quanSo - loss);
    p.wantedLevel = Math.min(10, (p.wantedLevel || 0) + 3);
    logLine(state, `🚨 Đốt phủ nha hỏng. Bị kỵ binh đuổi giết, mất ${loss} quân!`, true);
    return { ok: true, feedback: [{ text: `-${loss} Quân`, tone: "bad" }, { text: "+Truy nã", tone: "bad" }], sfx: "caiVa" };
  }
}
export function actionRebelRecruitLocal(state) {
  const gate = ensureRebel(state); if (gate) return gate;
  const p = state.player;
  if (p.theLuc < 25) return { ok: false, msg: "Thể lực không đủ (cần 25)." };
  if (!isControlledByRebelsHere(state)) return { ok: false, msg: "Chưa chiếm được địa bàn này thì không mộ binh được." };
  // Recruit from local drafted pool
  let maxSuatDinh = Math.floor(totalPops(state.village) / 5);
  let drafted = state.village.drafted || 0;
  let free = maxSuatDinh - drafted;
  if (free < 8) return { ok: false, msg: "Địa phương đã cạn trai tráng." };
  const qty = Math.min(20, Math.max(8, Math.floor(free * 0.3)));
  const thocCost = Math.ceil(qty * 1.5);
  const tienCost = Math.ceil(qty * 2);
  if (p.thocCaNhan < thocCost) return { ok: false, msg: `Cần ${thocCost} thóc để nuôi ${qty} tân binh.` };
  if (p.tien < tienCost) return { ok: false, msg: `Cần ${tienCost} quan để phát áo giáp vũ khí.` };
  p.theLuc -= 25;
  p.thocCaNhan -= thocCost;
  p.tien -= tienCost;
  p.quanSo += qty;
  state.village.drafted = drafted + qty;
  p.uyTinCong += 5;
  logLine(state, `🧑‍🌾 Mộ binh địa phương: ${qty} người theo nghĩa quân.`, true);
  return { ok: true, feedback: [{ text: `+${qty} Quân`, tone: "good" }, { text: `-${thocCost} Thóc`, tone: "bad" }, { text: `-${tienCost} Quan`, tone: "bad" }], sfx: "battle" };
}
export function addPrisoner(state, info) {
  if (!state.prisoners) state.prisoners = [];
  const p = state.player;
  const entry = {
    id: nextPrisonerId(state),
    name: info?.name || "Tù binh vô danh",
    side: info?.side || "unknown",
    value: Math.max(50, info?.value || 200),
    capturedAt: `${state.ban}-${state.monthIndex}-${state.gameDay}`,
    capturedHuyen: p.currentHuyen,
  };
  state.prisoners.push(entry);
  return entry;
}
export function actionPrisonerRelease(state, prisonerId) {
  const idx = (state.prisoners || []).findIndex(x => x.id === prisonerId);
  if (idx < 0) return { ok: false, msg: "Không tìm thấy tù binh." };
  const pr = state.prisoners[idx];
  state.prisoners.splice(idx, 1);
  state.player.uyTinCong += 8;
  logLine(state, `Thả tù binh ${pr.name}. Lòng người xôn xao.`);
  return { ok: true, feedback: [{ text: "+Uy tín", tone: "good" }], sfx: "murmur" };
}
export function actionPrisonerExecute(state, prisonerId) {
  const idx = (state.prisoners || []).findIndex(x => x.id === prisonerId);
  if (idx < 0) return { ok: false, msg: "Không tìm thấy tù binh." };
  const pr = state.prisoners[idx];
  state.prisoners.splice(idx, 1);
  state.player.danhVong += 15;
  state.player.uyTinCong = Math.max(0, state.player.uyTinCong - 10);
  logLine(state, `☠️ Chém tù binh ${pr.name}. Máu nhuộm doanh trại.`, true);
  return { ok: true, feedback: [{ text: "+Danh vọng", tone: "good" }, { text: "-Uy tín", tone: "bad" }], sfx: "battle" };
}
export function actionPrisonerRansom(state, prisonerId) {
  const idx = (state.prisoners || []).findIndex(x => x.id === prisonerId);
  if (idx < 0) return { ok: false, msg: "Không tìm thấy tù binh." };
  const pr = state.prisoners[idx];
  const chancePay = 0.55;
  if (rng(state) < chancePay) {
    state.player.tien += pr.value;
    state.prisoners.splice(idx, 1);
    logLine(state, `💰 Nhận tiền chuộc ${pr.value} quan cho ${pr.name}.`);
    return { ok: true, feedback: [{ text: `+${pr.value} Quan`, tone: "good" }], sfx: "coin" };
  } else {
    logLine(state, `Sứ giả địch chối bỏ, không chịu chuộc ${pr.name}.`);
    return { ok: true, feedback: [{ text: "Không chuộc", tone: "bad" }], sfx: "caiVa" };
  }
}

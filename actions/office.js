import { rng, rngInt, rngChance, rngChoice } from "../core/rng.js";
import { PostingBuildingDb, ensureCaseList, ensurePostingIfNeeded, getPosting, isOfficialRank, perkFx, postingHere, randInt } from "../engine.js";
import { Faction, MenAtArmType, totalPops } from "../models.js";
import { logLine } from "../log.js";
import { scopeKey, SeatLegitimacy, syncRankFromSeats } from "../core/seats.js";

export function actionPostingBuild(state, buildingId) {
  ensurePostingIfNeeded(state);
  const po = getPosting(state);
  if (!po) return { ok: false, msg: "Chưa có địa bàn nhậm chức." };
  if (!postingHere(state)) return { ok: false, msg: "Phải ở đúng địa bàn nhậm chức." };
  const b = PostingBuildingDb[buildingId];
  if (!b) return { ok: false, msg: "Công trình không tồn tại." };
  if (!po.buildings) po.buildings = {};
  const cur = po.buildings[buildingId] || 0;
  if (cur >= b.maxLevel) return { ok: false, msg: "Đã đạt cấp tối đa." };
  const next = cur + 1;
  const cost = b.costs?.[next] ?? 999999;
  if (po.treasury < cost) return { ok: false, msg: `Kho địa phương cần ${cost}Q.` };
  po.treasury -= cost;
  po.buildings[buildingId] = next;
  logLine(state, `🏗 Xây ${b.name} Cấp ${next} (−${cost}Q kho).`, true);
  return { ok: true, feedback: [{ text: `${b.name} ↑ Cấp ${next}`, tone: "good" }, { text: `-${cost}Q (Kho)`, tone: "bad" }], sfx: "coin" };
}
export function resolveCase(state, caseId, choiceIndex) {
  const po = getPosting(state);
  if (!po) return { ok: false, msg: "Chưa có địa bàn nhậm chức." };
  ensureCaseList(po);
  const idx = po.cases.findIndex(c => c.id === caseId);
  if (idx < 0) return { ok: false, msg: "Không tìm thấy vụ án." };
  const c = po.cases[idx];
  const ch = c.choices?.[choiceIndex];
  if (!ch) return { ok: false, msg: "Lựa chọn không hợp lệ." };
  ch.apply(state);
  po.cases.splice(idx, 1);
  return { ok: true, feedback: [{ text: "Đã xử án", tone: "good" }], sfx: "murmur" };
}
export function actionAssumeOfficeHere(state) {
  const p = state.player;
  if (p.faction !== Faction.TRIEU_DINH) return { ok: false, msg: "Chỉ quan triều đình mới nhậm chức." };
  if (!isOfficialRank(p.rank)) return { ok: false, msg: "Chưa đủ phẩm hàm để nhậm chức." };
  if (!state.postingsByHuyen) state.postingsByHuyen = {};
  state.postingId = p.currentHuyen;
  ensurePostingIfNeeded(state);
  // T2.1: huyện này có ghế trong hệ mới -> ghi nhận player vào ghế (một chiều).
  // Giữ nguyên luật "đứng đâu nhậm đó"; không chặn thêm; NPC cũ chỉ mất ghế, không bị xoá.
  const _seatId = state.seatsByScope && state.seatsByScope[scopeKey("huyen", p.currentHuyen)];
  const _seat = _seatId && state.seats ? state.seats[_seatId] : null;
  if (_seat) {
    _seat.occupantId = p.id;
    _seat.appointedDay = state.gameDay;
    _seat.legitimacy = SeatLegitimacy.BO_NHIEM;
    syncRankFromSeats(state, p);
  }
  return { ok: true, feedback: [{ text: "Nhậm chức tại đây", tone: "good" }], sfx: "coin" };
}
export function actionLocalLevy(state) {
  ensurePostingIfNeeded(state);
  const p = state.player;
  const po = getPosting(state);
  if (!po) return { ok: false, msg: "Chưa có địa bàn nhậm chức." };
  if (!postingHere(state)) return { ok: false, msg: "Phải ở đúng địa bàn nhậm chức mới mộ đinh được." };
  if (p.theLuc < 25) return { ok: false, msg: "Thể lực không đủ (cần 25)." };
  const levy = 40 + randInt(0, 80);
  p.theLuc -= 25;
  p.quanSo += levy;
  po.garrison += Math.floor(levy * 0.4);
  state.village.unrest = Math.min(100, state.village.unrest + 8);
  logLine(state, `📜 Trưng đinh mộ lính: thêm ${levy} quân. Dân oán tăng.`, true);
  return { ok: true, feedback: [{ text: `+${levy} Quân`, tone: "good" }, { text: "+Bất ổn", tone: "bad" }], sfx: "battle" };
}
export function actionLocalFund(state, amount) {
  ensurePostingIfNeeded(state);
  const po = getPosting(state);
  if (!po) return { ok: false, msg: "Chưa có địa bàn nhậm chức." };
  const p = state.player;
  const a = Math.max(0, Math.floor(amount || 0));
  if (a <= 0) return { ok: false, msg: "Số tiền không hợp lệ." };
  if (p.tien < a) return { ok: false, msg: "Không đủ tiền." };
  p.tien -= a;
  po.treasury += a;
  logLine(state, `Nộp ${a} quan vào kho bạc địa phương.`);
  return { ok: true, feedback: [{ text: `-${a} Quan`, tone: "bad" }], sfx: "coin" };
}
export function actionLocalEmbezzle(state, amount) {
  ensurePostingIfNeeded(state);
  const po = getPosting(state);
  if (!po) return { ok: false, msg: "Chưa có địa bàn nhậm chức." };
  const p = state.player;
  const a = Math.max(0, Math.floor(amount || 0));
  if (a <= 0) return { ok: false, msg: "Số tiền không hợp lệ." };
  if (po.treasury < a) return { ok: false, msg: "Kho bạc không đủ." };
  po.treasury -= a;
  p.tien += a;
  po.corruption = Math.min(100, (po.corruption || 0) + Math.ceil(a / 150));
  logLine(state, `💰 Tham ô ${a} quan từ kho bạc địa phương.`, true);
  return { ok: true, feedback: [{ text: `+${a} Quan`, tone: "good" }], sfx: "coin" };
}
export function actionLocalRecruitMaa(state, maaKey) {
  ensurePostingIfNeeded(state);
  const po = getPosting(state);
  if (!po) return { ok: false, msg: "Chưa có địa bàn nhậm chức." };
  if (!postingHere(state)) return { ok: false, msg: "Phải ở đúng địa bàn nhậm chức." };
  const p = state.player;
  if (p.theLuc < 20) return { ok: false, msg: "Thể lực không đủ (cần 20)." };
  const maa = MenAtArmType[(maaKey || "").toUpperCase()];
  if (!maa) return { ok: false, msg: "Binh chủng không tồn tại." };
  const cost = Math.max(10, maa.cost * 10);
  if (po.treasury < cost) return { ok: false, msg: `Kho bạc địa phương cần ${cost}Q.` };
  po.treasury -= cost;
  p.theLuc -= 20;
  // Each local regiment is bigger than player's personal regiment
  const addCount = maa.id === "phao_binh" ? 10 : 80;
  const arr = po.armies || (po.armies = []);
  const ex = arr.find(x => x.type === maa.id);
  if (ex) ex.count += addCount;
  else arr.push({ type: maa.id, count: addCount, morale: 80, level: 1 });
  po.garrison = (po.garrison || 0) + Math.floor(addCount * 0.35);
  logLine(state, `🏛 Tuyển ${addCount} ${maa.name} bằng kho bạc địa phương (−${cost}Q).`, true);
  return { ok: true, feedback: [{ text: `+${addCount} ${maa.name}`, tone: "good" }, { text: `-${cost}Q (Kho)`, tone: "bad" }], sfx: "battle" };
}
export function actionLocalCollectTax(state) {
  ensurePostingIfNeeded(state);
  const po = getPosting(state);
  if (!po) return { ok: false, msg: "Chưa có địa bàn nhậm chức." };
  if (!postingHere(state)) return { ok: false, msg: "Phải ở đúng địa bàn nhậm chức." };
  const p = state.player;
  // Annual tax season: only once per year, fixed by court law.
  if (state.monthIndex !== 6) return { ok: false, msg: "Thuế công chỉ thu vào kỳ giữa năm (tháng 6)." };
  if ((po.taxCollectedYear || 0) === state.ban) return { ok: false, msg: "Năm nay đã thu thuế công rồi." };
  if (p.theLuc < 20) return { ok: false, msg: "Thể lực không đủ (cần 20)." };
  p.theLuc -= 20;
  const dinh = Math.max(1, Math.floor(totalPops(state.village) / 5));
  const lawful = dinh * (state.thueDinh || 8);
  // corruption may skim extra -> unrest & audit risk
  const skimMult = 1 + Math.min(0.35, (po.corruption || 0) / 180);
  const take = Math.floor(lawful * skimMult);
  po.treasury += take;
  po.taxCollectedYear = state.ban;
  state.village.unrest = Math.min(100, state.village.unrest + 10);
  p.uyTinCong = Math.max(0, p.uyTinCong - 5);
  logLine(state, `📊 Thu thuế công theo luật: định mức ${lawful}Q. Thu thực ${take}Q vào kho. Dân oán tăng.`, true);
  return { ok: true, feedback: [{ text: `+${take}Q (Kho)`, tone: "good" }, { text: "+Bất ổn", tone: "bad" }], sfx: "coin" };
}
export function actionLocalPatrol(state) {
  ensurePostingIfNeeded(state);
  const po = getPosting(state);
  if (!po) return { ok: false, msg: "Chưa có địa bàn nhậm chức." };
  if (!postingHere(state)) return { ok: false, msg: "Phải ở đúng địa bàn nhậm chức." };
  const p = state.player;
  if (p.theLuc < 25) return { ok: false, msg: "Thể lực không đủ (cần 25)." };
  p.theLuc -= 25;
  const ok = rng(state) < (0.35 + (p.muuMeo || 0) * 0.004 + (po.garrison || 0) / 4000);
  if (ok) {
    const fine = 40 + randInt(0, 80);
    po.treasury += fine;
    state.village.unrest = Math.max(0, state.village.unrest - 8);
    p.uyTinCong += 10;
    logLine(state, `🚶 Tuần soát bắt được trộm vặt. Phạt vạ +${fine}Q vào kho. An dân.`, true);
    return { ok: true, feedback: [{ text: `+${fine}Q (Kho)`, tone: "good" }, { text: "Bất ổn giảm", tone: "good" }], sfx: "murmur" };
  } else {
    state.village.unrest = Math.min(100, state.village.unrest + 4);
    logLine(state, "Tuần soát không bắt được kẻ gian. Dân vẫn xôn xao.", false);
    return { ok: true, feedback: [{ text: "Không kết quả", tone: "bad" }], sfx: "caiVa" };
  }
}
export function actionLocalPacify(state) {
  ensurePostingIfNeeded(state);
  const po = getPosting(state);
  if (!po) return { ok: false, msg: "Chưa có địa bàn nhậm chức." };
  if (!postingHere(state)) return { ok: false, msg: "Phải ở đúng địa bàn nhậm chức." };
  const p = state.player;
  if (p.theLuc < 20) return { ok: false, msg: "Thể lực không đủ (cần 20)." };
  p.theLuc -= 20;
  const spend = 60;
  if (po.treasury < spend) return { ok: false, msg: `Kho bạc cần ${spend}Q để phát chẩn/tu sửa.` };
  po.treasury -= spend;
  state.village.unrest = Math.max(0, state.village.unrest - 15);
  p.uyTinCong += 15;
  logLine(state, "📜 Phủ dụ an dân: mở kho phát chẩn, sửa cầu đường. Bất ổn giảm mạnh.", true);
  return { ok: true, feedback: [{ text: `-${spend}Q (Kho)`, tone: "bad" }, { text: "+Uy tín", tone: "good" }], sfx: "coin" };
}
export function actionLocalBribeSuperior(state) {
  ensurePostingIfNeeded(state);
  const po = getPosting(state);
  if (!po) return { ok: false, msg: "Chưa có địa bàn nhậm chức." };
  const p = state.player;
  let cost = 120;
  cost = Math.floor(cost * (perkFx(state, "bribeCostMult", 1.0) || 1.0));
  if (p.tien < cost) return { ok: false, msg: `Cần ${cost}Q để lo lót quan trên.` };
  p.tien -= cost;
  po.corruption = Math.max(0, (po.corruption || 0) - 8);
  p.uyTinCong += 5;
  logLine(state, "🧧 Lo lót quan trên. Sổ sách nhẹ tay hơn một thời gian.", true);
  return { ok: true, feedback: [{ text: `-${cost}Q`, tone: "bad" }, { text: "Giảm nguy cơ điều tra", tone: "good" }], sfx: "coin" };
}

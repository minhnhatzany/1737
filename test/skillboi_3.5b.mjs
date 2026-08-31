// T3.5-3.5b — chỉ số cũ tăng qua HÀNH ĐỘNG THẬT.
//   actionDiHoc: bỏ xác suất 40/55%, chuyển bumpSkill("hocVan", gain). Trường học
//     (hoc_duong/van_mieu) -> gain 2 với p~0.30 ("buổi ngộ"). _birthThienTai -> ×1.5.
//   8 nghề hướng Y: chế biến (NauRuou/DetVai/ChanNuoiLon)->quanLy; BuonLauMuoi->muuMeo;
//     BanChoShop->ngoaiGiao; KhoiVu+CayRe->quanLy. KHÔNG bồi: ChatGo/CauCaSong/
//     DanhBatVenBien/KhaiThacDacSan/CayRuong/CayThue.
//   Mọi chỗ bồi chỉ số cũng addLifestyleXP đúng cây (STAT_TO_LIFESTYLE).
import { createInitialState, actionLuyenVo,
         actionNauRuou, actionDetVai, actionChanNuoiLon, actionBuonLauMuoi,
         actionChatGo, actionCauCaSong, actionKhaiThacDacSan, actionCayRuong,
         actionCayThue, actionKhoiVu, actionCayRe, actionXinCongDien,
         actionBanChoShop, villageForXa } from "../engine.js";
import { actionDiHoc } from "../court.js";
import { STAT_TO_LIFESTYLE, SKILL_ACCUM_THRESHOLD } from "../lifestyle.js";
import { RegionId } from "../models.js";

let pass = true;
const check = (name, cond) => { console.log((cond ? "  ok  " : " FAIL ") + name); if (!cond) pass = false; };
const xp = (s, tree) => s.player.lifestyleXP?.[tree] || 0;
const accum = (s, stat) => s.player._skillAccum?.[stat] || 0;

// --- 1. STAT_TO_LIFESTYLE ---
check("STAT_TO_LIFESTYLE: 5 chỉ số -> 5 cây",
  STAT_TO_LIFESTYLE.voThuat === "quan_su" && STAT_TO_LIFESTYLE.hocVan === "hoc_thuat" &&
  STAT_TO_LIFESTYLE.quanLy === "quan_ly" && STAT_TO_LIFESTYLE.muuMeo === "am_muu" &&
  STAT_TO_LIFESTYLE.ngoaiGiao === "ngoai_giao");

// --- 2. actionDiHoc KHÔNG trường: gain 1/buổi -> +1 hocVan mỗi 4 ---
{
  const s = createInitialState("T", 7);
  const h0 = s.player.hocVan;
  for (let i = 0; i < 4; i++) { s.player.theLuc = 140; s.player.tien = 999; actionDiHoc(s); }
  check("4 buổi không trường -> hocVan +1, accum về 0", s.player.hocVan === h0 + 1 && accum(s, "hocVan") === 0);
  for (let i = 0; i < 3; i++) { s.player.theLuc = 140; s.player.tien = 999; actionDiHoc(s); }
  check("3 buổi nữa -> accum 3, hocVan chưa đổi thêm", accum(s, "hocVan") === 3 && s.player.hocVan === h0 + 1);
  check("actionDiHoc bồi cây HOC_THUAT (7 buổi = 7 XP)", xp(s, "hoc_thuat") === 7);
}

// --- 3. actionDiHoc KHÔNG trường -> KHÔNG rút rng (không còn xác suất) ---
{
  const s = createInitialState("T", 7);
  const r0 = s.rngState;
  s.player.theLuc = 140; s.player.tien = 999; actionDiHoc(s);
  check("không trường: actionDiHoc không đụng rngState", s.rngState === r0);
}

// --- 4. actionDiHoc CÓ trường: có "buổi ngộ" gain 2 (~30%) + rút rng ---
{
  const s = createInitialState("T", 7);
  s.player.holdings = [{ typeId: "hoc_duong", regionId: "son_tay", level: 1 }];
  const r0 = s.rngState;
  let sumGain = 0, prevAcc = 0;
  for (let i = 0; i < 200; i++) {
    s.player.theLuc = 140; s.player.tien = 999;
    const beforeAcc = accum(s, "hocVan") + (s.player.hocVan) * SKILL_ACCUM_THRESHOLD;
    actionDiHoc(s);
    const afterAcc = accum(s, "hocVan") + (s.player.hocVan) * SKILL_ACCUM_THRESHOLD;
    sumGain += (afterAcc - beforeAcc);
  }
  check("có trường: actionDiHoc rút rng (rngState đổi)", s.rngState !== r0);
  const breakthroughs = sumGain - 200; // mỗi buổi cơ bản gain 1; dư ra là "buổi ngộ" +1
  check(`buổi ngộ ~30% (thấy ${breakthroughs}/200 = ${(breakthroughs / 200).toFixed(2)})`,
    breakthroughs >= 200 * 0.18 && breakthroughs <= 200 * 0.42);
}

// --- 5. _birthThienTai ×1.5: gain 1 -> ceil(1.5)=2 -> +1 hocVan mỗi 2 buổi ---
{
  const s = createInitialState("T", 7);
  s.player._birthThienTai = true;
  const h0 = s.player.hocVan;
  for (let i = 0; i < 4; i++) { s.player.theLuc = 140; s.player.tien = 999; actionDiHoc(s); }
  check("thiên tài không trường: 4 buổi -> hocVan +2 (gain 2/buổi)", s.player.hocVan === h0 + 2);
}

// --- 6. chế biến -> quanLy + cây QUAN_LY ---
{
  const s = createInitialState("T", 7);
  s.player.tien = 9999; s.player.thocCaNhan = 999;
  const q0 = s.player.quanLy;
  for (let i = 0; i < 4; i++) { s.player.theLuc = 140; s.player.thocCaNhan = 999; actionNauRuou(s); }
  check("4 buổi nấu rượu -> quanLy +1", s.player.quanLy === q0 + 1);
  check("nấu rượu bồi cây QUAN_LY (4 XP)", xp(s, "quan_ly") === 4);
  // dệt vải + chăn lợn cũng bồi quanLy
  const q1 = s.player.quanLy, acc1 = accum(s, "quanLy");
  s.player.theLuc = 140; s.player.tien = 9999; actionDetVai(s);
  s.player.theLuc = 140; s.player.tien = 9999; actionChanNuoiLon(s);
  check("dệt vải + chăn lợn cũng bồi quanLy (accum +2)", accum(s, "quanLy") === acc1 + 2 && s.player.quanLy === q1);
}

// --- 7. BuonLauMuoi trót lọt -> muuMeo + cây AM_MUU ---
{
  const s = createInitialState("T", 7);
  s.player.currentRegion = RegionId.SON_TAY;
  s.player.inventory = { muoi: 50 };
  s._amMuuBonus = 1000; // catchRate ~0 -> chắc trót lọt
  const m0 = s.player.muuMeo;
  for (let i = 0; i < 4; i++) { s.player.theLuc = 140; actionBuonLauMuoi(s, 2); }
  check("4 chuyến buôn lậu trót lọt -> muuMeo +1", s.player.muuMeo === m0 + 1);
  check("buôn lậu bồi cây AM_MUU (4 XP)", xp(s, "am_muu") === 4);
}

// --- 8. BanChoShop -> ngoaiGiao + cây NGOAI_GIAO ---
{
  const s = createInitialState("T", 7);
  s.player.currentXa = "bat_bat_t1_x0"; s.player.currentRegion = "son_tay";
  s.player.inventory = { lua: 40 };
  const n0 = s.player.ngoaiGiao;
  for (let i = 0; i < 4; i++) actionBanChoShop(s, "lua", 1);
  check("4 lần bán cho xưởng -> ngoaiGiao +1", s.player.ngoaiGiao === n0 + 1);
  check("bán xưởng bồi cây NGOAI_GIAO (4 XP)", xp(s, "ngoai_giao") === 4);
}

// --- 9. KhoiVu + CayRe -> quanLy ---
{
  const s = createInitialState("T", 7);
  actionXinCongDien(s);
  const q0 = s.player.quanLy, acc0 = accum(s, "quanLy");
  s.player.theLuc = 140;
  actionKhoiVu(s, s.player.farmPlots[0].id);
  check("khởi vụ -> bồi quanLy (accum +1)", accum(s, "quanLy") === acc0 + 1);

  const s2 = createInitialState("T", 7);
  s2.player.currentXa = "bat_bat_t0_x0";
  s2.village = villageForXa(s2, "bat_bat_t0_x0");
  const acc2 = accum(s2, "quanLy");
  const r = actionCayRe(s2);
  check("cấy rẽ -> ok + bồi quanLy (accum +1)", r.ok && accum(s2, "quanLy") === acc2 + 1);
}

// --- 10. KHÔNG bồi: khai thác thô + công nhật + cày thuê ---
{
  const s = createInitialState("T", 7);
  s.player.currentRegion = RegionId.SON_TAY; s.player.tien = 9999;
  const snap = JSON.stringify(s.player._skillAccum || {});
  const stats0 = { q: s.player.quanLy, m: s.player.muuMeo, n: s.player.ngoaiGiao, v: s.player.voThuat, h: s.player.hocVan };
  for (let i = 0; i < 6; i++) { s.player.theLuc = 140; actionChatGo(s); }
  for (let i = 0; i < 6; i++) { s.player.theLuc = 140; actionCauCaSong(s); }
  for (let i = 0; i < 6; i++) { s.player.theLuc = 140; actionKhaiThacDacSan(s); }
  for (let i = 0; i < 6; i++) { s.player.theLuc = 140; s.player._cayRuongToday = 0; actionCayRuong(s); }
  check("chặt gỗ / câu cá / đặc sản / cày công nhật: _skillAccum KHÔNG đổi",
    JSON.stringify(s.player._skillAccum || {}) === snap);
  check("5 chỉ số KHÔNG đổi qua các nghề lao động thô",
    s.player.quanLy === stats0.q && s.player.muuMeo === stats0.m && s.player.ngoaiGiao === stats0.n &&
    s.player.voThuat === stats0.v && s.player.hocVan === stats0.h);
  // cày thuê cũng không bồi
  const s2 = createInitialState("T", 7);
  s2.player.currentXa = "bat_bat_t0_x0"; s2.village = villageForXa(s2, "bat_bat_t0_x0");
  const acc = JSON.stringify(s2.player._skillAccum || {});
  actionCayThue(s2);
  check("cày thuê (ăn lương): _skillAccum KHÔNG đổi", JSON.stringify(s2.player._skillAccum || {}) === acc);
}

// --- 11. actionLuyenVo giờ cũng bồi cây QUAN_SU (3.5b nối addLifestyleXP vào bumpSkill) ---
{
  const s = createInitialState("T", 7);
  for (let i = 0; i < 5; i++) { s.player.theLuc = 140; s.player.tien = 999; actionLuyenVo(s); }
  check("luyện võ bồi cây QUAN_SU (> 0 XP)", xp(s, "quan_su") > 0);
}

// --- 12. replay-safe + world-gen ---
let badRng = 0;
for (let seed = 1; seed <= 60; seed++) { const st = createInitialState("T", seed); if (st.rngState !== st.rngSeed) badRng++; }
check("rngState === rngSeed trên 60 seed", badRng === 0);
for (const [seed, n] of [[999, 11], [4242, 10]]) {
  check(`seed ${seed}: NPC ngoài QO = ${n}`,
    createInitialState("T", seed).npcs.filter(x => x.currentPhu !== "quang_oai").length === n);
}
{
  const run = () => {
    const s = createInitialState("Z", 9);
    s.player.holdings = [{ typeId: "hoc_duong", regionId: "son_tay", level: 1 }];
    for (let i = 0; i < 12; i++) { s.player.theLuc = 140; s.player.tien = 999; actionDiHoc(s); }
    return JSON.stringify([s.player.hocVan, s.player._skillAccum.hocVan, s.rngState, xp(s, "hoc_thuat")]);
  };
  check("tất định: cùng seed -> cùng (hocVan, accum, rngState, XP)", run() === run());
}

console.log(pass ? "PASS - T3.5-3.5b: actionDiHoc accumulator + 8 nghề bồi hướng Y + addLifestyleXP đúng cây + thienTai ×1.5" : "FAIL - T3.5-3.5b");
process.exit(pass ? 0 : 1);

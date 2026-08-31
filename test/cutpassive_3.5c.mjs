// T3.5-3.5c — CẮT cộng điểm thẳng thụ động. Chỉ số cũ giờ CHỈ tăng qua hành động
// thật (bumpSkill — 3.5b). GIỮ mọi hệ số tình huống (_quanLyBonus, _amMuuBonus, ...).
//   HOC_THUAT focus: bỏ "hocVan +1 mỗi 4 tháng".
//   AM_MUU focus: bỏ "muuMeo += 2/tháng", GIỮ _amMuuBonus = 1.20.
//   Holding hocVanAccum (thu_phong/van_chi) + voThuatAccum (lo_ren): bỏ handler.
//   Công trình GIỮ NGUYÊN, chỉ mất hiệu ứng passive stat.
import { createInitialState, gameTick, actionLuyenVo } from "../engine.js";
import { actionDiHoc } from "../court.js";
import { tickLifestyle } from "../lifestyle.js";

let pass = true;
const check = (name, cond) => { console.log((cond ? "  ok  " : " FAIL ") + name); if (!cond) pass = false; };
const rollMonths = (s, m) => { const start = s.monthIndex + s.ban * 12; while (s.monthIndex + s.ban * 12 < start + m) { s.gameDay++; gameTick(s); } };

// --- 1. HOC_THUAT focus: hocVan KHÔNG tự tăng qua tháng ---
{
  const s = createInitialState("T", 7);
  s.player.lifestyleFocus = "hoc_thuat";
  const h0 = s.player.hocVan;
  for (let i = 0; i < 12; i++) tickLifestyle(s);
  check("HOC_THUAT focus 12 tháng -> hocVan KHÔNG đổi (trước đây +3)", s.player.hocVan === h0);
}

// --- 2. HOC_THUAT focus VẪN đáng chọn: XP cây +4/tháng (tickLifestyle không đụng) ---
{
  const s = createInitialState("T", 7);
  s.player.lifestyleFocus = "hoc_thuat";
  for (let i = 0; i < 10; i++) tickLifestyle(s);
  const focusXP = s.player.lifestyleXP.hoc_thuat || 0;
  const otherXP = s.player.lifestyleXP.quan_ly || 0;
  check(`focus cây +4/tháng (${focusXP}) >> cây khác +1/tháng (${otherXP})`, focusXP >= 35 && otherXP <= 12);
}

// --- 3. AM_MUU focus: muuMeo KHÔNG tự tăng, GIỮ _amMuuBonus 1.20 ---
{
  const s = createInitialState("T", 7);
  s.player.lifestyleFocus = "am_muu";
  const m0 = s.player.muuMeo;
  for (let i = 0; i < 12; i++) tickLifestyle(s);
  check("AM_MUU focus 12 tháng -> muuMeo KHÔNG đổi (trước đây +24)", s.player.muuMeo === m0);
  check("AM_MUU focus VẪN đặt _amMuuBonus = 1.20", s._amMuuBonus === 1.20);
}

// --- 4. GIỮ nguyên: _quanLyBonus, NGOAI_GIAO focus ---
{
  const s = createInitialState("T", 7);
  s.player.lifestyleFocus = "quan_ly";
  tickLifestyle(s);
  check("QUAN_LY focus giữ _quanLyBonus = 1.10", s._quanLyBonus === 1.10);

  const s2 = createInitialState("T", 7);
  s2.player.lifestyleFocus = "ngoai_giao";
  const uy0 = s2.player.uyTinCong;
  s2.player.uyTinCong = 100;
  tickLifestyle(s2);
  check("NGOAI_GIAO focus giữ uy tín ×1.1 (100 -> 110)", s2.player.uyTinCong === 110);
}

// --- 5. Holding hocVanAccum (thu_phong): hocVan KHÔNG tự tăng qua tháng ---
{
  const s = createInitialState("T", 7);
  s.player.holdings = [{ typeId: "thu_phong", regionId: "son_tay", level: 2 }]; // buffs[1] = hocVanAccum 2/tháng
  const h0 = s.player.hocVan;
  rollMonths(s, 8);
  check("thu_phong 8 tháng -> hocVan KHÔNG đổi (trước đây +4)", s.player.hocVan === h0);
  check("công trình thu_phong VẪN còn trong holdings", s.player.holdings.some(h => h.typeId === "thu_phong"));
}

// --- 6. Holding voThuatAccum (lo_ren): voThuat KHÔNG tự tăng ---
{
  const s = createInitialState("T", 7);
  s.player.holdings = [{ typeId: "lo_ren", regionId: "son_tay", level: 3 }]; // voThuatAccum 3/tháng
  const v0 = s.player.voThuat;
  rollMonths(s, 8);
  check("lo_ren 8 tháng -> voThuat KHÔNG đổi (trước đây +6)", s.player.voThuat === v0);
  check("công trình lo_ren VẪN còn", s.player.holdings.some(h => h.typeId === "lo_ren"));
}

// --- 7. Hành động thật VẪN bồi (3.5b không bị 3.5c đụng) ---
{
  const s = createInitialState("T", 7);
  s.player.lifestyleFocus = "hoc_thuat"; // focus không còn tự cộng
  const h0 = s.player.hocVan;
  for (let i = 0; i < 4; i++) { s.player.theLuc = 140; s.player.tien = 999; actionDiHoc(s); }
  check("HOC_THUAT focus + 4 buổi dùi mài -> hocVan +1 (từ HÀNH ĐỘNG, không phải focus)", s.player.hocVan === h0 + 1);

  const s2 = createInitialState("T", 7);
  const v0 = s2.player.voThuat;
  for (let i = 0; i < 40; i++) { s2.player.theLuc = 140; s2.player.tien = 999; actionLuyenVo(s2); }
  check("luyện võ vẫn tăng voThuat qua accumulator", s2.player.voThuat > v0);
}

// --- 8. RNG invariant + tất định ---
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
    s.player.holdings = [{ typeId: "thu_phong", regionId: "son_tay", level: 2 }];
    s.player.lifestyleFocus = "hoc_thuat";
    rollMonths(s, 6);
    return JSON.stringify([s.player.hocVan, s.player.muuMeo, s.rngState]);
  };
  check("tất định: cùng seed -> cùng kết quả", run() === run());
}

console.log(pass ? "PASS - T3.5-3.5c: cắt cộng điểm thụ động (HOC_THUAT/AM_MUU focus, holding *Accum); giữ hệ số tình huống; công trình còn nguyên" : "FAIL - T3.5-3.5c");
process.exit(pass ? 0 : 1);

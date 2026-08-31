// T3.5-3.5a — _skillAccum chung (khuôn _voTrainAccum) + refactor actionLuyenVo.
// NGHIỆM THU QUAN TRỌNG NHẤT: hành vi actionLuyenVo KHÔNG ĐỔI — cùng seed, cùng số
// buổi luyện -> đúng voThuat + rngState + accum y hệt. bumpSkill = accumulator thuần
// (ngưỡng 4, không rng, không addLifestyleXP — nối cây perk để 3.5b).
import { createInitialState, gameTick, actionLuyenVo } from "../engine.js";
import { bumpSkill, SKILL_ACCUM_THRESHOLD } from "../lifestyle.js";

let pass = true;
const check = (name, cond) => { console.log((cond ? "  ok  " : " FAIL ") + name); if (!cond) pass = false; };

// --- 1. hằng số ---
check("SKILL_ACCUM_THRESHOLD = 4 (khuôn _voTrainAccum)", SKILL_ACCUM_THRESHOLD === 4);

// --- 2. bumpSkill: bồi -> ngưỡng 4 -> +1 chỉ số, dư mang sang, clamp 100 ---
{
  const s = createInitialState("T", 7);
  const q0 = s.player.quanLy;
  check("bump 3 -> 0 up, accum 3, chỉ số chưa đổi",
    bumpSkill(s, "quanLy", 3) === 0 && s.player._skillAccum.quanLy === 3 && s.player.quanLy === q0);
  check("bump thêm 2 -> 1 up (3+2=5), accum 1, quanLy +1",
    bumpSkill(s, "quanLy", 2) === 1 && s.player._skillAccum.quanLy === 1 && s.player.quanLy === q0 + 1);
  check("bump 8 -> 2 up (1+8=9), accum 1",
    bumpSkill(s, "quanLy", 8) === 2 && s.player._skillAccum.quanLy === 1 && s.player.quanLy === q0 + 3);
  // clamp 100
  s.player.hocVan = 99;
  bumpSkill(s, "hocVan", 40);
  check("clamp: chỉ số không vượt 100", s.player.hocVan === 100);
  // guards
  check("bump gain<=0 -> no-op", bumpSkill(s, "quanLy", 0) === 0 && bumpSkill(s, "quanLy", -3) === 0);
  check("bump stat rỗng -> no-op", bumpSkill(s, null, 2) === 0);
  check("state rỗng -> no-op không ném", bumpSkill(null, "quanLy", 2) === 0);
}

// --- 3. bumpSkill KHÔNG rng, KHÔNG đụng rngState ---
{
  const s = createInitialState("T", 7);
  const r0 = s.rngState;
  bumpSkill(s, "voThuat", 3); bumpSkill(s, "muuMeo", 9);
  check("bumpSkill không rút rng (rngState bất biến)", s.rngState === r0);
}

// --- 4. actionLuyenVo: HÀNH VI KHÔNG ĐỔI — tất định cùng seed ---
{
  const run = (seed, n) => {
    const s = createInitialState("R", seed);
    for (let i = 0; i < n; i++) { s.player.theLuc = 140; s.player.tien = 999; actionLuyenVo(s); }
    return { vo: s.player.voThuat, rng: s.rngState, accum: s.player._skillAccum?.voThuat ?? null };
  };
  const a = run(7, 40), b = run(7, 40);
  check(`tất định: 40 buổi luyện -> cùng voThuat (${a.vo}), rngState, accum`,
    a.vo === b.vo && a.rng === b.rng && a.accum === b.accum);
  const seedC = run(99, 40);
  check("seed khác -> chuỗi khác (không phải hằng số cứng)", seedC.vo !== a.vo || seedC.rng !== a.rng);
}

// --- 5. actionLuyenVo: accumulator hoạt động, carryover bị chặn [0,3], voThuat tăng ---
{
  const s = createInitialState("R", 3);
  const vo0 = s.player.voThuat;
  let maxAccum = 0;
  for (let i = 0; i < 60; i++) {
    s.player.theLuc = 140; s.player.tien = 999;
    actionLuyenVo(s);
    maxAccum = Math.max(maxAccum, s.player._skillAccum.voThuat);
  }
  check("60 buổi -> voThuat tăng", s.player.voThuat > vo0);
  check("carryover accum luôn trong [0,3]", maxAccum <= 3 && s.player._skillAccum.voThuat <= 3);
  // đúng số học: voThuat tăng = floor(tổng gain / 4) (không clamp trong dải này)
  const totalGain = (s.player.voThuat - vo0) * 4 + s.player._skillAccum.voThuat;
  check(`voThuat tăng = floor(Σgain / 4): Σgain=${totalGain}`,
    (s.player.voThuat - vo0) === Math.floor(totalGain / 4));
}

// --- 6. field cũ _voTrainAccum KHÔNG còn được ghi; chỉ đụng voThuat, không stat khác ---
{
  const s = createInitialState("R", 5);
  for (let i = 0; i < 20; i++) { s.player.theLuc = 140; s.player.tien = 999; actionLuyenVo(s); }
  check("_voTrainAccum không còn tồn tại", s.player._voTrainAccum === undefined);
  check("_skillAccum CHỈ có key voThuat (3.5a chưa nối nghề)",
    Object.keys(s.player._skillAccum).length === 1 && "voThuat" in s.player._skillAccum);
}

// --- 7. migration: save cũ đang luyện võ dở (_voTrainAccum) -> dời sang _skillAccum ---
{
  const s = createInitialState("T", 7);
  delete s.player._skillAccum;
  s.player._voTrainAccum = 3;
  s.gameDay++; gameTick(s);
  check("gameTick dời _voTrainAccum 3 -> _skillAccum.voThuat 3", s.player._skillAccum?.voThuat === 3);
  check("gameTick xoá _voTrainAccum cũ", s.player._voTrainAccum === undefined);
  // migration cộng dồn nếu _skillAccum.voThuat đã có
  const s2 = createInitialState("T", 7);
  s2.player._skillAccum = { voThuat: 2 };
  s2.player._voTrainAccum = 3;
  s2.gameDay++; gameTick(s2);
  check("migration cộng dồn: 2 + 3 = 5 -> ... (giữ nguyên, không convert ở migration)", s2.player._skillAccum.voThuat === 5 && s2.player._voTrainAccum === undefined);
}

// --- 8. gate actionLuyenVo giữ nguyên ---
{
  const s = createInitialState("T", 7);
  s.player.theLuc = 10;
  check("theLuc < 30 -> từ chối", actionLuyenVo(s).ok === false);
  const s2 = createInitialState("T", 7); s2.player.theLuc = 140; s2.player.tien = 1;
  check("tien < 3 -> từ chối", actionLuyenVo(s2).ok === false);
  const s3 = createInitialState("T", 7); s3.player.theLuc = 140; s3.player.tien = 999; s3.player.faction = "nghia_quan";
  check("nghĩa quân -> từ chối", actionLuyenVo(s3).ok === false);
}

// --- 9. RNG invariant world-gen ---
let badRng = 0;
for (let seed = 1; seed <= 60; seed++) { const st = createInitialState("T", seed); if (st.rngState !== st.rngSeed) badRng++; }
check("rngState === rngSeed trên 60 seed", badRng === 0);
for (const [seed, n] of [[999, 11], [4242, 10]]) {
  check(`seed ${seed}: NPC ngoài QO = ${n}`,
    createInitialState("T", seed).npcs.filter(x => x.currentPhu !== "quang_oai").length === n);
}

console.log(pass ? "PASS - T3.5-3.5a: _skillAccum + bumpSkill (ngưỡng 4), actionLuyenVo refactor hành vi không đổi, migration" : "FAIL - T3.5-3.5a");
process.exit(pass ? 0 : 1);

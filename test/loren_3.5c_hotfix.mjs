// T3.5-3.5c hotfix — lò rèn (lo_ren, 4000Q) rỗng sau khi 3.5c cắt voThuatAccum.
// Trả tác dụng: có lo_ren -> "buổi tốt" của actionLuyenVo tăng 0.18 -> 0.30 (đúng
// số đã duyệt cho hoc_duong/van_mieu ở actionDiHoc — 3.5b). Không lo_ren: 0.18 y cũ.
import { createInitialState, actionLuyenVo } from "../engine.js";

let pass = true;
const check = (name, cond) => { console.log((cond ? "  ok  " : " FAIL ") + name); if (!cond) pass = false; };
const accVo = (s) => (s.player._skillAccum?.voThuat || 0);

// đo tỉ lệ "buổi tốt" (gain 2) qua N buổi luyện võ
const goodRate = (holdings, N, seedBase) => {
  let good = 0, calls = 0;
  for (let i = 0; i < N; i++) {
    const s = createInitialState("K", seedBase + (i % 40));
    if (holdings) s.player.holdings = holdings.map(t => ({ typeId: t, regionId: "son_tay", level: 1 }));
    s.player.theLuc = 140; s.player.tien = 999;
    const before = accVo(s) + s.player.voThuat * 4;
    actionLuyenVo(s);
    const after = accVo(s) + s.player.voThuat * 4;
    calls++;
    if ((after - before) === 2) good++;
  }
  return good / calls;
};

// --- 1. không lo_ren: ~0.18 (y như cũ) ---
{
  const r = goodRate(null, 400, 1);
  check(`không lò rèn: buổi tốt ~0.18 (thấy ${r.toFixed(3)})`, r >= 0.10 && r <= 0.27);
}

// --- 2. có lo_ren: ~0.30 ---
{
  const r = goodRate(["lo_ren"], 400, 1);
  check(`có lò rèn: buổi tốt ~0.30 (thấy ${r.toFixed(3)})`, r >= 0.22 && r <= 0.39);
}

// --- 3. có lo_ren > không lo_ren rõ rệt ---
{
  const noF = goodRate(null, 500, 100);
  const yesF = goodRate(["lo_ren"], 500, 100);
  check(`có lò rèn (${yesF.toFixed(3)}) > không lò rèn (${noF.toFixed(3)})`, yesF > noF + 0.05);
}

// --- 4. lo_ren KHÔNG đổi cơ chế còn lại: vẫn ngưỡng 4, vẫn bồi voThuat + cây QUAN_SU ---
{
  const s = createInitialState("T", 7);
  s.player.holdings = [{ typeId: "lo_ren", regionId: "son_tay", level: 1 }];
  const v0 = s.player.voThuat;
  for (let i = 0; i < 40; i++) { s.player.theLuc = 140; s.player.tien = 999; actionLuyenVo(s); }
  check("có lò rèn: voThuat vẫn tăng qua accumulator", s.player.voThuat > v0);
  check("có lò rèn: vẫn bồi cây QUAN_SU", (s.player.lifestyleXP?.quan_su || 0) > 0);
  check("carryover accum vẫn trong [0,3]", accVo(s) <= 3);
}

// --- 5. holding khác (không phải lo_ren) KHÔNG kích buff này ---
{
  const s = createInitialState("T", 7);
  s.player.holdings = [{ typeId: "thu_phong", regionId: "son_tay", level: 1 }];
  // thu_phong -> hocVan holding, không phải lo_ren -> buổi tốt vẫn 0.18
  let good = 0;
  for (let i = 0; i < 300; i++) {
    const st = createInitialState("K", 500 + (i % 40));
    st.player.holdings = [{ typeId: "thu_phong", regionId: "son_tay", level: 1 }];
    st.player.theLuc = 140; st.player.tien = 999;
    const before = accVo(st) + st.player.voThuat * 4;
    actionLuyenVo(st);
    if ((accVo(st) + st.player.voThuat * 4 - before) === 2) good++;
  }
  check(`chỉ có thu_phong (không lò rèn): buổi tốt vẫn ~0.18 (${(good / 300).toFixed(3)})`, good / 300 <= 0.27);
}

// --- 6. RNG invariant + tất định ---
let badRng = 0;
for (let seed = 1; seed <= 60; seed++) { const st = createInitialState("T", seed); if (st.rngState !== st.rngSeed) badRng++; }
check("rngState === rngSeed trên 60 seed", badRng === 0);
{
  const run = () => {
    const s = createInitialState("Z", 9);
    s.player.holdings = [{ typeId: "lo_ren", regionId: "son_tay", level: 1 }];
    for (let i = 0; i < 20; i++) { s.player.theLuc = 140; s.player.tien = 999; actionLuyenVo(s); }
    return JSON.stringify([s.player.voThuat, accVo(s), s.rngState]);
  };
  check("tất định: cùng seed + lò rèn -> cùng kết quả", run() === run());
}

console.log(pass ? "PASS - T3.5-3.5c hotfix: lo_ren -> buổi tốt luyện võ 0.18 -> 0.30 (khuôn hoc_duong/van_mieu)" : "FAIL - lo_ren hotfix");
process.exit(pass ? 0 : 1);

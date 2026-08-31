// T3.4-2a — thuyền nan cho CauCaSong + DanhBatVenBien (modifier MỀM, cond>0).
//   Không thuyền -> 1 giỏ/buổi (câu tay / mò ven bờ).
//   Có thuyen_nan -> công thức đầy đủ + HAO cond THUYEN_WEAR_PER_TRIP=2 mỗi chuyến
//     (hao theo LẦN DÙNG, chạy song song hao mòn tháng). cond=0 -> về mức không-thuyền.
//   + dọn RNG: randInt(min,max) -> randInt(state,min,max) cho cả 2 hàm.
import { createInitialState, actionCauCaSong, actionDanhBatVenBien, actionMuaCongCu } from "../engine.js";
import { THUYEN_WEAR_PER_TRIP, CAPITAL_WEAR_PER_MONTH } from "../core/capital.js";
import { RegionId } from "../models.js";
import { Weather } from "../weather.js";

let pass = true;
const check = (name, cond) => { console.log((cond ? "  ok  " : " FAIL ") + name); if (!cond) pass = false; };
const boatOf = (s) => (s.player.capital || []).find(c => c.kind === "thuyen_nan") || null;

// --- 0. hằng số ---
check("THUYEN_WEAR_PER_TRIP = 2", THUYEN_WEAR_PER_TRIP === 2);

// --- 1. CauCaSong KHÔNG thuyền -> luôn 1 giỏ (kể cả thời tiết + focus tốt) ---
{
  const s = createInitialState("T", 7);        // xã Quảng Oai = Sơn Tây (river region)
  s.thoiTiet = Weather.LU; s._quanLyBonus = 3; // weatherMul 1.2, focus 3
  let allOne = true, calls = 0;
  for (let i = 0; i < 12; i++) {
    s.player.theLuc = 140;
    const b = s.player.inventory?.ca || 0;
    if (!actionCauCaSong(s).ok) continue;
    calls++;
    if ((s.player.inventory.ca - b) !== 1) allOne = false;
  }
  check(`CauCaSong không thuyền: luôn 1 giỏ (${calls} buổi)`, calls > 0 && allOne);
}

// --- 2. CauCaSong CÓ thuyền -> công thức bung (≥2 với weather+focus) + hao cond 2/chuyến ---
{
  const s = createInitialState("T", 7);
  s.player.tien = 500;
  s.thoiTiet = Weather.LU; s._quanLyBonus = 3;
  actionMuaCongCu(s, "thuyen_nan");
  check("mua thuyền nan ok, cond 100", boatOf(s)?.cond === 100);
  let minQty = 99;
  for (let i = 0; i < 10; i++) { s.player.theLuc = 140; const b = s.player.inventory?.ca || 0; actionCauCaSong(s); minQty = Math.min(minQty, s.player.inventory.ca - b); }
  check(`CauCaSong có thuyền: sản lượng bung (min ${minQty} ≥ 2)`, minQty >= 2);
  check(`10 chuyến -> cond 100 → ${boatOf(s).cond} (−${10 * THUYEN_WEAR_PER_TRIP})`, boatOf(s).cond === 100 - 10 * THUYEN_WEAR_PER_TRIP);
}

// --- 3. DanhBatVenBien: không thuyền 1 giỏ / có thuyền công thức + hao cond ---
{
  const s = createInitialState("T", 7);
  s.player.currentRegion = RegionId.AN_QUANG; // vùng ven biển
  s._quanLyBonus = 2;
  let allOne = true;
  for (let i = 0; i < 8; i++) { s.player.theLuc = 140; const b = s.player.inventory?.ca || 0; actionDanhBatVenBien(s); if ((s.player.inventory.ca - b) !== 1) allOne = false; }
  check("DanhBatVenBien không thuyền: luôn 1 giỏ", allOne);

  const s2 = createInitialState("T", 7);
  s2.player.currentRegion = RegionId.AN_QUANG; s2.player.tien = 500; s2._quanLyBonus = 2;
  actionMuaCongCu(s2, "thuyen_nan");
  let minQty = 99;
  for (let i = 0; i < 10; i++) { s2.player.theLuc = 140; const b = s2.player.inventory?.ca || 0; actionDanhBatVenBien(s2); minQty = Math.min(minQty, s2.player.inventory.ca - b); }
  check(`DanhBatVenBien có thuyền: sản lượng bung (min ${minQty} ≥ 2)`, minQty >= 2);
  check("DanhBatVenBien: cũng hao cond 2/chuyến", boatOf(s2).cond === 100 - 10 * THUYEN_WEAR_PER_TRIP);
}

// --- 4. hao theo LẦN DÙNG nhanh hơn hao mòn THÁNG rõ rệt ---
{
  const s = createInitialState("T", 7);
  s.player.tien = 500; actionMuaCongCu(s, "thuyen_nan");
  for (let i = 0; i < 10; i++) { s.player.theLuc = 140; actionCauCaSong(s); }
  const dropByTrips = 100 - boatOf(s).cond;
  check(`10 chuyến hao ${dropByTrips} cond >> 1 tháng nằm không hao ${CAPITAL_WEAR_PER_MONTH}`,
    dropByTrips === 20 && dropByTrips > CAPITAL_WEAR_PER_MONTH * 5);
}

// --- 5. thuyền cond chạm 0 -> QUAY VỀ mức không-thuyền (bẫy cond>0) ---
{
  const s = createInitialState("T", 7);
  s.player.tien = 500; s.thoiTiet = Weather.LU; s._quanLyBonus = 3;
  actionMuaCongCu(s, "thuyen_nan");
  boatOf(s).cond = 2; // sắp hỏng
  s.player.theLuc = 140;
  let b = s.player.inventory?.ca || 0;
  actionCauCaSong(s);                       // chuyến này còn thuyền -> bung + cond 2→0
  check("chuyến cuối còn thuyền: sản lượng > 1", (s.player.inventory.ca - b) > 1);
  check("thuyền cond về 0", boatOf(s).cond === 0);
  s.player.theLuc = 140;
  b = s.player.inventory.ca;
  actionCauCaSong(s);                       // thuyền hỏng -> về 1 giỏ
  check("thuyền cond=0: chuyến sau về 1 giỏ (không-thuyền)", (s.player.inventory.ca - b) === 1);
}

// --- 6. dọn RNG: 2 hàm (nhánh có thuyền) nay rút từ state.rngState + tất định ---
{
  const s = createInitialState("T", 7);
  s.player.tien = 500; actionMuaCongCu(s, "thuyen_nan");
  s.player.theLuc = 140;
  const r0 = s.rngState;
  actionCauCaSong(s);
  check("CauCaSong (có thuyền) rút RNG từ state.rngState", s.rngState !== r0);

  const s2 = createInitialState("T", 7);
  s2.player.currentRegion = RegionId.AN_QUANG; s2.player.tien = 500; actionMuaCongCu(s2, "thuyen_nan");
  s2.player.theLuc = 140;
  const r1 = s2.rngState;
  actionDanhBatVenBien(s2);
  check("DanhBatVenBien (có thuyền) rút RNG từ state.rngState", s2.rngState !== r1);

  const run = () => {
    const st = createInitialState("Z", 9);
    st.player.tien = 500; actionMuaCongCu(st, "thuyen_nan");
    for (let i = 0; i < 6; i++) { st.player.theLuc = 140; actionCauCaSong(st); }
    return JSON.stringify([st.player.inventory.ca, boatOf(st).cond, st.rngState]);
  };
  check("tất định: cùng seed -> cùng (cá, cond thuyền, rngState)", run() === run());
}

// --- 7. RNG invariant world-gen ---
let badRng = 0;
for (let seed = 1; seed <= 60; seed++) { const st = createInitialState("T", seed); if (st.rngState !== st.rngSeed) badRng++; }
check("rngState === rngSeed trên 60 seed", badRng === 0);
for (const [seed, n] of [[999, 11], [4242, 10]]) {
  check(`seed ${seed}: NPC ngoài QO = ${n}`,
    createInitialState("T", seed).npcs.filter(x => x.currentPhu !== "quang_oai").length === n);
}

console.log(pass ? "PASS - T3.4-2a: thuyền nan (mềm, cond>0) + hao 2/chuyến song song hao tháng, cond=0 về mức không-thuyền" : "FAIL - T3.4-2a");
process.exit(pass ? 0 : 1);

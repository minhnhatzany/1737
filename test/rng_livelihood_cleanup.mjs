// Dọn RNG: actionChatGo / actionDetVai(có khung) / actionChanNuoiLon trước đây gọi
// randInt(min,max) 2 tham số -> rút _fallbackSeed module, KHÔNG replay-safe (cùng lỗi
// đã sửa ở actionCayRuong T3.4-0). Đổi sang randInt(state,min,max). CHỈ đổi nguồn RNG,
// KHÔNG đổi phân phối (vẫn uniform cùng dải). Khoá: nay rút từ state.rngState + tất định.
import { createInitialState, actionChatGo, actionDetVai, actionChanNuoiLon,
         actionMuaCongCu } from "../engine.js";
import { RegionId } from "../models.js";

let pass = true;
const check = (name, cond) => { console.log((cond ? "  ok  " : " FAIL ") + name); if (!cond) pass = false; };

// --- 1. mỗi hàm nay rút từ state.rngState (rngState đổi sau khi gọi) ---
{
  const s = createInitialState("T", 7);
  s.player.theLuc = 140;
  const r0 = s.rngState;
  actionChatGo(s);
  check("actionChatGo rút RNG từ state.rngState", s.rngState !== r0);

  const s2 = createInitialState("T", 7);
  s2.player.theLuc = 140; s2.player.tien = 500;
  actionMuaCongCu(s2, "khung_cui");
  const r1 = s2.rngState;
  actionDetVai(s2);
  check("actionDetVai (có khung) rút RNG từ state.rngState", s2.rngState !== r1);

  const s3 = createInitialState("T", 7);
  s3.player.theLuc = 140; s3.player.tien = 100;
  const r2 = s3.rngState;
  actionChanNuoiLon(s3);
  check("actionChanNuoiLon rút RNG từ state.rngState", s3.rngState !== r2);
}

// --- 2. phân phối KHÔNG đổi (vẫn đúng dải cũ) ---
{
  const s = createInitialState("T", 7);
  s.player.tien = 9999;
  s.player.currentRegion = RegionId.THANG_LONG; // vùng trung tính: không regionBoost cho 3 nghề này
  actionMuaCongCu(s, "khung_cui");
  let goMin = 99, goMax = 0, thitMin = 99, thitMax = 0, luaMin = 99, luaMax = 0;
  for (let i = 0; i < 80; i++) {
    s.player.theLuc = 140; s.player.tien += 50;
    let b = s.player.inventory?.go || 0; actionChatGo(s); goMin = Math.min(goMin, s.player.inventory.go - b); goMax = Math.max(goMax, s.player.inventory.go - b);
    s.player.theLuc = 140;
    b = s.player.inventory?.thit_lon || 0; actionChanNuoiLon(s); thitMin = Math.min(thitMin, s.player.inventory.thit_lon - b); thitMax = Math.max(thitMax, s.player.inventory.thit_lon - b);
    s.player.theLuc = 140;
    b = s.player.inventory?.lua || 0; actionDetVai(s); luaMin = Math.min(luaMin, s.player.inventory.lua - b); luaMax = Math.max(luaMax, s.player.inventory.lua - b);
  }
  // ChatGo: (1+0..2) * 1.0 * 1.0 = 1..3 ;  ChanNuoiLon: (1+0..2) = 1..3 ;  DetVai có khung ngoài vùng boost: (1+0..1) = 1..2
  check(`ChatGo vẫn dải 1..3 (thấy ${goMin}..${goMax})`, goMin === 1 && goMax === 3);
  check(`ChanNuoiLon vẫn dải 1..3 (thấy ${thitMin}..${thitMax})`, thitMin === 1 && thitMax === 3);
  check(`DetVai có khung vẫn dải 1..2 (thấy ${luaMin}..${luaMax})`, luaMin === 1 && luaMax === 2);
}

// --- 3. tất định: cùng seed + cùng chuỗi -> cùng kết quả + cùng rngState ---
{
  const run = () => {
    const s = createInitialState("Z", 5);
    s.player.theLuc = 140; s.player.tien = 500;
    actionMuaCongCu(s, "khung_cui");
    for (let i = 0; i < 5; i++) {
      s.player.theLuc = 140; s.player.tien += 30;
      actionChatGo(s); actionChanNuoiLon(s); actionDetVai(s);
    }
    return JSON.stringify([s.player.inventory.go, s.player.inventory.thit_lon, s.player.inventory.lua, s.rngState]);
  };
  check("tất định: cùng seed -> cùng (gỗ, thịt, lụa, rngState)", run() === run());
}

// --- 4. rngState invariant world-gen giữ nguyên ---
let badRng = 0;
for (let seed = 1; seed <= 60; seed++) { const st = createInitialState("T", seed); if (st.rngState !== st.rngSeed) badRng++; }
check("rngState === rngSeed trên 60 seed", badRng === 0);
for (const [seed, n] of [[999, 11], [4242, 10]]) {
  check(`seed ${seed}: NPC ngoài QO = ${n} (world-gen không lệch)`,
    createInitialState("T", seed).npcs.filter(x => x.currentPhu !== "quang_oai").length === n);
}

console.log(pass ? "PASS - dọn RNG: ChatGo/DetVai/ChanNuoiLon rút từ state.rngState, phân phối & world-gen không đổi" : "FAIL - dọn RNG");
process.exit(pass ? 0 : 1);

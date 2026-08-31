// T3.4-1a — công cụ chế biến, modifier MỀM (không chặn cứng):
//   actionNauRuou: nồi cất rượu (noi_ruou) -> mẻ khá hơn, tỉ lệ ra 2 tăng; không nồi -> 1 hũ.
//   actionDetVai : khung cửi (khung_cui) -> năng suất đầy đủ (vùng+focus); không khung -> 1 tấm.
//                  + input sợi trừu tượng DET_VAI_SOI_COST=6 quan/buổi (gate như chăn lợn).
//   actionChanNuoiLon: KHÔNG đụng.
//   Cả hai: cond>0 (công cụ hỏng = coi như không có — bẫy hasTrau ở actionKhoiVu).
import { createInitialState, gameTick, actionNauRuou, actionDetVai, actionChanNuoiLon,
         actionMuaCongCu } from "../engine.js";
import { RegionId } from "../models.js";

let pass = true;
const check = (name, cond) => { console.log((cond ? "  ok  " : " FAIL ") + name); if (!cond) pass = false; };

// helper: nạp thóc + tiền + thể lực để chạy nhiều buổi
const prep = (s) => { s.player.tien = 500; s.player.thocCaNhan = 400; s.player.theLuc = 140; };

// --- 1. NauRuou KHÔNG nồi -> luôn 1 hũ/buổi ---
{
  const s = createInitialState("T", 7); prep(s);
  let allOne = true, calls = 0;
  for (let i = 0; i < 12; i++) {
    s.player.theLuc = 140;
    const before = s.player.inventory?.ruou || 0;
    const r = actionNauRuou(s);
    if (!r.ok) continue;
    calls++;
    if ((s.player.inventory.ruou - before) !== 1) allOne = false;
  }
  check(`NauRuou không nồi: mọi buổi ra đúng 1 hũ (${calls} buổi)`, calls > 0 && allOne);
}

// --- 2. NauRuou CÓ nồi -> có buổi ra 2 (mean > 1) ---
{
  const s = createInitialState("T", 7); prep(s);
  const buy = actionMuaCongCu(s, "noi_ruou");
  check("mua nồi cất rượu ok", buy.ok && s.player.capital.some(c => c.kind === "noi_ruou" && c.cond > 0));
  let total = 0, calls = 0;
  for (let i = 0; i < 40; i++) {
    s.player.theLuc = 140; s.player.thocCaNhan = 400;
    const before = s.player.inventory?.ruou || 0;
    const r = actionNauRuou(s);
    if (!r.ok) continue;
    calls++; total += (s.player.inventory.ruou - before);
  }
  check(`NauRuou có nồi: có buổi ra 2 (mean ${(total / calls).toFixed(2)} > 1)`, calls > 0 && total / calls > 1);
  check("NauRuou có nồi: không buổi nào ra > 2", total <= calls * 2);
}

// --- 3. NauRuou nồi HỎNG (cond=0) -> coi như không có, về 1 hũ ---
{
  const s = createInitialState("T", 7); prep(s);
  actionMuaCongCu(s, "noi_ruou");
  s.player.capital.find(c => c.kind === "noi_ruou").cond = 0; // hỏng
  let allOne = true, calls = 0;
  for (let i = 0; i < 12; i++) {
    s.player.theLuc = 140; s.player.thocCaNhan = 400;
    const before = s.player.inventory?.ruou || 0;
    if (!actionNauRuou(s).ok) continue;
    calls++;
    if ((s.player.inventory.ruou - before) !== 1) allOne = false;
  }
  check(`NauRuou nồi cond=0: về 1 hũ/buổi (bẫy cond>0, ${calls} buổi)`, calls > 0 && allOne);
}

// --- 4. DetVai: gate sợi 6 quan ---
{
  const s = createInitialState("T", 7);
  s.player.theLuc = 140; s.player.tien = 5;
  const r = actionDetVai(s);
  check("DetVai thiếu tiền sợi (<6) -> từ chối", r.ok === false && /sợi/i.test(r.msg || ""));
  s.player.tien = 50;
  const t0 = s.player.tien;
  const r2 = actionDetVai(s);
  check("DetVai đủ tiền -> ok, trừ đúng 6 quan sợi", r2.ok && s.player.tien === t0 - 6);
}

// --- 5. DetVai KHÔNG khung -> luôn 1 tấm, kể cả có regionBoost + _quanLyBonus ---
{
  const s = createInitialState("T", 7);
  s.player.tien = 500; s.player.currentRegion = RegionId.SON_NAM; // regionBoost 1.25
  s._quanLyBonus = 2;                                             // focus mạnh
  let allOne = true, calls = 0;
  for (let i = 0; i < 10; i++) {
    s.player.theLuc = 140;
    const before = s.player.inventory?.lua || 0;
    if (!actionDetVai(s).ok) continue;
    calls++;
    if ((s.player.inventory.lua - before) !== 1) allOne = false;
  }
  check(`DetVai không khung: luôn 1 tấm dù SƠN_NAM + focus×2 (${calls} buổi)`, calls > 0 && allOne);
}

// --- 6. DetVai CÓ khung -> năng suất đầy đủ (≥2 với regionBoost + focus) ---
{
  const s = createInitialState("T", 7);
  s.player.tien = 500; s.player.currentRegion = RegionId.SON_NAM;
  s._quanLyBonus = 2;
  actionMuaCongCu(s, "khung_cui");
  check("mua khung cửi ok", s.player.capital.some(c => c.kind === "khung_cui" && c.cond > 0));
  let minQty = 99, calls = 0;
  for (let i = 0; i < 12; i++) {
    s.player.theLuc = 140; s.player.tien += 20;
    const before = s.player.inventory?.lua || 0;
    if (!actionDetVai(s).ok) continue;
    calls++;
    minQty = Math.min(minQty, s.player.inventory.lua - before);
  }
  check(`DetVai có khung: năng suất bung theo vùng+focus (min ${minQty} ≥ 2)`, calls > 0 && minQty >= 2);
}

// --- 7. DetVai khung HỎNG (cond=0) -> về 1 tấm ---
{
  const s = createInitialState("T", 7);
  s.player.tien = 500; s.player.currentRegion = RegionId.SON_NAM; s._quanLyBonus = 2;
  actionMuaCongCu(s, "khung_cui");
  s.player.capital.find(c => c.kind === "khung_cui").cond = 0;
  s.player.theLuc = 140;
  const before = s.player.inventory?.lua || 0;
  actionDetVai(s);
  check("DetVai khung cond=0: về 1 tấm (bẫy cond>0)", (s.player.inventory.lua - before) === 1);
}

// --- 8. ChanNuoiLon KHÔNG bị đụng ---
{
  const s = createInitialState("T", 7);
  s.player.theLuc = 140; s.player.tien = 100;
  const t0 = s.player.tien, tl0 = s.player.theLuc;
  const before = s.player.inventory?.thit_lon || 0;
  const r = actionChanNuoiLon(s);
  const gained = s.player.inventory.thit_lon - before;
  check("ChanNuoiLon vẫn chạy: −8 quan, −18 TL, +1..3 thịt", r.ok && s.player.tien === t0 - 8 && s.player.theLuc === tl0 - 18 && gained >= 1 && gained <= 3);
}

// --- 9. RNG invariant + tất định ---
let badRng = 0;
for (let seed = 1; seed <= 60; seed++) { const st = createInitialState("T", seed); if (st.rngState !== st.rngSeed) badRng++; }
check("rngState === rngSeed trên 60 seed", badRng === 0);
for (const [seed, n] of [[999, 11], [4242, 10]]) {
  check(`seed ${seed}: NPC ngoài QO = ${n}`,
    createInitialState("T", seed).npcs.filter(x => x.currentPhu !== "quang_oai").length === n);
}
{
  const mk = () => {
    const st = createInitialState("Z", 9); prep(st);
    actionMuaCongCu(st, "noi_ruou");
    let out = [];
    for (let i = 0; i < 6; i++) { st.player.theLuc = 140; st.player.thocCaNhan = 400; actionNauRuou(st); }
    out.push(st.player.inventory.ruou, st.rngState);
    return JSON.stringify(out);
  };
  check("tất định: cùng seed -> cùng (rượu, rngState)", mk() === mk());
}

console.log(pass ? "PASS - T3.4-1a: nồi/khung modifier mềm (cond>0), sợi 6Q cho dệt, chăn lợn nguyên vẹn" : "FAIL - T3.4-1a");
process.exit(pass ? 0 : 1);

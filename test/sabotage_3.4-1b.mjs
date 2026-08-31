// T3.4-1b — dòng họ đối nghịch CỤC BỘ phá 4 nghề chế biến/chặt gỗ (rượu/vải/lợn/gỗ).
// Khuôn nhánh sabotage của actionCayRuong + processMonthlyFarmRisk: chỉ rank dân/phú hộ;
// localHostile (họ cục bộ thù, KHÔNG tính họ bảo trợ); rng(state) < sabotageChance ->
// qty -= 1 (sàn 1) + log. KHÔNG patron boost cho nhóm này (chỉ đặc sản giữ patron).
import { createInitialState, actionNauRuou, actionDetVai, actionChanNuoiLon, actionChatGo,
         actionMuaCongCu } from "../engine.js";
import { localClanIds } from "../actions/clan.js";

let pass = true;
const check = (name, cond) => { console.log((cond ? "  ok  " : " FAIL ") + name); if (!cond) pass = false; };

const makeHostile = (s) => { for (const id of localClanIds(s)) { const c = s.clans.find(x => x.id === id); if (c) c.attitude = "hostile"; } };
const runChan = (s) => { s.player.theLuc = 140; s.player.tien += 20; const b = s.player.inventory?.thit_lon || 0; actionChanNuoiLon(s); return s.player.inventory.thit_lon - b; };
const sabotageLogs = (s) => (s.log || []).filter(e => /Dòng họ đối nghịch/.test(e.text || "")).length;

// --- 1. KHÔNG có họ thù cục bộ -> KHÔNG bao giờ bị phá ---
{
  const s = createInitialState("T", 7);
  s.player.tien = 9999;
  for (let i = 0; i < 40; i++) { s.player.theLuc = 140; s.player.thocCaNhan = 400; actionNauRuou(s); s.player.theLuc = 140; runChan(s); }
  check("clan trung lập: 0 lần bị phá", sabotageLogs(s) === 0);
}

// --- 2. Có họ thù cục bộ -> BỊ PHÁ đôi khi (~sabotageChance) ---
// Đo QUA SẢN LƯỢNG (không đếm log — state.log cap 120): _quanLyBonus=10 -> base mẻ
// thịt ∈ {10,20,30}; bị phá -> −1 -> {9,19,29} -> delta % 10 !== 0 ⟺ chắc chắn bị phá.
{
  const s = createInitialState("T", 7);
  s.player.tien = 999999;
  s._quanLyBonus = 10;
  s.clanPressureMode = "hardcore"; // sabotageChance 0.22
  makeHostile(s);
  let n = 0;
  const N = 400;
  for (let i = 0; i < N; i++) {
    const d = runChan(s);
    if (d % 10 !== 0) n++;
  }
  check(`họ thù: bị phá (${n}/${N} = ${(n / N).toFixed(3)}) rơi vào dải ~0.22 [${Math.round(N * 0.13)}..${Math.round(N * 0.33)}]`,
    n > 0 && n >= N * 0.13 && n <= N * 0.33);
}

// --- 3. Phá GIẢM qty đúng 1, sàn 1 (chăn lợn, _quanLyBonus=3 -> base {3,6,9}) ---
{
  const ctrl = createInitialState("T", 7); ctrl.player.tien = 99999; ctrl._quanLyBonus = 3;
  let ctrlMin = 99;
  for (let i = 0; i < 150; i++) ctrlMin = Math.min(ctrlMin, runChan(ctrl));
  check(`đối chứng (không họ thù): min mẻ thịt = 3 (base thấp nhất)`, ctrlMin === 3);

  const sab = createInitialState("T", 7); sab.player.tien = 99999; sab._quanLyBonus = 3;
  sab.clanPressureMode = "hardcore";
  makeHostile(sab);
  let sabMin = 99;
  for (let i = 0; i < 300; i++) sabMin = Math.min(sabMin, runChan(sab));
  check(`bị phá: min mẻ thịt = 2 (base 3 − 1)`, sabMin === 2);
  check("bị phá: không bao giờ xuống 0 (sàn 1)", sabMin >= 1);
}

// --- 4. rank cao (tri_huyen) -> KHÔNG bị phá dù họ thù ---
{
  const s = createInitialState("T", 7);
  s.player.tien = 99999; s.player.rank = "tri_huyen";
  s.clanPressureMode = "hardcore";
  makeHostile(s);
  for (let i = 0; i < 80; i++) { s.player.theLuc = 140; s.player.thocCaNhan = 400; actionNauRuou(s); }
  check("rank tri_huyen: 0 lần bị phá (gate rank dân/phú hộ)", sabotageLogs(s) === 0);
}

// --- 5. họ thù DUY NHẤT lại là họ bảo trợ -> KHÔNG bị phá ---
{
  const s = createInitialState("T", 7);
  s.player.tien = 99999;
  s.clanPressureMode = "hardcore";
  const locals = localClanIds(s);
  // chỉ 1 họ thù, và đặt nó làm _patronClanId; họ kia trung lập
  const c0 = s.clans.find(x => x.id === locals[0]); c0.attitude = "hostile";
  s.player._patronClanId = locals[0];
  for (let i = 0; i < 120; i++) { s.player.theLuc = 140; s.player.thocCaNhan = 400; actionNauRuou(s); }
  check("họ thù == họ bảo trợ (họ kia trung lập): 0 lần bị phá", sabotageLogs(s) === 0);
}

// --- 6. cả 4 nghề đều nối cơ chế (không chỉ 1) ---
{
  const s = createInitialState("T", 7);
  s.player.tien = 999999; s.player.thocCaNhan = 999999;
  s.clanPressureMode = "hardcore";
  makeHostile(s);
  const tags = { ruou: 0, vai: 0, lon: 0, go: 0 };
  for (let i = 0; i < 200; i++) {
    s.player.theLuc = 140; const b1 = sabotageLogs(s); actionNauRuou(s);   if (sabotageLogs(s) > b1) tags.ruou++;
    s.player.theLuc = 140; const b2 = sabotageLogs(s); actionDetVai(s);    if (sabotageLogs(s) > b2) tags.vai++;
    s.player.theLuc = 140; const b3 = sabotageLogs(s); actionChanNuoiLon(s); if (sabotageLogs(s) > b3) tags.lon++;
    s.player.theLuc = 140; const b4 = sabotageLogs(s); actionChatGo(s);    if (sabotageLogs(s) > b4) tags.go++;
  }
  check(`cả 4 nghề đều có lần bị phá: ${JSON.stringify(tags)}`, tags.ruou > 0 && tags.vai > 0 && tags.lon > 0 && tags.go > 0);
}

// --- 7. RNG invariant + tất định ---
let badRng = 0;
for (let seed = 1; seed <= 60; seed++) { const st = createInitialState("T", seed); if (st.rngState !== st.rngSeed) badRng++; }
check("rngState === rngSeed trên 60 seed", badRng === 0);
for (const [seed, n] of [[999, 11], [4242, 10]]) {
  check(`seed ${seed}: NPC ngoài QO = ${n}`,
    createInitialState("T", seed).npcs.filter(x => x.currentPhu !== "quang_oai").length === n);
}
{
  const run = () => {
    const s = createInitialState("Z", 5); s.player.tien = 99999; s.clanPressureMode = "hardcore";
    makeHostile(s);
    for (let i = 0; i < 20; i++) { s.player.theLuc = 140; s.player.thocCaNhan = 400; actionNauRuou(s); }
    return JSON.stringify([s.player.inventory.ruou, s.rngState, sabotageLogs(s)]);
  };
  check("tất định: cùng seed -> cùng (rượu, rngState, số lần bị phá)", run() === run());
}

console.log(pass ? "PASS - T3.4-1b: sabotage họ thù cục bộ cho rượu/vải/lợn/gỗ (−1 sàn 1, gate rank, trừ họ bảo trợ, không patron)" : "FAIL - T3.4-1b");
process.exit(pass ? 0 : 1);

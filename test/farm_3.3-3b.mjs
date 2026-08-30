// T3.3-3b — lớp rủi ro phase "chờ": weatherHits[] (thời tiết xấu + phá hoại dòng họ)
// tích theo THÁNG, mỗi hit trừ 12% yield (sàn 0.1). Phép thử chính: vụ gặp rủi ro
// -> yield THẤP HƠN RÕ RỆT vụ suôn sẻ, cùng điều kiện khác.
import { createInitialState, gameTick, actionKhoiVu, actionXinCongDien,
         rollVuYield, processMonthlyFarmRisk } from "../engine.js";
import { Weather } from "../weather.js";

let pass = true;
const check = (name, cond) => { console.log((cond ? "  ok  " : " FAIL ") + name); if (!cond) pass = false; };
const tickDays = (s, n) => { for (let i = 0; i < n; i++) { s.gameDay = (s.gameDay % 30) + 1; gameTick(s); } };

// --- 1. processMonthlyFarmRisk: thời tiết xấu -> weatherHits ---
{
  const s = createInitialState("T", 7);
  const p = s.player;
  actionXinCongDien(s);
  const plot = p.farmPlots[0];
  plot.phase = "cho"; plot.phaseDaysLeft = 75; plot.weatherHits = [];
  for (const w of [Weather.BAO, Weather.LU, Weather.HAN]) {
    plot.weatherHits = [];
    s.thoiTiet = w;
    processMonthlyFarmRisk(s);
    check(`${w} trong "chờ" -> +1 weatherHit`, plot.weatherHits.length === 1 && plot.weatherHits[0] === w);
  }
  for (const w of [Weather.MUA, Weather.NANG]) {
    plot.weatherHits = [];
    s.thoiTiet = w;
    processMonthlyFarmRisk(s);
    check(`${w} -> KHÔNG thêm weatherHit`, plot.weatherHits.length === 0);
  }
  // phase != "cho" -> bỏ qua
  plot.phase = "cay"; plot.weatherHits = []; s.thoiTiet = Weather.BAO;
  processMonthlyFarmRisk(s);
  check('phase "cấy" (không phải "chờ") -> không tích hit', plot.weatherHits.length === 0);
}

// --- 2. sabotage dòng họ: chỉ rank dân/phú hộ, cần localHostile ---
{
  const s = createInitialState("T", 7);
  const p = s.player;
  p.rank = "tri_huyen"; // quan lớn -> không bị phá
  actionXinCongDien(s);
  const plot = p.farmPlots[0];
  plot.phase = "cho"; plot.weatherHits = [];
  s.thoiTiet = Weather.MUA;
  // ép mọi clan xã thành hostile
  for (const c of s.clans.filter(c => c.scope === "xa")) c.attitude = "hostile";
  for (let i = 0; i < 20; i++) processMonthlyFarmRisk(s);
  check("rank tri_huyen -> KHÔNG bị dòng họ phá (0 hit dù hostile)", plot.weatherHits.length === 0);
  p.rank = "dan_thuong";
  for (let i = 0; i < 40; i++) processMonthlyFarmRisk(s);
  check("rank dân + clan hostile -> CÓ bị phá (weatherHits tăng)", plot.weatherHits.length > 0);
  check("hit phá hoại đánh dấu 'pha_hoai'", plot.weatherHits.includes("pha_hoai"));
}

// --- 3. rollVuYield: mỗi hit -12%, sàn 0.1 ---
{
  const s = createInitialState("T", 7);
  s.thoiTiet = Weather.MUA;
  actionXinCongDien(s);
  const plot = s.player.farmPlots[0];
  const snap = s.rngState;
  plot.weatherHits = []; s.rngState = snap; const y0 = rollVuYield(s, plot);
  plot.weatherHits = ["x"]; s.rngState = snap; const y1 = rollVuYield(s, plot);
  plot.weatherHits = ["x","x","x"]; s.rngState = snap; const y3 = rollVuYield(s, plot);
  plot.weatherHits = new Array(20).fill("x"); s.rngState = snap; const y20 = rollVuYield(s, plot);
  check("1 hit ~ y0 × 0.88", y1 < y0 && Math.abs(y1 / y0 - 0.88) < 0.06);
  check("3 hit < 1 hit < 0 hit", y3 < y1 && y1 < y0);
  check("nhiều hit -> sàn 0.1 (không về 0)", y20 >= 1 && y20 <= y0 * 0.15);
}

// --- 4. PHÉP THỬ CHÍNH: vụ gặp rủi ro vs vụ suôn sẻ (qua trọn pipeline 99 ngày) ---
{
  const runVu = (injectHits) => {
    const s = createInitialState("T", 123);
    s.thoiTiet = Weather.MUA;                 // cố định thời tiết lúc gặt cho công bằng
    actionXinCongDien(s);
    const plot = s.player.farmPlots[0];
    actionKhoiVu(s, plot.id);
    // tua tới phase "chờ" (lam_dat 10 + gieo_ma 6 + cay 5 = 21)
    tickDays(s, 21);
    // trong "chờ": vụ rủi ro bị nhồi weatherHits (mô phỏng nhiều tháng xấu)
    if (injectHits && plot.phase === "cho") plot.weatherHits.push("bao", "lu", "han", "pha_hoai", "bao");
    tickDays(s, 78);                           // hết chờ (75) + gặt (3)
    s.thoiTiet = Weather.MUA;                  // đảm bảo weather lúc gặt như nhau
    return plot.lastYield;
  };
  const yGood = runVu(false);
  const yBad  = runVu(true);
  check(`vụ suôn sẻ ra ${yGood} thóc, vụ 5-rủi-ro ra ${yBad} thóc`, typeof yGood === "number" && typeof yBad === "number");
  check("vụ gặp rủi ro yield THẤP HƠN RÕ RỆT (< 60% vụ suôn sẻ)", yBad < yGood * 0.6);
  check("vụ rủi ro vẫn ra > 0 thóc (sàn)", yBad >= 1);
}

// --- 5. RNG + world-gen ---
let badRng = 0;
for (let seed = 1; seed <= 60; seed++) { const st = createInitialState("T", seed); if (st.rngState !== st.rngSeed) badRng++; }
check("rngState === rngSeed trên 60 seed", badRng === 0);
for (const [seed, n] of [[999, 11], [4242, 10]]) {
  check(`seed ${seed}: NPC ngoài QO = ${n} (world-gen không lệch)`,
    createInitialState("T", seed).npcs.filter(x => x.currentPhu !== "quang_oai").length === n);
}
{
  const mk = () => {
    const st = createInitialState("Z", 9);
    actionXinCongDien(st);
    actionKhoiVu(st, st.player.farmPlots[0].id);
    tickDays(st, 99);
    return st.player.farmPlots[0].lastYield;
  };
  check("tất định: cùng seed -> cùng lastYield (kể cả nhánh risk)", mk() === mk());
}

console.log(pass ? "PASS - T3.3-3b: weatherHits (thời tiết xấu + phá hoại) làm vụ mất mùa thật sự, không chỉ log" : "FAIL - T3.3-3b");
process.exit(pass ? 0 : 1);

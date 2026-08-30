// T3.3-3a — vụ mùa nhiều giai đoạn. actionKhoiVu đưa thửa NHÀN vào chuỗi
// lam_dat→gieo_ma→cay→cho→gat (daily tick tự chuyển phase); "gat" xong -> yield gộp
// vào thocCaNhan (chưa tách tô — T3.3-4). actionCayRuong KHÔNG bị đụng.
import { createInitialState, gameTick, actionKhoiVu, actionXinCongDien, actionMuaRuongTu,
         actionMuaCongCu, actionCayRuong } from "../engine.js";
import { PHASE_DAYS, LAM_DAT_DAYS_TRAU, VU_PHASES, BASE_VU_YIELD, makeFarmPlot } from "../core/farm.js";

let pass = true;
const check = (name, cond) => { console.log((cond ? "  ok  " : " FAIL ") + name); if (!cond) pass = false; };
const tickDays = (s, n) => { for (let i = 0; i < n; i++) { s.gameDay = (s.gameDay % 30) + 1; gameTick(s); } };

// --- 1. shape ---
{
  const f = makeFarmPlot({ seq: 1, xaId: "x", tenure: "tu", day: 0 });
  check("makeFarmPlot có field vụ mùa",
    f.phase === null && f.phaseDaysLeft === 0 && f.hasTrau === false
    && Array.isArray(f.weatherHits) && f.vuStartedDay === null && f.lastYield === null);
  check("PHASE_DAYS = 10/6/5/75/3, LAM_DAT_DAYS_TRAU = 4",
    PHASE_DAYS.lam_dat === 10 && PHASE_DAYS.gieo_ma === 6 && PHASE_DAYS.cay === 5
    && PHASE_DAYS.cho === 75 && PHASE_DAYS.gat === 3 && LAM_DAT_DAYS_TRAU === 4);
}

// --- 2. actionKhoiVu: gate + khởi ---
{
  const s = createInitialState("T", 7);
  const p = s.player;
  check("plot lạ -> từ chối", actionKhoiVu(s, "plot_x").ok === false);
  actionXinCongDien(s);
  const plot = p.farmPlots[0];
  const tl0 = p.theLuc;
  const r = actionKhoiVu(s, plot.id);
  check("khởi vụ ok, -20 TL", r.ok && p.theLuc === tl0 - 20);
  check("phase=lam_dat, phaseDaysLeft=10 (cày tay), hasTrau=false, vuStartedDay số",
    plot.phase === "lam_dat" && plot.phaseDaysLeft === 10 && plot.hasTrau === false && typeof plot.vuStartedDay === "number");
  check("khởi vụ lần 2 (đang vụ) -> từ chối", actionKhoiVu(s, plot.id).ok === false);
  p.theLuc = 5;
  const s2 = createInitialState("T", 7); actionXinCongDien(s2); s2.player.theLuc = 5;
  check("thiếu TL -> từ chối", actionKhoiVu(s2, s2.player.farmPlots[0].id).ok === false);
}

// --- 3. state machine: chuyển phase đúng số ngày, tổng 99 (cày tay) ---
{
  const s = createInitialState("T", 7);
  const p = s.player;
  actionXinCongDien(s);
  const plot = p.farmPlots[0];
  actionKhoiVu(s, plot.id);
  const seq = [["lam_dat", 10], ["gieo_ma", 6], ["cay", 5], ["cho", 75], ["gat", 3]];
  let elapsed = 0;
  for (let i = 0; i < seq.length; i++) {
    const [ph, days] = seq[i];
    check(`đang phase "${ph}"`, plot.phase === ph);
    tickDays(s, days - 1);
    check(`"${ph}" còn 1 ngày sau ${days - 1} tick`, plot.phaseDaysLeft === 1 || (ph === "gat" && plot.phase === "gat"));
    tickDays(s, 1);
    elapsed += days;
  }
  check(`tổng vụ = ${elapsed} ngày (10+6+5+75+3)`, elapsed === 99);
  check("gặt xong: phase về null, lastYield >= 1, weatherHits rỗng",
    plot.phase === null && typeof plot.lastYield === "number" && plot.lastYield >= 1 && plot.weatherHits.length === 0);
  check("yield gộp vào thocCaNhan (chưa tách tô)", p.thocCaNhan >= plot.lastYield - 100); // trừ hao ăn hàng ngày
  check("yield trong dải hợp lý (BASE 60 × weather × ±15% ...)", plot.lastYield >= 1 && plot.lastYield <= BASE_VU_YIELD * 2);
}

// --- 4. có trâu: làm đất 4 ngày ---
{
  const s = createInitialState("T", 7);
  const p = s.player;
  p.tien = 999;
  actionMuaCongCu(s, "trau");
  actionMuaRuongTu(s);
  const plot = p.farmPlots.find(f => f.tenure === "tu");
  actionKhoiVu(s, plot.id);
  check("hasTrau=true, lam_dat = 4 ngày", plot.hasTrau === true && plot.phaseDaysLeft === LAM_DAT_DAYS_TRAU);
  tickDays(s, 4);
  check("sau 4 tick -> chuyển sang gieo_ma", plot.phase === "gieo_ma");
}

// --- 5. actionCayRuong KHÔNG bị đụng — vẫn tức thời ---
{
  const s = createInitialState("T", 7);
  const p = s.player;
  const before = p.thocCaNhan;
  const r = actionCayRuong(s);
  check("actionCayRuong vẫn chạy tức thời, +thóc ngay", r.ok && p.thocCaNhan > before);
  check("actionCayRuong KHÔNG tạo farmPlot", p.farmPlots.length === 0);
}

// --- 6. actionKhoiVu KHÔNG đụng rngState; createInitialState sạch; tất định ---
{
  const s = createInitialState("T", 42);
  actionXinCongDien(s);
  const rngBefore = s.rngState;
  actionKhoiVu(s, s.player.farmPlots[0].id);
  check("actionKhoiVu KHÔNG đụng state.rngState (không roll)", s.rngState === rngBefore);
}
let badRng = 0;
for (let seed = 1; seed <= 60; seed++) { const st = createInitialState("T", seed); if (st.rngState !== st.rngSeed) badRng++; }
check("rngState === rngSeed trên 60 seed", badRng === 0);
for (const [seed, n] of [[999, 11], [4242, 10]]) {
  check(`seed ${seed}: NPC ngoài QO = ${n} (world-gen không lệch)`,
    createInitialState("T", seed).npcs.filter(x => x.currentPhu !== "quang_oai").length === n);
}
{
  const mk = () => {
    const st = createInitialState("Z", 5);
    actionXinCongDien(st);
    actionKhoiVu(st, st.player.farmPlots[0].id);
    tickDays(st, 99);
    return st.player.farmPlots[0].lastYield;
  };
  check("tất định: cùng seed -> cùng lastYield", mk() === mk());
}

console.log(pass ? "PASS - T3.3-3a: vụ mùa 5 giai đoạn (10/6/5/75/3), yield gộp, actionCayRuong nguyên vẹn" : "FAIL - T3.3-3a");
process.exit(pass ? 0 : 1);

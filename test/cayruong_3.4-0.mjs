// T3.4-0 — cân bằng actionCayRuong: cày công nhật = đắp đổi qua ngày, KHÔNG tích sản.
//   - sản lượng nền ×0.4 (CAY_RUONG_FACTOR) so với rollPersonalHarvestThoc thô
//   - rng(state) thay rng() fallback (replay-safe)
//   - trần CAY_RUONG_MAX_PER_DAY (3) buổi/ngày; field _cayRuongToday, reset ở gameTick
//   - giọng log đổi: "cày công nhật kiếm bữa", không phô số thóc như thành tựu
//   - modifier dòng họ (patron/hostile) giữ nguyên
import { createInitialState, gameTick, actionCayRuong } from "../engine.js";
import { rollPersonalHarvestThoc, Weather } from "../weather.js";

let pass = true;
const check = (name, cond) => { console.log((cond ? "  ok  " : " FAIL ") + name); if (!cond) pass = false; };
const tickOneDay = (s) => { s.gameDay = (s.gameDay % 30) + 1; gameTick(s); };

// --- 1. ×0.4: delta thóc = floor(rollPersonalHarvestThoc thô × 0.4) ---
{
  const s = createInitialState("T", 7);
  s.thoiTiet = Weather.MUA;
  s.player._patronClanId = null;
  s.player._quanLyBonus = 1.0; s._quanLyBonus = 1.0;
  const snap = s.rngState;
  const t0 = s.player.thocCaNhan;
  actionCayRuong(s);
  const delta = s.player.thocCaNhan - t0;
  // tái tạo raw với cùng rngState
  const s2 = createInitialState("T", 7);
  s2.thoiTiet = Weather.MUA;
  s2.rngState = snap;
  const raw = rollPersonalHarvestThoc(Weather.MUA, s2);
  const expected = Math.max(1, Math.floor(raw * 0.4));
  check(`delta thóc (${delta}) = floor(raw ${raw} × 0.4) = ${expected}`, delta === expected);
  check("delta trong dải thấp (≤ 13 cho MƯA, ≥ 1)", delta >= 1 && delta <= 13);
}

// --- 2. replay-safe: rút từ dòng RNG phiên (state.rngState đổi) + tất định ---
{
  const s = createInitialState("T", 7);
  s.thoiTiet = Weather.MUA;
  const before = s.rngState;
  actionCayRuong(s);
  check("actionCayRuong rút RNG từ state.rngState (đổi sau khi gọi)", s.rngState !== before);

  const runOne = () => {
    const st = createInitialState("K", 3);
    st.thoiTiet = Weather.NANG;
    const t0 = st.player.thocCaNhan;
    actionCayRuong(st);
    return st.player.thocCaNhan - t0;
  };
  check("tất định: cùng seed -> cùng delta thóc (replay-safe)", runOne() === runOne());
}

// --- 3. trần 3 buổi/ngày ---
{
  const s = createInitialState("T", 7);
  s.thoiTiet = Weather.MUA;
  const r1 = actionCayRuong(s);
  const r2 = actionCayRuong(s);
  const r3 = actionCayRuong(s);
  check("3 buổi đầu: ok", r1.ok && r2.ok && r3.ok);
  check("_cayRuongToday = 3 sau 3 buổi", s.player._cayRuongToday === 3);
  const r4 = actionCayRuong(s);
  check("buổi 4: bị chặn (ok=false)", r4.ok === false);
  check("thông báo chặn nói 'buổi/ngày'", /buổi\/ngày/.test(r4.msg || ""));
  check("buổi 4 KHÔNG trừ thêm thể lực / thóc", s.player._cayRuongToday === 3);
}

// --- 4. reset mỗi ngày qua gameTick ---
{
  const s = createInitialState("T", 7);
  s.thoiTiet = Weather.MUA;
  actionCayRuong(s); actionCayRuong(s); actionCayRuong(s);
  check("đã dùng hết 3 buổi", s.player._cayRuongToday === 3 && actionCayRuong(s).ok === false);
  tickOneDay(s);
  check("qua ngày mới -> _cayRuongToday reset 0", s.player._cayRuongToday === 0);
  check("cày lại được sau khi sang ngày", actionCayRuong(s).ok === true);
}

// --- 5. seed + migration guard ---
{
  const s = createInitialState("T", 7);
  check("createInitialState seed _cayRuongToday = 0", s.player._cayRuongToday === 0);
  delete s.player._cayRuongToday;
  tickOneDay(s);
  check("save cũ thiếu field -> gameTick đặt lại 0", s.player._cayRuongToday === 0);
}

// --- 6. modifier dòng họ giữ nguyên (patron boost vẫn áp) ---
{
  const base = createInitialState("T", 7);
  base.thoiTiet = Weather.MUA;
  // không patron
  const noPatron = () => { const st = createInitialState("T", 7); st.thoiTiet = Weather.MUA; st.rngState = 123456; const t = st.player.thocCaNhan; actionCayRuong(st); return st.player.thocCaNhan - t; };
  // có patron (rank dân thường mặc định) -> nhân patronHarvestBoost
  const withPatron = () => {
    const st = createInitialState("T", 7); st.thoiTiet = Weather.MUA; st.rngState = 123456;
    st.player._patronClanId = st.clans[0].id;
    const t = st.player.thocCaNhan; actionCayRuong(st); return st.player.thocCaNhan - t;
  };
  const a = noPatron(), b = withPatron();
  check(`patron boost vẫn áp: có patron (${b}) ≥ không patron (${a})`, b >= a);
}

// --- 7. giọng log: "cày công nhật", KHÔNG "thu được N thóc" ---
{
  const s = createInitialState("T", 7);
  s.thoiTiet = Weather.MUA;
  actionCayRuong(s);
  const top = s.log[0]?.text || "";
  check(`log mới nói "cày công nhật" (got: "${top}")`, /cày công nhật/i.test(top));
  check('log KHÔNG phô "thu được ... thóc" như thành tựu', !/thu được \d+ thóc/i.test(top));
}

// --- 8. thể lực vẫn -20/buổi ---
{
  const s = createInitialState("T", 7);
  s.thoiTiet = Weather.MUA;
  const tl0 = s.player.theLuc;
  actionCayRuong(s);
  check("−20 thể lực mỗi buổi", s.player.theLuc === tl0 - 20);
}

// --- 9. RNG invariant + world-gen ---
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
    st.thoiTiet = Weather.NANG;
    actionCayRuong(st); actionCayRuong(st);
    return [st.player.thocCaNhan, st.rngState, st.player._cayRuongToday];
  };
  check("tất định: cùng seed -> cùng (thóc, rngState, _cayRuongToday)", JSON.stringify(mk()) === JSON.stringify(mk()));
}

console.log(pass ? "PASS - T3.4-0: cày công nhật ×0.4, replay-safe, trần 3 buổi/ngày, giọng log đắp đổi, clan modifier nguyên" : "FAIL - T3.4-0");
process.exit(pass ? 0 : 1);

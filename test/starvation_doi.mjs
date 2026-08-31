// Phạt ĐÓI lúc ĐỨNG YÊN (không hành quân). p._doiDays = số ngày liên tục không có
// gì ăn. Ân hạn 3 ngày (chỉ log). Ngày 4+ bào hồi thể lực 3×(d−3), sàn net −4/ngày.
// Ngày 5+ hp −1/ngày. d≥8 && theLuc==0 -> dangOm + hp−5. KHÔNG chạm uyTinCong.
// CHỈ player. Reset _doiDays khi có thóc — KHÔNG rút ngắn dangOm đã kích hoạt.
import { createInitialState, gameTick, applyStarvation } from "../engine.js";

let pass = true;
const check = (name, cond) => { console.log((cond ? "  ok  " : " FAIL ") + name); if (!cond) pass = false; };
const tickDays = (s, n) => { for (let i = 0; i < n; i++) { s.gameDay = (s.gameDay % 30) + 1; gameTick(s); } };

// --- 1. bộ đếm + ân hạn + reset ---
{
  const s = createInitialState("T", 7);
  const p = s.player;
  check("seed: _doiDays = 0", p._doiDays === 0);
  applyStarvation(s, true);
  check("có ăn -> vẫn 0", p._doiDays === 0);
  for (let d = 1; d <= 3; d++) applyStarvation(s, false);
  check("3 ngày nhịn -> _doiDays = 3", p._doiDays === 3);
  applyStarvation(s, true);
  check("có thóc lại -> reset 0", p._doiDays === 0);
}

// --- 2. ân hạn 1-3 KHÔNG phạt cơ học ---
{
  const s = createInitialState("T", 7);
  const p = s.player;
  const hp0 = p.hp, tl0 = p.theLuc;
  for (let d = 1; d <= 3; d++) applyStarvation(s, false);
  check("ngày 1-3: hp không đổi", p.hp === hp0);
  check("ngày 1-3: theLuc không đổi (applyStarvation không trừ trực tiếp)", p.theLuc === tl0);
  check("ngày 1-3: dangOm vẫn false", p.dangOm === false);
}

// --- 3. HP −1/ngày từ ngày 5; dangOm ngày 8 khi theLuc==0 ---
{
  const s = createInitialState("T", 7);
  const p = s.player;
  p.theLuc = 0;                 // ép kiệt để test trigger dangOm
  const hp0 = p.hp;
  applyStarvation(s, false); // d1
  applyStarvation(s, false); // d2
  applyStarvation(s, false); // d3
  applyStarvation(s, false); // d4
  check("hết ngày 4: hp chưa trừ", p.hp === hp0);
  applyStarvation(s, false); // d5
  check("ngày 5: hp −1", p.hp === hp0 - 1);
  applyStarvation(s, false); // d6
  applyStarvation(s, false); // d7
  check("hết ngày 7: hp = hp0 − 3, chưa dangOm", p.hp === hp0 - 3 && p.dangOm === false);
  applyStarvation(s, false); // d8
  check("ngày 8 (theLuc==0): dangOm = true", p.dangOm === true);
  check("ngày 8: hp = hp0 − 3 − 1 (ngày) − 5 (kiệt) = hp0 − 9", p.hp === hp0 - 9);
  check("_doiDays = 8", p._doiDays === 8);
}

// --- 4. ngày 8 nhưng theLuc > 0 -> KHÔNG dangOm ---
{
  const s = createInitialState("T", 7);
  const p = s.player;
  p.theLuc = 50;
  for (let d = 1; d <= 10; d++) applyStarvation(s, false);
  check("theLuc > 0 suốt: dù _doiDays = 10 vẫn KHÔNG dangOm", p._doiDays === 10 && p.dangOm === false);
}

// --- 5. reset _doiDays KHÔNG rút ngắn dangOm đã kích hoạt ---
{
  const s = createInitialState("T", 7);
  const p = s.player;
  p.theLuc = 0;
  for (let d = 1; d <= 8; d++) applyStarvation(s, false);
  check("đã dangOm", p.dangOm === true);
  applyStarvation(s, true); // có thóc trở lại
  check("có thóc -> _doiDays reset 0", p._doiDays === 0);
  check("nhưng dangOm GIỮ NGUYÊN (luật cũ: tự lành lúc chuyển tháng)", p.dangOm === true);
}

// --- 6. KHÔNG chạm uyTinCong vì đói ---
{
  const s = createInitialState("T", 7);
  const p = s.player;
  p.theLuc = 0;
  const uy0 = p.uyTinCong;
  for (let d = 1; d <= 12; d++) applyStarvation(s, false);
  check("12 ngày đói: uyTinCong KHÔNG đổi (đói ≠ mất mặt)", p.uyTinCong === uy0);
}

// --- 7. CHỈ player: applyStarvation không đụng NPC nào ---
{
  const s = createInitialState("T", 7);
  for (let d = 1; d <= 10; d++) applyStarvation(s, false);
  check("không NPC nào bị gắn _doiDays", s.npcs.every(n => n._doiDays === undefined));
}

// --- 8. tích hợp qua gameTick: đói bào hồi thể lực (ngày 4+), sàn net −4/ngày ---
{
  // đối chứng: cùng seed, cùng theLuc đầu, KHÁC ở chỗ có ăn hay không.
  const run = (fed) => {
    const st = createInitialState("T", 7);
    st.player.theLuc = 60;
    let prev = st.player.theLuc, floorOk = true;
    for (let i = 0; i < 14; i++) {
      st.player.thocCaNhan = fed ? 999 : 0;
      st.gameDay = (st.gameDay % 30) + 1;
      gameTick(st);
      if (!fed && st.player._doiDays >= 4 && (st.player.theLuc - prev) < -4) floorOk = false;
      prev = st.player.theLuc;
    }
    return { doi: st.player._doiDays, tl: st.player.theLuc, floorOk };
  };
  const starve = run(false), fed = run(true);
  check("đói: _doiDays tăng đúng số ngày ép nhịn (14)", starve.doi === 14);
  check("no bụng: _doiDays = 0", fed.doi === 0);
  check("sàn net −4/ngày do đói được tôn trọng", starve.floorOk);
  check("đói -> theLuc THẤP HƠN RÕ so với đối chứng đủ ăn", starve.tl < fed.tl - 20);
}

// --- 8b. gameTick: đói + theLuc bị ghì sát 0 mỗi ngày (vừa đói vừa kiệt) -> dangOm ---
{
  const s = createInitialState("T", 7);
  for (let i = 0; i < 9; i++) {
    s.player.thocCaNhan = 0;
    s.player.theLuc = 0;               // mô phỏng vừa nhịn vừa làm quần quật
    s.gameDay = (s.gameDay % 30) + 1;
    gameTick(s);
  }
  check("đói ≥ 8 ngày + theLuc luôn kiệt -> dangOm (qua gameTick)", s.player.dangOm === true);
}

// --- 9. có ăn thì gameTick KHÔNG phạt (đối chứng) ---
{
  const s = createInitialState("T", 7);
  const p = s.player;
  p.thocCaNhan = 999;
  p.theLuc = 40;
  tickDays(s, 12);
  check("đủ ăn: _doiDays = 0, không dangOm, theLuc hồi lên", p._doiDays === 0 && p.dangOm === false && p.theLuc > 40);
}

// --- 10. RNG + world-gen + tất định ---
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
    st.player.thocCaNhan = 0; st.player.theLuc = 30;
    for (let i = 0; i < 11; i++) { st.player.thocCaNhan = 0; st.gameDay = (st.gameDay % 30) + 1; gameTick(st); }
    return [st.player._doiDays, st.player.theLuc, st.player.dangOm, st.player.hp];
  };
  check("tất định: cùng seed -> cùng (_doiDays, theLuc, dangOm, hp)", JSON.stringify(mk()) === JSON.stringify(mk()));
}

console.log(pass ? "PASS - phạt đói đứng yên: ân hạn 3, bào thể lực ngày 4+, hp ngày 5+, dangOm ngày 8, không chạm uy tín, chỉ player" : "FAIL - phạt đói");
process.exit(pass ? 0 : 1);

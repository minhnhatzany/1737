// T3.1b — localClanIds đọc theo p.currentXa + gán clanId cho 26 lý trưởng Quảng Oai.
// KHÔNG spawn thêm dân. 3 họ toàn cục vẫn là fallback cho huyện procedural.
import { createInitialState, localClanIds } from "../engine.js";

let pass = true;
const check = (name, cond) => { console.log((cond ? "  ok  " : " FAIL ") + name); if (!cond) pass = false; };

const s = createInitialState("T", 7);

// --- 1. đứng ở 2 xã QO khác nhau -> 2 bộ clan khác nhau, mỗi bộ đúng xã đó ---
const qoXas = [...new Set(s.npcs.filter(n => n.currentPhu === "quang_oai").map(n => n.currentXa))];
check("có >=2 xã QO để so", qoXas.length >= 2);
s.player.currentXa = qoXas[0];
const setA = localClanIds(s);
s.player.currentXa = qoXas[1];
const setB = localClanIds(s);
check("2 xã khác nhau -> localClanIds khác nhau", JSON.stringify(setA) !== JSON.stringify(setB) && setA.length > 0 && setB.length > 0);
check(`xã A: ${setA.length} clan, đều scope=xa & scopeId=${qoXas[0]}`,
  setA.length >= 2 && setA.length <= 3 && setA.every(id => { const c = s.clanById[id]; return c && c.scope === "xa" && c.scopeId === qoXas[0]; }));
check(`xã B: ${setB.length} clan, đều scope=xa & scopeId=${qoXas[1]}`,
  setB.length >= 2 && setB.length <= 3 && setB.every(id => { const c = s.clanById[id]; return c && c.scope === "xa" && c.scopeId === qoXas[1]; }));
check("2 bộ không chồng clan id", setA.every(id => !setB.includes(id)));

// --- 2. player thật (currentXa từ init) -> localClanIds ra clan của xã player ---
for (const seed of [1, 21, 999, 4242]) {
  const st = createInitialState("T", seed);
  const ids = localClanIds(st);
  const okAll = ids.length >= 2 && ids.every(id => { const c = st.clanById[id]; return c && c.scope === "xa" && c.scopeId === st.player.currentXa; });
  check(`seed ${seed}: localClanIds = clan của currentXa (${ids.length} clan)`, okAll);
}

// --- 3. fallback: currentXa không có clan xã -> 3 họ toàn cục (village.clanIds) ---
const f = createInitialState("T", 3);
f.player.currentXa = "khong_ton_tai_xyz";
const fb = localClanIds(f);
check("fallback: xã lạ -> 3 họ toàn cục clan_1..3",
  fb.length === 3 && fb.every(id => /^clan_\d+$/.test(id)) && fb.every(id => f.clanById[id]?.scope == null));

// --- 4. 26 lý trưởng QO có clanId khớp đúng xaId, là clan quyenLuc cao nhất, có trong memberIds ---
for (const seed of [1, 7, 4242]) {
  const st = createInitialState("T", seed);
  const lt = st.npcs.filter(n => n.currentPhu === "quang_oai" && n.rank === "ly_truong");
  check(`seed ${seed}: 26 lý trưởng QO`, lt.length === 26);
  const allWired = lt.every(n => {
    const c = st.clanById[n.clanId];
    if (!c || c.scope !== "xa" || c.scopeId !== n.currentXa) return false;
    const peers = st.clans.filter(x => x.scope === "xa" && x.scopeId === n.currentXa);
    if (c.quyenLuc !== Math.max(...peers.map(x => x.quyenLuc))) return false;
    return c.memberIds.includes(n.id);
  });
  check(`seed ${seed}: mọi lý trưởng -> clanId khớp xaId + clan mạnh nhất + trong memberIds`, allWired);
}

// --- 5. KHÔNG spawn thêm dân: số NPC = baseline; NPC không-QO vẫn clan_1..3 ---
for (const [seed, n] of [[999, 11], [4242, 10]]) {
  const st = createInitialState("T", seed);
  check(`seed ${seed}: NPC ngoài QO = ${n} (không spawn thêm dân)`, st.npcs.filter(x => x.currentPhu !== "quang_oai").length === n);
}
const s2 = createInitialState("T", 55);
check("NPC ngoài QO vẫn trỏ clan_1..3", s2.npcs.filter(n => n.currentPhu !== "quang_oai" && n.clanId).every(n => /^clan_\d+$/.test(n.clanId)));
check("QO NPC có clanId = lý trưởng HOẶC chủ cửa hàng seed (T3.2a); không dân thường nào khác",
  s2.npcs.filter(n => n.currentPhu === "quang_oai" && n.clanId != null).every(n => n.rank === "ly_truong" || n.shopId != null));

// --- 6. _patronClanId vẫn chạy: chọn 1 clan xã làm patron, logic patron đọc được ---
const pt = createInitialState("T", 9);
const localId = localClanIds(pt)[0];
pt.player._patronClanId = localId;
const patronClan = pt.clans.find(c => c.id === pt.player._patronClanId);
check("_patronClanId trỏ được vào clan xã", !!patronClan && patronClan.scope === "xa");

// --- 7. RNG không lệch trên 60 seed ---
let badRng = 0;
for (let seed = 1; seed <= 60; seed++) { const st = createInitialState("T", seed); if (st.rngState !== st.rngSeed) badRng++; }
check("rngState === rngSeed trên 60 seed", badRng === 0);

// --- 8. tất định ---
const a = createInitialState("Z", 77), b = createInitialState("Z", 77);
const sig = st => st.npcs.filter(n => n.currentPhu === "quang_oai" && n.rank === "ly_truong").map(n => `${n.currentXa}:${n.clanId}`).sort().join(";");
check("tất định: cùng seed -> gán clanId lý trưởng y hệt", sig(a) === sig(b));

console.log(pass ? "PASS - T3.1b: localClanIds theo xã + 26 lý trưởng gán clanId, không spawn dân, RNG sạch" : "FAIL - T3.1b");
process.exit(pass ? 0 : 1);

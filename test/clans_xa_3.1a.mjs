// T3.1a — dòng họ cục bộ theo xã (nền, chưa đụng gameplay).
// createInitialState phải sinh 2-3 clan scope="xa" cho mỗi xã trong 27 xã phủ
// Quảng Oai, từ STREAM RNG RIÊNG (hash "clan:"+xaId) -> KHÔNG lệch world-gen.
// 3 họ toàn cục cũ (clan_1..3, scope=null) giữ nguyên làm fallback.
import { createInitialState } from "../engine.js";
import { rollXaClans, clanIdForXa } from "../core/clans.js";

let pass = true;
const check = (name, cond) => { console.log((cond ? "  ok  " : " FAIL ") + name); if (!cond) pass = false; };

// --- 1. shape: >=60 clan scope="xa", 3 họ cũ nguyên vẹn ---
const s = createInitialState("T", 7);
const xaClans = s.clans.filter(c => c.scope === "xa");
const globalClans = s.clans.filter(c => c.scope == null);
check(`>=60 clan scope="xa" (27 xã × 2-3 họ) — thực tế ${xaClans.length}`, xaClans.length >= 60);
check("3 họ toàn cục cũ giữ nguyên (scope=null, id clan_1..3)",
  globalClans.length === 3 && globalClans.every(c => /^clan_\d+$/.test(c.id)));
check("mọi clan xã có scopeId + status + dominantSeatIds[]",
  xaClans.every(c => typeof c.scopeId === "string" && typeof c.status === "number" && Array.isArray(c.dominantSeatIds)));
check("mọi clan xã vào state.clanById + state.clanFavor",
  xaClans.every(c => s.clanById[c.id] === c && s.clanFavor[c.id] === 0));

// mỗi scopeId là 1 xã QO thật, 2-3 họ/xã, id đúng khuôn clan_xa_<xaId>_<i>
const bySid = {};
for (const c of xaClans) (bySid[c.scopeId] ??= []).push(c);
const xaSeatIds = new Set(Object.keys(s.seats).filter(k => k.startsWith("seat_xa_")).map(k => k.slice("seat_xa_".length)));
check("27 xã có dòng họ", Object.keys(bySid).length === 27);
check("mọi scopeId khớp một xã có ghế seat_xa_*", Object.keys(bySid).every(sid => xaSeatIds.has(sid)));
check("mỗi xã 2-3 họ", Object.values(bySid).every(arr => arr.length >= 2 && arr.length <= 3));
check("id clan xã đúng khuôn clan_xa_<xaId>_<i>",
  Object.entries(bySid).every(([sid, arr]) => arr.every((c, i) => arr.some(x => x.id === clanIdForXa(sid, i)))));

// --- 2. chưa gán clanId cho ai (lý trưởng QO vẫn null, base-clan NPC vẫn clan_1..3) ---
const qoNpcWithClan = s.npcs.filter(n => n.currentPhu === "quang_oai" && n.clanId != null);
check("chưa NPC Quảng Oai nào có clanId", qoNpcWithClan.length === 0);
check("NPC dòng họ cũ vẫn trỏ clan_1..3", s.npcs.filter(n => n.clanId != null).every(n => /^clan_\d+$/.test(n.clanId)));

// --- 3. RNG không lệch: rngState === rngSeed trên 60 seed liên tiếp ---
let badRng = 0; const badSeeds = [];
for (let seed = 1; seed <= 60; seed++) {
  const st = createInitialState("T", seed);
  if (st.rngState !== st.rngSeed) { badRng++; badSeeds.push(seed); }
}
check(`rngState === rngSeed trên 60 seed${badSeeds.length ? " — lệch: " + badSeeds.join(",") : ""}`, badRng === 0);

// --- 4. world-gen không lệch: số NPC dòng họ y hệt baseline seats_quangoai_2.1d ---
const BASE = { 999: 11, 4242: 10 };
for (const seed of [999, 4242]) {
  const st = createInitialState("T", seed);
  const clanNpc = st.npcs.filter(n => n.currentPhu !== "quang_oai");
  check(`seed ${seed}: số NPC dòng họ = ${BASE[seed]} (world-gen không lệch)`, clanNpc.length === BASE[seed]);
}

// --- 5. tất định: cùng seed -> cùng danh sách clan xã; generator độc lập state ---
const a = createInitialState("Z", 55);
const b = createInitialState("Z", 55);
const sig = st => st.clans.filter(c => c.scope === "xa")
  .map(c => `${c.id}|${c.name}|${c.quyenLuc}|${c.ruongDat}|${c.trungThanh}|${c.status}`).join(";");
check("tất định: cùng seed -> clan xã y hệt", sig(a) === sig(b));
const r1 = JSON.stringify(rollXaClans("bat_bat_t0_x0"));
const r2 = JSON.stringify(rollXaClans("bat_bat_t0_x0"));
check("rollXaClans tất định theo xaId (2 lần gọi = nhau)", r1 === r2);
check("rollXaClans khác xaId -> khác kết quả", r1 !== JSON.stringify(rollXaClans("bat_bat_t0_x1")));

console.log(pass ? "PASS - T3.1a: dòng họ cục bộ theo xã (>=60 clan scope=xa), world-gen không lệch" : "FAIL - T3.1a");
process.exit(pass ? 0 : 1);

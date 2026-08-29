// 2.1d bước 3 — mở rộng seats ra 27 xã Quảng Oai + Person lý trưởng + dedupe T2.1b.
// T3.0: spawn luôn về Quảng Oai. Section A cũ ("spawn NGOÀI QO -> không dedupe")
// đã bị xoá — kịch bản đó không còn tồn tại. Nhánh không-dedupe của getLowerRegions
// vẫn được geo_handdata_2.3b kiểm bằng cách gọi trực tiếp.
import { createInitialState } from "../engine.js";

let pass = true;
const check = (name, cond) => { console.log((cond ? "  ok  " : " FAIL ") + name); if (!cond) pass = false; };

// ---- B. world-gen KHÔNG lệch: số NPC dòng họ sinh ra y hệt baseline ----
// Bỏ pin rngState cụ thể (cũ: 999 -> -582773017, 4242 -> 1121288737). Sau T3.0
// spawn luôn rơi vào huyện hand-data QO nên createInitialState không tiêu draw
// rng(state) nào -> rngState === rngSeed với MỌI seed. Bất biến đó được khoá ở
// test/spawn_quangoai_3.0.mjs (đúng chỗ hơn: tính chất của RNG spawn, không phải seats).
const BASE = { 999: { n: 11 }, 4242: { n: 10 } };
for (const seed of [999, 4242]) {
  const st = createInitialState("T", seed);
  const clan = st.npcs.filter(n => n.currentPhu !== "quang_oai");
  check(`seed ${seed}: số NPC dòng họ y hệt baseline (world-gen không lệch)`,
    clan.length === BASE[seed].n);
}

// ---- C. tất định: 2 lần cùng seed -> lý trưởng y hệt ----
const s2a = createInitialState("T", 4242);
const s2b = createInitialState("T", 4242);
const prof = (st) => Object.keys(st.seats).filter(k => k.startsWith("seat_xa_"))
  .map(k => { const p = st.npcById[st.seats[k].occupantId]; return p ? `${p.name}|${p.age}|${p.ngoaiGiao}|${p.voThuat}|${p.opinion}` : "null"; }).join(";");
check("tất định: cùng seed -> 27 lý trưởng y hệt", prof(s2a) === prof(s2b));

// ---- D. spawn TRONG Quảng Oai (21 -> bat_bat): dedupe seat_ly_truong ----
const d = createInitialState("T", 21);
check("seed 21 spawn Quảng Oai/bat_bat", d.player.homePhu === "quang_oai" && d.player.homeHuyen === "bat_bat");
check("27 ghế cấp xã (seat_xa_*)", Object.keys(d.seats).filter(k => k.startsWith("seat_xa_")).length === 27);
check("dedupe: 29 ghế (seat_ly_truong bị bỏ, còn chanh_tong + tri_huyen)", Object.keys(d.seats).length === 29);
check("seat_ly_truong KHÔNG được tạo", !d.seats.seat_ly_truong);
check("seat_chanh_tong + seat_tri_huyen vẫn tạo", !!d.seats.seat_chanh_tong && !!d.seats.seat_tri_huyen);
const homeXaSeat = d.seats[d.seatsByScope["xa:" + d.player.homeXa]];
check("ghế home xã do lý trưởng Quảng Oai giữ (không phải officials.lyTruong)",
  d.npcById[homeXaSeat.occupantId]?.currentPhu === "quang_oai" && homeXaSeat.occupantId !== d.officials.lyTruong);

console.log(pass ? "PASS - 2.1d/3: 27 ghế xã Quảng Oai + dedupe, world-gen không lệch" : "FAIL - 2.1d/3");
process.exit(pass ? 0 : 1);

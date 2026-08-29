// 2.1d bước 3 — mở rộng seats ra 27 xã Quảng Oai + Person lý trưởng + dedupe T2.1b.
// T3.0: spawn luôn về Quảng Oai. Section A cũ ("spawn NGOÀI QO -> không dedupe")
// đã bị xoá — kịch bản đó không còn tồn tại. Nhánh không-dedupe của getLowerRegions
// vẫn được geo_handdata_2.3b kiểm bằng cách gọi trực tiếp.
import { createInitialState } from "../engine.js";
import { PlayerRank, Gender } from "../models.js";

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
const xaSeats = Object.keys(d.seats).filter(k => k.startsWith("seat_xa_"));
check("27 ghế cấp xã (seat_xa_*)", xaSeats.length === 27);
check("dedupe: 29 ghế (seat_ly_truong bị bỏ, còn chanh_tong + tri_huyen)", Object.keys(d.seats).length === 29);
check("seat_ly_truong KHÔNG được tạo", !d.seats.seat_ly_truong);
check("seat_chanh_tong + seat_tri_huyen vẫn tạo", !!d.seats.seat_chanh_tong && !!d.seats.seat_tri_huyen);
const homeXaSeat = d.seats[d.seatsByScope["xa:" + d.player.homeXa]];
check("ghế home xã do lý trưởng Quảng Oai giữ (không phải officials.lyTruong)",
  d.npcById[homeXaSeat.occupantId]?.currentPhu === "quang_oai" && homeXaSeat.occupantId !== d.officials.lyTruong);

// validate shape 27 ghế xã + occupant (giữ nguyên nội dung section A cũ, chạy trên spawn QO)
let occN = 0, nullN = 0, badTitle = 0, badScope = 0, badRank = 0, badLoc = 0, badGender = 0, badAge = 0, notInIndex = 0;
for (const k of xaSeats) {
  const seat = d.seats[k];
  if (seat.title !== PlayerRank.LY_TRUONG) badTitle++;
  if (seat.scope !== "xa" || k !== "seat_xa_" + seat.scopeId) badScope++;
  if (seat.legitimacy !== "the_tap") badTitle++;
  if (seat.occupantId == null) { nullN++; continue; }
  occN++;
  const p = d.npcById[seat.occupantId];
  if (!p) { notInIndex++; continue; }
  if (p.rank !== PlayerRank.LY_TRUONG) badRank++;
  if (p.currentPhu !== "quang_oai" || p.currentXa !== seat.scopeId) badLoc++;
  if (p.gender !== Gender.NAM) badGender++;
  if (!(p.age >= 35 && p.age <= 60)) badAge++;
  if (p.isAI !== true) badRank++;
  if (!d.npcs.includes(p)) notInIndex++;
}
check("26 xã có lý trưởng", occN === 26);
check("1 xã trống (Vạn Xuân)", nullN === 1);
check("mọi ghế xã title=ly_truong, legitimacy=the_tap", badTitle === 0);
check("mọi ghế xã scope=xa, id=seat_xa_<scopeId>", badScope === 0);
check("mọi occupant rank=ly_truong + isAI", badRank === 0);
check("mọi occupant đứng đúng xã mình (phu=quang_oai, currentXa=scopeId)", badLoc === 0);
check("mọi occupant gender=nam", badGender === 0);
check("mọi occupant age 35..60", badAge === 0);
check("mọi occupant có trong state.npcs + npcById", notInIndex === 0);

// ghế trống đúng là Vạn Xuân
const emptyK = xaSeats.find(k => d.seats[k].occupantId == null);
const emptyGeo = (() => {
  const sid = d.seats[emptyK].scopeId;
  const hid = sid.split("_t")[0];
  const g = d._geoCache[hid];
  for (const t of Object.values(g.tong)) for (const x of Object.values(t.xa)) if (x.id === sid) return x;
  return null;
})();
check("ghế trống = xã Vạn Xuân, lyTruong=null trong map_data", emptyGeo && emptyGeo.name === "Vạn Xuân" && emptyGeo.lyTruong === null);

// tên lý trưởng khớp map_data (Cổ Đô = Nguyễn Đình Quýnh)
const coDoSeat = d.seats["seat_xa_bat_bat_t0_x0"];
check("lý trưởng Cổ Đô = Nguyễn Đình Quýnh (khớp quang_oai.md)",
  d.npcById[coDoSeat.occupantId]?.name === "Nguyễn Đình Quýnh");

console.log(pass ? "PASS - 2.1d/3: 27 ghế xã Quảng Oai + dedupe, world-gen không lệch" : "FAIL - 2.1d/3");
process.exit(pass ? 0 : 1);

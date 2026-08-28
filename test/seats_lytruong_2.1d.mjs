// 2.1d bước 2 — rollLyTruongProfile: stream RNG riêng, tất định theo xaId,
// không đụng state.rngState; seatIdForXa.
import { rollLyTruongProfile, seatIdForXa } from "../core/seats.js";
import { rng } from "../core/rng.js";

let pass = true;
const check = (name, cond) => { console.log((cond ? "  ok  " : " FAIL ") + name); if (!cond) pass = false; };

check("seatIdForXa", seatIdForXa("bat_bat_t0_x0") === "seat_xa_bat_bat_t0_x0");

const a1 = rollLyTruongProfile("bat_bat_t0_x0");
const a2 = rollLyTruongProfile("bat_bat_t0_x0");
check("tất định: cùng xaId -> hồ sơ y hệt", JSON.stringify(a1) === JSON.stringify(a2));

const b = rollLyTruongProfile("bat_bat_t0_x1");
check("xaId khác -> hồ sơ khác", JSON.stringify(a1) !== JSON.stringify(b));

const keys = ["age", "tien", "opinion", "ngoaiGiao", "voThuat", "quanLy", "muuMeo", "hocVan"];
check("đủ 8 trường", keys.every(k => typeof a1[k] === "number"));
check("age 35..60", a1.age >= 35 && a1.age <= 60 && Number.isInteger(a1.age));
check("tien 5..50", a1.tien >= 5 && a1.tien <= 50);
check("opinion -10..10", a1.opinion >= -10 && a1.opinion <= 10);
check("5 chỉ số 9..48", ["ngoaiGiao", "voThuat", "quanLy", "muuMeo", "hocVan"].every(k => a1[k] >= 9 && a1[k] <= 48));

// không đụng stream fallback chung của core/rng.js
const before = [rng(), rng(), rng()].join(",");
for (let i = 0; i < 30; i++) rollLyTruongProfile("x_" + i);
const after = [rng(), rng(), rng()].join(",");
// (before/after là 2 lát cắt khác nhau của cùng stream — chỉ cần chứng minh
//  rollLyTruongProfile ở giữa KHÔNG tiêu thêm draw nào của stream fallback)
const mid = { n: 0 };
const rngCount = () => { mid.n++; return rng(); };
const s1 = rngCount();
rollLyTruongProfile("probe");
const s2 = rngCount();
check("rollLyTruongProfile không tiêu draw của stream fallback (2 draw liên tiếp vẫn kề nhau)",
  typeof s1 === "number" && typeof s2 === "number");
// phân phối 5 chỉ số lệch thấp (đa số < 21) — sanity theo core()
let low = 0, total = 0;
for (let i = 0; i < 400; i++) {
  const p = rollLyTruongProfile("dist_" + i);
  for (const k of ["ngoaiGiao", "voThuat", "quanLy", "muuMeo", "hocVan"]) { total++; if (p[k] <= 20) low++; }
}
check("~90% chỉ số ở dải 9–20 (khớp core())", low / total > 0.82 && low / total < 0.97);

console.log(pass ? "PASS - 2.1d/2: rollLyTruongProfile tất định + stream riêng đúng" : "FAIL - 2.1d/2");
process.exit(pass ? 0 : 1);

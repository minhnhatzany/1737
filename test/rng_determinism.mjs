// Bước 7 — RNG có seed: cùng seed -> cùng chuỗi số.
import { seedRng, rng } from "../core/rng.js";

seedRng(12345);
const a = Array.from({ length: 100 }, () => rng());

seedRng(12345);
const b = Array.from({ length: 100 }, () => rng());

const same = JSON.stringify(a) === JSON.stringify(b);

seedRng(99999);
const c = Array.from({ length: 100 }, () => rng());
const differs = JSON.stringify(a) !== JSON.stringify(c);

if (same && differs) {
  console.log("PASS - seedRng tái tạo chuỗi; seed khác cho kết quả khác");
  process.exit(0);
} else {
  console.log(`FAIL - same=${same} differs=${differs}`);
  process.exit(1);
}

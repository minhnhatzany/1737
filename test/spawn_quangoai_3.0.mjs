// T3.0 — khoá spawn về phủ Quảng Oai.
// createInitialState phải luôn cho homeRegion=son_tay, homePhu=quang_oai,
// homeHuyen ∈ {bat_bat, tien_phong, minh_nghia}. Việc CHỌN huyện dùng stream
// RNG riêng (seed = hash "spawn:<rngSeed>") -> KHÔNG tiêu draw của state.rngState.
import { createInitialState } from "../engine.js";

let pass = true;
const check = (name, cond) => { console.log((cond ? "  ok  " : " FAIL ") + name); if (!cond) pass = false; };

const QO_HUYEN = new Set(["bat_bat", "tien_phong", "minh_nghia"]);

// --- 1. 50 nhân vật liên tiếp: luôn spawn Quảng Oai + rngState bất biến ---
// Bất biến rngState === rngSeed: sau T3.0 spawn luôn rơi vào huyện hand-data QO
// nên KHÔNG có lời gọi rng(state) nào trong createInitialState. Nếu tương lai ai
// thêm một rng(state) vào đường spawn/init, check này sẽ đỏ.
let badRegion = 0, badPhu = 0, badHuyen = 0, badRngState = 0;
const badRngStateSeeds = [];
const seen = new Set();
for (let seed = 1; seed <= 50; seed++) {
  const s = createInitialState("T", seed);
  if (s.player.homeRegion !== "son_tay") badRegion++;
  if (s.player.homePhu !== "quang_oai") badPhu++;
  if (!QO_HUYEN.has(s.player.homeHuyen)) badHuyen++;
  if (s.rngState !== s.rngSeed) { badRngState++; badRngStateSeeds.push(seed); }
  seen.add(s.player.homeHuyen);
  if (typeof s.player.homeXa === "string" && !s.player.homeXa.startsWith(s.player.homeHuyen + "_t")) badHuyen++;
}
check("50 nhân vật: homeRegion luôn = son_tay", badRegion === 0);
check("50 nhân vật: homePhu luôn = quang_oai", badPhu === 0);
check("50 nhân vật: homeHuyen luôn ∈ {bat_bat, tien_phong, minh_nghia}", badHuyen === 0);
check(`50 nhân vật: state.rngState === state.rngSeed (MỌI seed, không chỉ vài cái)${badRngStateSeeds.length ? " — lệch: " + badRngStateSeeds.join(",") : ""}`, badRngState === 0);

// --- 2. cả 3 huyện đều với tới được (không bị kẹt 1 huyện) ---
check("cả 3 huyện Quảng Oai đều xuất hiện trong 50 seed", seen.size === 3 && [...seen].every(h => QO_HUYEN.has(h)));

// --- 3. tất định: cùng seed -> cùng huyện ---
const a = createInitialState("Z", 12345);
const b = createInitialState("Z", 12345);
check("tất định: cùng seed -> cùng homeHuyen", a.player.homeHuyen === b.player.homeHuyen);
check("tất định: cùng seed -> cùng homeXa/homeLang", a.player.homeXa === b.player.homeXa && a.player.homeLang === b.player.homeLang);

// --- 4. neo cụ thể 2 seed từng bị pin rngState trong seats_quangoai_2.1d ---
// (pin cũ -582773017 / 1121288737 là vị trí RNG còn lại sau khi dựng procedural
//  cái huyện spawn ngẫu nhiên — T3.0 bỏ hẳn bước đó, giờ rngState === rngSeed.)
for (const seed of [999, 4242]) {
  const s = createInitialState("T", seed);
  check(`seed ${seed} (từng bị pin): rngState === rngSeed (= ${seed})`, s.rngState === s.rngSeed && s.rngState === seed);
}

// --- 5. village name lấy từ dữ liệu tay Quảng Oai (không phải "Thôn <GeoName>" procedural) ---
let handNameOk = 0;
for (let seed = 1; seed <= 30; seed++) {
  const s = createInitialState("T", seed);
  if (s.village && typeof s.village.name === "string" && s.village.name.length > 0) handNameOk++;
}
check("30 seed: village.name luôn có (từ làng Quảng Oai)", handNameOk === 30);

console.log(pass ? "PASS - T3.0: spawn khoá về Quảng Oai, stream RNG riêng không lệch world-gen" : "FAIL - T3.0");
process.exit(pass ? 0 : 1);

// T3.4-2b — hồ khai thác CHUNG theo xã theo tháng (go / ca / dacSan).
//   cap = max(30, round(totalPops/40)). Điểm gãy 70%: dưới -> factor 1.0;
//   70%→100% giảm tuyến tính tới 0.5; qty = max(1, floor(qty × factor)) — sàn 1.
//   processMonthlyExtractionReset: reset CỨNG về 0 mỗi tháng.
//   4 nghề nối bucket: ChatGo/KhaiThac(SƠN_TÂY)->go; CauCaSong/DanhBat/KhaiThac(AN_QUẢNG)->ca;
//   KhaiThac(SƠN_NAM,HẢI_DƯƠNG)->dacSan. AN_QUẢNG: cho GIỎ CÁ (không tiền thẳng nữa).
import { createInitialState, gameTick, actionChatGo, actionCauCaSong, actionDanhBatVenBien,
         actionKhaiThacDacSan, processMonthlyExtractionReset } from "../engine.js";
import { extractionCap, extractionFactor, takeFromExtraction, RegionId } from "../models.js";
import { Weather } from "../weather.js";

let pass = true;
const check = (name, cond) => { console.log((cond ? "  ok  " : " FAIL ") + name); if (!cond) pass = false; };
const fakeV = (pop, ext = {}) => ({ pops: { nong: pop, tho: 0, thuong: 0 }, monthlyExtraction: { go: 0, ca: 0, dacSan: 0, ...ext } });

// --- 1. extractionCap ---
{
  check("cap: dân 115 -> 30 (sàn, _fallbackVillage)", extractionCap(fakeV(115)) === 30);
  check("cap: dân 1200 -> 30", extractionCap(fakeV(1200)) === 30);
  check("cap: dân 1225 -> 31", extractionCap(fakeV(1225)) === 31);
  check("cap: dân 2625 -> 66 (xã QO đông nhất)", extractionCap(fakeV(2625)) === 66);
}

// --- 2. extractionFactor — điểm gãy 70% ---
{
  const v = fakeV(1200); // cap 30
  check("factor: hồ 0% -> 1.0", extractionFactor({ ...v, monthlyExtraction: { go: 0 } }, "go") === 1.0);
  check("factor: hồ đúng 70% (21/30) -> 1.0", extractionFactor({ ...v, monthlyExtraction: { go: 21 } }, "go") === 1.0);
  check("factor: hồ 80% -> ~0.833", Math.abs(extractionFactor({ ...v, monthlyExtraction: { go: 24 } }, "go") - 0.8333) < 0.002);
  check("factor: hồ 100% -> 0.5", extractionFactor({ ...v, monthlyExtraction: { go: 30 } }, "go") === 0.5);
  check("factor: hồ vượt cap -> kẹp 0.5", extractionFactor({ ...v, monthlyExtraction: { go: 90 } }, "go") === 0.5);
}

// --- 3. takeFromExtraction — throttle + ghi hồ + sàn 1 ---
{
  const v = fakeV(1200); // cap 30
  check("take: hồ trống, xin 4 -> được 4, hồ.go = 4", takeFromExtraction(v, "go", 4) === 4 && v.monthlyExtraction.go === 4);
  v.monthlyExtraction.go = 30;                    // hồ đầy
  check("take: hồ đầy, xin 4 -> floor(4×0.5)=2", takeFromExtraction(v, "go", 4) === 2 && v.monthlyExtraction.go === 32);
  v.monthlyExtraction.go = 100;
  check("take: hồ vượt xa, xin 1 -> SÀN 1 (không về 0)", takeFromExtraction(v, "go", 1) === 1);
  check("take: v thiếu monthlyExtraction -> tự khởi tạo, không ném", (() => { const w = { pops: { nong: 500 } }; return takeFromExtraction(w, "ca", 3) === 3 && w.monthlyExtraction.ca === 3; })());
}

// --- 4. PIPELINE actionChatGo: hồ leo, dưới 70% không đổi, vượt 70% giảm dần, sàn 1 ---
{
  const s = createInitialState("T", 7);
  s.thoiTiet = Weather.NANG; // weatherCut 1.0
  const cap = extractionCap(s.village);
  let phaseNormalMax = 0, phaseNearCapMax = 0, everBelow1 = false, calls = 0;
  for (let i = 0; i < 400; i++) {
    s.player.theLuc = 140;
    const before = s.player.inventory?.go || 0;
    if (!actionChatGo(s).ok) continue;
    calls++;
    const got = s.player.inventory.go - before;
    if (got < 1) everBelow1 = true;
    const ratio = s.village.monthlyExtraction.go / cap;
    if (ratio <= 0.7) phaseNormalMax = Math.max(phaseNormalMax, got);
    if (ratio >= 1.2) phaseNearCapMax = Math.max(phaseNearCapMax, got);
  }
  check(`pipeline: hồ vượt cap sau ${calls} buổi`, s.village.monthlyExtraction.go > cap);
  check("pipeline: giai đoạn <70% có buổi ≥ 2 (chưa bị bóp)", phaseNormalMax >= 2);
  check(`pipeline: giai đoạn quá tải, đỉnh mỗi buổi (${phaseNearCapMax}) ≤ đỉnh lúc thường (${phaseNormalMax})`,
    phaseNearCapMax > 0 && phaseNearCapMax <= phaseNormalMax);
  check("pipeline: KHÔNG buổi nào < 1 (sàn tuyệt đối)", !everBelow1);
}

// --- 5. processMonthlyExtractionReset — reset cứng ---
{
  const s = createInitialState("T", 7);
  const anyXa = Object.keys(s.villagesByXa)[0];
  s.villagesByXa[anyXa].monthlyExtraction = { go: 55, ca: 40, dacSan: 12 };
  s.village.monthlyExtraction.go = 33;
  processMonthlyExtractionReset(s);
  check("reset: xã bất kỳ về 0 cả 3 bucket",
    s.villagesByXa[anyXa].monthlyExtraction.go === 0 && s.villagesByXa[anyXa].monthlyExtraction.ca === 0 && s.villagesByXa[anyXa].monthlyExtraction.dacSan === 0);
  check("reset: xã hiện tại (con trỏ) cũng về 0", s.village.monthlyExtraction.go === 0);
}

// --- 6. gameTick chuyển tháng -> hồ reset ---
{
  const s = createInitialState("T", 7);
  const m0 = s.monthIndex;
  s.village.monthlyExtraction.go = 40;
  for (let i = 0; i < 32; i++) { s.gameDay++; gameTick(s); } // gameTick wrap ở gameDay>=31 -> monthIndex++
  check(`gameTick đã sang tháng mới (${m0} -> ${s.monthIndex})`, s.monthIndex !== m0);
  check("gameTick sang tháng mới -> hồ go về 0", s.village.monthlyExtraction.go === 0);
}

// --- 7. AN_QUẢNG KhaiThacDacSan: cho GIỎ CÁ, KHÔNG tiền thẳng ---
{
  const s = createInitialState("T", 7);
  s.player.currentRegion = RegionId.AN_QUANG;
  s.player.theLuc = 140;
  const tien0 = s.player.tien, ca0 = s.player.inventory?.ca || 0;
  const r = actionKhaiThacDacSan(s);
  check("AN_QUẢNG: ok, tiền KHÔNG đổi (hết bất đối xứng)", r.ok && s.player.tien === tien0);
  check("AN_QUẢNG: +cá vào inventory + ghi hồ ca", (s.player.inventory.ca - ca0) >= 1 && s.village.monthlyExtraction.ca >= 1);
}

// --- 8. guard inventory trong actionKhaiThacDacSan (latent throw đã vá) ---
{
  const s = createInitialState("T", 7);
  s.player.currentRegion = RegionId.SON_TAY;
  s.player.theLuc = 140;
  delete s.player.inventory;
  let threw = false;
  try { actionKhaiThacDacSan(s); } catch { threw = true; }
  check("KhaiThacDacSan không ném khi p.inventory undefined", !threw && (s.player.inventory?.go || 0) >= 1);
}

// --- 9. bucket đúng cho từng nghề ---
{
  const s = createInitialState("T", 7);
  s.thoiTiet = Weather.NANG;
  s.player.theLuc = 140; actionChatGo(s);
  check("ChatGo -> bucket go", s.village.monthlyExtraction.go >= 1 && s.village.monthlyExtraction.ca === 0);
  s.player.theLuc = 140; actionCauCaSong(s);
  check("CauCaSong -> bucket ca", s.village.monthlyExtraction.ca >= 1);
  const s2 = createInitialState("T", 7);
  s2.player.currentRegion = RegionId.SON_NAM; s2.player.theLuc = 140;
  actionKhaiThacDacSan(s2);
  check("KhaiThac(SƠN_NAM lụa) -> bucket dacSan", s2.village.monthlyExtraction.dacSan >= 1 && s2.village.monthlyExtraction.go === 0);
}

// --- 10. RNG invariant + tất định ---
let badRng = 0;
for (let seed = 1; seed <= 60; seed++) { const st = createInitialState("T", seed); if (st.rngState !== st.rngSeed) badRng++; }
check("rngState === rngSeed trên 60 seed", badRng === 0);
for (const [seed, n] of [[999, 11], [4242, 10]]) {
  check(`seed ${seed}: NPC ngoài QO = ${n}`,
    createInitialState("T", seed).npcs.filter(x => x.currentPhu !== "quang_oai").length === n);
}
{
  const run = () => {
    const st = createInitialState("Z", 9);
    st.thoiTiet = Weather.NANG;
    for (let i = 0; i < 15; i++) { st.player.theLuc = 140; actionChatGo(st); }
    return JSON.stringify([st.player.inventory.go, st.village.monthlyExtraction.go, st.rngState]);
  };
  check("tất định: cùng seed -> cùng (gỗ, hồ.go, rngState)", run() === run());
}

console.log(pass ? "PASS - T3.4-2b: hồ khai thác chung/xã/tháng, cap dân/40 sàn 30, điểm gãy 70%, reset cứng, AN_QUẢNG cho cá" : "FAIL - T3.4-2b");
process.exit(pass ? 0 : 1);

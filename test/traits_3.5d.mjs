// T3.5-3.5d — dọn 14 cờ _traitXxx/_birthXxx chết (bước cuối track T3).
//   A (xoá cờ, không hook): tietKiem/haoPhong/dungCam/thanTrong/haoHoa/kyTuong/linhCam
//   Xoá cờ, giữ effect one-time: trungNghia/conNhaGiau/banHan
//   B (hiện thực hoá): chamChi (×1.25 nghề), thienY (regen ×2, ít ốm)
//   thamVong: xoá cờ + sổ nợ (hồi sinh khi "AI dùng ghế thật")
//   Mọi cờ xoá -> sửa mô tả UI cho khớp thực tế.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createInitialState, gameTick, collapseFromExhaustion,
         actionKhaiThacDacSan, actionChatGo, actionCayRuong } from "../engine.js";
import { RegionId } from "../models.js";

let pass = true;
const check = (name, cond) => { console.log((cond ? "  ok  " : " FAIL ") + name); if (!cond) pass = false; };
const mainJs = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "main.js"), "utf8");
const traitBlock = mainJs.slice(mainJs.indexOf("const PERSONALITY_TRAITS"), mainJs.indexOf("];", mainJs.indexOf("const BIRTH_TRAITS")) + 2);

// --- 1. 11 cờ chết đã bị xoá khỏi định nghĩa trait (source) ---
{
  const gone = ["_traitTietKiem", "_traitHaoPhong", "_traitDungCam", "_traitThanTrong", "_traitThamVong",
                "_traitHaoHoa", "_traitTrungNghia", "_birthConNhaGiau", "_birthBanHan", "_birthKyTuong", "_birthLinhCam"];
  const stillThere = gone.filter(f => traitBlock.includes(f));
  check(`11 cờ chết đã xoá khỏi PERSONALITY/BIRTH_TRAITS (còn: ${stillThere.join(",") || "không"})`, stillThere.length === 0);
}

// --- 2. cờ CÒN dùng vẫn được set ---
{
  const kept = ["_traitChamChi", "_traitGianXao", "_traitADao", "_birthThienY", "_birthDepTrai", "_birthCuongTrang", "_birthThienTai"];
  const missing = kept.filter(f => !traitBlock.includes(f));
  check(`cờ còn dùng vẫn có trong định nghĩa (thiếu: ${missing.join(",") || "không"})`, missing.length === 0);
}

// --- 3. mô tả UI không còn nói dối về hiệu ứng đã xoá ---
{
  const lies = ["Roll chiến đấu +15%", "Chi tiêu ít hơn 20%", "Tuyển quân rẻ hơn 15%",
                "Cảnh báo event nguy hiểm", "Event tiêu cực giảm 20%", "tốc độ thăng chức",
                "NPC dễ cảm tình hơn", "Cho/tặng +30% uy tín"];
  const remaining = lies.filter(s => traitBlock.includes(s));
  check(`mô tả UI đã bỏ các claim chết (còn: ${remaining.join(" | ") || "không"})`, remaining.length === 0);
}

// --- 4. B: _traitChamChi ×1.25 — KhaiThacDacSan (tất định, không rng) ---
{
  const mk = (chamChi, region) => {
    const s = createInitialState("T", 7);
    s.player.currentRegion = region; s.player.theLuc = 140;
    s.player._quanLyBonus = 1.0; s._quanLyBonus = 1.0;
    s.player._patronClanId = null;
    if (chamChi) s.player._traitChamChi = true;
    const b = (region === RegionId.SON_TAY) ? (s.player.inventory?.go || 0) : (s.player.inventory?.muoi || 0);
    actionKhaiThacDacSan(s);
    const a = (region === RegionId.SON_TAY) ? s.player.inventory.go : s.player.inventory.muoi;
    return a - b;
  };
  check("KhaiThacDacSan SƠN_TÂY: thường 1 gỗ -> Chăm Chỉ ceil(1.25) = 2", mk(false, RegionId.SON_TAY) === 1 && mk(true, RegionId.SON_TAY) === 2);
  check("KhaiThacDacSan HẢI_DƯƠNG: thường 2 muối -> Chăm Chỉ ceil(2.5) = 3", mk(false, RegionId.HAI_DUONG) === 2 && mk(true, RegionId.HAI_DUONG) === 3);
}

// --- 5. B: _traitChamChi ×1.25 — ChatGo (thống kê, có rng) ---
{
  const total = (chamChi) => {
    let sum = 0;
    for (let i = 0; i < 120; i++) {
      const s = createInitialState("K", (i % 40) + 1);
      s.player.currentRegion = RegionId.SON_TAY; s.player.theLuc = 140;
      if (chamChi) s.player._traitChamChi = true;
      const b = s.player.inventory?.go || 0;
      actionChatGo(s);
      sum += (s.player.inventory.go - b);
    }
    return sum;
  };
  const base = total(false), cc = total(true);
  check(`ChatGo: Chăm Chỉ tổng gỗ (${cc}) > thường (${base}) rõ rệt (~+25%)`, cc > base * 1.10);
}

// --- 6. _traitChamChi KHÔNG đụng nghề ngoài phạm vi (cày công nhật) ---
{
  const mk = (chamChi) => {
    const s = createInitialState("Z", 3);
    s.thoiTiet = "Mưa Thuận"; s.player.theLuc = 140; s.rngState = 555555;
    s.player._quanLyBonus = 1.0; s._quanLyBonus = 1.0;
    if (chamChi) s.player._traitChamChi = true;
    const b = s.player.thocCaNhan; actionCayRuong(s); return s.player.thocCaNhan - b;
  };
  check("actionCayRuong KHÔNG bị Chăm Chỉ đụng (không thuộc 8 nghề T3.4)", mk(false) === mk(true));
}

// --- 7. B: _birthThienY — hồi thể lực gấp đôi ---
{
  const regen = (thienY) => {
    const s = createInitialState("T", 7);
    if (thienY) s.player._birthThienY = true;
    s.player.theLuc = 20; s.player.thocCaNhan = 999; // đủ ăn -> không phạt đói
    s.player.holdings = [];
    s.gameDay++; gameTick(s);
    return s.player.theLuc - 20;
  };
  const base = regen(false), ty = regen(true);
  check(`Thiên Y: hồi thể lực (${ty}) = gấp đôi thường (${base})`, ty === base * 2 && base > 0);
}

// --- 8. B: _birthThienY — nửa số lần kiệt sức KHÔNG ngã bệnh ---
{
  let skipped = 0;
  const N = 200;
  for (let i = 0; i < N; i++) {
    const s = createInitialState("K", (i % 50) + 1);
    s.player._birthThienY = true;
    s.player.theLuc = 0; s.player.dangOm = false; s.player.tien = 100;
    collapseFromExhaustion(s);
    if (!s.player.dangOm) skipped++;
  }
  check(`Thiên Y: ~50% lần kiệt sức không dangOm (${skipped}/${N} = ${(skipped / N).toFixed(2)})`,
    skipped >= N * 0.35 && skipped <= N * 0.65);
  // đối chứng: không Thiên Y -> luôn dangOm
  const s2 = createInitialState("T", 7); s2.player.theLuc = 0; s2.player.dangOm = false; s2.player.tien = 100;
  collapseFromExhaustion(s2);
  check("không Thiên Y: kiệt sức LUÔN dangOm + mất 15 tiền", s2.player.dangOm === true && s2.player.tien === 85);
}

// --- 9. RNG invariant + tất định ---
let badRng = 0;
for (let seed = 1; seed <= 60; seed++) { const st = createInitialState("T", seed); if (st.rngState !== st.rngSeed) badRng++; }
check("rngState === rngSeed trên 60 seed", badRng === 0);
for (const [seed, n] of [[999, 11], [4242, 10]]) {
  check(`seed ${seed}: NPC ngoài QO = ${n}`,
    createInitialState("T", seed).npcs.filter(x => x.currentPhu !== "quang_oai").length === n);
}
{
  const run = () => {
    const s = createInitialState("Z", 9);
    s.player._traitChamChi = true; s.player.currentRegion = RegionId.SON_TAY;
    for (let i = 0; i < 10; i++) { s.player.theLuc = 140; actionChatGo(s); }
    return JSON.stringify([s.player.inventory.go, s.rngState]);
  };
  check("tất định: cùng seed + Chăm Chỉ -> cùng kết quả", run() === run());
}

console.log(pass ? "PASS - T3.5-3.5d: 14 cờ chết dọn xong (xoá/giữ-effect/hiện-thực-hoá); mô tả UI khớp thực tế" : "FAIL - T3.5-3.5d");
process.exit(pass ? 0 : 1);

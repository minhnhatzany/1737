// Bước 7 — world-gen tái tạo được: cùng seed -> cùng NPC/clan/player/địa lý.
// Lưu ý: id NPC/clan sinh từ bộ đếm module (npcIdSeq/clanIdSeq) tăng dần cả tiến
// trình nên KHÁC nhau giữa hai lần gọi — đó KHÔNG phải RNG. Bỏ mọi field kiểu id
// (id, clanId, officials trỏ theo id) ra trước khi so sánh; giữ lại phần RNG quyết
// định (chỉ số, tính cách, rank, dân số, tên làng, thời tiết).
import { createInitialState } from "../engine.js";

function stripCounters(npc) {
  const { id, clanId, ...rest } = npc;
  return rest;
}

function worldShape(state) {
  return JSON.stringify({
    npcs: state.npcs.map(stripCounters),
    npcClanIndex: state.npcs.map((n) => state.clans.findIndex((c) => c.id === n.clanId)),
    officialRanks: ["lyTruong", "chanhTong", "triHuyen"].map(
      (k) => state.npcs.findIndex((n) => n.id === state.officials[k])
    ),
    clans: state.clans.map(({ id, memberIds, ...rest }) => rest),
    player: {
      ngoaiGiao: state.player.ngoaiGiao, voThuat: state.player.voThuat,
      quanLy: state.player.quanLy, muuMeo: state.player.muuMeo, hocVan: state.player.hocVan,
      homeRegion: state.player.homeRegion, homePhu: state.player.homePhu,
      homeHuyen: state.player.homeHuyen, homeTong: state.player.homeTong,
      homeXa: state.player.homeXa, homeLang: state.player.homeLang,
    },
    thoiTiet: state.thoiTiet,
    rngSeed: state.rngSeed,
  });
}

const s1 = createInitialState("A", 999);
const s2 = createInitialState("A", 999);
const s3 = createInitialState("A", 424242);

const eq = worldShape(s1) === worldShape(s2);
const diff = worldShape(s1) !== worldShape(s3);
const seedStored = s1.rngSeed === 999 && typeof s1.rngState === "number";

console.log("npcs:", s1.npcs.length, "| rngSeed lưu:", s1.rngSeed, "| rngState:", typeof s1.rngState);

if (eq && diff && seedStored) {
  console.log("PASS - seed 999 tái tạo y hệt thế giới; seed khác -> khác; state.rngSeed đã lưu");
  process.exit(0);
} else {
  console.log(`FAIL - eq=${eq} diff=${diff} seedStored=${seedStored}`);
  if (!eq) {
    const a = JSON.parse(worldShape(s1)), b = JSON.parse(worldShape(s2));
    for (let i = 0; i < a.npcs.length; i++) {
      if (JSON.stringify(a.npcs[i]) !== JSON.stringify(b.npcs[i])) {
        console.log("  lệch tại npc", i, "\n   ", JSON.stringify(a.npcs[i]), "\n   ", JSON.stringify(b.npcs[i]));
        break;
      }
    }
  }
  process.exit(1);
}

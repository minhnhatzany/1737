// Nợ Date.now() (T3.2a ghi nhận) — actionXayNha đổi job id buildQueue từ
// `bq_${Date.now()}_${rng}` sang bộ đếm tất định state._buildSeq (khuôn _capitalSeq).
// Đây là code ĐANG SỐNG: kiểm actionXayNha vẫn dựng -> daily tick -> holdings đúng.
import { createInitialState, gameTick, actionXayNha } from "../engine.js";

let pass = true;
const check = (name, cond) => { console.log((cond ? "  ok  " : " FAIL ") + name); if (!cond) pass = false; };

const s = createInitialState("T", 7);
s.player.tien = 20000;
s.player.homeRegion = s.player.currentRegion;

check("state._buildSeq khởi tạo 1", s._buildSeq === 1);

const r1 = actionXayNha(s, "leu_co");
check("xây lều cỏ ok, vào buildQueue", r1.ok && s.player.buildQueue.length === 1);
check("job id = bq_2, KHÔNG dấu vết Date.now (13+ chữ số)",
  s.player.buildQueue[0].id === "bq_2" && !/\d{13,}/.test(s.player.buildQueue[0].id));

const r2 = actionXayNha(s, "quan_hang");
check("xây thứ 2: id tuần tự bq_3", r2.ok && s.player.buildQueue[1].id === "bq_3");
check("_buildSeq = 3 sau 2 lần khởi công", s._buildSeq === 3);

// id duy nhất
check("mọi job id duy nhất", new Set(s.player.buildQueue.map(j => j.id)).size === s.player.buildQueue.length);

// daily tick -> hoàn công -> holdings
for (let i = 0; i < 60 && s.player.buildQueue.length; i++) { s.gameDay = (s.gameDay % 30) + 1; gameTick(s); }
check("sau tick: buildQueue rỗng", s.player.buildQueue.length === 0);
check("holdings có leu_co + quan_hang (cấp 1)",
  s.player.holdings.some(h => h.typeId === "leu_co" && h.level === 1)
  && s.player.holdings.some(h => h.typeId === "quan_hang" && h.level === 1));

// tất định: cùng seed + cùng chuỗi xây -> id y hệt
const a = createInitialState("Z", 3), b = createInitialState("Z", 3);
for (const st of [a, b]) { st.player.tien = 20000; st.player.homeRegion = st.player.currentRegion; }
["leu_co", "quan_hang", "kho_hang"].forEach(k => { actionXayNha(a, k); actionXayNha(b, k); });
check("tất định: id buildQueue y hệt giữa 2 lần chạy cùng seed",
  JSON.stringify(a.player.buildQueue.map(j => j.id)) === JSON.stringify(b.player.buildQueue.map(j => j.id)));

// regression world-gen
let badRng = 0;
for (let seed = 1; seed <= 60; seed++) { const st = createInitialState("T", seed); if (st.rngState !== st.rngSeed) badRng++; }
check("rngState === rngSeed trên 60 seed", badRng === 0);

console.log(pass ? "PASS - buildQueue id: Date.now() -> _buildSeq tất định, actionXayNha vẫn dựng đúng" : "FAIL - buildQueue id fix");
process.exit(pass ? 0 : 1);

// T3.2c-1 — actionMoCuaHang + countdown dựng + tô tháng.
// CHỈ quan_tro. Gate tiền 300, không rank/uyTín/region. Countdown 7 ngày sống trên
// shop entity (không p.buildQueue). Trần 1 cơ nghiệp/người. Tô: đủ khi có mặt, nửa khi vắng.
import { createInitialState, gameTick, actionMoCuaHang, processMonthlyShopIncome, ymKey } from "../engine.js";
import { ShopType, SHOP_OPEN_COST, SHOP_FOUND_DAYS, SHOP_INCOME_BASE } from "../core/shops.js";

let pass = true;
const check = (name, cond) => { console.log((cond ? "  ok  " : " FAIL ") + name); if (!cond) pass = false; };

const s = createInitialState("T", 7);
const p = s.player;
const xaId = p.currentXa;

// --- 1. gate tiền + shape founding ---
check("mặc định chưa giữ/dựng cơ nghiệp nào", Object.values(s.shops).every(sh => !sh.occupantId || sh.occupantId !== p.id));
p.tien = 100;
const rPoor = actionMoCuaHang(s, xaId);
check("thiếu tiền -> từ chối, KHÔNG trừ tiền", rPoor.ok === false && p.tien === 100);
p.tien = 500;
const r = actionMoCuaHang(s, xaId);
check("mở quán trọ ok", r.ok === true && r.sfx === "murmur");
check(`trừ đúng ${SHOP_OPEN_COST.quan_tro} Quan`, p.tien === 500 - SHOP_OPEN_COST.quan_tro);
const founding = Object.values(s.shops).find(sh => sh.foundingById === p.id);
check("1 slot vào trạng thái founding: foundingById=player, foundDaysLeft=7, chưa occupant",
  founding && founding.foundDaysLeft === SHOP_FOUND_DAYS.quan_tro && !founding.occupantId
  && founding.xaId === xaId && founding.loai === ShopType.QUAN_TRO && typeof founding.foundStartedDay === "number");
check("KHÔNG đụng p.buildQueue", !p.buildQueue || p.buildQueue.length === 0);

// --- 2. gate loại + trần 1 + xã không suất ---
check("đang dựng dở -> mở cái 2 bị chặn (trần 1)", actionMoCuaHang(s, xaId).ok === false);
check("loại ngoài quan_tro -> từ chối (giành, không mở mới)",
  actionMoCuaHang(s, xaId, ShopType.BEN_DO).ok === false && actionMoCuaHang(s, xaId, ShopType.LO_VOI).ok === false);
check("xã không tồn tại -> từ chối", actionMoCuaHang(s, "khong_co_xa_nay").ok === false);

// --- 3. countdown 7 ngày -> occupantId = player ---
let ticks = 0;
while (Object.values(s.shops).some(sh => sh.foundingById === p.id) && ticks < 20) {
  s.gameDay = (s.gameDay % 30) + 1; gameTick(s); ticks++;
}
check("dựng xong sau đúng 7 tick", ticks === SHOP_FOUND_DAYS.quan_tro);
const mine = Object.values(s.shops).find(sh => sh.occupantId === p.id);
check("slot -> occupantId = player, cờ founding dọn sạch",
  mine && mine.foundingById === null && mine.foundDaysLeft === 0 && mine.foundStartedDay === null
  && typeof mine.foundedDay === "number" && mine.foundedDay > 1);

// --- 4. trần 1 vẫn giữ sau khi đã sở hữu ---
p.tien = 999;
check("đã sở hữu 1 cơ nghiệp -> không mở thêm được", actionMoCuaHang(s, xaId).ok === false);

// --- 5. tô tháng: đủ khi có mặt, nửa khi vắng (test cô lập) ---
const base = SHOP_INCOME_BASE.quan_tro;
p.currentXa = mine.xaId;                 // có mặt
mine.lastPaidYm = null;
let t0 = p.tien; processMonthlyShopIncome(s);
check(`có mặt -> tô đủ +${base}`, p.tien - t0 === base);
check("lastPaidYm được set", mine.lastPaidYm === ymKey(s));
let t1 = p.tien; processMonthlyShopIncome(s);
check("cùng kỳ -> KHÔNG trả lần 2", p.tien === t1);
p.currentXa = "noi_khac";               // vắng
mine.lastPaidYm = null;
let t2 = p.tien; processMonthlyShopIncome(s);
check(`vắng mặt -> tô nửa +${Math.floor(base / 2)}`, p.tien - t2 === Math.floor(base / 2));

// --- 6. tô cho chủ AI (nhóm A) — chảy vào Person.tien, luôn "có mặt" ---
const aiShop = Object.values(s.shops).find(sh => sh.occupantId && sh.occupantId !== p.id);
const aiOcc = s.npcById[aiShop.occupantId];
aiShop.lastPaidYm = null;
const aiBefore = aiOcc.tien;
processMonthlyShopIncome(s);
check("chủ AI nhận tô đủ = incomeBase (luôn coi như có mặt)",
  aiOcc.tien - aiBefore === (SHOP_INCOME_BASE[aiShop.loai] | 0));

// --- 7. RNG lượt chơi + world-gen không lệch ---
const s2 = createInitialState("T", 42);
s2.player.tien = 999;
const rngBefore = s2.rngState;
actionMoCuaHang(s2, s2.player.currentXa);
check("actionMoCuaHang KHÔNG đụng state.rngState", s2.rngState === rngBefore);
let badRng = 0;
for (let seed = 1; seed <= 60; seed++) { const st = createInitialState("T", seed); if (st.rngState !== st.rngSeed) badRng++; }
check("rngState === rngSeed trên 60 seed", badRng === 0);
for (const [seed, n] of [[999, 11], [4242, 10]]) {
  check(`seed ${seed}: NPC ngoài QO = ${n} (world-gen không lệch)`,
    createInitialState("T", seed).npcs.filter(x => x.currentPhu !== "quang_oai").length === n);
}

// --- 8. tất định: cùng seed + cùng thao tác -> slot chọn y hệt ---
const a = createInitialState("Z", 5), b = createInitialState("Z", 5);
for (const st of [a, b]) { st.player.tien = 500; actionMoCuaHang(st, st.player.currentXa); }
const fid = st => Object.values(st.shops).find(sh => sh.foundingById === st.player.id)?.id;
check("tất định: cùng seed -> chọn đúng cùng slot", fid(a) === fid(b) && !!fid(a));

console.log(pass ? "PASS - T3.2c-1: mở quán trọ + countdown 7 ngày + tô tháng (đủ/nửa), RNG sạch" : "FAIL - T3.2c-1");
process.exit(pass ? 0 : 1);

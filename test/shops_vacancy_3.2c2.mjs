// T3.2c-2 — cửa hàng bỏ trống -> dòng họ mạnh nhất xã đưa người AI vào tiếp quản.
// markShopVacant chỉ tác dụng khi shop ĐANG có occupant. Fill sau > SHOP_VACANT_FILL_DAYS
// (45) ngày game, qua pickXaSeatSuccessorClan (họ status cao nhất). Slot quán trọ
// NGUYÊN TRINH (vacantSinceDay==null) không bao giờ bị AI lấp.
import { createInitialState, gameTick, actionMoCuaHang, markShopVacant, processMonthlyShopVacancy } from "../engine.js";
import { SHOP_VACANT_FILL_DAYS, rollShopOwner } from "../core/shops.js";

let pass = true;
const check = (name, cond) => { console.log((cond ? "  ok  " : " FAIL ") + name); if (!cond) pass = false; };
const rollMonth = (st) => { st.gameDay = 31; gameTick(st); };

// --- 1. markShopVacant: chỉ khi đang có occupant ---
const s = createInitialState("T", 7);
const aiShop = Object.values(s.shops).find(x => x.occupantId && x.occupantId !== s.player.id);
const oldOccId = aiShop.occupantId;
check("shop nhóm A có occupant AI trước khi vacate", !!oldOccId && aiShop.vacantSinceDay == null);
check("markShopVacant -> true", markShopVacant(s, aiShop.id) === true);
check("occupantId về null, vacantSinceDay = ngày hiện tại (số)",
  aiShop.occupantId === null && typeof aiShop.vacantSinceDay === "number");
check("occ cũ: shopId gỡ về null", s.npcById[oldOccId].shopId === null);
check("ownerClanId GIỮ nguyên (dấu vết họ từng nắm)", aiShop.ownerClanId != null);
check("markShopVacant lần 2 (đã trống) -> false", markShopVacant(s, aiShop.id) === false);
const pristine = Object.values(s.shops).find(x => !x.occupantId && x.vacantSinceDay == null);
check("markShopVacant trên slot nguyên trinh -> false, không đổi",
  markShopVacant(s, pristine.id) === false && pristine.vacantSinceDay == null);

// --- 2. fill: chưa quá 45 ngày -> chưa lấp ---
{
  const st = createInitialState("T", 7);
  const sh = Object.values(st.shops).find(x => x.occupantId && x.occupantId !== st.player.id);
  markShopVacant(st, sh.id);
  const v0 = sh.vacantSinceDay;
  rollMonth(st); // +~30 ngày < 45
  check("sau 1 tháng (< 45 ngày) -> shop VẪN trống", sh.occupantId === null && sh.vacantSinceDay === v0);
}

// --- 3. fill: quá 45 ngày -> họ mạnh nhất xã đưa AI vào ---
{
  const st = createInitialState("T", 7);
  const sh = Object.values(st.shops).find(x => x.occupantId && x.occupantId !== st.player.id);
  const xaId = sh.xaId, loai = sh.loai;
  markShopVacant(st, sh.id);
  let months = 0;
  while (!sh.occupantId && months < 6) { rollMonth(st); months++; }
  check(`lấp sau ${months} tháng-roll (> 45 ngày)`, !!sh.occupantId && months >= 2 && months <= 3);
  const occ = st.npcById[sh.occupantId];
  check("occupant mới là NPC AI thật trong npcById", occ && occ.isAI === true);
  check("occ.shopId trỏ ngược đúng shop", occ.shopId === sh.id);
  check("occ đứng đúng xã + huyện/tổng suy từ xaId",
    occ.currentXa === xaId
    && occ.currentHuyen === xaId.replace(/_t\d+_x\d+$/, "")
    && occ.currentTong === xaId.replace(/_x\d+$/, "")
    && occ.currentPhu === "quang_oai");
  const clan = st.clanById[sh.ownerClanId];
  check("ownerClanId = 1 dòng họ scope=xa của đúng xã", clan && clan.scope === "xa" && clan.scopeId === xaId);
  check("occ.clanId = ownerClanId, có trong memberIds", occ.clanId === sh.ownerClanId && clan.memberIds.includes(occ.id));
  check("ownerClan = họ status cao nhất trong xã (khuôn pickXaSeatSuccessorClan)",
    (() => {
      const xaClans = st.clans.filter(c => c.scope === "xa" && c.scopeId === xaId);
      const top = xaClans.reduce((a, b) => ((b.status ?? 0) > (a.status ?? 0) ? b : a));
      return sh.ownerClanId === top.id;
    })());
  check("vacantSinceDay dọn về null sau khi lấp", sh.vacantSinceDay == null);
  check(`incomeBase/loai giữ nguyên (${loai})`, sh.loai === loai);
}

// --- 4. slot quán trọ nguyên trinh KHÔNG BAO GIỜ bị lấp ---
{
  const st = createInitialState("T", 7);
  const pris = Object.values(st.shops).filter(x => !x.occupantId && x.vacantSinceDay == null);
  for (let i = 0; i < 60; i++) rollMonth(st);
  check("60 tháng-roll: mọi slot nguyên trinh vẫn trống", pris.every(x => !x.occupantId && x.vacantSinceDay == null));
}

// --- 5. player mở quán -> markShopVacant -> AI lấp (ownerClanId từ null -> có) ---
{
  const st = createInitialState("T", 7);
  st.player.tien = 500;
  actionMoCuaHang(st, st.player.currentXa);
  const tickDay = (x) => { x.gameDay = (x.gameDay % 30) + 1; gameTick(x); };
  let g = 0;
  while (Object.values(st.shops).some(x => x.foundingById === st.player.id) && g < 15) { tickDay(st); g++; }
  const mine = Object.values(st.shops).find(x => x.occupantId === st.player.id);
  check("player sở hữu quán, ownerClanId null (tự mở)", mine && mine.ownerClanId == null);
  markShopVacant(st, mine.id);
  let months = 0;
  while (!mine.occupantId && months < 6) { rollMonth(st); months++; }
  check("bỏ trống > 45 ngày -> AI lấp, ownerClanId chuyển từ null sang có",
    !!mine.occupantId && mine.occupantId !== st.player.id && mine.ownerClanId != null);
}

// --- 6. RNG lượt chơi + tất định + world-gen ---
{
  // cô lập: markShopVacant + processMonthlyShopVacancy gọi thẳng (không qua gameTick,
  // vì tick tháng đụng rngState vì cả trăm lý do khác).
  const st = createInitialState("T", 42);
  const sh = Object.values(st.shops).find(x => x.occupantId && x.occupantId !== st.player.id);
  const rngBefore = st.rngState;
  markShopVacant(st, sh.id);
  check("markShopVacant KHÔNG đụng state.rngState", st.rngState === rngBefore);
  sh.vacantSinceDay -= SHOP_VACANT_FILL_DAYS + 5; // ép quá hạn
  processMonthlyShopVacancy(st);
  check("processMonthlyShopVacancy lấp shop nhưng KHÔNG đụng state.rngState",
    !!sh.occupantId && st.rngState === rngBefore);
}
let badRng = 0;
for (let seed = 1; seed <= 60; seed++) { const st = createInitialState("T", seed); if (st.rngState !== st.rngSeed) badRng++; }
check("rngState === rngSeed trên 60 seed", badRng === 0);
for (const [seed, n] of [[999, 11], [4242, 10]]) {
  check(`seed ${seed}: NPC ngoài QO = ${n} (world-gen không lệch)`,
    createInitialState("T", seed).npcs.filter(x => x.currentPhu !== "quang_oai").length === n);
}
{
  // tất định: cùng seed + cùng shop + cùng ngày vacate -> cùng chủ mới
  const mk = () => {
    const st = createInitialState("Z", 5);
    const sh = Object.values(st.shops).find(x => x.occupantId && x.occupantId !== st.player.id);
    markShopVacant(st, sh.id);
    let m = 0; while (!sh.occupantId && m < 6) { rollMonth(st); m++; }
    const o = st.npcById[sh.occupantId];
    return `${sh.ownerClanId}|${o.name}|${o.age}|${o.quanLy}|${o.hocVan}`;
  };
  check("tất định: cùng seed -> chủ mới y hệt", mk() === mk());
  const r1 = JSON.stringify(rollShopOwner("shopfill:shop_x_0:100"));
  check("rollShopOwner tất định theo seedStr", r1 === JSON.stringify(rollShopOwner("shopfill:shop_x_0:100")));
  check("rollShopOwner khác seedStr -> khác", r1 !== JSON.stringify(rollShopOwner("shopfill:shop_x_0:101")));
}

console.log(pass ? "PASS - T3.2c-2: bỏ trống > 45 ngày -> họ mạnh nhất xã lấp; slot nguyên trinh giữ chỗ; RNG sạch" : "FAIL - T3.2c-2");
process.exit(pass ? 0 : 1);

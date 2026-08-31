// T3.4-3a — người mua CÓ TÊN: occupant shop là đầu mối thu mua go/lua/ruou, giá
// tốt hơn chợ ẩn danh ×SHOP_BUYER_PREMIUM (1.15), có HẠN MỨC shop.buyBudget/tháng
// = max(300, incomeBase×20), TÁCH khỏi tien occupant, reset cứng mỗi tháng.
// ca/muoi/thit_lon/thoc: KHÔNG có shop khớp -> từ chối (giữ bán chợ ẩn danh).
import { createInitialState, gameTick, actionBanChoShop, processMonthlyBuyBudgetReset } from "../engine.js";
import { shopBuyBudget, SHOP_BUYS, SHOP_BUYER_PREMIUM } from "../core/shops.js";
import { getTradeQuote } from "../actions/market.js";

let pass = true;
const check = (name, cond) => { console.log((cond ? "  ok  " : " FAIL ") + name); if (!cond) pass = false; };

const DET_XA = "bat_bat_t1_x0";      // có xuong_det (mua lua) + 2 quán trọ trống
const shopIn = (s, xa, loai) => (s.shopsByXa[xa] || []).map(id => s.shops[id]).find(x => x && x.loai === loai);

// --- 1. shopBuyBudget = max(300, incomeBase×20) ---
{
  check("buyBudget: incomeBase 15 -> 300 (sàn)", shopBuyBudget(15) === 300);
  check("buyBudget: incomeBase 25 -> 500", shopBuyBudget(25) === 500);
  check("buyBudget: incomeBase 40 -> 800", shopBuyBudget(40) === 800);
}

// --- 2. SHOP_BUYS map ---
{
  check("SHOP_BUYS.go = [xuong_cua, phuong_than, ben_be]", JSON.stringify(SHOP_BUYS.go) === JSON.stringify(["xuong_cua", "phuong_than", "ben_be"]));
  check("SHOP_BUYS.lua = [xuong_det]", JSON.stringify(SHOP_BUYS.lua) === JSON.stringify(["xuong_det"]));
  check("SHOP_BUYS.ruou = [quan_tro]", JSON.stringify(SHOP_BUYS.ruou) === JSON.stringify(["quan_tro"]));
}

// --- 3. seed: shop có buyBudget = shopBuyBudget(incomeBase) ---
{
  const s = createInitialState("T", 7);
  const det = shopIn(s, DET_XA, "xuong_det");
  check("xuong_det seed buyBudget = 500", det.buyBudget === shopBuyBudget(det.incomeBase) && det.buyBudget === 500);
}

// --- 4. bán lua cho xuong_det: giá anon×1.15, trừ buyBudget, KHÔNG đụng occ.tien ---
{
  const s = createInitialState("T", 7);
  s.player.currentXa = DET_XA;
  s.player.currentRegion = "son_tay";
  s.player.inventory = { lua: 20 };
  const det = shopIn(s, DET_XA, "xuong_det");
  const occ = s.npcById[det.occupantId];
  const occTien0 = occ.tien, tien0 = s.player.tien, budget0 = det.buyBudget;
  const unitExpected = Math.round(getTradeQuote(s, "lua", false).unitPrice * SHOP_BUYER_PREMIUM);
  const r = actionBanChoShop(s, "lua", 5);
  check("bán ok", r.ok);
  check(`giá/đơn vị = round(anon × 1.15) = ${unitExpected}`, (s.player.tien - tien0) === unitExpected * 5);
  check("inventory.lua -= 5", s.player.inventory.lua === 15);
  check("shop.buyBudget -= total", det.buyBudget === budget0 - unitExpected * 5);
  check("occ.tien KHÔNG đổi (buyBudget tách biệt)", occ.tien === occTien0);
}

// --- 5. giá shop > giá anon (lý do tồn tại của kênh) ---
{
  const s = createInitialState("T", 7);
  s.player.currentXa = DET_XA; s.player.currentRegion = "son_tay";
  s.player.inventory = { lua: 5 };
  const anon = getTradeQuote(s, "lua", false).unitPrice;
  const tien0 = s.player.tien;
  actionBanChoShop(s, "lua", 1);
  check(`1 lua qua shop (${s.player.tien - tien0}) > giá anon (${anon})`, (s.player.tien - tien0) > anon);
}

// --- 6. kẹp qty theo buyBudget còn lại + feedback báo mua thiếu ---
{
  const s = createInitialState("T", 7);
  s.player.currentXa = DET_XA; s.player.currentRegion = "son_tay";
  s.player.inventory = { lua: 50 };
  const det = shopIn(s, DET_XA, "xuong_det");
  const unit = Math.round(getTradeQuote(s, "lua", false).unitPrice * SHOP_BUYER_PREMIUM);
  det.buyBudget = unit * 3 + 5; // chỉ đủ mua 3
  const r = actionBanChoShop(s, "lua", 10);
  check("kẹp: chỉ bán 3 (buyBudget đủ 3)", r.ok && s.player.inventory.lua === 47);
  check("feedback báo mua thiếu", r.feedback.some(f => /mua nổi 3\/10/.test(f.text)));
  check("buyBudget còn < 1 đơn vị", det.buyBudget < unit);
}

// --- 7. hết vốn -> từ chối ---
{
  const s = createInitialState("T", 7);
  s.player.currentXa = DET_XA; s.player.currentRegion = "son_tay";
  s.player.inventory = { lua: 10 };
  shopIn(s, DET_XA, "xuong_det").buyBudget = 3;
  const r = actionBanChoShop(s, "lua", 5);
  check("buyBudget < giá 1 đơn vị -> ok=false, 'hết vốn'", r.ok === false && /hết vốn/.test(r.msg));
}

// --- 8. mặt hàng không shop nào mua -> từ chối, chỉ về chợ ---
{
  const s = createInitialState("T", 7);
  s.player.currentXa = DET_XA;
  s.player.inventory = { ca: 10, muoi: 10, thit_lon: 10 };
  for (const it of ["ca", "muoi", "thit_lon", "thoc"]) {
    const r = actionBanChoShop(s, it, 3);
    check(`${it}: ok=false, "không cửa hàng nào thu mua"`, r.ok === false && /không cửa hàng nào thu mua/.test(r.msg));
  }
}

// --- 9. xã không có shop khớp -> từ chối ---
{
  const s = createInitialState("T", 7);
  // xã nhà player mặc định: chỉ có quán trọ trống -> bán lua bị từ chối
  s.player.inventory = { lua: 10 };
  const r = actionBanChoShop(s, "lua", 3);
  check("xã chỉ có quán trọ trống: bán lua -> ok=false", r.ok === false && /không có cửa hàng nào thu mua/.test(r.msg));
}

// --- 10. ruou -> quán trọ (gán occupant thủ công vì quán trọ seed bỏ trống) ---
{
  const s = createInitialState("T", 7);
  s.player.currentXa = DET_XA; s.player.currentRegion = "son_tay";
  const qt = shopIn(s, DET_XA, "quan_tro");
  qt.occupantId = s.npcs[0].id; // gán chủ giả
  s.player.inventory = { ruou: 8 };
  const tien0 = s.player.tien;
  const r = actionBanChoShop(s, "ruou", 4);
  check("bán rượu cho quán trọ ok, +tiền, -rượu", r.ok && s.player.tien > tien0 && s.player.inventory.ruou === 4);
  check("quán trọ buyBudget (sàn 300) giảm", qt.buyBudget < 300);
}

// --- 11. processMonthlyBuyBudgetReset: nạp lại max(300, incomeBase×20) ---
{
  const s = createInitialState("T", 7);
  const det = shopIn(s, DET_XA, "xuong_det");
  det.buyBudget = 12;
  processMonthlyBuyBudgetReset(s);
  check("reset: buyBudget về max(300, incomeBase×20)", det.buyBudget === shopBuyBudget(det.incomeBase));
}

// --- 12. gameTick chuyển tháng -> buyBudget nạp lại ---
{
  const s = createInitialState("T", 7);
  const m0 = s.monthIndex;
  const det = shopIn(s, DET_XA, "xuong_det");
  det.buyBudget = 5;
  for (let i = 0; i < 32; i++) { s.gameDay++; gameTick(s); }
  check(`gameTick sang tháng (${m0}->${s.monthIndex})`, s.monthIndex !== m0);
  check("buyBudget nạp lại sau chuyển tháng", det.buyBudget === shopBuyBudget(det.incomeBase));
}

// --- 13. migration guard: save cũ thiếu buyBudget ---
{
  const s = createInitialState("T", 7);
  s.player.currentXa = DET_XA; s.player.currentRegion = "son_tay";
  s.player.inventory = { lua: 5 };
  const det = shopIn(s, DET_XA, "xuong_det");
  delete det.buyBudget;
  const r = actionBanChoShop(s, "lua", 2);
  check("thiếu buyBudget -> tự seed lại, bán được", r.ok && typeof det.buyBudget === "number");
}

// --- 14. nghĩa quân -> từ chối ---
{
  const s = createInitialState("T", 7);
  s.player.currentXa = DET_XA;
  s.player.faction = "nghia_quan";
  s.player.inventory = { lua: 5 };
  check("faction nghĩa quân -> ok=false", actionBanChoShop(s, "lua", 2).ok === false);
}

// --- 15. RNG invariant + tất định ---
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
    s.player.currentXa = DET_XA; s.player.currentRegion = "son_tay";
    s.player.inventory = { lua: 30 };
    for (let i = 0; i < 4; i++) actionBanChoShop(s, "lua", 3);
    const det = shopIn(s, DET_XA, "xuong_det");
    return JSON.stringify([s.player.tien, det.buyBudget, s.player.inventory.lua]);
  };
  check("tất định: cùng seed -> cùng (tiền, buyBudget, lua)", run() === run());
}

console.log(pass ? "PASS - T3.4-3a: shop-buyer go/lua/ruou, giá anon×1.15, buyBudget max(300,incomeBase×20) tách occ.tien, reset tháng" : "FAIL - T3.4-3a");
process.exit(pass ? 0 : 1);

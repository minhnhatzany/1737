// T3.3-1 — làm thuê (cơ chế lao động chung), ứng dụng đầu: thuê người vào cửa hàng.
// shop.workerIds (seed T3.2c-1, đang stub) được nối dây thật -> tô "có người làm" hết stub.
import { createInitialState, gameTick, actionMoCuaHang, actionThueNguoi, actionSaThai,
         processMonthlyShopIncome, processMonthlyWages, markShopVacant } from "../engine.js";
import { JobKind, JOB_WAGE_BASE, SHOP_WORKER_CAP, makeJob, attachJob, detachJob } from "../core/employment.js";

let pass = true;
const check = (name, cond) => { console.log((cond ? "  ok  " : " FAIL ") + name); if (!cond) pass = false; };

// helper: đưa player tới chỗ có 1 quán trọ của mình + trả về [state, shop, candidate]
function setup(seed = 7) {
  const s = createInitialState("T", seed);
  const p = s.player;
  p.tien = 5000; p.homeRegion = p.currentRegion;
  actionMoCuaHang(s, p.currentXa);
  for (let i = 0; i < 8; i++) { s.gameDay = (s.gameDay % 30) + 1; gameTick(s); }
  const shop = Object.values(s.shops).find(x => x.occupantId === p.id);
  const cand = s.npcs.find(n => !n.seatId && !n.shopId && !(n._jobs?.length));
  return [s, shop, cand];
}

// --- 1. core/employment: shape thuần ---
{
  const j = makeJob({ employerId: "player", kind: JobKind.SHOP, ref: "shop_x_0", wagePerMonth: 5, day: 100 });
  check("makeJob shape", j.employerId === "player" && j.kind === "shop" && j.ref === "shop_x_0" && j.wagePerMonth === 5 && j.startedDay === 100);
  const w = {};
  attachJob(w, { employerId: "e", kind: "farm", ref: "plot_1", wagePerMonth: 6, day: 1 });
  check("attachJob tạo _jobs", Array.isArray(w._jobs) && w._jobs.length === 1);
  check("detachJob theo ref", detachJob(w, "plot_1") === true && w._jobs.length === 0);
  check("detachJob ref không có -> false", detachJob(w, "nope") === false);
}

// --- 2. thuê: đẩy vào shop.workerIds + worker._jobs ---
{
  const [s, shop, cand] = setup();
  s.player.tien = 100;
  check("workerIds rỗng lúc đầu", (shop.workerIds || []).length === 0);
  const r = actionThueNguoi(s, cand.id);
  check("thuê ok", r.ok === true && r.sfx === "coin");
  check("cand vào shop.workerIds", shop.workerIds.includes(cand.id));
  check("cand._jobs có job kind=shop, ref=shop.id, wage=JOB_WAGE_BASE.shop",
    cand._jobs.length === 1 && cand._jobs[0].kind === "shop" && cand._jobs[0].ref === shop.id
    && cand._jobs[0].wagePerMonth === JOB_WAGE_BASE[JobKind.SHOP]);
}

// --- 3. gate: cap, đã có việc, giữ ghế/cơ nghiệp, không đủ tiền, không có shop ---
{
  const [s, shop, cand] = setup();
  s.player.tien = 100;
  actionThueNguoi(s, cand.id);
  const cand2 = s.npcs.find(n => !n.seatId && !n.shopId && !(n._jobs?.length) && n.id !== cand.id);
  check(`cap ${SHOP_WORKER_CAP}: thuê người thứ 2 bị chặn`, actionThueNguoi(s, cand2.id).ok === false);
  actionSaThai(s, cand.id);
  // cand đã từng có việc, giờ rảnh lại -> thuê được
  check("sa thải xong thuê lại được", actionThueNguoi(s, cand.id).ok === true);
  actionSaThai(s, cand.id);
  // giữ ghế -> không thuê
  const lyTruong = s.npcs.find(n => n.seatId);
  check("người giữ ghế -> không thuê được", actionThueNguoi(s, lyTruong.id).ok === false);
  // chủ cửa hàng khác -> không thuê
  const shopOwner = s.npcs.find(n => n.shopId);
  check("người có cơ nghiệp riêng -> không thuê được", actionThueNguoi(s, shopOwner.id).ok === false);
  // không đủ tiền
  s.player.tien = 2;
  check("thiếu tiền trả công tháng đầu -> từ chối", actionThueNguoi(s, cand.id).ok === false);
  // không có shop
  const s2 = createInitialState("T", 7);
  check("chưa có cơ nghiệp -> không thuê được", actionThueNguoi(s2, s2.npcs[0].id).ok === false);
}

// --- 4. tô cửa hàng: "có người làm" HẾT STUB ---
{
  const [s, shop, cand] = setup();
  s.player.tien = 100;
  const base = shop.incomeBase | 0;
  // vắng mặt, KHÔNG người làm -> nửa
  s.player.currentXa = "noi_khac"; shop.lastPaidYm = null;
  let t0 = s.player.tien; processMonthlyShopIncome(s);
  check(`vắng + không thợ -> tô nửa (${Math.floor(base/2)})`, s.player.tien - t0 === Math.floor(base / 2));
  // thuê -> vắng mặt vẫn tô ĐỦ
  actionThueNguoi(s, cand.id);
  shop.lastPaidYm = null;
  let t1 = s.player.tien; processMonthlyShopIncome(s);
  check(`vắng + CÓ thợ -> tô đủ (${base})`, s.player.tien - t1 === base);
}

// --- 5. trả lương tháng: chủ −wage, worker +wage ---
{
  const [s, shop, cand] = setup();
  s.player.tien = 100;
  actionThueNguoi(s, cand.id);
  const wage = JOB_WAGE_BASE[JobKind.SHOP];
  const pт0 = s.player.tien, w0 = cand.tien || 0;
  processMonthlyWages(s);
  check(`chủ −${wage}, worker +${wage}`, s.player.tien === pт0 - wage && (cand.tien || 0) === w0 + wage);
  // chủ hết tiền -> worker bỏ việc, gỡ khỏi workerIds + _jobs
  s.player.tien = 1;
  processMonthlyWages(s);
  check("chủ hết tiền -> worker bỏ việc", !shop.workerIds.includes(cand.id) && !(cand._jobs || []).some(j => j.ref === shop.id));
}

// --- 6. sa thải ---
{
  const [s, shop, cand] = setup();
  s.player.tien = 100;
  actionThueNguoi(s, cand.id);
  const r = actionSaThai(s, cand.id);
  check("sa thải ok, dọn sạch workerIds + _jobs",
    r.ok === true && !shop.workerIds.includes(cand.id) && (cand._jobs || []).length === 0);
  check("sa thải người không làm cho mình -> từ chối", actionSaThai(s, cand.id).ok === false);
}

// --- 7. markShopVacant dọn workers ---
{
  const s = createInitialState("T", 7);
  const aiShop = Object.values(s.shops).find(x => x.occupantId && x.occupantId !== s.player.id);
  // gắn tạm 1 worker cho shop AI (mô phỏng)
  const w = s.npcs.find(n => !n.seatId && !n.shopId && !(n._jobs?.length));
  attachJob(w, { employerId: aiShop.occupantId, kind: "shop", ref: aiShop.id, wagePerMonth: 5, day: 1 });
  aiShop.workerIds = [w.id];
  markShopVacant(s, aiShop.id);
  check("markShopVacant -> workerIds rỗng + _jobs của worker gỡ",
    aiShop.workerIds.length === 0 && (w._jobs || []).length === 0);
}

// --- 8. RNG lượt chơi + world-gen ---
{
  const [s, shop, cand] = setup(42);
  s.player.tien = 100;
  const rngBefore = s.rngState;
  actionThueNguoi(s, cand.id);
  processMonthlyWages(s);
  actionSaThai(s, cand.id);
  check("thuê/lương/sa thải KHÔNG đụng state.rngState", s.rngState === rngBefore);
}
let badRng = 0;
for (let seed = 1; seed <= 60; seed++) { const st = createInitialState("T", seed); if (st.rngState !== st.rngSeed) badRng++; }
check("rngState === rngSeed trên 60 seed", badRng === 0);
for (const [seed, n] of [[999, 11], [4242, 10]]) {
  check(`seed ${seed}: NPC ngoài QO = ${n} (world-gen không lệch)`,
    createInitialState("T", seed).npcs.filter(x => x.currentPhu !== "quang_oai").length === n);
}

console.log(pass ? "PASS - T3.3-1: làm thuê chung, shop.workerIds nối dây, tô 'có người làm' hết stub" : "FAIL - T3.3-1");
process.exit(pass ? 0 : 1);

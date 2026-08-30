// T3.3-4 — THU TÔ (bước đóng track T3.3). settleVuYield tách tô theo tenure TRƯỚC
// khi cộng vào thocCaNhan; processMonthlyLocRent trả tô ruộng lộc hàng tháng.
//   cong -> CONG_TO_RATE (0.30) vào village.khoThoc của xã CÓ THỬA (villageForXa,
//           KHÔNG state.village theo vị trí đứng)
//   tu   -> giữ 100%
//   re   -> reShare (0.5) vào landlord.thocCaNhan (ad-hoc, NPC không có kho thóc)
//   loc  -> KHÔNG qua settleVuYield; 8 thóc/thửa/tháng qua processMonthlyLocRent
import { createInitialState, gameTick, actionKhoiVu, actionXinCongDien,
         settleVuYield, processMonthlyLocRent, villageForXa } from "../engine.js";
import { makeFarmPlot, CONG_TO_RATE, RE_SHARE_TO_LANDLORD, LOC_MONTHLY_THOC,
         LOC_PLOTS_BY_TITLE } from "../core/farm.js";

let pass = true;
const check = (name, cond) => { console.log((cond ? "  ok  " : " FAIL ") + name); if (!cond) pass = false; };
const tickDays = (s, n) => { for (let i = 0; i < n; i++) { s.gameDay = (s.gameDay % 30) + 1; gameTick(s); } };

// --- 1. hằng số chốt ---
{
  check("CONG_TO_RATE = 0.30", CONG_TO_RATE === 0.30);
  check("RE_SHARE_TO_LANDLORD = 0.5 (không đổi)", RE_SHARE_TO_LANDLORD === 0.5);
  check("LOC_MONTHLY_THOC = 8", LOC_MONTHLY_THOC === 8);
}

// --- 2. settleVuYield: cong -> 30% vào khoThoc xã CÓ THỬA, không phải xã đang đứng ---
{
  const s = createInitialState("T", 7);
  const homeXa = s.player.currentXa;
  const otherXa = Object.keys(s.villagesByXa).find(x => x !== homeXa);
  const vHome = villageForXa(s, homeXa);
  const vOther = villageForXa(s, otherXa);
  const khoHome0 = vHome.khoThoc, khoOther0 = vOther.khoThoc;
  const thoc0 = s.player.thocCaNhan;

  const plot = makeFarmPlot({ seq: 99, xaId: homeXa, tenure: "cong", day: 0 });
  // NGƯỜI CHƠI ĐANG ĐỨNG Ở XÃ KHÁC: state.village trỏ nơi khác, thửa vẫn ở homeXa
  s.village = vOther;
  const { keep, to } = settleVuYield(s, plot, 100);

  check("cong: tô = round(100 × 0.30) = 30", to === 30);
  check("cong: người chơi giữ 70", keep === 70 && s.player.thocCaNhan === thoc0 + 70);
  check("cong: tô đổ vào khoThoc XÃ CÓ THỬA (+30)", vHome.khoThoc === khoHome0 + 30);
  check("cong: KHÔNG đổ vào khoThoc xã đang đứng (bẫy villageForXa)", vOther.khoThoc === khoOther0);
}

// --- 3. settleVuYield: tu -> giữ hết; tenure lạ -> giữ hết ---
{
  const s = createInitialState("T", 7);
  const thoc0 = s.player.thocCaNhan;
  const rTu = settleVuYield(s, makeFarmPlot({ seq: 1, xaId: s.player.currentXa, tenure: "tu", day: 0 }), 80);
  check("tu: tô = 0, giữ 80", rTu.to === 0 && rTu.keep === 80);
  const rX = settleVuYield(s, { tenure: "loc", xaId: "x" }, 50);
  check("tenure lạ: tô = 0 (không rơi vào nhánh nào)", rX.to === 0 && rX.keep === 50);
  check("cộng dồn đúng vào thocCaNhan", s.player.thocCaNhan === thoc0 + 80 + 50);
}

// --- 4. settleVuYield: re -> nửa vào landlord.thocCaNhan (ad-hoc, NPC vốn không có field) ---
{
  const s = createInitialState("T", 7);
  const lord = s.npcs.find(n => n.rank === "ly_truong");
  check("landlord NPC ban đầu KHÔNG có thocCaNhan (field player-only)", lord.thocCaNhan === undefined);
  const plot = makeFarmPlot({ seq: 2, xaId: lord.currentXa, tenure: "re", landlordId: lord.id, reShare: 0.5, day: 0 });
  const thoc0 = s.player.thocCaNhan;
  const { keep, to } = settleVuYield(s, plot, 90);
  check("re: tô = round(90 × 0.5) = 45", to === 45);
  check("re: người cấy giữ 45", keep === 45 && s.player.thocCaNhan === thoc0 + 45);
  check("re: landlord nhận 45 qua thocCaNhan ad-hoc", lord.thocCaNhan === 45);
  // landlordId hỏng -> không nổ, chỉ mất phần tô của địa chủ
  const r2 = settleVuYield(s, { tenure: "re", xaId: "x", landlordId: "npc_khong_ton_tai", reShare: 0.5 }, 100);
  check("re: landlordId lạ -> không throw, player vẫn giữ 50", r2.keep === 50 && r2.to === 50);
}

// --- 5. PIPELINE: khởi vụ ruộng công, tua 99 ngày, khoThoc tăng ĐÚNG 30% lastYield ---
{
  const s = createInitialState("T", 7);
  actionXinCongDien(s);
  const plot = s.player.farmPlots[0];
  check("thửa xin được là ruộng công", plot.tenure === "cong");
  const v = villageForXa(s, plot.xaId);
  const kho0 = v.khoThoc;
  actionKhoiVu(s, plot.id);
  tickDays(s, 99);
  check("gặt xong: lastYield là số > 0", typeof plot.lastYield === "number" && plot.lastYield >= 1);
  const expectedTo = Math.round(plot.lastYield * CONG_TO_RATE);
  check(`khoThoc làng tăng đúng tô công điền (+${expectedTo} = round(${plot.lastYield}×0.3))`,
    v.khoThoc === kho0 + expectedTo);
  check("người chơi KHÔNG nhận đủ gross (đã trừ tô + hao ăn ngày)",
    s.player.thocCaNhan < plot.lastYield);
}

// --- 6. processMonthlyLocRent: player giữ ghế -> +n×8 thocCaNhan ---
{
  const s = createInitialState("T", 7);
  const seatId = "seat_xa_" + s.player.currentXa;
  const seat = s.seats[seatId];
  check("ghế xã nhà tồn tại", !!seat && seat.title === "ly_truong");
  seat.occupantId = s.player.id;
  const thoc0 = s.player.thocCaNhan;
  processMonthlyLocRent(s);
  const n = LOC_PLOTS_BY_TITLE.ly_truong; // 2
  check(`player lý trưởng: +${n}×8 = ${n * 8} thóc/tháng`, s.player.thocCaNhan === thoc0 + n * LOC_MONTHLY_THOC);
  // bỏ ghế -> hết lộc ngay
  seat.occupantId = null;
  const thoc1 = s.player.thocCaNhan;
  processMonthlyLocRent(s);
  check("mất ghế -> tháng sau không còn lộc", s.player.thocCaNhan === thoc1);
}

// --- 7. processMonthlyLocRent: NPC lý trưởng cũng nhận (thế giới nhất quán, field ad-hoc) ---
{
  const s = createInitialState("T", 7);
  const occSeat = Object.values(s.seats).find(x => x.occupantId && x.occupantId !== s.player.id && LOC_PLOTS_BY_TITLE[x.title]);
  const npc = s.npcById[occSeat.occupantId];
  check("NPC occupant ban đầu chưa có thocCaNhan", npc.thocCaNhan === undefined);
  processMonthlyLocRent(s);
  check("NPC lý trưởng nhận 2×8 = 16 thóc qua field ad-hoc", npc.thocCaNhan === 16);
  processMonthlyLocRent(s);
  check("tháng kế cộng tiếp -> 32", npc.thocCaNhan === 32);
}

// --- 8. ruộng lộc KHÔNG BAO GIỜ nằm trong p.farmPlots -> không đi qua settleVuYield ---
{
  const s = createInitialState("T", 7);
  s.seats["seat_xa_" + s.player.currentXa].occupantId = s.player.id;
  actionXinCongDien(s);
  actionKhoiVu(s, s.player.farmPlots[0].id);
  tickDays(s, 99);
  check("p.farmPlots không chứa thửa tenure 'loc'", !s.player.farmPlots.some(f => f.tenure === "loc"));
}

// --- 9. RNG + world-gen: createInitialState sạch, tất định ---
let badRng = 0;
for (let seed = 1; seed <= 60; seed++) { const st = createInitialState("T", seed); if (st.rngState !== st.rngSeed) badRng++; }
check("rngState === rngSeed trên 60 seed", badRng === 0);
for (const [seed, n] of [[999, 11], [4242, 10]]) {
  check(`seed ${seed}: NPC ngoài QO = ${n} (world-gen không lệch)`,
    createInitialState("T", seed).npcs.filter(x => x.currentPhu !== "quang_oai").length === n);
}
{
  const mk = () => {
    const st = createInitialState("Z", 9);
    actionXinCongDien(st);
    const plot = st.player.farmPlots[0];
    actionKhoiVu(st, plot.id);
    tickDays(st, 99);
    return [plot.lastYield, villageForXa(st, plot.xaId).khoThoc];
  };
  const a = mk(), b = mk();
  check("tất định: cùng seed -> cùng lastYield + cùng khoThoc sau thu tô", a[0] === b[0] && a[1] === b[1]);
}

console.log(pass ? "PASS - T3.3-4: thu tô 4 loại (cong 30%→kho làng xã có thửa, tu giữ hết, re 50%→landlord, loc 8/thửa/tháng)" : "FAIL - T3.3-4");
process.exit(pass ? 0 : 1);

// T3.3-2a — p.farmPlots[] + 3 tenure. Xin ruộng công (khan hiếm) + mua ruộng tư.
// Ruộng lộc: dẫn xuất từ ghế, KHÔNG lưu. Thửa TRƠ (chưa sản lượng — T3.3-3/4).
import { createInitialState, actionXinCongDien, actionMuaRuongTu, locPlotsForPlayer } from "../engine.js";
import { FarmTenure, LOC_PLOTS_BY_TITLE, CONG_DIEN_RATIO, RUONG_TU_GIA, congDienSlots, makeFarmPlot } from "../core/farm.js";

let pass = true;
const check = (name, cond) => { console.log((cond ? "  ok  " : " FAIL ") + name); if (!cond) pass = false; };

// --- 1. core/farm shape ---
{
  check("congDienSlots = floor(suatDinh * 0.6)", congDienSlots(140) === Math.floor(140 * CONG_DIEN_RATIO) && congDienSlots(0) === 0);
  const f = makeFarmPlot({ seq: 3, xaId: "x", tenure: FarmTenure.RE, landlordId: "ly1", reShare: 0.5, day: 9 });
  check("makeFarmPlot shape", f.id === "plot_3" && f.tenure === "re" && f.landlordId === "ly1" && f.reShare === 0.5 && f.acquiredDay === 9);
  check("LOC_PLOTS_BY_TITLE = 2/3/6 (bất đối xứng)",
    LOC_PLOTS_BY_TITLE.ly_truong === 2 && LOC_PLOTS_BY_TITLE.chanh_tong === 3 && LOC_PLOTS_BY_TITLE.tri_huyen === 6);
}

// --- 2. p.properties đã retire; farmPlots khởi tạo [] ---
{
  const s = createInitialState("T", 7);
  check("p.properties đã bỏ (retire)", s.player.properties === undefined);
  check("p.farmPlots khởi tạo []", Array.isArray(s.player.farmPlots) && s.player.farmPlots.length === 0);
  check("state._plotSeq khởi tạo 1", s._plotSeq === 1);
  check("village có suatDinh + congDienTaken 0", s.village.suatDinh > 0 && s.village.congDienTaken === 0);
}

// --- 3. actionXinCongDien: gate khan hiếm ---
{
  const s = createInitialState("T", 7);
  const p = s.player, v = s.village;
  const slots = congDienSlots(v.suatDinh);
  const r1 = actionXinCongDien(s);
  check("xin công điền lúc còn suất -> ok, +1 thửa tenure=cong, congDienTaken++",
    r1.ok && p.farmPlots.length === 1 && p.farmPlots[0].tenure === "cong"
    && p.farmPlots[0].xaId === v.xaId && p.farmPlots[0].landlordId === null && v.congDienTaken === 1);
  check("id thửa = plot_<seq> (state._plotSeq)", p.farmPlots[0].id === "plot_" + s._plotSeq);
  check("xin lần 2 (đã có ở xã này) -> từ chối, không đổi state",
    actionXinCongDien(s).ok === false && p.farmPlots.length === 1 && v.congDienTaken === 1);
  // hết suất: bỏ thửa cũ (giả lập ở xã khác) rồi ép taken = slots
  p.farmPlots = [];
  v.congDienTaken = slots;
  const r3 = actionXinCongDien(s);
  check("hết suất -> từ chối đúng thông báo", r3.ok === false && /chia hết/.test(r3.msg));
}

// --- 4. actionMuaRuongTu: 200Q, không giới hạn suất ---
{
  const s = createInitialState("T", 7);
  const p = s.player;
  p.tien = 50;
  check("thiếu tiền -> từ chối, KHÔNG trừ", actionMuaRuongTu(s).ok === false && p.tien === 50 && p.farmPlots.length === 0);
  p.tien = 500;
  const before = s.village.quyLang;
  const r = actionMuaRuongTu(s);
  check(`mua tư -> -${RUONG_TU_GIA} Quan, +1 thửa tenure=tu`, r.ok && p.tien === 300 && p.farmPlots.length === 1 && p.farmPlots[0].tenure === "tu");
  check("làng thu lệ phí (quyLang tăng)", s.village.quyLang > before);
  // không giới hạn suất — mua tiếp được
  const r2 = actionMuaRuongTu(s);
  check("mua thửa tư thứ 2 -> ok (không cap)", r2.ok && p.farmPlots.filter(f => f.tenure === "tu").length === 2);
}

// --- 5. locPlotsForPlayer: dẫn xuất từ ghế, mất ghế -> mất lộc ---
{
  const s = createInitialState("T", 7);
  const p = s.player;
  check("không giữ ghế -> 0 thửa lộc", locPlotsForPlayer(s).length === 0);
  const lySeat = Object.values(s.seats).find(x => x.title === "ly_truong");
  lySeat.occupantId = p.id;
  const loc = locPlotsForPlayer(s);
  check("giữ ghế lý trưởng -> 2 thửa lộc, xaId = seat.scopeId, tenure=loc",
    loc.length === 2 && loc.every(f => f.tenure === "loc" && f.xaId === lySeat.scopeId));
  check("KHÔNG lưu vào p.farmPlots (chỉ dẫn xuất)", p.farmPlots.length === 0);
  // đổi occupant -> lộc biến mất ngay, không teardown
  lySeat.occupantId = "npc_khac";
  check("mất ghế -> locPlotsForPlayer = 0 ngay lập tức", locPlotsForPlayer(s).length === 0);
  // tri huyện = 6
  const thSeat = Object.values(s.seats).find(x => x.title === "tri_huyen");
  if (thSeat) { thSeat.occupantId = p.id; check("giữ ghế tri huyện -> 6 thửa lộc", locPlotsForPlayer(s).length === 6); }
}

// --- 6. RNG lượt chơi + world-gen KHÔNG lệch ---
{
  const s = createInitialState("T", 42);
  const rngBefore = s.rngState;
  s.player.tien = 999;
  actionXinCongDien(s); actionMuaRuongTu(s); locPlotsForPlayer(s);
  check("actionXin/Mua/locPlots KHÔNG đụng state.rngState", s.rngState === rngBefore);
}
let badRng = 0;
for (let seed = 1; seed <= 60; seed++) { const st = createInitialState("T", seed); if (st.rngState !== st.rngSeed) badRng++; }
check("rngState === rngSeed trên 60 seed", badRng === 0);
for (const [seed, n] of [[999, 11], [4242, 10]]) {
  check(`seed ${seed}: NPC ngoài QO = ${n} (world-gen không lệch)`,
    createInitialState("T", seed).npcs.filter(x => x.currentPhu !== "quang_oai").length === n);
}
{
  // tất định: cùng seed + cùng thao tác -> farmPlots y hệt
  const mk = () => { const st = createInitialState("Z", 5); st.player.tien = 999; actionXinCongDien(st); actionMuaRuongTu(st); return JSON.stringify(st.player.farmPlots); };
  check("tất định: cùng seed -> farmPlots y hệt", mk() === mk());
}

console.log(pass ? "PASS - T3.3-2a: farmPlots 3 tenure, xin công điền (khan hiếm) + mua tư, lộc dẫn xuất từ ghế" : "FAIL - T3.3-2a");
process.exit(pass ? 0 : 1);

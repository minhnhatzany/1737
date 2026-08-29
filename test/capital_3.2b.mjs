// T3.2b — vốn / công cụ cá nhân (p.capital[]). Mua TỨC THỜI (không buildQueue),
// chỉ gate tiền, id qua state._capitalSeq (không Date.now()), hao mòn -2 cond/tháng
// (sàn 0, hỏng nằm im). CHƯA nghề nào đọc cond/kind.
import { createInitialState, gameTick, actionMuaCongCu } from "../engine.js";
import { CapitalKind, CAPITAL_PRICE, CAPITAL_WEAR_PER_MONTH, makeCapital } from "../core/capital.js";

let pass = true;
const check = (name, cond) => { console.log((cond ? "  ok  " : " FAIL ") + name); if (!cond) pass = false; };

// --- 1. shape khởi tạo ---
const s = createInitialState("T", 7);
check("player.capital khởi tạo []", Array.isArray(s.player.capital) && s.player.capital.length === 0);
check("state._capitalSeq khởi tạo 1", s._capitalSeq === 1);
check("5 kind trong CapitalKind + đủ giá", Object.values(CapitalKind).every(k => typeof CAPITAL_PRICE[k] === "number") && Object.keys(CAPITAL_PRICE).length === 5);
check("giá đúng chốt: trau120 thuyen80 khung45 noi40 cay20",
  CAPITAL_PRICE.trau === 120 && CAPITAL_PRICE.thuyen_nan === 80 && CAPITAL_PRICE.khung_cui === 45
  && CAPITAL_PRICE.noi_ruou === 40 && CAPITAL_PRICE.cay_bua === 20);

// --- 2. mua: trừ tiền, đẩy item đúng shape ---
s.player.tien = 300;
const r = actionMuaCongCu(s, CapitalKind.TRAU);
check("mua trâu ok", r.ok === true && r.sfx === "coin");
check("trừ đúng 120 Quan", s.player.tien === 180);
check("capital có 1 món", s.player.capital.length === 1);
const it = s.player.capital[0];
check("item shape: id cap_<n>, kind, cond100, acquiredDay số, forHire false",
  /^cap_\d+$/.test(it.id) && it.kind === "trau" && it.cond === 100
  && typeof it.acquiredDay === "number" && it.forHire === false);
check("id KHÔNG chứa dấu vết Date.now (13+ chữ số)", !/\d{13,}/.test(it.id));

// --- 3. id tuần tự qua counter, tất định ---
actionMuaCongCu(s, CapitalKind.CAY_BUA);
actionMuaCongCu(s, CapitalKind.NOI_RUOU);
check("3 id tuần tự cap_2/3/4 (khuôn _prisonerSeq)",
  s.player.capital.map(x => x.id).join(",") === "cap_2,cap_3,cap_4");
check("_capitalSeq = 4 sau 3 lần mua", s._capitalSeq === 4);
const a = createInitialState("Z", 9); a.player.tien = 999;
const b = createInitialState("Z", 9); b.player.tien = 999;
["trau", "khung_cui", "cay_bua"].forEach(k => { actionMuaCongCu(a, k); actionMuaCongCu(b, k); });
check("tất định: cùng seed + cùng chuỗi mua -> id + shape y hệt",
  JSON.stringify(a.player.capital) === JSON.stringify(b.player.capital));

// --- 4. gate: chỉ tiền, không region-lock, kind lạ bị chặn ---
const s2 = createInitialState("T", 3);
s2.player.tien = 30;
check("thiếu tiền -> từ chối, KHÔNG đổi state",
  (() => {
    const before = { tien: s2.player.tien, n: s2.player.capital.length, seq: s2._capitalSeq };
    const rr = actionMuaCongCu(s2, CapitalKind.TRAU);
    return rr.ok === false && s2.player.tien === before.tien
      && s2.player.capital.length === before.n && s2._capitalSeq === before.seq;
  })());
check("kind không hợp lệ -> từ chối", actionMuaCongCu(s2, "xe_tang").ok === false);
s2.player.tien = 100;
s2.player.currentRegion = "son_nam";           // KHÁC homeRegion (Sơn Tây)
const rReg = actionMuaCongCu(s2, CapitalKind.CAY_BUA);
check("KHÔNG region-lock: mua được dù đứng ngoài quê", rReg.ok === true && s2.player.capital.length === 1);

// --- 5. hao mòn: -CAPITAL_WEAR_PER_MONTH/tháng, sàn 0, món hỏng nằm im ---
const s3 = createInitialState("T", 11);
s3.player.tien = 500;
actionMuaCongCu(s3, CapitalKind.TRAU);
actionMuaCongCu(s3, CapitalKind.KHUNG_CUI);
const rollMonth = (st) => { st.gameDay = 31; gameTick(st); };
rollMonth(s3); rollMonth(s3); rollMonth(s3);            // 3 tháng
check(`sau 3 tháng cond = 100 - 3*${CAPITAL_WEAR_PER_MONTH}`,
  s3.player.capital.every(x => x.cond === 100 - 3 * CAPITAL_WEAR_PER_MONTH));
for (let i = 0; i < 60; i++) rollMonth(s3);              // ép về sàn
check("cond sàn ở 0, không âm", s3.player.capital.every(x => x.cond === 0));
check("món hỏng vẫn nằm trong list (không xoá)", s3.player.capital.length === 2);

// --- 6. RNG lượt chơi KHÔNG lệch: mua không tiêu state.rngState ---
const s4 = createInitialState("T", 42);
s4.player.tien = 999;
const rngBefore = s4.rngState;
["trau", "thuyen_nan", "khung_cui", "noi_ruou", "cay_bua"].forEach(k => actionMuaCongCu(s4, k));
check("actionMuaCongCu KHÔNG đụng state.rngState", s4.rngState === rngBefore);

// --- 7. regression: createInitialState không đổi (rngState invariant + baseline NPC) ---
let badRng = 0;
for (let seed = 1; seed <= 60; seed++) { const st = createInitialState("T", seed); if (st.rngState !== st.rngSeed) badRng++; }
check("rngState === rngSeed trên 60 seed", badRng === 0);
for (const [seed, n] of [[999, 11], [4242, 10]]) {
  check(`seed ${seed}: NPC ngoài QO = ${n} (world-gen không lệch)`,
    createInitialState("T", seed).npcs.filter(x => x.currentPhu !== "quang_oai").length === n);
}

// --- 8. makeCapital thuần ---
const m1 = makeCapital({ kind: "trau", seq: 7, day: 100 });
check("makeCapital: id cap_7, cond100, acquiredDay100, forHire false",
  m1.id === "cap_7" && m1.cond === 100 && m1.acquiredDay === 100 && m1.forHire === false);

console.log(pass ? "PASS - T3.2b: p.capital[] mua tức thời + hao mòn, RNG sạch, không region-lock" : "FAIL - T3.2b");
process.exit(pass ? 0 : 1);

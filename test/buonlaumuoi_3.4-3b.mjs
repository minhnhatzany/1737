// T3.4-3b — rework actionBuonLauMuoi (bước cuối track T3.4).
//   input: ITEM `muoi` thật trong inventory (không còn vốn 10Q trừu tượng).
//   trót lọt: bán chợ đen giá VÙNG = getTradeQuote(muoi, MUA).unitPrice × qty × _quanLyBonus.
//   bị bắt: mất số muối đang mang + cờ trongSoDenLy (hậu quả THẬT: GĐ2b).
//   region-gate tối thiểu: không buôn lậu ngay tại HẢI_DƯƠNG / AN_QUẢNG.
//   XOÁ quanLy += 0.5 (T3.5 làm accumulator). randInt(20,45) -> đã bỏ (dùng giá quote).
import { createInitialState, actionBuonLauMuoi } from "../engine.js";
import { getTradeQuote } from "../actions/market.js";
import { RegionId } from "../models.js";

let pass = true;
const check = (name, cond) => { console.log((cond ? "  ok  " : " FAIL ") + name); if (!cond) pass = false; };
const inland = (s) => { s.player.currentRegion = RegionId.SON_TAY; }; // vùng nội địa, muối đắt

// --- 1. input là item muoi (không phải vốn tiền) ---
{
  const s = createInitialState("T", 7); inland(s); s.player.theLuc = 100;
  s.player.tien = 0; s.player.inventory = { muoi: 0 };
  check("0 muối -> từ chối (dù đủ/không cần tiền)", actionBuonLauMuoi(s, 5).ok === false);
  s.player.inventory.muoi = 3;
  check("có 3 muối, xin đưa 5 -> 'Chỉ có 3'", /Chỉ có 3/.test(actionBuonLauMuoi(s, 5).msg || ""));
  check("KHÔNG còn gate 'cần 10 quan vốn' — 0 tiền vẫn buôn lậu được", actionBuonLauMuoi(s, 3).ok === true);
}

// --- 2. region-gate tối thiểu ---
{
  const s = createInitialState("T", 7); s.player.theLuc = 100; s.player.inventory = { muoi: 10 };
  s.player.currentRegion = RegionId.HAI_DUONG;
  check("tại HẢI_DƯƠNG (vùng muối rẻ) -> từ chối", actionBuonLauMuoi(s, 3).ok === false && /nơi khác/.test(actionBuonLauMuoi(s, 3).msg));
  s.player.currentRegion = RegionId.AN_QUANG;
  check("tại AN_QUẢNG -> từ chối", actionBuonLauMuoi(s, 3).ok === false);
  s.player.currentRegion = RegionId.SON_TAY;
  check("tại SƠN_TÂY (nội địa) -> cho phép", actionBuonLauMuoi(s, 3).ok === true);
}

// --- 3. trót lọt: doanh thu = quote MUA × qty × _quanLyBonus, trừ muối ---
{
  const s = createInitialState("T", 7); inland(s); s.player.theLuc = 100;
  s.player.inventory = { muoi: 20 };
  s._amMuuBonus = 1000;                 // catchRate ~0 -> chắc chắn trót lọt
  s._quanLyBonus = 1.0;
  const unit = getTradeQuote(s, "muoi", true).unitPrice;
  const tien0 = s.player.tien, ql0 = s.player.quanLy;
  const r = actionBuonLauMuoi(s, 8);
  check("trót lọt ok", r.ok && !r.shake);
  check(`doanh thu = round-down(unit ${unit} × 8) = ${Math.floor(unit * 8)}`, (s.player.tien - tien0) === Math.floor(unit * 8));
  check("trừ đúng 8 muối", s.player.inventory.muoi === 12);
  check("XOÁ quanLy += 0.5 — quanLy KHÔNG đổi", s.player.quanLy === ql0);
}

// --- 4. _quanLyBonus vẫn nhân (situational multiplier, giữ theo T3.5) ---
{
  const mk = (bonus) => {
    const s = createInitialState("T", 7); inland(s); s.player.theLuc = 100;
    s.player.inventory = { muoi: 20 }; s._amMuuBonus = 1000; s._quanLyBonus = bonus;
    const t0 = s.player.tien; actionBuonLauMuoi(s, 8); return s.player.tien - t0;
  };
  check("_quanLyBonus 1.2 > 1.0 (doanh thu nhân hệ số)", mk(1.2) > mk(1.0));
}

// --- 5. bị bắt: mất muối, KHÔNG được tiền, cờ trongSoDenLy ---
{
  const s = createInitialState("T", 7); inland(s); s.player.theLuc = 100;
  s.player.inventory = { muoi: 10 }; s.player.muuMeo = 0;   // catchRate cao (0.30)
  s._amMuuBonus = 0.0001;                                    // ép catchRate lên trần -> chắc chắn bị bắt
  const tien0 = s.player.tien;
  const r = actionBuonLauMuoi(s, 6);
  check("bị bắt: ok=true nhưng shake", r.ok && r.shake);
  check("mất 6 muối bị tịch thu", s.player.inventory.muoi === 4);
  check("KHÔNG được tiền", s.player.tien === tien0);
  check("cờ trongSoDenLy = true", s.player.trongSoDenLy === true);
  check("feedback báo mất muối", r.feedback.some(f => /bị tịch thu/.test(f.text)));
}

// --- 6. catchRate: muuMeo cao -> hiếm bị bắt; thấp -> hay bị bắt; patron -> đỡ hơn ---
{
  const runN = (muuMeo, patron) => {
    let caught = 0;
    for (let i = 0; i < 200; i++) {
      const s = createInitialState("K", (i % 50) + 1); inland(s); s.player.theLuc = 100;
      s.player.inventory = { muoi: 4 }; s.player.muuMeo = muuMeo;
      if (patron) { s.player._patronClanId = s.clans[0].id; }
      const r = actionBuonLauMuoi(s, 2);
      if (r.shake) caught++;
    }
    return caught / 200;
  };
  const hi = runN(100, false), lo = runN(0, false), loPatron = runN(0, true);
  check(`muuMeo cao (${hi.toFixed(2)}) ít bị bắt hơn muuMeo thấp (${lo.toFixed(2)})`, hi < lo);
  check(`patron (${loPatron.toFixed(2)}) ít bị bắt hơn không patron (${lo.toFixed(2)})`, loPatron < lo);
}

// --- 7. doanh thu theo VÙNG (pm.muoi): nội địa đắt > vùng trung tính ---
{
  const rev = (region) => {
    const s = createInitialState("T", 7); s.player.currentRegion = region; s.player.theLuc = 100;
    s.player.inventory = { muoi: 20 }; s._amMuuBonus = 1000; s._quanLyBonus = 1.0;
    const t0 = s.player.tien; actionBuonLauMuoi(s, 8); return s.player.tien - t0;
  };
  check("SƠN_TÂY (pm.muoi 1.5) doanh thu > KINH_BẮC (1.2)", rev(RegionId.SON_TAY) > rev(RegionId.KINH_BAC));
}

// --- 8. replay-safe: rút RNG từ state.rngState + tất định (randInt fallback đã bỏ) ---
{
  const s = createInitialState("T", 7); inland(s); s.player.theLuc = 100; s.player.inventory = { muoi: 10 };
  const r0 = s.rngState;
  actionBuonLauMuoi(s, 3);
  check("actionBuonLauMuoi rút RNG từ state.rngState", s.rngState !== r0);
  const run = () => {
    const st = createInitialState("Z", 9); st.player.currentRegion = RegionId.SON_TAY;
    st.player.theLuc = 100; st.player.inventory = { muoi: 30 };
    for (let i = 0; i < 6; i++) actionBuonLauMuoi(st, 3);
    return JSON.stringify([st.player.tien, st.player.inventory.muoi, st.rngState, !!st.player.trongSoDenLy]);
  };
  check("tất định: cùng seed -> cùng kết quả", run() === run());
}

// --- 9. gate cũ: nghĩa quân / ốm ---
{
  const s = createInitialState("T", 7); inland(s); s.player.theLuc = 100; s.player.inventory = { muoi: 5 };
  s.player.faction = "nghia_quan";
  check("nghĩa quân -> từ chối", actionBuonLauMuoi(s, 3).ok === false);
  const s2 = createInitialState("T", 7); inland(s2); s2.player.theLuc = 100; s2.player.inventory = { muoi: 5 };
  s2.player.dangOm = true;
  check("đang ốm -> từ chối", actionBuonLauMuoi(s2, 3).ok === false);
}

// --- 10. RNG invariant world-gen ---
let badRng = 0;
for (let seed = 1; seed <= 60; seed++) { const st = createInitialState("T", seed); if (st.rngState !== st.rngSeed) badRng++; }
check("rngState === rngSeed trên 60 seed", badRng === 0);
for (const [seed, n] of [[999, 11], [4242, 10]]) {
  check(`seed ${seed}: NPC ngoài QO = ${n}`,
    createInitialState("T", seed).npcs.filter(x => x.currentPhu !== "quang_oai").length === n);
}

console.log(pass ? "PASS - T3.4-3b: buôn lậu muối dùng item thật, giá chợ đen theo vùng, region-gate tối thiểu, bỏ quanLy+=0.5, replay-safe" : "FAIL - T3.4-3b");
process.exit(pass ? 0 : 1);

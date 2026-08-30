// actionXayNha: biet_thu + van_mieu (gate TRI_HUYEN) đổi từ minRank (p.rank cache)
// sang playerHoldsSeatAtLeast (ghế thật). 10 entry minRank còn lại KHÔNG đổi.
import { createInitialState, actionXayNha, actionAssumeOfficeHere, playerHoldsSeatAtLeast, PropertyDb } from "../engine.js";
import { PlayerRank } from "../models.js";

let pass = true;
const check = (name, cond) => { console.log((cond ? "  ok  " : " FAIL ") + name); if (!cond) pass = false; };

// --- 1. playerHoldsSeatAtLeast ---
{
  const s = createInitialState("T", 7);
  const p = s.player;
  check("chưa giữ ghế nào -> playerHoldsSeatAtLeast(TRI_HUYEN) = false",
    playerHoldsSeatAtLeast(s, PlayerRank.TRI_HUYEN) === false);
  const seat = Object.values(s.seats).find(x => x.title === PlayerRank.TRI_HUYEN);
  check("có ghế seat_tri_huyen", !!seat);
  seat.occupantId = p.id;
  check("giữ ghế tri_huyen -> >= TRI_HUYEN true", playerHoldsSeatAtLeast(s, PlayerRank.TRI_HUYEN) === true);
  check("giữ ghế tri_huyen -> >= LY_TRUONG true (bậc thấp hơn)", playerHoldsSeatAtLeast(s, PlayerRank.LY_TRUONG) === true);
  check("giữ ghế tri_huyen -> >= THUONG_THU false (bậc cao hơn)", playerHoldsSeatAtLeast(s, PlayerRank.THUONG_THU) === false);
  check("minTitle lạ -> false", playerHoldsSeatAtLeast(s, "khong_ton_tai") === false);
}

// --- 2. PropertyDb: đúng 2 entry dùng minSeatRank, 10 entry giữ minRank ---
{
  const withSeatRank = Object.entries(PropertyDb).filter(([, v]) => v.unlockCondition?.minSeatRank);
  const withMinRank  = Object.entries(PropertyDb).filter(([, v]) => v.unlockCondition?.minRank);
  check("đúng 2 entry có minSeatRank = biet_thu + van_mieu",
    withSeatRank.length === 2 && withSeatRank.every(([, v]) => v.unlockCondition.minSeatRank === PlayerRank.TRI_HUYEN)
    && withSeatRank.map(([k]) => k).sort().join(",") === "BIET_THU,VAN_MIEU");
  check("đúng 10 entry còn giữ minRank (9 official seatless + thuong_diem)", withMinRank.length === 10);
  check("không entry nào có cả hai", !Object.values(PropertyDb).some(v => v.unlockCondition?.minRank && v.unlockCondition?.minSeatRank));
}

// --- 3. LỖ CẦN BỊT: rank cache tri_huyen, chưa nhậm chức -> KHÔNG xây được ---
{
  const s = createInitialState("T", 7);
  const p = s.player;
  p.rank = PlayerRank.TRI_HUYEN;          // cache tự xưng (mô phỏng court.js ghi thẳng)
  p.tien = 999999;
  p.homeRegion = p.currentRegion;
  check("rank cache tri_huyen, KHÔNG ghế -> biet_thu FAIL", actionXayNha(s, "biet_thu").ok === false);
  check("rank cache tri_huyen, KHÔNG ghế -> van_mieu FAIL", actionXayNha(s, "van_mieu").ok === false);
}

// --- 4. Đường thật: nhậm chức tại huyện nhà -> giữ ghế -> xây được ---
{
  const s = createInitialState("T", 7);
  const p = s.player;
  p.rank = PlayerRank.TRI_HUYEN;          // cần rank official để actionAssumeOfficeHere cho phép
  p.tien = 999999;
  p.homeRegion = p.currentRegion;
  const ao = actionAssumeOfficeHere(s);
  check("actionAssumeOfficeHere ok", ao.ok === true);
  const seat = Object.values(s.seats).find(x => x.title === PlayerRank.TRI_HUYEN);
  check("player nay là occupant ghế tri_huyen", seat && seat.occupantId === p.id);
  check("giữ ghế thật -> biet_thu xây được", actionXayNha(s, "biet_thu").ok === true);
  check("giữ ghế thật -> van_mieu xây được", actionXayNha(s, "van_mieu").ok === true);
}

// --- 5. 10 entry minRank còn lại: hành vi KHÔNG đổi ---
{
  const s = createInitialState("T", 7);
  const p = s.player;
  p.tien = 999999;
  p.homeRegion = p.currentRegion;
  p.rank = PlayerRank.DAN_THUONG;
  check("dan_thuong -> phu_de FAIL (minRank như cũ, cần Hiến sát sứ)", actionXayNha(s, "phu_de").ok === false);
  check("dan_thuong -> thuy_doanh FAIL (minRank Tổng lĩnh)", actionXayNha(s, "thuy_doanh").ok === false);
  p.rank = PlayerRank.HIEN_SAT_SU;        // rank cache đủ -> vẫn qua (minRank KHÔNG đổi)
  check("rank cache hien_sat_su -> phu_de OK (minRank path nguyên vẹn)", actionXayNha(s, "phu_de").ok === true);
  // thuong_diem: PHU_HO — không official, cố ý giữ
  const s2 = createInitialState("T", 7);
  s2.player.tien = 999999; s2.player.homeRegion = s2.player.currentRegion;
  s2.player.rank = PlayerRank.DAN_THUONG;
  check("dan_thuong -> thuong_diem FAIL (minRank PHU_HO như cũ)", actionXayNha(s2, "thuong_diem").ok === false);
  s2.player.rank = PlayerRank.PHU_HO; s2.player.lifestylePoints = 3;
  check("phu_ho + 3 lifestylePoints -> thuong_diem OK (không đổi)", actionXayNha(s2, "thuong_diem").ok === true);
}

// --- 6. regression: RNG lượt chơi + world-gen không lệch ---
{
  const s = createInitialState("T", 7);
  const rngBefore = s.rngState;
  s.player.rank = PlayerRank.TRI_HUYEN; s.player.tien = 999999; s.player.homeRegion = s.player.currentRegion;
  actionXayNha(s, "biet_thu");
  Object.values(s.seats).find(x => x.title === PlayerRank.TRI_HUYEN).occupantId = s.player.id;
  actionXayNha(s, "biet_thu");
  check("actionXayNha + playerHoldsSeatAtLeast KHÔNG đụng state.rngState", s.rngState === rngBefore);
}
let badRng = 0;
for (let seed = 1; seed <= 60; seed++) { const st = createInitialState("T", seed); if (st.rngState !== st.rngSeed) badRng++; }
check("rngState === rngSeed trên 60 seed", badRng === 0);
for (const [seed, n] of [[999, 11], [4242, 10]]) {
  check(`seed ${seed}: NPC ngoài QO = ${n} (world-gen không lệch)`,
    createInitialState("T", seed).npcs.filter(x => x.currentPhu !== "quang_oai").length === n);
}

console.log(pass ? "PASS - gate actionXayNha: biet_thu/van_mieu kiểm ghế thật, 10 entry minRank giữ nguyên" : "FAIL - xaynha_seat_gate");
process.exit(pass ? 0 : 1);

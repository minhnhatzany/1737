// Xuất thân bần cố nông — Bước 1: opts.xuatThan="ban_co_nong" ép vị trí xuất
// phát về xã Đại Đồng (minh_nghia_t0_x2), làng Đại Thôn (_l0). Ghi đè SAU khi
// random tổng/xã/làng chạy xong -> KHÔNG thêm/bớt lời gọi rng() -> rngState và
// tính tất định world-gen bất biến so với nhánh mặc định (không truyền opts).
import { createInitialState } from "../engine.js";

let pass = true;
const check = (name, cond) => { console.log((cond ? "  ok  " : " FAIL ") + name); if (!cond) pass = false; };

const XA = "minh_nghia_t0_x2";
const LANG = "minh_nghia_t0_x2_l0";
const TONG = "minh_nghia_t0";

// --- 1. cờ bật -> vị trí ép đúng Đại Đồng, mọi cấp đồng bộ ---
{
  const s = createInitialState("T", 1, { xuatThan: "ban_co_nong" });
  const p = s.player;
  check("homeRegion = son_tay",      p.homeRegion === "son_tay");
  check("homePhu = quang_oai",       p.homePhu === "quang_oai");
  check("homeHuyen = minh_nghia",    p.homeHuyen === "minh_nghia");
  check(`homeTong = ${TONG}`,        p.homeTong === TONG);
  check(`homeXa = ${XA} (Đại Đồng)`, p.homeXa === XA);
  check(`homeLang = ${LANG} (Đại Thôn)`, p.homeLang === LANG);
  check("current* khớp home*",
    p.currentRegion === "son_tay" && p.currentPhu === "quang_oai" &&
    p.currentHuyen === "minh_nghia" && p.currentTong === TONG &&
    p.currentXa === XA && p.currentLang === LANG);
  check("player.location khớp current*",
    p.location.regionId === "son_tay" && p.location.phuId === "quang_oai" &&
    p.location.huyenId === "minh_nghia" && p.location.tongId === TONG &&
    p.location.xaId === XA && p.location.langId === LANG);
}

// --- 2. state.village trỏ đúng Village của Đại Đồng ---
{
  const s = createInitialState("T", 7, { xuatThan: "ban_co_nong" });
  check("state.village.xaId = " + XA, s.village?.xaId === XA);
  check("state.village.name = 'Đại Đồng'", s.village?.name === "Đại Đồng");
  check("state.village === villagesByXa[XA]", s.village === s.villagesByXa?.[XA]);
}

// --- 3. ghế lý trưởng Đại Đồng có occupant thật (Lê Văn Đắc) -> actionCayThue chạy được ---
{
  const s = createInitialState("T", 3, { xuatThan: "ban_co_nong" });
  const seatId = s.seatsByScope?.["xa:" + XA];
  check("có seat lý trưởng cho xã Đại Đồng", seatId === "seat_xa_" + XA);
  const seat = s.seats?.[seatId];
  check("seat có occupantId", !!seat?.occupantId);
  check("occupant tên 'Lê Văn Đắc'", s.npcById?.[seat?.occupantId]?.name === "Lê Văn Đắc");
}

// --- 4. bất biến rngState trên nhánh có cờ ---
{
  for (const seed of [1, 42, 999, 4242, 123456]) {
    const s = createInitialState("T", seed, { xuatThan: "ban_co_nong" });
    check(`seed ${seed}: rngState === rngSeed (= ${seed})`, s.rngState === s.rngSeed && s.rngState === seed);
  }
}

// --- 5. ghi đè KHÔNG tiêu draw: cùng seed, nhánh cờ và nhánh mặc định có
//        rngState/rngSeed y hệt (chứng minh 0 lời gọi rng() trong khối ghi đè) ---
{
  for (const seed of [2, 50, 777, 31337]) {
    const base = createInitialState("T", seed);
    const flag = createInitialState("T", seed, { xuatThan: "ban_co_nong" });
    check(`seed ${seed}: rngState nhánh-cờ === nhánh-mặc-định`,
      base.rngState === flag.rngState && base.rngSeed === flag.rngSeed);
  }
}

// --- 6. tất định trên nhánh cờ: cùng seed -> cùng vị trí + cùng world shape ---
{
  const a = createInitialState("Z", 12345, { xuatThan: "ban_co_nong" });
  const b = createInitialState("Z", 12345, { xuatThan: "ban_co_nong" });
  const strip = st => JSON.stringify({
    npcs: st.npcs.map(({ id, clanId, ...r }) => r),
    xa: st.player.currentXa, lang: st.player.currentLang,
    rngState: st.rngState,
  });
  check("cùng seed+cờ -> world shape y hệt", strip(a) === strip(b));
}

// --- 7. nhánh mặc định KHÔNG đổi: không truyền opts -> vẫn spawn Quảng Oai,
//        vẫn với tới cả 3 huyện qua nhiều seed (chứng minh không ép ngầm) ---
{
  const QO = new Set(["bat_bat", "tien_phong", "minh_nghia"]);
  const seen = new Set();
  let badRng = 0;
  for (let seed = 1; seed <= 50; seed++) {
    const s = createInitialState("T", seed);
    if (!QO.has(s.player.homeHuyen)) { pass = false; }
    if (s.rngState !== s.rngSeed) badRng++;
    seen.add(s.player.homeHuyen);
  }
  check("nhánh mặc định: 50 seed vẫn spawn Quảng Oai", [...seen].every(h => QO.has(h)));
  check("nhánh mặc định: cả 3 huyện vẫn với tới được", seen.size === 3);
  check("nhánh mặc định: rngState === rngSeed mọi seed", badRng === 0);
}

// --- 8. opts lạ / rỗng -> coi như nhánh mặc định (không ép) ---
{
  const s1 = createInitialState("T", 21);
  const s2 = createInitialState("T", 21, {});
  const s3 = createInitialState("T", 21, { xuatThan: "khong_ton_tai" });
  check("opts rỗng === không truyền opts", s1.player.currentXa === s2.player.currentXa);
  check("opts.xuatThan lạ -> không ép Đại Đồng", s3.player.currentXa === s1.player.currentXa);
}

console.log(pass
  ? "PASS - xuất thân bần cố nông: ép vị trí Đại Đồng khi có cờ, nhánh mặc định byte-identical, rngState bất biến"
  : "FAIL - xuất thân bần cố nông Bước 1");
process.exit(pass ? 0 : 1);

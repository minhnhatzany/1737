// T3.3-0 — village per xã. state.village thành CON TRỎ tới villagesByXa[currentXa].
// Bug đã phát hiện: arriveTravel ghi đè state.village -> state xã bị xoá khi quay lại.
// Phép thử quan trọng nhất: đi A->B->A, mutate A, xác nhận CÒN NGUYÊN.
import { createInitialState, gameTick, villageForXa, processMonthlyDraftReclaim } from "../engine.js";
import { xaClanIds } from "../actions/clan.js";

let pass = true;
const check = (name, cond) => { console.log((cond ? "  ok  " : " FAIL ") + name); if (!cond) pass = false; };

function qoXaList(s) {
  const out = [];
  for (const h of ["bat_bat", "tien_phong", "minh_nghia"]) {
    for (const t of Object.values(s._geoCache[h].tong)) {
      for (const x of Object.values(t.xa)) out.push({ id: x.id, huyen: h, tong: t.id, lang: Object.keys(x.lang)[0], name: x.name });
    }
  }
  return out;
}
const goTo = (s, xa) => {
  s.travel = { active: true, daysLeft: 1, totalDays: 1,
    dest: { regionId: "son_tay", phuId: "quang_oai", huyenId: xa.huyen, tongId: xa.tong, xaId: xa.id, langId: xa.lang }, reason: "test" };
  s.gameDay = (s.gameDay % 30) + 1; gameTick(s);
};

// --- 1. seed: 27 village, state.village là con trỏ ---
{
  const s = createInitialState("T", 7);
  check("villagesByXa có 27 xã QO", Object.keys(s.villagesByXa).length === 27);
  check("state.village === villagesByXa[currentXa] (con trỏ, không copy)",
    s.village === s.villagesByXa[s.player.currentXa]);
  const v = s.village;
  check("village có xaId + name = tên xã + drafted khởi tạo 0",
    v.xaId === s.player.currentXa && typeof v.name === "string" && v.drafted === 0);
  check("village.clanIds = xaClanIds của xã đó",
    JSON.stringify(v.clanIds.slice().sort()) === JSON.stringify((xaClanIds(s, s.player.currentXa) || []).slice().sort()));
  // pop/khoThoc scale theo dân
  const xas = qoXaList(s);
  const big = xas.reduce((a, b) => (s._geoCache[b.huyen].tong[b.tong].xa[b.id].pop > s._geoCache[a.huyen].tong[a.tong].xa[a.id].pop ? b : a));
  const small = xas.reduce((a, b) => (s._geoCache[b.huyen].tong[b.tong].xa[b.id].pop < s._geoCache[a.huyen].tong[a.tong].xa[a.id].pop ? b : a));
  check("khoThoc xã đông dân > xã ít dân", s.villagesByXa[big.id].khoThoc > s.villagesByXa[small.id].khoThoc);
}

// --- 2. PHÉP THỬ CHÍNH: đi A -> B -> A, state xã A còn nguyên ---
{
  const s = createInitialState("T", 7);
  const xas = qoXaList(s);
  const xaA = s.player.currentXa;
  const vA = s.village;
  vA.unrest = 91; vA.drafted = 37; vA.khoThoc = 4242; vA.quyLang = 777;

  const xaB = xas.find(x => x.id !== xaA);
  goTo(s, xaB);
  check("tới B: currentXa đổi, state.village trỏ sang village của B",
    s.player.currentXa === xaB.id && s.village === s.villagesByXa[xaB.id] && s.village !== vA);
  check("village B là state RIÊNG (unrest mặc định, drafted 0)",
    s.village.unrest === 12 && s.village.drafted === 0 && s.village !== vA);
  // mutate B để chắc chắn A/B độc lập
  s.village.unrest = 5;

  const home = xas.find(x => x.id === xaA);
  goTo(s, home);
  check("về A: state.village === CHÍNH object vA cũ (không tạo mới)", s.village === vA);
  check("state xã A CÒN NGUYÊN: unrest 91, drafted 37, khoThoc 4242, quyLang 777",
    s.village.unrest === 91 && s.village.drafted === 37 && s.village.khoThoc === 4242 && s.village.quyLang === 777);
  check("village B vẫn giữ mutate riêng (unrest 5) — A/B độc lập", s.villagesByXa[xaB.id].unrest === 5);
}

// --- 3. arriveTravel KHÔNG re-init: name không bị ghi đè bằng tên làng ---
{
  const s = createInitialState("T", 7);
  const xas = qoXaList(s);
  const xaB = xas.find(x => x.id !== s.player.currentXa);
  goTo(s, xaB);
  check("village.name = tên XÃ đích (không phải tên làng)", s.village.name === xaB.name);
}

// --- 4. villageForXa fallback cho xã ngoài QO ---
{
  const s = createInitialState("T", 7);
  const fb1 = villageForXa(s, "van_lang_ls_t0_x0");   // xã procedural, không seed
  const fb2 = villageForXa(s, "khac_han_nua");
  check("xã ngoài QO -> _fallbackVillage dùng chung (cùng 1 object)", fb1 === fb2 && fb1 === s._fallbackVillage);
  check("fallback village: clanIds = 3 họ toàn cục (scope=null)",
    fb1.clanIds.length === 3 && fb1.clanIds.every(id => s.clanById[id]?.scope == null));
  check("QO xã -> đúng village seed, không phải fallback",
    villageForXa(s, s.player.currentXa) === s.villagesByXa[s.player.currentXa]);
}

// --- 5. processMonthlyDraftReclaim: thu hồi ~5%/tháng, min 1, sàn 0, MỌI xã ---
{
  const s = createInitialState("T", 7);
  const v1 = s.villagesByXa[Object.keys(s.villagesByXa)[0]];
  const v2 = s.villagesByXa[Object.keys(s.villagesByXa)[1]];
  v1.drafted = 100; v2.drafted = 3;
  processMonthlyDraftReclaim(s);
  check("drafted 100 -> giảm ~5 (ceil 5%)", v1.drafted === 95);
  check("drafted 3 -> giảm min 1 -> 2", v2.drafted === 2);
  v2.drafted = 0; processMonthlyDraftReclaim(s);
  check("drafted 0 -> không âm", v2.drafted === 0);
  // chạy nhiều tháng -> về 0
  for (let i = 0; i < 200 && v1.drafted > 0; i++) processMonthlyDraftReclaim(s);
  check("chạy đủ lâu -> drafted về 0", v1.drafted === 0);
}

// --- 6. RNG lượt chơi + world-gen KHÔNG lệch (seed village = tất định, 0 rng) ---
let badRng = 0;
for (let seed = 1; seed <= 60; seed++) { const st = createInitialState("T", seed); if (st.rngState !== st.rngSeed) badRng++; }
check("rngState === rngSeed trên 60 seed", badRng === 0);
for (const [seed, n] of [[999, 11], [4242, 10]]) {
  check(`seed ${seed}: NPC ngoài QO = ${n} (world-gen không lệch)`,
    createInitialState("T", seed).npcs.filter(x => x.currentPhu !== "quang_oai").length === n);
}
{
  // tất định: cùng seed -> villagesByXa y hệt
  const sig = st => Object.keys(st.villagesByXa).sort().map(k => {
    const v = st.villagesByXa[k];
    return `${k}|${v.name}|${v.khoThoc}|${v.quyLang}|${v.clanIds.join(",")}`;
  }).join(";");
  check("tất định: cùng seed -> villagesByXa y hệt", sig(createInitialState("Z", 55)) === sig(createInitialState("Z", 55)));
}

console.log(pass ? "PASS - T3.3-0: village per xã, state.village con trỏ, đi-về không xoá state, draft reclaim" : "FAIL - T3.3-0");
process.exit(pass ? 0 : 1);

// T3.2a — cửa hàng / cơ ngơi kinh doanh (schema + generator + seed, CHƯA action nào đọc).
// createInitialState phải seed state.shops{}/shopsByXa{} cho 27 xã phủ Quảng Oai từ
// STREAM RNG RIÊNG (hash "shop:"+xaId) -> KHÔNG lệch world-gen. 7 xã nhóm A có 1 cơ
// ngơi đúng loại flavor + CHỦ AI thuộc dòng họ mạnh nhất xã; mọi xã có >=1 slot
// generic "quán trọ" bỏ trống.
import { createInitialState } from "../engine.js";
import { rollXaShops, shopIdForXa, genericShopSlots, ShopType, SHOP_INCOME_BASE } from "../core/shops.js";

let pass = true;
const check = (name, cond) => { console.log((cond ? "  ok  " : " FAIL ") + name); if (!cond) pass = false; };

const s = createInitialState("T", 7);
const shops = Object.values(s.shops);
const xaSeatIds = Object.keys(s.seats).filter(k => k.startsWith("seat_xa_")).map(k => k.slice("seat_xa_".length));

// --- 1. shape: mọi xã QO có >=1 cửa hàng, index khớp ---
check(`27 xã QO có mục trong shopsByXa — thực tế ${Object.keys(s.shopsByXa).length}`, Object.keys(s.shopsByXa).length === 27);
check("mọi xã có >=1 cửa hàng", xaSeatIds.every(x => (s.shopsByXa[x] || []).length >= 1));
check("shopsByXa chỉ chứa xã có ghế seat_xa_*", Object.keys(s.shopsByXa).every(x => xaSeatIds.includes(x)));
check("mọi shopId trong shopsByXa tồn tại trong state.shops",
  Object.values(s.shopsByXa).every(ids => ids.every(id => s.shops[id])));
check("shape mọi shop đầy đủ field",
  shops.every(sh => typeof sh.id === "string" && typeof sh.loai === "string" && sh.scope === "xa"
    && typeof sh.xaId === "string" && sh.seeded === true && sh.level === 1
    && Array.isArray(sh.capitalIds) && Array.isArray(sh.workerIds) && Array.isArray(sh.contestingClanIds)
    && ("occupantId" in sh) && ("ownerClanId" in sh) && sh.lastPaidYm === null && sh.foundedDay === 1
    && typeof sh.incomeBase === "number"));
check("loai mọi shop thuộc ShopType (enum đóng)",
  shops.every(sh => Object.values(ShopType).includes(sh.loai)));
check("id đúng khuôn shop_<xaId>_<idx>, không trùng",
  (() => {
    const ids = shops.map(sh => sh.id);
    const uniq = new Set(ids).size === ids.length;
    const shaped = Object.entries(s.shopsByXa).every(([x, arr]) => arr.every((id, i) => id === shopIdForXa(x, i)));
    return uniq && shaped;
  })());
check("incomeBase khớp SHOP_INCOME_BASE theo loai",
  shops.every(sh => sh.incomeBase === SHOP_INCOME_BASE[sh.loai]));

// --- 2. nhóm A: 7 cơ ngơi viết tay đúng loại + có chủ AI + >=1 slot trống ---
const HAND = { ben_do: 1, ben_be: 1, lo_voi: 1, xuong_cua: 1, phuong_than: 1, xuong_da: 1, xuong_det: 1 };
const owned = shops.filter(sh => sh.occupantId != null);
check(`đúng 7 cửa hàng có chủ (nhóm A) — thực tế ${owned.length}`, owned.length === 7);
check("7 loại cơ ngơi nhóm A xuất hiện đúng 1 lần mỗi loại",
  (() => {
    const cnt = {};
    for (const sh of owned) cnt[sh.loai] = (cnt[sh.loai] || 0) + 1;
    return Object.keys(HAND).every(k => cnt[k] === 1) && Object.keys(cnt).length === 7;
  })());
check("shop có chủ: occupantId -> NPC thật trong npcById, có shopId trỏ ngược",
  owned.every(sh => { const o = s.npcById[sh.occupantId]; return o && o.isAI && o.shopId === sh.id; }));
check("shop có chủ: chủ đứng đúng xã, clanId = ownerClanId, ownerClan là họ scope=xa của xã đó",
  owned.every(sh => {
    const o = s.npcById[sh.occupantId];
    const clan = s.clanById[sh.ownerClanId];
    return o.currentXa === sh.xaId && o.clanId === sh.ownerClanId
      && clan && clan.scope === "xa" && clan.scopeId === sh.xaId
      && clan.memberIds.includes(o.id);
  }));
check("ownerClan = dòng họ quyenLuc cao nhất trong xã",
  owned.every(sh => {
    const xaClans = s.clans.filter(c => c.scope === "xa" && c.scopeId === sh.xaId);
    const top = xaClans.reduce((a, b) => ((b.quyenLuc || 0) > (a.quyenLuc || 0) ? b : a));
    return sh.ownerClanId === top.id;
  }));
check("mỗi xã nhóm A còn >=1 suất trống loại khác (quan_tro)",
  owned.every(sh => (s.shopsByXa[sh.xaId] || []).some(id => {
    const g = s.shops[id];
    return g.occupantId == null && g.loai === ShopType.QUAN_TRO;
  })));

// --- 3. slot generic: bỏ trống, loai quan_tro, số lượng theo dân số ---
const generic = shops.filter(sh => sh.occupantId == null);
check("mọi cửa hàng không chủ đều loai quan_tro + ownerClanId null",
  generic.every(sh => sh.loai === ShopType.QUAN_TRO && sh.ownerClanId == null));
check("số slot generic mỗi xã = genericShopSlots(xã.pop)",
  (() => {
    // dựng lại pop mỗi xã từ geo
    let okAll = true;
    for (const huyenId of ["bat_bat", "tien_phong", "minh_nghia"]) {
      const geo = s._geoCache?.[huyenId];
      for (const tong of Object.values(geo.tong)) {
        for (const xa of Object.values(tong.xa)) {
          const want = genericShopSlots(xa.pop);
          const got = (s.shopsByXa[xa.id] || []).filter(id => s.shops[id].loai === ShopType.QUAN_TRO).length;
          if (want !== got) { okAll = false; console.log(`    ${xa.id}: pop ${xa.pop} want ${want} got ${got}`); }
        }
      }
    }
    return okAll;
  })());

// --- 4. contestingClanIds: = họ scope=xa của xã đó, sort status desc (khuôn ghế T3.1c) ---
check("mọi shop: contestingClanIds = họ của xã, sort status giảm dần",
  shops.every(sh => {
    const want = s.clans.filter(c => c.scope === "xa" && c.scopeId === sh.xaId)
      .sort((a, b) => (b.status ?? 0) - (a.status ?? 0)).map(c => c.id);
    if (sh.contestingClanIds.length !== want.length) return false;
    return sh.contestingClanIds.every((id, i) => id === want[i]);
  }));

// --- 5. world-gen KHÔNG lệch: rngState === rngSeed + baseline NPC ngoài QO + 26 lý trưởng ---
let badRng = 0;
for (let seed = 1; seed <= 60; seed++) { const st = createInitialState("T", seed); if (st.rngState !== st.rngSeed) badRng++; }
check("rngState === rngSeed trên 60 seed (seed shop không tiêu rng lượt chơi)", badRng === 0);
for (const [seed, n] of [[999, 11], [4242, 10]]) {
  const st = createInitialState("T", seed);
  check(`seed ${seed}: NPC ngoài QO = ${n} (world-gen không lệch)`,
    st.npcs.filter(x => x.currentPhu !== "quang_oai").length === n);
}
check("seed 7: vẫn đúng 26 lý trưởng QO (seed shop không đụng ghế)",
  createInitialState("T", 7).npcs.filter(n => n.currentPhu === "quang_oai" && n.rank === "ly_truong").length === 26);
check("seed 7: +7 NPC chủ cửa hàng trong QO (ngoài 26 lý trưởng)",
  (() => {
    const st = createInitialState("T", 7);
    const qo = st.npcs.filter(n => n.currentPhu === "quang_oai");
    return qo.filter(n => n.shopId != null).length === 7 && qo.length === 26 + 7;
  })());

// --- 6. tất định: cùng seed -> shops y hệt; rollXaShops thuần theo xaId ---
const a = createInitialState("Z", 55), b = createInitialState("Z", 55);
const sig = st => Object.keys(st.shops).sort().map(id => {
  const sh = st.shops[id];
  return `${id}|${sh.loai}|${sh.incomeBase}|${sh.ownerClanId || "-"}|${sh.contestingClanIds.join(",")}`;
}).join(";");
check("tất định: cùng seed -> state.shops y hệt", sig(a) === sig(b));
const r1 = JSON.stringify(rollXaShops("tien_phong_t0_x2", { pop: 1400, cuaHangSeed: ["lo_voi"] }));
const r2 = JSON.stringify(rollXaShops("tien_phong_t0_x2", { pop: 1400, cuaHangSeed: ["lo_voi"] }));
check("rollXaShops tất định theo xaId (2 lần gọi = nhau)", r1 === r2);
check("rollXaShops khác xaId -> khác kết quả",
  r1 !== JSON.stringify(rollXaShops("bat_bat_t0_x1", { pop: 1400, cuaHangSeed: ["lo_voi"] })));
check("rollXaShops bỏ loại lạ trong cuaHangSeed",
  JSON.parse(JSON.stringify(rollXaShops("x", { pop: 0, cuaHangSeed: ["khong_ton_tai"] }))).every(sp => sp.loai === ShopType.QUAN_TRO));

console.log(pass ? "PASS - T3.2a: seed cửa hàng 27 xã QO (7 cơ ngơi có chủ + slot generic), world-gen không lệch" : "FAIL - T3.2a");
process.exit(pass ? 0 : 1);

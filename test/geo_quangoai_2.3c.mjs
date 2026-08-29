// T2.3c — địa lý viết tay phủ Quảng Oai (3 huyện) đã vào map_data.js.
import { getLowerRegions, getHuyen } from "../map_data.js";
import { createInitialState } from "../engine.js";

let pass = true;
const check = (name, cond) => { console.log((cond ? "  ok  " : " FAIL ") + name); if (!cond) pass = false; };

const HUYEN = ["bat_bat", "tien_phong", "minh_nghia"];
const geos = {};
for (const h of HUYEN) {
  check(`${h} có field tong (mảng) trong MapData`, Array.isArray(getHuyen("son_tay", "quang_oai", h).tong));
  geos[h] = getLowerRegions({ _geoCache: {} }, h);
}

let nTong = 0, nXa = 0, nLang = 0, nLyTruong = 0, nNull = 0, popTotal = 0;
let badId = 0, badControl = 0, badSuat = 0, badTenNom = 0;

for (const h of HUYEN) {
  const g = geos[h];
  const tIds = Object.keys(g.tong);
  check(`${h}: 3 tổng`, tIds.length === 3);
  nTong += tIds.length;
  tIds.forEach((tId, ti) => {
    const t = g.tong[tId];
    if (tId !== `${h}_t${ti}` || t.id !== tId) badId++;
    if (t.control !== "trieu_dinh") badControl++;
    const xIds = Object.keys(t.xa);
    check(`${h}/${t.name}: 3 xã`, xIds.length === 3);
    nXa += xIds.length;
    let tongPopSum = 0;
    xIds.forEach((xId, xi) => {
      const x = t.xa[xId];
      if (xId !== `${tId}_x${xi}` || x.id !== xId) badId++;
      if (x.control !== "trieu_dinh") badControl++;
      if (!x.tenNom || typeof x.tenNom !== "string") badTenNom++;
      if (x.lyTruong === null) nNull++; else if (typeof x.lyTruong === "string" && x.lyTruong) nLyTruong++;
      let xaPopSum = 0;
      const lIds = Object.keys(x.lang);
      nLang += lIds.length;
      lIds.forEach((lId, li) => {
        const l = x.lang[lId];
        if (lId !== `${xId}_l${li}` || l.id !== lId) badId++;
        if (l.pop <= 0) badSuat++;
        if (l.suatDinh !== Math.floor(l.pop / 5)) badSuat++;
        xaPopSum += l.pop;
      });
      if (x.pop !== xaPopSum) badSuat++;
      tongPopSum += x.pop;
      popTotal += xaPopSum;
    });
    if (t.pop !== tongPopSum) badSuat++;
  });
}

check("tổng cộng 9 tổng", nTong === 9);
check("tổng cộng 27 xã", nXa === 27);
check("tổng cộng 64 làng (đúng như liệt kê trong quang_oai.md)", nLang === 64);
check("26 xã có lý trưởng, 1 xã null (Vạn Xuân)", nLyTruong === 26 && nNull === 1);
check("mọi id đúng format <huyenId>_t<i>_x<j>_l<k>", badId === 0);
check("control = trieu_dinh khắp nơi", badControl === 0);
check("mọi xã có tenNom chuỗi", badTenNom === 0);
check("pop cộng dồn + suatDinh=floor(pop/5) nhất quán", badSuat === 0);

// spot-check giá trị cụ thể
const bb = geos.bat_bat.tong.bat_bat_t0;
check("Tổng Cổ Đô là tổng đầu Bất Bạt", bb.name === "Tổng Cổ Đô");
check("xã Cổ Đô pop = 800+700+500 = 2000", bb.xa.bat_bat_t0_x0.pop === 2000);
check("xã Cổ Đô tenNom = Kẻ Đô", bb.xa.bat_bat_t0_x0.tenNom === "Kẻ Đô");
const tp0 = geos.tien_phong.tong.tien_phong_t0;
check("xã lỵ sở Tiên Phong = Tây Đằng, lý trưởng Ngô Văn Hoạch",
  tp0.xa.tien_phong_t0_x0.name === "Tây Đằng" && tp0.xa.tien_phong_t0_x0.lyTruong === "Ngô Văn Hoạch");
const mnLast = geos.minh_nghia.tong.minh_nghia_t2;
check("Tổng Thượng Tiết là tổng cuối Minh Nghĩa", mnLast.name === "Tổng Thượng Tiết");
check("xã Vạn Xuân lyTruong = null (ghế trống)", mnLast.xa.minh_nghia_t2_x2.name === "Vạn Xuân" && mnLast.xa.minh_nghia_t2_x2.lyTruong === null);

// spawn vào Quảng Oai -> village name lấy từ dữ liệu tay (không phải "Làng <GeoName>")
const HANDLANG = new Set();
for (const h of HUYEN) for (const t of Object.values(geos[h].tong)) for (const x of Object.values(t.xa)) for (const l of Object.values(x.lang)) HANDLANG.add(l.name);
let qoSpawn = 0, qoNameOk = 0;
for (let seed = 1; seed <= 600; seed++) {
  const s = createInitialState("T", seed);
  if (s.player.homePhu === "quang_oai") {
    qoSpawn++;
    if (HANDLANG.has(s.village.name)) qoNameOk++;
  }
}
check(`spawn Quảng Oai (${qoSpawn} lần/600 seed): village name luôn từ dữ liệu tay`, qoSpawn > 0 && qoNameOk === qoSpawn);

// huyện ngoài Quảng Oai vẫn procedural — T3.0 khoá spawn về QO nên gọi trực tiếp
// getLowerRegions với huyện ngoài QO (tách "generator còn sống" khỏi "đường spawn").
const procGeo = getLowerRegions({ _geoCache: {} }, "van_lang_ls"); // Lạng Sơn
check("huyện ngoài Quảng Oai vẫn procedural (getLowerRegions trực tiếp)",
  Object.keys(procGeo.tong).length >= 5 && Object.keys(procGeo.tong)[0].startsWith("van_lang_ls_t"));

console.log(pass ? `PASS - T2.3c: Quảng Oai 9 tổng / 27 xã / ${nLang} làng / ${popTotal} dân, hand-data đúng` : "FAIL - T2.3c");
process.exit(pass ? 0 : 1);

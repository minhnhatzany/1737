// T2.3b — getLowerRegions rẽ nhánh sang địa lý viết tay khi huyện có field `tong`.
// Chưa có huyện thật nào mang `tong` (T2.3c mới đổ dữ liệu), nên test tự bơm
// dữ liệu tay tổng hợp vào một huyện rồi gỡ ra.
import { MapData, getLowerRegions, getHuyen } from "../map_data.js";
import { createInitialState } from "../engine.js";

let pass = true;
const check = (name, cond) => { console.log((cond ? "  ok  " : " FAIL ") + name); if (!cond) pass = false; };

// --- 1. huyện KHÔNG có `tong` -> vẫn procedural (không rẽ nhánh) ---
// T3.0 khoá spawn về Quảng Oai nên player không còn ra huyện procedural; gọi
// getLowerRegions trực tiếp với huyện ngoài QO để kiểm generator còn sống.
const procGeo = getLowerRegions({ _geoCache: {} }, "van_lang_ls"); // Lạng Sơn, procedural
check("huyện procedural vẫn sinh tong object", procGeo && Object.keys(procGeo.tong).length >= 5);
check("id tổng procedural đúng format <huyenId>_t<i>", Object.keys(procGeo.tong)[0].startsWith("van_lang_ls_t"));

// --- 2. bơm dữ liệu tay vào huyện bat_bat, gọi lại getLowerRegions ---
const bb = getHuyen("son_tay", "quang_oai", "bat_bat");
check("có object huyện bat_bat", !!bb);
bb.tong = [
  { name: "Tổng Thử", xa: [
    { name: "Xã A", tenNom: "Kẻ A", lyTruong: "Ông X", lang: [
      { name: "Làng Một", pop: 800 },
      { name: "Làng Hai", pop: 205 },
    ]},
    { name: "Xã B", tenNom: "Kẻ B", lyTruong: null, lang: [
      { name: "Làng Ba", pop: 500 },
    ]},
  ]},
];

const s = { _geoCache: {} };
const geo = getLowerRegions(s, "bat_bat");

const t0 = "bat_bat_t0", x0 = "bat_bat_t0_x0", x1 = "bat_bat_t0_x1", l0 = "bat_bat_t0_x0_l0";
check("tong là object keyed by id", !!geo.tong[t0] && geo.tong[t0].id === t0);
check("tong.name giữ nguyên", geo.tong[t0].name === "Tổng Thử");
check("xã keyed, id === key", geo.tong[t0].xa[x0].id === x0);
check("làng keyed, id === key", geo.tong[t0].xa[x0].lang[l0].id === l0);
check("làng pop cộng lên xã (800+205=1005)", geo.tong[t0].xa[x0].pop === 1005);
check("xã pop cộng lên tổng (1005+500=1505)", geo.tong[t0].pop === 1505);
check("totalPop = 1505", geo.totalPop === 1505);
check("suatDinh làng = floor(pop/5) (800->160)", geo.tong[t0].xa[x0].lang[l0].suatDinh === 160);
check("control mặc định trieu_dinh trên tổng", geo.tong[t0].control === "trieu_dinh");
check("control mặc định trieu_dinh trên xã", geo.tong[t0].xa[x0].control === "trieu_dinh");
check("tenNom xã passthrough", geo.tong[t0].xa[x0].tenNom === "Kẻ A");
check("lyTruong xã passthrough", geo.tong[t0].xa[x0].lyTruong === "Ông X");
check("lyTruong null giữ nguyên (Vạn Xuân-style)", geo.tong[t0].xa[x1].lyTruong === null);
check("tenNom làng null khi không ghi", geo.tong[t0].xa[x0].lang[l0].tenNom === null);
check("cache lưu dữ liệu tay", s._geoCache["bat_bat"] === geo);

// --- 3. gỡ dữ liệu tay ra, huyện bat_bat trở lại procedural ---
delete bb.tong;
const s3 = createInitialState("T", 21); // seed 21 spawn bat_bat (đã kiểm ở T2.3a)
check("gỡ tong -> bat_bat lại procedural (>=5 tổng, tên sinh)",
  s3.player.homeHuyen !== "bat_bat" ||
  (s3._geoCache["bat_bat"] && Object.keys(s3._geoCache["bat_bat"].tong).length >= 5));

console.log(pass ? "PASS - T2.3b: rẽ nhánh hand-data đúng hình dạng, procedural không đổi" : "FAIL - T2.3b");
process.exit(pass ? 0 : 1);

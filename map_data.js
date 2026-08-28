/**
 * map_data.js — Dữ liệu địa lý lịch sử Đàng Ngoài, Lê Trung Hưng
 * Cấu trúc: Trấn → Phủ → Huyện
 * Nguồn: Lịch sử hành chính Việt Nam thế kỷ XVIII
 */

import { rng } from "./core/rng.js";

export const RegionId = {
  THANG_LONG: "thang_long",
  SON_NAM:    "son_nam",
  HAI_DUONG:  "hai_duong",
  SON_TAY:    "son_tay",
  KINH_BAC:   "kinh_bac",
  AN_QUANG:   "an_quang",
  TUYEN_QUANG:"tuyen_quang",
  HUNG_HOA:   "hung_hoa",
  LANG_SON:   "lang_son",
  THAI_NGUYEN:"thai_nguyen",
  CAO_BINH:   "cao_binh",
  THANH_HOA:  "thanh_hoa",
  NGHE_AN:    "nghe_an",
};

// Chất lượng quân đội
export const TroopQuality = {
  O_HOP:   { id: "o_hop",   label: "Ô hợp",   color: "#888", mult: 0.4 },
  THUONG:  { id: "thuong",  label: "Thường",   color: "#aaa", mult: 0.7 },
  CHAT_LUONG:{ id:"chat_luong", label:"Chất lượng", color:"#7ab3d4", mult:1.0 },
  CAO_CAP: { id: "cao_cap", label: "Cao cấp",  color: "#ffd700", mult: 1.4 },
  TINH_NHUE:{ id:"tinh_nhue", label:"Tinh nhuệ", color:"#ff6a00", mult:1.8 },
};

function getTroopQuality(tuongSo, quanSo, menAtArm) {
  let score = (tuongSo * 5 + (menAtArm || 0) * 3) / Math.max(1, quanSo / 100);
  if (score >= 15) return TroopQuality.TINH_NHUE;
  if (score >= 10) return TroopQuality.CAO_CAP;
  if (score >= 5)  return TroopQuality.CHAT_LUONG;
  if (score >= 2)  return TroopQuality.THUONG;
  return TroopQuality.O_HOP;
}
export { getTroopQuality };

/**
 * Cấu trúc chiến sự tại một huyện
 * battle = {
 *   id, name, attacker, defender,
 *   atkForce, defForce (số quân),
 *   atkMorale, defMorale (0-100),
 *   atkCommander, defCommander,
 *   atkMenAtArm, defMenAtArm,
 *   atkLuong, defLuong (hậu cần 0-100),
 *   thangVong (0-100, 50=cân bằng, >50 = atkWinning),
 *   daysElapsed, isHistorical
 * }
 */

export const MapData = {
  [RegionId.THANG_LONG]: {
    id: RegionId.THANG_LONG,
    name: "Kinh thành Thăng Long",
    spec: "Giao Thương, Chính Trị",
    pm: { thoc: 3.0, muoi: 2.0, go: 2.5, lua: 3.0, ruou: 2.0 },
    docTran: "Trịnh Doanh",
    quanSoTran: 10000,
    chatLuong: TroopQuality.TINH_NHUE,
    desc: "Kinh thành phồn hoa, nơi Phủ Chúa Trịnh ngự trị. Mọi con đường quan lộ đều dẫn về đây.",
    /** Khu Hoàng thành — một địa điểm riêng trên bản đồ; phủ/huyện xung quanh là phụ cận. */
    kinhThanh: {
      id: "kinh_thanh_thang_long",
      name: "Kinh Thành Thăng Long",
      shortDesc: "Ba lớp thành lũy: La thành — Hoàng thành — Tử cấm thành; trung tâm quyền lực Đàng Ngoài.",
      desc: "Kinh đô nhà Lê, Phủ Chúa Trịnh ngự trị. (Hệ thống trong game: hư cấu hành chính có căn cứ lịch sử, không rập kỷ Hội đồng.)",
      garrison: 9600,
      garrisonLabel: "Tổng quân đồn trú kinh thành (ước lượng)",
      defenseNote: "Phòng thủ tầng lớp: ngoài La thành thương cổ đông đúc; trong Hoàng thành nha môn & cấm binh; lõi Tử cấm thành chỉ cấm vệ.",
      maaNote: "MAA tinh nhuệ tập trung ở Hoàng thành và Tử cấm thành.",
      corePhuId: "phung_thien",
      coreHuyenId: "tho_xuong",
      /** Ba vòng đồng tâm — từ ngoài vào trong */
      rings: {
        laThanh: {
          id: "la_thanh",
          key: "la",
          name: "La thành",
          tagline: "Vòng ngoài — thành quách & chợ phường",
          shortDesc: "Tường cao hào sâu, cửa ô tuần tra ngày đêm. Trong vòng La thành: phố xá san sát, thương cổ, tửu lâu, gánh hàng rong tấp nập.",
          wallGarrison: 4200,
          vibe: "Sầm uất nhất: buôn bán, thợ thủ công, lữ khách, sĩ tử tạm trú chờ khoa — không phải nơi họp triều.",
          maaNote: "Lính tuần thành & lính cờ hiệu trấn cửa ô; MAA trừng giáp đủ biên chế nhưng chủ yếu giữ trật tự đô thị.",
        },
        hoangThanh: {
          id: "hoang_thanh",
          key: "hoang",
          name: "Hoàng thành",
          tagline: "Vòng giữa — Phủ Chúa & Lục Phiên",
          shortDesc: "Khu cung điện Phủ Chúa Trịnh: điện thính chính, nha môn trung ương, kho lương nội địa. Lục Phiên chia việc như Lục Bộ: Lại – Hộ – Lễ – Binh – Hình – Công (danh xưng trong game).",
          garrison: 3800,
          phuChua: "Phủ Chúa Trịnh — nơi ban chiếu chỉ, tiếp kiến đại thần.",
          lucPhien: [
            "Lại Phiên — bổ nhiệm, công danh, sổ quan tịch",
            "Hộ Phiên — kho lương, thuế nội địa, tiền quỹ",
            "Lễ Phiên — nghi lễ, khoa cử, điện thí",
            "Binh Phiên — vệ dinh, lệnh binh, MAA nha môn",
            "Hình Phiên — án tụng, giam lục, trị an kinh thành",
            "Công Phiên — thủy lợi, xây dựng, tu tạo cung điện",
          ],
          maaNote: "MAA đầy đủ các loại: kỵ binh cấm vệ Phủ Chúa, bộ binh tinh nhuệ, cung nỏ điện tiền — trang bị và kỷ luật tối đại.",
        },
        tuCamThanh: {
          id: "tu_cam_thanh",
          key: "tu",
          name: "Tử cấm thành",
          tagline: "Vòng trong cùng — cung Vua Lê & nội đình",
          shortDesc: "Nơi cung điện nhà Lê, hoàng gia và lễ nghi đại triều. Ngoại vi chỉ cấm vệ được phép mang khí giới đầy đủ; kẻ lạ mặt gần như không thể lọt.",
          garrison: 1600,
          royalNote: "Vua Lê (ở ngôi danh nghĩa) và hoàng tộc; nghi trượng, Thái miếu, điện thờ. Thực quyền triều chính tại Phủ Chúa ngoài Hoàng thành — đây là biểu tượng thống nhất hai nhà.",
          maaNote: "Chỉ cấm vệ tinh nhuệ & MAA nội đình: trừng giáp sơn son, đao gươm cấm cung — tuyệt đối không dân thường.",
        },
      },
    },
    phu: {
      "phung_thien": {
        id: "phung_thien",
        name: "Phủ Phụng Thiên",
        triPhu: "Trịnh Doanh",
        quanSo: 900,
        chatLuong: TroopQuality.CHAT_LUONG,
        // Chỉ mô hình hóa phần “kinh thành phụ cận”: 2 huyện Quảng Đức & Thọ Xương.
        huyen: {
          "quang_duc": {
            id: "quang_duc",
            name: "Huyện Quảng Đức",
            triHuyen: "Nguyễn Trung Thành",
            quanSo: 300,
            chatLuong: TroopQuality.THUONG,
            desc: "Huyện phụ cận kinh thành (phía tây bắc): đất học, đường quan lộ đi về trung tâm."
          },
          "tho_xuong": {
            id: "tho_xuong",
            name: "Huyện Thọ Xương",
            triHuyen: "Phạm Văn Minh",
            quanSo: 9600,
            chatLuong: TroopQuality.TINH_NHUE,
            desc: "Huyện phụ cận kinh thành (gắn với trục chợ phường ngoài La thành): quân đồn trú và nha môn dày đặc."
          }
        }
      }
    }
  },

  [RegionId.SON_TAY]: {
    id: RegionId.SON_TAY,
    name: "Trấn Sơn Tây",
    spec: "Quặng / Gỗ / Lâm Thổ Sản",
    pm: { thoc: 1.5, muoi: 1.5, go: 0.5, lua: 1.5, ruou: 1.5 },
    docTran: "Hoàng Công Kỳ",
    quanSoTran: 3000,
    chatLuong: TroopQuality.CHAT_LUONG,
    desc: "Vùng rừng núi phía Tây. Tam Đảo hùng vĩ, nơi Nguyễn Dương Hưng khởi binh năm 1737.",
    phu: {
      "quang_oai": {
        id: "quang_oai", name: "Phủ Quảng Oai",
        triPhu: "Đinh Văn Nhân", quanSo: 400, chatLuong: TroopQuality.THUONG,
        huyen: {
          "minh_nghia": { id: "minh_nghia", name: "Huyện Minh Nghĩa", triHuyen: "Nguyễn Hữu Khiêm", quanSo: 60, chatLuong: TroopQuality.O_HOP, desc: "Thung lũng hẹp, đất ít người thưa" },
          "tien_phong": { id: "tien_phong", name: "Huyện Tiên Phong", triHuyen: "Phạm Quốc Nhân", quanSo: 45, chatLuong: TroopQuality.THUONG, desc: "Đồi gò, dân làm gỗ và than củi" },
          "bat_bat":    { id: "bat_bat",    name: "Huyện Bất Bạt",   triHuyen: "Lê Văn Tú", quanSo: 35, chatLuong: TroopQuality.O_HOP, desc: "Biên giới Sơn Tây–Hưng Hóa" },
        }
      },
      "tam_doi": {
        id: "tam_doi", name: "Phủ Tam Đới",
        triPhu: "Vũ Đình Dũng", quanSo: 600, chatLuong: TroopQuality.CHAT_LUONG,
        huyen: {
          "huong_canh":  { id: "huong_canh",  name: "Huyện Hương Canh", triHuyen: "Nguyễn Công Lợi", quanSo: 80, chatLuong: TroopQuality.CHAT_LUONG, desc: "⚔ Địa bàn của Nguyễn Danh Phương (1740+). Đồi núi hiểm trở.", historicalBattle: "danh_phuong" },
          "tam_dao":    { id: "tam_dao",     name: "Huyện Tam Đảo",    triHuyen: "Khuyết", quanSo: 20, chatLuong: TroopQuality.O_HOP, desc: "Rừng sâu Tam Đảo, nơi Nguyễn Dương Hưng ẩn náu năm 1737", historicalBattle: "duong_hung" },
          "lap_thach":  { id: "lap_thach",  name: "Huyện Lập Thạch",  triHuyen: "Bùi Minh Tuấn", quanSo: 50, chatLuong: TroopQuality.THUONG, desc: "Vùng bán sơn địa giàu gỗ quý" },
          "vinh_tuong": { id: "vinh_tuong", name: "Huyện Vĩnh Tường",  triHuyen: "Phạm Văn Nghĩa", quanSo: 55, chatLuong: TroopQuality.THUONG, desc: "Châu thổ sông Hồng, lúa hai mùa" },
        }
      },
      "tay_nguyen": {
        id: "tay_nguyen", name: "Phủ Tây Nguyên",
        triPhu: "Đặng Ngọc Thành", quanSo: 250, chatLuong: TroopQuality.O_HOP,
        huyen: {
          "ba_vi":  { id: "ba_vi",  name: "Huyện Ba Vì",   triHuyen: "Lý Công Tuấn", quanSo: 30, chatLuong: TroopQuality.O_HOP, desc: "Núi Tản Viên linh thiêng vùng biên" },
          "thach_that": { id: "thach_that", name: "Huyện Thạch Thất", triHuyen: "Nguyễn Đình Nhân", quanSo: 40, chatLuong: TroopQuality.THUONG, desc: "Làng nghề đá và mộc" },
        }
      }
    }
  },

  [RegionId.KINH_BAC]: {
    id: RegionId.KINH_BAC,
    name: "Trấn Kinh Bắc",
    spec: "Nho Giáo / Khoa Bảng",
    pm: { thoc: 1.2, muoi: 1.2, go: 1.0, lua: 1.0, ruou: 1.0 },
    docTran: "Trần Công Khiêm",
    quanSoTran: 4000,
    chatLuong: TroopQuality.CHAT_LUONG,
    desc: "Đất học kinh bắc, quê hương sĩ tử và văn võ. Hội Gióng và Hội Lim nổi tiếng.",
    phu: {
      "thuan_an": {
        id: "thuan_an", name: "Phủ Thuận An",
        triPhu: "Phạm Đình Trọng", quanSo: 800, chatLuong: TroopQuality.CHAT_LUONG,
        huyen: {
          "gia_lam":  { id: "gia_lam",  name: "Huyện Gia Lâm",   triHuyen: "Lê Minh Dũng", quanSo: 120, chatLuong: TroopQuality.CHAT_LUONG, desc: "Đối diện Thăng Long qua sông Hồng" },
          "dong_ngan": { id: "dong_ngan", name: "Huyện Đông Ngàn", triHuyen: "Vũ Hữu Thành", quanSo: 90, chatLuong: TroopQuality.CHAT_LUONG, desc: "Đất chợ Phủ Lý, thương nhân tấp nập" },
          "lang_tai": { id: "lang_tai", name: "Huyện Lãng Tài",  triHuyen: "Nguyễn Công Trung", quanSo: 60, chatLuong: TroopQuality.THUONG, desc: "Làng dệt lụa và nước mắm" },
        }
      },
      "lang_giang": {
        id: "lang_giang", name: "Phủ Lạng Giang",
        triPhu: "Đỗ Văn Lợi", quanSo: 500, chatLuong: TroopQuality.THUONG,
        huyen: {
          "bao_loc":  { id: "bao_loc",  name: "Huyện Bảo Lộc",  triHuyen: "Phạm Tuấn Anh", quanSo: 70, chatLuong: TroopQuality.THUONG, desc: "Điểm giao nhau Kinh Bắc–Lạng Sơn" },
          "yen_the":  { id: "yen_the",  name: "Huyện Yên Thế",  triHuyen: "Bùi Đình Nhân", quanSo: 50, chatLuong: TroopQuality.THUONG, desc: "Rừng rú, dân tụ họp ẩn náu" },
          "tan_yen":  { id: "tan_yen",  name: "Huyện Tân Yên",  triHuyen: "Lê Hữu Tuấn", quanSo: 40, chatLuong: TroopQuality.O_HOP, desc: "Đất trống hoang sơ, ít dân" },
        }
      },
      "bac_ha": {
        id: "bac_ha", name: "Phủ Bắc Hà",
        triPhu: "Nguyễn Văn Nhân", quanSo: 600, chatLuong: TroopQuality.CHAT_LUONG,
        huyen: {
          "vo_giang": { id: "vo_giang", name: "Huyện Vũ Giang", triHuyen: "Trần Đình Lợi", quanSo: 80, chatLuong: TroopQuality.CHAT_LUONG, desc: "Thị tứ sầm uất ven sông" },
          "que_duong": { id: "que_duong", name: "Huyện Quế Dương", triHuyen: "Hoàng Công Minh", quanSo: 60, chatLuong: TroopQuality.THUONG, desc: "Vùng dệt vải nổi tiếng" },
        }
      }
    }
  },

  [RegionId.SON_NAM]: {
    id: RegionId.SON_NAM,
    name: "Trấn Sơn Nam",
    spec: "Lúa Gạo / Tơ Lụa",
    pm: { thoc: 0.8, muoi: 1.2, go: 1.5, lua: 0.5, ruou: 1.0 },
    docTran: "Phạm Đình Trọng",
    quanSoTran: 3500,
    chatLuong: TroopQuality.THUONG,
    desc: "Vựa lúa Đàng Ngoài. Sông Đáy, sông Nhuệ bồi đắp phù sa màu mỡ. Nhưng cũng là nơi nổ ra nhiều cuộc khởi nghĩa.",
    phu: {
      "thien_truong": {
        id: "thien_truong", name: "Phủ Thiên Trường",
        triPhu: "Đinh Văn Thành", quanSo: 600, chatLuong: TroopQuality.THUONG,
        huyen: {
          "my_loc":    { id: "my_loc",    name: "Huyện Mỹ Lộc",   triHuyen: "Lê Đình Nhân", quanSo: 80, chatLuong: TroopQuality.THUONG, desc: "Trung tâm Phủ Thiên Trường" },
          "thuong_nguyen":{ id:"thuong_nguyen", name:"Huyện Thượng Nguyên", triHuyen:"Nguyễn Công Dũng", quanSo:50, chatLuong:TroopQuality.THUONG, desc:"Đồng bằng màu mỡ ven sông Đào" },
          "giao_thuy": { id: "giao_thuy", name: "Huyện Giao Thủy",  triHuyen: "Phạm Minh Tuấn", quanSo: 45, chatLuong: TroopQuality.O_HOP, desc: "Vùng ven biển, ngư nghiệp lớn" },
        }
      },
      "nghia_hung": {
        id: "nghia_hung", name: "Phủ Nghĩa Hưng",
        triPhu: "Bùi Văn Dũng", quanSo: 400, chatLuong: TroopQuality.O_HOP,
        huyen: {
          "ninh_xa":  { id: "ninh_xa",  name: "Huyện Ninh Xá",   triHuyen: "Khuyết", quanSo: 30, chatLuong: TroopQuality.O_HOP, desc: "⚔ Nơi Nguyễn Tuyển, Nguyễn Cừ khởi nghĩa 1739. Dân đói kém loạn lạc.", historicalBattle: "nguyen_cu" },
          "y_yen":    { id: "y_yen",    name: "Huyện Ý Yên",     triHuyen: "Vũ Công Nhân", quanSo: 40, chatLuong: TroopQuality.O_HOP, desc: "Đất trũng thường xuyên ngập lụt, dân đói" },
          "hoa_lu":   { id: "hoa_lu",   name: "Huyện Hoa Lư",    triHuyen: "Nguyễn Hữu Khiêm", quanSo: 35, chatLuong: TroopQuality.THUONG, desc: "Đất cố đô Hoa Lư thời Đinh-Lê" },
        }
      },
      "ung_thien": {
        id: "ung_thien", name: "Phủ Ứng Thiên",
        triPhu: "Trần Danh Lâm", quanSo: 500, chatLuong: TroopQuality.THUONG,
        huyen: {
          "thanh_tri":  { id: "thanh_tri",  name: "Huyện Thanh Trì",  triHuyen: "Lê Văn Tuấn", quanSo: 65, chatLuong: TroopQuality.THUONG, desc: "Tiếp giáp Thăng Long phía Nam" },
          "phu_xuyen2": { id: "phu_xuyen2", name: "Huyện Kim Bảng",   triHuyen: "Đinh Công Thành", quanSo: 45, chatLuong: TroopQuality.O_HOP, desc: "Vùng chiêm trũng, lúa bấp bênh" },
        }
      }
    }
  },

  [RegionId.HAI_DUONG]: {
    id: RegionId.HAI_DUONG,
    name: "Trấn Hải Dương",
    spec: "Muối Biển / Thương Cảng",
    pm: { thoc: 1.3, muoi: 0.4, go: 1.2, lua: 1.2, ruou: 1.0 },
    docTran: "Nguyễn Đình Huấn",
    quanSoTran: 4500,
    chatLuong: TroopQuality.CHAT_LUONG,
    desc: "Trấn giàu có vì muối và thương cảng. Nhưng bị Quận He Nguyễn Hữu Cầu hoành hành dữ dội từ khoảng 1743.",
    phu: {
      "ha_hong": {
        id: "ha_hong", name: "Phủ Hạ Hồng",
        triPhu: "Đỗ Đình Thành", quanSo: 900, chatLuong: TroopQuality.CHAT_LUONG,
        huyen: {
          "thanh_ha": { id: "thanh_ha", name: "Huyện Thanh Hà",  triHuyen: "Nguyễn Văn Nghĩa", quanSo: 120, chatLuong: TroopQuality.CAO_CAP, desc: "⚔ Địa bàn chính của Quận He Nguyễn Hữu Cầu (1743+). Cảng sông lớn.", historicalBattle: "quat_he" },
          "tu_ky":    { id: "tu_ky",    name: "Huyện Tứ Kỳ",    triHuyen: "Phạm Công Dũng", quanSo: 80, chatLuong: TroopQuality.CHAT_LUONG, desc: "Đồng muối rộng lớn, dân diêm nghiệp" },
          "gia_loc":  { id: "gia_loc",  name: "Huyện Gia Lộc",  triHuyen: "Lê Hữu Nhân", quanSo: 70, chatLuong: TroopQuality.THUONG, desc: "Vùng ruộng sâu, lúa nước" },
        }
      },
      "thuong_hong": {
        id: "thuong_hong", name: "Phủ Thượng Hồng",
        triPhu: "Bùi Công Thành", quanSo: 700, chatLuong: TroopQuality.CHAT_LUONG,
        huyen: {
          "binh_giang": { id: "binh_giang", name: "Huyện Bình Giang", triHuyen: "Trần Văn Lợi", quanSo: 90, chatLuong: TroopQuality.CHAT_LUONG, desc: "Thị trấn sầm uất, chợ Bình Giang nổi tiếng" },
          "nam_sach":   { id: "nam_sach",   name: "Huyện Nam Sách",   triHuyen: "Nguyễn Đình Tuấn", quanSo: 75, chatLuong: TroopQuality.THUONG, desc: "Vùng đất học, nhiều tiến sĩ" },
          "kinh_mon":   { id: "kinh_mon",   name: "Huyện Kinh Môn",   triHuyen: "Vũ Hữu Khiêm", quanSo: 60, chatLuong: TroopQuality.THUONG, desc: "Núi Yên Tử gần đây, phòng thủ tốt" },
        }
      },
      "hong_chau": {
        id: "hong_chau", name: "Phủ Hồng Châu",
        triPhu: "Hoàng Văn Minh", quanSo: 500, chatLuong: TroopQuality.THUONG,
        huyen: {
          "van_giang": { id: "van_giang", name: "Huyện Văn Giang", triHuyen: "Đỗ Minh Nhân", quanSo: 65, chatLuong: TroopQuality.THUONG, desc: "Giáp Thăng Long, dân buôn nhiều" },
          "phu_cu":    { id: "phu_cu",    name: "Huyện Phù Cừ",    triHuyen: "Lý Đình Thành", quanSo: 45, chatLuong: TroopQuality.O_HOP, desc: "Vùng chiêm trũng, đất nghèo" },
        }
      }
    }
  },

  [RegionId.AN_QUANG]: {
    id: RegionId.AN_QUANG,
    name: "Trấn An Quảng",
    spec: "Hải Sản / Mỏ Than",
    pm: { thoc: 1.8, muoi: 0.6, go: 0.8, lua: 2.0, ruou: 1.3 },
    docTran: "Lê Công Minh",
    quanSoTran: 2000,
    chatLuong: TroopQuality.THUONG,
    desc: "Vùng duyên hải phía Đông Bắc. Vịnh biển đẹp, mỏ than và hải sản dồi dào. Xa Thăng Long nên ít bị kiểm soát.",
    phu: {
      "tri_ha": {
        id: "tri_ha", name: "Phủ Trí Hà",
        triPhu: "Nguyễn Văn Dũng", quanSo: 350, chatLuong: TroopQuality.THUONG,
        huyen: {
          "yen_hung":    { id: "yen_hung",   name: "Huyện Yên Hưng",   triHuyen: "Phạm Văn Nhân", quanSo: 50, chatLuong: TroopQuality.THUONG, desc: "Vịnh biển đẹp, nghề chài lưới" },
          "dong_trieu":  { id: "dong_trieu", name: "Huyện Đông Triều",  triHuyen: "Lê Đình Tuấn", quanSo: 40, chatLuong: TroopQuality.THUONG, desc: "Mỏ than đầu tiên được khai thác" },
        }
      }
    }
  },

  [RegionId.TUYEN_QUANG]: {
    id: RegionId.TUYEN_QUANG,
    name: "Trấn Tuyên Quang",
    spec: "Thủy Lô / Biên giới",
    pm: { thoc: 1.4, muoi: 1.3, go: 1.1, lua: 1.2, ruou: 1.4 },
    docTran: "Ma Thế Đạt",
    quanSoTran: 2200,
    chatLuong: TroopQuality.THUONG,
    desc: "Ngoại trấn Tây Bắc: thung lũng sông Lô – Gâm, châu thổ hiểm. Từng là địa bàn Minh Quang / An Tây thừa tuyên.",
    phu: {
      "yen_binh": {
        id: "yen_binh", name: "Phủ Yên Bình",
        triPhu: "Phạm Khắc Thận", quanSo: 480, chatLuong: TroopQuality.THUONG,
        huyen: {
          "yen_son": { id: "yen_son", name: "Huyện Yên Sơn", triHuyen: "Hoàng Đình Lương", quanSo: 55, chatLuong: TroopQuality.THUONG, desc: "Phúc Yên — cửa ngõ Hà Giang, dân thợ săn và buôn ngựa" },
          "ham_yen": { id: "ham_yen", name: "Huyện Hàm Yên", triHuyen: "Vũ Công Tuấn", quanSo: 42, chatLuong: TroopQuality.O_HOP, desc: "Núi đá vôi, ruộng bậc thang, ít quan lộ" },
          "vi_xuyen": { id: "vi_xuyen", name: "Huyện Vị Xuyên", triHuyen: "Ma Thế Thành", quanSo: 35, chatLuong: TroopQuality.O_HOP, desc: "Châu Vị Xuyên — biên Hoàng Su Phì, gió núi lạnh" },
        }
      },
      "chieu_lau": {
        id: "chieu_lau", name: "Phủ Chiêu Lưu",
        triPhu: "Đặng Minh Khôi", quanSo: 320, chatLuong: TroopQuality.O_HOP,
        huyen: {
          "son_duong_tq": { id: "son_duong_tq", name: "Huyện Sơn Dương", triHuyen: "Lê Hữu Nhân", quanSo: 38, chatLuong: TroopQuality.THUONG, desc: "Đất châu Tam Dương cũ, giáp Tuyên – Sơn Tây" },
          "yen_binh_yb": { id: "yen_binh_yb", name: "Huyện Yên Bình", triHuyen: "Trần Danh An", quanSo: 40, chatLuong: TroopQuality.THUONG, desc: "Thung lũng Yên Bái — gạo hai vụ, gỗ xuôi sông" },
        }
      }
    }
  },

  [RegionId.HUNG_HOA]: {
    id: RegionId.HUNG_HOA,
    name: "Trấn Hưng Hóa",
    spec: "Sơn Cước / Thổ Ty",
    pm: { thoc: 1.2, muoi: 1.4, go: 1.3, lua: 1.0, ruou: 1.2 },
    docTran: "Nguyễn Hữu Chấn",
    quanSoTran: 2600,
    chatLuong: TroopQuality.CHAT_LUONG,
    desc: "Ngoại trấn Tây Bắc rộng nhất: phủ Gia Hưng, Quy Hóa, An Tây — nơi thổ ty và nghĩa quân giằng co.",
    phu: {
      "gia_hung": {
        id: "gia_hung", name: "Phủ Gia Hưng",
        triPhu: "Bùi Công Thành", quanSo: 520, chatLuong: TroopQuality.THUONG,
        huyen: {
          "thanh_son": { id: "thanh_son", name: "Huyện Thanh Sơn", triHuyen: "Phạm Văn Khiêm", quanSo: 48, chatLuong: TroopQuality.THUONG, desc: "Thanh Nguyên — rừng núi Phú Thọ, dân Mường đông" },
          "mai_chau_hh": { id: "mai_chau_hh", name: "Huyện Mai Châu", triHuyen: "Mộc A Thể", quanSo: 28, chatLuong: TroopQuality.O_HOP, desc: "Thung lũng đá vôi, thổ ty cư trú lâu đời" },
        }
      },
      "quy_hoa": {
        id: "quy_hoa", name: "Phủ Quy Hóa",
        triPhu: "Đinh Bạt Tụy", quanSo: 600, chatLuong: TroopQuality.CHAT_LUONG,
        huyen: {
          "van_chan": { id: "van_chan", name: "Huyện Văn Chấn", triHuyen: "Hoàng Phúc Lợi", quanSo: 55, chatLuong: TroopQuality.CHAT_LUONG, desc: "⚔ Tây Bắc: nơi nghĩa quân Hoàng Công Chất (1745–1769) giằng co với quan quân.", historicalBattle: "hoang_cong_chat" },
          "yen_lap": { id: "yen_lap", name: "Huyện Yên Lập", triHuyen: "Lê Đình Minh", quanSo: 44, chatLuong: TroopQuality.THUONG, desc: "Đồi chè và rừng tre, đường quan lộ khúc khuỷu" },
          "van_ban": { id: "van_ban", name: "Huyện Văn Bàn", triHuyen: "Nguyễn Trọng Hòa", quanSo: 36, chatLuong: TroopQuality.O_HOP, desc: "Giáp biên Lào Cai, buôn ngựa và muối" },
        }
      }
    }
  },

  [RegionId.LANG_SON]: {
    id: RegionId.LANG_SON,
    name: "Trấn Lạng Sơn",
    spec: "Ải Quan / Mậu Dịch",
    pm: { thoc: 1.5, muoi: 1.1, go: 1.0, lua: 1.1, ruou: 1.0 },
    docTran: "Phạm Đình Tuấn",
    quanSoTran: 3200,
    chatLuong: TroopQuality.CHAT_LUONG,
    desc: "Biên trấn Đông Bắc: Ải Chi Lăng, đường sứ sang Thanh. Một phủ Trùng Khánh, nhiều châu hiểm.",
    phu: {
      "trung_khanh": {
        id: "trung_khanh", name: "Phủ Trùng Khánh",
        triPhu: "Hoàng Công Uẩn", quanSo: 900, chatLuong: TroopQuality.CAO_CAP,
        huyen: {
          "loc_binh": { id: "loc_binh", name: "Huyện Lộc Bình", triHuyen: "Vũ Hữu Thành", quanSo: 70, chatLuong: TroopQuality.CHAT_LUONG, desc: "Châu Lộc Bình — biên giới động, chợ biên mậu" },
          "van_lang_ls": { id: "van_lang_ls", name: "Huyện Văn Lãng", triHuyen: "Đỗ Minh Tuấn", quanSo: 55, chatLuong: TroopQuality.THUONG, desc: "Châu Văn Uyên — rừng lim, đường ẩy quân" },
          "chi_lang": { id: "chi_lang", name: "Huyện Chi Lăng", triHuyen: "Trần Công Lợi", quanSo: 85, chatLuong: TroopQuality.TINH_NHUE, desc: "Ải vọng Nam Quan, thương đội qua lại tấp nập" },
        }
      }
    }
  },

  [RegionId.THAI_NGUYEN]: {
    id: RegionId.THAI_NGUYEN,
    name: "Trấn Thái Nguyên",
    spec: "Ninh Sóc / Mỏ Than",
    pm: { thoc: 1.6, muoi: 1.2, go: 1.4, lua: 1.3, ruou: 1.1 },
    docTran: "Nguyễn Danh Thế",
    quanSoTran: 2800,
    chatLuong: TroopQuality.CHAT_LUONG,
    desc: "Đất Ninh Sóc cũ: núi non trùng điệp, mỏ than và trà xanh. Gần kinh hơn các trấn Tây Bắc.",
    phu: {
      "phu_binh": {
        id: "phu_binh", name: "Phủ Phú Bình",
        triPhu: "Lê Công Minh", quanSo: 550, chatLuong: TroopQuality.CHAT_LUONG,
        huyen: {
          "pho_yen": { id: "pho_yen", name: "Huyện Phổ Yên", triHuyen: "Phạm Quốc Anh", quanSo: 62, chatLuong: TroopQuality.THUONG, desc: "Thị tứ mỏ than — dân thợ đông" },
          "dai_tu": { id: "dai_tu", name: "Huyện Đại Từ", triHuyen: "Bùi Văn Thịnh", quanSo: 48, chatLuong: TroopQuality.THUONG, desc: "Chùa Hàng, đất tổ sư tổ nghề đúc" },
          "vo_nhai": { id: "vo_nhai", name: "Huyện Võ Nhai", triHuyen: "Đặng Công Trung", quanSo: 32, chatLuong: TroopQuality.O_HOP, desc: "Núi rừng hiểm, dân săn và khai thác mỏ nhỏ" },
        }
      },
      "thong_hoa": {
        id: "thong_hoa", name: "Phủ Thông Hóa",
        triPhu: "Trần Hữu Lương", quanSo: 380, chatLuong: TroopQuality.THUONG,
        huyen: {
          "ngan_son": { id: "ngan_son", name: "Huyện Ngân Sơn", triHuyen: "Ma Văn Thắng", quanSo: 28, chatLuong: TroopQuality.O_HOP, desc: "Bắc Kạn — châu Cảm Hóa, rừng già" },
          "cho_don": { id: "cho_don", name: "Huyện Chợ Đồn", triHuyen: "Lý Công Tuấn", quanSo: 35, chatLuong: TroopQuality.THUONG, desc: "Chợ biên giới gỗ và mật ong" },
        }
      }
    }
  },

  [RegionId.CAO_BINH]: {
    id: RegionId.CAO_BINH,
    name: "Trấn Cao Bình",
    spec: "Biên Thùy / Thổ Ty",
    pm: { thoc: 1.1, muoi: 1.3, go: 1.0, lua: 1.0, ruou: 1.0 },
    docTran: "Hoàng Phúc Lai",
    quanSoTran: 1800,
    chatLuong: TroopQuality.THUONG,
    desc: "Lập sau khi dẹp họ Mạc (1677): đất Cao Bằng — châu động, đường mậu dịch sang Thanh.",
    phu: {
      "thach_lam": {
        id: "thach_lam", name: "Phủ Thạch Lâm",
        triPhu: "Nông Văn Thành", quanSo: 420, chatLuong: TroopQuality.THUONG,
        huyen: {
          "hoa_an": { id: "hoa_an", name: "Huyện Hòa An", triHuyen: "Triệu Văn Hùng", quanSo: 40, chatLuong: TroopQuality.O_HOP, desc: "Châu Thạch Lâm — núi đá vôi, ruộng bậc" },
          "nguyen_binh": { id: "nguyen_binh", name: "Huyện Nguyên Bình", triHuyen: "Ma Văn Đạt", quanSo: 35, chatLuong: TroopQuality.O_HOP, desc: "Quảng Uyên — thổ ty Nùng, buôn ngựa" },
        }
      },
      "ha_lang": {
        id: "ha_lang", name: "Phủ Hạ Lang",
        triPhu: "Hoàng Văn Phúc", quanSo: 360, chatLuong: TroopQuality.O_HOP,
        huyen: {
          "ha_lang": { id: "ha_lang_h", name: "Huyện Hạ Lang", triHuyen: "Nông Văn Lợi", quanSo: 32, chatLuong: TroopQuality.O_HOP, desc: "Biên giới — chợ phiên sớm tối" },
          "tra_linh": { id: "tra_linh", name: "Huyện Trà Lĩnh", triHuyen: "Lý Văn Tuấn", quanSo: 38, chatLuong: TroopQuality.THUONG, desc: "Thượng Lang — đèo gió, trà xanh" },
        }
      }
    }
  },

  [RegionId.THANH_HOA]: {
    id: RegionId.THANH_HOA,
    name: "Trấn Thanh Hóa",
    spec: "Thanh Địa / Võ Dũng",
    pm: { thoc: 1.0, muoi: 1.0, go: 1.2, lua: 0.9, ruou: 1.1 },
    docTran: "Lê Đình Hoan",
    quanSoTran: 4500,
    chatLuong: TroopQuality.CHAT_LUONG,
    desc: "Thanh Hóa nội — đất Lam Sơn, nhiều võ tướng. Giáp Nghệ An, là cứ điểm khởi nghĩa Thanh – Nghệ.",
    phu: {
      "thieu_thien": {
        id: "thieu_thien", name: "Phủ Thiệu Thiên",
        triPhu: "Phạm Đình Trọng", quanSo: 800, chatLuong: TroopQuality.CAO_CAP,
        huyen: {
          "tho_xuan_th": { id: "tho_xuan_th", name: "Huyện Thọ Xuân", triHuyen: "Nguyễn Hữu Dật", quanSo: 120, chatLuong: TroopQuality.CHAT_LUONG, desc: "⚔ Lôi Dương — địa bàn cốt lõi khởi nghĩa Lê Duy Mật (1738+). Rừng núi hiểm.", historicalBattle: "le_duy_mat" },
          "thach_thanh": { id: "thach_thanh", name: "Huyện Thạch Thành", triHuyen: "Lê Văn Nhân", quanSo: 90, chatLuong: TroopQuality.THUONG, desc: "Đá ong, thành lũy cổ, dân khí mạnh" },
          "cam_thuy": { id: "cam_thuy", name: "Huyện Cẩm Thủy", triHuyen: "Trần Danh Lâm", quanSo: 75, chatLuong: TroopQuality.THUONG, desc: "Ven biển Thanh, muối và cá" },
        }
      },
      "ha_trung": {
        id: "ha_trung", name: "Phủ Hà Trung",
        triPhu: "Đỗ Văn Thành", quanSo: 500, chatLuong: TroopQuality.THUONG,
        huyen: {
          "hoang_hoa": { id: "hoang_hoa", name: "Huyện Hoằng Hóa", triHuyen: "Vũ Công Tuấn", quanSo: 85, chatLuong: TroopQuality.THUONG, desc: "Đồng bằng sông Mã, lúa dày" },
          "ha_trung_h": { id: "ha_trung_h", name: "Huyện Hà Trung", triHuyen: "Phạm Minh Khiêm", quanSo: 70, chatLuong: TroopQuality.THUONG, desc: "Tống Sơn — nghề mộc và gốm" },
        }
      }
    }
  },

  [RegionId.NGHE_AN]: {
    id: RegionId.NGHE_AN,
    name: "Trấn Nghệ An",
    spec: "Thanh – Nghệ / Sông Cả",
    pm: { thoc: 1.1, muoi: 1.0, go: 1.1, lua: 1.0, ruou: 1.2 },
    docTran: "Trịnh Công Kỳ",
    quanSoTran: 4200,
    chatLuong: TroopQuality.CHAT_LUONG,
    desc: "Xứ Nghệ — hai phủ Diễn Châu, Anh Đô. Rừng núi giáp Lào, nơi nghĩa quân Lê Duy Mật kéo dài kháng chiến.",
    phu: {
      "dien_chau": {
        id: "dien_chau", name: "Phủ Diễn Châu",
        triPhu: "Nguyễn Đình Huấn", quanSo: 750, chatLuong: TroopQuality.CHAT_LUONG,
        huyen: {
          "dien_chau_h": { id: "dien_chau_h", name: "Huyện Diễn Châu", triHuyen: "Phan Văn Lợi", quanSo: 110, chatLuong: TroopQuality.CHAT_LUONG, desc: "Đông Thành — cửa biển, buôn muối cá" },
          "quynh_luu": { id: "quynh_luu", name: "Huyện Quỳnh Lưu", triHuyen: "Hoàng Văn Thịnh", quanSo: 95, chatLuong: TroopQuality.THUONG, desc: "Đất học, nhiều am chùa" },
          "yen_thanh_na": { id: "yen_thanh_na", name: "Huyện Yên Thành", triHuyen: "Lê Công Dũng", quanSo: 88, chatLuong: TroopQuality.THUONG, desc: "Ven Lam — dân phục tùng nghĩa quân thời loạn" },
        }
      },
      "anh_do": {
        id: "anh_do", name: "Phủ Anh Đô",
        triPhu: "Bùi Đình Nhân", quanSo: 620, chatLuong: TroopQuality.THUONG,
        huyen: {
          "hung_nguyen": { id: "hung_nguyen", name: "Huyện Hưng Nguyên", triHuyen: "Trần Văn Tuấn", quanSo: 92, chatLuong: TroopQuality.THUONG, desc: "Nam Đường — ruộng lúa và dệt" },
          "anh_son": { id: "anh_son", name: "Huyện Anh Sơn", triHuyen: "Phạm Công Trung", quanSo: 72, chatLuong: TroopQuality.THUONG, desc: "Núi đá vôi — hang sâu, tụ nghĩa" },
        }
      }
    }
  },
};

// Các trận chiến lịch sử cụ thể (dùng cho historicalBattle key)
// Tướng triều theo mốc năm: tham khảo tổng quan phong trào & nhân vật (Phạm Đình Trọng, Hoàng Ngũ Phúc, v.v.)
// https://vi.wikipedia.org/wiki/Kh%E1%BB%9Fi_ngh%C4%A9a_n%C3%B4ng_d%C3%A2n_%C4%90%C3%A0ng_Ngo%C3%A0i
// Chúa Trịnh không dùng làm tướng mặt trận song song nhiều cửa — chỉ huy từ Trấn Bắc, tiền tuyến giao đại thần / thống lĩnh.

/** Gán defCommander / atkCommander theo năm game (băng [fromYear,toYear]). */
function applyCommanderYearBands(hb, year) {
  if (!hb) return hb;
  const out = { ...hb };
  const db = hb.defCommanderBands;
  if (Array.isArray(db)) {
    const hit = db.find(b => year >= b.fromYear && year <= b.toYear);
    if (hit) {
      if (hit.defCommander) out.defCommander = hit.defCommander;
      if (hit.defCommanderStat != null) out.defCommanderStat = hit.defCommanderStat;
      if (hit.defName) out.defName = hit.defName;
    }
  }
  const ab = hb.atkCommanderBands;
  if (Array.isArray(ab)) {
    const hit = ab.find(b => year >= b.fromYear && year <= b.toYear);
    if (hit) {
      if (hit.atkCommander) out.atkCommander = hit.atkCommander;
      if (hit.atkCommanderStat != null) out.atkCommanderStat = hit.atkCommanderStat;
    }
  }
  return out;
}

export const HistoricalBattles = {
  "duong_hung": {
    id: "duong_hung",
    name: "Khởi nghĩa Nguyễn Dương Hưng",
    startYear: 1737, endYear: 1738,
    atkName: "Nguyễn Dương Hưng", defName: "Quân Triều Đình",
    atkCommander: "Nguyễn Dương Hưng",  defCommander: "Hoàng Công Kỳ",
    atkCommanderStat: 56, defCommanderStat: 62,
    atkQual: "O_HOP", defQual: "CHAT_LUONG",
    atkArmies: [{type:"dan_binh", count:200}], defArmies: [{type:"nhat_binh", count: 1000}, {type:"khinh_ky", count: 200}],
    baseAtkForce: 300, baseDefForce: 1500,
    desc: "Nhà sư Dương Hưng phất cờ tại Tam Đảo, nhưng thế lực còn yếu, triều đình sớm dẹp tan.",
    result: "def_win"
  },
  "nguyen_cu": {
    id: "nguyen_cu",
    name: "Khởi nghĩa Ninh Xá - Nguyễn Cừ",
    startYear: 1739, endYear: 1741,
    atkName: "Nguyễn Tuyển, Nguyễn Cừ", defName: "Quân Triều Đình",
    atkCommander: "Nguyễn Cừ", defCommander: "Phạm Đình Trọng",
    atkCommanderStat: 58, defCommanderStat: 70,
    defCommanderBands: [
      { fromYear: 1739, toYear: 1739, defCommander: "Hoàng Nghĩa Bá (thống Hải Dương)", defCommanderStat: 67 },
      { fromYear: 1740, toYear: 1741, defCommander: "Phạm Đình Trọng", defCommanderStat: 70 },
    ],
    atkQual: "O_HOP", defQual: "THUONG",
    atkArmies: [{type:"dan_binh", count:1000}, {type:"cung_no", count:300}], defArmies: [{type:"nhat_binh", count: 2000}, {type:"thuong_binh", count: 500}, {type:"dieu_thuong", count: 200}],
    baseAtkForce: 1500, baseDefForce: 3000,
    desc: "Hai anh em Nguyễn Tuyển, Nguyễn Cừ tập hợp dân nghèo đói khắp Sơn Nam - Hải Dương nổi dậy.",
    result: "prolonged"
  },
  "quat_he": {
    id: "quat_he",
    name: "Nguyễn Hữu Cầu (Quận He) hoành hành",
    startYear: 1743, endYear: 1751,
    atkName: "Quận He - Nguyễn Hữu Cầu", defName: "Đạo quân phủ Trịnh (Hải Dương — Kinh Bắc)",
    atkCommander: "Nguyễn Hữu Cầu", defCommander: "Hoàng Ngũ Phúc",
    atkCommanderStat: 74, defCommanderStat: 71,
    defCommanderBands: [
      { fromYear: 1743, toYear: 1745, defCommander: "Hoàng Ngũ Phúc", defCommanderStat: 72 },
      { fromYear: 1746, toYear: 1748, defCommander: "Phạm Đình Trọng", defCommanderStat: 70 },
      { fromYear: 1749, toYear: 1749, defCommander: "Đinh Văn Giai", defCommanderStat: 66 },
      { fromYear: 1750, toYear: 1751, defCommander: "Phạm Đình Trọng", defCommanderStat: 71 },
    ],
    atkQual: "CHAT_LUONG", defQual: "TINH_NHUE",
    atkArmies: [{type:"dan_binh", count:3000}, {type:"nhat_binh", count: 1000}, {type:"khinh_ky", count: 300}], defArmies: [{type:"uu_binh", count: 3000}, {type:"tuong_binh", count: 200}, {type:"phao_binh", count: 50}],
    baseAtkForce: 5000, baseDefForce: 8000,
    desc: "Quận He là thủ lĩnh kiệt xuất nhất, chiếm đóng rộng lớn. Quân lực dũng mãnh, thủy quân mạnh mẽ.",
    result: "prolonged"
  },
  "danh_phuong": {
    id: "danh_phuong",
    name: "Nguyễn Danh Phương xưng hùng Hương Canh",
    startYear: 1740, endYear: 1751,
    atkName: "Nguyễn Danh Phương", defName: "Quân Sơn Tây triều đình",
    atkCommander: "Nguyễn Danh Phương", defCommander: "Hoàng Công Kỳ",
    atkCommanderStat: 66, defCommanderStat: 62,
    defCommanderBands: [
      { fromYear: 1740, toYear: 1745, defCommander: "Hoàng Công Kỳ (trấn thủ Sơn Nam)", defCommanderStat: 62 },
      { fromYear: 1746, toYear: 1751, defCommander: "Vũ Tá Lý (Sơn Tây)", defCommanderStat: 68 },
    ],
    atkQual: "THUONG", defQual: "CAO_CAP",
    atkArmies: [{type:"nhat_binh", count:1500}, {type:"cung_no", count: 500}], defArmies: [{type:"bo_binh_nang", count: 2000}, {type:"trong_ky", count: 300}],
    baseAtkForce: 3000, baseDefForce: 5000,
    desc: "Nguyễn Danh Phương dựng căn cứ ở Hương Canh, Sơn Tây; đánh phá nhiều nơi, dựa vào vùng núi rừng hiểm trở chống trả quan quân.",
    result: "prolonged"
  },
  "le_duy_mat": {
    id: "le_duy_mat",
    name: "Lê Duy Mật phất cờ khởi nghĩa Thanh - Nghệ",
    startYear: 1738, endYear: 1770,
    atkName: "Nghĩa quân Lê Duy Mật", defName: "Quân Thanh Hóa — trấn áp Lôi Dương",
    atkCommander: "Lê Duy Mật", defCommander: "Đinh Bạt Tụy",
    atkCommanderStat: 68, defCommanderStat: 61,
    defCommanderBands: [
      { fromYear: 1738, toYear: 1742, defCommander: "Đinh Bạt Tụy", defCommanderStat: 61 },
      { fromYear: 1743, toYear: 1764, defCommander: "Phạm Đình Trọng", defCommanderStat: 69 },
      { fromYear: 1765, toYear: 1770, defCommander: "Nguyễn Phan (đạo Thanh Hóa)", defCommanderStat: 72 },
    ],
    atkQual: "CHAT_LUONG", defQual: "CAO_CAP",
    atkArmies: [{type:"dan_binh", count: 4000}, {type:"thuong_binh", count: 1000}, {type:"cung_no", count: 800}], defArmies: [{type:"uu_binh", count: 2500}, {type:"trong_ky", count: 800}, {type:"phao_binh", count: 100}],
    baseAtkForce: 6000, baseDefForce: 7000,
    desc: "Lê Duy Mật là hoàng thân quốc thích nổi dậy trừng trị quyền thần họ Trịnh. Dựa vào địa hình rừng núi hiểm trở Thanh - Nghệ, nghĩa quân giằng co hàng chục năm không dứt.",
    result: "prolonged"
  },
  "hoang_cong_chat": {
    id: "hoang_cong_chat",
    name: "Khởi nghĩa Hoàng Công Chất Tây Bắc",
    startYear: 1745, endYear: 1769,
    atkName: "Nghĩa Quân Tây Bắc", defName: "Đạo quân Tây Bắc (phủ Trịnh)",
    atkCommander: "Hoàng Công Chất", defCommander: "Hoàng Ngũ Phúc",
    atkCommanderStat: 69, defCommanderStat: 71,
    defCommanderBands: [
      { fromYear: 1745, toYear: 1750, defCommander: "Hoàng Ngũ Phúc", defCommanderStat: 71 },
      { fromYear: 1751, toYear: 1768, defCommander: "Phạm Đình Trọng", defCommanderStat: 70 },
      { fromYear: 1769, toYear: 1769, defCommander: "Đoàn Nguyễn Thục (đạo Sơn Tây)", defCommanderStat: 69 },
    ],
    atkQual: "THUONG", defQual: "TINH_NHUE",
    atkArmies: [{type:"dan_binh", count: 3000}, {type:"nhat_binh", count: 1200}, {type:"tuong_binh", count: 100}], defArmies: [{type:"uu_binh", count: 3500}, {type:"dieu_thuong", count: 1000}, {type:"phao_binh", count: 250}],
    baseAtkForce: 4500, baseDefForce: 8500,
    desc: "Hoàng Công Chất đem nghĩa quân từ Sơn Nam dạt lên vùng Tây Bắc, tập hợp các dân tộc thiểu số đóng giữ vùng sơn cước. Triều đình dốc toàn lực hỏa khí pháo binh tiến công đàn áp.",
    result: "prolonged"
  }
};

export function getBattleState(state, battleId) {
  const hbRaw = HistoricalBattles[battleId];
  if (!hbRaw) return null;
  const year = state.ban ?? 1737;
  const live = state?._battleSim?.[battleId];

  // Luôn ưu tiên snapshot tiền tuyến (kể cả năm ngoài catalog) để UI/logic tick khớp nhau.
  if (live && (live.active || live.ended)) {
    const yBand = Math.min(Math.max(year, hbRaw.startYear), hbRaw.endYear);
    const hb = applyCommanderYearBands(hbRaw, yBand);
    const th = Math.max(5, Math.min(95, live.thangVong ?? 50));
    const atkForce = Math.max(0, Math.round(live.atkForce ?? 0));
    const defForce = Math.max(0, Math.round(live.defForce ?? 0));
    const atkMoraleLive = typeof live.atkMorale === "number" ? live.atkMorale : 60 + (th - 50) * 0.5;
    const defMoraleLive = typeof live.defMorale === "number" ? live.defMorale : 60 - (th - 50) * 0.5;
    const atkLuongLive = typeof live.atkLuong === "number" ? live.atkLuong : 55 + (th - 50) * 0.2;
    const defLuongLive = typeof live.defLuong === "number" ? live.defLuong : 55 - (th - 50) * 0.2;
    const battleStartAtk = Math.max(1, Math.round(live.startAtk ?? atkForce ?? 1));
    const battleStartDef = Math.max(1, Math.round(live.startDef ?? defForce ?? 1));
    const battleDay = Math.max(0, Math.floor(live.daysElapsed ?? 0));
    return {
      ...hb,
      atkForce, defForce,
      thangVong: th,
      daysElapsed: live.daysElapsed ?? (year - hb.startYear) * 360 + state.monthIndex * 30 + state.gameDay,
      battleDay,
      battleStartAtk,
      battleStartDef,
      atkMorale: Math.max(4, Math.min(100, Math.round(atkMoraleLive))),
      defMorale: Math.max(4, Math.min(100, Math.round(defMoraleLive))),
      atkLuong: Math.max(4, Math.min(100, Math.round(atkLuongLive))),
      defLuong: Math.max(4, Math.min(100, Math.round(defLuongLive))),
      atkKnights: live.atkKnights || 0,
      defKnights: live.defKnights || 0,
      atkMenAtArm: hb.atkArmies?.map(a => a.type) || ["dan_binh"],
      defMenAtArm: hb.defArmies?.map(a => a.type) || ["nhat_binh"],
      atkQualObj: TroopQuality[hb.atkQual] || TroopQuality.THUONG,
      defQualObj: TroopQuality[hb.defQual] || TroopQuality.THUONG,
      isActive: !!live.active
    };
  }

  // Khởi nghĩa kéo dài: cho phép mô phỏng/placeholder sớm ~2 năm; trận ngắn: sớm 1 năm (tiền trận).
  const early = hbRaw.result === "prolonged" ? 2 : 1;
  if (year > hbRaw.endYear) return null;
  if (year < hbRaw.startYear - early) return null;

  const bandYear = Math.min(Math.max(year, hbRaw.startYear), hbRaw.endYear);
  const hb = applyCommanderYearBands(hbRaw, bandYear);

  // Deterministic pseudo-random per day for stable UI (avoid changing forces each render)
  function battleRand(seedStr) {
    let s = 0;
    for (let i = 0; i < seedStr.length; i++) s = (s * 33 + seedStr.charCodeAt(i)) >>> 0;
    // xorshift32
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17; s >>>= 0;
    s ^= s << 5;  s >>>= 0;
    return (s % 10000) / 10000;
  }
  const daySeed = `${battleId}|${state.ban}|${state.monthIndex}|${state.gameDay}`;

  // Tính tiến độ trận chiến theo năm + random (năm trước startYear coi như tiền trận: offset 0)
  const effectiveYear = Math.max(year, hb.startYear);
  const yearOffset = effectiveYear - hb.startYear;
  const totalDuration = hb.endYear - hb.startYear + 0.5;
  let baseProg = yearOffset / totalDuration; // 0..1

  // chaos modifier
  const chaos = (state._battleChaos?.[battleId] || 0.5);
  const thangVong = Math.round(40 + baseProg * 20 + (chaos - 0.5) * 30);

  let atkForce = Math.round(hb.baseAtkForce * (1 - baseProg * 0.6) * (0.7 + battleRand(daySeed + "|a") * 0.3));
  let defForce = Math.round(hb.baseDefForce * (1 - baseProg * 0.3) * (0.8 + battleRand(daySeed + "|d") * 0.2));

  // Player contribution / interventions
  const contrib = state._battleContrib?.[battleId];
  if (contrib?.atk) atkForce += Math.round(contrib.atk);
  if (contrib?.def) defForce += Math.round(contrib.def);

  const battleDay = yearOffset * 360 + state.monthIndex * 30 + state.gameDay;
  return {
    ...hb,
    atkForce, defForce,
    thangVong: Math.max(5, Math.min(95, thangVong)),
    daysElapsed: battleDay,
    battleDay,
    battleStartAtk: Math.max(1, atkForce),
    battleStartDef: Math.max(1, defForce),
    atkMorale: Math.round(60 + (thangVong - 50) * 0.5),
    defMorale: Math.round(60 - (thangVong - 50) * 0.5),
    atkLuong: Math.round(40 + rng(state) * 40),
    defLuong: Math.round(50 + rng(state) * 40),
    atkKnights: Math.max(1, Math.floor(atkForce / 1800)),
    defKnights: Math.max(1, Math.floor(defForce / 1800)),
    atkMenAtArm: hb.atkArmies?.map(a => a.type) || ["dan_binh"],
    defMenAtArm: hb.defArmies?.map(a => a.type) || ["nhat_binh"],
    atkQualObj: TroopQuality[hb.atkQual] || TroopQuality.THUONG,
    defQualObj: TroopQuality[hb.defQual] || TroopQuality.THUONG,
    isActive: true
  };
}

export function getAllRegions() {
  return Object.values(MapData);
}

export function getRegion(regionId) {
  return MapData[regionId];
}

export function getBattleLocation(battleId) {
  // Find which huyen hosts a historical battle
  for (const r of Object.values(MapData)) {
    for (const [phuId, ph] of Object.entries(r.phu || {})) {
      for (const [huyenId, h] of Object.entries(ph.huyen || {})) {
        if (h?.historicalBattle === battleId) {
          return { regionId: r.id, phuId, huyenId, huyenName: h.name || huyenId };
        }
      }
    }
  }
  return null;
}

// === HỆ THỐNG SINH ĐỊA LÝ ĐỘNG (PROCEDURAL GEOGRAPHY) ===
const GeoPrefixes = ["An", "Bình", "Thái", "Yên", "Phúc", "Lộc", "Gia", "Đông", "Tây", "Nam", "Bắc", "Trung", "Cẩm", "Mỹ", "Hòa", "Thịnh", "Hưng", "Tân", "Phú", "Bảo", "Đại", "Vạn", "Thiên"];
const GeoSuffixes = ["Khê", "Lâm", "Xá", "Đình", "Thôn", "Đoài", "Kiều", "Giang", "Hải", "Động", "Cốc", "Châu", "Môn", "Sơn", "Lăng", "Tĩnh", "Bạt", "Lập"];

function seededRandom(seed) {
    let x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}
function genGeoName(seedStr) {
    let s = 0;
    for(let i=0; i<seedStr.length; i++) s += seedStr.charCodeAt(i);
    let p1 = GeoPrefixes[Math.floor(seededRandom(s) * GeoPrefixes.length)];
    let p2 = GeoSuffixes[Math.floor(seededRandom(s+1) * GeoSuffixes.length)];
    return p1 + " " + p2;
}

/**
 * Lấy hoặc sinh tự động Bản đồ cấp dưới Huyện (Tổng -> Xã -> Làng)
 * Lưu vào state._geoCache để không thay đổi sau mỗi lần load.
 */
export function getLowerRegions(state, huyenId) {
    if (!state._geoCache) state._geoCache = {};
    if (state._geoCache[huyenId]) return state._geoCache[huyenId];
    
    // Seed generation based on huyenId
    let numTong = 5 + Math.floor(rng(state) * 6); // 5-10 Tổng
    let data = { tong: {} };
    let globalPop = 0;
    
    for (let t = 0; t < numTong; t++) {
        let tId = huyenId + "_t" + t;
        let tName = "Tổng " + genGeoName(tId);
        let tong = { id: tId, name: tName, xa: {}, pop: 0, suatDinh: 0, control: "trieu_dinh" };
        
        let numXa = 3 + Math.floor(rng(state) * 4); // 3-6 Xã
        for (let x = 0; x < numXa; x++) {
            let xId = tId + "_x" + x;
            let xName = "Xã " + genGeoName(xId);
            let xa = { id: xId, name: xName, lang: {}, pop: 0, suatDinh: 0, control: "trieu_dinh" };
            
            let numLang = 2 + Math.floor(rng(state) * 4); // 2-5 Làng
            for (let l = 0; l < numLang; l++) {
                let lId = xId + "_l" + l;
                let isThon = rng(state) > 0.5;
                let lName = (isThon ? "Thôn " : "Làng ") + genGeoName(lId);
                let pop = 300 + Math.floor(rng(state) * 501); // 300-800
                let suat = Math.floor(pop / 5);
                xa.lang[lId] = { id: lId, name: lName, pop, suatDinh: suat };
                xa.pop += pop;
                xa.suatDinh += suat;
            }
            tong.xa[xId] = xa;
            tong.pop += xa.pop;
            tong.suatDinh += xa.suatDinh;
        }
        data.tong[tId] = tong;
        globalPop += tong.pop;
    }
    data.totalPop = globalPop;
    data.totalSuatDinh = Math.floor(globalPop/5);
    state._geoCache[huyenId] = data;
    return data;
}
export function getPhu(regionId, phuId) {
  return MapData[regionId]?.phu?.[phuId];
}

export function getHuyen(regionId, phuId, huyenId) {
  return MapData[regionId]?.phu?.[phuId]?.huyen?.[huyenId];
}

/** Hoàng thành / Kinh thành (nếu trấn có định nghĩa). */
export function getKinhThanh(regionId) {
  return MapData[regionId]?.kinhThanh || null;
}

/**
 * lifestyle.js — Hệ thống Lối Sống XP-based (chậm, cross-tree)
 * Mỗi hoạt động phù hợp → +XP, đủ XP → mở 1 tầng, mỗi perk tốn điểm riêng
 */

export const LifestyleId = {
  NGOAI_GIAO: "ngoai_giao",
  HOC_THUAT:  "hoc_thuat",
  QUAN_SU:    "quan_su",
  QUAN_LY:    "quan_ly",
  AM_MUU:     "am_muu",
};

export const LifestyleLabel = {
  [LifestyleId.NGOAI_GIAO]: "Ngoại Giao",
  [LifestyleId.HOC_THUAT]:  "Học Thuật",
  [LifestyleId.QUAN_SU]:    "Quân Sự",
  [LifestyleId.QUAN_LY]:    "Quản Lý",
  [LifestyleId.AM_MUU]:     "Âm Mưu",
};

export const LifestyleIcon = {
  [LifestyleId.NGOAI_GIAO]: "🕊️",
  [LifestyleId.HOC_THUAT]:  "📚",
  [LifestyleId.QUAN_SU]:    "⚔️",
  [LifestyleId.QUAN_LY]:    "📜",
  [LifestyleId.AM_MUU]:     "🗡️",
};

// XP cần để đạt mỗi tầng (tier) — tích lũy, chơi ~1 năm mới qua vài tầng
export const XP_PER_TIER = [0, 60, 150, 280, 450, 660, 900]; // tier 1..6

// XP mỗi tháng tùy lối sống focus (nếu chọn) — thụ động
export const FOCUS_XP_PER_MONTH = 4;
// XP từ hoạt động thủ công (gọi từ action tương ứng)
// Gọi addLifestyleXP(state, lid, amount) trong các action

export const LifestyleFocusEffect = {
  [LifestyleId.NGOAI_GIAO]: {
    desc: "Mỗi tháng: tất cả NPC quen +3 cảm tình, uy tín nhận được ×1.1",
    apply(state) {
      state.npcs.forEach(n => { if (n.opinion > -50) n.opinion = Math.min(100, n.opinion + 3); });
      state.player.uyTinCong = Math.floor(state.player.uyTinCong * 1.1);
    }
  },
  [LifestyleId.HOC_THUAT]: {
    desc: "Mỗi tháng: tự động +1 Học Vấn mỗi 4 tháng, chi phí học giảm 15%",
    apply(state) {
      state.player._hocThuatAccum = (state.player._hocThuatAccum || 0) + 1;
      if (state.player._hocThuatAccum >= 4) {
        state.player.hocVan = Math.min(100, state.player.hocVan + 1);
        state.player._hocThuatAccum -= 4;
      }
    }
  },
  [LifestyleId.QUAN_SU]: {
    desc: "Mỗi tháng: lương quân giảm 10%, quân đội chiến đấu hiệu quả hơn",
    apply(state) { state._quanSuFocus = true; }
  },
  [LifestyleId.QUAN_LY]: {
    desc: "Mỗi tháng: thu nhập bất động sản & buôn bán ×1.10",
    apply(state) { state._quanLyBonus = 1.10; }
  },
  [LifestyleId.AM_MUU]: {
    desc: "Mỗi tháng: +2 Mưu Mẹo, tỉ lệ gian kế thành công ×1.20",
    apply(state) {
      state.player.muuMeo = Math.min(100, state.player.muuMeo + 2);
      state._amMuuBonus = 1.20;
    }
  },
};

function setFx(p, patch) {
  if (!p.perkFx) p.perkFx = {};
  Object.assign(p.perkFx, patch);
}

export const PerkTrees = {
  [LifestyleId.NGOAI_GIAO]: [
    { id:"ng_01", name:"Miệng Nam Mô",       desc:"+5 Ngoại Giao. Đàm phán/hoà giải dễ hơn.",                tier:1, cost:2, require:null,   apply(p){p.ngoaiGiao+=5;} },
    { id:"ng_02", name:"Lời Ngon Tiếng Ngọt",desc:"+8 Ngoại Giao. Mời rượu hiệu quả x2.",                     tier:1, cost:2, require:null,   apply(p){p.ngoaiGiao+=8; setFx(p,{ruouMult:2.0});} },
    { id:"ng_03", name:"Kết Giao Rộng Khắp", desc:"+10 Ngoại Giao. Uy tín từ event/quan vụ ×1.10.",           tier:2, cost:3, require:"ng_01", apply(p){p.ngoaiGiao+=10; setFx(p,{prestigeMult:1.10});} },
    { id:"ng_04", name:"Giao Thiệp Phủ Huyện",desc:"+10 Ngoại Giao. Lo lót & giấy tờ -20%.",                  tier:2, cost:3, require:"ng_02", apply(p){p.ngoaiGiao+=10; setFx(p,{bribeCostMult:0.8});} },
    { id:"ng_05", name:"Tiếng Tăm Lan Xa",   desc:"+15 Danh Vọng. Khi chiêu an/điều nhiệm dễ được nể.",       tier:2, cost:3, require:"ng_01", apply(p){p.danhVong+=15; setFx(p,{orderGrace:1});} },
    { id:"ng_06", name:"Mạng Lưới Tin Tức",  desc:"Mỗi tháng: có 1 tin mật (gợi ý event/chiến báo).",         tier:3, cost:4, require:"ng_03", apply(p){p.ngoaiGiao+=6; setFx(p,{intelPerMonth:1});} },
    { id:"ng_07", name:"Chiêu Đãi Thượng Lưu",desc:"+8 Ngoại Giao. Mời quan cao cấp đến dinh.",              tier:3, cost:4, require:"ng_04", apply(p){p.ngoaiGiao+=8;} },
    { id:"ng_08", name:"Tay Trong Phủ Chúa", desc:"+15 Ngoại Giao. Chi phí thăng chức giảm 30%.",            tier:3, cost:4, require:"ng_05", apply(p){p.ngoaiGiao+=15;} },
    { id:"ng_09", name:"Trọng Thần Khắp Nơi",desc:"+10 Ngoại Giao. Có thể thuyết phục NPC đổi phe.",        tier:4, cost:5, require:"ng_06", apply(p){p.ngoaiGiao+=10;} },
    { id:"ng_10", name:"Hòa Giải Đại Gia",   desc:"Ngăn được 1 cuộc xung đột NPC/tháng.",                    tier:4, cost:5, require:"ng_07", apply(p){p.ngoaiGiao+=8;} },
    { id:"ng_11", name:"Sứ Thần Bất Bại",    desc:"+20 Ngoại Giao. Ép nghỉ chiến với kẻ thù.",               tier:4, cost:5, require:"ng_08", apply(p){p.ngoaiGiao+=20;} },
    { id:"ng_12", name:"Đại Sứ Thiên Tử",    desc:"+15 Ngoại +100 Uy Tín. Event đặc biệt từ Phủ Chúa.",     tier:5, cost:6, require:"ng_09", apply(p){p.ngoaiGiao+=15;p.uyTinCong+=100;} },
    { id:"ng_13", name:"Người Nối Cầu",       desc:"-50% nội chiến lan vào vùng mình.",                       tier:5, cost:6, require:"ng_10", apply(p){p.ngoaiGiao+=10;} },
    { id:"ng_14", name:"Lưỡi Kiếm Bạch Ngọc",desc:"Thuyết phục bất kỳ NPC khi Ngoại Giao > 80.",            tier:5, cost:6, require:"ng_11", apply(p){p.ngoaiGiao+=12;} },
    { id:"ng_15", name:"Bá Vương Ngoại Giao", desc:"+200 Uy Tín. Mọi NPC chủ động tìm hợp tác.",            tier:6, cost:8, require:"ng_12", apply(p){p.ngoaiGiao+=20;p.uyTinCong+=200;} },
  ],
  [LifestyleId.HOC_THUAT]: [
    { id:"ht_01", name:"Nghiền Văn Chương",   desc:"+5 Học Vấn. Mua sách -20% chi phí.",                     tier:1, cost:2, require:null,   apply(p){p.hocVan+=5;} },
    { id:"ht_02", name:"Thiên Phú Ngôn Ngữ",  desc:"+6 Học Vấn. Hiểu văn bản quan trường.",                 tier:1, cost:2, require:null,   apply(p){p.hocVan+=6;} },
    { id:"ht_03", name:"Mãi Miết Kinh Điển",  desc:"+10 Học Vấn. Tỉ lệ thi đỗ +15%.",                      tier:2, cost:3, require:"ht_01", apply(p){p.hocVan+=10;} },
    { id:"ht_04", name:"Biện Thuyết Sắc Bén",  desc:"+8 Học Vấn. Thắng tranh luận với quan lại.",           tier:2, cost:3, require:"ht_02", apply(p){p.hocVan+=8;} },
    { id:"ht_05", name:"Kiến Thức Binh Pháp",  desc:"+5 Học Vấn, +5 Võ Thuật. Đọc Tôn Tử.",               tier:2, cost:3, require:"ht_01", apply(p){p.hocVan+=5;p.voThuat+=5;} },
    { id:"ht_06", name:"Cử Nhân Văn Khoa",    desc:"+12 Học Vấn. Giảm 25% chi phí thi Hương.",             tier:3, cost:4, require:"ht_03", apply(p){p.hocVan+=12;} },
    { id:"ht_07", name:"Sử Gia Địa Phương",   desc:"+10 Học Vấn, +50 Danh Vọng khi đỗ đạt.",              tier:3, cost:4, require:"ht_04", apply(p){p.hocVan+=10;} },
    { id:"ht_08", name:"Thông Thái Mảng Kỳ",  desc:"+15 Học Vấn, +5 Quản Lý.",                            tier:3, cost:4, require:"ht_05", apply(p){p.hocVan+=15;p.quanLy+=5;} },
    { id:"ht_09", name:"Bậc Tiến Sĩ Thực Học",desc:"+15 Học Vấn. Thi Đình +20% thành công.",              tier:4, cost:5, require:"ht_06", apply(p){p.hocVan+=15;} },
    { id:"ht_10", name:"Quản Lý Thực Tiễn",   desc:"+10 Quản Lý. Đề xuất cải cách thuế.",                 tier:4, cost:5, require:"ht_07", apply(p){p.quanLy+=10;} },
    { id:"ht_11", name:"Thiên Văn Địa Lý",    desc:"+10 Học Vấn. Thấy trước thời tiết tháng tới.",          tier:4, cost:5, require:"ht_08", apply(p){p.hocVan+=10; setFx(p,{weatherForecast:1});} },
    { id:"ht_12", name:"Đại Học Giả Đàng Ngoài",desc:"+20 Học Vấn, +150 Danh Vọng. Học trò mang tiền.",  tier:5, cost:6, require:"ht_09", apply(p){p.hocVan+=20;p.danhVong+=150;} },
    { id:"ht_13", name:"Bộ Sách Truyền Đời",  desc:"+15 Học Vấn. Con kế thừa thêm +10 Học Vấn.",         tier:5, cost:6, require:"ht_10", apply(p){p.hocVan+=15;} },
    { id:"ht_14", name:"Thư Viện Gia Truyền", desc:"+12 tất cả kỹ năng. Chi phí học -50%.",               tier:5, cost:6, require:"ht_11", apply(p){p.hocVan+=12;p.ngoaiGiao+=5;p.voThuat+=5;p.quanLy+=5;p.muuMeo+=5;} },
    { id:"ht_15", name:"Thánh Hiền Đương Thời",desc:"Miễn thuế sưu đinh. +300 Uy Tín.",                   tier:6, cost:8, require:"ht_12", apply(p){p.hocVan+=20;p.uyTinCong+=300;} },
  ],
  [LifestyleId.QUAN_SU]: [
    { id:"qs_01", name:"Tay Gươm Lão Luyện",  desc:"+5 Võ Thuật. Đánh dẹp NPC bạo lực -20% rủi ro.",      tier:1, cost:2, require:null,   apply(p){p.voThuat+=5;} },
    { id:"qs_02", name:"Khổ Luyện Võ Công",   desc:"+8 Võ Thuật. Luyện võ hiệu quả hơn 25%.",             tier:1, cost:2, require:null,   apply(p){p.voThuat+=8;} },
    { id:"qs_03", name:"Binh Pháp Tôn Tử",    desc:"+10 Võ Thuật. Sĩ khí quân ta +10 trong chiến.",       tier:2, cost:3, require:"qs_01", apply(p){p.voThuat+=10;} },
    { id:"qs_04", name:"Tuyển Quân Chuyên Nghiệp",desc:"+8 Võ Thuật. Chi phí tuyển lính -15%.",          tier:2, cost:3, require:"qs_02", apply(p){p.voThuat+=8;} },
    { id:"qs_05", name:"Phong Trần Bách Trận", desc:"+5 Võ Thuật. Mở event chiến trận đặc biệt.",          tier:2, cost:3, require:"qs_01", apply(p){p.voThuat+=5;} },
    { id:"qs_06", name:"Bách Chiến Bách Thắng",desc:"+12 Võ Thuật. Tỉ lệ thắng trận +20%.",               tier:3, cost:4, require:"qs_03", apply(p){p.voThuat+=12;} },
    { id:"qs_07", name:"Dũng Sĩ Nội Tâm",     desc:"+10 Võ Thuật. Thể lực <30 vẫn chiến đấu tốt.",       tier:3, cost:4, require:"qs_04", apply(p){p.voThuat+=10;} },
    { id:"qs_08", name:"Hợp Đồng Tác Chiến",   desc:"MAA chiến đấu +15% (thực chiến).",                     tier:3, cost:4, require:"qs_05", apply(p){p.voThuat+=4; setFx(p,{maaCombatMult:1.15});} },
    { id:"qs_09", name:"Dũng Tướng Một Cõi",   desc:"+15 Võ Thuật, +100 Danh Vọng.",                      tier:4, cost:5, require:"qs_06", apply(p){p.voThuat+=15;p.danhVong+=100;} },
    { id:"qs_10", name:"Thống Lĩnh Đại Quân",  desc:"+12 Võ Thuật. Quân tăng theo tháng.",                tier:4, cost:5, require:"qs_07", apply(p){p.voThuat+=12;} },
    { id:"qs_11", name:"Thần Chiến Trường",     desc:"+10 Võ Thuật. Sĩ khí quân không về 0 trong trận.",  tier:4, cost:5, require:"qs_08", apply(p){p.voThuat+=10;} },
    { id:"qs_12", name:"Quân Chủ Dũng Mãnh",   desc:"+20 Võ Thuật. NPC không dám đối đầu trực tiếp.",     tier:5, cost:6, require:"qs_09", apply(p){p.voThuat+=20;} },
    { id:"qs_13", name:"Binh Hùng Tướng Mạnh", desc:"+15 Võ Thuật, +5 mỗi tướng cấp dưới.",              tier:5, cost:6, require:"qs_10", apply(p){p.voThuat+=15;} },
    { id:"qs_14", name:"Chinh Phục Tám Phương", desc:"+12 Võ Thuật. Hành quân sang trấn khác không tốn TL.",tier:5,cost:6, require:"qs_11", apply(p){p.voThuat+=12;} },
    { id:"qs_15", name:"Huyền Thoại Chiến Trận",desc:"+25 Võ Thuật, +500 Danh Vọng. Vào sử sách.",        tier:6, cost:8, require:"qs_12", apply(p){p.voThuat+=25;p.danhVong+=500;} },
  ],
  [LifestyleId.QUAN_LY]: [
    { id:"ql_01", name:"Hay Tính Toán",        desc:"+5 Quản Lý. +5% từ mọi hoạt động kinh tế.",          tier:1, cost:2, require:null,   apply(p){p.quanLy+=5;} },
    { id:"ql_02", name:"Buôn Bán Tinh Anh",   desc:"+6 Quản Lý. Margin mua-bán giảm 5%.",                 tier:1, cost:2, require:null,   apply(p){p.quanLy+=6;} },
    { id:"ql_03", name:"Quản Gia Xuất Sắc",   desc:"Lợi tức bất động sản +20% (thực nhận).",                tier:2, cost:3, require:"ql_01", apply(p){p.quanLy+=6; setFx(p,{propertyIncomeMult:1.20});} },
    { id:"ql_04", name:"Đường Dây Thương Mại", desc:"+8 Quản Lý. Giá mua hàng xa -10%.",                  tier:2, cost:3, require:"ql_02", apply(p){p.quanLy+=8;} },
    { id:"ql_05", name:"Địa Chủ Nhỏ",         desc:"+15 Thóc/tháng thụ động.",                            tier:2, cost:3, require:"ql_01", apply(p){p.quanLy+=5;} },
    { id:"ql_06", name:"Lão Thành Kinh Tế",   desc:"+12 Quản Lý. Tửu lâu & thương điếm +30%.",           tier:3, cost:4, require:"ql_03", apply(p){p.quanLy+=12;} },
    { id:"ql_07", name:"Đầu Cơ Thóc Muối",   desc:"+10 Quản Lý. Thấy biến động giá trước 1 tháng.",     tier:3, cost:4, require:"ql_04", apply(p){p.quanLy+=10;} },
    { id:"ql_08", name:"Địa Chủ Lớn",         desc:"+8 Quản Lý, +25 Thóc +15 Quan/tháng từ điền trang.", tier:3, cost:4, require:"ql_05", apply(p){p.quanLy+=8;} },
    { id:"ql_09", name:"Kinh Tế Gia Trứ Danh",desc:"+15 Quản Lý. Thương nhân NPC tìm cộng tác.",         tier:4, cost:5, require:"ql_06", apply(p){p.quanLy+=15;} },
    { id:"ql_10", name:"Vua Buôn Đàng Ngoài", desc:"+12 Quản Lý. Bán hàng không giới hạn số lượng.",     tier:4, cost:5, require:"ql_07", apply(p){p.quanLy+=12;} },
    { id:"ql_11", name:"Thế Lực Tài Chính",    desc:"+10 Quản Lý. Cho quan lại vay tiền lấy lãi 20%.",   tier:4, cost:5, require:"ql_08", apply(p){p.quanLy+=10;} },
    { id:"ql_12", name:"Đế Chế Bất Động Sản", desc:"Tất cả bất động sản +50% lợi tức (thực nhận).",          tier:5, cost:6, require:"ql_09", apply(p){p.quanLy+=10; setFx(p,{propertyIncomeMult:1.50});} },
    { id:"ql_13", name:"Ngân Khố Thiên Hạ",    desc:"+15 Quản Lý. Tiền an toàn khỏi cướp và phạt.",      tier:5, cost:6, require:"ql_10", apply(p){p.quanLy+=15;} },
    { id:"ql_14", name:"Cung Ứng Chiến Lược",  desc:"Lương quân đội -30% (thực trả).",                       tier:5, cost:6, require:"ql_11", apply(p){p.quanLy+=6; setFx(p,{armyUpkeepMult:0.70});} },
    { id:"ql_15", name:"Phú Gia Địch Quốc",   desc:"+25 Quản Lý. Mỗi tháng nhận ít nhất 500 Quan.",     tier:6, cost:8, require:"ql_12", apply(p){p.quanLy+=25;p.tien+=500;} },
  ],
  [LifestyleId.AM_MUU]: [
    { id:"am_01", name:"Bóng Tối Thao Túng",  desc:"+5 Mưu Mẹo. Trộm cướp thành công +15%.",             tier:1, cost:2, require:null,   apply(p){p.muuMeo+=5;} },
    { id:"am_02", name:"Lưỡi Dao Ngầm",       desc:"+6 Mưu Mẹo. Tống tiền & đe dọa NPC hiệu quả hơn.",  tier:1, cost:2, require:null,   apply(p){p.muuMeo+=6;} },
    { id:"am_03", name:"Tin Tức Thông Thạo",  desc:"Mỗi tháng: nhận 1 tin mật (truy nã/chiến sự/thanh tra).", tier:2, cost:3, require:"am_01", apply(p){p.muuMeo+=6; setFx(p,{intelPerMonth:(p.perkFx?.intelPerMonth||0)+1});} },
    { id:"am_04", name:"Bịp Bợm Thiên Tài",  desc:"+8 Mưu Mẹo. Đóng giả danh phận trong 1 tháng.",      tier:2, cost:3, require:"am_02", apply(p){p.muuMeo+=8;} },
    { id:"am_05", name:"Lừa Tình Lừa Người", desc:"+5 Mưu Mẹo, +5 Ngoại Giao khi dùng cho gian kế.",    tier:2, cost:3, require:"am_01", apply(p){p.muuMeo+=5;p.ngoaiGiao+=5;} },
    { id:"am_06", name:"Mạng Nhện Bóng Đêm", desc:"+12 Mưu Mẹo. Đặt mật thám ở huyện bất kỳ.",          tier:3, cost:4, require:"am_03", apply(p){p.muuMeo+=12;} },
    { id:"am_07", name:"Tống Tiền Khéo Léo",  desc:"+10 Mưu Mẹo. Ép NPC nộp tiền không giảm cảm tình.", tier:3, cost:4, require:"am_04", apply(p){p.muuMeo+=10;} },
    { id:"am_08", name:"Bịa Đặt Hoàn Hảo",   desc:"+8 Mưu Mẹo. Tin đồn buộc NPC điều tra mất thời gian.",tier:3,cost:4, require:"am_05", apply(p){p.muuMeo+=8;} },
    { id:"am_09", name:"Hạ Bệ Không Dấu Vết",desc:"+15 Mưu Mẹo. Hạ chức NPC thù không bị phát hiện.",   tier:4, cost:5, require:"am_06", apply(p){p.muuMeo+=15;} },
    { id:"am_10", name:"Kẻ Giật Dây",         desc:"+12 Mưu Mẹo. Điều khiển 1 NPC như con rối.",          tier:4, cost:5, require:"am_07", apply(p){p.muuMeo+=12;} },
    { id:"am_11", name:"Tội Lỗi Người Khác",  desc:"+10 Mưu Mẹo. Đổ tội cho NPC khác khi bị bắt.",       tier:4, cost:5, require:"am_08", apply(p){p.muuMeo+=10;} },
    { id:"am_12", name:"Chủ Mưu Bóng Tối",   desc:"+20 Mưu Mẹo. Không ai biết bạn đứng sau vụ việc.",   tier:5, cost:6, require:"am_09", apply(p){p.muuMeo+=20;} },
    { id:"am_13", name:"Gián Điệp Toàn Quốc", desc:"+15 Mưu Mẹo. Biết intentions mọi thế lực.",          tier:5, cost:6, require:"am_10", apply(p){p.muuMeo+=15;} },
    { id:"am_14", name:"Bóng Ma Trong Bóng Tối",desc:"Miễn 1 lần bị bắt mỗi năm (truy nã).",             tier:5, cost:6, require:"am_11", apply(p){p.muuMeo+=8; setFx(p,{amnestyPerYear:1});} },
    { id:"am_15", name:"Bóng Tối Thống Trị",  desc:"+25 Mưu Mẹo, +100 Uy Tín. Kiểm soát 1 Phủ ngầm.",  tier:6, cost:8, require:"am_12", apply(p){p.muuMeo+=25;p.uyTinCong+=100;} },
  ],
};

// XP cần để unlock 1 perk ở mỗi tier
export const PERK_UNLOCK_XP = [0, 60, 150, 280, 450, 660, 900];

/** Thêm XP vào lifestyle cụ thể. Gọi từ các action tương ứng. */
export function addLifestyleXP(state, lifestyleId, amount) {
  if (!state.player.lifestyleXP) state.player.lifestyleXP = {};
  state.player.lifestyleXP[lifestyleId] = (state.player.lifestyleXP[lifestyleId] || 0) + amount;
}

/**
 * T3.5-3.5a — TẦNG DƯỚI: 5 chỉ số cũ (ngoaiGiao/voThuat/quanLy/muuMeo/hocVan) tăng
 * qua HÀNH ĐỘNG THẬT bằng accumulator (khuôn _voTrainAccum của actionLuyenVo).
 * p._skillAccum[stat] bồi `gain` mỗi lần; đủ SKILL_ACCUM_THRESHOLD -> +1 chỉ số, dư
 * mang sang. KHÔNG rng, KHÔNG addLifestyleXP ở đây (nối cây perk: 3.5b).
 *
 * NGUYÊN TẮC bồi chỉ số — áp cho MỌI hành động mới, không chỉ 8 nghề T3.4:
 *   BỒI  khi hành động là QUẢN LÝ một tài sản / quy trình CÓ THỜI GIAN —
 *        giữ ghế, giữ cửa hàng, khởi vụ, cấy rẽ, chế biến có công cụ, học hành.
 *   KHÔNG BỒI khi là lao động ĂN CÔNG TỨC THỜI —
 *        cày công nhật, cày thuê, khai thác thô (chặt gỗ/câu cá/đánh bắt/đặc sản).
 * Phần thưởng kỹ năng của lao động thô (bền bỉ, tay nghề vùng miền) thuộc TẦNG TRÊN
 * — domain hẹp kiểu KDC (Phần B, thiết kế cùng GĐ2b), chưa tới lượt.
 */
export const SKILL_ACCUM_THRESHOLD = 4;

export function bumpSkill(state, stat, gain) {
  const p = state?.player;
  if (!p || !stat || !(gain > 0)) return 0;
  if (!p._skillAccum) p._skillAccum = {};
  p._skillAccum[stat] = (p._skillAccum[stat] || 0) + gain;
  let ups = 0;
  while (p._skillAccum[stat] >= SKILL_ACCUM_THRESHOLD) {
    p._skillAccum[stat] -= SKILL_ACCUM_THRESHOLD;
    ups++;
  }
  if (ups > 0) p[stat] = Math.min(100, (p[stat] || 0) + ups);
  return ups;
}

/** Lấy tổng XP hiện có của 1 lifestyle */
export function getLifestyleXP(state, lifestyleId) {
  return (state.player.lifestyleXP?.[lifestyleId] || 0);
}

/** Tier hiện tại đạt được (dùng để kiểm tra unlock perk) */
export function getLifestyleTier(state, lifestyleId) {
  const xp = getLifestyleXP(state, lifestyleId);
  for (let t = 6; t >= 1; t--) {
    if (xp >= PERK_UNLOCK_XP[t]) return t;
  }
  return 0;
}

/** Mở khoá perk — cross-tree được phép, chỉ cần đủ XP của tree đó và require */
export function unlockPerk(state, lifestyleId, perkId) {
  const p = state.player;
  if (!p.lifestylePerks) p.lifestylePerks = {};

  const tree = PerkTrees[lifestyleId];
  if (!tree) return { ok: false, msg: "Không tìm thấy cây lối sống." };

  const perk = tree.find(pk => pk.id === perkId);
  if (!perk) return { ok: false, msg: "Không tìm thấy perk này." };
  if (p.lifestylePerks[perkId]) return { ok: false, msg: "Đã mở khoá rồi." };

  // Kiểm tra require
  if (perk.require && !p.lifestylePerks[perk.require]) {
    const req = tree.find(pk => pk.id === perk.require);
    return { ok: false, msg: `Cần mở "${req?.name || perk.require}" trước.` };
  }

  // Kiểm tra XP của tree tương ứng (không cần focus đúng tree, nhưng phải có XP đó)
  const xpNeeded = PERK_UNLOCK_XP[perk.tier] || 0;
  const xpHave   = getLifestyleXP(state, lifestyleId);
  if (xpHave < xpNeeded) {
    return { ok: false, msg: `Cần ${xpNeeded} XP ${LifestyleLabel[lifestyleId]} (đang có ${xpHave}).` };
  }

  // Kiểm tra perk points
  const points = p.lifestylePoints || 0;
  if (points < perk.cost) {
    return { ok: false, msg: `Cần ${perk.cost} điểm perk (đang có ${points}).` };
  }

  p.lifestylePoints -= perk.cost;
  p.lifestylePerks[perkId] = true;
  perk.apply(p);

  return { ok: true, msg: `✅ Mở khoá "${perk.name}"!`, feedback: [{ text: perk.name, tone: "good" }] };
}

/** Chọn focus lối sống */
export function setLifestyleFocus(state, lifestyleId) {
  state.player.lifestyleFocus = lifestyleId;
  return { ok: true, msg: `Trọng tâm: ${LifestyleLabel[lifestyleId]}` };
}

/**
 * Gọi mỗi tháng trong gameTick.
 * XP tích lũy CHẬM: focus tree +4 XP/tháng, các tree khác +1 XP/tháng
 * Perk points: +1 mỗi 3 tháng (rất chậm — cần chọn lọc kỹ)
 */
export function tickLifestyle(state) {
  const p = state.player;
  if (!p.lifestyleXP)     p.lifestyleXP = {};
  if (p.lifestylePoints == null) p.lifestylePoints = 0;
  if (!state._lifestyleMonthCount) state._lifestyleMonthCount = 0;

  state._lifestyleMonthCount++;

  // XP thụ động hàng tháng
  for (const lid of Object.values(LifestyleId)) {
    const isFocus = p.lifestyleFocus === lid;
    p.lifestyleXP[lid] = (p.lifestyleXP[lid] || 0) + (isFocus ? FOCUS_XP_PER_MONTH : 1);
  }

  // Perk point: +1 mỗi 3 tháng
  if (state._lifestyleMonthCount % 3 === 0) {
    p.lifestylePoints += 1;
  }

  // Apply focus effect
  if (p.lifestyleFocus && LifestyleFocusEffect[p.lifestyleFocus]) {
    LifestyleFocusEffect[p.lifestyleFocus].apply(state);
  }
}

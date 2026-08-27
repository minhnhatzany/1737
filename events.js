import { rng, rngInt, randInt, rngChance, rngChoice } from "./core/rng.js";
import { PlayerRank, Faction, RegionId, NpcTrait } from "./models.js";
import { logLine } from "./log.js";
import { inboxFull } from "./core/inbox.js";


// ============================================================
// POOL SỰ KIỆN — 50+ sự kiện, đa dạng con đường nhân vật
// ============================================================

// Event vận mệnh — chỉ xảy ra 1 lần duy nhất trong suốt game
const ONCE_EVENTS = new Set([
  "lay_vo",       // Lấy vợ
  "tro_binh",     // Gia nhập nghĩa quân
  "gia_nhap_giac",// Liên minh đại thủ lĩnh
  "bon_nhiem",    // Bổ nhiệm chức quan
]);

// Event linh tinh — cooldown ~6 event rồi được lặp lại
function isRecentEvent(state, evId) {
  if (!state.recentEventIds) state.recentEventIds = [];
  if (!state.onceDoneEventIds) state.onceDoneEventIds = [];
  if (ONCE_EVENTS.has(evId)) return state.onceDoneEventIds.includes(evId);
  return state.recentEventIds.includes(evId);
}
function markEvent(state, evId) {
  if (!state.recentEventIds) state.recentEventIds = [];
  if (!state.onceDoneEventIds) state.onceDoneEventIds = [];
  if (ONCE_EVENTS.has(evId)) {
    // Vận mệnh: ghi nhớ vĩnh viễn
    if (!state.onceDoneEventIds.includes(evId)) state.onceDoneEventIds.push(evId);
  } else {
    // Linh tinh: cooldown 6 event rồi cho lặp lại
    state.recentEventIds.push(evId);
    if (state.recentEventIds.length > 6) state.recentEventIds.shift();
  }
}

// Hiển thị impact của lựa chọn
function impactStr(effects) {
  // effects = array of { label, color } 
  return effects.map(e => `<span style="color:${e.color};font-size:0.8rem;">${e.label}</span>`).join(" ");
}

export function rollDailyEvent(state) {
  if (state.pendingEvent || inboxFull(state) || state.gameOver) return null;
  if (state.travel?.active) return null;

  // Chờ ít nhất 1 tháng (30 ngày) trước khi bắt đầu có sự kiện
  const totalDays = (state.ban - 1737) * 360 + state.monthIndex * 30 + (state.gameDay || 1);
  if (totalDays < 30) return null;

  // ~20% mỗi tháng = ~0.7% mỗi ngày (30 ngày/tháng)
  if (rng() > 0.007) return null;

  const p = state.player;
  const rank = p.rank;
  const isOutlaw = p.faction === Faction.NGHIA_QUAN || p.faction === Faction.CUOP || (p.wantedLevel || 0) > 0;

  // Pool phân layer theo tình trạng nhân vật
  const pool = [];

  // Events cho tất cả (nhưng phản tặc sẽ thay bằng pool khác)
  if (!isOutlaw) {
    pool.push(evDoiXuPhong, evThienTai, evDoanBuon, evCuopDuong, evNhaSu, evTuyetKyVo, evHoiCho, evDichBenh, evTinDon, evGapNguoiLa);
    pool.push(evGianTeThuyetPhuc);
    // 50 minor life events for variety
    for (let i = 0; i < 50; i++) pool.push((s) => evMinorLife(s, i));
  } else {
    // Outlaw / rebel-only feeling: no "quan phủ mời trà" nonsense while being hunted
    pool.push(evThienTai, evDichBenh);
    pool.push(evChieuAnPhuDu);
    for (let i = 0; i < 50; i++) pool.push((s) => evMinorOutlaw(s, i));
  }

  if (!isOutlaw) {
    if (rank !== PlayerRank.DAN_THUONG) pool.push(evThamNhung, evXuKien, evBonNhiem);
    if (rank === PlayerRank.DAN_THUONG || rank === PlayerRank.PHU_HO) pool.push(evLayVo, evQuanThuc, evTroBinh);
    if ([PlayerRank.LY_TRUONG, PlayerRank.CHANH_TONG, PlayerRank.TRI_HUYEN, PlayerRank.TRI_PHU].includes(rank)) pool.push(evLyTruong, evChinhSach, evDanKhieu);
    if ([PlayerRank.DOI_TRUONG, PlayerRank.CAI_CO, PlayerRank.BACH_HO, PlayerRank.TONG_LINH, PlayerRank.DO_DOC].includes(rank)) pool.push(evChienSiPhanBoi, evLinh_DaoNgu);
    if (p.quanSo > 50) pool.push(evLinh_DaoNgu, evPhanLoaN);
    if (p.giaDinh && p.giaDinh.vo) pool.push(evGiaDinh, evConCai);
  } else {
    // Rebel / outlaw core beats
    pool.push(evTroBinh, evChienSiPhanBoi, evLinh_DaoNgu, evPhanLoaN);
  }

  // Shuffle và chọn event không trùng gần đây
  const shuffled = pool.sort(() => rng() - 0.5);
  for (const fn of shuffled) {
    const ev = fn(state);
    if (ev && !isRecentEvent(state, ev.id)) {
      markEvent(state, ev.id);
      state.pendingEvent = ev;
      return ev;
    }
  }
  return null;
}

function totalDaysAbs(state) {
  return (state.ban - 1737) * 360 + state.monthIndex * 30 + (state.gameDay || 1);
}

function evGianTeThuyetPhuc(state) {
  const p = state.player;
  if (p.faction !== Faction.TRIEU_DINH) return null;
  if ((p.wantedLevel || 0) > 0) return null;
  if (p.quanSo < 80) return null;
  // not too frequent
  if (rng() > 0.35) return null;
  const until = totalDaysAbs(state) + 20;
  return {
    id: "ev_gian_te_defect",
    title: "🕯 Gian tế tìm đến",
    narrative: "Đêm khuya, một kẻ bịt mặt lẻn vào doanh trại. Hắn thì thầm: “Triều đình mục nát. Theo nghĩa quân, ngươi sẽ có đất dụng võ. Ta sẽ dẫn đường…”",
    choices: [
      { label: "Nghe theo (mở đường sang nghĩa quân)", impact:[{label:"Đổi phe",color:"#ff6b6b"},{label:"+Truy nã",color:"#ffd43b"}], apply(s){
        s._defectWindow = { to: Faction.NGHIA_QUAN, untilTotalDays: until };
        logLine(s, "Gian tế đưa thư mật. Trong vài tuần tới, ngươi có thể bí mật nhập nghĩa quân tại chiến trường.");
      }},
      { label: "Bắt gian tế (lập công)", impact:[{label:"+Uy tín",color:"#74c0fc"}], apply(s){
        s.player.uyTinCong += 20;
        logLine(s, "Bắt gian tế nộp quan. Được khen thưởng.");
      }},
      { label: "Làm ngơ", impact:[], apply(s){ logLine(s, "Ngươi im lặng cho qua. Nhưng lời thì thầm vẫn ám ảnh."); }},
    ]
  };
}

function evChieuAnPhuDu(state) {
  const p = state.player;
  if (p.faction !== Faction.NGHIA_QUAN && p.faction !== Faction.CUOP && (p.wantedLevel||0) <= 0) return null;
  if (rng() > 0.30) return null;
  const until = totalDaysAbs(state) + 18;
  return {
    id: "ev_chieu_an",
    title: "📜 Chiêu an phủ dụ",
    narrative: "Quan quân gửi hịch: “Ai sớm quay về, sẽ được giảm tội. Kẻ cố chấp tất bị truy cùng diệt tận.”",
    choices: [
      { label: "Nhận chiêu an (mở đường về triều)", impact:[{label:"Giảm truy nã",color:"#74c0fc"}], apply(s){
        s._defectWindow = { to: Faction.TRIEU_DINH, untilTotalDays: until };
        logLine(s, "Nhận chiêu an. Trong vài tuần tới, ngươi có thể trở về triều (tham chiến phe triều đình).");
      }},
      { label: "Đốt hịch (càng bị truy gắt)", impact:[{label:"+Truy nã",color:"#ff6b6b"}], apply(s){
        s.player.wantedLevel = Math.min(10, (s.player.wantedLevel||0) + 2);
        logLine(s, "Đốt hịch chiêu an. Quan quân càng thù ghét, truy bắt gắt hơn!");
      }},
      { label: "Giả vờ nhận để câu giờ", impact:[{label:"+Mưu mẹo",color:"#ffd43b"}], apply(s){
        s.player.muuMeo = Math.min(100, s.player.muuMeo + 1);
        logLine(s, "Ngươi giả vờ nhận chiêu an để câu giờ và dò phản ứng quan quân.");
      }},
    ]
  };
}

// ============================================================
// MINOR EVENT PACK (50+50)
// ============================================================
function evMinorLife(state, idx) {
  const id = `minor_life_${idx}`;
  const list = MINOR_LIFE_EVENTS;
  const pick = list[idx % list.length];
  if (!pick) return null;
  return { id, title: pick.title, narrative: pick.narrative, choices: pick.choices };
}

function evMinorOutlaw(state, idx) {
  const id = `minor_outlaw_${idx}`;
  if (state.player.faction !== Faction.NGHIA_QUAN && state.player.faction !== Faction.CUOP && (state.player.wantedLevel||0) <= 0) return null;
  const list = MINOR_OUTLAW_EVENTS;
  const pick = list[idx % list.length];
  if (!pick) return null;
  return { id, title: pick.title, narrative: pick.narrative, choices: pick.choices };
}

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

function makeLifeChoices(kind, seed) {
  switch (kind) {
    case "theft": {
      return [
        { label: `Đuổi bắt`, impact:[{label:"Thử Võ Thuật",color:"#ffd43b"}], apply(s){
          const ok = (s.player.voThuat + rng()*20) >= (20 + (seed % 6));
          if (ok) { s.player.uyTinCong += 6 + (seed % 5); s.player.tien += 8 + (seed % 12); logLine(s, "Bắt được kẻ gian. Dân khen."); }
          else { s.player.theLuc -= 18 + (seed % 18); logLine(s, "Đuổi hụt, bầm dập chân tay."); }
        }},
        { label: `Báo quan`, impact:[{label:"+Uy tín",color:"#74c0fc"}], apply(s){ s.player.uyTinCong += 4 + (seed % 5); logLine(s, "Báo quan, việc được xử."); } },
        { label: `Kệ`, impact:[], apply(s){ logLine(s, "Không dính vào."); } },
      ];
    }
    case "brawl": {
      return [
        { label:"Can ngăn", impact:[{label:"Thử Ngoại Giao",color:"#ffd43b"}], apply(s){
          const ok = rng() < (0.45 + (s.player.ngoaiGiao||0)*0.004);
          if (ok) { s.player.uyTinCong += 8 + (seed % 6); logLine(s, "Dàn xếp êm đẹp."); }
          else { s.player.theLuc -= 15 + (seed % 25); logLine(s, "Bị ăn đòn lây."); }
        }},
        { label:"Ra tay", impact:[{label:"Thử Võ Thuật",color:"#ffd43b"}], apply(s){
          const ok = (s.player.voThuat + rng()*20) >= (24 + (seed % 8));
          if (ok) { s.player.voThuat = Math.min(100, (s.player.voThuat||0) + 1); s.player.tien += 10 + (seed % 20); logLine(s, "Hạ đối thủ, nhặt được ít tiền rơi."); }
          else { s.player.theLuc -= 25 + (seed % 25); s.uiShakeProfile = true; logLine(s, "Bị hội đồng."); }
        }},
      ];
    }
    case "vice": {
      return [
        { label:`Giải khuây (40Q)`, impact:[{label:"-40 Quan",color:"#ff6b6b"},{label:"+Ngoại Giao",color:"#51cf66"}], apply(s){
          if (s.player.tien < 40) { logLine(s, "Không đủ tiền."); return; }
          s.player.tien -= 40;
          s.player.ngoaiGiao = Math.min(100, (s.player.ngoaiGiao||0) + 2);
          s.player.theLuc = Math.min(100, (s.player.theLuc||0) + 8);
          if (rng() < 0.08) { s.player.dangOm = true; s.player.theLuc = 0; logLine(s, "Ăn chơi quá đà, đổ bệnh.", true); }
          else logLine(s, "Một đêm tiêu dao.");
        }},
        { label:"Bỏ đi", impact:[], apply(s){ logLine(s, "Tự nhủ phải kiềm chế."); } },
      ];
    }
    case "fortune": {
      return [
        { label:"Thử vận (10Q)", impact:[{label:"-10 Quan",color:"#ff6b6b"}], apply(s){
          if (s.player.tien < 10) { logLine(s, "Không đủ tiền."); return; }
          s.player.tien -= 10;
          const ok = rng() < (0.35 + (s.player.muuMeo||0)*0.002);
          if (ok) { s.player.tien += 25 + (seed % 25); logLine(s, "Gặp may, kiếm lại được chút tiền."); }
          else logLine(s, "Toàn lời nhảm. Tốn tiền.");
        }},
        { label:"Vạch mặt", impact:[{label:"Thử Học Vấn",color:"#ffd43b"}], apply(s){
          const ok = (s.player.hocVan + rng()*20) >= (18 + (seed % 10));
          if (ok) { s.player.uyTinCong += 10 + (seed % 6); logLine(s, "Bạn vạch mâu thuẫn. Dân cười ồ."); }
          else { s.player.uyTinCong -= 4; logLine(s, "Nói không đủ thuyết phục, bị chê."); }
        }},
      ];
    }
    default: {
      return [{ label:"Bỏ qua", impact:[], apply(s){ logLine(s,"Không có gì xảy ra."); } }];
    }
  }
}

function makeOutlawChoices(kind, seed) {
  switch (kind) {
    case "search": {
      return [
        { label:"Ẩn nấp", impact:[{label:"Thử Mưu Mẹo",color:"#ffd43b"}], apply(s){
          const ok = (s.player.muuMeo + rng()*25) >= (26 + (seed % 10));
          if (ok) { logLine(s, "Lẩn thoát qua bờ tre."); }
          else { s.player.theLuc = 0; s.player.dangOm = true; logLine(s, "Bị truy binh đánh trọng thương!", true); }
        }},
        { label:"Hối lộ (80Q)", impact:[{label:"-80 Quan",color:"#ff6b6b"}], apply(s){
          if (s.player.tien < 80) { logLine(s, "Không đủ."); return; }
          s.player.tien -= 80;
          s.player.wantedLevel = Math.max(0, (s.player.wantedLevel || 1) - 1);
          logLine(s, "Nhét bạc qua cửa. Quan quân cho qua.");
        }},
      ];
    }
    case "raid": {
      return [
        { label:"Tập kích", impact:[{label:"+Thóc",color:"#51cf66"},{label:"Rủi ro",color:"#ff6b6b"}], apply(s){
          if (s.player.quanSo < 40) { logLine(s, "Quân ít, không dám."); return; }
          const ok = rng() < (0.40 + (s.player.voThuat||0)*0.003);
          if (ok) { const gain = randInt(30, 120); s.player.thocCaNhan += gain; s.player.tien += randInt(20, 90); s.player.wantedLevel = clamp((s.player.wantedLevel||1) + 1, 1, 3); logLine(s, `Cướp được ${gain} thóc!`, true); }
          else { const loss = Math.ceil(s.player.quanSo * (0.10 + (seed%10)/100)); s.player.quanSo -= loss; logLine(s, `Bị phản kích, mất ${loss} quân!`, true); }
        }},
        { label:"Bỏ qua", impact:[], apply(s){ logLine(s, "Chưa phải lúc."); } },
      ];
    }
    case "recruit": {
      return [
        { label:"Thu nạp", impact:[{label:"+Quân",color:"#51cf66"},{label:"-Thóc",color:"#ff6b6b"}], apply(s){
          const add = randInt(15, 70);
          s.player.quanSo += add;
          s.player.thocCaNhan = Math.max(0, s.player.thocCaNhan - 30);
          logLine(s, `Thu nạp ${add} người. Trại đông lên.`);
        }},
        { label:"Từ chối", impact:[{label:"-Uy tín",color:"#ff6b6b"}], apply(s){ s.player.uyTinCong = Math.max(0, s.player.uyTinCong - 10); logLine(s, "Xua đi. Lòng người xa dần."); } }
      ];
    }
    default:
      return [{ label:"Giải tán", impact:[], apply(s){ logLine(s, "Im hơi lặng tiếng."); } }];
  }
}

const MINOR_LIFE_SEEDS = [
  { title:"Trộm Gà Bắt Chó", narrative:"Đêm khuya, nhà hàng xóm la hét: 'Mất gà!' Có bóng người chạy vụt qua bờ rào.", kind:"theft" },
  { title:"Bắt Cá Trộm Ở Ao", narrative:"Người ta rỉ tai: ao làng có kẻ lén thả lưới ban đêm. Dân bức xúc mà không dám bắt.", kind:"theft" },
  { title:"Đánh Lộn Ở Chợ", narrative:"Hai gã say rượu lao vào nhau. Một cú đấm lạc bay về phía bạn.", kind:"brawl" },
  { title:"Bẻ Gãy Cọc Rào", narrative:"Sáng ra thấy cọc rào ruộng bị nhổ. Hai nhà cãi nhau om sòm.", kind:"brawl" },
  { title:"Kẻ Mạo Danh Thầy Bói", narrative:"Một gã tự xưng thầy bói đi khắp chợ phán bừa, lừa tiền người nhẹ dạ.", kind:"fortune" },
  { title:"Quẻ Xấu Đầu Năm", narrative:"Một bà đồng bảo bạn 'năm nay hạn nặng' và gợi ý cúng giải.", kind:"fortune" },
  { title:"Lầu Xanh Mời Gọi", narrative:"Đèn đỏ le lói. Một giọng ngọt: 'Khách quan ghé chơi chăng?'", kind:"vice" },
  { title:"Tửu Quán Xôn Xao", narrative:"Trong quán rượu, người ta bàn chuyện quan thuế sắp siết chặt.", kind:"vice" },
  { title:"Thợ Rèn Đòi Nợ", narrative:"Thợ rèn kéo đến đòi tiền công sửa nông cụ. Bạn nhớ mang máng nhưng chưa chắc.", kind:"fortune" },
  { title:"Mất Túi Bạc", narrative:"Lục túi mới biết thiếu một ít quan. Rõ là có kẻ chôm chỉa.", kind:"theft" },
  { title:"Kẻ Lạ Mượn Dao", narrative:"Một người lạ mượn dao đi cắt cỏ nhưng ánh mắt khả nghi.", kind:"fortune" },
  { title:"Gánh Hát Qua Làng", narrative:"Gánh hát chèo dựng rạp, rủ bạn góp tiền mua đèn và chiêng trống.", kind:"vice" },
  { title:"Trẻ Con Quậy Phá", narrative:"Trẻ con ném đất vào cửa, người lớn thì cười trừ.", kind:"brawl" },
  { title:"Chó Cắn Người", narrative:"Con chó dữ nhà bên cắn trúng người đi đường. Làng xôn xao đòi xử.", kind:"brawl" },
  { title:"Bão Đêm", narrative:"Mưa gió thốc vào mái. Sáng ra vài tấm liếp bị tốc.", kind:"fortune" },
  { title:"Gom Gạo Cứu Đói", narrative:"Dân xóm rủ nhau góp thóc giúp nhà vừa mất mùa.", kind:"fortune" },
  { title:"Đấu Gà", narrative:"Đám trai tráng rủ bạn đặt cửa đấu gà.", kind:"vice" },
  { title:"Xóc Đĩa", narrative:"Tiếng bát đĩa lách cách ở ngõ sau. Có người vẫy: 'Vào thử vận!'", kind:"vice" },
  { title:"Cãi Nhau Tiền Chợ", narrative:"Một tiểu thương tố bạn 'cân thiếu'.", kind:"brawl" },
  { title:"Thằng Bán Dầu Dỏm", narrative:"Một gã bán dầu xoa bóp dỏm, bôi vào rát da.", kind:"fortune" },
  { title:"Đòi Tiền Thuốc", narrative:"Thầy lang đòi tiền thuốc cũ của người nhà bạn.", kind:"fortune" },
  { title:"Mượn Trâu", narrative:"Hàng xóm xin mượn trâu kéo cày đúng mùa gấp.", kind:"fortune" },
  { title:"Tranh Chỗ Bơm Nước", narrative:"Hai nhà tranh nhau chỗ múc nước ngoài bờ sông.", kind:"brawl" },
  { title:"Ruộng Bị Dẫm", narrative:"Có kẻ dẫm nát lúa non. Bạn nghi nhà bên.", kind:"brawl" },
  { title:"Mất Mẻ Lưới", narrative:"Ngư dân than mất lưới, nghi có kẻ cắt trộm.", kind:"theft" },
  { title:"Mời Cưới", narrative:"Nhà giàu mời cưới, muốn bạn góp chút tiền mừng.", kind:"vice" },
  { title:"Đám Tang", narrative:"Làng có đám tang, người ta bảo bạn nên góp sức lo việc.", kind:"fortune" },
  { title:"Hội Chùa", narrative:"Lễ hội chùa mở, người đông như kiến.", kind:"vice" },
  { title:"Trẻ Lạc", narrative:"Một đứa trẻ lạc mẹ khóc giữa chợ.", kind:"fortune" },
  { title:"Trộm Thóc Đình", narrative:"Kho thóc đình mất vài bao, dân nghi có nội gián.", kind:"theft" },
  { title:"Bẻ Trộm Măng", narrative:"Có kẻ bẻ măng nhà bạn. Dấu chân còn mới.", kind:"theft" },
  { title:"Bán Hàng Gian", narrative:"Một thương lái bán muối pha cát.", kind:"fortune" },
  { title:"Đội Tuần Đi Qua", narrative:"Đội tuần đi kiểm tra giấy tờ, hỏi han đủ điều.", kind:"fortune" },
  { title:"Đập Chuột", narrative:"Chuột phá kho. Ai đó rủ góp tiền mua bẫy.", kind:"fortune" },
  { title:"Mượn Tiền Gấp", narrative:"Một người quen xin vay gấp 30 quan, hứa trả sau.", kind:"fortune" },
  { title:"Chơi Thả Diều", narrative:"Thanh niên tụ tập thả diều, cá cược cho vui.", kind:"vice" },
  { title:"Lời Thề Rượu", narrative:"Trong men rượu, có người rủ bạn kết nghĩa.", kind:"vice" },
  { title:"Đấu Võ Ở Sân Đình", narrative:"Hội làng có màn đấu võ, người xem reo hò.", kind:"brawl" },
  { title:"Ghen Tuông", narrative:"Hai người đàn ông cãi nhau vì một cô gái.", kind:"brawl" },
  { title:"Mất Đồ Trong Chợ", narrative:"Bạn nghi bị móc túi lúc chen lấn.", kind:"theft" },
  { title:"Tấm Bùa Lạ", narrative:"Trước cửa nhà có tấm bùa dán. Không biết ai làm.", kind:"fortune" },
  { title:"Gặp Người Từng Ơn", narrative:"Một người từng được bạn giúp ghé lại cảm ơn.", kind:"fortune" },
  { title:"Giá Thóc Đảo", narrative:"Thóc bỗng tăng giá. Ai cũng bàn chuyện tích trữ.", kind:"fortune" },
  { title:"Gặp Cướp Vặt", narrative:"Một tên vặt vãnh chặn đường dọa nạt.", kind:"theft" },
  { title:"Mời Vào Đoàn Buôn", narrative:"Có người rủ bạn góp vốn đi buôn ngắn hạn.", kind:"fortune" },
  { title:"Nghe Tin Quan Đổi", narrative:"Tin đồn tri huyện sắp bị thay, dân bàn tán.", kind:"fortune" },
  { title:"Đụng Độ Thuyền", narrative:"Hai thuyền va nhau, chủ thuyền cãi như mổ bò.", kind:"brawl" },
  { title:"Chợ Cháy Nhỏ", narrative:"Một góc chợ bốc khói. Dân hò nhau dập lửa.", kind:"fortune" },
  { title:"Cá Mắm Thiu", narrative:"Bạn mua nhầm mắm thiu, người bán cãi chày cãi cối.", kind:"brawl" },
];

const MINOR_OUTLAW_SEEDS = [
  { title:"Truy Binh Lục Soát", narrative:"Từ xa nghe tiếng mõ và giáp sắt. Quan quân đang lục soát từng nhà.", kind:"search" },
  { title:"Mật Thám Theo Dõi", narrative:"Có kẻ lạ mặt bám theo từ đầu ngõ đến cuối chợ.", kind:"search" },
  { title:"Chặn Cửa Ải", narrative:"Cổng huyện dựng chướng ngại, kiểm tra người qua lại gắt gao.", kind:"search" },
  { title:"Cướp Lương Đoàn Xe", narrative:"Một đoàn xe thóc triều đình đi ngang. Binh lính ít, lương nhiều.", kind:"raid" },
  { title:"Đốt Trạm Canh", narrative:"Trạm canh đầu làng sơ hở. Nếu đốt, địch sẽ rối loạn.", kind:"raid" },
  { title:"Bẻ Còi Cảnh Giới", narrative:"Địch đặt mõ báo động. Có thể phá đi để dễ hành quân.", kind:"raid" },
  { title:"Chiêu Mộ Dân Oan", narrative:"Dân đói kéo đến xin theo. 'Cho chúng tôi miếng ăn, chúng tôi theo ngài!'", kind:"recruit" },
  { title:"Đám Trẻ Xin Theo", narrative:"Vài trai tráng trẻ măng xin nhập trại để 'làm nên đại sự'.", kind:"recruit" },
  { title:"Thương Nhân Bán Tin", narrative:"Thương nhân nói biết đường tắt vào huyện địch (giá 60 quan).", kind:"search" },
  { title:"Thiếu Lương", narrative:"Trong trại thiếu thóc, quân kêu đói.", kind:"recruit" },
  { title:"Bị Phản Bội", narrative:"Có kẻ trong trại muốn bán đứng bạn để lấy thưởng.", kind:"search" },
  { title:"Cướp Kho Muối", narrative:"Kho muối của triều đình canh giữ lỏng lẻo.", kind:"raid" },
  { title:"Tập Kích Ban Đêm", narrative:"Đêm nay sương dày. Là cơ hội tốt để tập kích.", kind:"raid" },
  { title:"Ẩn Trong Chùa Hoang", narrative:"Một ngôi chùa hoang có thể làm nơi ẩn náu tạm.", kind:"search" },
  { title:"Dẫn Đường Lạc", narrative:"Người dẫn đường run rẩy, có vẻ muốn bỏ trốn.", kind:"search" },
  { title:"Chiêu Hàng Giả", narrative:"Một toán nói muốn chiêu hàng nhưng ánh mắt gian.", kind:"search" },
  { title:"Cướp Ngựa", narrative:"Đồn ngựa của địch có vài con tốt.", kind:"raid" },
  { title:"Thu Nạp Đào Ngũ", narrative:"Lính triều đào ngũ xin gia nhập.", kind:"recruit" },
  { title:"Đòi Nợ Máu", narrative:"Dân làng bị quan quân đốt nhà, xin bạn báo thù.", kind:"raid" },
  { title:"Gạo Mốc", narrative:"Kho thóc mốc một phần, quân bất mãn.", kind:"recruit" },
  // pad to 50 unique seeds by mirroring with different titles/narratives
  { title:"Mưa Lũ Cản Đường", narrative:"Mưa lũ làm đường lầy. Truy binh dễ theo dấu.", kind:"search" },
  { title:"Bị Lộ Dấu Trại", narrative:"Khói bếp bị thấy từ xa. Địch có thể lần ra.", kind:"search" },
  { title:"Cướp Thuyền", narrative:"Một bến thuyền nhỏ có thể cướp để vượt sông.", kind:"raid" },
  { title:"Chiêu Mộ Thợ Rèn", narrative:"Thợ rèn bỏ xứ xin vào trại, đổi lại rèn vũ khí.", kind:"recruit" },
  { title:"Đụng Độ Tuần Tiễu", narrative:"Đụng đội tuần tiễu trên đường mòn.", kind:"search" },
  { title:"Bẫy Độc", narrative:"Địch rải bẫy chông ở lối vào.", kind:"search" },
  { title:"Cướp Thuế", narrative:"Đoàn thu thuế về phủ, tiền nhiều, lính ít.", kind:"raid" },
  { title:"Đốt Sổ Thuế", narrative:"Đốt sổ thuế sẽ làm dân theo bạn hơn.", kind:"raid" },
  { title:"Lương Thực Đổi Vũ Khí", narrative:"Có kẻ bán giáo mác đổi lấy thóc.", kind:"recruit" },
  { title:"Lính Nổi Loạn", narrative:"Quân trong trại cãi nhau vì chia chiến lợi phẩm.", kind:"recruit" },
  { title:"Đêm Không Trăng", narrative:"Đêm đen, thuận lợi cho đột nhập kho lương.", kind:"raid" },
  { title:"Mật Lệnh Bắt Sống", narrative:"Nghe tin địch treo thưởng bắt sống bạn.", kind:"search" },
  { title:"Dân Che Giấu", narrative:"Có nhà dân muốn che giấu bạn qua đêm.", kind:"search" },
  { title:"Cướp Chợ Phiên", narrative:"Chợ phiên đông, có thể cướp nhanh rồi rút.", kind:"raid" },
  { title:"Thuyết Phục Hương Dũng", narrative:"Một nhóm hương dũng dao động, có thể kéo về.", kind:"recruit" },
  { title:"Bị Bỏ Đói", narrative:"Dân sợ liên lụy nên không dám bán thóc.", kind:"recruit" },
  { title:"Địch Dụ Hàng", narrative:"Địch treo cờ trắng dụ bạn vào bẫy.", kind:"search" },
  { title:"Cướp Kho Vũ Khí", narrative:"Kho vũ khí nhỏ của địch sơ hở.", kind:"raid" },
  { title:"Thu Nạp Dân Trốn Thuế", narrative:"Dân trốn thuế xin theo bạn để có nơi nương.", kind:"recruit" },
  { title:"Đồn Canh Sơ Hở", narrative:"Đồn canh đổi ca, có khoảng trống ngắn.", kind:"raid" },
  { title:"Truy Binh Đến Sát Trại", narrative:"Bụi đường mù mịt: truy binh đã đến sát trại.", kind:"search" },
  { title:"Cướp Muối Đổi Thóc", narrative:"Có thể cướp muối đem đổi lấy thóc.", kind:"raid" },
  { title:"Chiêu Mộ Người Nhà Quan", narrative:"Một kẻ trong nha môn bất mãn muốn phản.", kind:"recruit" },
  { title:"Gãy Nỏ", narrative:"Nỏ gãy, cần thợ sửa gấp.", kind:"recruit" },
  { title:"Bị Theo Dõi Ở Bến", narrative:"Bến sông có mắt nhìn lạ.", kind:"search" },
  { title:"Cướp Trâu Kéo", narrative:"Muốn hành quân nhanh, cần trâu kéo.", kind:"raid" },
  { title:"Thu Nạp Thổ Dân", narrative:"Người bản xứ biết đường rừng xin theo.", kind:"recruit" },
  { title:"Địch Đặt Giá Treo", narrative:"Giá treo thưởng tăng, dân càng sợ.", kind:"search" },
  { title:"Cướp Kho Thóc", narrative:"Kho thóc huyện địch có thể đột nhập.", kind:"raid" },
  { title:"Chiêu Mộ Kẻ Liều", narrative:"Những kẻ liều mạng xin đánh trận lớn.", kind:"recruit" },
];

const MINOR_LIFE_EVENTS = MINOR_LIFE_SEEDS.map((e, i) => ({
  title: e.title,
  narrative: e.narrative,
  choices: makeLifeChoices(e.kind, i),
}));

const MINOR_OUTLAW_EVENTS = MINOR_OUTLAW_SEEDS.map((e, i) => ({
  title: e.title,
  narrative: e.narrative,
  choices: makeOutlawChoices(e.kind, i),
}));

// ============================================================
// NHÓM 1: CUỘC SỐNG DÂN THƯỜNG
// ============================================================

function evDoiXuPhong(state) {
  // Sự kiện: Triều đình ra lệnh thâu thuế phụ thêm
  return {
    id: "doi_xu_phong",
    title: "Phóng Lệnh Đổi Địa Dượng",
    narrative: "Kỳ quan thuế năm nay căng thẳng. Làng xóm đồn đại: triều đình chẩn thuế theo 'xứ phong' mới, ai tỽ ra giàu có sẽ bị đánh thuế nặng hơn.",
    choices: [
      { label: "Khai giảm tài sản để trốn thuế",
        impact: [{ label: "Thử Mưu Mẹo", color: "#ffd43b" }, { label: "Tiết kiệm thuế", color: "#51cf66" }],
        apply(s) {
          if (s.player.muuMeo + rng() * 20 >= 22) { logLine(s, "Khai man khéo léo. Quan thuế không phát hiện, tiết kiệm được khá nhiều."); }
          else { s.player.tien -= 80; s.player.uyTinCong -= 20; logLine(s, "Bị quan xét sổ bắt gian! Phạt vạ 80 quan cộng mất uy tín."); }
        }},
      { label: "Nộp đủ thuế đờng hoàng",
        impact: [{ label: "+Uy tín triều đình", color: "#74c0fc" }, { label: "-Thuế theo tài sản", color: "#ff6b6b" }],
        apply(s) {
          let thue = Math.floor(s.player.tien * 0.08);
          s.player.tien -= thue;
          s.player.uyTinCong += 10;
          logLine(s, `Nộp đủ ${thue} quan thuế. Quan hệ với triều đình tốt hơn.`);
        }},
      { label: "Lảng tránh không làm thủ tục",
        impact: [{ label: "-10 Uy tín", color: "#ff6b6b" }],
        apply(s) { s.player.uyTinCong -= 10; logLine(s, "Trốn tránh giấy tờ. Quan lại ghi tên vào sổ nợ thuế."); }},
    ]
  };
}

function evQuanThuc(state) {
  if (state.player.currentRegion !== RegionId.THANG_LONG) return null;
  return {
    id: "quan_thuc",
    title: "Quan Phủ Đòi Tiền Lót Tay",
    narrative: "Lính nha môn ập vào sân hỏi thẳng: 'Đóng 20 quan mua bình yên, không thì chờ đấy!'",
    choices: [
      { label: "Xuất tiền 20 quan tránh họa",
        impact: [{ label: "-20 Quan", color: "#ff6b6b" }, { label: "+Quan hệ phủ huyện", color: "#51cf66" }],
        apply(s) {
          if (s.player.tien >= 20) { s.player.tien -= 20; s.player.quyenLuc += 10; logLine(s, "Đút lót êm thấm. Từ nay quan lệnh có chút thiện cảm."); }
          else { s.player.uyTinCong -= 5; s.uiShakeProfile = true; logLine(s, "Móc túi chỉ thấy gió. Bị tát thêm một cái, ê mặt."); }
        }},
      { label: "Cãi lý viện dẫn luật lệ",
        impact: [{ label: "Thử Học Vấn", color: "#ffd43b" }, { label: "Rủi ro", color: "#ff6b6b" }],
        apply(s) {
          if (s.player.hocVan + rng() * 20 >= 25) { s.player.uyTinCong += 20; logLine(s, "Dẫn theo luật Hồng Đức, quan đứng cứng họng bỏ đi."); }
          else { s.player.theLuc -= 50; s.uiShakeProfile = true; logLine(s, "Nói dài không xong, ăn trọn một trận đòn."); }
        }},
      { label: "Chạy thoát ra ngõ sau",
        impact: [{ label: "Thoát nạn", color: "#51cf66" }, { label: "+Bị ghi sổ đen", color: "#ff6b6b" }],
        apply(s) {
          s.player.trongSoDenLy = true;
          logLine(s, "Vừa chạy vừa nhìn sau lưng. Chắc sẽ bị nhớ mặt.");
        }},
    ]
  };
}

function evDoanBuon(state) {
  return {
    id: "doan_buon",
    title: "Đoàn Buôn Gặp Khó",
    narrative: "Một thương lái Hoa Lư hớt hải chạy đến: 'Bị cướp sạch, còn 15 thùng thóc giá rẻ cần bán gấp trả nợ!'",
    choices: [
      { label: "Mua ép giá (15 thóc = 20 quan)",
        impact: [{ label: "-20 Quan", color: "#ff6b6b" }, { label: "+15 Thóc", color: "#51cf66" }, { label: "-Uy tín", color: "#ff6b6b" }],
        apply(s) {
          if (s.player.tien >= 20) { s.player.tien -= 20; s.player.thocCaNhan += 15; s.player.uyTinCong -= 5; logLine(s, "Mua ép giá. Thương nhân khóc rống đếm từng đồng. Lãi to!"); }
          else logLine(s, "Túi rỗng, cơ hội vụt qua.");
        }},
      { label: "Mua giá công bằng (35 quan)",
        impact: [{ label: "-35 Quan", color: "#ff6b6b" }, { label: "+15 Thóc", color: "#51cf66" }, { label: "+10 Uy tín", color: "#51cf66" }],
        apply(s) {
          if (s.player.tien >= 35) { s.player.tien -= 35; s.player.thocCaNhan += 15; s.player.uyTinCong += 10; logLine(s, "Giao thương sòng phẳng. Tiếng lành đồn xa."); }
          else logLine(s, "Không đủ tiền."); }},
      { label: "Bố thí cho họ 5 thóc",
        impact: [{ label: "-5 Thóc", color: "#ff6b6b" }, { label: "+20 Uy tín", color: "#74c0fc" }],
        apply(s) {
          if (s.player.thocCaNhan >= 5) { s.player.thocCaNhan -= 5; s.player.uyTinCong += 20; logLine(s, "Nghĩa hiệp giúp người. Tiếng thơm lan khắp chợ."); }
          else logLine(s, "Cũng chẳng có thóc dư mà cho."); }},
      { label: "Lờ đi",
        impact: [{ label: "Không ảnh hưởng", color: "#999" }],
        apply(s) { logLine(s, "Giả vờ không thấy quay đi."); }}
    ]
  };
}

function evCuopDuong(state) {
  if (state.player.currentRegion !== RegionId.SON_TAY && state.player.currentRegion !== RegionId.KINH_BAC) return null;
  return {
    id: "cuop_duong",
    title: "Thổ Phỉ Mai Phục!",
    narrative: "Bốn tên giặc nhảy ra từ bụi rậm, lăm le đại đao. Đầu lĩnh quát: 'Nộp tiền mua mạng!'",
    choices: [
      { label: "Nộp hết tiền mua mạng",
        impact: [{ label: "-Toàn bộ Quan", color: "#ff6b6b" }],
        apply(s) { let lost = s.player.tien; s.player.tien = 0; s.uiShakeProfile = true; logLine(s, `Bị lột sạch ${lost} quan. Cắn răng bước đi tay không.`); }},
      { label: "Chống trả bằng võ",
        impact: [{ label: "Thử Võ Thuật", color: "#ffd43b" }, { label: "+Quan nếu thắng", color: "#51cf66" }],
        apply(s) {
          if (s.player.voThuat + rng() * 20 >= 30) {
            s.player.voThuat = Math.min(100, s.player.voThuat + 2); s.player.tien += 15; s.player.uyTinCong += 10;
            logLine(s, "Đánh đổ hết bọn cướp, thu được 15 quan chiến lợi phẩm. Tiếng lên!"); }
          else { s.player.theLuc -= 60; s.player.tien = Math.floor(s.player.tien * 0.5); s.uiShakeProfile = true;
            logLine(s, "Liều lĩnh mà võ yếu. Bị nện te tua, mất nửa tiền."); }
        }},
      { label: "Dùng miệng lách qua (Mưu Mẹo)",
        impact: [{ label: "Thử Mưu Mẹo", color: "#ffd43b" }, { label: "Thoát không mất gì", color: "#51cf66" }],
        apply(s) {
          if (s.player.muuMeo + rng() * 20 >= 28) {
            s.player.muuMeo = Math.min(100, s.player.muuMeo + 1);
            logLine(s, "Bịa ra chuyện là cháu đầu lĩnh sơn tặc vùng Tam Đảo. Bọn cướp sợ xanh mặt bỏ chạy."); }
          else { s.player.tien = 0; s.player.theLuc -= 40; s.uiShakeProfile = true;
            logLine(s, "Bịa không khéo bị lộ, ăn thêm trận đòn, lột sạch."); }
        }},
      { label: "Gia nhập bọn cướp",
        impact: [{ label: "+Binh Quyền", color: "#51cf66" }, { label: "-Uy tín", color: "#ff6b6b" }, { label: "Trở thành cướp", color: "#ff9800" }],
        apply(s) {
          if (s.player.rank === PlayerRank.DAN_THUONG) {
            s.player.rank = PlayerRank.THU_LINH; s.player.uyTinCong -= 30; s.player.binhQuyen += 20; s.player.quanSo += 20;
            s.player.tien += 50;
            logLine(s, "Bước qua lằn ranh. Từ nay làm thủ lĩnh sơn tặc trên đường núi Sơn Tây!"); }
          else logLine(s, "Bọn cướp nhìn quần áo biết anh không phải dân thường. Đòi tiền chia chác rồi cho đi."); }},
    ]
  };
}

function evThienTai(state) {
  const loai = ["Mưa lũ cuốn trôi nhà kho", "Hạn hán bốn tháng không mưa", "Chuột tràn phá hoại mùa màng"];
  const l = loai[randInt(0, loai.length - 1)];
  return {
    id: "thien_tai",
    title: "Trời Đất Thịnh Nộ",
    narrative: `${l}. Cả làng nhốn nháo, người lo của người lo mạng.`,
    choices: [
      { label: "Chia thóc cứu tế dân làng (20 thóc)",
        impact: [{ label: "-20 Thóc", color: "#ff6b6b" }, { label: "+30 Uy tín", color: "#74c0fc" }, { label: "Giảm bất ổn làng", color: "#51cf66" }],
        apply(s) {
          if (s.player.thocCaNhan >= 20) { s.player.thocCaNhan -= 20; s.player.uyTinCong += 30; s.village.unrest = Math.max(0, s.village.unrest - 15); logLine(s, "Mở kho chia thóc, tiếng thơm lan làng trên xóm dưới."); }
          else logLine(s, "Muốn giúp mà kho thóc cũng cạn."); }},
      { label: "Lo của riêng mình cất giữ",
        impact: [{ label: "-Uy tín", color: "#ff6b6b" }, { label: "An toàn tài sản", color: "#51cf66" }],
        apply(s) { s.player.uyTinCong -= 10; logLine(s, "Lo trước cho mình. Xóm giềng nhìn không được thiện cảm."); }},
      { label: "Lợi dụng bán thóc giá cao (gấp đôi)",
        impact: [{ label: "+Quan nhiều", color: "#51cf66" }, { label: "-50 Uy tín", color: "#ff6b6b" }],
        apply(s) {
          let thoc = s.player.thocCaNhan;
          if (thoc > 0) { let gain = thoc * 3; s.player.tien += gain; s.player.thocCaNhan = 0; s.player.uyTinCong -= 50; s.village.unrest += 20; logLine(s, `Chặt chém dân đói, kiếm được ${gain} quan. Cả làng nguyền rủa.`); }
          else logLine(s, "Không có thóc để bán."); }},
    ]
  };
}

function evNhaSu(state) {
  return {
    id: "nha_su",
    title: "Tiếng Chuông Từ Bi",
    narrative: "Đi ngang chùa cổ giữa núi. Một hòa thượng già nhìn thẳng vào mắt hỏi: 'Thí chủ tìm gì trong cõi tục lụy này?'",
    choices: [
      { label: "Quyên 50 quan xây tháp Phật",
        impact: [{ label: "-50 Quan", color: "#ff6b6b" }, { label: "+40 Uy tín", color: "#74c0fc" }, { label: "+30 Danh Vọng", color: "#ffd43b" }],
        apply(s) {
          if (s.player.tien >= 50) { s.player.tien -= 50; s.player.uyTinCong += 40; s.player.danhVong += 30; logLine(s, "Đại thí chủ! Sư trụ trì tụng kinh cầu phúc. Danh tiếng vang xa."); }
          else logLine(s, "Muốn làm phước mà túi rỗng."); }},
      { label: "Nhập môn học đạo (5 ngày)",
        impact: [{ label: "-5 Thể lực", color: "#ff6b6b" }, { label: "+8 Học Vấn", color: "#51cf66" }, { label: "+15 Uy tín", color: "#74c0fc" }],
        apply(s) { s.player.theLuc = Math.max(10, s.player.theLuc - 5); s.player.hocVan = Math.min(100, s.player.hocVan + 8); s.player.uyTinCong += 15; logLine(s, "Năm ngày tịnh tâm học đạo. Trí tuệ mở mang."); }},
      { label: "Thụ đao vào chùa cướp tiền bạc hương đăng",
        impact: [{ label: "+Tiền ít", color: "#51cf66" }, { label: "-80 Uy tín", color: "#ff6b6b" }, { label: "Bị nguyền rủa", color: "#ff6b6b" }],
        apply(s) { s.player.tien += 30; s.player.uyTinCong -= 80; s.village.unrest += 10; logLine(s, "Kẻ ác cướp đồ Phật. Cả vùng tránh xa. Tội lỗi chồng chất."); }},
      { label: "Lễ Phật rồi đi về",
        impact: [{ label: "+Bình yên nội tâm", color: "#999" }],
        apply(s) { logLine(s, "Thắp nén nhang, lòng nhẹ nhõm bước tiếp."); }}
    ]
  };
}

function evTuyetKyVo(state) {
  return {
    id: "tuyet_ky",
    title: "Bí Kíp Trong Hốc Đá",
    narrative: "Sau trận mưa, lộ ra một cuốn sách nhỏ dính đất trong hốc đá. Trang đầu chữ Nôm: 'Thất Thương Quyền Phổ'.",
    choices: [
      { label: "Khổ luyện bí kíp một tháng",
        impact: [{ label: "-30 Thể lực", color: "#ff6b6b" }, { label: "+12 Võ Thuật", color: "#51cf66" }],
        apply(s) { s.player.theLuc -= 30; s.player.voThuat = Math.min(100, s.player.voThuat + 12); logLine(s, "Máu chảy ướt áo luyện tập. Cuối cùng đột phá võ công!"); }},
      { label: "Bán cho chủ võ đường",
        impact: [{ label: "+30 Quan", color: "#51cf66" }, { label: "+5 Uy tín", color: "#74c0fc" }],
        apply(s) { s.player.tien += 30; s.player.uyTinCong += 5; logLine(s, "Bán lại được 30 quan. Thực dụng hơn."); }},
      { label: "Trao lại cho học trò nghèo",
        impact: [{ label: "+25 Uy tín", color: "#74c0fc" }, { label: "+20 Danh Vọng", color: "#ffd43b" }],
        apply(s) { s.player.uyTinCong += 25; s.player.danhVong += 20; logLine(s, "Nghĩa hiệp nhường sách. Học trò thề báo ơn một ngày nào đó."); }},
    ]
  };
}

function evHoiCho(state) {
  return {
    id: "hoi_cho",
    title: "Hội Chợ Mùa Xuân",
    narrative: "Tiếng trống vui vẻ, hội chợ khai màn. Người người nhộn nhịp, cờ bay phấp phới.",
    choices: [
      { label: "Mở gian hàng bán đồ",
        impact: [{ label: "+30-80 Quan (tùy may)", color: "#51cf66" }, { label: "Tốn công sức", color: "#ff6b6b" }],
        apply(s) {
          let earn = randInt(30, 80); s.player.tien += earn; s.player.theLuc -= 20;
          s.player.quanLy = Math.min(100, s.player.quanLy + 1);
          logLine(s, `Hội chợ đông vui, bán hàng thu về ${earn} quan.`); }},
      { label: "Xem lẫn đặt cược đấu võ",
        impact: [{ label: "50% +50 Quan, 50% -20 Quan", color: "#ffd43b" }],
        apply(s) {
          if (rng() < 0.5 + s.player.voThuat * 0.003) { s.player.tien += 50; logLine(s, "Đặt cược đúng người thắng. Bộn tiền!"); }
          else { s.player.tien = Math.max(0, s.player.tien - 20); logLine(s, "Đặt nhầm! Mất 20 quan."); }
        }},
      { label: "Gặp gỡ kết giao",
        impact: [{ label: "+1 NPC quen biết", color: "#74c0fc" }, { label: "+10 Ngoại Giao", color: "#51cf66" }],
        apply(s) { s.player.ngoaiGiao = Math.min(100, s.player.ngoaiGiao + 2); s.player.uyTinCong += 10; logLine(s, "Quen thêm được dăm người có chức sắc. Nên thân."); }},
      { label: "Chộp cơ hội móc túi người đông",
        impact: [{ label: "Thử Mưu Mẹo", color: "#ffd43b" }, { label: "+Tiền nếu may", color: "#51cf66" }, { label: "-Uy tín nếu bị bắt", color: "#ff6b6b" }],
        apply(s) {
          if (s.player.muuMeo + rng() * 25 >= 30) { let loot = randInt(10, 40); s.player.tien += loot; logLine(s, `Tay nghề điêu luyện giữa đám đông. Móc được ${loot} quan!`); }
          else { s.player.uyTinCong -= 40; s.player.theLuc -= 30; s.uiShakeProfile = true; logLine(s, "Bị bắt quả tang! Cả hội chợ xúm lại đánh."); }
        }},
    ]
  };
}

function evDichBenh(state) {
  return {
    id: "dich_benh",
    title: "Dịch Bệnh Lan Làng",
    narrative: "Mấy nhà trong xóm liên tiếp có người lên cơn sốt cao. Phù thủy nói 'ma quỷ quở'. Thầy thuốc không có.",
    choices: [
      { label: "Bỏ tiền mời thầy thuốc giỏi (50 quan)",
        impact: [{ label: "-50 Quan", color: "#ff6b6b" }, { label: "+40 Uy tín", color: "#74c0fc" }, { label: "Làng giảm bất ổn", color: "#51cf66" }],
        apply(s) {
          if (s.player.tien >= 50) {
            s.player.tien -= 50;
            s.player.uyTinCong += 40;
            s.village.unrest = Math.max(0, s.village.unrest - 20);
            s.village.khoThoc = Math.max(0, (s.village.khoThoc || 0) - 25);
            logLine(s, "Thầy thuốc đến chữa trị. Dân làng ơn xương ơn thịt — kho làng vẫn hao vì dịch và phát chẩn.");
          }
          else logLine(s, "Không đủ tiền mời thầy.");
        }},
      { label: "Dùng kiến thức y học tự chữa",
        impact: [{ label: "Thử Học Vấn", color: "#ffd43b" }, { label: "+Uy tín nếu thành công", color: "#51cf66" }],
        apply(s) {
          if (s.player.hocVan + rng() * 20 >= 25) { s.player.uyTinCong += 25; s.village.unrest = Math.max(0, s.village.unrest - 10); logLine(s, "Biết dùng thuốc nam, cứu được vài mạng người. Cả làng biết ơn."); }
          else { s.player.dangOm = true; s.player.theLuc = 0; logLine(s, "Bị lây bệnh! Nằm liệt giường cả tháng."); }
        }},
      { label: "Chạy về phía không có dịch",
        impact: [{ label: "An toàn bản thân", color: "#51cf66" }, { label: "-20 Uy tín", color: "#ff6b6b" }],
        apply(s) {
          s.player.uyTinCong -= 20;
          s.village.unrest = Math.min(100, (s.village.unrest || 0) + 12);
          s.village.khoThoc = Math.max(0, (s.village.khoThoc || 0) - 35);
          logLine(s, "Bỏ làng trốn dịch. Sống sót nhưng bị chê; làng mất người, kho thóc công cũng hao hụt.", true);
        }},
    ]
  };
}

function evTinDon(state) {
  const tinDon = [
    "Có kho báu chôn giữa gò đất phía Đông",
    "Tri huyện đang nhận hối lộ từ nhà giàu trong vùng",
    "Đội quân nghĩa quân sắp tập kích trấn lỵ đêm nay",
    "Quan trấn sắp thu thêm thuế gấp đôi tháng tới",
  ];
  const tin = tinDon[randInt(0, tinDon.length - 1)];
  return {
    id: "tin_don",
    title: "Tin Đồn Giữa Chợ",
    narrative: `Một thương nhân thì thầm vào tai: "${tin}."`,
    choices: [
      { label: "Kiểm tra xem có thật không (Tiêu 1 ngày)",
        impact: [{ label: "-10 Thể lực", color: "#ff6b6b" }, { label: "Cơ hội lợi lớn", color: "#51cf66" }],
        apply(s) {
          s.player.theLuc -= 10;
          if (rng() < 0.4) { s.player.tien += randInt(50, 200); s.player.muuMeo = Math.min(100, s.player.muuMeo + 1); logLine(s, "Thông tin có giá trị thật! Nhanh tay kiếm bộn."); }
          else logLine(s, "Tin đồn thổi. Tốn công mà không được gì."); }},
      { label: "Tố giác lên quan nếu là tin về loạn",
        impact: [{ label: "+15 Uy tín (với triều đình)", color: "#74c0fc" }],
        apply(s) { s.player.uyTinCong += 15; logLine(s, "Báo tin lên quan huyện. Được khen thưởng nhỏ."); }},
      { label: "Bắt đầu tung đồn để trục lợi",
        impact: [{ label: "Thử Mưu Mẹo", color: "#ffd43b" }, { label: "+Quan nếu lường gạt", color: "#51cf66" }],
        apply(s) {
          if (s.player.muuMeo + rng() * 20 >= 25) { s.player.tien += randInt(20, 60); logLine(s, "Thêm thắt bịa đặt, bán thông tin ra giá cao. Lợi không nhỏ."); }
          else { s.player.uyTinCong -= 15; logLine(s, "Bị nhận ra là bịa đặt. Tự chuốc nhục!"); }
        }},
      { label: "Cười bỏ qua",
        impact: [],
        apply(s) { logLine(s, "Tin đồn gió bay."); }},
    ]
  };
}

function evGapNguoiLa(state) {
  const nguoi = ["một lão tướng thất thế lẩn trốn triều đình", "một thương nhân người Hoa buôn lụa", "một thầy đồ lưu lạc xa xứ", "một thám tử của Phủ Chúa"];
  const ng = nguoi[randInt(0, nguoi.length - 1)];
  return {
    id: "gap_nguoi_la",
    title: "Người Lạ Trên Đường",
    narrative: `Gặp ${ng} ngồi nghỉ bên vệ đường. Nhìn vào mắt thấy cả trời đất sóng gió.`,
    choices: [
      { label: "Ngồi xuống trò chuyện học hỏi",
        impact: [{ label: "+1 Kỹ năng ngẫu nhiên", color: "#51cf66" }, { label: "+10 Ngoại Giao", color: "#74c0fc" }],
        apply(s) {
          s.player.ngoaiGiao = Math.min(100, s.player.ngoaiGiao + 2);
          const roll = rng();
          if (roll < 0.2) { s.player.hocVan = Math.min(100, s.player.hocVan + 5); logLine(s, "Học được nhiều điều về quản trị. Học Vấn tăng!"); }
          else if (roll < 0.4) { s.player.voThuat = Math.min(100, s.player.voThuat + 5); logLine(s, "Được chỉ dạy vài thế võ cổ truyền. Võ Thuật tăng!"); }
          else if (roll < 0.6) { s.player.muuMeo = Math.min(100, s.player.muuMeo + 5); logLine(s, "Học được mưu lược từ con người trải đời. Mưu Mẹo tăng!"); }
          else { s.player.quanLy = Math.min(100, s.player.quanLy + 5); logLine(s, "Lĩnh hội bí quyết buôn bán. Quản Lý tăng!"); }
        }},
      { label: "Đề nghị làm ăn cùng nhau",
        impact: [{ label: "50% +50 Quan", color: "#51cf66" }, { label: "50% bị lừa -30 Quan", color: "#ff6b6b" }],
        apply(s) {
          if (rng() < 0.5 + s.player.muuMeo * 0.005) { s.player.tien += 50; logLine(s, "Làm ăn phát đạt. Đối tác tốt bụng chia đôi lợi nhuận."); }
          else { s.player.tien = Math.max(0, s.player.tien - 30); logLine(s, "Bị lừa mất 30 quan. Người lạ biến mất như khói."); }
        }},
      { label: "Tố giác (nếu là kẻ trốn chạy)",
        impact: [{ label: "+20 Uy tín với triều đình", color: "#74c0fc" }, { label: "+Tiền thưởng", color: "#51cf66" }],
        apply(s) { s.player.uyTinCong += 20; s.player.tien += 50; logLine(s, "Báo quan bắt tên trốn chạy. Được thưởng tiền và tiếng thơm."); }},
    ]
  };
}

// ============================================================
// NHÓM 2: SỰ KIỆN XÃ HỘI VÀ GIA ĐÌNH
// ============================================================

function evLayVo(state) {
  if (state.player.giaDinh?.vo) return null;
  if (state.player.tien < 20) return null;
  const isNam = (state.player.gender || "nam") === "nam";

  // NPC ngẫu nhiên từ làng — kiểm tra giới tính ngược
  const npcs = Object.values(state.npcById || {});
  const targetGender = isNam ? "Nữ" : "Nam";
  const candidates = npcs.filter(n => n.gender === targetGender && !n.married);
  const npc = candidates.length > 0 ? candidates[Math.floor(rng() * candidates.length)] : null;

  // Tính xác suất đồng ý của NPC
  // Dựa vào opinion + ngoaiGiao + bẩm sinh đẹp trai/xinh gái của player
  const baseOpinion = npc ? npc.opinion : 0;
  const appealBonus = state.player._birthDepTrai ? 15 : 0;
  const npcWilling  = (baseOpinion + appealBonus + state.player.ngoaiGiao * 0.5) >= 10;

  if (isNam) {
    const tenNPC = npc?.name || "Thị Cúc";
    const tenNPC2 = "Thị Mai";
    return {
      id: "lay_vo",
      title: "Duyên Phận Tơ Hồng",
      narrative: npc
        ? `Bà mối giới thiệu ${tenNPC} (${npc.age} tuổi, cảm tình: ${baseOpinion > 10 ? "😊 Thiện cảm" : baseOpinion < -5 ? "😒 Lạnh nhạt" : "😐 Bình thường"}). Cha cô hỏi: "Có 50 quan sính lễ không?"`
        : "Bà mối dẫn đến một thiếu nữ, nhà nghèo nhưng nết na. 'Có 50 quan sính lễ thì tôi gả.'",
      choices: [
        { label: `Bỏ 50 quan rước ${npc ? tenNPC : "nàng"} về`,
          impact: [{ label: "-50 Quan", color: "#ff6b6b" }, { label: "+Lấy vợ", color: "#74c0fc" }],
          apply(s) {
            if (!npcWilling && npc) {
              logLine(s, `${tenNPC} lắc đầu từ chối. Cảm tình chưa đủ để cô ấy đồng ý.`);
              return;
            }
            if (s.player.tien >= 50) {
              s.player.tien -= 50;
              s.player.giaDinh.vo = npc ? tenNPC : "Thị Cúc";
              s.player.uyTinCong += 10;
              if (npc) npc.married = true;
              logLine(s, `Khói trầm nghi ngút, đèn hoa lung linh. ${s.player.giaDinh.vo} về dinh.`);
            } else logLine(s, "Hụt tiền cưới.");
          }},
        { label: "Hỏi vay thêm tiền cưới (tín dụng 30Q, trả 45Q)",
          impact: [{ label: "+Vợ", color: "#74c0fc" }, { label: "+Nợ 45 Quan", color: "#ff6b6b" }],
          apply(s) {
            if (!npcWilling && npc) { logLine(s, `${tenNPC} vẫn lắc đầu. Tiền nhiều mà tình ít cũng vô nghĩa.`); return; }
            s.player.tien += 30; s.player.noVayConLai += 45;
            if (s.player.tien >= 50) { s.player.tien -= 50; s.player.giaDinh.vo = tenNPC2; if(npc) npc.married=true; logLine(s, `Vay mượn thêm, cưới được ${tenNPC2} về. Còn nợ phải trả.`); }
            else logLine(s, "Vay thêm nhưng vẫn không đủ sính lễ.");
          }},
        { label: "Từ chối khéo",
          impact: [{ label: "Vẫn độc thân", color: "#999" }],
          apply(s) { logLine(s, "Nhẹ nhàng từ chối. Chưa đến lúc."); }},
      ]
    };
  } else {
    // Player nữ → cưới chồng
    const tenNPC = npc?.name || "Nguyễn Văn Hùng";
    const isRich  = npc ? npc.tien > 50 : false;
    let narrativeText = "Bà mối dẫn đến một trang nam nhi, gia thế khá. 'Chàng ấy đang hỏi thăm ý nàng.'";
    if (npc) {
      const attitudeText = baseOpinion > 10 ? "'Ưng lắm!'" : baseOpinion < -5 ? "'Còn phải xem lại...'" : "'Được thôi, xem nhà!'";
      narrativeText = `Một mối mai dẫn đến ${tenNPC} (${npc.age} tuổi${isRich ? ", nhà khá giả" : ""}). Nhà trai nhìn thái độ: ${attitudeText}`;
    }
    return {
      id: "lay_vo",
      title: "Chỉ Mành Treo Chuông",
      narrative: narrativeText,
      choices: [
        { label: "Gật đầu thuận hôn",
          impact: [{ label: "+Lấy chồng", color: "#74c0fc" }, { label: "-20 Quan lễ vật", color: "#ff6b6b" }],
          apply(s) {
            if (!npcWilling && npc) { logLine(s, `${tenNPC} lịch sự từ chối. Duyên phận chưa tới.`); return; }
            if (s.player.tien >= 20) {
              s.player.tien -= 20;
              s.player.giaDinh.vo = npc ? tenNPC : "Nguyễn Văn Thuận";
              s.player.uyTinCong += 10;
              if (npc) npc.married = true;
              logLine(s, `Lễ thành hôn chu đáo. ${s.player.giaDinh.vo} về chung mái nhà.`);
            } else logLine(s, "Không đủ tiền lễ vật.");
          }},
        { label: "Từ chối — tự lập không cần dựa vào ai",
          impact: [{ label: "+5 Uy tín (độc lập)", color: "#74c0fc" }],
          apply(s) { s.player.uyTinCong += 5; logLine(s, "Từ chối hôn sự. Tự mình lo thân mình."); }},
      ]
    };
  }
}

function evGiaDinh(state) {
  if (!state.player.giaDinh?.vo) return null;
  const vợ = state.player.giaDinh.vo;
  return {
    id: "gia_dinh",
    title: "Chuyện Nhà Cửa",
    narrative: `${vợ} đến nói chuyện cùng: 'Chàng ơi, nhà đang cần tiền mua gạo, lại cha mẹ bên ngoại ốm cần thuốc...'`,
    choices: [
      { label: "Chu cấp đầy đủ cho gia đình (30 quan)",
        impact: [{ label: "-30 Quan", color: "#ff6b6b" }, { label: "+Gia đình hạnh phúc", color: "#74c0fc" }, { label: "+20 Uy tín", color: "#51cf66" }],
        apply(s) {
          if (s.player.tien >= 30) { s.player.tien -= 30; s.player.uyTinCong += 20; s.player.theLuc = Math.min(100, s.player.theLuc + 10); logLine(s, "Chu toàn gia thất. Vợ hết lòng biết ơn, thể lực hồi phục tốt hơn."); }
          else logLine(s, "Không đủ tiền, vợ ôm mặt khóc."); }},
      { label: "Giải thích tình hình khó khăn",
        impact: [{ label: "Không tốn tiền", color: "#999" }, { label: "-5 Thể lực (căng thẳng)", color: "#ff6b6b" }],
        apply(s) { s.player.theLuc = Math.max(5, s.player.theLuc - 5); logLine(s, "Giải thích khó khăn. Vợ hiểu nhưng vẫn lo."); }},
      { label: "Phát cáu và bỏ đi",
        impact: [{ label: "-30 Uy tín", color: "#ff6b6b" }, { label: "-Quan hệ gia đình", color: "#ff6b6b" }],
        apply(s) { s.player.uyTinCong -= 30; s.player.giaDinh.vo += " (Giận)"; logLine(s, "Nóng giận mắng vợ. Nhà không còn ấm."); }},
    ]
  };
}

function evConCai(state) {
  if (!state.player.giaDinh?.vo || state.player.giaDinh.con < 1) return null;
  return {
    id: "con_cai",
    title: "Chuyện Con Trẻ",
    narrative: "Đứa con trai lớn đến hỏi: 'Con muốn đi học võ ở võ đường trong trấn. Bố cho phép không?'",
    choices: [
      { label: "Cho tiền cho con đi học (50 quan)",
        impact: [{ label: "-50 Quan", color: "#ff6b6b" }, { label: "+Con nối dõi thêm kỹ năng", color: "#51cf66" }],
        apply(s) {
          if (s.player.tien >= 50) { s.player.tien -= 50; s.player.danhVong += 30; logLine(s, "Con trai lên đường học võ. Tương lai sáng lạn!"); }
          else logLine(s, "Không đủ tiền gửi con đi học."); }},
      { label: "Bắt con ở nhà phụ làm ruộng",
        impact: [{ label: "+10 Thóc/tháng", color: "#51cf66" }, { label: "Con không phát triển", color: "#ff6b6b" }],
        apply(s) { s.village.khoThoc += 10; logLine(s, "Con ở nhà cày cuốc. Lợi trước mắt nhưng lỡ tương lai."); }},
      { label: "Để con tự quyết định",
        impact: [{ label: "+10 Uy tín (cha tốt)", color: "#74c0fc" }],
        apply(s) { s.player.uyTinCong += 10; logLine(s, "Dạy con tự lập. Con cảm ơn với đôi mắt sáng."); }},
    ]
  };
}

// ============================================================
// NHÓM 3: CHIẾN TRANH & BINH ĐAO
// ============================================================

function evTroBinh(state) {
  if (state.player.quanSo < 10) return null;
  return {
    id: "tro_binh",
    title: "Nghĩa Quân Kẻ Chiêu Mộ",
    narrative: "Một thủ lĩnh nghĩa quân gửi mật thư: 'Cùng ta đánh giặc? Chia đôi chiến lợi phẩm và đất đai.'",
    choices: [
      { label: "Gia nhập nghĩa quân (bỏ phe triều đình)",
        impact: [{ label: "+Quân to", color: "#51cf66" }, { label: "Trở thành phản loạn", color: "#ff9800" }, { label: "-Uy tín với triều đình", color: "#ff6b6b" }],
        apply(s) {
          s.player.rank = PlayerRank.THU_LINH; s.player.uyTinCong -= 50; s.player.quanSo += 100; s.player.tien += 200; s.player.faction = Faction.NGHIA_QUAN;
          logLine(s, "Quay giáo hướng về kinh thành! Bước chân vào con đường phản loạn."); }},
      { label: "Giả vờ đồng ý rồi báo quan",
        impact: [{ label: "+30 Uy tín", color: "#74c0fc" }, { label: "+Tiền thưởng", color: "#51cf66" }],
        apply(s) {
          if (s.player.muuMeo + rng() * 20 >= 20) { s.player.uyTinCong += 30; s.player.tien += 100; logLine(s, "Vừa đóng kịch đồng ý, vừa nhét thư vào túi báo quan. Thưởng hậu!"); }
          else { s.player.uyTinCong -= 30; s.player.theLuc -= 50; logLine(s, "Kế sách bị phát hiện. Nghĩa quân nổi giận đánh tan tác!"); }
        }},
      { label: "Từ chối không can dự",
        impact: [{ label: "An toàn", color: "#999" }],
        apply(s) { logLine(s, "Từ chối khéo léo. Đủ khôn để không dính vào chuyện nguy hiểm."); }},
    ]
  };
}

function evChienSiPhanBoi(state) {
  if (state.player.quanSo < 30) return null;
  return {
    id: "chien_si_phan_boi",
    title: "Binh Sĩ Muốn Đào Thoát",
    narrative: "Cai đội báo cáo: 10 tên lính lén liên lạc với giặc. Cần xử lý ngay kẻo loạn nội bộ.",
    choices: [
      { label: "Chém đầu làm gương",
        impact: [{ label: "-10 Quân", color: "#ff6b6b" }, { label: "+Sĩ khí (sợ)", color: "#51cf66" }, { label: "-20 Uy tín do dã man", color: "#ff6b6b" }],
        apply(s) { s.player.quanSo = Math.max(0, s.player.quanSo - 10); s.player.uyTinCong -= 20; logLine(s, "Chặt đầu 10 tên trước hàng quân. Cả đội im lặng như tờ — vì sợ hãi."); }},
      { label: "Tha tội điều tra ai xúi bẩy",
        impact: [{ label: "+5 Quân trung thành", color: "#51cf66" }, { label: "Có thể tìm ra gián điệp địch", color: "#74c0fc" }],
        apply(s) {
          s.player.ngoaiGiao = Math.min(100, s.player.ngoaiGiao + 2);
          if (rng() < 0.5) { s.player.tien += 80; s.player.uyTinCong += 20; logLine(s, "Khéo léo khai thác. Tìm ra gián điệp địch, lấy được cả tài liệu mật!"); }
          else logLine(s, "Điều tra không ra gì. Ít nhất lính được tha thán phục."); }},
      { label: "Tăng lương cho toàn quân",
        impact: [{ label: "-100 Quan", color: "#ff6b6b" }, { label: "+Sĩ khí cao", color: "#51cf66" }],
        apply(s) {
          if (s.player.tien >= 100) { s.player.tien -= 100; logLine(s, "Tăng lương tất cả binh sĩ. Không còn ai muốn đào ngũ."); }
          else logLine(s, "Muốn tăng lương mà kho rỗng."); }},
    ]
  };
}

function evLinhDao_Ngu(state) {
  // Alias — dùng cùng logic với evLinh_DaoNgu
  return evLinh_DaoNgu(state);
}
function evLinh_DaoNgu(state) {
  if (state.player.quanSo < 30) return null;
  return {
    id: "linh_dao_ngu",
    title: "Lính Hết Thóc Kêu Đói",
    narrative: "Cả đại đội ngồi im không chịu ra trận. Đại diện tâu: 'Bữa nay, binh không cơm, gươm không giơ được!'",
    choices: [
      { label: "Mở kho thóc cấp lương (30 thóc)",
        impact: [{ label: "-30 Thóc", color: "#ff6b6b" }, { label: "+Trật tự đội quân", color: "#51cf66" }],
        apply(s) {
          if (s.player.thocCaNhan >= 30) { s.player.thocCaNhan -= 30; logLine(s, "Mở kho lương cứu đội. Quân sĩ ngoan ngoãn đội ngũ ngay."); }
          else { s.player.quanSo -= 20; logLine(s, "Không đủ thóc! 20 tên bỏ trốn về quê."); }
        }},
      { label: "Mua thóc từ làng kế (giá cao 60 quan)",
        impact: [{ label: "-60 Quan", color: "#ff6b6b" }, { label: "+Ổn định quân đội", color: "#51cf66" }],
        apply(s) {
          if (s.player.tien >= 60) { s.player.tien -= 60; logLine(s, "Mua thóc đắt nhưng giữ được đội ngũ."); }
          else { s.player.quanSo -= 20; logLine(s, "Mua không nổi, quân đào ngũ hàng loạt!"); }
        }},
      { label: "Ra lệnh cướp thóc trong vùng",
        impact: [{ label: "+30 Thóc", color: "#51cf66" }, { label: "-50 Uy tín", color: "#ff6b6b" }, { label: "Dân oán thán", color: "#ff6b6b" }],
        apply(s) { s.player.thocCaNhan += 30; s.player.uyTinCong -= 50; s.village.unrest += 20; logLine(s, "Cướp thóc dân lành. Quân no bụng nhưng dân thù oán."); }},
    ]
  };
}

function evPhanLoaN(state) {
  if (state.player.quanSo < 100) return null;
  return {
    id: "phan_loan",
    title: "Nội Loạn Trong Hàng Ngũ",
    narrative: "Hai cánh tướng tá tranh giành quyền chỉ huy. Nếu không dập tắt, quân có thể tan rã.",
    choices: [
      { label: "Hòa giải chia quyền bình đẳng",
        impact: [{ label: "+Ngoại Giao", color: "#51cf66" }, { label: "Quân ổn định", color: "#74c0fc" }],
        apply(s) {
          if (s.player.ngoaiGiao + rng() * 20 >= 25) { s.player.ngoaiGiao = Math.min(100, s.player.ngoaiGiao + 3); logLine(s, "Dàn xếp thành công. Hai cánh họp lại dưới quyền."); }
          else { s.player.quanSo = Math.floor(s.player.quanSo * 0.7); logLine(s, "Hòa giải thất bại! Cánh kém hơn rút lui mang 30% quân theo."); }
        }},
      { label: "Giải tán cánh yếu hơn",
        impact: [{ label: "-30% Quân", color: "#ff6b6b" }, { label: "+Ổn định lâu dài", color: "#51cf66" }],
        apply(s) { s.player.quanSo = Math.floor(s.player.quanSo * 0.7); logLine(s, "Cánh yếu bị giải tán. Quân ít hơn nhưng đoàn kết hơn."); }},
      { label: "Thưởng tiền cho cả hai cánh",
        impact: [{ label: "-100 Quan", color: "#ff6b6b" }, { label: "Mọi người vui vẻ", color: "#51cf66" }],
        apply(s) {
          if (s.player.tien >= 100) { s.player.tien -= 100; logLine(s, "Bỏ tiền ra phủ dụ. Tranh chấp tan biến."); }
          else { s.player.quanSo = Math.floor(s.player.quanSo * 0.8); logLine(s, "Không đủ tiền, quân tiếp tục chia rẽ!"); }
        }},
    ]
  };
}

// ============================================================
// NHÓM 4: QUAN TRƯỜNG VÀ CHÍNH TRỊ
// ============================================================

function evThamNhung(state) {
  if (state.player.tien < 100) return null;
  return {
    id: "tham_nhung",
    title: "Tri Phủ Mời Lên Dinh",
    narrative: "Tri Phủ biết bạn đang có của. Hắn mời một mình lên dinh ngồi trà. 'Ở đây ai cũng phải nộp chút hiếu kính mới yên.'",
    choices: [
      { label: "Nộp 50 quan 'hiếu kính'",
        impact: [{ label: "-50 Quan", color: "#ff6b6b" }, { label: "+Quan hệ phủ huyện", color: "#74c0fc" }, { label: "+15 Uy tín (với quan)", color: "#51cf66" }],
        apply(s) { s.player.tien -= 50; s.player.quyenLuc += 20; s.player.uyTinCong += 15; logLine(s, "Đút lót. Từ nay Tri Phủ có mắt có tai, việc gì cũng bao che."); }},
      { label: "Phân lý bằng Học Vấn",
        impact: [{ label: "Thử Học Vấn", color: "#ffd43b" }, { label: "Rủi ro cao", color: "#ff6b6b" }],
        apply(s) {
          if (s.player.hocVan + rng() * 20 >= 35) { s.player.uyTinCong += 25; logLine(s, "Dẫn luật Hồng Đức và tiền lệ, quan cứng họng đành thả bạn về."); }
          else { s.player.tien -= 150; s.uiShakeProfile = true; logLine(s, "Học chưa đủ, quan tức giận phạt vạ gấp ba!"); }
        }},
      { label: "Giả vờ đồng ý rồi tố cáo lên Đốc Trấn",
        impact: [{ label: "Thử Mưu Mẹo", color: "#ffd43b" }, { label: "+Uy tín lớn nếu thành", color: "#74c0fc" }],
        apply(s) {
          if (s.player.muuMeo + rng() * 20 >= 30) { s.player.uyTinCong += 60; s.player.danhVong += 50; logLine(s, "Thu thập bằng chứng, tố cáo lên Đốc Trấn. Tri Phủ bị cách chức. Bạn nổi tiếng!"); }
          else { s.player.tien -= 200; s.player.uyTinCong -= 50; s.uiShakeProfile = true; logLine(s, "Bị phản đòn! Tri Phủ cho người đánh đập và tịch thu nhiều hơn."); }
        }},
      { label: "Dùng mối quan hệ trong Phủ Chúa khoe trước",
        impact: [{ label: "Cần Quyền Lực > 30", color: "#ffd43b" }],
        apply(s) {
          if (s.player.quyenLuc >= 30) { logLine(s, "Sơ sơ đề cập 'tôi quen quan lớn phủ Chúa'. Tri Phủ nhợt mặt, thôi không đụng đến."); }
          else { s.player.tien -= 80; logLine(s, "Bluff không qua mặt được người. Bị phạt thêm."); }
        }},
    ]
  };
}

function evXuKien(state) {
  if (state.player.rank !== PlayerRank.LY_TRUONG && state.player.rank !== PlayerRank.CHANH_TONG && state.player.rank !== PlayerRank.TRI_HUYEN) return null;
  return {
    id: "xu_kien",
    title: "Kiện Tụng Ruộng Đất",
    narrative: "Trần Nhị kiện họ Nguyễn lấn chiếm 2 sào đất. Cả hai vác bằng khoán, ai cũng kêu là của mình.",
    choices: [
      { label: "Hòa giải chia đôi",
        impact: [{ label: "+15 Uy tín", color: "#74c0fc" }],
        apply(s) {
          if (s.player.ngoaiGiao + rng() * 20 >= 20) { s.player.uyTinCong += 15; logLine(s, "Ép hai bên bắt tay chia đôi. Làng bình yên trở lại."); }
          else { s.village.unrest += 5; logLine(s, "Hòa giải hỏng, hai bên cạch mặt nhau."); }
        }},
      { label: "Xử theo bằng khoán cũ nhất",
        impact: [{ label: "+20 Uy tín (công bằng)", color: "#74c0fc" }, { label: "+5 Học Vấn", color: "#51cf66" }],
        apply(s) { s.player.uyTinCong += 20; s.player.hocVan = Math.min(100, s.player.hocVan + 2); logLine(s, "Xét bằng khoán cổ, tìm ra bên đúng. Danh tiếng xét xử công minh lan rộng."); }},
      { label: "Ăn hối lộ của bên nào trả nhiều hơn",
        impact: [{ label: "+60 Quan", color: "#51cf66" }, { label: "-30 Uy tín", color: "#ff6b6b" }, { label: "Rủi ro bị tố giác", color: "#ff6b6b" }],
        apply(s) { s.player.tien += 60; s.player.uyTinCong -= 30; s.village.unrest += 10; logLine(s, "Tiền vào túi, bên thua kiện tức tối bỏ đi. Nhưng tiếng ác bắt đầu lan."); }},
    ]
  };
}

function evBonNhiem(state) {
  const needRank = [PlayerRank.DOI_TRUONG, PlayerRank.CAI_CO, PlayerRank.BACH_HO, PlayerRank.TONG_LINH, PlayerRank.TRI_HUYEN, PlayerRank.TRI_PHU];
  if (!needRank.includes(state.player.rank)) return null;
  const p = state.player;
  const chucVu = p.rank === PlayerRank.TRI_HUYEN ? "Tri Phủ" : p.rank === PlayerRank.CAI_CO ? "Bách Hộ" : "Tổng Lĩnh";
  const diaDiem = ["Phủ Nghĩa Hưng (Sơn Nam)", "Huyện Thanh Hà (Hải Dương)", "Huyện Hương Canh (Sơn Tây)"];
  const dd = diaDiem[randInt(0, diaDiem.length - 1)];
  return {
    id: "bon_nhiem",
    title: "Lệnh Triều Đình Bổ Nhiệm",
    narrative: `Sứ quan mang chiếu chỉ đến: 'Lệnh Phủ Chúa Trịnh Doanh khẩn — bổ nhậm khanh làm ${chucVu} tại ${dd}, khởi hành trong 3 ngày!'`,
    choices: [
      { label: `Phụng mệnh nhậm chức ${chucVu}`,
        impact: [{ label: "+Thăng chức", color: "#ffd43b" }, { label: "Di chuyển ngay", color: "#74c0fc" }],
        apply(s) {
          if (p.rank === PlayerRank.DOI_TRUONG) s.player.rank = PlayerRank.CAI_CO;
          else if (p.rank === PlayerRank.CAI_CO) s.player.rank = PlayerRank.BACH_HO;
          else if (p.rank === PlayerRank.TRI_HUYEN) s.player.rank = PlayerRank.TRI_PHU;
          s.player.uyTinCong += 50; s.player.danhVong += 100; s.player.tien += 500;
          logLine(s, `Đội mũ, mặc áo quan, ra đi nhậm chức ${chucVu} tại ${dd}. Lộc vua ban 500 quan.`);
        }},
      { label: "Từ chối vì gia đình bận",
        impact: [{ label: "-50 Uy tín", color: "#ff6b6b" }, { label: "Chúa Trịnh ghét bỏ", color: "#ff6b6b" }],
        apply(s) { s.player.uyTinCong -= 50; s.player.quyenLuc -= 20; logLine(s, "Phủ Chúa Trịnh nổi giận. Quan lại nhìn mình bằng ánh mắt nghi ngờ."); }},
      { label: "Xin hoãn lại 1 tháng lo gia thất",
        impact: [{ label: "-15 Uy tín", color: "#ff6b6b" }, { label: "Chưa mất cơ hội", color: "#74c0fc" }],
        apply(s) { s.player.uyTinCong -= 15; logLine(s, "Xin hoãn 1 tháng. Phủ Chúa khó chịu nhưng chưa về triệu tội."); }},
    ]
  };
}

function evLyTruong(state) {
  return {
    id: "ly_truong_evt",
    title: "Việc Công Của Lý Trưởng",
    narrative: "Hội đồng làng nhóm họp bàn: Nên dùng quỹ làng 200 quan vào việc gì?",
    choices: [
      { label: "Sửa đê ngăn lũ",
        impact: [{ label: "-200 Quan (quỹ làng)", color: "#ff6b6b" }, { label: "+Bảo vệ mùa màng", color: "#51cf66" }, { label: "+20 Uy tín", color: "#74c0fc" }],
        apply(s) { s.village.quyLang = Math.max(0, s.village.quyLang - 200); s.village.unrest = Math.max(0, s.village.unrest - 10); s.player.uyTinCong += 20; logLine(s, "Đê điều được sửa. Mùa màng sang năm an tâm hơn nhiều."); }},
      { label: "Mở trường học trong làng",
        impact: [{ label: "-150 Quan (quỹ làng)", color: "#ff6b6b" }, { label: "+Danh tiếng giáo dục", color: "#74c0fc" }],
        apply(s) { s.village.quyLang = Math.max(0, s.village.quyLang - 150); s.player.uyTinCong += 30; s.player.danhVong += 40; logLine(s, "Trường làng mở cửa. Con em được học chữ. Tiếng lành vọng lên huyện."); }},
      { label: "Biển thủ tiền làng bỏ túi",
        impact: [{ label: "+200 Quan", color: "#51cf66" }, { label: "-60 Uy tín", color: "#ff6b6b" }, { label: "Nguy cơ bị phát hiện", color: "#ff6b6b" }],
        apply(s) {
          s.player.tien += 200; s.village.quyLang = Math.max(0, s.village.quyLang - 200); s.player.uyTinCong -= 60;
          if (rng() < 0.3) { s.player.rank = PlayerRank.DAN_THUONG; s.player.uyTinCong -= 80; logLine(s, "Bị bắt quả tang! Mất chức lý trưởng, bị đánh hội đồng!"); }
          else logLine(s, "Tạm thời qua mặt được mọi người. Đồng tiền từng đồng chui vào túi."); }},
    ]
  };
}

function evChinhSach(state) {
  return {
    id: "chinh_sach",
    title: "Lệnh Mới Từ Phủ Trên",
    narrative: "Quan huyện truyền: tất cả quan lại địa phương phải tăng thu thuế thêm 30% nộp về Thăng Long.",
    choices: [
      { label: "Tuân lệnh thu thuế đúng lệnh",
        impact: [{ label: "+Uy tín với triều đình", color: "#74c0fc" }, { label: "+Bất ổn làng dân", color: "#ff6b6b" }],
        apply(s) { s.player.uyTinCong += 10; s.player.quyenLuc += 5; s.village.unrest += 20; s.village.quyLang += 200; logLine(s, "Thu đủ thuế nộp lên. Triều đình khen ngợi. Dân oán thán thêm."); }},
      { label: "Thu vừa phải, bào làng ít thôi",
        impact: [{ label: "+Dân thương", color: "#74c0fc" }, { label: "Nguy cơ bị kiểm tra", color: "#ff6b6b" }],
        apply(s) { s.village.unrest = Math.max(0, s.village.unrest - 5); s.player.uyTinCong += 20; logLine(s, "Thu khoảng 70% rồi nộp. Dân biết ơn. Phủ trên chưa biết."); }},
      { label: "Dùng Mưu Mẹo lách qua',",
        impact: [{ label: "Thử Mưu Mẹo", color: "#ffd43b" }],
        apply(s) {
          if (s.player.muuMeo + rng() * 20 >= 25) { s.village.unrest = Math.max(0, s.village.unrest - 10); s.player.tien += 100; logLine(s, "Giả số liệu thật khéo, thu ít mà báo cáo đủ. Tạm thời an toàn."); }
          else { s.player.uyTinCong -= 40; logLine(s, "Bị Hiến Sát Sứ kiểm tra bắt tại trận!"); }
        }},
    ]
  };
}

function evDanKhieu(state) {
  return {
    id: "dan_khieu",
    title: "Dân Đến Kiện Điều Oan",
    narrative: "Mười mấy người dân quỳ ngoài sân quan, kêu khóc: 'Bọn cường hào địa phương cướp đất họ từ ba mùa trước!'",
    choices: [
      { label: "Tiếp nhận xét xử theo luật",
        impact: [{ label: "+30 Uy tín", color: "#74c0fc" }, { label: "Cơ hội đụng cường hào", color: "#ffd43b" }],
        apply(s) {
          s.player.uyTinCong += 30;
          if (rng() < 0.6) { logLine(s, "Xét xử sáng suốt, trả đất cho dân. Nổi tiếng quan thanh liêm."); }
          else { s.player.theLuc -= 30; logLine(s, "Đụng chạm cường hào có thế lực. Bị trả thù vặt, đồ vật trong nhà bị phá."); }
        }},
      { label: "Lờ đi vì ngán va chạm cường hào",
        impact: [{ label: "-25 Uy tín", color: "#ff6b6b" }, { label: "+Bất ổn", color: "#ff6b6b" }],
        apply(s) { s.player.uyTinCong -= 25; s.village.unrest += 10; logLine(s, "Xua dân về đi. Tiếng quan hèn nhát lan rộng."); }},
      { label: "Nhận hối lộ từ cường hào",
        impact: [{ label: "+150 Quan", color: "#51cf66" }, { label: "-50 Uy tín", color: "#ff6b6b" }],
        apply(s) { s.player.tien += 150; s.player.uyTinCong -= 50; s.village.unrest += 15; logLine(s, "Đút túi tiền cường hào, đuổi dân về. Tức ứa lòng mà thôi."); }},
    ]
  };
}

function evKhanCapThue(state) {
  return {
    id: "khanCap_thue",
    title: "Lệnh Khẩn Thu Tô",
    narrative: "Chiến tranh căng thẳng, triều đình phát lệnh thu gấp 3 lần thuế trong 1 tháng. Ai không đủ bị trừng phạt.",
    choices: [
      { label: "Thu gắt theo lệnh",
        impact: [{ label: "+Uy tín triều đình", color: "#74c0fc" }, { label: "+Bất ổn cực cao", color: "#ff6b6b" }],
        apply(s) { s.village.unrest = Math.min(100, s.village.unrest + 35); s.village.quyLang += 300; s.player.uyTinCong += 15; logLine(s, "Thu đủ nộp đủ. Dân khóc ròng mà quan lại khen ngợi."); }},
      { label: "Chỉ thu vừa đủ bảo vệ dân",
        impact: [{ label: "-20 Uy tín triều đình", color: "#ff6b6b" }, { label: "Dân thương", color: "#74c0fc" }],
        apply(s) { s.player.uyTinCong -= 20; s.player.danhVong += 30; logLine(s, "Thu vừa đủ, che chở dân một phần. Được dân gọi là 'quan thanh liêm'."); }},
    ]
  };
}

// ============================================================
// NHÓM 5: NGHĨA QUÂN & PHẢN LOẠN
// ============================================================

function evNghiaQuanKeu(state) {
  if (state.player.rank !== PlayerRank.THU_LINH) return null;
  return {
    id: "nghia_quan_keu",
    title: "Giặc Yếu Cần Thủ Lĩnh",
    narrative: "Ba toán nghĩa quân nhỏ từ làng bên kéo đến: 'Chúng tôi không người dẫn đầu. Thủ lĩnh có thể thu nạp chúng tôi không?'",
    choices: [
      { label: "Thu nạp cả ba toán",
        impact: [{ label: "+200 Quân", color: "#51cf66" }, { label: "+Chi phí lương cao hơn", color: "#ff6b6b" }],
        apply(s) { s.player.quanSo += 200; s.player.thocCaNhan -= 30; logLine(s, "Hàng ngũ nghĩa quân lớn thêm 200 người. Quân thế hùng mạnh hơn!"); }},
      { label: "Chỉ thu một toán giỏi nhất",
        impact: [{ label: "+100 Quân tinh nhuệ", color: "#51cf66" }],
        apply(s) { s.player.quanSo += 100; logLine(s, "Kén chọn toán giỏi nhất. Ít quân nhưng chiến lực cao hơn."); }},
      { label: "Từ chối — quân đông người khó quản",
        impact: [{ label: "Giữ nguyên lực lượng", color: "#999" }],
        apply(s) { logLine(s, "Cảnh giác với quân không rõ nguồn gốc. Bỏ qua."); }},
    ]
  };
}

function evGiainhapGiặc(state) {
  if (state.player.rank !== PlayerRank.THU_LINH && state.player.quanSo < 50) return null;
  return {
    id: "gia_nhap_giac",
    title: "Đại Thủ Lĩnh Mời Liên Minh",
    narrative: "Sứ giả từ Quận He Nguyễn Hữu Cầu đến: 'Quận He mời ngài liên minh. Cùng đánh Thăng Long, chia thiên hạ.'",
    choices: [
      { label: "Chấp thuận liên minh với Quận He",
        impact: [{ label: "+1000 Quân (hỗ trợ)", color: "#51cf66" }, { label: "Kẻ thù của Trịnh Doanh", color: "#ff9800" }],
        apply(s) { s.player.quanSo += 1000; s.player.faction = Faction.NGHIA_QUAN; s.player.uyTinCong -= 100; s.player.danhVong += 200; logLine(s, "Liên minh với Quận He! Thế lực nghĩa quân liên kết rầm rộ Đàng Ngoài."); }},
      { label: "Từ chối — muốn giữ độc lập",
        impact: [{ label: "+Độc lập", color: "#74c0fc" }, { label: "Quận He không hài lòng", color: "#ff6b6b" }],
        apply(s) { logLine(s, "Khéo từ chối một mình một cõi. Nhưng Quận He không vừa lòng."); }},
      { label: "Giả vờ đồng ý rồi phản bội",
        impact: [{ label: "Thử Mưu Mẹo", color: "#ffd43b" }, { label: "+Tiền bán thông tin", color: "#51cf66" }],
        apply(s) {
          if (s.player.muuMeo + rng() * 20 >= 40) { s.player.tien += 500; s.player.uyTinCong += 50; logLine(s, "Bán kế hoạch của Quận He cho triều đình Trịnh Doanh. Thu về 500 quan!"); }
          else { s.player.quanSo = Math.floor(s.player.quanSo * 0.5); s.uiShakeProfile = true; logLine(s, "Bị phát hiện phản bội! Quận He tấn công ngay. Quân bị đánh tơi tả!"); }
        }},
    ]
  };
}

function evDanHo(state) {
  if (state.player.rank !== PlayerRank.THU_LINH) return null;
  return {
    id: "dan_ho",
    title: "Dân Chạy Đến Nhờ Che Chở",
    narrative: "Hàng trăm dân chạy loạn đến xin ẩn náu trong trại nghĩa quân: 'Quan quân đang đốt làng chúng tôi!'",
    choices: [
      { label: "Mở cửa trại đón dân vào",
        impact: [{ label: "+50 Uy tín", color: "#74c0fc" }, { label: "+Thêm quân tình nguyện", color: "#51cf66" }, { label: "-Thóc nuôi người", color: "#ff6b6b" }],
        apply(s) { s.player.quanSo += 50; s.player.thocCaNhan -= 50; s.player.uyTinCong += 50; s.player.danhVong += 40; logLine(s, "Mở trại chứa nạn dân. Nhiều trai tráng tình nguyện gia nhập nghĩa quân!"); }},
      { label: "Đuổi đi vì sợ quan quân tìm đến",
        impact: [{ label: "-30 Uy tín", color: "#ff6b6b" }, { label: "An toàn tạm thời", color: "#51cf66" }],
        apply(s) { s.player.uyTinCong -= 30; logLine(s, "Xua dân đi nơi khác. Sống sót nhưng bị chê là lạnh lùng."); }},
    ]
  };
}

function hasLocalBattle(state) {
  if (!state._battleChaos) return false;
  // Giả lập check chiến sự: chiến sự làm _battleChaos lớn hơn 0
  return Object.values(state._battleChaos).some(v => v > 0);
}

function evBiBatLinh(state) {
  if (!hasLocalBattle(state)) return null;
  if (state.player.rank !== PlayerRank.DAN_THUONG && state.player.rank !== PlayerRank.PHU_HO) return null;
  return {
    id: "bi_bat_linh",
    inboxDays: 2,
    title: "Tróc Nã Sung Quân",
    narrative: "Quân triều đình đang càn quét giặc cỏ. Lính nha môn ập vào nhà bắt đinh tráng đi lính hầu hạ trận tiền!",
    choices: [
      { label: "Đút lót 100 quan để thoát",
        impact: [{ label: "-100 Quan", color: "#ff6b6b" }, { label: "Bình yên", color: "#51cf66" }],
        apply(s) {
          if (s.player.tien >= 100) { s.player.tien -= 100; logLine(s, "Đút 100 quan cho cai đội nha môn. Bọn chúng lờ đi không bắt."); }
          else { 
            s.player.quanSo += 5; s.player.rank = PlayerRank.DOI_TRUONG; s.player.faction = "trieu_dinh";
            logLine(s, "Không đủ tiền! Bị đánh một trận rồi cưỡng ép sung quân triều đình!"); 
          }
        }},
      { label: "Ngoan ngoãn tòng quân",
        impact: [{ label: "Chuyển ngạch lính", color: "#74c0fc" }],
        apply(s) {
          s.player.rank = PlayerRank.DOI_TRUONG; s.player.faction = "trieu_dinh"; s.player.quanSo += 10;
          logLine(s, "Bị sung vào vệ quân triều đình. Từ nay sống chết nơi sa trường.");
        }},
      { label: "Bỏ trốn vào rừng",
        impact: [{ label: "Thử Thể lực & Mưu Mẹo", color: "#ffd43b" }],
        apply(s) {
          if (s.player.theLuc + s.player.muuMeo >= 80) { logLine(s, "Lủi nhanh vào rừng. Thoát vòng vây."); }
          else { s.player.theLuc -= 50; s.player.tien = 0; logLine(s, "Bị tóm lại, ăn đòn nhừ tử rồi bị tịch thu toàn bộ tài sản!"); }
        }}
    ]
  };
}

function evRebelKhuyenHang(state) {
  if (!hasLocalBattle(state)) return null;
  if (state.player.rank === PlayerRank.THU_LINH || state.player.faction === "nghia_quan") return null;
  return {
    id: "rebel_khuyen_hang",
    inboxDays: 2,
    title: "Nghĩa Quân Vây Làng",
    narrative: "Một toán nghĩa quân cầm đao súng xông vào làng. Đầu lĩnh nói: 'Ai theo nghĩa quân thì ăn no, ai chống cự thì mất mạng!'",
    choices: [
      { label: "Vác cuốc tòng quân khởi nghĩa",
        impact: [{ label: "Trở thành phản loạn", color: "#ff9800" }, { label: "+Quân", color: "#51cf66" }],
        apply(s) { 
          s.player.rank = PlayerRank.THU_LINH; s.player.faction = "nghia_quan"; s.player.quanSo += 20; 
          logLine(s, "Gia nhập nghĩa quân. Sống kiếp lục lâm thảo khấu từ đây."); 
        }},
      { label: "Nộp 50 Thóc để mua bình yên",
        impact: [{ label: "-50 Thóc", color: "#ff6b6b" }],
        apply(s) {
          if (s.player.thocCaNhan >= 50) { s.player.thocCaNhan -= 50; logLine(s, "Nộp thóc cứu mạng. Nghĩa quân kéo đi."); }
          else { s.player.tien = 0; s.village.unrest += 20; logLine(s, "Không đủ thóc, bị lục soát lấy sạch tiền, làng xóm điêu tàn."); }
        }},
      { label: "Tập hợp trai tráng đánh đuổi",
        impact: [{ label: "Thử Võ Thuật", color: "#ffd43b" }, { label: "+Uy tín lớn", color: "#51cf66" }],
        apply(s) {
          if (s.player.voThuat + rng() * 20 >= 40) { 
            s.player.uyTinCong += 50; s.player.tien += 100;
            logLine(s, "Đánh bật quân giặc cỏ! Cả làng tung hô, thu được chiến lợi phẩm."); 
          }
          else { s.player.theLuc -= 60; s.player.tien = 0; logLine(s, "Chống trả thất bại! Bị chém trọng thương, cướp sạch."); }
        }}
    ]
  };
}

function evThaBinhKhoi(state) {
  if (state.player.rank !== PlayerRank.THU_LINH || state.player.quanSo < 200) return null;
  return {
    id: "tha_binh_khoi",
    title: "Triều Đình Đề Nghị Chiêu Hàng",
    narrative: "Sứ quan mang thư: 'Nếu ngài đầu hàng, Chúa Trịnh ban ân xá toàn bộ và trao chức Bách Hộ!'",
    choices: [
      { label: "Đầu hàng nhận ân xá",
        impact: [{ label: "+Chức Bách Hộ", color: "#ffd43b" }, { label: "Rời bỏ nghĩa quân", color: "#ff9800" }],
        apply(s) { s.player.rank = PlayerRank.BACH_HO; s.player.quanSo = 100; s.player.faction = Faction.TRIEU_DINH; s.player.uyTinCong += 20; logLine(s, "Giao gươm nhận chiếu chỉ. Bước ra khỏi bóng tối phản loạn."); }},
      { label: "Từ chối — đã quyết tâm lật Trịnh",
        impact: [{ label: "+Danh Vọng nghĩa quân", color: "#ffd43b" }, { label: "Trở thành kẻ thù không đội trời chung", color: "#ff6b6b" }],
        apply(s) { s.player.danhVong += 100; s.player.uyTinCong -= 50; logLine(s, "Bác bỏ chiêu hàng trước mặt sứ quan! Toàn trại nghĩa quân hoan hô vang trời."); }},
    ]
  };
}

// ============================================================
// NHÓM 6: SỰ KIỆN PHỤ ĐA DẠNG
// ============================================================

function evMemTiu(state) {
  return {
    id: "mem_tiu",
    title: "Rượu Vào Miệng Thần Ra",
    narrative: "Sau bữa tiệc, mình không kiểm soát nổi bản thân. Sáng ra môi đắng, đầu như búa bổ.",
    choices: [
      { label: "Đó là đêm kết thân quan trọng",
        impact: [{ label: "+20 Ngoại Giao", color: "#51cf66" }, { label: "-20 Thể lực", color: "#ff6b6b" }],
        apply(s) { s.player.ngoaiGiao = Math.min(100, s.player.ngoaiGiao + 3); s.player.theLuc -= 20; logLine(s, "Uống quá nhưng kết được nhiều mối quan hệ giá trị."); }},
      { label: "Tỉnh dậy thấy mất ví tiền",
        impact: [{ label: "-30 Quan", color: "#ff6b6b" }],
        apply(s) { let lost = Math.min(s.player.tien, randInt(20, 50)); s.player.tien -= lost; s.player.theLuc -= 30; logLine(s, `Bừng tỉnh thấy ví vơi đi ${lost} quan. Không biết nửa đêm mình làm gì.`); }},
    ]
  };
}

function evLieu_Linh(state) {
  return {
    id: "lieu_linh",
    title: "Cơ Hội Mạo Hiểm",
    narrative: "Một thương nhân mời cùng đầu tư chuyến hàng lậu. 'Lãi gấp đôi trong 2 tháng! Chỉ cần 100 quan vốn.'",
    choices: [
      { label: "Bỏ 100 quan đầu tư",
        impact: [{ label: "-100 Quan", color: "#ff6b6b" }, { label: "60%: +200 Quan | 40%: Mất hết", color: "#ffd43b" }],
        apply(s) {
          if (s.player.tien >= 100) {
            s.player.tien -= 100;
            if (rng() < 0.6 + s.player.quanLy * 0.003) { s.player.tien += 200; logLine(s, "Chuyến hàng thành công! Thu về 200 quan lời lãi béo bở."); }
            else { s.uiShakeProfile = true; logLine(s, "Chuyến hàng bị quan kiểm tra tịch thu! Mất vốn!"); }
          } else logLine(s, "Không đủ vốn."); }},
      { label: "Từ chối — giang hồ không tin được",
        impact: [],
        apply(s) { logLine(s, "Bước qua cơ hội. An phận hơn."); }},
    ]
  };
}

function evCon_No(state) {
  if (state.player.noVayConLai <= 0) return null;
  return {
    id: "con_no",
    title: "Chủ Nợ Đến Đòi",
    narrative: "Sáng sớm, ba tên côn đồ xộc vào sân nhà: 'Hạn đã qua rồi! Nộp ngay tiền nợ không thì chúng tao đập nhà!'",
    choices: [
      { label: "Trả hết nợ ngay",
        impact: [{ label: `-${state.player.noVayConLai} Quan`, color: "#ff6b6b" }, { label: "+Thoát nợ", color: "#51cf66" }],
        apply(s) {
          if (s.player.tien >= s.player.noVayConLai) { s.player.tien -= s.player.noVayConLai; s.player.noVayConLai = 0; logLine(s, "Trả sạch nợ. Thở phào nhẹ nhõm."); }
          else { s.player.theLuc -= 60; s.uiShakeProfile = true; logLine(s, "Không đủ tiền, cả nhà bị đánh trận!"); }
        }},
      { label: "Đàm phán hoãn thêm 1 tháng",
        impact: [{ label: "+5 lãi nữa", color: "#ff6b6b" }, { label: "Tạm thời an toàn", color: "#74c0fc" }],
        apply(s) { s.player.noVayConLai += 5; logLine(s, "Xin hoãn được 1 tháng nữa. Nợ lại phình thêm."); }},
      { label: "Dùng quan hệ hoặc vũ lực đuổi chúng đi",
        impact: [{ label: "Thử Võ Thuật hoặc Quyền Lực", color: "#ffd43b" }],
        apply(s) {
          if (s.player.voThuat >= 30 || s.player.quyenLuc >= 30) { logLine(s, "Một mình đủ sức đuổi cả bọn. Chúng không dám quay lại sớm."); }
          else { s.player.theLuc -= 50; s.uiShakeProfile = true; logLine(s, "Đánh không lại, bị phản đòn tơi bời!"); }
        }},
    ]
  };
}

function evBaoLuc(state) {
  return {
    id: "bao_luc",
    title: "Xô Xát Giữa Chợ",
    narrative: "Một tên to lớn đang đánh người đàn ông gầy yếu giữa chợ. 'Thằng này mượn nợ tao không trả!'",
    choices: [
      { label: "Can ngăn vào giữa",
        impact: [{ label: "Thử Võ Thuật", color: "#ffd43b" }, { label: "+Uy tín nếu thành công", color: "#74c0fc" }],
        apply(s) {
          if (s.player.voThuat + rng() * 20 >= 25) { s.player.uyTinCong += 20; s.player.voThuat = Math.min(100, s.player.voThuat + 1); logLine(s, "Can thiệp thành công! Người bị hại ngưỡng mộ, tiếng nghĩa hiệp lan rộng."); }
          else { s.player.theLuc -= 40; s.uiShakeProfile = true; logLine(s, "Can ngăn mà tay yếu đòn kém, bị ăn đòn thay người ta."); }
        }},
      { label: "Báo quan gần nhất",
        impact: [{ label: "+5 Uy tín", color: "#74c0fc" }, { label: "Chậm trễ nhưng an toàn", color: "#999" }],
        apply(s) { s.player.uyTinCong += 5; logLine(s, "Báo quan đến dẹp loạn. Từ từ nhưng đúng quy trình."); }},
      { label: "Không can dự đứng nhìn",
        impact: [{ label: "An toàn bản thân", color: "#999" }, { label: "-5 Uy tín", color: "#ff6b6b" }],
        apply(s) { s.player.uyTinCong -= 5; logLine(s, "Quay mặt đi. Xã hội đời thường vốn thế."); }},
    ]
  };
}

function evKhoanNguyen(state) {
  return {
    id: "khoan_nguyen",
    title: "Khai Hoang Khải Nguồn",
    narrative: "Tìm thấy mảnh đất bỏ hoang size lớn ven suối. Nếu khai phá được là ruộng ngon, nhưng tốn công sức và tiền bạc.",
    choices: [
      { label: "Bỏ công khai phá (80 quan + 30 ngày)",
        impact: [{ label: "-80 Quan", color: "#ff6b6b" }, { label: "+Điền trang mới", color: "#51cf66" }, { label: "+Thóc tháng hàng tháng", color: "#74c0fc" }],
        apply(s) {
          if (s.player.tien >= 80) { s.player.tien -= 80; s.player.theLuc -= 40; s.player.thocCaNhan += 60; s.player.uyTinCong += 10; logLine(s, "Đất khai phá xong! Từ nay có thêm nguồn thóc ổn định."); }
          else logLine(s, "Không đủ tiền khai phá."); }},
      { label: "Đăng ký với huyện và bán lại",
        impact: [{ label: "+60 Quan một lần", color: "#51cf66" }],
        apply(s) { s.player.tien += 60; logLine(s, "Đăng ký chứng nhận đất rồi bán lại cho hào phú."); }},
    ]
  };
}

function evXomLang(state) {
  return {
    id: "xom_lang",
    title: "Mâu Thuẫn Xóm Giềng",
    narrative: "Nhà kế bên đổ phân tưới vào ruộng làm mùi thối bay sang. Họ nói 'đất họ họ muốn làm gì thì làm!'",
    choices: [
      { label: "Đi hòa giải nói chuyện thân thiện",
        impact: [{ label: "Thử Ngoại Giao", color: "#ffd43b" }],
        apply(s) {
          if (s.player.ngoaiGiao + rng() * 20 >= 15) { s.player.uyTinCong += 10; logLine(s, "Hàng xóm thông cảm và thay đổi cách tưới. Mọi chuyện êm xuôi."); }
          else { s.village.unrest += 3; logLine(s, "Nói không khéo, hai nhà cạch mặt nhau."); }
        }},
      { label: "Đưa ra tòa làng xét xử",
        impact: [{ label: "+Phán quyết công bằng", color: "#74c0fc" }],
        apply(s) { s.player.uyTinCong += 5; logLine(s, "Hội đồng làng xét xử. Hàng xóm buộc phải bồi thường."); }},
      { label: "Đánh lén ruộng họ",
        impact: [{ label: "Thỏa mái", color: "#51cf66" }, { label: "-15 Uy tín nếu bị biết", color: "#ff6b6b" }],
        apply(s) {
          if (rng() < 0.5) logLine(s, "Đêm đó lén chuyển phân sang ruộng họ. Họ không biết nhưng nghi ngờ.");
          else { s.player.uyTinCong -= 15; logLine(s, "Bị bắt quả tang! Cả xóm cười chê."); }
        }},
    ]
  };
}

function evDuaBeo(state) {
  if (state.player.tien < 20) return null;
  return {
    id: "dua_beo",
    title: "Cuộc Đặt Cược Tay Đôi",
    narrative: "Hai tay anh chị địa phương mời cùng ngồi xúc xắc. Có thể thắng to hoặc thua sạch.",
    choices: [
      { label: "Cược 50 quan",
        impact: [{ label: "50%: +100 Quan | 50%: -50 Quan", color: "#ffd43b" }],
        apply(s) {
          if (s.player.tien >= 50) {
            s.player.tien -= 50;
            if (rng() < 0.4 + s.player.muuMeo * 0.005) { s.player.tien += 100; logLine(s, "Xúc xắc nghiêng về phía mình! Thu 100 quan!"); }
            else { logLine(s, "Lần này vận về phía họ. Mất 50 quan."); }
          } else logLine(s, "Không đủ vốn cược."); }},
      { label: "Theo dõi nhưng không cược",
        impact: [],
        apply(s) { logLine(s, "Xem người khác chơi rồi bỏ đi. An toàn."); }},
      { label: "Tố giác đây là tụ điểm cờ bạc",
        impact: [{ label: "+10 Uy tín", color: "#74c0fc" }, { label: "Bị ghét bởi dân cờ bạc", color: "#ff6b6b" }],
        apply(s) { s.player.uyTinCong += 10; logLine(s, "Báo quan. Được khen. Nhưng một số người địa phương bắt đầu ghét mặt."); }},
    ]
  };
}

function evKhachTro(state) {
  return {
    id: "khach_tro",
    title: "Khách Lạ Ghé Nghỉ",
    narrative: "Một người khách xin ngủ nhờ qua đêm, trông vội vã và có vẻ cất giấu gì đó trong người.",
    choices: [
      { label: "Cho nghỉ và trò chuyện",
        impact: [{ label: "Cơ hội gặp nhân vật quan trọng", color: "#74c0fc" }],
        apply(s) {
          if (rng() < 0.4) { let bonus = randInt(50, 150); s.player.tien += bonus; logLine(s, `Hóa ra là thương nhân giàu có. Đổi lại, ông ta tặng ${bonus} quan vì lòng hiếu khách!`); }
          else { s.player.ngoaiGiao = Math.min(100, s.player.ngoaiGiao + 2); logLine(s, "Qua đêm ăn nói ý vị. Học được vài điều về đời."); }
        }},
      { label: "Lần mó đồ của khách lúc ngủ",
        impact: [{ label: "Thử Mưu Mẹo", color: "#ffd43b" }],
        apply(s) {
          if (s.player.muuMeo + rng() * 20 >= 25) { let loot = randInt(30, 100); s.player.tien += loot; logLine(s, `Tay mò vào túi áo lấy được ${loot} quan. Sáng ra khách không hay biết...`); }
          else { s.player.uyTinCong -= 40; s.player.theLuc -= 30; logLine(s, "Bị thức dậy bắt quả tang! Khách đánh tơi bời."); }
        }},
      { label: "Tống cổ ra đi, không cần khách lạ",
        impact: [{ label: "An toàn", color: "#999" }],
        apply(s) { logLine(s, "Đuổi về đường mình đi. Không biết đó là ai."); }},
    ]
  };
}

function evNghiNgo(state) {
  return {
    id: "nghi_ngo",
    title: "Bị Nghi Ngờ Làm Gian",
    narrative: "Quan huyện gọi lên hỏi về một vụ trộm trong vùng. Có người tố giác tên bạn.  ",
    choices: [
      { label: "Khai thật và hợp tác",
        impact: [{ label: "+10 Uy tín (trung thực)", color: "#74c0fc" }],
        apply(s) { s.player.uyTinCong += 10; logLine(s, "Khai ngay khai thật. Quan huyện điều tra thấy không liên quan."); }},
      { label: "Đổ tội cho người khác",
        impact: [{ label: "Thử Mưu Mẹo", color: "#ffd43b" }, { label: "+Thoát nghi ngờ", color: "#51cf66" }, { label: "+Tội ác nếu trúng người vô tội", color: "#ff6b6b" }],
        apply(s) {
          if (s.player.muuMeo + rng() * 20 >= 25) { logLine(s, "Khéo léo lạc hướng điều tra sang người khác. Thoát!"); }
          else { s.player.uyTinCong -= 30; logLine(s, "Bịa không qua được! Quan huyện kết tội nặng hơn."); }
        }},
      { label: "Dùng tiền lo lót quan huyện",
        impact: [{ label: "-60 Quan", color: "#ff6b6b" }, { label: "+Thoát tội", color: "#51cf66" }],
        apply(s) {
          if (s.player.tien >= 60) { s.player.tien -= 60; logLine(s, "Đút lót êm ái. Quan huyện bỗng dưng 'quên' ai tố giác."); }
          else logLine(s, "Không có tiền lo lót — bị giữ lại điều tra thêm!"); }},
    ]
  };
}

function evMauThuan(state) {
  return {
    id: "mau_thuan",
    title: "Xung Đột Với Họ Hàng",
    narrative: "Người anh họ đến đòi phần di sản từ đất ruộng của cha để lại. 'Phần ấy của ta từ hồi trước!'",
    choices: [
      { label: "Nhường một phần cho yên ổn",
        impact: [{ label: "-30 Thóc/năm", color: "#ff6b6b" }, { label: "+Hòa khí gia tộc", color: "#74c0fc" }],
        apply(s) { s.village.khoThoc -= 30; s.player.uyTinCong += 10; logLine(s, "Nhường đất. Hòa thuận trở lại. Lợi nhỏ mà tình thân vô giá."); }},
      { label: "Phân tranh ra tòa làng xét xử",
        impact: [{ label: "Phán quyết theo luật", color: "#74c0fc" }, { label: "Họ hàng oán giận", color: "#ff6b6b" }],
        apply(s) { if (rng() < 0.5 + s.player.hocVan * 0.005) { s.player.uyTinCong += 5; logLine(s, "Tòa làng xử thắng. Đất giữ được nhưng họ hàng cạch mặt."); } else { s.village.khoThoc -= 50; logLine(s, "Tòa xử thua. Mất đất thêm mà còn mất mặt."); } }},
      { label: "Đuổi thẳng cổ ra khỏi làng",
        impact: [{ label: "-30 Uy tín", color: "#ff6b6b" }, { label: "+Giữ toàn bộ đất", color: "#51cf66" }],
        apply(s) { s.player.uyTinCong -= 30; logLine(s, "Đuổi phăng đi. Giữ đất. Nhưng bị chê thiếu tình người."); }},
    ]
  };
}

function evBanDat(state) {
  return {
    id: "ban_dat",
    title: "Thương Nhân Muốn Mua Đất",
    narrative: "Một thương nhân giàu có muốn mua lại mảnh đất vườn của bạn với giá 200 quan — giá gấp đôi thị trường!",
    choices: [
      { label: "Bán ngay giá tốt",
        impact: [{ label: "+200 Quan", color: "#51cf66" }, { label: "-Điền sản", color: "#ff6b6b" }],
        apply(s) { s.player.tien += 200; logLine(s, "Bán được giá tốt! Tiền bỏ túi."); }},
      { label: "Từ chối — đất cha ông để lại",
        impact: [{ label: "+10 Uy tín", color: "#74c0fc" }],
        apply(s) { s.player.uyTinCong += 10; logLine(s, "Giữ lại đất cha ông. Người mua khuất bóng ra đi."); }},
      { label: "Mặc cả thêm (300 quan)",
        impact: [{ label: "Thử Ngoại Giao", color: "#ffd43b" }],
        apply(s) {
          if (s.player.ngoaiGiao + rng() * 20 >= 20) { s.player.tien += 300; logLine(s, "Mặc cả thắng! Bán được 300 quan."); }
          else { s.player.tien += 200; logLine(s, "Mặc cả không được, đành bán 200 quan."); }
        }},
    ]
  };
}

function evTranh_ChapHo(state) {
  if (!state.player.giaDinh?.vo) return null;
  return {
    id: "tranh_chap_ho",
    title: "Hai Họ Xung Đột",
    narrative: "Họ Nguyễn và Họ Trần trong làng sắp đánh nhau vì tranh giành vị trí chăn trâu bên bờ sông.",
    choices: [
      { label: "Đứng ra hòa giải",
        impact: [{ label: "+25 Uy tín", color: "#74c0fc" }],
        apply(s) {
          if (s.player.ngoaiGiao + rng() * 20 >= 20) { s.player.uyTinCong += 25; s.village.unrest = Math.max(0, s.village.unrest - 10); logLine(s, "Hòa giải thành công. Cả làng gọi là 'người có uy'."); }
          else { s.village.unrest += 10; logLine(s, "Can ngăn không thành, hai họ đánh nhau loạn xạ."); }
        }},
      { label: "Bênh một bên để ơn nghĩa",
        impact: [{ label: "+1 đồng minh họ", color: "#74c0fc" }, { label: "-1 họ thù", color: "#ff6b6b" }],
        apply(s) { s.player.quyenLuc += 10; logLine(s, "Bênh Họ Nguyễn. Từ nay họ này trở thành đồng minh, Họ Trần thù cay cú."); }},
    ]
  };
}

function evGiauCo(state) {
  return {
    id: "giau_co",
    title: "Sứ Giả Từ Kinh Thành",
    narrative: "Một quan lớn từ Thăng Long đến thăm, nói bạn có tiếng là người thành đạt và muốn mượn 500 quan 'tạm thời'.",
    choices: [
      { label: "Cho vay với điều kiện rõ ràng",
        impact: [{ label: "-500 Quan tạm", color: "#ff6b6b" }, { label: "+Kết nối Phủ Chúa", color: "#74c0fc" }],
        apply(s) {
          if (s.player.tien >= 500) { s.player.tien -= 500; s.player.quyenLuc += 30; logLine(s, "Cho vay, nhận lại cam kết. Từ nay có tai mắt trong kinh thành."); }
          else logLine(s, "Không đủ tiền cho vay."); }},
      { label: "Tặng hẳn 100 quan để lấy lòng",
        impact: [{ label: "-100 Quan", color: "#ff6b6b" }, { label: "+Quan hệ triều đình", color: "#74c0fc" }],
        apply(s) {
          if (s.player.tien >= 100) { s.player.tien -= 100; s.player.uyTinCong += 30; s.player.quyenLuc += 20; logLine(s, "Tặng không 100 quan. Quan lớn mắt sáng lên hứa hẹn đền đáp."); }
          else logLine(s, "Không đủ tiền."); }},
      { label: "Từ chối lịch sự",
        impact: [],
        apply(s) { logLine(s, "Lịch sự từ chối. Quan lớn gật đầu ra đi."); }},
    ]
  };
}

function evBiCuop(state) {
  if (state.player.tien < 100) return null;
  return {
    id: "bi_cuop",
    title: "Nhà Bị Đột Nhập",
    narrative: "Tỉnh dậy thấy cửa bị phá, chiếc rương tiền bị lật. Một phần tiền đã biến mất!",
    choices: [
      { label: "Truy tìm kẻ trộm",
        impact: [{ label: "Thử Mưu Mẹo", color: "#ffd43b" }],
        apply(s) {
          if (s.player.muuMeo + rng() * 20 >= 25) { let back = randInt(30, 80); s.player.tien += back; logLine(s, `Lần theo dấu vết, tìm ra kẻ trộm bắt hoàn trả ${back} quan.`); }
          else { let lost = randInt(30, 100); s.player.tien = Math.max(0, s.player.tien - lost); logLine(s, `Điều tra không ra, đành gánh mất ${lost} quan.`); }
        }},
      { label: "Báo quan huyện",
        impact: [{ label: "+5 Uy tín", color: "#74c0fc" }, { label: "Quan điều tra", color: "#999" }],
        apply(s) { s.player.uyTinCong += 5; logLine(s, "Quan huyện điều tra nhưng chưa bắt được tên nào."); }},
      { label: "Tăng cường bảo vệ nhà (xây thêm)",
        impact: [{ label: "Tốn 40 Quan", color: "#ff6b6b" }, { label: "+An toàn tài sản", color: "#51cf66" }],
        apply(s) {
          if (s.player.tien >= 40) { s.player.tien -= 40; logLine(s, "Bỏ tiền củng cố cửa rào. Về sau an toàn hơn."); }
          else logLine(s, "Không đủ tiền gia cố."); }},
    ]
  };
}

function evTuonDich(state) {
  if (state.player.quanSo < 50) return null;
  return {
    id: "tuong_dich",
    title: "Tướng Địch Muốn Đầu Hàng",
    narrative: "Một tướng đối địch cử người tới bí mật: 'Tôi muốn đầu hàng và gia nhập cánh của ngài, nếu ngài đảm bảo tính mạng.'",
    choices: [
      { label: "Chấp nhận, thu nạp và quân lực",
        impact: [{ label: "+Quân và tướng", color: "#51cf66" }, { label: "Rủi ro nếu là gián điệp", color: "#ff6b6b" }],
        apply(s) {
          s.player.quanSo += 150;
          if (rng() < 0.8) { logLine(s, "Tướng đầu hàng thật. Thu thêm 150 quân tinh nhuệ!"); }
          else { s.player.quanSo -= 200; s.uiShakeProfile = true; logLine(s, "Là gián điệp! Nội tuyến phá nát kho lương trong đêm khuya!"); }
        }},
      { label: "Từ chối gặp, chém đầu sứ giả",
        impact: [{ label: "+Sĩ khí quân ta", color: "#51cf66" }, { label: "Địch tức giận quyết chiến", color: "#ff6b6b" }],
        apply(s) { logLine(s, "Chém đầu sứ giả trước mặt toàn quân. Sĩ khí lên cao, địch tức tối nhưng nể sợ."); }},
    ]
  };
}

function evThamTran(state) {
  if (state.player.quanSo < 30) return null;
  return {
    id: "tham_tran",
    title: "Thám Thính Trở Về",
    narrative: "Toán thám thính báo về: 'Địch cách 1 ngày đường, quân số gấp đôi ta, nhưng hậu cần yếu!'",
    choices: [
      { label: "Tập kích ngay ban đêm",
        impact: [{ label: "Thử Võ Thuật", color: "#ffd43b" }, { label: "+Quân nếu thắng", color: "#51cf66" }],
        apply(s) {
          if (s.player.voThuat + rng() * 20 >= 35) { s.player.tien += 200; s.player.danhVong += 80; logLine(s, "Tập kích đêm khiến địch choáng váng tan vỡ. Chiến thắng vang dội!"); }
          else { s.player.quanSo = Math.floor(s.player.quanSo * 0.6); s.uiShakeProfile = true; logLine(s, "Tập kích thất bại! Lọt bẫy phản công, mất 40% quân."); }
        }},
      { label: "Chờ và tìm viện binh",
        impact: [{ label: "+Cơ hội liên minh", color: "#74c0fc" }],
        apply(s) { s.player.uyTinCong += 10; logLine(s, "Tạm chờ và gửi thư tìm đồng minh. Thế trận chưa quyết."); }},
      { label: "Lui về phòng thủ",
        impact: [{ label: "-Lãnh thổ", color: "#ff6b6b" }, { label: "+Bảo toàn lực lượng", color: "#51cf66" }],
        apply(s) { logLine(s, "Rút lui bảo tồn lực lượng. Giữ mạng để chiến ngày khác."); }},
    ]
  };
}

// ============================================================
// NHÓM 7: GIẢI TRÍ (Uống rượu, Lầu xanh, Xem kịch, Đánh bài)
// ============================================================

function evUongRuou(state) {
  return {
    id: "uong_ruou",
    title: "Tửu Quán Bên Đường",
    narrative: "Mùi rượu thơm nồng xộc vào mũi. Chủ quán gật đầu mời: 'Hôm nay có rượu nếp quê ủ ba năm, bảo đảm ngon!'",
    choices: [
      { label: "Uống vài chén cho vui (10 quan)",
        impact: [{ label: "-10 Quan", color: "#ff6b6b" }, { label: "+Giao tiếp XP", color: "#51cf66" }, { label: "-5 TL hôm sau", color: "#ff6b6b" }],
        apply(s) {
          if (s.player.tien >= 10) {
            s.player.tien -= 10;
            s.player.theLuc = Math.max(10, s.player.theLuc - 5);
            s.player.ngoaiGiao = Math.min(100, s.player.ngoaiGiao + 2);
            const bonus = s.player._traitADao ? " Tính cách Ăn Đạo: cảm xúc thăng hoa, ngoại giao +3 thêm!" : "";
            if (s.player._traitADao) s.player.ngoaiGiao = Math.min(100, s.player.ngoaiGiao + 3);
            logLine(s, `Rượu ngon, chuyện vui. Quen thêm dăm người lạ ở quán.${bonus}`);
          } else logLine(s, "Không đủ tiền uống rượu.");
        }},
      { label: "Uống say xỉn cả đêm (30 quan)",
        impact: [{ label: "-30 Quan", color: "#ff6b6b" }, { label: "+Ngoại Giao +5", color: "#51cf66" }, { label: "-20 TL", color: "#ff6b6b" }],
        apply(s) {
          if (s.player.tien >= 30) {
            s.player.tien -= 30;
            s.player.theLuc = Math.max(5, s.player.theLuc - 20);
            s.player.ngoaiGiao = Math.min(100, s.player.ngoaiGiao + 5);
            if (s.player._traitADao) { s.player.ngoaiGiao = Math.min(100, s.player.ngoaiGiao + 5); s.player.muuMeo = Math.min(100, s.player.muuMeo + 2); }
            logLine(s, "Say bí tỉ cùng đám thương nhân. Tình bạn nhậu đôi khi giá trị hơn vàng.");
          } else logLine(s, "Không đủ tiền cho một đêm say.");
        }},
      { label: "Mua một hũ mang về",
        impact: [{ label: "-15 Quan", color: "#ff6b6b" }, { label: "+1 Hũ Rượu", color: "#51cf66" }],
        apply(s) {
          if (s.player.tien >= 15) { s.player.tien -= 15; s.player.inventory = s.player.inventory||{}; s.player.inventory.ruou = (s.player.inventory.ruou||0) + 1; logLine(s, "Mua hũ rượu quý về nhà. Để dành tiếp khách."); }
          else logLine(s, "Hụt tiền.");
        }},
      { label: "Lờ đi đi thẳng",
        impact: [],
        apply(s) { logLine(s, "Không ghé. Tiết kiệm mới giàu."); }},
    ]
  };
}

function evLauXanh(state) {
  const isNam = (state.player.gender || "nam") === "nam";
  return {
    id: "lau_xanh",
    title: isNam ? "Tiếng Đàn Từ Lầu Hoa" : "Tửu Lầu Nam Kép",
    narrative: isNam
      ? "Tiếng đàn tranh réo rắt vang ra từ lầu hoa hai tầng. Một cô kỹ nữ xinh đẹp đứng trên lan can vẩy tay mời."
      : "Tửu lầu đèn đỏ le lói. Một tên nam kép áo lụa bước ra, cúi chào: 'Nàng có ghé vào thưởng trà không?'",
    choices: [
      { label: isNam ? "Ghé lầu hoa thư giãn (50 quan)" : "Ghé tửu lầu giải khuây (50 quan)",
        impact: [{ label: "-50 Quan", color: "#ff6b6b" }, { label: "+Thể lực +15", color: "#51cf66" }, { label: "Rủi ro bệnh", color: "#ffd43b" }],
        apply(s) {
          if (s.player.tien >= 50) {
            s.player.tien -= 50;
            s.player.theLuc = Math.min(s.player._birthCuongTrang ? 120 : 100, s.player.theLuc + 15);
            s.player.ngoaiGiao = Math.min(100, s.player.ngoaiGiao + 3);
            if (s.player._traitADao) s.player.ngoaiGiao = Math.min(100, s.player.ngoaiGiao + 4);
            if (rng() < 0.15) { s.player.dangOm = true; s.player.theLuc = 0; logLine(s, "Ôi thôi, mắc bệnh! Nằm liệt giường cả tuần."); }
            else logLine(s, isNam ? "Đêm thơ mộng trong lầu hoa. Người thư thái, chân bước nhẹ hơn." : "Đêm vui vẻ đến tận sáng. Gặp vài thương nhân lạ, nói chuyện thú vị.");
          } else logLine(s, "Không đủ tiền.");
        }},
      { label: "Nhìn ngắm rồi bỏ đi",
        impact: [],
        apply(s) { logLine(s, "Nhìn qua rồi đi. Không phải lúc."); }},
    ]
  };
}

function evXemKich(state) {
  const vo = ["Quan Âm Thị Kính", "Lưu Bình Dương Lễ", "Trương Viên", "Kim Nham"];
  const v  = vo[randInt(0, vo.length - 1)];
  return {
    id: "xem_kich",
    title: "Gánh Hát Làng Vào Xã",
    narrative: `Một gánh hát chèo nổi tiếng ghé vào làng, dựng rạp giữa sân đình. Tối nay diễn vở "${v}".`,
    choices: [
      { label: "Mua vé xem hát (20 quan)",
        impact: [{ label: "-20 Quan", color: "#ff6b6b" }, { label: "+Học Vấn +2", color: "#51cf66" }, { label: "+Uy tín văn hóa", color: "#74c0fc" }],
        apply(s) {
          if (s.player.tien >= 20) {
            s.player.tien -= 20;
            s.player.hocVan = Math.min(100, s.player.hocVan + 2);
            s.player.uyTinCong += 5;
            if (s.player._traitADao) { s.player.hocVan = Math.min(100, s.player.hocVan + 2); s.player.danhVong += 10; }
            logLine(s, `Xem vở "${v}" say mê. Câu chuyện trung hiếu tiết nghĩa khắc sâu vào lòng.`);
          } else logLine(s, "Không đủ tiền mua vé.");
        }},
      { label: "Tài trợ cho gánh hát (80 quan)",
        impact: [{ label: "-80 Quan", color: "#ff6b6b" }, { label: "+30 Danh Vọng", color: "#ffd43b" }, { label: "+20 Uy tín", color: "#74c0fc" }],
        apply(s) {
          if (s.player.tien >= 80) { s.player.tien -= 80; s.player.danhVong += 30; s.player.uyTinCong += 20; logLine(s, "Đại nhân tài trợ! Người xướng tên ra giữa rạp. Tiếng vang khắp vùng."); }
          else logLine(s, "Không đủ tiền bảo trợ.");
        }},
      { label: "Xem chui không mua vé",
        impact: [{ label: "Thử Mưu Mẹo", color: "#ffd43b" }],
        apply(s) {
          if (s.player.muuMeo + rng() * 20 >= 20) { s.player.hocVan = Math.min(100, s.player.hocVan + 1); logLine(s, "Lách qua đám đông, xem chui cũng được. Tiết kiệm mà!"); }
          else { s.player.uyTinCong -= 10; logLine(s, "Bị bắt xem chui! Bị đuổi ra ngoài, xấu hổ quá."); }
        }},
      { label: "Không xem",
        impact: [],
        apply(s) { logLine(s, "Không ghé xem. Còn nhiều việc."); }},
    ]
  };
}

function evDanhBai(state) {
  return {
    id: "danh_bai",
    title: "Chiếu Bạc Giữa Đêm",
    narrative: "Tiếng xóc đĩa lách cách vang ra từ căn phòng sau quán rượu. Dân đánh bài vẫy tay mời: 'Vào đây, hên xui mà thôi!'",
    choices: [
      { label: "Đánh bài nhỏ cược 30 quan",
        impact: [{ label: "60% +60 Quan", color: "#51cf66" }, { label: "40% -30 Quan", color: "#ff6b6b" }],
        apply(s) {
          const winChance = 0.4 + (s.player.muuMeo * 0.004) + (s.player._traitGianXao ? 0.1 : 0);
          if (s.player.tien >= 30) {
            if (rng() < winChance) { s.player.tien += 60; logLine(s, "Hên! Thắng 60 quan một ván. Vừa vui vừa lo."); }
            else { s.player.tien -= 30; logLine(s, "Xui! Thua 30 quan. Đứng dậy ra về lặng lẽ."); }
          } else logLine(s, "Không đủ vốn cược.");
        }},
      { label: "Cược lớn 100 quan",
        impact: [{ label: "40% +200 Quan", color: "#51cf66" }, { label: "60% -100 Quan", color: "#ff6b6b" }],
        apply(s) {
          const winChance = 0.3 + (s.player.muuMeo * 0.003) + (s.player._traitGianXao ? 0.1 : 0);
          if (s.player.tien >= 100) {
            if (rng() < winChance) { s.player.tien += 200; s.player.uyTinCong += 5; logLine(s, "Đại thắng! 200 quan! Cả chiếu vỗ tay."); }
            else { s.player.tien -= 100; s.uiShakeProfile = true; logLine(s, "Thua sạch 100 quan. Trời ơi đất hỡi."); }
          } else logLine(s, "Không đủ vốn.");
        }},
      { label: "Quan sát học mẹo cờ bạc",
        impact: [{ label: "+2 Mưu Mẹo", color: "#51cf66" }],
        apply(s) { s.player.muuMeo = Math.min(100, s.player.muuMeo + 2); logLine(s, "Ngồi xem học được vài mẹo đọc bài của dân cờ bạc lão luyện."); }},
      { label: "Bỏ đi không tham gia",
        impact: [],
        apply(s) { logLine(s, "Cờ bạc là bác thằng bần. Không dây."); }},
    ]
  };
}

// ============================================================
// RESOLVE
// ============================================================

export function resolveEventChoice(state, eventId, choiceIndex) {
  // Sự kiện hành quân vẫn nằm trên state.pendingEvent (phiên liên tục, không phải thư).
  if (state.pendingEvent && state.pendingEvent.id === eventId) {
    const chT = state.pendingEvent.choices && state.pendingEvent.choices[choiceIndex];
    if (chT && typeof chT.apply === "function") chT.apply(state);
    state.pendingEvent = null;
    return true;
  }
  const arr = Array.isArray(state.inbox) ? state.inbox : [];
  const i = arr.findIndex(x => x.id === eventId);
  if (i < 0) return false;
  const ch = arr[i].choices && arr[i].choices[choiceIndex];
  if (ch && typeof ch.apply === "function") ch.apply(state);
  arr.splice(i, 1);
  return true;
}

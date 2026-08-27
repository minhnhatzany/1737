import { logLine } from "./log.js";

// Sự kiện lịch sử xảy ra theo năm
export const HistoricalTimeline = [
  {
    year: 1737,
    events: [
      {
        id: "ht_duong_hung",
        trigger: "year_start",
        exec(state) {
          logLine(state, "🔴 SỰ KIỆN LỊCH SỬ: Nguyễn Dương Hưng khởi nghĩa tại Tam Đảo, Sơn Tây. Tiếng thanh la giáo mác rền vang vùng núi rừng!", true);
          state.marqueeQueue.push("Khởi nghĩa Nguyễn Dương Hưng nổ ra tại Tam Đảo — Sơn Tây (1737)!");
        }
      },
      {
        id: "ht_trinhGiang_gia",
        trigger: "year_end",
        exec(state) {
          logLine(state, "Chúa Trịnh Giang ngày càng chìm đắm trong yến tiệc và hoang phí. Quan văn dị nghị.", true);
        }
      }
    ]
  },
  {
    year: 1738,
    events: [
      {
        id: "ht_duong_hung_dep",
        trigger: "year_start",
        exec(state) {
          logLine(state, "✅ Phủ Chúa Trịnh Giang phái Hoàng Công Kỳ đại binh tiễu phạt. Nguyễn Dương Hưng thế cô binh ít, thất bại chạy vào rừng sâu.", true);
        }
      },
    ]
  },
  {
    year: 1739,
    events: [
      {
        id: "ht_nguyen_cu",
        trigger: "year_start",
        exec(state) {
          logLine(state, "🔴 SỰ KIỆN LỊCH SỬ: Nguyễn Tuyển và Nguyễn Cừ phất cờ khởi sự tại Ninh Xá — Sơn Nam Hạ! Vạn dân đói khổ ùn ùn theo về!", true);
          state.marqueeQueue.push("🔥 Khởi nghĩa Nguyễn Cừ — Sơn Nam Hạ bùng cháy (1739)!");
          state.village.unrest += 20;
        }
      },
    ]
  },
  {
    year: 1740,
    events: [
      {
        id: "ht_le_hien_tong",
        trigger: "year_start",
        exec(state) {
          logLine(state, "👑 TRIỀU ĐẠI MỚI: Lê Hiển Tông (Duy Diêu) lên ngôi Hoàng Đế, Chúa Trịnh Doanh nắm quyền. Phủ Chúa ra lệnh đại tu quân chính.", true);
          state.marqueeQueue.push("Lê Hiển Tông đăng cơ — Trịnh Doanh chấp chính (1740)!");
        }
      },
      {
        id: "ht_danh_phuong_som",
        trigger: "year_mid",
        exec(state) {
          logLine(state, "🔴 SỰ KIỆN: Nguyễn Danh Phương tụ nghĩa vùng Tam Đảo - Hương Canh, bắt đầu hình thành căn cứ riêng trong loạn Đàng Ngoài.", true);
          state.marqueeQueue.push("⚔️ Nguyễn Danh Phương nổi dậy vùng Hương Canh (1740)!");
          state.village.unrest += 10;
        }
      }
    ]
  },
  {
    year: 1743,
    events: [
      {
        id: "ht_quat_he",
        trigger: "year_start",
        exec(state) {
          logLine(state, "🔴 SỰ KIỆN: Quận He Nguyễn Hữu Cầu nổi dậy mạnh ở duyên hải Đông Bắc, đánh giết tướng thủy đạo và gây báo động tới Thăng Long.", true);
          state.marqueeQueue.push("⚔️ Quận He Nguyễn Hữu Cầu đại loạn vùng Hải Dương - Kinh Bắc (1743)!");
          state.village.unrest += 15;
        }
      }
    ]
  },
  {
    year: 1741,
    events: [
      {
        id: "ht_danh_phuong",
        trigger: "year_start",
        exec(state) {
          logLine(state, "🔴 DIỄN BIẾN: Nguyễn Danh Phương củng cố mạnh căn cứ Hương Canh — Sơn Tây, mở rộng vùng đánh phá sau đợt nổi dậy ban đầu.", true);
          state.marqueeQueue.push("Nguyễn Danh Phương mở rộng căn cứ Hương Canh (1741).");
        }
      }
    ]
  },
  {
    year: 1743,
    events: [
      {
        id: "ht_trinh_doanh_dich_than",
        trigger: "year_start",
        exec(state) {
          logLine(state, "⚔️ Phủ Chúa Trịnh Doanh hạ chiếu đại chinh: Phạm Đình Trọng, Hoàng Ngũ Phúc các đạo tiến đánh Ninh Xá và Quận He — Chúa chỉ đạo từ Trấn Bắc, không giao cho một mình Chúa cầm nhiều tiền tuyến.", true);
          state.marqueeQueue.push("Đại chinh khởi nghĩa (1743): Phạm Đình Trọng / Hoàng Ngũ Phúc!");
        }
      }
    ]
  },
  {
    year: 1748,
    events: [
      {
        id: "ht_nguyen_cu_bat",
        trigger: "year_start",
        exec(state) {
          logLine(state, "✅ Nguyễn Cừ bị bắt sống và xử tử tại Thăng Long. Anh trai Nguyễn Tuyển chết trận trước đó. Cuộc khởi nghĩa Ninh Xá chấm dứt.", true);
          state.marqueeQueue.push("✅ Nguyễn Cừ bị bắt, khởi nghĩa Sơn Nam tan rã (1748)!");
        }
      }
    ]
  },
  {
    year: 1751,
    events: [
      {
        id: "ht_quat_he_tu",
        trigger: "year_start",
        exec(state) {
          logLine(state, "✅ Quận He Nguyễn Hữu Cầu bị Bùi Thế Đạt và Phạm Đình Trọng bắt được — kết thúc oanh liệt 11 năm khởi nghĩa!", true);
          state.marqueeQueue.push("✅ Quận He Nguyễn Hữu Cầu bị bắt sau 11 năm (1751)!");
        }
      },
      {
        id: "ht_danh_phuong_tu",
        trigger: "year_mid",
        exec(state) {
          logLine(state, "✅ Nguyễn Danh Phương cũng bị bắt trong năm này. Lần đầu tiên sau 15 năm Đàng Ngoài tạm yên.", true);
        }
      }
    ]
  },
];

const markKey = "ht_executed";

export function checkHistoricalEvents(state) {
  if (!state._htExec) state._htExec = {};
  const year = state.ban;
  const monthIndex = state.monthIndex;

  for (const ytl of HistoricalTimeline) {
    if (ytl.year !== year) continue;
    for (const ev of ytl.events) {
      if (state._htExec[ev.id]) continue;

      let shouldRun = false;
      if (ev.trigger === "year_start") shouldRun = monthIndex <= 2;
      else if (ev.trigger === "year_mid") shouldRun = monthIndex === 6 || monthIndex === 7;
      else if (ev.trigger === "year_end") shouldRun = monthIndex >= 11;

      if (shouldRun) {
        ev.exec(state);
        state._htExec[ev.id] = true;
      }
    }
  }
}

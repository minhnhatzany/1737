import { rng, rngInt, rngChance, rngChoice } from "./core/rng.js";
import { PlayerRank } from "./models.js";
import { pushCelebration, randInt, ymKey } from "./engine.js";
import { logLine } from "./log.js";

export function ensureQuestState(state) {
  if (!state.quests) state.quests = [];
  if (!state.uiCelebrations) state.uiCelebrations = [];
  if (!state._questFlags) state._questFlags = {};
}
export function completeQuest(state, q, rewardText) {
  if (q.completed) return;
  q.completed = true;
  q.completedAt = ymKey(state);
  logLine(state, `✅ HOÀN THÀNH SỨ MỆNH: ${q.title}. ${rewardText}`, true);
  pushCelebration(state, "CHIẾU CHỈ BAN THƯỞNG", `${q.title}<br><br>${rewardText}`, "coin");
}
export function questProgressText(q) {
  if (!q) return "";
  const pct = Math.max(0, Math.min(100, Math.floor((q.progress / Math.max(1, q.goal)) * 100)));
  return `${q.progress}/${q.goal} (${pct}%)`;
}
export function makeQuestStarterPack(state) {
  const qStart = ymKey(state);
  const core = [
    {
      id: "q_startup_grain",
      title: "Dân Đen Khởi Nghiệp",
      desc: "Tích cóp đủ 100 Quan và 50 Thóc. Có vốn mới dám mơ lớn.",
      kind: "threshold",
      startAt: qStart,
      deadlineMonths: 12,
      goal: 1,
      progress: 0,
      completed: false,
      reward: { uyTin: 10, danhVong: 5, money: 20 },
      check(state) {
        const p = state.player;
        const ok = (p.tien >= 100 && p.thocCaNhan >= 50);
        return { ok, progress: ok ? 1 : 0, goal: 1, deadline: this.deadlineMonths };
      },
      applyReward(state) {
        state.player.uyTinCong += this.reward.uyTin;
        state.player.danhVong += this.reward.danhVong;
        state.player.tien += this.reward.money;
        return `Thưởng: +${this.reward.uyTin} Uy Tín · +${this.reward.danhVong} Danh Vọng · +${this.reward.money} Quan.`;
      }
    },
    {
      id: "q_find_spouse",
      title: "Mối Lương Duyên",
      desc: "Thành gia thất trước tuổi 25. Nhà có nóc thì người mới yên.",
      kind: "milestone",
      startAt: qStart,
      deadlineMonths: 84,
      goal: 1,
      progress: 0,
      completed: false,
      reward: { uyTin: 20, danhVong: 20 },
      check(state) {
        const p = state.player;
        const ok = !!p.giaDinh?.vo;
        return { ok, progress: ok ? 1 : 0, goal: 1, deadline: this.deadlineMonths };
      },
      applyReward(state) {
        state.player.uyTinCong += this.reward.uyTin;
        state.player.danhVong += this.reward.danhVong;
        return `Thưởng: +${this.reward.uyTin} Uy Tín · +${this.reward.danhVong} Danh Vọng.`;
      }
    },
    {
      id: "q_bac_cu",
      title: "Tay Mơ Lên Võ Đài",
      desc: "Đạt 20 Võ Thuật và đỗ Bác Cử để mở đường binh nghiệp.",
      kind: "milestone",
      startAt: qStart,
      deadlineMonths: 36,
      goal: 1,
      progress: 0,
      completed: false,
      reward: { danhVong: 25, money: 50 },
      check(state) {
        const p = state.player;
        const ok = (p.voThuat >= 20 && p.rank === PlayerRank.DOI_TRUONG);
        return { ok, progress: ok ? 1 : 0, goal: 1, deadline: this.deadlineMonths };
      },
      applyReward(state) {
        state.player.danhVong += this.reward.danhVong;
        state.player.tien += this.reward.money;
        return `Thưởng: +${this.reward.danhVong} Danh Vọng · +${this.reward.money} Quan.`;
      }
    },
    {
      id: "q_clan_patron",
      title: "Xin Nương Dòng Họ",
      desc: "Chọn một dòng họ địa phương để xin bảo trợ làm ăn.",
      kind: "milestone",
      startAt: qStart,
      deadlineMonths: 8,
      goal: 1,
      progress: 0,
      completed: false,
      reward: { money: 25, uyTin: 5 },
      check(s) {
        const ok = !!s.player?._patronClanId;
        return { ok, progress: ok ? 1 : 0, goal: 1, deadline: this.deadlineMonths };
      },
      applyReward(s) {
        s.player.tien += this.reward.money;
        s.player.uyTinCong += this.reward.uyTin;
        return `Thưởng: +${this.reward.money} Quan · +${this.reward.uyTin} Uy Tín.`;
      }
    },
    {
      id: "q_clan_dirty_work_1",
      title: "Việc Bẩn Đầu Tay",
      desc: "Nhận và hoàn thành 1 phi vụ bẩn cho một dòng họ địa phương.",
      kind: "milestone",
      startAt: qStart,
      deadlineMonths: 10,
      goal: 1,
      progress: 0,
      completed: false,
      reward: { money: 40, uyTin: 8 },
      check(s) {
        const done = s._clanQuestStats?.total || 0;
        const ok = done >= 1;
        return { ok, progress: Math.min(1, done), goal: 1, deadline: this.deadlineMonths };
      },
      applyReward(s) {
        s.player.tien += this.reward.money;
        s.player.uyTinCong += this.reward.uyTin;
        return `Thưởng: +${this.reward.money} Quan · +${this.reward.uyTin} Uy Tín.`;
      }
    },
    {
      id: "q_clan_mediate_once",
      title: "Dập Lửa Gầm Gè",
      desc: "Can thiệp dàn hòa ít nhất 1 mâu thuẫn giữa các dòng họ.",
      kind: "milestone",
      startAt: qStart,
      deadlineMonths: 16,
      goal: 1,
      progress: 0,
      completed: false,
      reward: { uyTin: 15, danhVong: 12 },
      check(s) {
        const done = s._clanQuestStats?.mediate || 0;
        const ok = done >= 1;
        return { ok, progress: Math.min(1, done), goal: 1, deadline: this.deadlineMonths };
      },
      applyReward(s) {
        s.player.uyTinCong += this.reward.uyTin;
        s.player.danhVong += this.reward.danhVong;
        return `Thưởng: +${this.reward.uyTin} Uy Tín · +${this.reward.danhVong} Danh Vọng.`;
      }
    },
    {
      id: "q_clan_dirty_work_3",
      title: "Chuyên Gia Chơi Đểu",
      desc: "Hoàn thành tổng cộng 3 phi vụ bẩn cho các dòng họ để gây tiếng tăm ngầm.",
      kind: "milestone",
      startAt: qStart,
      deadlineMonths: 18,
      goal: 3,
      progress: 0,
      completed: false,
      reward: { money: 120, danhVong: 20 },
      check(s) {
        const done = s._clanQuestStats?.total || 0;
        const ok = done >= 3;
        return { ok, progress: Math.min(3, done), goal: 3, deadline: this.deadlineMonths };
      },
      applyReward(s) {
        s.player.tien += this.reward.money;
        s.player.danhVong += this.reward.danhVong;
        return `Thưởng: +${this.reward.money} Quan · +${this.reward.danhVong} Danh Vọng.`;
      }
    },
    {
      id: "q_open_market_tab",
      title: "Làm Quen Sàn Chợ",
      desc: "Mở tab Chợ lần đầu để xem giá hàng hóa theo vùng.",
      kind: "tutorial",
      startAt: qStart,
      deadlineMonths: 6,
      goal: 1,
      progress: 0,
      completed: false,
      reward: { money: 15 },
      check(s) {
        const ok = !!s.uiSeenTabs?.tabMarket;
        return { ok, progress: ok ? 1 : 0, goal: 1, deadline: this.deadlineMonths };
      },
      applyReward(s) {
        s.player.tien += this.reward.money;
        return `Thưởng: +${this.reward.money} Quan.`;
      }
    },
    {
      id: "q_first_trade",
      title: "Mua Bán Mở Hàng",
      desc: "Hoàn tất ít nhất 1 giao dịch ở Chợ (mua hoặc bán).",
      kind: "tutorial",
      startAt: qStart,
      deadlineMonths: 8,
      goal: 1,
      progress: 0,
      completed: false,
      reward: { money: 30, uyTin: 6 },
      check(s) {
        const ok = !!s.onboarding?.firstTradeDone;
        return { ok, progress: ok ? 1 : 0, goal: 1, deadline: this.deadlineMonths };
      },
      applyReward(s) {
        s.player.tien += this.reward.money;
        s.player.uyTinCong += this.reward.uyTin;
        return `Thưởng: +${this.reward.money} Quan · +${this.reward.uyTin} Uy Tín.`;
      }
    },
    {
      id: "q_open_map_tab",
      title: "Nhìn Bản Đồ Đại Cục",
      desc: "Mở tab Bản Đồ để quan sát địa bàn và tuyến hành quân.",
      kind: "tutorial",
      startAt: qStart,
      deadlineMonths: 8,
      goal: 1,
      progress: 0,
      completed: false,
      reward: { uyTin: 8 },
      check(s) {
        const ok = !!s.uiSeenTabs?.tabMap;
        return { ok, progress: ok ? 1 : 0, goal: 1, deadline: this.deadlineMonths };
      },
      applyReward(s) {
        s.player.uyTinCong += this.reward.uyTin;
        return `Thưởng: +${this.reward.uyTin} Uy Tín.`;
      }
    },
    {
      id: "q_first_travel",
      title: "Hành Quân Đầu Đời",
      desc: "Di chuyển thành công ít nhất 1 lần qua Bản Đồ.",
      kind: "tutorial",
      startAt: qStart,
      deadlineMonths: 10,
      goal: 1,
      progress: 0,
      completed: false,
      reward: { danhVong: 12, money: 20 },
      check(s) {
        const ok = !!s.onboarding?.firstTravelDone;
        return { ok, progress: ok ? 1 : 0, goal: 1, deadline: this.deadlineMonths };
      },
      applyReward(s) {
        s.player.danhVong += this.reward.danhVong;
        s.player.tien += this.reward.money;
        return `Thưởng: +${this.reward.danhVong} Danh Vọng · +${this.reward.money} Quan.`;
      }
    },
    {
      id: "q_choose_focus",
      title: "Định Hướng Cuộc Đời",
      desc: "Vào tab Lối Sống và chọn 1 trọng tâm chơi.",
      kind: "tutorial",
      startAt: qStart,
      deadlineMonths: 12,
      goal: 1,
      progress: 0,
      completed: false,
      reward: { uyTin: 10, danhVong: 10 },
      check(s) {
        const ok = !!s.onboarding?.firstFocusDone || !!s.player?.lifestyleFocus;
        return { ok, progress: ok ? 1 : 0, goal: 1, deadline: this.deadlineMonths };
      },
      applyReward(s) {
        s.player.uyTinCong += this.reward.uyTin;
        s.player.danhVong += this.reward.danhVong;
        return `Thưởng: +${this.reward.uyTin} Uy Tín · +${this.reward.danhVong} Danh Vọng.`;
      }
    },
    {
      id: "q_survive_wanted_3",
      title: "Tên Cướp Có Số Má",
      desc: "Đạt mức truy nã 3 mà vẫn còn sống sót để đi tiếp. Không có đường lùi.",
      kind: "hardcore",
      startAt: qStart,
      deadlineMonths: 24,
      goal: 1,
      progress: 0,
      completed: false,
      reward: { danhVong: 30, money: 80 },
      check(s) {
        const lvl = s.player?.wantedLevel || 0;
        const ok = lvl >= 3;
        return { ok, progress: ok ? 1 : 0, goal: 1, deadline: this.deadlineMonths };
      },
      applyReward(s) {
        s.player.danhVong += this.reward.danhVong;
        s.player.tien += this.reward.money;
        return `Thưởng: +${this.reward.danhVong} Danh Vọng · +${this.reward.money} Quan.`;
      }
    },
    {
      id: "q_shadow_warrior",
      title: "Bàn Tay Bóng Tối",
      desc: "Hoàn thành 6 phi vụ bẩn cho dòng họ. Càng làm càng lún.",
      kind: "hardcore",
      startAt: qStart,
      deadlineMonths: 24,
      goal: 6,
      progress: 0,
      completed: false,
      reward: { money: 180, uyTin: 20, danhVong: 35 },
      check(s) {
        const done = s._clanQuestStats?.total || 0;
        return { ok: done >= 6, progress: Math.min(6, done), goal: 6, deadline: this.deadlineMonths };
      },
      applyReward(s) {
        s.player.tien += this.reward.money;
        s.player.uyTinCong += this.reward.uyTin;
        s.player.danhVong += this.reward.danhVong;
        return `Thưởng: +${this.reward.money} Quan · +${this.reward.uyTin} Uy Tín · +${this.reward.danhVong} Danh Vọng.`;
      }
    },
    {
      id: "q_break_200_army",
      title: "Lửa Thử Vàng",
      desc: "Dẫn được 200 quân trong lúc vẫn giữ thể lực trên 60. Vừa mạnh vừa bền.",
      kind: "hardcore",
      startAt: qStart,
      deadlineMonths: 30,
      goal: 1,
      progress: 0,
      completed: false,
      reward: { money: 120, uyTin: 28 },
      check(s) {
        const ok = (s.player?.quanSo || 0) >= 200 && (s.player?.theLuc || 0) >= 60;
        return { ok, progress: ok ? 1 : 0, goal: 1, deadline: this.deadlineMonths };
      },
      applyReward(s) {
        s.player.tien += this.reward.money;
        s.player.uyTinCong += this.reward.uyTin;
        return `Thưởng: +${this.reward.money} Quan · +${this.reward.uyTin} Uy Tín.`;
      }
    },
    {
      id: "q_clan_shadow_10",
      title: "Bóng Tối Thành Danh",
      desc: "Hoàn tất 10 phi vụ dòng họ để thành tay trong khét tiếng khắp vùng.",
      kind: "hardcore",
      startAt: qStart,
      deadlineMonths: 36,
      goal: 10,
      progress: 0,
      completed: false,
      reward: { money: 260, danhVong: 50 },
      check(s) {
        const done = s._clanQuestStats?.total || 0;
        return { ok: done >= 10, progress: Math.min(10, done), goal: 10, deadline: this.deadlineMonths };
      },
      applyReward(s) {
        s.player.tien += this.reward.money;
        s.player.danhVong += this.reward.danhVong;
        return `Thưởng: +${this.reward.money} Quan · +${this.reward.danhVong} Danh Vọng.`;
      }
    },
    {
      id: "q_wealth_1200",
      title: "Két Sắt Dân Gian",
      desc: "Tích lũy 1200 Quan tiền mặt. Người không vốn khó mà sống yên.",
      kind: "milestone",
      startAt: qStart,
      deadlineMonths: 40,
      goal: 1,
      progress: 0,
      completed: false,
      reward: { uyTin: 35, danhVong: 20 },
      check(s) {
        const ok = (s.player?.tien || 0) >= 1200;
        return { ok, progress: ok ? 1 : 0, goal: 1, deadline: this.deadlineMonths };
      },
      applyReward(s) {
        s.player.uyTinCong += this.reward.uyTin;
        s.player.danhVong += this.reward.danhVong;
        return `Thưởng: +${this.reward.uyTin} Uy Tín · +${this.reward.danhVong} Danh Vọng.`;
      }
    },
    {
      id: "q_stamina_master",
      title: "Thép Rèn Thân Xác",
      desc: "Giữ thể lực từ 95 trở lên trong một tháng trọn vẹn (khi sang tháng vẫn >=95).",
      kind: "challenge",
      startAt: qStart,
      deadlineMonths: 24,
      goal: 1,
      progress: 0,
      completed: false,
      reward: { money: 90, uyTin: 16 },
      check(s) {
        const ok = (s.player?.theLuc || 0) >= 95;
        return { ok, progress: ok ? 1 : 0, goal: 1, deadline: this.deadlineMonths };
      },
      applyReward(s) {
        s.player.tien += this.reward.money;
        s.player.uyTinCong += this.reward.uyTin;
        return `Thưởng: +${this.reward.money} Quan · +${this.reward.uyTin} Uy Tín.`;
      }
    }
  ];
  if (state?.uxFirstPlay === false) {
    return core.filter(q => q.kind !== "tutorial");
  }
  return core;
}
export function initQuestsIfNeeded(state) {
  ensureQuestState(state);
  if (!state.quests || state.quests.length === 0) {
    state.quests = makeQuestStarterPack(state);
    logLine(state, "🧭 Sứ mệnh khởi đầu đã được giao. Hoàn thành để nhận thưởng.", true);
  }
}
export function refreshQuestsYearly(state) {
  ensureQuestState(state);
  const k = `year_${state.ban}`;
  if (state._questFlags[k]) return;
  // mỗi năm chỉ thêm 1 sứ mệnh ngẫu nhiên nhẹ để tránh loãng UI
  state._questFlags[k] = true;

  const qStart = ymKey(state);
  const candidates = [
    {
      id: `q_year_${state.ban}_prestige`,
      title: "Danh Tiếng Nổi Lên",
      desc: "Đạt 150 Danh Vọng. Có danh mới có quyền.",
      kind: "threshold",
      startAt: qStart,
      deadlineMonths: 12,
      goal: 1, progress: 0, completed: false,
      reward: { uyTin: 15, money: 60 },
      check(s) {
        const ok = (s.player.danhVong >= 150);
        return { ok, progress: ok ? 1 : 0, goal: 1, deadline: this.deadlineMonths };
      },
      applyReward(s) {
        s.player.uyTinCong += this.reward.uyTin;
        s.player.tien += this.reward.money;
        return `Thưởng: +${this.reward.uyTin} Uy Tín · +${this.reward.money} Quan.`;
      }
    },
    {
      id: `q_year_${state.ban}_holdings`,
      title: "Đắp Nền Cơ Nghiệp",
      desc: "Sở hữu 2 công trình bất động sản ở quê nhà.",
      kind: "threshold",
      startAt: qStart,
      deadlineMonths: 12,
      goal: 1, progress: 0, completed: false,
      reward: { money: 80, danhVong: 15 },
      check(s) {
        const count = (s.player.holdings || []).length;
        const ok = count >= 2;
        return { ok, progress: ok ? 1 : 0, goal: 1, deadline: this.deadlineMonths };
      },
      applyReward(s) {
        s.player.tien += this.reward.money;
        s.player.danhVong += this.reward.danhVong;
        return `Thưởng: +${this.reward.danhVong} Danh Vọng · +${this.reward.money} Quan.`;
      }
    }
  ];
  const q = candidates[randInt(0, candidates.length - 1)];
  state.quests.push(q);
  logLine(state, `🧭 Sứ mệnh mới: ${q.title}.`, true);
}
export function tickQuests(state) {
  ensureQuestState(state);
  if (!state.quests || state.quests.length === 0) return;

  for (const q of state.quests) {
    if (!q || q.completed) continue;
    if (q.kind === "tutorial" && state?.uxFirstPlay === false) continue;
    const res = q.check ? q.check(state) : null;
    if (!res) continue;
    q.progress = res.progress ?? q.progress ?? 0;
    q.goal = res.goal ?? q.goal ?? 1;
    if (res.ok) {
      const rewardText = q.applyReward ? q.applyReward(state) : "Thưởng: (không rõ).";
      completeQuest(state, q, rewardText);
    }
  }
}

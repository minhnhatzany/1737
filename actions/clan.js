import { rng, rngInt, rngChance, rngChoice } from "../core/rng.js";
import { scopeKey } from "../core/seats.js";
import { addCase, clamp, daySerial, getPosting, randInt, scheduleDelayedEffect } from "../engine.js";
import { ClanAttitude, Faction, PlayerRank } from "../models.js";
import { logLine } from "../log.js";

export function clanSurname(clanName) {
  const m = String(clanName || "").match(/Họ\s+([A-Za-zÀ-ỹ]+)/i);
  return m?.[1] || "Nguyễn";
}
export function adjustClanMembersOpinion(state, clanId, delta, fearDelta = 0) {
  const clan = state.clans?.find(c => c.id === clanId);
  if (!clan) return;
  for (const mid of (clan.memberIds || [])) {
    const npc = state.npcById?.[mid];
    if (!npc) continue;
    npc.opinion = clamp((npc.opinion || 0) + delta, -100, 100);
    if (fearDelta) npc._fear = clamp((npc._fear || 0) + fearDelta, 0, 200);
  }
}
export function clanAvgOpinionToPlayer(state, clanId) {
  const clan = state.clans?.find(c => c.id === clanId);
  if (!clan || !clan.memberIds || clan.memberIds.length === 0) return 0;
  let sum = 0, n = 0;
  for (const mid of clan.memberIds) {
    const npc = state.npcById?.[mid];
    if (!npc) continue;
    sum += (npc.opinion || 0);
    n++;
  }
  return n > 0 ? Math.round(sum / n) : 0;
}
export function isClanFriendly(clan) {
  return clan?.attitude === ClanAttitude.KINH || clan?.attitude === ClanAttitude.LIEN_MINH || clan?.attitude === ClanAttitude.FRIENDLY || clan?.attitude === "friendly";
}
export function isClanHostile(clan) {
  return clan?.attitude === ClanAttitude.THU || clan?.attitude === ClanAttitude.HOSTILE || clan?.attitude === "hostile";
}
export function ensureClanFavorState(state) {
  if (!state.clanFavor) state.clanFavor = {};
  for (const c of (state.clans || [])) {
    if (!(c.id in state.clanFavor)) state.clanFavor[c.id] = 0;
  }
}
export function changeClanFavor(state, clanId, delta) {
  if (!clanId || !Number.isFinite(delta)) return;
  ensureClanFavorState(state);
  const prev = state.clanFavor[clanId] || 0;
  state.clanFavor[clanId] = clamp(prev + delta, -100, 100);
}
export function getClanPressurePreset(state) {
  const mode = state?.clanPressureMode || "standard";
  if (mode === "easy") {
    return {
      mode,
      levyMin: 4, levySpan: 6,
      retaliationChance: 0.12,
      retaliationLossMin: 5, retaliationLossSpan: 10,
      extortChance: 0.20,
      extortMin: 6, extortSpan: 10,
      extortStamina: 2,
      patronHarvestBoost: 1.18,
      sabotageChance: 0.11,
      smuggleCatchMul: 0.78,
      specialtyBoost: 1.15,
    };
  }
  if (mode === "hardcore") {
    return {
      mode,
      levyMin: 7, levySpan: 10,
      retaliationChance: 0.26,
      retaliationLossMin: 9, retaliationLossSpan: 18,
      extortChance: 0.39,
      extortMin: 10, extortSpan: 16,
      extortStamina: 5,
      patronHarvestBoost: 1.12,
      sabotageChance: 0.22,
      smuggleCatchMul: 0.90,
      specialtyBoost: 1.10,
    };
  }
  return {
    mode: "standard",
    levyMin: 6, levySpan: 8,
    retaliationChance: 0.22,
    retaliationLossMin: 8, retaliationLossSpan: 18,
    extortChance: 0.35,
    extortMin: 10, extortSpan: 16,
    extortStamina: 4,
    patronHarvestBoost: 1.15,
    sabotageChance: 0.18,
    smuggleCatchMul: 0.85,
    specialtyBoost: 1.12,
  };
}
export function localClanIds(state) {
  // T3.1b: "địa phương" = xã người chơi ĐANG ĐỨNG (p.currentXa). Xã phủ Quảng Oai
  // có 2-3 dòng họ sinh riêng (scope="xa", scopeId=xaId). Ngoài QO (huyện procedural,
  // hoặc xã chưa có họ) rơi về 3 họ toàn cục qua village.clanIds — đường cũ không đổi.
  return xaClanIds(state, state.player?.currentXa) || fallbackGlobalClanIds(state);
}
/** T3.1c: id dòng họ cấp xã của MỘT xã bất kỳ (không phụ thuộc vị trí player). */
export function xaClanIds(state, xaId) {
  if (!xaId) return null;
  const ids = (state.clans || []).filter(c => c.scope === "xa" && c.scopeId === xaId).map(c => c.id);
  return ids.length ? ids : null;
}
function fallbackGlobalClanIds(state) {
  // T3.3-0: village.clanIds nay là họ CỤC BỘ xã hiện tại. Fallback (xã ngoài QO) phải
  // đọc thẳng 3 họ toàn cục (scope=null), không qua village.
  return (state.clans || []).filter(c => c.scope == null).map(c => c.id).slice(0, 6);
}
/** T3.1c: đổi vị thế (status 0..100) một dòng họ, clamp. */
export function adjustClanStatus(state, clanId, delta) {
  const clan = state.clans?.find(c => c.id === clanId);
  if (!clan || !Number.isFinite(delta)) return;
  clan.status = clamp((clan.status ?? 50) + delta, 0, 100);
}
/**
 * T3.1c: đồng bộ seat.contestingClanIds cho MỘT ghế cấp xã = các dòng họ trong
 * đúng xã đó, xếp theo status giảm dần. Ghế trống hay có chủ đều điền.
 */
export function syncSeatContestants(state, seatId) {
  const seat = state.seats?.[seatId];
  if (!seat || seat.scope !== "xa") return;
  const ids = (xaClanIds(state, seat.scopeId) || []).slice();
  ids.sort((a, b) => (state.clanById?.[b]?.status ?? 0) - (state.clanById?.[a]?.status ?? 0));
  seat.contestingClanIds = ids;
}
/**
 * T3.1c: dòng họ sẽ lên nắm ghế lý trưởng nếu ghế trống / đổi chủ — status CAO NHẤT
 * trong xã, KHÔNG random đều. Tie: giữ thứ tự contestingClanIds (đã sort theo status).
 */
export function pickXaSeatSuccessorClan(state, seatId) {
  const seat = state.seats?.[seatId];
  if (!seat || seat.scope !== "xa") return null;
  const ids = seat.contestingClanIds?.length ? seat.contestingClanIds : (xaClanIds(state, seat.scopeId) || []);
  let best = null, bestStatus = -Infinity;
  for (const id of ids) {
    const st = state.clanById?.[id]?.status ?? -Infinity;
    if (st > bestStatus) { bestStatus = st; best = id; }
  }
  return best;
}
/**
 * T3.1c: tick tháng — tuyệt tự (không NPC nào còn mang clanId đó, không thành viên,
 * player cũng không nương) -> status lụi dần; rồi đồng bộ contestingClanIds mọi ghế xã.
 * KHÔNG dùng rng(state) -> không xê dịch chuỗi RNG lượt chơi.
 */
export function tickXaClanStatusMonthly(state) {
  const xaClans = (state.clans || []).filter(c => c.scope === "xa");
  if (xaClans.length === 0) return;
  const alive = new Set((state.npcs || []).map(n => n.clanId).filter(Boolean));
  if (state.player?._patronClanId) alive.add(state.player._patronClanId);
  for (const c of xaClans) {
    if (!alive.has(c.id) && (c.memberIds || []).length === 0) {
      c.status = clamp((c.status ?? 50) - 3, 0, 100);
    }
  }
  for (const seatId of Object.keys(state.seats || {})) {
    if (state.seats[seatId].scope === "xa") syncSeatContestants(state, seatId);
  }
}
/**
 * T3.1c: sinh 1 vụ "tranh ghế lý trưởng" cho ghế xã TRỐNG nơi player đứng, xã có
 * >=2 dòng họ. Lựa chọn THIÊN VỀ dòng họ status cao nhất (không chọn ngẫu nhiên đều).
 */
export function maybeAddSeatContestCase(state, po) {
  const xaId = state.player?.currentXa;
  const seatId = xaId ? state.seatsByScope?.[scopeKey("xa", xaId)] : null;
  const seat = seatId ? state.seats[seatId] : null;
  if (!seat || seat.scope !== "xa" || seat.occupantId) return;
  syncSeatContestants(state, seatId);
  const ids = seat.contestingClanIds || [];
  if (ids.length < 2) return;
  if (rng(state) > 0.5) return;
  const favClan = state.clans.find(c => c.id === pickXaSeatSuccessorClan(state, seatId));
  const other = state.clans.find(c => c.id === ids.find(id => id !== favClan?.id));
  if (!favClan || !other) return;
  addCase(po, {
    type: "seat_contest",
    severity: "vừa",
    title: `Tranh ghế lý trưởng: ${favClan.name} vs ${other.name}`,
    desc: `Ghế lý trưởng xã đang trống. ${favClan.name} (vị thế ${Math.round(favClan.status)}) và ${other.name} (${Math.round(other.status)}) cùng giành. Ngả về ai?`,
    due: `trong tháng ${state.monthIndex}`,
    choices: [
      { label: `Thuận theo ${favClan.name} (vị thế cao)`, apply(s){
        adjustClanStatus(s, favClan.id, +10);
        adjustClanStatus(s, other.id, -4);
        s.player.uyTinCong += 4;
        logLine(s, `Ghế lý trưởng về tay ${favClan.name}. Thuận lòng số đông, yên chuyện.`, true);
      }},
      { label: `Ép ${other.name} lên (nghịch vị thế)`, apply(s){
        adjustClanStatus(s, other.id, +12);
        adjustClanStatus(s, favClan.id, -10);
        s.village.unrest = clamp((s.village.unrest || 0) + 8, 0, 100);
        logLine(s, `Ép ${other.name} lên ghế. ${favClan.name} bất phục, xã dậy sóng.`, true);
      }},
      { label: "Ăn tiền cả hai, hoãn lại (tham)", apply(s){
        const po2 = getPosting(s); if (po2) po2.corruption = clamp((po2.corruption || 0) + 8, 0, 100);
        s.player.tien += 90;
        adjustClanStatus(s, favClan.id, -3);
        adjustClanStatus(s, other.id, -3);
        logLine(s, "Nhận lót tay cả hai, ghế vẫn trống. Tiếng xấu lan.", true);
      }},
    ],
  });
}
export function tickLocalClansMonthly(state, po) {
  const p = state.player;
  if (!po || !p) return;
  const ids = localClanIds(state);
  if (ids.length === 0) return;

  // Friendly clans support the magistrate; hostile clans obstruct.
  for (const cid of ids) {
    const clan = state.clans?.find(c => c.id === cid);
    if (!clan) continue;
    const op = clanAvgOpinionToPlayer(state, cid);
    const fear = Math.max(0, Math.min(200, (state.npcById?.[clan.memberIds?.[0]]?._fear || 0)));

    // Support: donate to local treasury / help with garrison.
    const friendly = isClanFriendly(clan) || op >= 55;
    if (friendly && rng(state) < 0.55) {
      const donation = Math.max(20, Math.floor((clan.quyenLuc || 20) * (0.8 + rng(state) * 1.2)));
      po.treasury = (po.treasury || 0) + donation;
      // small unrest decrease if they fund relief
      if (rng(state) < 0.35) state.village.unrest = Math.max(0, (state.village.unrest || 0) - 3);
      logLine(state, `🤝 Dòng họ ${clan.name} ủng hộ quan phủ: +${donation}Q vào kho bạc địa phương.`, false);
      continue;
    }

    // Opposition: sabotage / whisper campaigns when hostile or hated (unless terrified).
    const hostile = isClanHostile(clan) || op <= -15;
    if (hostile && fear < 80 && rng(state) < 0.40) {
      const harm = Math.max(1, Math.floor((clan.quyenLuc || 20) * (0.25 + rng(state) * 0.35)));
      po.corruption = clamp((po.corruption || 0) + 4 + Math.floor(harm / 10), 0, 100);
      state.village.unrest = clamp((state.village.unrest || 0) + 4 + Math.floor(harm / 12), 0, 100);
      logLine(state, `😠 Dòng họ ${clan.name} ngầm chống đối: dân xì xào, việc quan khó thông suốt.`, true);
    }
  }
}
export function maybeAddClanRivalryCase(state, po) {
  const ids = localClanIds(state);
  if (ids.length < 2) return;
  // Rivalry probability: higher when unrest or corruption is high.
  const base = 0.10 + Math.max(0, (state.village.unrest - 30)) * 0.001 + Math.max(0, (po.corruption || 0) - 20) * 0.001;
  if (rng(state) > Math.min(0.35, base)) return;
  const a = ids[randInt(0, ids.length - 1)];
  let b = ids[randInt(0, ids.length - 1)];
  if (b === a) b = ids[(ids.indexOf(a) + 1) % ids.length];
  const clanA = state.clans?.find(c => c.id === a);
  const clanB = state.clans?.find(c => c.id === b);
  if (!clanA || !clanB) return;

  addCase(po, {
    type: "clan_rivalry",
    severity: "vừa",
    title: `Gầm gè dòng họ: ${clanA.name} vs ${clanB.name}`,
    desc: `Hai dòng họ tranh nhau quyền lợi (ruộng/thuế/địa vị). Nếu không hoà giải, mâu thuẫn sẽ lan thành bạo loạn và kéo phe phái vào quan phủ.`,
    due: `trong tháng ${state.monthIndex}`,
    choices: [
      { label: "Hoà giải (thử Ngoại Giao)", apply(s){
        const ok = rng(state) < (0.35 + (s.player.ngoaiGiao||0) * 0.006);
        if (ok) {
          adjustClanMembersOpinion(s, a, +10);
          adjustClanMembersOpinion(s, b, +10);
          s.village.unrest = Math.max(0, (s.village.unrest || 0) - 8);
          s.player.uyTinCong += 8;
          logLine(s, `Hoà giải thành công. ${clanA.name} và ${clanB.name} tạm nguôi giận.`, true);
        } else {
          adjustClanMembersOpinion(s, a, -6);
          adjustClanMembersOpinion(s, b, -6);
          s.village.unrest = clamp((s.village.unrest || 0) + 8, 0, 100);
          logLine(s, `Hoà giải thất bại. Hai bên càng hằn học, kéo người đến phủ nha gây sự.`, true);
        }
      }},
      { label: `Bênh ${clanA.name} (có hậu thuẫn)`, apply(s){
        adjustClanMembersOpinion(s, a, +18);
        adjustClanMembersOpinion(s, b, -18);
        adjustClanStatus(s, a, +6); adjustClanStatus(s, b, -8); // T3.1c: thắng/thua kiện -> vị thế
        const po = getPosting(s); if (po) po.treasury = (po.treasury || 0) + 60;
        s.village.unrest = clamp((s.village.unrest || 0) + 6, 0, 100);
        logLine(s, `Ngả về ${clanA.name}. Có người chống lưng, nhưng phe kia oán hận.`, true);
      }},
      { label: `Bênh ${clanB.name} (có hậu thuẫn)`, apply(s){
        adjustClanMembersOpinion(s, b, +18);
        adjustClanMembersOpinion(s, a, -18);
        adjustClanStatus(s, b, +6); adjustClanStatus(s, a, -8); // T3.1c: thắng/thua kiện -> vị thế
        const po = getPosting(s); if (po) po.treasury = (po.treasury || 0) + 60;
        s.village.unrest = clamp((s.village.unrest || 0) + 6, 0, 100);
        logLine(s, `Ngả về ${clanB.name}. Có người chống lưng, nhưng phe kia oán hận.`, true);
      }},
      { label: "Ăn tiền cả hai (tham)", apply(s){
        const po = getPosting(s); if (!po) return;
        po.corruption = clamp((po.corruption || 0) + 10, 0, 100);
        s.player.tien += 140;
        adjustClanMembersOpinion(s, a, -10);
        adjustClanMembersOpinion(s, b, -10);
        s.village.unrest = clamp((s.village.unrest || 0) + 10, 0, 100);
        logLine(s, "Nhận lót tay cả hai. Trước mắt yên, nhưng tiếng xấu lan và oán khí tăng.", true);
      }},
    ]
  });
}
export function tickClanPressureForCommoner(state) {
  const p = state.player;
  if (!p) return;
  const isCommoner = p.rank === PlayerRank.DAN_THUONG || p.rank === PlayerRank.PHU_HO;
  if (!isCommoner) return;
  const local = localClanIds(state);
  if (local.length === 0) return;

  const preset = getClanPressurePreset(state);
  const patron = p._patronClanId ? state.clans?.find(c => c.id === p._patronClanId) : null;
  if (patron) {
    // Hidden levy: protection is useful but not free.
    const levy = preset.levyMin + randInt(0, preset.levySpan);
    p.tien = Math.max(0, p.tien - levy);
    if (rng(state) < 0.45) {
      p.theLuc = clamp((p.theLuc || 0) + 3, 0, 100);
      logLine(state, `🛡️ ${patron.name} thu tô ngầm ${levy}Q nhưng cử người dẹp rối, bạn làm ăn yên ổn hơn.`, false);
    } else {
      logLine(state, `💰 Đầu tháng, ${patron.name} thu tô bảo kê ${levy}Q.`, false);
    }

    // Rival retaliation against protected commoners.
    const hostileRival = local
      .filter(cid => cid !== patron.id)
      .map(cid => state.clans?.find(c => c.id === cid))
      .filter(Boolean)
      .find(c => isClanHostile(c) || clanAvgOpinionToPlayer(state, c.id) < -25);
    if (hostileRival && rng(state) < preset.retaliationChance) {
      const loss = preset.retaliationLossMin + randInt(0, preset.retaliationLossSpan);
      p.tien = Math.max(0, p.tien - loss);
      p.uyTinCong = Math.max(0, (p.uyTinCong || 0) - 2);
      logLine(state, `🪓 Người của ${hostileRival.name} trả đũa vì bạn nương ${patron.name}: mất ${loss}Q và mất mặt ngoài chợ.`, true);
    }
    // Friendly patron occasionally calls in favors later.
    if (rng(state) < 0.12) {
      scheduleDelayedEffect(state, {
        type: "clan_favor_callin",
        clanId: patron.id,
        payQ: 8 + randInt(0, 10),
        dueDay: daySerial(state) + randInt(10, 38),
      });
    }
    return;
  }

  // No patron: easier to be squeezed by any strong local clan.
  const bully = local
    .map(cid => state.clans?.find(c => c.id === cid))
    .filter(Boolean)
    .sort((a, b) => (b.quyenLuc || 0) - (a.quyenLuc || 0))[0];
  if (bully && rng(state) < preset.extortChance) {
    const extort = preset.extortMin + randInt(0, preset.extortSpan);
    p.tien = Math.max(0, p.tien - extort);
    p.theLuc = Math.max(0, (p.theLuc || 0) - preset.extortStamina);
    logLine(state, `😓 Không có họ chống lưng, bạn bị tay chân ${bully.name} chặn đường thu ${extort}Q.`, true);
  }
}
export function actionChooseClanPatron(state, clanId) {
  const p = state.player;
  const clan = state.clans?.find(c => c.id === clanId);
  if (!clan) return { ok: false, msg: "Không tìm thấy dòng họ." };
  if (p.rank !== PlayerRank.DAN_THUONG && p.rank !== PlayerRank.PHU_HO) {
    return { ok: false, msg: "Chỉ dân đen/phú hộ mới cần xin bảo trợ dòng họ theo cách này." };
  }
  if (p.tien < 20) return { ok: false, msg: "Cần 20 quan lễ ra mắt để xin nương họ." };
  p.tien -= 20;
  p._patronClanId = clan.id;
  p._patronSinceYm = `${state.ban}-${state.monthIndex}`;
  adjustClanMembersOpinion(state, clan.id, +12, 0);
  changeClanFavor(state, clan.id, +18);
  clan.attitude = ClanAttitude.KINH;
  logLine(state, `🤝 Bạn chính thức nương dưới bóng ${clan.name}. Từ nay làm ăn đỡ bị chèn ép (nhưng phải biết điều).`, true);
  return { ok: true, feedback: [{ text: `Bảo trợ: ${clan.name}`, tone: "good" }, { text: "-20 Quan", tone: "bad" }], sfx: "coin" };
}
export function actionDropClanPatron(state) {
  const p = state.player;
  if (!p._patronClanId) return { ok: false, msg: "Bạn chưa nương dòng họ nào." };
  const clan = state.clans?.find(c => c.id === p._patronClanId);
  if (clan) {
    adjustClanMembersOpinion(state, clan.id, -15, 0);
    changeClanFavor(state, clan.id, -25);
    clan.attitude = ClanAttitude.THU;
    scheduleDelayedEffect(state, {
      type: "clan_retaliation",
      clanId: clan.id,
      lossQ: 12 + randInt(0, 20),
      dueDay: daySerial(state) + randInt(8, 26),
    });
  }
  const old = p._patronClanId;
  p._patronClanId = null;
  delete p._patronSinceYm;
  logLine(state, `🚪 Bạn cắt quan hệ bảo trợ với ${clan?.name || old}. Họ ghi thù vì bị bẽ mặt.`, true);
  return { ok: true, feedback: [{ text: "Mất bảo kê", tone: "bad" }], sfx: "caiVa" };
}
export function actionClanMediate(state, clanAId, clanBId) {
  const p = state.player;
  const a = state.clans?.find(c => c.id === clanAId);
  const b = state.clans?.find(c => c.id === clanBId);
  if (!a || !b || a.id === b.id) return { ok: false, msg: "Không đủ hai dòng họ để dàn hòa." };
  if (p.theLuc < 20) return { ok: false, msg: "Cần 20 thể lực để chạy đôn chạy đáo dàn hòa." };
  if (p.tien < 15) return { ok: false, msg: "Cần 15 quan trà nước/đãi đằng để mở lời dàn hòa." };
  p.theLuc -= 20;
  p.tien -= 15;
  const success = rng(state) < Math.min(0.9, 0.35 + (p.ngoaiGiao || 0) * 0.01 + (p.muuMeo || 0) * 0.004);
  if (success) {
    adjustClanMembersOpinion(state, a.id, +10, -6);
    adjustClanMembersOpinion(state, b.id, +10, -6);
    a.attitude = ClanAttitude.TRUNG_LAP;
    b.attitude = ClanAttitude.TRUNG_LAP;
    state.village.unrest = clamp((state.village.unrest || 0) - 8, 0, 100);
    if (!state._clanQuestStats) state._clanQuestStats = { total: 0, trom_ga: 0, pha_vuon: 0, boi_ban: 0, mediate: 0 };
    state._clanQuestStats.mediate = (state._clanQuestStats.mediate || 0) + 1;
    changeClanFavor(state, a.id, +8);
    changeClanFavor(state, b.id, +8);
    logLine(state, `🕊️ Bạn dàn hòa thành công mâu thuẫn giữa ${a.name} và ${b.name}. Làng bớt căng thẳng.`, true);
    return { ok: true, feedback: [{ text: "Dàn hòa thành công", tone: "good" }, { text: "-15 Quan", tone: "bad" }], sfx: "coin" };
  }
  state.village.unrest = clamp((state.village.unrest || 0) + 6, 0, 100);
  adjustClanMembersOpinion(state, a.id, -4, +5);
  adjustClanMembersOpinion(state, b.id, -4, +5);
  changeClanFavor(state, a.id, -4);
  changeClanFavor(state, b.id, -4);
  logLine(state, `🗯️ Dàn hòa thất bại, hai họ ${a.name} và ${b.name} càng thêm gắt gao.`, true);
  return { ok: true, feedback: [{ text: "Dàn hòa hỏng", tone: "bad" }, { text: "-15 Quan", tone: "bad" }], sfx: "caiVa" };
}
export function actionSetClanPressureMode(state, mode = "standard") {
  const next = (mode === "easy" || mode === "hardcore") ? mode : "standard";
  state.clanPressureMode = next;
  const label = next === "easy" ? "Dễ" : (next === "hardcore" ? "Hardcore" : "Chuẩn");
  logLine(state, `⚖️ Mức chi phối dòng họ chuyển sang: ${label}.`, false);
  return { ok: true, feedback: [{ text: `Chế độ dòng họ: ${label}`, tone: "good" }], sfx: "coin" };
}
export function actionClanMischief(state, clanId, type) {
  const p = state.player;
  if (!clanId || !type) return { ok: false, msg: "Thiếu thông tin phi vụ." };
  if ((state.jailDays || 0) > 0) return { ok: false, msg: "Đang bị giam, không thể đi làm kèo bẩn." };
  if (p.theLuc < 18) return { ok: false, msg: "Cần ít nhất 18 thể lực để đi quậy phá." };
  if (p.faction === Faction.NGHIA_QUAN) return { ok: false, msg: "Nghĩa quân đang lộ mặt, khó làm việc kín kiểu này." };

  const patron = state.clans?.find(c => c.id === clanId);
  if (!patron) return { ok: false, msg: "Không tìm thấy dòng họ giao việc." };

  const localIds = (localClanIds(state) || []).filter(id => id !== clanId); // T3.1c: theo xã đang đứng
  const rivals = localIds
    .map(id => state.clans?.find(c => c.id === id))
    .filter(Boolean);
  if (rivals.length === 0) return { ok: false, msg: "Không có dòng họ đối địch để ra tay." };
  rivals.sort((a, b) => clanAvgOpinionToPlayer(state, a.id) - clanAvgOpinionToPlayer(state, b.id));
  const target = rivals[0];

  const jobs = {
    trom_ga: {
      name: "Trộm gà bắt chó",
      stamina: 18,
      baseReward: 22,
      logOk: `Đêm xuống, bạn mò qua sân sau họ ${target.name}, bắt gọn gà chó đem nộp cho ${patron.name}.`,
      logFail: `Mò sang trại họ ${target.name} trộm gà nhưng bị phát giác, cả xóm réo tên.`,
      successBonus: () => [{ text: "+Quan bẩn", tone: "good" }, { text: "-CT họ bị hại", tone: "bad" }],
    },
    pha_vuon: {
      name: "Phá vườn rau đối thủ",
      stamina: 20,
      baseReward: 28,
      logOk: `Bạn ném phân và dẫm nát luống rau của họ ${target.name}, làm họ quê mặt với làng.`,
      logFail: `Đang bôi bẩn vườn rau họ ${target.name} thì bị tuần đinh soi đèn bắt tại trận.`,
      successBonus: () => [{ text: "+Uy tín ngầm", tone: "good" }, { text: "+Bất ổn", tone: "bad" }],
    },
    boi_ban: {
      name: "Bêu xấu chợ sớm",
      stamina: 22,
      baseReward: 35,
      logOk: `Bạn tung tin bẩn ở chợ khiến danh tiếng họ ${target.name} lao dốc, ${patron.name} khoái chí thưởng nóng.`,
      logFail: `Bạn bị tóm khi đang bêu xấu họ ${target.name}, phải nộp phạt để rút thân.`,
      successBonus: () => [{ text: "+Danh vọng du côn", tone: "good" }, { text: "-Uy tín chính danh", tone: "bad" }],
    },
  };
  const job = jobs[type];
  if (!job) return { ok: false, msg: "Phi vụ không hợp lệ." };

  p.theLuc -= job.stamina;
  const successChance = Math.min(0.88, 0.42 + (p.muuMeo || 0) * 0.008 + (p.voThuat || 0) * 0.003);
  const success = rng(state) < successChance;

  if (!state._clanQuestStats) state._clanQuestStats = { total: 0, trom_ga: 0, pha_vuon: 0, boi_ban: 0, mediate: 0 };

  if (success) {
    const reward = Math.floor(job.baseReward * (0.85 + rng(state) * 0.5));
    p.tien += reward;
    p.danhVong += 2;
    state.village.unrest = clamp((state.village.unrest || 0) + 2, 0, 100);
    adjustClanMembersOpinion(state, patron.id, +8, 0);
    adjustClanMembersOpinion(state, target.id, -12, +8);
    changeClanFavor(state, patron.id, +6);
    changeClanFavor(state, target.id, -8);
    patron.attitude = ClanAttitude.KINH;
    if (rng(state) < 0.35) target.attitude = ClanAttitude.THU;
    if (rng(state) < 0.45) {
      scheduleDelayedEffect(state, {
        type: "clan_retaliation",
        clanId: target.id,
        lossQ: 8 + randInt(0, 14),
        dueDay: daySerial(state) + randInt(12, 45),
      });
    }
    state._clanQuestStats.total += 1;
    state._clanQuestStats[type] = (state._clanQuestStats[type] || 0) + 1;

    logLine(state, `🕳️ Phi vụ "${job.name}" thành công cho ${patron.name}. ${job.logOk}`, true);
    return {
      ok: true,
      feedback: [{ text: `+${reward} Quan`, tone: "good" }, ...job.successBonus()],
      sfx: "coin",
    };
  }

  const fine = Math.min(p.tien, 8 + randInt(0, 14));
  p.tien -= fine;
  p.uyTinCong = Math.max(0, p.uyTinCong - 6);
  adjustClanMembersOpinion(state, target.id, -4, +5);
  changeClanFavor(state, patron.id, -4);
  changeClanFavor(state, target.id, -3);
  state.village.unrest = clamp((state.village.unrest || 0) + 4, 0, 100);
  logLine(state, `💥 Phi vụ "${job.name}" hỏng. ${job.logFail}`, true);
  return {
    ok: true,
    feedback: [{ text: `-${fine} Quan phạt`, tone: "bad" }, { text: "-6 Uy tín", tone: "bad" }],
    sfx: "caiVa",
  };
}
export function actionBeginClanMission(state, clanId, type) {
  const p = state.player;
  if (!clanId || !type) return { ok: false, msg: "Thiếu thông tin kèo dòng họ." };
  if (state._clanMission?.active) return { ok: false, msg: "Bạn đang nhận một kèo dòng họ khác. Làm xong hoặc hủy rồi nhận tiếp." };
  if ((state.jailDays || 0) > 0) return { ok: false, msg: "Đang bị giam, không thể nhận kèo." };
  if (p.faction === Faction.NGHIA_QUAN) return { ok: false, msg: "Nghĩa quân lộ mặt, khó làm kèo kín." };

  const patron = state.clans?.find(c => c.id === clanId);
  if (!patron) return { ok: false, msg: "Không tìm thấy dòng họ giao việc." };
  const localIds = (localClanIds(state) || []).filter(id => id !== clanId); // T3.1c: theo xã đang đứng
  const rivals = localIds.map(id => state.clans?.find(c => c.id === id)).filter(Boolean);
  if (rivals.length === 0) return { ok: false, msg: "Không có dòng họ đối nghịch để ra tay." };
  rivals.sort((a, b) => clanAvgOpinionToPlayer(state, a.id) - clanAvgOpinionToPlayer(state, b.id));
  const target = rivals[0];
  const targetNpcId = (target.memberIds || []).find(id => !!state.npcById?.[id]) || null;
  if (!targetNpcId) return { ok: false, msg: "Không tìm được đầu mối để do thám." };

  const jobs = {
    trom_ga:  { name: "Trộm gà bắt chó", stamina: 18, baseReward: 26 },
    pha_vuon: { name: "Phá vườn rau đối thủ", stamina: 20, baseReward: 32 },
    boi_ban:  { name: "Bêu xấu chợ sớm", stamina: 22, baseReward: 40 },
  };
  const job = jobs[type];
  if (!job) return { ok: false, msg: "Kèo không hợp lệ." };

  state._clanMission = {
    active: true,
    clanId,
    targetClanId: target.id,
    targetNpcId,
    targetRegion: state.npcById?.[targetNpcId]?.currentRegion || state.player.currentRegion,
    targetPhu: state.npcById?.[targetNpcId]?.currentPhu || null,
    targetHuyen: state.npcById?.[targetNpcId]?.currentHuyen || state.player.currentHuyen,
    targetTong: state.npcById?.[targetNpcId]?.currentTong || null,
    targetXa: state.npcById?.[targetNpcId]?.currentXa || null,
    targetLang: state.npcById?.[targetNpcId]?.currentLang || null,
    type,
    step: "intel",
    acceptedDay: daySerial(state),
    expiresDay: daySerial(state) + 45,
    jobName: job.name,
    staminaCost: job.stamina,
    rewardBase: job.baseReward,
  };
  logLine(state, `📌 Nhận kèo "${job.name}" từ ${patron.name}. Cần do thám mục tiêu trước khi ra tay.`, true);
  return { ok: true, feedback: [{ text: "Đã nhận kèo", tone: "good" }, { text: "Cần do thám mục tiêu", tone: "neutral" }], sfx: "murmur" };
}
export function actionAdvanceClanMissionIntel(state, npcId) {
  const m = state._clanMission;
  if (!m?.active || m.step !== "intel") return { ok: false, msg: "Không có kèo nào cần do thám." };
  if (!npcId || m.targetNpcId !== npcId) return { ok: false, msg: "Đây không phải đầu mối của kèo đang nhận." };
  const p = state.player;
  const npc = state.npcById?.[npcId];
  if (npc?.currentHuyen && p.currentHuyen !== npc.currentHuyen) {
    return { ok: false, msg: "Phải tới đúng huyện của đầu mối mới do thám được." };
  }
  m.step = "ready";
  logLine(state, `🕵 Bạn đã nắm được tin mật cho kèo "${m.jobName}". Có thể quay lại dòng họ để ra tay.`, false);
  return { ok: true, feedback: [{ text: "Đã lấy tin mật", tone: "good" }], sfx: "coin" };
}
export function actionExecuteClanMission(state) {
  const p = state.player;
  const m = state._clanMission;
  if (!m?.active) return { ok: false, msg: "Bạn chưa nhận kèo dòng họ nào." };
  if (m.step !== "ready") return { ok: false, msg: "Kèo chưa đủ điều kiện. Cần do thám đầu mối trước." };
  if (daySerial(state) > (m.expiresDay || 0)) {
    state._clanMission = null;
    return { ok: false, msg: "Kèo đã quá hạn, dòng họ đổi người làm." };
  }
  if (m.targetHuyen && p.currentHuyen !== m.targetHuyen) {
    return { ok: false, msg: "Bạn chưa tới đúng huyện mục tiêu để ra tay." };
  }
  if (m.targetXa && p.currentXa && p.currentXa !== m.targetXa) {
    return { ok: false, msg: "Bạn cần vào đúng xã mục tiêu để ra tay." };
  }
  if (p.theLuc < (m.staminaCost || 18)) return { ok: false, msg: `Cần ${m.staminaCost || 18} thể lực để ra tay.` };
  const patron = state.clans?.find(c => c.id === m.clanId);
  const target = state.clans?.find(c => c.id === m.targetClanId);
  if (!patron || !target) {
    state._clanMission = null;
    return { ok: false, msg: "Mục tiêu kèo đã thay đổi, phải nhận lại kèo mới." };
  }

  p.theLuc -= (m.staminaCost || 18);
  const reward = Math.max(18, Math.floor((m.rewardBase || 20) * (1 + (p.muuMeo || 0) * 0.004)));
  p.tien += reward;
  p.danhVong += 2;
  state.village.unrest = clamp((state.village.unrest || 0) + 2, 0, 100);
  adjustClanMembersOpinion(state, patron.id, +8, 0);
  adjustClanMembersOpinion(state, target.id, -12, +8);
  changeClanFavor(state, patron.id, +6);
  changeClanFavor(state, target.id, -8);
  patron.attitude = ClanAttitude.KINH;
  if (rng(state) < 0.45) {
    scheduleDelayedEffect(state, {
      type: "clan_retaliation",
      clanId: target.id,
      lossQ: 8 + randInt(0, 14),
      dueDay: daySerial(state) + randInt(12, 45),
    });
  }
  if (!state._clanQuestStats) state._clanQuestStats = { total: 0, trom_ga: 0, pha_vuon: 0, boi_ban: 0, mediate: 0 };
  state._clanQuestStats.total += 1;
  state._clanQuestStats[m.type] = (state._clanQuestStats[m.type] || 0) + 1;
  logLine(state, `🕳️ Kèo "${m.jobName}" hoàn thành cho ${patron.name}. Bạn nhận ${reward}Q.`, true);
  state._clanMission = null;
  return { ok: true, feedback: [{ text: `+${reward} Quan`, tone: "good" }, { text: `-${m.staminaCost || 18} TL`, tone: "bad" }], sfx: "coin" };
}

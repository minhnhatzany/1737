import { Faction, RegionId } from "../models.js";
import { logLine } from "../log.js";
import { getAllRegions, getRegion, getBattleState } from "../map_data.js";
import {
  clamp,
  currentYmSerial,
  ensurePostingIfNeeded,
  estimateHuyenDefense,
  getFactionStore,
  getHuyenControl,
  getHuyenGarrisonTroops,
  getPosting,
  postingHere,
  pushCelebration,
  randInt,
  setHuyenControl,
  strategicAiCounterRaidPlayer,
  strategicAiRaidWeakEnemy,
  strategicAiReinforceWeakControl,
  strategicAiTrainFieldForces,
  syncHuyenBannerFromXaBalance,
  totalDaysAbs,
  ymKey
} from "../engine.js";

export function ensureWarAiState(state) {
  if (!state._warAi || typeof state._warAi !== "object") {
    state._warAi = { nextDecisionAbs: 0, chatterCd: 0 };
  }
  if (!("truceUntilYm" in state._warAi)) state._warAi.truceUntilYm = 0;
  if (!("phase" in state._warAi)) state._warAi.phase = "mobilize";
  if (!("lastCouncilYm" in state._warAi)) state._warAi.lastCouncilYm = null;
}


export function ensureAdvancedWarState(state) {
  ensureWarAiState(state);
  if (!state._warLogistics || typeof state._warLogistics !== "object") state._warLogistics = { seq: 1, convoys: [] };
  if (!Array.isArray(state._warLogistics.convoys)) state._warLogistics.convoys = [];
  if (!Number.isFinite(Number(state._warLogistics.seq))) state._warLogistics.seq = 1;
  if (!state._warEconomy || typeof state._warEconomy !== "object") state._warEconomy = { huyen: {} };
  if (!state._warEconomy.huyen || typeof state._warEconomy.huyen !== "object") state._warEconomy.huyen = {};
  if (!state._warObjectives || typeof state._warObjectives !== "object") state._warObjectives = { current: null, lastRollYm: null };
  if (!state._warAnnualStats || typeof state._warAnnualStats !== "object") {
    state._warAnnualStats = { year: state.ban || 1737, battles: 0, flips: 0, convoysRaided: 0, supplyMoved: 0, localRequisition: 0, objectivesDone: 0, truceMonths: 0 };
  }
  if (state._warAnnualStats.year !== (state.ban || 1737)) {
    state._warAnnualStats = { year: state.ban || 1737, battles: 0, flips: 0, convoysRaided: 0, supplyMoved: 0, localRequisition: 0, objectivesDone: 0, truceMonths: 0 };
  }
}


export function warStatInc(state, key, amount = 1) {
  ensureAdvancedWarState(state);
  state._warAnnualStats[key] = Math.max(0, Math.floor((state._warAnnualStats[key] || 0) + amount));
}


export function currentWarPhase(state) {
  const idx = ((state.monthIndex || 1) - 1) % 4;
  if (idx === 0) return "mobilize";
  if (idx === 1) return "march";
  if (idx === 2) return "clash";
  return "consolidate";
}


export function warPhaseLabel(phase) {
  if (phase === "mobilize") return "Huy động";
  if (phase === "march") return "Hành quân";
  if (phase === "clash") return "Giao chiến";
  return "Củng cố";
}


export function isWarTruceActive(state) {
  const ym = currentYmSerial(state);
  return (state?._warAi?.truceUntilYm || 0) >= ym;
}


export function ensureWarEconomyByHuyen(state, entries) {
  ensureAdvancedWarState(state);
  for (const e of entries) {
    const cur = state._warEconomy.huyen[e.huyenId];
    if (!cur) {
      state._warEconomy.huyen[e.huyenId] = {
        taxBase: 80 + randInt(0, 90),
        grainBase: 70 + randInt(0, 80),
        devastation: randInt(0, 10),
      };
      continue;
    }
    if (!Number.isFinite(Number(cur.taxBase))) cur.taxBase = 80 + randInt(0, 90);
    if (!Number.isFinite(Number(cur.grainBase))) cur.grainBase = 70 + randInt(0, 80);
    if (!Number.isFinite(Number(cur.devastation))) cur.devastation = 0;
    cur.devastation = Math.max(0, Math.min(100, Math.floor(cur.devastation)));
  }
}


export function updateMonthlyWarEconomyByHuyen(state, entries) {
  ensureWarEconomyByHuyen(state, entries);
  const tri = getFactionStore(state, Faction.TRIEU_DINH);
  const nq = getFactionStore(state, Faction.NGHIA_QUAN);
  if (!tri || !nq) return;
  for (const e of entries) {
    const eco = state._warEconomy.huyen[e.huyenId];
    const side = getHuyenControl(state, e.huyenId);
    const gEnemy = getHuyenGarrisonTroops(state, e.huyenId, side === Faction.NGHIA_QUAN ? Faction.TRIEU_DINH : Faction.NGHIA_QUAN);
    if (gEnemy > 0) eco.devastation = Math.min(100, eco.devastation + Math.floor(gEnemy / 180));
    else eco.devastation = Math.max(0, eco.devastation - 3);
    const rate = Math.max(0.22, 1 - eco.devastation / 120);
    const cash = Math.floor(eco.taxBase * rate);
    const grain = Math.floor(eco.grainBase * rate);
    const store = side === Faction.NGHIA_QUAN ? nq : tri;
    store.treasury = (store.treasury || 0) + cash;
    store.granary = (store.granary || 0) + grain;
  }
}


export function createWarConvoy(state, side, fromEntry, toEntry) {
  ensureAdvancedWarState(state);
  const store = getFactionStore(state, side);
  if (!store || !fromEntry || !toEntry) return null;
  const cash = Math.max(60, Math.floor((store.treasury || 0) * 0.015));
  const grain = Math.max(80, Math.floor((store.granary || 0) * 0.018));
  if (cash <= 0 || grain <= 0) return null;
  store.treasury = Math.max(0, (store.treasury || 0) - cash);
  store.granary = Math.max(0, (store.granary || 0) - grain);
  const id = `cv_${state._warLogistics.seq++}`;
  const eta = 2 + randInt(0, 3);
  const convoy = {
    id,
    side,
    from: fromEntry.huyenId,
    to: toEntry.huyenId,
    etaDays: eta,
    payloadCash: cash,
    payloadGrain: grain,
    escort: 45 + randInt(0, 90),
  };
  state._warLogistics.convoys.push(convoy);
  return convoy;
}


export function planMonthlyWarConvoys(state, entries) {
  ensureAdvancedWarState(state);
  const sides = [Faction.TRIEU_DINH, Faction.NGHIA_QUAN];
  for (const side of sides) {
    const mine = entries.filter(e => getHuyenControl(state, e.huyenId) === side);
    const enemy = entries.filter(e => getHuyenControl(state, e.huyenId) !== side);
    if (mine.length < 2 || enemy.length === 0) continue;
    const from = mine[randInt(0, mine.length - 1)];
    const to = enemy[randInt(0, enemy.length - 1)];
    const made = createWarConvoy(state, side, from, to);
    if (made && Math.random() < 0.35) {
      const toName = to.name || to.huyenId;
      const sideName = side === Faction.NGHIA_QUAN ? "Nghĩa quân" : "Triều đình";
      logLine(state, `🚚 ${sideName} mở tuyến vận lương bí mật hướng ${toName}.`, false);
    }
  }
}


export function tickWarConvoysDaily(state, entries) {
  ensureAdvancedWarState(state);
  if (!state._warLogistics.convoys.length) return;
  const alive = [];
  for (const cv of state._warLogistics.convoys) {
    cv.etaDays = Math.max(0, Math.floor((cv.etaDays || 0) - 1));
    const enemy = cv.side === Faction.NGHIA_QUAN ? Faction.TRIEU_DINH : Faction.NGHIA_QUAN;
    const toEntry = entries.find(e => e.huyenId === cv.to);
    const ambushBase = 0.13 + (toEntry && getHuyenControl(state, toEntry.huyenId) === enemy ? 0.16 : 0.04);
    const escortMitigation = Math.max(0.04, 1 - (cv.escort || 50) / 180);
    const ambushChance = Math.max(0.06, Math.min(0.65, ambushBase * escortMitigation));
    if (Math.random() < ambushChance) {
      const stolenCash = Math.floor((cv.payloadCash || 0) * (0.36 + Math.random() * 0.22));
      const stolenGrain = Math.floor((cv.payloadGrain || 0) * (0.40 + Math.random() * 0.20));
      cv.payloadCash = Math.max(0, (cv.payloadCash || 0) - stolenCash);
      cv.payloadGrain = Math.max(0, (cv.payloadGrain || 0) - stolenGrain);
      const enemyStore = getFactionStore(state, enemy);
      if (enemyStore) {
        enemyStore.treasury = (enemyStore.treasury || 0) + stolenCash;
        enemyStore.granary = (enemyStore.granary || 0) + stolenGrain;
      }
      warStatInc(state, "convoysRaided", 1);
      if (Math.random() < 0.45) logLine(state, `🗡️ Đoàn vận lương ${cv.id} bị phục kích, mất ${stolenCash}Q và ${stolenGrain} thóc.`, true);
    }
    if (cv.etaDays > 0) {
      alive.push(cv);
      continue;
    }
    const store = getFactionStore(state, cv.side);
    if (store) {
      store.treasury = (store.treasury || 0) + (cv.payloadCash || 0);
      store.granary = (store.granary || 0) + (cv.payloadGrain || 0);
      warStatInc(state, "supplyMoved", (cv.payloadCash || 0) + (cv.payloadGrain || 0));
    }
    const g = state._huyenGarrisons?.[cv.to];
    if (g && g.faction === cv.side) g.morale = Math.min(100, Math.floor((g.morale || 68) + 5));
  }
  state._warLogistics.convoys = alive;
}


export function tryMonthlyWarTruce(state) {
  ensureAdvancedWarState(state);
  if (isWarTruceActive(state)) return;
  const tri = getFactionStore(state, Faction.TRIEU_DINH);
  const nq = getFactionStore(state, Faction.NGHIA_QUAN);
  if (!tri || !nq) return;
  const bothExhausted = (tri.treasury || 0) < 65000 && (nq.treasury || 0) < 45000 && (tri.granary || 0) < 70000 && (nq.granary || 0) < 48000;
  if (!bothExhausted || Math.random() >= 0.28) return;
  state._warAi.truceUntilYm = currentYmSerial(state) + 1;
  warStatInc(state, "truceMonths", 1);
  logLine(state, "🕊️ Hai phe tạm đình chiến để chỉnh đốn quân lương. Chiến tuyến lắng xuống ngắn hạn.", true);
}


export function tickWarObjectivesMonthly(state, entries) {
  ensureAdvancedWarState(state);
  const ym = ymKey(state);
  if (state._warObjectives.lastRollYm === ym) return;
  state._warObjectives.lastRollYm = ym;
  if (!state._warObjectives.current || state._warObjectives.current.done) {
    const side = Math.random() < 0.5 ? Faction.NGHIA_QUAN : Faction.TRIEU_DINH;
    const types = ["hold_control", "strike_khuhuyen", "starve_enemy"];
    const type = types[randInt(0, types.length - 1)];
    const target = entries[randInt(0, entries.length - 1)];
    state._warObjectives.current = {
      side,
      type,
      targetHuyen: target?.huyenId || null,
      issuedYm: ym,
      dueYmSerial: currentYmSerial(state) + 2,
      done: false,
    };
  }
  const cur = state._warObjectives.current;
  if (!cur || cur.done) return;
  const side = cur.side;
  const enemy = side === Faction.NGHIA_QUAN ? Faction.TRIEU_DINH : Faction.NGHIA_QUAN;
  let ok = false;
  if (cur.type === "hold_control") {
    const stats = collectWarControlStats(state);
    const ratio = side === Faction.NGHIA_QUAN ? stats.nq / stats.total : stats.td / stats.total;
    ok = ratio >= 0.55;
  } else if (cur.type === "strike_khuhuyen") {
    ok = !!cur.targetHuyen && getHuyenControl(state, cur.targetHuyen) === side;
  } else if (cur.type === "starve_enemy") {
    const enemyStore = getFactionStore(state, enemy);
    ok = (enemyStore?.granary || 0) < 38000;
  }
  if (ok) {
    const store = getFactionStore(state, side);
    if (store) {
      store.treasury = (store.treasury || 0) + 1200;
      store.granary = (store.granary || 0) + 900;
    }
    cur.done = true;
    warStatInc(state, "objectivesDone", 1);
    const sideName = side === Faction.NGHIA_QUAN ? "Nghĩa quân" : "Triều đình";
    logLine(state, `🎯 ${sideName} hoàn thành chiến dịch trọng điểm, sĩ khí và hậu cần tăng mạnh.`, true);
  } else if (currentYmSerial(state) > (cur.dueYmSerial || 0)) {
    cur.done = true;
  }
}


export function pushYearlyWarReplay(state, prevYear) {
  const st = state._warAnnualStats || {};
  const title = `CHIẾN BÁO NIÊN GIÁM ${prevYear}`;
  const body = [
    `Trận ngã ngũ: <strong>${st.battles || 0}</strong>`,
    `Đổi cờ huyện: <strong>${st.flips || 0}</strong>`,
    `Phục kích vận lương: <strong>${st.convoysRaided || 0}</strong>`,
    `Tổng vật tư luân chuyển: <strong>${st.supplyMoved || 0}</strong>`,
    `Mệnh lệnh chiến dịch hoàn tất: <strong>${st.objectivesDone || 0}</strong>`,
  ].join("<br>");
  pushCelebration(state, title, body, "battle");
}


export function getAllWarHuyenEntries(state) {
  const out = [];
  const regions = getAllRegions();
  for (const r of regions) {
    for (const phuId of Object.keys(r.phu || {})) {
      const ph = r.phu?.[phuId];
      for (const huyenId of Object.keys(ph?.huyen || {})) {
        const h = ph.huyen?.[huyenId];
        if (!h) continue;
        out.push({
          regionId: r.id,
          phuId,
          huyenId: h.id || huyenId,
          name: h.name || huyenId,
          historicalBattle: h.historicalBattle || null,
        });
      }
    }
  }
  return out;
}


export function estimateFrontlineStrength(state, entry, faction) {
  if (!entry?.historicalBattle) return 0;
  const bs = getBattleState(state, entry.historicalBattle);
  if (!bs) return 0;
  const atkRebel = /ngh[iĩ]a|khởi|phiến|phản/i.test(String(bs.atkName || "") + " " + String(bs.atkCommander || ""));
  const defRebel = /ngh[iĩ]a|khởi|phiến|phản/i.test(String(bs.defName || "") + " " + String(bs.defCommander || ""));
  if (faction === Faction.NGHIA_QUAN) {
    if (atkRebel) return Math.max(0, Math.floor(bs.atkForce || 0));
    if (defRebel) return Math.max(0, Math.floor(bs.defForce || 0));
    return 0;
  }
  if (atkRebel) return Math.max(0, Math.floor(bs.defForce || 0));
  if (defRebel) return Math.max(0, Math.floor(bs.atkForce || 0));
  return Math.max(0, Math.floor(bs.defForce || 0));
}


export function strategicAiRecruitWarChest(state, faction) {
  const store = getFactionStore(state, faction);
  if (!store) return;
  const unrest = state.village?.unrest || 0;
  const deltaT = faction === Faction.NGHIA_QUAN ? (170 + Math.floor(unrest * 1.4)) : (260 + Math.floor((100 - unrest) * 0.9));
  const deltaG = faction === Faction.NGHIA_QUAN ? (130 + Math.floor(unrest * 0.9)) : (220 + Math.floor((100 - unrest) * 0.7));
  store.treasury = Math.max(0, (store.treasury || 0) + deltaT);
  store.granary = Math.max(0, (store.granary || 0) + deltaG);
}


export function tickStrategicWarAi(state) {
  ensureWarAiState(state);
  if (isWarTruceActive(state)) return;
  const nowAbs = totalDaysAbs(state);
  if ((state._warAi.nextDecisionAbs || 0) > nowAbs) return;
  const phase = currentWarPhase(state);
  state._warAi.phase = phase;
  const cadence = phase === "march" ? [1, 3] : phase === "clash" ? [1, 2] : phase === "mobilize" ? [2, 4] : [2, 5];
  state._warAi.nextDecisionAbs = nowAbs + randInt(cadence[0], cadence[1]);

  const entries = getAllWarHuyenEntries(state);
  if (entries.length === 0) return;
  strategicAiRecruitWarChest(state, Faction.TRIEU_DINH);
  strategicAiRecruitWarChest(state, Faction.NGHIA_QUAN);

  const order = Math.random() < 0.5
    ? [Faction.TRIEU_DINH, Faction.NGHIA_QUAN]
    : [Faction.NGHIA_QUAN, Faction.TRIEU_DINH];
  for (const side of order) {
    strategicAiReinforceWeakControl(state, side, entries);
    strategicAiTrainFieldForces(state, side);
    const didCounter = strategicAiCounterRaidPlayer(state, side, entries);
    if (!didCounter) strategicAiRaidWeakEnemy(state, side, entries);
  }
}


export function tickLiveBattles(state) {
  // Daily attrition + momentum so fronts visibly change over days.
  // Đình chiến chiến lược: làm chậm tiêu hao, không tắt hẳn mặt trận lịch sử (tránh cảm giác “đứng hình”).
  const truceMult = isWarTruceActive(state) ? 0.52 : 1.0;
  if (!state._battleSim) state._battleSim = {};
  const isRebelName = (s) => /ngh[iĩ]a|khởi|phiến|phản/i.test(String(s || ""));
  const regions = getAllRegions();
  const nowAbs = totalDaysAbs(state);
  const m = state.monthIndex || 1;
  const season = (m <= 3) ? "spring" : (m <= 6) ? "summer" : (m <= 9) ? "autumn" : "winter";
  if (!state._warLevySpent) state._warLevySpent = { strict: 0, wide: 0 };

  function getAvailableWarLevy(useWide) {
    const strictBase = Math.max(0, state.village._eligibleLevy || 0);
    const wideBase = Math.max(strictBase, state.village._eligibleLevyWide || strictBase);
    const spentStrict = Math.max(0, state._warLevySpent.strict || 0);
    const spentWide = Math.max(0, state._warLevySpent.wide || 0);
    const strictLeft = Math.max(0, strictBase - spentStrict);
    const wideLeft = Math.max(0, wideBase - spentWide);
    return useWide ? wideLeft : strictLeft;
  }

  function consumeWarLevy(amount, useWide) {
    const n = Math.max(0, Math.floor(amount));
    if (n <= 0) return 0;
    const avail = getAvailableWarLevy(useWide);
    const take = Math.min(avail, n);
    if (take <= 0) return 0;
    if (useWide) state._warLevySpent.wide = Math.max(0, (state._warLevySpent.wide || 0) + take);
    state._warLevySpent.strict = Math.max(0, (state._warLevySpent.strict || 0) + take);
    return take;
  }

  function riverNameFor(regionId) {
    // Use period-flavored names (no "claim", just naming for immersion)
    if (regionId === RegionId.THANG_LONG || regionId === RegionId.SON_NAM) return "Sông Nhị";
    if (regionId === RegionId.KINH_BAC) return "Sông Như Nguyệt";
    if (regionId === RegionId.HAI_DUONG) return "Sông Lục Đầu";
    if (regionId === RegionId.SON_TAY) return "Sông Đà";
    if (regionId === RegionId.THANH_HOA || regionId === RegionId.NGHE_AN) return "Sông Mã / Lam";
    if (regionId === RegionId.TUYEN_QUANG) return "Sông Lô";
    if (regionId === RegionId.HUNG_HOA) return "Sông Đà / Thao";
    if (regionId === RegionId.LANG_SON) return "Sông Kỳ Cùng";
    if (regionId === RegionId.THAI_NGUYEN) return "Sông Cầu";
    if (regionId === RegionId.CAO_BINH) return "Sông Bằng";
    return "Sông Cái";
  }

  for (const r of regions) {
    for (const ph of Object.values(r.phu || {})) {
      for (const h of Object.values(ph.huyen || {})) {
        const bid = h.historicalBattle;
        if (!bid) continue;
        const bs = getBattleState(state, bid);
        if (!bs) continue;

        const desc = String(bs.desc || "").toLowerCase();
        const isRoughTerrain = /đồi|núi|rừng|sơn|hiểm trở/.test(desc);
        const isRiverTerrain = /sông|cảng|bến|ven sông|thuyền/.test(desc);
        const prolonged = String(bs.result || "") === "prolonged";

        let snap = state._battleSim[bid];
        if (snap?.ended) continue; // do not restart ended fronts
        if (!snap) {
          // Initialize from current UI state
          const aQual = bs.atkQualObj?.mult || 1.0;
          const dQual = bs.defQualObj?.mult || 1.0;
          const estKn = (force, q) => Math.max(1, Math.floor((force / 1800) * (0.7 + q * 0.35)));
          state._battleSim[bid] = {
            active: true,
            atkForce: bs.atkForce,
            defForce: bs.defForce,
            thangVong: bs.thangVong,
            startAtk: Math.max(1, bs.atkForce),
            startDef: Math.max(1, bs.defForce),
            lastTickAbs: -1,
            startedAbs: nowAbs,
            daysElapsed: 0,
            winnerSide: null,
            atkQual: aQual,
            defQual: dQual,
            atkKnights: estKn(bs.atkForce, aQual),
            defKnights: estKn(bs.defForce, dQual),
            atkCmd: Math.max(1, Math.min(100, Number(bs.atkCommanderStat || 50))),
            defCmd: Math.max(1, Math.min(100, Number(bs.defCommanderStat || 50))),
            atkMorale: clamp(Math.round(58 + (bs.thangVong - 50) * 0.35 + randInt(-4, 6)), 18, 98),
            defMorale: clamp(Math.round(58 - (bs.thangVong - 50) * 0.35 + randInt(-4, 6)), 18, 98),
            atkLuong: clamp(Math.round(52 + randInt(-5, 8)), 15, 95),
            defLuong: clamp(Math.round(54 + randInt(-5, 8)), 15, 95),
            restUntilAbs: -1,
            nextOperationalPauseAbs: nowAbs + randInt(6, 10),
          };
          snap = state._battleSim[bid];
          pushBattleLedger(state, {
            battleId: bid,
            kind: "open",
            text: `${bs.name}: bắt đầu nhật ký tiền tuyến (hao quân theo ngày).`,
          });
        }
        if (!snap.active) continue;
        if (snap.lastTickAbs === nowAbs) continue;
        snap.lastTickAbs = nowAbs;
        snap.daysElapsed = (snap.daysElapsed || 0) + 1;

        let atk = Math.max(0, snap.atkForce || 0);
        let def = Math.max(0, snap.defForce || 0);
        if (atk <= 0 || def <= 0) {
          snap.active = false;
          continue;
        }

        const aQual = snap.atkQual || (bs.atkQualObj?.mult || 1.0);
        const dQual = snap.defQual || (bs.defQualObj?.mult || 1.0);
        const aKn = snap.atkKnights || 0;
        const dKn = snap.defKnights || 0;
        const aCmd = snap.atkCmd || Number(bs.atkCommanderStat || 50);
        const dCmd = snap.defCmd || Number(bs.defCommanderStat || 50);
        const aCmdMul = 0.72 + (aCmd / 100) * 0.62; // 50 -> 1.03, 75 -> 1.185
        const dCmdMul = 0.72 + (dCmd / 100) * 0.62;
        const atkExhausted = (snap.atkMorale || 60) < 24 || (snap.atkLuong || 50) < 12;
        const defExhausted = (snap.defMorale || 60) < 24 || (snap.defLuong || 50) < 12;
        const levyDry = getAvailableWarLevy(true) <= 0;
        const shouldPauseOps = nowAbs <= (snap.restUntilAbs || -1)
          || nowAbs >= (snap.nextOperationalPauseAbs || 0)
          || atkExhausted || defExhausted || levyDry;
        if (nowAbs >= (snap.nextOperationalPauseAbs || 0)) {
          snap.nextOperationalPauseAbs = nowAbs + randInt(7, 12);
          snap.restUntilAbs = nowAbs + randInt(2, 4);
        }

        if (shouldPauseOps) {
          // Operational pause: mostly skirmish/fortify/supply recovery instead of daily frontal clash.
          const skirmA = Math.max(0, Math.floor(atk * (0.0008 + Math.random() * 0.0018) * truceMult));
          const skirmD = Math.max(0, Math.floor(def * (0.0008 + Math.random() * 0.0018) * truceMult));
          atk = Math.max(0, atk - skirmA);
          def = Math.max(0, def - skirmD);
          snap.atkForce = atk;
          snap.defForce = def;
          snap.atkMorale = clamp((snap.atkMorale ?? 60) + 0.9, 8, 100);
          snap.defMorale = clamp((snap.defMorale ?? 60) + 0.9, 8, 100);
          snap.atkLuong = clamp((snap.atkLuong ?? 50) + 1.8, 4, 100);
          snap.defLuong = clamp((snap.defLuong ?? 50) + 1.8, 4, 100);
          if (Math.random() < 0.08) {
            logLine(state, `⛺ ${bs.name}: hai bên tạm ngưng giao chiến lớn để vá đội hình, gom lương và bố trí lại tuyến.`, false);
          }
          continue;
        }
        // Human-like maneuver layer:
        // - weaker side may intentionally disengage (avoid wipe)
        // - then launch short ambush if commander quality is high
        const earlyAtkPow = Math.max(1, atk * aQual * (1 + aKn * 0.035) * aCmdMul);
        const earlyDefPow = Math.max(1, def * dQual * (1 + dKn * 0.035) * dCmdMul);
        const earlyRatio = (earlyAtkPow + 1) / (earlyDefPow + 1);
        if (earlyRatio > 1.45 && dCmd >= 62 && Math.random() < 0.24) {
          const disengage = Math.max(0, Math.floor(def * (0.05 + dCmd * 0.00045)));
          def = Math.max(0, def - disengage);
          const ambushHit = Math.floor(atk * (0.008 + dCmd * 0.00012));
          atk = Math.max(0, atk - ambushHit);
          if (Math.random() < 0.28) logLine(state, `🎯 Quân thủ chủ động rút mỏng đội hình rồi phục kích hồi mã thương.`, true);
        } else if (earlyRatio < 0.68 && aCmd >= 62 && Math.random() < 0.24) {
          const disengage = Math.max(0, Math.floor(atk * (0.05 + aCmd * 0.00045)));
          atk = Math.max(0, atk - disengage);
          const ambushHit = Math.floor(def * (0.008 + aCmd * 0.00012));
          def = Math.max(0, def - ambushHit);
          if (Math.random() < 0.28) logLine(state, `🎯 Quân công giả thoái, cắt đuôi rồi đánh hồi mã.`, true);
        }

        // Rebel-side recruitment: nearby peasants join quickly, especially in summer and high unrest.
        // This is the main historical "buff" so large rebellions don't get crushed instantly.
        const atkIsRebel = isRebelName(bs.atkName) || isRebelName(bs.atkCommander);
        const defIsRebel = isRebelName(bs.defName) || isRebelName(bs.defCommander);
        const unrest = state.village.unrest || 0;
        const seasonMult = (season === "summer") ? 1.35 : (season === "spring") ? 1.15 : (season === "winter") ? 0.85 : 1.0;
        // Use eligible pool (not "take all villagers"); population continues to grow separately.
        const eligibleStrict = getAvailableWarLevy(false);
        const eligibleWide = getAvailableWarLevy(true);
        const useWide = unrest >= 65; // loạn lớn thì vét rộng (trừ trẻ em/đàn bà/già hẳn)
        const eligible = useWide ? eligibleWide : eligibleStrict;
        const baseJoin = Math.floor((eligible * (0.010 + unrest * 0.00010)) * seasonMult);
        // Big rebellions: faster swelling (quận he hiệu ứng "hô 1 cái cả xã theo")
        const bigBoost = /quận|hữu cầu|hoàng công chất|nguyễn cừ|nguyễn tuyển|danh phương/.test(desc) ? 1.6 : 1.0;
        const joinRaw = Math.max(0, Math.floor(baseJoin * bigBoost * truceMult));
        const joined = consumeWarLevy(joinRaw, useWide);
        if (atkIsRebel) atk += Math.floor(joined * 0.65);
        if (defIsRebel) def += Math.floor(joined * 0.65);

        // Ambushes in rough terrain: chance to spike losses on the stronger/elite side.
        if (isRoughTerrain && Math.random() < (0.06 + unrest * 0.0006)) {
          const atkPower0 = Math.max(1, atk * aQual * (1 + aKn * 0.035) * aCmdMul);
          const defPower0 = Math.max(1, def * dQual * (1 + dKn * 0.035) * dCmdMul);
          const strongerIsAtk = atkPower0 > defPower0;
          const hit = Math.max(1, Math.floor((strongerIsAtk ? atk : def) * (0.015 + Math.random() * 0.015) * truceMult));
          if (strongerIsAtk) atk = Math.max(0, atk - hit);
          else def = Math.max(0, def - hit);
          if (Math.random() < 0.08) logLine(state, `🌲 Phục kích địa hình hiểm: một cánh quân bị úp sọt, thiệt hại nặng.`, true);
        }

        // River warfare: more swingy, rebels can leverage numbers/rafts to bloody elites.
        if (isRiverTerrain && Math.random() < (0.05 + unrest * 0.0003)) {
          const river = riverNameFor(r.id);
          const atkPower0 = Math.max(1, atk * aQual * (1 + aKn * 0.035) * aCmdMul);
          const defPower0 = Math.max(1, def * dQual * (1 + dKn * 0.035) * dCmdMul);
          const strongerIsAtk = atkPower0 > defPower0;
          const hit = Math.max(1, Math.floor((strongerIsAtk ? atk : def) * (0.010 + Math.random() * 0.012) * truceMult));
          if (strongerIsAtk) atk = Math.max(0, atk - hit);
          else def = Math.max(0, def - hit);
          if (Math.random() < 0.12) logLine(state, `🚣 Thủy chiến trên ${river}: thuyền bè xung kích, quân tinh nhuệ cũng phải chao đảo.`, true);
        }

        // Daily casualties scale with opposing "effective power" and chaos (more chaos = more swingy)
        const chaos = (state._battleChaos?.[bid] || 0.5);
        const swing = 0.75 + chaos * 0.7; // 0.75..1.45
        const atkPower = Math.max(1, atk * aQual * (1 + aKn * 0.035) * aCmdMul);
        const defPower = Math.max(1, def * dQual * (1 + dKn * 0.035) * dCmdMul);
        let atkDmgMul = 1.0;
        let defDmgMul = 1.0;
        // If one side is massively outnumbered + low quality, force "du kích/quấy phá" behavior
        // instead of unrealistic decisive assaults by a tiny rabble stack.
        const powerRatio = (atkPower + 1) / (defPower + 1);
        if (powerRatio < 0.28 && aQual < 0.98 && atk < def * 0.45) {
          atkDmgMul = 0.58;
          defDmgMul = 1.1;
          snap.thangVong = Math.max(5, Math.min(95, Math.round((snap.thangVong || 50) - 1.1)));
          if (Math.random() < 0.06) logLine(state, "🪓 Quân công tạm rút để giữ cốt, vẫn vây quấy — không để địch nghỉ tay.", false);
        } else if (powerRatio > 3.2 && dQual < 0.98 && def < atk * 0.45) {
          defDmgMul = 0.58;
          atkDmgMul = 1.1;
          snap.thangVong = Math.max(5, Math.min(95, Math.round((snap.thangVong || 50) + 1.1)));
          if (Math.random() < 0.06) logLine(state, "🪓 Quân thủ co cụm trấn, cánh tinh nhuệ ra đánh úp để cầm chân.", false);
        }
        const dayDmg = 1.22;
        let atkLoss = Math.max(0, Math.floor((defPower * (0.0022 + Math.random() * 0.0024)) * dayDmg * swing * defDmgMul / Math.max(0.9, aQual)));
        let defLoss = Math.max(0, Math.floor((atkPower * (0.0022 + Math.random() * 0.0024)) * dayDmg * (1.6 - swing) * atkDmgMul / Math.max(0.9, dQual)));
        atkLoss = Math.max(0, Math.floor(atkLoss * truceMult));
        defLoss = Math.max(0, Math.floor(defLoss * truceMult));
        atk = Math.max(0, atk - atkLoss);
        def = Math.max(0, def - defLoss);

        // Truy kích / phản xung: thêm một lớp hao tổn ngắn, dễ “thấy” chiến sự đang chạy.
        if (Math.random() < 0.17 * truceMult && atk >= 120 && def >= 120) {
          const ap2 = Math.max(1, atk * aQual * (1 + aKn * 0.035) * aCmdMul);
          const dp2 = Math.max(1, def * dQual * (1 + dKn * 0.035) * dCmdMul);
          if (ap2 > dp2 * 1.12 && Math.random() < 0.52) {
            const cut = Math.max(1, Math.floor(def * (0.004 + Math.random() * 0.007)));
            def = Math.max(0, def - cut);
            defLoss += cut;
            if (Math.random() < 0.38) logLine(state, `🏇 ${bs.name}: thắng thế truy kích — quét thêm đuôi đội địch.`, false);
          } else if (dp2 > ap2 * 1.12 && Math.random() < 0.52) {
            const cut = Math.max(1, Math.floor(atk * (0.004 + Math.random() * 0.007)));
            atk = Math.max(0, atk - cut);
            atkLoss += cut;
            if (Math.random() < 0.38) logLine(state, "🏇 Quan quân bám đuổi — nghĩa binh rơi rụng dọc đường rút.", false);
          }
        }

        const join0 = Math.floor((joined || 0) * 0.65);
        if (join0 >= 55 && Math.random() < 0.22) {
          const side = atkIsRebel ? "nghĩa quân" : (defIsRebel ? "nghĩa quân" : "hai bên");
          logLine(state, `🥁 ${bs.name}: dân binh theo cờ ${side} +~${join0} người trong ngày.`, false);
        }

        // Momentum: if one side has clear effective advantage, tilt thangVong gradually.
        const ratio = (atkPower + 1) / (defPower + 1);
        let tilt = 0;
        if (ratio > 1.08) tilt = 1;
        else if (ratio < 0.92) tilt = -1;
        // Chaos amplifies tilt a bit
        const tilt2 = tilt === 0 ? 0 : (tilt * (0.8 + chaos * 0.8));
        snap.thangVong = Math.max(5, Math.min(95, Math.round((snap.thangVong || 50) + tilt2 * truceMult)));

        snap.atkForce = atk;
        snap.defForce = def;

        // Sĩ khí / quân lương theo ngày (gắn thiệt hại thật, không chỉ thangVong tĩnh).
        const aLossF = atkLoss / Math.max(1, snap.startAtk);
        const dLossF = defLoss / Math.max(1, snap.startDef);
        snap.atkMorale = clamp(
          (snap.atkMorale ?? 62) - aLossF * 95 - randInt(0, 1) + (dLossF > aLossF + 1e-6 ? 1.4 : 0) + (tilt > 0 ? 0.35 : 0),
          8,
          100
        );
        snap.defMorale = clamp(
          (snap.defMorale ?? 62) - dLossF * 95 - randInt(0, 1) + (aLossF > dLossF + 1e-6 ? 1.4 : 0) + (tilt < 0 ? 0.35 : 0),
          8,
          100
        );
        snap.atkLuong = clamp((snap.atkLuong ?? 54) - 0.42 - aLossF * 42 + (tilt > 0 ? 0.2 : 0), 4, 100);
        snap.defLuong = clamp((snap.defLuong ?? 54) - 0.42 - dLossF * 42 + (tilt < 0 ? 0.2 : 0), 4, 100);

        if (snap.active && snap.daysElapsed > 0 && snap.daysElapsed % 7 === 0) {
          pushBattleLedger(state, {
            battleId: bid,
            kind: "week",
            text: `${bs.name} (tuần ${Math.floor(snap.daysElapsed / 7)}): còn ~${Math.round(atk).toLocaleString()} vs ~${Math.round(def).toLocaleString()} quân; thế ${Math.round(snap.thangVong || 50)}.`,
          });
        }

        // End condition: rout can happen before annihilation.
        const atkRout = (snap.atkMorale || 60) < 16 || (snap.atkLuong || 50) < 8;
        const defRout = (snap.defMorale || 60) < 16 || (snap.defLuong || 50) < 8;
        const atkLossPct = 1 - atk / Math.max(1, snap.startAtk || 1);
        const defLossPct = 1 - def / Math.max(1, snap.startDef || 1);
        // End gating:
        // - Always require at least a few days of fighting to avoid "join once -> instant end".
        // - Only large, long-lasting rebellions (result === "prolonged") are prevented from ending before endYear.
        const minDays = prolonged ? 42 : 10;
        const daysSinceStart = nowAbs - (snap.startedAbs || nowAbs);
        const canEndByDays = daysSinceStart >= minDays;
        // Khởi nghĩa kéo dài: không cho kết sớm bằng “quét sạch” trước năm kết mục lịch sử.
        const canEndByHistory = !prolonged || (state.ban >= (Number(bs.endYear) || state.ban));
        const canEndNow = canEndByDays && canEndByHistory;
        if (canEndNow && (atkRout || defRout || atk < 120 || def < 120 || atkLossPct >= 0.75 || defLossPct >= 0.75)) {
          snap.active = false;
          snap.ended = true;
          snap.endedAtAbs = nowAbs;
          const atkWin = defRout || def <= 0 || defLossPct >= 0.75 || (snap.thangVong || 50) >= 55;
          snap.winnerSide = atkWin ? "atk" : "def";

          // Apply control: determine which side corresponds to rebels based on names
          let winnerFaction = Faction.TRIEU_DINH;
          if (snap.winnerSide === "atk") winnerFaction = atkIsRebel ? Faction.NGHIA_QUAN : Faction.TRIEU_DINH;
          else winnerFaction = defIsRebel ? Faction.NGHIA_QUAN : Faction.TRIEU_DINH;

          const capMode = winnerFaction === Faction.NGHIA_QUAN ? "insurgent" : "soft";
          setHuyenControl(state, h.id, winnerFaction, capMode);
          warStatInc(state, "battles", 1);
          warStatInc(state, "flips", 1);
          if (!state._huyenGarrisons) state._huyenGarrisons = {};
          const winForce = snap.winnerSide === "atk" ? atk : def;
          const seedQ = Math.max(40, Math.min(260, Math.floor(winForce * 0.042)));
          const prevG = state._huyenGarrisons[h.id];
          const same = prevG && prevG.faction === winnerFaction;
          state._huyenGarrisons[h.id] = {
            faction: winnerFaction,
            quan: (same ? Math.floor(prevG.quan || 0) : 0) + seedQ,
            level: same ? Math.max(1, Math.min(3, prevG.level || 1)) : 1,
            morale: Math.min(100, 66 + randInt(0, 10)),
          };
          syncHuyenBannerFromXaBalance(state, h.id);
          const routNote = (atkRout || defRout) ? " Một cánh đã vỡ trận và phải rút khỏi chính diện." : "";
          logLine(state, `🏁 KẾT THÚC: ${bs.name} ngã ngũ. ${winnerFaction === Faction.NGHIA_QUAN ? "Nghĩa quân" : "Triều đình"} giữ thế tại ${h.name || h.id} (đồn trú ~${seedQ}).${routNote}`, true);
          pushBattleLedger(state, {
            battleId: bid,
            kind: "end",
            text: `Kết trận ${bs.name}: ${winnerFaction === Faction.NGHIA_QUAN ? "Nghĩa quân" : "Triều đình"} thắng thế tại ${h.name || h.id}.`,
          });
        }
      }
    }
  }
}


export function processMonthlyWarEconomyAI(state) {
  if (!state?.factions) return;
  const tri = state.factions.trieuDinh;
  const nq = state.factions.nghiaQuan;
  if (!tri || !nq) return;
  const ym = ymKey(state);
  if (!state._warAi) state._warAi = {};
  if (state._warAi.lastWarEcoYm === ym) return;
  state._warAi.lastWarEcoYm = ym;

  // Triều đình: thiếu ngân/lương thì ép các địa phương nộp chiến phí.
  // Mức trưng thu phản ánh nền hành chính còn vận hành được.
  const triNeed = (tri.treasury || 0) < 90000 || (tri.granary || 0) < 75000;
  if (triNeed) {
    const controlled = Math.max(1, collectWarControlStats(state).td || 1);
    const taxCash = Math.floor(controlled * (170 + Math.random() * 140));
    const taxGrain = Math.floor(controlled * (120 + Math.random() * 120));
    tri.treasury = (tri.treasury || 0) + taxCash;
    tri.granary = (tri.granary || 0) + taxGrain;
    warStatInc(state, "localRequisition", taxCash + taxGrain);
    state.village.unrest = Math.min(100, (state.village.unrest || 0) + 2 + randInt(0, 3));
    logLine(state, `🏯 Triều đình phát hịch trưng thu chiến phí: +${taxCash}Q, +${taxGrain} thóc từ các nha môn địa phương.`, true);
  }

  // Nếu người chơi là quan triều đình tại nhiệm sở: có thể bị ép đóng góp tiền/lương/quân.
  ensurePostingIfNeeded(state);
  const po = getPosting(state);
  const p = state.player;
  if (!state.pendingEvent && p?.faction === Faction.TRIEU_DINH && po && postingHere(state) && Math.random() < 0.34) {
    const reqCash = Math.max(60, Math.floor((po.treasury || 0) * (0.22 + Math.random() * 0.16)));
    const reqGrain = Math.max(45, Math.floor((state.village?.khoThoc || 0) * (0.04 + Math.random() * 0.03)));
    const reqTroops = Math.max(20, Math.floor((po.garrison || 0) * (0.16 + Math.random() * 0.14)));
    state.pendingEvent = {
      id: "imperial_war_supply_order",
      title: "📜 Công văn trưng phát chiến dịch",
      narrative: `Tướng phủ gửi thư hỏa tốc: yêu cầu địa phương nộp <strong>${reqCash}Q</strong>, <strong>${reqGrain} thóc</strong> và điều <strong>${reqTroops} quân</strong> hỗ trợ mặt trận.`,
      choices: [
        { label: "Tuân chỉ, chuyển đủ ngay", impact:[{label:"Được tín nhiệm",color:"#51cf66"}], apply(s){
          const triS = s.factions?.trieuDinh;
          const poS = getPosting(s);
          if (!triS || !poS) return;
          const payCash = Math.min(reqCash, Math.max(0, poS.treasury || 0));
          const payGrain = Math.min(reqGrain, Math.max(0, s.village?.khoThoc || 0));
          const sendTroops = Math.min(reqTroops, Math.max(0, poS.garrison || 0));
          poS.treasury = Math.max(0, (poS.treasury || 0) - payCash);
          if (s.village) s.village.khoThoc = Math.max(0, (s.village.khoThoc || 0) - payGrain);
          poS.garrison = Math.max(0, (poS.garrison || 0) - sendTroops);
          triS.treasury = (triS.treasury || 0) + payCash;
          triS.granary = (triS.granary || 0) + payGrain;
          warStatInc(s, "localRequisition", payCash + payGrain);
          triS.armies = triS.armies || [];
          triS.armies.push({ id: `tri_aux_${Date.now()}_${randInt(100,999)}`, count: sendTroops, morale: 68 + randInt(0, 8), origin: poS.huyenId });
          s.player.uyTinCong = Math.min(9999, (s.player.uyTinCong || 0) + 8);
          logLine(s, `Bạn tuân chỉ, nộp ${payCash}Q + ${payGrain} thóc, điều ${sendTroops} quân ra tiền tuyến.`, true);
        }},
        { label: "Nộp một phần, xin hoãn quân", impact:[{label:"Giữ lực địa phương",color:"#ffd43b"}], apply(s){
          const triS = s.factions?.trieuDinh;
          const poS = getPosting(s);
          if (!triS || !poS) return;
          const payCash = Math.min(Math.floor(reqCash * 0.55), Math.max(0, poS.treasury || 0));
          const payGrain = Math.min(Math.floor(reqGrain * 0.55), Math.max(0, s.village?.khoThoc || 0));
          poS.treasury = Math.max(0, (poS.treasury || 0) - payCash);
          if (s.village) s.village.khoThoc = Math.max(0, (s.village.khoThoc || 0) - payGrain);
          triS.treasury = (triS.treasury || 0) + payCash;
          triS.granary = (triS.granary || 0) + payGrain;
          warStatInc(s, "localRequisition", payCash + payGrain);
          s.player.uyTinCong = Math.max(0, (s.player.uyTinCong || 0) - 6);
          logLine(s, `Bạn chỉ nộp một phần chiến phí. Triều đình ghi nhận chậm trễ quân dịch.`, true);
        }},
        { label: "Kháng lệnh, giữ kho nuôi dân", impact:[{label:"Nguy cơ truy xét",color:"#ff6b6b"}], apply(s){
          const poS = getPosting(s);
          if (!poS) return;
          s.player.uyTinCong = Math.max(0, (s.player.uyTinCong || 0) - 20);
          poS.corruption = Math.min(100, (poS.corruption || 0) + 10);
          s.village.unrest = Math.max(0, (s.village.unrest || 0) - 4);
          logLine(s, "Bạn kháng lệnh trưng phát. Dân đỡ khổ nhưng hồ sơ triều chính bắt đầu đen.", true);
        }},
      ]
    };
  }

  // Nghĩa quân: cướp vận lương + tự xoay kinh tế chiến tranh.
  const convoyRaidChance = 0.28 + Math.min(0.22, (state.village?.unrest || 0) * 0.0022);
  if (Math.random() < convoyRaidChance) {
    const raidCash = Math.max(120, Math.floor((tri.treasury || 0) * (0.008 + Math.random() * 0.008)));
    const raidGrain = Math.max(100, Math.floor((tri.granary || 0) * (0.010 + Math.random() * 0.010)));
    tri.treasury = Math.max(0, (tri.treasury || 0) - raidCash);
    tri.granary = Math.max(0, (tri.granary || 0) - raidGrain);
    nq.treasury = (nq.treasury || 0) + Math.floor(raidCash * 0.72);
    nq.granary = (nq.granary || 0) + Math.floor(raidGrain * 0.78);
    state.village.unrest = Math.min(100, (state.village.unrest || 0) + 3);
    logLine(state, `🗡️ Nghĩa quân phục kích đoàn vận lương: triều mất ${raidCash}Q và ${raidGrain} thóc.`, true);
  }

  const rebelFarm = Math.max(80, Math.floor((state.village?._eligibleLevyWide || 120) * (0.16 + Math.random() * 0.10)));
  const rebelRecruit = Math.max(30, Math.floor((state.village?.unrest || 0) * (0.6 + Math.random() * 0.5)));
  nq.granary = (nq.granary || 0) + rebelFarm;
  nq.armies = nq.armies || [];
  nq.armies.push({ id: `nq_wave_${Date.now()}_${randInt(100,999)}`, count: rebelRecruit, morale: 60 + randInt(0, 15), source: "levy" });
  if (Math.random() < 0.55) {
    logLine(state, `🌾 Nghĩa quân tự tổ chức trồng cấy & chiêu dân theo cờ: +${rebelFarm} thóc, +${rebelRecruit} quân tân mộ.`, false);
  }
}


export function collectWarControlStats(state) {
  const regions = getAllRegions();
  const ids = [];
  for (const r of regions) {
    for (const ph of Object.values(r.phu || {})) {
      for (const h of Object.values(ph.huyen || {})) ids.push(h.id);
    }
  }
  let td = 0, nq = 0;
  for (const hid of ids) {
    const c = getHuyenControl(state, hid);
    if (c === Faction.NGHIA_QUAN) nq++;
    else td++;
  }
  return { total: Math.max(1, ids.length), td, nq };
}


export function markWarFrontPulse(state) {
  state._warFrontPulseAbs = totalDaysAbs(state);
}


export function ensureWarRegionalDigestScratch(state) {
  if (!state._warRegionalScratch || typeof state._warRegionalScratch !== "object") state._warRegionalScratch = {};
}


export function recordWarRegionalIncident(state, regionId, regionName, incident) {
  if (isWarTruceActive(state)) return;
  ensureAdvancedWarState(state);
  if (!state.factions?.trieuDinh || !state.factions?.nghiaQuan) return;
  ensureWarRegionalDigestScratch(state);
  const rid = regionId || "unknown";
  const rnm = regionName || getRegion(rid)?.name || String(rid);
  if (!state._warRegionalScratch[rid]) state._warRegionalScratch[rid] = { regionName: rnm, incidents: [] };
  state._warRegionalScratch[rid].regionName = rnm;
  state._warRegionalScratch[rid].incidents.push({
    ...incident,
    ban: state.ban,
    monthIndex: state.monthIndex,
    gameDay: state.gameDay,
  });
  const arr = state._warRegionalScratch[rid].incidents;
  if (arr.length > 400) arr.splice(0, arr.length - 400);
}


export function flushWarRegionalDigestForYear(state, yearClosing) {
  ensureWarRegionalDigestScratch(state);
  const keys = Object.keys(state._warRegionalScratch);
  for (const rid of keys) {
    const pack = state._warRegionalScratch[rid];
    if (!pack?.incidents?.length) continue;
    const kept = [];
    const yearItems = [];
    for (const it of pack.incidents) {
      if (Number(it.ban) === Number(yearClosing)) yearItems.push(it);
      else kept.push(it);
    }
    pack.incidents = kept;
    if (!yearItems.length) {
      if (!kept.length) delete state._warRegionalScratch[rid];
      continue;
    }
    const nqW = yearItems.filter(i => i.winner === "nq").length;
    const tdW = yearItems.filter(i => i.winner === "td").length;
    const stale = Math.max(0, yearItems.length - nqW - tdW);
    const rtitle = pack.regionName || getRegion(rid)?.name || rid;
    const summaryPlain = `🗞️ Chiến báo năm ${yearClosing} · trấn ${rtitle} — ${yearItems.length} mũi: NQ thắng ${nqW} · TD thắng ${tdW}${stale ? ` · vật tay/chưa rõ ${stale}` : ""}. Bấm “Xem chi tiết” để đọc từng trận.`;
    logLine(state, summaryPlain, false, "chienbao", {
      logLabel: `Năm ${yearClosing}`,
      warBriefRegion: rid,
      warBriefItems: yearItems,
    });
    if (!pack.incidents.length) delete state._warRegionalScratch[rid];
  }
}


export function isRecentWarFrontPulse(state, maxDays = 48) {
  const t = state._warFrontPulseAbs;
  if (!Number.isFinite(t)) return false;
  return (totalDaysAbs(state) - t) <= maxDays;
}


export function hasRebelHeldMajorFrontHuyen(state) {
  const regions = getAllRegions();
  for (const r of regions) {
    for (const ph of Object.values(r.phu || {})) {
      for (const h of Object.values(ph.huyen || {})) {
        if (!h?.historicalBattle) continue;
        if (getHuyenControl(state, h.id) === Faction.NGHIA_QUAN) return true;
      }
    }
  }
  return false;
}


export function isWarStillRaging(state) {
  if (isRecentWarFrontPulse(state, 48)) return true;
  if (!state._battleSim) return false;
  for (const snap of Object.values(state._battleSim)) {
    if (!snap?.active) continue;
    const a = Math.max(0, snap.atkForce || 0);
    const d = Math.max(0, snap.defForce || 0);
    const lo = Math.min(a, d);
    const hi = Math.max(a, d);
    if (lo >= 85 && hi >= 200) return true;
  }
  return false;
}


export function updateWarFrontControl(state) {
  if (!state._huyenControl) state._huyenControl = {};
  const regions = getAllRegions();
  for (const r of regions) {
    for (const ph of Object.values(r.phu || {})) {
      for (const h of Object.values(ph.huyen || {})) {
        if (!h.historicalBattle) continue;
        const bs = getBattleState(state, h.historicalBattle);
        if (!bs) continue;
        // thangVong > 55: rebels dominate; <45: triều dominates; else keep previous
        const prev = state._huyenControl[h.id] || Faction.TRIEU_DINH;
        let next = prev;
        if (bs.thangVong >= 58) next = Faction.NGHIA_QUAN;
        else if (bs.thangVong <= 42) next = Faction.TRIEU_DINH;
        setHuyenControl(state, h.id, next, "soft");
      }
    }
  }
}


export function pushBattleLedger(state, entry) {
  if (!state._battleLedger) state._battleLedger = [];
  const row = {
    ban: state.ban,
    monthIndex: state.monthIndex,
    gameDay: state.gameDay,
    battleId: entry.battleId || "",
    kind: entry.kind || "note",
    text: String(entry.text || "").slice(0, 240),
  };
  state._battleLedger.unshift(row);
  if (state._battleLedger.length > 50) state._battleLedger.length = 50;
}


export function ensureBattleLedgerAndSimCompat(state) {
  if (!state) return;
  if (!Array.isArray(state._battleLedger)) state._battleLedger = [];
  if (state._battleLedger.length > 80) state._battleLedger = state._battleLedger.slice(0, 50);
  if (!state._battleSim || typeof state._battleSim !== "object") state._battleSim = {};
  for (const bid of Object.keys(state._battleSim)) {
    const snap = state._battleSim[bid];
    if (!snap || typeof snap !== "object") { delete state._battleSim[bid]; continue; }
    const th = typeof snap.thangVong === "number" ? snap.thangVong : 50;
    if (typeof snap.atkMorale !== "number") {
      snap.atkMorale = clamp(Math.round(58 + (th - 50) * 0.35), 18, 98);
    }
    if (typeof snap.defMorale !== "number") {
      snap.defMorale = clamp(Math.round(58 - (th - 50) * 0.35), 18, 98);
    }
    if (typeof snap.atkLuong !== "number") snap.atkLuong = clamp(52 + randInt(-4, 5), 15, 95);
    if (typeof snap.defLuong !== "number") snap.defLuong = clamp(54 + randInt(-4, 5), 15, 95);
    if (typeof snap.daysElapsed !== "number" || snap.daysElapsed > 1e6 || snap.daysElapsed < 0) {
      snap.daysElapsed = Math.max(0, Math.floor(Number(snap.daysElapsed) || 0));
    }
  }
  ensureWarRegionalDigestScratch(state);
}


export function getWarHudIntel(state) {
  if (!state?.player) return "";
  ensureAdvancedWarState(state);
  const p = state.player;
  const stats = collectWarControlStats(state);
  const ratioNq = Math.round((stats.nq / stats.total) * 100);
  const ratioTd = Math.round((stats.td / stats.total) * 100);
  const intel = (p.muuMeo || 0) + Math.floor((p.hocVan || 0) * 0.6);
  const phase = warPhaseLabel(currentWarPhase(state));
  const truce = isWarTruceActive(state) ? " · Đang đình chiến" : "";
  if (intel < 45) {
    const rough = ratioNq > ratioTd ? "Nghĩa quân đang nhỉnh hơn" : "Triều đình đang nhỉnh hơn";
    return `🛰️ Quân báo: ${rough} · Pha: ${phase}${truce}`;
  }
  const cv = state._warLogistics?.convoys?.length || 0;
  return `🛰️ Quân báo: Triều ${ratioTd}% · Nghĩa ${ratioNq}% · Tuyến vận lương: ${cv} · Pha: ${phase}${truce}`;
}


export function getWarCouncilBrief(state) {
  if (!state?.player) return "";
  ensureAdvancedWarState(state);
  const p = state.player;
  const side = p.faction === Faction.NGHIA_QUAN ? Faction.NGHIA_QUAN : Faction.TRIEU_DINH;
  const entries = getAllWarHuyenEntries(state);
  if (!entries.length) return "📌 Hội đồng: chờ thêm chiến báo.";
  const mine = entries.filter(e => getHuyenControl(state, e.huyenId) === side);
  const enemy = entries.filter(e => getHuyenControl(state, e.huyenId) !== side);
  const weak = mine.map(e => ({ e, s: estimateHuyenDefense(state, e, side) })).sort((a, b) => a.s - b.s)[0];
  const soft = enemy.map(e => ({ e, s: estimateHuyenDefense(state, e, side === Faction.NGHIA_QUAN ? Faction.TRIEU_DINH : Faction.NGHIA_QUAN) })).sort((a, b) => a.s - b.s)[0];
  const notes = [];
  if (weak) notes.push(`Gia cố ${weak.e.name}`);
  if (soft) notes.push(`Tập kích ${soft.e.name}`);
  const cv = state._warLogistics?.convoys?.[0];
  if (cv) notes.push(`Theo dõi vận lương ${cv.id} (${cv.etaDays} ngày)`);
  const obj = state._warObjectives?.current;
  if (obj && !obj.done) notes.push(`Mục tiêu: ${obj.type === "hold_control" ? "giữ thế kiểm soát" : obj.type === "strike_khuhuyen" ? "đánh chiếm mục tiêu" : "bóp kho lương địch"}`);
  return `📌 Hội đồng: ${notes.slice(0, 3).join(" · ")}`;
}


import {
  createInitialState, gameTick, logLine, ensureBattleLedgerAndSimCompat,
  actionCayRuong, actionKhaiThacDacSan,
  actionBuonLauMuoi, actionChatGo, actionDetVai, actionChanNuoiLon, actionNauRuou, actionCauCaSong, actionDanhBatVenBien, actionMarketHaggle, actionAcceptMarketContract, getMerchantProgress, getMarketSceneBrief, getTradeQuote, actionMoBinh, actionLuyenVo,
  actionRebelTrain, actionRebelRaidSupply, actionRebelAidPeople, actionRebelBurnYamen, actionRebelRecruitLocal,
  actionChooseClanPatron, actionDropClanPatron, actionClanMediate, actionSetClanPressureMode,
  actionPrisonerRelease, actionPrisonerExecute, actionPrisonerRansom,
  planActivity, cancelActivity, activityStatus, runPlannedActivity,
  activityBribeOpponent, activityThreatenOpponent,
  actionLocalLevy, actionLocalFund, actionLocalEmbezzle, actionRequestReinforcements,
  actionLocalRecruitMaa, actionLocalCollectTax, actionLocalPatrol, actionLocalPacify, actionLocalBribeSuperior,
  actionAssumeOfficeHere,
  actionBeginClanMission, actionAdvanceClanMissionIntel, actionExecuteClanMission,
  resolveCase,
  actionPostingBuild,
  actionXayNha, actionDemolishNha, actionTradeItem,
  actionTangRuouNPC, actionRecruitMaa, actionJoinBattle, actionAttackVillage, setWanted, checkWantedArrest, MaaDb,
  PropertyDb, PropertyCategories, RegionsDb, ItemsDb, RegionId,
  initQuestsIfNeeded, tickQuests,
  getHuyenControl, siegeHuyen, actionAssignGarrison, actionRecallGarrison, actionUpgradeGarrison,
  canPlayerCommandStrategicGarrison,
  getWarHudIntel, getWarCouncilBrief,
  isTraveling, startTravel,
  repairGeoCacheFactionFlags,
} from "./engine.js";

import { rollDailyEvent, resolveEventChoice } from "./events.js";
import {
  actionDiHoc, actionThiHuong, actionThiHoi, actionThiDinh,
  actionBacCu, actionThangTienVo, actionLuanChuyenKhaoKhoa,
  actionXinChucBoNhiem,
} from "./court.js";
import { audioManager, playSfxKey } from "./audio.js";
import {
  PerkTrees, LifestyleId, LifestyleLabel, LifestyleIcon,
  LifestyleFocusEffect, unlockPerk, setLifestyleFocus,
  getLifestyleXP, getLifestyleTier, PERK_UNLOCK_XP,
} from "./lifestyle.js";
import { getAllRegions, getRegion, getBattleState, getLowerRegions, getPhu, getHuyen, getBattleLocation, getKinhThanh } from "./map_data.js";
import { PlayerRank, RankLabel, getDynastyInfo, Faction, MenAtArmType, totalPops } from "./models.js";
import { weatherIcon } from "./weather.js";
import { inferLogCategory } from "./log.js";

try {
  if (typeof MaaDb !== 'undefined') {
    window.MaaDb = MaaDb;
  }
} catch (e) {}

window.doRecruitMaa = (id) => {
  const result = actionRecruitMaa((typeof state !== 'undefined' ? state : window.state), id);
  if (!result.ok) { window.showToast(result.msg, true); return; }
  window.showFeedback(result);
  if (typeof render === 'function') render();
  else if (typeof window.render === 'function') window.render();
};

// Save/Load: multi-slot local saves (keep compatibility with older key)
const SAVE_KEY = "bachtinh_save_v3";
const SAVE_KEY_OLD = "game_save_1737";
const SAVE_SLOT_KEY_PREFIX = "bachtinh_save_slot_";
const SAVE_SLOT_META_KEY = "bachtinh_save_slots_meta_v1";
const SAVE_ACTIVE_SLOT_KEY = "bachtinh_active_slot_v1";
const SAVE_AUTOSAVE_META_KEY_PREFIX = "bachtinh_autosave_meta_slot_";
const SAVE_AUTOSAVE_KEY_PREFIX = "bachtinh_autosave_slot_";
const SAVE_SLOT_COUNT = 8;

function getSaveSlotKey(slot) {
  const n = Math.max(1, Math.min(SAVE_SLOT_COUNT, Number(slot) || 1));
  return `${SAVE_SLOT_KEY_PREFIX}${n}`;
}
function getActiveSaveSlot() {
  const raw = Number(localStorage.getItem(SAVE_ACTIVE_SLOT_KEY) || 1);
  return Math.max(1, Math.min(SAVE_SLOT_COUNT, raw || 1));
}
function setActiveSaveSlot(slot) {
  const n = Math.max(1, Math.min(SAVE_SLOT_COUNT, Number(slot) || 1));
  localStorage.setItem(SAVE_ACTIVE_SLOT_KEY, String(n));
}
function getSaveSlotsMeta() {
  try {
    const m = JSON.parse(localStorage.getItem(SAVE_SLOT_META_KEY) || "{}");
    return (m && typeof m === "object") ? m : {};
  } catch {
    return {};
  }
}
function setSaveSlotsMeta(meta) {
  localStorage.setItem(SAVE_SLOT_META_KEY, JSON.stringify(meta || {}));
}
function formatSaveMeta(slot, meta, hasData) {
  if (!hasData) return `Slot ${slot}: Trống`;
  const nm = meta?.name ? `(${meta.name})` : "";
  const dt = meta?.savedAt ? new Date(meta.savedAt).toLocaleString("vi-VN") : "không rõ thời gian";
  const ym = (meta?.ban && meta?.monthIndex) ? ` · Năm ${meta.ban}/Tháng ${meta.monthIndex}` : "";
  return `Slot ${slot} ${nm} · Lưu lúc ${dt}${ym}`;
}
function getAutoSaveMetaKey(slot) {
  return `${SAVE_AUTOSAVE_META_KEY_PREFIX}${slot}`;
}
function getAutoSaveKey(slot, idx) {
  return `${SAVE_AUTOSAVE_KEY_PREFIX}${slot}_${idx}`;
}
function getAutoSaveMeta(slot) {
  try {
    const m = JSON.parse(localStorage.getItem(getAutoSaveMetaKey(slot)) || "{}");
    if (!m || typeof m !== "object") return { nextIdx: 0, items: [] };
    if (!Array.isArray(m.items)) m.items = [];
    if (typeof m.nextIdx !== "number") m.nextIdx = 0;
    return m;
  } catch {
    return { nextIdx: 0, items: [] };
  }
}
function setAutoSaveMeta(slot, meta) {
  localStorage.setItem(getAutoSaveMetaKey(slot), JSON.stringify(meta || { nextIdx: 0, items: [] }));
}
function writeAutoSaveSnapshot(reason = "month") {
  if (!state) return;
  const slot = getActiveSaveSlot();
  try {
    const meta = getAutoSaveMeta(slot);
    const idx = Math.max(0, Math.min(2, meta.nextIdx || 0));
    localStorage.setItem(getAutoSaveKey(slot, idx), JSON.stringify(state));
    const now = Date.now();
    meta.items = (meta.items || []).filter(x => x && x.idx !== idx);
    meta.items.push({
      idx,
      savedAt: now,
      reason,
      ban: state?.ban || 1737,
      monthIndex: state?.monthIndex || 1,
      gameDay: state?.gameDay || 1,
    });
    meta.items.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    meta.items = meta.items.slice(0, 3);
    meta.nextIdx = (idx + 1) % 3;
    setAutoSaveMeta(slot, meta);
  } catch {}
}
window.loadLatestAutoSave = () => {
  const slot = Number($("saveSlotSelect")?.value || getActiveSaveSlot());
  const meta = getAutoSaveMeta(slot);
  const latest = (meta.items || []).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))[0];
  if (!latest) { showToast("Slot này chưa có autosave.", true); return; }
  try {
    const raw = localStorage.getItem(getAutoSaveKey(slot, latest.idx));
    if (!raw) { showToast("Autosave bị thiếu dữ liệu.", true); return; }
    setActiveSaveSlot(slot);
    state = JSON.parse(raw);
    if (typeof window.__migrateLoadedState === "function") {
      window.__migrateLoadedState();
    }
    $("roleScreen").classList.add("hidden");
    $("gameRoot").classList.remove("hidden");
    initButtons();
    resetTimeToDefaultSpeed();
    if ($("chkBgm")?.checked) audioManager.unlock().then(() => audioManager.startBg()).catch(() => {});
    startGameLoop();
    render();
    showToast(`Đã nạp autosave gần nhất của Slot ${slot}.`);
  } catch {
    showToast("Nạp autosave thất bại.", true);
  }
};
function updateDifficultyUi() {
  const d = state?.difficulty || "normal";
  $("btnDifficultyEasy")?.classList.toggle("active", d === "easy");
  $("btnDifficultyNormal")?.classList.toggle("active", d === "normal");
  $("btnDifficultyHardcore")?.classList.toggle("active", d === "hardcore");
}
window.setDifficulty = (difficulty) => {
  if (!state) return;
  const d = (difficulty === "easy" || difficulty === "hardcore") ? difficulty : "normal";
  state.difficulty = d;
  updateDifficultyUi();
  showToast(`Độ khó đã đổi: ${d === "easy" ? "Dễ" : d === "hardcore" ? "Hardcore" : "Chuẩn"}`);
};
function buildVictoryProgressText() {
  if (!state?.player) return "";
  const d = state.difficulty || "normal";
  const df = d === "easy" ? 0.9 : (d === "hardcore" ? 1.14 : 1.0);
  const p = state.player;
  const regions = getAllRegions();
  const allHuyen = [];
  for (const r of regions) for (const ph of Object.values(r.phu || {})) for (const h of Object.values(ph.huyen || {})) allHuyen.push(h.id);
  let nq = 0, td = 0;
  for (const hid of allHuyen) {
    const c = getHuyenControl(state, hid);
    if (c === Faction.NGHIA_QUAN) nq++; else td++;
  }
  const total = Math.max(1, allHuyen.length);
  const ratioNq = nq / total;
  const ratioTd = td / total;
  const controlsKinhKy = getHuyenControl(state, "tho_xuong") === Faction.NGHIA_QUAN || getHuyenControl(state, "quang_duc") === Faction.NGHIA_QUAN || getHuyenControl(state, "gia_lam") === Faction.NGHIA_QUAN;
  if (p.faction === Faction.NGHIA_QUAN) {
    const needPhoLe = `${Math.round(ratioNq * 100)}%/${Math.round(0.42 * df * 100)}%`;
    const needVuong = `${p.quanSo || 0}/${Math.floor(1800 * df)}`;
    return `🏁 Tiến độ Nghĩa Quân · Đất: ${needPhoLe}${controlsKinhKy ? " · Đã áp Kinh thành" : " · Chưa áp Kinh thành"} · Quân: ${needVuong} · Danh vọng: ${p.danhVong || 0}/${Math.floor(520 * df)}`;
  }
  const highRank = [PlayerRank.HIEN_SAT_SU, PlayerRank.THUONG_THU, PlayerRank.THUA_CHINH_SU, PlayerRank.DOC_TRAN, PlayerRank.THAM_TUNG, PlayerRank.BOI_TUNG].includes(p.rank);
  return `🏁 Tiến độ Triều Đình · Đất: ${Math.round(ratioTd * 100)}%/${Math.round(0.78 * df * 100)}% · Uy tín: ${p.uyTinCong || 0}/${Math.floor(280 * df)} · Cấp quan: ${highRank ? "đủ" : "chưa đủ cao"}`;
}
window.refreshSaveSlotUi = () => {
  const select = $("saveSlotSelect");
  const metaEl = $("saveSlotMeta");
  if (!select) return;
  const meta = getSaveSlotsMeta();
  const active = getActiveSaveSlot();
  const options = [];
  for (let i = 1; i <= SAVE_SLOT_COUNT; i++) {
    const hasData = !!localStorage.getItem(getSaveSlotKey(i));
    const label = meta?.[i]?.name ? `Slot ${i} — ${meta[i].name}` : `Slot ${i}${hasData ? " — Có dữ liệu" : " — Trống"}`;
    options.push(`<option value="${i}" ${active === i ? "selected" : ""}>${label}</option>`);
  }
  select.innerHTML = options.join("");
  const hasActive = !!localStorage.getItem(getSaveSlotKey(active));
  if (metaEl) {
    const aMeta = getAutoSaveMeta(active);
    const latest = (aMeta.items || []).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))[0];
    const autoTxt = latest ? ` · AutoSave: ${new Date(latest.savedAt).toLocaleString("vi-VN")}` : " · AutoSave: chưa có";
    metaEl.textContent = formatSaveMeta(active, meta?.[active], hasActive) + autoTxt;
  }
  if ($("saveSlotNameInput")) $("saveSlotNameInput").value = meta?.[active]?.name || "";
};
window.renameSaveSlot = () => {
  const select = $("saveSlotSelect");
  const input = $("saveSlotNameInput");
  if (!select || !input) return;
  const slot = Number(select.value || getActiveSaveSlot());
  const name = String(input.value || "").trim().slice(0, 28);
  const meta = getSaveSlotsMeta();
  meta[slot] = meta[slot] || {};
  meta[slot].name = name;
  setSaveSlotsMeta(meta);
  showToast(name ? `Đổi tên Slot ${slot}: ${name}` : `Đã xóa tên Slot ${slot}`);
  window.refreshSaveSlotUi();
};
window.deleteSaveSlot = () => {
  const select = $("saveSlotSelect");
  const slot = Number(select?.value || getActiveSaveSlot());
  const ok = window.confirm(`Xóa dữ liệu Slot ${slot}? Hành động này không thể hoàn tác.`);
  if (!ok) return;
  localStorage.removeItem(getSaveSlotKey(slot));
  const meta = getSaveSlotsMeta();
  delete meta[slot];
  setSaveSlotsMeta(meta);
  showToast(`Đã xóa Slot ${slot}.`);
  window.refreshSaveSlotUi();
};

window.actionJoinBattle = (battleId, side = "def") => {
  // Must travel to the battle's huyen (no teleport participation)
  const loc = (typeof getBattleLocation === "function") ? getBattleLocation(battleId) : null;
  if (loc && state?.player?.currentHuyen && state.player.currentHuyen !== loc.huyenId) {
    const geo = getLowerRegions(state, loc.huyenId);
    const tongId = Object.keys(geo?.tong || {})[0];
    const xaId = tongId ? Object.keys(geo.tong[tongId].xa || {})[0] : null;
    const langId = xaId ? Object.keys(geo.tong[tongId].xa[xaId].lang || {})[0] : null;
    if (!tongId || !xaId || !langId) { window.showToast("Không tìm được đường tới chiến trường.", true); return; }
    state._pendingJoinBattle = { battleId, side, huyenId: loc.huyenId };
    const dest = { regionId: loc.regionId, phuId: loc.phuId, huyenId: loc.huyenId, tongId, xaId, langId };
    const res = startTravel(state, dest, `Hành quân tới chiến trường: ${loc.huyenName || loc.huyenId}`, { roadEvents: true });
    if (!res.ok) { window.showToast(res.msg || "Không thể hành quân.", true); return; }
    window.showFeedback(res);
    render();
    return;
  }

  const result = actionJoinBattle(state, battleId, side);
  if (!result.ok) { window.showToast(result.msg, true); return; }
  window.showFeedback(result);
  render();
};

window.actionAttackVillage = (langId) => {
  const focusHuyen = mapFocusHuyen || state.player.currentHuyen;
  const result = actionAttackVillage(state, langId, focusHuyen);
  if (!result.ok) {
    window.showToast(result.msg, true);
    return;
  }
  window.showFeedback(result);
  if (typeof render === 'function') render();
  else if (typeof window.render === 'function') window.render();
};


// ──────────────────────────────────────────────────
// GAME STATE
// ──────────────────────────────────────────────────
let state  = null;
let paused = false;
let speed  = 1;  // 1, 2, 3
let tickInterval = null;
const MS_PER_DAY_BASE = { 1: 1500, 2: 700, 3: 280 };
const SPEED_PROFILE_MUL = { slow: 1.35, normal: 1.0, fast: 0.72 };
let logFilterMode = "all";
let _lastHudHeavyRenderAt = 0;
let _warMiniMapCells = [];

function syncTimeUi() {
  if ($("btnPause")) $("btnPause").textContent = paused ? "▶" : "⏸";
  if ($("timeStatus")) $("timeStatus").textContent = paused ? "DỪNG" : `x${speed}`;
  document.querySelectorAll(".speed-btn").forEach((b, i) => {
    b.classList.toggle("active", !paused && speed === (i + 1));
  });
}

function resetTimeToDefaultSpeed() {
  paused = false;
  speed = 1;
  setIntervalSpeed(speed);
  syncTimeUi();
}

// ──────────────────────────────────────────────────
// UTILS
// ──────────────────────────────────────────────────
const $ = id => document.getElementById(id);
function setText(id, val) { const el = $(id); if (el) el.textContent = val; }
function clamp(n, a, b)   { return Math.max(a, Math.min(b, n)); }
function randInt(a, b)     { return a + Math.floor(Math.random() * (b - a + 1)); }

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showFeedback(results) {
  if (!results?.feedback) return;
  const bar = document.querySelector(".hud-center");
  if (!bar) return;
  const el = document.createElement("div");
  el.className = "feedback-pop";
  el.innerHTML = results.feedback.map(f =>
    `<span style="color:${f.tone === "good" ? "#88e88d" : f.tone === "bad" ? "#f87171" : "#a0a0a0"}">${f.text}</span>`
  ).join(" ");
  bar.appendChild(el);
  setTimeout(() => el.remove(), 1800);
}

function showToast(msg, isError = false) {
  const t = document.createElement("div");
  t.className = "game-toast" + (isError ? " error" : "");
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add("show"), 30);
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 400); }, 2800);
}
// Expose feedback helpers early for inline/global callers.
// Some action wrappers call window.showFeedback/window.showToast.
window.showToast = (msg, isError = false) => showToast(msg, isError);
window.showFeedback = (results) => showFeedback(results);

// ──────────────────────────────────────────────────
// CHARACTER CREATION — Data & UI (đặt sớm: HTML dùng onclick="window.selectGender…"
// phải có hàm ngay khi module bắt đầu chạy; nếu lỗi ở giữa file thì trước đây chưa kịp gán window.*)
// ──────────────────────────────────────────────────
const PERSONALITY_TRAITS = [
  { id:"tiet_kiem",  name:"Tiết Kiệm 💰",      effect:"Chi tiêu ít hơn 20%.",                   apply(p){ p._traitTietKiem=true; } },
  { id:"hao_phong",  name:"Hào Phóng 🎁",      effect:"Cho/tặng +30% uy tín. Chi phí cao hơn.", apply(p){ p._traitHaoPhong=true; } },
  { id:"dung_cam",   name:"Dũng Cảm ⚔️",       effect:"+10 Võ Thuật. Roll chiến đấu +15%.",      apply(p){ p.voThuat=Math.min(100,p.voThuat+10); p._traitDungCam=true; } },
  { id:"than_trong", name:"Thận Trọng 🛡️",     effect:"Event tiêu cực giảm 20%.",                apply(p){ p._traitThanTrong=true; } },
  { id:"tham_vong",  name:"Tham Vọng 🏆",      effect:"+15% tốc độ thăng chức.",                 apply(p){ p._traitThamVong=true; } },
  { id:"gian_xao",   name:"Gian Xảo 🦊",       effect:"+10 Mưu Mẹo. Roll lừa đảo +10%.",        apply(p){ p.muuMeo=Math.min(100,p.muuMeo+10); p._traitGianXao=true; } },
  { id:"cham_chi",   name:"Chăm Chỉ 🌾",       effect:"Sản xuất, khai thác +25%.",               apply(p){ p._traitChamChi=true; } },
  { id:"hao_hoa",    name:"Hào Hoa 🌸",         effect:"+10 Ngoại Giao. NPC dễ cảm tình hơn.",  apply(p){ p.ngoaiGiao=Math.min(100,p.ngoaiGiao+10); p._traitHaoHoa=true; } },
  { id:"trung_nghia",name:"Trung Nghĩa 🤝",    effect:"+20 uy tín dân ban đầu.",                  apply(p){ p.uyTinCong+=20; p._traitTrungNghia=true; } },
  { id:"a_dao",      name:"Ăn Chơi 🍷",         effect:"Dễ sa đà tửu sắc: event 'giải khuây' mạnh hơn nhưng rủi ro cũng cao.", apply(p){ p._traitADao=true; } },
];

const BIRTH_TRAITS = [
  { id:"dep_trai",     name:"Đẹp Trai/Xinh Gái 💎", effect:"NPC cảm tình +15. Hôn nhân dễ hơn.",      apply(p){ p._birthDepTrai=true; p.ngoaiGiao=Math.min(100,p.ngoaiGiao+5); } },
  { id:"thien_tai",    name:"Thiên Tài 📚",           effect:"Học Vấn +15. Học nhanh hơn 50%.",         apply(p){ p._birthThienTai=true; p.hocVan=Math.min(100,p.hocVan+15); } },
  { id:"cuong_trang",  name:"Cường Tráng 💪",         effect:"Võ Thuật +10. Thể lực tối đa 120.",       apply(p){ p._birthCuongTrang=true; p.voThuat=Math.min(100,p.voThuat+10); p.theLuc=120; } },
  { id:"con_nha_giau", name:"Con Nhà Giàu 🏠",        effect:"+150 quan và +30 thóc ban đầu.",           apply(p){ p._birthConNhaGiau=true; p.tien+=150; p.thocCaNhan+=30; } },
  { id:"ban_han",      name:"Bần Hàn 🪨",             effect:"-5 quan nhưng +30 uy tín dân.",            apply(p){ p._birthBanHan=true; p.tien=Math.max(0,p.tien-5); p.uyTinCong+=30; } },
  { id:"ky_tuong",     name:"Kỳ Tướng 🗡️",           effect:"Quản Lý +10. Tuyển quân rẻ hơn 15%.",    apply(p){ p._birthKyTuong=true; p.quanLy=Math.min(100,p.quanLy+10); } },
  { id:"thien_y",      name:"Thiên Y 🌿",             effect:"Hồi thể lực nhanh gấp đôi. Ít ốm.",       apply(p){ p._birthThienY=true; } },
  { id:"linh_cam",     name:"Linh Cảm 🔮",            effect:"Mưu Mẹo +8. Cảnh báo event nguy hiểm.",   apply(p){ p._birthLinhCam=true; p.muuMeo=Math.min(100,p.muuMeo+8); } },
];

let _ccGender = "nam";
let _ccTraits  = new Set();
let _ccBirth   = null;

window.selectGender = (g) => {
  _ccGender = g;
  $("btnGenderMale")?.classList.toggle("active",   g === "nam");
  $("btnGenderFemale")?.classList.toggle("active", g === "nu");
};

function renderTraitGrid() {
  const grid = $("traitGrid");
  if (!grid) return;
  grid.innerHTML = PERSONALITY_TRAITS.map(t => {
    const sel = _ccTraits.has(t.id);
    const dis = !sel && _ccTraits.size >= 2;
    return `<div class="cc-trait-card ${sel?"selected":""} ${dis?"disabled-trait":""}"
                 onclick="window.toggleTrait('${t.id}')">
      <div class="cc-trait-name">${t.name}</div>
      <div class="cc-trait-effect">${t.effect}</div>
    </div>`;
  }).join("");
}
function renderBirthTraitGrid() {
  const grid = $("birthTraitGrid");
  if (!grid) return;
  grid.innerHTML = BIRTH_TRAITS.map(t => {
    const sel = _ccBirth === t.id;
    return `<div class="cc-trait-card ${sel?"selected":""}"
                 onclick="window.selectBirth('${t.id}')">
      <div class="cc-trait-name">${t.name}</div>
      <div class="cc-trait-effect">${t.effect}</div>
    </div>`;
  }).join("");
}

window.toggleTrait  = (id) => { if(_ccTraits.has(id)){_ccTraits.delete(id);}else if(_ccTraits.size<2){_ccTraits.add(id);} renderTraitGrid(); };
window.selectBirth  = (id) => { _ccBirth = _ccBirth===id ? null : id; renderBirthTraitGrid(); };

function initCharacterCreationUi() {
  renderTraitGrid();
  renderBirthTraitGrid();
}

function bindCharacterCreationEvents() {
  $("btnStartGame")?.addEventListener("click", () => {
  const nameInput = $("inputPlayerName");
  const roleScreen = $("roleScreen");
  const gameRoot = $("gameRoot");
  if (!nameInput || !roleScreen || !gameRoot) {
    showToast("Thiếu thành phần giao diện khởi động. Vui lòng tải lại trang.", true);
    return;
  }

  try {
    const name = nameInput.value.trim() || "Dân Đen";
    state = createInitialState(name);
    ensureUxState();
    ensureActionModeState();
    state.uxFirstPlay = true;

    // Áp dụng giới tính
    state.player.gender = _ccGender;

    // Safety check stats
    const pInfo = state.player;
    if (typeof pInfo.voThuat === "undefined") pInfo.voThuat = 10;
    if (typeof pInfo.ngoaiGiao === "undefined") pInfo.ngoaiGiao = 5;
    if (typeof pInfo.quanLy === "undefined") pInfo.quanLy = 5;
    if (typeof pInfo.muuMeo === "undefined") pInfo.muuMeo = 5;
    if (typeof pInfo.hocVan === "undefined") pInfo.hocVan = 5;

    // Áp dụng tính cách (tối đa 2)
    state.player.traits = [..._ccTraits];
    for (const tid of _ccTraits) {
      const t = PERSONALITY_TRAITS.find(x => x.id === tid);
      if (t) t.apply(state.player);
    }

    // Áp dụng đặc điểm bẩm sinh (1 cái)
    if (_ccBirth) {
      state.player.birthTrait = _ccBirth;
      const bt = BIRTH_TRAITS.find(x => x.id === _ccBirth);
      if (bt) bt.apply(state.player);
    }

    roleScreen.classList.add("hidden");
    gameRoot.classList.remove("hidden");
    initButtons();
    resetTimeToDefaultSpeed();
    render();
    startGameLoop();

    audioManager.unlock().then(() => {
      audioManager.startBg();
    }).catch(() => {});

    if (state.uxFirstPlay && state.firstRun) {
      setTimeout(openTutorial, 800);
      state.firstRun = false;
    }
  } catch (err) {
    showToast("Lỗi khi khởi tạo ván mới. Vui lòng tải lại và thử lại.", true);
    logLine("Lỗi khởi tạo game: " + (err?.message || String(err)), "sukien");
    console.error("[boot/start-game-error]", err);
  }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initCharacterCreationUi();
    bindCharacterCreationEvents();
  }, { once: true });
} else {
  initCharacterCreationUi();
  bindCharacterCreationEvents();
}

function applyPerformanceModeUi() {
  const perf = !!state?.performanceMode;
  document.body.classList.toggle("perf-mode", perf);
  if ($("chkPerfMode")) $("chkPerfMode").checked = perf;
}

function updateThemeInkUi() {
  const ink = state?.themeInkMode === "bold" ? "bold" : "soft";
  $("btnThemeInkSoft")?.classList.toggle("active", ink === "soft");
  $("btnThemeInkBold")?.classList.toggle("active", ink === "bold");
}

function applyThemeInkMode() {
  const ink = state?.themeInkMode === "bold" ? "bold" : "soft";
  document.body.classList.toggle("theme-ink-bold", ink === "bold");
  document.body.classList.toggle("theme-ink-soft", ink !== "bold");
  updateThemeInkUi();
}

window.setThemeInkMode = (mode) => {
  if (!state) return;
  const m = mode === "bold" ? "bold" : "soft";
  state.themeInkMode = m;
  applyThemeInkMode();
  showToast(m === "bold" ? "Đã bật Cổ Họa Đậm: nét mực/sepia rõ hơn." : "Đã về Cổ Họa Mềm.");
};

function updateUiUxModeUi() {
  const mode = state?.uiUxMode === "strategic" ? "strategic" : "newbie";
  $("btnUxModeNewbie")?.classList.toggle("active", mode === "newbie");
  $("btnUxModeStrategic")?.classList.toggle("active", mode === "strategic");
}

function applyUiUxMode() {
  const mode = state?.uiUxMode === "strategic" ? "strategic" : "newbie";
  document.body.classList.toggle("ux-newbie", mode === "newbie");
  document.body.classList.toggle("ux-strategic", mode === "strategic");
  updateUiUxModeUi();
  if (mode === "newbie" && state?.uiActionMode === "advanced") {
    // In newbie mode keep default action density lower.
    state.uiActionMode = "basic";
  }
}

window.setUiUxMode = (mode) => {
  if (!state) return;
  const m = mode === "strategic" ? "strategic" : "newbie";
  state.uiUxMode = m;
  applyUiUxMode();
  renderActionMode();
  showToast(m === "strategic" ? "Đã chuyển Strategic UI: mở đầy đủ bảng chiến lược." : "Đã chuyển Newbie UI: ẩn bớt bảng nặng, ưu tiên dễ chơi.");
};

function warDashboardMetrics() {
  const p = state?.player;
  if (!p) return null;
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
    if (c === Faction.NGHIA_QUAN) nq++; else td++;
  }
  const total = Math.max(1, ids.length);
  const side = p.faction === Faction.NGHIA_QUAN ? Faction.NGHIA_QUAN : Faction.TRIEU_DINH;
  const ownRatio = side === Faction.NGHIA_QUAN ? Math.round((nq / total) * 100) : Math.round((td / total) * 100);
  const enemyRatio = side === Faction.NGHIA_QUAN ? Math.round((td / total) * 100) : Math.round((nq / total) * 100);
  return {
    ownRatio,
    enemyRatio,
    money: p.tien || 0,
    army: p.quanSo || 0,
    unrest: state?.village?.unrest || 0,
  };
}

function isWarUiUnlocked() {
  const p = state?.player;
  if (!p) return false;
  if (p.faction === Faction.NGHIA_QUAN) return true; // vào vai nghĩa quân thì cần chiến báo ngay
  if ((p.quanSo || 0) >= 180) return true;            // có thực lực quân sự tối thiểu
  if (p.rank && p.rank !== PlayerRank.DAN_THUONG) return true; // đã có phẩm hàm/chức vị
  return false;
}

function buildPriorityActions() {
  const p = state?.player;
  if (!p) return [];
  const risk = computeRiskForecast();
  const isRebel = p.faction === Faction.NGHIA_QUAN;
  const actions = [];
  if ((p.theLuc || 0) <= 30) actions.push({ key: "rest", title: "Hồi Thể Lực", desc: "Nghỉ để tránh hụt nhịp hành động." });
  if (risk.label === "Cao") actions.push({ key: "stabilize", title: "Hạ Rủi Ro", desc: "Giảm bất ổn và hạ xác suất biến cố xấu." });
  if ((p.tien || 0) < 120) actions.push({ key: "money", title: "Bơm Ngân Quỹ", desc: "Ưu tiên hành động kiếm tiền nhanh." });
  if ((p.quanSo || 0) < 250) actions.push({ key: "recruit", title: "Bổ Sung Quân", desc: "Mộ thêm quân để giữ thế chiến trường." });
  actions.push({ key: isRebel ? "raid" : "map", title: isRebel ? "Tập Kích Hậu Cần" : "Kiểm Soát Bản Đồ", desc: isRebel ? "Cướp lương, bào mòn địch." : "Xem điểm nóng rồi điều quân." });
  return actions.slice(0, 3);
}

function renderBattleLedgerPanel() {
  const el = $("battleLedgerPanel");
  if (!el || !state) return;
  if (!isWarUiUnlocked()) {
    el.innerHTML = "";
    return;
  }
  const active = [];
  for (const [bid, snap] of Object.entries(state._battleSim || {})) {
    if (!snap?.active) continue;
    const bs = getBattleState(state, bid);
    active.push({ bid, name: (bs?.name || bid).slice(0, 42) });
  }
  const chips = active.length
    ? `<div class="battle-ledger-chips">${active.map(({ bid, name }) => `
      <button type="button" class="battle-ledger-chip" onclick='window.focusBattleOnMap(${JSON.stringify(bid)})'>${escapeHtml(name)}</button>
    `).join("")}</div>`
    : `<p class="muted battle-ledger-empty">Hiện không có mặt trận đang mở — nhật ký vẫn ghi các sự kiện gần đây.</p>`;

  const ledger = Array.isArray(state._battleLedger) ? state._battleLedger : [];
  const rows = ledger.slice(0, 18).map((row) => {
    const t = `Ngày ${row.gameDay}/${row.monthIndex}/${row.ban}`;
    const pin = row.battleId
      ? `<button type="button" class="battle-ledger-pin" title="Mở bản đồ tới huyện" aria-label="Định vị" onclick='window.focusBattleOnMap(${JSON.stringify(row.battleId)})'>📍</button>`
      : "";
    return `<div class="battle-ledger-row">${pin}<div class="battle-ledger-body"><span class="battle-ledger-meta">${escapeHtml(t)}</span><span class="battle-ledger-text">${escapeHtml(row.text || "")}</span></div></div>`;
  }).join("");

  el.innerHTML = `
    <h5 class="battle-ledger-title">📜 Nhật ký tiền tuyến</h5>
    <p class="muted battle-ledger-hint">Mặt trận đang diễn ra (bấm chip hoặc 📍 để nhảy bản đồ).</p>
    ${chips}
    <div class="battle-ledger-list">${rows || '<p class="muted">Chưa có mục nhật ký.</p>'}</div>
  `;
}

function renderWarMiniMap() {
  const canvas = $("warMiniMapCanvas");
  if (!canvas || !state?.player) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#100b07";
  ctx.fillRect(0, 0, w, h);

  const allHuyen = [];
  const regions = getAllRegions();
  for (const r of regions) for (const ph of Object.values(r.phu || {})) for (const hy of Object.values(ph.huyen || {})) allHuyen.push(hy.id);
  if (allHuyen.length === 0) return;
  allHuyen.sort();
  const cols = Math.max(10, Math.min(22, Math.ceil(Math.sqrt(allHuyen.length * 1.8))));
  const rows = Math.ceil(allHuyen.length / cols);
  const pad = 4;
  const gap = 2;
  const cellW = Math.max(3, Math.floor((w - pad * 2 - (cols - 1) * gap) / cols));
  const cellH = Math.max(3, Math.floor((h - pad * 2 - (rows - 1) * gap) / rows));

  const hotHuyen = new Set();
  for (const [bid, snap] of Object.entries(state._battleSim || {})) {
    if (!snap?.active) continue;
    const loc = getBattleLocation(bid);
    if (loc?.huyenId) hotHuyen.add(loc.huyenId);
  }
  const meHid = state.player.currentHuyen;
  _warMiniMapCells = [];
  allHuyen.forEach((hid, idx) => {
    const r = Math.floor(idx / cols);
    const c = idx % cols;
    const x = pad + c * (cellW + gap);
    const y = pad + r * (cellH + gap);
    const side = getHuyenControl(state, hid);
    ctx.fillStyle = side === Faction.NGHIA_QUAN ? "#9f4433" : "#3f678f";
    ctx.fillRect(x, y, cellW, cellH);
    if (hotHuyen.has(hid)) {
      ctx.strokeStyle = "#f59f00";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, Math.max(1, cellW - 1), Math.max(1, cellH - 1));
    }
    if (hid === meHid) {
      ctx.fillStyle = "#f5d980";
      const cx = x + Math.floor(cellW / 2);
      const cy = y + Math.floor(cellH / 2);
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1.5, Math.min(cellW, cellH) / 3), 0, Math.PI * 2);
      ctx.fill();
    }
    _warMiniMapCells.push({ hid, x, y, w: cellW, h: cellH, hot: hotHuyen.has(hid) });
  });
}

function findHuyenLocation(huyenId) {
  const regions = getAllRegions();
  for (const r of regions) {
    for (const [phuId, ph] of Object.entries(r.phu || {})) {
      if (ph?.huyen?.[huyenId]) return { regionId: r.id, phuId, huyenId };
    }
  }
  return null;
}

window.focusMapToHuyen = (huyenId) => {
  const loc = findHuyenLocation(huyenId);
  if (!loc) { showToast("Không xác định được huyện mục tiêu.", true); return; }
  mapLevel = "huyen";
  mapFocusTran = loc.regionId;
  mapFocusPhu = loc.phuId;
  mapFocusHuyen = loc.huyenId;
  openTab("tabMap", { markSeen: true });
  renderMap();
};

window.focusBattleOnMap = (battleId) => {
  const loc = getBattleLocation(battleId);
  if (!loc?.huyenId) {
    showToast("Không tìm thấy mặt trận trên bản đồ.", true);
    return;
  }
  window.focusMapToHuyen(loc.huyenId);
};

window.runPriorityAction = (key) => {
  const click = (id) => {
    const el = $(id);
    if (!el || el.disabled || el.classList.contains("hidden")) return false;
    el.click();
    return true;
  };
  if (key === "rest") {
    if (!click("btnNghi")) showToast("Hiện chưa có hành động nghỉ khả dụng, hãy giảm tốc và tránh hao thể lực.", true);
    return;
  }
  if (key === "stabilize") {
    if (!click("btnRebelAid") && !click("btnTiec")) openTab("tabSociety", { markSeen: true });
    return;
  }
  if (key === "money") {
    if (!click("btnKhaiThac") && !click("btnBuonMuoi")) openTab("tabMarket", { markSeen: true });
    return;
  }
  if (key === "recruit") {
    if (!click("btnRebelRecruit") && !click("btnMoBinh")) openTab("tabActions", { markSeen: true });
    return;
  }
  if (key === "raid") {
    if (!click("btnRebelRaid")) openTab("tabMap", { markSeen: true });
    return;
  }
  if (key === "map") {
    openTab("tabMap", { markSeen: true });
  }
};

function computeRiskForecast() {
  if (!state) return { score: 0, label: "Thấp", reasons: [] };
  const p = state.player || {};
  const reasons = [];
  let score = 0;
  if ((state.village?.unrest || 0) >= 70) { score += 35; reasons.push("Bất ổn làng cao"); }
  else if ((state.village?.unrest || 0) >= 45) { score += 18; reasons.push("Bất ổn đang tăng"); }
  if ((p.wantedLevel || 0) >= 2) { score += 18; reasons.push("Đang bị truy nã"); }
  if ((p.theLuc || 0) < 25) { score += 12; reasons.push("Thể lực thấp"); }
  const hostileClans = (state.village?.clanIds || []).filter(cid => {
    const c = state.clans?.find(x => x.id === cid);
    const favor = state.clanFavor?.[cid] || 0;
    return c && (favor < -20 || c.attitude === "Thù ghét" || c.attitude === "hostile");
  }).length;
  if (hostileClans > 0) { score += 12 + hostileClans * 4; reasons.push(`Có ${hostileClans} dòng họ thù địch`); }
  const label = score >= 45 ? "Cao" : (score >= 24 ? "Trung bình" : "Thấp");
  return { score, label, reasons };
}

function buildMonthlySummary(prev) {
  const p = state?.player;
  if (!p || !prev) return null;
  const deltaMoney = p.tien - prev.money;
  const deltaGrain = p.thocCaNhan - prev.grain;
  const deltaRep = p.uyTinCong - prev.rep;
  const risk = computeRiskForecast();
  const moneyTone = deltaMoney >= 0 ? "+" : "";
  const grainTone = deltaGrain >= 0 ? "+" : "";
  const repTone = deltaRep >= 0 ? "+" : "";
  const econ = summarizeMonthlyEconomy(prev.logCount || 0);
  const econRows = econ.length
    ? `<div style="margin-top:6px;font-size:0.8rem;color:var(--text-muted);">${econ.map(x => `• ${escapeHtml(x)}`).join("<br>")}</div>`
    : "";
  const body = [
    `<div><strong class="gold-text">Tổng kết tháng ${prev.month}/${prev.year}</strong></div>`,
    `<div style="margin-top:6px;">Tiền: <strong>${moneyTone}${deltaMoney}</strong> · Thóc: <strong>${grainTone}${deltaGrain}</strong> · Uy tín: <strong>${repTone}${deltaRep}</strong></div>`,
    `<div style="margin-top:6px;">Rủi ro tháng mới: <strong>${risk.label}</strong>${risk.reasons.length ? ` (${escapeHtml(risk.reasons[0])})` : ""}</div>`,
    econRows,
  ].join("");
  return { title: "BÁO CÁO THÁNG", body, sfx: "coin" };
}

function summarizeMonthlyEconomy(prevLogCount) {
  const logs = state?.log || [];
  const newCount = Math.max(0, logs.length - prevLogCount);
  if (newCount <= 0) return [];
  const lines = logs.slice(0, newCount);
  let levy = 0;
  let retaliation = 0;
  let marketGain = 0;
  let otherLoss = 0;
  for (const e of lines) {
    const t = String(e?.text || "");
    const m = t.match(/mất (\d+)Q|mất (\d+) quan|thu tô.*?(\d+)Q|thu bảo kê.*?(\d+)Q|thu (\d+)Q|(\+?\d+) quan/gi);
    const amt = m ? m.reduce((s, chunk) => {
      const n = Number((chunk.match(/\d+/) || [0])[0]);
      return s + (Number.isFinite(n) ? n : 0);
    }, 0) : 0;
    if (/tô ngầm|bảo kê/.test(t)) levy += amt;
    else if (/trả đũa|hậu quả trễ/.test(t)) retaliation += amt;
    else if (/buôn|chợ|bán|giao dịch|thu về/.test(t)) marketGain += amt;
    else if (/mất|phạt|đút lót/.test(t)) otherLoss += amt;
  }
  const rows = [];
  if (levy > 0) rows.push(`Nộp tô/bảo kê ước tính: ${levy}Q`);
  if (retaliation > 0) rows.push(`Thiệt hại trả đũa ước tính: ${retaliation}Q`);
  if (marketGain > 0) rows.push(`Dòng tiền chợ/buôn ước tính: ${marketGain}Q`);
  if (otherLoss > 0) rows.push(`Chi phí/phạt khác ước tính: ${otherLoss}Q`);
  return rows.slice(0, 3);
}

function gameOverReportText() {
  if (!state?.player) return "";
  const p = state.player;
  const years = Math.max(0, (state.ban || 1737) - 1737);
  const mainStats = `Sống ${years} năm · Tuổi ${p.age} · Danh vọng ${p.danhVong || 0} · Uy tín ${p.uyTinCong || 0}`;
  const assets = `Tài sản cuối: ${p.tien || 0}Q, ${p.thocCaNhan || 0} thóc, ${p.quanSo || 0} quân`;
  return `${mainStats}. ${assets}.`;
}

function ensureUxState() {
  if (!state) return;
  if (!state.uiSeenTabs) {
    state.uiSeenTabs = { tabActions: true };
  } else if (!state.uiSeenTabs.tabActions) {
    state.uiSeenTabs.tabActions = true;
  }
  if (!state.onboarding) {
    state.onboarding = {
      firstResourceActionDone: false,
      firstTradeDone: false,
      firstTravelDone: false,
      firstFocusDone: false,
    };
  }
  if (!state._uxHintsSeen) state._uxHintsSeen = {};
  if (!("uxFirstPlay" in state)) state.uxFirstPlay = !!state.firstRun;
  if (!state.clanFavor) state.clanFavor = {};
  if (!state._delayedEffects) state._delayedEffects = [];
  if (!("speedProfile" in state)) state.speedProfile = "normal";
  if (!("performanceMode" in state)) state.performanceMode = false;
}

function isUxAssistEnabled() {
  return !!state?.uxFirstPlay;
}

function completeFirstPlayUx() {
  if (!state || !state.uxFirstPlay) return;
  state.uxFirstPlay = false;
  state.tutorial = state.tutorial || { completed: false, track: null, step: 0 };
  state.tutorial.completed = true;
  state._uxHintsSeen = {};
  updateTabDiscoverabilityUi();
}

function onboardingCoreDone() {
  if (!state) return false;
  ensureUxState();
  const ob = state.onboarding || {};
  const seen = state.uiSeenTabs || {};
  return !!(seen.tabMarket && ob.firstTradeDone && seen.tabMap && ob.firstTravelDone && ob.firstFocusDone);
}

function showFirstTabCoach(tabId) {
  if (!state) return;
  if (!isUxAssistEnabled()) return;
  ensureUxState();
  const k = `coach_${tabId}`;
  if (state._uxHintsSeen[k]) return;
  state._uxHintsSeen[k] = true;
  if (tabId === "tabMarket") showToast("Mẹo Chợ: thử mua/bán số lượng 1 trước, rồi tăng dần theo vốn.");
  if (tabId === "tabMap") showToast("Mẹo Bản Đồ: đi theo thứ tự Trấn -> Phủ -> Huyện -> Tổng/Xã/Làng để điều quân.");
  if (tabId === "tabLifestyle") showToast("Mẹo Lối Sống: chọn 1 focus sớm để tích XP đúng hướng.");
  if (tabId === "tabSociety") showToast("Mẹo Xã Hội: dân mới nên xin bảo trợ 1 dòng họ để giảm bị bóp sinh kế.");
}

function markTabSeen(tabId) {
  if (!state || !tabId) return;
  ensureUxState();
  state.uiSeenTabs[tabId] = true;
  updateTabDiscoverabilityUi();
}

function openTab(targetId, opts = {}) {
  const { markSeen = true } = opts;
  if (!targetId) return;
  const firstOpen = !!(state && !state.uiSeenTabs?.[targetId]);
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.add("hidden"));
  const btn = Array.from(document.querySelectorAll(".tab-btn")).find(b => b.dataset.target === targetId);
  if (btn) btn.classList.add("active");
  requestAnimationFrame(() => {
    try {
      btn?.scrollIntoView?.({ inline: "nearest", block: "nearest", behavior: "smooth" });
    } catch (_) {
      btn?.scrollIntoView?.({ inline: "nearest", block: "nearest" });
    }
  });
  const panel = $(targetId);
  panel?.classList.remove("hidden");
  if (markSeen) markTabSeen(targetId);
  if (targetId === "tabMap") renderMap();
  if (targetId === "tabLog") renderLog();
  updateTabDiscoverabilityUi();
  if (firstOpen) showFirstTabCoach(targetId);
}
window.openTab = openTab;

function updateTabDiscoverabilityUi() {
  const nav = document.querySelector(".nav-tabs");
  if (!nav) return;
  const scroller = document.getElementById("navTabsScroll") || nav;
  if (state) ensureUxState();
  const seen = state?.uiSeenTabs || {};
  const enabled = isUxAssistEnabled();
  const importantTabs = ["tabMarket", "tabMap", "tabLifestyle", "tabSociety"];
  document.querySelectorAll(".tab-btn").forEach(btn => {
    const target = btn.dataset.target;
    const shouldNew = enabled && importantTabs.includes(target) && !seen[target];
    btn.classList.toggle("is-new", !!shouldNew);
  });
  const collapsed = nav.classList.contains("nav-tabs--collapsed");
  const overflow = !collapsed && scroller.scrollWidth > scroller.clientWidth + 4;
  nav.classList.toggle("has-overflow", overflow);
  nav.classList.toggle("at-start", !overflow || scroller.scrollLeft <= 2);
  nav.classList.toggle("at-end", !overflow || (scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 2));
  const prev = document.getElementById("btnNavTabsPrev");
  const next = document.getElementById("btnNavTabsNext");
  if (prev) {
    const show = overflow && !collapsed && scroller.scrollLeft > 2;
    prev.hidden = !show;
    prev.setAttribute("aria-hidden", show ? "false" : "true");
  }
  if (next) {
    const show = overflow && !collapsed && (scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 2);
    next.hidden = !show;
    next.setAttribute("aria-hidden", show ? "false" : "true");
  }
}

function pushContextHint(key, msg) {
  if (!state) return;
  if (!isUxAssistEnabled()) return;
  ensureUxState();
  if (state._uxHintsSeen[key]) return;
  state._uxHintsSeen[key] = true;
  showToast(msg);
}

// ──────────────────────────────────────────────────
// TICKER / MARQUEE
// ──────────────────────────────────────────────────
let tickerQueue = [];
let tickerRunning = false;

function showTicker(text) {
  tickerQueue.push(text);
  if (!tickerRunning) runNextTicker();
}

function runNextTicker() {
  if (tickerQueue.length === 0) {
    tickerRunning = false;
    $("newsTicker").classList.add("hidden");
    return;
  }
  tickerRunning = true;
  const text = tickerQueue.shift();
  const tickerEl = $("newsTicker");
  const textEl   = $("tickerText");
  textEl.textContent = text;
  tickerEl.classList.remove("hidden");
  // Animate width → wait enough → next
  textEl.style.animation = "none";
  tickerEl.offsetHeight; // reflow
  textEl.style.animation = "";
  setTimeout(runNextTicker, 6000);
}

// ──────────────────────────────────────────────────
// RENDER
// ──────────────────────────────────────────────────
function render() {
  if (!state) return;
  ensureUxState();
  applyPerformanceModeUi();
  applyThemeInkMode();
  applyUiUxMode();
  ensureActionModeState();
  if (!state._huyenGarrisons) state._huyenGarrisons = {};
  const p = state.player;

  // Header stats
  setText("playerName",    p.ten);
  setText("playerMoney",   p.tien);
  setText("playerThoc",    p.thocCaNhan);
  setText("playerHp",      (typeof p.hp === "number" ? p.hp : 100));
  setText("playerStamina", p.theLuc);
  let maaTxt = (p.maa && p.maa.length > 0) ? ` (+${p.maa.length} đạo)` : "";
  setText("playerBinhQuyen", `${p.quanSo}${maaTxt}`);
  setText("playerUyTin",   p.uyTinCong);
  setText("playerRankBadge", RankLabel[p.rank] || p.rank);
  const wBadge = $("playerWantedBadge");
  if (wBadge) {
    if (p.wantedLevel > 0) {
      wBadge.classList.remove("hidden");
      wBadge.textContent = `🚨 TRUY NÃ Mức ${p.wantedLevel}`;
      wBadge.style.cursor = "pointer";
      wBadge.setAttribute("title", `Đang bị truy nã mức ${p.wantedLevel}. Mức càng cao càng dễ bị bắt, bị cấm thi cử/chính danh và gặp tuần binh gắt hơn.`);
    } else {
      wBadge.classList.add("hidden");
    }
  }
  const dBadge = $("delayedWarningBadge");
  if (dBadge) {
    const n = state._delayedEffects?.length || 0;
    if (n > 0) {
      dBadge.classList.remove("hidden");
      dBadge.textContent = `⏱ HẬU QUẢ TREO: ${n}`;
      dBadge.style.cursor = "pointer";
      dBadge.setAttribute("title", "Có hậu quả trễ/ân tình chưa đến hạn xử lý. Bấm để xem chi tiết.");
    } else {
      dBadge.classList.add("hidden");
    }
  }

  // Time
  setText("currentDate", `Ngày ${state.gameDay} · Tháng ${state.monthIndex} · Năm ${state.ban}`);
  const forecast = state._weatherForecast ? ` · Tháng tới: ${weatherIcon(state._weatherForecast)} ${state._weatherForecast}` : "";
  $("weatherLine").textContent = `Tình hình: ${weatherIcon(state.thoiTiet)} ${state.thoiTiet}${forecast}`;
  if (state.travel?.active) {
    const d = state.travel.dest;
    const destTxt = d?.huyenId ? `Hành quân: còn ${state.travel.daysLeft} ngày` : `Hành quân`;
    $("weatherLine").textContent = `${destTxt} — ${weatherIcon(state.thoiTiet)} ${state.thoiTiet}${forecast}`;
  }
  const riskLine = $("riskForecastLine");
  if (riskLine) {
    const risk = computeRiskForecast();
    const reason = risk.reasons[0] ? ` · ${risk.reasons[0]}` : "";
    riskLine.textContent = `⚠️ Dự báo rủi ro: ${risk.label}${reason}`;
    riskLine.style.color = risk.label === "Cao" ? "#f87171" : (risk.label === "Trung bình" ? "#d6a75a" : "var(--text-dim)");
  }
  const victoryLine = $("victoryProgressLine");
  if (victoryLine) {
    victoryLine.textContent = isWarUiUnlocked() ? buildVictoryProgressText() : "";
  }
  const warIntelLine = $("warIntelLine");
  if (warIntelLine) {
    warIntelLine.textContent = isWarUiUnlocked() ? getWarHudIntel(state) : "";
  }
  const warCouncilLine = $("warCouncilLine");
  if (warCouncilLine) {
    warCouncilLine.textContent = isWarUiUnlocked() ? getWarCouncilBrief(state) : "";
  }
  $("warCommandDeck")?.classList.toggle("hidden", !isWarUiUnlocked());
  const nowMs = Date.now();
  const shouldHeavyRefresh = isWarUiUnlocked() && (!state.performanceMode || (nowMs - _lastHudHeavyRenderAt >= 380));
  if (shouldHeavyRefresh) {
    _lastHudHeavyRenderAt = nowMs;
    renderWarMiniMap();
    const metrics = warDashboardMetrics();
    const cardsEl = $("warDashboardCards");
    if (cardsEl && metrics) {
      cardsEl.innerHTML = `
        <div class="war-kpi-card"><div class="war-kpi-label">Kiểm soát phe ta</div><div class="war-kpi-value">${metrics.ownRatio}%</div></div>
        <div class="war-kpi-card"><div class="war-kpi-label">Kiểm soát phe địch</div><div class="war-kpi-value">${metrics.enemyRatio}%</div></div>
        <div class="war-kpi-card"><div class="war-kpi-label">Ngân quỹ cá nhân</div><div class="war-kpi-value">${metrics.money}Q</div></div>
        <div class="war-kpi-card"><div class="war-kpi-label">Binh lực hiện hữu</div><div class="war-kpi-value">${metrics.army}</div></div>
      `;
    }
    const priorityEl = $("actionPriorityBar");
    if (priorityEl) {
      const picks = buildPriorityActions();
      priorityEl.innerHTML = picks.map(pick => `
        <button type="button" class="priority-btn" onclick="window.runPriorityAction('${pick.key}')">
          <div class="priority-title">${escapeHtml(pick.title)}</div>
          <div class="priority-desc">${escapeHtml(pick.desc)}</div>
        </button>
      `).join("");
    }
  }
  if (isWarUiUnlocked()) renderBattleLedgerPanel();

  // Activity HUD & modal pulse
  const a = activityStatus(state);
  if (a?.active) {
    if (a.phase === "waiting") {
      const pin = a.venueShort ? ` · 📍 ${a.venueShort}` : "";
      $("weatherLine").textContent = `Kỳ ${a.title}: còn ${fmtDaysToMonths(a.daysToStart)}${pin} — ${weatherIcon(state.thoiTiet)} ${state.thoiTiet}${forecast}`;
    } else if (a.phase === "travel") {
      $("weatherLine").textContent = `Đi ${a.title} — ${weatherIcon(state.thoiTiet)} ${state.thoiTiet}${forecast}`;
    }
    // Engine sets phase "ready" + _activityUiPulse when start date is reached; "running" only exists
    // briefly inside runPlannedActivity — so we must pulse on "ready" or the modal never opens.
    if ((state._activityUiPulse || 0) > 0 && a.phase === "ready") {
      state._activityUiPulse = 0;
      openActivityReadyGate();
    }
  }

  if (state?._pendingExamResultModal && !$("activityModal")?.classList.contains("open")) {
    const pay = state._pendingExamResultModal;
    state._pendingExamResultModal = null;
    setTimeout(() => {
      try { openVanExamFinalResultModal(pay); } catch {}
    }, 100);
  }

  const schedEl = $("activityScheduleLine");
  if (schedEl) {
    if (a?.active) {
      const d = Math.max(0, Math.floor(a.daysToStart ?? 0));
      let line = "";
      if (a.phase === "waiting" && d > 0) line = `📅 ${a.title}: còn ${fmtDaysToMonths(d)} đến kỳ${a.venueShort ? ` · 📍 ${a.venueShort}` : ""}`;
      else if (a.phase === "waiting") line = `📅 ${a.title}: sắp khai mạc${a.venueShort ? ` · 📍 ${a.venueShort}` : ""}`;
      else if (a.phase === "travel") line = `📅 Đang đi đường — ${a.title}`;
      else if (a.phase === "ready") line = `📅 ${a.title}: vào sân / đài (bấm để mở)`;
      else if (a.phase === "running") line = `📅 ${a.title}: đang thi đấu`;
      else if (a.phase === "returning") line = `📅 ${a.title}: hồi hương chờ kết quả`;
      else if (a.phase === "await_result") line = `📅 ${a.title}: chờ chiếu bảng`;
      else line = `📅 ${a.title}`;
      schedEl.textContent = line;
      if (a.phase === "ready") {
        schedEl.style.cursor = "pointer";
        schedEl.title = "Mở hộp thoại khai mạc — Vào cuộc";
        schedEl.onclick = () => openActivityReadyGate();
      } else {
        schedEl.style.cursor = "";
        schedEl.title = "";
        schedEl.onclick = null;
      }
    } else {
      const bits = [];
      if (state?.lastBacCuArchive?.report) {
        const arc = state.lastBacCuArchive;
        bits.push(`<span role="button" class="gold-text" style="cursor:pointer;text-decoration:underline;" title="Biên bản Bác Cử đã lưu" onclick="window.openBacCuArchiveViewer()">🥊 Bác Cử (T${arc.monthIndex}/${arc.ban})</span>`);
      }
      if (state?.lastVanExamArchive?.report) {
        const v = state.lastVanExamArchive;
        bits.push(`<span role="button" class="gold-text" style="cursor:pointer;text-decoration:underline;" title="Biên bản khoa cử đã lưu" onclick="window.openVanExamArchiveViewer()">📜 Thi văn (T${v.monthIndex}/${v.ban})</span>`);
      }
      if (bits.length) {
        schedEl.innerHTML = bits.join('<span class="muted"> · </span>');
        schedEl.style.cursor = "default";
        schedEl.title = "";
        schedEl.onclick = null;
      } else {
        schedEl.textContent = "";
        schedEl.innerHTML = "";
        schedEl.style.cursor = "";
        schedEl.title = "";
        schedEl.onclick = null;
      }
    }
  }

  const progress = ((state.gameDay - 1) / 29) * 100;
  $("monthProgressFill").style.width = progress + "%";

  // Region name
  const tranObj = getRegion(p.currentRegion);
  let geoTextArgs = [];
  if (p.currentLang) geoTextArgs.push(state._geoCache?.[p.currentHuyen]?.tong?.[p.currentTong]?.xa?.[p.currentXa]?.lang?.[p.currentLang]?.name || `Làng ${p.currentLang}`);
  if (p.currentXa) geoTextArgs.push(state._geoCache?.[p.currentHuyen]?.tong?.[p.currentTong]?.xa?.[p.currentXa]?.name || `Xã ${p.currentXa}`);
  if (p.currentTong) geoTextArgs.push(state._geoCache?.[p.currentHuyen]?.tong?.[p.currentTong]?.name || `Tổng ${p.currentTong}`);
  if (p.currentHuyen) {
    const h = getHuyen(p.currentRegion, p.currentPhu, p.currentHuyen);
    geoTextArgs.push(h?.name || `Huyện ${p.currentHuyen}`);
  }
  if (p.currentPhu) {
    const phuObj = getPhu(p.currentRegion, p.currentPhu);
    geoTextArgs.push(phuObj?.name || `Phủ ${p.currentPhu}`);
  }
  geoTextArgs.push(tranObj?.name || p.currentRegion);

  setText("currentRegionNameStr", geoTextArgs.join(" ➔ "));
  setText("marketRegionStr",      `${geoTextArgs[geoTextArgs.length-2] || ""} — ${geoTextArgs[geoTextArgs.length-1] || ""}`);


  // Profile tab
  setText("statDip", p.ngoaiGiao);
  setText("statMar", p.voThuat);
  setText("statSte", p.quanLy);
  setText("statInt", p.muuMeo);
  setText("statLea", p.hocVan);
  $("statDip")?.setAttribute("title", "Ngoại giao: tăng tỉ lệ dàn hòa, thương lượng, hạ nhiệt xung đột.");
  $("statMar")?.setAttribute("title", "Võ thuật: tăng sức chiến đấu, áp lực khi uy hiếp.");
  $("statSte")?.setAttribute("title", "Quản lý: tối ưu kinh tế, giảm hao hụt và tăng hiệu suất.");
  $("statInt")?.setAttribute("title", "Mưu mẹo: tăng do thám, phi vụ kín, lách rủi ro.");
  $("statLea")?.setAttribute("title", "Học vấn: mở đường khoa cử và các quyết sách cao cấp.");
  $("barDip").style.width = p.ngoaiGiao + "%";
  $("barMar").style.width = p.voThuat + "%";
  $("barSte").style.width = p.quanLy + "%";
  $("barInt").style.width = p.muuMeo + "%";
  $("barLea").style.width = p.hocVan + "%";

  setText("playerHocVi",       p.hocVi || "Vô Danh");
  setText("playerUyTinProfile", p.uyTinCong);
  setText("playerAge",         p.age);
  setText("playerDanhVong",    p.danhVong);
  setText("playerFaction",     p.faction === Faction.NGHIA_QUAN ? "Nghĩa Quân" :
                                p.faction === Faction.CUOP ? "Cướp Đường" : "Dân Triều Đình");

  // Replace action blocks when rebel (avoid "activities banned" boredom)
  const normalBlocks = $("normalActionBlocks");
  const rebelBlocks = $("rebelActionBlocks");
  if (normalBlocks && rebelBlocks) {
    const isRebel = p.faction === Faction.NGHIA_QUAN;
    normalBlocks.classList.toggle("hidden", isRebel);
    rebelBlocks.classList.toggle("hidden", !isRebel);
  }

  // Vợ/chồng theo giới tính player
  const spouseLabel = (p.gender === "nu") ? "Chồng" : "Vợ/Chồng";
  let familyText = "Đơn độc";
  if (p.giaDinh?.vo) {
    const conText = (p.giaDinh?.con > 0) ? ` · ${p.giaDinh.con} con` : "";
    familyText = `${spouseLabel}: ${p.giaDinh.vo}${conText}`;
  } else if (p.rank !== PlayerRank.DAN_THUONG) {
    familyText = "Chưa thành gia thất";
  }
  setText("playerFamily", familyText);

  // Hiển thị traits & birth trait trong profile
  const traitsEl = $("playerTraitTags");
  if (traitsEl) {
    const allTraits = typeof PERSONALITY_TRAITS !== "undefined" ? PERSONALITY_TRAITS : [];
    const allBirth  = typeof BIRTH_TRAITS !== "undefined" ? BIRTH_TRAITS : [];
    const genderBadge = `<span class="trait-tag">${p.gender === "nu" ? "👩 Nữ Nhân" : "👨 Nam Nhân"}</span>`;
    const traitTags = (p.traits || []).map(tid => {
      const t = allTraits.find(x => x.id === tid);
      return t ? `<span class="trait-tag">${t.name}</span>` : "";
    }).join("");
    const birthTag = p.birthTrait ? (() => {
      const bt = allBirth.find(x => x.id === p.birthTrait);
      return bt ? `<span class="trait-tag birth">${bt.name}</span>` : "";
    })() : "";
    traitsEl.innerHTML = genderBadge + traitTags + birthTag || "<span style='color:var(--text-dim);font-size:0.8rem;'>Không có đặc điểm</span>";
  }

  // Dynasty info
  const dynEl = $("dynastyInfo");
  if (dynEl) {
    const dyn = getDynastyInfo(state.ban);
    dynEl.innerHTML = `
      <div>🤴 <strong class="gold-text">Vua Lê:</strong> ${dyn.vua}</div>
      <div>⚜️ <strong class="gold-text">Chúa Trịnh:</strong> ${dyn.chua}</div>
    `;
  }

  // Sick banner
  const sickBanner = $("sickBanner");
  if (p.dangOm) {
    sickBanner.textContent = "⚠️ Đang Ốm Liệt Giường — Không thể hành động!";
    sickBanner.classList.remove("hidden");
  } else {
    sickBanner.classList.add("hidden");
  }

  // Low stamina visual flash
  if (p.theLuc <= 20) {
    $("playerStamina").style.color = "#f87171";
  } else {
    $("playerStamina").style.color = "";
  }

  // Low hp visual flash
  const hpEl = $("playerHp");
  if (hpEl) {
    if ((p.hp ?? 100) <= 30) hpEl.style.color = "#f87171";
    else hpEl.style.color = "";
  }

  if (state.uiShakeProfile) {
    const badge = $("playerRankBadge");
    badge.classList.add("shake");
    setTimeout(() => badge.classList.remove("shake"), 600);
    state.uiShakeProfile = false;
  }

  // Game over
  const govBanner = $("gameOverBanner");
  if (state.gameOver) {
    govBanner.classList.remove("hidden");
    const lead = state.gameOverType === "win" ? "🏆" : "⚰️";
    setText("gameOverText", `${lead} ${state.gameOverReason || "Cuộc đời đã kết thúc."}`);
    setText("gameOverReport", gameOverReportText());
    setIntervalSpeed(0);
    return;
  } else {
    govBanner.classList.add("hidden");
    setText("gameOverReport", "");
  }

  // Society tab
  setText("villageName",   state.village.name);
  setText("villageUnrest", state.village.unrest);
  setText("villageDinh",   totalPops(state.village));
  setText("villageGrain",  state.village.khoThoc);
  setText("villageFund",   state.village.quyLang);
  $("unrestBar").style.width = clamp(state.village.unrest, 0, 100) + "%";
  $("unrestBar").style.background = state.village.unrest > 60 ? "var(--danger-red)" :
                                    state.village.unrest > 35 ? "#c17f24" : "#3a7c32";

  // Log tab — only update if dirty
  if (state.logDirty) {
    renderLog();
    state.logDirty = false;
  }

  // Quests
  renderQuests();
  renderOnboardingGuide();

  // Market
  renderMarket();

  // Actions visibility
  renderPoliticsButtons();
  renderActionMode();
  updateActionSoftLocks();

  // Properties
  renderProperties();

  // Officials + clans
  renderOfficialsAndClans();
  renderPostingPanel();

  // Lifestyle
  renderLifestyle();
  updateTabDiscoverabilityUi();
  updateSpeedPresetUi();
  updateDifficultyUi();

  // Contextual hints to guide first 10 minutes
  if (isUxAssistEnabled() && !state.uiSeenTabs?.tabMarket && p.tien >= 25) {
    pushContextHint("hint_open_market", "Bạn đã có vốn. Mở tab Chợ để mua/bán và xoay vòng tài nguyên.");
  }
  if (isUxAssistEnabled() && state.uiSeenTabs?.tabMarket && !state.onboarding?.firstTradeDone) {
    pushContextHint("hint_first_trade", "Thử mua/bán 1 món ở Chợ để mở vòng lợi nhuận.");
  }
  if (isUxAssistEnabled() && !state.uiSeenTabs?.tabMap && p.theLuc >= 35) {
    pushContextHint("hint_open_map", "Bạn đủ thể lực để di chuyển. Mở tab Bản Đồ để hành quân.");
  }
  if (isUxAssistEnabled() && !state.onboarding?.firstFocusDone && (p.lifestylePoints || 0) >= 1) {
    pushContextHint("hint_open_lifestyle", "Bạn đã có điểm perk. Mở tab Lối Sống để chọn trọng tâm.");
  }
  if (isUxAssistEnabled() && onboardingCoreDone()) {
    completeFirstPlayUx();
  }

  // Marquee queue
  while (state.marqueeQueue && state.marqueeQueue.length > 0) {
    showTicker(state.marqueeQueue.shift());
  }

  // Celebrations queue (quests, major milestones, etc.)
  drainCelebrations();

  // Market header
  setText("mktTien", p.tien);
  setText("mktThoc", p.thocCaNhan);

  refreshMapBattlePanelIfVisible();
}

function renderOnboardingGuide() {
  const box = $("onboardingGuide");
  if (!box || !state) return;
  if (!isUxAssistEnabled()) {
    box.innerHTML = "";
    box.classList.add("hidden");
    return;
  }
  box.classList.remove("hidden");
  ensureUxState();
  const seen = state.uiSeenTabs || {};
  const ob = state.onboarding || {};
  const tasks = [
    {
      ok: !!state.onboarding?.firstResourceActionDone,
      label: "Làm 1 hành động sinh kế đầu tiên",
      cta: `<button class="btn-tiny" onclick="window.quickStartEconomy()">Làm ngay</button>`,
    },
    {
      ok: !!seen.tabMarket,
      label: "Mở tab Chợ",
      cta: `<button class="btn-tiny" onclick="window.openTab('tabMarket')">Mở Chợ</button>`,
    },
    {
      ok: !!ob.firstTradeDone,
      label: "Mua hoặc bán 1 món ở Chợ",
      cta: `<button class="btn-tiny" onclick="window.openTab('tabMarket')">Đi giao dịch</button>`,
    },
    {
      ok: !!seen.tabMap,
      label: "Mở tab Bản Đồ",
      cta: `<button class="btn-tiny" onclick="window.openTab('tabMap')">Mở Bản Đồ</button>`,
    },
    {
      ok: !!ob.firstTravelDone,
      label: "Hành quân 1 lần trên bản đồ",
      cta: `<button class="btn-tiny" onclick="window.openTab('tabMap')">Đi hành quân</button>`,
    },
    {
      ok: !!ob.firstFocusDone,
      label: "Chọn trọng tâm ở tab Lối Sống",
      cta: `<button class="btn-tiny" onclick="window.openTab('tabLifestyle')">Chọn Lối Sống</button>`,
    },
    {
      ok: !!seen.tabSociety,
      label: "Mở tab Xã Hội để xem dòng họ",
      cta: `<button class="btn-tiny" onclick="window.openTab('tabSociety')">Mở Xã Hội</button>`,
    },
    {
      ok: !!state.player?._patronClanId,
      label: "Xin bảo trợ 1 dòng họ để giảm rủi ro đầu game",
      cta: `<button class="btn-tiny" onclick="window.openTab('tabSociety')">Tìm họ bảo kê</button>`,
    },
  ];
  const next = tasks.find(t => !t.ok);
  const doneCount = tasks.filter(t => t.ok).length;
  const rows = tasks.map(t =>
    `<div class="onboard-row ${t.ok ? "done" : ""}">
      <span>${t.ok ? "✓" : "○"} ${escapeHtml(t.label)}</span>
      ${t.ok ? "" : t.cta}
    </div>`
  ).join("");
  const advHint = onboardingCoreDone() && state.uiActionMode === "basic"
    ? `<div class="muted" style="font-size:0.76rem;margin-top:6px;">Bạn đã xong onboarding cơ bản. Có thể chuyển sang <button class="btn-tiny" onclick="window.setActionMode('advanced')">Lối Chơi Nâng Cao</button></div>`
    : "";
  box.innerHTML = `
    <div class="onboard-head">
      <strong class="gold-text">Bước tiếp theo cho người mới</strong>
      <span class="muted" style="font-size:0.76rem;">${doneCount}/${tasks.length}</span>
    </div>
    <div class="onboard-list">${rows}</div>
    <div class="muted" style="font-size:0.76rem;margin-top:6px;">
      ${next ? `Ưu tiên: ${escapeHtml(next.label)}` : "Bạn đã nắm xong onboarding cơ bản."}
    </div>
    <div class="muted" style="font-size:0.74rem;margin-top:6px;">
      Mẹo: Dân đen có họ chống lưng sẽ đỡ bị bóp sinh kế, nhưng phải chịu tô ngầm mỗi tháng.
    </div>
    ${advHint}
  `;
}

function ensureActionModeState() {
  if (!state) return;
  if (!state.uiActionMode) state.uiActionMode = "basic";
}

function setActionMode(mode) {
  if (!state) return;
  ensureActionModeState();
  state.uiActionMode = mode === "advanced" ? "advanced" : "basic";
  renderActionMode();
}
window.setActionMode = setActionMode;

function renderActionMode() {
  if (!state) return;
  ensureActionModeState();
  const isAdvanced = state.uiActionMode === "advanced";
  $("btnModeBasic")?.classList.toggle("active", !isAdvanced);
  $("btnModeAdvanced")?.classList.toggle("active", isAdvanced);
  document.querySelectorAll("[data-action-tier='basic']").forEach(el => {
    if (isAdvanced) el.classList.add("ux-tier-hidden");
    else el.classList.remove("ux-tier-hidden");
  });
  document.querySelectorAll("[data-action-tier='advanced']").forEach(el => {
    if (isAdvanced) el.classList.remove("ux-tier-hidden");
    else el.classList.add("ux-tier-hidden");
  });
}

function setSoftLock(selector, reason) {
  const el = document.querySelector(selector);
  applySoftLock(el, reason);
}

function applySoftLock(el, reason) {
  if (!el) return;
  const locked = !!reason;
  el.classList.toggle("soft-locked", locked);
  if (locked) {
    el.dataset.lockReason = reason;
    el.setAttribute("title", reason);
    el.setAttribute("aria-disabled", "true");
  } else {
    delete el.dataset.lockReason;
    el.removeAttribute("title");
    el.removeAttribute("aria-disabled");
  }
}

function updateActionSoftLocks() {
  if (!state) return;
  const p = state.player;
  const inJail = (state.jailDays || 0) > 0;
  const traveling = !!(isTraveling && isTraveling(state));
  const blockedByGlobal = inJail ? "Đang bị giam." : (traveling ? "Đang hành quân." : "");

  const lockCay = blockedByGlobal || (p.faction === Faction.NGHIA_QUAN ? "Nghĩa quân không cày ruộng như dân thường." : (p.dangOm ? "Đang ốm liệt giường." : (p.theLuc < 20 ? "Cần 20 thể lực." : "")));
  const lockKhai = blockedByGlobal || (p.faction === Faction.NGHIA_QUAN ? "Nghĩa quân không khai thác kiểu dân thường." : (p.theLuc < 25 ? "Cần 25 thể lực." : ""));
  const lockChatGo = blockedByGlobal || (p.faction === Faction.NGHIA_QUAN ? "Nghĩa quân không làm lâm nghiệp dân sự." : (p.dangOm ? "Đang ốm liệt giường." : (p.theLuc < 22 ? "Cần 22 thể lực." : "")));
  const lockDetVai = blockedByGlobal || (p.faction === Faction.NGHIA_QUAN ? "Nghĩa quân không dệt vải dân sự lúc này." : (p.dangOm ? "Đang ốm liệt giường." : (p.theLuc < 20 ? "Cần 20 thể lực." : "")));
  const riverRegions = [RegionId.THANG_LONG, RegionId.SON_NAM, RegionId.HAI_DUONG, RegionId.SON_TAY, RegionId.KINH_BAC, RegionId.THANH_HOA, RegionId.NGHE_AN, RegionId.TUYEN_QUANG];
  const coastRegions = [RegionId.AN_QUANG, RegionId.HAI_DUONG];
  const lockCauCa = blockedByGlobal || (p.faction === Faction.NGHIA_QUAN ? "Nghĩa quân không câu cá dân sinh lúc này." : (p.dangOm ? "Đang ốm liệt giường." : (p.theLuc < 16 ? "Cần 16 thể lực." : (!riverRegions.includes(p.currentRegion) ? "Vùng này không thuận câu cá sông." : ""))));
  const lockDanhBat = blockedByGlobal || (p.faction === Faction.NGHIA_QUAN ? "Nghĩa quân không đánh bắt dân sự lúc này." : (p.dangOm ? "Đang ốm liệt giường." : (p.theLuc < 24 ? "Cần 24 thể lực." : (!coastRegions.includes(p.currentRegion) ? "Phải ở vùng ven biển." : ""))));
  const lockChanNuoi = blockedByGlobal || (p.faction === Faction.NGHIA_QUAN ? "Nghĩa quân không chăn nuôi dân sự lúc này." : (p.dangOm ? "Đang ốm liệt giường." : (p.theLuc < 18 ? "Cần 18 thể lực." : (p.tien < 8 ? "Cần 8 quan vốn." : ""))));
  const lockNauRuou = blockedByGlobal || (p.faction === Faction.NGHIA_QUAN ? "Nghĩa quân không mở lò rượu dân sự." : (p.dangOm ? "Đang ốm liệt giường." : (p.theLuc < 16 ? "Cần 16 thể lực." : ((p.thocCaNhan || 0) < 2 ? "Cần 2 thóc." : ""))));
  const lockBuon = blockedByGlobal || (p.faction === Faction.NGHIA_QUAN ? "Nghĩa quân không buôn muối." : (p.dangOm ? "Đang ốm." : (p.tien < 10 ? "Cần 10 quan vốn." : "")));
  const lockVo = blockedByGlobal || (p.faction === Faction.NGHIA_QUAN ? "Nghĩa quân không luyện ở võ đường triều đình." : (p.theLuc < 30 ? "Cần 30 thể lực." : (p.tien < 3 ? "Cần 3 quan." : "")));
  const suatDinhRanh = Math.floor((totalPops(state.village) || 0) / 5) - (state.village?.drafted || 0);
  const lockMoBinh = blockedByGlobal || (p.faction === Faction.NGHIA_QUAN ? "Hãy dùng mục mộ binh của Nghĩa Quân." : (p.tien < 30 ? "Cần 30 quan." : (p.thocCaNhan < 20 ? "Cần 20 thóc." : (suatDinhRanh < 10 ? `Không đủ suất đinh (còn ${suatDinhRanh}).` : ""))));
  const lockRebel = blockedByGlobal || (p.quanSo < 50 ? "Cần ít nhất 50 quân để dựng cờ tự trị." : "");

  setSoftLock("#btnCay", lockCay);
  setSoftLock("#btnKhaiThac", lockKhai);
  setSoftLock("#btnChatGo", lockChatGo);
  setSoftLock("#btnDetVai", lockDetVai);
  setSoftLock("#btnCauCa", lockCauCa);
  setSoftLock("#btnDanhBat", lockDanhBat);
  setSoftLock("#btnChanNuoi", lockChanNuoi);
  setSoftLock("#btnNauRuou", lockNauRuou);
  setSoftLock("#btnBuonMuoi", lockBuon);
  setSoftLock("#btnTapVo", lockVo);
  setSoftLock("#btnMoBinh", lockMoBinh);
  setSoftLock("#btnRaiseRebel", lockRebel);

  // Society tab key actions (have inline onclick, so lock here avoids blind fail click)
  const lockThiHuong = blockedByGlobal || (p.faction === Faction.NGHIA_QUAN || (p.wantedLevel || 0) > 0 ? "Đang bị truy nã/làm phản, cấm dự khoa cử." : ((p.hocVi === "Hương Cống" || p.hocVi === "Tiến Sĩ") ? "Đã qua kỳ Thi Hương." : (p.hocVan < 20 ? "Cần Học Vấn >= 20." : "")));
  const lockThiHoi = blockedByGlobal || (p.faction === Faction.NGHIA_QUAN || (p.wantedLevel || 0) > 0 ? "Đang bị truy nã/làm phản, cấm dự khoa cử." : (p.hocVi !== "Hương Cống" ? "Cần học vị Hương Cống." : (p.hocVan < 40 ? "Cần Học Vấn >= 40." : "")));
  const lockThiDinh = blockedByGlobal || (p.faction === Faction.NGHIA_QUAN || (p.wantedLevel || 0) > 0 ? "Đang bị truy nã/làm phản, cấm dự khoa cử." : (p.hocVi !== "Trúng Cách" ? "Cần học vị Trúng Cách." : (p.hocVan < 60 ? "Cần Học Vấn >= 60." : "")));
  const lockBacCu = blockedByGlobal || (p.faction === Faction.NGHIA_QUAN || (p.wantedLevel || 0) > 0 ? "Đang bị truy nã/làm phản, cấm dự khoa võ." : (![PlayerRank.DAN_THUONG, PlayerRank.PHU_HO, PlayerRank.LY_TRUONG].includes(p.rank) ? "Danh phận hiện tại không được dự Bác Cử." : (p.voThuat < 20 ? "Cần Võ Thuật >= 20." : "")));

  setSoftLock("button[onclick=\"window.doThiHuong()\"]", lockThiHuong);
  setSoftLock("button[onclick=\"window.doThiHoi()\"]", lockThiHoi);
  setSoftLock("button[onclick=\"window.doThiDinh()\"]", lockThiDinh);
  setSoftLock("button[onclick=\"window.doBacCu()\"]", lockBacCu);

  // Local governance / posting panel
  const po = (state.postingsByHuyen && state.postingId) ? state.postingsByHuyen[state.postingId] : null;
  const isOfficial = [PlayerRank.TRI_HUYEN, PlayerRank.TRI_PHU, PlayerRank.HIEN_SAT_SU, PlayerRank.THUONG_THU].includes(p.rank);
  const canGovernRole = isOfficial && p.faction === Faction.TRIEU_DINH;
  const here = !!po && (p.currentRegion === po.regionId && p.currentHuyen === po.huyenId);
  const govBaseLock = blockedByGlobal || (!canGovernRole ? "Cần danh phận quan triều (Tri Huyện+) để dùng quan vụ." : (!po ? "Chưa có địa bàn nhậm chức." : (!here ? "Bạn không đứng tại địa bàn đang quản." : "")));

  setSoftLock("button[onclick=\"window.openCases()\"]", govBaseLock);
  setSoftLock("button[onclick=\"window.localTax()\"]", govBaseLock);
  setSoftLock("button[onclick=\"window.localPatrol()\"]", govBaseLock);
  setSoftLock("button[onclick=\"window.localPacify()\"]", govBaseLock);
  setSoftLock("button[onclick=\"window.localLevy()\"]", govBaseLock);
  setSoftLock("button[onclick=\"window.localFund()\"]", govBaseLock);
  setSoftLock("button[onclick=\"window.localEmbezzle()\"]", govBaseLock);
  setSoftLock("button[onclick=\"window.localBribe()\"]", govBaseLock);
  setSoftLock("button[onclick=\"window.localReinforce()\"]", govBaseLock);
  setSoftLock("button[onclick=\"window.assumeOffice()\"]", blockedByGlobal || (!canGovernRole ? "Cần danh phận quan triều (Tri Huyện+) để nhậm chức." : ""));
  document.querySelectorAll("button[onclick^=\"window.localMaa(\"]").forEach(el => applySoftLock(el, govBaseLock));
  document.querySelectorAll("button[onclick^=\"window.postingBuild(\"]").forEach(el => applySoftLock(el, govBaseLock));

  // Map siege / movement buttons
  const lockMapMove = blockedByGlobal || (p.theLuc < 30 ? "Cần 30 thể lực để hành quân." : (p._attached?.battleId ? "Đang thuộc quân trong chiến trận, không thể tự ý di chuyển." : ""));
  const lockSiege = blockedByGlobal || (p.rank === PlayerRank.DAN_THUONG && p.faction === Faction.TRIEU_DINH
    ? "Dân đen triều đình không được tự ý công huyện."
    : (p.theLuc < 30 ? "Nên đảm bảo thể lực đủ trước khi công huyện." : ""));
  document.querySelectorAll(".btn-map-move-huyen, .btn-map-move-lang").forEach(el => applySoftLock(el, lockMapMove));
  document.querySelectorAll(".btn-map-siege").forEach(el => applySoftLock(el, lockSiege));
  document.querySelectorAll(".btn-map-assign, .btn-map-recall, .btn-map-upgrade").forEach(el => applySoftLock(el, blockedByGlobal || (!canPlayerCommandStrategicGarrison(state) ? "Cần Đốc trấn trở lên hoặc võ tướng cao (không phải bách hộ / chưởng cơ / cai cơ) để điều động đồn trú phe." : "Cần đứng tại huyện đang kiểm soát để quản lý đồn trú.")));
}

function renderQuests() {
  const list = $("questList");
  if (!list) return;
  initQuestsIfNeeded(state);
  const qs = (state.quests || [])
    .filter(q => isUxAssistEnabled() || q.kind !== "tutorial")
    .filter(q => !q.completed)
    .slice(0, 6);
  if (qs.length === 0) {
    list.innerHTML = `<div class="muted" style="font-size:0.8rem;">Chưa có sứ mệnh.</div>`;
    return;
  }
  list.innerHTML = qs.map(q => {
    const goal = Math.max(1, q.goal || 1);
    const prog = Math.max(0, Math.min(goal, q.progress || 0));
    const pct = Math.round((prog / goal) * 100);
    const ddl = q.deadlineMonths ? `Hạn: ${q.deadlineMonths} tháng` : "—";
    const cls = q.completed ? "quest-card done" : "quest-card";
    return `
      <div class="${cls}">
        <div class="quest-title">${q.completed ? "✅ " : "• "}${escapeHtml(q.title)}</div>
        <div class="quest-desc">${escapeHtml(q.desc || "")}</div>
        <div class="quest-progress-track"><div class="quest-progress-fill" style="width:${pct}%;"></div></div>
        <div class="quest-meta">
          <span>Tiến độ: <strong class="gold-text">${prog}/${goal}</strong></span>
          <span>${escapeHtml(ddl)}</span>
        </div>
      </div>
    `;
  }).join("");
}

function openCelebrateModal(payload) {
  const modal = $("celebrateModal");
  if (!modal) return;
  const inner = modal.querySelector(".celebrate-inner");
  inner?.classList.remove("celebrate-inner--danger", "celebrate-inner--warn");
  if (payload?.tone === "danger") inner?.classList.add("celebrate-inner--danger");
  else if (payload?.tone === "warn") inner?.classList.add("celebrate-inner--warn");
  const titleEl = $("celebrateTitle");
  const bodyEl = $("celebrateBody");
  if (titleEl) titleEl.innerHTML = payload?.title || "CHIẾU CHỈ";
  if (bodyEl) bodyEl.innerHTML = payload?.body || "";
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function closeCelebrateModal() {
  const modal = $("celebrateModal");
  if (!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

function drainCelebrations() {
  if (!state?.uiCelebrations || state.uiCelebrations.length === 0) return;
  const modal = $("celebrateModal");
  if (modal?.classList.contains("open")) return; // avoid stacking

  const payload = state.uiCelebrations.shift();
  if (payload?.sfx) playSfxKey(payload.sfx);
  // subtle shake on big news
  const badge = $("playerRankBadge");
  badge?.classList.add("shake");
  setTimeout(() => badge?.classList.remove("shake"), 650);
  openCelebrateModal(payload);
}

function renderLog() {
  const list = $("logEntries");
  if (!list) return;
  const rows = (state.log || []).filter(entry => {
    if (logFilterMode === "all") return true;
    const cat = entry.category || inferLogCategory(entry.text);
    return cat === logFilterMode;
  });
  const iconByCat = { kinhte: "💰", dongho: "🏛️", honnhan: "💍", sukien: "⚔️", chienbao: "🗞️" };
  list.innerHTML = rows.map(entry => {
    const cat = entry.category || inferLogCategory(entry.text);
    const catText = cat === "kinhte" ? "Kinh tế" : cat === "dongho" ? "Dòng họ" : cat === "honnhan" ? "Hôn nhân" : cat === "chienbao" ? "Chiến báo" : "Sự kiện";
    const briefItems = Array.isArray(entry.warBriefItems) ? entry.warBriefItems : null;
    if (briefItems?.length) {
      const lines = briefItems.map((it) => {
        const w = it.winner === "nq" ? "Nghĩa quân thắng" : it.winner === "td" ? "Triều đình thắng" : "Giằng co / chưa rõ";
        const atkC = it.atkCas != null ? Number(it.atkCas) : "—";
        const defC = it.defCas != null ? Number(it.defCas) : "—";
        const sc = escapeHtml(it.scale || "Mũi");
        const pl = escapeHtml(it.place || "");
        const att = escapeHtml(it.attackers || "");
        const defn = escapeHtml(it.defenders || "");
        const note = it.note ? `<div class="war-brief-note">${escapeHtml(it.note)}</div>` : "";
        return `<div class="war-brief-line">
          <div class="war-brief-line-title">${sc} · ${pl}</div>
          <div class="war-brief-line-meta"><strong>${att}</strong> tấn <strong>${defn}</strong> — ước thương vong: <strong>${atkC}</strong> / <strong>${defC}</strong> · ${escapeHtml(w)}</div>
          ${note}
        </div>`;
      }).join("");
      const sum = escapeHtml(String(entry.text || "").replace(/<[^>]+>/g, ""));
      const n = briefItems.length;
      return `
      <div class="log-entry log-${cat}${entry.critical ? " log-critical" : ""}">
        <div class="log-meta-row">
          <span class="log-tag">${iconByCat[cat] || "📜"} ${catText}</span>
          <span class="log-label">${escapeHtml(entry.label)}</span>
        </div>
        <div class="war-brief-block">
          <div class="war-brief-head">${sum}</div>
          <button type="button" class="war-brief-toggle btn-tiny">Xem ${n} trận — chi tiết ▾</button>
          <div class="war-brief-body" hidden>${lines}</div>
        </div>
      </div>`;
    }
    return `
      <div class="log-entry log-${cat}${entry.critical ? " log-critical" : ""}">
        <div class="log-meta-row">
          <span class="log-tag">${iconByCat[cat] || "📜"} ${catText}</span>
          <span class="log-label">${entry.label}</span>
        </div>
        <span class="log-text">${escapeHtml(entry.text)}</span>
      </div>
    `;
  }).join("");
}

// Lưu qty theo key để không bị reset
const _mktQty = {};
let _marketFilter = "all";
const _marketTradeFeed = [];
const MARKET_FEED_LIMIT = 6;

const ITEM_UNITS = {
  thoc: "thùng", ruou: "hũ", muoi: "đấu", go: "tấm", lua: "tấm", ca: "giỏ", thit_lon: "mẻ"
};
const ITEM_CATEGORIES = {
  thoc: "food",
  ca: "food",
  thit_lon: "food",
  ruou: "craft",
  lua: "craft",
  go: "resource",
  muoi: "resource",
};
const MARKET_FILTERS = [
  { id: "all", label: "Tất cả" },
  { id: "food", label: "Lương thực" },
  { id: "craft", label: "Thủ công" },
  { id: "resource", label: "Nguyên liệu" },
];

// Hệ số giá theo vùng sản xuất: vùng sản xuất chính → giá bán cao, vùng nhập → giá rẻ
// Đã trong pm của RegionsDb; nhưng thêm weather + war bonus
function getMarketPrice(state, itemKey, basePrice, pm) {
  const region = RegionsDb[state.player.currentRegion];
  // Hệ số vùng: vùng có pm thấp = dồi dào = giá rẻ; vùng pm cao = khan = giá đắt
  const regionMult = pm[itemKey] || 1.0;
  // Thời tiết: hạn hán/lũ lụt → thóc +30%, buôn muối +10%
  let weatherMult = 1.0;
  const tw = state.thoiTiet || "";
  if (tw.includes("Hạn") || tw.includes("Lũ")) {
    if (itemKey === "thoc") weatherMult = 1.30;
    if (itemKey === "muoi") weatherMult = 1.10;
  }
  if (tw.includes("Bão")) { weatherMult = 1.20; }
  // Chiến sự: vùng có chiến sự → hàng hóa +15% (khan hiếm)
  let warMult = 1.0;
  if (state._battleChaos) {
    const hasBattle = Object.values(state._battleChaos).some(v => v > 0.5);
    if (hasBattle && regionMult > 1.2) warMult = 1.15; // vùng đang chiến
  }
  return basePrice * regionMult * weatherMult * warMult;
}

function renderMarket() {
  const container = $("marketRowsContainer");
  if (!container) return;

  const p = state.player;
  const pm = RegionsDb[p.currentRegion]?.pm || {};

  const trader = getMerchantProgress(state);
  const marketScene = getMarketSceneBrief(state);
  const merchantLine = $("merchantProgressLine");
  const marketSceneLine = $("marketSceneLine");
  const marketContractBox = $("marketContractBox");
  const marketQuickFilters = $("marketQuickFilters");
  const marketTradeFeed = $("marketTradeFeed");
  if (merchantLine) {
    const next = trader.nextXp ? `${trader.xp}/${trader.nextXp}` : `${trader.xp}/MAX`;
    merchantLine.innerHTML = `🎒 Lộ Trình Thương Nhân: <strong class="gold-text">Cấp ${trader.tier}</strong> · Kinh nghiệm <strong>${next}</strong> · Độ thành thạo <strong>${trader.pct}%</strong>`;
  }
  if (marketSceneLine) {
    const focusName = ItemsDb?.[marketScene.focusItem]?.name || "hàng lặt vặt";
    marketSceneLine.innerHTML = `🏮 ${marketScene.trader} · ${marketScene.moodLabel} · Mặt hàng nóng: <strong>${focusName}</strong>`;
  }
  if (marketContractBox) {
    const c = marketScene.contract;
    if (!c) marketContractBox.innerHTML = `<div class="muted">Tháng này chưa có hợp đồng.</div>`;
    else if (c.completed) {
      marketContractBox.innerHTML = `<div class="ux-helper-card">✅ Hợp đồng tháng hoàn tất: ${ItemsDb[c.itemKey]?.name || c.itemKey} (${c.qtyRequired}/${c.qtyRequired}).</div>`;
    } else {
      const progress = Math.max(0, Math.min(100, Math.round(((c.delivered || 0) / Math.max(1, c.qtyRequired || 1)) * 100)));
      marketContractBox.innerHTML = `
        <div class="ux-helper-card">
          <div><strong class="gold-text">Kèo Chợ Tháng:</strong> giao <strong>${c.qtyRequired}</strong> ${ItemsDb[c.itemKey]?.name || c.itemKey} · thưởng <strong>${c.reward} Quan</strong></div>
          <div class="quest-progress-track mt-1"><div class="quest-progress-fill" style="width:${progress}%;"></div></div>
          <div class="muted" style="font-size:0.75rem;">Tiến độ: ${c.delivered || 0}/${c.qtyRequired}</div>
          ${c.accepted ? `<div class="muted" style="font-size:0.75rem;">Đã nhận hợp đồng, cứ bán đúng mặt hàng là tự cộng tiến độ.</div>` : `<button class="btn-market buy mt-1" onclick="window.acceptMarketContract()">📜 Nhận Hợp Đồng</button>`}
        </div>`;
    }
  }
  if (marketQuickFilters) {
    marketQuickFilters.innerHTML = MARKET_FILTERS.map(f => `
      <button class="market-filter-chip${_marketFilter === f.id ? " active" : ""}" onclick="window.setMarketFilter('${f.id}')">${f.label}</button>
    `).join("");
  }

  const items = [
    { key: "thoc", label: "🌾 Thóc",  bal: () => p.thocCaNhan },
    { key: "ruou", label: "🍶 Rượu",  bal: () => (p.inventory?.ruou || 0) },
    { key: "muoi", label: "🧂 Muối",  bal: () => (p.inventory?.muoi || 0) },
    { key: "go",   label: "🪵 Gỗ",    bal: () => (p.inventory?.go   || 0) },
    { key: "lua",  label: "🧵 Lụa",   bal: () => (p.inventory?.lua  || 0) },
    { key: "ca",   label: "🐟 Cá",    bal: () => (p.inventory?.ca   || 0) },
    { key: "thit_lon", label: "🥩 Thịt lợn", bal: () => (p.inventory?.thit_lon || 0) },
  ];

  // Xây dựng HTML nhưng GIỮ nguyên qty nếu input đã tồn tại
  items.forEach(item => {
    const existingInput = $(`mktQty_${item.key}`);
    if (existingInput) _mktQty[item.key] = existingInput.value || "1";
  });

  const activeId = document.activeElement?.id;
  if (activeId && activeId.startsWith("mktQty")) return; // Ngăn chặn render lại toàn bộ lúc đang gõ

  const helper = !isUxAssistEnabled() ? ""
    : (!state.onboarding?.firstTradeDone)
    ? `<div class="ux-helper-card"><strong class="gold-text">Gợi ý nhanh:</strong> Bắt đầu bằng mua/bán 1 đơn vị để làm quen biên lợi nhuận từng vùng.</div>`
    : `<div class="ux-helper-card"><strong class="gold-text">Lộ trình thương nhân:</strong> (1) Làm hàng từ sinh kế → (2) Vào chợ bấm Đàm Phán theo món chủ lực → (3) Nhận kèo tháng và bán đủ số lượng để ăn thưởng lớn.</div>`;

  const shownItems = (_marketFilter === "all")
    ? items
    : items.filter(item => (ITEM_CATEGORIES[item.key] || "resource") === _marketFilter);

  container.innerHTML = helper + shownItems.map(item => {
    const buyQuote = getTradeQuote(state, item.key, true);
    const sellQuote = getTradeQuote(state, item.key, false);
    const basePrice = item.key === "thoc" ? (state.marketPriceThoc || 3) : ((ItemsDb?.[item.key]?.basePrice) || 5);
    const buyPrice = Math.max(1, buyQuote.unitPrice || 1);
    const sellPrice = Math.max(1, sellQuote.unitPrice || 1);
    const priceGap = Math.max(0, buyPrice - sellPrice);
    const hagState = buyQuote.haggle || sellQuote.haggle;
    const hagLabel = !hagState ? "Chưa mặc cả"
      : (hagState.success ? "Mặc cả thuận lợi" : "Mặc cả bất lợi");
    const hag = state._marketHaggle?.[item.key];
    const isHaggleActive = !!(hag && hag.ym === `${state.ban}-${state.monthIndex}`);
    const current    = item.bal();
    const unit       = ITEM_UNITS[item.key] || "đơn vị";
    const savedQty   = Math.max(1, parseInt(_mktQty[item.key] || "1", 10));
    const estBuyCost = buyPrice * savedQty;
    const estSellRev = sellPrice * Math.min(savedQty, current);
    const estProfit = estSellRev - estBuyCost;

    const regionNote = (pm[item.key] || 1) < 0.8
      ? `<span style="color:#88e88d;font-size:0.7rem;">(Đặc sản — Nên bán rẻ, mua tốt)</span>`
      : (pm[item.key] || 1) > 1.5
      ? `<span style="color:#f87171;font-size:0.7rem;">(Khan hiếm — Giá cao)</span>`
      : "";

    return `
      <div class="market-row">
        <div class="market-row-item">
          <span class="market-item-name">${item.label}</span>
          <span class="market-balance">Đang có: <strong class="gold-text">${current} ${unit}</strong> ${regionNote}</span>
        </div>
        <div class="market-row-prices">
          <span style="color:#f87171;">Mua: <strong>${buyPrice}</strong> Quan/${unit}</span>
          <span style="color:#88e88d;">Bán: <strong>${sellPrice}</strong> Quan/${unit}</span>
          <span class="muted" style="font-size:0.72rem;">Giá cơ sở: ${Math.round(basePrice * 10) / 10} Quan · Chênh lệch chợ: ${priceGap} · ${hagLabel}</span>
          <span class="muted" style="font-size:0.72rem;">Ước tính theo SL ${savedQty}: mua tốn ${estBuyCost}Q · bán thu ${estSellRev}Q · ${estProfit >= 0 ? `<span style="color:#88e88d">lãi ${estProfit}Q</span>` : `<span style="color:#f87171">lỗ ${Math.abs(estProfit)}Q</span>`}</span>
        </div>
        <div class="market-row-controls">
          <input type="number" min="1" max="9999" value="${savedQty}" id="mktQty_${item.key}"
                 class="market-qty-input" inputmode="numeric"
                 onchange="window._saveMktQty('${item.key}',this.value)" />
          <div class="market-qty-preset">
            <button class="btn-market qty" onclick="window.setMarketQty('${item.key}',1)">1</button>
            <button class="btn-market qty" onclick="window.setMarketQty('${item.key}',5)">5</button>
            <button class="btn-market qty" onclick="window.setMarketQty('${item.key}',10)">10</button>
            <button class="btn-market qty" onclick="window.setMarketQtyMax('${item.key}')">Max</button>
          </div>
          <button class="btn-market" onclick="window.doMarketHaggle('${item.key}')" title="Dùng Ngoại Giao để đàm phán ưu đãi giá trong tháng">${isHaggleActive ? "🧮 Đã Mặc Cả" : "🧮 Đàm Phán"}</button>
          <button class="btn-market buy"  onclick="window.doMarketBuy('${item.key}')">Mua</button>
          <button class="btn-market sell" onclick="window.doMarketSell('${item.key}')">Bán</button>
        </div>
      </div>
    `;
  }).join("");

  if (marketTradeFeed) {
    const rows = _marketTradeFeed.slice(0, MARKET_FEED_LIMIT);
    if (rows.length === 0) {
      marketTradeFeed.innerHTML = `<div class="muted" style="font-size:0.78rem;">📒 Chưa có thương vụ gần đây.</div>`;
    } else {
      marketTradeFeed.innerHTML = `
        <h4 class="gold-text border-bot pb-2 mb-2">📒 Sổ Thương Vụ Gần Đây</h4>
        <div class="market-trade-feed">
          ${rows.map(r => `<div class="market-feed-row"><span>${r.text}</span><span class="muted">${r.label}</span></div>`).join("")}
        </div>`;
    }
  }
}

window._saveMktQty = (key, val) => { _mktQty[key] = val; };
window.setMarketFilter = (id) => {
  _marketFilter = MARKET_FILTERS.some(f => f.id === id) ? id : "all";
  renderMarket();
};
window.setMarketQty = (key, qty) => {
  _mktQty[key] = String(Math.max(1, qty | 0));
  const input = $(`mktQty_${key}`);
  if (input) input.value = _mktQty[key];
  renderMarket();
};
window.setMarketQtyMax = (key) => {
  const p = state?.player;
  if (!p) return;
  const quote = getTradeQuote(state, key, true);
  const maxByMoney = Math.max(1, Math.floor((p.tien || 0) / Math.max(1, quote.unitPrice || 1)));
  _mktQty[key] = String(Math.min(9999, Math.max(1, maxByMoney)));
  const input = $(`mktQty_${key}`);
  if (input) input.value = _mktQty[key];
  renderMarket();
};

function renderProperties() {
  const propList   = $("propList");
  const catTabs    = $("propCatTabs");
  if (!propList || !catTabs) return;

  const currentCat = propList.dataset.cat || "nha_o";

  // Category tabs
  catTabs.innerHTML = PropertyCategories.map(cat => `
    <button class="cat-tab-btn${currentCat === cat.id ? " active" : ""}"
            onclick="window.setPropCat('${cat.id}')">${cat.icon} ${cat.name.split(" ").slice(1).join(" ")}</button>
  `).join("");

  const p = state.player;
  const items = Object.values(PropertyDb).filter(pt => pt.category === currentCat);
  const isHome = p.homeRegion === p.currentRegion && p.homeHuyen === p.currentHuyen;
  const locWarning = !isHome ? `<div style="color:var(--danger-light);font-size:0.8rem;margin-bottom:0.6rem;padding:0.4rem;background:rgba(200,0,0,0.1);border-radius:4px;border:1px solid var(--danger-red);">⚠ Bạn đang ở huyện <strong>${p.currentHuyen}</strong>. Chỉ có thể xây dựng và tương tác Kiến Trúc ở quê nhà (huyện <strong>${p.homeHuyen}</strong>).</div>` : "";

  propList.innerHTML = locWarning + items.map(pt => {
    const holding = (p.holdings || []).find(h => h.typeId === pt.id);
    const level   = holding?.level || 0;
    const isMax   = level >= pt.maxLevel;
    const cost    = level === 0 ? pt.cost : (pt.upgradeCost * level);
    const canAfford = p.tien >= cost && isHome;
    const lockReason = !isHome ? "Chỉ có thể xây dựng khi ở quê nhà." : (p.tien < cost ? `Thiếu tiền: cần ${cost} quan.` : "");
    let statusClass = level > 0 ? "prop-owned" : "prop-unowned";
    if (isMax) statusClass = "prop-maxed";
    if (!isHome) statusClass += " muted";

    // Binh chủng từ Kiến trúc Quân Sự
    let maaHtml = "";
    if (isHome && pt.category === "quan_su" && level > 0) {
      if (window.MaaDb) {
        const maaOptions = Object.values(window.MaaDb).filter(m => m.unlock === pt.id);
        if (maaOptions.length > 0) {
          const maaListHtml = maaOptions.map(m => {
             const exist = p.maa?.find(x => x.id === m.id);
             const mLevel = exist ? (exist.level || 1) : 0;
             const isMax = mLevel >= 10;
             if (isMax) return `<span class="prop-maxed-label" style="font-size:0.65rem;padding:2px">Đã Max ${m.name}</span>`;
             const label = mLevel > 0 ? `Mở rộng ${m.name} Cấp ${mLevel+1}` : `Tuyển ${m.name}`;
             return `<button class="action-btn highlight-gold" style="font-size:0.72rem;padding:3px 6px;" onclick="window.doRecruitMaa('${m.id}')">${label} (${m.cost}Q)</button>`;
          }).join("");
          maaHtml = `<div class="mt-2" style="border-top:1px dashed rgba(154,122,50,0.2);padding-top:6px;display:flex;gap:4px;flex-wrap:wrap;">
            ${maaListHtml}
          </div>`;
        }
      }
    }

    return `
      <div class="prop-card ${statusClass}">
        <div class="prop-card-header">
          <span class="prop-name">${pt.name}</span>
          <span class="prop-level">${level > 0 ? `Cấp ${level}/${pt.maxLevel}` : "Chưa xây"}</span>
        </div>
        <div class="prop-desc">${pt.desc}</div>
        <div class="prop-effect">${pt.effectDesc}</div>
        ${!isMax ? `<button class="action-btn ${canAfford ? "highlight-gold" : "soft-locked"} mt-1"
            style="font-size:0.78rem;padding:4px 8px;"
            onclick="window.doBuild('${pt.id}')"
            data-lock-reason="${escapeHtml(lockReason)}"
            title="${escapeHtml(lockReason)}"
            ${canAfford ? "" : "disabled"}>
            ${level === 0 ? "⚒ Xây" : "⬆ Nâng Cấp"} (${cost}Q)
          </button>` : '<span class="prop-maxed-label">✅ Cấp Tối Đa</span>'}
        ${level > 0 && isHome ? `<button class="action-btn danger mt-1"
            style="font-size:0.72rem;padding:3px 6px;"
            onclick="window.doDemo('${pt.id}')">🔨 Phá Dỡ</button>` : ""}
        ${maaHtml}
      </div>
    `;
  }).join("") || "<p class='muted text-center'>Không có kiến trúc nào ở danh mục này.</p>";
}

function renderOfficialsAndClans() {
  const ofList = $("officialsList");
  if (ofList) {
    const { lyTruong, chanhTong, triHuyen } = state.officials;
    const roles = [
      { label: "Lý Trưởng",  id: lyTruong  },
      { label: "Chánh Tổng", id: chanhTong },
      { label: "Tri Huyện",  id: triHuyen  },
    ];
    ofList.innerHTML = roles.map(r => {
      const npc = r.id ? state.npcById[r.id] : null;
      if (!npc) return `<div class="official-card"><div class="off-title">${r.label}</div><div class="off-name muted">—Trống—</div></div>`;
      const opColor = npc.opinion > 30 ? "#88e88d" : npc.opinion < -10 ? "#f87171" : "#aaa";
      return `<div class="official-card" onclick="window.openNpcModal('${npc.id}')">
        <div class="off-title">${r.label}</div>
        <div class="off-name">${npc.name}</div>
        <div class="off-opinion" style="color:${opColor}">Cảm tình: ${npc.opinion}</div>
      </div>`;
    }).join("");
  }

  const clanList = $("clanList");
  if (clanList) {
    clanList.innerHTML = state.clans.map(c => {
      const members = c.memberIds.map(id => state.npcById[id]?.name || "?").join(", ");
      const attitude = c.attitude === "hostile" ? "⚔️ Thù vịch" :
                       c.attitude === "friendly" ? "👍 Thân thiện" : "🤝 Trung lập";
      return `<div class="clan-card" onclick="window.openClanModal('${c.id}')" style="cursor:pointer;">
        <div class="clan-name">${c.name} <span style="font-size:0.72rem;color:var(--text-dim);">(Bấm để xem)</span></div>
        <div class="clan-stat">Quyền Lực: <strong class="gold-text">${c.quyenLuc}</strong> &nbsp; ${attitude}</div>
        <div class="clan-members muted" style="font-size:0.78rem;margin-top:4px;">Thành viên: ${members}</div>
      </div>`;
    }).join("");
  }
}

function renderPostingPanel() {
  const el = $("postingPanel");
  if (!el) return;
  const p = state.player;
  const po = (state.postingsByHuyen && state.postingId) ? state.postingsByHuyen[state.postingId] : null;
  const isOfficial = [PlayerRank.TRI_HUYEN, PlayerRank.TRI_PHU, PlayerRank.HIEN_SAT_SU, PlayerRank.THUONG_THU].includes(p.rank);
  if (!isOfficial || p.faction !== Faction.TRIEU_DINH) {
    el.innerHTML = `<p class="muted" style="font-size:0.85rem;">Chỉ quan triều đình (Tri Huyện+) mới có quan vụ địa phương.</p>`;
    return;
  }
  if (!po) {
    el.innerHTML = `<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center;">
      <p class="muted" style="font-size:0.85rem;margin:0;">Chưa có địa bàn nhậm chức. Hãy nhậm chức tại huyện đang đứng.</p>
      <button class="btn-tiny primary" onclick="window.assumeOffice()">Nhậm Chức Tại Đây</button>
    </div>`;
    return;
  }
  const here = (p.currentRegion === po.regionId && p.currentHuyen === po.huyenId);
  const ctrl = (typeof getHuyenControl === "function") ? getHuyenControl(state, po.huyenId) : Faction.TRIEU_DINH;
  const ctrlTxt = ctrl === Faction.NGHIA_QUAN ? "🚩 Nghĩa quân" : "⛳ Triều đình";
  const nowAbs = (state.ban - 1737) * 360 + (state.monthIndex * 30) + (state.gameDay || 1);
  let orderLine = "";
  if (state.postingOrder?.active && state.postingOrder?.to?.huyenId) {
    const due = state.postingOrder.dueTotalDays || nowAbs;
    const daysLeft = Math.max(0, due - nowAbs);
    const tgt = state.postingOrder.to.huyenId;
    orderLine = `<div class="muted" style="font-size:0.82rem;margin-top:6px;">
      📜 <strong class="gold-text">Chỉ dụ:</strong> Điều nhiệm tới <strong class="gold-text">${escapeHtml(tgt)}</strong> · Còn <strong class="danger-red">${daysLeft}</strong> ngày
    </div>`;
  }
  const d = state.village?.demo;
  const demoLine = d ? `
    <div class="muted" style="font-size:0.8rem;margin-top:6px;">
      👥 Dân: Trẻ ${d.children||0} · Đinh nam ${d.men||0} · Nữ ${d.women||0} · Lão ${d.elderly||0}
      <span style="margin-left:10px;">📌 Suất đinh: <strong class="gold-text">${state.village._eligibleLevy||0}</strong> (mở rộng ${state.village._eligibleLevyWide||0})</span>
    </div>
  ` : "";
  // Local clans: show why they matter
  const clanIds = (state.village?.clanIds || []).slice(0, 6);
  const clanLine = (clanIds.length > 0) ? `
    <div class="box-plate mt-2" style="padding:0.7rem;">
      <div style="font-weight:700;color:var(--gold-light);margin-bottom:6px;">🏮 Gia tộc địa phương</div>
      <div class="muted" style="font-size:0.8rem;line-height:1.55;">
        ${clanIds.map(cid => {
          const clan = (state.clans||[]).find(c => c.id === cid);
          if (!clan) return "";
          const members = (clan.memberIds||[]).map(id => state.npcById?.[id]).filter(Boolean);
          const avg = members.length ? Math.round(members.reduce((s,n)=>s+(n.opinion||0),0)/members.length) : 0;
          const stance = (clan.attitude === "friendly" || avg >= 55) ? `<span style="color:#51cf66;">ủng hộ</span>`
                        : (clan.attitude === "hostile" || avg <= -15) ? `<span style="color:#f87171;">chống đối</span>`
                        : `<span style="color:var(--text-dim);">lăm le</span>`;
          return `<span style="display:inline-block;margin-right:10px;cursor:pointer;text-decoration:underline;color:var(--gold-light);" onclick="window.openClanModal('${cid}')">${escapeHtml(clan.name)}</span>
                  <span style="color:var(--text-dim);">CT≈${avg}</span> · ${stance}`;
        }).filter(Boolean).join("<br>")}
      </div>
      <div class="muted" style="font-size:0.78rem;margin-top:6px;">Gia tộc sẽ <strong>rót tiền vào kho</strong> khi thiện cảm cao, hoặc <strong>ngầm phá</strong> khi thù ghét. Họ cũng hay gầm gè — hãy xử án/hoà giải để giữ yên địa phương.</div>
    </div>
  ` : "";
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start;">
      <div>
        <div style="font-weight:700;color:var(--gold-light);">Địa bàn: ${escapeHtml(po.huyenId)} <span class="muted" style="font-size:0.8rem;">(${ctrlTxt})</span></div>
        <div class="muted" style="font-size:0.82rem;margin-top:4px;">Kho bạc: <strong class="gold-text">${(po.treasury||0).toLocaleString()}</strong>Q · Quân nha: <strong class="gold-text">${(po.garrison||0).toLocaleString()}</strong> · Tham ô: <strong class="danger-red">${po.corruption||0}</strong>/100</div>
        <div class="muted" style="font-size:0.78rem;margin-top:4px;">${here ? "📍 Bạn đang ở đúng địa bàn." : "⚠️ Bạn đang ở nơi khác — một số lệnh sẽ bị hạn chế."}</div>
        ${demoLine}
        ${orderLine}
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">
        <button class="btn-tiny" onclick="window.openCases()">Xử Án</button>
        <button class="btn-tiny" onclick="window.localTax()">Thu Thuế</button>
        <button class="btn-tiny" onclick="window.localPatrol()">Tuần Soát</button>
        <button class="btn-tiny" onclick="window.localPacify()">Phủ Dụ</button>
        <button class="btn-tiny" onclick="window.localLevy()">Mộ Đinh</button>
        <button class="btn-tiny" onclick="window.localFund()">Nộp Kho</button>
        <button class="btn-tiny" onclick="window.localEmbezzle()">Tham Ô</button>
        <button class="btn-tiny" onclick="window.localBribe()">Lo Lót</button>
        <button class="btn-tiny primary" onclick="window.localReinforce()">Xin Cứu Viện</button>
        <button class="btn-tiny" onclick="window.assumeOffice()">Đổi Địa Bàn (Nhậm chức tại đây)</button>
      </div>
    </div>
    ${clanLine}
    <div class="box-plate mt-2" style="padding:0.7rem;">
      <div style="font-weight:700;color:var(--gold-light);margin-bottom:6px;">🏛 Xây quân MAA (kho địa phương)</div>
      <div class="action-grid">
        <button class="action-btn highlight-red" onclick="window.localMaa('NHAT_BINH')">🛡 Nhất Binh</button>
        <button class="action-btn highlight-red" onclick="window.localMaa('UU_BINH')">🗡 Ưu Binh</button>
        <button class="action-btn highlight-gold" onclick="window.localMaa('DIEU_THUONG')">🔫 Điểu Thương</button>
        <button class="action-btn highlight-gold" onclick="window.localMaa('TRONG_KY')">🐎 Trọng Kỵ</button>
        <button class="action-btn danger" onclick="window.localMaa('PHAO_BINH')">💣 Pháo Binh</button>
      </div>
      <div class="muted" style="font-size:0.8rem;margin-top:6px;">MAA này thuộc địa phương; khi luân chuyển đi nơi khác sẽ dùng kho/MAA khác.</div>
    </div>
    <div class="box-plate mt-2" style="padding:0.7rem;">
      <div style="font-weight:700;color:var(--gold-light);margin-bottom:6px;">🏗 Công trình nhiệm sở (chỉ địa phương này)</div>
      <div class="action-grid">
        <button class="action-btn" onclick="window.postingBuild('granary')">🌾 Kho Thóc Huyện</button>
        <button class="action-btn" onclick="window.postingBuild('yamen')">🏛 Mở Rộng Phủ Nha</button>
        <button class="action-btn" onclick="window.postingBuild('barracks')">🪖 Doanh Trại Địa Phương</button>
        <button class="action-btn" onclick="window.postingBuild('river_patrol')">🚣 Trạm Tuần Sông</button>
      </div>
      <div class="muted" style="font-size:0.8rem;margin-top:6px;">Xây bằng <strong class="gold-text">kho địa phương</strong>. Khi luân chuyển đi nơi khác sẽ không hưởng công trình ở đây.</div>
    </div>
  `;
}

function renderLifestyle() {
  const p = state.player;

  // Lifestyle focus + points
  setText("lifestyleFocusLabel",
    p.lifestyleFocus ? `${LifestyleIcon[p.lifestyleFocus]} ${LifestyleLabel[p.lifestyleFocus]}` : "Chưa chọn");
  setText("lifestylePoints", p.lifestylePoints || 0);

  // Selector
  const selector = $("lifestyleSelector");
  if (selector) {
    selector.innerHTML = Object.values(LifestyleId).map(lid => {
      const isFocus = p.lifestyleFocus === lid;
      const xp      = getLifestyleXP(state, lid);
      const tier    = getLifestyleTier(state, lid);
      const xpNext  = PERK_UNLOCK_XP[Math.min(tier + 1, 6)] || PERK_UNLOCK_XP[6];
      const xpCur   = PERK_UNLOCK_XP[tier] || 0;
      const xpPct   = xpNext > xpCur ? Math.round((xp - xpCur) / (xpNext - xpCur) * 100) : 100;
      const fx       = LifestyleFocusEffect[lid];
      return `<div class="lifestyle-card${isFocus ? " active" : ""}" onclick="window.doSetFocus('${lid}')">
        <div class="ls-icon">${LifestyleIcon[lid]}</div>
        <div class="ls-name">${LifestyleLabel[lid]}</div>
        <div class="ls-desc">${fx?.desc || ""}</div>
        <div style="margin-top:0.4rem;">
          <div style="font-size:0.68rem;color:var(--text-dim);margin-bottom:2px;">Tầng ${tier}/6 — ${xp} XP</div>
          <div style="height:4px;background:rgba(255,255,255,0.08);border-radius:2px;overflow:hidden;">
            <div style="height:100%;width:${xpPct}%;background:${isFocus ? 'var(--gold-light)' : 'var(--gold-dark)'};transition:width 0.4s;"></div>
          </div>
        </div>
        ${isFocus ? '<div class="ls-active-badge">✓ Đang Chọn</div>' : ''}
      </div>`;
    }).join("");
  }

  const treeContainer = $("perkTreeContainer");
  if (!treeContainer) return;

  // Chọn tree hiển thị = focus; nếu chưa chọn thì NGOAI_GIAO
  const currentFocus = p.lifestyleFocus || LifestyleId.NGOAI_GIAO;
  const tree = PerkTrees[currentFocus] || [];

  const byTier = {};
  tree.forEach(pk => {
    if (!byTier[pk.tier]) byTier[pk.tier] = [];
    byTier[pk.tier].push(pk);
  });

  const tierLabels = ["", "Vỡ Lòng", "Sơ Nhập", "Lão Luyện", "Bậc Thầy", "Tinh Thông", "Huyền Thoại"];
  const treeTier   = getLifestyleTier(state, currentFocus);
  const treeXP     = getLifestyleXP(state, currentFocus);

  const focusHelper = !isUxAssistEnabled() ? "" : (!p.lifestyleFocus
    ? `<div class="ux-helper-card">Chưa chọn focus. Hãy chọn 1 focus ngay để tăng XP đúng hướng mỗi tháng.</div>`
    : "");
  treeContainer.innerHTML = `
    ${focusHelper}
    <div class="perk-tree-header">
      <span class="gold-text">${LifestyleIcon[currentFocus]} ${LifestyleLabel[currentFocus]} — Cây Kỹ Năng</span>
      <span style="font-size:0.78rem;color:var(--text-dim);margin-left:0.8rem;">Tầng ${treeTier}/6 · ${treeXP} XP · ${p.lifestylePoints || 0} điểm perk</span>
    </div>
    <div style="font-size:0.75rem;color:var(--text-muted);margin:0.4rem 0 0.6rem;background:rgba(0,0,0,0.3);padding:0.4rem 0.6rem;border-radius:3px;border:1px solid var(--border-dim);">
      💡 Perk mở chậm: điểm perk +1 mỗi 3 tháng. XP tăng được bằng hoạt động tương ứng hoặc chọn focus (+4 XP/t). Có thể mở perk ở bất kỳ cây nào miễn đủ XP.
    </div>
    ${Object.entries(byTier).map(([tier, perks]) => {
      const tierNum   = +tier;
      const xpNeeded  = PERK_UNLOCK_XP[tierNum] || 0;
      const tierUnlockable = treeXP >= xpNeeded;
      return `
      <div class="perk-tier">
        <div class="perk-tier-label">Tầng ${tier}: ${tierLabels[tierNum] || ""}
          ${!tierUnlockable ? `<span style="color:var(--danger-light);font-size:0.68rem;">(Cần ${xpNeeded} XP)</span>` : ""}
        </div>
        <div class="perk-row">
          ${perks.map(pk => {
            const unlocked  = !!p.lifestylePerks?.[pk.id];
            const reqMet    = !pk.require || !!p.lifestylePerks?.[pk.require];
            const xpOk      = treeXP >= (PERK_UNLOCK_XP[pk.tier] || 0);
            const ptOk      = (p.lifestylePoints || 0) >= pk.cost;
            const canUnlock = !unlocked && reqMet && xpOk && ptOk;
            const cls = unlocked ? "perk-card unlocked" : (reqMet && xpOk) ? "perk-card available" : "perk-card locked";
            const lockReason = !reqMet ? " 🔐 cần perk trước" : !xpOk ? ` 🔐 cần ${PERK_UNLOCK_XP[pk.tier]} XP` : !ptOk ? ` (đang có ${p.lifestylePoints||0} điểm)` : "";
            return `<div class="${cls}" onclick="window.doUnlockPerk('${currentFocus}','${pk.id}')">
              <div class="perk-name">${pk.name}</div>
              <div class="perk-desc">${pk.desc}</div>
              <div class="perk-cost">${unlocked ? "✅ Đã Mở" : `${pk.cost} điểm${lockReason}`}</div>
            </div>`;
          }).join("")}
        </div>
      </div>`;
    }).join("")}
  `;
}

function renderPoliticsButtons() {
  const p = state.player;
  const noPol = $("noPoliticsText");
  const politicsRanks = [
    PlayerRank.LY_TRUONG, PlayerRank.CHANH_TONG, PlayerRank.TRI_HUYEN,
    PlayerRank.TRI_PHU, PlayerRank.HIEN_SAT_SU, PlayerRank.THUONG_THU,
  ];
  const hasPolitics = politicsRanks.includes(p.rank);
  ["btnThue","btnTiec","btnTrung","btnDanPhu"].forEach(id => {
    const el = $(id);
    if (!el) return;
    if (hasPolitics) el.classList.remove("hidden"); else el.classList.add("hidden");
  });
  if (noPol) {
    noPol.style.display = hasPolitics ? "none" : "";
    if (!hasPolitics) {
      noPol.textContent = "Chưa đủ danh phận để can thiệp chính sự. Gợi ý: tăng Học Vấn/Võ Thuật và thi cử ở tab Xã Hội.";
    }
  }
}

// Helper để tạo banner chiến sự có nút Tham Chiến
function getWarBanner(bs) {
  if (!bs) return "";
  const p = state.player;
  const isEligible = p.theLuc >= 30 && p.quanSo >= 20 && p.voThuat >= 15;
  const btnClass = isEligible ? "action-btn highlight-red" : "action-btn muted";
  const btnStyle = isEligible ? "" : "opacity: 0.6; cursor: help;";
  const btnText = isEligible ? "⚔️ Tham Chiến" : "🔒 Tham Chiến (Chưa đủ điều kiện)";

  const reqList = [];
  if (p.theLuc < 30) reqList.push("Cần 30 Thể lực");
  if (p.quanSo < 20) reqList.push("Cần 20 Quân số");
  if (p.voThuat < 15) reqList.push("Cần 15 Võ thuật");
  const reqTip = reqList.join(", ");

  return `
    <div style="color:#f87171;font-weight:bold;margin-bottom:12px;border:1px solid #f87171;padding:8px;text-align:center;border-radius:4px;background:rgba(248,113,113,0.1);">
      🔥 Toàn huyện đang chìm trong bão lửa: ${bs.name}! Các vùng lân cận đều chịu cảnh binh đao.
      <div style="margin-top:8px; display:flex; gap:8px; justify-content:center;">
        <button class="${btnClass}" style="${btnStyle}" onclick="window.actionJoinBattle('${bs.id}', 'def')" title="${reqTip}">
          🛡 Theo Triều Đình (An toàn)
        </button>
        <button class="${btnClass}" style="${btnStyle} color:#ff6b6b; border-color:#ff6b6b;" onclick="window.actionJoinBattle('${bs.id}', 'atk')" title="${reqTip}">
          ⚔️ Theo Nghĩa Quân (PHẢN LOẠN!)
        </button>
      </div>
    </div>`;
}

// ──────────────────────────────────────────────────
// MAP RENDERING (6-level drill-down)
// ──────────────────────────────────────────────────

/** Triều đình, không truy nã: được đi quan lộ vào Phủ Phụng Thiên (Thăng Long) dù huyện đang bị ghi nhận phe khác — để thi cử / bái kiến / nội thành. Nghĩa quân vẫn phải chiếm bằng quân sự. */
function kinhDinhCivilAccess(p, tranId, phuId) {
  if (!p) return false;
  if (p.faction !== Faction.TRIEU_DINH) return false;
  if ((p.wantedLevel || 0) > 0) return false;
  return tranId === RegionId.THANG_LONG && phuId === "phung_thien";
}

/** La thành: thứ dân & quan lại tới cấp trấn buôn bán, tạm trú, mua nhà; chỉ cần thân phận triều đình, không truy nã. Nghĩa quân không nhập dân sự. */
function playerCanKinhLaThanh(p) {
  if (!p) return false;
  if (p.faction === Faction.NGHIA_QUAN) return false;
  if (p.faction !== Faction.TRIEU_DINH) return false;
  if ((p.wantedLevel || 0) > 0) return false;
  return true;
}

/** Hoàng thành: đại thần trung ương về triều — trên Hiến sát (Hiến sát dưới đốc trấn không vào Phủ Chúa). */
function playerCanKinhHoangThanh(p) {
  if (!playerCanKinhLaThanh(p)) return false;
  return new Set([
    PlayerRank.THUONG_THU,
    PlayerRank.THAM_TUNG,
    PlayerRank.BOI_TUNG,
    PlayerRank.DAI_TUONG,
  ]).has(p.rank);
}

/** Tử cấm thành: cực hạn — Thượng thư / Tham–Bồi tụng (lễ triều đình). */
function playerCanKinhTuCamThanh(p) {
  if (!playerCanKinhLaThanh(p)) return false;
  return p.rank === PlayerRank.THUONG_THU || p.rank === PlayerRank.THAM_TUNG || p.rank === PlayerRank.BOI_TUNG;
}

let mapLevel  = "tran";  // "tran" | "kinh_hub" | "kinh_shell" | "kinh_la" | "kinh_hoang" | "kinh_tu" | "phu" | ...
let mapFocusTran  = null;
let mapFocusPhu   = null;
let mapFocusHuyen = null;
let mapFocusTong  = null;
let mapFocusXa    = null;
let _battleLocLabel = "";

/** Cập nhật panel trận khi đang ở tab Bản đồ (tránh “đứng hình” sau mỗi ngày game). */
function refreshMapBattlePanelIfVisible() {
  const tabMapEl = $("tabMap");
  if (!tabMapEl || tabMapEl.classList.contains("hidden") || !state) return;
  if (!mapFocusHuyen || !mapFocusTran || !mapFocusPhu) return;
  if (!["tong", "xa", "lang"].includes(mapLevel)) return;
  const tran = getRegion(mapFocusTran);
  const huyen = tran?.phu?.[mapFocusPhu]?.huyen?.[mapFocusHuyen];
  if (!huyen?.historicalBattle) return;
  const bs = getBattleState(state, huyen.historicalBattle);
  if (!bs) return;
  _battleLocLabel = huyen.name || mapFocusHuyen || "";
  renderBattlePanel(huyen.historicalBattle);
}

function renderMap() {
  const grid = $("mapGrid");
  const crumb = $("mapBreadcrumb");
  const battlePanel = $("battlePanel");
  if (!grid) return;
  const homeJump = `<span onclick="window.mapGoHome()" style="cursor:pointer;text-decoration:underline;color:var(--gold-light);">🏠 Về Quê Nhà</span>`;

  battlePanel?.classList.add("hidden");

  if (mapLevel === "tran") {
    // Show all Trấn
    crumb.innerHTML = `Đàng Ngoài › Chọn Trấn · ${homeJump}`;
    const regions = getAllRegions();
    grid.innerHTML = regions.map(r => {
      const isHere = state.player.currentRegion === r.id;
      const isHome = state.player.homeRegion === r.id; // Still show home region roughly directly
      const propCount = state.player.holdings?.filter(h => h.regionId === r.id).length || 0;
      const hasBattle = Object.values(r.phu || {}).some(ph =>
        Object.values(ph.huyen || {}).some(h => h.historicalBattle && getBattleState(state, h.historicalBattle))
      );
      return `<div class="map-card ${isHere ? "map-current" : ""} ${hasBattle ? "map-battle" : ""}"
                   onclick="window.mapDrillTran('${r.id}')">
        <div class="map-card-name">${r.name}</div>
        <div class="map-card-spec">${r.spec}</div>
        ${hasBattle ? '<div class="map-battle-badge">⚔️ Chiến Sự</div>' : ""}
        ${isHere ? '<div class="map-current-badge">📍 Đang Ở</div>' : ""}
        ${isHome ? '<div class="map-current-badge" style="background:var(--gold-dark);color:#fff;top:auto;bottom:0.5rem;">🏠 Quê Nhà</div>' : ""}
        ${propCount > 0 ? `<div style="font-size:0.75rem;color:var(--gold-light);margin:0.2rem 0;">Bất động sản: ${propCount}</div>` : ""}
        <div class="map-card-general">Quân trấn: ${r.quanSoTran?.toLocaleString() || "?"}</div>
        <div class="map-card-general muted" style="font-size:0.78rem;">${r.desc?.slice(0, 60) || ""}...</div>
        <div style="margin-top:0.45rem;display:flex;flex-direction:column;gap:6px;">
          <button class="btn-map-travel" onclick="event.stopPropagation();window.mapMoveToTranCenter('${r.id}')">🏛 Đến trung tâm trấn</button>
        </div>
        ${r.id === RegionId.THANG_LONG ? `<div class="muted" style="font-size:0.78rem;margin-top:8px;line-height:1.45;">🏛 Vào trấn để mở <strong>Kinh thành</strong> (Hoàng thành) và danh sách <strong>phủ · huyện phụ cận</strong>.</div>` : ""}
      </div>`;
    }).join("");

  } else if (mapLevel === "kinh_hub") {
    const tran = getRegion(mapFocusTran);
    const kt = getKinhThanh(mapFocusTran);
    crumb.innerHTML = `<span onclick="window.mapNavTo('tran')" style="cursor:pointer;text-decoration:underline;color:var(--gold-light);">Đàng Ngoài</span> › <strong>${escapeHtml(tran?.name || "")}</strong> · Kinh thành · phụ cận · ${homeJump}`;
    const phus = Object.values(tran?.phu || {});
    const kinhCard = kt
      ? `<div class="map-card map-kinh-thanh map-kinh-crown-hub" role="button" tabindex="0" style="grid-column:1/-1;cursor:pointer;" onclick="window.mapOpenKinhShell()" title="Mở bản đồ ba lớp Kinh thành">
          <div class="map-kinh-crown-ico" aria-hidden="true">👑</div>
          <div class="map-card-name" style="font-size:1.15rem;padding-right:36px;">${escapeHtml(kt.name)}</div>
          <div class="map-card-spec" style="margin-top:4px;">${escapeHtml(kt.shortDesc || "")}</div>
          <div class="map-battle-badge" style="margin-top:10px;background:rgba(55,95,130,0.42);border-color:rgba(122,179,212,0.55);">🛡 Tổng đồn ~${(kt.garrison ?? 0).toLocaleString()} · ${escapeHtml(kt.garrisonLabel || "")}</div>
          <div class="muted" style="font-size:0.8rem;margin-top:10px;line-height:1.55;">${escapeHtml(kt.defenseNote || "")}</div>
          <div class="muted" style="font-size:0.78rem;margin-top:8px;line-height:1.5;">${escapeHtml(kt.maaNote || "")}</div>
          <div style="margin-top:14px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
            <span class="gold-text" style="font-size:0.88rem;font-weight:700;">Bấm vào đây —</span>
            <button type="button" class="btn-map-travel" style="background:rgba(180,130,50,0.45);border-color:var(--gold-light);" onclick="event.stopPropagation();window.mapOpenKinhShell()">👑 La thành · Hoàng thành · Tử cấm thành</button>
          </div>
        </div>`
      : "";
    const phuCards = phus.map(ph => {
      const hasBattle = Object.values(ph.huyen || {}).some(h => h.historicalBattle && getBattleState(state, h.historicalBattle));
      const isHomePhu = state.player.homeRegion === mapFocusTran && state.player.homePhu === ph.id;
      return `<div class="map-card ${hasBattle ? "map-battle" : ""}"
                   onclick="window.mapDrillPhu('${mapFocusTran}','${ph.id}')">
        <div class="map-card-name">${ph.name}</div>
        <div class="map-card-spec">${ph.triPhu || "Tri Phủ: —"} · <span class="muted" style="font-size:0.78rem;">Phụ cận kinh thành</span></div>
        ${hasBattle ? '<div class="map-battle-badge">⚔️ Chiến Sự</div>' : ""}
        ${isHomePhu ? '<div class="map-current-badge" style="background:var(--gold-dark);color:#fff;top:auto;bottom:0.5rem;">🏠 Quê Nhà</div>' : ""}
        <div class="map-card-general">Quân phủ: ${ph.quanSo || 0}</div>
      </div>`;
    }).join("") || "<p class='muted text-center'>Chưa có dữ liệu</p>";
    grid.innerHTML = `
      ${kinhCard}
      <div style="margin:14px 0 8px;font-family:var(--font-title);font-size:0.95rem;color:var(--gold-light);letter-spacing:0.06em;">Phụ cận kinh thành — các Phủ</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;">${phuCards}</div>
    `;

  } else if (mapLevel === "kinh_shell") {
    const tran = getRegion(RegionId.THANG_LONG);
    const kt = getKinhThanh(RegionId.THANG_LONG);
    const rings = kt?.rings || {};
    const p = state.player;
    const canLa = playerCanKinhLaThanh(p);
    const canH = playerCanKinhHoangThanh(p);
    const canT = playerCanKinhTuCamThanh(p);
    const la = rings.laThanh;
    const ho = rings.hoangThanh;
    const tu = rings.tuCamThanh;
    crumb.innerHTML = `<span onclick="window.mapNavTo('tran')" style="cursor:pointer;text-decoration:underline;color:var(--gold-light);">Đàng Ngoài</span> › <span onclick="window.mapNavToKinhHub()" style="cursor:pointer;text-decoration:underline;color:var(--gold-light);">${escapeHtml(tran?.name || "")}</span> › <strong>Ba lớp Kinh thành</strong> · ${homeJump}`;

    const ringHtml = (key, r, can) => {
      if (!r) return "";
      const lockedCls = can ? "" : " map-kinh-locked";
      const crown = `<div class="map-kinh-crown-ico" aria-hidden="true">👑</div>`;
      const gLine = key === "la"
        ? `🛡 Tuần thành · cửa ô: ~${(r.wallGarrison ?? 0).toLocaleString()} quân`
        : `🛡 Đồn nội khối: ~${(r.garrison ?? 0).toLocaleString()} quân`;
      return `
        <div class="map-card map-kinh-crown-card map-kinh-ring-${key}${lockedCls}" onclick="window.mapEnterKinhRing('${key}')">
          ${crown}
          <div class="map-kinh-ring-tag">${escapeHtml(r.tagline || "")}</div>
          <div class="map-card-name" style="font-size:1.05rem;">${escapeHtml(r.name)}</div>
          <div class="map-card-spec" style="margin-top:6px;">${escapeHtml(r.shortDesc || "")}</div>
          <div class="map-battle-badge" style="margin-top:10px;font-size:0.78rem;">${gLine}</div>
          <div class="muted" style="font-size:0.78rem;margin-top:8px;line-height:1.5;">${escapeHtml(r.maaNote || "")}</div>
          ${!can ? `<div class="map-kinh-lock-hint">🔒 Bấm để xem yêu cầu mở khóa</div>` : `<div class="map-kinh-lock-hint" style="color:var(--gold-light);">✧ Được phép vào</div>`}
        </div>`;
    };

    grid.innerHTML = `
      <div class="muted" style="grid-column:1/-1;font-size:0.82rem;margin-bottom:12px;line-height:1.55;">Ba lớp thành xếp ngang theo trục <strong>phải → trái</strong>: <strong>La thành</strong> (thương phố &amp; thành quách) → <strong>Hoàng thành</strong> (Phủ Chúa &amp; Lục Phiên) → <strong>Tử cấm thành</strong> (cung Vua Lê &amp; hoàng gia).</div>
      <div style="grid-column:1/-1;display:flex;flex-direction:row-reverse;gap:12px;align-items:stretch;overflow-x:auto;padding-bottom:2px;">
        <div style="flex:1 1 220px;min-width:220px;">${ringHtml("la", la, canLa)}</div>
        <div style="flex:1 1 220px;min-width:220px;">${ringHtml("hoang", ho, canH)}</div>
        <div style="flex:1 1 220px;min-width:220px;">${ringHtml("tu", tu, canT)}</div>
      </div>
    `;

  } else if (mapLevel === "kinh_la") {
    const tran = getRegion(RegionId.THANG_LONG);
    const kt = getKinhThanh(RegionId.THANG_LONG);
    const la = kt?.rings?.laThanh;
    const p = state.player;
    const canH = playerCanKinhHoangThanh(p);
    const canT = playerCanKinhTuCamThanh(p);
    crumb.innerHTML = `<span onclick="window.mapNavTo('tran')" style="cursor:pointer;text-decoration:underline;color:var(--gold-light);">Đàng Ngoài</span> › <span onclick="window.mapNavToKinhHub()" style="cursor:pointer;text-decoration:underline;color:var(--gold-light);">${escapeHtml(tran?.name || "")}</span> › <span onclick="window.mapNavToKinhShell()" style="cursor:pointer;text-decoration:underline;color:var(--gold-light);">Ba lớp</span> › <strong>La thành</strong> · ${homeJump}`;
    grid.innerHTML = `
      <div class="map-card map-kinh-crown-card map-kinh-ring-la" style="grid-column:1/-1;">
        <div class="map-kinh-crown-ico">👑</div>
        <div class="map-card-name">${escapeHtml(la?.name || "La thành")}</div>
        <div class="muted" style="font-size:0.85rem;margin-top:8px;line-height:1.6;">${escapeHtml(la?.vibe || "")}</div>
        <div class="muted" style="font-size:0.82rem;margin-top:10px;line-height:1.55;">${escapeHtml(la?.shortDesc || "")}</div>
        <div class="box-plate" style="margin-top:12px;">
          <div class="muted" style="font-size:0.82rem;color:var(--text-main);line-height:1.55;margin-bottom:10px;">
            <strong>Trung tâm La thành</strong> (tương đương “trấn” ở rìa kinh thành). Từ đây có thể vào:
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <button class="btn-map-travel" onclick="window.mapKinhLaOpenPhungThien()">🏛 Phủ Phụng Thiên (2 huyện Quảng Đức · Thọ Xương)</button>
            <button class="btn-map-travel ${canH ? '' : ''}" onclick="window.mapEnterKinhRing('hoang')" ${!canH ? 'disabled' : ''}>
              🛡 Hoàng thành
            </button>
            <button class="btn-map-travel" onclick="window.mapEnterKinhRing('tu')" ${!canT ? 'disabled' : ''}>
              👑 Tử cấm thành
            </button>
          </div>
          <div class="muted" style="font-size:0.74rem;margin-top:10px;line-height:1.45;">
            Hoàng thành / Tử cấm thành có yêu cầu thân phận theo thứ bậc quan.
          </div>
        </div>
      </div>`;

  } else if (mapLevel === "kinh_hoang") {
    const tran = getRegion(RegionId.THANG_LONG);
    const kt = getKinhThanh(RegionId.THANG_LONG);
    const ho = kt?.rings?.hoangThanh;
    const luc = (ho?.lucPhien || []).map(x => `<li style="margin:4px 0;">${escapeHtml(x)}</li>`).join("");
    crumb.innerHTML = `<span onclick="window.mapNavTo('tran')" style="cursor:pointer;text-decoration:underline;color:var(--gold-light);">Đàng Ngoài</span> › <span onclick="window.mapNavToKinhHub()" style="cursor:pointer;text-decoration:underline;color:var(--gold-light);">${escapeHtml(tran?.name || "")}</span> › <span onclick="window.mapNavToKinhShell()" style="cursor:pointer;text-decoration:underline;color:var(--gold-light);">Ba lớp</span> › <strong>Hoàng thành</strong> · ${homeJump}`;
    grid.innerHTML = `
      <div class="map-card map-kinh-crown-card map-kinh-ring-hoang" style="grid-column:1/-1;">
        <div class="map-kinh-crown-ico">👑</div>
        <div class="map-card-name">${escapeHtml(ho?.name || "Hoàng thành")}</div>
        <div class="muted" style="font-size:0.85rem;margin-top:8px;line-height:1.6;"><strong>${escapeHtml(ho?.phuChua || "")}</strong></div>
        <div class="muted" style="font-size:0.82rem;margin-top:10px;line-height:1.55;">${escapeHtml(ho?.shortDesc || "")}</div>
        <div class="box-plate" style="margin-top:12px;text-align:left;">
          <div style="font-weight:700;color:var(--gold-light);margin-bottom:6px;">Lục Phiên (chia việc như Lục Bộ)</div>
          <ul style="margin:0;padding-left:1.1rem;font-size:0.82rem;color:var(--text-muted);line-height:1.5;">${luc}</ul>
        </div>
        <div class="muted" style="font-size:0.78rem;margin-top:10px;">${escapeHtml(ho?.maaNote || "")}</div>
      </div>`;

  } else if (mapLevel === "kinh_tu") {
    const tran = getRegion(RegionId.THANG_LONG);
    const kt = getKinhThanh(RegionId.THANG_LONG);
    const tu = kt?.rings?.tuCamThanh;
    const dyn = getDynastyInfo(state.ban || 1737);
    crumb.innerHTML = `<span onclick="window.mapNavTo('tran')" style="cursor:pointer;text-decoration:underline;color:var(--gold-light);">Đàng Ngoài</span> › <span onclick="window.mapNavToKinhHub()" style="cursor:pointer;text-decoration:underline;color:var(--gold-light);">${escapeHtml(tran?.name || "")}</span> › <span onclick="window.mapNavToKinhShell()" style="cursor:pointer;text-decoration:underline;color:var(--gold-light);">Ba lớp</span> › <strong>Tử cấm thành</strong> · ${homeJump}`;
    grid.innerHTML = `
      <div class="map-card map-kinh-crown-card map-kinh-ring-tu" style="grid-column:1/-1;">
        <div class="map-kinh-crown-ico">👑</div>
        <div class="map-card-name">${escapeHtml(tu?.name || "Tử cấm thành")}</div>
        <div class="muted" style="font-size:0.82rem;margin-top:10px;line-height:1.55;">${escapeHtml(tu?.shortDesc || "")}</div>
        <div class="box-plate" style="margin-top:12px;">
          <div style="font-size:0.82rem;color:var(--text-main);line-height:1.55;">Niên hiện tại (ước lượng trong game): <strong>Vua</strong> ${escapeHtml(dyn?.vua || "Lê")} · <strong>Chúa</strong> ${escapeHtml(dyn?.chua || "Trịnh")}.</div>
          <div class="muted" style="font-size:0.8rem;margin-top:8px;line-height:1.55;">${escapeHtml(tu?.royalNote || "")}</div>
        </div>
        <div class="muted" style="font-size:0.78rem;margin-top:10px;">${escapeHtml(tu?.maaNote || "")}</div>
      </div>`;

  } else if (mapLevel === "phu") {
    const tran = getRegion(mapFocusTran);
    const phu  = tran?.phu?.[mapFocusPhu];
    if (mapFocusTran === RegionId.THANG_LONG) {
      crumb.innerHTML = `<span onclick="window.mapNavTo('tran')" style="cursor:pointer;text-decoration:underline;color:var(--gold-light);">Đàng Ngoài</span> › <span onclick="window.mapNavToKinhHub()" style="cursor:pointer;text-decoration:underline;color:var(--gold-light);">${tran?.name || ""}</span> › Chọn Phủ (phụ cận) · ${homeJump}`;
    } else {
      crumb.innerHTML = `<span onclick="window.mapNavTo('tran')" style="cursor:pointer;text-decoration:underline;color:var(--gold-light);">Đàng Ngoài</span> › ${tran?.name || ""} · ${homeJump}`;
    }

    const phus = Object.values(tran?.phu || {});
    const isSinglePhu = phus.length <= 1;
    const centerPhuCard = `
      <div class="map-card map-current" style="border-color:rgba(212,175,55,0.45);grid-column:1/-1;">
        <div class="map-card-name">🏛 Trung tâm ${escapeHtml(phu?.name || "phủ")}</div>
        <div class="map-card-spec">Nha môn phủ · cổng khoa trường · trạm điều vận</div>
        <div class="map-card-general muted" style="font-size:0.78rem;">Từ đây có thể lên trung tâm trấn hoặc về trung tâm từng huyện.</div>
        <div style="margin-top:0.45rem;display:flex;flex-direction:column;gap:6px;">
          <button class="btn-map-travel" onclick="window.mapMoveToPhuCenter('${mapFocusTran}','${mapFocusPhu}')">🛤 Hành quân tới trung tâm phủ</button>
          <button class="btn-map-travel" onclick="window.mapMoveToTranCenter('${mapFocusTran}')">🏛 Lên trung tâm trấn</button>
        </div>
      </div>
    `;
    grid.innerHTML = centerPhuCard + phus.map(ph => {
      const hasBattle = Object.values(ph.huyen || {}).some(h => h.historicalBattle && getBattleState(state, h.historicalBattle));
      const isHomePhu = state.player.homeRegion === mapFocusTran && state.player.homePhu === ph.id;
      return `<div class="map-card ${hasBattle ? "map-battle" : ""}"
                   style="${isSinglePhu ? "grid-column:1/-1;" : ""}"
                   onclick="window.mapDrillPhu('${mapFocusTran}','${ph.id}')">
        <div class="map-card-name">${ph.name}</div>
        <div class="map-card-spec">${ph.triPhu || "Tri Phủ: —"}</div>
        ${hasBattle ? '<div class="map-battle-badge">⚔️ Chiến Sự</div>' : ""}
        ${isHomePhu ? '<div class="map-current-badge" style="background:var(--gold-dark);color:#fff;top:auto;bottom:0.5rem;">🏠 Quê Nhà</div>' : ""}
        <div class="map-card-general">Quân: ${ph.quanSo || 0}</div>
      </div>`;
    }).join("") || "<p class='muted text-center'>Chưa có dữ liệu</p>";

  } else if (mapLevel === "huyen") {
    const tran = getRegion(mapFocusTran);
    const phu  = tran?.phu?.[mapFocusPhu];
    const midUp = mapFocusTran === RegionId.THANG_LONG
      ? `onclick="window.mapNavToKinhHub()"`
      : `onclick="window.mapNavTo('phu')"`;
    crumb.innerHTML = `
      <span onclick="window.mapNavTo('tran')" style="cursor:pointer;text-decoration:underline;color:var(--gold-light);">Đàng Ngoài</span> ›
      <span ${midUp} style="cursor:pointer;text-decoration:underline;color:var(--gold-light);">${tran?.name}</span> ›
      ${phu?.name || ""} · ${homeJump}`;

    let huyens = Object.values(phu?.huyen || {});
    if (mapFocusTran === RegionId.THANG_LONG && mapFocusPhu === "phung_thien") {
      huyens = [...huyens].sort((a, b) => {
        if (a.id === "tho_xuong") return -1;
        if (b.id === "tho_xuong") return 1;
        return 0;
      });
    }
    const isSingleHuyen = huyens.length <= 1;
    const mySide = state.player.faction === Faction.NGHIA_QUAN ? Faction.NGHIA_QUAN : Faction.TRIEU_DINH;
    const myTotalGarrison = Object.values(state._huyenGarrisons || {})
      .filter(g => g?.faction === mySide)
      .reduce((sum, g) => sum + (g.quan || 0), 0);
    const enemySide = mySide === Faction.NGHIA_QUAN ? Faction.TRIEU_DINH : Faction.NGHIA_QUAN;
    const enemyTotalGarrison = Object.values(state._huyenGarrisons || {})
      .filter(g => g?.faction === enemySide)
      .reduce((sum, g) => sum + (g.quan || 0), 0);
    const huyenSummary = `
      <div class="box-plate" style="margin-bottom:10px;">
        <div class="muted" style="font-size:0.78rem;line-height:1.45;">
          🪖 Đồn trú toàn cục — Phe bạn: <strong class="gold-text">${myTotalGarrison.toLocaleString()}</strong> ·
          Phe địch: <strong>${enemyTotalGarrison.toLocaleString()}</strong>
        </div>
      </div>
    `;
    const kinhPhungThienInfo = (mapFocusTran === RegionId.THANG_LONG && mapFocusPhu === "phung_thien")
      ? `<div class="box-plate" style="margin-bottom:10px;border-color:rgba(245,217,128,0.35);">
          <div style="font-size:0.82rem;color:var(--text-main);line-height:1.5;">
            <strong>🏛 Kinh thành:</strong> <strong>Phủ Phụng Thiên</strong> là khu <em>phụ cận</em> quanh kinh thành, gồm 2 huyện <strong>Quảng Đức</strong> và <strong>Thọ Xương</strong>.
            Người <strong>triều đình</strong> (không truy nã) được <strong>nhập kinh theo quan lộ</strong> — không bị chặn như mặt trận ngoại tuyến.
          </div>
        </div>`
      : "";
    grid.innerHTML = kinhPhungThienInfo + huyenSummary + huyens.map(h => {
      const bs = h.historicalBattle ? getBattleState(state, h.historicalBattle) : null;
      const isHere = state.player.currentRegion === mapFocusTran && state.player.currentHuyen === h.id;
      const isHomeHuyen = state.player.homeRegion === mapFocusTran && state.player.homePhu === mapFocusPhu && state.player.homeHuyen === h.id;
      const ctrl = (typeof getHuyenControl === "function") ? getHuyenControl(state, h.id) : Faction.TRIEU_DINH;
      const isEnemy = ctrl !== mySide;
      const canGarrison = isHere && ctrl === mySide && !state.travel?.active && canPlayerCommandStrategicGarrison(state);
      const gInfo = state._huyenGarrisons?.[h.id];
      const gLine = gInfo
        ? `<div style="font-size:0.72rem;color:var(--text-dim);margin-top:4px;">Đồn trú: <strong>${(gInfo.quan || 0).toLocaleString()}</strong> ${gInfo.faction === Faction.NGHIA_QUAN ? "(NQ)" : "(TD)"} · Cấp ${gInfo.level || 1} · Sĩ khí ${typeof gInfo.morale === "number" ? gInfo.morale : 70}</div>`
        : "";
      const ctrlBadge = ctrl === Faction.NGHIA_QUAN
        ? `<div class="map-battle-badge">🚩 Nghĩa Quân</div>`
        : `<div class="map-current-badge" style="border-color:#7ab3d4;color:#7ab3d4;background:rgba(42,80,112,0.18);">⛳ Triều Đình</div>`;
      // Trong mô hình mới, Thọ Xương & Quảng Đức đều là “phụ cận kinh thành”, không tách nội thành/cận kinh.
      const kinhNộiBadge = "";
      return `<div class="map-card ${bs ? "map-battle" : ""} ${isHere ? "map-current" : ""}"
                   style="${isSingleHuyen ? "grid-column:1/-1;" : ""}"
                   onclick="window.mapDrillHuyen('${mapFocusTran}','${mapFocusPhu}','${h.id}')">
        <div class="map-card-name">${h.name}</div>
        <div class="map-card-spec">Tri Huyện: ${h.triHuyen || "Khuyết"}</div>
        ${kinhNộiBadge}
        ${bs ? `<div class="map-battle-badge">⚔️ ${bs.name}</div>` : ""}
        ${ctrlBadge}
        ${isHere ? '<div class="map-current-badge">📍 Đang Ở</div>' : ""}
        ${isHomeHuyen ? '<div class="map-current-badge" style="background:var(--gold-dark);color:#fff;top:auto;bottom:0.5rem;">🏠 Quê Nhà</div>' : ""}
        ${gLine}
        <div class="map-card-general muted" style="font-size:0.78rem;">${h.desc || ""}</div>
        <div style="margin-top:0.5rem; display:flex; flex-direction:column; gap:6px;">
          <button class="btn-map-travel" onclick="event.stopPropagation();window.mapMoveToHuyenCenter('${mapFocusTran}','${mapFocusPhu}','${h.id}')">🏛 Đến trung tâm huyện</button>
          ${isEnemy ? `<button class="btn-map-travel btn-map-siege" style="background:var(--danger-red); border-color:#ff9b9b;" onclick="event.stopPropagation();window.siegeHuyenUI('${mapFocusTran}','${mapFocusPhu}','${h.id}')">🏰 Công Huyện</button>` : ""}
          ${canGarrison ? `<button class="btn-map-travel btn-map-assign" onclick="event.stopPropagation();window.assignGarrisonUI()">🪖 Đồn Trú (chia quân)</button>` : ""}
          ${canGarrison ? `<button class="btn-map-travel btn-map-recall" onclick="event.stopPropagation();window.recallGarrisonUI()">📣 Thu Hồi Đồn Trú</button>` : ""}
          ${canGarrison ? `<button class="btn-map-travel btn-map-upgrade" onclick="event.stopPropagation();window.upgradeGarrisonUI()">🏗 Nâng Cấp Đồn Trú</button>` : ""}
          <button class="btn-map-travel btn-map-move-huyen" onclick="event.stopPropagation();window.moveToHuyen('${mapFocusTran}','${mapFocusPhu}','${h.id}')">🛤 Hành Quân</button>
        </div>
      </div>`;
    }).join("") || "<p class='muted text-center'>Không có dữ liệu huyện</p>";
    
  } else if (mapLevel === "tong") {
    const tran = getRegion(mapFocusTran);
    const huyen = tran?.phu?.[mapFocusPhu]?.huyen?.[mapFocusHuyen];
    crumb.innerHTML = `
      <span onclick="window.mapNavTo('tran')" style="cursor:pointer;text-decoration:underline;color:var(--gold-light);">Đàng Ngoài</span> ›
      <span onclick="window.mapNavTo('huyen')" style="cursor:pointer;text-decoration:underline;color:var(--gold-light);">${huyen?.name || ""}</span> › Các Tổng · ${homeJump}`;

    const bs = huyen?.historicalBattle ? getBattleState(state, huyen.historicalBattle) : null;
    const warBanner = getWarBanner(bs);

    const geoData = getLowerRegions(state, mapFocusHuyen);
    const tongs = Object.values(geoData.tong || {});
    const isSingleTong = tongs.length <= 1;
    // Tính % xã bị chiếm trong từng Tổng để hiển thị thanh progress
    grid.innerHTML = warBanner + tongs.map(t => {
      const isHere = state.player.currentTong === t.id && state.player.currentHuyen === mapFocusHuyen;
      const isHomeTong = state.player.homeHuyen === mapFocusHuyen && state.player.homeTong === t.id;
      const xaList = Object.values(t.xa || {});
      const xaChiem = xaList.filter(x => x.control === "nghia_quan").length;
      const pctChiem = xaList.length > 0 ? Math.round(xaChiem / xaList.length * 100) : 0;
      const isChiem = t.control === "nghia_quan";
      const controlFlag = isChiem ? "🚩 Nghĩa Quân Chiếm" : "⛳ Triều Đình Kiểm Soát";
      const controlStyle = isChiem ? "color:#f87171" : "color:#7ab3d4";
      const barColor = pctChiem > 50 ? "#f87171" : pctChiem > 0 ? "#c17f24" : "#3a7c32";

      let xaHtml = "";
      if (xaChiem > 0) {
        xaHtml = `<div style="margin-top:4px;">
          <div style="font-size:0.68rem;color:var(--text-dim);margin-bottom:2px;">Nghĩa quân kiểm soát: ${xaChiem}/${xaList.length} xã (${pctChiem}%)</div>
          <div style="height:4px;background:rgba(255,255,255,0.08);border-radius:2px;overflow:hidden;">
            <div style="height:100%;width:${pctChiem}%;background:${barColor};transition:width 0.4s;"></div>
          </div>
        </div>`;
      }

      const currentBadge = isHere ? '<div class="map-current-badge">📍 Đang Ở</div>' : "";
      const homeBadge = isHomeTong ? '<div class="map-current-badge" style="background:var(--gold-dark);color:#fff;top:auto;bottom:0.5rem;">🏠 Quê Nhà</div>' : "";

      return `<div class="map-card ${isHere ? "map-current" : ""}" style="${isSingleTong ? "grid-column:1/-1;" : ""}" onclick="window.mapDrillTong('${t.id}')">
        <div class="map-card-name">${t.name}</div>
        <div class="map-card-spec">Dân số: ${t.pop} (Suất đinh: ${t.suatDinh})</div>
        <div style="font-size:0.75rem;margin-top:0.3rem;${controlStyle}">${controlFlag}</div>
        ${xaHtml}
        ${currentBadge}
        ${homeBadge}
      </div>`;
    }).join("");

  } else if (mapLevel === "xa") {
    const geoData = getLowerRegions(state, mapFocusHuyen);
    const tong = geoData.tong[mapFocusTong];
    crumb.innerHTML = `
      <span onclick="window.mapNavTo('tong')" style="cursor:pointer;text-decoration:underline;color:var(--gold-light);">${tong?.name || ""}</span> › Các Xã · ${homeJump}`;

    const tran = getRegion(mapFocusTran);
    const huyen = tran?.phu?.[mapFocusPhu]?.huyen?.[mapFocusHuyen];
    const bs = huyen?.historicalBattle ? getBattleState(state, huyen.historicalBattle) : null;
    const warBanner = getWarBanner(bs);

    const xas = Object.values(tong?.xa || {});
    const isSingleXa = xas.length <= 1;
    grid.innerHTML = warBanner + xas.map(x => {
      const isHere = state.player.currentXa === x.id && state.player.currentHuyen === mapFocusHuyen;
      const isHomeXa = state.player.homeHuyen === mapFocusHuyen && state.player.homeTong === mapFocusTong && state.player.homeXa === x.id;
      const isChiem = x.control === "nghia_quan";
      const controlFlag = isChiem
        ? `<span style="color:#f87171;font-weight:bold;">🚩 Nghĩa Quân Chiếm</span>`
        : `<span style="color:#7ab3d4;">⛳ Triều Đình Kiểm Soát</span>`;
      return `<div class="map-card ${isHere ? "map-current" : ""}" style="${isSingleXa ? "grid-column:1/-1;" : ""}" onclick="window.mapDrillXa('${x.id}')">
        <div class="map-card-name">${x.name}</div>
        <div class="map-card-spec">Dân số: ${x.pop} (Đinh: ${x.suatDinh})</div>
        <div style="font-size:0.75rem;margin-top:0.3rem;">Quản lý: ${controlFlag}</div>
        ${isHere ? '<div class="map-current-badge">📍 Đang Ở</div>' : ""}
        ${isHomeXa ? '<div class="map-current-badge" style="background:var(--gold-dark);color:#fff;top:auto;bottom:0.5rem;">🏠 Quê Nhà</div>' : ""}
      </div>`;
    }).join("");

  } else if (mapLevel === "lang") {
    const geoData = getLowerRegions(state, mapFocusHuyen);
    const tong = geoData.tong[mapFocusTong];
    const xa = tong?.xa[mapFocusXa];
    crumb.innerHTML = `
      <span onclick="window.mapNavTo('xa')" style="cursor:pointer;text-decoration:underline;color:var(--gold-light);">${xa?.name || ""}</span> › Các Làng / Thôn · ${homeJump}`;

    const tran = getRegion(mapFocusTran);
    const huyen = tran?.phu?.[mapFocusPhu]?.huyen?.[mapFocusHuyen];
    const bs = huyen?.historicalBattle ? getBattleState(state, huyen.historicalBattle) : null;
    const warBanner = getWarBanner(bs);

    const langs = Object.values(xa?.lang || {});
    const isSingleLang = langs.length <= 1;
    grid.innerHTML = warBanner + langs.map(l => {
      const isHere = state.player.currentHuyen === mapFocusHuyen && state.player.currentLang === l.id;
      const isHomeLang = state.player.homeHuyen === mapFocusHuyen && state.player.homeTong === mapFocusTong && state.player.homeXa === mapFocusXa && state.player.homeLang === l.id;
      const isRebel = state.player.faction === Faction.NGHIA_QUAN;
      const enemyFlag = isRebel ? Faction.TRIEU_DINH : Faction.NGHIA_QUAN;
      const isEnemyControlled = xa.control === enemyFlag;

      return `<div class="map-card ${isHere ? "map-current" : ""}" style="${isSingleLang ? "grid-column:1/-1;" : ""}">
        <div class="map-card-name">${l.name}</div>
        <div class="map-card-spec">Dân số: ${l.pop}</div>
        <div class="map-card-general">Suất đinh: ${l.suatDinh}</div>
        ${isHere ? '<div class="map-current-badge">📍 Đang Ở</div>' : ""}
        ${isHomeLang ? '<div class="map-current-badge" style="background:var(--gold-dark);color:#fff;top:auto;bottom:0.5rem;">🏠 Quê Nhà</div>' : ""}
        <div style="margin-top:0.4rem; display:flex; flex-direction:column; gap:6px;">
          <button class="btn-map-travel btn-map-move-lang" onclick="event.stopPropagation();window.travelToLang('${l.id}')">🛤 Di Chuyển Đến ${l.name}</button>
          ${isEnemyControlled ? `<button class="btn-map-travel" style="background:var(--danger-red); border-color:#ff9b9b;" onclick="event.stopPropagation();window.actionAttackVillage('${l.id}')">⚔️ Tấn Công Chiếm Đóng</button>` : ""}
        </div>
      </div>`;
    }).join("");
  }
  if (isUxAssistEnabled() && !state.onboarding?.firstTravelDone) {
    grid.insertAdjacentHTML("afterbegin", `<div class="ux-helper-card">Đường đi nhanh: chọn Trấn -> Phủ -> Huyện -> Tổng/Xã/Làng rồi bấm <strong>Di Chuyển</strong>.</div>`);
  }
  refreshMapBattlePanelIfVisible();
}

// Dịch mảng id binh chủng → tên tiếng Việt
function maaNames(ids) {
  if (!ids || ids.length === 0) return "Dân binh";
  const lookup = Object.values(MenAtArmType);
  return ids.map(id => {
    const found = lookup.find(m => m.id === id);
    return found ? found.name : id.replace(/_/g, " ");
  }).join(", ");
}

function renderBattlePanel(battleId) {
  const panel = $("battlePanel");
  if (!panel) return;

  const bs = getBattleState(state, battleId);
  if (!bs) { panel.classList.add("hidden"); return; }

  panel.classList.remove("hidden");

  const sumF = Math.max(1, (bs.atkForce || 0) + (bs.defForce || 0));
  const forceRatio = (bs.atkForce || 0) / sumF;
  const thTilt = (bs.thangVong || 50) / 100;
  const atkPct = clamp((forceRatio * 0.72 + thTilt * 0.28) * 100, 6, 94);
  const defPct = 100 - atkPct;
  const atkWin = bs.thangVong > 50;
  const sa = Math.max(1, Number(bs.battleStartAtk) || 1);
  const sd = Math.max(1, Number(bs.battleStartDef) || 1);
  const atkQuanW = clamp(Math.round((100 * (bs.atkForce || 0)) / sa), 2, 100);
  const defQuanW = clamp(Math.round((100 * (bs.defForce || 0)) / sd), 2, 100);
  const atkMorW = clamp(Number(bs.atkMorale) || 0, 0, 100);
  const defMorW = clamp(Number(bs.defMorale) || 0, 0, 100);
  const atkLuongW = clamp(Number(bs.atkLuong) || 0, 0, 100);
  const defLuongW = clamp(Number(bs.defLuong) || 0, 0, 100);
  const dayN = typeof bs.battleDay === "number" ? bs.battleDay : (bs.daysElapsed ?? 0);

  const title = _battleLocLabel ? `⚔️ Trận ${escapeHtml(_battleLocLabel)}` : `⚔️ ${bs.name}`;
  panel.innerHTML = `
    <div class="battle-panel-title">${title}</div>
    <div class="battle-desc">${bs.desc}</div>
    <div class="battle-meta">Năm ${bs.startYear || "?"} — ${bs.isActive ? "ĐANG DIỄN RA" : "ĐÃ KẾT THÚC"} · Ngày mặt trận: <strong>${dayN}</strong></div>

    <div class="battle-combatants">
      <div class="battle-side atk">
        <div class="battle-side-name">⚔️ ${bs.atkName}</div>
        <div class="battle-side-general" style="margin-bottom:0.2rem;">Tướng: ${bs.atkCommander}</div>
        <div class="muted" style="font-size:0.72rem;margin-bottom:0.2rem;">Năng lực chỉ huy: <strong class="gold-text">${Math.max(1, Math.min(100, Number(bs.atkCommanderStat || 50)))}</strong></div>
        <div class="muted" style="font-size:0.72rem;margin-bottom:0.25rem;">Tướng lĩnh: <strong class="gold-text">${(bs.atkKnights || 0)}</strong></div>
        <div style="font-size:0.7rem; color:${bs.atkQualObj?.color || '#ccc'}; font-weight:bold; margin-bottom:0.4rem;">Chất lượng: ${bs.atkQualObj?.label || 'Chưa rõ'}</div>
        <div class="battle-side-force">Quân: ${bs.atkForce?.toLocaleString()}</div>
        <div class="battle-stat-barwrap" aria-hidden="true"><div class="battle-stat-bar"><div class="battle-stat-fill battle-stat-fill--quan-atk" style="width:${atkQuanW}%"></div></div><span class="battle-stat-cap">còn ${atkQuanW}% so đầu trận</span></div>
        <div class="battle-side-morale">Sĩ khí: ${bs.atkMorale}/100</div>
        <div class="battle-stat-barwrap"><div class="battle-stat-bar"><div class="battle-stat-fill battle-stat-fill--morale" style="width:${atkMorW}%"></div></div></div>
        <div class="battle-side-supply">Lương: ${bs.atkLuong}/100</div>
        <div class="battle-stat-barwrap"><div class="battle-stat-bar"><div class="battle-stat-fill battle-stat-fill--supply" style="width:${atkLuongW}%"></div></div></div>
        <div class="battle-arm" style="font-size:0.72rem;color:var(--text-muted);margin-top:0.3rem;">Binh chủng: <em>${maaNames(bs.atkMenAtArm)}</em></div>
      </div>
      <div class="battle-center-info">
        <div class="battle-thangvong-label" style="margin-bottom:0.35rem;">Thế trận (thang vọng)</div>
        <div class="battle-thangvong-bar battle-thangvong-bar--tall">
          <div class="btv-atk" style="width:${atkPct}%;background:${atkWin ? "#c0392b" : "#c0392b66"}"></div>
          <div class="btv-def" style="width:${defPct}%;background:${!atkWin ? "#2980b9" : "#2980b966"}"></div>
        </div>
        <div class="battle-thangvong-label">${atkWin ? "⚔️ Nghiêng về công / nghĩa quân" : "🛡 Nghiêng về thủ / triều"}</div>
        <div class="muted" style="font-size:0.7rem;margin-top:8px;line-height:1.45;">Thanh đỏ lam: tỉ lệ quân thực (nặng) + thế trận. Hai bên: thanh xám = quân còn, xanh lá = sĩ khí, xanh dương = lương.</div>
        <div class="muted" style="font-size:0.72rem;margin-top:4px;">Tiền tuyến mỗi ngày: đánh chính diện, truy kích, rút lui tạm, mộ binh bổ sung — khởi nghĩa kéo dài <strong>không kết</strong> trước mốc năm mục lịch sử.</div>
        <div style="font-size:0.72rem;color:var(--text-dim);margin-top:4px;">Lịch game: ngày ${state.gameDay}/${state.monthIndex}/${state.ban}</div>
      </div>
      <div class="battle-side def">
        <div class="battle-side-name">🛡 ${bs.defName}</div>
        <div class="battle-side-general" style="margin-bottom:0.2rem;">Tướng: ${bs.defCommander}</div>
        <div class="muted" style="font-size:0.72rem;margin-bottom:0.2rem;">Năng lực chỉ huy: <strong class="gold-text">${Math.max(1, Math.min(100, Number(bs.defCommanderStat || 50)))}</strong></div>
        <div class="muted" style="font-size:0.72rem;margin-bottom:0.25rem;">Tướng lĩnh: <strong class="gold-text">${(bs.defKnights || 0)}</strong></div>
        <div style="font-size:0.7rem; color:${bs.defQualObj?.color || '#ccc'}; font-weight:bold; margin-bottom:0.4rem;">Chất lượng: ${bs.defQualObj?.label || 'Chưa rõ'}</div>
        <div class="battle-side-force">Quân: ${bs.defForce?.toLocaleString()}</div>
        <div class="battle-stat-barwrap"><div class="battle-stat-bar"><div class="battle-stat-fill battle-stat-fill--quan-def" style="width:${defQuanW}%"></div></div><span class="battle-stat-cap">còn ${defQuanW}% so đầu trận</span></div>
        <div class="battle-side-morale">Sĩ khí: ${bs.defMorale}/100</div>
        <div class="battle-stat-barwrap"><div class="battle-stat-bar"><div class="battle-stat-fill battle-stat-fill--morale" style="width:${defMorW}%"></div></div></div>
        <div class="battle-side-supply">Lương: ${bs.defLuong}/100</div>
        <div class="battle-stat-barwrap"><div class="battle-stat-bar"><div class="battle-stat-fill battle-stat-fill--supply" style="width:${defLuongW}%"></div></div></div>
        <div class="battle-arm" style="font-size:0.72rem;color:var(--text-muted);margin-top:0.3rem;">Binh chủng: <em>${maaNames(bs.defMenAtArm)}</em></div>
      </div>
    </div>
  `;
}

// ──────────────────────────────────────────────────
// GAMEPLAY ACTIONS (window.* bindings for HTML)
// ──────────────────────────────────────────────────
function doAction(fn, args = []) {
  if (!state) return;
  if ((state.jailDays || 0) > 0) {
    showToast("Đang bị giam — không thể hành động.", true);
    return;
  }
  if (isTraveling && isTraveling(state)) {
    showToast("Đang hành quân — không thể làm việc khác.", true);
    return;
  }
  audioManager.unlock().catch(() => {});
  const before = {
    rank: state.player.rank,
    hocVi: state.player.hocVi,
    voThuat: state.player.voThuat,
    hocVan: state.player.hocVan,
    ngoaiGiao: state.player.ngoaiGiao,
    quanLy: state.player.quanLy,
    muuMeo: state.player.muuMeo,
    spouse: state.player.giaDinh?.vo || "",
  };
  const result = fn(state, ...args);
  if (!result) return null;
  if (!result.ok && result.msg) {
    const fnName = fn?.name || "";
    let msg = result.msg;
    if (fnName === "actionTradeItem") msg += " Gợi ý: mở tab Chợ và thử giao dịch số lượng nhỏ.";
    if (fnName === "actionLuyenVo" || fnName === "actionMoBinh") msg += " Gợi ý: kiểm tra yêu cầu ở mục Binh Mã trong tab Hoạt Động.";
    if (fnName === "startTravel" || fnName === "siegeHuyen") msg += " Gợi ý: mở tab Bản Đồ và chọn đúng huyện/xã trước khi đi.";
    if (fnName === "actionThiHuong" || fnName === "actionThiHoi" || fnName === "actionThiDinh") msg += " Gợi ý: nâng Học Vấn trước, rồi vào tab Xã Hội để đăng ký khoa cử.";
    if (fnName === "actionBacCu" || fnName === "actionThangTienVo") msg += " Gợi ý: nâng Võ Thuật ở tab Hoạt Động trước khi xin thăng võ.";
    showToast(msg, true);
    return result;
  }
  if (result.sfx) playSfxKey(result.sfx);
  if (result.shake) state.uiShakeProfile = true;
  const fnName = fn?.name || "";
  if (fnName === "actionCayRuong" || fnName === "actionKhaiThacDacSan" || fnName === "actionBuonLauMuoi") {
    ensureUxState();
    state.onboarding.firstResourceActionDone = true;
  }

  // If action returns battle logs, show as readable combat report
  if (result.battleLogs && Array.isArray(result.battleLogs)) {
    state.uiCelebrations = state.uiCelebrations || [];
    const html = result.battleLogs.slice(0, 18).map(x => escapeHtml(x)).join("<br>");
    state.uiCelebrations.unshift({
      title: "CHIẾN BÁO",
      body: html,
      sfx: result.sfx || "battle"
    });
  }

  // Quest update & milestone celebrations
  initQuestsIfNeeded(state);
  tickQuests(state);

  // If an action created a pending event (e.g., captured after rout), show it immediately
  if (state.pendingEvent) {
    openEventModal(state.pendingEvent);
    return result;
  }
  const p = state.player;
  if (p.rank !== before.rank) {
    state.uiCelebrations = state.uiCelebrations || [];
    state.uiCelebrations.unshift({
      title: "CHIẾU CHỈ TRIỆU VỀ",
      body: `Tước vị đổi: <strong>${escapeHtml(RankLabel[before.rank] || before.rank)}</strong> → <strong>${escapeHtml(RankLabel[p.rank] || p.rank)}</strong>`,
      sfx: "battle"
    });
  }
  if ((p.hocVi || "") !== (before.hocVi || "")) {
    state.uiCelebrations = state.uiCelebrations || [];
    state.uiCelebrations.unshift({
      title: "BẢNG VÀNG ĐỀ DANH",
      body: `Học vị: <strong>${escapeHtml(before.hocVi || "Vô Danh")}</strong> → <strong>${escapeHtml(p.hocVi || "Vô Danh")}</strong>`,
      sfx: "coin"
    });
  }
  if (!before.spouse && p.giaDinh?.vo) {
    state.uiCelebrations = state.uiCelebrations || [];
    state.uiCelebrations.unshift({
      title: "HỶ SỰ LÂM MÔN",
      body: `Thành thân cùng <strong>${escapeHtml(p.giaDinh.vo)}</strong>.`,
      sfx: "coin"
    });
  }
  // Slow down core stat progression (perk-like pacing): gains are accumulated fractionally.
  if (!p._coreStatAccum) p._coreStatAccum = { ngoaiGiao: 0, voThuat: 0, quanLy: 0, muuMeo: 0, hocVan: 0 };
  const CORE_KEYS = ["ngoaiGiao", "voThuat", "quanLy", "muuMeo", "hocVan"];
  for (const k of CORE_KEYS) {
    const oldV = Number(before[k] || 0);
    const newV = Number(p[k] || 0);
    const delta = newV - oldV;
    if (delta <= 0) continue; // keep losses/flat as-is
    p[k] = oldV;
    const diff = state?.difficulty || "normal";
    const statRate = diff === "easy" ? 0.3 : (diff === "hardcore" ? 0.2 : 0.26);
    p._coreStatAccum[k] = (p._coreStatAccum[k] || 0) + delta * statRate;
    const gain = Math.floor(p._coreStatAccum[k]);
    if (gain > 0) {
      p[k] = Math.min(100, p[k] + gain);
      p._coreStatAccum[k] -= gain;
    }
  }

  showFeedback(result);
  render();
  return result;
}

function pushMarketFeed(text) {
  _marketTradeFeed.unshift({ text, label: `Tháng ${state.monthIndex}/${state.ban}` });
  if (_marketTradeFeed.length > MARKET_FEED_LIMIT) _marketTradeFeed.length = MARKET_FEED_LIMIT;
}

window.doMarketBuy  = key => {
  const qty = parseInt($(`mktQty_${key}`)?.value || "1");
  const quote = getTradeQuote(state, key, true);
  const res = doAction(actionTradeItem, [key, true, qty]);
  if (res?.ok) {
    ensureUxState();
    state.onboarding.firstTradeDone = true;
    pushMarketFeed(`🛒 Mua ${qty} ${ItemsDb[key]?.name || key} · ${Math.max(1, quote.unitPrice || 1)}Q/đv`);
  }
};
window.doMarketSell = key => {
  const qty = parseInt($(`mktQty_${key}`)?.value || "1");
  const quote = getTradeQuote(state, key, false);
  const res = doAction(actionTradeItem, [key, false, qty]);
  if (res?.ok) {
    ensureUxState();
    state.onboarding.firstTradeDone = true;
    pushMarketFeed(`💰 Bán ${qty} ${ItemsDb[key]?.name || key} · ${Math.max(1, quote.unitPrice || 1)}Q/đv`);
  }
};
window.doMarketHaggle = key => doAction(actionMarketHaggle, [key]);
window.acceptMarketContract = () => doAction(actionAcceptMarketContract);

window.setPropCat   = cat => {
  const el = $("propList");
  if (el) el.dataset.cat = cat;
  renderProperties();
};
window.doBuild      = id => doAction(actionXayNha, [id]);
window.doDemo       = id => doAction(actionDemolishNha, [id]);
window.doLuyenVo    = ()  => doAction(actionLuyenVo);
window.doDiHoc      = ()  => doAction(actionDiHoc);
window.doThiHuong   = ()  => window.openActivityPlanner("thi_huong");
window.doThiHoi     = ()  => window.openActivityPlanner("thi_hoi");
window.doThiDinh    = ()  => window.openActivityPlanner("thi_dinh");
window.doBacCu      = ()  => window.openActivityPlanner("bac_cu");
window.doThangTienVo= ()  => doAction(actionThangTienVo);
window.doLuanChuyen = ()  => doAction(actionLuanChuyenKhaoKhoa);
window.doXinBonNhiem= ()  => doAction(actionXinChucBoNhiem);

window.doSetFocus   = lid => {
  const result = setLifestyleFocus(state, lid);
  showToast(result.msg);
  ensureUxState();
  state.onboarding.firstFocusDone = true;
  render();
};

window.quickStartEconomy = () => {
  const r = doAction(actionCayRuong);
  if (r?.ok) showToast("Đã làm hành động sinh kế nhanh: Cày Ruộng.");
};

function autoSaveMonthly(prevMonth, prevYear) {
  if (!state) return;
  if (state.monthIndex === prevMonth && state.ban === prevYear) return;
  writeAutoSaveSnapshot("month");
}
window.doUnlockPerk = (lid, pid) => {
  const result = unlockPerk(state, lid, pid);
  if (!result.ok) { showToast(result.msg, true); return; }
  showToast(result.msg);
  playSfxKey("coin");
  render();
};

window.actionOopVo  = () => {
  const p = state.player;
  if (p.theLuc < 20) { showToast("Thể lực không đủ.", true); return; }
  if (!p.giaDinh.vo) { showToast("Chưa có vợ. Hãy chờ sự kiện hôn nhân!", true); return; }
  p.theLuc -= 20;
  // Chance-based conception: mỗi lần ngẫu nhiên trong khoảng 5–10%
  const conceiveChance = 0.05 + Math.random() * 0.05;
  if (Math.random() > conceiveChance) {
    showToast("Đêm ân ái trôi qua… nhưng chưa có tin vui.");
    logLine(state, "Thắp nến ân ái — chưa có tin vui.", false);
    render();
    return;
  }

  const isBoy = Math.random() < 0.52;
  const defaultName = isBoy ? "Con Trai" : "Con Gái";
  const childName = (prompt(`Có tin vui! Đặt tên cho ${isBoy ? "con trai" : "con gái"} (tối đa 32 ký tự):`, defaultName) || defaultName).trim().slice(0, 32);
  if (!p.children) p.children = [];
  p.children.push({ name: childName, gender: isBoy ? "nam" : "nu", bornAt: { ban: state.ban, monthIndex: state.monthIndex, gameDay: state.gameDay } });
  p.giaDinh.con = (p.giaDinh.con || 0) + 1;
  showToast(`${p.giaDinh.vo} sinh hạ ${isBoy ? "con trai" : "con gái"}: ${childName}.`);
  logLine(state, `👶 Sinh con: ${childName} (${isBoy ? "trai" : "gái"}). Dòng tộc tiếp nối.`, true);
  render();
};

// Map navigation
window.mapDrillTran  = tranId => {
  mapFocusTran = tranId;
  mapLevel = tranId === RegionId.THANG_LONG ? "kinh_hub" : "phu";
  renderMap();
};
window.mapOpenKinhShell = () => {
  if (!state) return;
  mapFocusTran = RegionId.THANG_LONG;
  mapLevel = "kinh_shell";
  renderMap();
};
window.mapNavToKinhShell = () => {
  mapFocusTran = RegionId.THANG_LONG;
  mapLevel = "kinh_shell";
  renderMap();
};
window.mapEnterKinhRing = (key) => {
  if (!state) return;
  const p = state.player;
  if (key === "la") {
    if (!playerCanKinhLaThanh(p)) {
      showToast("La thành: cần thân phận triều đình và không bị truy nã. Nghĩa quân không nhập theo lối dân thường.", true);
      return;
    }
    mapLevel = "kinh_la";
  } else if (key === "hoang") {
    if (!playerCanKinhHoangThanh(p)) {
      showToast("Hoàng thành (Phủ Chúa & Lục Phiên): Thượng thư, Tham/Bồi tụng, Đại tướng. Hiến sát sứ (dưới tầm đốc trấn về triều) không vào được.", true);
      return;
    }
    mapLevel = "kinh_hoang";
  } else if (key === "tu") {
    if (!playerCanKinhTuCamThanh(p)) {
      showToast("Tử cấm thành chỉ dành cho Thượng thư hoặc Tham tụng / Bồi tụng.", true);
      return;
    }
    mapLevel = "kinh_tu";
  }
  renderMap();
};
window.mapKinhLaDrillHuyen = () => {
  const kt = getKinhThanh(RegionId.THANG_LONG);
  if (!kt?.corePhuId || !kt?.coreHuyenId) return;
  mapFocusTran = RegionId.THANG_LONG;
  mapFocusPhu = kt.corePhuId;
  mapFocusHuyen = kt.coreHuyenId;
  mapFocusTong = null;
  mapFocusXa = null;
  mapLevel = "huyen";
  renderMap();
};
// Từ màn La thành: vào danh sách huyện phụ cận (Phủ Phụng Thiên) để chọn Quảng Đức hoặc Thọ Xương.
window.mapKinhLaOpenPhungThien = () => {
  if (!state) return;
  mapFocusTran = RegionId.THANG_LONG;
  mapFocusPhu = "phung_thien";
  mapFocusHuyen = null;
  mapFocusTong = null;
  mapFocusXa = null;
  mapLevel = "huyen";
  renderMap();
};
window.mapKinhLaTravel = () => {
  const kt = getKinhThanh(RegionId.THANG_LONG);
  if (!kt?.corePhuId || !kt?.coreHuyenId) return;
  window.moveToHuyen(RegionId.THANG_LONG, kt.corePhuId, kt.coreHuyenId);
};
window.mapKinhLaSiege = () => {
  const kt = getKinhThanh(RegionId.THANG_LONG);
  if (!kt?.corePhuId || !kt?.coreHuyenId) return;
  window.siegeHuyenUI(RegionId.THANG_LONG, kt.corePhuId, kt.coreHuyenId);
};
window.mapMoveToTranCenter = (tranId) => {
  const tran = getRegion(tranId);
  const phuId = Object.keys(tran?.phu || {})[0];
  const huyenId = phuId ? Object.keys(tran?.phu?.[phuId]?.huyen || {})[0] : null;
  if (!phuId || !huyenId) { showToast("Không tìm thấy trung tâm trấn.", true); return; }
  window.moveToHuyen(tranId, phuId, huyenId);
};
window.mapMoveToPhuCenter = (tranId, phuId) => {
  const huyenId = Object.keys(getRegion(tranId)?.phu?.[phuId]?.huyen || {})[0];
  if (!huyenId) { showToast("Không tìm thấy trung tâm phủ.", true); return; }
  window.moveToHuyen(tranId, phuId, huyenId);
};
window.mapMoveToHuyenCenter = (tranId, phuId, huyenId) => {
  const geo = getLowerRegions(state, huyenId);
  const tongId = Object.keys(geo?.tong || {})[0];
  const xaId = tongId ? Object.keys(geo.tong[tongId]?.xa || {})[0] : null;
  const langId = xaId ? Object.keys(geo.tong[tongId]?.xa?.[xaId]?.lang || {})[0] : null;
  if (!tongId || !xaId || !langId) { showToast("Không tìm thấy trung tâm huyện.", true); return; }
  const dest = { regionId: tranId, phuId, huyenId, tongId, xaId, langId };
  const res = startTravel(state, dest, "Hành quân tới trung tâm huyện");
  if (!res.ok) { showToast(res.msg || "Không thể hành quân.", true); return; }
  showFeedback(res);
  render();
};
window.mapNavToKinhHub = () => {
  if (mapFocusTran !== RegionId.THANG_LONG) return;
  mapLevel = "kinh_hub";
  mapFocusPhu = null;
  mapFocusHuyen = null;
  mapFocusTong = null;
  mapFocusXa = null;
  renderMap();
};
window.mapDrillPhu   = (tranId, phuId) => { mapLevel = "huyen"; mapFocusTran = tranId; mapFocusPhu = phuId; renderMap(); };
window.mapDrillHuyen = (tranId, phuId, huyenId) => {
  mapLevel = "tong"; mapFocusTran = tranId; mapFocusPhu = phuId; mapFocusHuyen = huyenId;
  renderMap();
  // Gọi SAU renderMap() vì renderMap() luôn ẩn battlePanel ở đầu hàm
  const tran = getRegion(tranId);
  const huyen = tran?.phu?.[phuId]?.huyen?.[huyenId];
  _battleLocLabel = huyen?.name ? `${huyen.name}` : (huyenId ? `${huyenId}` : "");
  if (huyen?.historicalBattle) renderBattlePanel(huyen.historicalBattle);
};
window.mapDrillTong  = tongId => { mapLevel = "xa"; mapFocusTong = tongId; renderMap(); };
window.mapDrillXa    = xaId => { mapLevel = "lang"; mapFocusXa = xaId; renderMap(); };

window.mapNavTo      = level => {
  if (level === "phu" && mapFocusTran === RegionId.THANG_LONG) {
    mapLevel = "kinh_hub";
    mapFocusPhu = null;
    mapFocusHuyen = null;
    mapFocusTong = null;
    mapFocusXa = null;
    renderMap();
    return;
  }
  mapLevel = level;
  if (level === "tran") { mapFocusTran = null; mapFocusPhu = null; }
  if (level === "phu")  { mapFocusPhu = null; }
  if (level === "huyen"){ mapFocusHuyen = null; }
  if (level === "tong") { mapFocusTong = null; }
  if (level === "xa")   { mapFocusXa = null; }
  renderMap();
};

window.mapGoHome = () => {
  const p = state?.player;
  if (!p?.homeRegion || !p?.homePhu || !p?.homeHuyen) return;
  mapFocusTran = p.homeRegion;
  mapFocusPhu = p.homePhu;
  mapFocusHuyen = p.homeHuyen;
  mapFocusTong = p.homeTong || null;
  mapFocusXa = p.homeXa || null;
  mapLevel = (p.homeTong && p.homeXa) ? "lang" : "huyen";
  renderMap();
};

window.mapGoMissionTarget = () => {
  const m = state?._clanMission;
  if (!m?.active) return;
  if (!m.targetRegion || !m.targetPhu || !m.targetHuyen) {
    showToast("Kèo này chưa có tọa độ mục tiêu rõ ràng.", true);
    return;
  }
  mapFocusTran = m.targetRegion;
  mapFocusPhu = m.targetPhu;
  mapFocusHuyen = m.targetHuyen;
  mapFocusTong = m.targetTong || null;
  mapFocusXa = m.targetXa || null;
  mapLevel = (m.targetTong && m.targetXa) ? "lang" : "huyen";
  renderMap();
};

window.travelToLang = (langId) => {
  const p = state.player;
  if (p.currentHuyen === mapFocusHuyen && p.currentLang === langId) { showToast("Bạn đã ở đây rồi!"); return; }
  if (p.theLuc < 30) { showToast("Thể lực không đủ để di chuyển (cần 30).", true); return; }
  if (p._attached?.battleId) { showToast(`Bạn đang thuộc quân ${p._attached.armyName}. Không thể tự ý tách đội.`, true); return; }

  // Kiểm tra chiếm đóng khi di chuyển (Xã địch kiểm soát)
  const geoDataCheck = getLowerRegions(state, mapFocusHuyen);
  const targetXaObj = geoDataCheck.tong[mapFocusTong]?.xa[mapFocusXa];
  const isRebel = p.faction === Faction.NGHIA_QUAN;
  const enemyFlag = isRebel ? Faction.TRIEU_DINH : Faction.NGHIA_QUAN;

  if (targetXaObj && targetXaObj.control === enemyFlag) {
    if (!kinhDinhCivilAccess(p, mapFocusTran, mapFocusPhu)) {
      showToast("Vùng này do địch kiểm soát! Phải tấn công chiếm đóng mới có thể vào.", true);
      return;
    }
    logLine(state, "Đi trong địa bàn Phụng Thiên — tuần môn ghi nhận lệnh triều, cho qua xã.", false);
  }

  // Restrict movement for commoners
  let caught = false;
  let phat = 0;
  if (p.homeHuyen !== mapFocusHuyen) { // Rời khỏi huyện nhà phải có cớ
    const isOfficial = [PlayerRank.LY_TRUONG, PlayerRank.CHANH_TONG, PlayerRank.TRI_HUYEN, PlayerRank.TRI_PHU, PlayerRank.HIEN_SAT_SU, PlayerRank.THUONG_THU, PlayerRank.DOI_TRUONG, PlayerRank.CAI_CO, PlayerRank.BACH_HO, PlayerRank.TONG_LINH, PlayerRank.DO_DOC, PlayerRank.DAI_TUONG].includes(p.rank);
    const isRebel = p.faction === "nghia_quan" || p.faction === "cuop";
    if (!isOfficial && !isRebel) {
       if (Math.random() < 0.3) {
         caught = true;
         phat = Math.floor(Math.random() * 3);
       }
    }
  }

  p.theLuc -= 30;

  if (caught) {
    if (phat === 0) {
      if (p.tien >= 20) {
         p.tien -= 20;
         logLine(state, "Bị Tuần Kiểm chặn đường rời huyện, phải đút lót 20 quan để đi tiếp.");
         showToast("Đút lót 20 quan!");
      } else {
         p.theLuc -= 20;
         logLine(state, "Bị Tuần Kiểm bắt gặp, lột sạch rồi đánh đuổi về bản quán!");
         showToast("Bị đánh đuổi về quê!");
         return; 
      }
    } else if (phat === 1) {
      p.theLuc -= 30;
      logLine(state, "Bị Tuần Kiểm đánh một trận vì rời làng không có công lệnh. Bị tống về quê.");
      showToast("Bị tống về quê!");
      return; 
    } else {
      logLine(state, "Bị Tuần Kiểm tra hỏi, may dùng miệng lưỡi qua mặt được.");
    }
  }

  const dest = { regionId: mapFocusTran, phuId: mapFocusPhu, huyenId: mapFocusHuyen, tongId: mapFocusTong, xaId: mapFocusXa, langId };
  const res = startTravel(state, dest, `Hành hương`);
  if (!res.ok) { showToast(res.msg || "Không thể đi.", true); return; }
  ensureUxState();
  state.onboarding.firstTravelDone = true;
  showFeedback(res);
  render();
};

window.siegeHuyenUI = (tranId, phuId, huyenId) => {
  if (!state) return;
  // allow both factions to siege; if you're still a commoner in triều đình, you are not allowed to go full war
  if (state.player.rank === PlayerRank.DAN_THUONG && state.player.faction === Faction.TRIEU_DINH) {
    showToast("Dân đen không được tự ý công huyện. Hãy dựng cờ tự trị hoặc đỗ võ/văn để có danh phận.", true);
    return;
  }
  doAction(siegeHuyen, [tranId, phuId, huyenId]);
};

window.assignGarrisonUI = () => {
  if (!state) return;
  if (!canPlayerCommandStrategicGarrison(state)) {
    showToast("Chỉ Đốc trấn trở lên hoặc võ tướng cao (không phải bách hộ / chưởng cơ / cai cơ) mới điều động được đồn trú phe.", true);
    return;
  }
  const raw = prompt("Số quân để lại đồn trú (tối thiểu 40; phải giữ ít nhất 30 quân trong đội thân binh):", "80");
  if (raw === null) return;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) { showToast("Nhập số hợp lệ.", true); return; }
  const r = actionAssignGarrison(state, n);
  if (!r.ok) { showToast(r.msg, true); return; }
  showFeedback(r);
  render();
};

window.recallGarrisonUI = () => {
  if (!state) return;
  if (!canPlayerCommandStrategicGarrison(state)) {
    showToast("Chỉ Đốc trấn trở lên hoặc võ tướng cao (không phải bách hộ / chưởng cơ / cai cơ) mới điều động được đồn trú phe.", true);
    return;
  }
  const r = actionRecallGarrison(state);
  if (!r.ok) { showToast(r.msg, true); return; }
  showFeedback(r);
  render();
};

window.upgradeGarrisonUI = () => {
  if (!state) return;
  if (!canPlayerCommandStrategicGarrison(state)) {
    showToast("Chỉ Đốc trấn trở lên hoặc võ tướng cao (không phải bách hộ / chưởng cơ / cai cơ) mới điều động được đồn trú phe.", true);
    return;
  }
  const hid = state.player?.currentHuyen;
  const g = state._huyenGarrisons?.[hid];
  const cur = g?.level || 1;
  const q = g?.quan || 0;
  const next = cur + 1;
  if (!g) { showToast("Không có đồn trú ở đây.", true); return; }
  if (cur >= 3) { showToast("Đồn trú đã tối đa (cấp 3)."); return; }
  const ok = confirm(`Nâng cấp đồn trú huyện này từ cấp ${cur} → ${next}?\n(Đồn trú: ${q} quân)\nSẽ tốn tiền/thóc của kho phe.`);
  if (!ok) return;
  const r = actionUpgradeGarrison(state);
  if (!r.ok) { showToast(r.msg, true); return; }
  showFeedback(r);
  render();
};

window.moveToHuyen = (tranId, phuId, huyenId) => {
  if (!state) return;
  const p = state.player;
  if (p.theLuc < 30) { showToast("Thể lực không đủ để hành quân (cần 30).", true); return; }
  if (p._attached?.battleId) { showToast(`Bạn đang thuộc quân ${p._attached.armyName}. Không thể tự ý đi lung tung.`, true); return; }

  const mySide = p.faction === Faction.NGHIA_QUAN ? Faction.NGHIA_QUAN : Faction.TRIEU_DINH;
  const ctrl = (typeof getHuyenControl === "function") ? getHuyenControl(state, huyenId) : Faction.TRIEU_DINH;
  if (ctrl !== mySide) {
    if (kinhDinhCivilAccess(p, tranId, phuId)) {
      logLine(state, "📜 Nhập Phủ Phụng Thiên theo lộ triều đình — thông hành nhập kinh (thi cử / công quan), không xét như xâm nhập phe địch.", true);
    } else if (tranId === RegionId.THANG_LONG && phuId === "phung_thien" && p.faction === Faction.TRIEU_DINH && (p.wantedLevel || 0) > 0) {
      showToast("Đang truy nã — không được nhập kinh theo quan lộ!", true);
      return;
    } else {
      showToast("Đất địch kiểm soát. Phải Công Huyện trước!", true);
      return;
    }
  }

  mapFocusTran = tranId;
  mapFocusPhu = phuId;
  mapFocusHuyen = huyenId;
  const geoData = getLowerRegions(state, huyenId);
  const tongId = Object.keys(geoData.tong || {})[0];
  const xaId = tongId ? Object.keys(geoData.tong[tongId].xa || {})[0] : null;
  const langId = xaId ? Object.keys(geoData.tong[tongId].xa[xaId].lang || {})[0] : null;
  if (!tongId || !xaId || !langId) { showToast("Không có dữ liệu hành quân.", true); return; }

  const dest = { regionId: tranId, phuId, huyenId, tongId, xaId, langId };
  const res = startTravel(state, dest, "Hành quân tới huyện");
  if (!res.ok) { showToast(res.msg || "Không thể hành quân.", true); return; }
  showFeedback(res);
  render();
};

// NPC Modal — tương tác phong phú
window.openNpcModal = npcId => {
  const npc = state.npcById[npcId];
  if (!npc) return;
  const p = state.player;

  const opColor = npc.opinion > 40 ? "#88e88d" : npc.opinion < 0 ? "#f87171" : "#aaa";
  const opBar   = Math.max(0, Math.min(100, npc.opinion + 50)); // -50..100 → 0..150 → clamp 0..100

  setText("npcModalTitle", npc.name);
  $("npcOpinionMeter").innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
      <span>Cảm tình: <strong style="color:${opColor}">${npc.opinion}</strong>/100</span>
      <span style="font-size:0.75rem;color:var(--text-dim);">${npc.opinion > 60 ? "🤝 Tâm phúc" : npc.opinion > 20 ? "😐 Bình thường" : npc.opinion < -10 ? "😠 Thù địch" : "🫤 Lạnh nhạt"}</span>
    </div>
    <div style="height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;">
      <div style="height:100%;width:${opBar}%;background:${opColor};transition:width 0.4s;"></div>
    </div>
  `;
    let clanHtml = "";
    if (npc.clanId) {
      const clan = state.clans?.find(c => c.id === npc.clanId);
      clanHtml = `<div style="font-size:0.78rem;margin-top:0.3rem;color:var(--text-dim);">Dòng họ: ${clan?.name || "?"}</div>`;
    }

    $("npcModalBody").innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:0.82rem;margin-top:0.5rem;">
        <div>Tuổi: <strong class="gold-text">${npc.age}</strong></div>
        <div>Chức: <strong class="gold-text">${RankLabel[npc.rank] || npc.rank || "Dân"}</strong></div>
        <div>Tỉnh: <span style="color:var(--text-muted);">${RegionsDb[npc.currentRegion]?.name || "?"}</span></div>
        <div>Quân: <span style="color:var(--text-muted);">${npc.quanSo || 0}</span></div>
      </div>
      <div style="margin-top:0.4rem;font-size:0.8rem;color:var(--text-dim);">
        Đặc tính: <em>${(npc.traits || []).join(", ") || "Bình thường"}</em>
      </div>
      ${clanHtml}
    `;

  const canMarry  = !p.giaDinh?.vo && npc.gender === "female" && npc.opinion >= 40 && p.tien >= 50;
  const canBribe  = p.tien >= 30;
  const canIntimidate = p.voThuat >= 30 && p.quanSo >= 10;
  const canBroker = !p.giaDinh?.vo && p.tien >= 25;

  const ranks = Object.values(PlayerRank);
  const isHighRank = ranks.indexOf(p.rank) >= ranks.indexOf(PlayerRank.TRI_HUYEN);
  const canAppoint = isHighRank && npc.opinion > 50 && npc.rank === PlayerRank.DAN_THUONG && p.tien >= 100;
  const lockBribe = canBribe ? "" : "Cần 30 quan để lót tay.";
  const lockMarry = canMarry ? "" : (p.giaDinh?.vo ? "Bạn đã có gia thất." : (npc.gender !== "female" ? "Tương tác này hiện chỉ mở cho NPC nữ." : (npc.opinion < 40 ? "Cần cảm tình >= 40." : "Cần 50 quan sính lễ.")));
  const lockIntimidate = canIntimidate ? "" : (p.voThuat < 30 ? "Cần Võ Thuật >= 30." : "Cần ít nhất 10 quân.");
  const lockAlly = (npc.opinion >= 60 && p.tien >= 20) ? "" : (npc.opinion < 60 ? "Cần cảm tình >= 60." : "Cần 20 quan đặt tiệc kết minh.");
  const lockBroker = canBroker ? "" : (p.giaDinh?.vo ? "Bạn đã có gia thất." : "Cần 25 quan phí mai mối.");
  const lockAppoint = canAppoint ? "" : (!isHighRank ? "Cần chức từ Tri Huyện trở lên." : (npc.opinion <= 50 ? "Cần cảm tình > 50." : (npc.rank !== PlayerRank.DAN_THUONG ? "NPC phải là dân thường." : "Cần 100 quan gia lộc.")));
  
  $("npcInteractions").innerHTML = `
    <button class="action-btn mt-1" onclick="window.doTangRuou('${npcId}')">🍶 Mời Rượu<br><span style="font-size:0.72rem;color:var(--text-dim);">−1 Rượu · +Cảm Tình</span></button>
    <button class="action-btn mt-1 ${lockBribe ? "soft-locked" : ""}" data-lock-reason="${escapeHtml(lockBribe)}" title="${escapeHtml(lockBribe)}" onclick="window.doBribe('${npcId}')">💰 Lót Tay<br><span style="font-size:0.72rem;color:var(--text-dim);">−30 Quan · +20 Cảm Tình</span></button>
    <button class="action-btn mt-1 highlight-gold ${lockMarry ? "soft-locked" : ""}" data-lock-reason="${escapeHtml(lockMarry)}" title="${escapeHtml(lockMarry)}" onclick="window.doKetHon('${npcId}')">💍 Thành Thân<br><span style="font-size:0.72rem;color:var(--text-dim);">Cần tình cảm 40+, −50 Quan · +Uy Tín</span></button>
    <button class="action-btn mt-1 highlight-red ${lockIntimidate ? "soft-locked" : ""}" data-lock-reason="${escapeHtml(lockIntimidate)}" title="${escapeHtml(lockIntimidate)}" onclick="window.doIntimidate('${npcId}')">😤 Uy Hiếp<br><span style="font-size:0.72rem;color:var(--text-dim);">Cần Võ 30+, 10 Quân · Ép phục tùng</span></button>
    <button class="action-btn mt-1 ${lockAlly ? "soft-locked" : ""}" data-lock-reason="${escapeHtml(lockAlly)}" title="${escapeHtml(lockAlly)}" onclick="window.doMakeAlly('${npcId}')">🤝 Kết Minh<br><span style="font-size:0.72rem;color:var(--text-dim);">Cần tình cảm 60+ · −20 Quan</span></button>
    <button class="action-btn mt-1" onclick="window.doSpyOn('${npcId}')">🕵 Do Thám<br><span style="font-size:0.72rem;color:var(--text-dim);">Lấy tin mật; thành công +1 Mưu Mẹo (tỉ lệ phụ thuộc Mưu Mẹo)</span></button>
    <button class="action-btn mt-1 ${lockBroker ? "soft-locked" : ""}" data-lock-reason="${escapeHtml(lockBroker)}" title="${escapeHtml(lockBroker)}" onclick="window.doMaiMoi('${npcId}')">💌 Nhờ Mai Mối<br><span style="font-size:0.72rem;color:var(--text-dim);">−25 Quan · tăng cửa cưới hỏi</span></button>
    ${isHighRank ? `<button class="action-btn highlight-blue mt-1 ${lockAppoint ? "soft-locked" : ""}" data-lock-reason="${escapeHtml(lockAppoint)}" title="${escapeHtml(lockAppoint)}" onclick="window.doAppointSub('${npcId}')">📜 Bổ Nhiệm Thuộc Tướng<br><span style="font-size:0.72rem;color:var(--text-dim);">Cần CT 50+, −100 Quan · Thu nhận dưới trướng</span></button>` : ""}
  `;
  $("npcModal").setAttribute("aria-hidden", "false");
  $("npcModal").classList.add("open");
};

window.doAppointSub = npcId => {
  const npc = state.npcById[npcId];
  const p = state.player;
  if (!npc) return;
  if (p.tien < 100) { showToast("Cần 100 Quan gia lộc bổ nhiệm.", true); return; }
  if (npc.opinion < 50) { showToast("Cảm tình chưa đủ (cần 50+).", true); return; }
  if (npc.rank !== PlayerRank.DAN_THUONG) { showToast("Người này đang có chức vụ, không thể thu nạp.", true); return; }
  
  p.tien -= 100;
  npc.rank = PlayerRank.DOI_TRUONG; // Cho thăng làm Đội Trưởng dưới quyền
  npc._isSubordinate = true;
  npc.opinion = 100;
  p.uyTinCong += 30;
  logLine(state, `Bổ nhiệm ${npc.name} làm thuộc tướng dưới quyền. Y vô cùng cảm kích!`, true);
  showToast(`Phá lệ thi ân — ${npc.name} cúc cung tận tụy!`);
  render(); window.openNpcModal(npcId);
};

window.doTangRuou = npcId => {
  const result = actionTangRuouNPC(state, npcId);
  if (!result.ok) { showToast(result.msg, true); return; }
  showFeedback(result); render();
};

window.doBribe = npcId => {
  const npc = state.npcById[npcId];
  const p = state.player;
  if (!npc) return;
  if (p.tien < 30) { showToast("Cần 30 Quan để lót tay.", true); return; }
  p.tien -= 30;
  npc.opinion = Math.min(100, npc.opinion + 20);
  logLine(state, `Lót tay ${npc.name} 30 Quan. Cảm tình tăng nhanh.`);
  showToast(`${npc.name}: Cảm tình +20`);
  render(); window.openNpcModal(npcId);
};

window.doIntimidate = npcId => {
  const npc = state.npcById[npcId];
  const p = state.player;
  if (!npc) return;
  if (p.voThuat < 30) { showToast("Cần Võ Thuật ≥ 30.", true); return; }
  if (p.quanSo < 10)  { showToast("Cần ≥ 10 quân để áp lực.", true); return; }
  const success = Math.random() < (0.3 + p.voThuat * 0.005);
  if (success) {
    npc.opinion = Math.max(-50, npc.opinion - 30);
    npc._fear = (npc._fear || 0) + 20;
    logLine(state, `Uy hiếp ${npc.name} thành công. Y khiếp sợ phục tùng.`);
    showToast(`${npc.name} khiếp sợ — phục tùng tạm thời!`);
  } else {
    npc.opinion -= 10; p.uyTinCong -= 5;
    logLine(state, `Uy hiếp ${npc.name} thất bại. Mất mặt!`);
    showToast("Uy hiếp thất bại — mất uy tín!", true);
  }
  render(); window.openNpcModal(npcId);
};

window.doMakeAlly = npcId => {
  const npc = state.npcById[npcId];
  const p = state.player;
  if (!npc) return;
  if (npc.opinion < 60) { showToast("Cần cảm tình ≥ 60 để kết minh.", true); return; }
  if (p.tien < 20) { showToast("Cần 20 Quan đặt tiệc kết minh.", true); return; }
  p.tien -= 20;
  npc._isAlly = true;
  npc.opinion = Math.min(100, npc.opinion + 10);
  p.uyTinCong += 15; p.danhVong += 10;
  logLine(state, `Kết minh với ${npc.name}. Từ nay có thêm nội ứng!`, true);
  showToast(`Kết minh với ${npc.name} thành công! +Uy Tín +Danh Vọng`);
  render(); window.openNpcModal(npcId);
};

window.doSpyOn = npcId => {
  const npc = state.npcById[npcId];
  const p = state.player;
  if (!npc) return;
  const success = Math.random() < (0.4 + p.muuMeo * 0.005);
  if (success) {
    const infos = [
      `${npc.name} đang nợ ${Math.floor(Math.random()*200)+50} quan`,
      `${npc.name} có liên hệ bí mật với ${state.npcs[Math.floor(Math.random()*state.npcs.length)]?.name || "người lạ"}`,
      `${npc.name} đang ngầm thu mua vũ khí`,
      `${npc.name} bất mãn với lý trưởng hiện tại`,
      `${npc.name} có ruộng đất riêng chưa khai`,
    ];
    const info = infos[Math.floor(Math.random() * infos.length)];
    p.muuMeo = Math.min(100, p.muuMeo + 1);
    logLine(state, `Do thám thành công: "${info}"`);
    const intel = actionAdvanceClanMissionIntel(state, npcId);
    if (intel?.ok) {
      showToast("Đã lấy đủ tin mật cho kèo dòng họ. Quay lại tab Nhiệm Vụ để ra tay.");
    }
    showToast(`Tin mật: ${info} (+1 Mưu Mẹo)`);
  } else {
    p.uyTinCong -= 10;
    logLine(state, `Do thám thất bại! Bị ${npc.name} phát hiện. Uy tín giảm.`);
    showToast("Bị phát hiện! −10 Uy Tín", true);
  }
  render();
};

window.doMaiMoi = npcId => {
  const npc = state.npcById[npcId];
  const p = state.player;
  if (!npc) return;
  if (p.giaDinh?.vo) { showToast("Bạn đã có gia thất.", true); return; }
  if (p.tien < 25) { showToast("Cần 25 quan phí mai mối.", true); return; }
  p.tien -= 25;
  npc.opinion = Math.min(100, (npc.opinion || 0) + 12);
  if (npc.clanId) state.clanFavor[npc.clanId] = Math.min(100, (state.clanFavor?.[npc.clanId] || 0) + 6);
  logLine(state, `Nhờ bà mối nối lời với ${npc.name}. Cửa hôn phối sáng hơn, nhà gái bớt gắt.`);
  showToast("Mai mối thành công: +12 cảm tình");
  render(); window.openNpcModal(npcId);
};

window.doKetHon = npcId => {
  const npc = state.npcById[npcId];
  const p = state.player;
  if (p.giaDinh?.vo) { showToast("Đã có vợ rồi!", true); return; }
  if (!npc) return;
  let extraBride = 0;
  if (npc.clanId) {
    const members = (state.clans?.find(c => c.id === npc.clanId)?.memberIds || []).map(id => state.npcById[id]).filter(Boolean);
    const avgClan = members.length ? Math.round(members.reduce((s, n) => s + (n.opinion || 0), 0) / members.length) : 0;
    if (avgClan < 0) { showToast("Dòng họ nhà gái ghét bạn, cấm cửa hôn phối!", true); return; }
    if (avgClan < 25) extraBride = 60;
    if (avgClan >= 65) extraBride = 0;
  }
  if (npc.opinion < 40) { showToast("Cảm tình chưa đủ (cần 40+).", true); return; }
  const totalBride = 50 + extraBride;
  if (p.tien < totalBride)  { showToast(`Cần ≥ ${totalBride} Quan sính lễ (${extraBride > 0 ? "đội giá do họ chưa thuận" : "mức chuẩn"}).`, true); return; }
  p.tien -= totalBride;
  if (!p.giaDinh) p.giaDinh = {};
  p.giaDinh.vo = npc.name;
  p.uyTinCong += 15; p.danhVong += 20;
  npc.opinion = 80;
  logLine(state, `Lễ thành thân với ${npc.name}. Hạnh phúc đôi lứa! ${extraBride > 0 ? "Nhà gái làm khó, sính lễ đội lên." : ""}`, true);
  showToast(`Kết hôn với ${npc.name}!`);
  render();
  $("npcModal").classList.remove("open");
};

// Clan Modal
window._clanModalTab = window._clanModalTab || "overview";
window.setClanModalTab = (tab) => {
  window._clanModalTab = (tab === "missions") ? "missions" : "overview";
  const currentClanId = window._clanModalClanId;
  if (currentClanId) window.openClanModal(currentClanId);
};

window.openClanModal = clanId => {
  const clan = state.clans?.find(c => c.id === clanId);
  if (!clan) return;
  if (window._clanModalClanId && window._clanModalClanId !== clanId) {
    window._clanModalTab = "overview";
  }
  window._clanModalClanId = clanId;
  const p = state.player;
  const patroningThis = p._patronClanId === clanId;
  const canPatron = (p.rank === PlayerRank.DAN_THUONG || p.rank === PlayerRank.PHU_HO);
  const localOthers = (state.village?.clanIds || []).filter(id => id !== clanId);
  let rivalId = localOthers[0] || null;
  if (localOthers.length > 1) {
    localOthers.sort((a, b) => {
      const ao = (state.clans?.find(c => c.id === a)?.quyenLuc || 0);
      const bo = (state.clans?.find(c => c.id === b)?.quyenLuc || 0);
      return bo - ao;
    });
    rivalId = localOthers[0] || rivalId;
  }
  const rivalName = state.clans?.find(c => c.id === rivalId)?.name || "họ đối nghịch";
  const favor = state.clanFavor?.[clanId] || 0;

  const members = clan.memberIds.map(id => {
    const npc = state.npcById[id];
    if (!npc) return "";
    const opColor = npc.opinion > 30 ? "#88e88d" : npc.opinion < 0 ? "#f87171" : "#aaa";
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:0.3rem 0;border-bottom:1px solid rgba(154,122,50,0.1);">
      <span style="font-size:0.85rem;cursor:pointer;" onclick="window.openNpcModal('${npc.id}')">${npc.name} <span style="color:var(--text-dim);font-size:0.72rem;">${RankLabel[npc.rank] || ""}</span></span>
      <span style="color:${opColor};font-size:0.8rem;">CT: ${npc.opinion}</span>
    </div>`;
  }).join("");

  const attitude = (clan.attitude === "hostile" || clan.attitude === "Thù ghét") ? "⚔️ Thù địch — Dòng họ này chống lại bạn" :
                   (clan.attitude === "friendly" || clan.attitude === "Kính trọng" || clan.attitude === "Đồng minh") ? "🤝 Thân thiện — Đồng minh tiềm năng" :
                   "🫤 Trung lập — Chưa có quan hệ rõ ràng";
  const pressureMode = state.clanPressureMode || "standard";
  const clanStats = state._clanQuestStats || { total: 0, trom_ga: 0, pha_vuon: 0, boi_ban: 0, mediate: 0 };
  const isMissionTab = window._clanModalTab === "missions";
  const missionCards = [
    { icon: "🐔", title: "Trộm Gà Bắt Chó", prog: clanStats.trom_ga || 0, goal: 2, hint: "Kèo nhẹ, kiếm nóng nhanh." },
    { icon: "💩", title: "Ném Phân Vườn Rau", prog: clanStats.pha_vuon || 0, goal: 2, hint: "Phá mặt mũi đối thủ." },
    { icon: "🗣️", title: "Bêu Xấu Chợ Sớm", prog: clanStats.boi_ban || 0, goal: 2, hint: "Đòn bẩn kéo ảnh hưởng." },
    { icon: "🕊️", title: "Dàn Hòa Hai Họ", prog: clanStats.mediate || 0, goal: 1, hint: "Kèo ngoại giao khó." },
    { icon: "🕳️", title: "Tổng Phi Vụ Bẩn", prog: clanStats.total || 0, goal: 8, hint: "Chuỗi nhiệm vụ dài, nặng." },
  ];
  const missionHtml = missionCards.map(m => {
    const pct = Math.max(0, Math.min(100, Math.round((Math.min(m.prog, m.goal) / m.goal) * 100)));
    return `<div class="quest-card" style="margin-top:8px;">
      <div class="quest-title">${m.icon} ${escapeHtml(m.title)}</div>
      <div class="quest-desc">${escapeHtml(m.hint)}</div>
      <div class="quest-progress-track"><div class="quest-progress-fill" style="width:${pct}%;"></div></div>
      <div class="quest-meta"><span>Tiến độ: <strong class="gold-text">${Math.min(m.prog, m.goal)}/${m.goal}</strong></span></div>
    </div>`;
  }).join("");
  const activeMission = state._clanMission?.active ? state._clanMission : null;
  const missionTargetNpc = activeMission ? state.npcById?.[activeMission.targetNpcId] : null;
  const missionOwnerClan = activeMission ? state.clans?.find(c => c.id === activeMission.clanId) : null;
  const missionTargetClan = activeMission ? state.clans?.find(c => c.id === activeMission.targetClanId) : null;
  const hasMissionFromOtherClan = !!activeMission && activeMission.clanId !== clanId;
  const atMissionHuyen = !!activeMission && (!activeMission.targetHuyen || state.player.currentHuyen === activeMission.targetHuyen);
  const atMissionXa = !!activeMission && (!activeMission.targetXa || !state.player.currentXa || state.player.currentXa === activeMission.targetXa);
  const missionLocationOk = atMissionHuyen && atMissionXa;

  // Reuse NPC modal làm clan detail modal
  setText("npcModalTitle", `Dòng Họ ${clan.name}`);
  $("npcOpinionMeter").innerHTML = `
    <div style="font-size:0.85rem;margin-bottom:0.4rem;">${attitude}</div>
    <div style="font-size:0.82rem;color:var(--text-muted);">Quyền lực: <strong class="gold-text">${clan.quyenLuc}</strong> | Thành viên: <strong class="gold-text">${clan.memberIds.length}</strong> | Ân tình: <strong class="gold-text">${favor > 0 ? "+" : ""}${favor}</strong></div>
  `;
  $("npcModalBody").innerHTML = `
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin:0.2rem 0 0.8rem;">
      <button class="btn-tiny ${!isMissionTab ? "active" : ""}" onclick="window.setClanModalTab('overview')">Tổng Quan Dòng Họ</button>
      <button class="btn-tiny ${isMissionTab ? "active" : ""}" onclick="window.setClanModalTab('missions')">Nhiệm Vụ Dòng Họ</button>
    </div>
    ${!isMissionTab ? `
      <div class="ux-helper-card" style="margin:0.2rem 0 0.7rem;">
        <div style="font-size:0.82rem;color:var(--text-muted);line-height:1.4;">
          <strong class="gold-text">Luật ngầm dân làng:</strong> Nương họ thì đỡ bị bóp làm ăn nhưng phải nộp tô ngầm.
          Không nương ai thì dễ bị chặn đường thu tiền.
        </div>
      </div>
      <h4 style="margin:0.6rem 0 0.3rem;font-size:0.85rem;color:var(--gold-light);font-family:var(--font-title);">Thành Viên Dòng Họ</h4>
      ${members || "<p style='color:var(--text-dim);font-size:0.8rem;'>Không có thành viên.</p>"}
    ` : `
      <div class="ux-helper-card" style="margin:0.1rem 0 0.6rem;">
        <div style="font-size:0.82rem;color:var(--text-muted);line-height:1.4;">
          Kèo dòng họ chỉ hiện trong tab này để đỡ rối. Làm xong nhiệm vụ thì tự biến mất ở bảng nhiệm vụ chính.
        </div>
      </div>
      ${missionHtml}
    `}
  `;
  const missionActionHtml = hasMissionFromOtherClan ? `
    <div class="ux-helper-card">
      Bạn đang nhận kèo của <strong class="gold-text">${escapeHtml(missionOwnerClan?.name || "dòng họ khác")}</strong>.
      Hãy quay về đúng dòng họ đó để tiếp tục.
    </div>
  ` : (!activeMission ? `
    <button class="action-btn mt-1 ${(p.theLuc < 18 || p.faction === Faction.NGHIA_QUAN) ? "soft-locked" : ""}" data-lock-reason="${escapeHtml((p.faction === Faction.NGHIA_QUAN) ? "Nghĩa quân khó làm việc kín." : (p.theLuc < 18 ? "Cần 18 thể lực." : ""))}" title="${escapeHtml((p.faction === Faction.NGHIA_QUAN) ? "Nghĩa quân khó làm việc kín." : (p.theLuc < 18 ? "Cần 18 thể lực." : ""))}" onclick="window.doClanJob('${clanId}','trom_ga')">📌 Nhận Kèo Trộm Gà<br><span style="font-size:0.72rem;">Nhận kèo xong phải tự đi do thám mục tiêu</span></button>
    <button class="action-btn mt-1 ${(p.theLuc < 20 || p.faction === Faction.NGHIA_QUAN) ? "soft-locked" : ""}" data-lock-reason="${escapeHtml((p.faction === Faction.NGHIA_QUAN) ? "Nghĩa quân khó làm việc kín." : (p.theLuc < 20 ? "Cần 20 thể lực." : ""))}" title="${escapeHtml((p.faction === Faction.NGHIA_QUAN) ? "Nghĩa quân khó làm việc kín." : (p.theLuc < 20 ? "Cần 20 thể lực." : ""))}" onclick="window.doClanJob('${clanId}','pha_vuon')">📌 Nhận Kèo Phá Vườn<br><span style="font-size:0.72rem;">Phải lấy đủ tin mới được ra tay</span></button>
    <button class="action-btn mt-1 ${(p.theLuc < 22 || p.faction === Faction.NGHIA_QUAN) ? "soft-locked" : ""}" data-lock-reason="${escapeHtml((p.faction === Faction.NGHIA_QUAN) ? "Nghĩa quân khó làm việc kín." : (p.theLuc < 22 ? "Cần 22 thể lực." : ""))}" title="${escapeHtml((p.faction === Faction.NGHIA_QUAN) ? "Nghĩa quân khó làm việc kín." : (p.theLuc < 22 ? "Cần 22 thể lực." : ""))}" onclick="window.doClanJob('${clanId}','boi_ban')">📌 Nhận Kèo Bêu Xấu<br><span style="font-size:0.72rem;">Nhiệm vụ nhiều bước, không auto random</span></button>
  ` : `
    <div class="quest-card" style="margin-bottom:8px;">
      <div class="quest-title">🎯 Kèo Đang Nhận: ${escapeHtml(activeMission.jobName || "Phi vụ dòng họ")}</div>
      <div class="quest-desc">Mục tiêu: ${escapeHtml(missionTargetClan?.name || "Dòng họ đối nghịch")} · Đầu mối: ${escapeHtml(missionTargetNpc?.name || "Không rõ")}</div>
      <div class="quest-meta">
        <span>Bước hiện tại: <strong class="gold-text">${activeMission.step === "intel" ? "Do thám lấy tin" : "Sẵn sàng ra tay"}</strong></span>
        <span>Hạn: ngày ${Math.max(0, (activeMission.expiresDay || 0) - ((state.ban - 1737) * 360 + state.monthIndex * 30 + (state.gameDay || 1)))} còn lại</span>
      </div>
      <div class="quest-meta" style="margin-top:4px;">
        <span>Địa điểm mục tiêu: <strong class="gold-text">${escapeHtml(activeMission.targetHuyen || "?" )}</strong>${activeMission.targetXa ? ` · ${escapeHtml(activeMission.targetXa)}` : ""}</span>
      </div>
    </div>
    ${activeMission.step === "intel" ? `
      <button class="action-btn highlight-blue mt-1" onclick="window.openNpcModal('${activeMission.targetNpcId}')">🕵 Đi Do Thám Đầu Mối<br><span style="font-size:0.72rem;">Do thám thành công mới mở bước ra tay</span></button>
    ` : `
      <button class="action-btn ${missionLocationOk ? "danger" : "soft-locked"} mt-1" ${missionLocationOk ? "" : "disabled"} onclick="window.executeClanMission('${clanId}')">⚔ Ra Tay Hoàn Thành Kèo<br><span style="font-size:0.72rem;">${missionLocationOk ? "Tiêu hao thể lực, có thể kéo theo trả đũa" : "Chưa ở đúng huyện/xã mục tiêu"}</span></button>
      <button class="action-btn mt-1" onclick="window.mapGoMissionTarget()">🗺 Mở Bản Đồ Tới Mục Tiêu<br><span style="font-size:0.72rem;">Canh đúng địa bàn rồi mới ra tay</span></button>
    `}
  `);

  $("npcInteractions").innerHTML = !isMissionTab ? `
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;">
      <button class="btn-tiny ${pressureMode === "easy" ? "active" : ""}" onclick="window.setClanPressureMode('easy')">Dễ</button>
      <button class="btn-tiny ${pressureMode === "standard" ? "active" : ""}" onclick="window.setClanPressureMode('standard')">Chuẩn</button>
      <button class="btn-tiny ${pressureMode === "hardcore" ? "active" : ""}" onclick="window.setClanPressureMode('hardcore')">Hardcore</button>
    </div>
    <button class="action-btn highlight-gold mt-1 ${(p.tien < 100) ? "soft-locked" : ""}" data-lock-reason="${escapeHtml(p.tien < 100 ? "Cần 100 quan." : "")}" title="${escapeHtml(p.tien < 100 ? "Cần 100 quan." : "")}" onclick="window.doClanTribute('${clanId}')">💰 Tặng Lễ Vật (−100Q)<br><span style="font-size:0.72rem;">Tăng cảm tình toàn bộ dòng họ</span></button>
    <button class="action-btn highlight-red mt-1 ${(p.voThuat < 40 || p.quanSo < 50) ? "soft-locked" : ""}" data-lock-reason="${escapeHtml((p.voThuat < 40 || p.quanSo < 50) ? "Cần Võ 40+ và 50 quân." : "")}" title="${escapeHtml((p.voThuat < 40 || p.quanSo < 50) ? "Cần Võ 40+ và 50 quân." : "")}" onclick="window.doClanIntimid('${clanId}')">😤 Uy Hiếp Cả Dòng Họ<br><span style="font-size:0.72rem;">Cần Võ 40+, quân 50+</span></button>
    <button class="action-btn highlight-blue mt-1 ${(!canPatron || p.tien < 20 || patroningThis) ? "soft-locked" : ""}" data-lock-reason="${escapeHtml(!canPatron ? "Chỉ dân đen/phú hộ mới dùng cơ chế bảo trợ." : (patroningThis ? "Bạn đã nương dòng họ này." : (p.tien < 20 ? "Cần 20 quan lễ ra mắt." : "")))}" title="${escapeHtml(!canPatron ? "Chỉ dân đen/phú hộ mới dùng cơ chế bảo trợ." : (patroningThis ? "Bạn đã nương dòng họ này." : (p.tien < 20 ? "Cần 20 quan lễ ra mắt." : "")))}" onclick="window.chooseClanPatron('${clanId}')">🛡 Xin Bảo Trợ Dòng Họ<br><span style="font-size:0.72rem;">Nương họ để làm ăn dễ thở</span></button>
    ${patroningThis ? `<button class="action-btn danger mt-1" onclick="window.dropClanPatron()">🚪 Cắt Bảo Trợ<br><span style="font-size:0.72rem;">Rời phe này, dễ bị trả đũa</span></button>` : ""}
    <button class="action-btn mt-1 ${(p.theLuc < 20 || p.tien < 15 || !rivalId) ? "soft-locked" : ""}" data-lock-reason="${escapeHtml(!rivalId ? "Chưa có dòng họ đối nghịch để dàn hòa." : (p.theLuc < 20 ? "Cần 20 thể lực." : (p.tien < 15 ? "Cần 15 quan trà nước." : "")))}" title="${escapeHtml(!rivalId ? "Chưa có dòng họ đối nghịch để dàn hòa." : (p.theLuc < 20 ? "Cần 20 thể lực." : (p.tien < 15 ? "Cần 15 quan trà nước." : "")))}" onclick="window.doClanMediate('${clanId}','${rivalId || ""}')">🕊️ Dàn Hòa Với ${escapeHtml(rivalName)}<br><span style="font-size:0.72rem;">Giảm căng thẳng hai họ</span></button>
  ` : missionActionHtml;
  $("npcModal").setAttribute("aria-hidden", "false");
  $("npcModal").classList.add("open");
};

window.doClanTribute = clanId => {
  const clan = state.clans?.find(c => c.id === clanId);
  const p = state.player;
  if (!clan) return;
  if (p.tien < 100) { showToast("Cần 100 Quan.", true); return; }
  p.tien -= 100;
  clan.memberIds.forEach(id => {
    const npc = state.npcById[id];
    if (npc) npc.opinion = Math.min(100, npc.opinion + 15);
  });
  if (!state.clanFavor) state.clanFavor = {};
  state.clanFavor[clanId] = Math.min(100, (state.clanFavor[clanId] || 0) + 10);
  clan.quyenLuc = Math.min(100, clan.quyenLuc + 5);
  p.uyTinCong += 10;
  logLine(state, `Tặng lễ vật 100 Quan cho dòng họ ${clan.name}. Cảm tình toàn bộ thành viên tăng.`);
  showToast(`Dòng họ ${clan.name}: Cảm tình +15 cho mỗi thành viên`);
  render(); window.openClanModal(clanId);
};

window.doClanIntimid = clanId => {
  const clan = state.clans?.find(c => c.id === clanId);
  const p = state.player;
  if (!clan) return;
  if (p.voThuat < 40 || p.quanSo < 50) { showToast("Cần Võ 40+ và 50 quân.", true); return; }
  const success = Math.random() < 0.5;
  if (success) {
    clan.attitude = "Thù ghét";
    clan.memberIds.forEach(id => {
      const npc = state.npcById[id];
      if (npc) { npc.opinion -= 30; npc._fear = (npc._fear || 0) + 30; }
    });
    logLine(state, `Uy hiếp dòng họ ${clan.name} thành công. Họ sợ hãi khuất phục tạm thời.`);
    showToast(`Dòng họ ${clan.name} khiếp sợ — nhưng oán hận sâu!`);
  } else {
    p.uyTinCong -= 20;
    logLine(state, `Uy hiếp dòng họ ${clan.name} thất bại. Mất uy tín nghiêm trọng!`, true);
    showToast("Thất bại — Mất 20 Uy Tín!", true);
  }
  if (!state.clanFavor) state.clanFavor = {};
  state.clanFavor[clanId] = Math.max(-100, (state.clanFavor[clanId] || 0) - 18);
  render(); window.openClanModal(clanId);
};

window.doClanJob = (clanId, type) => {
  const labels = {
    trom_ga: "🐔 Trộm Gà Bắt Chó",
    pha_vuon: "💩 Ném Phân Vườn Rau",
    boi_ban: "🗣️ Bêu Xấu Chợ Sớm",
  };
  const costText = {
    trom_ga: "Nhận kèo nhiều bước: trước hết phải đi do thám đầu mối.",
    pha_vuon: "Nhận kèo nhiều bước: trước hết phải đi do thám đầu mối.",
    boi_ban: "Nhận kèo nhiều bước: trước hết phải đi do thám đầu mối.",
  };
  const ok = window.confirm(`Nhận kèo ${labels[type] || "dòng họ"}?\n${costText[type] || "Kèo này cần tự làm từng bước."}`);
  if (!ok) return;
  const r = doAction(actionBeginClanMission, [clanId, type]);
  if (r?.ok) window.openClanModal(clanId);
};

window.executeClanMission = (clanId) => {
  const ok = window.confirm("Xác nhận ra tay hoàn thành kèo dòng họ?\nHành động sẽ tiêu hao thể lực và có thể kéo theo trả đũa.");
  if (!ok) return;
  const r = doAction(actionExecuteClanMission);
  if (r?.ok) window.openClanModal(clanId);
};

window.chooseClanPatron = (clanId) => {
  const r = doAction(actionChooseClanPatron, [clanId]);
  if (r?.ok) {
    pushContextHint("clan_patron_cost", "Có bảo kê sẽ an toàn hơn, nhưng mỗi tháng sẽ bị thu tô ngầm.");
    window.openClanModal(clanId);
  }
};

window.dropClanPatron = () => {
  const clanId = state?.player?._patronClanId;
  const r = doAction(actionDropClanPatron);
  if (r?.ok && clanId) window.openClanModal(clanId);
};

window.doClanMediate = (clanAId, clanBId) => {
  const ok = window.confirm("Nhận kèo dàn hòa hai dòng họ?\nTốn thể lực và trà nước, nhưng có thể tăng uy tín nếu thành công.");
  if (!ok) return;
  const r = doAction(actionClanMediate, [clanAId, clanBId]);
  if (r?.ok) window.openClanModal(clanAId);
};

window.setClanPressureMode = (mode) => {
  doAction(actionSetClanPressureMode, [mode]);
  render();
};

window.__migrateLoadedState = () => {
  if (!state) return;
  if (!state.recentEventIds)  state.recentEventIds  = [];
  if (!state.marqueeQueue)    state.marqueeQueue     = [];
  if (!state._battleChaos)    state._battleChaos     = {};
  if (!state._battleContrib)  state._battleContrib   = {};
  if (!state._huyenControl)   state._huyenControl    = {};
  if (!state._huyenGarrisons) state._huyenGarrisons = {};
  if (!state.travel) state.travel = { active: false, daysLeft: 0, totalDays: 0, dest: null, reason: "" };
  if (!state.tutorial) state.tutorial = { completed: false, track: null, step: 0 };
  if (!state.prisoners) state.prisoners = [];
  if (!state._prisonerSeq) state._prisonerSeq = 1;
  if (typeof state._activityUiPulse !== "number") state._activityUiPulse = 0;
  if (!("activity" in state)) state.activity = null;
  if (!("lastActivityReport" in state)) state.lastActivityReport = null;
  if (!("lastBacCuArchive" in state)) state.lastBacCuArchive = null;
  if (!("lastVanExamArchive" in state)) state.lastVanExamArchive = null;
  if (!("_pendingExamResultModal" in state)) state._pendingExamResultModal = null;
  if (!("posting" in state)) state.posting = null;
  if (!state.reinforcements) state.reinforcements = [];
  if (!("postingOrder" in state)) state.postingOrder = null;
  if (!("_campaignYm" in state)) state._campaignYm = null;
  if (!("_weatherForecast" in state)) state._weatherForecast = null;
  if (!state.postingsByHuyen) state.postingsByHuyen = {};
  if (!("postingId" in state)) state.postingId = null;
  if (state.posting && state.posting.huyenId) {
    state.postingsByHuyen[state.posting.huyenId] = { ...state.posting, taxCollectedYear: state.posting.taxCollectedYear || 0, lastAuditYear: state.posting.lastAuditYear || 0 };
    state.postingId = state.posting.huyenId;
    delete state.posting;
  }
  if ((state.postingId && state.postingsByHuyen[state.postingId]) && !state.postingsByHuyen[state.postingId].armies) state.postingsByHuyen[state.postingId].armies = [];
  if (state.postingId && state.postingsByHuyen[state.postingId] && !state.postingsByHuyen[state.postingId].cases) state.postingsByHuyen[state.postingId].cases = [];
  if (state.postingId && state.postingsByHuyen[state.postingId] && !state.postingsByHuyen[state.postingId].buildings) state.postingsByHuyen[state.postingId].buildings = {};
  if (!state._htExec)         state._htExec          = {};
  if (!state.player.lifestylePerks)  state.player.lifestylePerks  = {};
  if (!state.player.lifestylePoints) state.player.lifestylePoints = 0;
  if (!state.player.lifestyleXP)     state.player.lifestyleXP     = {};
  if (!state.uiActionMode) state.uiActionMode = "basic";
  if (!state._clanQuestStats) state._clanQuestStats = { total: 0, trom_ga: 0, pha_vuon: 0, boi_ban: 0, mediate: 0 };
  if (!("mediate" in state._clanQuestStats)) state._clanQuestStats.mediate = 0;
  if (!("_clanMission" in state)) state._clanMission = null;
  if (!state.player.holdings)        state.player.holdings        = [];
  if (!state.player.inventory)       state.player.inventory       = { ruou:0, tra:0, lua:0, muoi:0, go:0, ca:0, thit_lon:0 };
  if (!("ca" in state.player.inventory)) state.player.inventory.ca = 0;
  if (!("thit_lon" in state.player.inventory)) state.player.inventory.thit_lon = 0;
  if (typeof state.player.merchantXp !== "number") state.player.merchantXp = 0;
  if (typeof state.player.merchantTier !== "number") state.player.merchantTier = 0;
  if (!state.player.giaDinh)         state.player.giaDinh         = { vo: null, con: 0 };
  if (!state.uiSeenTabs) state.uiSeenTabs = { tabActions: true };
  if (!state.onboarding) state.onboarding = { firstResourceActionDone: false, firstTradeDone: false, firstTravelDone: false, firstFocusDone: false };
  if (!("firstResourceActionDone" in state.onboarding)) state.onboarding.firstResourceActionDone = false;
  if (!("clanPressureMode" in state)) state.clanPressureMode = "standard";
  if (!("speedProfile" in state)) state.speedProfile = "normal";
  if (!("difficulty" in state)) state.difficulty = "normal";
  if (!("performanceMode" in state)) state.performanceMode = false;
  if (!("uiUxMode" in state)) state.uiUxMode = state.uxFirstPlay ? "newbie" : "strategic";
  if (!("themeInkMode" in state)) state.themeInkMode = "soft";
  if (!state.clanFavor) state.clanFavor = {};
  if (state.clans?.length) state.clans.forEach(c => { if (!(c.id in state.clanFavor)) state.clanFavor[c.id] = 0; });
  if (!state._delayedEffects) state._delayedEffects = [];
  if (!state._uxHintsSeen) state._uxHintsSeen = {};
  if (!("uxFirstPlay" in state)) state.uxFirstPlay = !!state.firstRun;
  if (!("gameOverType" in state)) state.gameOverType = "lose";
  if (!state.victory) state.victory = { offered: false, chosen: null, nextOfferYm: null };
  if (state.village && !state.village.demo) state.village.demo = null;
  try { ensureBattleLedgerAndSimCompat(state); } catch {}
  if (!state._warRegionalScratch || typeof state._warRegionalScratch !== "object") state._warRegionalScratch = {};
  try { repairGeoCacheFactionFlags(state); } catch {}
};


// Settings
window.actionSaveGame = () => {
  try {
    const slot = Number($("saveSlotSelect")?.value || getActiveSaveSlot());
    setActiveSaveSlot(slot);
    localStorage.setItem(getSaveSlotKey(slot), JSON.stringify(state));
    // Keep last-save compatibility key for older loader paths.
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    const meta = getSaveSlotsMeta();
    meta[slot] = {
      ...(meta[slot] || {}),
      savedAt: Date.now(),
      ban: state?.ban || 1737,
      monthIndex: state?.monthIndex || 1,
      name: (meta[slot]?.name || "").trim(),
    };
    setSaveSlotsMeta(meta);
    writeAutoSaveSnapshot("manual");
    window.refreshSaveSlotUi();
    showToast(`Đã lưu game vào Slot ${slot}!`);
  } catch { showToast("Lưu thất bại — bộ nhớ đầy?", true); }
};
window.actionLoadGame = () => {
  try {
    const slot = Number($("saveSlotSelect")?.value || getActiveSaveSlot());
    setActiveSaveSlot(slot);
    let raw = localStorage.getItem(getSaveSlotKey(slot));
    if (!raw && slot === 1) {
      // One-time fallback for legacy single-save users.
      raw = localStorage.getItem(SAVE_KEY) || localStorage.getItem(SAVE_KEY_OLD);
      if (raw) {
        localStorage.setItem(getSaveSlotKey(1), raw);
      }
    }
    if (!raw) { showToast("Không tìm thấy save.", true); return; }
    state = JSON.parse(raw);
    window.__migrateLoadedState();
    window.refreshSaveSlotUi();
    showToast(`Tải game thành công từ Slot ${slot}!`);
    $("roleScreen").classList.add("hidden");
    $("gameRoot").classList.remove("hidden");
    initButtons();
    resetTimeToDefaultSpeed();
    if ($("chkBgm")?.checked) {
      audioManager.unlock().then(() => audioManager.startBg()).catch(() => {});
    }
    startGameLoop();
    render();
    if (state.uxFirstPlay && !state.tutorial?.completed) {
      setTimeout(() => {
        try { itStart(); } catch {}
      }, 500);
    }
  } catch { showToast("File save bị lỗi!", true); }
};

// Debug cheat
window.debugHackQuan = () => {
  const p = state.player;
  p.tien = 99999; p.thocCaNhan = 5000;
  p.ngoaiGiao = 100; p.voThuat = 100; p.quanLy = 100; p.muuMeo = 100; p.hocVan = 100;
  p.quanSo = 10000; p.uyTinCong = 9999; p.danhVong = 9999;
  p.theLuc = 100; p.lifestylePoints += 50; p.dangOm = false;
  showToast("GOD MODE kích hoạt!");
  render();
};
window.debugHackTime = () => {
  state.ban = 1740; state.monthIndex = 1; state.gameDay = 1;
  showToast("Tua tới 1740 — Trịnh Doanh đại chiến!");
  render();
};

// Rebel
$("btnRaiseRebel")?.addEventListener("click", () => {
  if (!state) return;
  const p = state.player;
  if (p.quanSo < 50) { showToast("Cần ít nhất 50 quân để dựng cờ!", true); return; }
  p.rank = PlayerRank.THU_LINH;
  p.faction = Faction.NGHIA_QUAN;
  p.uyTinCong -= 30;
  p.danhVong += 50;
  logLine(state, "DỰNG CỜ KHỞI NGHĨA! Từ nay là kẻ thù của triều đình Trịnh!");
  showToast("Nghĩa quân thành lập! Cạch mặt với triều đình.");
  render();
});

// ──────────────────────────────────────────────────
// EVENT MODAL
// ──────────────────────────────────────────────────
function openEventModal(ev) {
  setText("eventTitle", ev.title);
  setText("eventNarrative", ev.narrative);
  const choiceDiv = $("eventChoices");
  choiceDiv.innerHTML = ev.choices.map((c, i) => {
    const impactHtml = (c.impact || []).map(imp =>
      `<span style="font-size:0.75rem;color:${imp.color};font-weight:600;">${imp.label}</span>`
    ).join(" &nbsp;");

    return `<div class="event-choice-wrapper">
      <div class="event-impact-row">${impactHtml}</div>
      <button class="event-choice-btn"
              id="evChoice_${i}"
              onclick="window.pickEventChoice(${i})">${c.label}</button>
    </div>`;
  }).join("");

  $("eventModal").setAttribute("aria-hidden", "false");
  $("eventModal").classList.add("open");
}

window.pickEventChoice = idx => {
  if (!state.pendingEvent) return;
  const evId = state.pendingEvent.id;
  resolveEventChoice(state, evId, idx);
  $("eventModal").classList.remove("open");
  $("eventModal").setAttribute("aria-hidden", "true");
  playSfxKey("coin");
  render();
};

// ──────────────────────────────────────────────────
// PRISONERS UI
// ──────────────────────────────────────────────────
window.openPrisoners = () => {
  if (!state) return;
  const modal = $("prisonerModal");
  if (!modal) return;
  const list = $("prisonerList");
  const prs = state.prisoners || [];
  list.innerHTML = prs.length === 0
    ? `<p class="muted" style="font-size:0.85rem;">Không có tù binh.</p>`
    : prs.map(pr => `
      <div class="box-plate" style="margin:0.5rem 0; padding:0.7rem;">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;">
          <div>
            <div style="font-weight:700;color:var(--gold-light);">${escapeHtml(pr.name)}</div>
            <div class="muted" style="font-size:0.8rem;margin-top:2px;">Bắt tại: ${escapeHtml(pr.capturedAt || "")} · Giá chuộc: <strong class="gold-text">${(pr.value||0).toLocaleString()}</strong>Q</div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn-tiny" onclick="window.prisonerRansom('${pr.id}')">Chuộc</button>
            <button class="btn-tiny" onclick="window.prisonerRelease('${pr.id}')">Thả</button>
            <button class="btn-tiny" style="background:rgba(180,50,50,0.35);border-color:#ff9b9b;" onclick="window.prisonerExecute('${pr.id}')">Chém</button>
          </div>
        </div>
      </div>
    `).join("");
  modal.setAttribute("aria-hidden", "false");
  modal.classList.add("open");
};
window.prisonerRelease = (id) => { doAction(actionPrisonerRelease, [id]); window.openPrisoners(); };
window.prisonerExecute = (id) => { doAction(actionPrisonerExecute, [id]); window.openPrisoners(); };
window.prisonerRansom  = (id) => { doAction(actionPrisonerRansom,  [id]); window.openPrisoners(); };

// Local governance bindings
window.localLevy = () => doAction(actionLocalLevy);
window.localFund = () => doAction(actionLocalFund, [100]);
window.localEmbezzle = () => doAction(actionLocalEmbezzle, [120]);
window.localReinforce = () => doAction(actionRequestReinforcements);
window.localTax = () => doAction(actionLocalCollectTax);
window.localPatrol = () => doAction(actionLocalPatrol);
window.localPacify = () => doAction(actionLocalPacify);
window.localBribe = () => doAction(actionLocalBribeSuperior);
window.localMaa = (k) => doAction(actionLocalRecruitMaa, [k]);
window.postingBuild = (id) => doAction(actionPostingBuild, [id]);
window.assumeOffice = () => doAction(actionAssumeOfficeHere);

// ──────────────────────────────────────────────────
// CASES UI (governance)
// ──────────────────────────────────────────────────
window.openCases = () => {
  if (!state) return;
  const modal = $("caseModal");
  const list = $("caseList");
  if (!modal || !list) return;
  const po = (state.postingsByHuyen && state.postingId) ? state.postingsByHuyen[state.postingId] : null;
  const cases = po?.cases || [];
  if (!po) {
    list.innerHTML = `<p class="muted" style="font-size:0.85rem;">Chưa có địa bàn nhậm chức.</p>`;
  } else if (cases.length === 0) {
    list.innerHTML = `<p class="muted" style="font-size:0.85rem;">Chưa có vụ án tồn đọng.</p>`;
  } else {
    list.innerHTML = cases.map(c => `
      <div class="box-plate" style="margin:0.6rem 0;padding:0.8rem;">
        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;">
          <div>
            <div style="font-weight:700;color:var(--gold-light);">${escapeHtml(c.title)}</div>
            <div class="muted" style="font-size:0.82rem;margin-top:4px;">${escapeHtml(c.desc || "")}</div>
            <div class="muted" style="font-size:0.78rem;margin-top:6px;">Mức độ: <strong class="gold-text">${escapeHtml(c.severity || "nhẹ")}</strong> · Hạn: ${escapeHtml(c.due || "")}</div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:flex-start;justify-content:flex-end;">
            ${(c.choices || []).map((ch, i) => `<button class="btn-tiny" onclick="window.pickCase('${c.id}',${i})">${escapeHtml(ch.label)}</button>`).join("")}
          </div>
        </div>
      </div>
    `).join("");
  }
  modal.setAttribute("aria-hidden", "false");
  modal.classList.add("open");
};

window.pickCase = (caseId, idx) => {
  // resolve is done by engine action exposed on window (added below)
  if (typeof window.resolveCase !== "function") return;
  window.resolveCase(caseId, idx);
  window.openCases();
};

window.resolveCase = (caseId, idx) => doAction(resolveCase, [caseId, idx]);

// ──────────────────────────────────────────────────
// ACTIVITIES (EXAMS / TOURNAMENT)
// ──────────────────────────────────────────────────
function openActivityModal(title, bodyHtml, actionsHtml) {
  setText("activityTitle", title);
  const b = $("activityBody");
  const a = $("activityActions");
  if (b) b.innerHTML = bodyHtml || "";
  if (a) a.innerHTML = actionsHtml || "";
  $("activityModal")?.setAttribute("aria-hidden", "false");
  $("activityModal")?.classList.add("open");
}

function clearBacCuRevealTimers() {
  if (Array.isArray(window.__bacCuRevealTimers)) {
    window.__bacCuRevealTimers.forEach(id => clearTimeout(id));
  }
  window.__bacCuRevealTimers = [];
}

function closeActivityModal() {
  clearBacCuRevealTimers();
  $("activityModal")?.classList.remove("open");
  $("activityModal")?.setAttribute("aria-hidden", "true");
}

function renderActivityRosterPanel() {
  const a = activityStatus(state);
  if (!a?.roster?.length) return "";
  const isVo = a.kind === "bac_cu";
  const statLabel = isVo ? "Võ đài (chỉ số võ)" : "Khoa trường (học vấn)";
  const rows = a.roster.map((r, rosterIdx) => {
    if (r.withdrawn) {
      return `<div class="muted" style="font-size:0.78rem;padding:4px 0;border-bottom:1px solid rgba(154,122,50,0.1);"><em>${escapeHtml(r.name)}</em> — đã lui kỳ</div>`;
    }
    const tip = `${r.homeLabel || ""} · HV ${r.hocVan ?? "—"} · Võ ${r.voThuat ?? "—"} · Mưu ${r.muuMeo ?? "—"} · ${r.personality || ""}`.replace(/\s+/g, " ").trim();
    const ageBit = r.tuoi != null ? ` · <span class="muted">${r.tuoi} tuổi</span>` : "";
    const btns = r.isPlayer ? "" : `
      <button type="button" class="btn-tiny" style="margin-left:6px;" onclick="window.activityBribeRivalByIndex(${rosterIdx})">Mua chuộc lui</button>
      <button type="button" class="btn-tiny" style="margin-left:4px;" onclick="window.activityThreatenRivalByIndex(${rosterIdx})">Đe dọa lui</button>`;
    return `
      <div style="padding:8px 0;border-bottom:1px solid rgba(154,122,50,0.12);font-size:0.82rem;line-height:1.45;">
        <div><strong title="${escapeHtml(tip)}">${escapeHtml(r.name)}</strong>${r.isPlayer ? " <span class='tag'>(Bạn)</span>" : ""}${ageBit}</div>
        <div class="muted" style="margin-top:3px;">${escapeHtml(r.homeLabel || "")}</div>
        <div class="muted" style="margin-top:2px;font-style:italic;">${escapeHtml(r.personality || "")}</div>
        <div class="muted" style="margin-top:3px;">${statLabel}: <strong class="gold-text">${r.skill ?? "—"}</strong> · HV <strong>${r.hocVan ?? "—"}</strong> · Võ <strong>${r.voThuat ?? "—"}</strong> · Mưu <strong>${r.muuMeo ?? "—"}</strong></div>
        ${!r.isPlayer ? `<div style="margin-top:6px;">${btns}</div>` : ""}
      </div>`;
  }).join("");
  return `<div class="box-plate" style="margin-top:10px;"><div style="font-weight:700;color:var(--gold-light);margin-bottom:4px;">Sảnh chờ — danh sách thật</div><div class="muted" style="font-size:0.78rem;margin-bottom:8px;">Trong lúc cửa sổ này mở, <strong>ngày tháng trong game đứng yên</strong>. Mua chuộc / đe dọa chỉ trước «Vào cuộc» — có thể bại lộ, mất uy tín hoặc tiền.</div>${rows}</div>`;
}

/** Kỳ thi/lôi đài đã tới ngày khai mạc (phase ready) — mở hộp thoại "Vào cuộc". */
function openActivityReadyGate() {
  const a = activityStatus(state);
  if (!a?.active || a.phase !== "ready") return;
  const isVo = a.kind === "bac_cu";
  const body = `
        <div class="box-plate">
          <div style="color:var(--text-main);line-height:1.6;">
            <div class="muted">Khai mạc: <strong class="gold-text">${escapeHtml(a.title)}</strong></div>
            <div class="muted" style="margin-top:10px;"><strong>Chọn «Vào cuộc»</strong> để hệ thống <strong>giả lập</strong> các vòng ${isVo ? "đấu" : "thi"} theo chỉ số và may rủi. ${isVo ? "Lôi đài sẽ <strong>chiếu từng vòng</strong> có nhật ký trận (không đấu tay)." : "Không có mini-game tay."}</div>
            <div class="muted" style="margin-top:8px;">Đóng cửa sổ (✕) <strong>không hủy</strong> ghi danh; bấm dòng 📅 dưới HUD để mở lại hộp thoại này.</div>
            <div class="muted" style="margin-top:6px;">Nếu bạn từng hối lộ/cò chạy chọt trên đường thì tỉ lệ sẽ nhỉnh hơn một chút.</div>
          </div>
        </div>
        ${renderActivityRosterPanel()}
      `;
  const actions = `<button class="btn-tiny primary" onclick="window.activityEnter()">Vào cuộc</button>`;
  openActivityModal(`🏟 ${escapeHtml(a.title)}`, body, actions);
}
window.openActivityReadyGate = openActivityReadyGate;

window.activityBribeRivalByIndex = (rosterIdx) => {
  const a = state?.activity;
  const r = a?.roster?.[rosterIdx];
  if (!r || r.isPlayer || r.withdrawn) {
    showToast("Không tìm thấy người đó trong danh sách.", true);
    return;
  }
  doAction(activityBribeOpponent, [r.id]);
  if (activityStatus(state)?.phase === "ready" && $("activityModal")?.classList.contains("open")) {
    openActivityReadyGate();
  }
};

window.activityThreatenRivalByIndex = (rosterIdx) => {
  const a = state?.activity;
  const r = a?.roster?.[rosterIdx];
  if (!r || r.isPlayer || r.withdrawn) {
    showToast("Không tìm thấy người đó trong danh sách.", true);
    return;
  }
  doAction(activityThreatenOpponent, [r.id]);
  if (activityStatus(state)?.phase === "ready" && $("activityModal")?.classList.contains("open")) {
    openActivityReadyGate();
  }
};

window.activityEnter = () => {
  const res = doAction(runPlannedActivity);
  closeActivityModal();
  const rep = state?.lastActivityReport;
  if (!res?.ok || !rep) {
    render();
    return;
  }
  if (rep.kind === "bac_cu") {
    startBacCuResultReveal(rep);
    return;
  }
  if (rep.pendingResult && ["thi_huong", "thi_hoi", "thi_dinh"].includes(rep.kind)) {
    startVanExamInkAnim(rep);
    return;
  }
  const tmp = { bracket: rep.bracket, logs: rep.logs, kind: rep.kind, title: rep.title };
  const body = `
    <div class="box-plate">
      <div class="muted" style="font-size:0.85rem;line-height:1.6;">
        ${escapeHtml("Trường thi mở cửa. Sĩ tử chen chúc như kiến.")}
        ${rep.pendingResult ? "<br><br><strong>Kết quả chính thức</strong> sẽ công bố sau khi bạn hồi hương." : ""}
      </div>
    </div>
    ${renderActivityResults(tmp)}
  `;
  openActivityModal(`📜 Diễn biến: ${escapeHtml(rep.title)}`, body, `<button class="btn-tiny primary" onclick="window.activityClose()">Đóng</button>`);
};
window.activityClose = () => closeActivityModal();

function bacCuLogsUpToRound(rep, maxRound) {
  const lines = rep?.logs || [];
  if (!maxRound || maxRound < 1) return [];
  return lines.filter(line => {
    const m = /^Vòng (\d+):/.exec(String(line));
    return m && Number(m[1]) <= maxRound;
  });
}

function renderBacCuLogPanel(rep, maxRound) {
  const lines = bacCuLogsUpToRound(rep, maxRound);
  const inner = lines.length
    ? lines.map(l => `<div>${escapeHtml(l)}</div>`).join("")
    : `<div class="muted">${maxRound < 1 ? "Trọng tài gọi danh sách, võ sinh lên đài…" : "…"}</div>`;
  return `<div class="box-plate muted" style="font-size:0.8rem;max-height:120px;overflow-y:auto;line-height:1.5;margin-bottom:10px;" id="bacCuLogPanel">${inner}</div>`;
}

function startBacCuResultReveal(rep) {
  clearBacCuRevealTimers();
  window.__bacCuRevealTimers = [];
  const addT = (fn, ms) => window.__bacCuRevealTimers.push(setTimeout(fn, ms));
  const totalRounds = (rep.bracket?.bracket || []).length;
  const stepMs = 880;

  const body = `
    <div class="box-plate">
      <div class="muted" style="font-size:0.88rem;line-height:1.55;">
        Mỗi trận đã được <strong>tính sẵn</strong> (Võ + may rủi). Dưới đây là <strong>nhật ký + bảng chiếu dần từng vòng</strong> — không phải đấu tay.
        Biên bản cũng được <strong>lưu</strong>: sau khi đóng, bấm dòng <strong>🥊 Xem lại…</strong> dưới HUD để mở lại.
      </div>
    </div>
    <div id="bacCuDynamic">${renderBacCuLogPanel(rep, 0)}${renderActivityResults(rep, { maxBacCuRound: 0 })}</div>
  `;
  const actions = `
    <button type="button" class="btn-tiny" onclick="window.finishActivityRevealSkip()">Xem hết ngay</button>
    <button type="button" class="btn-tiny primary" onclick="window.activityClose()">Đóng</button>
  `;
  openActivityModal(`📜 Diễn biến: ${escapeHtml(rep.title)}`, body, actions);

  for (let r = 1; r <= totalRounds; r++) {
    addT(() => {
      const dyn = $("bacCuDynamic");
      if (!dyn || !$("activityModal")?.classList.contains("open")) return;
      dyn.innerHTML = `${renderBacCuLogPanel(rep, r)}${renderActivityResults(rep, { maxBacCuRound: r })}`;
      playSfxKey("cay");
    }, r * stepMs);
  }
  addT(() => {
    const dyn = $("bacCuDynamic");
    if (!dyn || !$("activityModal")?.classList.contains("open")) return;
    dyn.innerHTML = `${renderBacCuLogPanel(rep, totalRounds)}${renderActivityResults(rep, {})}`;
    playSfxKey("battle");
  }, (totalRounds + 1) * stepMs);
}

window.finishActivityRevealSkip = () => {
  clearBacCuRevealTimers();
  const rep = state?.lastActivityReport;
  if (!rep || rep.kind !== "bac_cu") return;
  const dyn = $("bacCuDynamic");
  if (!dyn) return;
  const totalRounds = (rep.bracket?.bracket || []).length;
  dyn.innerHTML = `${renderBacCuLogPanel(rep, totalRounds)}${renderActivityResults(rep, {})}`;
};

window.finishVanExamInkSkip = () => {
  clearBacCuRevealTimers();
  const el = $("vanExamInkBody");
  if (el && $("activityModal")?.classList.contains("open")) {
    el.innerHTML = vanExamInkStageHtml(3);
  }
};

window.openBacCuArchiveViewer = () => {
  const arc = state?.lastBacCuArchive;
  const rep = arc?.report;
  if (!rep || rep.kind !== "bac_cu") {
    showToast("Chưa có biên bản Bác Cử đã lưu.", true);
    return;
  }
  state.lastActivityReport = rep;
  const body = `
    <div class="box-plate">
      <div class="muted" style="font-size:0.85rem;line-height:1.55;">
        Biên bản đã lưu (Tháng <strong>${arc.monthIndex}</strong> năm <strong>${arc.ban}</strong>, ngày <strong>${arc.gameDay}</strong>). Đây là toàn bộ vòng và quán quân.
      </div>
    </div>
    ${renderBacCuLogPanel(rep, (rep.bracket?.bracket || []).length)}
    ${renderActivityResults(rep, {})}
  `;
  openActivityModal(`📜 Lôi đài đã qua: ${escapeHtml(rep.title)}`, body, `<button class="btn-tiny primary" onclick="window.activityClose()">Đóng</button>`);
};

function renderVanExamLogPanel(rep, lineCount) {
  const logs = rep?.logs || [];
  const lines = lineCount <= 0 ? [] : logs.slice(0, Math.min(lineCount, logs.length));
  const inner = lines.length
    ? lines.map(l => `<div>${escapeHtml(l)}</div>`).join("")
    : `<div class="muted">Thu bài xong — quan chủ khảo đang duyệt từng thiên…</div>`;
  return `<div class="box-plate muted" style="font-size:0.8rem;max-height:120px;overflow-y:auto;line-height:1.5;margin-bottom:10px;">${inner}</div>`;
}

function vanExamInkStageHtml(step) {
  const bar = pct => `<div style="height:8px;background:rgba(255,255,255,0.08);border-radius:4px;margin-top:10px;overflow:hidden;"><div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--gold-dark),var(--gold-light));transition:width 0.55s ease;"></div></div>`;
  const stages = [
    { h: "✍️ Nhận đề", t: "Vào trường, phát giấy, gọi danh — bạn mở bút phác luận.", p: 22 },
    { h: "✍️ Soạn bài", t: "Bố cục kinh nghĩa, chỉnh văn xuôi — tiếng trống canh giờ ngoài sân.", p: 52 },
    { h: "✍️ Chép sạch", t: "Chép bài thiện, kiểm lại chữ — gần tới giờ nộp.", p: 82 },
    { h: "📜 Nộp bài", t: "Nộp quyển, lễ tạ chủ khảo. Kỳ trường kết — về quê chờ chiếu (vài tháng) mới biết đỗ/trượt.", p: 100 },
  ];
  const s = stages[Math.min(Math.max(0, step), stages.length - 1)];
  return `<div class="box-plate">
    <div style="font-size:1rem;color:var(--gold-light);margin-bottom:8px;">${escapeHtml(s.h)}</div>
    <div class="muted" style="line-height:1.65;font-size:0.9rem;">${escapeHtml(s.t)}</div>
    ${bar(s.p)}
    <div class="muted" style="margin-top:12px;font-size:0.8rem;">Không công bố bảng xếp hạng tại sân — đúng như thi thật: chỉ còn <strong>chờ chiếu</strong>.</div>
  </div>`;
}

function startVanExamInkAnim(rep) {
  clearBacCuRevealTimers();
  window.__bacCuRevealTimers = [];
  const addT = (fn, ms) => window.__bacCuRevealTimers.push(setTimeout(fn, ms));
  const body = `<div id="vanExamInkBody">${vanExamInkStageHtml(0)}</div>`;
  const actions = `
    <button type="button" class="btn-tiny" onclick="window.finishVanExamInkSkip()">Bỏ qua hoạt ảnh</button>
    <button type="button" class="btn-tiny primary" onclick="window.activityClose()">Đóng</button>
  `;
  openActivityModal(`📜 Trường thi: ${escapeHtml(rep.title)}`, body, actions);
  [1, 2, 3].forEach((st, i) => {
    addT(() => {
      const el = $("vanExamInkBody");
      if (!el || !$("activityModal")?.classList.contains("open")) return;
      el.innerHTML = vanExamInkStageHtml(st);
      playSfxKey(i >= 2 ? "murmur" : "cay");
    }, 820 * (i + 1));
  });
}

function openVanExamFinalResultModal(payload) {
  if (!payload?.report) return;
  const { passed, kind, rankTitle, rankPos, report } = payload;
  const passLabel = !passed
    ? "Trượt"
    : (kind === "thi_huong"
      ? "Đỗ Hương Cống"
      : kind === "thi_hoi"
        ? "Đỗ Thi Hội (Trúng Cách)"
        : `Đỗ Thi Đình${rankTitle ? ` — ${rankTitle}` : ""}`);
  const head = passed
    ? `<div class="box-plate" style="border-color:rgba(245,217,128,0.42);">
         <div style="font-size:1.05rem;color:var(--gold-light);font-weight:700;">Chiếu bảng: ${escapeHtml(passLabel)}</div>
         ${rankPos ? `<div class="muted" style="margin-top:6px;font-size:0.85rem;">Thứ hạng trên bảng tạm trường: <strong>#${rankPos}</strong></div>` : ""}
       </div>`
    : `<div class="box-plate">
         <div style="color:var(--danger-light);font-weight:700;">Chiếu bảng: Trượt</div>
         <div class="muted" style="margin-top:6px;font-size:0.84rem;">Giữ nguyên học vị, có thể dự kỳ sau.</div>
       </div>`;
  const body = `${head}
    <div class="muted" style="font-size:0.82rem;margin:10px 0 6px;">Biên bản bài thi (điểm tạm) đã lưu — có thể mở lại từ dòng <strong>📜 Thi văn</strong> dưới HUD.</div>
    ${renderVanExamLogPanel(report, (report.logs || []).length)}
    ${renderActivityResults(report, {})}`;
  openActivityModal(`📜 Kết quả: ${escapeHtml(report.title || "Khoa cử")}`, body, `<button class="btn-tiny primary" onclick="window.activityClose()">Đóng</button>`);
  playSfxKey(passed ? "coin" : "caiVa");
}

window.openVanExamArchiveViewer = () => {
  const arc = state?.lastVanExamArchive;
  const rep = arc?.report;
  if (!rep || !["thi_huong", "thi_hoi", "thi_dinh"].includes(rep.kind)) {
    showToast("Chưa có biên bản thi văn đã lưu.", true);
    return;
  }
  state.lastActivityReport = { ...rep, pendingResult: false };
  const endTxt = arc.passed
    ? "Chiếu bảng sau hồi hương: <strong class=\"gold-text\">Đỗ</strong>"
    : "Chiếu bảng sau hồi hương: <strong style=\"color:var(--danger-light)\">Rớt</strong>";
  const rankExtra = arc.rankTitle
    ? `<div class="gold-text" style="margin-top:8px;font-size:0.9rem;">Danh vị: <strong>${escapeHtml(arc.rankTitle)}</strong>${arc.rankPos ? ` · Hạng bài: <strong>#${arc.rankPos}</strong>` : ""}</div>`
    : "";
  const body = `
    <div class="box-plate"><div class="muted" style="font-size:0.85rem;line-height:1.5;">Kỳ đã qua (Tháng <strong>${arc.monthIndex}</strong>/${arc.ban}). ${endTxt}</div>${rankExtra}</div>
    ${renderVanExamLogPanel(rep, (rep.logs || []).length)}
    ${renderActivityResults(rep, {})}
  `;
  openActivityModal(`📜 Khoa cử đã qua: ${escapeHtml(rep.title)}`, body, `<button class="btn-tiny primary" onclick="window.activityClose()">Đóng</button>`);
};

function fmtDaysToMonths(days) {
  const m = Math.floor(days / 30);
  const d = days % 30;
  if (m <= 0) return `${d} ngày`;
  return `${m} tháng ${d} ngày`;
}

function activityLabel(kind) {
  if (kind === "thi_huong") return "🎓 Thi Hương";
  if (kind === "thi_hoi") return "🎓 Thi Hội";
  if (kind === "thi_dinh") return "👑 Thi Đình";
  return "🥊 Bác Cử";
}

window.openActivityPlanner = (kind) => {
  if (!state) return;
  const st = activityStatus(state);
  if (st?.active) { showToast("Đã có hoạt động đang đăng ký.", true); return; }
  const hint = (kind === "thi_dinh")
    ? "Địa điểm: Điện thí tại Kinh thành Thăng Long (không thi tại làng xã)"
    : (kind === "thi_hoi")
      ? "Địa điểm: trung tâm Trấn bạn đang ở (không thi tại làng xã)"
      : (kind === "thi_huong")
        ? "Địa điểm: trung tâm Phủ bạn đang ở (không thi tại làng xã)"
        : "Địa điểm: võ đài trung tâm Trấn (yêu cầu Võ Thuật từ 20)";
  const fee = (kind === "thi_huong" ? 100 : kind === "thi_hoi" ? 300 : kind === "thi_dinh" ? 0 : 100);
  const body = `
    <div class="box-plate">
      <div style="font-size:0.9rem;color:var(--text-main);line-height:1.6;">
        <div><strong>${activityLabel(kind)}</strong></div>
        <div class="muted" style="margin-top:4px;">${escapeHtml(hint)} · Lệ phí ghi danh: <strong class="gold-text">${fee}</strong>Q</div>
        <div class="muted" style="margin-top:6px;">Hoạt động sẽ diễn ra sau vài tháng. Trước kỳ ~1 tháng sẽ có nhắc hành quân nếu bạn chưa tới đúng huyện trường. Trên đường có thể gặp biến cố (cướp, sĩ tử, cò chạy chọt...).</div>
      </div>
    </div>
  `;
  const actions = `
    <button class="btn-tiny" onclick="window.cancelActivityPlan()">Hủy</button>
    <button class="btn-tiny primary" onclick="window.confirmActivityPlan('${kind}')">Ghi danh & lên đường</button>
  `;
  openActivityModal("🗓 Lập kế hoạch", body, actions);
};

window.cancelActivityPlan = () => closeActivityModal();

window.confirmActivityPlan = (kind) => {
  closeActivityModal();
  doAction(planActivity, [kind, {}]);
};

function renderActivityResults(a, opts = {}) {
  if (!a) return "";
  if (a.bracket?.kind === "bac_cu") {
    const allRounds = a.bracket.bracket || [];
    const mr = opts.maxBacCuRound;
    let rounds;
    if (typeof mr === "number") {
      rounds = mr <= 0 ? [] : allRounds.slice(0, Math.min(mr, allRounds.length));
    } else {
      rounds = allRounds;
    }
    const showChamp = typeof mr !== "number" || mr >= allRounds.length;
    const cols = rounds.length
      ? rounds.map(r => {
        const ms = (r.matches || []).map(m => {
          const aTip = escapeHtml([m.a?.homeLabel, m.a?.personality].filter(Boolean).join(" · "));
          const bTip = escapeHtml([m.b?.homeLabel, m.b?.personality].filter(Boolean).join(" · "));
          const aName = escapeHtml(m.a?.name || "?");
          const bName = escapeHtml(m.b?.name || "?");
          const wName = escapeHtml(m.winner?.name || "?");
          const aTag = m.a?.isPlayer ? "<span class='tag'>(Bạn)</span>" : "";
          const bTag = m.b?.isPlayer ? "<span class='tag'>(Bạn)</span>" : "";
          const wIsPlayer = !!m.winner?.isPlayer;
          const aSub = m.a?.homeLabel ? `<div class="muted" style="font-size:0.72rem;margin-top:2px;">${escapeHtml(m.a.homeLabel)}</div>` : "";
          const bSub = m.b?.homeLabel ? `<div class="muted" style="font-size:0.72rem;margin-top:2px;">${escapeHtml(m.b.homeLabel)}</div>` : "";
          return `
          <div class="match-card">
            <div class="match-row"><span class="name" title="${aTip}">${aName}</span>${aTag}${aSub}</div>
            <div class="match-row" style="opacity:0.9;"><span class="name" title="${bTip}">${bName}</span>${bTag}${bSub}</div>
            <div class="match-winner">Thắng: <strong${wIsPlayer ? " style='text-shadow:0 0 10px rgba(245,217,128,0.22)'" : ""}>${wName}</strong></div>
          </div>
        `;
        }).join("");
        return `<div class="bracket-col"><div class="bracket-col-title">Vòng ${escapeHtml(String(r.round || ""))}</div>${ms || "<div class='muted' style='font-size:0.82rem;'>Không có trận.</div>"}</div>`;
      }).join("")
      : `<div class="bracket-col" style="min-width:200px;"><div class="bracket-col-title">Vòng 1</div><div class="muted" style="padding:10px;font-size:0.85rem;">Chờ nhịp trống mở trận…</div></div>`;
    const champ = escapeHtml(a.bracket.champ || "?");
    const champBlock = showChamp
      ? `<div class="box-plate"><div class="muted">Quán quân: <strong class="gold-text">${champ}</strong></div></div>`
      : `<div class="box-plate"><div class="muted" style="font-size:0.82rem;">Quán quân sẽ công bố sau vòng chung kết…</div></div>`;
    return `
      ${champBlock}
      <div class="bracket-tree mt-2">${cols}</div>
    `;
  }
  if (a.bracket?.scoreboard) {
    const fullBoard = a.bracket.scoreboard;
    const mr = opts.maxScoreRows;
    if (typeof mr === "number" && mr <= 0) {
      return `<div class="box-plate"><div class="muted" style="font-size:0.85rem;">Bảng xếp hạng sẽ <strong>công bố dần</strong> từng danh…</div></div>`;
    }
    const board = (typeof mr === "number")
      ? fullBoard.slice(0, Math.min(mr, fullBoard.length))
      : fullBoard;
    const rows = board.map((s, i) => {
      const isMe = !!s.isPlayer;
      const lineStyle = isMe
        ? "background:rgba(245,217,128,0.08);border:1px solid rgba(245,217,128,0.22);border-radius:6px;padding:7px 10px;margin:6px 0;"
        : "border-bottom:1px solid rgba(154,122,50,0.12);padding:6px 0;";
      const rank = `#${i + 1}`;
      const tip = escapeHtml([s.homeLabel, s.personality, `HV ${s.hocVan ?? "—"} · Võ ${s.voThuat ?? "—"}`].filter(Boolean).join(" · "));
      return `
        <div style="display:flex;justify-content:space-between;gap:12px;${lineStyle}">
          <span title="${tip}">${escapeHtml(rank)} ${escapeHtml(s.name)}${isMe ? " <span class='tag'>(Bạn)</span>" : ""}</span>
          <span class="gold-text">${s.score}</span>
        </div>
      `;
    }).join("");
    const mePos = fullBoard.findIndex(x => x.isPlayer) + 1;
    const meLine = (mePos > 0) ? `<div class="muted" style="font-size:0.82rem;margin-bottom:6px;">Vị trí của bạn (trên bảng đầy đủ): <strong class="gold-text">#${mePos}</strong></div>` : "";
    return `<div class="box-plate"><div style="font-weight:700;color:var(--gold-light);margin-bottom:6px;">Bảng điểm (tạm tại trường)</div>${meLine}${rows}</div>`;
  }
  return "";
}

// ──────────────────────────────────────────────────
// GAME LOOP
// ──────────────────────────────────────────────────
function isGameClockFrozenModal() {
  return [
    "tutorialModal",
    "eventModal",
    "activityModal",
    "caseModal",
    "npcModal",
    "prisonerModal",
    "celebrateModal",
  ].some(id => $(id)?.classList.contains("open"));
}

function tickGame() {
  if (!state || paused || state.gameOver) return;
  if (itActive()) return;
  if (state.pendingEvent) {
    openEventModal(state.pendingEvent);
    return;
  }
  if (isGameClockFrozenModal()) return;
  const prevMonth = state.monthIndex;
  const prevYear = state.ban;
  const monthSnapshot = {
    month: prevMonth,
    year: prevYear,
    money: state.player?.tien || 0,
    grain: state.player?.thocCaNhan || 0,
    rep: state.player?.uyTinCong || 0,
    logCount: state.log?.length || 0,
  };

  // Advance game day
  state.gameDay++;
  gameTick(state);

  // Roll daily event
  rollDailyEvent(state);
  if (state.pendingEvent) {
    autoSaveMonthly(prevMonth, prevYear);
    openEventModal(state.pendingEvent);
    return;
  }

  autoSaveMonthly(prevMonth, prevYear);
  if (state.monthIndex !== prevMonth || state.ban !== prevYear) {
    const summary = buildMonthlySummary(monthSnapshot);
    if (summary) {
      if (!state.uiCelebrations) state.uiCelebrations = [];
      state.uiCelebrations.push(summary);
    }
  }

  render();
}

// ──────────────────────────────────────────────────
// INTERACTIVE TUTORIAL (A: Kinh Tế, C: Đại Thế)
// ──────────────────────────────────────────────────
let itutor = { dim: null, spot: null, card: null, bound: null };

function itEnsure() {
  if (itutor.dim) return;
  itutor.dim = document.createElement("div");
  itutor.dim.className = "itutor-dim";
  itutor.dim.style.display = "none";
  document.body.appendChild(itutor.dim);

  itutor.spot = document.createElement("div");
  itutor.spot.className = "itutor-spot";
  itutor.spot.style.display = "none";
  document.body.appendChild(itutor.spot);

  itutor.card = document.createElement("div");
  itutor.card.className = "itutor-card";
  itutor.card.style.display = "none";
  itutor.card.innerHTML = `
    <h3 class="itutor-title" id="itTitle"></h3>
    <p class="itutor-body" id="itBody"></p>
    <div class="itutor-btnrow" id="itBtns"></div>
  `;
  document.body.appendChild(itutor.card);

  window.addEventListener("resize", () => itShowStep());
}

function itActive() {
  return isUxAssistEnabled() && !!state?.tutorial && !state.tutorial.completed;
}

const ITUTOR_STEPS = [
  { title: "Chào mừng", body: "Tutorial tương tác sẽ chỉ cho bạn các thứ cần thiết để chơi (không phải vài bước lèo tèo). Bấm Tiếp.", spot: null },
  { title: "Thời gian", body: "Đây là ngày/tháng/năm. Game chạy theo ngày ở thanh trên.", spot: ".time-hud" },
  { title: "HP & Thể lực", body: "🩸 là Sinh mệnh. ⚡ là Thể lực (hồi theo ngày). Thấp quá thì dễ lăn ra ốm.", spot: "#playerHp" },
  { title: "Sứ mệnh", body: "🧭 Sứ mệnh là mục tiêu ngắn hạn để đỡ bị ngợp. Làm xong sẽ có thưởng + popup.", spot: "#questList" },
  { title: "Hoạt động", body: "Bấm tab Hoạt Động để làm việc hằng ngày.", spot: ".tab-btn[data-target='tabActions']",
    on: () => itBindClickOnce(".tab-btn[data-target='tabActions']", () => itAdvance()) },
  { title: "Kiếm thóc", body: "Bấm 'Cày Ruộng' để có thóc nuôi thân/nuôi quân.", spot: "#btnCay",
    on: () => itBindClickOnce("#btnCay", () => itAdvance()) },
  { title: "Chợ", body: "Bấm tab Chợ để mua/bán (thóc, rượu, v.v).", spot: ".tab-btn[data-target='tabMarket']",
    on: () => itBindClickOnce(".tab-btn[data-target='tabMarket']", () => itAdvance()) },
  { title: "Giao dịch đầu tiên", body: "Trong Chợ, thử bấm Mua hoặc Bán 1 món để mở vòng kinh tế.", spot: "#marketRowsContainer",
    on: () => itBindClickOnce(".btn-trade", () => itAdvance()) },
  { title: "Bản đồ", body: "Bấm tab Bản Đồ để xem địa bàn và drill xuống từng cấp.", spot: ".tab-btn[data-target='tabMap']",
    on: () => itBindClickOnce(".tab-btn[data-target='tabMap']", () => itAdvance()) },
  { title: "Hành quân có ETA", body: "Giờ di chuyển không teleport: drill xuống rồi bấm nút 🛤 để hành quân nhiều ngày.", spot: "#mapGrid",
    on: () => itBindClickOnce("#mapGrid", () => itAdvance()) },
  { title: "Lối sống", body: "Bấm tab Lối Sống để chọn trọng tâm và mở perk theo hướng chơi của bạn.", spot: ".tab-btn[data-target='tabLifestyle']",
    on: () => itBindClickOnce(".tab-btn[data-target='tabLifestyle']", () => itAdvance()) },
  { title: "Chiến sự", body: "Ở nơi có ⚔️, mở panel trận để xem quân số/sĩ khí. Tham chiến thì phải theo quân.", spot: "#battlePanel" },
  { title: "Cài đặt", body: "Bấm ⚙ để chỉnh nhạc nền, âm lượng và Save/Load.", spot: "#btnSettings",
    on: () => itBindClickOnce("#btnSettings", () => itAdvance()) },
  { title: "Xong", body: "Xong tutorial. Nếu muốn xem lại: vào Cài đặt → Reset Tutorial Tương Tác.", spot: null },
];

function itStart() {
  if (!isUxAssistEnabled()) return;
  itEnsure();
  state.tutorial = state.tutorial || { completed: false, track: null, step: 0 };
  state.tutorial.completed = false;
  state.tutorial.step = 0;
  if (!paused) {
    paused = true;
    state._pauseByInteractiveTutorial = true;
    if ($("btnPause")) $("btnPause").textContent = "▶";
    if ($("timeStatus")) $("timeStatus").textContent = "DỪNG";
  }
  itShowStep(true);
}

function itFinish(markCompleted) {
  if (!state.tutorial) state.tutorial = { completed: false, track: null, step: 0 };
  if (markCompleted) state.tutorial.completed = true;
  itutor.dim && (itutor.dim.style.display = "none");
  itutor.spot && (itutor.spot.style.display = "none");
  itutor.card && (itutor.card.style.display = "none");
  if (state._pauseByInteractiveTutorial) {
    paused = false;
    state._pauseByInteractiveTutorial = false;
    if ($("btnPause")) $("btnPause").textContent = "⏸";
    if ($("timeStatus")) $("timeStatus").textContent = `x${speed}`;
  }
  if (typeof window.actionSaveGame === "function") window.actionSaveGame();
}

function itRectFor(sel) {
  const el = document.querySelector(sel);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return null;
  return r;
}

function itSetSpotToRect(r, pad = 8) {
  itutor.spot.style.display = "block";
  itutor.spot.style.top = Math.max(8, r.top - pad) + "px";
  itutor.spot.style.left = Math.max(8, r.left - pad) + "px";
  itutor.spot.style.width = Math.min(window.innerWidth - 16, r.width + pad * 2) + "px";
  itutor.spot.style.height = Math.min(window.innerHeight - 16, r.height + pad * 2) + "px";
}

function itGotoTab(targetId) {
  openTab(targetId, { markSeen: false });
}

function itBindClickOnce(selector, advanceFn) {
  const el = document.querySelector(selector);
  if (!el) return false;
  const handler = () => {
    el.removeEventListener("click", handler, true);
    advanceFn();
  };
  el.addEventListener("click", handler, true);
  return true;
}

function itAdvance() {
  state.tutorial.step = (state.tutorial.step || 0) + 1;
  itShowStep(true);
}

function itShowStep(force) {
  if (!state) return;
  itEnsure();
  if (state.tutorial?.completed) return itFinish(false);
  itutor.dim.style.display = "block";
  itutor.card.style.display = "block";

  const step = state.tutorial.step || 0;
  const s = ITUTOR_STEPS[Math.min(step, ITUTOR_STEPS.length - 1)];
  $("itTitle").textContent = s.title;
  $("itBody").textContent = s.body;

  $("itBtns").innerHTML = `
    <button class="btn-tiny" id="itEnd">Kết thúc</button>
    ${step < ITUTOR_STEPS.length - 1 ? `<button class="btn-tiny primary" id="itNext">Tiếp</button>` : ``}
  `;
  $("itEnd").onclick = () => itFinish(true);
  $("itNext") && ($("itNext").onclick = () => itAdvance());

  if (s.spot) {
    const r = itRectFor(s.spot);
    if (r) itSetSpotToRect(r, 10);
    else itutor.spot.style.display = "none";
  } else {
    itutor.spot.style.display = "none";
  }

  if (force) {
    if (s.spot?.includes("tabActions")) itGotoTab("tabActions");
    if (s.spot?.includes("tabMarket")) itGotoTab("tabMarket");
    if (s.spot?.includes("tabMap")) itGotoTab("tabMap");
    if (s.spot?.includes("tabLifestyle")) itGotoTab("tabLifestyle");
  }

  // Bind action if provided (only once per step)
  if (!itutor.bound || itutor.bound.step !== step) {
    itutor.bound = { step };
    if (typeof s.on === "function") s.on();
  }
}

window.resetInteractiveTutorial = () => {
  if (!state) return;
  if (!isUxAssistEnabled()) { showToast("Tutorial tương tác chỉ dùng cho lần chơi đầu."); return; }
  state.tutorial = { completed: false, track: null, step: 0 };
  itStart();
};

function setIntervalSpeed(s) {
  if (tickInterval) clearInterval(tickInterval);
  if (s === 0) return;
  const profile = state?.speedProfile || "normal";
  const mul = SPEED_PROFILE_MUL[profile] || 1.0;
  const ms = Math.max(120, Math.floor((MS_PER_DAY_BASE[s] || 1500) * mul));
  tickInterval = setInterval(tickGame, ms);
}

function setSpeedProfile(profile) {
  if (!state) return;
  const next = (profile === "slow" || profile === "fast") ? profile : "normal";
  state.speedProfile = next;
  updateSpeedPresetUi();
  if (!paused) setIntervalSpeed(speed);
}

function updateSpeedPresetUi() {
  const profile = state?.speedProfile || "normal";
  $("btnSpeedPresetSlow")?.classList.toggle("active", profile === "slow");
  $("btnSpeedPresetNormal")?.classList.toggle("active", profile === "normal");
  $("btnSpeedPresetFast")?.classList.toggle("active", profile === "fast");
}

function startGameLoop() {
  setIntervalSpeed(speed);
  syncTimeUi();
}

// ──────────────────────────────────────────────────
// TUTORIAL
// ──────────────────────────────────────────────────
const TUTORIAL_PAGES = [
  {
    title: "Chào Mừng, Thị Dân Nhỏ Bé!",
    content: `Bạn đang sống trong thời Lê Trung Hưng — đất nước chia đôi,
    Chúa Trịnh nắm quyền, vua Lê chỉ còn hư vị. Năm 1737 đến 1740 là
    thời điểm hỗn loạn nhất: dân đói, quan tham, nghĩa quân nổi dậy khắp nơi.`
  },
  {
    title: "Con Đường Của Ngươi",
    content: `Game <strong>KHÔNG có con đường đúng tuyệt đối</strong>. Bạn
    có thể trở thành:<br><br>
    🏛 <strong>Quan Văn</strong> — học thi đỗ đạt, leo thang quan lộ<br>
    ⚔️ <strong>Võ Tướng</strong> — lên lôi đài Bác Cử, dẹp loạn lập công<br>
    🔥 <strong>Thủ Lĩnh</strong> — dựng nghĩa quân, chống triều đình<br>
    💰 <strong>Đại Phú Hào</strong> — xây cơ nghiệp, buôn bán giàu sang`
  },
  {
    title: "Hệ Thống Cơ Bản",
    content: `<strong>Thể Lực (❤️)</strong> — Hành động tiêu thể lực. Hết 0 = ốm liệt giường 1 tháng.<br><br>
    <strong>Uy Tín (👑)</strong> — Quan hệ xã hội. Mất hết bị tẩy chay.<br><br>
    <strong>5 Kỹ Năng</strong> — Ngoại Giao, Võ Thuật, Quản Lý, Mưu Mẹo, Học Vấn. Mỗi kỹ năng mở ra lựa chọn mới.<br><br>
    <strong>Thóc & Tiền</strong> — Thóc nuôi quân. Tiền dùng mọi thứ.`
  },
  {
    title: "Sự Kiện & Lựa Chọn",
    content: `Từ tháng thứ 2 trở đi, sự kiện ngẫu nhiên xuất hiện với tần suất thấp nhưng đều theo tháng.<br><br>
    Nhìn màu hiển thị kết quả trước khi chọn:<br>
    🟢 Màu xanh = Tốt &nbsp;&nbsp; 🔴 Màu đỏ = Xấu &nbsp;&nbsp; 🟡 Vàng = Không chắc<br><br>
    Một số sự kiện <strong>đóng vai trò định hình con đường</strong> của bạn — chọn gia nhập bọn cướp, đầu hàng triều đình, hay kết hôn đều có hệ quả lâu dài.`
  },
  {
    title: "Điểm Lối Sống",
    content: `Tab <strong>🌟 Lối Sống</strong> là nơi bạn mở khóa <em>Perks</em> định nghĩa phong cách chơi:<br><br>
    Mỗi <strong>3 tháng nhận +1 điểm perk</strong>. XP thì tăng hằng tháng theo focus đang chọn.<br><br>
    Chọn focus phù hợp mục tiêu (Quản Lý → Thu nhập, Quân Sự → Chiến đấu...).<br><br>
    <em>Lưu ý:</em> mỗi perk mở đường cho perk cao hơn — lên kế hoạch từ đầu!`
  },
  {
    title: "Lịch Sử & Chiến Sự",
    content: `Các sự kiện lịch sử <strong>có thật</strong> diễn ra theo năm:<br><br>
    📅 1737 — Nguyễn Dương Hưng nổi dậy tại Tam Đảo<br>
    📅 1739 — Nguyễn Cừ khởi nghĩa Sơn Nam<br>
    📅 1740 — Trịnh Doanh lên nắm quyền, Lê Hiển Tông đăng cơ<br>
    📅 1740 — Nguyễn Danh Phương nổi lên ở Hương Canh<br>
    📅 1743+ — Quận He bùng phát mạnh ở Hải Dương - Kinh Bắc<br>
    📅 1745+ — Hoàng Công Chất chuyển thành cánh lớn vùng Tây Bắc<br><br>
    Tab <strong>🗺 Bản Đồ</strong> hiển thị chiến sự real-time. Drilldown vào huyện để xem chi tiết trận chiến.`
  }
];

let tutPage = 0;
function closeTutorialModal(startInteractive = false) {
  $("tutorialModal")?.classList.remove("open");
  $("tutorialModal")?.setAttribute("aria-hidden", "true");
  if (state?._pauseByReadTutorial) {
    paused = false;
    state._pauseByReadTutorial = false;
    if ($("btnPause")) $("btnPause").textContent = "⏸";
    if ($("timeStatus")) $("timeStatus").textContent = `x${speed}`;
  }
  if (startInteractive) {
    try { itStart(); } catch {}
  }
}

function openTutorial() {
  if (!isUxAssistEnabled()) { showToast("Cẩm nang chỉ hiện tự động ở lần chơi đầu."); return; }
  tutPage = 0;
  renderTutorialPage();
  $("tutorialModal")?.classList.add("open");
  $("tutorialModal")?.setAttribute("aria-hidden", "false");
  if (state && !paused) {
    paused = true;
    state._pauseByReadTutorial = true;
    if ($("btnPause")) $("btnPause").textContent = "▶";
    if ($("timeStatus")) $("timeStatus").textContent = "DỪNG";
  }
}

// Settings screen uses inline onclick="openTutorial()"
window.openTutorial = openTutorial;
function renderTutorialPage() {
  const p = TUTORIAL_PAGES[tutPage];
  $("tutorialContent").innerHTML = `<h4 style="color:var(--gold-light);margin-bottom:0.5rem;">${p.title}</h4>${p.content}`;
  setText("tutorialPage", `${tutPage+1}/${TUTORIAL_PAGES.length}`);
  $("tutorialPrev").style.opacity = tutPage === 0 ? "0.3" : "1";
  const next = $("tutorialNext");
  if (next) next.textContent = tutPage === TUTORIAL_PAGES.length - 1 ? "✓ Hiểu rồi!" : "Tiếp ▶";
}


// ──────────────────────────────────────────────────
// INIT
// ──────────────────────────────────────────────────
function initButtons() {
  if (window.__uiBound1737) return;
  window.__uiBound1737 = true;
  document.addEventListener("click", (ev) => {
    const btn = ev.target?.closest?.(".soft-locked");
    if (!btn) return;
    ev.preventDefault();
    ev.stopPropagation();
    const reason = btn.dataset.lockReason || "Chưa đủ điều kiện.";
    showToast(reason, true);
  }, true);
  $("btnModeBasic")?.addEventListener("click", () => setActionMode("basic"));
  $("btnModeAdvanced")?.addEventListener("click", () => setActionMode("advanced"));
  $("btnCay")?.addEventListener("click", () => doAction(actionCayRuong));
  $("btnKhaiThac")?.addEventListener("click", () => doAction(actionKhaiThacDacSan));
  $("btnChatGo")?.addEventListener("click", () => doAction(actionChatGo));
  $("btnDetVai")?.addEventListener("click", () => doAction(actionDetVai));
  $("btnCauCa")?.addEventListener("click", () => doAction(actionCauCaSong));
  $("btnDanhBat")?.addEventListener("click", () => doAction(actionDanhBatVenBien));
  $("btnChanNuoi")?.addEventListener("click", () => doAction(actionChanNuoiLon));
  $("btnNauRuou")?.addEventListener("click", () => doAction(actionNauRuou));
  // btnNghi removed (stamina auto-regens daily)
  $("btnBuonMuoi")?.addEventListener("click", () => doAction(actionBuonLauMuoi));
  $("btnRebelTrain")?.addEventListener("click", () => doAction(actionRebelTrain));
  $("btnRebelRaid")?.addEventListener("click", () => doAction(actionRebelRaidSupply));
  $("btnRebelAid")?.addEventListener("click", () => doAction(actionRebelAidPeople));
  $("btnRebelBurn")?.addEventListener("click", () => doAction(actionRebelBurnYamen));
  $("btnRebelRecruit")?.addEventListener("click", () => doAction(actionRebelRecruitLocal));
  $("btnSave")?.addEventListener("click", window.actionSaveGame);
  $("btnLoad")?.addEventListener("click", window.actionLoadGame);
  $("btnMoBinh")?.addEventListener("click", () => doAction(actionMoBinh));

  // Tutorial modal navigation
  $("tutorialPrev")?.addEventListener("click", () => {
    if (tutPage > 0) { tutPage--; renderTutorialPage(); }
  });
  $("tutorialNext")?.addEventListener("click", () => {
    if (tutPage < TUTORIAL_PAGES.length - 1) { tutPage++; renderTutorialPage(); }
    else closeTutorialModal(true);
  });
  $("tutorialModal")?.addEventListener("click", (ev) => {
    if (ev.target?.id === "tutorialModal") closeTutorialModal(false);
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && $("tutorialModal")?.classList.contains("open")) closeTutorialModal(false);
  });

  // Politics
  $("btnThue")?.addEventListener("click", () => {
    const v = state.village;
    const gained = Math.floor(totalPops(v) * 0.5);
    v.quyLang += gained;
    logLine(state, `Rà soát sổ thuế. Thu thêm ${gained} quan vào quỹ làng.`);
    showToast(`+${gained} Quan quỹ làng`);
    render();
  });
  $("btnTiec")?.addEventListener("click", () => {
    const p = state.player;
    if (p.tien < 50) { showToast("Cần 50 Quan mở tiệc.", true); return; }
    p.tien -= 50; state.village.unrest -= 15; p.uyTinCong += 20;
    state.village.unrest = Math.max(0, state.village.unrest);
    logLine(state, "Mở tiệc xoa dịu dân tình. Bất ổn giảm mạnh.");
    showToast("Tiệc thành công! Bất ổn −15, Uy Tín +20");
    render();
  });
  $("btnTrung")?.addEventListener("click", () => {
    state.village.unrest -= 20; state.village.unrest = Math.max(0, state.village.unrest);
    state.player.uyTinCong -= 20;
    logLine(state, "Trừng phạt công khai góc chợ. Dân sợ hãi, bất ổn giảm.");
    showToast("Bất ổn −20, uy tín −20");
    render();
  });
  $("btnDanPhu")?.addEventListener("click", () => {
    const p = state.player;
    if (p.theLuc < 30) { showToast("Thể lực không đủ.", true); return; }
    p.theLuc -= 30;
    state.village.unrest = Math.max(0, state.village.unrest - 5);
    logLine(state, "Điều dân đắp đê bờ. Công trình thủy lợi tăng sản lượng.");
    showToast("Đắp đê thành công!");
    render();
  });

  // Time controls
  $("btnPause")?.addEventListener("click", () => {
    paused = !paused;
    syncTimeUi();
  });

  // Prisoner modal close
  $("prisonerClose")?.addEventListener("click", () => {
    $("prisonerModal")?.classList.remove("open");
    $("prisonerModal")?.setAttribute("aria-hidden", "true");
  });

  // Activity modal close
  $("activityClose")?.addEventListener("click", () => {
    const st = state && activityStatus(state);
    $("activityModal")?.classList.remove("open");
    $("activityModal")?.setAttribute("aria-hidden", "true");
    if (st?.active && st.phase === "ready") {
      showToast("Ghi danh vẫn còn. Bấm dòng 📅 (lịch kỳ thi) dưới HUD để mở lại và chọn «Vào cuộc».", false);
    }
  });

  // Case modal close
  $("caseClose")?.addEventListener("click", () => {
    $("caseModal")?.classList.remove("open");
    $("caseModal")?.setAttribute("aria-hidden", "true");
  });
  ["btnSpeed1","btnSpeed2","btnSpeed3"].forEach((id, i) => {
    $(id)?.addEventListener("click", () => {
      speed = i + 1;
      paused = false;
      setIntervalSpeed(speed);
      syncTimeUi();
    });
  });
  $("btnSpeedPresetSlow")?.addEventListener("click", () => setSpeedProfile("slow"));
  $("btnSpeedPresetNormal")?.addEventListener("click", () => setSpeedProfile("normal"));
  $("btnSpeedPresetFast")?.addEventListener("click", () => setSpeedProfile("fast"));
  $("btnDifficultyEasy")?.addEventListener("click", () => window.setDifficulty("easy"));
  $("btnDifficultyNormal")?.addEventListener("click", () => window.setDifficulty("normal"));
  $("btnDifficultyHardcore")?.addEventListener("click", () => window.setDifficulty("hardcore"));

  ["all","kinhte","dongho","honnhan","sukien","chienbao"].forEach(mode => {
    $(`logFilter_${mode}`)?.addEventListener("click", () => {
      logFilterMode = mode;
      ["all","kinhte","dongho","honnhan","sukien","chienbao"].forEach(m => {
        $(`logFilter_${m}`)?.classList.toggle("active", m === mode);
      });
      renderLog();
    });
  });

  $("logEntries")?.addEventListener("click", (ev) => {
    const btn = ev.target.closest(".war-brief-toggle");
    if (!btn) return;
    const body = btn.closest(".war-brief-block")?.querySelector(".war-brief-body");
    if (!body) return;
    if (body.hasAttribute("hidden")) body.removeAttribute("hidden");
    else body.setAttribute("hidden", "");
    const n = body.querySelectorAll(".war-brief-line").length || 0;
    btn.textContent = body.hasAttribute("hidden") ? `Xem ${n} trận — chi tiết ▾` : `Thu gọn (${n} trận) ▴`;
  });

  // Mute
  $("btnMuteAudio")?.addEventListener("click", () => {
    const isMuted = audioManager.toggleMute();
    $("btnMuteAudio").textContent = isMuted ? "🔇" : "🔊";
  });
  $("btnQuickLog")?.addEventListener("click", () => openTab("tabLog", { markSeen: true }));
  $("playerWantedBadge")?.addEventListener("click", () => {
    const lvl = state?.player?.wantedLevel || 0;
    if (lvl <= 0) return;
    showToast(`Truy nã mức ${lvl}: tuần binh gắt hơn, tăng nguy cơ bị bắt, hạn chế thi cử/chính danh.`);
  });
  $("delayedWarningBadge")?.addEventListener("click", () => {
    const pending = state?._delayedEffects || [];
    if (pending.length === 0) return;
    const lines = pending.slice(0, 3).map(ef => {
      if (ef.type === "clan_retaliation") return "• Trả đũa dòng họ: có thể mất tiền + uy tín khi tới hạn.";
      if (ef.type === "clan_favor_callin") return "• Ân tình gọi lại: có thể bị thu phí đáp lễ khi tới hạn.";
      return "• Có một hệ quả trễ đang chờ xử lý.";
    });
    showToast(`Hậu quả treo ${pending.length}: ${lines.join(" ")}`);
  });

  // Settings
  $("btnSettings")?.addEventListener("click", () => {
    window.refreshSaveSlotUi();
    if ($("chkPerfMode")) $("chkPerfMode").checked = !!state?.performanceMode;
    updateUiUxModeUi();
    updateThemeInkUi();
    $("settingsModal")?.classList.add("open");
    $("settingsModal")?.setAttribute("aria-hidden","false");
  });
  $("settingsClose")?.addEventListener("click", () => {
    $("settingsModal")?.classList.remove("open");
    $("settingsModal")?.setAttribute("aria-hidden","true");
  });
  $("saveSlotSelect")?.addEventListener("change", (e) => {
    const slot = Number(e.target?.value || 1);
    setActiveSaveSlot(slot);
    window.refreshSaveSlotUi();
  });
  $("npcModalClose")?.addEventListener("click", () => {
    $("npcModal").classList.remove("open");
    $("npcModal").setAttribute("aria-hidden","true");
  });

  $("celebrateClose")?.addEventListener("click", () => {
    closeCelebrateModal();
    // if queue still has items, show next
    drainCelebrations();
  });

  // Volume
  $("volumeSlider")?.addEventListener("input", e => {
    audioManager.setVolume(+e.target.value / 100);
  });

  // BGM
  $("chkBgm")?.addEventListener("change", e => {
    if (e.target.checked) {
      audioManager.unlock().then(() => audioManager.startBg()).catch(() => {});
    } else {
      audioManager.stopBg();
    }
  });
  $("chkPerfMode")?.addEventListener("change", e => {
    if (!state) return;
    state.performanceMode = !!e.target?.checked;
    applyPerformanceModeUi();
    showToast(state.performanceMode ? "Đã bật Performance Mode." : "Đã tắt Performance Mode.");
  });
  $("btnUxModeNewbie")?.addEventListener("click", () => window.setUiUxMode("newbie"));
  $("btnUxModeStrategic")?.addEventListener("click", () => window.setUiUxMode("strategic"));
  $("btnThemeInkSoft")?.addEventListener("click", () => window.setThemeInkMode("soft"));
  $("btnThemeInkBold")?.addEventListener("click", () => window.setThemeInkMode("bold"));
  $("warMiniMapCanvas")?.addEventListener("click", (ev) => {
    const canvas = ev.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / Math.max(1, rect.width);
    const sy = canvas.height / Math.max(1, rect.height);
    const x = (ev.clientX - rect.left) * sx;
    const y = (ev.clientY - rect.top) * sy;
    const hit = _warMiniMapCells.find(c => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h);
    if (!hit?.hid) return;
    window.focusMapToHuyen(hit.hid);
  });
  $("warMiniMapCanvas")?.addEventListener("mousemove", (ev) => {
    const canvas = ev.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / Math.max(1, rect.width);
    const sy = canvas.height / Math.max(1, rect.height);
    const x = (ev.clientX - rect.left) * sx;
    const y = (ev.clientY - rect.top) * sy;
    const hit = _warMiniMapCells.find(c => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h);
    canvas.title = hit?.hid ? `Tới huyện: ${hit.hid}${hit.hot ? " · đang có chiến sự" : ""}` : "Mini bản đồ chiến tuyến";
  });

  // Tab switching
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      openTab(btn.dataset.target, { markSeen: true });
    });
  });
  const nav = document.querySelector(".nav-tabs");
  const navScroll = document.getElementById("navTabsScroll");
  navScroll?.addEventListener("scroll", () => updateTabDiscoverabilityUi(), { passive: true });
  const nudge = (el, delta) => {
    if (!navScroll || !el) return;
    el.addEventListener("click", (e) => {
      e.preventDefault();
      navScroll.scrollBy({ left: delta, behavior: "smooth" });
    });
  };
  nudge(document.getElementById("btnNavTabsPrev"), -Math.min(220, typeof window !== "undefined" ? window.innerWidth * 0.55 : 200));
  nudge(document.getElementById("btnNavTabsNext"), Math.min(220, typeof window !== "undefined" ? window.innerWidth * 0.55 : 200));

  const btnCollapse = document.getElementById("btnNavTabsCollapse");
  if (btnCollapse && nav) {
    const syncCollapseUi = () => {
      const collapsed = nav.classList.contains("nav-tabs--collapsed");
      btnCollapse.setAttribute("aria-expanded", collapsed ? "false" : "true");
      btnCollapse.textContent = collapsed ? "›" : "‹";
      btnCollapse.title = collapsed ? "Mở thanh tab" : "Thu gọn thanh tab";
      updateTabDiscoverabilityUi();
    };
    btnCollapse.addEventListener("click", (e) => {
      e.preventDefault();
      nav.classList.toggle("nav-tabs--collapsed");
      syncCollapseUi();
    });
    syncCollapseUi();
  }

  window.addEventListener("resize", () => updateTabDiscoverabilityUi());
  updateTabDiscoverabilityUi();
  window.refreshSaveSlotUi();
}

// Unlock audio on first touch (without blocking natural scroll)
document.addEventListener("touchstart", function() {
  if (!audioManager.unlocked) {
    audioManager.unlock().then(() => {
      // Audio context resumed
    }).catch(() => {});
    if ($("chkBgm")?.checked) {
      audioManager.startBg();
    }
  }
}, { passive: true });

// Mobile Safari pull-to-refresh guard: keep vertical gesture inside game containers.
let touchStartY = 0;
document.addEventListener("touchstart", (e) => {
  touchStartY = e.touches?.[0]?.clientY || 0;
}, { passive: true });
document.addEventListener("touchmove", (e) => {
  const target = e.target;
  /* Thanh tab cuộn ngang: không áp logic chặn “kéo dọc mép” — trước đây .nav-tabs bị coi là scroll dọc (scrollTop=0) nên preventDefault làm hỏng vuốt ngang. */
  if (target?.closest?.(".nav-tabs, .nav-tabs-scroll, .nav-tabs-inner, .nav-tabs-nudge, .nav-tabs-collapse-btn")) {
    return;
  }
  const scroller = target?.closest?.(".tab-content-area, .start-box, .modal-inner");
  if (!scroller) {
    if ((window.scrollY || document.documentElement.scrollTop || 0) <= 0 && (e.touches?.[0]?.clientY || 0) > touchStartY) {
      e.preventDefault();
    }
    return;
  }
  const y = e.touches?.[0]?.clientY || 0;
  const goingDown = y > touchStartY;
  const goingUp = y < touchStartY;
  const atTop = scroller.scrollTop <= 0;
  const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
  if ((goingDown && atTop) || (goingUp && atBottom)) {
    e.preventDefault();
  }
}, { passive: false });

// Prevent pinch-to-zoom
document.addEventListener("gesturestart", function(e) { e.preventDefault(); }, { passive: false });
document.addEventListener("gesturechange", function(e) { e.preventDefault(); }, { passive: false });

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && $("chkBgm")?.checked) {
    audioManager.unlock().then(() => audioManager.startBg()).catch(() => {});
    setTimeout(() => {
      if ($("chkBgm")?.checked) audioManager.unlock().then(() => audioManager.startBg()).catch(() => {});
    }, 250);
  }
});
window.addEventListener("pageshow", () => {
  if ($("chkBgm")?.checked) {
    audioManager.unlock().then(() => audioManager.startBg()).catch(() => {});
  }
});
window.addEventListener("focus", () => {
  if ($("chkBgm")?.checked) {
    audioManager.unlock().then(() => audioManager.startBg()).catch(() => {});
  }
});

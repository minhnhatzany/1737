// T3.3-2b — cày thuê (job kind="farm", employer = lý trưởng xã) + cấy rẽ (thửa
// tenure="re" + landlordId + reShare). Xã ghế trống (Vạn Xuân) -> chặn, ĐÚNG câu
// chuyện thiết kế, không phải lỗi. actionNghiViec: player tự nghỉ việc.
import { createInitialState, actionCayThue, actionCayRe, actionNghiViec, processMonthlyWages } from "../engine.js";
import { JobKind, JOB_WAGE_BASE } from "../core/employment.js";
import { FarmTenure, RE_SHARE_TO_LANDLORD } from "../core/farm.js";

let pass = true;
const check = (name, cond) => { console.log((cond ? "  ok  " : " FAIL ") + name); if (!cond) pass = false; };

const vxId = s => {
  for (const t of Object.values(s._geoCache.minh_nghia.tong))
    for (const x of Object.values(t.xa)) if (x.name === "Vạn Xuân") return x.id;
};

// --- 1. RE_SHARE con số ---
check("RE_SHARE_TO_LANDLORD = 0.5 (cấy 'rẽ' = chia đôi)", RE_SHARE_TO_LANDLORD === 0.5);

// --- 2. actionCayThue: job kind=farm, employer = lý trưởng xã ---
{
  const s = createInitialState("T", 7);
  const p = s.player;
  const seatId = "seat_xa_" + s.village.xaId;
  const lyId = s.seats[seatId].occupantId;
  check("xã spawn có lý trưởng", !!lyId);
  const r = actionCayThue(s);
  check("cày thuê ok", r.ok === true);
  check("p._jobs: 1 job kind=farm, employerId+ref = lý trưởng, wage = JOB_WAGE_BASE.farm",
    p._jobs.length === 1 && p._jobs[0].kind === "farm" && p._jobs[0].employerId === lyId
    && p._jobs[0].ref === lyId && p._jobs[0].wagePerMonth === JOB_WAGE_BASE[JobKind.FARM]);
  check("cày thuê lần 2 -> chặn (đang có việc)", actionCayThue(s).ok === false);
  // lương chảy qua processMonthlyWages (đã có từ T3.3-1): lý trưởng −wage, player +wage
  const boss = s.npcById[lyId];
  boss.tien = 100;
  const pt0 = p.tien, bt0 = boss.tien;
  processMonthlyWages(s);
  check("processMonthlyWages: lý trưởng −wage, player +wage",
    boss.tien === bt0 - JOB_WAGE_BASE[JobKind.FARM] && p.tien === pt0 + JOB_WAGE_BASE[JobKind.FARM]);
}

// --- 3. actionNghiViec ---
{
  const s = createInitialState("T", 7);
  const p = s.player;
  check("không có việc -> nghỉ việc từ chối", actionNghiViec(s).ok === false);
  actionCayThue(s);
  check("có việc -> nghỉ việc ok, _jobs rỗng", actionNghiViec(s).ok === true && p._jobs.length === 0);
}

// --- 4. actionCayRe: thửa tenure=re, landlordId + reShare ---
{
  const s = createInitialState("T", 7);
  const p = s.player;
  const lyId = s.seats["seat_xa_" + s.village.xaId].occupantId;
  const r = actionCayRe(s);
  check("cấy rẽ ok, +1 thửa tenure=re", r.ok && p.farmPlots.length === 1 && p.farmPlots[0].tenure === "re");
  check("thửa rẽ: landlordId = lý trưởng, reShare = 0.5",
    p.farmPlots[0].landlordId === lyId && p.farmPlots[0].reShare === RE_SHARE_TO_LANDLORD);
  check("cấy rẽ lần 2 cùng xã -> chặn", actionCayRe(s).ok === false);
}

// --- 5. cày thuê <-> cấy rẽ loại trừ nhau ---
{
  const s = createInitialState("T", 7);
  actionCayThue(s);
  check("đang cày thuê -> cấy rẽ bị chặn", actionCayRe(s).ok === false);
  actionNghiViec(s);
  actionCayRe(s);
  check("đang cấy rẽ -> cày thuê bị chặn", actionCayThue(s).ok === false);
}

// --- 6. Vạn Xuân (ghế trống cố ý) -> cả hai bị chặn, thông báo rõ ---
{
  const s = createInitialState("T", 7);
  s.village = s.villagesByXa[vxId(s)];
  s.player.currentXa = s.village.xaId;
  check("seat Vạn Xuân occupantId = null", s.seats["seat_xa_" + s.village.xaId].occupantId == null);
  const rT = actionCayThue(s), rR = actionCayRe(s);
  check("Vạn Xuân: cày thuê bị chặn, msg nói 'chưa có ai đứng đầu'", rT.ok === false && /chưa có ai đứng đầu/.test(rT.msg));
  check("Vạn Xuân: cấy rẽ bị chặn tương tự", rR.ok === false && /chưa có ai đứng đầu/.test(rR.msg));
  check("Vạn Xuân: không tạo thửa, không tạo job", s.player.farmPlots.length === 0 && (s.player._jobs || []).length === 0);
}

// --- 7. RNG + world-gen ---
{
  const s = createInitialState("T", 42);
  const rngBefore = s.rngState;
  actionCayThue(s); actionNghiViec(s); actionCayRe(s);
  check("cày thuê/cấy rẽ/nghỉ việc KHÔNG đụng state.rngState", s.rngState === rngBefore);
}
let badRng = 0;
for (let seed = 1; seed <= 60; seed++) { const st = createInitialState("T", seed); if (st.rngState !== st.rngSeed) badRng++; }
check("rngState === rngSeed trên 60 seed", badRng === 0);
for (const [seed, n] of [[999, 11], [4242, 10]]) {
  check(`seed ${seed}: NPC ngoài QO = ${n} (world-gen không lệch)`,
    createInitialState("T", seed).npcs.filter(x => x.currentPhu !== "quang_oai").length === n);
}

console.log(pass ? "PASS - T3.3-2b: cày thuê (job farm) + cấy rẽ (reShare 0.5) + nghỉ việc, Vạn Xuân chặn đúng" : "FAIL - T3.3-2b");
process.exit(pass ? 0 : 1);

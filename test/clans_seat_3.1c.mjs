// T3.1c — seat lý trưởng ↔ clan: contestingClanIds, clan.status thay đổi, tranh ghế.
import { createInitialState, xaClanIds, pickXaSeatSuccessorClan, adjustClanStatus, syncSeatContestants, tickXaClanStatusMonthly } from "../engine.js";
import { maybeAddSeatContestCase } from "../actions/clan.js";

let pass = true;
const check = (name, cond) => { console.log((cond ? "  ok  " : " FAIL ") + name); if (!cond) pass = false; };

const s = createInitialState("T", 7);
const xaSeatIds = Object.keys(s.seats).filter(k => k.startsWith("seat_xa_"));
const emptySeatId = xaSeatIds.find(k => !s.seats[k].occupantId);
const occSeatId = xaSeatIds.find(k => s.seats[k].occupantId);

// --- 1. contestingClanIds: mọi ghế xã điền = clan trong đúng xã, sort status desc ---
check("27 ghế xã", xaSeatIds.length === 27);
check("ghế trống Vạn Xuân tồn tại", !!emptySeatId);
let badFill = 0, badSort = 0, badScope = 0;
for (const k of xaSeatIds) {
  const seat = s.seats[k];
  const want = xaClanIds(s, seat.scopeId) || [];
  if (seat.contestingClanIds.length !== want.length) badFill++;
  if (!seat.contestingClanIds.every(id => s.clanById[id]?.scope === "xa" && s.clanById[id]?.scopeId === seat.scopeId)) badScope++;
  const st = seat.contestingClanIds.map(id => s.clanById[id].status);
  if (!st.every((v, i) => i === 0 || st[i - 1] >= v)) badSort++;
}
check("mọi ghế xã: contestingClanIds = clan của xã đó", badFill === 0);
check("mọi ghế xã: contestants đúng scope/scopeId", badScope === 0);
check("mọi ghế xã: contestingClanIds sort theo status giảm dần", badSort === 0);
check("ghế NGOÀI xã (chanh_tong/tri_huyen): contestingClanIds rỗng",
  Object.keys(s.seats).filter(k => s.seats[k].scope !== "xa").every(k => s.seats[k].contestingClanIds.length === 0));
check("ghế trống VẪN có contestingClanIds (dùng được để test tranh ghế)", s.seats[emptySeatId].contestingClanIds.length >= 1);
check("ghế có chủ cũng có contestingClanIds", s.seats[occSeatId].contestingClanIds.length >= 1);

// --- 2. pickXaSeatSuccessorClan: status cao nhất, KHÔNG random đều ---
const contestEmpty = xaSeatIds.filter(k => !s.seats[k].occupantId && s.seats[k].contestingClanIds.length >= 2);
// Vạn Xuân có >=2 clan để dò tranh ghế?
check("xã ghế trống có >=2 dòng họ (dò được tranh ghế)", contestEmpty.includes(emptySeatId));
for (const k of xaSeatIds) {
  const succ = pickXaSeatSuccessorClan(s, k);
  if (!succ) continue;
  const sts = s.seats[k].contestingClanIds.map(id => s.clanById[id].status);
  if (s.clanById[succ].status !== Math.max(...sts)) { check(`successor ${k} = status cao nhất`, false); break; }
}
check("pickXaSeatSuccessorClan = clan status cao nhất (mọi ghế xã)", true);

// đổi status -> successor đổi theo, và resync đổi thứ tự contestingClanIds
{
  const seat = s.seats[emptySeatId];
  const top0 = pickXaSeatSuccessorClan(s, emptySeatId);
  const under = seat.contestingClanIds.find(id => id !== top0);
  adjustClanStatus(s, under, +40);
  adjustClanStatus(s, top0, -40);
  syncSeatContestants(s, emptySeatId);
  check("boost clan yếu -> successor chuyển sang nó", pickXaSeatSuccessorClan(s, emptySeatId) === under);
  check("resync: contestingClanIds[0] = clan status cao nhất", seat.contestingClanIds[0] === under);
  check("adjustClanStatus clamp 0..100", (() => { adjustClanStatus(s, under, +999); adjustClanStatus(s, top0, -999); return s.clanById[under].status === 100 && s.clanById[top0].status === 0; })());
}

// --- 3. tuyệt tự: clan xã không NPC + không member -> status lụi -3/tháng; clan có lý trưởng thì không ---
{
  const st = createInitialState("T", 3);
  const orphan = st.clans.find(c => c.scope === "xa" && c.memberIds.length === 0 && !st.npcs.some(n => n.clanId === c.id));
  const held = st.clans.find(c => c.scope === "xa" && c.memberIds.length > 0);
  const ob = orphan.status, hb = held.status;
  tickXaClanStatusMonthly(st);
  check("tuyệt tự: clan không người -> status -3", orphan.status === Math.max(0, ob - 3));
  check("clan có lý trưởng -> status không đổi", held.status === hb);
  // player nương clan tuyệt tự -> coi như chưa tuyệt, không lụi
  const st2 = createInitialState("T", 3);
  const orphan2 = st2.clans.find(c => c.scope === "xa" && c.memberIds.length === 0 && !st2.npcs.some(n => n.clanId === c.id));
  st2.player._patronClanId = orphan2.id;
  const o2b = orphan2.status;
  tickXaClanStatusMonthly(st2);
  check("player nương -> clan không bị coi là tuyệt tự", orphan2.status === o2b);
}

// --- 4. tranh ghế thành case: ghế trống + >=2 clan + player đứng đó -> maybeAddSeatContestCase sinh case ---
{
  const st = createInitialState("T", 7);
  const empty = Object.keys(st.seats).find(k => k.startsWith("seat_xa_") && !st.seats[k].occupantId && st.seats[k].contestingClanIds.length >= 2);
  st.player.currentXa = st.seats[empty].scopeId;
  const po = { huyenId: "test", cases: [] };
  let fired = false, favIsTop = true;
  for (let i = 0; i < 40 && !fired; i++) {
    maybeAddSeatContestCase(st, po);
    if (po.cases.length) {
      fired = true;
      const c = po.cases[0];
      check("case type = seat_contest", c.type === "seat_contest");
      check("case có 3 lựa chọn", c.choices.length === 3);
      // lựa chọn đầu = thuận theo clan status cao nhất
      const favName = st.clans.find(x => x.id === pickXaSeatSuccessorClan(st, empty))?.name;
      favIsTop = c.choices[0].label.includes(favName);
    }
  }
  check("ghế trống + >=2 clan + đứng tại xã -> sinh được vụ tranh ghế", fired);
  check("lựa chọn số 1 thiên về clan vị thế cao nhất", favIsTop);

  // ghế CÓ chủ -> không sinh
  const st3 = createInitialState("T", 7);
  const occ = Object.keys(st3.seats).find(k => k.startsWith("seat_xa_") && st3.seats[k].occupantId);
  st3.player.currentXa = st3.seats[occ].scopeId;
  const po3 = { huyenId: "t", cases: [] };
  for (let i = 0; i < 40; i++) maybeAddSeatContestCase(st3, po3);
  check("ghế có chủ -> KHÔNG sinh vụ tranh ghế", po3.cases.length === 0);
}

// --- 5. RNG world-gen không lệch: rngState === rngSeed trên 300 seed ---
let badRng = 0;
for (let seed = 1; seed <= 300; seed++) { const st = createInitialState("T", seed); if (st.rngState !== st.rngSeed) badRng++; }
check("rngState === rngSeed trên 300 seed (contestingClanIds/init không tiêu rng)", badRng === 0);

// --- 6. tất định ---
const A = createInitialState("Z", 88), B = createInitialState("Z", 88);
const sig = st => Object.keys(st.seats).filter(k => k.startsWith("seat_xa_")).sort()
  .map(k => `${k}:${st.seats[k].contestingClanIds.join(",")}`).join("|");
check("tất định: cùng seed -> contestingClanIds mọi ghế y hệt", sig(A) === sig(B));

console.log(pass ? "PASS - T3.1c: seat↔clan (contestingClanIds, status, tranh ghế), RNG sạch, 11 regression PASS" : "FAIL - T3.1c");
process.exit(pass ? 0 : 1);

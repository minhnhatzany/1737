// T2.1c — actionAssumeOfficeHere ghi player vào ghế + syncRankFromSeats (một chiều).
// Không chơi để đạt rank: set thẳng player.rank/faction trong script rồi gọi hành động.
import { createInitialState } from "../engine.js";
import { PlayerRank, Faction } from "../models.js";
import { actionAssumeOfficeHere } from "../actions/office.js";

let pass = true;
const check = (name, cond) => { console.log((cond ? "  ok  " : " FAIL ") + name); if (!cond) pass = false; };

const s = createInitialState("Test 2.1c", 4242);

// Ghế tri huyện của vùng nhà = huyện player đang đứng lúc bắt đầu.
const seat = s.seats.seat_tri_huyen;
check("có seat_tri_huyen", !!seat);
check("player đứng đúng huyện của ghế", s.player.currentHuyen === seat.scopeId);
check("seatsByScope trỏ đúng ghế", s.seatsByScope["huyen:" + s.player.currentHuyen] === "seat_tri_huyen");

const oldOccId = seat.occupantId;                 // npcId đang giữ ghế (the_tap)
check("ghế đang do một NPC giữ", typeof oldOccId === "string" && oldOccId !== "player");
check("NPC đó có thật trong thế giới trước khi hất", s.npcs.some(n => n.id === oldOccId));
check("legitimacy ban đầu = the_tap", seat.legitimacy === "the_tap");

// Đạt trạng thái test bằng script, KHÔNG phải chơi.
s.player.rank = PlayerRank.TRI_HUYEN;
s.player.faction = Faction.TRIEU_DINH;
const rankBefore = s.player.rank;

const res = actionAssumeOfficeHere(s);

check("hành động ok", res && res.ok === true);
check("seat.occupantId -> 'player'", seat.occupantId === "player");
check("seat.legitimacy -> bo_nhiem", seat.legitimacy === "bo_nhiem");
check("seat.appointedDay = gameDay", seat.appointedDay === s.gameDay);
check("player.rank không đổi lung tung (vẫn TRI_HUYEN)", s.player.rank === rankBefore && s.player.rank === PlayerRank.TRI_HUYEN);
check("NPC cũ vẫn còn trong state.npcs (bị hất khỏi ghế, không bị xoá)", s.npcs.some(n => n.id === oldOccId));
check("NPC cũ vẫn còn trong state.npcById", !!s.npcById[oldOccId]);

// Huyện KHÁC không có ghế -> hành vi cũ y nguyên, không tạo ghế mới.
const before = Object.keys(s.seats).length;
s.player.currentHuyen = "khong_ton_tai_huyen_xyz";
const res2 = actionAssumeOfficeHere(s);
check("huyện không có ghế: vẫn ok (đứng đâu nhậm đó)", res2 && res2.ok === true);
check("huyện không có ghế: KHÔNG tạo ghế mới", Object.keys(s.seats).length === before);

console.log(pass ? "PASS - T2.1c: nhậm chức ghi lên ghế + sync rank một chiều đúng" : "FAIL - T2.1c");
process.exit(pass ? 0 : 1);

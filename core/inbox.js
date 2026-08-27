/**
 * core/inbox.js — Hộp thư sự kiện (bước 9a).
 * Thay state.pendingEvent cho luồng sự kiện đời thường: sự kiện vào state.inbox[],
 * đồng hồ KHÔNG bị chặn khi có thư chưa trả lời.
 *
 * NGOẠI LỆ: sự kiện hành quân (road_bandit/scholar/broker/inn, arrive_battlefield)
 * VẪN dùng state.pendingEvent — đó là một phiên đi đường liên tục, không phải thư từ.
 * GĐ2 sẽ tính lại khi làm vận chuyển + cướp đường.
 *
 * Phân loại (đánh dấu trên chính event object lúc tạo):
 *   - blocking: true  -> thư không bao giờ hết hạn; bước 9b sẽ khoá HÀNH ĐỘNG VẬT CHẤT
 *                        của người chơi tới khi trả lời (KHÔNG khoá đồng hồ, KHÔNG khoá
 *                        hành động xã hội — xem brief C.3 mục 6). Bản offline chưa có
 *                        action xã hội nên tạm chỉ cần khoá action vật chất.
 *   - onExpire(state) -> hết hạn thì gọi hàm này (việc BÊN NGOÀI vẫn xảy ra dù người
 *                        chơi có mặt hay không: triều đình vẫn thanh tra, vẫn trưng binh,
 *                        loạn vẫn lan). Không được đổi phe / đổi chức / khoá nhánh mới.
 *   - (không đánh dấu) -> hết hạn = no-op + logLine. Mọi thứ xảy ra VỚI người chơi
 *                        (mất tiền, bị đánh, bị bắt) đều thuộc loại này: không có mặt thì không bị.
 */
import { logLine } from "../log.js";

// Bước 9b: tối đa 5 thư xếp chồng. Đầy 5 -> các cổng !inboxFull() ngừng đẻ event mới.
export const INBOX_MAX = 5;
const INBOX_HARD_CAP = 20;

function absDay(state) {
  return (state.ban - 1737) * 360 + state.monthIndex * 30 + (state.gameDay || 1);
}

export function inboxFull(state) {
  return (state.inbox && state.inbox.length ? state.inbox.length : 0) >= INBOX_MAX;
}

/** Đưa một event object vào hộp thư. blocking => không hạn; ngược lại hạn = nhận + (inboxDays||5). */
export function pushInbox(state, ev) {
  if (!ev) return;
  if (!Array.isArray(state.inbox)) state.inbox = [];
  if (state.inbox.some(x => x.id === ev.id)) return;
  const receivedDay = absDay(state);
  const deadlineDay = ev.blocking ? null : receivedDay + (ev.inboxDays || 5);
  state.inbox.push(Object.assign({}, ev, { receivedDay, deadlineDay }));
  if (state.inbox.length > INBOX_HARD_CAP) state.inbox.length = INBOX_HARD_CAP;
}

/** Chuyển pendingEvent (không phải sự kiện hành quân) sang hộp thư. Idempotent. */
export function drainPendingToInbox(state) {
  const ev = state.pendingEvent;
  if (!ev) return;
  if (state.travel && state.travel.active) return; // sự kiện hành quân: để nguyên trên pendingEvent
  state.pendingEvent = null;
  pushInbox(state, ev);
}

/**
 * Quét thư quá hạn. blocking (deadlineDay == null) không bao giờ hết hạn.
 * Có onExpire => gọi nó. Không có => no-op + logLine. Thư luôn được gỡ khỏi inbox.
 * (onExpire/choices là hàm nên không sống qua save/load JSON — giống pendingEvent cũ;
 *  bước 10 xoá save/load, GĐ3 làm lại persistence nên chấp nhận được. Có guard typeof.)
 */
export function expireInbox(state) {
  if (!Array.isArray(state.inbox) || state.inbox.length === 0) return;
  const now = absDay(state);
  for (let i = state.inbox.length - 1; i >= 0; i--) {
    const it = state.inbox[i];
    if (it.deadlineDay == null) continue;
    if (now <= it.deadlineDay) continue;
    state.inbox.splice(i, 1);
    if (typeof it.onExpire === "function") {
      try { it.onExpire(state); } catch (e) { /* onExpire lỗi: bỏ qua, thư vẫn đã được gỡ */ }
    } else {
      logLine(state, "⏳ " + (it.title || "Một việc") + ": bạn không kịp xử lý, cơ hội trôi qua.");
    }
  }
}

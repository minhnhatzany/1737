// Bước 9a — hộp thư không chặn đồng hồ + xử lý quá hạn A/B/C.
import { createInitialState, gameTick } from "../engine.js";
import { pushInbox, drainPendingToInbox, expireInbox, inboxFull } from "../core/inbox.js";

let pass = true;
const check = (name, cond) => { console.log((cond ? "  ok  " : " FAIL ") + name); if (!cond) pass = false; };

// --- 1. state có inbox ---
const s = createInitialState("Test", 42);
check("createInitialState có state.inbox = []", Array.isArray(s.inbox) && s.inbox.length === 0);

// --- 2. đồng hồ chạy dù inbox có thư chưa trả lời ---
// mô phỏng vòng tickGame: gameDay++ ; gameTick ; (rollDailyEvent bỏ qua) ; drain
pushInbox(s, { id: "seed_letter", title: "Thư thử", narrative: "", choices: [{ label: "x", apply(){} }] });
const day0 = (s.ban - 1737) * 360 + s.monthIndex * 30 + s.gameDay;
for (let i = 0; i < 200; i++) {
  s.gameDay++;
  if (s.gameDay >= 31) { s.gameDay = 1; s.monthIndex++; if (s.monthIndex > 12) { s.monthIndex = 1; s.ban++; } }
  gameTick(s);
  drainPendingToInbox(s);
}
const day1 = (s.ban - 1737) * 360 + s.monthIndex * 30 + s.gameDay;
check("200 vòng tick -> thời gian tiến đúng 200 ngày kể cả khi inbox có thư", day1 - day0 === 200);

// --- 3. type A: quá hạn -> no-op + logLine + gỡ khỏi inbox ---
const a = createInitialState("A", 1);
const logBefore = a.log.length;
pushInbox(a, { id: "ev_a", title: "Cơ hội A", narrative: "", choices: [{ label: "y", apply(st){ st.player.tien += 9999; } }] });
const itemA = a.inbox.find(x => x.id === "ev_a");
check("type A có deadlineDay (số)", typeof itemA.deadlineDay === "number");
a.gameDay += 10; // vượt hạn +5
expireInbox(a);
check("type A hết hạn -> bị gỡ khỏi inbox", !a.inbox.some(x => x.id === "ev_a"));
check("type A hết hạn -> KHÔNG áp choice (tiền không đổi)", a.player.tien < 9999);
check("type A hết hạn -> có logLine 'cơ hội trôi qua'", a.log.length > logBefore && /trôi qua/.test(a.log[0].text));

// --- 4. type C blocking: deadlineDay = null, không bao giờ hết hạn ---
const c = createInitialState("C", 2);
pushInbox(c, { id: "ev_c", title: "Bị bắt", blocking: true, narrative: "", choices: [{ label: "z", apply(){} }] });
const itemC = c.inbox.find(x => x.id === "ev_c");
check("type C: deadlineDay == null", itemC.deadlineDay == null);
c.gameDay += 25; c.monthIndex += 3;
expireInbox(c);
check("type C: sau rất lâu VẪN còn trong inbox", c.inbox.some(x => x.id === "ev_c"));

// --- 5. type B onExpire: hết hạn -> gọi onExpire (không áp choice) ---
const b = createInitialState("B", 3);
let fired = 0;
pushInbox(b, {
  id: "ev_b", title: "Trưng binh", narrative: "",
  onExpire(st){ fired++; st.player.uyTinCong = Math.max(0, st.player.uyTinCong - 5); },
  choices: [{ label: "w", apply(st){ st.player.tien += 9999; } }],
});
b.gameDay += 10;
expireInbox(b);
check("type B hết hạn -> onExpire chạy đúng 1 lần", fired === 1);
check("type B hết hạn -> KHÔNG áp choice", b.player.tien < 9999);
check("type B hết hạn -> bị gỡ khỏi inbox", !b.inbox.some(x => x.id === "ev_b"));

// --- 6. inboxFull(): true khi đã đủ INBOX_MAX thư (9b: 5). Gate ở nơi sinh sự kiện dùng cái này. ---
import { INBOX_MAX } from "../core/inbox.js";
const f = createInitialState("F", 4);
check("inbox rỗng -> inboxFull() = false", inboxFull(f) === false);
for (let i = 0; i < INBOX_MAX; i++) pushInbox(f, { id: "m" + i, title: "" + i, narrative: "", choices: [] });
check(`đủ ${INBOX_MAX} thư -> inboxFull() = true`, inboxFull(f) === true);
pushInbox(f, { id: "m0", title: "dup", narrative: "", choices: [] });
check("pushInbox trùng id -> không thêm bản sao", f.inbox.length === INBOX_MAX);

console.log(pass ? "\nPASS - hộp thư 9a hoạt động đúng A/B/C, đồng hồ không bị chặn" : "\nFAIL");
process.exit(pass ? 0 : 1);

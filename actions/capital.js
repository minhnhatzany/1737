import { CapitalKind, CAPITAL_PRICE, CAPITAL_LABEL, makeCapital } from "../core/capital.js";
import { totalDaysAbs } from "../engine.js";
import { logLine } from "../log.js";

/**
 * T3.2b — mua một công cụ / vốn cá nhân. Tức thời (không buildQueue), chỉ gate tiền.
 * Id qua state._capitalSeq (khuôn _prisonerSeq), KHÔNG Date.now().
 */
export function actionMuaCongCu(state, kind) {
  const p = state.player;
  if (!Object.values(CapitalKind).includes(kind)) {
    return { ok: false, msg: "Loại công cụ không hợp lệ." };
  }
  const price = CAPITAL_PRICE[kind];
  const label = CAPITAL_LABEL[kind];
  if (p.tien < price) {
    return { ok: false, msg: `Sắm ${label} cần ${price} Quan. Ngươi có ${p.tien}.` };
  }

  p.tien -= price;
  if (!Array.isArray(p.capital)) p.capital = [];
  state._capitalSeq = (state._capitalSeq || 1) + 1;
  const item = makeCapital({ kind, seq: state._capitalSeq, day: totalDaysAbs(state) });
  p.capital.push(item);

  logLine(state, `Sắm ${label} hết ${price} Quan. Của nhà, dùng lâu dài.`, true);
  return {
    ok: true,
    feedback: [
      { text: `+1 ${label}`, tone: "good" },
      { text: `-${price} Quan`, tone: "bad" },
    ],
    sfx: "coin",
  };
}

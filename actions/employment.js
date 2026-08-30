import { JobKind, JOB_WAGE_BASE, SHOP_WORKER_CAP, attachJob, detachJob } from "../core/employment.js";
import { totalDaysAbs } from "../engine.js";
import { SHOP_LABEL } from "../core/shops.js";
import { logLine } from "../log.js";

/** Cửa hàng người chơi đang giữ (T3.2c: tối đa 1). */
function playerShop(state) {
  return Object.values(state.shops || {}).find(s => s.occupantId === state.player?.id) || null;
}

/**
 * T3.3-1 — thuê một người vào làm ở cửa hàng của mình.
 * Chỉ thuê AI (state.npcById) ở bước này; người chơi khác = GĐ3.
 * KHÔNG ràng buộc địa lý (cùng xã hay không) — thêm sau nếu chơi thử thấy cần.
 */
export function actionThueNguoi(state, workerId) {
  const p = state.player;
  const shop = playerShop(state);
  if (!shop) return { ok: false, msg: "Ngươi chưa có cơ nghiệp nào để thuê người." };
  const label = SHOP_LABEL[shop.loai] || "cửa hàng";

  if (!Array.isArray(shop.workerIds)) shop.workerIds = [];
  if (shop.workerIds.length >= SHOP_WORKER_CAP) {
    return { ok: false, msg: `${label} đã đủ người làm (tối đa ${SHOP_WORKER_CAP}).` };
  }

  const worker = state.npcById?.[workerId];
  if (!worker) return { ok: false, msg: "Không tìm thấy người này." };
  if (worker.seatId) return { ok: false, msg: `${worker.name} đang giữ chức, không đi làm thuê.` };
  if (worker.shopId) return { ok: false, msg: `${worker.name} đang có cơ nghiệp riêng.` };
  if (Array.isArray(worker._jobs) && worker._jobs.length > 0) {
    return { ok: false, msg: `${worker.name} đang có việc làm nơi khác.` };
  }

  const wage = JOB_WAGE_BASE[JobKind.SHOP];
  if (p.tien < wage) return { ok: false, msg: `Cần ít nhất ${wage} Quan để trả công tháng đầu.` };

  attachJob(worker, {
    employerId: p.id, kind: JobKind.SHOP, ref: shop.id,
    wagePerMonth: wage, day: totalDaysAbs(state),
  });
  shop.workerIds.push(worker.id);

  logLine(state, `Thuê ${worker.name} vào làm ở ${label} (công ${wage} Quan/tháng).`, true);
  return {
    ok: true,
    feedback: [{ text: `Thuê ${worker.name}`, tone: "good" }, { text: `${wage} Quan/tháng`, tone: "bad" }],
    sfx: "coin",
  };
}

/** T3.3-1 — cho một người làm ở cửa hàng của mình nghỉ việc. */
export function actionSaThai(state, workerId) {
  const shop = playerShop(state);
  if (!shop) return { ok: false, msg: "Ngươi chưa có cơ nghiệp nào." };
  if (!Array.isArray(shop.workerIds) || !shop.workerIds.includes(workerId)) {
    return { ok: false, msg: "Người này không làm cho ngươi." };
  }
  const worker = state.npcById?.[workerId];
  shop.workerIds = shop.workerIds.filter(id => id !== workerId);
  if (worker) detachJob(worker, shop.id);
  const label = SHOP_LABEL[shop.loai] || "cửa hàng";
  logLine(state, `Cho ${worker?.name || "người làm"} nghỉ việc ở ${label}.`, true);
  return { ok: true, feedback: [{ text: `Sa thải ${worker?.name || ""}`.trim(), tone: "bad" }], sfx: "murmur" };
}

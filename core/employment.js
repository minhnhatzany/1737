/**
 * core/employment.js — Làm thuê (T3.3-1).
 *
 * Cơ chế lao động CHUNG: một người (AI, sau này cả người chơi khác) làm công cho
 * một chủ, nhận lương tháng. Ứng dụng đầu tiên: thuê người vào cửa hàng (T3.2).
 * Ứng dụng kế: cày thuê / cấy rẽ cho ruộng (T3.3-2) — dùng lại y nguyên attachJob,
 * chỉ đổi kind="farm".
 *
 * Trên NGƯỜI LÀM:  person._jobs = [ job, ... ]   (lazy, khuôn _voTrainAccum)
 * Trên CHỦ:        shop.workerIds = [ personId, ... ]  (đã seed từ T3.2c-1)
 *
 * job = { employerId, kind, ref, wagePerMonth, startedDay }
 *   ref: shopId (kind="shop") | plotId (kind="farm")
 *
 * Trả lương: engine.processMonthlyWages — chủ −wage, người làm +wage vào .tien.
 * Không đủ tiền trả -> việc chấm dứt (người làm bỏ).
 */

export const JobKind = Object.freeze({
  SHOP: "shop",   // rót rượu / thợ phụ ở cửa hàng
  FARM: "farm",   // cày thuê / cấy rẽ — T3.3-2
});

/** Lương nền / tháng (Quan) theo loại việc. SỐ HẠT GIỐNG — chỉnh 1 dòng nếu chơi thử lệch. */
export const JOB_WAGE_BASE = Object.freeze({
  [JobKind.SHOP]: 5,
  [JobKind.FARM]: 6,
});

/**
 * T3.3-1: mỗi cửa hàng thuê tối đa 1 người. Hiện tô cửa hàng chỉ đọc nhị phân
 * "có >=1 người làm" -> thuê người thứ 2 không thêm lợi ích. Nới khi worker có
 * tác dụng phân tầng (nhiều loại cửa hàng, sản lượng theo số thợ).
 */
export const SHOP_WORKER_CAP = 1;

export function makeJob({ employerId, kind, ref, wagePerMonth, day }) {
  return { employerId, kind, ref, wagePerMonth, startedDay: day };
}

/** Gắn một việc vào person._jobs (tạo mảng nếu chưa có). */
export function attachJob(worker, spec) {
  if (!Array.isArray(worker._jobs)) worker._jobs = [];
  worker._jobs.push(makeJob(spec));
}

/** Gỡ mọi việc của person có job.ref === ref. Trả về true nếu có gỡ. */
export function detachJob(worker, ref) {
  if (!Array.isArray(worker._jobs) || worker._jobs.length === 0) return false;
  const before = worker._jobs.length;
  worker._jobs = worker._jobs.filter(j => j.ref !== ref);
  return worker._jobs.length < before;
}

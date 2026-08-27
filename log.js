/**
 * log.js — Shared logging utility (tách ra để tránh circular import)
 */
export function inferLogCategory(text = "") {
  const t = String(text || "").toLowerCase();
  if (/chiến báo trấn|chiến báo năm|chien bao tran|chien bao nam|🗞️\s*chiến báo/.test(t)) return "chienbao";
  if (/dòng họ|bảo trợ|bảo kê|trả đũa|gầm gè|họ /.test(t)) return "dongho";
  if (/kết hôn|thành thân|sính lễ|sinh con|mai mối|hôn/.test(t)) return "honnhan";
  if (/quan|thóc|thuế|kho|chợ|buôn|thưởng|tham ô|lót tay|mất/.test(t)) return "kinhte";
  return "sukien";
}

/** meta: optional extra fields (e.g. warBriefItems) lưu cùng entry — save/load giữ được. */
export function logLine(state, text, isCritical = false, category = null, meta = null) {
  const lbl = (meta && typeof meta.logLabel === "string") ? meta.logLabel : `Tháng ${state.monthIndex}/${state.ban}`;
  const entry = {
    label: lbl,
    text,
    critical: isCritical,
    category: category || inferLogCategory(text),
  };
  if (meta && typeof meta === "object") {
    for (const [k, v] of Object.entries(meta)) {
      if (k === "logLabel" || v === undefined) continue;
      entry[k] = v;
    }
  }
  state.log.unshift(entry);
  if (state.log.length > 120) state.log.length = 120;
  state.logDirty = true;
  if (isCritical && state.marqueeQueue) {
    const plain = String(text || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    state.marqueeQueue.push(plain || text);
    if (state.marqueeQueue.length > 5) state.marqueeQueue.shift();
  }
}

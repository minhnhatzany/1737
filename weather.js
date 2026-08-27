import { rng, rngInt } from "./core/rng.js";
export const Weather = {
  NANG: "Nắng Hạn",
  MUA:  "Mưa Thuận",
  BAO:  "Bão Tố",
  LU:   "Lũ Lụt",
  HAN:  "Hạn Hán",
};

export function rollWeather(state = null, ) {
  const r = rng(state);
  if (r < 0.40) return Weather.MUA;
  if (r < 0.60) return Weather.NANG;
  if (r < 0.75) return Weather.BAO;
  if (r < 0.87) return Weather.LU;
  return Weather.HAN;
}

export function rollPersonalHarvestThoc(weather) {
  const base = 10 + Math.floor(rng() * 15);
  switch (weather) {
    case Weather.MUA:  return Math.floor(base * 1.3);
    case Weather.NANG: return Math.floor(base * 0.9);
    case Weather.BAO:  return Math.floor(base * 0.5);
    case Weather.LU:   return Math.floor(base * 0.4);
    case Weather.HAN:  return Math.floor(base * 0.2);
    default: return base;
  }
}

export function weatherIcon(weather) {
  switch (weather) {
    case Weather.MUA:  return "🌧️";
    case Weather.NANG: return "☀️";
    case Weather.BAO:  return "🌪️";
    case Weather.LU:   return "🌊";
    case Weather.HAN:  return "🏜️";
    default: return "❓";
  }
}

"use strict";

const AUTH_SESSION_KEY = "four-hunters-authenticated";
const AUTH_SALT = "four-hunters:v1";
const AUTH_DIGEST = "87723c14070be517acc60bc34dc8179216138f994a66511c0825b29282d9d9b0";

const ASSETS = [
  { symbol: "BTCUSDT", code: "BTC", name: "Bitcoin", icon: "₿", color: "#f3ba2f", seed: 64000 },
  { symbol: "ETHUSDT", code: "ETH", name: "Ethereum", icon: "Ξ", color: "#8797f5", seed: 3400 },
  { symbol: "SOLUSDT", code: "SOL", name: "Solana", icon: "S", color: "#8e62ff", seed: 145 },
  { symbol: "XRPUSDT", code: "XRP", name: "XRP", icon: "X", color: "#67d8d2", seed: 0.55 },
  { symbol: "BNBUSDT", code: "BNB", name: "BNB", icon: "B", color: "#f3ba2f", seed: 610 },
  { symbol: "ADAUSDT", code: "ADA", name: "Cardano", icon: "A", color: "#4ca9eb", seed: 0.42 },
  { symbol: "DOGEUSDT", code: "DOGE", name: "Dogecoin", icon: "D", color: "#d9bd55", seed: 0.14 },
  { symbol: "AVAXUSDT", code: "AVAX", name: "Avalanche", icon: "V", color: "#e84142", seed: 36 },
  { symbol: "LINKUSDT", code: "LINK", name: "Chainlink", icon: "L", color: "#4f72e6", seed: 15.5 },
  { symbol: "DOTUSDT", code: "DOT", name: "Polkadot", icon: "P", color: "#e6007a", seed: 6.2 },
  { symbol: "LTCUSDT", code: "LTC", name: "Litecoin", icon: "Ł", color: "#b8b8b8", seed: 82 },
  { symbol: "TRXUSDT", code: "TRX", name: "TRON", icon: "T", color: "#ef3340", seed: 0.12 },
  { symbol: "TONUSDT", code: "TON", name: "Toncoin", icon: "T", color: "#37aee2", seed: 5.4 },
  { symbol: "SUIUSDT", code: "SUI", name: "Sui", icon: "S", color: "#6fbcf0", seed: 1.1 },
  { symbol: "NEARUSDT", code: "NEAR", name: "NEAR", icon: "N", color: "#79dec8", seed: 4.8 },
  { symbol: "APTUSDT", code: "APT", name: "Aptos", icon: "A", color: "#86e2d5", seed: 7.2 },
  { symbol: "ARBUSDT", code: "ARB", name: "Arbitrum", icon: "R", color: "#28a0f0", seed: 0.75 },
  { symbol: "OPUSDT", code: "OP", name: "Optimism", icon: "O", color: "#ff0420", seed: 1.8 },
  { symbol: "PEPEUSDT", code: "PEPE", name: "Pepe", icon: "P", color: "#68a84f", seed: 0.000012 },
  { symbol: "SHIBUSDT", code: "SHIB", name: "Shiba Inu", icon: "S", color: "#f09438", seed: 0.000018 },
  { symbol: "BCHUSDT", code: "BCH", name: "Bitcoin Cash", icon: "B", color: "#8dc351", seed: 430 },
  { symbol: "UNIUSDT", code: "UNI", name: "Uniswap", icon: "U", color: "#ff4f9a", seed: 9.5 },
  { symbol: "ATOMUSDT", code: "ATOM", name: "Cosmos", icon: "C", color: "#7b7be8", seed: 7.5 },
  { symbol: "FILUSDT", code: "FIL", name: "Filecoin", icon: "F", color: "#0090ff", seed: 4.5 },
  { symbol: "ICPUSDT", code: "ICP", name: "Internet Computer", icon: "I", color: "#ef7b5b", seed: 9.2 },
  { symbol: "HBARUSDT", code: "HBAR", name: "Hedera", icon: "H", color: "#c9d1d0", seed: 0.09 },
  { symbol: "AAVEUSDT", code: "AAVE", name: "Aave", icon: "A", color: "#8f67e8", seed: 105 },
  { symbol: "PAXGUSDT", code: "PAXG", name: "PAX Gold", icon: "Au", color: "#e6bd56", seed: 4200, isGold: true }
];

const state = {
  asset: ASSETS[0],
  interval: "4h",
  candles: [],
  analysis: null,
  timeframeAnalyses: {},
  futureOutlooks: [],
  tickers: {},
  layers: { fib: true, ob: true, fvg: true, ema: true },
  source: "live",
  hoverIndex: null
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const refs = {
  loginGate: $("#loginGate"),
  loginForm: $("#loginForm"),
  loginUsername: $("#loginUsername"),
  loginPassword: $("#loginPassword"),
  loginError: $("#loginError"),
  togglePassword: $("#togglePassword"),
  logoutButton: $("#logoutButton"),
  appShell: $("#appShell"),
  exportAnalysis: $("#exportAnalysis"),
  exportDialog: $("#exportDialog"),
  exportPreview: $("#exportPreview"),
  downloadExport: $("#downloadExport"),
  assetList: $("#assetList"),
  assetSearch: $("#assetSearch"),
  selectedIcon: $("#selectedIcon"),
  selectedName: $("#selectedName"),
  selectedPair: $("#selectedPair"),
  selectedPrice: $("#selectedPrice"),
  selectedChange: $("#selectedChange"),
  chart: $("#marketChart"),
  chartWrap: $(".chart-wrap"),
  chartLoader: $("#chartLoader"),
  tooltip: $("#chartTooltip"),
  launch: $("#launchAnalysis"),
  marketStatus: $("#marketStatus"),
  lastUpdate: $("#lastUpdate"),
  assetCount: $("#assetCount"),
  dialog: $("#infoDialog")
};

let appInitialized = false;
let exportObjectUrl = null;

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hasActiveSession() {
  try {
    return sessionStorage.getItem(AUTH_SESSION_KEY) === "true";
  } catch (error) {
    return false;
  }
}

function setActiveSession(active) {
  try {
    if (active) sessionStorage.setItem(AUTH_SESSION_KEY, "true");
    else sessionStorage.removeItem(AUTH_SESSION_KEY);
  } catch (error) {
    // The login still works for the current page when storage is unavailable.
  }
}

async function unlockApplication() {
  document.body.classList.remove("auth-locked");
  refs.loginGate.classList.add("hidden");
  refs.loginGate.setAttribute("aria-hidden", "true");
  refs.appShell.setAttribute("aria-hidden", "false");
  if (!appInitialized) {
    appInitialized = true;
    await init();
  }
}

function lockApplication() {
  setActiveSession(false);
  window.location.reload();
}

function bindAuthentication() {
  refs.togglePassword.addEventListener("click", () => {
    const revealing = refs.loginPassword.type === "password";
    refs.loginPassword.type = revealing ? "text" : "password";
    refs.togglePassword.textContent = revealing ? "הסתר" : "הצג";
    refs.togglePassword.setAttribute("aria-label", revealing ? "הסתרת סיסמה" : "הצגת סיסמה");
  });

  refs.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    refs.loginError.textContent = "";
    const username = refs.loginUsername.value.trim().toLowerCase();
    const password = refs.loginPassword.value;

    if (!username || !password) {
      refs.loginError.textContent = "יש להזין שם משתמש וסיסמה.";
      return;
    }

    const digest = await sha256(`${AUTH_SALT}:${username}:${password}`);
    if (digest !== AUTH_DIGEST) {
      refs.loginError.textContent = "שם המשתמש או הסיסמה אינם נכונים.";
      refs.loginPassword.value = "";
      refs.loginPassword.focus();
      return;
    }

    setActiveSession(true);
    await unlockApplication();
  });

  refs.logoutButton.addEventListener("click", lockApplication);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function formatPrice(value) {
  if (!Number.isFinite(value)) return "--";
  const digits = value < 0.0001 ? 8 : value < 0.01 ? 6 : value < 1 ? 4 : value < 1000 ? 2 : 0;
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

function formatCompact(value) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatTime(time) {
  const date = new Date(time);
  return state.interval === "1d"
    ? date.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" })
    : date.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

function seededRandom(seed) {
  let value = seed % 2147483647;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function intervalMs(interval) {
  return { "15m": 900000, "1h": 3600000, "4h": 14400000, "1d": 86400000 }[interval];
}

function generateFallbackCandles(asset, interval, count = 300) {
  const random = seededRandom([...asset.symbol].reduce((sum, char) => sum + char.charCodeAt(0), 0) + intervalMs(interval));
  const step = intervalMs(interval);
  let price = asset.seed;
  const now = Date.now();
  const candles = [];
  const volatility = asset.isGold ? 0.004 : asset.code === "BTC" || asset.code === "ETH" ? 0.014 : 0.021;

  for (let i = count; i > 0; i -= 1) {
    const cycle = Math.sin((count - i) / 22) * volatility * 0.35;
    const drift = Math.sin((count - i) / 75) * volatility * 0.12 + 0.00025;
    const move = (random() - 0.485) * volatility + cycle * 0.18 + drift;
    const open = price;
    const close = Math.max(0.0001, open * (1 + move));
    const wick = open * volatility * (0.15 + random() * 0.48);
    const high = Math.max(open, close) + wick * random();
    const low = Math.max(0.0001, Math.min(open, close) - wick * random());
    const volume = (700 + random() * 1800) * (1 + Math.abs(move) / volatility * 1.5);
    candles.push({ time: now - i * step, open, high, low, close, volume });
    price = close;
  }
  return candles;
}

async function fetchCandles(interval = state.interval, isPrimary = false) {
  const endpoint = `https://api.binance.com/api/v3/klines?symbol=${state.asset.symbol}&interval=${interval}&limit=300`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(endpoint, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length < 80) throw new Error("Insufficient data");
    if (isPrimary) state.source = "live";
    return rows.map((row) => ({
      time: Number(row[0]),
      open: Number(row[1]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
      volume: Number(row[5])
    }));
  } catch (error) {
    if (isPrimary) state.source = "simulation";
    return generateFallbackCandles(state.asset, interval);
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchAssetTickers() {
  try {
    const response = await fetch("https://api.binance.com/api/v3/ticker/24hr");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const rows = await response.json();
    const allowed = new Set(ASSETS.map((asset) => asset.symbol));
    state.tickers = Object.fromEntries(rows
      .filter((row) => allowed.has(row.symbol))
      .map((row) => [row.symbol, {
        price: Number(row.lastPrice),
        change: Number(row.priceChangePercent)
      }]));
    renderAssetList(refs.assetSearch.value);
  } catch (error) {
    state.tickers = {};
  }
}

function ema(values, period) {
  const result = [];
  const multiplier = 2 / (period + 1);
  let previous = values[0] || 0;
  values.forEach((value, index) => {
    previous = index === 0 ? value : value * multiplier + previous * (1 - multiplier);
    result.push(previous);
  });
  return result;
}

function rsi(values, period = 14) {
  if (values.length <= period) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = values.length - period; i < values.length; i += 1) {
    const delta = values[i] - values[i - 1];
    if (delta >= 0) gains += delta;
    else losses -= delta;
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

function atr(candles, period = 14) {
  const ranges = [];
  for (let i = Math.max(1, candles.length - period); i < candles.length; i += 1) {
    const candle = candles[i];
    const previousClose = candles[i - 1].close;
    ranges.push(Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose)
    ));
  }
  return average(ranges);
}

function calculateVWAP(candles) {
  let cumulativePriceVolume = 0;
  let cumulativeVolume = 0;
  return candles.map((candle) => {
    const typical = (candle.high + candle.low + candle.close) / 3;
    cumulativePriceVolume += typical * candle.volume;
    cumulativeVolume += candle.volume;
    return cumulativePriceVolume / cumulativeVolume;
  });
}

function standardDeviation(values) {
  const mean = average(values);
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2)));
}

function calculateBollinger(values, period = 20, multiplier = 2) {
  const sample = values.slice(-period);
  const middle = average(sample);
  const deviation = standardDeviation(sample);
  const upper = middle + deviation * multiplier;
  const lower = middle - deviation * multiplier;
  const position = (values.at(-1) - lower) / Math.max(upper - lower, 0.000001);
  const width = (upper - lower) / Math.max(middle, 0.000001) * 100;
  return { upper, middle, lower, position, width };
}

function calculateStochastic(candles, period = 14) {
  const sample = candles.slice(-period);
  const highest = Math.max(...sample.map((candle) => candle.high));
  const lowest = Math.min(...sample.map((candle) => candle.low));
  return (candles.at(-1).close - lowest) / Math.max(highest - lowest, 0.000001) * 100;
}

function calculateADX(candles, period = 14) {
  const trueRanges = [];
  const plusDM = [];
  const minusDM = [];
  for (let i = 1; i < candles.length; i += 1) {
    const current = candles[i];
    const previous = candles[i - 1];
    const upMove = current.high - previous.high;
    const downMove = previous.low - current.low;
    trueRanges.push(Math.max(
      current.high - current.low,
      Math.abs(current.high - previous.close),
      Math.abs(current.low - previous.close)
    ));
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  if (trueRanges.length < period * 2) return { value: 0, plusDI: 0, minusDI: 0 };
  let smoothedTR = trueRanges.slice(0, period).reduce((sum, value) => sum + value, 0);
  let smoothedPlus = plusDM.slice(0, period).reduce((sum, value) => sum + value, 0);
  let smoothedMinus = minusDM.slice(0, period).reduce((sum, value) => sum + value, 0);
  const dxValues = [];
  let plusDI = 0;
  let minusDI = 0;

  for (let i = period; i < trueRanges.length; i += 1) {
    smoothedTR = smoothedTR - smoothedTR / period + trueRanges[i];
    smoothedPlus = smoothedPlus - smoothedPlus / period + plusDM[i];
    smoothedMinus = smoothedMinus - smoothedMinus / period + minusDM[i];
    plusDI = 100 * smoothedPlus / Math.max(smoothedTR, 0.000001);
    minusDI = 100 * smoothedMinus / Math.max(smoothedTR, 0.000001);
    dxValues.push(100 * Math.abs(plusDI - minusDI) / Math.max(plusDI + minusDI, 0.000001));
  }

  return { value: average(dxValues.slice(-period)), plusDI, minusDI };
}

function findSwings(candles, window = 3) {
  const highs = [];
  const lows = [];
  for (let i = window; i < candles.length - window; i += 1) {
    const around = candles.slice(i - window, i + window + 1);
    if (candles[i].high === Math.max(...around.map((c) => c.high))) highs.push({ index: i, price: candles[i].high });
    if (candles[i].low === Math.min(...around.map((c) => c.low))) lows.push({ index: i, price: candles[i].low });
  }
  return { highs, lows };
}

function detectOrderBlocks(candles, atrValue) {
  const blocks = [];
  for (let i = 5; i < candles.length - 4; i += 1) {
    const candle = candles[i];
    const nextThree = candles.slice(i + 1, i + 4);
    const bullishDisplacement = nextThree[nextThree.length - 1].close - candle.close > atrValue * 1.25;
    const bearishDisplacement = candle.close - nextThree[nextThree.length - 1].close > atrValue * 1.25;
    const volumeBase = average(candles.slice(Math.max(0, i - 20), i).map((c) => c.volume));

    if (candle.close < candle.open && bullishDisplacement) {
      blocks.push({
        type: "bull",
        index: i,
        low: candle.low,
        high: candle.open,
        strength: clamp(55 + (candle.volume / Math.max(volumeBase, 1) - 1) * 20, 45, 94)
      });
    }
    if (candle.close > candle.open && bearishDisplacement) {
      blocks.push({
        type: "bear",
        index: i,
        low: candle.open,
        high: candle.high,
        strength: clamp(55 + (candle.volume / Math.max(volumeBase, 1) - 1) * 20, 45, 94)
      });
    }
  }

  const current = candles.at(-1).close;
  return blocks
    .filter((block) => block.index > candles.length - 130)
    .map((block) => {
      const after = candles.slice(block.index + 1);
      const invalidated = block.type === "bull"
        ? after.some((c) => c.close < block.low)
        : after.some((c) => c.close > block.high);
      const distance = Math.abs((block.low + block.high) / 2 - current) / current;
      return { ...block, invalidated, distance };
    })
    .filter((block) => !block.invalidated)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 4);
}

function detectFVG(candles) {
  const gaps = [];
  for (let i = 2; i < candles.length; i += 1) {
    const first = candles[i - 2];
    const third = candles[i];
    if (third.low > first.high) gaps.push({ type: "bull", index: i, low: first.high, high: third.low });
    if (third.high < first.low) gaps.push({ type: "bear", index: i, low: third.high, high: first.low });
  }
  const current = candles.at(-1).close;
  return gaps
    .filter((gap) => gap.index > candles.length - 100)
    .filter((gap) => gap.type === "bull"
      ? !candles.slice(gap.index + 1).some((c) => c.low <= gap.low)
      : !candles.slice(gap.index + 1).some((c) => c.high >= gap.high))
    .map((gap) => ({ ...gap, distance: Math.abs((gap.high + gap.low) / 2 - current) / current }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3);
}

function detectLiquiditySweep(candles) {
  const last = candles.at(-1);
  const prior = candles.slice(-22, -1);
  const priorHigh = Math.max(...prior.map((c) => c.high));
  const priorLow = Math.min(...prior.map((c) => c.low));
  if (last.high > priorHigh && last.close < priorHigh) return { type: "bear", label: "סריקת Buy-side", level: priorHigh };
  if (last.low < priorLow && last.close > priorLow) return { type: "bull", label: "סריקת Sell-side", level: priorLow };
  return { type: "none", label: "לא זוהתה סריקה", level: null };
}

function inferWyckoff(candles, rangeLow, rangeHigh, ema20, ema50, volumeRatio) {
  const price = candles.at(-1).close;
  const position = (price - rangeLow) / Math.max(rangeHigh - rangeLow, 0.000001);
  const slope = (ema20.at(-1) - ema20.at(-12)) / price;

  if (position < 0.38 && Math.abs(slope) < 0.025) {
    return { phase: "צבירה", marker: 8, score: 0.35, text: "המחיר נמצא בחלק התחתון של הטווח עם התכנסות יחסית. חפש Spring, שינוי אופי ועלייה בנפח לפני אישור." };
  }
  if (ema20.at(-1) > ema50.at(-1) && slope > 0.004) {
    return { phase: "Markup", marker: 34, score: 0.75, text: `ממוצעים עולים ומבנה התקדמות חיובי${volumeRatio > 1.1 ? " עם תמיכת נפח" : ""}. תיקונים רדודים עשויים להציע המשכיות.` };
  }
  if (position > 0.68 && Math.abs(slope) < 0.025) {
    return { phase: "פיזור", marker: 62, score: -0.35, text: "המחיר בחלק העליון של הטווח ללא התקדמות נקייה. חפש Upthrust, כשלי פריצה וחולשה בנפח." };
  }
  if (ema20.at(-1) < ema50.at(-1) && slope < -0.004) {
    return { phase: "Markdown", marker: 87, score: -0.75, text: `מבנה ירידה וממוצעים שליליים${volumeRatio > 1.1 ? " עם התרחבות נפח" : ""}. עליות עשויות לשמש תיקון עד שינוי מבני.` };
  }
  return { phase: "מעבר", marker: 49, score: 0, text: "אין שלב Wyckoff חד־משמעי. השוק מציג מעבר בין איזון להתרחבות; נדרש אישור מבני נוסף." };
}

function calculateScenarioProbabilities(combined, trendScore, alignment, atrPercent) {
  const confidence = clamp(Math.round(48 + alignment * 35 - (atrPercent > 5 ? 8 : 0)), 42, 88);
  let bullish = 33 + combined * 35 + Math.max(0, trendScore) * 7;
  let bearish = 33 - combined * 35 + Math.max(0, -trendScore) * 7;
  let neutral = 34 + (1 - Math.abs(combined)) * 14 - alignment * 8;
  bullish = Math.max(8, bullish);
  bearish = Math.max(8, bearish);
  neutral = Math.max(10, neutral);
  const total = bullish + bearish + neutral;
  bullish = Math.round(bullish / total * 100);
  bearish = Math.round(bearish / total * 100);
  neutral = 100 - bullish - bearish;
  return { bullish, bearish, neutral, confidence };
}

function buildFutureOutlooks() {
  const a = state.analysis;
  const price = state.candles.at(-1).close;
  const configs = [
    {
      id: "24h",
      label: "24 שעות",
      weights: { "15m": 0.25, "1h": 0.4, "4h": 0.25, "1d": 0.1 },
      volatilityFactor: 1.35,
      description: "תגובה קצרה לנזילות ולמומנטום התוך־יומי."
    },
    {
      id: "7d",
      label: "7 ימים",
      weights: { "15m": 0.05, "1h": 0.2, "4h": 0.4, "1d": 0.35 },
      volatilityFactor: 3.1,
      description: "תרחיש סווינג שמשלב מבנה, Wyckoff ואזורי עניין."
    },
    {
      id: "30d",
      label: "30 ימים",
      weights: { "15m": 0, "1h": 0.1, "4h": 0.3, "1d": 0.6 },
      volatilityFactor: 6.2,
      description: "כיוון מאקרו יחסי; אי־הוודאות גבוהה יותר באופק זה."
    }
  ];

  return configs.map((config) => {
    const score = Object.entries(config.weights).reduce(
      (sum, [interval, weight]) => sum + state.timeframeAnalyses[interval].combined * weight,
      0
    );
    const trendScore = Object.entries(config.weights).reduce(
      (sum, [interval, weight]) => sum + state.timeframeAnalyses[interval].trendScore * weight,
      0
    );
    const alignment = Object.entries(config.weights).reduce(
      (sum, [interval, weight]) => sum + Math.abs(state.timeframeAnalyses[interval].combined) * weight,
      0
    );
    const probabilities = calculateScenarioProbabilities(score, trendScore, alignment, a.atrPercent);
    const movePercent = clamp(a.atrPercent * config.volatilityFactor, a.atrPercent * 0.8, 28);
    const dominant = [
      { key: "bull", label: "עולה", value: probabilities.bullish, color: "#5ee0a0" },
      { key: "flat", label: "דשדוש", value: probabilities.neutral, color: "#f4c66b" },
      { key: "bear", label: "יורד", value: probabilities.bearish, color: "#ff6b78" }
    ].sort((x, y) => y.value - x.value)[0];
    const bullishTarget = price * (1 + movePercent / 100);
    const bearishTarget = price * (1 - movePercent / 100);
    const flatBand = price * Math.max(a.atrPercent * config.volatilityFactor * 0.3, 0.4) / 100;

    return {
      ...config,
      score,
      trendScore,
      alignment,
      ...probabilities,
      dominant,
      movePercent,
      currentPrice: price,
      bullishTarget,
      bearishTarget,
      flatLow: price - flatBand,
      flatHigh: price + flatBand
    };
  });
}

function analyzeMarket(candles) {
  const closes = candles.map((c) => c.close);
  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);
  const ema200 = ema(closes, 200);
  const fast = ema(closes, 12);
  const slow = ema(closes, 26);
  const macdLine = fast.map((value, index) => value - slow[index]);
  const signalLine = ema(macdLine, 9);
  const macdHistogram = macdLine.at(-1) - signalLine.at(-1);
  const rsiValue = rsi(closes);
  const atrValue = atr(candles);
  const atrPercent = atrValue / closes.at(-1) * 100;
  const vwap = calculateVWAP(candles);
  const recent = candles.slice(-120);
  const rangeHigh = Math.max(...recent.map((c) => c.high));
  const rangeLow = Math.min(...recent.map((c) => c.low));
  const rangePosition = (closes.at(-1) - rangeLow) / (rangeHigh - rangeLow);
  const volumes = candles.slice(-21).map((c) => c.volume);
  const volumeRatio = volumes.at(-1) / Math.max(average(volumes.slice(0, -1)), 1);
  const bollinger = calculateBollinger(closes);
  const stochastic = calculateStochastic(candles);
  const adx = calculateADX(candles);
  const swings = findSwings(candles);
  const recentHighs = swings.highs.slice(-2);
  const recentLows = swings.lows.slice(-2);
  const orderBlocks = detectOrderBlocks(candles, atrValue);
  const fvgs = detectFVG(candles);
  const sweep = detectLiquiditySweep(candles);
  const wyckoff = inferWyckoff(candles, rangeLow, rangeHigh, ema20, ema50, volumeRatio);

  let structure = "טווח";
  let structureScore = 0;
  if (recentHighs.length === 2 && recentLows.length === 2) {
    const higherHigh = recentHighs[1].price > recentHighs[0].price;
    const higherLow = recentLows[1].price > recentLows[0].price;
    if (higherHigh && higherLow) { structure = "עולה"; structureScore = 0.9; }
    else if (!higherHigh && !higherLow) { structure = "יורד"; structureScore = -0.9; }
    else { structure = "מעורב"; structureScore = 0; }
  }

  const trendScore = clamp(
    (ema20.at(-1) > ema50.at(-1) ? 0.45 : -0.45) +
    (ema50.at(-1) > ema200.at(-1) ? 0.35 : -0.35) +
    structureScore * 0.4,
    -1,
    1
  );
  const momentumScore = clamp(
    (rsiValue > 55 ? 0.35 : rsiValue < 45 ? -0.35 : 0) +
    (macdHistogram > 0 ? 0.35 : -0.35) +
    (closes.at(-1) > vwap.at(-1) ? 0.25 : -0.25),
    -1,
    1
  );
  const nearbyBullOB = orderBlocks.find((block) => block.type === "bull");
  const nearbyBearOB = orderBlocks.find((block) => block.type === "bear");
  const ictScore = clamp(
    (nearbyBullOB && nearbyBullOB.distance < 0.04 ? 0.35 : 0) +
    (nearbyBearOB && nearbyBearOB.distance < 0.04 ? -0.35 : 0) +
    (sweep.type === "bull" ? 0.45 : sweep.type === "bear" ? -0.45 : 0) +
    (fvgs[0]?.type === "bull" ? 0.18 : fvgs[0]?.type === "bear" ? -0.18 : 0),
    -1,
    1
  );
  const locationScore = clamp(
    rangePosition < 0.35 ? 0.5 : rangePosition > 0.7 ? -0.5 : 0,
    -1,
    1
  );
  const combined = trendScore * 0.35 + ictScore * 0.25 + momentumScore * 0.2 + (locationScore + wyckoff.score * 0.45) * 0.2;
  const alignment = average([trendScore, momentumScore, ictScore, locationScore + wyckoff.score * 0.45].map(Math.abs));
  const probabilities = calculateScenarioProbabilities(combined, trendScore, alignment, atrPercent);
  const regime = adx.value >= 25
    ? (trendScore >= 0 ? "מגמה עולה" : "מגמה יורדת")
    : bollinger.width < 4 ? "כיווץ" : "טווח";

  const fibRatios = [0, 0.236, 0.382, 0.5, 0.618, 0.705, 0.786, 1];
  const fibLevels = fibRatios.map((ratio) => ({
    ratio,
    price: rangeHigh - (rangeHigh - rangeLow) * ratio,
    distance: Math.abs(rangeHigh - (rangeHigh - rangeLow) * ratio - closes.at(-1)) / closes.at(-1)
  }));
  const nearestFib = [...fibLevels].sort((a, b) => a.distance - b.distance)[0];

  return {
    ema20, ema50, ema200, vwap, rsiValue, atrValue, atrPercent, volumeRatio,
    rangeHigh, rangeLow, rangePosition, structure, structureScore,
    trendScore, momentumScore, ictScore, locationScore, combined, alignment,
    ...probabilities, orderBlocks, fvgs, sweep, wyckoff, fibLevels, nearestFib,
    macdHistogram, bollinger, stochastic, adx, regime
  };
}

function renderAssetList(filter = "") {
  const query = filter.trim().toLowerCase();
  const filteredAssets = ASSETS.filter((asset) => `${asset.name} ${asset.code}`.toLowerCase().includes(query));
  refs.assetList.innerHTML = "";
  refs.assetCount.textContent = `${ASSETS.length} נכסים`;
  filteredAssets.forEach((asset) => {
    const ticker = state.tickers[asset.symbol];
    const price = ticker ? formatPrice(ticker.price) : "--";
    const changeClass = ticker?.change > 0 ? "up" : ticker?.change < 0 ? "down" : "";
    const changeText = ticker ? `${ticker.change >= 0 ? "+" : ""}${ticker.change.toFixed(2)}%` : "לחץ לניתוח";
    const button = document.createElement("button");
    button.className = `asset-item ${asset.symbol === state.asset.symbol ? "active" : ""}`;
    button.style.setProperty("--asset-color", asset.color);
    button.innerHTML = `
      <span class="asset-logo">${asset.icon}</span>
      <span class="asset-name"><strong>${asset.name}</strong><span>${asset.code} / USDT</span></span>
      <span class="asset-price"><strong data-price="${asset.symbol}">${price}</strong><small class="${changeClass}">${changeText}</small></span>
    `;
    button.addEventListener("click", () => selectAsset(asset));
    refs.assetList.appendChild(button);
  });
}

function updateSelectedAsset() {
  refs.selectedIcon.textContent = state.asset.icon;
  refs.selectedIcon.style.setProperty("--asset-color", state.asset.color);
  refs.selectedName.textContent = state.asset.name;
  refs.selectedPair.textContent = `${state.asset.code} / USDT`;
}

async function selectAsset(asset) {
  if (asset.symbol === state.asset.symbol) return;
  state.asset = asset;
  updateSelectedAsset();
  renderAssetList(refs.assetSearch.value);
  await runAnalysis();
}

function setLoading(isLoading) {
  refs.chartLoader.classList.toggle("hidden", !isLoading);
  refs.launch.classList.toggle("loading", isLoading);
  refs.launch.disabled = isLoading;
}

async function runAnalysis() {
  setLoading(true);
  const intervals = ["15m", "1h", "4h", "1d"];
  const candleSets = await Promise.all(intervals.map((interval) => fetchCandles(interval, interval === state.interval)));
  state.timeframeAnalyses = Object.fromEntries(intervals.map((interval, index) => [
    interval,
    analyzeMarket(candleSets[index])
  ]));
  state.candles = candleSets[intervals.indexOf(state.interval)];
  state.analysis = state.timeframeAnalyses[state.interval];

  const weights = { "15m": 0.15, "1h": 0.25, "4h": 0.3, "1d": 0.3 };
  const mtfScore = intervals.reduce((sum, interval) => sum + state.timeframeAnalyses[interval].combined * weights[interval], 0);
  const blendedScore = state.analysis.combined * 0.7 + mtfScore * 0.3;
  const mtfAlignment = average(intervals.map((interval) => Math.abs(state.timeframeAnalyses[interval].combined)));
  Object.assign(
    state.analysis,
    calculateScenarioProbabilities(
      blendedScore,
      state.analysis.trendScore,
      (state.analysis.alignment + mtfAlignment) / 2,
      state.analysis.atrPercent
    ),
    { mtfScore, blendedScore }
  );
  state.futureOutlooks = buildFutureOutlooks();
  updateDashboard();
  setLoading(false);
}

function updateDashboard() {
  const candles = state.candles;
  const analysis = state.analysis;
  const last = candles.at(-1);
  const first = candles[0];
  const change = (last.close / first.close - 1) * 100;

  refs.selectedPrice.textContent = formatPrice(last.close);
  refs.selectedChange.textContent = `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`;
  refs.selectedChange.className = `change ${change > 0 ? "up" : change < 0 ? "down" : "neutral"}`;
  refs.marketStatus.textContent = state.source === "live" ? "נתוני Binance חיים" : "מצב הדמיה מקומי";
  refs.lastUpdate.textContent = new Date().toLocaleTimeString("he-IL");

  const listPrice = document.querySelector(`[data-price="${state.asset.symbol}"]`);
  if (listPrice) listPrice.textContent = formatPrice(last.close);

  $("#rangeValue").textContent = `${formatPrice(analysis.rangeLow)} – ${formatPrice(analysis.rangeHigh)}`;
  $("#atrValue").textContent = `${formatPrice(analysis.atrValue)} (${analysis.atrPercent.toFixed(2)}%)`;
  $("#rsiValue").textContent = analysis.rsiValue.toFixed(1);
  $("#volumeValue").textContent = `${analysis.volumeRatio.toFixed(2)}x`;

  updateProbability();
  updateMetrics();
  updateOrderBlocks();
  updateFibonacci();
  updateWyckoff();
  updateOutlookPanel();
  updateDecisionCenter();
  drawChart();
}

function updateProbability() {
  const a = state.analysis;
  const scenarios = [
    { key: "bullish", label: "עולה", value: a.bullish, color: "var(--green)" },
    { key: "neutral", label: "דשדוש", value: a.neutral, color: "var(--amber)" },
    { key: "bearish", label: "יורד", value: a.bearish, color: "var(--red)" }
  ];
  const leading = [...scenarios].sort((x, y) => y.value - x.value)[0];

  $("#probabilityGauge").style.setProperty("--bull", a.bullish);
  $("#probabilityGauge").style.setProperty("--neutral", a.neutral);
  $("#leadingProbability").textContent = `${leading.value}%`;
  $("#leadingScenario").textContent = leading.label;
  $("#leadingScenario").style.color = leading.color;
  $("#bullishValue").textContent = `${a.bullish}%`;
  $("#neutralValue").textContent = `${a.neutral}%`;
  $("#bearishValue").textContent = `${a.bearish}%`;
  $("#bullishBar").style.width = `${a.bullish}%`;
  $("#neutralBar").style.width = `${a.neutral}%`;
  $("#bearishBar").style.width = `${a.bearish}%`;
  $("#confidenceBadge").textContent = `ביטחון ${a.confidence}%`;

  const trend = a.trendScore > 0.2 ? "המגמה תומכת בעלייה" : a.trendScore < -0.2 ? "המגמה תומכת בירידה" : "המגמה אינה חד־משמעית";
  const location = a.rangePosition < 0.35 ? "והמחיר באזור Discount" : a.rangePosition > 0.7 ? "אך המחיר באזור Premium" : "והמחיר במרכז טווח המסחר";
  $("#scenarioCallout").innerHTML = `<span>תזה מרכזית</span><p>${trend} ${location}. משטר שוק: ${a.regime}, ADX ${a.adx.value.toFixed(1)}. רמת Fibonacci הקרובה: ${(a.nearestFib.ratio * 100).toFixed(1)}%.</p>`;
}

function updateMetrics() {
  const a = state.analysis;
  $("#structureMetric").textContent = a.structure;
  $("#structureDetail").textContent = a.structure === "עולה" ? "HH / HL" : a.structure === "יורד" ? "LH / LL" : "Mixed structure";
  $("#liquidityMetric").textContent = a.sweep.type === "none" ? "ניטרלי" : a.sweep.type === "bull" ? "שורי" : "דובי";
  $("#liquidityDetail").textContent = a.sweep.label;
  $("#momentumMetric").textContent = a.momentumScore > 0.2 ? "חיובי" : a.momentumScore < -0.2 ? "שלילי" : "מאוזן";
  $("#momentumDetail").textContent = `RSI ${a.rsiValue.toFixed(1)} · MACD ${a.macdHistogram >= 0 ? "+" : "−"}`;
  $("#volatilityMetric").textContent = a.atrPercent > 4 ? "גבוהה" : a.atrPercent > 1.7 ? "בינונית" : "נמוכה";
  $("#volatilityDetail").textContent = `ATR ${a.atrPercent.toFixed(2)}%`;
}

function updateOrderBlocks() {
  const a = state.analysis;
  const rows = [
    ...a.orderBlocks.slice(0, 3).map((block) => ({
      type: block.type,
      title: block.type === "bull" ? "Bullish Order Block" : "Bearish Order Block",
      subtitle: `איכות ${Math.round(block.strength)}% · מרחק ${(block.distance * 100).toFixed(1)}%`,
      price: `${formatPrice(block.low)} – ${formatPrice(block.high)}`
    })),
    ...a.fvgs.slice(0, Math.max(0, 3 - a.orderBlocks.length)).map((gap) => ({
      type: "fvg",
      title: gap.type === "bull" ? "Bullish FVG" : "Bearish FVG",
      subtitle: "פער פתוח · מגנט מחיר אפשרי",
      price: `${formatPrice(gap.low)} – ${formatPrice(gap.high)}`
    }))
  ];

  if (!rows.length) {
    rows.push({ type: "fvg", title: "אין אזור נקי קרוב", subtitle: "המתן ל־displacement ואישור מבני", price: "—" });
  }
  $("#orderBlockList").innerHTML = rows.map((row) => `
    <div class="level-row">
      <i class="level-color ${row.type}"></i>
      <div><strong>${row.title}</strong><span>${row.subtitle}</span></div>
      <b class="level-price">${row.price}</b>
    </div>
  `).join("");
  $("#obStatus").textContent = a.orderBlocks.length ? `${a.orderBlocks.length} פעילים` : "אין אזור נקי";
}

function updateFibonacci() {
  const a = state.analysis;
  const colors = ["#a7b7b0", "#6fcfa0", "#5edfa0", "#f4c66b", "#f2a65a", "#ff8c72", "#ff6b78", "#b692ff"];
  $("#fibVisual").innerHTML = a.fibLevels.map((level, index) => {
    const active = level === a.nearestFib ? "active" : "";
    return `
      <div class="fib-row ${active}">
        <span>${level.ratio.toFixed(3)}</span>
        <div class="fib-line" style="--fill:${(1 - level.ratio) * 100}%;--level-color:${colors[index]}"><i></i></div>
        <b>${formatPrice(level.price)}</b>
      </div>
    `;
  }).join("");
  $("#fibBias").textContent = a.rangePosition < 0.5 ? "Discount" : "Premium";
}

function updateWyckoff() {
  const a = state.analysis;
  $("#wyckoffPhase").textContent = a.wyckoff.phase;
  $("#wyckoffMarker").style.left = `${a.wyckoff.marker}%`;
  $("#wyckoffText").textContent = a.wyckoff.text;

  const signals = [
    { label: "מגמה ומבנה", score: a.trendScore },
    { label: "ICT / נזילות", score: a.ictScore },
    { label: "מומנטום", score: a.momentumScore },
    { label: "מיקום בטווח", score: a.locationScore }
  ];
  $("#signalStack").innerHTML = signals.map((signal) => {
    const positive = signal.score >= 0;
    const width = Math.max(5, Math.abs(signal.score) * 100);
    const color = positive ? "var(--green)" : "var(--red)";
    return `
      <div class="signal-row">
        <span>${signal.label}</span>
        <div class="signal-meter"><i style="width:${width}%;background:${color}"></i></div>
        <b style="color:${color}">${positive ? "+" : ""}${Math.round(signal.score * 100)}</b>
      </div>
    `;
  }).join("");
}

function updateOutlookPanel() {
  const strongest = [...state.futureOutlooks].sort((a, b) => b.dominant.value - a.dominant.value)[0];
  $("#outlookBias").textContent = strongest
    ? `${strongest.dominant.label} ${strongest.dominant.value}% · ${strongest.label}`
    : "--";
  $("#outlookGrid").innerHTML = state.futureOutlooks.map((outlook) => `
    <article class="outlook-card" style="--outlook-color:${outlook.dominant.color}">
      <div class="outlook-head">
        <span>${outlook.label}</span>
        <strong>${outlook.dominant.label} ${outlook.dominant.value}%</strong>
      </div>
      <div class="outlook-probabilities">
        <div class="bull"><span>עולה</span><b>${outlook.bullish}%</b></div>
        <div class="flat"><span>דשדוש</span><b>${outlook.neutral}%</b></div>
        <div class="bear"><span>יורד</span><b>${outlook.bearish}%</b></div>
      </div>
      <div class="outlook-range">
        <span>טווח תרחיש</span>
        <strong>${formatPrice(outlook.bearishTarget)} – ${formatPrice(outlook.bullishTarget)}</strong>
      </div>
      <p>${outlook.description} תנועה משוערת: ±${outlook.movePercent.toFixed(1)}%.</p>
    </article>
  `).join("");
}

function updateDecisionCenter() {
  const a = state.analysis;
  const intervalLabels = { "15m": "15M", "1h": "1H", "4h": "4H", "1d": "1D" };
  const intervalNames = { "15m": "קצר", "1h": "תוך יומי", "4h": "סווינג", "1d": "ראשי" };
  const intervals = ["15m", "1h", "4h", "1d"];
  const directions = intervals.map((interval) => {
    const analysis = state.timeframeAnalyses[interval];
    const direction = analysis.combined > 0.1 ? "bull" : analysis.combined < -0.1 ? "bear" : "neutral";
    return { interval, analysis, direction };
  });
  const bullishFrames = directions.filter((item) => item.direction === "bull").length;
  const bearishFrames = directions.filter((item) => item.direction === "bear").length;
  const dominantDirection = bullishFrames > bearishFrames ? "bull" : bearishFrames > bullishFrames ? "bear" : "neutral";
  const alignedFrames = dominantDirection === "neutral"
    ? directions.filter((item) => item.direction === "neutral").length
    : directions.filter((item) => item.direction === dominantDirection).length;

  $("#timeframeMatrix").innerHTML = directions.map(({ interval, analysis, direction }) => `
    <div class="timeframe-cell ${direction}">
      <span>${intervalLabels[interval]}</span>
      <strong>${direction === "bull" ? "שורי" : direction === "bear" ? "דובי" : "ניטרלי"}</strong>
      <small>${intervalNames[interval]} · ${analysis.regime}</small>
    </div>
  `).join("");
  $("#mtfAlignment").textContent = dominantDirection === "neutral"
    ? `פיצול ${bullishFrames}/${bearishFrames}`
    : `${alignedFrames}/4 מיושרים`;

  const currentPrice = state.candles.at(-1).close;
  const bullLead = a.bullish - a.bearish;
  const bearLead = a.bearish - a.bullish;
  const isBullSetup = a.bullish > a.neutral && bullLead >= 5;
  const isBearSetup = a.bearish > a.neutral && bearLead >= 5;
  const setupType = isBullSetup ? "bull" : isBearSetup ? "bear" : "neutral";
  const bullBlock = a.orderBlocks.find((block) => block.type === "bull");
  const bearBlock = a.orderBlocks.find((block) => block.type === "bear");
  let entryLow;
  let entryHigh;
  let invalidation;
  let targetOne;
  let targetTwo;
  let setupCondition;

  if (setupType === "bull") {
    entryLow = bullBlock?.low ?? a.fibLevels.find((level) => level.ratio === 0.705).price;
    entryHigh = bullBlock?.high ?? a.fibLevels.find((level) => level.ratio === 0.618).price;
    invalidation = bullBlock ? bullBlock.low - a.atrValue * 0.35 : a.rangeLow - a.atrValue * 0.2;
    targetOne = Math.max(currentPrice + a.atrValue, a.fibLevels.find((level) => level.ratio === 0.382).price);
    targetTwo = Math.max(targetOne, a.rangeHigh);
    setupCondition = "תקף רק לאחר תגובה שורית באזור המעקב ושמירת מבנה עולה. סגירה מתחת לביטול התזה מבטלת את התרחיש.";
  } else if (setupType === "bear") {
    entryLow = bearBlock?.low ?? a.fibLevels.find((level) => level.ratio === 0.382).price;
    entryHigh = bearBlock?.high ?? a.fibLevels.find((level) => level.ratio === 0.236).price;
    invalidation = bearBlock ? bearBlock.high + a.atrValue * 0.35 : a.rangeHigh + a.atrValue * 0.2;
    targetOne = Math.min(currentPrice - a.atrValue, a.fibLevels.find((level) => level.ratio === 0.618).price);
    targetTwo = Math.min(targetOne, a.rangeLow);
    setupCondition = "תקף רק לאחר דחייה דובית באזור המעקב ושבירת מבנה מטה. סגירה מעל ביטול התזה מבטלת את התרחיש.";
  } else {
    $("#setupDirection").textContent = "המתנה";
    $("#entryZone").textContent = `${formatPrice(a.rangeHigh)} / ${formatPrice(a.rangeLow)}`;
    $("#invalidationLevel").textContent = "חזרה לתוך הטווח";
    $("#targetOne").textContent = "1 × ATR מהפריצה";
    $("#targetTwo").textContent = "2 × ATR מהפריצה";
    $("#riskReward").textContent = "אין יתרון ברור";
    $("#setupCondition").textContent = "המתן לפריצה מאושרת של גבול הטווח, נפח גבוה מהממוצע וסגירה מחוץ לאזור. אין כרגע קונפלואנס מספק.";
  }

  if (setupType !== "neutral") {
    const entryMid = (entryLow + entryHigh) / 2;
    const risk = Math.abs(entryMid - invalidation);
    const reward = Math.abs(targetTwo - entryMid);
    const ratio = risk > 0 ? reward / risk : 0;
    $("#setupDirection").textContent = setupType === "bull" ? "תרחיש שורי" : "תרחיש דובי";
    $("#entryZone").textContent = `${formatPrice(Math.min(entryLow, entryHigh))} – ${formatPrice(Math.max(entryLow, entryHigh))}`;
    $("#invalidationLevel").textContent = formatPrice(invalidation);
    $("#targetOne").textContent = formatPrice(targetOne);
    $("#targetTwo").textContent = formatPrice(targetTwo);
    $("#riskReward").textContent = `1 : ${ratio.toFixed(2)}`;
    $("#setupCondition").textContent = setupCondition;
  }

  const confluences = [
    {
      label: "סידור EMA 20 / 50 / 200",
      value: a.trendScore > 0.2 ? "שורי" : a.trendScore < -0.2 ? "דובי" : "מעורב",
      status: a.trendScore > 0.2 ? "positive" : a.trendScore < -0.2 ? "negative" : "neutral"
    },
    {
      label: "RSI 14",
      value: a.rsiValue.toFixed(1),
      status: a.rsiValue > 55 ? "positive" : a.rsiValue < 45 ? "negative" : "neutral"
    },
    {
      label: "MACD Histogram",
      value: a.macdHistogram >= 0 ? "חיובי" : "שלילי",
      status: a.macdHistogram >= 0 ? "positive" : "negative"
    },
    {
      label: "מחיר מול VWAP",
      value: currentPrice >= a.vwap.at(-1) ? "מעל" : "מתחת",
      status: currentPrice >= a.vwap.at(-1) ? "positive" : "negative"
    },
    {
      label: "ADX / עוצמת מגמה",
      value: `${a.adx.value.toFixed(1)} · ${a.adx.plusDI >= a.adx.minusDI ? "+DI" : "−DI"}`,
      status: a.adx.value < 20 ? "neutral" : a.adx.plusDI >= a.adx.minusDI ? "positive" : "negative"
    },
    {
      label: "Stochastic",
      value: a.stochastic.toFixed(1),
      status: a.stochastic < 20 ? "positive" : a.stochastic > 80 ? "negative" : "neutral"
    },
    {
      label: "ICT / נזילות",
      value: a.ictScore > 0.15 ? "שורי" : a.ictScore < -0.15 ? "דובי" : "ללא יתרון",
      status: a.ictScore > 0.15 ? "positive" : a.ictScore < -0.15 ? "negative" : "neutral"
    },
    {
      label: "יישור רב־טווח",
      value: dominantDirection === "neutral" ? `${bullishFrames}↑ / ${bearishFrames}↓` : `${alignedFrames}/4`,
      status: dominantDirection === "bull" ? "positive" : dominantDirection === "bear" ? "negative" : "neutral"
    }
  ];
  const positiveCount = confluences.filter((item) => item.status === "positive").length;
  const negativeCount = confluences.filter((item) => item.status === "negative").length;
  $("#confluenceScore").textContent = `${positiveCount} שורי · ${negativeCount} דובי`;
  $("#confluenceList").innerHTML = confluences.map((item) => `
    <div class="confluence-item ${item.status}">
      <i class="confluence-light"></i>
      <span>${item.label}</span>
      <b>${item.value}</b>
    </div>
  `).join("");
}

function setupCanvas() {
  const canvas = refs.chart;
  const rect = refs.chartWrap.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * ratio);
  canvas.height = Math.round(rect.height * ratio);
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { ctx, width: rect.width, height: rect.height };
}

function drawChart() {
  if (!state.candles.length || !state.analysis) return;
  const { ctx, width, height } = setupCanvas();
  const candles = state.candles.slice(-120);
  const offset = state.candles.length - candles.length;
  const a = state.analysis;
  const pad = { top: 18, right: 72, bottom: 30, left: 12 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;

  const visibleZones = [
    ...(state.layers.ob ? a.orderBlocks : []),
    ...(state.layers.fvg ? a.fvgs : [])
  ].filter((zone) => zone.index >= offset);
  let min = Math.min(...candles.map((c) => c.low), ...visibleZones.map((z) => z.low));
  let max = Math.max(...candles.map((c) => c.high), ...visibleZones.map((z) => z.high));
  const buffer = (max - min) * 0.08;
  min -= buffer;
  max += buffer;

  const x = (index) => pad.left + index / Math.max(candles.length - 1, 1) * plotWidth;
  const y = (price) => pad.top + (max - price) / Math.max(max - min, 0.000001) * plotHeight;
  const css = getComputedStyle(document.body);
  const muted = css.getPropertyValue("--muted").trim();
  const line = css.getPropertyValue("--line").trim();
  const green = css.getPropertyValue("--green").trim();
  const red = css.getPropertyValue("--red").trim();

  ctx.clearRect(0, 0, width, height);
  ctx.font = '9px "IBM Plex Mono", monospace';
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  for (let i = 0; i <= 5; i += 1) {
    const py = pad.top + i / 5 * plotHeight;
    const price = max - i / 5 * (max - min);
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, py);
    ctx.lineTo(width - pad.right + 5, py);
    ctx.stroke();
    ctx.fillStyle = muted;
    ctx.fillText(formatPrice(price).replace("$", ""), width - pad.right + 10, py);
  }

  for (let i = 0; i < candles.length; i += 24) {
    const px = x(i);
    ctx.strokeStyle = line;
    ctx.beginPath();
    ctx.moveTo(px, pad.top);
    ctx.lineTo(px, height - pad.bottom);
    ctx.stroke();
    ctx.fillStyle = muted;
    ctx.textAlign = "center";
    ctx.fillText(formatTime(candles[i].time), px, height - 14);
  }

  visibleZones.forEach((zone) => {
    const start = Math.max(0, zone.index - offset);
    const zoneX = x(start);
    const top = y(zone.high);
    const bottom = y(zone.low);
    const isBull = zone.type === "bull";
    const isFvg = !("strength" in zone);
    ctx.fillStyle = isFvg
      ? "rgba(95,216,213,0.08)"
      : isBull ? "rgba(94,224,160,0.09)" : "rgba(255,107,120,0.09)";
    ctx.strokeStyle = isFvg
      ? "rgba(95,216,213,0.32)"
      : isBull ? "rgba(94,224,160,0.38)" : "rgba(255,107,120,0.38)";
    ctx.setLineDash(isFvg ? [4, 4] : []);
    ctx.fillRect(zoneX, top, width - pad.right - zoneX, Math.max(3, bottom - top));
    ctx.strokeRect(zoneX, top, width - pad.right - zoneX, Math.max(3, bottom - top));
    ctx.setLineDash([]);
  });

  if (state.layers.fib) {
    a.fibLevels.slice(1, -1).forEach((level) => {
      if (level.price < min || level.price > max) return;
      const py = y(level.price);
      ctx.strokeStyle = level === a.nearestFib ? "rgba(244,198,107,0.5)" : "rgba(244,198,107,0.16)";
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(pad.left, py);
      ctx.lineTo(width - pad.right, py);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = level === a.nearestFib ? "#f4c66b" : muted;
      ctx.textAlign = "right";
      ctx.fillText(`${(level.ratio * 100).toFixed(1)}%`, width - pad.right - 5, py - 7);
    });
  }

  if (state.layers.ema) {
    [
      { values: a.ema20.slice(-120), color: "#5fd8d5" },
      { values: a.ema50.slice(-120), color: "#b692ff" }
    ].forEach((series) => {
      ctx.strokeStyle = series.color;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      series.values.forEach((value, index) => {
        if (index === 0) ctx.moveTo(x(index), y(value));
        else ctx.lineTo(x(index), y(value));
      });
      ctx.stroke();
    });
  }

  const candleSpace = plotWidth / candles.length;
  const bodyWidth = Math.max(2, Math.min(7, candleSpace * 0.62));
  candles.forEach((candle, index) => {
    const px = x(index);
    const isUp = candle.close >= candle.open;
    const color = isUp ? green : red;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, y(candle.high));
    ctx.lineTo(px, y(candle.low));
    ctx.stroke();
    const top = y(Math.max(candle.open, candle.close));
    const bottom = y(Math.min(candle.open, candle.close));
    ctx.fillRect(px - bodyWidth / 2, top, bodyWidth, Math.max(1.5, bottom - top));
  });

  const last = candles.at(-1);
  const lastY = y(last.close);
  ctx.strokeStyle = last.close >= last.open ? green : red;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(pad.left, lastY);
  ctx.lineTo(width - pad.right, lastY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = last.close >= last.open ? green : red;
  ctx.fillRect(width - pad.right + 5, lastY - 10, pad.right - 7, 20);
  ctx.fillStyle = "#07110f";
  ctx.textAlign = "center";
  ctx.fillText(formatPrice(last.close).replace("$", ""), width - pad.right / 2 + 2, lastY);

  state.chartGeometry = { x, y, candles, pad, plotWidth, plotHeight };
}

function handleChartMove(event) {
  if (!state.chartGeometry) return;
  const rect = refs.chart.getBoundingClientRect();
  const pointerX = event.clientX - rect.left;
  const { candles, pad, plotWidth } = state.chartGeometry;
  const index = clamp(Math.round((pointerX - pad.left) / plotWidth * (candles.length - 1)), 0, candles.length - 1);
  const candle = candles[index];
  if (!candle || pointerX < pad.left || pointerX > pad.left + plotWidth) {
    refs.tooltip.style.display = "none";
    return;
  }
  refs.tooltip.style.display = "block";
  refs.tooltip.style.left = `${clamp(pointerX + 12, 8, rect.width - 165)}px`;
  refs.tooltip.style.top = `${clamp(event.clientY - rect.top - 30, 8, rect.height - 85)}px`;
  refs.tooltip.innerHTML = `
    <strong>${new Date(candle.time).toLocaleString("he-IL")}</strong><br>
    O ${formatPrice(candle.open)} · H ${formatPrice(candle.high)}<br>
    L ${formatPrice(candle.low)} · C ${formatPrice(candle.close)}<br>
    VOL ${formatCompact(candle.volume)}
  `;
}

function canvasRoundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function canvasPill(ctx, text, x, y, background, color, align = "left") {
  ctx.save();
  ctx.font = '600 18px "Arial"';
  const width = ctx.measureText(text).width + 28;
  const left = align === "right" ? x - width : x;
  canvasRoundRect(ctx, left, y, width, 34, 17);
  ctx.fillStyle = background;
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, left + width / 2, y + 17);
  ctx.restore();
}

function canvasWrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  lines.slice(0, maxLines).forEach((item, index) => ctx.fillText(item, x, y + index * lineHeight));
}

function scenarioReason(outlook, type) {
  const a = state.analysis;
  if (type === "bull") {
    const factors = [];
    if (a.momentumScore > 0) factors.push("מומנטום חיובי");
    if (a.ictScore > 0) factors.push("תמיכת ICT");
    if (outlook.trendScore > 0) factors.push("יישור מגמה");
    return factors.join(" · ") || "נדרש אישור פריצה";
  }
  if (type === "bear") {
    const factors = [];
    if (a.trendScore < 0) factors.push("מבנה ארוך שלילי");
    if (a.ictScore < 0) factors.push("נזילות דובית");
    if (a.rangePosition > 0.65) factors.push("אזור Premium");
    return factors.join(" · ") || "נדרש כשל תמיכה";
  }
  return a.adx.value < 20 ? "ADX נמוך · שוק ללא מגמה" : "איזון בין אותות סותרים";
}

function drawExportPath(ctx, points, color, dashed = false) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.setLineDash(dashed ? [11, 9] : []);
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else {
      const previous = points[index - 1];
      const controlX = (previous.x + point.x) / 2;
      ctx.bezierCurveTo(controlX, previous.y, controlX, point.y, point.x, point.y);
    }
  });
  ctx.stroke();
  ctx.setLineDash([]);
  points.slice(1).forEach((point) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  });
  ctx.restore();
}

async function exportAnalysisImage() {
  if (!state.analysis || !state.candles.length || !state.futureOutlooks.length) return;
  refs.exportAnalysis.classList.add("exporting");
  const originalText = refs.exportAnalysis.querySelector("span").textContent;
  refs.exportAnalysis.querySelector("span").textContent = "מייצר תמונה...";

  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1800;
    canvas.height = 1180;
    const ctx = canvas.getContext("2d");
    const a = state.analysis;
    const candles = state.candles.slice(-130);
    const current = candles.at(-1).close;
    const outlooks = state.futureOutlooks;

    const background = ctx.createLinearGradient(0, 0, 1800, 1180);
    background.addColorStop(0, "#07110f");
    background.addColorStop(0.55, "#0b1b17");
    background.addColorStop(1, "#071310");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(94,224,160,0.045)";
    ctx.beginPath();
    ctx.arc(1500, 80, 330, 0, Math.PI * 2);
    ctx.fill();

    ctx.direction = "rtl";
    ctx.textAlign = "right";
    ctx.fillStyle = "#edf7f2";
    ctx.font = '700 42px "Arial"';
    ctx.fillText("מפת העתיד של ארבעת הציידים", 1730, 65);
    ctx.fillStyle = "#829b91";
    ctx.font = '500 18px "Arial"';
    ctx.fillText(`${state.asset.name} · ${state.asset.code}/USDT · טווח גרף ${state.interval.toUpperCase()}`, 1730, 100);
    ctx.direction = "ltr";
    ctx.textAlign = "left";
    ctx.fillStyle = "#5ee0a0";
    ctx.font = '600 18px "Arial"';
    ctx.fillText(`GENERATED ${new Date().toLocaleString("en-GB")}`, 70, 70);
    ctx.fillStyle = "#829b91";
    ctx.fillText(`LIVE SOURCE: ${state.source === "live" ? "BINANCE" : "SIMULATION"}`, 70, 100);

    const plot = { x: 70, y: 150, width: 1320, height: 660 };
    const futureWidth = 450;
    const historyWidth = plot.width - futureWidth;
    const volumeHeight = 105;
    const priceHeight = plot.height - volumeHeight;
    const allFuturePrices = outlooks.flatMap((outlook) => [
      outlook.bullishTarget,
      outlook.bearishTarget,
      outlook.flatHigh,
      outlook.flatLow
    ]);
    const zones = [...a.orderBlocks, ...a.fvgs];
    let priceMin = Math.min(...candles.map((c) => c.low), ...allFuturePrices, ...zones.map((zone) => zone.low));
    let priceMax = Math.max(...candles.map((c) => c.high), ...allFuturePrices, ...zones.map((zone) => zone.high));
    const pricePadding = (priceMax - priceMin) * 0.1;
    priceMin -= pricePadding;
    priceMax += pricePadding;
    const priceY = (price) => plot.y + (priceMax - price) / Math.max(priceMax - priceMin, 0.000001) * priceHeight;
    const historyX = (index) => plot.x + index / Math.max(candles.length - 1, 1) * historyWidth;

    canvasRoundRect(ctx, plot.x, plot.y, plot.width, plot.height, 18);
    ctx.fillStyle = "rgba(4,13,11,0.68)";
    ctx.fill();
    ctx.strokeStyle = "rgba(140,184,168,0.18)";
    ctx.lineWidth = 1;
    ctx.stroke();

    const futureGradient = ctx.createLinearGradient(plot.x + historyWidth, 0, plot.x + plot.width, 0);
    futureGradient.addColorStop(0, "rgba(95,216,213,0.025)");
    futureGradient.addColorStop(1, "rgba(95,216,213,0.09)");
    ctx.fillStyle = futureGradient;
    ctx.fillRect(plot.x + historyWidth, plot.y, futureWidth, priceHeight);
    ctx.fillStyle = "#5fd8d5";
    ctx.font = '600 15px "Arial"';
    ctx.textAlign = "center";
    ctx.fillText("מרחב תרחישים עתידי", plot.x + historyWidth + futureWidth / 2, plot.y + 28);

    for (let i = 0; i <= 6; i += 1) {
      const y = plot.y + i / 6 * priceHeight;
      const price = priceMax - i / 6 * (priceMax - priceMin);
      ctx.strokeStyle = "rgba(140,184,168,0.11)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(plot.x, y);
      ctx.lineTo(plot.x + plot.width, y);
      ctx.stroke();
      ctx.fillStyle = "#829b91";
      ctx.font = '500 14px "Arial"';
      ctx.textAlign = "right";
      ctx.fillText(formatPrice(price), plot.x + plot.width - 10, y - 10);
    }

    const keyLevels = [
      { price: a.rangeHigh, label: "Range High", color: "rgba(255,107,120,0.55)" },
      { price: a.rangeLow, label: "Range Low", color: "rgba(94,224,160,0.55)" },
      { price: a.vwap.at(-1), label: "VWAP", color: "rgba(95,216,213,0.48)" },
      { price: a.nearestFib.price, label: `Fib ${(a.nearestFib.ratio * 100).toFixed(1)}%`, color: "rgba(244,198,107,0.58)" }
    ];
    keyLevels.forEach((level) => {
      const y = priceY(level.price);
      ctx.strokeStyle = level.color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([7, 6]);
      ctx.beginPath();
      ctx.moveTo(plot.x, y);
      ctx.lineTo(plot.x + plot.width, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = level.color;
      ctx.font = '600 13px "Arial"';
      ctx.textAlign = "left";
      ctx.fillText(`${level.label} ${formatPrice(level.price)}`, plot.x + 10, y - 9);
    });

    zones.slice(0, 5).forEach((zone) => {
      const top = priceY(zone.high);
      const bottom = priceY(zone.low);
      const isBull = zone.type === "bull";
      const isFvg = !("strength" in zone);
      ctx.fillStyle = isFvg
        ? "rgba(95,216,213,0.08)"
        : isBull ? "rgba(94,224,160,0.09)" : "rgba(255,107,120,0.09)";
      ctx.strokeStyle = isFvg
        ? "rgba(95,216,213,0.38)"
        : isBull ? "rgba(94,224,160,0.4)" : "rgba(255,107,120,0.4)";
      ctx.fillRect(plot.x + historyWidth * 0.64, top, plot.width - historyWidth * 0.64, Math.max(4, bottom - top));
      ctx.strokeRect(plot.x + historyWidth * 0.64, top, plot.width - historyWidth * 0.64, Math.max(4, bottom - top));
    });

    const maxVolume = Math.max(...candles.map((c) => c.volume));
    const candleSpace = historyWidth / candles.length;
    const candleWidth = Math.max(2, Math.min(6, candleSpace * 0.58));
    candles.forEach((candle, index) => {
      const x = historyX(index);
      const up = candle.close >= candle.open;
      const color = up ? "#5ee0a0" : "#ff6b78";
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, priceY(candle.high));
      ctx.lineTo(x, priceY(candle.low));
      ctx.stroke();
      const top = priceY(Math.max(candle.open, candle.close));
      const bottom = priceY(Math.min(candle.open, candle.close));
      ctx.fillRect(x - candleWidth / 2, top, candleWidth, Math.max(2, bottom - top));

      const volumeTop = plot.y + priceHeight + volumeHeight - candle.volume / maxVolume * (volumeHeight - 18);
      ctx.globalAlpha = 0.42;
      ctx.fillRect(x - candleWidth / 2, volumeTop, candleWidth, plot.y + plot.height - volumeTop);
      ctx.globalAlpha = 1;
    });

    ctx.strokeStyle = "rgba(140,184,168,0.32)";
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(plot.x + historyWidth, plot.y);
    ctx.lineTo(plot.x + historyWidth, plot.y + plot.height);
    ctx.stroke();
    ctx.setLineDash([]);

    const futureXs = [
      plot.x + historyWidth + futureWidth * 0.22,
      plot.x + historyWidth + futureWidth * 0.56,
      plot.x + historyWidth + futureWidth * 0.88
    ];
    const startPoint = { x: plot.x + historyWidth, y: priceY(current) };
    const bullPoints = [startPoint, ...outlooks.map((outlook, index) => ({ x: futureXs[index], y: priceY(outlook.bullishTarget) }))];
    const flatPoints = [startPoint, ...outlooks.map((outlook, index) => ({ x: futureXs[index], y: priceY((outlook.flatLow + outlook.flatHigh) / 2) }))];
    const bearPoints = [startPoint, ...outlooks.map((outlook, index) => ({ x: futureXs[index], y: priceY(outlook.bearishTarget) }))];
    drawExportPath(ctx, bullPoints, "#5ee0a0");
    drawExportPath(ctx, flatPoints, "#f4c66b", true);
    drawExportPath(ctx, bearPoints, "#ff6b78");

    outlooks.forEach((outlook, index) => {
      const x = futureXs[index];
      ctx.fillStyle = "#829b91";
      ctx.font = '600 14px "Arial"';
      ctx.textAlign = "center";
      ctx.fillText(outlook.label, x, plot.y + priceHeight - 15);
      canvasPill(ctx, `↑ ${outlook.bullish}%`, x - 12, priceY(outlook.bullishTarget) - 45, "rgba(94,224,160,0.16)", "#96ffc7", "right");
      canvasPill(ctx, `→ ${outlook.neutral}%`, x + 12, priceY((outlook.flatLow + outlook.flatHigh) / 2) - 17, "rgba(244,198,107,0.16)", "#f4c66b");
      canvasPill(ctx, `↓ ${outlook.bearish}%`, x - 12, priceY(outlook.bearishTarget) + 12, "rgba(255,107,120,0.16)", "#ff8e98", "right");
    });

    ctx.strokeStyle = "#edf7f2";
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.moveTo(plot.x + historyWidth - 20, priceY(current));
    ctx.lineTo(plot.x + plot.width, priceY(current));
    ctx.stroke();
    ctx.setLineDash([]);
    canvasPill(ctx, `NOW ${formatPrice(current)}`, plot.x + historyWidth - 10, priceY(current) - 17, "#edf7f2", "#07110f", "right");

    const summaryY = 845;
    const columnWidth = 535;
    const cards = [
      {
        x: 70,
        title: "תרחיש עולה",
        color: "#5ee0a0",
        probability: outlooks[1].bullish,
        target: formatPrice(outlooks[1].bullishTarget),
        reason: scenarioReason(outlooks[1], "bull")
      },
      {
        x: 632,
        title: "תרחיש דשדוש",
        color: "#f4c66b",
        probability: outlooks[1].neutral,
        target: `${formatPrice(outlooks[1].flatLow)} – ${formatPrice(outlooks[1].flatHigh)}`,
        reason: scenarioReason(outlooks[1], "flat")
      },
      {
        x: 1194,
        title: "תרחיש יורד",
        color: "#ff6b78",
        probability: outlooks[1].bearish,
        target: formatPrice(outlooks[1].bearishTarget),
        reason: scenarioReason(outlooks[1], "bear")
      }
    ];
    cards.forEach((card) => {
      canvasRoundRect(ctx, card.x, summaryY, columnWidth, 170, 16);
      ctx.fillStyle = "rgba(13,28,24,0.9)";
      ctx.fill();
      ctx.strokeStyle = `${card.color}55`;
      ctx.stroke();
      ctx.direction = "rtl";
      ctx.textAlign = "right";
      ctx.fillStyle = card.color;
      ctx.font = '700 24px "Arial"';
      ctx.fillText(`${card.title} · ${card.probability}%`, card.x + columnWidth - 22, summaryY + 40);
      ctx.fillStyle = "#edf7f2";
      ctx.font = '600 20px "Arial"';
      ctx.fillText(`יעד 7 ימים: ${card.target}`, card.x + columnWidth - 22, summaryY + 78);
      ctx.fillStyle = "#9eb2aa";
      ctx.font = '500 17px "Arial"';
      canvasWrapText(ctx, card.reason, card.x + columnWidth - 22, summaryY + 113, columnWidth - 44, 25, 2);
    });

    const footerY = 1045;
    ctx.direction = "rtl";
    ctx.textAlign = "right";
    ctx.fillStyle = "#edf7f2";
    ctx.font = '700 18px "Arial"';
    ctx.fillText(`ביטול תזה: ${$("#invalidationLevel").textContent} · ADX ${a.adx.value.toFixed(1)} · RSI ${a.rsiValue.toFixed(1)} · Wyckoff ${a.wyckoff.phase}`, 1730, footerY);
    ctx.fillStyle = "#71877e";
    ctx.font = '500 14px "Arial"';
    ctx.fillText("התרחישים הם ניתוח הסתברותי המבוסס על נתוני עבר ואינם תחזית ודאית או הוראת מסחר.", 1730, footerY + 35);
    ctx.direction = "ltr";
    ctx.textAlign = "left";
    ctx.fillStyle = "#5ee0a0";
    ctx.font = '600 16px "Arial"';
    ctx.fillText("FOUR HUNTERS · MARKET ATLAS", 70, footerY + 18);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.96));
    if (!blob) throw new Error("Could not create export");
    if (exportObjectUrl) URL.revokeObjectURL(exportObjectUrl);
    exportObjectUrl = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    refs.exportPreview.src = exportObjectUrl;
    refs.downloadExport.href = exportObjectUrl;
    refs.downloadExport.download = `four-hunters-${state.asset.code}-${state.interval}-${timestamp}.png`;
    refs.exportDialog.showModal();
  } finally {
    refs.exportAnalysis.classList.remove("exporting");
    refs.exportAnalysis.querySelector("span").textContent = originalText;
  }
}

function bindEvents() {
  refs.assetSearch.addEventListener("input", (event) => renderAssetList(event.target.value));
  refs.launch.addEventListener("click", runAnalysis);
  refs.exportAnalysis.addEventListener("click", exportAnalysisImage);
  refs.chart.addEventListener("mousemove", handleChartMove);
  refs.chart.addEventListener("mouseleave", () => { refs.tooltip.style.display = "none"; });

  $$(".timeframes button").forEach((button) => {
    button.addEventListener("click", async () => {
      $$(".timeframes button").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      state.interval = button.dataset.interval;
      await runAnalysis();
    });
  });

  $$("[data-layer]").forEach((button) => {
    button.addEventListener("click", () => {
      const layer = button.dataset.layer;
      state.layers[layer] = !state.layers[layer];
      button.classList.toggle("active", state.layers[layer]);
      drawChart();
    });
  });

  $("#themeButton").addEventListener("click", () => {
    document.body.classList.toggle("light-mode");
    drawChart();
  });
  $("#methodButton").addEventListener("click", () => refs.dialog.showModal());
  $("#disclaimerButton").addEventListener("click", () => refs.dialog.showModal());
  $("#dialogClose").addEventListener("click", () => refs.dialog.close());
  $("#exportDialogClose").addEventListener("click", () => refs.exportDialog.close());
  refs.dialog.addEventListener("click", (event) => {
    if (event.target === refs.dialog) refs.dialog.close();
  });
  refs.exportDialog.addEventListener("click", (event) => {
    if (event.target === refs.exportDialog) refs.exportDialog.close();
  });

  const observer = new ResizeObserver(() => drawChart());
  observer.observe(refs.chartWrap);
}

async function init() {
  renderAssetList();
  updateSelectedAsset();
  bindEvents();
  await Promise.all([runAnalysis(), fetchAssetTickers()]);
}

async function bootstrap() {
  bindAuthentication();
  if (hasActiveSession()) {
    await unlockApplication();
  } else {
    refs.loginUsername.focus();
  }
}

bootstrap();

"use strict";

const ASSETS = [
  { symbol: "BTCUSDT", code: "BTC", name: "Bitcoin", icon: "₿", color: "#f3ba2f", seed: 68000 },
  { symbol: "ETHUSDT", code: "ETH", name: "Ethereum", icon: "Ξ", color: "#8797f5", seed: 3600 },
  { symbol: "SOLUSDT", code: "SOL", name: "Solana", icon: "S", color: "#8e62ff", seed: 155 },
  { symbol: "XRPUSDT", code: "XRP", name: "XRP", icon: "X", color: "#67d8d2", seed: 0.54 },
  { symbol: "BNBUSDT", code: "BNB", name: "BNB", icon: "B", color: "#f3ba2f", seed: 610 },
  { symbol: "ADAUSDT", code: "ADA", name: "Cardano", icon: "A", color: "#4ca9eb", seed: 0.42 },
  { symbol: "LINKUSDT", code: "LINK", name: "Chainlink", icon: "L", color: "#4f72e6", seed: 15.5 },
  { symbol: "PAXGUSDT", code: "PAXG", name: "PAX Gold", icon: "Au", color: "#e6bd56", seed: 2350, isGold: true }
];

const state = {
  asset: ASSETS[0],
  interval: "4h",
  candles: [],
  analysis: null,
  layers: { fib: true, ob: true, fvg: true, ema: true },
  source: "live",
  hoverIndex: null
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const refs = {
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
  dialog: $("#infoDialog")
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function formatPrice(value) {
  if (!Number.isFinite(value)) return "--";
  const digits = value < 1 ? 4 : value < 100 ? 2 : value < 1000 ? 2 : 0;
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

async function fetchCandles() {
  const endpoint = `https://api.binance.com/api/v3/klines?symbol=${state.asset.symbol}&interval=${state.interval}&limit=300`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(endpoint, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length < 80) throw new Error("Insufficient data");
    state.source = "live";
    return rows.map((row) => ({
      time: Number(row[0]),
      open: Number(row[1]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
      volume: Number(row[5])
    }));
  } catch (error) {
    state.source = "simulation";
    return generateFallbackCandles(state.asset, state.interval);
  } finally {
    clearTimeout(timeout);
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
    trendScore, momentumScore, ictScore, locationScore, combined, confidence,
    bullish, bearish, neutral, orderBlocks, fvgs, sweep, wyckoff, fibLevels, nearestFib,
    macdHistogram
  };
}

function renderAssetList(filter = "") {
  const query = filter.trim().toLowerCase();
  refs.assetList.innerHTML = "";
  ASSETS.filter((asset) => `${asset.name} ${asset.code}`.toLowerCase().includes(query)).forEach((asset) => {
    const button = document.createElement("button");
    button.className = `asset-item ${asset.symbol === state.asset.symbol ? "active" : ""}`;
    button.style.setProperty("--asset-color", asset.color);
    button.innerHTML = `
      <span class="asset-logo">${asset.icon}</span>
      <span class="asset-name"><strong>${asset.name}</strong><span>${asset.code} / USDT</span></span>
      <span class="asset-price"><strong data-price="${asset.symbol}">--</strong><small>לחץ לניתוח</small></span>
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
  state.candles = await fetchCandles();
  state.analysis = analyzeMarket(state.candles);
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
  $("#scenarioCallout").innerHTML = `<span>תזה מרכזית</span><p>${trend} ${location}. רמת Fibonacci הקרובה: ${(a.nearestFib.ratio * 100).toFixed(1)}%.</p>`;
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

function bindEvents() {
  refs.assetSearch.addEventListener("input", (event) => renderAssetList(event.target.value));
  refs.launch.addEventListener("click", runAnalysis);
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
  refs.dialog.addEventListener("click", (event) => {
    if (event.target === refs.dialog) refs.dialog.close();
  });

  const observer = new ResizeObserver(() => drawChart());
  observer.observe(refs.chartWrap);
}

async function init() {
  renderAssetList();
  updateSelectedAsset();
  bindEvents();
  await runAnalysis();
}

init();

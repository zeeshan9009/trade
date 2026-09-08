/**
 * Candlestick Pattern Recognition and Trend Detection
 * Pure functions for detecting market trend and technical candlestick patterns.
 */

import type { CandleData } from "./indicators.ts";

export type TrendDirection = "UP" | "DOWN" | "NEUTRAL";

export type PatternType =
  | "BULLISH_ENGULFING"
  | "BEARISH_ENGULFING"
  | "DOJI"
  | "HAMMER"
  | "SHOOTING_STAR"
  | "MORNING_STAR"
  | "EVENING_STAR"
  | "BULLISH_MARUBOZU"
  | "BEARISH_MARUBOZU";

export interface PatternDefinition {
  type: PatternType;
  name: string;
  shortLabel: string;
  sentiment: "bullish" | "bearish" | "neutral";
  position: "aboveBar" | "belowBar";
  color: string;
  meaning: string;
  reliability: string;
}

export interface DetectedPattern {
  type: PatternType;
  name: string;
  shortLabel: string;
  sentiment: "bullish" | "bearish" | "neutral";
  time: number;
  price: number;
  position: "aboveBar" | "belowBar";
  color: string;
  trendContext: string;
  meaning: string;
  reliability: string;
}

export const PATTERN_DEFINITIONS: Record<PatternType, Omit<PatternDefinition, "type">> = {
  BULLISH_ENGULFING: {
    name: "Bullish Engulfing",
    shortLabel: "Bull Engulf",
    sentiment: "bullish",
    position: "belowBar",
    color: "#0ecb81",
    meaning: "Bullish Engulfing after a downtrend suggests strong buyer demand and potential reversal to the upside.",
    reliability: "High. Most reliable at major support levels or oversold conditions.",
  },
  BEARISH_ENGULFING: {
    name: "Bearish Engulfing",
    shortLabel: "Bear Engulf",
    sentiment: "bearish",
    position: "aboveBar",
    color: "#f6465d",
    meaning: "Bearish Engulfing after an uptrend indicates sellers overpowering buyers, signaling potential downward reversal.",
    reliability: "High. Most reliable near resistance levels or overbought conditions.",
  },
  DOJI: {
    name: "Doji",
    shortLabel: "Doji",
    sentiment: "neutral",
    position: "aboveBar",
    color: "#f0b90b",
    meaning: "Represents indecision in the market where buyers and sellers reached equilibrium.",
    reliability: "Moderate. Await subsequent candle confirmation to establish directional momentum.",
  },
  HAMMER: {
    name: "Hammer",
    shortLabel: "Hammer",
    sentiment: "bullish",
    position: "belowBar",
    color: "#0ecb81",
    meaning: "Long lower wick shows aggressive rejection of lower prices, indicating strong buying support after a decline.",
    reliability: "Moderate to high when appearing at clear swing lows or support.",
  },
  SHOOTING_STAR: {
    name: "Shooting Star",
    shortLabel: "Shooting Star",
    sentiment: "bearish",
    position: "aboveBar",
    color: "#f6465d",
    meaning: "Long upper wick shows rejection of higher prices, signaling seller rejection after an upward push.",
    reliability: "Moderate to high when appearing at swing highs or resistance.",
  },
  MORNING_STAR: {
    name: "Morning Star",
    shortLabel: "Morning Star",
    sentiment: "bullish",
    position: "belowBar",
    color: "#0ecb81",
    meaning: "Three-candle bottom reversal pattern indicating transition from selling pressure through indecision to buyer dominance.",
    reliability: "Very high. Standard institutional reversal formation.",
  },
  EVENING_STAR: {
    name: "Evening Star",
    shortLabel: "Evening Star",
    sentiment: "bearish",
    position: "aboveBar",
    color: "#f6465d",
    meaning: "Three-candle top reversal pattern indicating transition from bullish momentum through exhaustion to seller dominance.",
    reliability: "Very high. Standard institutional top formation.",
  },
  BULLISH_MARUBOZU: {
    name: "Bullish Marubozu",
    shortLabel: "Bull Marubozu",
    sentiment: "bullish",
    position: "belowBar",
    color: "#0ecb81",
    meaning: "Long body with virtually no wicks indicates total buyer control from open to close, signaling strong trend continuation or breakout.",
    reliability: "High. Strongly confirms directional momentum.",
  },
  BEARISH_MARUBOZU: {
    name: "Bearish Marubozu",
    shortLabel: "Bear Marubozu",
    sentiment: "bearish",
    position: "aboveBar",
    color: "#f6465d",
    meaning: "Long body with virtually no wicks indicates total seller control from open to close, signaling aggressive downward pressure.",
    reliability: "High. Strongly confirms downward momentum.",
  },
};

/**
 * Calculate simple moving average value for a given index and period
 */
function getSmaAt(candles: CandleData[], index: number, period: number): number | null {
  if (index < period - 1 || index >= candles.length) return null;
  let sum = 0;
  for (let i = index - period + 1; i <= index; i++) {
    sum += candles[i]!.close;
  }
  return sum / period;
}

/**
 * Detect trend for a specific candle index based on SMA slope & Higher-High/Lower-Low structure
 */
export function detectTrendAtIndex(
  candles: CandleData[],
  index: number,
  period = 20,
): TrendDirection {
  if (candles.length < 3 || index < 0 || index >= candles.length) {
    return "NEUTRAL";
  }

  // 1. Check SMA slope if enough history exists
  if (index >= period + 2) {
    const currentSma = getSmaAt(candles, index, period);
    const pastSma = getSmaAt(candles, index - 3, period);
    const close = candles[index]!.close;

    if (currentSma !== null && pastSma !== null) {
      const slope = (currentSma - pastSma) / pastSma;
      if (slope > 0.0005 && close >= currentSma) return "UP";
      if (slope < -0.0005 && close <= currentSma) return "DOWN";
      if (slope > 0.001) return "UP";
      if (slope < -0.001) return "DOWN";
    }
  }

  // 2. Fallback / Short-term structure: Higher-Highs / Higher-Lows vs Lower-Highs / Lower-Lows
  const lookback = Math.min(5, index);
  if (lookback >= 2) {
    let higherHighs = 0;
    let lowerLows = 0;
    for (let i = index - lookback + 1; i <= index; i++) {
      if (candles[i]!.high >= candles[i - 1]!.high) higherHighs++;
      if (candles[i]!.low <= candles[i - 1]!.low) lowerLows++;
    }

    if (higherHighs >= lookback - 1 && candles[index]!.close >= candles[index - lookback]!.close) {
      return "UP";
    }
    if (lowerLows >= lookback - 1 && candles[index]!.close <= candles[index - lookback]!.close) {
      return "DOWN";
    }
  }

  const startClose = candles[Math.max(0, index - 3)]!.close;
  const endClose = candles[index]!.close;
  if (endClose > startClose * 1.002) return "UP";
  if (endClose < startClose * 0.998) return "DOWN";

  return "NEUTRAL";
}

/**
 * Determine overall current trend of the chart
 */
export function detectCurrentTrend(
  candles: CandleData[],
  period = 20,
): { trend: TrendDirection; strength: number; slope: number } {
  if (candles.length === 0) {
    return { trend: "NEUTRAL", strength: 0, slope: 0 };
  }
  const lastIndex = candles.length - 1;
  const trend = detectTrendAtIndex(candles, lastIndex, period);

  // Calculate slope metric
  let slope = 0;
  if (lastIndex >= period + 2) {
    const curr = getSmaAt(candles, lastIndex, period);
    const prev = getSmaAt(candles, lastIndex - 3, period);
    if (curr !== null && prev !== null && prev !== 0) {
      slope = ((curr - prev) / prev) * 100;
    }
  } else if (lastIndex >= 3) {
    const curr = candles[lastIndex]!.close;
    const prev = candles[lastIndex - 3]!.close;
    slope = ((curr - prev) / prev) * 100;
  }

  const strength = Math.min(100, Math.round(Math.abs(slope) * 50) + 50);
  return { trend, strength, slope };
}

/**
 * Check if candle is a Doji
 */
export function isDoji(candle: CandleData): boolean {
  const range = candle.high - candle.low;
  if (range <= 0) return false;
  const body = Math.abs(candle.close - candle.open);
  return body <= range * 0.1;
}

/**
 * Check if candle is a Hammer (bullish reversal)
 */
export function isHammer(candle: CandleData): boolean {
  const range = candle.high - candle.low;
  if (range <= 0) return false;
  const body = Math.abs(candle.close - candle.open);
  const upperWick = candle.high - Math.max(candle.open, candle.close);
  const lowerWick = Math.min(candle.open, candle.close) - candle.low;

  // Body must be in top 35% of the range
  // Lower wick >= 2x body and >= 50% of total range
  // Upper wick <= 20% of range
  return (
    body > 0 &&
    lowerWick >= body * 2 &&
    lowerWick >= range * 0.5 &&
    upperWick <= range * 0.2
  );
}

/**
 * Check if candle is a Shooting Star (bearish reversal)
 */
export function isShootingStar(candle: CandleData): boolean {
  const range = candle.high - candle.low;
  if (range <= 0) return false;
  const body = Math.abs(candle.close - candle.open);
  const upperWick = candle.high - Math.max(candle.open, candle.close);
  const lowerWick = Math.min(candle.open, candle.close) - candle.low;

  // Body must be in bottom 35% of the range
  // Upper wick >= 2x body and >= 50% of total range
  // Lower wick <= 20% of range
  return (
    body > 0 &&
    upperWick >= body * 2 &&
    upperWick >= range * 0.5 &&
    lowerWick <= range * 0.2
  );
}

/**
 * Check if two candles form a Bullish Engulfing pattern
 */
export function isBullishEngulfing(prev: CandleData, curr: CandleData): boolean {
  const prevIsBearish = prev.close < prev.open;
  const currIsBullish = curr.close > curr.open;
  if (!prevIsBearish || !currIsBullish) return false;

  const prevBody = prev.open - prev.close;
  const currBody = curr.close - curr.open;
  if (prevBody <= 0 || currBody <= 0) return false;

  // Current body must encompass prior candle body
  return curr.open <= prev.close + prevBody * 0.1 && curr.close >= prev.open - prevBody * 0.1 && currBody > prevBody;
}

/**
 * Check if two candles form a Bearish Engulfing pattern
 */
export function isBearishEngulfing(prev: CandleData, curr: CandleData): boolean {
  const prevIsBullish = prev.close > prev.open;
  const currIsBearish = curr.close < curr.open;
  if (!prevIsBullish || !currIsBearish) return false;

  const prevBody = prev.close - prev.open;
  const currBody = curr.open - curr.close;
  if (prevBody <= 0 || currBody <= 0) return false;

  // Current body must encompass prior candle body
  return curr.open >= prev.close - prevBody * 0.1 && curr.close <= prev.open + prevBody * 0.1 && currBody > prevBody;
}

/**
 * Check if 3 candles form a Morning Star pattern
 */
export function isMorningStar(first: CandleData, second: CandleData, third: CandleData): boolean {
  const firstIsBearish = first.close < first.open;
  const thirdIsBullish = third.close > third.open;
  if (!firstIsBearish || !thirdIsBullish) return false;

  const firstBody = first.open - first.close;
  const secondBody = Math.abs(second.close - second.open);
  const thirdBody = third.close - third.open;

  const firstRange = first.high - first.low;
  if (firstRange <= 0 || firstBody < firstRange * 0.4) return false;

  // Second candle is small star/doji lower than first
  const secondIsSmall = secondBody <= firstBody * 0.5;
  const secondLower = Math.max(second.open, second.close) <= first.close + firstBody * 0.3;

  // Third candle closes well into first candle (above 50% midpoint)
  const firstMidpoint = first.close + firstBody * 0.5;
  const thirdClosesHigh = third.close >= firstMidpoint;

  return secondIsSmall && secondLower && thirdClosesHigh && thirdBody > 0;
}

/**
 * Check if 3 candles form an Evening Star pattern
 */
export function isEveningStar(first: CandleData, second: CandleData, third: CandleData): boolean {
  const firstIsBullish = first.close > first.open;
  const thirdIsBearish = third.close < third.open;
  if (!firstIsBullish || !thirdIsBearish) return false;

  const firstBody = first.close - first.open;
  const secondBody = Math.abs(second.close - second.open);
  const thirdBody = third.open - third.close;

  const firstRange = first.high - first.low;
  if (firstRange <= 0 || firstBody < firstRange * 0.4) return false;

  // Second candle is small star/doji higher than first
  const secondIsSmall = secondBody <= firstBody * 0.5;
  const secondHigher = Math.min(second.open, second.close) >= first.close - firstBody * 0.3;

  // Third candle closes well into first candle (below 50% midpoint)
  const firstMidpoint = first.close - firstBody * 0.5;
  const thirdClosesLow = third.close <= firstMidpoint;

  return secondIsSmall && secondHigher && thirdClosesLow && thirdBody > 0;
}

/**
 * Check if candle is a Bullish Marubozu
 */
export function isBullishMarubozu(candle: CandleData): boolean {
  const range = candle.high - candle.low;
  if (range <= 0) return false;
  const body = candle.close - candle.open;
  if (body <= 0) return false;

  // Body must cover at least 88% of the entire range
  return body >= range * 0.88;
}

/**
 * Check if candle is a Bearish Marubozu
 */
export function isBearishMarubozu(candle: CandleData): boolean {
  const range = candle.high - candle.low;
  if (range <= 0) return false;
  const body = candle.open - candle.close;
  if (body <= 0) return false;

  // Body must cover at least 88% of the entire range
  return body >= range * 0.88;
}

/**
 * Formats trend context string (e.g. "Formed after Uptrend")
 */
function getTrendContextLabel(trend: TrendDirection): string {
  if (trend === "UP") return "Formed after an Uptrend";
  if (trend === "DOWN") return "Formed after a Downtrend";
  return "Formed during Consolidation / Neutral Trend";
}

/**
 * Analyze full candle array and detect all patterns with trend context
 */
export function detectAllPatterns(
  candles: CandleData[],
  options?: { smaPeriod?: number },
): { patterns: DetectedPattern[]; currentTrend: TrendDirection } {
  const period = options?.smaPeriod ?? 20;
  const patterns: DetectedPattern[] = [];

  if (candles.length === 0) {
    return { patterns, currentTrend: "NEUTRAL" };
  }

  for (let i = 0; i < candles.length; i++) {
    const curr = candles[i]!;
    const prev = i > 0 ? candles[i - 1]! : null;
    const prev2 = i > 1 ? candles[i - 2]! : null;

    // Trend before this candle
    const priorTrend = detectTrendAtIndex(candles, Math.max(0, i - 1), period);
    const trendContext = getTrendContextLabel(priorTrend);

    // 1. Three-candle patterns (Morning / Evening Star)
    if (prev && prev2) {
      if (isMorningStar(prev2, prev, curr)) {
        const def = PATTERN_DEFINITIONS.MORNING_STAR;
        patterns.push({
          type: "MORNING_STAR",
          name: def.name,
          shortLabel: def.shortLabel,
          sentiment: def.sentiment,
          time: curr.time,
          price: curr.low,
          position: def.position,
          color: def.color,
          trendContext,
          meaning: def.meaning,
          reliability: def.reliability,
        });
        continue;
      }
      if (isEveningStar(prev2, prev, curr)) {
        const def = PATTERN_DEFINITIONS.EVENING_STAR;
        patterns.push({
          type: "EVENING_STAR",
          name: def.name,
          shortLabel: def.shortLabel,
          sentiment: def.sentiment,
          time: curr.time,
          price: curr.high,
          position: def.position,
          color: def.color,
          trendContext,
          meaning: def.meaning,
          reliability: def.reliability,
        });
        continue;
      }
    }

    // 2. Two-candle patterns (Engulfing)
    if (prev) {
      if (isBullishEngulfing(prev, curr)) {
        const def = PATTERN_DEFINITIONS.BULLISH_ENGULFING;
        patterns.push({
          type: "BULLISH_ENGULFING",
          name: def.name,
          shortLabel: def.shortLabel,
          sentiment: def.sentiment,
          time: curr.time,
          price: curr.low,
          position: def.position,
          color: def.color,
          trendContext,
          meaning: def.meaning,
          reliability: def.reliability,
        });
        continue;
      }
      if (isBearishEngulfing(prev, curr)) {
        const def = PATTERN_DEFINITIONS.BEARISH_ENGULFING;
        patterns.push({
          type: "BEARISH_ENGULFING",
          name: def.name,
          shortLabel: def.shortLabel,
          sentiment: def.sentiment,
          time: curr.time,
          price: curr.high,
          position: def.position,
          color: def.color,
          trendContext,
          meaning: def.meaning,
          reliability: def.reliability,
        });
        continue;
      }
    }

    // 3. Single-candle patterns
    if (isBullishMarubozu(curr)) {
      const def = PATTERN_DEFINITIONS.BULLISH_MARUBOZU;
      patterns.push({
        type: "BULLISH_MARUBOZU",
        name: def.name,
        shortLabel: def.shortLabel,
        sentiment: def.sentiment,
        time: curr.time,
        price: curr.low,
        position: def.position,
        color: def.color,
        trendContext,
        meaning: def.meaning,
        reliability: def.reliability,
      });
      continue;
    }

    if (isBearishMarubozu(curr)) {
      const def = PATTERN_DEFINITIONS.BEARISH_MARUBOZU;
      patterns.push({
        type: "BEARISH_MARUBOZU",
        name: def.name,
        shortLabel: def.shortLabel,
        sentiment: def.sentiment,
        time: curr.time,
        price: curr.high,
        position: def.position,
        color: def.color,
        trendContext,
        meaning: def.meaning,
        reliability: def.reliability,
      });
      continue;
    }

    if (isHammer(curr)) {
      const def = PATTERN_DEFINITIONS.HAMMER;
      patterns.push({
        type: "HAMMER",
        name: def.name,
        shortLabel: def.shortLabel,
        sentiment: def.sentiment,
        time: curr.time,
        price: curr.low,
        position: def.position,
        color: def.color,
        trendContext,
        meaning: def.meaning,
        reliability: def.reliability,
      });
      continue;
    }

    if (isShootingStar(curr)) {
      const def = PATTERN_DEFINITIONS.SHOOTING_STAR;
      patterns.push({
        type: "SHOOTING_STAR",
        name: def.name,
        shortLabel: def.shortLabel,
        sentiment: def.sentiment,
        time: curr.time,
        price: curr.high,
        position: def.position,
        color: def.color,
        trendContext,
        meaning: def.meaning,
        reliability: def.reliability,
      });
      continue;
    }

    if (isDoji(curr)) {
      const def = PATTERN_DEFINITIONS.DOJI;
      patterns.push({
        type: "DOJI",
        name: def.name,
        shortLabel: def.shortLabel,
        sentiment: def.sentiment,
        time: curr.time,
        price: curr.high,
        position: def.position,
        color: def.color,
        trendContext,
        meaning: def.meaning,
        reliability: def.reliability,
      });
      continue;
    }
  }

  const { trend: currentTrend } = detectCurrentTrend(candles, period);
  return { patterns, currentTrend };
}

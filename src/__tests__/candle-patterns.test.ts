import { describe, expect, it } from "vitest";
import {
  detectAllPatterns,
  detectCurrentTrend,
  isBearishEngulfing,
  isBearishMarubozu,
  isBullishEngulfing,
  isBullishMarubozu,
  isDoji,
  isEveningStar,
  isHammer,
  isMorningStar,
  isShootingStar,
  type CandleData,
} from "../lib/candle-patterns.ts";

describe("Candle Pattern Recognition", () => {
  it("correctly identifies a Doji candle", () => {
    const dojiCandle: CandleData = {
      time: 1000,
      open: 100,
      high: 105,
      low: 95,
      close: 100.2, // body = 0.2, range = 10 (2% <= 10%)
    };
    expect(isDoji(dojiCandle)).toBe(true);

    const normalCandle: CandleData = {
      time: 1000,
      open: 100,
      high: 105,
      low: 95,
      close: 104, // body = 4, range = 10 (40%)
    };
    expect(isDoji(normalCandle)).toBe(false);
  });

  it("correctly identifies Hammer and Shooting Star", () => {
    // Hammer: long lower wick, small body at top
    const hammer: CandleData = {
      time: 1000,
      open: 108,
      high: 110,
      low: 90,
      close: 109, // body = 1, lower wick = 18 (18x body), upper wick = 1
    };
    expect(isHammer(hammer)).toBe(true);
    expect(isShootingStar(hammer)).toBe(false);

    // Shooting Star: long upper wick, small body at bottom
    const shootingStar: CandleData = {
      time: 1000,
      open: 92,
      high: 110,
      low: 90,
      close: 91, // body = 1, upper wick = 18 (18x body), lower wick = 1
    };
    expect(isShootingStar(shootingStar)).toBe(true);
    expect(isHammer(shootingStar)).toBe(false);
  });

  it("correctly identifies Bullish and Bearish Engulfing patterns", () => {
    // Bullish Engulfing: 1st red, 2nd green engulfing
    const prevBearish: CandleData = {
      time: 1000,
      open: 105,
      high: 106,
      low: 99,
      close: 100,
    };
    const currBullish: CandleData = {
      time: 1060,
      open: 99,
      high: 108,
      low: 98,
      close: 107,
    };
    expect(isBullishEngulfing(prevBearish, currBullish)).toBe(true);
    expect(isBearishEngulfing(prevBearish, currBullish)).toBe(false);

    // Bearish Engulfing: 1st green, 2nd red engulfing
    const prevBullish: CandleData = {
      time: 1000,
      open: 100,
      high: 106,
      low: 99,
      close: 105,
    };
    const currBearish: CandleData = {
      time: 1060,
      open: 106,
      high: 107,
      low: 97,
      close: 98,
    };
    expect(isBearishEngulfing(prevBullish, currBearish)).toBe(true);
    expect(isBullishEngulfing(prevBullish, currBearish)).toBe(false);
  });

  it("correctly identifies Morning Star and Evening Star formations", () => {
    // Morning Star: Long Bearish -> Small star lower -> Long Bullish retracing >50%
    const c1: CandleData = { time: 1000, open: 110, high: 111, low: 99, close: 100 };
    const c2: CandleData = { time: 1060, open: 98, high: 99, low: 95, close: 97 };
    const c3: CandleData = { time: 1120, open: 98, high: 108, low: 97, close: 107 }; // closes above midpoint 105
    expect(isMorningStar(c1, c2, c3)).toBe(true);

    // Evening Star: Long Bullish -> Small star higher -> Long Bearish retracing >50%
    const e1: CandleData = { time: 1000, open: 100, high: 111, low: 99, close: 110 };
    const e2: CandleData = { time: 1060, open: 112, high: 114, low: 111, close: 113 };
    const e3: CandleData = { time: 1120, open: 112, high: 113, low: 101, close: 102 }; // closes below midpoint 105
    expect(isEveningStar(e1, e2, e3)).toBe(true);
  });

  it("correctly identifies Marubozu candles", () => {
    const bullMarubozu: CandleData = {
      time: 1000,
      open: 100,
      high: 110,
      low: 100,
      close: 110, // 100% body
    };
    expect(isBullishMarubozu(bullMarubozu)).toBe(true);
    expect(isBearishMarubozu(bullMarubozu)).toBe(false);

    const bearMarubozu: CandleData = {
      time: 1000,
      open: 110,
      high: 110,
      low: 100,
      close: 100, // 100% body
    };
    expect(isBearishMarubozu(bearMarubozu)).toBe(true);
    expect(isBullishMarubozu(bearMarubozu)).toBe(false);
  });

  it("detects trend and processes full candle sequence with detectAllPatterns", () => {
    const uptrendCandles: CandleData[] = Array.from({ length: 30 }, (_, i) => ({
      time: 1000 + i * 60,
      open: 100 + i * 2,
      high: 102 + i * 2,
      low: 99 + i * 2,
      close: 101.5 + i * 2,
    }));

    // Append a Shooting Star at top of uptrend
    uptrendCandles.push({
      time: 1000 + 30 * 60,
      open: 161,
      high: 180,
      low: 160,
      close: 160.5,
    });

    const result = detectAllPatterns(uptrendCandles);
    expect(result.currentTrend).toBe("UP");
    expect(result.patterns.length).toBeGreaterThan(0);

    const lastPattern = result.patterns.find((p) => p.time === 1000 + 30 * 60);
    expect(lastPattern).toBeDefined();
    expect(lastPattern?.type).toBe("SHOOTING_STAR");
    expect(lastPattern?.trendContext).toContain("Uptrend");
    expect(lastPattern?.meaning).toBeDefined();
    expect(lastPattern?.reliability).toBeDefined();
  });
});

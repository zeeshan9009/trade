import { describe, expect, it } from "vitest";
import {
  detectNewProductDiff,
  type CoinbaseProduct,
} from "../services/coinbase-listings.ts";

describe("Coinbase New Listings Diff Detection", () => {
  it("detects newly listed products when not in known set", () => {
    const knownIds = new Set(["BTC-USD", "ETH-USD", "SOL-USD"]);

    const incomingProducts: CoinbaseProduct[] = [
      {
        id: "BTC-USD",
        base_currency: "BTC",
        quote_currency: "USD",
        quote_increment: "0.01",
        base_increment: "0.00000001",
        display_name: "BTC/USD",
        status: "online",
      },
      {
        id: "ETH-USD",
        base_currency: "ETH",
        quote_currency: "USD",
        quote_increment: "0.01",
        base_increment: "0.000001",
        display_name: "ETH/USD",
        status: "online",
      },
      {
        id: "DRIFT-USD", // New product!
        base_currency: "DRIFT",
        quote_currency: "USD",
        quote_increment: "0.001",
        base_increment: "0.1",
        display_name: "DRIFT/USD",
        status: "online",
      },
      {
        id: "RENDER-USDT", // New product!
        base_currency: "RENDER",
        quote_currency: "USDT",
        quote_increment: "0.001",
        base_increment: "0.1",
        display_name: "RENDER/USDT",
        status: "online",
      },
    ];

    const result = detectNewProductDiff(incomingProducts, knownIds);

    expect(result.newProducts).toHaveLength(2);
    expect(result.newProducts.map((p) => p.id)).toEqual(["DRIFT-USD", "RENDER-USDT"]);
    expect(result.updatedKnownIds.has("DRIFT-USD")).toBe(true);
    expect(result.updatedKnownIds.has("RENDER-USDT")).toBe(true);
    expect(result.updatedKnownIds.size).toBe(5);
  });

  it("returns zero new products when no new listings exist", () => {
    const knownIds = new Set(["BTC-USD", "ETH-USD"]);

    const incomingProducts: CoinbaseProduct[] = [
      {
        id: "BTC-USD",
        base_currency: "BTC",
        quote_currency: "USD",
        quote_increment: "0.01",
        base_increment: "0.00000001",
        display_name: "BTC/USD",
        status: "online",
      },
      {
        id: "ETH-USD",
        base_currency: "ETH",
        quote_currency: "USD",
        quote_increment: "0.01",
        base_increment: "0.000001",
        display_name: "ETH/USD",
        status: "online",
      },
    ];

    const result = detectNewProductDiff(incomingProducts, knownIds);

    expect(result.newProducts).toHaveLength(0);
    expect(result.updatedKnownIds.size).toBe(2);
  });

  it("handles empty incoming products gracefully without crashing", () => {
    const knownIds = new Set(["BTC-USD"]);
    const result = detectNewProductDiff([], knownIds);

    expect(result.newProducts).toHaveLength(0);
    expect(result.updatedKnownIds.size).toBe(1);
  });
});

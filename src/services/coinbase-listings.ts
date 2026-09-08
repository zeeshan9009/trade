/**
 * Coinbase Exchange New Listings Service
 * Handles fetching, diff-detection of newly listed products,
 * ticker/stats enrichment, rate-limiting, and paper-trading execution.
 */

import type { CandleData } from "../lib/indicators.ts";
import { mark, placeOrder } from "./demo/engine.ts";
import { useTradingStore } from "./store.tsx";
import { toast } from "./toast.ts";

export interface CoinbaseProduct {
  id: string;
  base_currency: string;
  quote_currency: string;
  quote_increment: string;
  base_increment: string;
  display_name: string;
  status: string;
  status_message?: string;
  cancel_only?: boolean;
  limit_only?: boolean;
  post_only?: boolean;
  trading_disabled?: boolean;
  auction_mode?: boolean;
  product_type?: string;
}

export interface CoinbaseTicker {
  trade_id?: number;
  price?: string;
  size?: string;
  time?: string;
  bid?: string;
  ask?: string;
  volume?: string;
}

export interface CoinbaseStats {
  open?: string;
  high?: string;
  low?: string;
  volume?: string;
  last?: string;
  volume_30day?: string;
}

export interface CoinbaseNewListing {
  id: string;
  baseCurrency: string;
  quoteCurrency: string;
  displayName: string;
  status: string;
  tradingDisabled: boolean;
  quoteIncrement: string;
  baseIncrement: string;
  detectedAt: string; // ISO string
  price: number;
  open24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  change24h: number;
  bid: number;
  ask: number;
  sparkline: number[];
  isNew: boolean;
}

const STORAGE_KNOWN_PRODUCTS_KEY = "opencharts_cb_known_products_v1";
const STORAGE_NEW_LISTINGS_KEY = "opencharts_cb_new_listings_v1";
const STORAGE_LAST_POLL_KEY = "opencharts_cb_last_poll_v1";

const BASE_URL = "https://api.exchange.coinbase.com";

/**
 * Fetch all available products from Coinbase Exchange public endpoint
 */
export async function fetchCoinbaseProducts(): Promise<CoinbaseProduct[]> {
  const res = await fetch(`${BASE_URL}/products`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Coinbase API error: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as CoinbaseProduct[];
}

/**
 * Fetch latest ticker for a product
 */
export async function fetchCoinbaseTicker(productId: string): Promise<CoinbaseTicker | null> {
  try {
    const res = await fetch(`${BASE_URL}/products/${encodeURIComponent(productId)}/ticker`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as CoinbaseTicker;
  } catch {
    return null;
  }
}

/**
 * Fetch 24h stats for a product
 */
export async function fetchCoinbaseStats(productId: string): Promise<CoinbaseStats | null> {
  try {
    const res = await fetch(`${BASE_URL}/products/${encodeURIComponent(productId)}/stats`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as CoinbaseStats;
  } catch {
    return null;
  }
}

/**
 * Fetch historical candles for a Coinbase product
 * Granularity in seconds: 60, 300, 900, 3600, 21600, 86400
 */
export async function fetchCoinbaseCandles(
  productId: string,
  granularity = 300,
): Promise<CandleData[]> {
  try {
    const res = await fetch(
      `${BASE_URL}/products/${encodeURIComponent(productId)}/candles?granularity=${granularity}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return [];
    // Coinbase candle format: [time, low, high, open, close, volume]
    const data = (await res.json()) as Array<[number, number, number, number, number, number]>;
    if (!Array.isArray(data)) return [];

    return data
      .map(([time, low, high, open, close, volume]) => ({
        time,
        open,
        high,
        low,
        close,
        volume,
      }))
      .sort((a, b) => a.time - b.time);
  } catch {
    return [];
  }
}

/**
 * Pure diff calculation function: compares incoming products with known product IDs
 */
export function detectNewProductDiff(
  currentProducts: CoinbaseProduct[],
  knownProductIds: Set<string>,
  nowIso: string = new Date().toISOString(),
): { newProducts: CoinbaseProduct[]; updatedKnownIds: Set<string> } {
  const newProducts: CoinbaseProduct[] = [];
  const updatedKnownIds = new Set(knownProductIds);

  for (const product of currentProducts) {
    if (!knownProductIds.has(product.id)) {
      newProducts.push(product);
      updatedKnownIds.add(product.id);
    }
  }

  return { newProducts, updatedKnownIds };
}

/**
 * Helper to throttle batch promises to avoid hitting Coinbase rate limits
 */
async function batchThrottled<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    const chunk = items.slice(i, i + limit);
    const chunkResults = await Promise.all(chunk.map((item) => fn(item)));
    results.push(...chunkResults);
    if (i + limit < items.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  return results;
}

/**
 * Load known products and cached new listings from LocalStorage
 */
export function loadStoredListingsState(): {
  knownIds: Set<string>;
  listings: CoinbaseNewListing[];
  lastPoll: string | null;
} {
  try {
    const rawKnown = localStorage.getItem(STORAGE_KNOWN_PRODUCTS_KEY);
    const rawListings = localStorage.getItem(STORAGE_NEW_LISTINGS_KEY);
    const lastPoll = localStorage.getItem(STORAGE_LAST_POLL_KEY);

    const knownIds = new Set<string>(rawKnown ? JSON.parse(rawKnown) : []);
    const listings: CoinbaseNewListing[] = rawListings ? JSON.parse(rawListings) : [];

    return { knownIds, listings, lastPoll };
  } catch {
    return { knownIds: new Set(), listings: [], lastPoll: null };
  }
}

/**
 * Save known products and listings to LocalStorage
 */
export function saveStoredListingsState(knownIds: Set<string>, listings: CoinbaseNewListing[]): void {
  try {
    localStorage.setItem(STORAGE_KNOWN_PRODUCTS_KEY, JSON.stringify(Array.from(knownIds)));
    localStorage.setItem(STORAGE_NEW_LISTINGS_KEY, JSON.stringify(listings));
    localStorage.setItem(STORAGE_LAST_POLL_KEY, new Date().toISOString());
  } catch {
    /* ignore storage quota errors */
  }
}

/**
 * Seed initial sample listings for first run so user immediately sees rich data
 */
function getInitialSeedListings(products: CoinbaseProduct[]): CoinbaseNewListing[] {
  // Pick active spot USD/USDT products
  const candidates = products.filter(
    (p) =>
      p.status === "online" &&
      !p.trading_disabled &&
      (p.quote_currency === "USD" || p.quote_currency === "USDT"),
  );

  // Take the last 15 products as initial showcase
  const seedSlice = candidates.slice(-16);
  const now = Date.now();

  return seedSlice.map((p, idx) => {
    const fakeHoursAgo = (seedSlice.length - idx) * 3 + 1;
    const detectedAt = new Date(now - fakeHoursAgo * 3600 * 1000).toISOString();
    return {
      id: p.id,
      baseCurrency: p.base_currency,
      quoteCurrency: p.quote_currency,
      displayName: p.display_name || `${p.base_currency}/${p.quote_currency}`,
      status: p.status,
      tradingDisabled: !!p.trading_disabled,
      quoteIncrement: p.quote_increment,
      baseIncrement: p.base_increment,
      detectedAt,
      price: 0,
      open24h: 0,
      high24h: 0,
      low24h: 0,
      volume24h: 0,
      change24h: 0,
      bid: 0,
      ask: 0,
      sparkline: [],
      isNew: true,
    };
  });
}

/**
 * Enriches a product with ticker and 24h stats
 */
async function enrichListingData(listing: CoinbaseNewListing): Promise<CoinbaseNewListing> {
  const [ticker, stats] = await Promise.all([
    fetchCoinbaseTicker(listing.id),
    fetchCoinbaseStats(listing.id),
  ]);

  const price = ticker?.price ? parseFloat(ticker.price) : stats?.last ? parseFloat(stats.last) : 0;
  const open24h = stats?.open ? parseFloat(stats.open) : price;
  const high24h = stats?.high ? parseFloat(stats.high) : price;
  const low24h = stats?.low ? parseFloat(stats.low) : price;
  const volume24h = stats?.volume ? parseFloat(stats.volume) : ticker?.volume ? parseFloat(ticker.volume) : 0;
  const bid = ticker?.bid ? parseFloat(ticker.bid) : price;
  const ask = ticker?.ask ? parseFloat(ticker.ask) : price;

  const change24h = open24h > 0 ? ((price - open24h) / open24h) * 100 : 0;

  // Generate synthetic / interpolated mini sparkline
  const sparkline: number[] = [];
  if (price > 0) {
    const steps = 10;
    const start = open24h > 0 ? open24h : price * 0.98;
    for (let i = 0; i <= steps; i++) {
      const progress = i / steps;
      const noise = (Math.sin(i * 1.5) * (high24h - low24h) * 0.2) || 0;
      sparkline.push(Number((start + (price - start) * progress + noise).toFixed(4)));
    }
  }

  return {
    ...listing,
    price,
    open24h,
    high24h,
    low24h,
    volume24h,
    change24h,
    bid,
    ask,
    sparkline,
  };
}

/**
 * Main function to poll Coinbase Exchange and return up-to-date new listings
 */
export async function pollCoinbaseNewListings(): Promise<{
  listings: CoinbaseNewListing[];
  newlyDetectedCount: number;
}> {
  const { knownIds, listings: currentListings } = loadStoredListingsState();
  const allProducts = await fetchCoinbaseProducts();

  let newlyDetectedCount = 0;
  let updatedListings = [...currentListings];
  let updatedKnownIds = new Set(knownIds);

  if (knownIds.size === 0) {
    // First run initialization: seed with initial listings showcase
    const initialListings = getInitialSeedListings(allProducts);
    allProducts.forEach((p) => updatedKnownIds.add(p.id));
    updatedListings = initialListings;
  } else {
    // Diff against known products
    const diff = detectNewProductDiff(allProducts, knownIds);
    newlyDetectedCount = diff.newProducts.length;
    updatedKnownIds = diff.updatedKnownIds;

    if (newlyDetectedCount > 0) {
      const nowIso = new Date().toISOString();
      const detectedItems: CoinbaseNewListing[] = diff.newProducts.map((p) => ({
        id: p.id,
        baseCurrency: p.base_currency,
        quoteCurrency: p.quote_currency,
        displayName: p.display_name || `${p.base_currency}/${p.quote_currency}`,
        status: p.status,
        tradingDisabled: !!p.trading_disabled,
        quoteIncrement: p.quote_increment,
        baseIncrement: p.base_increment,
        detectedAt: nowIso,
        price: 0,
        open24h: 0,
        high24h: 0,
        low24h: 0,
        volume24h: 0,
        change24h: 0,
        bid: 0,
        ask: 0,
        sparkline: [],
        isNew: true,
      }));

      // Prepend newest listings at the top
      updatedListings = [...detectedItems, ...updatedListings];
      toast.info(
        "✨ New Listing Detected!",
        `Found ${newlyDetectedCount} newly listed pair(s) on Coinbase!`,
      );
    }
  }

  // Enrich top 25 listings with latest ticker & stats
  const topListingsToEnrich = updatedListings.slice(0, 30);
  const enrichedTop = await batchThrottled(topListingsToEnrich, 5, enrichListingData);

  const finalMap = new Map(updatedListings.map((item) => [item.id, item]));
  enrichedTop.forEach((item) => finalMap.set(item.id, item));

  const sortedListings = Array.from(finalMap.values()).sort(
    (a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime(),
  );

  saveStoredListingsState(updatedKnownIds, sortedListings);

  return {
    listings: sortedListings,
    newlyDetectedCount,
  };
}

/**
 * Execute direct paper trade on any Coinbase listing
 */
export async function executePaperTradeOnListing(params: {
  listing: CoinbaseNewListing;
  side: "BUY" | "SELL";
  quantity: number;
  orderPrice?: number;
  takeProfit?: number;
  stopLoss?: number;
}): Promise<{ success: boolean; orderId?: string }> {
  const { listing, side, quantity, orderPrice, takeProfit, stopLoss } = params;
  const store = useTradingStore.getState();
  const accountId = store.activeAccountId || "demo-account";

  const price = orderPrice && orderPrice > 0 ? orderPrice : listing.price || 1;

  // Register symbol in trading store if not present
  const existingSymbol = store.symbols.find((s) => s.name === listing.id);
  if (!existingSymbol) {
    const newSymbolObj = {
      name: listing.id,
      displayName: listing.displayName,
      assetClass: "CRYPTO",
      category: "Crypto",
      baseCurrency: listing.baseCurrency,
      quoteCurrency: listing.quoteCurrency,
      tickSize: parseFloat(listing.quoteIncrement) || 0.01,
      pipSize: parseFloat(listing.quoteIncrement) || 0.01,
      contractSize: 1,
      minLot: parseFloat(listing.baseIncrement) || 0.001,
      maxLot: 1000000,
      lotStep: parseFloat(listing.baseIncrement) || 0.001,
      marginPercent: 1,
      commission: 0,
      isActive: true,
    };
    useTradingStore.setState((s) => ({
      symbols: [newSymbolObj, ...s.symbols],
    }));
  }

  // Update engine mark price
  mark(listing.id, price);

  // Update tick in trading store
  store.updateTick(
    listing.id,
    listing.bid || price * 0.9995,
    listing.ask || price * 1.0005,
    Date.now(),
  );

  // Execute order in paper engine
  const order = placeOrder({
    accountId,
    symbol: listing.id,
    side,
    type: "MARKET",
    quantity,
    price,
    takeProfit,
    stopLoss,
  });

  toast.success(
    "Paper Trade Executed!",
    `${side} ${quantity} ${listing.baseCurrency} @ $${price.toFixed(4)}`,
  );

  return { success: true, orderId: order.id };
}

import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flame,
  LayoutGrid,
  List,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  executePaperTradeOnListing,
  fetchCoinbaseCandles,
  loadStoredListingsState,
  pollCoinbaseNewListings,
  type CoinbaseNewListing,
} from "../services/coinbase-listings.ts";
import { formatCurrency, formatNumber } from "../lib/utils.ts";
import { useTradingStore } from "../services/store.tsx";
import { toast } from "../services/toast.ts";
import type { CandleData } from "../lib/indicators.ts";

export interface NewListingsPageProps {
  onNavigateToTerminal?: (symbolName?: string) => void;
  isDark?: boolean;
}

export function NewListingsPage({
  onNavigateToTerminal,
  isDark = true,
}: NewListingsPageProps) {
  const [listings, setListings] = useState<CoinbaseNewListing[]>(() => {
    return loadStoredListingsState().listings;
  });
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [quoteFilter, setQuoteFilter] = useState<"ALL" | "USD" | "USDT" | "EUR" | "BTC">("ALL");
  const [sortBy, setSortBy] = useState<"newest" | "volume" | "change" | "price">("newest");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [lastPollTime, setLastPollTime] = useState<string | null>(() => {
    return loadStoredListingsState().lastPoll;
  });

  // Active detail modal
  const [selectedCoin, setSelectedCoin] = useState<CoinbaseNewListing | null>(null);
  // Active trade drawer
  const [tradingCoin, setTradingCoin] = useState<CoinbaseNewListing | null>(null);

  const activeAccountId = useTradingStore((s) => s.activeAccountId);
  const account = useTradingStore((s) => s.accounts.find((a) => a.id === activeAccountId));

  // ── Poll Coinbase Products ──
  const handlePoll = useCallback(async () => {
    setLoading(true);
    try {
      const result = await pollCoinbaseNewListings();
      setListings(result.listings);
      setLastPollTime(new Date().toISOString());
    } catch (err: unknown) {
      toast.error(
        "Coinbase Scan Error",
        err instanceof Error ? err.message : "Failed to scan Coinbase products",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load & 5-minute background cron polling
  useEffect(() => {
    if (listings.length === 0) {
      void handlePoll();
    }
    const interval = setInterval(() => {
      void handlePoll();
    }, 5 * 60 * 1000); // Poll every 5 minutes

    return () => clearInterval(interval);
  }, [handlePoll, listings.length]);

  // ── Filter and Sort ──
  const filteredListings = useMemo(() => {
    return listings
      .filter((item) => {
        const matchesSearch =
          item.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.baseCurrency.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.displayName.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesQuote =
          quoteFilter === "ALL" || item.quoteCurrency.toUpperCase() === quoteFilter;

        return matchesSearch && matchesQuote;
      })
      .sort((a, b) => {
        if (sortBy === "newest") {
          return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
        }
        if (sortBy === "volume") {
          return (b.volume24h * b.price) - (a.volume24h * a.price);
        }
        if (sortBy === "change") {
          return b.change24h - a.change24h;
        }
        if (sortBy === "price") {
          return b.price - a.price;
        }
        return 0;
      });
  }, [listings, searchQuery, quoteFilter, sortBy]);

  // Top stats
  const stats = useMemo(() => {
    const total = listings.length;
    const online = listings.filter((l) => l.status === "online").length;
    const gainers = listings.filter((l) => l.change24h > 0).length;
    const topGainer = [...listings].sort((a, b) => b.change24h - a.change24h)[0];

    return { total, online, gainers, topGainer };
  }, [listings]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0d14] text-slate-100 overflow-y-auto font-sans">
      {/* ── Top Header & Hero Banner ── */}
      <div className="border-b border-border/50 bg-[#0d111c] px-4 md:px-8 py-5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Coinbase Live Scanner Active
              </span>
              {lastPollTime && (
                <span className="text-[11px] text-muted-foreground font-mono">
                  Last scanned: {new Date(lastPollTime).toLocaleTimeString()}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-amber-400" />
              Coinbase New Listings
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-0.5">
              Automated real-time detection of newly listed pairs on Coinbase Exchange with instant paper-trading execution.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handlePoll}
              disabled={loading}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-xs shadow-md hover:bg-primary/90 transition-all disabled:opacity-50 active:scale-95 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Scanning Coinbase..." : "Scan / Refresh Now"}
            </button>
          </div>
        </div>

        {/* ── Metrics Cards ── */}
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className="bg-[#131826] border border-border/40 rounded-lg p-3">
            <span className="text-[11px] text-slate-400 font-medium">Monitored New Pairs</span>
            <div className="text-xl font-bold font-mono text-white mt-0.5">{stats.total}</div>
          </div>
          <div className="bg-[#131826] border border-border/40 rounded-lg p-3">
            <span className="text-[11px] text-slate-400 font-medium">Tradable Online</span>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">
              {stats.online} <span className="text-xs text-slate-500 font-normal">/ {stats.total}</span>
            </div>
          </div>
          <div className="bg-[#131826] border border-border/40 rounded-lg p-3">
            <span className="text-[11px] text-slate-400 font-medium">24h Gainers</span>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">{stats.gainers}</div>
          </div>
          <div className="bg-[#131826] border border-border/40 rounded-lg p-3">
            <span className="text-[11px] text-slate-400 font-medium">Top 24h Performer</span>
            <div className="text-base font-bold font-mono text-white mt-0.5 flex items-center justify-between">
              <span>{stats.topGainer ? stats.topGainer.baseCurrency : "--"}</span>
              <span className="text-emerald-400 text-xs">
                {stats.topGainer ? `+${stats.topGainer.change24h.toFixed(2)}%` : "--"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filter Bar & Search ── */}
      <div className="max-w-7xl mx-auto w-full px-4 md:px-8 py-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[#0f1422] p-2.5 rounded-xl border border-border/40">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by coin name or symbol (e.g. DRIFT, RENDER, USD)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#161c2e] border border-border/40 rounded-lg pl-9 pr-4 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary/80"
            />
          </div>

          {/* Quote Currency Filter */}
          <div className="flex items-center gap-1 shrink-0 overflow-x-auto">
            {(["ALL", "USD", "USDT", "EUR", "BTC"] as const).map((q) => (
              <button
                key={q}
                onClick={() => setQuoteFilter(q)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  quoteFilter === q
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-[#161c2e] text-slate-400 hover:text-white"
                }`}
              >
                {q}
              </button>
            ))}
          </div>

          {/* Sort & View Mode */}
          <div className="flex items-center gap-2 shrink-0 border-t md:border-t-0 md:border-l border-border/40 pt-2 md:pt-0 md:pl-3">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="bg-[#161c2e] border border-border/40 rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none"
            >
              <option value="newest">🕒 Newest Detected</option>
              <option value="volume">📊 24h Volume</option>
              <option value="change">🔥 24h Change %</option>
              <option value="price">💵 Price</option>
            </select>

            <div className="flex items-center bg-[#161c2e] rounded-lg p-0.5 border border-border/40">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1 rounded ${viewMode === "grid" ? "bg-primary text-white" : "text-slate-400"}`}
                title="Grid View"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`p-1 rounded ${viewMode === "table" ? "bg-primary text-white" : "text-slate-400"}`}
                title="Table View"
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Content: Listings Grid or Table ── */}
        {filteredListings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Sparkles className="h-12 w-12 text-slate-600 mb-3 animate-pulse" />
            <h3 className="text-base font-semibold text-slate-300">No listings match your search</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Click &quot;Scan / Refresh Now&quot; to fetch the latest Coinbase products or clear your search filters.
            </p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {filteredListings.map((item) => (
              <ListingCard
                key={item.id}
                listing={item}
                onSelectDetails={() => setSelectedCoin(item)}
                onTrade={() => setTradingCoin(item)}
              />
            ))}
          </div>
        ) : (
          <div className="bg-[#0f1422] border border-border/40 rounded-xl mt-4 overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#141a2b] text-slate-400 border-b border-border/50 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Asset / Pair</th>
                    <th className="py-3 px-4">Detected</th>
                    <th className="py-3 px-4">Price</th>
                    <th className="py-3 px-4">24h Change</th>
                    <th className="py-3 px-4">24h High / Low</th>
                    <th className="py-3 px-4">24h Volume</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {filteredListings.map((item) => (
                    <tr key={item.id} className="hover:bg-[#151c30] transition-colors">
                      <td className="py-3 px-4 font-sans font-semibold text-white">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-[10px] font-bold text-white uppercase">
                            {item.baseCurrency.slice(0, 3)}
                          </div>
                          <div>
                            <div>{item.displayName}</div>
                            <span className="text-[10px] text-slate-500 font-normal font-mono">{item.id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        {formatTimeAgo(item.detectedAt)}
                      </td>
                      <td className="py-3 px-4 font-bold text-white">
                        ${item.price > 0 ? formatPricePrecise(item.price) : "--"}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded font-bold ${
                            item.change24h >= 0
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-rose-500/10 text-rose-400"
                          }`}
                        >
                          {item.change24h >= 0 ? "+" : ""}
                          {item.change24h.toFixed(2)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        ${formatPricePrecise(item.high24h)} / ${formatPricePrecise(item.low24h)}
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {item.volume24h > 0 ? `$${(item.volume24h * item.price).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "--"}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedCoin(item)}
                            className="px-2.5 py-1 rounded bg-[#1f2740] hover:bg-[#283353] text-slate-200 text-xs font-sans transition-colors cursor-pointer"
                          >
                            Details
                          </button>
                          <button
                            onClick={() => setTradingCoin(item)}
                            className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-sans font-semibold transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <Zap className="h-3 w-3" />
                            Trade
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Detail Modal / Candlestick Chart ── */}
      {selectedCoin && (
        <CoinDetailModal
          listing={selectedCoin}
          onClose={() => setSelectedCoin(null)}
          onTrade={() => {
            const c = selectedCoin;
            setSelectedCoin(null);
            setTradingCoin(c);
          }}
          onNavigateToTerminal={onNavigateToTerminal}
        />
      )}

      {/* ── Direct Paper Trading Ticket Drawer ── */}
      {tradingCoin && (
        <DirectPaperTradeDrawer
          listing={tradingCoin}
          accountBalance={account?.freeMargin ?? account?.balance ?? 100000}
          onClose={() => setTradingCoin(null)}
          onNavigateToTerminal={onNavigateToTerminal}
        />
      )}
    </div>
  );
}

// ── Card Component for Grid View ──
function ListingCard({
  listing,
  onSelectDetails,
  onTrade,
}: {
  listing: CoinbaseNewListing;
  onSelectDetails: () => void;
  onTrade: () => void;
}) {
  const isUp = listing.change24h >= 0;
  return (
    <div className="bg-[#0f1422] border border-border/40 hover:border-primary/50 transition-all rounded-xl p-4 flex flex-col justify-between shadow-md group">
      <div>
        {/* Header: Asset & Badge */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-xs text-white uppercase shadow-inner">
              {listing.baseCurrency.slice(0, 3)}
            </div>
            <div>
              <div className="font-bold text-sm text-white group-hover:text-primary transition-colors flex items-center gap-1.5">
                {listing.displayName}
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Online" />
              </div>
              <span className="text-[11px] text-slate-500 font-mono">{listing.id}</span>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-400/10 text-amber-300 border border-amber-400/20">
            <Sparkles className="h-2.5 w-2.5" />
            NEW
          </span>
        </div>

        {/* Price & 24h Change */}
        <div className="flex items-baseline justify-between mb-3 bg-[#141a2c] p-2.5 rounded-lg border border-border/30">
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Live Price</span>
            <div className="text-lg font-bold font-mono text-white">
              ${listing.price > 0 ? formatPricePrecise(listing.price) : "--"}
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">24h Change</span>
            <span
              className={`inline-flex items-center gap-0.5 text-xs font-bold font-mono ${
                isUp ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {isUp ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              {isUp ? "+" : ""}
              {listing.change24h.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Mini Stats Row */}
        <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-slate-400 mb-3">
          <div>
            <span className="text-slate-500 block">24h High</span>
            <span className="text-slate-200 font-medium">${formatPricePrecise(listing.high24h)}</span>
          </div>
          <div>
            <span className="text-slate-500 block">24h Low</span>
            <span className="text-slate-200 font-medium">${formatPricePrecise(listing.low24h)}</span>
          </div>
          <div>
            <span className="text-slate-500 block">24h Volume</span>
            <span className="text-slate-200 font-medium">
              {listing.volume24h > 0 ? `$${(listing.volume24h * listing.price).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "--"}
            </span>
          </div>
        </div>

        {/* Mini Sparkline Visualization */}
        {listing.sparkline.length > 0 && (
          <div className="h-10 w-full mb-3">
            <MiniSparkline data={listing.sparkline} isUp={isUp} />
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-border/30">
        <button
          onClick={onSelectDetails}
          className="flex-1 py-1.5 rounded-lg bg-[#192138] hover:bg-[#222d4c] text-xs font-medium text-slate-200 transition-colors text-center cursor-pointer flex items-center justify-center gap-1.5"
        >
          <BarChart2 className="h-3.5 w-3.5" />
          Chart & Stats
        </button>
        <button
          onClick={onTrade}
          className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition-all text-center cursor-pointer flex items-center justify-center gap-1.5 shadow-md active:scale-95"
        >
          <Zap className="h-3.5 w-3.5" />
          Paper Trade
        </button>
      </div>
    </div>
  );
}

// ── Coin Detail & Historical Candlestick Chart Modal ──
function CoinDetailModal({
  listing,
  onClose,
  onTrade,
  onNavigateToTerminal,
}: {
  listing: CoinbaseNewListing;
  onClose: () => void;
  onTrade: () => void;
  onNavigateToTerminal?: (symbolName: string) => void;
}) {
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [granularity, setGranularity] = useState<number>(300); // 5m
  const [loadingCandles, setLoadingCandles] = useState(true);

  useEffect(() => {
    let active = true;
    setLoadingCandles(true);
    fetchCoinbaseCandles(listing.id, granularity)
      .then((data) => {
        if (active) setCandles(data);
      })
      .finally(() => {
        if (active) setLoadingCandles(false);
      });
    return () => {
      active = false;
    };
  }, [listing.id, granularity]);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0f1422] border border-border rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-[#141a2b]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-sm text-white uppercase">
              {listing.baseCurrency.slice(0, 3)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">{listing.displayName}</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {listing.status.toUpperCase()}
                </span>
              </div>
              <span className="text-xs text-slate-400 font-mono">Product ID: {listing.id}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onNavigateToTerminal?.(listing.id);
              }}
              className="px-3 py-1.5 rounded-lg bg-[#1e2740] hover:bg-[#2a3658] text-xs font-semibold text-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
            >
              Open in Terminal
              <ExternalLink className="h-3 w-3" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Key Metric Overview */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-[#141a2b] p-3 rounded-xl border border-border/40">
              <span className="text-[11px] text-slate-400 block">Current Price</span>
              <div className="text-lg font-bold font-mono text-white">
                ${listing.price > 0 ? formatPricePrecise(listing.price) : "--"}
              </div>
            </div>
            <div className="bg-[#141a2b] p-3 rounded-xl border border-border/40">
              <span className="text-[11px] text-slate-400 block">24h Change</span>
              <div
                className={`text-lg font-bold font-mono ${
                  listing.change24h >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {listing.change24h >= 0 ? "+" : ""}
                {listing.change24h.toFixed(2)}%
              </div>
            </div>
            <div className="bg-[#141a2b] p-3 rounded-xl border border-border/40">
              <span className="text-[11px] text-slate-400 block">24h High</span>
              <div className="text-lg font-bold font-mono text-slate-200">
                ${formatPricePrecise(listing.high24h)}
              </div>
            </div>
            <div className="bg-[#141a2b] p-3 rounded-xl border border-border/40">
              <span className="text-[11px] text-slate-400 block">24h Low</span>
              <div className="text-lg font-bold font-mono text-slate-200">
                ${formatPricePrecise(listing.low24h)}
              </div>
            </div>
            <div className="bg-[#141a2b] p-3 rounded-xl border border-border/40 col-span-2 md:col-span-1">
              <span className="text-[11px] text-slate-400 block">24h Volume</span>
              <div className="text-lg font-bold font-mono text-slate-200">
                {listing.volume24h > 0
                  ? `$${(listing.volume24h * listing.price).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                  : "--"}
              </div>
            </div>
          </div>

          {/* Interactive Chart Container */}
          <div className="bg-[#141a2b] p-4 rounded-xl border border-border/40">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <BarChart2 className="h-4 w-4 text-primary" />
                Coinbase Historical OHLCV Feed
              </span>

              {/* Granularity selector */}
              <div className="flex items-center gap-1 bg-[#0f1422] p-0.5 rounded-lg border border-border/40 text-[11px] font-mono">
                {[
                  { label: "1m", sec: 60 },
                  { label: "5m", sec: 300 },
                  { label: "15m", sec: 900 },
                  { label: "1h", sec: 3600 },
                  { label: "1d", sec: 86400 },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => setGranularity(item.sec)}
                    className={`px-2 py-0.5 rounded transition-all ${
                      granularity === item.sec ? "bg-primary text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {loadingCandles ? (
              <div className="h-64 flex items-center justify-center text-slate-500 text-xs font-mono">
                <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                Fetching Coinbase candle stream...
              </div>
            ) : candles.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-slate-500 text-xs">
                No historical candle bars returned for this granularity
              </div>
            ) : (
              <SimpleCandleCanvas candles={candles} height={260} />
            )}
          </div>

          {/* Market Specs & Listing Details */}
          <div className="bg-[#141a2b] p-4 rounded-xl border border-border/40">
            <h4 className="text-xs font-semibold text-slate-300 mb-3">Coinbase Exchange Specifications</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
              <div>
                <span className="text-slate-500 block text-[10px]">Base Currency</span>
                <span className="text-white font-bold">{listing.baseCurrency}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Quote Currency</span>
                <span className="text-white font-bold">{listing.quoteCurrency}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Quote Increment</span>
                <span className="text-white">{listing.quoteIncrement || "0.01"}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Base Increment</span>
                <span className="text-white">{listing.baseIncrement || "0.001"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-[#141a2b] flex items-center justify-between">
          <span className="text-xs text-slate-400 font-mono">
            Detected: {new Date(listing.detectedAt).toLocaleString()}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={onTrade}
              className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Zap className="h-4 w-4" />
              Paper Trade Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Direct Paper Trade Drawer / Ticket ──
function DirectPaperTradeDrawer({
  listing,
  accountBalance,
  onClose,
  onNavigateToTerminal,
}: {
  listing: CoinbaseNewListing;
  accountBalance: number;
  onClose: () => void;
  onNavigateToTerminal?: (symbolName: string) => void;
}) {
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [quantity, setQuantity] = useState<number>(10);
  const [takeProfit, setTakeProfit] = useState<string>("");
  const [stopLoss, setStopLoss] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const price = listing.price > 0 ? listing.price : 1;
  const estimatedCost = price * quantity;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quantity <= 0) {
      toast.warning("Invalid Size", "Quantity must be greater than 0");
      return;
    }

    setSubmitting(true);
    try {
      const tp = takeProfit ? parseFloat(takeProfit) : undefined;
      const sl = stopLoss ? parseFloat(stopLoss) : undefined;

      await executePaperTradeOnListing({
        listing,
        side,
        quantity,
        orderPrice: price,
        takeProfit: tp,
        stopLoss: sl,
      });

      onClose();
    } catch (err: unknown) {
      toast.error("Trade Failed", err instanceof Error ? err.message : "Execution failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0f1422] border border-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-[#141a2b]">
          <div className="flex items-center gap-2.5">
            <Zap className="h-5 w-5 text-emerald-400" />
            <div>
              <h3 className="font-bold text-white text-base">Paper Trade {listing.displayName}</h3>
              <span className="text-xs text-slate-400 font-mono">Live Price: ${formatPricePrecise(price)}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 font-sans text-xs">
          {/* Side Selector */}
          <div className="grid grid-cols-2 gap-2 bg-[#141a2b] p-1 rounded-xl border border-border/40">
            <button
              type="button"
              onClick={() => setSide("BUY")}
              className={`py-2 rounded-lg font-bold text-xs transition-all ${
                side === "BUY" ? "bg-emerald-600 text-white shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              Buy / Long
            </button>
            <button
              type="button"
              onClick={() => setSide("SELL")}
              className={`py-2 rounded-lg font-bold text-xs transition-all ${
                side === "SELL" ? "bg-rose-600 text-white shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              Sell / Short
            </button>
          </div>

          {/* Quantity Input */}
          <div>
            <label className="block text-slate-400 font-medium mb-1">
              Quantity ({listing.baseCurrency})
            </label>
            <input
              type="number"
              step="any"
              min="0.0001"
              value={quantity}
              onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
              className="w-full bg-[#141a2b] border border-border/50 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-primary"
            />
            {/* Quick presets */}
            <div className="flex items-center gap-1.5 mt-2">
              {[10, 50, 100, 500, 1000].map((val) => (
                <button
                  type="button"
                  key={val}
                  onClick={() => setQuantity(val)}
                  className="flex-1 py-1 rounded bg-[#182035] hover:bg-[#232d4b] text-[11px] font-mono text-slate-300"
                >
                  {val}
                </button>
              ))}
            </div>
          </div>

          {/* TP & SL Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-medium mb-1">Take Profit (TP)</label>
              <input
                type="number"
                step="any"
                placeholder="Optional"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                className="w-full bg-[#141a2b] border border-border/50 rounded-lg px-3 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-medium mb-1">Stop Loss (SL)</label>
              <input
                type="number"
                step="any"
                placeholder="Optional"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                className="w-full bg-[#141a2b] border border-border/50 rounded-lg px-3 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          {/* Trade Summary */}
          <div className="bg-[#141a2b] p-3 rounded-xl border border-border/40 font-mono space-y-1 text-[11px]">
            <div className="flex justify-between text-slate-400">
              <span>Estimated Cost:</span>
              <span className="text-white font-bold">${estimatedCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Paper Margin Available:</span>
              <span className="text-emerald-400 font-bold">${accountBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className={`w-full py-2.5 rounded-xl font-bold text-sm text-white shadow-lg transition-all cursor-pointer ${
              side === "BUY" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-rose-600 hover:bg-rose-500"
            }`}
          >
            {submitting ? "Placing Order..." : `Execute ${side} Order`}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Simple Canvas Candlestick Renderer for Modal ──
function SimpleCandleCanvas({ candles, height }: { candles: CandleData[]; height: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || candles.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.parentElement?.clientWidth || 800;
    canvas.width = width * 2; // HiDPI
    canvas.height = height * 2;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.scale(2, 2);
    ctx.clearRect(0, 0, width, height);

    const minPrice = Math.min(...candles.map((c) => c.low));
    const maxPrice = Math.max(...candles.map((c) => c.high));
    const priceRange = maxPrice - minPrice || 1;

    const barWidth = Math.max(2, Math.floor(width / candles.length) - 2);

    candles.forEach((c, idx) => {
      const x = idx * (barWidth + 2) + barWidth / 2;
      const isUp = c.close >= c.open;

      const yHigh = height - ((c.high - minPrice) / priceRange) * (height - 30) - 15;
      const yLow = height - ((c.low - minPrice) / priceRange) * (height - 30) - 15;
      const yOpen = height - ((c.open - minPrice) / priceRange) * (height - 30) - 15;
      const yClose = height - ((c.close - minPrice) / priceRange) * (height - 30) - 15;

      const color = isUp ? "#0ecb81" : "#f6465d";

      // Draw wick
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, yHigh);
      ctx.lineTo(x, yLow);
      ctx.stroke();

      // Draw body
      ctx.fillStyle = color;
      const bodyTop = Math.min(yOpen, yClose);
      const bodyHeight = Math.max(2, Math.abs(yOpen - yClose));
      ctx.fillRect(x - barWidth / 2, bodyTop, barWidth, bodyHeight);
    });
  }, [candles, height]);

  return <canvas ref={canvasRef} className="w-full block" />;
}

// ── Mini SVG Sparkline Component ──
function MiniSparkline({ data, isUp }: { data: number[]; isUp: boolean }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 200;
  const height = 36;

  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 6) - 3;
      return `${x},${y}`;
    })
    .join(" ");

  const strokeColor = isUp ? "#0ecb81" : "#f6465d";

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

function formatPricePrecise(price: number): string {
  if (price >= 1000) return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(4);
  if (price >= 0.001) return price.toFixed(6);
  return price.toFixed(8);
}

function formatTimeAgo(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMins = Math.floor(diffMs / (60 * 1000));
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

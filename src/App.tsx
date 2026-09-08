import { useEffect, useState } from "react";
import { BarChart3, Sparkles, TrendingUp, Wallet } from "lucide-react";
import { TradingPage } from "./pages/TradingPage.tsx";
import { NewListingsPage } from "./pages/NewListingsPage.tsx";
import { useAuthStore, useTradingStore } from "./services/store.tsx";

/**
 * OpenCharts entry point with multi-tab navigation:
 * - 📈 Terminal: Complete TradingView-style charting & paper trading terminal
 * - ✨ New Listings: Real-time Coinbase new token discovery & direct paper trading
 */
export function App() {
  const [ready, setReady] = useState(false);
  const [activeTab, setActiveTab] = useState<"trading" | "new-listings">("trading");

  const demoLogin = useAuthStore((s) => s.demoLogin);
  const loadSymbols = useTradingStore((s) => s.loadSymbols);
  const loadAccounts = useTradingStore((s) => s.loadAccounts);
  const setSelectedSymbol = useTradingStore((s) => s.setSelectedSymbol);
  const activeAccountId = useTradingStore((s) => s.activeAccountId);
  const account = useTradingStore((s) => s.accounts.find((a) => a.id === activeAccountId));

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      await demoLogin();
      localStorage.setItem("is_demo", "false");
      useAuthStore.setState({ isDemo: false });
      await Promise.all([loadSymbols(), loadAccounts()]);
      if (!cancelled) setReady(true);
    }
    boot();
    return () => {
      cancelled = true;
    };
  }, [demoLogin, loadSymbols, loadAccounts]);

  const handleNavigateToTerminal = (symbolName?: string) => {
    if (symbolName) {
      setSelectedSymbol(symbolName);
    }
    setActiveTab("trading");
  };

  if (!ready) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0a0a0a] text-neutral-400 font-mono text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span>Loading OpenCharts Terminal…</span>
        </div>
      </div>
    );
  }

  const balance = account?.balance ?? 100_000;
  const equity = account?.equity ?? balance;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background text-foreground select-none">
      {/* ── Top Navigation Bar ── */}
      <header className="h-10 px-3 bg-[#0c101b] border-b border-border/50 flex items-center justify-between shrink-0 z-40">
        {/* Brand & Main Tabs */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 font-bold text-sm text-white tracking-tight cursor-pointer">
            <span className="text-primary font-black text-base">📈</span>
            <span>OpenCharts</span>
          </div>

          <div className="flex items-center gap-1 bg-[#131929] p-0.5 rounded-lg border border-border/40 text-xs">
            <button
              onClick={() => setActiveTab("trading")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                activeTab === "trading"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Terminal
            </button>
            <button
              onClick={() => setActiveTab("new-listings")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                activeTab === "new-listings"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              New Listings
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </button>
          </div>
        </div>

        {/* Paper Account Summary Badge */}
        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="hidden sm:flex items-center gap-2 bg-[#131929] px-2.5 py-1 rounded-lg border border-border/30">
            <Wallet className="h-3 w-3 text-slate-400" />
            <span className="text-slate-400 text-[11px]">Paper Balance:</span>
            <span className="font-bold text-white">${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400 text-[11px]">Equity:</span>
            <span className="font-bold text-emerald-400">${equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      </header>

      {/* ── Main View Switcher ── */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {activeTab === "trading" ? (
          <TradingPage />
        ) : (
          <NewListingsPage onNavigateToTerminal={handleNavigateToTerminal} />
        )}
      </main>
    </div>
  );
}

import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, limit, doc } from 'firebase/firestore';
import { db } from './services/firebase';
import type { PriceBatch, TradeAction, PortfolioState, PortfolioPosition, PriceSymbol } from './types';
import { TradeStatus } from './types';
import Stat from './components/Stat';
import TradeVisualizer from './components/TradeVisualizer';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-EG', { style: 'currency', currency: 'EGP' }).format(value);
};

const formatTimestamp = (timestamp: any): string => {
  if (!timestamp || typeof timestamp.toDate !== 'function') {
    return 'N/A';
  }
  return timestamp.toDate().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const LoadingSkeleton: React.FC = () => (
  <div className="animate-pulse flex space-x-4">
    <div className="flex-1 space-y-4 py-1">
      <div className="h-4 bg-gray-700 rounded w-3/4"></div>
      <div className="space-y-2">
        <div className="h-4 bg-gray-700 rounded"></div>
        <div className="h-4 bg-gray-700 rounded w-5/6"></div>
      </div>
    </div>
  </div>
);


const App: React.FC = () => {
  const [portfolioState, setPortfolioState] = useState<PortfolioState | null>(null);
  const [portfolioPositions, setPortfolioPositions] = useState<PortfolioPosition[]>([]);
  const [latestBatch, setLatestBatch] = useState<PriceBatch | null>(null);
  const [tradeActions, setTradeActions] = useState<TradeAction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribers: (() => void)[] = [];
    const collectionsToWatch = ['portfolioState', 'portfolioPositions', 'prices', 'tradeActions'];
    let loadedCount = 0;

    const checkAllLoaded = () => {
        loadedCount++;
        if (loadedCount >= collectionsToWatch.length) {
            setLoading(false);
        }
    };
    
    // Listener for Portfolio State
    const portfolioStateDocRef = doc(db, 'portfolio', 'state');
    unsubscribers.push(onSnapshot(portfolioStateDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setPortfolioState(docSnap.data() as PortfolioState);
      }
      checkAllLoaded();
    }));

    // Listener for Portfolio Positions
    const positionsCollRef = collection(db, 'portfolio', 'state', 'positions');
    unsubscribers.push(onSnapshot(positionsCollRef, (snapshot) => {
      const positions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PortfolioPosition));
      setPortfolioPositions(positions);
      checkAllLoaded();
    }));

    // Listener for latest Price Batch
    const pricesQuery = query(collection(db, 'prices'), orderBy('createdAt', 'desc'), limit(1));
    unsubscribers.push(onSnapshot(pricesQuery, (snapshot) => {
      if (!snapshot.empty) {
        setLatestBatch(snapshot.docs[0].data() as PriceBatch);
      }
      checkAllLoaded();
    }));

    // Listener for recent Trade Actions
    const actionsQuery = query(collection(db, 'actions'), orderBy('date', 'desc'), limit(20));
    unsubscribers.push(onSnapshot(actionsQuery, (snapshot) => {
      const actions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TradeAction));
      setTradeActions(actions);
      checkAllLoaded();
    }));
    
    return () => unsubscribers.forEach(unsub => unsub());
  }, []);

  const { portfolioValue, dailyPnL, dailyPnLPct } = useMemo(() => {
    if (!portfolioState || portfolioPositions.length === 0) {
      return { portfolioValue: portfolioState?.cash || 0, dailyPnL: 0, dailyPnLPct: 0 };
    }
    const equity = portfolioPositions.reduce((acc, pos) => acc + (pos.shares * pos.marketPrice), 0);
    const portfolioValue = portfolioState.cash + equity;
    const totalPnl = portfolioPositions.reduce((acc, pos) => acc + pos.unrealizedPnL, 0);
    return { portfolioValue, dailyPnL: totalPnl, dailyPnLPct: (totalPnl / (portfolioValue-totalPnl || 1)) * 100 };
  }, [portfolioState, portfolioPositions]);

  const egx30 = useMemo(() => {
      return latestBatch?.symbols.find(s => s.ticker === 'EGX30');
  }, [latestBatch]);

  const availableTickers = useMemo(() => {
      if (!latestBatch) return [];
      // Filter out indices like EGX30 and sort alphabetically
      return latestBatch.symbols
        .map(s => s.ticker)
        .filter(t => !t.startsWith('EGX'))
        .sort();
  }, [latestBatch]);

  const getStatusBadge = (status: TradeStatus) => {
    switch(status) {
        case TradeStatus.FILLED: return "bg-green-500/20 text-green-400";
        case TradeStatus.PENDING: return "bg-yellow-500/20 text-yellow-400";
        case TradeStatus.CANCELLED: return "bg-red-500/20 text-red-400";
        default: return "bg-gray-500/20 text-gray-400";
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-white tracking-tight">EGX Auto-Trader</h1>
          <p className="text-gray-400 mt-1">Live Portfolio & Market Dashboard</p>
        </header>

        <main>
          {/* KPIs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Stat
              label="Portfolio Value"
              value={formatCurrency(portfolioValue)}
              isLoading={loading}
              change={dailyPnLPct}
              changeIsPositive={dailyPnL >= 0}
            />
            <Stat label="Equity" value={formatCurrency(portfolioState?.equity ?? 0)} isLoading={loading} />
            <Stat label="Cash" value={formatCurrency(portfolioState?.cash ?? 0)} isLoading={loading} />
            <Stat 
              label="EGX30 Index" 
              value={egx30?.close.toFixed(2) ?? 'N/A'}
              isLoading={loading || !egx30}
              change={egx30?.changePct}
              changeIsPositive={egx30 ? egx30.changePct >= 0 : undefined}
            />
          </div>

          {/* Trade Visualizer */}
          <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">Trade Visualizer</h2>
            {loading ? (
                <div className="h-96 bg-gray-700 animate-pulse rounded-md"></div>
            ) : (
                <TradeVisualizer availableTickers={availableTickers} />
            )}
          </div>

          {/* Actions Table */}
          <div className="bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
                 <h2 className="text-xl font-semibold text-white">Recent Trading Actions</h2>
                 <div className="flex items-center space-x-2 text-sm text-gray-400">
                    <span className={`h-3 w-3 rounded-full ${latestBatch ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                    <span>Last market update: {formatTimestamp(latestBatch?.createdAt)}</span>
                 </div>
            </div>
            <div className="overflow-x-auto">
                {loading && tradeActions.length === 0 ? (
                    <div className="space-y-4">
                        {[...Array(5)].map((_, i) => <LoadingSkeleton key={i} />)}
                    </div>
                ) : (
                <table className="w-full text-left">
                  <thead className="border-b border-gray-700 text-xs uppercase text-gray-400">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Ticker</th>
                      <th className="py-3 px-4">Action</th>
                      <th className="py-3 px-4 text-right">Shares</th>
                      <th className="py-3 px-4 text-right">Price</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 hidden lg:table-cell">Rationale</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {tradeActions.map((action) => (
                      <tr key={action.id} className="hover:bg-gray-700/50">
                        <td className="py-3 px-4 text-sm text-gray-300">{formatTimestamp(action.date)}</td>
                        <td className="py-3 px-4 font-medium text-white">{action.ticker}</td>
                        <td className={`py-3 px-4 font-semibold ${action.action === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
                          {action.action}
                        </td>
                        <td className="py-3 px-4 text-right">{action.shares}</td>
                        <td className="py-3 px-4 text-right">{formatCurrency(action.price)}</td>
                        <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(action.status)}`}>
                                {action.status}
                            </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-400 hidden lg:table-cell max-w-xs truncate">{action.rationale}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                )}
                 { !loading && tradeActions.length === 0 && (
                    <div className="text-center py-10 text-gray-500">
                        <p>No trading actions have been recorded yet.</p>
                        <p className="text-sm mt-1">Waiting for market data and trading signals...</p>
                    </div>
                )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;

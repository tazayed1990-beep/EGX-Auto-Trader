import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, where, limit } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { PriceBatch, TradeAction } from '../types';
import { TradeActionType } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface TradeVisualizerProps {
  availableTickers: string[];
}

interface ChartDataPoint {
  date: string;
  close: number;
  trade?: TradeAction;
}

// Custom dot component to render trade markers on the chart
const TradeMarker = (props: any) => {
  const { cx, cy, payload } = props;
  if (!payload.trade) {
    return null;
  }

  const isBuy = payload.trade.action === TradeActionType.BUY;
  const fill = isBuy ? '#22c55e' : '#ef4444'; // green-500 or red-500

  // SVG triangle path
  const path = isBuy 
    ? `M ${cx},${cy - 5} L ${cx - 5},${cy + 5} L ${cx + 5},${cy + 5} Z` // Upward triangle for BUY
    : `M ${cx},${cy + 5} L ${cx - 5},${cy - 5} L ${cx + 5},${cy - 5} Z`; // Downward triangle for SELL

  return <path d={path} fill={fill} />;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-gray-700/80 backdrop-blur-sm p-3 rounded-md border border-gray-600 shadow-lg">
        <p className="text-sm text-gray-200">{`Date: ${label}`}</p>
        <p className="text-sm text-white">{`Close: ${data.close.toFixed(2)} EGP`}</p>
        {data.trade && (
          <div className={`mt-2 pt-2 border-t border-gray-500 ${data.trade.action === TradeActionType.BUY ? 'text-green-400' : 'text-red-400'}`}>
            <p className="font-bold">{`${data.trade.action} ${data.trade.shares} @ ${data.trade.price.toFixed(2)}`}</p>
            <p className="text-xs text-gray-300 italic">{data.trade.rationale}</p>
          </div>
        )}
      </div>
    );
  }
  return null;
};


const TradeVisualizer: React.FC<TradeVisualizerProps> = ({ availableTickers }) => {
  const [selectedTicker, setSelectedTicker] = useState<string>('');
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Set the first available ticker as the default
    if (availableTickers.length > 0 && !selectedTicker) {
      setSelectedTicker(availableTickers[0]);
    }
  }, [availableTickers, selectedTicker]);

  useEffect(() => {
    if (!selectedTicker) return;

    setLoading(true);

    // Query for the last 100 price batches
    const pricesQuery = query(
      collection(db, 'prices'),
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    // Query for all actions related to the selected ticker
    const actionsQuery = query(
      collection(db, 'actions'),
      where('ticker', '==', selectedTicker),
      orderBy('date', 'asc')
    );

    const unsubscribePrices = onSnapshot(pricesQuery, (priceSnapshot) => {
      const prices = priceSnapshot.docs.map(doc => doc.data() as PriceBatch);
      
      const unsubscribeActions = onSnapshot(actionsQuery, (actionSnapshot) => {
        const actions = actionSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TradeAction));
        
        // --- Merge Data ---
        const actionsByBatchId = new Map(actions.map(a => [a.batchId, a]));
        
        const mergedData = prices
          .map(batch => {
            const symbolData = batch.symbols.find(s => s.ticker === selectedTicker);
            if (!symbolData) return null;

            return {
              date: new Date(batch.createdAt.seconds * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
              close: symbolData.close,
              trade: actionsByBatchId.get(batch.batchId),
            };
          })
          .filter((d): d is ChartDataPoint => d !== null)
          .reverse(); // reverse to show oldest to newest

        setChartData(mergedData);
        setLoading(false);
      });

      // Return cleanup function for the nested subscription
      return () => unsubscribeActions();
    });

    // Return cleanup function for the outer subscription
    return () => unsubscribePrices();
  }, [selectedTicker]);

  const handleTickerChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedTicker(event.target.value);
  };

  if (availableTickers.length === 0) {
      return (
          <div className="text-center py-10 text-gray-500">
              <p>No stock data available to visualize.</p>
              <p className="text-sm mt-1">Waiting for the first market data batch...</p>
          </div>
      );
  }

  return (
    <div>
      <div className="mb-4">
        <label htmlFor="ticker-select" className="sr-only">Select Ticker</label>
        <select
          id="ticker-select"
          value={selectedTicker}
          onChange={handleTickerChange}
          className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full sm:w-1/4 p-2.5"
        >
          {availableTickers.map(ticker => (
            <option key={ticker} value={ticker}>{ticker}</option>
          ))}
        </select>
      </div>

      <div style={{ height: '400px' }} className="relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800/50 z-10">
            <p className="text-lg">Loading Chart Data...</p>
          </div>
        )}
        {!loading && chartData.length === 0 && (
             <div className="absolute inset-0 flex items-center justify-center bg-gray-800/50">
                <p className="text-lg text-gray-400">No price history found for {selectedTicker}.</p>
            </div>
        )}
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
            <XAxis dataKey="date" stroke="#a0aec0" fontSize={12} />
            <YAxis stroke="#a0aec0" fontSize={12} domain={['dataMin - 1', 'dataMax + 1']} tickFormatter={(val) => `${val.toFixed(2)}`} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line
              type="monotone"
              dataKey="close"
              stroke="#4299e1" // blue-400
              strokeWidth={2}
              dot={<TradeMarker />}
              activeDot={{ r: 8 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default TradeVisualizer;


import { Timestamp } from 'firebase/firestore';

export interface PriceSymbol {
  ticker: string;
  name: string;
  close: number;
  changePct: number;
  volume: number;
}

export interface PriceBatch {
  batchId: string;
  createdAt: Timestamp;
  symbols: PriceSymbol[];
}

export enum TradeActionType {
  BUY = 'BUY',
  SELL = 'SELL',
}

export enum TradeStatus {
  PENDING = 'PENDING',
  FILLED = 'FILLED',
  CANCELLED = 'CANCELLED',
}

export interface TradeAction {
  id: string;
  batchId: string;
  date: Timestamp;
  ticker: string;
  action: TradeActionType;
  shares: number;
  price: number;
  stopLoss: number;
  takeProfit: number;
  rationale: string;
  status: TradeStatus;
}

export interface PortfolioState {
  cash: number;
  equity: number;
  updatedAt: Timestamp;
  cashBufferPct: number;
}

export interface PortfolioPosition {
  id: string; // Ticker symbol
  ticker: string;
  shares: number;
  avgPrice: number;
  marketPrice: number;
  unrealizedPnL: number;
}

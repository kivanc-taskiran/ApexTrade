import { Market } from './types';

export const MARKETS: Market[] = [
  { symbol: 'BTCUSDT', base: 'BTC', quote: 'USDT', priceDp: 2, qtyDp: 5 },
  { symbol: 'ETHUSDT', base: 'ETH', quote: 'USDT', priceDp: 2, qtyDp: 4 },
  { symbol: 'SOLUSDT', base: 'SOL', quote: 'USDT', priceDp: 2, qtyDp: 3 },
  { symbol: 'BNBUSDT', base: 'BNB', quote: 'USDT', priceDp: 2, qtyDp: 3 },
  { symbol: 'XRPUSDT', base: 'XRP', quote: 'USDT', priceDp: 4, qtyDp: 1 },
];

/** Public market-data endpoints (no API key). Rotated on reconnect for resilience. */
export const WS_ENDPOINTS = [
  'wss://stream.binance.com:9443/stream',
  'wss://data-stream.binance.vision/stream',
];

/** How often buffered socket data is committed to React state (UI batching). */
export const FLUSH_INTERVAL_MS = 200;
export const BOOK_DEPTH = 15;
export const MAX_TRADES = 30;

export const STARTING_CASH = 10_000;
export const FEE_RATE = 0.001; // 0.1% taker fee

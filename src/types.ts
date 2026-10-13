export type Side = 'buy' | 'sell';

export type ConnectionStatus = 'connecting' | 'open' | 'error' | 'closed';

export interface Market {
  symbol: string; // e.g. BTCUSDT
  base: string; // e.g. BTC
  quote: string; // e.g. USDT
  priceDp: number;
  qtyDp: number;
}

/** A single aggregated price level in the order book. `total` is the cumulative quantity up to this level. */
export interface Level {
  price: number;
  qty: number;
  total: number;
}

export interface OrderBook {
  bids: Level[];
  asks: Level[];
}

export interface Ticker {
  last: number;
  changePct: number;
  high: number;
  low: number;
  quoteVolume: number;
}

export interface Trade {
  id: number;
  price: number;
  qty: number;
  time: number;
  /** true => the aggressor was a seller (shown red) */
  isBuyerMaker: boolean;
}

export type OrderType = 'market' | 'limit';

export interface Fill {
  id: string;
  symbol: string;
  side: Side;
  qty: number;
  avgPrice: number;
  fee: number;
  time: number;
}

export interface OpenOrder {
  id: string;
  symbol: string;
  side: Side;
  type: OrderType;
  price: number;
  qty: number;
  time: number;
}

export interface Portfolio {
  cash: number;
  holdings: Record<string, number>;
  fills: Fill[];
  openOrders: OpenOrder[];
}

export type OrderResult =
  | { ok: true; fill?: Fill; openOrder?: OpenOrder; message: string }
  | { ok: false; reason: string };

export type KlineInterval = '1m' | '5m' | '15m' | '1h' | '1d';

export interface Kline {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

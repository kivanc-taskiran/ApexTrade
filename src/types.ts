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

export interface Fill {
  id: string;
  symbol: string;
  side: Side;
  qty: number;
  avgPrice: number;
  fee: number;
  time: number;
}

export interface Portfolio {
  cash: number;
  holdings: Record<string, number>;
  fills: Fill[];
}

export type OrderResult = { ok: true; fill: Fill } | { ok: false; reason: string };

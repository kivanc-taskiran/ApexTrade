import { useEffect, useRef, useState } from 'react';
import { BOOK_DEPTH, FLUSH_INTERVAL_MS, MAX_TRADES } from '../config';
import { BinanceStream } from '../services/BinanceStream';
import { ConnectionStatus, Level, OrderBook, Ticker, Trade } from '../types';

interface Snapshot {
  symbol: string;
  book: OrderBook;
  ticker: Ticker | null;
  trades: Trade[];
}

interface Pending {
  depth?: { bids: [string, string][]; asks: [string, string][] };
  ticker?: any;
  trades: Trade[];
}

const emptySnapshot = (symbol: string): Snapshot => ({
  symbol,
  book: { bids: [], asks: [] },
  ticker: null,
  trades: [],
});

function toLevels(raw: [string, string][]): Level[] {
  let total = 0;
  return raw.slice(0, BOOK_DEPTH).map(([p, q]) => {
    const qty = Number(q);
    total += qty;
    return { price: Number(p), qty, total };
  });
}

/**
 * Subscribes to depth / ticker / trade streams for a symbol.
 *
 * Performance design: socket frames arrive 10–50x per second. Writing each one
 * into React state would re-render the tree constantly and drop frames.
 * Instead, frames are written into a mutable buffer (useRef) and committed
 * to state in a single batch every FLUSH_INTERVAL_MS. Only the latest depth
 * snapshot / ticker is kept; trades are accumulated and prepended.
 */
export function useMarketStream(symbol: string) {
  const [snapshot, setSnapshot] = useState<Snapshot>(() => emptySnapshot(symbol));
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [msgPerSec, setMsgPerSec] = useState(0);

  const pending = useRef<Pending>({ trades: [] });
  const msgCount = useRef(0);

  useEffect(() => {
    const s = symbol.toLowerCase();
    pending.current = { trades: [] };
    msgCount.current = 0;
    setSnapshot(emptySnapshot(symbol));

    const stream = new BinanceStream(
      [`${s}@depth20@100ms`, `${s}@ticker`, `${s}@trade`],
      (name, data) => {
        msgCount.current += 1;
        const buf = pending.current;
        if (name.endsWith('@depth20@100ms')) {
          buf.depth = data;
        } else if (name.endsWith('@ticker')) {
          buf.ticker = data;
        } else if (name.endsWith('@trade')) {
          buf.trades.push({
            id: data.t,
            price: Number(data.p),
            qty: Number(data.q),
            time: data.T,
            isBuyerMaker: data.m,
          });
          if (buf.trades.length > MAX_TRADES) buf.trades.splice(0, buf.trades.length - MAX_TRADES);
        }
      },
      setStatus,
    );
    stream.connect();

    const flushTimer = setInterval(() => {
      const buf = pending.current;
      const depth = buf.depth;
      const tick = buf.ticker;
      const newTrades = buf.trades;
      if (!depth && !tick && newTrades.length === 0) return;
      buf.depth = undefined;
      buf.ticker = undefined;
      buf.trades = [];

      setSnapshot((prev) => {
        if (prev.symbol !== symbol) return prev;
        return {
          symbol,
          // unchanged slices keep their reference so memoized children skip rendering
          book: depth ? { bids: toLevels(depth.bids), asks: toLevels(depth.asks) } : prev.book,
          ticker: tick
            ? {
                last: Number(tick.c),
                changePct: Number(tick.P),
                high: Number(tick.h),
                low: Number(tick.l),
                quoteVolume: Number(tick.q),
              }
            : prev.ticker,
          trades: newTrades.length
            ? [...newTrades.reverse(), ...prev.trades].slice(0, MAX_TRADES)
            : prev.trades,
        };
      });
    }, FLUSH_INTERVAL_MS);

    const rateTimer = setInterval(() => {
      setMsgPerSec(msgCount.current);
      msgCount.current = 0;
    }, 1000);

    return () => {
      clearInterval(flushTimer);
      clearInterval(rateTimer);
      stream.dispose();
    };
  }, [symbol]);

  // On the render right after a symbol switch, never leak the previous market's data.
  const live = snapshot.symbol === symbol ? snapshot : emptySnapshot(symbol);
  return { ...live, status, msgPerSec };
}

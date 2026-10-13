import { useEffect, useRef, useState } from 'react';
import { Kline, KlineInterval, Ticker } from '../types';

export function useKlineStream(symbol: string, ticker: Ticker | null) {
  const [interval, setInterval] = useState<KlineInterval>('1m');
  const [klines, setKlines] = useState<Kline[]>([]);
  const [loading, setLoading] = useState(false);
  const activeSymbol = useRef(symbol);
  const activeInterval = useRef(interval);

  activeSymbol.current = symbol;
  activeInterval.current = interval;

  // Fetch initial klines from Binance REST API on symbol or interval change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=60`)
      .then((res) => res.json())
      .then((raw) => {
        if (cancelled) return;
        if (Array.isArray(raw)) {
          const parsed: Kline[] = raw.map((item) => ({
            time: Number(item[0]),
            open: parseFloat(item[1]),
            high: parseFloat(item[2]),
            low: parseFloat(item[3]),
            close: parseFloat(item[4]),
            volume: parseFloat(item[5]),
          }));
          setKlines(parsed);
        }
      })
      .catch(() => {
        // Fallback: gracefully continue with empty or existing klines
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [symbol, interval]);

  // Update latest candle in real-time with live ticker ticks
  useEffect(() => {
    if (!ticker?.last) return;
    const price = ticker.last;

    setKlines((prev) => {
      if (prev.length === 0) return prev;
      const lastIdx = prev.length - 1;
      const lastKline = prev[lastIdx];

      // Update high, low, close on active candle
      const updated: Kline = {
        ...lastKline,
        high: Math.max(lastKline.high, price),
        low: Math.min(lastKline.low, price),
        close: price,
        volume: lastKline.volume + 0.01,
      };

      const next = [...prev];
      next[lastIdx] = updated;
      return next;
    });
  }, [ticker?.last]);

  return { klines, interval, setInterval, loading };
}

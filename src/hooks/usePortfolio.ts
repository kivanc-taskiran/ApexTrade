import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { FEE_RATE, STARTING_CASH } from '../config';
import { simulateFill } from '../engine/matching';
import { Fill, Market, OrderBook, OrderResult, Portfolio, Side } from '../types';

const STORAGE_KEY = 'apextrade:portfolio:v1';
const MAX_FILLS = 50;

const initialPortfolio = (): Portfolio => ({ cash: STARTING_CASH, holdings: {}, fills: [] });

/** Paper-trading wallet persisted to device storage. */
export function usePortfolio() {
  const [portfolio, setPortfolio] = useState<Portfolio>(initialPortfolio);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setPortfolio(JSON.parse(raw));
      })
      .catch(() => {})
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (hydrated) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(portfolio)).catch(() => {});
  }, [portfolio, hydrated]);

  const placeMarketOrder = useCallback(
    (market: Market, side: Side, qty: number, book: OrderBook): OrderResult => {
      if (!(qty > 0)) return { ok: false, reason: 'Enter a valid quantity' };

      const est = simulateFill(side === 'buy' ? book.asks : book.bids, qty);
      if (!est) return { ok: false, reason: 'Not enough visible liquidity' };

      const fee = est.cost * FEE_RATE;
      const held = portfolio.holdings[market.base] ?? 0;

      if (side === 'buy' && est.cost + fee > portfolio.cash + 1e-9) {
        return { ok: false, reason: `Insufficient ${market.quote} balance` };
      }
      if (side === 'sell' && qty > held + 1e-12) {
        return { ok: false, reason: `Insufficient ${market.base} balance` };
      }

      const fill: Fill = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        symbol: market.symbol,
        side,
        qty,
        avgPrice: est.avgPrice,
        fee,
        time: Date.now(),
      };

      setPortfolio((prev) => {
        const prevHeld = prev.holdings[market.base] ?? 0;
        return {
          cash: side === 'buy' ? prev.cash - est.cost - fee : prev.cash + est.cost - fee,
          holdings: {
            ...prev.holdings,
            [market.base]: Math.max(0, side === 'buy' ? prevHeld + qty : prevHeld - qty),
          },
          fills: [fill, ...prev.fills].slice(0, MAX_FILLS),
        };
      });

      return { ok: true, fill };
    },
    [portfolio],
  );

  const reset = useCallback(() => setPortfolio(initialPortfolio()), []);

  return { portfolio, hydrated, placeMarketOrder, reset };
}

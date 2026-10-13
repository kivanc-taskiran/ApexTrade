import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { FEE_RATE, STARTING_CASH } from '../config';
import { simulateFill } from '../engine/matching';
import { Fill, Market, OpenOrder, OrderBook, OrderResult, Portfolio, Side } from '../types';

const STORAGE_KEY = 'apextrade:portfolio:v2';
const MAX_FILLS = 50;

const initialPortfolio = (): Portfolio => ({
  cash: STARTING_CASH,
  holdings: {},
  fills: [],
  openOrders: [],
});

/** Paper-trading wallet and order matching engine persisted to device storage. */
export function usePortfolio() {
  const [portfolio, setPortfolio] = useState<Portfolio>(initialPortfolio);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw);
          setPortfolio({
            cash: parsed.cash ?? STARTING_CASH,
            holdings: parsed.holdings ?? {},
            fills: parsed.fills ?? [],
            openOrders: parsed.openOrders ?? [],
          });
        }
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
      if (!est) return { ok: false, reason: 'Not enough visible depth to fill order' };

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
          ...prev,
          cash: side === 'buy' ? prev.cash - est.cost - fee : prev.cash + est.cost - fee,
          holdings: {
            ...prev.holdings,
            [market.base]: Math.max(0, side === 'buy' ? prevHeld + qty : prevHeld - qty),
          },
          fills: [fill, ...prev.fills].slice(0, MAX_FILLS),
        };
      });

      return {
        ok: true,
        fill,
        message: `${side === 'buy' ? 'Bought' : 'Sold'} ${qty} ${market.base} @ ${est.avgPrice.toFixed(market.priceDp)}`,
      };
    },
    [portfolio],
  );

  const placeLimitOrder = useCallback(
    (market: Market, side: Side, price: number, qty: number): OrderResult => {
      if (!(qty > 0)) return { ok: false, reason: 'Enter a valid quantity' };
      if (!(price > 0)) return { ok: false, reason: 'Enter a valid limit price' };

      const cost = price * qty;
      const fee = cost * FEE_RATE;
      const held = portfolio.holdings[market.base] ?? 0;

      // Reserve funds / asset for limit order
      if (side === 'buy' && cost + fee > portfolio.cash + 1e-9) {
        return { ok: false, reason: `Insufficient ${market.quote} balance` };
      }
      if (side === 'sell' && qty > held + 1e-12) {
        return { ok: false, reason: `Insufficient ${market.base} balance` };
      }

      const order: OpenOrder = {
        id: `limit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        symbol: market.symbol,
        side,
        type: 'limit',
        price,
        qty,
        time: Date.now(),
      };

      setPortfolio((prev) => {
        const prevHeld = prev.holdings[market.base] ?? 0;
        return {
          ...prev,
          cash: side === 'buy' ? prev.cash - cost - fee : prev.cash,
          holdings: {
            ...prev.holdings,
            [market.base]: side === 'sell' ? Math.max(0, prevHeld - qty) : prevHeld,
          },
          openOrders: [order, ...prev.openOrders],
        };
      });

      return {
        ok: true,
        openOrder: order,
        message: `Limit ${side.toUpperCase()} placed: ${qty} ${market.base} @ ${price}`,
      };
    },
    [portfolio],
  );

  const cancelOrder = useCallback((orderId: string) => {
    setPortfolio((prev) => {
      const target = prev.openOrders.find((o) => o.id === orderId);
      if (!target) return prev;

      const cost = target.price * target.qty;
      const fee = cost * FEE_RATE;
      const base = target.symbol.replace('USDT', '');
      const prevHeld = prev.holdings[base] ?? 0;

      return {
        ...prev,
        cash: target.side === 'buy' ? prev.cash + cost + fee : prev.cash,
        holdings: {
          ...prev.holdings,
          [base]: target.side === 'sell' ? prevHeld + target.qty : prevHeld,
        },
        openOrders: prev.openOrders.filter((o) => o.id !== orderId),
      };
    });
  }, []);

  /** Checks pending limit orders against latest live price tick and executes them */
  const checkLimitOrders = useCallback((symbol: string, currentPrice: number) => {
    if (!currentPrice) return;

    setPortfolio((prev) => {
      const eligible = prev.openOrders.filter((o) => {
        if (o.symbol !== symbol) return false;
        return o.side === 'buy' ? currentPrice <= o.price : currentPrice >= o.price;
      });

      if (eligible.length === 0) return prev;

      let newFills = [...prev.fills];
      let newHoldings = { ...prev.holdings };
      let newCash = prev.cash;
      const remainingOrders = prev.openOrders.filter((o) => !eligible.includes(o));

      for (const order of eligible) {
        const base = order.symbol.replace('USDT', '');
        const cost = order.price * order.qty;
        const fee = cost * FEE_RATE;
        const prevHeld = newHoldings[base] ?? 0;

        if (order.side === 'buy') {
          newHoldings[base] = prevHeld + order.qty;
        } else {
          newCash += cost - fee;
        }

        newFills.unshift({
          id: `fill-${order.id}`,
          symbol: order.symbol,
          side: order.side,
          qty: order.qty,
          avgPrice: order.price,
          fee,
          time: Date.now(),
        });
      }

      return {
        ...prev,
        cash: newCash,
        holdings: newHoldings,
        fills: newFills.slice(0, MAX_FILLS),
        openOrders: remainingOrders,
      };
    });
  }, []);

  const reset = useCallback(() => setPortfolio(initialPortfolio()), []);

  return { portfolio, hydrated, placeMarketOrder, placeLimitOrder, cancelOrder, checkLimitOrders, reset };
}

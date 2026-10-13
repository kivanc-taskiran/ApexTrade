import { Level } from '../types';

export interface FillEstimate {
  avgPrice: number;
  cost: number; // quote amount before fees
  worstPrice: number;
  slippagePct: number; // avg price vs. best price
}

/**
 * Simulates a market order by walking the visible book level by level,
 * so large orders realistically pay slippage instead of filling at the top price.
 * Returns null if the visible depth cannot fill the full quantity.
 */
export function simulateFill(levels: Level[], qty: number): FillEstimate | null {
  if (!(qty > 0) || levels.length === 0) return null;

  let remaining = qty;
  let cost = 0;
  let worstPrice = levels[0].price;

  for (const level of levels) {
    const take = Math.min(remaining, level.qty);
    cost += take * level.price;
    remaining -= take;
    worstPrice = level.price;
    if (remaining <= 1e-12) break;
  }

  if (remaining > 1e-12) return null;

  const avgPrice = cost / qty;
  const best = levels[0].price;
  return { avgPrice, cost, worstPrice, slippagePct: (Math.abs(avgPrice - best) / best) * 100 };
}

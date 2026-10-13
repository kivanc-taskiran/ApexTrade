import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateFill } from '../src/engine/matching.ts';
import { fmt, fmtCompact, fmtTime, floorTo } from '../src/utils/format.ts';
import { Level } from '../src/types.ts';

test('format utils', () => {
  assert.equal(fmt(83558.123, 2), '83,558.12');
  assert.equal(fmt(0.123456, 4), '0.1235');
  assert.equal(fmt(NaN, 2), '-');

  assert.equal(fmtCompact(1_500_000_000), '1.50B');
  assert.equal(fmtCompact(24_500_000), '24.50M');
  assert.equal(fmtCompact(3_250), '3.25K');
  assert.equal(fmtCompact(450), '450.00');

  assert.equal(floorTo(1.23456, 3), 1.234);
  assert.equal(floorTo(100.999, 2), 100.99);

  // Time format check
  const ts = new Date('2026-10-13T14:30:00Z').getTime();
  assert.match(fmtTime(ts), /\d{2}:\d{2}:\d{2}/);
});

test('matching engine: simulateFill', () => {
  const levels: Level[] = [
    { price: 100, qty: 1, total: 1 },
    { price: 105, qty: 2, total: 3 },
    { price: 110, qty: 3, total: 6 },
  ];

  // Zero or negative quantity
  assert.equal(simulateFill(levels, 0), null);
  assert.equal(simulateFill(levels, -1), null);

  // Empty book
  assert.equal(simulateFill([], 1), null);

  // Single-level fill (no slippage)
  const single = simulateFill(levels, 0.5);
  assert.ok(single);
  assert.equal(single.avgPrice, 100);
  assert.equal(single.cost, 50);
  assert.equal(single.worstPrice, 100);
  assert.equal(single.slippagePct, 0);

  // Multi-level fill with realistic slippage
  // Buying 2 units: takes 1 @ 100 ($100) + 1 @ 105 ($105) = $205 total cost, avg 102.5
  const multi = simulateFill(levels, 2);
  assert.ok(multi);
  assert.equal(multi.cost, 205);
  assert.equal(multi.avgPrice, 102.5);
  assert.equal(multi.worstPrice, 105);
  assert.equal(multi.slippagePct, 2.5); // (102.5 - 100) / 100 = 2.5%

  // Full book consumption
  const full = simulateFill(levels, 6);
  assert.ok(full);
  assert.equal(full.worstPrice, 110);
  assert.equal(full.cost, 100 * 1 + 105 * 2 + 110 * 3); // 100 + 210 + 330 = 640

  // Insufficient liquidity returns null
  assert.equal(simulateFill(levels, 7), null);
});

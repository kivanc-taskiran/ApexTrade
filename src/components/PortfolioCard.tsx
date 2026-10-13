import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MARKETS, STARTING_CASH } from '../config';
import { colors, mono } from '../theme';
import { OpenOrder, Portfolio } from '../types';
import { fmt, fmtTime } from '../utils/format';

interface Props {
  portfolio: Portfolio;
  prices: Record<string, number>;
  onReset: () => void;
  onCancelOrder: (orderId: string) => void;
}

type Tab = 'fills' | 'orders';

export function PortfolioCard({ portfolio, prices, onReset, onCancelOrder }: Props) {
  const [tab, setTab] = useState<Tab>('fills');

  const holdingsValue = Object.entries(portfolio.holdings).reduce((sum, [asset, qty]) => {
    let price = prices[asset];
    if (price === undefined) {
      const lastFill = portfolio.fills.find((f) => f.symbol.startsWith(asset));
      price = lastFill?.avgPrice ?? 0;
    }
    return sum + qty * price;
  }, 0);

  const equity = portfolio.cash + holdingsValue;
  const pnl = equity - STARTING_CASH;
  const pnlColor = pnl >= 0 ? colors.green : colors.red;
  const dpFor = (symbol: string) => MARKETS.find((m) => m.symbol === symbol)?.qtyDp ?? 4;
  const openCount = portfolio.openOrders?.length ?? 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Paper Portfolio</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Simulated</Text>
          </View>
        </View>
        <Pressable onPress={onReset} style={styles.resetBtn}>
          <Text style={styles.reset}>Reset Wallet</Text>
        </Pressable>
      </View>

      <Text style={[styles.equity, mono]}>{fmt(equity, 2)} USDT</Text>
      <Text style={[mono, { color: pnlColor, fontSize: 13, fontWeight: '700' }]}>
        Unrealized PnL: {pnl >= 0 ? '+' : ''}
        {fmt(pnl, 2)} USDT ({((pnl / STARTING_CASH) * 100).toFixed(2)}%)
      </Text>

      {/* Asset Balances Grid */}
      <View style={styles.balances}>
        <Balance asset="USDT" qty={fmt(portfolio.cash, 2)} />
        {MARKETS.map((m) => (
          <Balance key={m.base} asset={m.base} qty={fmt(portfolio.holdings[m.base] ?? 0, m.qtyDp)} />
        ))}
      </View>

      {/* History & Open Orders Tab Switcher */}
      <View style={styles.tabsHeader}>
        <Pressable onPress={() => setTab('fills')} style={[styles.tabBtn, tab === 'fills' && styles.tabBtnActive]}>
          <Text style={[styles.tabLabel, tab === 'fills' && styles.tabLabelActive]}>
            Recent Fills ({portfolio.fills.length})
          </Text>
        </Pressable>
        <Pressable onPress={() => setTab('orders')} style={[styles.tabBtn, tab === 'orders' && styles.tabBtnActive]}>
          <Text style={[styles.tabLabel, tab === 'orders' && styles.tabLabelActive]}>
            Open Orders ({openCount})
          </Text>
        </Pressable>
      </View>

      {tab === 'fills' ? (
        <View style={styles.list}>
          {portfolio.fills.length === 0 ? (
            <Text style={styles.emptyText}>No executions yet. Place an order above.</Text>
          ) : (
            portfolio.fills.slice(0, 6).map((f) => (
              <View key={f.id} style={styles.fillRow}>
                <View style={styles.fillLeft}>
                  <Text style={[styles.sideBadge, { color: f.side === 'buy' ? colors.green : colors.red }]}>
                    {f.side.toUpperCase()}
                  </Text>
                  <Text style={[styles.fillText, mono]}>
                    {fmt(f.qty, dpFor(f.symbol))} {f.symbol.replace('USDT', '')}
                  </Text>
                </View>
                <Text style={[styles.fillText, mono]}>@ {fmt(f.avgPrice, 2)}</Text>
                <Text style={[styles.fillMuted, mono]}>{fmtTime(f.time)}</Text>
              </View>
            ))
          )}
        </View>
      ) : (
        <View style={styles.list}>
          {openCount === 0 ? (
            <Text style={styles.emptyText}>No open limit orders. Orders execute when market reaches limit price.</Text>
          ) : (
            portfolio.openOrders.map((o) => (
              <View key={o.id} style={styles.fillRow}>
                <View style={styles.fillLeft}>
                  <Text style={[styles.sideBadge, { color: o.side === 'buy' ? colors.green : colors.red }]}>
                    LIMIT {o.side.toUpperCase()}
                  </Text>
                  <Text style={[styles.fillText, mono]}>
                    {fmt(o.qty, dpFor(o.symbol))} {o.symbol.replace('USDT', '')}
                  </Text>
                </View>
                <Text style={[styles.fillText, mono]}>@ {fmt(o.price, 2)}</Text>
                <Pressable onPress={() => onCancelOrder(o.id)} style={styles.cancelBtn}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );
}

function Balance({ asset, qty }: { asset: string; qty: string }) {
  return (
    <View style={styles.balance}>
      <Text style={styles.balanceAsset}>{asset}</Text>
      <Text style={[styles.balanceValue, mono]}>{qty}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 14, gap: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: colors.text, fontWeight: '700', fontSize: 14 },
  badge: {
    backgroundColor: 'rgba(240,185,11,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: { color: colors.accent, fontSize: 10, fontWeight: '700' },
  resetBtn: { paddingVertical: 2, paddingHorizontal: 6 },
  reset: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  equity: { color: colors.text, fontSize: 24, fontWeight: '800' },
  balances: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  balance: {
    backgroundColor: colors.panelAlt,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 6,
    minWidth: '18%',
  },
  balanceAsset: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  balanceValue: { color: colors.text, fontSize: 11, fontWeight: '600', marginTop: 1 },
  tabsHeader: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginTop: 8,
    gap: 12,
  },
  tabBtn: { paddingVertical: 6 },
  tabBtnActive: { borderBottomWidth: 2, borderColor: colors.accent },
  tabLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  tabLabelActive: { color: colors.text },
  list: { marginTop: 6, gap: 5 },
  emptyText: { color: colors.muted, fontSize: 11, textAlign: 'center', paddingVertical: 12 },
  fillRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  fillLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sideBadge: { fontSize: 11, fontWeight: '700' },
  fillText: { color: colors.text, fontSize: 11, fontWeight: '500' },
  fillMuted: { color: colors.muted, fontSize: 11 },
  cancelBtn: {
    backgroundColor: 'rgba(246,70,93,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cancelText: { color: colors.red, fontSize: 10, fontWeight: '700' },
});

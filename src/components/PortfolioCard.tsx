import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MARKETS, STARTING_CASH } from '../config';
import { colors, mono } from '../theme';
import { OpenOrder, Portfolio } from '../types';
import { playSound } from '../utils/audio';
import { fmt, fmtTime } from '../utils/format';

interface Props {
  portfolio: Portfolio;
  prices: Record<string, number>;
  onReset: () => void;
  onCancelOrder: (orderId: string) => void;
  onFaucet?: () => void;
}

type Tab = 'positions' | 'orders' | 'history' | 'stats';

export function PortfolioCard({ portfolio, prices, onReset, onCancelOrder, onFaucet }: Props) {
  const [tab, setTab] = useState<Tab>('positions');

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

  // Trading Statistics
  const totalVolume = portfolio.fills.reduce((sum, f) => sum + f.avgPrice * f.qty, 0);
  const buyFills = portfolio.fills.filter((f) => f.side === 'buy');
  const sellFills = portfolio.fills.filter((f) => f.side === 'sell');

  return (
    <View style={styles.container}>
      {/* Portfolio Header Bar */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Trading Console & Portfolio</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>PAPER ACCOUNT</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          {onFaucet && (
            <Pressable
              onPress={() => {
                playSound('faucet');
                onFaucet();
              }}
              style={styles.faucetBtn}
            >
              <Text style={styles.faucetBtnText}>+10k Faucet</Text>
            </Pressable>
          )}
          <Pressable onPress={onReset} style={styles.resetBtn}>
            <Text style={styles.reset}>Reset</Text>
          </Pressable>
        </View>
      </View>

      {/* Net Worth & PnL Summary Banner */}
      <View style={styles.equityBanner}>
        <View>
          <Text style={styles.equityLabel}>Total Net Equity</Text>
          <Text style={[styles.equity, mono]}>{fmt(equity, 2)} USDT</Text>
        </View>
        <View style={styles.pnlBox}>
          <Text style={styles.equityLabel}>All-Time PnL</Text>
          <Text style={[mono, { color: pnlColor, fontSize: 14, fontWeight: '700' }]}>
            {pnl >= 0 ? '+' : ''}
            {fmt(pnl, 2)} USDT ({((pnl / STARTING_CASH) * 100).toFixed(2)}%)
          </Text>
        </View>
      </View>

      {/* Dock Tabs Header */}
      <View style={styles.tabsHeader}>
        {(['positions', 'orders', 'history', 'stats'] as Tab[]).map((t) => {
          const active = tab === t;
          const label =
            t === 'positions'
              ? 'Positions & Balances'
              : t === 'orders'
              ? `Open Orders (${openCount})`
              : t === 'history'
              ? `Trade History (${portfolio.fills.length})`
              : 'Analytics';
          return (
            <Pressable
              key={t}
              onPress={() => {
                playSound('click');
                setTab(t);
              }}
              style={[styles.tabBtn, active && styles.tabBtnActive]}
            >
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Tab 1: Positions & Balances */}
      {tab === 'positions' && (
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.thCell, { flex: 1.2 }]}>Asset</Text>
            <Text style={[styles.thCell, styles.right]}>Balance</Text>
            <Text style={[styles.thCell, styles.right]}>Price</Text>
            <Text style={[styles.thCell, styles.right]}>Value (USDT)</Text>
          </View>

          {/* USDT Cash Row */}
          <View style={styles.tableRow}>
            <Text style={[styles.tdCell, { flex: 1.2, fontWeight: '700' }]}>USDT</Text>
            <Text style={[styles.tdCell, styles.right, mono]}>{fmt(portfolio.cash, 2)}</Text>
            <Text style={[styles.tdCell, styles.right, mono]}>$1.00</Text>
            <Text style={[styles.tdCell, styles.right, mono, { fontWeight: '700' }]}>
              ${fmt(portfolio.cash, 2)}
            </Text>
          </View>

          {/* Holdings Rows */}
          {MARKETS.map((m) => {
            const qty = portfolio.holdings[m.base] ?? 0;
            const price = prices[m.base] || 0;
            const val = qty * price;
            return (
              <View key={m.base} style={styles.tableRow}>
                <Text style={[styles.tdCell, { flex: 1.2, fontWeight: '700' }]}>{m.base}</Text>
                <Text style={[styles.tdCell, styles.right, mono]}>{fmt(qty, m.qtyDp)}</Text>
                <Text style={[styles.tdCell, styles.right, mono]}>${fmt(price, m.priceDp)}</Text>
                <Text style={[styles.tdCell, styles.right, mono, { fontWeight: '700' }]}>
                  ${fmt(val, 2)}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Tab 2: Open Orders */}
      {tab === 'orders' && (
        <View style={styles.list}>
          {openCount === 0 ? (
            <Text style={styles.emptyText}>
              No active limit orders. Orders will automatically execute when market price hits your limit target.
            </Text>
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
                <Text style={[styles.fillText, mono]}>Target: ${fmt(o.price, 2)}</Text>
                <Pressable
                  onPress={() => {
                    playSound('click');
                    onCancelOrder(o.id);
                  }}
                  style={styles.cancelBtn}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
              </View>
            ))
          )}
        </View>
      )}

      {/* Tab 3: Trade History */}
      {tab === 'history' && (
        <View style={styles.list}>
          {portfolio.fills.length === 0 ? (
            <Text style={styles.emptyText}>No executions logged yet. Place an order to see execution receipts.</Text>
          ) : (
            portfolio.fills.slice(0, 10).map((f) => (
              <View key={f.id} style={styles.fillRow}>
                <View style={styles.fillLeft}>
                  <Text style={[styles.sideBadge, { color: f.side === 'buy' ? colors.green : colors.red }]}>
                    {f.side.toUpperCase()}
                  </Text>
                  <Text style={[styles.fillText, mono]}>
                    {fmt(f.qty, dpFor(f.symbol))} {f.symbol.replace('USDT', '')}
                  </Text>
                </View>
                <Text style={[styles.fillText, mono]}>@ ${fmt(f.avgPrice, 2)}</Text>
                <Text style={[styles.fillMuted, mono]}>${fmt(f.avgPrice * f.qty, 2)}</Text>
                <Text style={[styles.fillMuted, mono]}>{fmtTime(f.time)}</Text>
              </View>
            ))
          )}
        </View>
      )}

      {/* Tab 4: Performance Analytics */}
      {tab === 'stats' && (
        <View style={styles.statsWrap}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Total Executions</Text>
            <Text style={[styles.statBig, mono]}>{portfolio.fills.length}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Total Volume</Text>
            <Text style={[styles.statBig, mono]}>${fmt(totalVolume, 2)}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Buy / Sell Orders</Text>
            <Text style={[styles.statBig, mono]}>
              {buyFills.length} / {sellFills.length}
            </Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Starting Capital</Text>
            <Text style={[styles.statBig, mono]}>${fmt(STARTING_CASH, 2)}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 14, gap: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: colors.text, fontWeight: '700', fontSize: 14 },
  badge: {
    backgroundColor: 'rgba(240,185,11,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: { color: colors.accent, fontSize: 9, fontWeight: '800' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  faucetBtn: {
    backgroundColor: 'rgba(14,203,129,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.green,
  },
  faucetBtnText: { color: colors.green, fontSize: 10, fontWeight: '700' },
  resetBtn: { paddingVertical: 2, paddingHorizontal: 6 },
  reset: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  equityBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.panelAlt,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  equityLabel: { color: colors.muted, fontSize: 11, marginBottom: 2 },
  equity: { color: colors.text, fontSize: 22, fontWeight: '800' },
  pnlBox: { alignItems: 'flex-end' },
  tabsHeader: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: 12,
    flexWrap: 'wrap',
  },
  tabBtn: { paddingVertical: 6 },
  tabBtnActive: { borderBottomWidth: 2, borderColor: colors.accent },
  tabLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  tabLabelActive: { color: colors.text, fontWeight: '700' },
  table: { marginTop: 4 },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  thCell: { flex: 1, color: colors.muted, fontSize: 11 },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  tdCell: { flex: 1, color: colors.text, fontSize: 12 },
  right: { textAlign: 'right' },
  list: { marginTop: 6, gap: 6 },
  emptyText: { color: colors.muted, fontSize: 11, textAlign: 'center', paddingVertical: 14 },
  fillRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
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
  statsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6,
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.panelAlt,
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statLabel: { color: colors.muted, fontSize: 11 },
  statBig: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 4 },
});

import React, { memo, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, mono } from '../theme';
import { Level, Market, OrderBook } from '../types';
import { playSound } from '../utils/audio';
import { fmt } from '../utils/format';

interface RowProps {
  level: Level;
  side: 'bid' | 'ask';
  maxTotal: number;
  priceDp: number;
  qtyDp: number;
  onPress?: (price: number) => void;
}

type BookFilter = 'both' | 'bids' | 'asks';

const BookRow = memo(
  function BookRow({ level, side, maxTotal, priceDp, qtyDp, onPress }: RowProps) {
    const pct = maxTotal > 0 ? Math.min(100, (level.total / maxTotal) * 100) : 0;
    const isBid = side === 'bid';
    return (
      <Pressable
        onPress={() => {
          playSound('click');
          onPress?.(level.price);
        }}
        style={styles.row}
      >
        <View
          style={[
            styles.depthBar,
            { width: `${pct}%`, backgroundColor: isBid ? colors.greenBg : colors.redBg },
          ]}
        />
        <Text style={[styles.cell, styles.left, mono, { color: isBid ? colors.green : colors.red }]}>
          {fmt(level.price, priceDp)}
        </Text>
        <Text style={[styles.cell, styles.right, mono]}>{fmt(level.qty, qtyDp)}</Text>
        <Text style={[styles.cell, styles.right, mono]}>{fmt(level.total, qtyDp)}</Text>
      </Pressable>
    );
  },
  (a, b) =>
    a.level.price === b.level.price &&
    a.level.qty === b.level.qty &&
    a.level.total === b.level.total &&
    a.maxTotal === b.maxTotal &&
    a.side === b.side,
);

interface Props {
  market: Market;
  book: OrderBook;
  onSelectPrice?: (price: number) => void;
}

export const OrderBookView = memo(function OrderBookView({ market, book, onSelectPrice }: Props) {
  const [filter, setFilter] = useState<BookFilter>('both');
  const { bids, asks } = book;
  const asksDesc = useMemo(() => [...asks].reverse(), [asks]);

  if (bids.length === 0 || asks.length === 0) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.muted}>Connecting to Binance depth stream…</Text>
      </View>
    );
  }

  const maxTotal = Math.max(bids[bids.length - 1].total, asks[asks.length - 1].total);
  const bestBid = bids[0].price;
  const bestAsk = asks[0].price;
  const mid = (bestBid + bestAsk) / 2;
  const spread = bestAsk - bestBid;
  const spreadBps = ((spread / mid) * 10000).toFixed(1);

  // Depth Sentiment Ratio Calculation
  const totalBidsQty = bids.reduce((acc, b) => acc + b.qty, 0);
  const totalAsksQty = asks.reduce((acc, a) => acc + a.qty, 0);
  const totalDepth = totalBidsQty + totalAsksQty;
  const bidRatio = totalDepth > 0 ? (totalBidsQty / totalDepth) * 100 : 50;
  const askRatio = 100 - bidRatio;

  const displayAsks = filter === 'bids' ? [] : filter === 'asks' ? asksDesc : asksDesc.slice(asksDesc.length - 8);
  const displayBids = filter === 'asks' ? [] : filter === 'bids' ? bids : bids.slice(0, 8);

  return (
    <View style={styles.container}>
      {/* Top Controls: Filter & Sentiment */}
      <View style={styles.topControlRow}>
        <View style={styles.filterGroup}>
          <Pressable
            onPress={() => setFilter('both')}
            style={[styles.filterBtn, filter === 'both' && styles.filterBtnActive]}
          >
            <Text style={[styles.filterText, filter === 'both' && styles.filterTextActive]}>Both</Text>
          </Pressable>
          <Pressable
            onPress={() => setFilter('bids')}
            style={[styles.filterBtn, filter === 'bids' && styles.filterBtnActive]}
          >
            <Text style={[styles.filterText, { color: colors.green }]}>Bids</Text>
          </Pressable>
          <Pressable
            onPress={() => setFilter('asks')}
            style={[styles.filterBtn, filter === 'asks' && styles.filterBtnActive]}
          >
            <Text style={[styles.filterText, { color: colors.red }]}>Asks</Text>
          </Pressable>
        </View>

        <Text style={[styles.bpsText, mono]}>Spread: {spreadBps} bps</Text>
      </View>

      {/* Depth Pressure Indicator Bar */}
      <View style={styles.pressureWrap}>
        <View style={styles.pressureLabels}>
          <Text style={[styles.pressureText, { color: colors.green }]}>Bids: {bidRatio.toFixed(1)}%</Text>
          <Text style={styles.pressureTitle}>Order Book Depth Ratio</Text>
          <Text style={[styles.pressureText, { color: colors.red }]}>Asks: {askRatio.toFixed(1)}%</Text>
        </View>
        <View style={styles.pressureBarTrack}>
          <View style={[styles.pressureFillBid, { width: `${bidRatio}%` }]} />
          <View style={[styles.pressureFillAsk, { width: `${askRatio}%` }]} />
        </View>
      </View>

      <View style={styles.headerRow}>
        <Text style={[styles.headerCell, styles.left]}>Price ({market.quote})</Text>
        <Text style={[styles.headerCell, styles.right]}>Amount ({market.base})</Text>
        <Text style={[styles.headerCell, styles.right]}>Total</Text>
      </View>

      {/* Asks (Sells) */}
      {displayAsks.map((lvl, i) => (
        <BookRow
          key={`a${i}`}
          level={lvl}
          side="ask"
          maxTotal={maxTotal}
          priceDp={market.priceDp}
          qtyDp={market.qtyDp}
          onPress={onSelectPrice}
        />
      ))}

      {/* Mid Market Spread Bar */}
      <View style={styles.spreadRow}>
        <Text style={[styles.mid, mono]}>{fmt(mid, market.priceDp)}</Text>
        <Text style={[styles.spreadInfo, mono]}>
          Spread: {fmt(spread, market.priceDp)}
        </Text>
      </View>

      {/* Bids (Buys) */}
      {displayBids.map((lvl, i) => (
        <BookRow
          key={`b${i}`}
          level={lvl}
          side="bid"
          maxTotal={maxTotal}
          priceDp={market.priceDp}
          qtyDp={market.qtyDp}
          onPress={onSelectPrice}
        />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingBottom: 4,
  },
  loading: { paddingVertical: 40, alignItems: 'center', gap: 10 },
  muted: { color: colors.muted, fontSize: 12 },
  topControlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  filterGroup: {
    flexDirection: 'row',
    backgroundColor: colors.panelAlt,
    borderRadius: 4,
    padding: 2,
    gap: 4,
  },
  filterBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  filterBtnActive: {
    backgroundColor: colors.panel,
  },
  filterText: {
    fontSize: 10,
    color: colors.muted,
    fontWeight: '600',
  },
  filterTextActive: {
    color: colors.text,
  },
  bpsText: {
    fontSize: 10,
    color: colors.muted,
  },
  pressureWrap: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  pressureLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  pressureTitle: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '600',
  },
  pressureText: {
    fontSize: 11,
    fontWeight: '700',
  },
  pressureBarTrack: {
    height: 4,
    borderRadius: 2,
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  pressureFillBid: {
    height: '100%',
    backgroundColor: colors.green,
  },
  pressureFillAsk: {
    height: '100%',
    backgroundColor: colors.red,
  },
  headerRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 5 },
  headerCell: { flex: 1, color: colors.muted, fontSize: 11 },
  row: { flexDirection: 'row', paddingHorizontal: 12, height: 20, alignItems: 'center' },
  depthBar: { position: 'absolute', right: 0, top: 1, bottom: 1 },
  cell: { flex: 1, color: colors.text, fontSize: 11 },
  left: { textAlign: 'left' },
  right: { textAlign: 'right' },
  spreadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginVertical: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.panelAlt,
  },
  mid: { color: colors.text, fontSize: 15, fontWeight: '700' },
  spreadInfo: { color: colors.muted, fontSize: 11 },
});

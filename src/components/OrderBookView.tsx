import React, { memo, useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, mono } from '../theme';
import { Level, Market, OrderBook } from '../types';
import { fmt } from '../utils/format';

interface RowProps {
  level: Level;
  side: 'bid' | 'ask';
  maxTotal: number;
  priceDp: number;
  qtyDp: number;
  onPress?: (price: number) => void;
}

/** Re-renders only when its own level (or the depth scale) actually changes. */
const BookRow = memo(
  function BookRow({ level, side, maxTotal, priceDp, qtyDp, onPress }: RowProps) {
    const pct = maxTotal > 0 ? Math.min(100, (level.total / maxTotal) * 100) : 0;
    const isBid = side === 'bid';
    return (
      <Pressable onPress={() => onPress?.(level.price)} style={styles.row}>
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

  // Order Book Buy/Sell Pressure Ratio
  const totalBidsQty = bids.reduce((acc, b) => acc + b.qty, 0);
  const totalAsksQty = asks.reduce((acc, a) => acc + a.qty, 0);
  const totalDepth = totalBidsQty + totalAsksQty;
  const bidRatio = totalDepth > 0 ? (totalBidsQty / totalDepth) * 100 : 50;
  const askRatio = 100 - bidRatio;

  return (
    <View>
      {/* Depth Pressure Indicator Bar */}
      <View style={styles.pressureWrap}>
        <View style={styles.pressureLabels}>
          <Text style={[styles.pressureText, { color: colors.green }]}>Bids: {bidRatio.toFixed(1)}%</Text>
          <Text style={styles.pressureTitle}>Order Book Depth Sentiment</Text>
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

      {asksDesc.map((lvl, i) => (
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

      <View style={styles.spreadRow}>
        <Text style={[styles.mid, mono]}>{fmt(mid, market.priceDp)}</Text>
        <Text style={[styles.muted, mono]}>
          Spread {fmt(spread, market.priceDp)} ({((spread / mid) * 100).toFixed(3)}%)
        </Text>
      </View>

      {bids.map((lvl, i) => (
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
  loading: { paddingVertical: 40, alignItems: 'center', gap: 10 },
  muted: { color: colors.muted, fontSize: 12 },
  pressureWrap: {
    paddingHorizontal: 12,
    paddingTop: 8,
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
  headerRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 6 },
  headerCell: { flex: 1, color: colors.muted, fontSize: 11 },
  row: { flexDirection: 'row', paddingHorizontal: 12, height: 21, alignItems: 'center' },
  depthBar: { position: 'absolute', right: 0, top: 1, bottom: 1 },
  cell: { flex: 1, color: colors.text, fontSize: 12 },
  left: { textAlign: 'left' },
  right: { textAlign: 'right' },
  spreadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.panelAlt,
  },
  mid: { color: colors.text, fontSize: 16, fontWeight: '700' },
});

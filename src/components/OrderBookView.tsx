import { memo, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, mono } from '../theme';
import { Level, Market, OrderBook } from '../types';
import { fmt } from '../utils/format';

interface RowProps {
  level: Level;
  side: 'bid' | 'ask';
  maxTotal: number;
  priceDp: number;
  qtyDp: number;
}

/** Re-renders only when its own level (or the depth scale) actually changes. */
const BookRow = memo(
  function BookRow({ level, side, maxTotal, priceDp, qtyDp }: RowProps) {
    const pct = maxTotal > 0 ? Math.min(100, (level.total / maxTotal) * 100) : 0;
    const isBid = side === 'bid';
    return (
      <View style={styles.row}>
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
      </View>
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
}

export const OrderBookView = memo(function OrderBookView({ market, book }: Props) {
  const { bids, asks } = book;
  // Asks arrive ascending; display descending so the best ask sits next to the spread.
  const asksDesc = useMemo(() => [...asks].reverse(), [asks]);

  if (bids.length === 0 || asks.length === 0) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.muted}>Connecting to order book…</Text>
      </View>
    );
  }

  const maxTotal = Math.max(bids[bids.length - 1].total, asks[asks.length - 1].total);
  const bestBid = bids[0].price;
  const bestAsk = asks[0].price;
  const mid = (bestBid + bestAsk) / 2;
  const spread = bestAsk - bestBid;

  return (
    <View>
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
        />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  loading: { paddingVertical: 40, alignItems: 'center', gap: 10 },
  muted: { color: colors.muted, fontSize: 12 },
  headerRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 6 },
  headerCell: { flex: 1, color: colors.muted, fontSize: 11 },
  row: { flexDirection: 'row', paddingHorizontal: 12, height: 20, alignItems: 'center' },
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
  },
  mid: { color: colors.text, fontSize: 16, fontWeight: '700' },
});

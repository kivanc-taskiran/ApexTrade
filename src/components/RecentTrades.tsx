import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, mono } from '../theme';
import { Market, Trade } from '../types';
import { fmt, fmtTime } from '../utils/format';

interface Props {
  market: Market;
  trades: Trade[];
}

const TradeRow = memo(function TradeRow({ trade, market }: { trade: Trade; market: Market }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.cell, mono, { color: trade.isBuyerMaker ? colors.red : colors.green }]}>
        {fmt(trade.price, market.priceDp)}
      </Text>
      <Text style={[styles.cell, styles.right, mono]}>{fmt(trade.qty, market.qtyDp)}</Text>
      <Text style={[styles.cell, styles.right, styles.muted, mono]}>{fmtTime(trade.time)}</Text>
    </View>
  );
});

export const RecentTrades = memo(function RecentTrades({ market, trades }: Props) {
  if (trades.length === 0) {
    return <Text style={[styles.muted, styles.empty]}>Waiting for trades…</Text>;
  }
  return (
    <View>
      <View style={styles.row}>
        <Text style={[styles.cell, styles.header]}>Price ({market.quote})</Text>
        <Text style={[styles.cell, styles.header, styles.right]}>Amount ({market.base})</Text>
        <Text style={[styles.cell, styles.header, styles.right]}>Time</Text>
      </View>
      {trades.map((t) => (
        <TradeRow key={t.id} trade={t} market={market} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: 12, height: 20, alignItems: 'center' },
  cell: { flex: 1, color: colors.text, fontSize: 12 },
  header: { color: colors.muted, fontSize: 11 },
  right: { textAlign: 'right' },
  muted: { color: colors.muted },
  empty: { textAlign: 'center', paddingVertical: 30, fontSize: 12 },
});

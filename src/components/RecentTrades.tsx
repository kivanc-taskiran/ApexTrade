import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, mono } from '../theme';
import { Market, Trade } from '../types';
import { playSound } from '../utils/audio';
import { fmt, fmtTime } from '../utils/format';

interface Props {
  market: Market;
  trades: Trade[];
  onSelectPrice?: (price: number) => void;
}

const TradeRow = memo(function TradeRow({
  trade,
  market,
  onPress,
}: {
  trade: Trade;
  market: Market;
  onPress?: (price: number) => void;
}) {
  return (
    <Pressable
      onPress={() => {
        playSound('click');
        onPress?.(trade.price);
      }}
      style={styles.row}
    >
      <Text style={[styles.cell, mono, { color: trade.isBuyerMaker ? colors.red : colors.green }]}>
        {fmt(trade.price, market.priceDp)}
      </Text>
      <Text style={[styles.cell, styles.right, mono]}>{fmt(trade.qty, market.qtyDp)}</Text>
      <Text style={[styles.cell, styles.right, styles.muted, mono]}>{fmtTime(trade.time)}</Text>
    </Pressable>
  );
});

export const RecentTrades = memo(function RecentTrades({ market, trades, onSelectPrice }: Props) {
  if (trades.length === 0) {
    return <Text style={[styles.muted, styles.empty]}>Waiting for live trades stream…</Text>;
  }
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.cell, styles.header]}>Price ({market.quote})</Text>
        <Text style={[styles.cell, styles.header, styles.right]}>Amount ({market.base})</Text>
        <Text style={[styles.cell, styles.header, styles.right]}>Time</Text>
      </View>
      {trades.slice(0, 18).map((t) => (
        <TradeRow key={t.id} trade={t} market={market} onPress={onSelectPrice} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { paddingBottom: 4 },
  headerRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 5 },
  row: { flexDirection: 'row', paddingHorizontal: 12, height: 21, alignItems: 'center' },
  cell: { flex: 1, color: colors.text, fontSize: 11 },
  header: { color: colors.muted, fontSize: 11 },
  right: { textAlign: 'right' },
  muted: { color: colors.muted },
  empty: { textAlign: 'center', paddingVertical: 35, fontSize: 12 },
});

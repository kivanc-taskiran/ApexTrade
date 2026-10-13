import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MARKETS, STARTING_CASH } from '../config';
import { colors, mono } from '../theme';
import { Portfolio } from '../types';
import { fmt, fmtTime } from '../utils/format';

interface Props {
  portfolio: Portfolio;
  prices: Record<string, number>;
  onReset: () => void;
}

export function PortfolioCard({ portfolio, prices, onReset }: Props) {
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Paper Portfolio</Text>
        <Pressable onPress={onReset}>
          <Text style={styles.reset}>Reset</Text>
        </Pressable>
      </View>

      <Text style={[styles.equity, mono]}>{fmt(equity, 2)} USDT</Text>
      <Text style={[mono, { color: pnlColor, fontSize: 13, fontWeight: '600' }]}>
        PnL {pnl >= 0 ? '+' : ''}
        {fmt(pnl, 2)} ({((pnl / STARTING_CASH) * 100).toFixed(2)}%)
      </Text>

      <View style={styles.balances}>
        <Balance asset="USDT" qty={fmt(portfolio.cash, 2)} />
        {MARKETS.map((m) => (
          <Balance key={m.base} asset={m.base} qty={fmt(portfolio.holdings[m.base] ?? 0, m.qtyDp)} />
        ))}
      </View>

      {portfolio.fills.length > 0 && (
        <View style={styles.fills}>
          <Text style={styles.subTitle}>Recent fills</Text>
          {portfolio.fills.slice(0, 5).map((f) => (
            <View key={f.id} style={styles.fillRow}>
              <Text style={[styles.fillText, { color: f.side === 'buy' ? colors.green : colors.red }]}>
                {f.side.toUpperCase()}
              </Text>
              <Text style={[styles.fillText, mono]}>
                {fmt(f.qty, dpFor(f.symbol))} {f.symbol.replace('USDT', '')}
              </Text>
              <Text style={[styles.fillText, mono]}>@ {fmt(f.avgPrice, 2)}</Text>
              <Text style={[styles.fillText, styles.muted, mono]}>{fmtTime(f.time)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function Balance({ asset, qty }: { asset: string; qty: string }) {
  return (
    <View style={styles.balance}>
      <Text style={styles.muted}>{asset}</Text>
      <Text style={[styles.balanceValue, mono]}>{qty}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 12, gap: 6 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.text, fontWeight: '700', fontSize: 14 },
  reset: { color: colors.accent, fontSize: 12, fontWeight: '600' },
  equity: { color: colors.text, fontSize: 22, fontWeight: '700' },
  balances: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  balance: {
    backgroundColor: colors.panelAlt,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: '22%',
  },
  balanceValue: { color: colors.text, fontSize: 12, fontWeight: '600', marginTop: 2 },
  muted: { color: colors.muted, fontSize: 11 },
  fills: { marginTop: 8, gap: 4 },
  subTitle: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  fillRow: { flexDirection: 'row', justifyContent: 'space-between' },
  fillText: { color: colors.text, fontSize: 11 },
});

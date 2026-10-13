import { memo, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, mono } from '../theme';
import { ConnectionStatus, Market, Ticker } from '../types';
import { fmt, fmtCompact } from '../utils/format';

interface Props {
  markets: Market[];
  market: Market;
  onSelect: (m: Market) => void;
  ticker: Ticker | null;
  status: ConnectionStatus;
  msgPerSec: number;
}

const STATUS_COLOR: Record<ConnectionStatus, string> = {
  open: colors.green,
  connecting: colors.accent,
  error: colors.red,
  closed: colors.muted,
};

export const TickerHeader = memo(function TickerHeader({
  markets,
  market,
  onSelect,
  ticker,
  status,
  msgPerSec,
}: Props) {
  const prevSymbol = useRef(market.symbol);
  const prevPrice = useRef<number | null>(null);
  const direction = useRef<'up' | 'down'>('up');

  if (prevSymbol.current !== market.symbol) {
    prevSymbol.current = market.symbol;
    prevPrice.current = null;
  } else if (ticker && prevPrice.current !== null && ticker.last !== prevPrice.current) {
    direction.current = ticker.last > prevPrice.current ? 'up' : 'down';
  }

  useEffect(() => {
    prevPrice.current = ticker?.last ?? null;
  }, [ticker?.last]);

  const changeColor = (ticker?.changePct ?? 0) >= 0 ? colors.green : colors.red;
  const priceColor = prevPrice.current === null ? changeColor : direction.current === 'up' ? colors.green : colors.red;

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Text style={styles.brand}>
          Apex<Text style={{ color: colors.accent }}>Trade</Text>
        </Text>
        <View style={styles.statusPill}>
          <View style={[styles.dot, { backgroundColor: STATUS_COLOR[status] }]} />
          <Text style={[styles.statusText, mono]}>
            {status === 'open' ? `LIVE · ${msgPerSec} msg/s` : status.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.tabs}>
        {markets.map((m) => {
          const active = m.symbol === market.symbol;
          return (
            <Pressable
              key={m.symbol}
              onPress={() => onSelect(m)}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {m.base}/{m.quote}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.priceRow}>
        <Text style={[styles.price, mono, { color: ticker ? priceColor : colors.muted }]}>
          {ticker ? fmt(ticker.last, market.priceDp) : '—'}
        </Text>
        {ticker && (
          <Text style={[styles.change, mono, { color: changeColor }]}>
            {ticker.changePct >= 0 ? '+' : ''}
            {ticker.changePct.toFixed(2)}%
          </Text>
        )}
      </View>

      <View style={styles.statsRow}>
        <Stat label="24h High" value={ticker ? fmt(ticker.high, market.priceDp) : '—'} />
        <Stat label="24h Low" value={ticker ? fmt(ticker.low, market.priceDp) : '—'} />
        <Stat label={`24h Vol (${market.quote})`} value={ticker ? fmtCompact(ticker.quoteVolume) : '—'} />
      </View>
    </View>
  );
});

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, mono]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 10 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { color: colors.text, fontSize: 20, fontWeight: '800', letterSpacing: 0.3 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.panel,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: { borderColor: colors.accent },
  tabText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: colors.accent },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  price: { fontSize: 30, fontWeight: '700' },
  change: { fontSize: 15, fontWeight: '600' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statLabel: { color: colors.muted, fontSize: 11 },
  statValue: { color: colors.text, fontSize: 13, fontWeight: '600', marginTop: 2 },
});

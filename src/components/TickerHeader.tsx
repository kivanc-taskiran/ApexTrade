import { memo, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, mono } from '../theme';
import { ConnectionStatus, Market, Ticker } from '../types';
import { isAudioEnabled, playSound, setAudioEnabled } from '../utils/audio';
import { fmt, fmtCompact } from '../utils/format';

interface Props {
  markets: Market[];
  market: Market;
  onSelect: (m: Market) => void;
  ticker: Ticker | null;
  status: ConnectionStatus;
  msgPerSec: number;
  onFaucet?: () => void;
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
  onFaucet,
}: Props) {
  const [audioOn, setAudioOn] = useState(isAudioEnabled());
  const prevPrice = useRef<number | null>(null);
  const direction = useRef<'up' | 'down'>('up');

  if (ticker && prevPrice.current !== null && ticker.last !== prevPrice.current) {
    direction.current = ticker.last > prevPrice.current ? 'up' : 'down';
  }

  useEffect(() => {
    prevPrice.current = ticker?.last ?? null;
  }, [ticker?.last]);

  const toggleAudio = () => {
    const next = !audioOn;
    setAudioOn(next);
    setAudioEnabled(next);
    if (next) playSound('click');
  };

  const handleFaucet = () => {
    playSound('faucet');
    onFaucet?.();
  };

  const changeColor = (ticker?.changePct ?? 0) >= 0 ? colors.green : colors.red;
  const priceColor = prevPrice.current === null ? changeColor : direction.current === 'up' ? colors.green : colors.red;

  return (
    <View style={styles.container}>
      {/* Top Pro Brand & Diagnostic Bar */}
      <View style={styles.topRow}>
        <View style={styles.brandRow}>
          <Text style={styles.brand}>
            Apex<Text style={{ color: colors.accent }}>Trade</Text>
          </Text>
          <View style={styles.proBadge}>
            <Text style={styles.proText}>PRO TERMINAL</Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          {onFaucet && (
            <Pressable onPress={handleFaucet} style={styles.faucetBtn}>
              <Text style={styles.faucetText}>+$10,000 Faucet</Text>
            </Pressable>
          )}

          <Pressable onPress={toggleAudio} style={styles.audioBtn}>
            <Text style={styles.audioText}>{audioOn ? '🔊 Audio' : '🔇 Muted'}</Text>
          </Pressable>

          <View style={styles.statusPill}>
            <View style={[styles.dot, { backgroundColor: STATUS_COLOR[status] }]} />
            <Text style={[styles.statusText, mono]}>
              {status === 'open' ? `WS · ${msgPerSec} msg/s` : status.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      {/* Asset Quick Switcher Chips */}
      <View style={styles.marketScroll}>
        {markets.map((m) => {
          const active = m.symbol === market.symbol;
          return (
            <Pressable
              key={m.symbol}
              onPress={() => {
                playSound('click');
                onSelect(m);
              }}
              style={[styles.marketChip, active && styles.marketChipActive]}
            >
              <Text style={[styles.marketChipText, active && styles.marketChipTextActive]}>
                {m.base}/{m.quote}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Hero Price & 24h Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.heroPriceWrap}>
          <Text style={[styles.price, mono, { color: ticker ? priceColor : colors.muted }]}>
            {ticker ? fmt(ticker.last, market.priceDp) : '—'}
          </Text>
          {ticker && (
            <View style={[styles.changeBadge, { backgroundColor: (ticker.changePct >= 0 ? colors.greenBg : colors.redBg) }]}>
              <Text style={[styles.changeText, mono, { color: changeColor }]}>
                {ticker.changePct >= 0 ? '+' : ''}
                {ticker.changePct.toFixed(2)}%
              </Text>
            </View>
          )}
        </View>

        <View style={styles.statsGrid}>
          <Stat label="24h High" value={ticker ? fmt(ticker.high, market.priceDp) : '—'} />
          <Stat label="24h Low" value={ticker ? fmt(ticker.low, market.priceDp) : '—'} />
          <Stat label={`24h Vol (${market.quote})`} value={ticker ? fmtCompact(ticker.quoteVolume) : '—'} />
          <Stat label="Funding / 8h" value="0.0100%" />
        </View>
      </View>
    </View>
  );
});

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, mono]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brand: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  proBadge: {
    backgroundColor: 'rgba(240,185,11,0.15)',
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  proText: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  faucetBtn: {
    backgroundColor: 'rgba(14,203,129,0.15)',
    borderWidth: 1,
    borderColor: colors.green,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  faucetText: {
    color: colors.green,
    fontSize: 11,
    fontWeight: '700',
  },
  audioBtn: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  audioText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.panel,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  marketScroll: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  marketChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  marketChipActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(240,185,11,0.08)',
  },
  marketChipText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  marketChipTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  heroPriceWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  price: {
    fontSize: 26,
    fontWeight: '800',
  },
  changeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  changeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  statItem: {
    gap: 2,
  },
  statLabel: {
    color: colors.muted,
    fontSize: 10,
  },
  statValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
});

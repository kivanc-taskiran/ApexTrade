import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { FEE_RATE } from '../config';
import { simulateFill } from '../engine/matching';
import { colors, mono } from '../theme';
import { Market, OrderBook, OrderResult, Side } from '../types';
import { floorTo, fmt } from '../utils/format';

interface Props {
  market: Market;
  book: OrderBook;
  cash: number;
  holding: number;
  onOrder: (side: Side, qty: number) => OrderResult;
}

const PERCENTS = [0.25, 0.5, 0.75, 1];

export function TradePanel({ market, book, cash, holding, onOrder }: Props) {
  const [side, setSide] = useState<Side>('buy');
  const [qtyText, setQtyText] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    setQtyText('');
    setFeedback(null);
  }, [market.symbol]);

  const qty = Number(qtyText.replace(',', '.')) || 0;
  const levels = side === 'buy' ? book.asks : book.bids;
  const estimate = qty > 0 ? simulateFill(levels, qty) : null;
  const isBuy = side === 'buy';
  const accent = isBuy ? colors.green : colors.red;

  const applyPercent = (p: number) => {
    const bestAsk = book.asks[0]?.price;
    let max = 0;
    if (isBuy && bestAsk) max = cash / (bestAsk * (1 + FEE_RATE) * 1.002); // small buffer for slippage
    if (!isBuy) max = holding;
    if (max > 0) {
      setQtyText(String(floorTo(max * p, market.qtyDp)));
      setFeedback(null);
    } else {
      setFeedback({
        ok: false,
        text: isBuy ? `Insufficient ${market.quote} balance` : `No ${market.base} balance to sell`,
      });
    }
  };

  const submit = () => {
    const res = onOrder(side, qty);
    if (res.ok) {
      setFeedback({
        ok: true,
        text: `${isBuy ? 'Bought' : 'Sold'} ${fmt(res.fill.qty, market.qtyDp)} ${market.base} @ ${fmt(
          res.fill.avgPrice,
          market.priceDp,
        )}`,
      });
      setQtyText('');
    } else {
      setFeedback({ ok: false, text: res.reason });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.sideSwitch}>
        {(['buy', 'sell'] as Side[]).map((s) => {
          const active = s === side;
          const c = s === 'buy' ? colors.green : colors.red;
          return (
            <Pressable
              key={s}
              onPress={() => {
                setSide(s);
                setFeedback(null);
              }}
              style={[styles.sideBtn, active && { backgroundColor: c }]}
            >
              <Text style={[styles.sideText, active && { color: '#fff' }]}>
                {s === 'buy' ? 'Buy' : 'Sell'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>
        Available:{' '}
        <Text style={[styles.value, mono]}>
          {isBuy ? `${fmt(cash, 2)} ${market.quote}` : `${fmt(holding, market.qtyDp)} ${market.base}`}
        </Text>
      </Text>

      <View style={styles.inputWrap}>
        <TextInput
          value={qtyText}
          onChangeText={(t) => {
            setQtyText(t);
            setFeedback(null);
          }}
          placeholder="Amount"
          placeholderTextColor={colors.muted}
          keyboardType="decimal-pad"
          style={[styles.input, mono]}
        />
        <Text style={styles.unit}>{market.base}</Text>
      </View>

      <View style={styles.percentRow}>
        {PERCENTS.map((p) => (
          <Pressable key={p} onPress={() => applyPercent(p)} style={styles.percentBtn}>
            <Text style={styles.percentText}>{p * 100}%</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.estimate}>
        <Row label="Est. avg price" value={estimate ? fmt(estimate.avgPrice, market.priceDp) : '—'} />
        <Row label="Slippage" value={estimate ? `${estimate.slippagePct.toFixed(4)}%` : '—'} />
        <Row
          label={`Est. ${isBuy ? 'cost' : 'proceeds'} (incl. ${FEE_RATE * 100}% fee)`}
          value={
            estimate
              ? `${fmt(isBuy ? estimate.cost * (1 + FEE_RATE) : estimate.cost * (1 - FEE_RATE), 2)} ${market.quote}`
              : qty > 0
                ? 'Insufficient depth'
                : '—'
          }
        />
      </View>

      <Pressable
        onPress={submit}
        disabled={!estimate}
        style={({ pressed }) => [
          styles.submit,
          { backgroundColor: accent, opacity: !estimate ? 0.4 : pressed ? 0.8 : 1 },
        ]}
      >
        <Text style={styles.submitText}>
          {isBuy ? 'Market Buy' : 'Market Sell'} {market.base}
        </Text>
      </Pressable>

      {feedback && (
        <Text style={[styles.feedback, { color: feedback.ok ? colors.green : colors.red }]}>
          {feedback.text}
        </Text>
      )}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.estRow}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, mono]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 12, gap: 10 },
  sideSwitch: { flexDirection: 'row', backgroundColor: colors.panelAlt, borderRadius: 6, padding: 3 },
  sideBtn: { flex: 1, paddingVertical: 8, borderRadius: 4, alignItems: 'center' },
  sideText: { color: colors.muted, fontWeight: '700' },
  label: { color: colors.muted, fontSize: 12 },
  value: { color: colors.text, fontSize: 12, fontWeight: '600' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.panelAlt,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
  },
  input: { flex: 1, color: colors.text, fontSize: 16, paddingVertical: 10 },
  unit: { color: colors.muted, fontWeight: '600' },
  percentRow: { flexDirection: 'row', gap: 6 },
  percentBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  percentText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  estimate: { gap: 4 },
  estRow: { flexDirection: 'row', justifyContent: 'space-between' },
  submit: { paddingVertical: 12, borderRadius: 6, alignItems: 'center' },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  feedback: { fontSize: 12, textAlign: 'center' },
});

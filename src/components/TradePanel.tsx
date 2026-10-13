import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { FEE_RATE } from '../config';
import { simulateFill } from '../engine/matching';
import { colors, mono } from '../theme';
import { Market, OrderBook, OrderResult, OrderType, Side } from '../types';
import { playSound } from '../utils/audio';
import { floorTo, fmt } from '../utils/format';

interface Props {
  market: Market;
  book: OrderBook;
  cash: number;
  holding: number;
  selectedPrice?: number | null;
  onMarketOrder: (side: Side, qty: number) => OrderResult;
  onLimitOrder: (side: Side, price: number, qty: number) => OrderResult;
}

const PERCENTS = [0.25, 0.5, 0.75, 1];

export function TradePanel({
  market,
  book,
  cash,
  holding,
  selectedPrice,
  onMarketOrder,
  onLimitOrder,
}: Props) {
  const [orderType, setOrderType] = useState<OrderType>('limit');
  const [side, setSide] = useState<Side>('buy');
  const [limitPriceText, setLimitPriceText] = useState('');
  const [qtyText, setQtyText] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  // When selectedPrice is passed from order book tap, update the limit price
  useEffect(() => {
    if (selectedPrice) {
      setLimitPriceText(String(selectedPrice));
      setOrderType('limit');
    }
  }, [selectedPrice]);

  // Reset inputs when market changes
  useEffect(() => {
    setQtyText('');
    setFeedback(null);
    const bestAsk = book.asks[0]?.price;
    if (bestAsk) setLimitPriceText(String(bestAsk));
  }, [market.symbol]);

  const qty = Number(qtyText.replace(',', '.')) || 0;
  const limitPrice = Number(limitPriceText.replace(',', '.')) || 0;
  const levels = side === 'buy' ? book.asks : book.bids;
  const isBuy = side === 'buy';
  const isLimit = orderType === 'limit';
  const accent = isBuy ? colors.green : colors.red;

  const estimate = !isLimit && qty > 0 ? simulateFill(levels, qty) : null;
  const limitTotal = isLimit ? limitPrice * qty : 0;

  const applyPercent = (p: number) => {
    playSound('click');
    const targetPrice = isLimit ? limitPrice : book.asks[0]?.price || 1;
    let max = 0;
    if (isBuy && targetPrice > 0) {
      max = cash / (targetPrice * (1 + FEE_RATE) * 1.002);
    } else if (!isBuy) {
      max = holding;
    }

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
    if (isLimit) {
      const res = onLimitOrder(side, limitPrice, qty);
      if (res.ok) {
        playSound(isBuy ? 'buy' : 'sell');
        setFeedback({ ok: true, text: res.message });
        setQtyText('');
      } else {
        setFeedback({ ok: false, text: res.reason });
      }
    } else {
      const res = onMarketOrder(side, qty);
      if (res.ok) {
        playSound(isBuy ? 'buy' : 'sell');
        setFeedback({ ok: true, text: res.message });
        setQtyText('');
      } else {
        setFeedback({ ok: false, text: res.reason });
      }
    }
  };

  const canSubmit = isLimit ? limitPrice > 0 && qty > 0 : !!estimate;

  return (
    <View style={styles.container}>
      {/* Order Type Switcher: Limit vs Market */}
      <View style={styles.typeSwitch}>
        {(['limit', 'market'] as OrderType[]).map((t) => {
          const active = t === orderType;
          return (
            <Pressable
              key={t}
              onPress={() => {
                playSound('click');
                setOrderType(t);
                setFeedback(null);
              }}
              style={[styles.typeBtn, active && styles.typeBtnActive]}
            >
              <Text style={[styles.typeText, active && styles.typeTextActive]}>
                {t === 'limit' ? 'Limit' : 'Market'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Side Switcher: Buy vs Sell */}
      <View style={styles.sideSwitch}>
        {(['buy', 'sell'] as Side[]).map((s) => {
          const active = s === side;
          const c = s === 'buy' ? colors.green : colors.red;
          return (
            <Pressable
              key={s}
              onPress={() => {
                playSound('click');
                setSide(s);
                setFeedback(null);
              }}
              style={[styles.sideBtn, active && { backgroundColor: c }]}
            >
              <Text style={[styles.sideText, active && { color: '#fff' }]}>
                {s === 'buy' ? 'Buy / Long' : 'Sell / Short'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.availRow}>
        <Text style={styles.availLabel}>Avail:</Text>
        <Text style={[styles.availVal, mono]}>
          {isBuy ? `${fmt(cash, 2)} ${market.quote}` : `${fmt(holding, market.qtyDp)} ${market.base}`}
        </Text>
      </View>

      {/* Limit Price Input */}
      {isLimit && (
        <View style={styles.inputWrap}>
          <Text style={styles.inputPrefix}>Price</Text>
          <TextInput
            value={limitPriceText}
            onChangeText={(t) => {
              setLimitPriceText(t);
              setFeedback(null);
            }}
            placeholder="0.00"
            placeholderTextColor={colors.muted}
            keyboardType="decimal-pad"
            style={[styles.input, mono]}
          />
          <Text style={styles.unit}>{market.quote}</Text>
        </View>
      )}

      {/* Amount Input */}
      <View style={styles.inputWrap}>
        <Text style={styles.inputPrefix}>Amount</Text>
        <TextInput
          value={qtyText}
          onChangeText={(t) => {
            setQtyText(t);
            setFeedback(null);
          }}
          placeholder="0.00"
          placeholderTextColor={colors.muted}
          keyboardType="decimal-pad"
          style={[styles.input, mono]}
        />
        <Text style={styles.unit}>{market.base}</Text>
      </View>

      {/* Quick Balance Percentage Buttons */}
      <View style={styles.percentRow}>
        {PERCENTS.map((p) => (
          <Pressable key={p} onPress={() => applyPercent(p)} style={styles.percentBtn}>
            <Text style={styles.percentText}>{p * 100}%</Text>
          </Pressable>
        ))}
      </View>

      {/* Order Estimate Summary */}
      <View style={styles.estimate}>
        {isLimit ? (
          <>
            <Row label="Order Value" value={`${fmt(limitTotal, 2)} ${market.quote}`} />
            <Row label={`Est. Fee (${FEE_RATE * 100}%)`} value={`${fmt(limitTotal * FEE_RATE, 4)} ${market.quote}`} />
          </>
        ) : (
          <>
            <Row label="Est. Avg Price" value={estimate ? fmt(estimate.avgPrice, market.priceDp) : '—'} />
            <Row label="Est. Slippage" value={estimate ? `${estimate.slippagePct.toFixed(4)}%` : '—'} />
            <Row
              label={`Est. ${isBuy ? 'Cost' : 'Proceeds'}`}
              value={
                estimate
                  ? `${fmt(isBuy ? estimate.cost * (1 + FEE_RATE) : estimate.cost * (1 - FEE_RATE), 2)} ${market.quote}`
                  : qty > 0
                  ? 'Depth exhausted'
                  : '—'
              }
            />
          </>
        )}
      </View>

      <Pressable
        onPress={submit}
        disabled={!canSubmit}
        style={({ pressed }) => [
          styles.submit,
          { backgroundColor: accent, opacity: !canSubmit ? 0.4 : pressed ? 0.8 : 1 },
        ]}
      >
        <Text style={styles.submitText}>
          {isLimit ? `Limit ${isBuy ? 'Buy' : 'Sell'}` : `Market ${isBuy ? 'Buy' : 'Sell'}`} {market.base}
        </Text>
      </Pressable>

      {feedback && (
        <View style={[styles.feedbackBox, { borderColor: feedback.ok ? colors.green : colors.red }]}>
          <Text style={[styles.feedback, { color: feedback.ok ? colors.green : colors.red }]}>
            {feedback.text}
          </Text>
        </View>
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
  container: { padding: 14, gap: 10 },
  typeSwitch: {
    flexDirection: 'row',
    backgroundColor: colors.panelAlt,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 2,
  },
  typeBtn: { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 4 },
  typeBtnActive: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border },
  typeText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  typeTextActive: { color: colors.text, fontWeight: '700' },
  sideSwitch: { flexDirection: 'row', backgroundColor: colors.panelAlt, borderRadius: 6, padding: 3 },
  sideBtn: { flex: 1, paddingVertical: 8, borderRadius: 4, alignItems: 'center' },
  sideText: { color: colors.muted, fontWeight: '700', fontSize: 13 },
  availRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  availLabel: { color: colors.muted, fontSize: 11 },
  availVal: { color: colors.text, fontSize: 12, fontWeight: '600' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.panelAlt,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
  },
  inputPrefix: { color: colors.muted, fontSize: 12, marginRight: 8, fontWeight: '600' },
  input: { flex: 1, color: colors.text, fontSize: 14, paddingVertical: 8 },
  unit: { color: colors.muted, fontWeight: '600', fontSize: 11 },
  percentRow: { flexDirection: 'row', gap: 6 },
  percentBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.panelAlt,
  },
  percentText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  estimate: { gap: 4, paddingVertical: 2 },
  estRow: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { color: colors.muted, fontSize: 11 },
  value: { color: colors.text, fontSize: 11, fontWeight: '600' },
  submit: { paddingVertical: 11, borderRadius: 6, alignItems: 'center' },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  feedbackBox: {
    backgroundColor: colors.panelAlt,
    borderWidth: 1,
    borderRadius: 6,
    padding: 8,
  },
  feedback: { fontSize: 11, textAlign: 'center', fontWeight: '600' },
});

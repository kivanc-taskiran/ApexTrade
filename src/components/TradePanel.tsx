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
  onStopLimitOrder: (side: Side, stopPrice: number, price: number, qty: number) => OrderResult;
  onShowToast?: (title: string, type: 'success' | 'error') => void;
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
  onStopLimitOrder,
  onShowToast,
}: Props) {
  const [orderType, setOrderType] = useState<OrderType>('limit');
  const [side, setSide] = useState<Side>('buy');
  const [stopPriceText, setStopPriceText] = useState('');
  const [limitPriceText, setLimitPriceText] = useState('');
  const [qtyText, setQtyText] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  // When selectedPrice is passed from order book or recent trade tap, update the limit price
  useEffect(() => {
    if (selectedPrice) {
      setLimitPriceText(String(selectedPrice));
      if (orderType === 'market') setOrderType('limit');
    }
  }, [selectedPrice]);

  // Reset inputs when market changes
  useEffect(() => {
    setQtyText('');
    setFeedback(null);
    const bestAsk = book.asks[0]?.price;
    if (bestAsk) {
      setLimitPriceText(String(bestAsk));
      setStopPriceText(String(bestAsk));
    }
  }, [market.symbol]);

  const qty = Number(qtyText.replace(',', '.')) || 0;
  const limitPrice = Number(limitPriceText.replace(',', '.')) || 0;
  const stopPrice = Number(stopPriceText.replace(',', '.')) || 0;
  const levels = side === 'buy' ? book.asks : book.bids;
  const isBuy = side === 'buy';
  const isLimit = orderType === 'limit';
  const isStopLimit = orderType === 'stop_limit';
  const accent = isBuy ? colors.green : colors.red;

  const estimate = orderType === 'market' && qty > 0 ? simulateFill(levels, qty) : null;
  const orderTotal = (isLimit || isStopLimit) ? limitPrice * qty : 0;

  const applyPercent = (p: number) => {
    playSound('click');
    const targetPrice = (isLimit || isStopLimit) ? limitPrice : book.asks[0]?.price || 1;
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

  const adjustQty = (delta: number) => {
    playSound('click');
    const next = Math.max(0, qty + delta);
    setQtyText(String(floorTo(next, market.qtyDp)));
  };

  const submit = () => {
    let res: OrderResult;
    if (isStopLimit) {
      res = onStopLimitOrder(side, stopPrice, limitPrice, qty);
    } else if (isLimit) {
      res = onLimitOrder(side, limitPrice, qty);
    } else {
      res = onMarketOrder(side, qty);
    }

    if (res.ok) {
      playSound(isBuy ? 'buy' : 'sell');
      setFeedback({ ok: true, text: res.message });
      onShowToast?.(res.message, 'success');
      setQtyText('');
    } else {
      setFeedback({ ok: false, text: res.reason });
      onShowToast?.(res.reason, 'error');
    }
  };

  const canSubmit = isStopLimit
    ? stopPrice > 0 && limitPrice > 0 && qty > 0
    : isLimit
    ? limitPrice > 0 && qty > 0
    : !!estimate;

  return (
    <View style={styles.container}>
      {/* Order Type Switcher: Limit, Market, Stop-Limit */}
      <View style={styles.typeSwitch}>
        {(['limit', 'market', 'stop_limit'] as OrderType[]).map((t) => {
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
                {t === 'limit' ? 'Limit' : t === 'market' ? 'Market' : 'Stop-Limit'}
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
        <Text style={styles.availLabel}>Available Balance:</Text>
        <Text style={[styles.availVal, mono]}>
          {isBuy ? `${fmt(cash, 2)} ${market.quote}` : `${fmt(holding, market.qtyDp)} ${market.base}`}
        </Text>
      </View>

      {/* Stop Trigger Price Input (For Stop-Limit) */}
      {isStopLimit && (
        <View style={styles.inputWrap}>
          <Text style={styles.inputPrefix}>Stop</Text>
          <TextInput
            value={stopPriceText}
            onChangeText={(t) => {
              setStopPriceText(t);
              setFeedback(null);
            }}
            placeholder="Trigger price"
            placeholderTextColor={colors.muted}
            keyboardType="decimal-pad"
            style={[styles.input, mono]}
          />
          <Text style={styles.unit}>{market.quote}</Text>
        </View>
      )}

      {/* Limit Price Input (For Limit and Stop-Limit) */}
      {(isLimit || isStopLimit) && (
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

      {/* Amount Input with Steppers */}
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
        <View style={styles.stepperWrap}>
          <Pressable onPress={() => adjustQty(-0.01)} style={styles.stepperBtn}>
            <Text style={styles.stepperText}>−</Text>
          </Pressable>
          <Pressable onPress={() => adjustQty(0.01)} style={styles.stepperBtn}>
            <Text style={styles.stepperText}>+</Text>
          </Pressable>
        </View>
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
        {(isLimit || isStopLimit) ? (
          <>
            <Row label="Order Value" value={`${fmt(orderTotal, 2)} ${market.quote}`} />
            <Row label={`Est. Fee (${FEE_RATE * 100}%)`} value={`${fmt(orderTotal * FEE_RATE, 4)} ${market.quote}`} />
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
          {isStopLimit
            ? `Stop-Limit ${isBuy ? 'Buy' : 'Sell'}`
            : isLimit
            ? `Limit ${isBuy ? 'Buy' : 'Sell'}`
            : `Market ${isBuy ? 'Buy' : 'Sell'}`}{' '}
          {market.base}
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
  typeText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
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
    paddingHorizontal: 10,
  },
  inputPrefix: { color: colors.muted, fontSize: 11, marginRight: 8, fontWeight: '600', minWidth: 44 },
  input: { flex: 1, color: colors.text, fontSize: 14, paddingVertical: 8 },
  stepperWrap: { flexDirection: 'row', gap: 4, marginRight: 6 },
  stepperBtn: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  stepperText: { color: colors.text, fontSize: 12, fontWeight: '700' },
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

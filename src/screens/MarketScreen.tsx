import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OrderBookView } from '../components/OrderBookView';
import { PortfolioCard } from '../components/PortfolioCard';
import { RecentTrades } from '../components/RecentTrades';
import { TickerHeader } from '../components/TickerHeader';
import { TradePanel } from '../components/TradePanel';
import { MARKETS } from '../config';
import { useMarketStream } from '../hooks/useMarketStream';
import { usePortfolio } from '../hooks/usePortfolio';
import { colors } from '../theme';
import { Market, Side } from '../types';

type Tab = 'book' | 'trades';

export function MarketScreen() {
  const [market, setMarket] = useState<Market>(MARKETS[0]);
  const [tab, setTab] = useState<Tab>('book');
  const [prices, setPrices] = useState<Record<string, number>>({});

  const { book, ticker, trades, status, msgPerSec } = useMarketStream(market.symbol);
  const { portfolio, placeMarketOrder, reset } = usePortfolio();

  // Remember the last price per asset so portfolio equity stays valued after switching markets.
  useEffect(() => {
    if (!ticker) return;
    setPrices((p) => (p[market.base] === ticker.last ? p : { ...p, [market.base]: ticker.last }));
  }, [ticker, market.base]);

  const handleOrder = useCallback(
    (side: Side, qty: number) => placeMarketOrder(market, side, qty, book),
    [placeMarketOrder, market, book],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
          <TickerHeader
            markets={MARKETS}
            market={market}
            onSelect={setMarket}
            ticker={ticker}
            status={status}
            msgPerSec={msgPerSec}
          />

          <View style={styles.card}>
            <View style={styles.tabs}>
              {(['book', 'trades'] as Tab[]).map((t) => (
                <Pressable key={t} onPress={() => setTab(t)} style={styles.tab}>
                  <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                    {t === 'book' ? 'Order Book' : 'Market Trades'}
                  </Text>
                  {tab === t && <View style={styles.tabUnderline} />}
                </Pressable>
              ))}
            </View>
            {tab === 'book' ? (
              <OrderBookView market={market} book={book} />
            ) : (
              <RecentTrades market={market} trades={trades} />
            )}
          </View>

          <View style={styles.card}>
            <TradePanel
              market={market}
              book={book}
              cash={portfolio.cash}
              holding={portfolio.holdings[market.base] ?? 0}
              onOrder={handleOrder}
            />
          </View>

          <View style={styles.card}>
            <PortfolioCard portfolio={portfolio} prices={prices} onReset={reset} />
          </View>

          <Text style={styles.footer}>Market data: Binance public WebSocket · Paper trading only</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 32 },
  card: {
    backgroundColor: colors.panel,
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingBottom: 8,
    overflow: 'hidden',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: 4,
  },
  tab: { paddingHorizontal: 14, paddingVertical: 10 },
  tabText: { color: colors.muted, fontWeight: '600', fontSize: 13 },
  tabTextActive: { color: colors.text },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 14,
    right: 14,
    height: 2,
    backgroundColor: colors.accent,
  },
  footer: { color: colors.muted, fontSize: 11, textAlign: 'center', marginTop: 4 },
});

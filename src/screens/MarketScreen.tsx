import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OrderBookView } from '../components/OrderBookView';
import { PortfolioCard } from '../components/PortfolioCard';
import { ProTradingChart } from '../components/ProTradingChart';
import { RecentTrades } from '../components/RecentTrades';
import { TickerHeader } from '../components/TickerHeader';
import { TradePanel } from '../components/TradePanel';
import { MARKETS } from '../config';
import { useKlineStream } from '../hooks/useKlineStream';
import { useMarketStream } from '../hooks/useMarketStream';
import { usePortfolio } from '../hooks/usePortfolio';
import { colors } from '../theme';
import { Market, Side } from '../types';

type MiddleTab = 'book' | 'trades';

export function MarketScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const [market, setMarket] = useState<Market>(MARKETS[0]);
  const [middleTab, setMiddleTab] = useState<MiddleTab>('book');
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [selectedPrice, setSelectedPrice] = useState<number | null>(null);

  const { book, ticker, trades, status, msgPerSec } = useMarketStream(market.symbol);
  const { klines, interval, setInterval } = useKlineStream(market.symbol, ticker);
  const {
    portfolio,
    placeMarketOrder,
    placeLimitOrder,
    cancelOrder,
    checkLimitOrders,
    reset,
    topUpFaucet,
  } = usePortfolio();

  // Remember latest price and check for pending limit orders
  useEffect(() => {
    if (!ticker) return;
    setPrices((p) => (p[market.base] === ticker.last ? p : { ...p, [market.base]: ticker.last }));
    checkLimitOrders(market.symbol, ticker.last);
  }, [ticker, market.base, market.symbol, checkLimitOrders]);

  const handleMarketOrder = useCallback(
    (side: Side, qty: number) => placeMarketOrder(market, side, qty, book),
    [placeMarketOrder, market, book],
  );

  const handleLimitOrder = useCallback(
    (side: Side, price: number, qty: number) => placeLimitOrder(market, side, price, qty),
    [placeLimitOrder, market],
  );

  const handleSelectPrice = useCallback((price: number) => {
    setSelectedPrice(price);
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
          {/* Top Ticker & Diagnostic Header */}
          <TickerHeader
            markets={MARKETS}
            market={market}
            onSelect={(m) => {
              setMarket(m);
              setSelectedPrice(null);
            }}
            ticker={ticker}
            status={status}
            msgPerSec={msgPerSec}
            onFaucet={topUpFaucet}
          />

          {isDesktop ? (
            /* Desktop Pro Terminal Layout (3-Column Bloomberg Grid) */
            <View style={styles.desktopGrid}>
              {/* Left Column: Pro Candlestick Chart + Trading Console / Portfolio */}
              <View style={styles.colLeft}>
                <ProTradingChart
                  market={market}
                  ticker={ticker}
                  klines={klines}
                  interval={interval}
                  onSelectInterval={setInterval}
                  book={book}
                />
                <View style={styles.card}>
                  <PortfolioCard
                    portfolio={portfolio}
                    prices={prices}
                    onReset={reset}
                    onCancelOrder={cancelOrder}
                    onFaucet={topUpFaucet}
                  />
                </View>
              </View>

              {/* Center Column: Order Book & Real-Time Trades */}
              <View style={styles.colCenter}>
                <View style={styles.card}>
                  <View style={styles.tabs}>
                    {(['book', 'trades'] as MiddleTab[]).map((t) => (
                      <Pressable key={t} onPress={() => setMiddleTab(t)} style={styles.tab}>
                        <Text style={[styles.tabText, middleTab === t && styles.tabTextActive]}>
                          {t === 'book' ? 'Order Book Depth' : 'Recent Market Trades'}
                        </Text>
                        {middleTab === t && <View style={styles.tabUnderline} />}
                      </Pressable>
                    ))}
                  </View>
                  {middleTab === 'book' ? (
                    <OrderBookView market={market} book={book} onSelectPrice={handleSelectPrice} />
                  ) : (
                    <RecentTrades market={market} trades={trades} />
                  )}
                </View>
              </View>

              {/* Right Column: Execution Order Ticket */}
              <View style={styles.colRight}>
                <View style={styles.card}>
                  <TradePanel
                    market={market}
                    book={book}
                    cash={portfolio.cash}
                    holding={portfolio.holdings[market.base] ?? 0}
                    selectedPrice={selectedPrice}
                    onMarketOrder={handleMarketOrder}
                    onLimitOrder={handleLimitOrder}
                  />
                </View>
              </View>
            </View>
          ) : (
            /* Mobile Layout (Clean Single-Column Stack) */
            <View style={styles.mobileWrap}>
              <ProTradingChart
                market={market}
                ticker={ticker}
                klines={klines}
                interval={interval}
                onSelectInterval={setInterval}
                book={book}
              />

              <View style={styles.card}>
                <View style={styles.tabs}>
                  {(['book', 'trades'] as MiddleTab[]).map((t) => (
                    <Pressable key={t} onPress={() => setMiddleTab(t)} style={styles.tab}>
                      <Text style={[styles.tabText, middleTab === t && styles.tabTextActive]}>
                        {t === 'book' ? 'Order Book' : 'Market Trades'}
                      </Text>
                      {middleTab === t && <View style={styles.tabUnderline} />}
                    </Pressable>
                  ))}
                </View>
                {middleTab === 'book' ? (
                  <OrderBookView market={market} book={book} onSelectPrice={handleSelectPrice} />
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
                  selectedPrice={selectedPrice}
                  onMarketOrder={handleMarketOrder}
                  onLimitOrder={handleLimitOrder}
                />
              </View>

              <View style={styles.card}>
                <PortfolioCard
                  portfolio={portfolio}
                  prices={prices}
                  onReset={reset}
                  onCancelOrder={cancelOrder}
                  onFaucet={topUpFaucet}
                />
              </View>
            </View>
          )}

          <Text style={styles.footer}>
            ApexTrade Pro Terminal · Binance Public WebSocket Stream & Historical Klines · Client-Side Matching Engine
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 40 },
  desktopGrid: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    marginTop: 10,
    gap: 12,
    alignItems: 'flex-start',
  },
  colLeft: {
    flex: 2.3,
    gap: 12,
  },
  colCenter: {
    flex: 1.4,
  },
  colRight: {
    flex: 1.3,
  },
  mobileWrap: {
    paddingHorizontal: 12,
    marginTop: 10,
    gap: 12,
  },
  card: {
    backgroundColor: colors.panel,
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
    backgroundColor: colors.panelAlt,
  },
  tab: { paddingHorizontal: 14, paddingVertical: 10 },
  tabText: { color: colors.muted, fontWeight: '600', fontSize: 13 },
  tabTextActive: { color: colors.text, fontWeight: '700' },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 14,
    right: 14,
    height: 2,
    backgroundColor: colors.accent,
  },
  footer: { color: colors.muted, fontSize: 11, textAlign: 'center', marginTop: 20 },
});

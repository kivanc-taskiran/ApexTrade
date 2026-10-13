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
import { LivePriceChart } from '../components/LivePriceChart';
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

type MiddleTab = 'book' | 'trades';

export function MarketScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const [market, setMarket] = useState<Market>(MARKETS[0]);
  const [middleTab, setMiddleTab] = useState<MiddleTab>('book');
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [selectedPrice, setSelectedPrice] = useState<number | null>(null);

  const { book, ticker, trades, status, msgPerSec } = useMarketStream(market.symbol);
  const {
    portfolio,
    placeMarketOrder,
    placeLimitOrder,
    cancelOrder,
    checkLimitOrders,
    reset,
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
          {/* Top Ticker Header */}
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
          />

          {isDesktop ? (
            /* Desktop Pro Terminal Layout (3 Columns) */
            <View style={styles.desktopGrid}>
              {/* Left Column: Live Chart + Portfolio / History */}
              <View style={styles.colLeft}>
                <LivePriceChart market={market} ticker={ticker} />
                <View style={styles.card}>
                  <PortfolioCard
                    portfolio={portfolio}
                    prices={prices}
                    onReset={reset}
                    onCancelOrder={cancelOrder}
                  />
                </View>
              </View>

              {/* Center Column: Order Book & Trades */}
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

              {/* Right Column: Trading Ticket Panel */}
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
            /* Mobile Layout (Single Column) */
            <View style={styles.mobileWrap}>
              <LivePriceChart market={market} ticker={ticker} />

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
                />
              </View>
            </View>
          )}

          <Text style={styles.footer}>
            ApexTrade Pro · Binance Public WebSocket Data Stream · Simulated Paper Trading Engine
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
    gap: 12,
    alignItems: 'flex-start',
  },
  colLeft: {
    flex: 2.2,
    gap: 12,
  },
  colCenter: {
    flex: 1.5,
  },
  colRight: {
    flex: 1.3,
  },
  mobileWrap: {
    paddingHorizontal: 12,
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
  footer: { color: colors.muted, fontSize: 11, textAlign: 'center', marginTop: 16 },
});

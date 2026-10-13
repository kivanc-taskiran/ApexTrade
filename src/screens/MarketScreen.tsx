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
import { colors, mono } from '../theme';
import { Market, Side, ToastMessage } from '../types';
import { playSound } from '../utils/audio';

type MiddleTab = 'book' | 'trades';

export function MarketScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const [market, setMarket] = useState<Market>(MARKETS[0]);
  const [middleTab, setMiddleTab] = useState<MiddleTab>('book');
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [selectedPrice, setSelectedPrice] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [showHotkeysModal, setShowHotkeysModal] = useState(false);

  const { book, ticker, trades, status, msgPerSec } = useMarketStream(market.symbol);
  const { klines, interval, setInterval } = useKlineStream(market.symbol, ticker);
  const {
    portfolio,
    placeMarketOrder,
    placeLimitOrder,
    placeStopLimitOrder,
    cancelOrder,
    checkLimitOrders,
    closePosition,
    reset,
    topUpFaucet,
  } = usePortfolio();

  const showToast = useCallback((title: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = String(Date.now());
    setToast({ id, title, type });
    setTimeout(() => {
      setToast((curr) => (curr?.id === id ? null : curr));
    }, 3500);
  }, []);

  // Remember latest price and check for pending limit orders
  useEffect(() => {
    if (!ticker) return;
    setPrices((p) => (p[market.base] === ticker.last ? p : { ...p, [market.base]: ticker.last }));
    checkLimitOrders(market.symbol, ticker.last);
  }, [ticker, market.base, market.symbol, checkLimitOrders]);

  // Global Keyboard Shortcuts (Web Terminal Experience)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      const key = e.key.toUpperCase();
      if (key === '1') {
        setInterval('1m');
        showToast('Chart Timeframe: 1m', 'info');
      } else if (key === '5') {
        setInterval('5m');
        showToast('Chart Timeframe: 5m', 'info');
      } else if (key === 'H') {
        setInterval('1h');
        showToast('Chart Timeframe: 1h', 'info');
      } else if (key === 'D') {
        setInterval('1d');
        showToast('Chart Timeframe: 1d', 'info');
      } else if (key === 'F') {
        topUpFaucet(10000);
        playSound('faucet');
        showToast('+$10,000 USDT Faucet Deposited', 'success');
      } else if (key === '?') {
        setShowHotkeysModal((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setInterval, showToast, topUpFaucet]);

  const handleMarketOrder = useCallback(
    (side: Side, qty: number) => {
      const res = placeMarketOrder(market, side, qty, book);
      if (res.ok) showToast(res.message, 'success');
      return res;
    },
    [placeMarketOrder, market, book, showToast],
  );

  const handleLimitOrder = useCallback(
    (side: Side, price: number, qty: number) => {
      const res = placeLimitOrder(market, side, price, qty);
      if (res.ok) showToast(res.message, 'success');
      return res;
    },
    [placeLimitOrder, market, showToast],
  );

  const handleStopLimitOrder = useCallback(
    (side: Side, stopPrice: number, price: number, qty: number) => {
      const res = placeStopLimitOrder(market, side, stopPrice, price, qty);
      if (res.ok) showToast(res.message, 'success');
      return res;
    },
    [placeStopLimitOrder, market, showToast],
  );

  const handleClosePosition = useCallback(
    (targetMarket: Market) => {
      const res = closePosition(targetMarket, book);
      if (res.ok) {
        playSound('sell');
        showToast(`Closed ${targetMarket.base} position at market price`, 'success');
      } else {
        showToast(res.reason, 'error');
      }
    },
    [closePosition, book, showToast],
  );

  const handleSelectPrice = useCallback((price: number) => {
    setSelectedPrice(price);
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Floating Toast Notification */}
        {toast && (
          <View
            style={[
              styles.floatingToast,
              {
                borderColor:
                  toast.type === 'success'
                    ? colors.green
                    : toast.type === 'error'
                    ? colors.red
                    : colors.accent,
              },
            ]}
          >
            <View
              style={[
                styles.toastDot,
                {
                  backgroundColor:
                    toast.type === 'success'
                      ? colors.green
                      : toast.type === 'error'
                      ? colors.red
                      : colors.accent,
                },
              ]}
            />
            <Text style={styles.toastTitle}>{toast.title}</Text>
          </View>
        )}

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
            onFaucet={() => {
              topUpFaucet(10000);
              showToast('+$10,000 USDT Faucet Deposited', 'success');
            }}
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
                    onClosePosition={handleClosePosition}
                    onFaucet={() => {
                      topUpFaucet(10000);
                      showToast('+$10,000 USDT Faucet Deposited', 'success');
                    }}
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
                    <RecentTrades market={market} trades={trades} onSelectPrice={handleSelectPrice} />
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
                    onStopLimitOrder={handleStopLimitOrder}
                    onShowToast={showToast}
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
                  <RecentTrades market={market} trades={trades} onSelectPrice={handleSelectPrice} />
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
                  onStopLimitOrder={handleStopLimitOrder}
                  onShowToast={showToast}
                />
              </View>

              <View style={styles.card}>
                <PortfolioCard
                  portfolio={portfolio}
                  prices={prices}
                  onReset={reset}
                  onCancelOrder={cancelOrder}
                  onClosePosition={handleClosePosition}
                  onFaucet={() => {
                    topUpFaucet(10000);
                    showToast('+$10,000 USDT Faucet Deposited', 'success');
                  }}
                />
              </View>
            </View>
          )}

          <View style={styles.footerWrap}>
            <Text style={styles.footer}>
              ApexTrade Pro Terminal · Binance Public WebSocket Stream & Historical Klines · Client-Side Matching Engine
            </Text>
            <Text style={[styles.footerHotkeys, mono]}>
              Hotkeys: [1, 5, H, D] Timeframe · [F] +10k Faucet · Tap price to fill
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 40 },
  floatingToast: {
    position: 'absolute',
    top: 14,
    right: 16,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#161a1e',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  toastDot: { width: 8, height: 8, borderRadius: 4 },
  toastTitle: { color: colors.text, fontSize: 12, fontWeight: '700' },
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
  footerWrap: {
    marginTop: 20,
    alignItems: 'center',
    gap: 4,
  },
  footer: { color: colors.muted, fontSize: 11, textAlign: 'center' },
  footerHotkeys: { color: colors.accent, fontSize: 10, opacity: 0.8 },
});

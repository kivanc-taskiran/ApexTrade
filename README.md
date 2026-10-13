# ApexTrade

Real-time crypto order book & paper-trading app built with **React Native (Expo) + TypeScript**, streaming live market data from Binance's public WebSocket API.

## Features

- **Live order book** (top 15 bids/asks, 100 ms updates) with cumulative depth bars, mid price and spread
- **Live trade tape** and 24h ticker (price, change, high/low, volume)
- **Market switching** between BTC / ETH / SOL with zero data leakage between markets
- **Paper trading**: market orders filled by walking the live book, so large orders pay realistic **slippage** + 0.1% fee
- **Persistent portfolio** (AsyncStorage): balances, equity, PnL, fill history
- **Connection resilience**: exponential-backoff reconnect + endpoint rotation, live `msg/s` indicator

## Architecture

```
Binance WS ──► BinanceStream (reconnect, backoff, endpoint rotation)
                    │  raw frames (10–50 / sec)
                    ▼
             useMarketStream ── mutable ref buffer ──► flush every 200 ms ──► React state
                    │                                    (single batched commit)
                    ▼
   TickerHeader · OrderBookView (memoized rows) · RecentTrades · TradePanel
                                                              │
                                     simulateFill (book walk) ◄┘──► usePortfolio ──► AsyncStorage
```

```
src/
├── config.ts               # markets, endpoints, tuning constants
├── types.ts                # domain types
├── services/BinanceStream.ts
├── hooks/useMarketStream.ts
├── hooks/usePortfolio.ts
├── engine/matching.ts      # market-order simulation with slippage
├── components/             # TickerHeader, OrderBookView, RecentTrades, TradePanel, PortfolioCard
└── screens/MarketScreen.tsx
```

## Key engineering decisions

| Problem | Solution |
| --- | --- |
| Socket frames arrive far faster than the UI needs to repaint | Frames are written to a `useRef` buffer, committed to state once per 200 ms. Only the latest depth snapshot is kept; trades are accumulated. |
| Re-rendering 30 book rows on every tick | `React.memo` rows with a custom comparator; unchanged state slices keep their object reference. |
| Stale data flashing after switching markets | Snapshot is tagged with its symbol; the hook never returns data that doesn't match the requested symbol. |
| Unrealistic "fill at last price" paper trading | `simulateFill` consumes liquidity level by level and reports avg price & slippage. |
| Flaky mobile networks | Exponential backoff (1s → 30s) and rotation between `stream.binance.com` and `data-stream.binance.vision`. |

## Run

```bash
npm install
npx expo start        # scan the QR code with Expo Go, or press "a" for Android emulator
```

> Market data is public and requires no API key. This app is for demonstration only and places no real orders.

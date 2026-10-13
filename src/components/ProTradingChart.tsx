import React, { memo, useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { colors, mono } from '../theme';
import { Kline, KlineInterval, Market, OrderBook, Ticker } from '../types';
import { fmt, fmtCompact } from '../utils/format';

export type ChartMode = 'candles' | 'line' | 'depth';

interface Props {
  market: Market;
  ticker: Ticker | null;
  klines: Kline[];
  interval: KlineInterval;
  onSelectInterval: (i: KlineInterval) => void;
  book?: OrderBook;
}

const INTERVALS: KlineInterval[] = ['1m', '5m', '15m', '1h', '1d'];

// Calculate Simple Moving Average
function calculateSMA(data: Kline[], period: number): (number | null)[] {
  return data.map((_, i) => {
    if (i < period - 1) return null;
    const slice = data.slice(i - period + 1, i + 1);
    const sum = slice.reduce((acc, k) => acc + k.close, 0);
    return sum / period;
  });
}

export const ProTradingChart = memo(function ProTradingChart({
  market,
  ticker,
  klines,
  interval,
  onSelectInterval,
  book,
}: Props) {
  const [chartMode, setChartMode] = useState<ChartMode>('candles');
  const [showMA, setShowMA] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [size, setSize] = useState({ width: 0, height: 260 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && (width !== size.width || height !== size.height)) {
      setSize({ width, height: height || 260 });
    }
  };

  const ma7 = useMemo(() => calculateSMA(klines, 7), [klines]);
  const ma25 = useMemo(() => calculateSMA(klines, 25), [klines]);

  const activeCandle = hoveredIndex !== null && klines[hoveredIndex] ? klines[hoveredIndex] : klines[klines.length - 1];
  const activeMA7 = hoveredIndex !== null ? ma7[hoveredIndex] : ma7[ma7.length - 1];
  const activeMA25 = hoveredIndex !== null ? ma25[hoveredIndex] : ma25[ma25.length - 1];

  // Chart dimensions & scaling
  const paddingY = 24;
  const volHeight = showVolume ? 45 : 0;
  const priceChartHeight = Math.max(100, size.height - paddingY * 2 - volHeight);
  const hasData = klines.length >= 2 && size.width > 0;

  const minPrice = hasData ? Math.min(...klines.map((k) => k.low)) : 0;
  const maxPrice = hasData ? Math.max(...klines.map((k) => k.high)) : 1;
  const priceRange = maxPrice - minPrice || 1;
  const maxVolume = hasData ? Math.max(...klines.map((k) => k.volume)) || 1 : 1;

  const candleCount = klines.length;
  const candleSlotWidth = hasData ? size.width / candleCount : 10;
  const candleBodyWidth = Math.max(2, candleSlotWidth * 0.72);

  const getY = (p: number) => paddingY + priceChartHeight - ((p - minPrice) / priceRange) * priceChartHeight;

  // Build Line Mode Path
  let linePathD = '';
  let lineAreaD = '';
  if (hasData) {
    const coords = klines.map((k, i) => ({
      x: i * candleSlotWidth + candleSlotWidth / 2,
      y: getY(k.close),
    }));
    linePathD = coords.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`, '');
    const first = coords[0];
    const last = coords[coords.length - 1];
    lineAreaD = `${linePathD} L ${last.x.toFixed(1)} ${paddingY + priceChartHeight} L ${first.x.toFixed(1)} ${paddingY + priceChartHeight} Z`;
  }

  // Build MA lines
  const buildMAPath = (maValues: (number | null)[]) => {
    let d = '';
    maValues.forEach((val, i) => {
      if (val === null) return;
      const x = i * candleSlotWidth + candleSlotWidth / 2;
      const y = getY(val);
      d += `${d === '' ? 'M' : ' L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    });
    return d;
  };

  const ma7Path = showMA && hasData ? buildMAPath(ma7) : '';
  const ma25Path = showMA && hasData ? buildMAPath(ma25) : '';

  // Render Depth Chart if in depth mode
  const renderDepthChart = () => {
    if (!book || book.bids.length === 0 || book.asks.length === 0 || size.width === 0) return null;
    const bids = book.bids.slice(0, 15);
    const asks = book.asks.slice(0, 15);
    const maxDepth = Math.max(bids[bids.length - 1]?.total || 1, asks[asks.length - 1]?.total || 1);
    const midX = size.width / 2;
    const depthH = size.height - 40;

    // Bids (left, green)
    const bidPoints = bids.map((b, i) => {
      const x = midX - ((i + 1) / bids.length) * midX;
      const y = size.height - 20 - (b.total / maxDepth) * depthH;
      return { x, y };
    });
    const bidD = `M ${midX} ${size.height - 20} ` + bidPoints.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ` L 0 ${size.height - 20} Z`;

    // Asks (right, red)
    const askPoints = asks.map((a, i) => {
      const x = midX + ((i + 1) / asks.length) * midX;
      const y = size.height - 20 - (a.total / maxDepth) * depthH;
      return { x, y };
    });
    const askD = `M ${midX} ${size.height - 20} ` + askPoints.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ` L ${size.width} ${size.height - 20} Z`;

    return (
      <Svg width={size.width} height={size.height}>
        <Path d={bidD} fill="rgba(14,203,129,0.25)" stroke={colors.green} strokeWidth="2" />
        <Path d={askD} fill="rgba(246,70,93,0.25)" stroke={colors.red} strokeWidth="2" />
        <Line x1={midX} y1={20} x2={midX} y2={size.height - 20} stroke={colors.border} strokeDasharray="4,4" />
        <SvgText x={midX - 10} y="35" fill={colors.green} fontSize="11" textAnchor="end" fontWeight="bold">
          BIDS CUMULATIVE
        </SvgText>
        <SvgText x={midX + 10} y="35" fill={colors.red} fontSize="11" textAnchor="start" fontWeight="bold">
          ASKS CUMULATIVE
        </SvgText>
      </Svg>
    );
  };

  return (
    <View style={styles.card} onLayout={onLayout}>
      {/* Top Chart Toolbar: Mode, Interval, Indicators */}
      <View style={styles.toolbar}>
        <View style={styles.modeGroup}>
          {(['candles', 'line', 'depth'] as ChartMode[]).map((m) => (
            <Pressable
              key={m}
              onPress={() => setChartMode(m)}
              style={[styles.toolBtn, chartMode === m && styles.toolBtnActive]}
            >
              <Text style={[styles.toolBtnText, chartMode === m && styles.toolBtnTextActive]}>
                {m === 'candles' ? 'Candles' : m === 'line' ? 'Line' : 'Depth'}
              </Text>
            </Pressable>
          ))}
        </View>

        {chartMode !== 'depth' && (
          <View style={styles.intervalGroup}>
            {INTERVALS.map((i) => (
              <Pressable
                key={i}
                onPress={() => onSelectInterval(i)}
                style={[styles.intervalBtn, interval === i && styles.intervalBtnActive]}
              >
                <Text style={[styles.intervalText, interval === i && styles.intervalTextActive]}>
                  {i}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.indicatorGroup}>
          <Pressable onPress={() => setShowMA(!showMA)} style={[styles.indPill, showMA && styles.indPillActive]}>
            <Text style={[styles.indText, showMA && { color: colors.accent }]}>MA</Text>
          </Pressable>
          <Pressable onPress={() => setShowVolume(!showVolume)} style={[styles.indPill, showVolume && styles.indPillActive]}>
            <Text style={[styles.indText, showVolume && { color: colors.accent }]}>VOL</Text>
          </Pressable>
        </View>
      </View>

      {/* Interactive HUD Bar (TradingView Style) */}
      {chartMode !== 'depth' && activeCandle && (
        <View style={styles.hudBar}>
          <Text style={[styles.hudLabel, mono]}>
            O: <Text style={styles.hudVal}>{fmt(activeCandle.open, market.priceDp)}</Text>
          </Text>
          <Text style={[styles.hudLabel, mono]}>
            H: <Text style={styles.hudVal}>{fmt(activeCandle.high, market.priceDp)}</Text>
          </Text>
          <Text style={[styles.hudLabel, mono]}>
            L: <Text style={styles.hudVal}>{fmt(activeCandle.low, market.priceDp)}</Text>
          </Text>
          <Text style={[styles.hudLabel, mono]}>
            C:{' '}
            <Text
              style={[
                styles.hudVal,
                { color: activeCandle.close >= activeCandle.open ? colors.green : colors.red },
              ]}
            >
              {fmt(activeCandle.close, market.priceDp)}
            </Text>
          </Text>
          {showVolume && (
            <Text style={[styles.hudLabel, mono]}>
              V: <Text style={styles.hudVal}>{fmtCompact(activeCandle.volume)}</Text>
            </Text>
          )}
          {showMA && activeMA7 && (
            <Text style={[styles.hudLabel, mono, { color: '#f59e0b' }]}>
              MA(7): {fmt(activeMA7, market.priceDp)}
            </Text>
          )}
          {showMA && activeMA25 && (
            <Text style={[styles.hudLabel, mono, { color: '#38bdf8' }]}>
              MA(25): {fmt(activeMA25, market.priceDp)}
            </Text>
          )}
        </View>
      )}

      {/* SVG Canvas */}
      <View style={[styles.canvasWrap, { height: size.height }]}>
        {chartMode === 'depth' ? (
          renderDepthChart()
        ) : hasData ? (
          <Svg width={size.width} height={size.height}>
            <Defs>
              <LinearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={colors.green} stopOpacity="0.25" />
                <Stop offset="100%" stopColor={colors.green} stopOpacity="0.0" />
              </LinearGradient>
            </Defs>

            {/* Price Grid Lines */}
            <Line x1="0" y1={paddingY} x2={size.width} y2={paddingY} stroke={colors.border} strokeDasharray="3,3" opacity="0.4" />
            <Line
              x1="0"
              y1={paddingY + priceChartHeight / 2}
              x2={size.width}
              y2={paddingY + priceChartHeight / 2}
              stroke={colors.border}
              strokeDasharray="3,3"
              opacity="0.4"
            />
            <Line
              x1="0"
              y1={paddingY + priceChartHeight}
              x2={size.width}
              y2={paddingY + priceChartHeight}
              stroke={colors.border}
              strokeDasharray="3,3"
              opacity="0.4"
            />

            {/* High / Low Watermark */}
            <SvgText x={size.width - 8} y={paddingY + 12} fill={colors.muted} fontSize="10" textAnchor="end">
              H: {fmt(maxPrice, market.priceDp)}
            </SvgText>
            <SvgText x={size.width - 8} y={paddingY + priceChartHeight - 4} fill={colors.muted} fontSize="10" textAnchor="end">
              L: {fmt(minPrice, market.priceDp)}
            </SvgText>

            {/* Volume Histogram (Bottom) */}
            {showVolume &&
              klines.map((k, i) => {
                const x = i * candleSlotWidth + (candleSlotWidth - candleBodyWidth) / 2;
                const vH = (k.volume / maxVolume) * volHeight;
                const y = size.height - vH;
                const isGreen = k.close >= k.open;
                return (
                  <Rect
                    key={`v${i}`}
                    x={x}
                    y={y}
                    width={candleBodyWidth}
                    height={Math.max(1, vH)}
                    fill={isGreen ? 'rgba(14,203,129,0.3)' : 'rgba(246,70,93,0.3)'}
                  />
                );
              })}

            {/* Candlesticks Mode */}
            {chartMode === 'candles' &&
              klines.map((k, i) => {
                const isGreen = k.close >= k.open;
                const color = isGreen ? colors.green : colors.red;
                const slotX = i * candleSlotWidth;
                const centerX = slotX + candleSlotWidth / 2;
                const bodyX = slotX + (candleSlotWidth - candleBodyWidth) / 2;

                const openY = getY(k.open);
                const closeY = getY(k.close);
                const highY = getY(k.high);
                const lowY = getY(k.low);

                const bodyTop = Math.min(openY, closeY);
                const bodyH = Math.max(2, Math.abs(openY - closeY));

                return (
                  <React.Fragment key={`c${i}`}>
                    {/* Wick */}
                    <Line x1={centerX} y1={highY} x2={centerX} y2={lowY} stroke={color} strokeWidth="1.2" />
                    {/* Candle Body */}
                    <Rect x={bodyX} y={bodyTop} width={candleBodyWidth} height={bodyH} fill={color} rx="1" />
                  </React.Fragment>
                );
              })}

            {/* Line Mode */}
            {chartMode === 'line' && (
              <>
                <Path d={lineAreaD} fill="url(#lineGrad)" />
                <Path d={linePathD} fill="none" stroke={colors.green} strokeWidth="2.5" />
              </>
            )}

            {/* MA7 Curve */}
            {showMA && ma7Path !== '' && (
              <Path d={ma7Path} fill="none" stroke="#f59e0b" strokeWidth="1.5" opacity="0.85" />
            )}

            {/* MA25 Curve */}
            {showMA && ma25Path !== '' && (
              <Path d={ma25Path} fill="none" stroke="#38bdf8" strokeWidth="1.5" opacity="0.85" />
            )}

            {/* Current Price Dashed Reference Line */}
            {ticker?.last && (
              <Line
                x1="0"
                y1={getY(ticker.last)}
                x2={size.width}
                y2={getY(ticker.last)}
                stroke={colors.accent}
                strokeWidth="1"
                strokeDasharray="4,4"
                opacity="0.75"
              />
            )}
          </Svg>
        ) : (
          <View style={styles.loadingWrap}>
            <Text style={styles.loadingText}>Connecting to Binance historical klines feed…</Text>
          </View>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.panel,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingTop: 10,
    overflow: 'hidden',
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    flexWrap: 'wrap',
    gap: 8,
  },
  modeGroup: {
    flexDirection: 'row',
    backgroundColor: colors.panelAlt,
    borderRadius: 6,
    padding: 2,
  },
  toolBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  toolBtnActive: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toolBtnText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  toolBtnTextActive: {
    color: colors.text,
    fontWeight: '700',
  },
  intervalGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  intervalBtn: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  intervalBtnActive: {
    backgroundColor: 'rgba(240,185,11,0.15)',
  },
  intervalText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  intervalTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  indicatorGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  indPill: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: colors.panelAlt,
  },
  indPillActive: {
    borderColor: colors.accent,
  },
  indText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  hudBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingTop: 6,
    gap: 10,
  },
  hudLabel: {
    fontSize: 10,
    color: colors.muted,
  },
  hudVal: {
    color: colors.text,
    fontWeight: '600',
  },
  canvasWrap: {
    width: '100%',
    justifyContent: 'center',
  },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  loadingText: {
    color: colors.muted,
    fontSize: 12,
  },
});

import React, { memo, useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop, Circle, Line, Text as SvgText } from 'react-native-svg';
import { colors, mono } from '../theme';
import { Market, Ticker } from '../types';
import { fmt } from '../utils/format';

interface Props {
  market: Market;
  ticker: Ticker | null;
}

const MAX_POINTS = 50;

export const LivePriceChart = memo(function LivePriceChart({ market, ticker }: Props) {
  const [points, setPoints] = useState<number[]>([]);
  const [size, setSize] = useState({ width: 0, height: 180 });
  const currentSymbol = useRef(market.symbol);

  // Reset points on market switch
  if (currentSymbol.current !== market.symbol) {
    currentSymbol.current = market.symbol;
    setPoints([]);
  }

  // Append latest price
  useEffect(() => {
    if (!ticker?.last) return;
    setPoints((prev) => {
      const last = prev[prev.length - 1];
      if (last === ticker.last) return prev;
      const next = [...prev, ticker.last];
      return next.length > MAX_POINTS ? next.slice(next.length - MAX_POINTS) : next;
    });
  }, [ticker?.last]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && (width !== size.width || height !== size.height)) {
      setSize({ width, height: height || 180 });
    }
  };

  const hasData = points.length >= 2 && size.width > 0;
  const minPrice = hasData ? Math.min(...points) : 0;
  const maxPrice = hasData ? Math.max(...points) : 1;
  const range = maxPrice - minPrice || 1;

  const isUp = points.length >= 2 ? points[points.length - 1] >= points[0] : true;
  const strokeColor = isUp ? colors.green : colors.red;
  const gradId = `chartGrad_${market.symbol}`;

  const paddingY = 24;
  const chartHeight = size.height - paddingY * 2;

  // Build SVG path
  let pathD = '';
  let areaD = '';
  let lastX = 0;
  let lastY = 0;

  if (hasData) {
    const dx = size.width / (points.length - 1);
    const coords = points.map((p, i) => {
      const x = i * dx;
      const y = paddingY + chartHeight - ((p - minPrice) / range) * chartHeight;
      return { x, y };
    });

    pathD = coords.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`, '');
    const firstPt = coords[0];
    const lastPt = coords[coords.length - 1];
    lastX = lastPt.x;
    lastY = lastPt.y;

    areaD = `${pathD} L ${lastPt.x.toFixed(1)} ${size.height} L ${firstPt.x.toFixed(1)} ${size.height} Z`;
  }

  return (
    <View style={styles.card} onLayout={onLayout}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Real-Time Price Trend</Text>
          <View style={styles.liveIndicator}>
            <View style={[styles.pulseDot, { backgroundColor: isUp ? colors.green : colors.red }]} />
            <Text style={[styles.liveText, mono]}>{points.length} ticks</Text>
          </View>
        </View>
        <View style={styles.rangeLabels}>
          <Text style={[styles.rangeText, mono]}>H: {fmt(maxPrice, market.priceDp)}</Text>
          <Text style={[styles.rangeText, mono]}>L: {fmt(minPrice, market.priceDp)}</Text>
        </View>
      </View>

      <View style={styles.chartWrap}>
        {hasData && (
          <Svg width={size.width} height={size.height}>
            <Defs>
              <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={strokeColor} stopOpacity="0.35" />
                <Stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
              </LinearGradient>
            </Defs>

            {/* Area Fill */}
            <Path d={areaD} fill={`url(#${gradId})`} />

            {/* Price Line */}
            <Path d={pathD} fill="none" stroke={strokeColor} strokeWidth="2.5" />

            {/* Current Price Dot */}
            <Circle cx={lastX} cy={lastY} r="4" fill={strokeColor} />
            <Circle cx={lastX} cy={lastY} r="8" fill={strokeColor} opacity="0.3" />
          </Svg>
        )}
        {!hasData && (
          <View style={styles.loadingWrap}>
            <Text style={styles.loadingText}>Streaming tick data from Binance WebSocket…</Text>
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
    paddingTop: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.panelAlt,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveText: {
    color: colors.muted,
    fontSize: 10,
  },
  rangeLabels: {
    flexDirection: 'row',
    gap: 10,
  },
  rangeText: {
    color: colors.muted,
    fontSize: 11,
  },
  chartWrap: {
    height: 180,
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

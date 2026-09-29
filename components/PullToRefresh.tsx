import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import type { GestureResponderEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { shadow } from '../lib/theme';

/**
 * Pull-to-refresh for the web build.
 *
 * On a phone, ScrollView's refreshControl does this natively. On the web it
 * does nothing at all: react-native-web's RefreshControl takes the onRefresh
 * prop and discards it. Safari's own pull-to-refresh cannot stand in either,
 * because the page itself never scrolls — the app scrolls inside its own
 * container — so on the web no screen could be refreshed by pulling down.
 *
 * This follows the finger instead. A pull only starts when the list is already
 * at its top, travels at half the finger's speed so it feels weighted, and
 * only refreshes past a threshold, where the arrow flips to say so. Touch
 * only: with a mouse, the browser's own reload button does this job.
 */

const THRESHOLD = 72;
const MAX = 120;
const RESISTANCE = 0.5;
const DISC = 38;

export function useWebPullToRefresh({
  enabled,
  refreshing,
  onRefresh,
}: {
  enabled: boolean;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const active = Platform.OS === 'web' && enabled;
  const pull = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(0);
  const startY = useRef<number | null>(null);
  const distance = useRef(0);

  const settle = (to: number) =>
    Animated.timing(pull, {
      toValue: to,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

  // Parked at the threshold while the refresh runs, put away when it ends.
  useEffect(() => {
    if (!active) return;
    if (refreshing) settle(THRESHOLD);
    else if (startY.current === null) settle(0);
    // settle is stable in effect; pull is a ref-held value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshing, active]);

  const finish = (refresh: boolean) => {
    if (startY.current === null) return;
    startY.current = null;
    if (refresh && distance.current >= THRESHOLD) onRefresh();
    else settle(0);
    distance.current = 0;
  };

  const scrollProps = active
    ? {
        scrollEventThrottle: 16,
        onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
          scrollY.current = event.nativeEvent.contentOffset.y;
        },
        onTouchStart: (event: GestureResponderEvent) => {
          if (refreshing || scrollY.current > 0) return;
          startY.current = event.nativeEvent.touches[0]?.pageY ?? null;
          distance.current = 0;
        },
        onTouchMove: (event: GestureResponderEvent) => {
          if (startY.current === null) return;
          // The list moved instead: this was a scroll, not a pull.
          if (scrollY.current > 0) {
            startY.current = null;
            settle(0);
            return;
          }
          const y = event.nativeEvent.touches[0]?.pageY ?? startY.current;
          distance.current = Math.max(0, Math.min((y - startY.current) * RESISTANCE, MAX));
          pull.setValue(distance.current);
        },
        onTouchEnd: () => finish(true),
        onTouchCancel: () => finish(false),
      }
    : {};

  return { active, pull, scrollProps };
}

export function PullIndicator({
  pull,
  refreshing,
  top,
  tint,
  background,
}: {
  pull: Animated.Value;
  refreshing: boolean;
  top: number;
  tint: string;
  background: string;
}) {
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.wrap,
        {
          top,
          opacity: pull.interpolate({
            inputRange: [0, 16, THRESHOLD],
            outputRange: [0, 0.5, 1],
            extrapolate: 'clamp',
          }),
          transform: [
            {
              translateY: pull.interpolate({
                inputRange: [0, MAX],
                outputRange: [-DISC, MAX - DISC],
                extrapolate: 'clamp',
              }),
            },
          ],
        },
      ]}
    >
      <View style={[styles.disc, { backgroundColor: background }]}>
        {refreshing ? (
          <ActivityIndicator color={tint} />
        ) : (
          <Animated.View
            style={{
              transform: [
                {
                  // Upside down once far enough: let go now and it refreshes.
                  rotate: pull.interpolate({
                    inputRange: [THRESHOLD * 0.6, THRESHOLD],
                    outputRange: ['0deg', '180deg'],
                    extrapolate: 'clamp',
                  }),
                },
              ],
            }}
          >
            <Ionicons name="arrow-down" size={20} color={tint} />
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 10 },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.raised,
  },
});

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type AccessibilityActionEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { formatDuration, splitDuration } from '../lib/format';
import { useReducedMotion } from '../lib/a11y';
import { useTheme, useThemedStyles } from '../lib/appearance';
import { radius, spacing, type, type Palette } from '../lib/theme';

const ROW = 44;
const VISIBLE = 5;
/** Rows above and below the chosen one, so the first and last can sit in the middle. */
const PAD = ROW * Math.floor(VISIBLE / 2);

const HOURS = Array.from({ length: 10 }, (_, i) => i);
const SIXTY = Array.from({ length: 60 }, (_, i) => i);


/**
 * A run's total time, picked on three wheels (hours, minutes, seconds) rather
 * than typed, so nobody has to know whether "42.30" or "42:30" is right.
 *
 * Drawn here rather than with the system picker: iOS's timer wheel has no
 * seconds, Android's has no wheel, and the web has neither. The wheels open in
 * place under the field, because the log form already lives in a sheet and a
 * second one on top of it is fragile on Android.
 */
export function DurationField({
  label = 'Time',
  value,
  onChange,
}: {
  label?: string;
  /** Total seconds, or null for no time. */
  value: number | null;
  onChange: (seconds: number | null) => void;
}) {
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [open, setOpen] = useState(false);
  const [hours, minutes, seconds] = splitDuration(value);

  function set(part: 0 | 1 | 2, next: number) {
    const parts = [hours, minutes, seconds];
    parts[part] = next;
    const total = parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
    onChange(total > 0 ? total : null);
  }

  const shown = formatDuration(value);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${shown ? spoken(value) : 'not set'}`}
        accessibilityHint={open ? 'Closes the time wheels' : 'Opens wheels for hours, minutes and seconds'}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((now) => !now)}
        style={({ pressed }) => [styles.trigger, open && styles.triggerOpen, pressed && styles.pressed]}
      >
        <Ionicons name="stopwatch-outline" size={20} color={c.primary} />
        <Text style={[styles.triggerText, !shown && styles.placeholder]}>
          {shown ?? 'Tap to set your time'}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={c.textMuted} />
      </Pressable>

      {open ? (
        <View style={styles.panel}>
          <View style={styles.wheels}>
            <View pointerEvents="none" style={styles.band} />
            <Wheel label="hours" unit="hr" items={HOURS} value={hours} onChange={(n) => set(0, n)} />
            <Wheel label="minutes" unit="min" items={SIXTY} value={minutes} onChange={(n) => set(1, n)} />
            <Wheel label="seconds" unit="sec" items={SIXTY} value={seconds} onChange={(n) => set(2, n)} />
          </View>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => onChange(null)}
              disabled={!shown}
              hitSlop={8}
              style={({ pressed }) => [styles.action, !shown && styles.actionOff, pressed && styles.pressed]}
            >
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setOpen(false)}
              hitSlop={8}
              style={({ pressed }) => [styles.action, styles.done, pressed && styles.pressed]}
            >
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** "45 minutes 30 seconds", for a screen reader. */
function spoken(total: number | null): string {
  const [h, m, s] = splitDuration(total);
  return [
    h ? `${h} ${h === 1 ? 'hour' : 'hours'}` : null,
    m ? `${m} ${m === 1 ? 'minute' : 'minutes'}` : null,
    s ? `${s} ${s === 1 ? 'second' : 'seconds'}` : null,
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * One wheel. It settles on whichever row is nearest the middle once scrolling
 * stops, which works the same with a flick on a phone and a trackpad on the
 * web, where momentum events never arrive.
 */
function Wheel({
  label,
  unit,
  items,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  items: number[];
  value: number;
  onChange: (next: number) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const calm = useReducedMotion();
  const ref = useRef<ScrollView>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The row the wheel last settled on, so an outside change can be told apart. */
  const settled = useRef(value);
  const [centre, setCentre] = useState(value);

  const scrollTo = useCallback(
    (index: number, animated: boolean) => ref.current?.scrollTo({ y: index * ROW, animated }),
    []
  );

  // Clear, or a value that came in from outside: move the wheel to it.
  useEffect(() => {
    if (value !== settled.current) {
      settled.current = value;
      setCentre(value);
      scrollTo(value, !calm);
    }
  }, [value, calm, scrollTo]);

  useEffect(() => () => {
    if (settle.current) clearTimeout(settle.current);
  }, []);

  function choose(index: number) {
    const next = Math.max(0, Math.min(items.length - 1, index));
    if (next !== settled.current) {
      settled.current = next;
      if (Platform.OS !== 'web') void Haptics.selectionAsync();
      onChange(next);
    }
    setCentre(next);
  }

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const y = event.nativeEvent.contentOffset.y;
    setCentre(Math.max(0, Math.min(items.length - 1, Math.round(y / ROW))));
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const index = Math.max(0, Math.min(items.length - 1, Math.round(y / ROW)));
      if (Math.abs(y - index * ROW) > 1) scrollTo(index, !calm);
      choose(index);
    }, 140);
  }

  function onAction(event: AccessibilityActionEvent) {
    const step = event.nativeEvent.actionName === 'increment' ? 1 : -1;
    const next = Math.max(0, Math.min(items.length - 1, settled.current + step));
    scrollTo(next, false);
    choose(next);
  }

  return (
    <View
      style={styles.wheel}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: `${value} ${label}` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={onAction}
    >
      <ScrollView
        ref={ref}
        style={styles.scroller}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        snapToInterval={ROW}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={onScroll}
        onLayout={() => scrollTo(settled.current, false)}
        nestedScrollEnabled
      >
        {items.map((item, index) => {
          const distance = Math.abs(index - centre);
          return (
            <Pressable
              key={item}
              accessible={false}
              onPress={() => {
                scrollTo(index, !calm);
                choose(index);
              }}
              style={styles.row}
            >
              <Text
                style={[
                  styles.number,
                  distance === 0 && styles.numberChosen,
                  distance === 1 && styles.numberNear,
                  distance >= 2 && styles.numberFar,
                ]}
              >
                {unit === 'hr' ? String(item) : String(item).padStart(2, '0')}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Text pointerEvents="none" style={styles.unit}>
        {unit}
      </Text>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    field: { gap: spacing.sm },
    label: { ...type.label, color: c.text },
    trigger: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      minHeight: 48,
    },
    triggerOpen: { borderColor: c.primary },
    pressed: { opacity: 0.75 },
    triggerText: { ...type.bodyStrong, color: c.text, flex: 1, fontVariant: ['tabular-nums'] },
    placeholder: { ...type.body, color: c.textMuted },
    panel: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.lg,
      backgroundColor: c.background,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      gap: spacing.sm,
    },
    wheels: { flexDirection: 'row', height: ROW * VISIBLE, position: 'relative' },
    band: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: PAD,
      height: ROW,
      borderRadius: radius.md,
      backgroundColor: c.primaryTint,
    },
    wheel: { flex: 1, height: ROW * VISIBLE },
    scroller: { flex: 1 },
    scrollContent: { paddingVertical: PAD },
    row: { height: ROW, alignItems: 'center', justifyContent: 'center', paddingRight: 34 },
    number: { fontSize: 22, fontVariant: ['tabular-nums'], color: c.text },
    numberChosen: { fontSize: 26, fontWeight: '700', color: c.primary },
    numberNear: { opacity: 0.55 },
    numberFar: { opacity: 0.25 },
    unit: {
      position: 'absolute',
      right: spacing.md,
      top: PAD,
      ...type.caption,
      height: ROW,
      lineHeight: ROW,
      color: c.textMuted,
      fontWeight: '700',
    },
    actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.sm },
    action: { minHeight: 44, minWidth: 64, justifyContent: 'center', alignItems: 'center', borderRadius: radius.pill },
    actionOff: { opacity: 0.35 },
    clearText: { ...type.label, color: c.textMuted },
    done: { backgroundColor: c.primarySurface, paddingHorizontal: spacing.xl },
    doneText: { ...type.label, color: c.textInverse },
  });

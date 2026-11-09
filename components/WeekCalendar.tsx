import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PLAN_DAYS, isSameDay, toDateInput } from '../lib/format';
import { monthWeeks, planWeekOf, workoutDate } from '../lib/training';
import { useTheme, useThemedStyles } from '../lib/appearance';
import { radius, spacing, type, type Palette } from '../lib/theme';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type Props = {
  /** The day week 1 begins, "2026-11-16", or null before one is picked. */
  startsOn: string | null;
  /** The plan week being written, highlighted on the calendar. */
  selectedWeek: number | null;
  /** Weeks with at least one workout, marked with a dot. */
  writtenWeeks: Set<number>;
  /** Choosing the week that becomes week 1, rather than a week to write. */
  picking: boolean;
  /** A week row was tapped; gets that week's Monday. */
  onPickWeek: (monday: Date) => void;
};

/**
 * A month of the plan, one row per Monday-to-Sunday week, labelled with the
 * plan's week numbers. Tapping a row picks that whole week: either the week to
 * write, or, while picking, the week the plan starts.
 *
 * Drawn here rather than with the system date picker, which picks a single day
 * and, on the web, has no calendar at all.
 */
export function WeekCalendar({ startsOn, selectedWeek, writtenWeeks, picking, onPickWeek }: Props) {
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);
  const today = new Date();

  // Open on the month of the week being written, else this month.
  const focus = (startsOn && selectedWeek ? workoutDate(startsOn, selectedWeek, 1) : null) ?? today;
  const [month, setMonth] = useState(() => new Date(focus.getFullYear(), focus.getMonth(), 1));

  // Follow the week chips: choosing week 9 below turns the calendar to it.
  const focusKey = toDateInput(focus);
  useEffect(() => {
    if (!startsOn || !selectedWeek) return;
    const date = workoutDate(startsOn, selectedWeek, 1);
    if (date) setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    // focusKey stands in for the date object, which is new every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  function turn(by: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + by, 1));
  }

  return (
    <View style={styles.calendar}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          onPress={() => turn(-1)}
          hitSlop={8}
          style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={20} color={c.primary} />
        </Pressable>
        <Text style={styles.month}>
          {MONTHS[month.getMonth()]} {month.getFullYear()}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          onPress={() => turn(1)}
          hitSlop={8}
          style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-forward" size={20} color={c.primary} />
        </Pressable>
      </View>

      <View style={styles.row}>
        <Text style={[styles.weekLabel, styles.headLabel]}>Wk</Text>
        {PLAN_DAYS.map((day) => (
          <Text key={day} style={[styles.cell, styles.dayName]}>
            {day.slice(0, 2)}
          </Text>
        ))}
      </View>

      {monthWeeks(month).map((monday) => {
        const week = startsOn ? planWeekOf(startsOn, monday) : null;
        const selected = !picking && week !== null && week === selectedWeek;
        const isStart = week === 1;
        // Before the plan begins there is nothing to write, unless the coach is
        // choosing where it begins.
        const enabled = picking || week !== null;
        const days = Array.from({ length: 7 }, (_, index) => {
          const date = new Date(monday);
          date.setDate(monday.getDate() + index);
          return date;
        });
        const sunday = days[6];

        return (
          <Pressable
            key={toDateInput(monday)}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled: !enabled }}
            accessibilityLabel={
              picking
                ? `Start week 1 on Monday ${monday.getDate()} ${MONTHS[monday.getMonth()]}`
                : week !== null
                  ? `Week ${week}, ${monday.getDate()} ${MONTHS[monday.getMonth()]} to ${sunday.getDate()} ${MONTHS[sunday.getMonth()]}`
                  : 'Before the plan starts'
            }
            disabled={!enabled}
            onPress={() => onPickWeek(monday)}
            style={({ pressed }) => [
              styles.row,
              styles.weekRow,
              selected && styles.weekRowSelected,
              !selected && isStart && !picking && styles.weekRowStart,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.weekLabelBox}>
              <Text style={[styles.weekLabel, selected && styles.textOnSelected]}>
                {week !== null ? week : ''}
              </Text>
              {week !== null && writtenWeeks.has(week) ? (
                <View style={[styles.dot, selected && styles.dotOnSelected]} />
              ) : null}
            </View>
            {days.map((date) => {
              const outside = date.getMonth() !== month.getMonth();
              const isToday = isSameDay(date, today);
              return (
                <View key={toDateInput(date)} style={styles.cellBox}>
                  <View style={[styles.dateWrap, isToday && styles.todayRing, isToday && selected && styles.todayRingOnSelected]}>
                    <Text
                      style={[
                        styles.date,
                        outside && styles.outside,
                        !enabled && styles.disabled,
                        selected && styles.textOnSelected,
                        selected && outside && styles.outsideOnSelected,
                      ]}
                    >
                      {date.getDate()}
                    </Text>
                  </View>
                </View>
              );
            })}
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    calendar: { gap: 2 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    arrow: {
      width: 36,
      height: 36,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
    },
    month: { ...type.bodyStrong, color: c.text },
    row: { flexDirection: 'row', alignItems: 'center' },
    weekRow: {
      minHeight: 40,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    weekRowSelected: { backgroundColor: c.primarySurface },
    weekRowStart: { borderColor: c.accent },
    weekLabelBox: { width: 32, alignItems: 'center', gap: 2 },
    weekLabel: { ...type.label, color: c.primary, textAlign: 'center' },
    headLabel: { width: 32, color: c.textFaint },
    dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: c.accent },
    dotOnSelected: { backgroundColor: c.textInverse },
    cellBox: { flex: 1, alignItems: 'center' },
    cell: { flex: 1, textAlign: 'center' },
    dayName: { ...type.caption, color: c.textFaint, fontWeight: '700' },
    dateWrap: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    todayRing: { borderColor: c.accent },
    todayRingOnSelected: { borderColor: c.textInverse },
    date: { ...type.body, color: c.text, lineHeight: 20 },
    outside: { color: c.textFaint },
    disabled: { opacity: 0.45 },
    textOnSelected: { color: c.textInverse, fontWeight: '700' },
    outsideOnSelected: { color: c.textOnPrimary, fontWeight: '400' },
    pressed: { opacity: 0.7 },
  });

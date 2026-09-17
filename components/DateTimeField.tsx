import { useState } from 'react';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { formatDateTime, parseLocalDateTime, toDateInput, toTimeInput } from '../lib/format';
import { colors, radius, spacing, type } from '../lib/theme';

type Props = {
  label: string;
  value: Date;
  onChange: (next: Date) => void;
  hint?: string;
  minimumDate?: Date;
};

/**
 * One date-and-time control across three platforms. Android opens the system
 * dialogs back to back, iOS shows a spinner in a sheet, and web — where the
 * native picker has no implementation — falls back to typed fields.
 */
export function DateTimeField({ label, value, onChange, hint, minimumDate }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  if (Platform.OS === 'web') {
    return <WebDateTime label={label} value={value} onChange={onChange} hint={hint} />;
  }

  function openAndroid() {
    DateTimePickerAndroid.open({
      value,
      mode: 'date',
      minimumDate,
      onChange: (dateEvent: DateTimePickerEvent, picked?: Date) => {
        if (dateEvent.type !== 'set' || !picked) return;
        DateTimePickerAndroid.open({
          value: picked,
          mode: 'time',
          onChange: (timeEvent: DateTimePickerEvent, time?: Date) => {
            if (timeEvent.type !== 'set' || !time) return;
            const merged = new Date(picked);
            merged.setHours(time.getHours(), time.getMinutes(), 0, 0);
            onChange(merged);
          },
        });
      },
    });
  }

  function open() {
    if (Platform.OS === 'android') {
      openAndroid();
      return;
    }
    setDraft(value);
    setSheetOpen(true);
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatDateTime(value)}`}
        onPress={open}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
      >
        <Ionicons name="calendar-outline" size={18} color={colors.primary} />
        <Text style={styles.triggerText}>{formatDateTime(value)}</Text>
        <Ionicons name="chevron-down" size={16} color={colors.textFaint} />
      </Pressable>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}

      <Modal visible={sheetOpen} transparent animationType="slide" onRequestClose={() => setSheetOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setSheetOpen(false)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{label}</Text>
          <DateTimePicker
            value={draft}
            mode="datetime"
            display="spinner"
            minimumDate={minimumDate}
            onChange={(_event: DateTimePickerEvent, picked?: Date) => {
              if (picked) setDraft(picked);
            }}
          />
          <View style={styles.sheetActions}>
            <Button label="Cancel" variant="secondary" onPress={() => setSheetOpen(false)} style={styles.sheetButton} />
            <Button
              label="Done"
              onPress={() => {
                onChange(draft);
                setSheetOpen(false);
              }}
              style={styles.sheetButton}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function WebDateTime({ label, value, onChange, hint }: Omit<Props, 'minimumDate'>) {
  const [date, setDate] = useState(toDateInput(value));
  const [time, setTime] = useState(toTimeInput(value));

  function commit(nextDate: string, nextTime: string) {
    setDate(nextDate);
    setTime(nextTime);
    const parsed = parseLocalDateTime(nextDate, nextTime);
    if (parsed) onChange(parsed);
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.webRow}>
        <TextInput
          style={[styles.input, styles.webDate]}
          value={date}
          onChangeText={(next) => commit(next, time)}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textFaint}
          accessibilityLabel={`${label} date`}
        />
        <TextInput
          style={[styles.input, styles.webTime]}
          value={time}
          onChangeText={(next) => commit(date, next)}
          placeholder="HH:MM"
          placeholderTextColor={colors.textFaint}
          accessibilityLabel={`${label} time`}
        />
      </View>
      <Text style={styles.hint}>{hint ?? '24-hour time, e.g. 17:30'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  label: { ...type.label, color: colors.text },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    minHeight: 46,
  },
  pressed: { opacity: 0.85 },
  triggerText: { ...type.body, color: colors.text, flex: 1 },
  hint: { ...type.caption, color: colors.textFaint },
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  sheetTitle: { ...type.heading, color: colors.text, textAlign: 'center' },
  sheetActions: { flexDirection: 'row', gap: spacing.md },
  sheetButton: { flex: 1 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    minHeight: 46,
    ...type.body,
    color: colors.text,
  },
  webRow: { flexDirection: 'row', gap: spacing.md },
  // minWidth 0 lets these shrink inside the row. Without it the inputs keep
  // their content width and the time field runs off the edge of the card.
  webDate: { flex: 2, minWidth: 0 },
  webTime: { flex: 1, minWidth: 0 },
});

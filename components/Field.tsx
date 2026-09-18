import { useState } from 'react';
import { Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from 'react-native';
import { radius, spacing, type, type Palette } from '../lib/theme';
import { useTheme, useThemedStyles } from '../lib/appearance';

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string | null;
  multiline?: boolean;
  required?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  textContentType?: TextInputProps['textContentType'];
  maxLength?: number;
};

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  error,
  multiline,
  required,
  keyboardType,
  autoCapitalize = 'sentences',
  textContentType,
  maxLength,
}: FieldProps) {

  const c = useTheme();

  const styles = useThemedStyles(makeStyles);

  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <TextInput
        style={[
          styles.input,
          multiline && styles.multiline,
          focused && styles.inputFocused,
          Boolean(error) && styles.inputError,
        ]}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={c.textFaint}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        textAlignVertical={multiline ? 'top' : 'center'}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        textContentType={textContentType}
        maxLength={maxLength}
        accessibilityLabel={label}
      />
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

type Option<T extends string> = { value: T; label: string };

/** Single-select as a wrapping row of chips — faster to tap than a dropdown. */
export function ChipSelect<T extends string>({
  label,
  options,
  value,
  onChange,
  hint,
  required,
}: {
  label: string;
  options: readonly Option<T>[];
  value: T | null;
  onChange: (next: T) => void;
  hint?: string;
  required?: boolean;
}) {
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <View style={styles.chips}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.chip,
                selected && styles.chipSelected,
                pressed && styles.chipPressed,
              ]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function SwitchRow({
  label,
  hint,
  value,
  onValueChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
}) {

  const c = useTheme();

  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.switchRow}>
      <View style={styles.switchText}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: c.primary, false: c.borderStrong }}
        thumbColor={c.background}
        accessibilityLabel={label}
      />
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  field: { gap: spacing.sm },
  label: { ...type.label, color: c.text },
  required: { color: c.danger },
  input: {
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 46,
    ...type.body,
    color: c.text,
  },
  inputFocused: { borderColor: c.primary, backgroundColor: c.background },
  inputError: { borderColor: c.danger },
  multiline: { minHeight: 104, paddingTop: spacing.md },
  hint: { ...type.caption, color: c.textFaint },
  error: { ...type.caption, color: c.danger },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    minHeight: 40,
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: c.primarySurface, borderColor: c.primary },
  chipPressed: { opacity: 0.85 },
  chipText: { ...type.label, color: c.textMuted },
  chipTextSelected: { color: c.textInverse },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingVertical: spacing.xs,
  },
  switchText: { flex: 1, gap: 2 },
});

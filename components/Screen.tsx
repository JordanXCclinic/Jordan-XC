import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, type } from '../lib/theme';

type ScreenProps = {
  title?: string;
  subtitle?: string;
  /** Rendered opposite the title — a filter, an add button, an avatar. */
  headerRight?: React.ReactNode;
  /** Pull-to-refresh. Omit it and the control is not attached at all. */
  onRefresh?: () => Promise<void> | void;
  /** Pushed routes get their title from the navigation bar, so they skip the inset. */
  inStack?: boolean;
  /** Lifts content above the keyboard; set it on any screen with inputs. */
  avoidKeyboard?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

export function Screen({
  title,
  subtitle,
  headerRight,
  onRefresh,
  inStack,
  avoidKeyboard,
  contentStyle,
  children,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  const scroll = (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: inStack ? spacing.lg : insets.top + spacing.lg },
        // Clears the tab bar and the home indicator on gesture-nav devices.
        { paddingBottom: insets.bottom + spacing.xxxl },
        contentStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        ) : undefined
      }
    >
      {title ? (
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {headerRight}
        </View>
      ) : null}
      <View style={styles.body}>{children}</View>
    </ScrollView>
  );

  if (!avoidKeyboard) return scroll;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top}
    >
      {scroll}
    </KeyboardAvoidingView>
  );
}

export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

export function EmptyState({
  message,
  icon = 'ellipse-outline',
  action,
}: {
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={22} color={colors.primary} />
      </View>
      <Text style={styles.emptyText}>{message}</Text>
      {action}
    </View>
  );
}

export function LoadingState({ label }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.primary} />
      {label ? <Text style={styles.loadingLabel}>{label}</Text> : null}
    </View>
  );
}

/** Full-bleed centered spinner for route-level gates. */
export function FullScreenLoader() {
  return (
    <View style={styles.full}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  headerText: { flex: 1 },
  title: { ...type.display, color: colors.text },
  subtitle: { ...type.body, color: colors.textMuted, marginTop: spacing.xs },
  body: { marginTop: spacing.lg, gap: spacing.md },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  sectionTitle: { ...type.overline, color: colors.textFaint, textTransform: 'uppercase' },
  empty: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { ...type.body, color: colors.textMuted, textAlign: 'center' },
  loading: { paddingVertical: spacing.xl, alignItems: 'center', gap: spacing.sm },
  loadingLabel: { ...type.caption, color: colors.textFaint },
  full: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});

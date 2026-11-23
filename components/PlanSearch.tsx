import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { searchPlans, type PlanSearchResult } from '../lib/planSearch';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { radius, shadow, spacing, type, type Palette } from '../lib/theme';
import { useTheme, useThemedStyles } from '../lib/appearance';

/** As many results as fit above the keyboard on a phone. */
const SHOWN = 5;

type Runner = { id: string; full_name: string; role: string };
type Plan = { id: string; name: string; assignments: { athlete_id: string; starts_on: string }[] };

/**
 * The coach's search box on the Home tab: type a runner's name, or a plan's,
 * and go straight to the plan. Staff only; the screen decides who sees it.
 *
 * It sits at the bottom of Home, so it scrolls the page to its end while it is
 * in use — otherwise the keyboard comes up over the box and its results.
 */
export function PlanSearch({ scrollRef }: { scrollRef?: RefObject<ScrollView | null> }) {

  const c = useTheme();

  const styles = useThemedStyles(makeStyles);

  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [runners, setRunners] = useState<Runner[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const active = useRef(false);

  // Loaded when the coach opens the box, not with the rest of Home, so a plan
  // they assigned a minute ago is already in it.
  const load = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const [people, planRows] = await Promise.all([
      supabase.from('profiles').select('id, full_name, role').in('role', ['athlete', 'private_client']),
      supabase.from('training_plans').select('id, name, plan_assignments(athlete_id, starts_on)'),
    ]);
    if (people.error || planRows.error) {
      setError('The plans did not load. Check your connection and try again.');
      return;
    }
    setError(null);
    setRunners((people.data as Runner[] | null) ?? []);
    setPlans(
      (
        (planRows.data as
          | { id: string; name: string; plan_assignments: Plan['assignments'] | null }[]
          | null) ?? []
      ).map((plan) => ({ id: plan.id, name: plan.name, assignments: plan.plan_assignments ?? [] }))
    );
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const reveal = useCallback(() => {
    if (!active.current) return;
    requestAnimationFrame(() => scrollRef?.current?.scrollToEnd({ animated: true }));
  }, [scrollRef]);

  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', reveal);
    return () => shown.remove();
  }, [reveal]);

  const results = useMemo(() => searchPlans(runners, plans, query), [runners, plans, query]);
  const typed = query.trim();

  function open(result: PlanSearchResult) {
    Keyboard.dismiss();
    setQuery('');
    // The plan lives on the Coach tab. The anchor puts the Coach page under it,
    // so Back has somewhere to go.
    if (result.planId) router.push(`/(tabs)/coach/plans/${result.planId}`, { withAnchor: true });
    else router.push('/(tabs)/coach/plans', { withAnchor: true });
  }

  return (
    <View style={styles.wrap} onLayout={reveal}>
      <View style={[styles.box, focused && styles.boxFocused]}>
        <Ionicons name="search" size={20} color={focused ? c.primary : c.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onFocus={() => {
            active.current = true;
            setFocused(true);
            void load();
            reveal();
          }}
          onBlur={() => {
            active.current = false;
            setFocused(false);
          }}
          placeholder="Find a runner's training plan"
          placeholderTextColor={c.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Find a runner's training plan"
          style={styles.input}
        />
        {query ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear the search"
            hitSlop={10}
            onPress={() => setQuery('')}
          >
            <Ionicons name="close-circle" size={20} color={c.textFaint} />
          </Pressable>
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {typed && !error ? (
        results.length === 0 ? (
          <Text style={styles.none}>No runner or plan matches “{typed}”.</Text>
        ) : (
          <View style={styles.results}>
            {results.slice(0, SHOWN).map((result, index) => (
              <Pressable
                key={result.key}
                accessibilityRole="button"
                onPress={() => open(result)}
                style={({ pressed }) => [
                  styles.row,
                  index > 0 && styles.rowDivider,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.icon}>
                  <Ionicons
                    name={result.kind === 'runner' ? 'person' : 'barbell'}
                    size={16}
                    color={c.primary}
                  />
                </View>
                <View style={styles.text}>
                  <Text style={styles.title} numberOfLines={1}>
                    {result.name}
                  </Text>
                  <Text
                    style={[styles.sub, result.kind === 'runner' && !result.planId && styles.subMissing]}
                    numberOfLines={1}
                  >
                    {describe(result)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={c.textFaint} />
              </Pressable>
            ))}
            {results.length > SHOWN ? (
              <Text style={styles.more}>
                {results.length - SHOWN} more. Keep typing to narrow it down.
              </Text>
            ) : null}
          </View>
        )
      ) : null}
    </View>
  );
}

function describe(result: PlanSearchResult): string {
  if (result.kind === 'plan') {
    if (result.runners === 0) return 'Plan · nobody assigned';
    return `Plan · ${result.runners} ${result.runners === 1 ? 'runner' : 'runners'}`;
  }
  return result.planName ?? 'No training plan yet';
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    wrap: { gap: spacing.sm },
    box: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: c.background,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: spacing.lg,
      minHeight: 52,
      ...shadow.card,
    },
    boxFocused: { borderColor: c.primary },
    input: {
      ...type.body,
      color: c.text,
      flex: 1,
      minWidth: 0,
      paddingVertical: spacing.md,
    },
    error: { ...type.caption, color: c.danger },
    none: { ...type.caption, color: c.textMuted, paddingHorizontal: spacing.xs },
    results: {
      backgroundColor: c.background,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    pressed: { backgroundColor: c.surface },
    icon: {
      width: 32,
      height: 32,
      borderRadius: radius.pill,
      backgroundColor: c.primaryTint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    text: { flex: 1, minWidth: 0 },
    title: { ...type.bodyStrong, color: c.text },
    sub: { ...type.caption, color: c.textMuted },
    subMissing: { color: c.warning },
    more: {
      ...type.caption,
      color: c.textMuted,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
  });

import { useCallback, useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../../components/Card';
import { EmptyState, LoadingState, Screen } from '../../components/Screen';
import { formatDate } from '../../lib/format';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { POST_COLUMNS, type Post } from '../../lib/types';
import { colors, radius, spacing, type } from '../../lib/theme';

const ALL = 'All';

export default function Learn() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [category, setCategory] = useState(ALL);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('posts')
      .select(POST_COLUMNS)
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false })
      .limit(60);
    setPosts((data as Post[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const categories = useMemo(() => {
    const found = [...new Set(posts.map((post) => post.category).filter(Boolean))] as string[];
    return [ALL, ...found.sort()];
  }, [posts]);

  const shown = useMemo(
    () => (category === ALL ? posts : posts.filter((post) => post.category === category)),
    [posts, category]
  );

  return (
    <Screen
      title="Learn"
      subtitle="Training, nutrition, and racing from the coaches"
      onRefresh={load}
    >
      {categories.length > 2 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {categories.map((name) => {
            const selected = name === category;
            return (
              <Pressable
                key={name}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => setCategory(name)}
                style={[styles.filter, selected && styles.filterSelected]}
              >
                <Text style={[styles.filterText, selected && styles.filterTextSelected]}>
                  {name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {loading ? (
        <LoadingState />
      ) : shown.length === 0 ? (
        <EmptyState
          icon="book-outline"
          message="No sessions published yet. Coaching articles and videos will show up here."
        />
      ) : (
        shown.map((post) => (
          <Card key={post.id} onPress={() => router.push(`/post/${post.id}`)} style={styles.card}>
            {post.hero_image_url ? (
              <Image
                source={{ uri: post.hero_image_url }}
                style={styles.hero}
                contentFit="cover"
                transition={200}
                accessibilityIgnoresInvertColors
              />
            ) : null}
            <View style={styles.cardBody}>
              <View style={styles.metaRow}>
                {post.category ? <Text style={styles.category}>{post.category}</Text> : null}
                {post.video_url ? (
                  <View style={styles.videoTag}>
                    <Ionicons name="play-circle" size={14} color={colors.accent} />
                    <Text style={styles.videoText}>Video</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.title}>{post.title}</Text>
              {post.summary ? (
                <Text style={styles.summary} numberOfLines={3}>
                  {post.summary}
                </Text>
              ) : null}
              {post.published_at ? (
                <Text style={styles.date}>{formatDate(post.published_at)}</Text>
              ) : null}
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { gap: spacing.sm, paddingVertical: spacing.xs },
  filter: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { ...type.label, color: colors.textMuted },
  filterTextSelected: { color: colors.textInverse },
  card: { padding: 0, overflow: 'hidden' },
  hero: { width: '100%', height: 168, backgroundColor: colors.surfaceSunken },
  cardBody: { padding: spacing.lg, gap: spacing.xs },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  category: { ...type.overline, color: colors.primary },
  videoTag: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  videoText: { ...type.overline, color: colors.accent },
  title: { ...type.heading, color: colors.text },
  summary: { ...type.body, color: colors.textMuted },
  date: { ...type.caption, color: colors.textFaint, marginTop: spacing.xs },
});

import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { EmptyState, Screen } from '../../components/Screen';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { colors, radius, spacing } from '../../lib/theme';
import type { Post } from '../../lib/types';

export default function Learn() {
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase
      .from('posts')
      .select('id, title, slug, summary, body, category, hero_image_url, video_url, published_at')
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false })
      .limit(50)
      .then(({ data }) => setPosts((data as Post[]) ?? []));
  }, []);

  return (
    <Screen title="Learn" subtitle="Training, nutrition, and racing from the coaches">
      {posts.length === 0 ? (
        <EmptyState message="No articles published yet. Coaching content will appear here." />
      ) : (
        posts.map((post) => (
          <View key={post.id} style={styles.card}>
            {post.category ? <Text style={styles.category}>{post.category}</Text> : null}
            <Text style={styles.title}>{post.title}</Text>
            {post.summary ? <Text style={styles.summary}>{post.summary}</Text> : null}
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  category: { fontSize: 12, fontWeight: '700', color: colors.accent, letterSpacing: 0.5 },
  title: { fontSize: 17, fontWeight: '600', color: colors.text, marginTop: spacing.xs },
  summary: { fontSize: 15, color: colors.textMuted, marginTop: spacing.xs, lineHeight: 21 },
});

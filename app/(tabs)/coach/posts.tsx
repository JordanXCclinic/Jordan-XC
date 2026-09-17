import { useCallback, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge } from '../../../components/Badge';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { TextField } from '../../../components/Field';
import { EmptyState, LoadingState, Screen, SectionHeader } from '../../../components/Screen';
import { useAuth } from '../../../lib/auth';
import { formatDate } from '../../../lib/format';
import { isSupabaseConfigured, supabase } from '../../../lib/supabase';
import { POST_COLUMNS, type Post } from '../../../lib/types';
import { colors, spacing, type } from '../../../lib/theme';

/** Slugs are derived from the title; the suffix only appears if one collides. */
function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'post'
  );
}

export default function CoachPosts() {
  const { profile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [summary, setSummary] = useState('');
  const [body, setBody] = useState('');
  const [heroUrl, setHeroUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('posts')
      .select(POST_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(50);
    setPosts((data as Post[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(publish: boolean) {
    if (!profile) return;
    if (!title.trim() || !body.trim()) {
      setError('A title and the session itself are both needed.');
      return;
    }

    setSaving(true);
    setError(null);

    const base = slugify(title);
    const row = {
      author_id: profile.id,
      title: title.trim(),
      summary: summary.trim() || null,
      body: body.trim(),
      category: category.trim() || null,
      hero_image_url: heroUrl.trim() || null,
      video_url: videoUrl.trim() || null,
      published_at: publish ? new Date().toISOString() : null,
    };

    let { error: insertError } = await supabase.from('posts').insert({ ...row, slug: base });

    // 23505 is the unique violation on slug — retry once with a suffix rather
    // than making the coach invent a different title.
    if (insertError?.code === '23505') {
      ({ error: insertError } = await supabase
        .from('posts')
        .insert({ ...row, slug: `${base}-${Date.now().toString(36).slice(-4)}` }));
    }

    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }

    setTitle('');
    setCategory('');
    setSummary('');
    setBody('');
    setHeroUrl('');
    setVideoUrl('');
    await load();
  }

  async function setPublished(post: Post, published: boolean) {
    await supabase
      .from('posts')
      .update({ published_at: published ? new Date().toISOString() : null })
      .eq('id', post.id);
    await load();
  }

  function confirmDelete(post: Post) {
    const remove = async () => {
      await supabase.from('posts').delete().eq('id', post.id);
      await load();
    };
    if (Platform.OS === 'web') {
      void remove();
      return;
    }
    Alert.alert('Delete this session?', post.title, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void remove() },
    ]);
  }

  return (
    <Screen
      inStack
      title="Learn"
      subtitle="Educational sessions — the evergreen counterpart to announcements."
      onRefresh={load}
      avoidKeyboard
    >
      <Card accent="primary">
        <Text style={styles.cardTitle}>New session</Text>
        <View style={styles.fields}>
          <TextField
            label="Title"
            value={title}
            onChangeText={setTitle}
            placeholder="How to warm up before a hard workout"
            required
          />
          <TextField
            label="Category"
            value={category}
            onChangeText={setCategory}
            placeholder="Training"
            hint="Groups sessions on the Learn tab. Training, Nutrition, Racing…"
          />
          <TextField
            label="Summary"
            value={summary}
            onChangeText={setSummary}
            placeholder="Ten minutes that decide how the next forty go."
            multiline
          />
          <TextField
            label="The session"
            value={body}
            onChangeText={setBody}
            placeholder="Start with five minutes of easy jogging…"
            multiline
            required
          />
          <TextField
            label="Image URL"
            value={heroUrl}
            onChangeText={setHeroUrl}
            placeholder="https://jordanxcclinic.com/…"
            hint="Optional. A public link — images on the clinic site work well."
            autoCapitalize="none"
          />
          <TextField
            label="Video URL"
            value={videoUrl}
            onChangeText={setVideoUrl}
            placeholder="https://youtube.com/…"
            autoCapitalize="none"
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.actions}>
          <Button
            label="Save draft"
            variant="secondary"
            onPress={() => create(false)}
            style={styles.action}
          />
          <Button label="Publish" loading={saving} onPress={() => create(true)} style={styles.action} />
        </View>
      </Card>

      <SectionHeader title="Sessions" />

      {loading ? (
        <LoadingState />
      ) : posts.length === 0 ? (
        <EmptyState icon="book-outline" message="Nothing published yet." />
      ) : (
        posts.map((post) => {
          const published = Boolean(post.published_at);
          return (
            <Card key={post.id}>
              <View style={styles.head}>
                <Text style={styles.itemTitle}>{post.title}</Text>
                <Badge label={published ? 'Live' : 'Draft'} tone={published ? 'success' : 'warning'} />
              </View>

              {post.summary ? (
                <Text style={styles.itemBody} numberOfLines={2}>
                  {post.summary}
                </Text>
              ) : null}

              <View style={styles.metaRow}>
                <Text style={styles.meta}>{post.category ?? 'Uncategorised'}</Text>
                {post.published_at ? (
                  <Text style={styles.meta}>{formatDate(post.published_at)}</Text>
                ) : null}
              </View>

              <View style={styles.rowActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void setPublished(post, !published)}
                  style={({ pressed }) => [styles.rowAction, pressed && styles.pressed]}
                >
                  <Ionicons
                    name={published ? 'eye-off-outline' : 'send-outline'}
                    size={16}
                    color={colors.primary}
                  />
                  <Text style={styles.rowActionText}>{published ? 'Unpublish' : 'Publish'}</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => confirmDelete(post)}
                  style={({ pressed }) => [styles.rowAction, pressed && styles.pressed]}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  <Text style={[styles.rowActionText, styles.danger]}>Delete</Text>
                </Pressable>
              </View>
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: { ...type.heading, color: colors.text },
  fields: { gap: spacing.lg, marginTop: spacing.lg },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  action: { flex: 1 },
  error: { ...type.caption, color: colors.danger, marginTop: spacing.md },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  itemTitle: { ...type.heading, color: colors.text, flex: 1 },
  itemBody: { ...type.body, color: colors.textMuted, marginTop: spacing.sm },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md },
  meta: { ...type.caption, color: colors.textFaint },
  rowActions: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowAction: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowActionText: { ...type.label, color: colors.primary },
  danger: { color: colors.danger },
  pressed: { opacity: 0.7 },
});

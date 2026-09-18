import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { EmptyState, LoadingState, Screen } from '../../components/Screen';
import { useAuth } from '../../lib/auth';
import { formatDate } from '../../lib/format';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { POST_COLUMNS, type Post } from '../../lib/types';
import { radius, spacing, type, type Palette } from '../../lib/theme';
import { useTheme, useThemedStyles } from '../../lib/appearance';
import { useReducedMotion } from '../../lib/a11y';

export default function PostDetail() {

  const c = useTheme();
  const calm = useReducedMotion();

  const styles = useThemedStyles(makeStyles);

  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [done, setDone] = useState(false);
  const [marking, setMarking] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !id) {
      setLoading(false);
      return;
    }
    const [{ data }, { data: completion }] = await Promise.all([
      supabase.from('posts').select(POST_COLUMNS).eq('id', id).maybeSingle(),
      supabase.from('lesson_completions').select('id').eq('post_id', id).maybeSingle(),
    ]);
    setPost((data as Post | null) ?? null);
    setDone(Boolean(completion));
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleDone() {
    if (!id || !profile) return;
    setMarking(true);

    if (done) {
      await supabase
        .from('lesson_completions')
        .delete()
        .eq('post_id', id)
        .eq('profile_id', profile.id);
      setDone(false);
    } else {
      const { error } = await supabase
        .from('lesson_completions')
        .upsert({ post_id: id, profile_id: profile.id }, { onConflict: 'post_id,profile_id' });
      if (!error) setDone(true);
    }

    setMarking(false);
  }

  if (loading) {
    return (
      <Screen inStack>
        <LoadingState />
      </Screen>
    );
  }

  if (!post) {
    return (
      <Screen inStack>
        <EmptyState icon="document-outline" message="That article is no longer available." />
      </Screen>
    );
  }

  return (
    <Screen inStack>
      {post.hero_image_url ? (
        <Image
          source={{ uri: post.hero_image_url }}
          style={styles.hero}
          contentFit="cover"
          transition={calm ? 0 : 200}
          accessibilityIgnoresInvertColors
        />
      ) : null}

      <View style={styles.head}>
        {post.category ? <Text style={styles.category}>{post.category}</Text> : null}
        <Text style={styles.title} accessibilityRole="header">
          {post.title}
        </Text>
        {post.published_at ? (
          <Text style={styles.date}>{formatDate(post.published_at)}</Text>
        ) : null}
      </View>

      {post.summary ? <Text style={styles.summary}>{post.summary}</Text> : null}

      {post.video_url ? (
        <Button
          label="Watch the video"
          icon="play"
          onPress={() => void WebBrowser.openBrowserAsync(post.video_url!)}
        />
      ) : null}

      <Text style={styles.body}>{post.body}</Text>

      {/* Marking your own is the only way it happens: a coach ticking it off
          for someone would make the count mean nothing. */}
      <Button
        label={done ? 'Done — tap to undo' : 'Mark as done'}
        icon={done ? 'checkmark-circle' : 'checkmark-circle-outline'}
        variant={done ? 'secondary' : 'primary'}
        full
        loading={marking}
        onPress={toggleDone}
        style={styles.done}
      />
    </Screen>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  hero: {
    width: '100%',
    height: 200,
    borderRadius: radius.lg,
    backgroundColor: c.surfaceSunken,
  },
  head: { gap: spacing.xs },
  category: { ...type.overline, color: c.primary },
  title: { ...type.display, color: c.text, fontSize: 26, lineHeight: 32 },
  date: { ...type.caption, color: c.textFaint },
  summary: {
    ...type.body,
    color: c.text,
    fontWeight: '600',
    borderLeftWidth: 3,
    borderLeftColor: c.primary,
    paddingLeft: spacing.md,
  },
  body: { ...type.body, color: c.textMuted, lineHeight: 25 },
  done: { marginTop: spacing.lg },
});

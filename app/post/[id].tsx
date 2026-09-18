import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { EmptyState, LoadingState, Screen } from '../../components/Screen';
import { formatDate } from '../../lib/format';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { POST_COLUMNS, type Post } from '../../lib/types';
import { radius, spacing, type, type Palette } from '../../lib/theme';
import { useTheme, useThemedStyles } from '../../lib/appearance';

export default function PostDetail() {

  const c = useTheme();

  const styles = useThemedStyles(makeStyles);

  const { id } = useLocalSearchParams<{ id: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !id) {
      setLoading(false);
      return;
    }
    const { data } = await supabase.from('posts').select(POST_COLUMNS).eq('id', id).maybeSingle();
    setPost((data as Post | null) ?? null);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

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
          transition={200}
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
});

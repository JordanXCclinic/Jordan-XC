import { useCallback, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge } from '../../../components/Badge';
import { confirmDestructive } from '../../../lib/confirm';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { AudiencePicker } from '../../../components/AudiencePicker';
import { TextField } from '../../../components/Field';
import { EmptyState, LoadingState, Screen, SectionHeader } from '../../../components/Screen';
import { useAuth } from '../../../lib/auth';
import { formatDate } from '../../../lib/format';
import { isSupabaseConfigured, supabase } from '../../../lib/supabase';
import { AUDIENCE_LABELS, POST_COLUMNS, type Audience, type Post } from '../../../lib/types';
import { spacing, type, type Palette } from '../../../lib/theme';
import { useTheme, useThemedStyles } from '../../../lib/appearance';

/** A session as the coach sees it: with who it is for. */
type CoachPost = Post & { audience: Audience; audience_athlete_id: string | null };

/** What the form edits: everything about a session but whether it is live. */
type Draft = {
  title: string;
  category: string;
  summary: string;
  body: string;
  heroUrl: string;
  videoUrl: string;
  audience: Audience;
  audienceAthlete: string | null;
};

const EMPTY: Draft = {
  title: '',
  category: '',
  summary: '',
  body: '',
  heroUrl: '',
  videoUrl: '',
  audience: 'everyone',
  audienceAthlete: null,
};

function draftOf(post: CoachPost): Draft {
  return {
    title: post.title,
    category: post.category ?? '',
    summary: post.summary ?? '',
    body: post.body,
    heroUrl: post.hero_image_url ?? '',
    videoUrl: post.video_url ?? '',
    audience: post.audience,
    audienceAthlete: post.audience_athlete_id,
  };
}

/** The columns a draft writes. Whether it is live is set apart, by Publish. */
function rowOf(draft: Draft) {
  return {
    title: draft.title.trim(),
    summary: draft.summary.trim() || null,
    body: draft.body.trim(),
    category: draft.category.trim() || null,
    hero_image_url: draft.heroUrl.trim() || null,
    video_url: draft.videoUrl.trim() || null,
    audience: draft.audience,
    audience_athlete_id: draft.audienceAthlete,
  };
}

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

  const c = useTheme();

  const styles = useThemedStyles(makeStyles);

  const { profile } = useAuth();
  const [posts, setPosts] = useState<CoachPost[]>([]);
  /** Names for sessions meant for one runner, so the list can say who. */
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  /** The session being changed in place, if any. */
  const [editingId, setEditingId] = useState<string | null>(null);
  /** Bumped after a new session is saved, so the form starts empty again. */
  const [formKey, setFormKey] = useState(0);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('posts')
      .select(`${POST_COLUMNS}, audience, audience_athlete_id`)
      .order('created_at', { ascending: false })
      .limit(50);
    const list = (data as CoachPost[] | null) ?? [];
    setPosts(list);

    const ids = [...new Set(list.map((post) => post.audience_athlete_id).filter(Boolean))] as string[];
    if (ids.length > 0) {
      const { data: people } = await supabase.from('profiles').select('id, full_name').in('id', ids);
      setNames(
        Object.fromEntries(
          ((people as { id: string; full_name: string }[] | null) ?? []).map((p) => [p.id, p.full_name])
        )
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(draft: Draft, publish: boolean): Promise<string | null> {
    if (!profile) return 'Not signed in.';
    const row = {
      ...rowOf(draft),
      author_id: profile.id,
      published_at: publish ? new Date().toISOString() : null,
    };
    const base = slugify(draft.title);

    let { error: insertError } = await supabase.from('posts').insert({ ...row, slug: base });

    // 23505 is the unique violation on slug — retry once with a suffix rather
    // than making the coach invent a different title.
    if (insertError?.code === '23505') {
      ({ error: insertError } = await supabase
        .from('posts')
        .insert({ ...row, slug: `${base}-${Date.now().toString(36).slice(-4)}` }));
    }
    if (insertError) return insertError.message;

    setFormKey((key) => key + 1);
    await load();
    return null;
  }

  // The slug stays as it was, so a link already shared keeps working; whether
  // it is live stays too. A live session changed here sends no notification:
  // the notify function only announces one the moment it goes live.
  async function saveChanges(post: CoachPost, draft: Draft): Promise<string | null> {
    const { error: updateError } = await supabase.from('posts').update(rowOf(draft)).eq('id', post.id);
    if (updateError) return updateError.message;
    setEditingId(null);
    await load();
    return null;
  }

  async function setPublished(post: CoachPost, published: boolean) {
    await supabase
      .from('posts')
      .update({ published_at: published ? new Date().toISOString() : null })
      .eq('id', post.id);
    await load();
  }

  async function confirmDelete(post: CoachPost) {
    if (!(await confirmDestructive('Delete this session?', post.title))) return;
    await supabase.from('posts').delete().eq('id', post.id);
    await load();
  }

  function audienceLabel(post: CoachPost): string {
    if (post.audience_athlete_id) return `Only ${names[post.audience_athlete_id] ?? 'one runner'}`;
    return AUDIENCE_LABELS[post.audience] ?? 'Everyone';
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
        <PostForm
          key={formKey}
          initial={EMPTY}
          onSubmit={(draft) => create(draft, true)}
          submitLabel="Publish"
          onSecondary={(draft) => create(draft, false)}
          secondaryLabel="Save draft"
        />
      </Card>

      <SectionHeader title="Sessions" />

      {loading ? (
        <LoadingState />
      ) : posts.length === 0 ? (
        <EmptyState icon="book-outline" message="Nothing published yet." />
      ) : (
        posts.map((post) => {
          const published = Boolean(post.published_at);

          if (editingId === post.id) {
            return (
              <Card key={post.id} accent="primary">
                <Text style={styles.cardTitle}>Edit session</Text>
                <Text style={styles.editNote}>
                  {published
                    ? 'It stays live while you edit. Saving updates it for everyone who can see it.'
                    : 'Still a draft. Publish it from the list when it is ready.'}
                </Text>
                <PostForm
                  initial={draftOf(post)}
                  onSubmit={(draft) => saveChanges(post, draft)}
                  submitLabel="Save changes"
                  onCancel={() => setEditingId(null)}
                />
              </Card>
            );
          }

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

              <View style={styles.audienceRow}>
                <Ionicons name="people-outline" size={15} color={c.textMuted} />
                <Text style={styles.audienceText}>{audienceLabel(post)}</Text>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.meta}>{post.category ?? 'Uncategorised'}</Text>
                {post.published_at ? (
                  <Text style={styles.meta}>{formatDate(post.published_at)}</Text>
                ) : null}
              </View>

              <View style={styles.rowActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${post.title}, or change who sees it`}
                  onPress={() => setEditingId(post.id)}
                  disabled={editingId !== null}
                  style={({ pressed }) => [
                    styles.rowAction,
                    editingId !== null && styles.off,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons name="create-outline" size={16} color={c.primary} />
                  <Text style={styles.rowActionText}>Edit</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => void setPublished(post, !published)}
                  style={({ pressed }) => [styles.rowAction, pressed && styles.pressed]}
                >
                  <Ionicons
                    name={published ? 'eye-off-outline' : 'send-outline'}
                    size={16}
                    color={c.primary}
                  />
                  <Text style={styles.rowActionText}>{published ? 'Unpublish' : 'Publish'}</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => void confirmDelete(post)}
                  style={({ pressed }) => [styles.rowAction, pressed && styles.pressed]}
                >
                  <Ionicons name="trash-outline" size={16} color={c.danger} />
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

/**
 * The session's fields, for writing a new one or changing one in place. The
 * caller decides what saving does and returns an error message, or null.
 */
function PostForm({
  initial,
  onSubmit,
  submitLabel,
  onSecondary,
  secondaryLabel,
  onCancel,
}: {
  initial: Draft;
  onSubmit: (draft: Draft) => Promise<string | null>;
  submitLabel: string;
  onSecondary?: (draft: Draft) => Promise<string | null>;
  secondaryLabel?: string;
  onCancel?: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const [draft, setDraft] = useState<Draft>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof Draft>(field: K) => (value: Draft[K]) =>
    setDraft((current) => ({ ...current, [field]: value }));

  async function run(action: (draft: Draft) => Promise<string | null>) {
    if (!draft.title.trim() || !draft.body.trim()) {
      setError('A title and the session itself are both needed.');
      return;
    }
    setSaving(true);
    setError(null);
    const problem = await action(draft);
    setSaving(false);
    if (problem) setError(problem);
  }

  return (
    <>
      <View style={styles.fields}>
        <TextField
          label="Title"
          value={draft.title}
          onChangeText={set('title')}
          placeholder="How to warm up before a hard workout"
          required
        />
        <TextField
          label="Category"
          value={draft.category}
          onChangeText={set('category')}
          placeholder="Training"
          hint="Groups sessions on the Learn tab. Training, Nutrition, Racing…"
        />
        <TextField
          label="Summary"
          value={draft.summary}
          onChangeText={set('summary')}
          placeholder="Ten minutes that decide how the next forty go."
          multiline
        />
        <TextField
          label="The session"
          value={draft.body}
          onChangeText={set('body')}
          placeholder="Start with five minutes of easy jogging…"
          multiline
          required
        />
        <TextField
          label="Image URL"
          value={draft.heroUrl}
          onChangeText={set('heroUrl')}
          placeholder="https://jordanxcclinic.com/…"
          hint="Optional. A public link — images on the clinic site work well."
          autoCapitalize="none"
        />
        <AudiencePicker
          audience={draft.audience}
          onAudienceChange={set('audience')}
          athleteId={draft.audienceAthlete}
          onAthleteChange={set('audienceAthlete')}
        />
        <TextField
          label="Video URL"
          value={draft.videoUrl}
          onChangeText={set('videoUrl')}
          placeholder="https://youtube.com/…"
          autoCapitalize="none"
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        {onSecondary ? (
          <Button
            label={secondaryLabel ?? 'Save'}
            variant="secondary"
            onPress={() => void run(onSecondary)}
            style={styles.action}
          />
        ) : null}
        {onCancel ? (
          <Button label="Cancel" variant="secondary" onPress={onCancel} style={styles.action} />
        ) : null}
        <Button
          label={submitLabel}
          loading={saving}
          onPress={() => void run(onSubmit)}
          style={styles.action}
        />
      </View>
    </>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  cardTitle: { ...type.heading, color: c.text },
  editNote: { ...type.caption, color: c.textMuted, marginTop: spacing.xs },
  fields: { gap: spacing.lg, marginTop: spacing.lg },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  action: { flex: 1 },
  error: { ...type.caption, color: c.danger, marginTop: spacing.md },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  itemTitle: { ...type.heading, color: c.text, flex: 1 },
  itemBody: { ...type.body, color: c.textMuted, marginTop: spacing.sm },
  audienceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md },
  audienceText: { ...type.label, color: c.textMuted },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  meta: { ...type.caption, color: c.textFaint },
  rowActions: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  rowAction: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowActionText: { ...type.label, color: c.primary },
  danger: { color: c.danger },
  off: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
});

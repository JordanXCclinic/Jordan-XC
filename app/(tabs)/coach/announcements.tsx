import { useCallback, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge } from '../../../components/Badge';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { ChipSelect, TextField } from '../../../components/Field';
import { EmptyState, LoadingState, Screen, SectionHeader } from '../../../components/Screen';
import { useAuth } from '../../../lib/auth';
import { formatRelative } from '../../../lib/format';
import { isSupabaseConfigured, supabase } from '../../../lib/supabase';
import {
  ANNOUNCEMENT_COLUMNS,
  AUDIENCE_LABELS,
  type Announcement,
  type Audience,
} from '../../../lib/types';
import { colors, spacing, type } from '../../../lib/theme';

const AUDIENCES = (Object.keys(AUDIENCE_LABELS) as Audience[]).map((value) => ({
  value,
  label: AUDIENCE_LABELS[value],
}));

export default function CoachAnnouncements() {
  const { profile } = useAuth();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<Audience>('everyone');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    // Coaches see drafts too; the select policy lets staff past published_at.
    const { data } = await supabase
      .from('announcements')
      .select(ANNOUNCEMENT_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(50);
    setItems((data as Announcement[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(publish: boolean) {
    if (!profile) return;
    if (!title.trim() || !body.trim()) {
      setError('A title and a message are both needed.');
      return;
    }

    setSaving(true);
    setError(null);

    const { error: insertError } = await supabase.from('announcements').insert({
      author_id: profile.id,
      title: title.trim(),
      body: body.trim(),
      audience,
      published_at: publish ? new Date().toISOString() : null,
    });

    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }

    setTitle('');
    setBody('');
    setAudience('everyone');
    await load();
  }

  async function setPublished(item: Announcement, published: boolean) {
    await supabase
      .from('announcements')
      .update({ published_at: published ? new Date().toISOString() : null })
      .eq('id', item.id);
    await load();
  }

  function confirmDelete(item: Announcement) {
    const remove = async () => {
      await supabase.from('announcements').delete().eq('id', item.id);
      await load();
    };
    if (Platform.OS === 'web') {
      void remove();
      return;
    }
    Alert.alert('Delete this announcement?', item.title, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void remove() },
    ]);
  }

  return (
    <Screen
      inStack
      title="Announcements"
      subtitle="Time-sensitive news. Everything here shows on the family home screen."
      onRefresh={load}
      avoidKeyboard
    >
      <Card accent="primary">
        <Text style={styles.cardTitle}>New announcement</Text>
        <View style={styles.fields}>
          <TextField
            label="Title"
            value={title}
            onChangeText={setTitle}
            placeholder="Thursday practice moved to 7am"
            required
          />
          <TextField
            label="Message"
            value={body}
            onChangeText={setBody}
            placeholder="Heat index is climbing, so we are starting early. Same place."
            multiline
            required
          />
          <ChipSelect
            label="Who sees it"
            options={AUDIENCES}
            value={audience}
            onChange={setAudience}
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
          <Button
            label="Publish"
            loading={saving}
            onPress={() => create(true)}
            style={styles.action}
          />
        </View>
      </Card>

      <SectionHeader title="Posted" />

      {loading ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <EmptyState icon="megaphone-outline" message="Nothing posted yet." />
      ) : (
        items.map((item) => {
          const published = Boolean(item.published_at);
          return (
            <Card key={item.id}>
              <View style={styles.head}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Badge
                  label={published ? 'Live' : 'Draft'}
                  tone={published ? 'success' : 'warning'}
                />
              </View>

              <Text style={styles.itemBody}>{item.body}</Text>

              <View style={styles.metaRow}>
                <Text style={styles.meta}>{AUDIENCE_LABELS[item.audience]}</Text>
                <Text style={styles.meta}>
                  {formatRelative(item.published_at ?? item.created_at)}
                </Text>
              </View>

              <View style={styles.rowActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void setPublished(item, !published)}
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
                  onPress={() => confirmDelete(item)}
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

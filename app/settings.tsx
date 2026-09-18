import { useState } from 'react';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Card, ListRow } from '../components/Card';
import { SwitchRow } from '../components/Field';
import { Screen, SectionHeader } from '../components/Screen';
import { useAuth } from '../lib/auth';
import { roleLabel } from '../lib/format';
import { PRIVACY_POLICY_URL, SUPPORT_EMAIL, TERMS_URL, isPrivateRelay, providerLabel } from '../lib/legal';
import {
  DEFAULT_PREFS,
  PREF_LABELS,
  disableNotifications,
  enableNotifications,
  savePrefs,
  type NotificationPrefs,
} from '../lib/notifications';
import { supabase } from '../lib/supabase';
import { colors, radius, spacing, type } from '../lib/theme';
import { CLINIC_URL } from './sign-in';

export default function Settings() {
  const { profile, session, signOut, refreshProfile } = useAuth();
  const [pushOn, setPushOn] = useState(Boolean(profile?.push_token));
  const [prefs, setPrefs] = useState<NotificationPrefs>(profile?.notification_prefs ?? DEFAULT_PREFS);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const email = session?.user?.email ?? null;
  const provider = session?.user?.app_metadata?.provider as string | undefined;
  const relay = isPrivateRelay(email);

  async function togglePush(next: boolean) {
    if (!profile) return;
    setPushBusy(true);
    setPushError(null);

    if (!next) {
      const problem = await disableNotifications(profile.id);
      setPushBusy(false);
      if (problem) setPushError(problem);
      else setPushOn(false);
      await refreshProfile();
      return;
    }

    // Permission is only ever asked for here, on a deliberate tap — never on
    // launch, where iOS would burn the single prompt it allows.
    const { ok, error: problem } = await enableNotifications(profile.id);
    setPushBusy(false);
    setPushOn(ok);
    if (problem) setPushError(problem);
    await refreshProfile();
  }

  async function togglePref(key: keyof NotificationPrefs, value: boolean) {
    if (!profile) return;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    const problem = await savePrefs(profile.id, next);
    if (problem) {
      setPrefs(prefs);
      setPushError(problem);
    }
  }

  async function exportData() {
    setBusy(true);
    setError(null);
    setNote(null);

    const { data, error: rpcError } = await supabase.rpc('export_my_data');
    if (rpcError) {
      setBusy(false);
      setError(rpcError.message);
      return;
    }

    const contents = JSON.stringify(data, null, 2);

    // Web has no share sheet and no writable file system, so it falls back to
    // the clipboard rather than failing.
    if (Platform.OS === 'web' || !(await Sharing.isAvailableAsync())) {
      await Clipboard.setStringAsync(contents);
      setBusy(false);
      setNote('Your data has been copied to the clipboard.');
      return;
    }

    try {
      const file = new FileSystem.File(FileSystem.Paths.cache, 'jordan-xc-my-data.json');
      file.create({ overwrite: true });
      file.write(contents);
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/json',
        dialogTitle: 'Your Jordan XC Clinic data',
      });
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'That export could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    setBusy(true);
    setError(null);

    const { error: rpcError } = await supabase.rpc('delete_my_account');

    if (rpcError) {
      setBusy(false);
      setError(rpcError.message);
      return;
    }

    // The row is gone; clearing the session sends the gate back to sign-in.
    setConfirming(false);
    setBusy(false);
    await signOut();
    router.replace('/sign-in');
  }

  return (
    <Screen inStack title="Settings" subtitle={profile?.full_name ?? undefined}>
      <Card>
        <Text style={styles.cardTitle}>Account</Text>
        <View style={styles.rows}>
          <Detail label="Name" value={profile?.full_name ?? '—'} />
          <Detail label="Role" value={profile ? roleLabel(profile.role) : '—'} />
          <Detail label="Signed in with" value={provider ? providerLabel(provider) : "\u2014"} />
          <Detail label="Email" value={email ?? '—'} />
        </View>

        {relay ? (
          <View style={styles.relay}>
            <Ionicons name="eye-off-outline" size={16} color={colors.warning} />
            <Text style={styles.relayText}>
              This is an Apple private relay address. Mail still reaches you, but it will not
              match the address on your clinic registration.
            </Text>
          </View>
        ) : null}
      </Card>

      <SectionHeader title="Privacy" />
      <ListRow
        icon="shield-checkmark-outline"
        title="Privacy policy"
        subtitle="How we handle your family's information"
        onPress={() => void WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL)}
      />
      <ListRow
        icon="document-text-outline"
        title="Terms of use"
        onPress={() => void WebBrowser.openBrowserAsync(TERMS_URL)}
      />
      <ListRow
        icon="mail-outline"
        title="Contact the clinic"
        subtitle={SUPPORT_EMAIL}
        onPress={() => void WebBrowser.openBrowserAsync(`mailto:${SUPPORT_EMAIL}`)}
      />
      <ListRow
        icon="globe-outline"
        title="jordanxcclinic.com"
        subtitle="Registration, payment, and waivers"
        onPress={() => void WebBrowser.openBrowserAsync(CLINIC_URL)}
      />

      <SectionHeader title="Notifications" />
      <Card>
        <SwitchRow
          label="Notifications on this phone"
          hint={
            pushBusy
              ? 'Just a moment…'
              : 'Practice changes are the reason this exists. You can pick which ones below.'
          }
          value={pushOn}
          onValueChange={(next) => void togglePush(next)}
        />

        {pushOn ? (
          <View style={styles.prefs}>
            {(Object.keys(PREF_LABELS) as (keyof NotificationPrefs)[]).map((key) => (
              <SwitchRow
                key={key}
                label={PREF_LABELS[key].title}
                hint={PREF_LABELS[key].hint}
                value={prefs[key]}
                onValueChange={(next) => void togglePref(key, next)}
              />
            ))}
          </View>
        ) : null}

        {pushError ? <Text style={styles.error}>{pushError}</Text> : null}
      </Card>

      <SectionHeader title="Your data" />
      <Card>
        <Text style={styles.cardTitle}>Take a copy</Text>
        <Text style={styles.cardHint}>
          Everything the clinic holds about you: your profile, personal bests, training logs,
          and meetings. Yours to keep.
        </Text>
        <Button
          label="Export my data"
          icon="download-outline"
          variant="secondary"
          full
          loading={busy && !confirming}
          onPress={exportData}
          style={styles.action}
        />
        {note ? <Text style={styles.note}>{note}</Text> : null}
      </Card>

      <Card accent="danger">
        <Text style={styles.cardTitle}>Delete your account</Text>
        <Text style={styles.cardHint}>
          This removes your profile, your intake form, your personal bests, and your training
          logs for good. It cannot be undone, and you would need a new clinic code to come back.
        </Text>
        <Button
          label="Delete my account"
          icon="trash-outline"
          variant="danger"
          full
          onPress={() => {
            setError(null);
            setConfirming(true);
          }}
          style={styles.action}
        />
      </Card>

      {error && !confirming ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        accessibilityRole="button"
        onPress={() => void signOut()}
        style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
      >
        <Ionicons name="log-out-outline" size={18} color={colors.textMuted} />
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>

      <Modal
        visible={confirming}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirming(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.dialog}>
            <ScrollView contentContainerStyle={styles.dialogBody}>
              <View style={styles.dialogIcon}>
                <Ionicons name="warning" size={22} color={colors.danger} />
              </View>
              <Text style={styles.dialogTitle}>Delete your account?</Text>
              <Text style={styles.dialogText}>
                Your profile, intake form, personal bests, training logs, and any booked
                meetings will be permanently deleted. This cannot be undone.
              </Text>
              <Text style={styles.dialogText}>
                If you only want to stop notifications, sign out instead.
              </Text>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <View style={styles.dialogActions}>
                <Button
                  label="Keep my account"
                  variant="secondary"
                  full
                  onPress={() => setConfirming(false)}
                />
                <Button
                  label="Delete for good"
                  variant="danger"
                  full
                  loading={busy}
                  onPress={deleteAccount}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cardTitle: { ...type.heading, color: colors.text },
  cardHint: { ...type.caption, color: colors.textMuted, marginTop: spacing.xs, lineHeight: 17 },
  rows: { marginTop: spacing.md, gap: spacing.sm },
  detail: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.lg },
  detailLabel: { ...type.caption, color: colors.textFaint },
  detailValue: { ...type.body, color: colors.text, flexShrink: 1 },
  relay: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.warningTint,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  relayText: { ...type.caption, color: colors.warning, flex: 1, lineHeight: 17 },
  action: { marginTop: spacing.lg },
  prefs: {
    gap: spacing.lg,
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  note: { ...type.caption, color: colors.success, marginTop: spacing.md },
  error: { ...type.caption, color: colors.danger, marginTop: spacing.md },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
  },
  pressed: { opacity: 0.7 },
  signOutText: { ...type.bodyStrong, color: colors.textMuted },
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  dialog: {
    backgroundColor: colors.background,
    borderRadius: radius.xl,
    maxWidth: 420,
    width: '100%',
    maxHeight: '80%',
  },
  dialogBody: { padding: spacing.xl, gap: spacing.md },
  dialogIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.dangerTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogTitle: { ...type.title, color: colors.text },
  dialogText: { ...type.body, color: colors.textMuted },
  // Stacked rather than side by side: "Keep my account" does not fit on half a
  // phone's width, and a full-width destructive button is harder to mis-tap.
  dialogActions: { gap: spacing.md, marginTop: spacing.sm },
});

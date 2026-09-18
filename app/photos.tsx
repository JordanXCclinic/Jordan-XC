import { useCallback, useEffect, useState } from 'react';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Button } from '../components/Button';
import { EmptyState, LoadingState, Screen } from '../components/Screen';
import { useAuth } from '../lib/auth';
import { formatDate } from '../lib/format';
import { deletePhoto, signPhotoUrls, uploadPhoto } from '../lib/photos';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { PHOTO_COLUMNS, isCoach, type Photo } from '../lib/types';
import { radius, spacing, type, type Palette } from '../lib/theme';
import { useTheme, useThemedStyles } from '../lib/appearance';

const GUTTER = spacing.sm;
const COLUMNS = 2;

export default function Photos() {

  const c = useTheme();

  const styles = useThemedStyles(makeStyles);

  const { profile, role } = useAuth();
  const { width } = useWindowDimensions();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [viewing, setViewing] = useState<Photo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const staff = isCoach(role);
  // Two columns inside the screen's 16pt gutters, minus the gap between them.
  const tile = (width - spacing.lg * 2 - GUTTER * (COLUMNS - 1)) / COLUMNS;

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data } = await supabase
      .from('photos')
      .select(PHOTO_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(120);

    const rows = (data as Photo[] | null) ?? [];
    setPhotos(rows);
    // The bucket is private, so every tile needs a freshly signed link.
    setUrls(await signPhotoUrls(rows.map((photo) => photo.storage_path)));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addPhotos() {
    if (!profile) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo access is off. Turn it on in Settings to post pictures.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 10,
      quality: 0.75,
      base64: true,
    });

    if (result.canceled) return;

    setUploading(true);
    setError(null);

    for (const asset of result.assets) {
      const { path, error: uploadError } = await uploadPhoto(asset);
      if (uploadError || !path) {
        setError(uploadError ?? 'That photo could not be uploaded.');
        continue;
      }
      const { error: insertError } = await supabase
        .from('photos')
        .insert({ storage_path: path, uploaded_by: profile.id });
      if (insertError) setError(insertError.message);
    }

    setUploading(false);
    await load();
  }

  function confirmDelete(photo: Photo) {
    const remove = async () => {
      const message = await deletePhoto(photo.id, photo.storage_path);
      if (message) setError(message);
      setViewing(null);
      await load();
    };

    if (Platform.OS === 'web') {
      void remove();
      return;
    }

    Alert.alert('Delete this photo?', 'It will be removed for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void remove() },
    ]);
  }

  return (
    <Screen
      inStack
      title="Clinic photos"
      subtitle="From practices, workouts, and meets."
      onRefresh={load}
    >
      {staff ? (
        <Button
          label={uploading ? 'Uploading…' : 'Add photos'}
          icon="cloud-upload-outline"
          loading={uploading}
          onPress={addPhotos}
          full
        />
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <LoadingState />
      ) : photos.length === 0 ? (
        <EmptyState
          icon="images-outline"
          message={
            staff
              ? 'No photos yet. Add a few from practice and the whole clinic will see them.'
              : 'No photos yet. Pictures from practices and meets show up here.'
          }
        />
      ) : (
        <View style={styles.grid}>
          {photos.map((photo) => (
            <Pressable
              key={photo.id}
              accessibilityRole="imagebutton"
              accessibilityLabel={photo.caption ?? 'Clinic photo'}
              onPress={() => setViewing(photo)}
              style={({ pressed }) => [
                styles.tile,
                { width: tile, height: tile },
                pressed && styles.pressed,
              ]}
            >
              <Image
                source={urls[photo.storage_path] ? { uri: urls[photo.storage_path] } : null}
                style={styles.image}
                contentFit="cover"
                transition={180}
                accessibilityIgnoresInvertColors
              />
            </Pressable>
          ))}
        </View>
      )}

      <Modal
        visible={viewing !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setViewing(null)}
      >
        <View style={styles.viewer}>
          <Pressable style={styles.viewerBackdrop} onPress={() => setViewing(null)} />

          <Image
            source={
              viewing && urls[viewing.storage_path] ? { uri: urls[viewing.storage_path] } : null
            }
            style={styles.viewerImage}
            contentFit="contain"
            transition={160}
            accessibilityIgnoresInvertColors
          />

          <View style={styles.viewerBar}>
            <View style={styles.viewerText}>
              {viewing?.caption ? <Text style={styles.caption}>{viewing.caption}</Text> : null}
              {viewing ? (
                <Text style={styles.captionMeta}>
                  {formatDate(viewing.taken_on ?? viewing.created_at)}
                </Text>
              ) : null}
            </View>

            {staff && viewing ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete photo"
                onPress={() => confirmDelete(viewing)}
                hitSlop={10}
              >
                <Ionicons name="trash-outline" size={22} color={c.textInverse} />
              </Pressable>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={() => setViewing(null)}
              hitSlop={10}
            >
              <Ionicons name="close" size={24} color={c.textInverse} />
            </Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GUTTER },
  tile: {
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: c.surfaceSunken,
  },
  pressed: { opacity: 0.85 },
  image: { width: '100%', height: '100%' },
  error: { ...type.caption, color: c.danger },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', justifyContent: 'center' },
  viewerBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  viewerImage: { width: '100%', height: '70%' },
  viewerBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  viewerText: { flex: 1, gap: 2 },
  caption: { ...type.bodyStrong, color: c.textInverse },
  captionMeta: { ...type.caption, color: c.borderStrong },
});

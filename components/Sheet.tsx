import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useThemedStyles } from '../lib/appearance';
import { useReducedMotion } from '../lib/a11y';
import { radius, spacing, type Palette } from '../lib/theme';

/** A panel that slides up from the bottom, closed by tapping above it. */
export function Sheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const calm = useReducedMotion();
  const styles = useThemedStyles(makeStyles);

  return (
    <Modal
      visible={open}
      transparent
      animationType={calm ? 'none' : 'slide'}
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: c.overlay },
    sheet: {
      backgroundColor: c.background,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      maxHeight: '88%',
    },
    grabber: {
      width: 36,
      height: 4,
      borderRadius: radius.pill,
      backgroundColor: c.borderStrong,
      alignSelf: 'center',
      marginTop: spacing.md,
    },
    content: { padding: spacing.xl, gap: spacing.lg },
  });

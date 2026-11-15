import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as Haptics from 'expo-haptics';
import {
  Animated,
  PanResponder,
  Platform,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type GestureResponderHandlers,
  type LayoutChangeEvent,
} from 'react-native';
import { useReducedMotion } from '../lib/a11y';
import { spacing } from '../lib/theme';

const GAP = spacing.md;

/** What a row gives its drag handle: the touch handlers and a move-by-one for screen readers. */
export type DragHandle = {
  handlers: GestureResponderHandlers;
  accessibilityActions: { name: string; label: string }[];
  onAccessibilityAction: (event: AccessibilityActionEvent) => void;
};

/**
 * The final position of a row dragged from `from`, given where its middle now
 * sits. It goes after every other row whose middle is above it.
 */
export function dropIndex(from: number, centre: number, middles: number[]): number {
  let index = 0;
  middles.forEach((middle, row) => {
    if (row !== from && middle < centre) index += 1;
  });
  return index;
}

/** Moves one item, the way the list will look once a drag is dropped. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = items.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}

/**
 * A list whose rows can be dragged into a new order by a handle.
 *
 * Built on PanResponder and Animated, which ship inside React Native, so it
 * reaches phones as an over-the-air update: a gesture library would mean a new
 * store build. Rows may differ in height; each is measured as it lays out.
 */
export function DraggableList<T>({
  items,
  keyOf,
  renderItem,
  onReorder,
  onDragChange,
  enabled = true,
}: {
  items: readonly T[];
  keyOf: (item: T) => string;
  renderItem: (item: T, handle: DragHandle | null, dragging: boolean) => ReactNode;
  /** A row was dropped somewhere new: from its old index to its new one. */
  onReorder: (from: number, to: number) => void;
  /** Dragging started or stopped; the screen stops scrolling meanwhile. */
  onDragChange?: (dragging: boolean) => void;
  enabled?: boolean;
}) {
  const calm = useReducedMotion();
  const layouts = useRef<Record<string, { y: number; height: number }>>({});
  const offsets = useRef<Record<string, Animated.Value>>({});
  const lift = useRef(new Animated.Value(0)).current;
  const [dragging, setDragging] = useState<string | null>(null);
  const drag = useRef<{ from: number; to: number; key: string } | null>(null);

  const keys = useMemo(() => items.map(keyOf), [items, keyOf]);
  const keysRef = useRef(keys);
  keysRef.current = keys;
  // Read through refs: a row's touch handlers are made once and must not be
  // swapped mid-drag, or the gesture loses how far it has moved.
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const reorderRef = useRef(onReorder);
  reorderRef.current = onReorder;
  const dragChangeRef = useRef(onDragChange);
  dragChangeRef.current = onDragChange;
  const handles = useRef<Record<string, DragHandle>>({});

  function offsetOf(key: string): Animated.Value {
    return (offsets.current[key] ??= new Animated.Value(0));
  }

  // A new order from outside starts every row back in its own place.
  useEffect(() => {
    for (const key of keys) offsetOf(key).setValue(0);
    // offsetOf reads a ref; the keys are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys]);

  /** Slides the other rows aside to show where the dragged one would land. */
  function makeRoom(from: number, to: number) {
    const draggedKey = keysRef.current[from]!;
    const space = (layouts.current[draggedKey]?.height ?? 0) + GAP;
    keysRef.current.forEach((key, row) => {
      if (row === from) return;
      const shift = from < to && row > from && row <= to ? -space : to < from && row >= to && row < from ? space : 0;
      if (calm) offsetOf(key).setValue(shift);
      else
        Animated.timing(offsetOf(key), { toValue: shift, duration: 140, useNativeDriver: Platform.OS !== 'web' }).start();
    });
  }

  function finish() {
    const done = drag.current;
    drag.current = null;
    // Everything back in place in the same moment the new order lands, so no
    // row is drawn shifted on top of its new position.
    lift.setValue(0);
    for (const key of keysRef.current) offsetOf(key).setValue(0);
    setDragging(null);
    dragChangeRef.current?.(false);
    if (done && done.to !== done.from) reorderRef.current(done.from, done.to);
  }

  function handleFor(key: string): DragHandle {
    const made = handles.current[key];
    if (made) return made;
    const responder = PanResponder.create({
      // Claimed on the press, or on the first movement (a mouse on the web
      // only gets as far as that), and never while another row is being
      // dragged: a handle the pointer passes over must not take the drag.
      onStartShouldSetPanResponder: () => enabledRef.current && !drag.current,
      onStartShouldSetPanResponderCapture: () => enabledRef.current && !drag.current,
      onMoveShouldSetPanResponder: () => enabledRef.current && !drag.current,
      onMoveShouldSetPanResponderCapture: () => enabledRef.current && !drag.current,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: () => {
        if (drag.current) return;
        const from = keysRef.current.indexOf(key);
        drag.current = { from, to: from, key };
        lift.setValue(0);
        setDragging(key);
        dragChangeRef.current?.(true);
        if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      },
      onPanResponderMove: (_event, gesture) => {
        const current = drag.current;
        if (!current || current.key !== key) return;
        lift.setValue(gesture.dy);
        const own = layouts.current[key];
        if (!own) return;
        const centre = own.y + own.height / 2 + gesture.dy;
        const middles = keysRef.current.map((k) => {
          const box = layouts.current[k];
          return box ? box.y + box.height / 2 : 0;
        });
        const to = dropIndex(current.from, centre, middles);
        if (to !== current.to) {
          current.to = to;
          makeRoom(current.from, to);
          if (Platform.OS !== 'web') void Haptics.selectionAsync();
        }
      },
      onPanResponderRelease: () => {
        if (drag.current?.key === key) finish();
      },
      onPanResponderTerminate: () => {
        if (drag.current?.key === key) finish();
      },
    });

    const handle: DragHandle = {
      handlers: responder.panHandlers,
      accessibilityActions: [
        { name: 'moveUp', label: 'Move up' },
        { name: 'moveDown', label: 'Move down' },
      ],
      onAccessibilityAction: (event) => {
        const from = keysRef.current.indexOf(key);
        const to = event.nativeEvent.actionName === 'moveUp' ? from - 1 : from + 1;
        if (to >= 0 && to < keysRef.current.length) reorderRef.current(from, to);
      },
    };
    handles.current[key] = handle;
    return handle;
  }

  return (
    <View style={styles.list}>
      {items.map((item, index) => {
        const key = keys[index]!;
        const isDragging = dragging === key;
        return (
          <Animated.View
            key={key}
            onLayout={(event: LayoutChangeEvent) => {
              const { y, height } = event.nativeEvent.layout;
              layouts.current[key] = { y, height };
            }}
            style={[
              isDragging ? styles.lifted : null,
              { transform: [{ translateY: isDragging ? lift : offsetOf(key) }] },
            ]}
          >
            {renderItem(item, enabled ? handleFor(key) : null, isDragging)}
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: GAP },
  lifted: {
    zIndex: 10,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
});

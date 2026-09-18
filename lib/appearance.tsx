import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import { darkColors, lightColors, type Palette } from './theme';

export type ThemeMode = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'jxc.appearance';

type AppearanceState = {
  /** What the person chose. */
  mode: ThemeMode;
  setMode: (next: ThemeMode) => void;
  /** What that resolves to right now, once the device is taken into account. */
  scheme: 'light' | 'dark';
  colors: Palette;
};

const AppearanceContext = createContext<AppearanceState | undefined>(undefined);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const device = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    // A stored preference is a convenience, not state worth blocking paint for,
    // so the app renders in the device's scheme until it arrives.
    void AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setModeState(stored);
      }
    });
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const scheme: 'light' | 'dark' =
    mode === 'system' ? (device === 'dark' ? 'dark' : 'light') : mode;

  const value = useMemo<AppearanceState>(
    () => ({ mode, setMode, scheme, colors: scheme === 'dark' ? darkColors : lightColors }),
    [mode, setMode, scheme]
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): AppearanceState {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error('useAppearance must be used inside AppearanceProvider');
  return context;
}

/** The active palette. What components reach for. */
export const useTheme = (): Palette => useAppearance().colors;

/**
 * Styles built from the active palette, rebuilt only when the palette changes.
 *
 * Screens define `makeStyles = (c: Palette) => StyleSheet.create({...})` at
 * module scope and call this inside the component, which is what lets a colour
 * follow the theme instead of being frozen at import time.
 */
export function useThemedStyles<T>(factory: (c: Palette) => T): T {
  const colors = useTheme();
  return useMemo(() => factory(colors), [factory, colors]);
}

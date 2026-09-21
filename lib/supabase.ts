import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

// Placeholder values keep the client constructible before a Supabase project
// exists; screens check isSupabaseConfigured before querying.
export const supabase = createClient(url ?? 'https://placeholder.supabase.co', anonKey ?? 'placeholder', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // The web signs in by redirecting the page, so the session comes back in
    // the returned URL and has to be read out of it. The phone apps hand the
    // result to setSession themselves, and leaving this on there would mean
    // parsing deep links that are none of its business.
    detectSessionInUrl: Platform.OS === 'web',
  },
});

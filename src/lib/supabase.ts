import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const hasPlaceholderConfig = /your-project|your-anon-key|placeholder/i.test(`${supabaseUrl} ${supabaseAnonKey}`);
const isValidProjectUrl = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(supabaseUrl);

export const isSupabaseConfigured = isValidProjectUrl && supabaseAnonKey.length > 20 && !hasPlaceholderConfig;

export const supabase = createClient<Database>(
  isSupabaseConfigured ? supabaseUrl : 'https://not-configured.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'not-configured',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: true,
    },
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  },
);

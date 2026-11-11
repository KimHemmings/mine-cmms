import { createBrowserClient } from '@supabase/ssr';
import { publicEnv } from '@/utils/env';

export const createClient = () =>
  createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey);

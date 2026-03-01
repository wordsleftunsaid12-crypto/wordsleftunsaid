import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from '../config/env.js';

let anonClient: SupabaseClient | null = null;
let serviceClient: SupabaseClient | null = null;

export function getAnonClient(): SupabaseClient {
  if (anonClient) return anonClient;
  const env = getEnv();
  anonClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  return anonClient;
}

export function getServiceClient(): SupabaseClient {
  if (serviceClient) return serviceClient;
  const env = getEnv();
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for service client');
  }
  serviceClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  return serviceClient;
}

import { z } from 'zod';

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GA_MEASUREMENT_ID: z.string().optional(),
  // Instagram (Graph API — optional, browser automation is the default)
  INSTAGRAM_ACCESS_TOKEN: z.string().optional(),
  INSTAGRAM_BUSINESS_ACCOUNT_ID: z.string().optional(),
  FACEBOOK_APP_ID: z.string().optional(),
  FACEBOOK_APP_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (cachedEnv) return cachedEnv;
  cachedEnv = envSchema.parse(process.env);
  return cachedEnv;
}

export function getEnvSafe(): Env | null {
  try {
    return getEnv();
  } catch {
    return null;
  }
}

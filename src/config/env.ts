import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  N8N_API_TOKEN: z.string().min(1),
  GITHUB_APP_ID: z.string().min(1),
  GITHUB_APP_PRIVATE_KEY: z.string().optional().default(''),
  GITHUB_APP_PRIVATE_KEY_PATH: z.string().optional().default(''),
  GITHUB_WEBHOOK_SECRET: z.string().min(1),
  GITHUB_INSTALLATION_ID: z.string().optional().default(''),
  LOG_LEVEL: z.string().default('info'),
  MAX_PATCH_BYTES: z.coerce.number().int().positive().default(100_000),
  MAX_MANIFEST_FILES: z.coerce.number().int().positive().default(200),
  GITHUB_API_MAX_RETRIES: z.coerce.number().int().min(0).default(3),
  CURSOR_API_KEY: z.string().min(1),
  CURSOR_MODEL_ID: z.string().default('composer-2.5'),
  AI_REVIEW_MAX_FILES: z.coerce.number().int().positive().default(40),
  AI_REVIEW_MAX_PROMPT_CHARS: z.coerce
    .number()
    .int()
    .positive()
    .default(120_000),
});

export type AppEnv = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): AppEnv {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  return parsed.data;
}

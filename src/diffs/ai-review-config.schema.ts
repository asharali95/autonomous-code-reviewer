import { z } from 'zod';

export const DEFAULT_IGNORE_GLOBS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/.git/**',
  '**/coverage/**',
  '**/package-lock.json',
  '**/yarn.lock',
  '**/pnpm-lock.yaml',
];

export const riskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);

export const aiReviewConfigSchema = z.object({
  ignore: z.array(z.string()).optional().default([]),
  riskRules: z
    .array(
      z.object({
        glob: z.string().min(1),
        risk: riskLevelSchema,
      }),
    )
    .optional()
    .default([]),
  maxFileBytes: z.number().int().positive().optional(),
});

export type AiReviewConfig = z.infer<typeof aiReviewConfigSchema>;
export type RiskLevel = z.infer<typeof riskLevelSchema>;

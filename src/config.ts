import { z } from 'zod';
import type { BridgeConfig } from './types.js';

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().int().positive().default(8787),
  HOST: z.string().default('127.0.0.1'),
  LOG_LEVEL: z.string().default('info'),
  ALEXA_SKILL_ID: z.string().min(1),
  ALEXA_USER_HASH_SALT: z.string().min(16),
  ALLOW_UNSIGNED_ALEXA_REQUESTS: z.string().optional(),
  OPENCLAW_ASSISTANT_ID: z.string().min(1).default('assistant'),
  OPENCLAW_ADAPTER: z.enum(['cli', 'http']).default('cli'),
  OPENCLAW_CLI_BIN: z.string().min(1).default('openclaw'),
  OPENCLAW_CLI_TIMEOUT_MS: z.coerce.number().int().positive().default(2500),
  OPENCLAW_CLI_DRAIN_TIMEOUT_MS: z.coerce.number().int().positive().default(120000),
  OPENCLAW_CLI_THINKING: z.string().optional(),
  OPENCLAW_DELIVER_REPLY: z.coerce.boolean().default(false),
  OPENCLAW_REPLY_CHANNEL: z.string().min(1).optional(),
  OPENCLAW_REPLY_TO: z.string().min(1).optional(),
  OPENCLAW_WORKDIR: z.string().min(1).optional(),
  OPENCLAW_SESSION_KEY: z.string().min(1).default('agent:assistant:main'),
  OPENCLAW_MESSAGE_STYLE: z.enum(['detailed', 'compact']).default('detailed'),
  ALEXA_MESSAGE_PREFIX: z.string().min(1).optional(),
  OPENCLAW_INGEST_URL: z.string().url().optional(),
  OPENCLAW_INGEST_TOKEN: z.string().optional(),
  QUEUE_PATH: z.string().min(1).default('./data/queue.jsonl'),
  QUEUE_DRAIN_INTERVAL_MS: z.coerce.number().int().nonnegative().default(30000),
  QUEUE_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),
  BRIDGE_INTERNAL_TOKEN: z.string().min(24),
  HA_URL: z.string().url().optional(),
  HA_TOKEN: z.string().optional(),
  HA_WEBHOOK_ID: z.string().optional(),
  HA_DEFAULT_TARGET: z.string().optional(),
  HA_ALLOWED_TARGETS: z.string().default(''),
  ANNOUNCEMENT_MAX_LENGTH: z.coerce.number().int().positive().default(240),
  ANNOUNCEMENT_RATE_LIMIT_MS: z.coerce.number().int().nonnegative().default(30000)
});

export function parseTargetMap(value: string): Map<string, string> {
  const targets = new Map<string, string>();
  for (const part of value.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const [alias, entity] = trimmed.includes('=') ? trimmed.split('=', 2) : [trimmed, trimmed];
    const key = alias.trim();
    const resolved = entity.trim();
    if (key && resolved) targets.set(key, resolved);
  }
  return targets;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): BridgeConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Invalid bridge configuration: ${missing}`);
  }

  const raw = parsed.data;
  const allowUnsigned = raw.ALLOW_UNSIGNED_ALEXA_REQUESTS === 'true';
  if (allowUnsigned && raw.NODE_ENV === 'production') {
    throw new Error('ALLOW_UNSIGNED_ALEXA_REQUESTS cannot be true in production');
  }
  if (raw.OPENCLAW_ADAPTER === 'http' && (!raw.OPENCLAW_INGEST_URL || !raw.OPENCLAW_INGEST_TOKEN)) {
    throw new Error('OPENCLAW_INGEST_URL and OPENCLAW_INGEST_TOKEN are required for OPENCLAW_ADAPTER=http');
  }
  if (raw.OPENCLAW_DELIVER_REPLY && (!raw.OPENCLAW_REPLY_CHANNEL || !raw.OPENCLAW_REPLY_TO)) {
    throw new Error('OPENCLAW_REPLY_CHANNEL and OPENCLAW_REPLY_TO are required when OPENCLAW_DELIVER_REPLY=true');
  }

  return {
    port: raw.PORT,
    host: raw.HOST,
    logLevel: raw.LOG_LEVEL,
    nodeEnv: raw.NODE_ENV,
    alexaSkillId: raw.ALEXA_SKILL_ID,
    alexaUserHashSalt: raw.ALEXA_USER_HASH_SALT,
    allowUnsignedAlexaRequests: allowUnsigned,
    assistantId: raw.OPENCLAW_ASSISTANT_ID,
    openclawAdapter: raw.OPENCLAW_ADAPTER,
    openclawCliBin: raw.OPENCLAW_CLI_BIN,
    openclawCliTimeoutMs: raw.OPENCLAW_CLI_TIMEOUT_MS,
    openclawCliDrainTimeoutMs: raw.OPENCLAW_CLI_DRAIN_TIMEOUT_MS,
    openclawCliThinking: raw.OPENCLAW_CLI_THINKING,
    openclawDeliverReply: raw.OPENCLAW_DELIVER_REPLY,
    openclawReplyChannel: raw.OPENCLAW_REPLY_CHANNEL,
    openclawReplyTo: raw.OPENCLAW_REPLY_TO,
    openclawWorkdir: raw.OPENCLAW_WORKDIR,
    openclawSessionKey: raw.OPENCLAW_SESSION_KEY,
    openclawMessageStyle: raw.OPENCLAW_MESSAGE_STYLE,
    alexaMessagePrefix: raw.ALEXA_MESSAGE_PREFIX,
    openclawIngestUrl: raw.OPENCLAW_INGEST_URL,
    openclawIngestToken: raw.OPENCLAW_INGEST_TOKEN,
    queuePath: raw.QUEUE_PATH,
    queueDrainIntervalMs: raw.QUEUE_DRAIN_INTERVAL_MS,
    queueMaxAttempts: raw.QUEUE_MAX_ATTEMPTS,
    bridgeInternalToken: raw.BRIDGE_INTERNAL_TOKEN,
    haUrl: raw.HA_URL,
    haToken: raw.HA_TOKEN,
    haWebhookId: raw.HA_WEBHOOK_ID,
    haDefaultTarget: raw.HA_DEFAULT_TARGET,
    haAllowedTargets: parseTargetMap(raw.HA_ALLOWED_TARGETS),
    announcementMaxLength: raw.ANNOUNCEMENT_MAX_LENGTH,
    announcementRateLimitMs: raw.ANNOUNCEMENT_RATE_LIMIT_MS
  };
}

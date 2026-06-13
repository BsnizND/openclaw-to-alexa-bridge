export interface BridgeConfig {
  port: number;
  host: string;
  logLevel: string;
  nodeEnv: string;
  alexaSkillId: string;
  alexaUserHashSalt: string;
  allowUnsignedAlexaRequests: boolean;
  assistantId: string;
  openclawAdapter: 'cli' | 'http';
  openclawCliBin: string;
  openclawCliTimeoutMs: number;
  openclawCliDrainTimeoutMs: number;
  openclawCliThinking?: string;
  openclawSessionKey: string;
  openclawIngestUrl?: string;
  openclawIngestToken?: string;
  queuePath: string;
  queueDrainIntervalMs: number;
  queueMaxAttempts: number;
  bridgeInternalToken: string;
  haUrl?: string;
  haToken?: string;
  haWebhookId?: string;
  haDefaultTarget?: string;
  haAllowedTargets: Map<string, string>;
  announcementMaxLength: number;
  announcementRateLimitMs: number;
}

export interface NormalizedAlexaEvent {
  source: 'alexa_skill';
  assistant: string;
  raw_text: string;
  captured_at: string;
  locale?: string;
  request_id?: string;
  session_id?: string;
  skill_id?: string;
  user_id_hash?: string;
  device_id_hash?: string;
}

export interface DeliveryResult {
  ok: boolean;
  id?: string;
  queued?: boolean;
}

export interface QueueRecord {
  status: 'pending' | 'delivered' | 'failed';
  created_at: string;
  attempts: number;
  event: NormalizedAlexaEvent;
  last_error?: string;
  last_attempt_at?: string;
  delivered_at?: string;
}

export interface AnnounceRequest {
  message?: unknown;
  target?: unknown;
  mode?: unknown;
}

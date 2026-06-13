import type { BridgeConfig } from './types.js';

const lastAnnouncement = new Map<string, number>();

export function resolveTarget(config: BridgeConfig, requested: unknown): string {
  const target = typeof requested === 'string' && requested.trim() ? requested.trim() : config.haDefaultTarget;
  if (!target) throw new Error('target required');
  const resolved = config.haAllowedTargets.get(target);
  if (!resolved) throw new Error('target not allowed');
  return resolved;
}

export async function sendAnnouncement(config: BridgeConfig, message: string, requestedTarget: unknown): Promise<void> {
  if (!config.haUrl || (!config.haToken && !config.haWebhookId)) throw new Error('Home Assistant is not configured');
  const trimmed = message.trim();
  if (!trimmed) throw new Error('message required');
  if (trimmed.length > config.announcementMaxLength) throw new Error('message too long');
  const entityId = resolveTarget(config, requestedTarget);

  const key = `${entityId}:${trimmed}`;
  const now = Date.now();
  const last = lastAnnouncement.get(key) || 0;
  if (config.announcementRateLimitMs > 0 && now - last < config.announcementRateLimitMs) {
    throw new Error('announcement rate limited');
  }

  const baseUrl = config.haUrl.replace(/\/$/, '');
  const res = config.haToken
    ? await fetch(`${baseUrl}/api/services/notify/send_message`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.haToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ entity_id: entityId, message: trimmed })
      })
    : await fetch(`${baseUrl}/api/webhook/${config.haWebhookId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ entity_id: entityId, message: trimmed })
      });

  if (!res.ok) throw new Error(`Home Assistant failed with HTTP ${res.status}`);
  lastAnnouncement.set(key, now);
}

export function resetAnnouncementRateLimits(): void {
  lastAnnouncement.clear();
}

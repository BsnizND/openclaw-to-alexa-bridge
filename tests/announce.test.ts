import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetAnnouncementRateLimits, resolveTarget, sendAnnouncement } from '../src/announce.js';
import type { BridgeConfig } from '../src/types.js';

function config(overrides: Partial<BridgeConfig> = {}): BridgeConfig {
  return {
    haUrl: 'http://homeassistant.local:8123',
    haToken: 'ha-token',
    haDefaultTarget: 'office',
    haAllowedTargets: new Map([
      ['office', 'notify.office_echo'],
      ['everywhere', 'notify.everywhere']
    ]),
    announcementMaxLength: 40,
    announcementRateLimitMs: 1000,
    ...overrides
  } as BridgeConfig;
}

describe('announcement controls', () => {
  beforeEach(() => {
    resetAnnouncementRateLimits();
    vi.restoreAllMocks();
  });

  it('resolves aliases through an allowlist', () => {
    expect(resolveTarget(config(), 'office')).toBe('notify.office_echo');
    expect(() => resolveTarget(config(), 'bedroom')).toThrow(/not allowed/);
  });

  it('caps message length', async () => {
    await expect(sendAnnouncement(config(), 'x'.repeat(41), 'office')).rejects.toThrow(/too long/);
  });

  it('calls Home Assistant notify service', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await sendAnnouncement(config(), 'Jay bridge test.', 'office');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://homeassistant.local:8123/api/services/notify/send_message',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ entity_id: 'notify.office_echo', message: 'Jay bridge test.' })
      })
    );
  });

  it('can call a narrow Home Assistant webhook instead of storing a REST token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await sendAnnouncement(config({ haToken: undefined, haWebhookId: 'bridge-webhook-id' }), 'Jay bridge test.', 'office');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://homeassistant.local:8123/api/webhook/bridge-webhook-id',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ entity_id: 'notify.office_echo', message: 'Jay bridge test.' })
      })
    );
  });

  it('rate-limits repeated announcements', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    await sendAnnouncement(config(), 'Repeat', 'office');
    await expect(sendAnnouncement(config(), 'Repeat', 'office')).rejects.toThrow(/rate limited/);
  });
});

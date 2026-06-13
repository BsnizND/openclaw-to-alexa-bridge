import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import type { BridgeConfig } from '../src/types.js';

function config(): BridgeConfig {
  return {
    logLevel: 'silent',
    allowUnsignedAlexaRequests: true,
    bridgeInternalToken: '0123456789abcdef01234567',
    alexaSkillId: 'amzn1.ask.skill.test',
    alexaUserHashSalt: '0123456789abcdef',
    assistantId: 'jay',
    haAllowedTargets: new Map([['office', 'notify.office_echo']])
  } as BridgeConfig;
}

describe('app routes', () => {
  it('serves health without sensitive details', async () => {
    const res = await request(createApp(config())).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('rejects unauthorized announcement calls', async () => {
    const res = await request(createApp(config()))
      .post('/internal/announce')
      .send({ message: 'hello', target: 'office' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
  });

  it('uses injected announcement dependency for authorized calls', async () => {
    const announce = vi.fn().mockResolvedValue(undefined);
    const res = await request(createApp(config(), { announce }))
      .post('/internal/announce')
      .set('Authorization', 'Bearer 0123456789abcdef01234567')
      .send({ message: 'hello', target: 'office' });
    expect(res.status).toBe(200);
    expect(announce).toHaveBeenCalledWith('hello', 'office');
  });

  it('does not expose unknown routes', async () => {
    const res = await request(createApp(config())).get('/logs');
    expect(res.status).toBe(404);
  });
});


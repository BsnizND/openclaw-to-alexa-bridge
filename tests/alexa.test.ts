import { describe, expect, it } from 'vitest';
import { buildNormalizedEvent } from '../src/alexa.js';
import type { BridgeConfig } from '../src/types.js';

const config = {
  alexaSkillId: 'amzn1.ask.skill.test',
  alexaUserHashSalt: '0123456789abcdef',
  assistantId: 'jay'
} as BridgeConfig;

describe('Alexa event normalization', () => {
  it('normalizes message events and hashes Amazon identifiers', () => {
    const event = buildNormalizedEvent(
      {
        request: { locale: 'en-US', requestId: 'request-1' },
        session: { sessionId: 'session-1' },
        context: {
          System: {
            application: { applicationId: 'amzn1.ask.skill.test' },
            user: { userId: 'raw-user' },
            device: { deviceId: 'raw-device' }
          }
        }
      },
      'remember the network tech comes Friday',
      config
    );

    expect(event.source).toBe('alexa_skill');
    expect(event.adapter).toBe('alexa');
    expect(event.assistant).toBe('jay');
    expect(event.raw_text).toBe('remember the network tech comes Friday');
    expect(event.user_id_hash).toMatch(/^sha256:/);
    expect(event.user_id_hash).not.toContain('raw-user');
    expect(event.device_id_hash).not.toContain('raw-device');
  });
});

import { describe, expect, it } from 'vitest';
import { loadConfig, parseTargetMap } from '../src/config.js';

const baseEnv = {
  ALEXA_SKILL_ID: 'amzn1.ask.skill.test',
  ALEXA_USER_HASH_SALT: '0123456789abcdef',
  BRIDGE_INTERNAL_TOKEN: '0123456789abcdef01234567'
};

describe('config', () => {
  it('fails loudly when required config is missing', () => {
    expect(() => loadConfig({})).toThrow(/ALEXA_SKILL_ID/);
  });

  it('rejects unsigned Alexa requests in production', () => {
    expect(() =>
      loadConfig({
        ...baseEnv,
        NODE_ENV: 'production',
        ALLOW_UNSIGNED_ALEXA_REQUESTS: 'true'
      })
    ).toThrow(/ALLOW_UNSIGNED_ALEXA_REQUESTS/);
  });

  it('parses target aliases', () => {
    const targets = parseTargetMap('office=notify.office_echo,notify.everywhere');
    expect(targets.get('office')).toBe('notify.office_echo');
    expect(targets.get('notify.everywhere')).toBe('notify.everywhere');
  });

  it('loads OpenClaw voice-ingress delivery options', () => {
    const config = loadConfig({
      ...baseEnv,
      OPENCLAW_ASSISTANT_ID: 'assistant',
      OPENCLAW_DELIVER_REPLY: 'true',
      OPENCLAW_REPLY_CHANNEL: 'telegram',
      OPENCLAW_REPLY_TO: 'telegram:12345',
      OPENCLAW_WORKDIR: '/tmp/openclaw',
      OPENCLAW_MESSAGE_STYLE: 'compact',
      ALEXA_MESSAGE_PREFIX: 'Sent via Alexa voice message:'
    });

    expect(config.assistantId).toBe('assistant');
    expect(config.openclawDeliverReply).toBe(true);
    expect(config.openclawReplyChannel).toBe('telegram');
    expect(config.openclawReplyTo).toBe('telegram:12345');
    expect(config.openclawWorkdir).toBe('/tmp/openclaw');
    expect(config.openclawMessageStyle).toBe('compact');
    expect(config.alexaMessagePrefix).toBe('Sent via Alexa voice message:');
  });

  it('requires reply routing when OpenClaw delivery is enabled', () => {
    expect(() =>
      loadConfig({
        ...baseEnv,
        OPENCLAW_DELIVER_REPLY: 'true'
      })
    ).toThrow(/OPENCLAW_REPLY_CHANNEL and OPENCLAW_REPLY_TO/);
  });
});

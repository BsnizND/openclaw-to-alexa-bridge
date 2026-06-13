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
});


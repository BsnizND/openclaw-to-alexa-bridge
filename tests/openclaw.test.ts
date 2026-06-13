import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { deliverToOpenClaw, drainOpenClawQueue } from '../src/openclaw.js';
import type { BridgeConfig, NormalizedAlexaEvent } from '../src/types.js';

describe('OpenClaw delivery', () => {
  it('queues inbound Alexa events immediately instead of blocking the request', async () => {
    const dir = join(tmpdir(), `openclaw-alexa-test-${Date.now()}`);
    await mkdir(dir, { recursive: true });
    const queuePath = join(dir, 'queue.jsonl');
    const event: NormalizedAlexaEvent = {
      source: 'alexa_skill',
      assistant: 'jay',
      raw_text: 'remember dog food',
      captured_at: new Date().toISOString()
    };

    const result = await deliverToOpenClaw(
      {
        openclawAdapter: 'cli',
        openclawCliBin: '/missing/openclaw',
        openclawCliTimeoutMs: 2500,
        openclawCliDrainTimeoutMs: 120000,
        assistantId: 'jay',
        openclawSessionKey: 'agent:jay:main',
        queuePath,
        queueMaxAttempts: 3
      } as BridgeConfig,
      event
    );

    expect(result).toEqual({ ok: true, queued: true });
    const queued = await readFile(queuePath, 'utf8');
    expect(queued).toContain('remember dog food');
    expect(queued).toContain('"status":"pending"');
    expect(queued).toContain('queued for asynchronous OpenClaw delivery');
    await rm(dir, { recursive: true, force: true });
  });

  it('drains queued events through the OpenClaw CLI and marks them delivered', async () => {
    const dir = join(tmpdir(), `openclaw-alexa-drain-test-${Date.now()}`);
    await mkdir(dir, { recursive: true });
    const queuePath = join(dir, 'queue.jsonl');
    const binPath = join(dir, 'fake-openclaw');
    const argsPath = join(dir, 'args.txt');
    await writeFile(binPath, `#!/bin/sh\nprintf '%s\\n' "$@" > '${argsPath}'\n`, 'utf8');
    await chmod(binPath, 0o755);

    const event: NormalizedAlexaEvent = {
      source: 'alexa_skill',
      assistant: 'jay',
      raw_text: 'drain this message',
      captured_at: new Date().toISOString()
    };

    const config = {
      openclawAdapter: 'cli',
      openclawCliBin: binPath,
      openclawCliTimeoutMs: 25,
      openclawCliDrainTimeoutMs: 1000,
      openclawCliThinking: 'minimal',
      assistantId: 'jay',
      openclawSessionKey: 'agent:jay:main',
      queuePath,
      queueMaxAttempts: 3
    } as BridgeConfig;

    await deliverToOpenClaw(config, event);
    const drain = await drainOpenClawQueue(config);

    expect(drain).toEqual({ delivered: 1, failed: 0, pending: 0 });
    const queue = await readFile(queuePath, 'utf8');
    expect(queue).toContain('"status":"delivered"');
    expect(queue).toContain('"attempts":1');
    expect(queue).toContain('"delivered_at"');
    const args = await readFile(argsPath, 'utf8');
    expect(args).toContain('--message');
    expect(args).toContain('drain this message');
    expect(args).toContain('--thinking');
    expect(args).toContain('minimal');
    await rm(dir, { recursive: true, force: true });
  });

  it('marks queued events failed after the configured attempt limit', async () => {
    const dir = join(tmpdir(), `openclaw-alexa-failed-drain-test-${Date.now()}`);
    await mkdir(dir, { recursive: true });
    const queuePath = join(dir, 'queue.jsonl');
    const binPath = join(dir, 'failing-openclaw');
    await writeFile(binPath, '#!/bin/sh\necho nope >&2\nexit 2\n', 'utf8');
    await chmod(binPath, 0o755);

    const event: NormalizedAlexaEvent = {
      source: 'alexa_skill',
      assistant: 'jay',
      raw_text: 'this should fail visibly',
      captured_at: new Date().toISOString()
    };

    const config = {
      openclawAdapter: 'cli',
      openclawCliBin: binPath,
      openclawCliTimeoutMs: 25,
      openclawCliDrainTimeoutMs: 1000,
      assistantId: 'jay',
      openclawSessionKey: 'agent:jay:main',
      queuePath,
      queueMaxAttempts: 1
    } as BridgeConfig;

    await deliverToOpenClaw(config, event);
    const drain = await drainOpenClawQueue(config);

    expect(drain).toEqual({ delivered: 0, failed: 1, pending: 0 });
    const queue = await readFile(queuePath, 'utf8');
    expect(queue).toContain('"status":"failed"');
    expect(queue).toContain('openclaw exited 2');
    await rm(dir, { recursive: true, force: true });
  });

  it('does not let a slow CLI block the Alexa request path', async () => {
    const dir = join(tmpdir(), `openclaw-alexa-timeout-test-${Date.now()}`);
    await mkdir(dir, { recursive: true });
    const queuePath = join(dir, 'queue.jsonl');
    const binPath = join(dir, 'slow-openclaw');
    await writeFile(binPath, '#!/bin/sh\nsleep 3\n', 'utf8');
    await chmod(binPath, 0o755);

    const event: NormalizedAlexaEvent = {
      source: 'alexa_skill',
      assistant: 'jay',
      raw_text: 'this should not block alexa',
      captured_at: new Date().toISOString()
    };

    const startedAt = Date.now();
    const result = await deliverToOpenClaw(
      {
        openclawAdapter: 'cli',
        openclawCliBin: binPath,
        openclawCliTimeoutMs: 25,
        openclawCliDrainTimeoutMs: 120000,
        assistantId: 'jay',
        openclawSessionKey: 'agent:jay:main',
        queuePath,
        queueMaxAttempts: 3
      } as BridgeConfig,
      event
    );

    expect(Date.now() - startedAt).toBeLessThan(1000);
    expect(result).toEqual({ ok: true, queued: true });
    const queued = await readFile(queuePath, 'utf8');
    expect(queued).toContain('this should not block alexa');
    expect(queued).not.toContain('openclaw delivery exceeded 25ms');
    await rm(dir, { recursive: true, force: true });
  });
});

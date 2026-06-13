import { spawn } from 'node:child_process';
import type { BridgeConfig, DeliveryResult, NormalizedAlexaEvent } from './types.js';
import { drainQueue, queueEvent } from './queue.js';

function buildAssistantMessage(event: NormalizedAlexaEvent): string {
  return [
    `Voice message from Alexa for ${event.assistant}:`,
    '',
    event.raw_text,
    '',
    `Captured at: ${event.captured_at}`,
    `Source: ${event.source}`,
    event.request_id ? `Alexa request id: ${event.request_id}` : undefined
  ]
    .filter(Boolean)
    .join('\n');
}

async function deliverViaCli(config: BridgeConfig, event: NormalizedAlexaEvent, timeoutMs: number): Promise<DeliveryResult> {
  const args = [
    'agent',
    '--agent',
    config.assistantId,
    '--session-key',
    config.openclawSessionKey,
    '--message',
    buildAssistantMessage(event),
    '--json',
    '--timeout',
    String(Math.ceil(timeoutMs / 1000))
  ];
  if (config.openclawCliThinking) {
    args.push('--thinking', config.openclawCliThinking);
  }

  return new Promise((resolve, reject) => {
    const child = spawn(config.openclawCliBin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timeout = setTimeout(() => {
      settled = true;
      child.kill('SIGTERM');
      reject(new Error(`openclaw delivery exceeded ${timeoutMs}ms`));
    }, timeoutMs);
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (code === 0) {
        resolve({ ok: true });
      } else {
        reject(new Error(`openclaw exited ${code}: ${stderr || stdout}`.trim()));
      }
    });
  });
}

async function deliverViaHttp(config: BridgeConfig, event: NormalizedAlexaEvent): Promise<DeliveryResult> {
  if (!config.openclawIngestUrl || !config.openclawIngestToken) {
    throw new Error('OpenClaw HTTP ingest is not configured');
  }
  const res = await fetch(config.openclawIngestUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.openclawIngestToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(event)
  });
  if (!res.ok) {
    throw new Error(`OpenClaw ingest failed with HTTP ${res.status}`);
  }
  return { ok: true };
}

export async function deliverToOpenClaw(config: BridgeConfig, event: NormalizedAlexaEvent): Promise<DeliveryResult> {
  await queueEvent(config.queuePath, event, new Error('queued for asynchronous OpenClaw delivery'));
  return { ok: true, queued: true };
}

export async function deliverQueuedEventToOpenClaw(config: BridgeConfig, event: NormalizedAlexaEvent): Promise<DeliveryResult> {
  return config.openclawAdapter === 'http'
    ? await deliverViaHttp(config, event)
    : await deliverViaCli(config, event, config.openclawCliDrainTimeoutMs);
}

export async function drainOpenClawQueue(config: BridgeConfig) {
  return drainQueue(config.queuePath, config.queueMaxAttempts, async (event) => {
    await deliverQueuedEventToOpenClaw(config, event);
  });
}

import express from 'express';
import { ExpressAdapter } from 'ask-sdk-express-adapter';
import pino from 'pino';
import type { BridgeConfig, AnnounceRequest, DeliveryResult, NormalizedAlexaEvent } from './types.js';
import { createSkill } from './alexa.js';
import { deliverToOpenClaw } from './openclaw.js';
import { sendAnnouncement } from './announce.js';

export interface AppDependencies {
  deliverEvent?: (event: NormalizedAlexaEvent) => Promise<DeliveryResult>;
  announce?: (message: string, target: unknown) => Promise<void>;
}

export function createApp(config: BridgeConfig, deps: AppDependencies = {}) {
  const app = express();
  const logger = pino({ level: config.logLevel });
  const deliverEvent = deps.deliverEvent ?? ((event) => deliverToOpenClaw(config, event));
  const announce = deps.announce ?? ((message, target) => sendAnnouncement(config, message, target));

  app.disable('x-powered-by');

  app.use((req, _res, next) => {
    if (req.path === '/alexa') {
      logger.info(
        {
          method: req.method,
          path: req.path,
          contentLength: req.header('content-length'),
          userAgent: req.header('user-agent')
        },
        'alexa request received'
      );
    }
    next();
  });

  app.use((req, res, next) => {
    if (req.path === '/alexa') {
      res.on('finish', () => {
        logger.info({ method: req.method, path: req.path, statusCode: res.statusCode }, 'alexa request completed');
      });
    }
    next();
  });

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true });
  });

  const skill = createSkill(config, { deliverEvent });
  const adapter = new ExpressAdapter(skill, !config.allowUnsignedAlexaRequests, !config.allowUnsignedAlexaRequests);
  app.post('/alexa', adapter.getRequestHandlers());
  app.use('/alexa', (error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    void next;
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ error: message }, 'alexa request failed');
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: 'alexa request failed' });
    }
  });

  app.post('/internal/announce', express.json({ limit: '16kb' }), async (req, res) => {
    const auth = req.header('authorization') || '';
    if (auth !== `Bearer ${config.bridgeInternalToken}`) {
      res.status(401).json({ ok: false, error: 'unauthorized' });
      return;
    }

    const body = req.body as AnnounceRequest;
    const message = typeof body.message === 'string' ? body.message : '';
    try {
      await announce(message, body.target);
      res.json({ ok: true });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'announcement failed';
      const status = messageText.includes('not configured') ? 500 : messageText.includes('Home Assistant failed') ? 502 : 400;
      logger.warn({ error: messageText, target: body.target }, 'announcement rejected');
      res.status(status).json({ ok: false, error: messageText });
    }
  });

  app.use((_req, res) => {
    res.status(404).json({ ok: false, error: 'not found' });
  });

  return app;
}

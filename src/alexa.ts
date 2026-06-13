import crypto from 'node:crypto';
import Alexa from 'ask-sdk-core';
import type { ErrorHandler, HandlerInput, RequestHandler } from 'ask-sdk-core';
import type { BridgeConfig, DeliveryResult, NormalizedAlexaEvent } from './types.js';

export interface AlexaDependencies {
  deliverEvent(event: NormalizedAlexaEvent): Promise<DeliveryResult>;
}

function hashId(value: string | undefined, salt: string): string | undefined {
  if (!value) return undefined;
  return `sha256:${crypto.createHash('sha256').update(`${salt}:${value}`).digest('hex')}`;
}

export function buildNormalizedEvent(envelope: any, rawText: string, config: BridgeConfig): NormalizedAlexaEvent {
  return {
    source: 'alexa_skill',
    adapter: 'alexa',
    assistant: config.assistantId,
    raw_text: rawText,
    captured_at: new Date().toISOString(),
    locale: envelope.request?.locale,
    request_id: envelope.request?.requestId,
    session_id: envelope.session?.sessionId,
    skill_id: envelope.context?.System?.application?.applicationId,
    user_id_hash: hashId(envelope.context?.System?.user?.userId, config.alexaUserHashSalt),
    device_id_hash: hashId(envelope.context?.System?.device?.deviceId, config.alexaUserHashSalt)
  };
}

export function createSkill(config: BridgeConfig, deps: AlexaDependencies) {
  const launchHandler: RequestHandler = {
    canHandle(handlerInput: HandlerInput) {
      return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput: HandlerInput) {
      return handlerInput.responseBuilder
        .speak('What should I pass along?')
        .reprompt(`You can say something like, remind me to get dog food.`)
        .getResponse();
    }
  };

  const captureHandler: RequestHandler = {
    canHandle(handlerInput: HandlerInput) {
      return (
        Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
        Alexa.getIntentName(handlerInput.requestEnvelope) === 'CaptureMessageIntent'
      );
    },
    async handle(handlerInput: HandlerInput) {
      const envelope: any = handlerInput.requestEnvelope;
      const rawText = envelope.request?.intent?.slots?.message?.value?.trim();
      if (!rawText) {
        return handlerInput.responseBuilder
          .speak('What should I pass along?')
          .reprompt('Tell me the message you want to send.')
          .getResponse();
      }

      const event = buildNormalizedEvent(envelope, rawText, config);
      if (event.skill_id !== config.alexaSkillId) {
        return handlerInput.responseBuilder
          .speak('This bridge is not configured for that Alexa skill.')
          .getResponse();
      }

      const result = await deps.deliverEvent(event);
      if (result.ok && result.queued) {
        return handlerInput.responseBuilder
          .speak('Got it. I sent that along.')
          .getResponse();
      }
      if (result.ok) {
        return handlerInput.responseBuilder.speak('Got it. I sent that along.').getResponse();
      }
      return handlerInput.responseBuilder.speak('I could not send that message.').getResponse();
    }
  };

  const helpHandler: RequestHandler = {
    canHandle(handlerInput: HandlerInput) {
      return (
        Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
        Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent'
      );
    },
    handle(handlerInput: HandlerInput) {
      return handlerInput.responseBuilder
        .speak('You can ask this bridge to pass along a message.')
        .getResponse();
    }
  };

  const stopHandler: RequestHandler = {
    canHandle(handlerInput: HandlerInput) {
      return (
        Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
        ['AMAZON.CancelIntent', 'AMAZON.StopIntent'].includes(Alexa.getIntentName(handlerInput.requestEnvelope))
      );
    },
    handle(handlerInput: HandlerInput) {
      return handlerInput.responseBuilder.speak('Okay.').getResponse();
    }
  };

  const errorHandler: ErrorHandler = {
    canHandle() {
      return true;
    },
    handle(handlerInput: HandlerInput, error: Error) {
      console.error(`alexa skill error: ${error.message}`);
      return handlerInput.responseBuilder.speak('I could not send that message.').getResponse();
    }
  };

  return Alexa.SkillBuilders.custom()
    .addRequestHandlers(launchHandler, captureHandler, helpHandler, stopHandler)
    .addErrorHandlers(errorHandler)
    .create();
}

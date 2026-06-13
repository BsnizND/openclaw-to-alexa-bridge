# ADR-0001: Bridge Boundaries

Status: accepted

## Context

The bridge must let a user say an Alexa custom skill phrase and have a free-form
message reach a configured OpenClaw assistant. It must also let OpenClaw trigger
short announcements to selected Echo devices through Home Assistant.

The assistant id, invocation examples, ingress adapter, and announcement targets
are configured rather than hard-coded.

## Decision

- Build a Node.js/TypeScript service.
- Use an Alexa custom skill endpoint for inbound message capture.
- Use the ASK SDK Express adapter or equivalent verification for Alexa request signatures and timestamps.
- Keep OpenClaw and Home Assistant private.
- Expose only the Alexa-facing route through a narrow public Tailscale Funnel route.
- Use an allowlisted internal endpoint for outbound Home Assistant announcements.
- Use the existing OpenClaw CLI path for the first adapter unless implementation evidence identifies a better documented adapter.
- Do not create or modify OpenClaw worker agents for this bridge.
- Enqueue Alexa events before OpenClaw delivery so Alexa response latency does not depend on a full assistant turn.
- Prefer a bridge-specific local-only Home Assistant webhook when no narrow REST token already exists.

## Consequences

- Real production acceptance requires a real Alexa skill invocation, a real OpenClaw delivery proof, and a real Home Assistant/Echo announcement.
- Test doubles are allowed only in tests and cannot satisfy production acceptance.
- If Home Assistant Alexa Devices setup requires MFA, CAPTCHA, or other interactive account work, implementation must stop and report the exact prompt.
- If Tailscale cannot expose only the bridge route safely, implementation must stop rather than widening exposure.
- Exact consumer phrasing such as `Alexa, tell <person-name> ...` may require a separate invocation/routine/certification decision if Alexa built-ins intercept the desired name.

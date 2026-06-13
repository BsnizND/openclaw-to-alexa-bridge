# openclaw-to-alexa-bridge

Configurable bridge between Amazon Alexa custom skills and an OpenClaw assistant.

The first deployment target is Brian's private Jay/OpenClaw runtime, but the code should stay assistant-agnostic:

- inbound: Alexa custom skill captures a free-form message and forwards a normalized event to a configured OpenClaw adapter;
- outbound: OpenClaw can call an internal bridge endpoint to announce short messages through allowlisted Home Assistant Alexa Devices targets;
- security: only the Alexa-facing route may be exposed publicly, and Home Assistant/OpenClaw remain private.

## Status

Working private deployment for Brian's Jay/OpenClaw runtime, with the bridge
kept configurable for other OpenClaw assistants.

Implementation evidence is tracked in:

`/Users/briansnyder/Documents/Axicom/Codex/.codex-runs/openclaw-to-alexa-bridge-implementation-20260613-023036Z/`

Verified local runtime:

- service listens on `127.0.0.1`;
- only `/alexa` is intended for public Alexa traffic;
- `/internal/announce` requires a bearer token and only reaches allowlisted Home Assistant targets;
- Alexa inbound messages are durably queued first, then drained to OpenClaw in the background.

## Quick Start

```sh
npm install
cp examples/env.example .env.runtime
npm run build
set -a && . ./.env.runtime && set +a
npm start
```

Health check:

```sh
curl -fsS http://127.0.0.1:${PORT:-8787}/healthz
```

Smoke announcement, if Home Assistant is configured:

```sh
BASE_URL=http://127.0.0.1:${PORT:-8787} \
BRIDGE_INTERNAL_TOKEN="$BRIDGE_INTERNAL_TOKEN" \
HA_DEFAULT_TARGET="$HA_DEFAULT_TARGET" \
./scripts/smoke-tests.sh
```

## Runtime Model

Inbound Alexa requests use `ask-sdk-express-adapter` signature and timestamp
verification. The bridge also validates the configured `ALEXA_SKILL_ID`.

The Alexa request path never waits for a full OpenClaw turn. It writes a JSONL
queue record and returns a short acknowledgement. A non-overlapping background
drain loop delivers pending records to OpenClaw using either:

- `OPENCLAW_ADAPTER=cli`, via `openclaw agent`;
- `OPENCLAW_ADAPTER=http`, via a configured ingest URL and token.

Queue records are marked `pending`, `delivered`, or `failed` with attempt
metadata. On restart, pending records are reloaded and drained.

## Alexa Skill

The verified development invocation name is:

```text
claw bridge
```

Example tested utterance:

```text
ask claw bridge to tell jay bridge drain verification only please acknowledge receipt and do not create a reminder
```

The exact phrase `Alexa, tell Jay ...` is not proven in v1 because `jay` is
currently intercepted by Alexa built-in Contacts/Reminders behavior before the
custom skill receives the utterance. A later product step can explore a routine,
different invocation name, or certification/naming approach.

## Home Assistant Announcements

The first deployment uses Home Assistant's Alexa Devices notify entities through
a bridge-specific local-only webhook automation. This avoids storing a broad Home
Assistant long-lived token in the bridge runtime.

Verified target aliases:

```text
bedroom=notify.bedroom_announce
master_bedroom=notify.master_bedroom_announce
kitchen=notify.kitchen_announce
bathroom=notify.bathroom_announce
inside=notify.inside_announce
outside=notify.outside_announce
everywhere=notify.everywhere_announce
echo_auto=notify.brian_s_echo_auto_announce
```

Announcement controls:

- bearer auth on `/internal/announce`;
- fixed target allowlist;
- nonempty message validation;
- configurable max length, default `240`;
- same target/message rate limit, default `30000ms`;
- no secret values in normal logs.

## Deployment Notes

Current private runtime path:

```text
/Volumes/LaCie_6big/briansnyder/repos/openclaw-to-alexa-bridge
```

The live runtime env is `.env.runtime` with mode `0600`. Do not commit it.

Restart shape used during verification:

```sh
pkill -f 'dist/src/index.js' || true
set -a && . ./.env.runtime && set +a
nohup npm start > run/bridge.log 2>&1 &
echo "$!" > run/bridge.pid
curl -fsS "http://127.0.0.1:${PORT}/healthz"
```

Tailscale Funnel is intentionally constrained to the Alexa route. At the time
of this implementation, `https://snizserver.barred-komodo.ts.net:8443/alexa`
is the verified Alexa endpoint. The host also had pre-existing unrelated Funnel
state, including `/ClawTV`, and an earlier bridge-only `:10000/alexa` attempt.
Do not run broad Funnel resets from this repo; remove only known bridge routes
after reviewing `tailscale funnel status --json`.

## Rollback

Bridge service:

```sh
if [ -f run/bridge.pid ]; then kill "$(cat run/bridge.pid)"; fi
```

Home Assistant webhook automation:

1. Restore the saved `automations.yaml` backup.
2. Run `docker exec homeassistant hass --script check_config -c /config`.
3. Restart Home Assistant.

Alexa endpoint:

1. Disable or change the skill endpoint in the ASK console.
2. Remove only the bridge-specific Funnel route after confirming the live
   `tailscale funnel status --json` output.

## Verification

```sh
npm run typecheck
npm test
npm run lint
npm run build
npm audit --omit=dev
```

Production acceptance must use real Alexa, real OpenClaw, and real Home
Assistant/Echo evidence. Test doubles are limited to tests.

## Non-goals

- public/commercial Alexa certification in v1;
- public exposure of Home Assistant, OpenClaw, logs, admin routes, or queue browsers;
- long-form assistant conversations through Alexa in v1;
- creating or changing OpenClaw worker-agent topology.

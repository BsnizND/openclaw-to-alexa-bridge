# openclaw-to-alexa-bridge

Configurable bridge between Amazon Alexa custom skills and an OpenClaw assistant.

- inbound: Alexa custom skill captures a free-form message and forwards a normalized event to a configured OpenClaw adapter;
- outbound: OpenClaw can call an internal bridge endpoint to announce short messages through allowlisted Home Assistant Alexa Devices targets;
- security: only the Alexa-facing route may be exposed publicly, and Home Assistant/OpenClaw remain private.

## Status

Early implementation. The service is intended to be assistant-agnostic: configure
your assistant id, OpenClaw delivery method, Alexa skill id, and Home Assistant
announcement targets through environment variables.

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

Use a two-word invocation name that does not overlap with Alexa contacts,
messaging, reminders, or built-in commands. For development, this repo uses:

```text
claw bridge
```

Example utterance:

```text
ask claw bridge to capture remember to check the garage door
```

Single-word personal names and contact-like phrases are often intercepted by
Alexa before a custom skill receives them. If you want a person-like name, test
the invocation thoroughly in the Alexa Developer Console before relying on it.

## Home Assistant Announcements

The bridge can call Home Assistant either with a long-lived token or with a
bridge-specific webhook automation. A local-only webhook can be a good fit when
the bridge runs on the same host or private network as Home Assistant and you
want to avoid storing a broad Home Assistant token.

Example target aliases:

```text
office=notify.office_announce
living_room=notify.living_room_announce
everywhere=notify.everywhere_announce
```

Announcement controls:

- bearer auth on `/internal/announce`;
- fixed target allowlist;
- nonempty message validation;
- configurable max length, default `240`;
- same target/message rate limit, default `30000ms`;
- no secret values in normal logs.

## Deployment Notes

Keep runtime secrets in `.env.runtime` with mode `0600`. Do not commit it.

Restart shape used during verification:

```sh
pkill -f 'dist/src/index.js' || true
set -a && . ./.env.runtime && set +a
nohup npm start > run/bridge.log 2>&1 &
echo "$!" > run/bridge.pid
curl -fsS "http://127.0.0.1:${PORT}/healthz"
```

Tailscale Funnel is intentionally constrained to the Alexa route. At the time
of deployment, expose only the public path your Alexa skill needs, such as
`https://<your-tailnet-host>:8443/alexa`. Do not expose Home Assistant,
OpenClaw, logs, queue files, or `/internal/announce` through Funnel.

## Rollback

Bridge service:

```sh
if [ -f run/bridge.pid ]; then kill "$(cat run/bridge.pid)"; fi
```

Home Assistant webhook automation:

1. Remove or disable the bridge-specific webhook automation.
2. Validate and restart Home Assistant using your normal deployment process.

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

Production acceptance should use real Alexa, real OpenClaw, and real Home
Assistant/Echo evidence. Test doubles are limited to tests.

## Non-goals

- public/commercial Alexa certification in v1;
- public exposure of Home Assistant, OpenClaw, logs, admin routes, or queue browsers;
- long-form assistant conversations through Alexa in v1;
- creating or changing OpenClaw worker-agent topology.

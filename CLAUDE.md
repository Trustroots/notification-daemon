# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Nostr Push Notification Service that provides privacy-preserving push notifications using Nostr filters. The service processes AppMessage events (Kind 10395) with filters and Expo push tokens, then uses the Expo Go service to push notifications to subscribed mobile devices when matching events arrive.

**Implementations:**
- **Deno/TypeScript** (main): Root directory contains the production Deno implementation
- **Go** (reference): `notification-daemon-readonly-git/` contains the original Go implementation

Both implementations provide identical functionality. The Deno version is recommended for development and deployment.

## Architecture

The service operates in two phases:

1. **Startup Phase:** Reads all historical Nostr events from strfry relay and processes Kind 10395 (AppData) events to initialize filter subscriptions and push tokens
2. **Normal Operation Phase:** Listens to RabbitMQ queue (fed by strfry) for real-time event processing

**Data Flow:**
- Nostr relay (strfry) → RabbitMQ queue → notification-daemon
- notification-daemon → Expo Go API → Mobile devices (iOS/Android)

**Message Processing:**
- **Subscription messages (Kind 10395):** NIP-04 encrypted AppData containing Nostr filters and Expo push tokens
- **Regular events (any kind):** Matched against stored filters; notifications sent to subscribed devices

## Key Components

### Deno/TypeScript Implementation

**Module Structure:**
- `main.ts`: Application entry point, orchestrates startup and runtime
- `config.ts`: Environment configuration and key derivation
- `types.ts`: TypeScript type definitions and constants
- `crypto.ts`: NIP-04 encryption/decryption utilities, plus code extraction
- `managers.ts`: `FilterManager` and `PushManager` classes
- `nostr.ts`: Nostr relay connection and historical event reading
- `rabbitmq.ts`: RabbitMQ integration and real-time event processing
- `push.ts`: Expo push notification integration

**Core Classes:**
- `FilterManager`: Manages per-pubkey Nostr filters from Kind 10395 events
- `PushManager`: Manages Expo push tokens per pubkey

**Key Functions:**
- `readStrfryEvents()`: Initial sync of historical events from Nostr relay
- `readRabbitMQ()`: Real-time event consumption from RabbitMQ queue
- `isEncryptedAndIsForMe()`: Validates NIP-04 encrypted messages using p-tags
- `decryptContent()`: NIP-04 decryption using shared secrets
- `sendPushToMany()`: Sends push notifications via Expo with plus code location extraction

### Go Implementation (Reference)

Located in `notification-daemon-readonly-git/`. See that directory for Go-specific details.

**Helper tool (`notification-daemon-readonly-git/tools/app_kind_enc_sender.go`):**
- Utility for testing NIP-04 encryption/decryption
- Commands: `test` (key generation test), `derive` (derive pubkey), `send` (send encrypted event)

## Development Commands

### Deno/TypeScript Version

**Local development:**
```bash
# Copy and configure environment
cp .env.example .env
# Edit .env with your keys

# Run locally with Deno
deno task dev
# or
make dev
```

**Production with Docker:**
```bash
make run  # Requires .env file with PRIVATEKEY and EXPOACCESSTOKEN
```

**Other commands:**
```bash
make build      # Build Docker image
make shell      # Shell into running container
make fmt        # Format TypeScript code
make lint       # Lint TypeScript code
make check      # Type check TypeScript code
```

### Go Version

**With Docker:**
```bash
cd notification-daemon-readonly-git
make run
# Requires: PRIVATEKEY and EXPOACCESSTOKEN in privatekey file or environment
```

**Shell into running container:**
```bash
cd notification-daemon-readonly-git
make shell
```

### Testing Tools

**Send test encrypted message:**
```bash
cd notification-daemon-readonly-git/tools
go run app_kind_enc_sender.go send \
  --message "your message" \
  --private-key <hex> \
  --recipient-key <hex> \
  --relay wss://relay.trustroots.org
```

**Derive public key from private key:**
```bash
go run app_kind_enc_sender.go derive --private-key <hex>
```

**Test encryption:**
```bash
go run app_kind_enc_sender.go test
```

### Using nak (Nostr testing)

The Makefile includes various `nak_*` targets for testing Nostr events:

```bash
make nak_send          # Send test event kind 10333
make nak_filter12345   # Send kind 10395 with filter for kind 12345
make nak_filterrand    # Send filter with random secret key
```

## Configuration

**Required environment variables:**
- `PRIVATEKEY`: Nostr private key (hex) for NIP-04 decryption
- `EXPOACCESSTOKEN`: Expo push notification service access token

**Optional environment variables:**
- `STRFRY_URL`: Nostr relay WebSocket URL (default: `ws://localhost:7777`)
- `RABBITMQ_URL`: RabbitMQ connection string (default: `amqp://guest:guest@localhost:5672/`)
- `RABBITMQ_QUEUE`: Queue name (default: `nostr_events`)

**Setup:** Copy `example.env` to `privatekey` and populate with actual credentials (privatekey file is gitignored).

## RabbitMQ Integration

The service expects RabbitMQ messages in this wrapper format:
```json
{
  "event": { /* Nostr event object */ },
  "type": "string",
  "receivedAt": 1234567890,
  "sourceInfo": "string"
}
```

**Queue setup:**
- Exchange: `nostrEvents` (fanout, durable)
- Queue: `notifications` (or configured name, durable)
- Binding: Queue bound to exchange with no routing key

## NIP-04 Encryption Handling

Kind 10395 events must be NIP-04 encrypted and addressed to the daemon's public key:
- Content format: `<base64_ciphertext>?iv=<base64_iv>`
- Must include p-tag with daemon's public key
- Decryption uses shared secret from sender's pubkey and daemon's private key

**Decrypted content structure:**
```json
{
  "filters": [
    { "filter": { /* Nostr filter object */ } }
  ],
  "tokens": [
    { "expoPushToken": "ExponentPushToken[...]" }
  ]
}
```

## Push Notification Format

Notifications include:
- **Title:** "New note in plus code `<PLUSCODE>`" (extracted from event #l or l tags)
- **Body:** First 80 characters of event content (truncated at rune boundary)
- **Data payload:** Full event (id, kind, pubkey, content, createdAt, tags)

## Code Style Notes

- Logging uses emoji prefixes for visual categorization (e.g., 📥 for received, ✅ for success, ❌ for errors)
- Kind 10395 events replace previous filters/tokens for the same pubkey (no merging)
- Filter matching checks all stored filters against incoming events; multiple matches possible

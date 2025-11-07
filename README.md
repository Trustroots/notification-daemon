# Nostr Push Notification Service (Deno/TypeScript)

Privacy-preserving push notifications for Nostroots using Nostr filters. This is a TypeScript/Deno rewrite of the original Go implementation.

## Architecture

The service operates in two phases:
1. **Startup Phase**: Reads all historical Nostr events from strfry relay and processes Kind 10395 (AppData) events
2. **Normal Operation Phase**: Listens to RabbitMQ queue (fed by strfry) for real-time event processing

**Data Flow:**
```
Nostr relay (strfry) → RabbitMQ → notification-daemon → Expo Go → Mobile devices
```

## Quick Start

### Development (Local)

```bash
# Copy and configure environment
cp .env.example .env
# Edit .env with your keys

# Run locally
deno task dev
```

### Production (Docker)

```bash
# Build and run with Docker Compose
make run
```

## Configuration

Required environment variables:
- `PRIVATEKEY`: Nostr private key (hex) for NIP-04 decryption
- `EXPOACCESSTOKEN`: Expo push notification service access token

Optional:
- `STRFRY_URL`: Nostr relay WebSocket URL (default: `ws://localhost:7777`)
- `RABBITMQ_URL`: RabbitMQ connection string (default: `amqp://guest:guest@localhost:5672/`)
- `RABBITMQ_QUEUE`: Queue name (default: `nostr_events`)

## Project Structure

```
.
├── main.ts           # Application entry point
├── config.ts         # Configuration and environment loading
├── types.ts          # TypeScript type definitions
├── crypto.ts         # NIP-04 encryption/decryption utilities
├── managers.ts       # FilterManager and PushManager classes
├── nostr.ts          # Nostr relay connection
├── rabbitmq.ts       # RabbitMQ integration
├── push.ts           # Expo push notification integration
├── deno.json         # Deno configuration and tasks
├── Dockerfile        # Docker image for Deno service
└── docker-compose.yml
```

## Available Commands

```bash
# Development
make dev          # Run locally with Deno
deno task dev     # Same as above
deno task test    # Run tests
deno task test:watch  # Run tests in watch mode

# Production
make run          # Run with Docker Compose
make build        # Build Docker image
make shell        # Shell into running container

# Code Quality
make fmt          # Format code
make lint         # Lint code
make check        # Type check

# Testing Tools
cd tools
make test         # Test encryption/decryption
make derive       # Derive public key from private key
make send         # Send test encrypted message
```

## Message Format

The service handles two types of Nostr events:

### Kind 10395 (AppData) - Subscription Messages
NIP-04 encrypted events containing:
```json
{
  "filters": [
    { "filter": { "kinds": [1], "limit": 10 } }
  ],
  "tokens": [
    { "expoPushToken": "ExponentPushToken[...]" }
  ]
}
```

### Regular Events
Any Nostr event that matches stored filters triggers push notifications to subscribed devices.

## Development

The Deno implementation uses:
- **nostr-tools**: Nostr protocol implementation
- **amqplib**: RabbitMQ client
- **expo-server-sdk**: Expo push notifications
- **@std/dotenv**: Environment variable loading
- **@std/assert**: Testing assertions

### Testing

Run all tests:
```bash
deno task test
# or
deno test --allow-net --allow-env
```

Run tests in watch mode:
```bash
deno task test:watch
```

**Test Coverage:**
- `crypto_test.ts` - Crypto utilities (truncation, tag extraction, NIP-04 encryption)
- `managers_test.ts` - FilterManager and PushManager (24 tests)
- `config_test.ts` - Configuration loading and validation
- `integration_test.ts` - End-to-end event processing flows

Type checking:
```bash
deno check main.ts
# or
make check
```

Format code:
```bash
deno fmt
# or
make fmt
```

Lint code:
```bash
deno lint
# or
make lint
```

## Features

- ✅ **Two-phase operation**: Historical event sync + real-time processing
- ✅ **NIP-04 encryption**: Full support for encrypted subscription messages
- ✅ **Filter management**: Per-pubkey Nostr filter subscriptions
- ✅ **Push notifications**: Integration with Expo Go service
- ✅ **Graceful shutdown**: Proper cleanup on SIGTERM/SIGINT
- ✅ **Auto-reconnect**: Automatic RabbitMQ reconnection on failure
- ✅ **Type safety**: Full TypeScript type checking
- ✅ **Testing tools**: CLI utilities for encryption and message sending
- ✅ **Unit tests**: Test coverage for core functionality

## Comparison with Go Version

This Deno/TypeScript implementation provides:
- ✅ Same functionality as Go version
- ✅ Type safety with TypeScript
- ✅ Modern async/await patterns
- ✅ Better debugging with source maps
- ✅ Simpler dependency management
- ✅ No compilation step for development
- ✅ Graceful shutdown handling
- ✅ Automatic reconnection logic

The original Go implementation is available in `notification-daemon-readonly-git/`.

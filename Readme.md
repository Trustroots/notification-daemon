# Nostr Push Notification Service

Privacy-preserving push notifications for Nostroots using Nostr filters.
Mobile clients send AppMessage events (Kind 10395) with filters and Expo push tokens.
The notification daemon uses the Expo Go service to push notifications to all subscribed (filtered) devices when matching events arrive.

### Architecture
```
┌──────────────────────────┐       ┌──────────┐     ┌───────────────┐
│ nostr relay / strfry     ├───────┤AppData as├───► │               │
│                          │       │kind 10395│     │               │
└──────────────────────────┘       │   or     │     │ notification- │
┌──────────────────────────┐       │Events as │     │ daemon        │
│ message queue / rabbitmq ├───────┤Any Kind  ├───► │               │
│                          │       │          │     │               │
└──────────────────────────┘       └──────────┘     │               │
┌──────────────────────────┐       ┌──────────┐     │               │
│ SDK's Notification hub / │◄──────┤REST PUSH ├─────┤               │
│       Expo Go            │       │   API    │     │               │
└────────────┬┬────────────┘       └──────────┘     └───────────────┘
             ││                                                      
     ┌───────┴┴────────┐                                             
     │PUSH Notification│                                             
     └───────┬┬────────┘                                             
┌─────────┐  ││  ┌─────────┐                                         
│Mobile - │  ││  │Mobile - │                                         
│Devices /│◄─┘└─►│Devices /│                                         
│iOS      │      │Android  │                                         
└─────────┘      └─────────┘                                         
```
### Overview

The service operates in two phases:
* in Startup Phase, all historical Nostr events are read from strfry and processes.
* Normal Operation Phase: Listens to a RabbitMQ queue (fed by strfry) for real-time event processing.

### Message Types

The service handles two kinds of messages:

- Subscription (Nip4, Kind 10395, _AppData_)
- Message

as defined in https://github.com/Trustroots/nostroots/blob/main/nr-common/src/10395.schema.ts

#### Subscription (Kind 10395 / _AppData_)

Containes filers and push-sub-keys
Client notifies server for which events they/a pubkey wants notifications for and includes the expoPushToken for Expo push SAS.

10395: replaces older messages with the same ID.

#### Message

Any Nostr event. If it matches a stored subscription filter, push notifications are sent to all relevant (e.g. subscribed) devices.

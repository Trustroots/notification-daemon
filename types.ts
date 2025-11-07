import type { Event as NostrEvent, Filter } from "nostr-tools";

export const KIND_APP_DATA = 10395;

export type Pushtoken = string;

export interface AppDataContent {
  filters?: Array<{ filter: Filter }>;
  tokens?: Array<{ expoPushToken: string }>;
}

export interface RabbitMQWrapper {
  event: NostrEvent;
  type: string;
  receivedAt: number;
  sourceInfo: string;
}

export interface FilterPubKeyPair {
  filter: Filter;
  pubkey: string;
}

export interface Config {
  strfryUrl: string;
  rabbitmqUrl: string;
  rabbitmqQueue: string;
  privateKey: string;
  expoAccessToken: string;
  publicKey: string;
}

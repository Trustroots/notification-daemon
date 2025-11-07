import { load } from "@std/dotenv";
import { getPublicKey } from "nostr-tools";
import type { Config } from "./types.ts";

export async function loadConfig(): Promise<Config> {
  // Load .env file if it exists
  try {
    await load({ export: true });
  } catch {
    console.log("No .env file found, using environment variables");
  }

  const privateKey = Deno.env.get("PRIVATEKEY");
  if (!privateKey) {
    throw new Error("PRIVATEKEY not found in environment");
  }

  const expoAccessToken = Deno.env.get("EXPOACCESSTOKEN");
  if (!expoAccessToken) {
    throw new Error("EXPOACCESSTOKEN not found in environment");
  }

  const publicKey = getPublicKey(privateKey);
  console.log(`Derived public key: ${publicKey}`);

  return {
    strfryUrl: Deno.env.get("STRFRY_URL") || "ws://localhost:7777",
    rabbitmqUrl: Deno.env.get("RABBITMQ_URL") ||
      "amqp://guest:guest@localhost:5672/",
    rabbitmqQueue: Deno.env.get("RABBITMQ_QUEUE") || "nostr_events",
    privateKey,
    expoAccessToken,
    publicKey,
  };
}

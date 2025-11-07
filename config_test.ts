import { assertEquals, assertRejects } from "jsr:@std/assert";
import { loadConfig } from "./config.ts";
import { getPublicKey } from "nostr-tools";

Deno.test("loadConfig - loads from environment variables", async () => {
  // Set test environment variables
  Deno.env.set("PRIVATEKEY", "0000000000000000000000000000000000000000000000000000000000000001");
  Deno.env.set("EXPOACCESSTOKEN", "test-token");
  Deno.env.set("STRFRY_URL", "wss://test.relay.com");
  Deno.env.set("RABBITMQ_URL", "amqp://test:test@localhost:5672");
  Deno.env.set("RABBITMQ_QUEUE", "test-queue");

  const config = await loadConfig();

  assertEquals(config.privateKey, "0000000000000000000000000000000000000000000000000000000000000001");
  assertEquals(config.expoAccessToken, "test-token");
  assertEquals(config.strfryUrl, "wss://test.relay.com");
  assertEquals(config.rabbitmqUrl, "amqp://test:test@localhost:5672");
  assertEquals(config.rabbitmqQueue, "test-queue");

  // Public key should be derived
  const expectedPubkey = getPublicKey("0000000000000000000000000000000000000000000000000000000000000001");
  assertEquals(config.publicKey, expectedPubkey);

  // Cleanup
  Deno.env.delete("PRIVATEKEY");
  Deno.env.delete("EXPOACCESSTOKEN");
  Deno.env.delete("STRFRY_URL");
  Deno.env.delete("RABBITMQ_URL");
  Deno.env.delete("RABBITMQ_QUEUE");
});

Deno.test("loadConfig - uses default values when not set", async () => {
  // Set only required variables
  Deno.env.set("PRIVATEKEY", "0000000000000000000000000000000000000000000000000000000000000001");
  Deno.env.set("EXPOACCESSTOKEN", "test-token");

  // Remove optional variables
  Deno.env.delete("STRFRY_URL");
  Deno.env.delete("RABBITMQ_URL");
  Deno.env.delete("RABBITMQ_QUEUE");

  const config = await loadConfig();

  // Should use defaults
  assertEquals(config.strfryUrl, "ws://localhost:7777");
  assertEquals(config.rabbitmqUrl, "amqp://guest:guest@localhost:5672/");
  assertEquals(config.rabbitmqQueue, "nostr_events");

  // Cleanup
  Deno.env.delete("PRIVATEKEY");
  Deno.env.delete("EXPOACCESSTOKEN");
});

Deno.test("loadConfig - throws when PRIVATEKEY missing", async () => {
  Deno.env.delete("PRIVATEKEY");
  Deno.env.set("EXPOACCESSTOKEN", "test-token");

  await assertRejects(
    async () => await loadConfig(),
    Error,
    "PRIVATEKEY not found in environment",
  );

  // Cleanup
  Deno.env.delete("EXPOACCESSTOKEN");
});

Deno.test("loadConfig - throws when EXPOACCESSTOKEN missing", async () => {
  Deno.env.set("PRIVATEKEY", "0000000000000000000000000000000000000000000000000000000000000001");
  Deno.env.delete("EXPOACCESSTOKEN");

  await assertRejects(
    async () => await loadConfig(),
    Error,
    "EXPOACCESSTOKEN not found in environment",
  );

  // Cleanup
  Deno.env.delete("PRIVATEKEY");
});

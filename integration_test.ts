import { assertEquals, assert } from "jsr:@std/assert";
import { FilterManager, PushManager } from "./managers.ts";
import type { Event as NostrEvent } from "nostr-tools";
import { matchFilter, getPublicKey, nip04, generateSecretKey } from "nostr-tools";

// Helper to convert Uint8Array to hex
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.test("Integration - full encrypted subscription flow", async () => {
  // Setup: Generate keys
  const daemonPrivateKeyBytes = generateSecretKey();
  const daemonPrivateKey = bytesToHex(daemonPrivateKeyBytes);
  const daemonPublicKey = getPublicKey(daemonPrivateKey);

  const clientPrivateKeyBytes = generateSecretKey();
  const clientPrivateKey = bytesToHex(clientPrivateKeyBytes);
  const clientPublicKey = getPublicKey(clientPrivateKey);

  // Client creates subscription
  const subscriptionData = {
    filters: [
      { filter: { kinds: [1], authors: ["author1"] } },
      { filter: { kinds: [10333] } },
    ],
    tokens: [
      { expoPushToken: "ExponentPushToken[abc123]" },
      { expoPushToken: "ExponentPushToken[def456]" },
    ],
  };

  // Encrypt subscription for daemon
  const encrypted = await nip04.encrypt(
    clientPrivateKey,
    daemonPublicKey,
    JSON.stringify(subscriptionData),
  );

  // Create Kind 10395 event
  const subscriptionEvent: NostrEvent = {
    id: "sub1",
    pubkey: clientPublicKey,
    created_at: Math.floor(Date.now() / 1000),
    kind: 10395,
    tags: [["p", daemonPublicKey]],
    content: encrypted,
    sig: "",
  };

  // Daemon processes subscription
  const filterManager = new FilterManager();
  const pushManager = new PushManager();

  // Decrypt and process
  const decrypted = await nip04.decrypt(
    daemonPrivateKey,
    clientPublicKey,
    encrypted,
  );
  const processedEvent = { ...subscriptionEvent, content: decrypted };

  filterManager.updateFilters(processedEvent);
  pushManager.updatePushkeys(processedEvent);

  // Verify filters registered
  const allFilters = filterManager.getAllFilters();
  assertEquals(allFilters.length, 2);

  // Verify push tokens registered
  const tokens = pushManager.getPushkeys(clientPublicKey);
  assertEquals(tokens?.length, 2);
  assertEquals(tokens?.[0], "ExponentPushToken[abc123]");

  // Test filter matching
  const testEvent: NostrEvent = {
    id: "test1",
    pubkey: "author1",
    created_at: Math.floor(Date.now() / 1000),
    kind: 1,
    tags: [],
    content: "Hello world",
    sig: "",
  };

  const pairs = filterManager.getAllFiltersPubKeyPairs();
  let matched = false;
  for (const pair of pairs) {
    if (matchFilter(pair.filter, testEvent)) {
      matched = true;
      assertEquals(pair.pubkey, clientPublicKey);
      break;
    }
  }
  assert(matched, "Event should match filter");
});

Deno.test("Integration - multiple clients with different filters", () => {
  const fm = new FilterManager();
  const pm = new PushManager();

  // Client 1 subscribes to kind 1 events
  const event1: NostrEvent = {
    id: "sub1",
    pubkey: "client1",
    created_at: 0,
    kind: 10395,
    tags: [],
    content: JSON.stringify({
      filters: [{ filter: { kinds: [1] } }],
      tokens: [{ expoPushToken: "ExponentPushToken[client1]" }],
    }),
    sig: "",
  };

  // Client 2 subscribes to kind 10333 events
  const event2: NostrEvent = {
    id: "sub2",
    pubkey: "client2",
    created_at: 0,
    kind: 10395,
    tags: [],
    content: JSON.stringify({
      filters: [{ filter: { kinds: [10333] } }],
      tokens: [{ expoPushToken: "ExponentPushToken[client2]" }],
    }),
    sig: "",
  };

  fm.updateFilters(event1);
  fm.updateFilters(event2);
  pm.updatePushkeys(event1);
  pm.updatePushkeys(event2);

  // Test event of kind 1
  const testEvent1: NostrEvent = {
    id: "test1",
    pubkey: "author1",
    created_at: 0,
    kind: 1,
    tags: [],
    content: "test",
    sig: "",
  };

  // Should match client1's filter only
  const pairs = fm.getAllFiltersPubKeyPairs();
  const matchedPubkeys: string[] = [];
  for (const pair of pairs) {
    if (matchFilter(pair.filter, testEvent1)) {
      matchedPubkeys.push(pair.pubkey);
    }
  }

  assertEquals(matchedPubkeys.length, 1);
  assertEquals(matchedPubkeys[0], "client1");

  // Test event of kind 10333
  const testEvent2: NostrEvent = {
    id: "test2",
    pubkey: "author1",
    created_at: 0,
    kind: 10333,
    tags: [],
    content: "test",
    sig: "",
  };

  const matchedPubkeys2: string[] = [];
  for (const pair of pairs) {
    if (matchFilter(pair.filter, testEvent2)) {
      matchedPubkeys2.push(pair.pubkey);
    }
  }

  assertEquals(matchedPubkeys2.length, 1);
  assertEquals(matchedPubkeys2[0], "client2");
});

Deno.test("Integration - client updates subscription", () => {
  const fm = new FilterManager();
  const pm = new PushManager();

  // Initial subscription
  const event1: NostrEvent = {
    id: "sub1",
    pubkey: "client1",
    created_at: 0,
    kind: 10395,
    tags: [],
    content: JSON.stringify({
      filters: [{ filter: { kinds: [1] } }],
      tokens: [{ expoPushToken: "ExponentPushToken[old]" }],
    }),
    sig: "",
  };

  fm.updateFilters(event1);
  pm.updatePushkeys(event1);

  assertEquals(fm.getAllFilters().length, 1);
  assertEquals(pm.getPushkeys("client1")?.[0], "ExponentPushToken[old]");

  // Updated subscription (replaces old one)
  const event2: NostrEvent = {
    id: "sub2",
    pubkey: "client1",
    created_at: 1,
    kind: 10395,
    tags: [],
    content: JSON.stringify({
      filters: [
        { filter: { kinds: [1, 2, 3] } },
        { filter: { kinds: [10333] } },
      ],
      tokens: [
        { expoPushToken: "ExponentPushToken[new1]" },
        { expoPushToken: "ExponentPushToken[new2]" },
      ],
    }),
    sig: "",
  };

  fm.updateFilters(event2);
  pm.updatePushkeys(event2);

  // Should replace, not merge
  assertEquals(fm.getAllFilters().length, 2);
  const tokens = pm.getPushkeys("client1");
  assertEquals(tokens?.length, 2);
  assertEquals(tokens?.[0], "ExponentPushToken[new1]");
  assertEquals(tokens?.[1], "ExponentPushToken[new2]");
});

Deno.test("Integration - filter matching with complex filters", () => {
  const fm = new FilterManager();

  // Subscribe to events from specific authors with specific kinds
  const event: NostrEvent = {
    id: "sub1",
    pubkey: "client1",
    created_at: 0,
    kind: 10395,
    tags: [],
    content: JSON.stringify({
      filters: [
        {
          filter: {
            kinds: [1],
            authors: ["author1", "author2"],
            limit: 10,
          },
        },
      ],
    }),
    sig: "",
  };

  fm.updateFilters(event);

  // Test matching event
  const matchingEvent: NostrEvent = {
    id: "test1",
    pubkey: "author1",
    created_at: 0,
    kind: 1,
    tags: [],
    content: "test",
    sig: "",
  };

  const pairs = fm.getAllFiltersPubKeyPairs();
  assert(matchFilter(pairs[0].filter, matchingEvent), "Should match");

  // Test non-matching event (wrong author)
  const nonMatchingEvent1: NostrEvent = {
    id: "test2",
    pubkey: "author3",
    created_at: 0,
    kind: 1,
    tags: [],
    content: "test",
    sig: "",
  };

  assert(!matchFilter(pairs[0].filter, nonMatchingEvent1), "Should not match wrong author");

  // Test non-matching event (wrong kind)
  const nonMatchingEvent2: NostrEvent = {
    id: "test3",
    pubkey: "author1",
    created_at: 0,
    kind: 2,
    tags: [],
    content: "test",
    sig: "",
  };

  assert(!matchFilter(pairs[0].filter, nonMatchingEvent2), "Should not match wrong kind");
});

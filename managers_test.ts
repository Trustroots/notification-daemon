import { assertEquals, assert } from "jsr:@std/assert";
import { FilterManager, PushManager } from "./managers.ts";
import type { Event as NostrEvent } from "nostr-tools";

Deno.test("FilterManager - updates filters from event", () => {
  const fm = new FilterManager();

  const event: NostrEvent = {
    id: "test1",
    pubkey: "pubkey1",
    created_at: 0,
    kind: 10395,
    tags: [],
    content: JSON.stringify({
      filters: [
        { filter: { kinds: [1], limit: 10 } },
        { filter: { kinds: [2] } },
      ],
    }),
    sig: "",
  };

  fm.updateFilters(event);
  const filters = fm.getAllFilters();
  assertEquals(filters.length, 2);
});

Deno.test("FilterManager - replaces filters for same pubkey", () => {
  const fm = new FilterManager();

  const event1: NostrEvent = {
    id: "test1",
    pubkey: "pubkey1",
    created_at: 0,
    kind: 10395,
    tags: [],
    content: JSON.stringify({
      filters: [
        { filter: { kinds: [1] } },
      ],
    }),
    sig: "",
  };

  const event2: NostrEvent = {
    id: "test2",
    pubkey: "pubkey1",
    created_at: 1,
    kind: 10395,
    tags: [],
    content: JSON.stringify({
      filters: [
        { filter: { kinds: [2] } },
        { filter: { kinds: [3] } },
      ],
    }),
    sig: "",
  };

  fm.updateFilters(event1);
  assertEquals(fm.getAllFilters().length, 1);

  fm.updateFilters(event2);
  assertEquals(fm.getAllFilters().length, 2);
});

Deno.test("FilterManager - handles multiple pubkeys", () => {
  const fm = new FilterManager();

  const event1: NostrEvent = {
    id: "test1",
    pubkey: "pubkey1",
    created_at: 0,
    kind: 10395,
    tags: [],
    content: JSON.stringify({
      filters: [
        { filter: { kinds: [1] } },
      ],
    }),
    sig: "",
  };

  const event2: NostrEvent = {
    id: "test2",
    pubkey: "pubkey2",
    created_at: 1,
    kind: 10395,
    tags: [],
    content: JSON.stringify({
      filters: [
        { filter: { kinds: [2] } },
      ],
    }),
    sig: "",
  };

  fm.updateFilters(event1);
  fm.updateFilters(event2);

  const allFilters = fm.getAllFilters();
  assertEquals(allFilters.length, 2);

  const pairs = fm.getAllFiltersPubKeyPairs();
  assertEquals(pairs.length, 2);
  assertEquals(pairs[0].pubkey, "pubkey1");
  assertEquals(pairs[1].pubkey, "pubkey2");
});

Deno.test("FilterManager - ignores non-10395 events", () => {
  const fm = new FilterManager();

  const event: NostrEvent = {
    id: "test1",
    pubkey: "pubkey1",
    created_at: 0,
    kind: 1, // Not 10395
    tags: [],
    content: JSON.stringify({
      filters: [
        { filter: { kinds: [1] } },
      ],
    }),
    sig: "",
  };

  fm.updateFilters(event);
  assertEquals(fm.getAllFilters().length, 0);
});

Deno.test("FilterManager - handles invalid JSON gracefully", () => {
  const fm = new FilterManager();

  const event: NostrEvent = {
    id: "test1",
    pubkey: "pubkey1",
    created_at: 0,
    kind: 10395,
    tags: [],
    content: "invalid json{{{",
    sig: "",
  };

  fm.updateFilters(event);
  assertEquals(fm.getAllFilters().length, 0);
});

Deno.test("FilterManager - handles empty filters array", () => {
  const fm = new FilterManager();

  const event: NostrEvent = {
    id: "test1",
    pubkey: "pubkey1",
    created_at: 0,
    kind: 10395,
    tags: [],
    content: JSON.stringify({
      filters: [],
    }),
    sig: "",
  };

  fm.updateFilters(event);
  assertEquals(fm.getAllFilters().length, 0);
});

Deno.test("PushManager - updates push tokens from event", () => {
  const pm = new PushManager();

  const event: NostrEvent = {
    id: "test1",
    pubkey: "pubkey1",
    created_at: 0,
    kind: 10395,
    tags: [],
    content: JSON.stringify({
      tokens: [
        { expoPushToken: "ExponentPushToken[abc]" },
        { expoPushToken: "ExponentPushToken[def]" },
      ],
    }),
    sig: "",
  };

  pm.updatePushkeys(event);
  const tokens = pm.getPushkeys("pubkey1");
  assertEquals(tokens?.length, 2);
  assertEquals(tokens?.[0], "ExponentPushToken[abc]");
});

Deno.test("PushManager - replaces tokens for same pubkey", () => {
  const pm = new PushManager();

  const event1: NostrEvent = {
    id: "test1",
    pubkey: "pubkey1",
    created_at: 0,
    kind: 10395,
    tags: [],
    content: JSON.stringify({
      tokens: [
        { expoPushToken: "ExponentPushToken[abc]" },
      ],
    }),
    sig: "",
  };

  const event2: NostrEvent = {
    id: "test2",
    pubkey: "pubkey1",
    created_at: 1,
    kind: 10395,
    tags: [],
    content: JSON.stringify({
      tokens: [
        { expoPushToken: "ExponentPushToken[xyz]" },
      ],
    }),
    sig: "",
  };

  pm.updatePushkeys(event1);
  pm.updatePushkeys(event2);

  const tokens = pm.getPushkeys("pubkey1");
  assertEquals(tokens?.length, 1);
  assertEquals(tokens?.[0], "ExponentPushToken[xyz]");
});

Deno.test("PushManager - handles multiple pubkeys", () => {
  const pm = new PushManager();

  const event1: NostrEvent = {
    id: "test1",
    pubkey: "pubkey1",
    created_at: 0,
    kind: 10395,
    tags: [],
    content: JSON.stringify({
      tokens: [
        { expoPushToken: "ExponentPushToken[abc]" },
      ],
    }),
    sig: "",
  };

  const event2: NostrEvent = {
    id: "test2",
    pubkey: "pubkey2",
    created_at: 1,
    kind: 10395,
    tags: [],
    content: JSON.stringify({
      tokens: [
        { expoPushToken: "ExponentPushToken[xyz]" },
      ],
    }),
    sig: "",
  };

  pm.updatePushkeys(event1);
  pm.updatePushkeys(event2);

  assertEquals(pm.getPushkeys("pubkey1")?.[0], "ExponentPushToken[abc]");
  assertEquals(pm.getPushkeys("pubkey2")?.[0], "ExponentPushToken[xyz]");
});

Deno.test("PushManager - returns undefined for unknown pubkey", () => {
  const pm = new PushManager();

  const tokens = pm.getPushkeys("unknown");
  assertEquals(tokens, undefined);
});

Deno.test("PushManager - ignores non-10395 events", () => {
  const pm = new PushManager();

  const event: NostrEvent = {
    id: "test1",
    pubkey: "pubkey1",
    created_at: 0,
    kind: 1, // Not 10395
    tags: [],
    content: JSON.stringify({
      tokens: [
        { expoPushToken: "ExponentPushToken[abc]" },
      ],
    }),
    sig: "",
  };

  pm.updatePushkeys(event);
  assertEquals(pm.getPushkeys("pubkey1"), undefined);
});

Deno.test("PushManager - handles invalid JSON gracefully", () => {
  const pm = new PushManager();

  const event: NostrEvent = {
    id: "test1",
    pubkey: "pubkey1",
    created_at: 0,
    kind: 10395,
    tags: [],
    content: "invalid json{{{",
    sig: "",
  };

  pm.updatePushkeys(event);
  assertEquals(pm.getPushkeys("pubkey1"), undefined);
});

Deno.test("PushManager - handles empty tokens array", () => {
  const pm = new PushManager();

  const event: NostrEvent = {
    id: "test1",
    pubkey: "pubkey1",
    created_at: 0,
    kind: 10395,
    tags: [],
    content: JSON.stringify({
      tokens: [],
    }),
    sig: "",
  };

  pm.updatePushkeys(event);
  // Should skip since tokens array is empty
  assertEquals(pm.getPushkeys("pubkey1"), undefined);
});

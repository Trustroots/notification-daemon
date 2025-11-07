import { assertEquals, assertExists, assert } from "jsr:@std/assert";
import {
  truncateRunes,
  getTagValues,
  plusCodeFromTags,
  isEncryptedAndIsForMe,
  decryptContent,
} from "./crypto.ts";
import type { Event as NostrEvent } from "nostr-tools";
import { getPublicKey, nip04, generateSecretKey } from "nostr-tools";

// Helper to convert Uint8Array to hex
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
}

Deno.test("truncateRunes - truncates long strings", () => {
  const input = "a".repeat(100);
  const result = truncateRunes(input, 10);
  assertEquals(result.length, 11); // 10 chars + ellipsis
  assertEquals(result.endsWith("…"), true);
});

Deno.test("truncateRunes - doesn't truncate short strings", () => {
  const input = "short";
  const result = truncateRunes(input, 10);
  assertEquals(result, "short");
});

Deno.test("truncateRunes - handles exactly max length", () => {
  const input = "exactly10!";
  const result = truncateRunes(input, 10);
  assertEquals(result, "exactly10!");
});

Deno.test("truncateRunes - handles unicode characters", () => {
  const input = "🔥".repeat(20);
  const result = truncateRunes(input, 5);
  assert(result.length <= 6); // 5 emojis + ellipsis
  assert(result.endsWith("…"));
});

Deno.test("getTagValues - extracts tag values", () => {
  const event: NostrEvent = {
    id: "test",
    pubkey: "test",
    created_at: 0,
    kind: 1,
    tags: [
      ["p", "pubkey1"],
      ["p", "pubkey2"],
      ["e", "event1"],
    ],
    content: "",
    sig: "",
  };

  const pTags = getTagValues(event, "p");
  assertEquals(pTags, ["pubkey1", "pubkey2"]);

  const eTags = getTagValues(event, "e");
  assertEquals(eTags, ["event1"]);
});

Deno.test("getTagValues - returns empty array when no tags match", () => {
  const event: NostrEvent = {
    id: "test",
    pubkey: "test",
    created_at: 0,
    kind: 1,
    tags: [["e", "event1"]],
    content: "",
    sig: "",
  };

  const pTags = getTagValues(event, "p");
  assertEquals(pTags, []);
});

Deno.test("getTagValues - handles empty tags array", () => {
  const event: NostrEvent = {
    id: "test",
    pubkey: "test",
    created_at: 0,
    kind: 1,
    tags: [],
    content: "",
    sig: "",
  };

  const pTags = getTagValues(event, "p");
  assertEquals(pTags, []);
});

Deno.test("plusCodeFromTags - extracts plus code from l tag", () => {
  const event: NostrEvent = {
    id: "test",
    pubkey: "test",
    created_at: 0,
    kind: 1,
    tags: [
      ["l", "8FVC9G8F+6X", "open-location-code"],
    ],
    content: "",
    sig: "",
  };

  const plusCode = plusCodeFromTags(event);
  assertEquals(plusCode, "8FVC9G8F+6X");
});

Deno.test("plusCodeFromTags - extracts plus code from #l tag", () => {
  const event: NostrEvent = {
    id: "test",
    pubkey: "test",
    created_at: 0,
    kind: 1,
    tags: [
      ["#l", "9FVC9G8F+6X", "open-location-code"],
    ],
    content: "",
    sig: "",
  };

  const plusCode = plusCodeFromTags(event);
  assertEquals(plusCode, "9FVC9G8F+6X");
});

Deno.test("plusCodeFromTags - returns unknown when no tag", () => {
  const event: NostrEvent = {
    id: "test",
    pubkey: "test",
    created_at: 0,
    kind: 1,
    tags: [],
    content: "",
    sig: "",
  };

  const plusCode = plusCodeFromTags(event);
  assertEquals(plusCode, "unknown");
});

Deno.test("isEncryptedAndIsForMe - validates encrypted message for me", () => {
  const myPubkey = "mypubkey123";
  const event: NostrEvent = {
    id: "test",
    pubkey: "sender",
    created_at: 0,
    kind: 10395,
    tags: [["p", myPubkey]],
    content: "ciphertext?iv=base64iv",
    sig: "",
  };

  assert(isEncryptedAndIsForMe(event, myPubkey));
});

Deno.test("isEncryptedAndIsForMe - rejects when no p tag", () => {
  const myPubkey = "mypubkey123";
  const event: NostrEvent = {
    id: "test",
    pubkey: "sender",
    created_at: 0,
    kind: 10395,
    tags: [],
    content: "ciphertext?iv=base64iv",
    sig: "",
  };

  assert(!isEncryptedAndIsForMe(event, myPubkey));
});

Deno.test("isEncryptedAndIsForMe - rejects when p tag is not for me", () => {
  const myPubkey = "mypubkey123";
  const event: NostrEvent = {
    id: "test",
    pubkey: "sender",
    created_at: 0,
    kind: 10395,
    tags: [["p", "someoneelse"]],
    content: "ciphertext?iv=base64iv",
    sig: "",
  };

  assert(!isEncryptedAndIsForMe(event, myPubkey));
});

Deno.test("isEncryptedAndIsForMe - rejects when no iv marker", () => {
  const myPubkey = "mypubkey123";
  const event: NostrEvent = {
    id: "test",
    pubkey: "sender",
    created_at: 0,
    kind: 10395,
    tags: [["p", myPubkey]],
    content: "plaintext",
    sig: "",
  };

  assert(!isEncryptedAndIsForMe(event, myPubkey));
});

Deno.test("decryptContent - successfully decrypts NIP-04 content", async () => {
  // Generate key pairs
  const senderPrivateKeyBytes = generateSecretKey();
  const senderPrivateKey = bytesToHex(senderPrivateKeyBytes);
  const senderPublicKey = getPublicKey(senderPrivateKey);

  const receiverPrivateKeyBytes = generateSecretKey();
  const receiverPrivateKey = bytesToHex(receiverPrivateKeyBytes);
  const receiverPublicKey = getPublicKey(receiverPrivateKey);

  const secretMessage = "This is a secret message!";

  // Encrypt from sender to receiver
  const encrypted = await nip04.encrypt(
    senderPrivateKey,
    receiverPublicKey,
    secretMessage,
  );

  // Decrypt as receiver
  const decrypted = await decryptContent(
    encrypted,
    senderPublicKey,
    receiverPrivateKey,
  );

  assertEquals(decrypted, secretMessage);
});

Deno.test("decryptContent - handles JSON content", async () => {
  const senderPrivateKeyBytes = generateSecretKey();
  const senderPrivateKey = bytesToHex(senderPrivateKeyBytes);
  const senderPublicKey = getPublicKey(senderPrivateKey);

  const receiverPrivateKeyBytes = generateSecretKey();
  const receiverPrivateKey = bytesToHex(receiverPrivateKeyBytes);
  const receiverPublicKey = getPublicKey(receiverPrivateKey);

  const jsonContent = JSON.stringify({
    filters: [{ kinds: [1] }],
    tokens: ["token1", "token2"],
  });

  const encrypted = await nip04.encrypt(
    senderPrivateKey,
    receiverPublicKey,
    jsonContent,
  );

  const decrypted = await decryptContent(
    encrypted,
    senderPublicKey,
    receiverPrivateKey,
  );

  assertEquals(decrypted, jsonContent);

  // Verify it can be parsed
  const parsed = JSON.parse(decrypted);
  assertEquals(parsed.filters.length, 1);
  assertEquals(parsed.tokens.length, 2);
});

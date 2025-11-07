#!/usr/bin/env -S deno run --allow-net --allow-env
/**
 * Testing utility for NIP-04 encryption and sending Kind 10395 events
 *
 * Usage:
 *   deno run --allow-net tools/sender.ts test
 *   deno run --allow-net tools/sender.ts derive --private-key <hex>
 *   deno run --allow-net tools/sender.ts send --message '...' --private-key <hex> --recipient-key <hex> --relay <url>
 */

import { getPublicKey, generateSecretKey, nip04, finalizeEvent, type EventTemplate } from "nostr-tools";
import { SimplePool } from "nostr-tools";

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function genKeyPair(): { privateKey: string; publicKey: string } {
  const privateKeyBytes = generateSecretKey();
  const privateKey = bytesToHex(privateKeyBytes);
  const publicKey = getPublicKey(privateKey);
  return { privateKey, publicKey };
}

async function testEncryption() {
  console.log("Generating Private / Public key pair for sender");
  const sender = genKeyPair();
  console.log(`SenderPrivateKey: ${sender.privateKey}`);
  console.log(`SenderPublicKey: ${sender.publicKey}`);

  console.log("\nGenerating Private / Public key pair for receiver");
  const receiver = genKeyPair();
  console.log(`ReceiverPrivateKey: ${receiver.privateKey}`);
  console.log(`ReceiverPublicKey: ${receiver.publicKey}`);

  const secretMsg = "this is our very secret message";
  console.log(`\nSecret message: ${secretMsg}`);

  console.log("\nEncrypting...");
  const cipherText = await nip04.encrypt(sender.privateKey, receiver.publicKey, secretMsg);
  console.log(`CipherText: ${cipherText}`);

  console.log("\nDecrypting...");
  const decrypted = await nip04.decrypt(receiver.privateKey, sender.publicKey, cipherText);
  console.log(`Decrypted: ${decrypted}`);

  if (decrypted === secretMsg) {
    console.log("\n✅ Encryption/Decryption successful!");
  } else {
    console.log("\n❌ Encryption/Decryption failed!");
  }
}

function derivePublicKey(privateKey: string) {
  console.log(`Deriving public key from private key: ${privateKey}`);
  const publicKey = getPublicKey(privateKey);
  console.log(`Derived PublicKey: ${publicKey}`);
  return publicKey;
}

async function sendEncryptedMessage(
  message: string,
  privateKey: string,
  recipientKey: string,
  relayUrl: string,
) {
  console.log(`Sending '${message}' to ${recipientKey} via ${relayUrl}`);

  const senderPublicKey = getPublicKey(privateKey);
  console.log(`Using private key with public key: ${senderPublicKey}`);

  // Encrypt the message using NIP-04
  console.log("Encrypting message...");
  const encryptedContent = await nip04.encrypt(privateKey, recipientKey, message);
  console.log(`Encrypted content: ${encryptedContent}`);

  // Create the event of kind 10395
  const eventTemplate: EventTemplate = {
    kind: 10395,
    tags: [["p", recipientKey]], // Add recipient as a 'p' tag
    content: encryptedContent,
    created_at: Math.floor(Date.now() / 1000),
  };

  const signedEvent = finalizeEvent(eventTemplate, privateKey);
  console.log(`Event ID: ${signedEvent.id}`);

  // Create a relay connection
  const pool = new SimplePool();

  try {
    console.log(`Publishing to relay ${relayUrl}...`);
    await pool.publish([relayUrl], signedEvent);
    console.log(`✅ Message sent successfully with event ID: ${signedEvent.id}`);
  } catch (error) {
    console.error(`❌ Failed to publish event: ${error}`);
  } finally {
    pool.close([relayUrl]);
  }
}

// CLI argument parsing
const command = Deno.args[0];

if (!command) {
  console.log("Usage:");
  console.log("  test                               - Test encryption/decryption");
  console.log("  derive --private-key <hex>        - Derive public key from private key");
  console.log("  send --message <msg> --private-key <hex> --recipient-key <hex> --relay <url>");
  Deno.exit(1);
}

switch (command) {
  case "test":
    await testEncryption();
    break;

  case "derive": {
    const privateKeyIndex = Deno.args.indexOf("--private-key");
    if (privateKeyIndex === -1 || !Deno.args[privateKeyIndex + 1]) {
      console.error("Error: --private-key required");
      Deno.exit(1);
    }
    derivePublicKey(Deno.args[privateKeyIndex + 1]);
    break;
  }

  case "send": {
    const messageIndex = Deno.args.indexOf("--message");
    const privateKeyIndex = Deno.args.indexOf("--private-key");
    const recipientIndex = Deno.args.indexOf("--recipient-key");
    const relayIndex = Deno.args.indexOf("--relay");

    if (
      messageIndex === -1 || !Deno.args[messageIndex + 1] ||
      privateKeyIndex === -1 || !Deno.args[privateKeyIndex + 1] ||
      recipientIndex === -1 || !Deno.args[recipientIndex + 1] ||
      relayIndex === -1 || !Deno.args[relayIndex + 1]
    ) {
      console.error("Error: --message, --private-key, --recipient-key, and --relay required");
      Deno.exit(1);
    }

    await sendEncryptedMessage(
      Deno.args[messageIndex + 1],
      Deno.args[privateKeyIndex + 1],
      Deno.args[recipientIndex + 1],
      Deno.args[relayIndex + 1],
    );
    break;
  }

  default:
    console.error(`Unknown command: ${command}`);
    Deno.exit(1);
}

import { nip04 } from "nostr-tools";
import type { Event as NostrEvent } from "nostr-tools";

/**
 * Get all tag values for a specific tag name
 */
export function getTagValues(event: NostrEvent, name: string): string[] {
  return event.tags
    .filter((tag) => tag.length > 1 && tag[0] === name)
    .map((tag) => tag[1]);
}

/**
 * Check if an event is NIP-04 encrypted and addressed to us
 */
export function isEncryptedAndIsForMe(
  event: NostrEvent,
  myPublicKey: string,
): boolean {
  // Check if has p tag
  const pTags = getTagValues(event, "p");
  if (pTags.length === 0) {
    console.log("⛔ no p tag");
    return false;
  }

  // Check if first p tag is for me
  if (pTags[0] !== myPublicKey) {
    console.log(`⛔ first p tag is not for me (was: ${pTags[0]})`);
    return false;
  }

  // Check if content has NIP-04 format marker
  if (!event.content.includes("?iv=")) {
    console.log("⛔ no iv marker");
    return false;
  }

  return true;
}

/**
 * Decrypt NIP-04 encrypted content
 */
export async function decryptContent(
  content: string,
  senderPublicKey: string,
  myPrivateKey: string,
): Promise<string> {
  try {
    const decrypted = await nip04.decrypt(myPrivateKey, senderPublicKey, content);
    console.log(`Decrypted content from ${senderPublicKey}`);
    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error}`);
  }
}

/**
 * Truncate string to max runes/characters with ellipsis
 */
export function truncateRunes(s: string, max: number): string {
  if (s.length <= max) {
    return s;
  }
  return s.slice(0, max) + "…";
}

/**
 * Extract plus code from event tags
 * Tag format: ["#l", "<PLUSCODE>", "open-location-code"] or ["l", "<PLUSCODE>", "open-location-code"]
 */
export function plusCodeFromTags(event: NostrEvent): string {
  for (const tag of event.tags) {
    if (tag.length >= 2 && (tag[0] === "#l" || tag[0] === "l")) {
      // Prefer when explicitly marked as open-location-code
      if (
        tag.length >= 3 &&
        tag[2].toLowerCase() === "open-location-code"
      ) {
        return tag[1];
      }
      return tag[1];
    }
  }
  return "unknown";
}

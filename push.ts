import Expo, { ExpoPushMessage } from "expo-server-sdk";
import type { Event as NostrEvent } from "nostr-tools";
import type { Pushtoken } from "./types.ts";
import { plusCodeFromTags, truncateRunes } from "./crypto.ts";

let expoClient: Expo;

/**
 * Initialize Expo push notification client
 */
export function setupPush(expoAccessToken: string): void {
  if (!expoAccessToken) {
    throw new Error("EXPOACCESSTOKEN not found in env. exiting.");
  }

  expoClient = new Expo({
    accessToken: expoAccessToken,
  });
}

/**
 * Send push notifications to multiple devices
 */
export async function sendPushToMany(
  tokenStrs: Pushtoken[],
  event: NostrEvent,
): Promise<void> {
  // Build title & body from the event
  const plusCode = plusCodeFromTags(event);
  const title = `New note in plus code ${plusCode}`;
  const body = truncateRunes(event.content, 80);

  const messages: ExpoPushMessage[] = [];

  for (const token of tokenStrs) {
    // Check that all push tokens are valid
    if (!Expo.isExpoPushToken(token)) {
      console.error(`Push token ${token} is not a valid Expo push token`);
      continue;
    }

    messages.push({
      to: token,
      sound: "default",
      title: title,
      body: body,
      data: {
        id: event.id,
        kind: String(event.kind),
        pubkey: event.pubkey,
        content: event.content,
        createdAt: String(event.created_at),
        tags: JSON.stringify(event.tags),
      },
      priority: "default",
    });
  }

  try {
    const chunks = expoClient.chunkPushNotifications(messages);
    const tickets = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expoClient.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error("Error sending push notification chunk:", error);
      }
    }

    // Log results
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      if (ticket.status === "ok") {
        console.log(`Sent to ${tokenStrs[i]}`);
      } else if (ticket.status === "error") {
        console.error(`Failed to ${tokenStrs[i]}: ${ticket.message}`);
      }
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

/**
 * Handle a matched event by sending push notifications
 */
export async function handleMatchedEvent(
  pushManager: { getPushkeys: (pubkey: string) => Pushtoken[] | undefined },
  pubkey: string,
  event: NostrEvent,
): Promise<void> {
  const pushTokens = pushManager.getPushkeys(pubkey);
  console.log(`✅ Sending Push to ${pushTokens} for pubkey ${pubkey}`);

  if (!pushTokens || pushTokens.length === 0) {
    console.log("No pushtoken for public key found. done.");
    return;
  }

  console.log(`number of push tokens for this msg ${pushTokens.length}`);
  await sendPushToMany(pushTokens, event);
}

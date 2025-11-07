import { SimplePool, type Event as NostrEvent } from "nostr-tools";
import { KIND_APP_DATA } from "./types.ts";

/**
 * Read all stored events from strfry relay
 */
export async function readStrfryEvents(
  strfryHost: string,
): Promise<NostrEvent[]> {
  const pool = new SimplePool();
  const events: NostrEvent[] = [];

  try {
    console.log(`Connecting to strfry relay: ${strfryHost}`);

    const sub = pool.subscribeMany(
      [strfryHost],
      [
        {
          kinds: [KIND_APP_DATA],
          limit: 0,
        },
      ],
      {
        onevent(event) {
          events.push(event);
          console.log(`Got stored event: ${event.id}`);
        },
        oneose() {
          console.log("Finished reading stored events");
        },
      },
    );

    // Wait for EOSE (End of Stored Events)
    await new Promise((resolve) => {
      setTimeout(() => {
        sub.close();
        resolve(null);
      }, 5000); // 5 second timeout
    });

    return events;
  } catch (error) {
    throw new Error(`Failed to read from strfry: ${error}`);
  } finally {
    pool.close([strfryHost]);
  }
}

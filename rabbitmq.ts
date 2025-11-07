import amqp from "amqplib";
import { matchFilter, type Event as NostrEvent } from "nostr-tools";
import type { FilterManager, PushManager } from "./managers.ts";
import type { RabbitMQWrapper } from "./types.ts";
import { KIND_APP_DATA } from "./types.ts";
import { decryptContent, isEncryptedAndIsForMe } from "./crypto.ts";
import { handleMatchedEvent } from "./push.ts";

/**
 * Setup RabbitMQ exchange and queue
 */
async function setupRabbitMQ(
  channel: amqp.Channel,
  queueName: string,
): Promise<void> {
  // Declare the exchange
  await channel.assertExchange("nostrEvents", "fanout", {
    durable: true,
  });

  // Declare the queue
  const queue = await channel.assertQueue(queueName, {
    durable: true,
  });

  // Bind the queue to the exchange
  await channel.bindQueue(queue.queue, "nostrEvents", "");

  console.log(
    `RabbitMQ setup complete: exchange='nostrEvents', queue='${queueName}'`,
  );
}

/**
 * Read and process messages from RabbitMQ
 */
export async function readRabbitMQ(
  rabbitURL: string,
  queueName: string,
  filterManager: FilterManager,
  pushManager: PushManager,
  privateKey: string,
  publicKey: string,
): Promise<void> {
  let connection: amqp.Connection | null = null;
  let channel: amqp.Channel | null = null;

  try {
    connection = await amqp.connect(rabbitURL);
    console.log("✅ Connected to RabbitMQ");

    // Handle connection errors
    connection.on("error", (err) => {
      console.error("RabbitMQ connection error:", err);
    });

    connection.on("close", () => {
      console.log("RabbitMQ connection closed");
    });

    channel = await connection.createChannel();
    await setupRabbitMQ(channel, queueName);

    console.log(
      `Starting to consume messages from queue: ${queueName} with ${
        filterManager.getAllFilters().length
      } filters`,
    );

    await channel.consume(
      queueName,
      async (msg) => {
        if (!msg) return;

        try {
          // Print raw message for debugging
          const bodyStr = msg.content.toString();
          console.log(`📥 Received message:\n${bodyStr}`);

          // Parse the wrapper structure
          const wrapper: RabbitMQWrapper = JSON.parse(bodyStr);
          let event = wrapper.event;

          // Handle AppData events (Kind 10395)
          if (event.kind === KIND_APP_DATA) {
            console.log(
              `📥 Received new appData message from pubkey: ${event.pubkey}`,
            );

            if (!isEncryptedAndIsForMe(event, publicKey)) {
              channel.ack(msg);
              return;
            }

            const decryptedContent = await decryptContent(
              event.content,
              event.pubkey,
              privateKey,
            );

            if (!decryptedContent) {
              console.log(`Decryption failed for message: ${event.id}`);
              channel.ack(msg);
              return;
            }

            // Update event with decrypted content
            event = { ...event, content: decryptedContent };

            console.log("🔄🔍 Updating filters");
            filterManager.updateFilters(event);

            console.log("🔄📱 Updating pushkeys");
            pushManager.updatePushkeys(event);

            pushManager.printPushtoken();
            console.log("----------------------------------");

            channel.ack(msg);
            return;
          }

          // Regular event processing
          console.log(
            `📋 Parsed Nostr Event:\n` +
              `  ID: ${event.id}\n` +
              `  Kind: ${event.kind}\n` +
              `  Created: ${event.created_at}\n` +
              `  Content: ${event.content}\n` +
              `  PubKey: ${event.pubkey}\n` +
              `  Source: ${wrapper.sourceInfo}`,
          );

          let matches = 0;
          for (const pair of filterManager.getAllFiltersPubKeyPairs()) {
            console.log(`🔍 Checking against filter:`, pair.filter);

            if (matchFilter(pair.filter, event)) {
              console.log(
                `✅ Filter matched event kind ${event.kind} filter: ${
                  JSON.stringify(pair.filter)
                }. pubkey: ${pair.pubkey}`,
              );
              await handleMatchedEvent(pushManager, pair.pubkey, event);
              matches++;
            } else {
              console.log(`❌ Filter did not match event kind ${event.kind}`);
            }
          }

          if (matches === 0) {
            console.log(`❌ No filter matches for event kind ${event.kind}`);
          } else {
            console.log(`✨ Event matched ${matches} filters`);
          }

          channel.ack(msg);
        } catch (error) {
          console.error(`❌ Error processing message: ${error}`);
          channel.nack(msg, false, true);
        }
      },
      {
        noAck: false,
      },
    );

    console.log("RabbitMQ consumer started successfully");

    // Keep the connection alive
    await new Promise((_, reject) => {
      connection?.on("close", () => reject(new Error("Connection closed")));
      connection?.on("error", reject);
    });
  } catch (error) {
    console.error(`Failed to read from RabbitMQ: ${error}`);
    throw error;
  } finally {
    // Cleanup
    try {
      if (channel) await channel.close();
      if (connection) await connection.close();
      console.log("RabbitMQ connection cleaned up");
    } catch (cleanupError) {
      console.error("Error during cleanup:", cleanupError);
    }
  }
}

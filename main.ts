import { loadConfig } from "./config.ts";
import { FilterManager, PushManager } from "./managers.ts";
import { readStrfryEvents } from "./nostr.ts";
import { setupPush } from "./push.ts";
import { readRabbitMQ } from "./rabbitmq.ts";
import { KIND_APP_DATA } from "./types.ts";

// Global flag for graceful shutdown
let isShuttingDown = false;

async function main() {
  console.log("🚀 Starting Nostr Push Notification Service");

  // Setup graceful shutdown
  setupShutdownHandlers();

  // Load configuration
  const config = await loadConfig();

  // Setup Expo push notifications
  setupPush(config.expoAccessToken);

  // Initialize managers
  const filterManager = new FilterManager();
  const pushManager = new PushManager();

  // Read historical events from strfry
  console.log("📚 Reading historical events from strfry...");
  try {
    const events = await readStrfryEvents(config.strfryUrl);

    // Initialize filters and push tokens from historical events
    for (const event of events) {
      if (event.kind === KIND_APP_DATA) {
        filterManager.updateFilters(event);
        pushManager.updatePushkeys(event);
      }
    }

    console.log(
      `✅ Loaded initial filters and pushtoken from strfry: ${
        filterManager.getAllFilters().length
      } filters`,
    );

    pushManager.printPushtoken();
  } catch (error) {
    console.error("⚠️ Failed to read historical events from strfry:", error);
    console.log("Continuing with empty initial state...");
  }

  // Start consuming from RabbitMQ with retry logic
  console.log("🐰 Starting RabbitMQ consumer...");
  while (!isShuttingDown) {
    try {
      await readRabbitMQ(
        config.rabbitmqUrl,
        config.rabbitmqQueue,
        filterManager,
        pushManager,
        config.privateKey,
        config.publicKey,
      );
    } catch (error) {
      if (isShuttingDown) {
        console.log("Shutdown requested, exiting...");
        break;
      }
      console.error("❌ RabbitMQ connection error:", error);
      console.log("🔄 Reconnecting in 5 seconds...");
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  console.log("👋 Service stopped gracefully");
}

function setupShutdownHandlers() {
  const shutdown = () => {
    if (isShuttingDown) {
      return;
    }
    console.log("\n🛑 Received shutdown signal, cleaning up...");
    isShuttingDown = true;
    // Give some time for cleanup
    setTimeout(() => {
      console.log("Forcing exit...");
      Deno.exit(0);
    }, 5000);
  };

  // Handle SIGINT (Ctrl+C) and SIGTERM
  Deno.addSignalListener("SIGINT", shutdown);
  Deno.addSignalListener("SIGTERM", shutdown);
}

// Run the main function
if (import.meta.main) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    Deno.exit(1);
  });
}

import type { Event as NostrEvent, Filter } from "nostr-tools";
import { matchFilter } from "nostr-tools";
import type { AppDataContent, FilterPubKeyPair, Pushtoken } from "./types.ts";
import { KIND_APP_DATA } from "./types.ts";

export class FilterManager {
  private filtersByPubkey: Map<string, Filter[]> = new Map();

  /**
   * Update filters for a pubkey from a Kind 10395 event
   */
  updateFilters(event: NostrEvent): void {
    if (event.kind !== KIND_APP_DATA) {
      return;
    }

    const newFilters = this.parseFilters([event]);
    const exists = this.filtersByPubkey.has(event.pubkey);
    this.filtersByPubkey.set(event.pubkey, newFilters);

    const count = newFilters.length;
    if (exists) {
      console.log(
        `🔄 Updating filters from existing pubkey ${event.pubkey}. Count: ${count}`,
      );
    } else {
      console.log(
        `👤 Received filters from new pubkey ${event.pubkey}. Count: ${count}`,
      );
    }
  }

  /**
   * Parse filters from AppData events
   */
  private parseFilters(events: NostrEvent[]): Filter[] {
    const filters: Filter[] = [];

    for (const [i, event] of events.entries()) {
      if (event.kind !== KIND_APP_DATA) {
        continue;
      }

      try {
        const content: AppDataContent = JSON.parse(event.content);

        if (content.filters) {
          for (const filterObj of content.filters) {
            filters.push(filterObj.filter);
            console.log(`📋 Parsed filter from event ${i}:`, filterObj.filter);
          }
        }
      } catch (error) {
        console.log(
          `❌ Failed to parse filter content from event ${i}: ${error}. Content: ${event.content}`,
        );
      }
    }

    if (filters.length === 0) {
      console.log(`⚠️ Warning: No valid filters parsed from ${events.length} events`);
    } else {
      console.log(`✅ Successfully parsed ${filters.length} filters`);
    }

    return filters;
  }

  /**
   * Get all filters from all pubkeys
   */
  getAllFilters(): Filter[] {
    const allFilters: Filter[] = [];
    for (const [pubkey, filters] of this.filtersByPubkey.entries()) {
      console.log(`📋 Pubkey ${pubkey} has ${filters.length} active filters`);
      allFilters.push(...filters);
    }
    return allFilters;
  }

  /**
   * Get all filter-pubkey pairs for matching
   */
  getAllFiltersPubKeyPairs(): FilterPubKeyPair[] {
    const result: FilterPubKeyPair[] = [];
    for (const [pubkey, filters] of this.filtersByPubkey.entries()) {
      for (const filter of filters) {
        result.push({ filter, pubkey });
      }
    }
    return result;
  }
}

export class PushManager {
  private pushkeysByPubkey: Map<string, Pushtoken[]> = new Map();

  /**
   * Update push tokens for a pubkey from a Kind 10395 event
   */
  updatePushkeys(event: NostrEvent): void {
    if (event.kind !== KIND_APP_DATA) {
      return;
    }

    const newPushtokens = this.parsePushtokens([event]);

    if (newPushtokens.length === 0) {
      console.log("No tokens found. Skipping.");
      return;
    }

    console.log(`super duper debuggggggg, ${newPushtokens[0]}`);
    const exists = this.pushkeysByPubkey.has(event.pubkey);
    this.pushkeysByPubkey.set(event.pubkey, newPushtokens);

    const count = newPushtokens.length;
    if (exists) {
      console.log(
        `🔄 Updating pushkeys from existing pubkey ${event.pubkey}. count: ${count}`,
      );
    } else {
      console.log(
        `👤 Received pushkeys from new pubkey ${event.pubkey}. Total: ${count}`,
      );
    }
    console.log(`... ${newPushtokens}`);
  }

  /**
   * Parse push tokens from AppData events
   */
  private parsePushtokens(events: NostrEvent[]): Pushtoken[] {
    const pushtokens: Pushtoken[] = [];

    for (const [i, event] of events.entries()) {
      if (event.kind !== KIND_APP_DATA) {
        continue;
      }

      try {
        const content: AppDataContent = JSON.parse(event.content);

        if (content.tokens) {
          for (const tokenObj of content.tokens) {
            const pushtoken = tokenObj.expoPushToken;
            console.log(`📋 Parsed pushtoken from event ${i}: ${pushtoken}`);
            pushtokens.push(pushtoken);
          }
        }
      } catch (error) {
        console.log(
          `❌ Failed to parse pushtoken content from event ${i}: ${error}`,
        );
      }
    }

    if (pushtokens.length === 0) {
      console.log(
        `⚠️ Warning: No valid pushtokens parsed from ${events.length} events`,
      );
    } else {
      console.log(`✅ Successfully parsed ${pushtokens.length} pushtokens`);
    }

    return pushtokens;
  }

  /**
   * Get push tokens for a specific pubkey
   */
  getPushkeys(pubkey: string): Pushtoken[] | undefined {
    return this.pushkeysByPubkey.get(pubkey);
  }

  /**
   * Print all push tokens (for debugging)
   */
  printPushtoken(): void {
    console.log("=== debug: Printing all pushtoken for each pubkey");
    for (const [pubkey, pushkeys] of this.pushkeysByPubkey.entries()) {
      console.log(`Pubkey: ${pubkey} has pushkeys ->`);
      pushkeys.forEach((key, i) => {
        console.log(`   [${i}]: ${key}`);
      });
    }
    console.log("=== end of events ===");
  }
}

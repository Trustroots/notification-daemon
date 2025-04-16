package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"

	"github.com/nbd-wtf/go-nostr"
	amqp "github.com/rabbitmq/amqp091-go"
)

const (
	KindAppData = 10395
)

// FilterManager keeps track of all filters, ensuring only latest message per pubkey
type FilterManager struct {
	filtersByPubkey map[string][]nostr.Filter
}

func NewFilterManager() *FilterManager {
	return &FilterManager{
		filtersByPubkey: make(map[string][]nostr.Filter),
	}
}

type Pushtoken string

type PushManager struct {
	pushkeysByPubkey map[string][]Pushtoken
}

func NewPushManager() *PushManager {
	return &PushManager{
		pushkeysByPubkey: make(map[string][]Pushtoken),
	}
}

func (fm *FilterManager) UpdateFilters(event nostr.Event) {
	if event.Kind != KindAppData {
		return
	}

	newFilters := parseFilters([]nostr.Event{event})

	_, exists := fm.filtersByPubkey[event.PubKey]
	if exists {
		log.Printf("🔄 Updating filters from existing pubkey %s", event.PubKey)
	} else {
		log.Printf("👤 Received filters from new pubkey %s", event.PubKey)
	}

	fm.filtersByPubkey[event.PubKey] = newFilters
	log.Printf("  Now has %d filters", len(newFilters))
}

func (pm *PushManager) UpdatePushkeys(event nostr.Event) {
	if event.Kind != KindAppData {
		return
	}

	newPushtokens := parsePushtokens([]nostr.Event{event})


	//log.Printf("super duper debuggggggg, %s", newPushtokens[])
	_, exist := pm.pushkeysByPubkey[event.PubKey]
	if exist {
		log.Printf("🔄 Updating pushkeys from existing pubkey %s", event.PubKey)
	} else {
		log.Printf("👤 Received pushkeys from new pubkey %s", event.PubKey)
	}

	pm.pushkeysByPubkey[event.PubKey] = newPushtokens
	log.Printf("  Now has %d pushkeys", len(newPushtokens))
}

func (fm *FilterManager) GetAllFilters() []nostr.Filter {
	var allFilters []nostr.Filter
	for pubkey, filters := range fm.filtersByPubkey {
		log.Printf("  📋 Pubkey %s has %d active filters", pubkey, len(filters))
		allFilters = append(allFilters, filters...)
	}
	return allFilters
}

func processMessage(msg string) {
	log.Printf("Processing message: %s", msg)
}

func readStrfryEvents(strfryHost string) ([]nostr.Event, error) {
	ctx := context.Background()

	relay, err := nostr.RelayConnect(ctx, strfryHost)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to strfry: %v", err)
	}
	defer relay.Close()

	filters := nostr.Filters{
		nostr.Filter{
			Kinds: []int{KindAppData},
			Limit: 0,
		},
	}

	sub, err := relay.Subscribe(ctx, filters)
	if err != nil {
		return nil, fmt.Errorf("failed to subscribe: %v", err)
	}

	var events []nostr.Event

	// Wait for all stored events
	for {
		select {
		case ev := <-sub.Events:
			events = append(events, *ev)
			log.Printf("Got stored event: %v", ev.ID)
		case <-sub.EndOfStoredEvents:
			log.Println("Finished reading stored events")
			return events, nil
		}
	}
}

func printEvents(events []nostr.Event) {
	log.Println("=== Debug: Printing all events ===")
	for i, event := range events {
		log.Printf("Event %d: Kind=%d Content=%s", i, event.Kind, event.Content)
	}
	log.Println("=== End of events ===")
}

func handleMatchedEvent(event nostr.Event) {
	log.Printf("✅ Matched event %s! Would process this...", event.ID)
}

func setupRabbitMQ(ch *amqp.Channel, queueName string) error {
	// Declare the exchange
	err := ch.ExchangeDeclare(
		"nostrEvents", // exchange name
		"fanout",      // exchange type
		true,          // durable
		false,         // auto-deleted
		false,         // internal
		false,         // no-wait
		nil,           // arguments
	)
	if err != nil {
		return fmt.Errorf("failed to declare exchange: %v", err)
	}

	// Declare the queue
	queue, err := ch.QueueDeclare(
		queueName, // queue name
		true,      // durable
		false,     // delete when unused
		false,     // exclusive
		false,     // no-wait
		nil,       // arguments
	)
	if err != nil {
		return fmt.Errorf("failed to declare queue: %v", err)
	}

	// Bind the queue to the exchange
	err = ch.QueueBind(
		queue.Name,    // queue name
		"",            // routing key
		"nostrEvents", // exchange name
		false,         // no-wait
		nil,           // arguments
	)
	if err != nil {
		return fmt.Errorf("failed to bind queue: %v", err)
	}

	log.Printf("RabbitMQ setup complete: exchange='nostrEvents', queue='%s'", queueName)
	return nil
}

func readRabbitMQ(rabbitURL string, queueName string, fm *FilterManager, pm *PushManager) error {
	conn, err := amqp.Dial(rabbitURL)
	if err != nil {
		return fmt.Errorf("failed to connect to RabbitMQ: %v", err)
	}
	defer conn.Close()

	ch, err := conn.Channel()
	if err != nil {
		return fmt.Errorf("failed to open channel: %v", err)
	}
	defer ch.Close()

	if err := setupRabbitMQ(ch, queueName); err != nil {
		return fmt.Errorf("failed to setup RabbitMQ: %v", err)
	}

	msgs, err := ch.Consume(
		queueName, // queue
		"",        // consumer
		false,     // auto-ack
		false,     // exclusive
		false,     // no-local
		false,     // no-wait
		nil,       // args
	)
	if err != nil {
		return fmt.Errorf("failed to register a consumer: %v", err)
	}

	log.Printf("🔍 Loaded filters:")
	for pubkey, filters := range fm.filtersByPubkey {
		log.Printf("  Pubkey %s has filters: %+v", pubkey, filters) // add pushtoken
	}

	log.Printf("Starting to consume messages from queue: %s with %d filters",
		queueName,
		len(fm.GetAllFilters()))

	for msg := range msgs {
		// Print raw message for debugging
		log.Printf("📥 Received message:\n%s", string(msg.Body))

		// Parse the wrapper structure first
		var wrapper struct {
			Event      nostr.Event `json:"event"`
			Type       string      `json:"type"`
			ReceivedAt int64       `json:"receivedAt"`
			SourceInfo string      `json:"sourceInfo"`
		}

		if err := json.Unmarshal(msg.Body, &wrapper); err != nil {
			log.Printf("❌ Failed to parse wrapper: %v\n", err)
			msg.Nack(false, true)
			continue
		}

		event := wrapper.Event

		if event.Kind == KindAppData {
			log.Printf("📥 Received new appData message from pubkey: %s", event.PubKey)

			log.Printf("🔄🔍 Updating filters")
			fm.UpdateFilters(event)

			log.Printf("🔄📱 Updating pushkeys")
			pm.UpdatePushkeys(event)

			msg.Ack(false)
			continue
		}

		// Regular event processing
		log.Printf("📋 Parsed Nostr Event:\n"+
			"  ID: %s\n"+
			"  Kind: %d\n"+
			"  Created: %v\n"+
			"  Content: %s\n"+
			"  PubKey: %s\n"+
			"  Source: %s",
			event.ID,
			event.Kind,
			event.CreatedAt,
			event.Content,
			event.PubKey,
			wrapper.SourceInfo)

		// Check all current filters
		matches := 0
		for _, filter := range fm.GetAllFilters() {
			log.Printf("  🔍 Checking against filter: %+v", filter)
			if filter.Matches(&event) {
				log.Printf("  ✅ Filter matched event kind %d", event.Kind)
				handleMatchedEvent(event)
				matches++
			} else {
				log.Printf("  ❌ Filter did not match event kind %d", event.Kind)
			}
		}

		if matches == 0 {
			log.Printf("❌ No filter matches for event kind %d", event.Kind)
		} else {
			log.Printf("✨ Event matched %d filters", matches)
		}

		msg.Ack(false)
	}

	return nil
}


func parseFilters(events []nostr.Event) []nostr.Filter {
	var filters []nostr.Filter

	for i, event := range events {
		if event.Kind != KindAppData {
			continue
		}

		var content struct {
            Filters []json.RawMessage `json:"filters"`
        }
        
        if err := json.Unmarshal([]byte(event.Content), &content); err != nil {
            log.Printf("❌ Failed to parse filter content from event %d: %v", i, err)
            continue
        }
		for _, rawFilter := range content.Filters {
            var filter nostr.Filter
            if err := json.Unmarshal(rawFilter, &filter); err != nil {
                log.Printf("❌ Failed to parse individual filter: %v", err)
                continue
            } 
            
            log.Printf("📋 Parsed filter from event %d: %+v", i, filter)
            filters = append(filters, filter)
        }
    }

	if len(filters) == 0 {
		log.Printf("⚠️ Warning: No valid filters parsed from %d events", len(events))
	} else {
		log.Printf("✅ Successfully parsed %d filters", len(filters))
	}

	return filters
}

func parsePushtokens(events []nostr.Event) []Pushtoken {
	var pushtokens []Pushtoken

	for i, event := range events {
		if event.Kind != KindAppData {
			continue
		}

		var content struct {
            Pushtokens []json.RawMessage `json:"tokens"`
        }
        
        if err := json.Unmarshal([]byte(event.Content), &content); err != nil {
            log.Printf("❌ Failed to parse pushtoken content from event %d: %v", i, err)
            continue
        }
		for _, rawPushtoken := range content.Pushtokens {
            var pushtoken Pushtoken
            if err := json.Unmarshal(rawPushtoken, &pushtoken); err != nil {
                log.Printf("❌ Failed to parse individual pushtoken: %v", err)
                continue
            } 
            
            log.Printf("📋 Parsed pushtoken from event %d: %+v", i, pushtoken)
            pushtokens = append(pushtokens, pushtoken)
        }
    }

	if len(pushtokens) == 0 {
		log.Printf("⚠️ Warning: No valid pushtokens parsed from %d events", len(events))
	} else {
		log.Printf("✅ Successfully parsed %d pushtokens", len(pushtokens))
	}

	return pushtokens
}

func main() {
	filterManager := NewFilterManager()
	pushManager := NewPushManager() 

	strfryHost := os.Getenv("STRFRY_URL")
	if strfryHost == "" {
		strfryHost = "ws://localhost:7777"
	}

	events, err := readStrfryEvents(strfryHost)
	if err != nil {
		log.Fatal("Failed to read from strfry:", err)
	}

	// Initialize the map with existing filters
	for _, event := range events {
		if event.Kind == KindAppData {
			filterManager.UpdateFilters(event)
			pushManager.UpdatePushkeys(event)
		}
	}

	log.Printf("✅ Loaded initial filters and pushtoken from strfry: %d pubkeys",
		len(filterManager.filtersByPubkey))

	printEvents(events)

	rabbitURL := os.Getenv("RABBITMQ_URL")
	if rabbitURL == "" {
		rabbitURL = "amqp://guest:guest@localhost:5672/"
	}
	queueName := os.Getenv("RABBITMQ_QUEUE")
	if queueName == "" {
		queueName = "nostr_events"
	}

	if err := readRabbitMQ(rabbitURL, queueName, filterManager, pushManager); err != nil {
		log.Fatal("Failed to read from RabbitMQ:", err)
	}
}

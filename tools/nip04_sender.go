package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/nbd-wtf/go-nostr"
	"github.com/nbd-wtf/go-nostr/nip04"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Println("expected 'send' or 'derive' subcommand")
		os.Exit(1)
	}

	switch os.Args[1] {
	case "derive":
		deriveCmd := flag.NewFlagSet("derive", flag.ExitOnError)
		privateKey := deriveCmd.String("private-key", "", "Private key (hex)")

		deriveCmd.Parse(os.Args[2:])
		if *privateKey == "" {
			deriveCmd.Usage()
			log.Fatal("required flag --private-key missing")
		}

		fmt.Printf("Deriving stuff from %s\n", *privateKey)
		publicKey, err := nostr.GetPublicKey(*privateKey)
		if err != nil {
			log.Fatalf("Failed to derive public key. %v", err)
		}
		log.Printf("Derived Publickey: %s", publicKey)

	case "send":
		sendCmd := flag.NewFlagSet("send", flag.ExitOnError)
		message := sendCmd.String("message", "", "Message to encrypt and send")
		privateKey := sendCmd.String("private-key", "", "Sender's private key (hex)")
		recipientKey := sendCmd.String("recipient-key", "", "Recipient's public key (hex)")
		relay := sendCmd.String("relay", "", "Relay URL")

		sendCmd.Parse(os.Args[2:])
		if *message == "" || *privateKey == "" || *recipientKey == "" || *relay == "" {
			sendCmd.Usage()
			log.Fatal("required flags missing")
		}

		fmt.Printf("Sending '%s' from %s to %s via %s\n", *message, *privateKey, *recipientKey, *relay)

		var senderPrivateKey string
		var senderPublicKey string

		senderPrivateKey = *privateKey
		pubKey, err := nostr.GetPublicKey(*privateKey)
		if err != nil {
			log.Fatalf("Failed to derive public key: %v", err)
		}
		senderPublicKey = pubKey
		fmt.Printf("Using provided private key with public key: %s\n", senderPublicKey)

		shared, err := nip04.ComputeSharedSecret(*recipientKey, senderPrivateKey)
		if err != nil {
			log.Fatalf("Failed to compute shared secret: %v", err)

		}

		// Encrypt the message using NIP04
		log.Printf("encrypt db message: %s, share: %s", *message, shared)
		encryptedContent, err := nip04.Encrypt(*message, shared)
		if err != nil {
			log.Fatalf("Failed to encrypt message: %v", err)
		}

		fmt.Printf("Encrypted content: %s\n", encryptedContent)

		// Create the event of kind 12345
		event := nostr.Event{
			PubKey:    senderPublicKey,
			CreatedAt: nostr.Timestamp(time.Now().Unix()),
			Kind:      10395,
			Tags:      nostr.Tags{nostr.Tag{"p", *recipientKey}}, // Add recipient as a 'p' tag
			Content:   encryptedContent,
		}

		// Sign the event
		err = event.Sign(senderPrivateKey)
		if err != nil {
			log.Fatalf("Failed to sign event: %v", err)
		}

		// Create a relay connection
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		relayConn, err := nostr.RelayConnect(ctx, *relay)
		if err != nil {
			log.Fatalf("Failed to connect to relay: %v", err)
		}
		defer relayConn.Close()

		// Publish the event to the relay
		err = relayConn.Publish(ctx, event)
		if err != nil {
			log.Fatalf("Failed to publish event: %v", err)
		}

		fmt.Printf("Message sent successfully with event ID: %s\n", event.ID)

	default:
		fmt.Println("unknown command:", os.Args[1])
		os.Exit(1)
	}

}

include ../.env
export

TARGET = sender.ts
RELAY = wss://relay.trustroots.org
# This private key is for testing and may be public in VC
PRIVKEY = 6e4d5d4c2a017e8c4c8dc02cbeb1d1dbfcb8a52f2bde53d1ec1b7ffbe65f3c56
PUBKEY = 51340781544c47086eb049b0ac10403d75554bf7531f5934b75194f70d15f5f5

MESSAGE = '{"filters": [{"kinds": [10333]}], "tokens":["some", "other"]}'

send:
	deno run --allow-net $(TARGET) send \
		--message $(MESSAGE) \
		--private-key $(PRIVKEY) \
		--recipient-key $(PUBKEY) \
		--relay $(RELAY)

derive:
	deno run --allow-net $(TARGET) derive --private-key $(PRIVKEY)

test:
	deno run --allow-net $(TARGET) test

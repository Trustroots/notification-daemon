include env
export

TARGET = app_kind_enc_sender.go
RELAY = -relay wss://relay.trustroots.org
# this private key is for testing any may be public in VC
PRIVKEY = -private-key 6e4d5d4c2a017e8c4c8dc02cbeb1d1dbfcb8a52f2bde53d1ec1b7ffbe65f3c56
PUBKEY = -recipient-key  51340781544c47086eb049b0ac10403d75554bf7531f5934b75194f70d15f5f5

MESSAGE = -message '{"filters": [{"kinds": [10333]}], "tokens":["some", "other"]}'
MESSAGE_C = -message '{"filters": [{"kinds": [10333]}], "tokens":["$(TOKEN)"]}'
send:
	go run $(TARGET) $@ $(MESSAGE_C) $(PRIVKEY) $(RELAY) $(PUBKEY)

derive:
	go run $(TARGET) $@ $(PRIVKEY)

test:
	go run $(TARGET) $@

ttt:
	echo $$TOKEN

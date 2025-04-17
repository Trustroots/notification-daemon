TARGET = app_kind_enc_sender.go

RELAY = -relay wss://relay.trustroots.org


# this privatek
PRIVKEY = -private-key 6e4d5d4c2a017e8c4c8dc02cbeb1d1dbfcb8a52f2bde53d1ec1b7ffbe65f3c56
#PUBKEY = -recipient-key 3e6bd742536aa1bd9700503f665f54a12a09e1f08256de1cb712cdb7b3f31757
PUBKEY = -recipient-key  51340781544c47086eb049b0ac10403d75554bf7531f5934b75194f70d15f5f5
#PUBKEY = -recipient-key 02c1b22f3a15d1a64b2fa9c1a5c3a22b7dfcd6b32d4b2d5ccf2fce7463b2235d99
send:
	go run $(TARGET) $@ -message 23456789abcdef01 $(PRIVKEY) $(RELAY) $(PUBKEY)


derive:
	go run $(TARGET) $@ $(PRIVKEY)


test:
	go run $(TARGET) $@ 

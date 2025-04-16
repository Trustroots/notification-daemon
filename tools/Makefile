
RELAY = -relay wss://relay.trustroots.org
PRIVKEY = -private-key 6e4d5d4c2a017e8c4c8dc02cbeb1d1dbfcb8a52f2bde53d1ec1b7ffbe65f3c56
PUBKEY = -recipient-key 3e6bd742536aa1bd9700503f665f54a12a09e1f08256de1cb712cdb7b3f31757
#PUBKEY = -recipient-key 02c1b22f3a15d1a64b2fa9c1a5c3a22b7dfcd6b32d4b2d5ccf2fce7463b2235d99

send:
	go run nip04_sender.go send -message fooooooSECRET $(PRIVKEY) $(RELAY) $(PUBKEY)


derive:
	go run nip04_sender.go derive $(PRIVKEY) 
.PHONY: run build shell

include privatekey
export

STRFRY = wss://relay.trustroots.org
KIND = 10395

forward_ports:
	# forward AMQP and rabbit-web-UI from tr to docker and localhost respectivly
	ssh -N -L 8888:0.0.0.0:15672 -L 0.0.0.0:5672:157.90.239.153:5672 tr

test_privatekey_export:
	echo $$PRIVATEKEY

###############################
### some nak testing things ###
###############################

nak_send:
	nak event -c hello $(STRFRY)

nak_req:
	nak req --limit 50000 --paginate --paginate-interval 1s $(STRFRY)

nak_event12345:
	nak event -c hello $(STRFRY) -k 12345

nak_eventother:
	nak event -c hello $(STRFRY) -k 666

nak_filter_121314:
	nak event -k $(KIND) -c  '{"filters": [{"kinds": [10111]}]}' $(STRFRY) --sec 12
	nak event -k $(KIND) -c  '{"filters": [{"kinds": [10222]}]}' $(STRFRY) --sec 13
	nak event -k $(KIND) -c  '{"filters": [{"kinds": [10333]}]}' $(STRFRY) --sec 14

nak_filterrand:
	nak event -k $(KIND) -c  '{"filters": [{"kinds": [10333]}]}' $(STRFRY) --sec $(shell echo $$RANDOM)

nak_filter12345:
	#nak event -k $(KIND) -c '{ kinds: [0] }'  $(STRFRY) --sec 11
	nak event -k $(KIND) -c  '{"filters": [{"kinds": [12345]}]}' $(STRFRY) --sec 11


nak_filter_and_token:
	nak event -k $(KIND) -c  '{"filters": [{"kinds": [10222]}], "tokens": ["fooo", "bar", "foobar"]}' $(STRFRY) --sec 13

nak_filter_some:
	make send12345
	make sendother
	make send12345
	make sendother

### nip04 shit
nip04:
	#nak req -k 10395 -a 864c1494cd39a106743fe7426daa20b7a39c3c83da281b1e8d98789210ffe46f wss://relay.trustroots.org
	cat nip04.json| nak event wss://relay.trustroots.org/

####################
#### end of nak ####
####################

run:
	PRIVATEKEY=$$PRIVATEKEY docker compose up --build

build:
	docker compose build

shell:
	docker compose exec notifi sh

.PHONY: run build shell

STRFRY = wss://relay.trustroots.org
KIND = 10395

forward_ports:
	# forward AMQP and rabbit-web-UI from tr to docker and localhost respectivly
	ssh -N -L 8888:0.0.0.0:15672 -L 0.0.0.0:5672:157.90.239.153:5672 tr

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
	nak event -k $(KIND) -c  '{"filters": [{"kind": [10111]}]}' $(STRFRY) --sec 12
	nak event -k $(KIND) -c  '{"filters": [{"kind": [10222]}]}' $(STRFRY) --sec 13
	nak event -k $(KIND) -c  '{"filters": [{"kind": [10333]}]}' $(STRFRY) --sec 14

nak_filterrand:
	nak event -k $(KIND) -c  '{"filters": [{"kind": [10333]}]}' $(STRFRY) --sec $(shell echo $$RANDOM)

nak_filter12345:
	#nak event -k $(KIND) -c '{ kinds: [0] }'  $(STRFRY) --sec 11
	nak event -k $(KIND) -c  '{"filters": [{"kind": [12345]}]}' $(STRFRY) --sec 11

nak_filter_some:
	make send12345
	make sendother
	make send12345
	make sendother

####################
#### end of nak ####
####################

run:
	docker compose up --build

build:
	docker compose build

shell:
	docker compose exec notifi sh

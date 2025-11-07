.PHONY: run build dev test shell

include .env
export

run:
	PRIVATEKEY=$$PRIVATEKEY EXPOACCESSTOKEN=$$EXPOACCESSTOKEN docker compose up --build

build:
	docker compose build

dev:
	deno task dev

test:
	deno task test

shell:
	docker compose exec notifi_deno sh

# Development helpers
fmt:
	deno fmt

lint:
	deno lint

check:
	deno check main.ts

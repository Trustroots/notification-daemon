FROM golang:1.24-rc-alpine

WORKDIR /app
COPY go.mod ./
COPY main.go ./

RUN go mod tidy && go mod download

CMD ["go", "run", "main.go"]

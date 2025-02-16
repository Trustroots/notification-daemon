FROM golang:1.24-rc-alpine

WORKDIR /app
COPY main.go ./main.go
COPY go.mod go.sum ./

RUN go mod tidy && go mod download

CMD ["go", "run", "main.go"]

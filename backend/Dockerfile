FROM golang:alpine AS build
WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /server .

FROM gcr.io/distroless/static-debian13:nonroot

COPY --from=build /server /server

EXPOSE 8080

ENTRYPOINT ["/server"]
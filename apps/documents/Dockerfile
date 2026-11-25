# syntax=docker/dockerfile:1
# Build context: the repository root (docker compose / Railway).

FROM rust:1.100-slim-bookworm@sha256:7c7d4eb4d05b7781187a327809466cfddf29753f6defdc3d19a0e291951b7a37 AS builder

WORKDIR /src
# rust-toolchain.toml is left out: this image already is the pinned version.
COPY Cargo.toml Cargo.lock ./
COPY packages/proto packages/proto
COPY apps/documents apps/documents
RUN --mount=type=cache,target=/usr/local/cargo/registry \
	--mount=type=cache,target=/src/target \
	cargo build --release --locked -p documents \
	&& cp target/release/documents /documents

FROM debian:bookworm-slim@sha256:734a72b3d6142a71993b4bc580ca01d8ca687f77a2c422d96a961d3376b179bc

RUN useradd --system --uid 10001 --no-create-home documents
COPY --from=builder /documents /usr/local/bin/documents
USER 10001
EXPOSE 50051 9464
ENTRYPOINT ["/usr/local/bin/documents"]

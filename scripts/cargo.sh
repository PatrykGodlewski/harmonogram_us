#!/usr/bin/env sh
# Runs cargo for the Rust workspace: the local toolchain if installed (rust-toolchain.toml
# pins the version), otherwise the same version in Docker, so contributors need only Docker.
set -eu
cd "$(dirname "$0")/.."
if command -v cargo >/dev/null 2>&1; then
	exec cargo "$@"
fi
exec docker run --rm -u "$(id -u):$(id -g)" \
	-e CARGO_HOME=/w/target/cargo-home -e RUSTUP_HOME=/w/target/rustup-home \
	-v "$PWD":/w -w /w \
	rust:1.100-slim-bookworm sh -c 'export PATH="$CARGO_HOME/bin:$PATH"; [ -x "$CARGO_HOME/bin/cargo" ] || { mkdir -p "$CARGO_HOME"; cp -r /usr/local/cargo/bin "$CARGO_HOME/"; }; exec cargo "$@"' cargo "$@"

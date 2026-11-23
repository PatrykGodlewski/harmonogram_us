#!/usr/bin/env bash
# Copies the compose setup and settings to the server and starts the latest images.
# Usage: deploy/deploy.sh   (reads the server from Terraform outputs)
set -euo pipefail
cd "$(dirname "$0")/.."

host=$(terraform -chdir=infra/azure output -raw fqdn)
user=deploy
key=${SSH_KEY:-$HOME/.ssh/harmonogram_azure}
target="$user@$host"
ssh_opts=(-i "$key" -o StrictHostKeyChecking=accept-new)

if [[ ! -f deploy/.env.production ]]; then
	echo "Missing deploy/.env.production (copy deploy/.env.production.example)" >&2
	exit 1
fi

scp "${ssh_opts[@]}" deploy/compose.yml deploy/Caddyfile "$target:/opt/harmonogram/"
# The settings file holds secrets: copied as is, readable only by the deploy user.
scp "${ssh_opts[@]}" deploy/.env.production "$target:/opt/harmonogram/.env"
ssh "${ssh_opts[@]}" "$target" 'cd /opt/harmonogram && chmod 600 .env && docker compose pull && docker compose up -d --remove-orphans && docker compose ps'

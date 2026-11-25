#!/usr/bin/env bash
# Public demo from this computer over Cloudflare quick tunnels (docs/development.md).
# Usage: scripts/tunnel.sh        start (or refresh) and print the two addresses
#        scripts/tunnel.sh stop   stop the demo (the dev database keeps running)
set -euo pipefail
cd "$(dirname "$0")/.."

compose=(docker compose -f docker-compose.yml -f docker-compose.tunnel.yml --profile app)

if [[ ${1:-} == stop ]]; then
	"${compose[@]}" stop web admin worker tunnel-web tunnel-admin
	exit 0
fi

"${compose[@]}" up -d tunnel-web tunnel-admin

# Each quick tunnel gets a random address; it is in the tunnel's log.
url_of() {
	local url
	for _ in $(seq 1 60); do
		url=$("${compose[@]}" logs "$1" 2>&1 | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | tail -1 || true)
		if [[ -n $url ]]; then
			echo "$url"
			return
		fi
		sleep 1
	done
	echo "No address from $1 (see: docker compose logs $1)" >&2
	exit 1
}

PUBLIC_WEB_URL=$(url_of tunnel-web)
PUBLIC_ADMIN_URL=$(url_of tunnel-admin)
export PUBLIC_WEB_URL PUBLIC_ADMIN_URL

# The apps must know their public addresses (sign-in, links in e-mails): (re)start them.
"${compose[@]}" up -d --build web admin worker

echo
echo "Public site:  $PUBLIC_WEB_URL"
echo "Admin panel:  $PUBLIC_ADMIN_URL"

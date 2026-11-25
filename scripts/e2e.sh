#!/bin/sh
# Drives the e2e stack (compose project "harmonogram-e2e"); see e2e/README.md.
#   scripts/e2e.sh ensure [--force]          reuse a healthy, current stack; rebuild only when code changed
#   scripts/e2e.sh run [--force] [args...]   ensure, then playwright test with the given args
#   scripts/e2e.sh logs [service] [--tail N] container logs (default: all services, last 100 lines)
set -eu

cd "$(dirname "$0")/.."

# The committed compose file is the source of truth: a local docker-compose.override.yml
# (picked up automatically by plain `docker compose`) must not change the e2e stack.
export COMPOSE_FILE=docker-compose.yml

SERVICES="db mailpit storage documents teams-mock oidc-mock web admin worker"
HEALTHCHECKED="db mailpit storage documents"
STAMP_FILE=.e2e/stack-stamp
# Everything baked into the images; e2e/ (tests, bind-mounted mocks) needs no rebuild.
STAMP_PATHS="apps packages proto services Dockerfile pnpm-lock.yaml Cargo.toml Cargo.lock"

compose() {
	docker compose -p harmonogram-e2e --env-file .env --env-file e2e/ports.env \
		--profile app --profile e2e "$@"
}

sha256() {
	if command -v sha256sum >/dev/null 2>&1; then
		sha256sum | cut -d" " -f1
	else
		shasum -a 256 | cut -d" " -f1
	fi
}

# HEAD plus the content of every uncommitted change (tracked diff and untracked files),
# so a second edit to an already-modified file still changes the stamp.
stamp() {
	{
		git rev-parse HEAD
		git status --porcelain=v1 -- $STAMP_PATHS
		git diff HEAD --binary -- $STAMP_PATHS
		git ls-files --others --exclude-standard -- $STAMP_PATHS | git hash-object --stdin-paths
	} | sha256
}

healthy() {
	states=$(compose ps --format '{{.Service}} {{.State}} {{.Health}}' 2>/dev/null) || return 1
	for service in $SERVICES; do
		echo "$states" | grep -q "^$service running" || return 1
	done
	for service in $HEALTHCHECKED; do
		echo "$states" | grep -q "^$service running healthy$" || return 1
	done
	curl -fsS -o /dev/null http://localhost:3100/ || return 1
	curl -fsS -o /dev/null http://localhost:3101/ || return 1
}

psql_e2e() {
	compose exec -T db psql -U postgres -v ON_ERROR_STOP=1 "$@"
}

migrate_db() {
	# ports.env is a compose env file, not a shell script (unquoted values with spaces).
	db_port=$(sed -n 's/^DB_PORT=//p' e2e/ports.env)
	db_url="postgresql://postgres:postgres@localhost:${db_port:-15432}/harmonogram_us"
	# drizzle-kit keeps its journal in the "drizzle" schema.
	journal=$(psql_e2e -d harmonogram_us -tAc "SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL")
	if [ "$journal" != "t" ]; then
		echo "e2e DB was seeded without the drizzle migration journal; resetting it (disposable data)"
		psql_e2e -c "DROP DATABASE IF EXISTS harmonogram_us WITH (FORCE)" -c "CREATE DATABASE harmonogram_us"
	fi
	DATABASE_URL=$db_url pnpm --filter @repo/db db:migrate
}

ensure() {
	force=$1
	current=$(stamp)
	if [ "$force" = no ] && [ -f "$STAMP_FILE" ] && [ "$(cat "$STAMP_FILE")" = "$current" ] && healthy; then
		echo "e2e stack up to date"
		return 0
	fi
	rm -f "$STAMP_FILE"
	compose up -d --build --wait --remove-orphans
	migrate_db
	mkdir -p "$(dirname "$STAMP_FILE")"
	echo "$current" >"$STAMP_FILE"
	printf "\ne2e stack rebuilt and migrated\n"
}

usage() {
	sed -n '2,5p' "$0" >&2
	exit 2
}

command=${1:-}
[ $# -gt 0 ] && shift

case $command in
ensure)
	case ${1:-} in
	"") ensure no ;;
	--force) ensure yes ;;
	*) usage ;;
	esac
	;;
run)
	force=no
	if [ "${1:-}" = --force ]; then
		force=yes
		shift
	fi
	ensure "$force"
	pnpm --filter e2e exec playwright test "$@"
	;;
logs)
	service=""
	tail=100
	while [ $# -gt 0 ]; do
		case $1 in
		--tail)
			[ $# -ge 2 ] || usage
			tail=$2
			shift 2
			;;
		-*) usage ;;
		*)
			service=$1
			shift
			;;
		esac
	done
	compose logs --no-color --tail "$tail" $service
	;;
*) usage ;;
esac

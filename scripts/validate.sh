#!/bin/sh
# Runs every repository gate and prints a summary; answers "is the tree green?".
#   pnpm validate [--only gate[,gate...]]
# Gates, in order: lint typecheck test build rust e2e. Every selected gate runs even after
# a failure, so one run gives the full picture.
# Exit: 0 all selected gates passed, 1 any gate failed, 2 usage error (unknown gate/argument).
set -u

cd "$(dirname "$0")/.."

GATES="lint typecheck test build rust e2e"

usage() {
	echo "usage: pnpm validate [--only gate[,gate...]]  (gates: $GATES)" >&2
	exit 2
}

gate_command() {
	case "$1" in
	lint) echo "pnpm lint && pnpm proto:lint" ;;
	typecheck) echo "pnpm typecheck" ;;
	test) echo "pnpm test" ;;
	build) echo "pnpm build" ;;
	rust) echo "pnpm rust:lint && pnpm rust:test" ;;
	e2e) echo "scripts/e2e.sh ensure && pnpm e2e" ;;
	esac
}

selected=$GATES
case "${1:-}" in
"") ;;
--only)
	[ -n "${2:-}" ] && [ $# -eq 2 ] || usage
	selected=$(echo "$2" | tr ',' ' ')
	for gate in $selected; do
		case " $GATES " in
		*" $gate "*) ;;
		*)
			echo "unknown gate: $gate" >&2
			usage
			;;
		esac
	done
	;;
*) usage ;;
esac

summary=""
failed=0
for gate in $GATES; do
	case " $selected " in
	*" $gate "*) ;;
	*) continue ;;
	esac
	command=$(gate_command "$gate")
	echo "==> [$gate] $command"
	start=$(date +%s)
	if sh -c "$command"; then
		result=PASS
	else
		result=FAIL
		failed=1
	fi
	duration=$(($(date +%s) - start))
	echo "==> [$gate] $result (${duration}s)"
	summary="$summary$(printf '%-10s %-6s %6ss' "$gate" "$result" "$duration")
"
done

echo
printf '%-10s %-6s %7s\n' GATE RESULT TIME
printf '%s' "$summary"
exit "$failed"

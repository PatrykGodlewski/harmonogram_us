#!/bin/sh
# Pre-commit: `turbo typecheck` for every workspace package that owns a staged file.
# Called by lefthook.yml with the staged paths as arguments; runs from the repo root.
set -eu

filters=""
for file in "$@"; do
	case "$file" in
	apps/web/*) name=web ;;
	apps/admin/*) name=admin ;;
	apps/worker/*) name=worker ;;
	packages/proto/*) continue ;;
	packages/*/*)
		dir=${file#packages/}
		name="@repo/${dir%%/*}"
		;;
	tooling/e2e/*) name=e2e ;;
	*) continue ;;
	esac
	case " $filters " in
	*" --filter=$name "*) ;;
	*) filters="$filters --filter=$name" ;;
	esac
done

if [ -z "$filters" ]; then
	echo "typecheck: no workspace package has staged changes"
	exit 0
fi

# shellcheck disable=SC2086 # filters are space-free flags built above
exec pnpm exec turbo typecheck $filters

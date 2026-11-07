#!/usr/bin/env bash
# Apply each new file in db/migrations in order.
# A file is recorded in schema_migrations in the same transaction as its SQL.
# Migration files must not open or close their own transaction.

set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

cd "$(dirname "$0")/.."

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
SQL

files=()
while IFS= read -r file; do
  files+=("$file")
done < <(find db/migrations -maxdepth 1 -type f -name '*.sql' | sort)

if [[ ${#files[@]} -eq 0 ]]; then
  echo "No migration files in db/migrations"
  exit 0
fi

for file in "${files[@]}"; do
  name="$(basename "$file")"
  if [[ ! "$name" =~ ^[0-9A-Za-z._-]+$ ]]; then
    echo "Refusing migration filename: ${name}" >&2
    exit 1
  fi

  applied="$(
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -tA \
      -c "SELECT 1 FROM schema_migrations WHERE filename = '${name}'"
  )"

  if [[ "$applied" == "1" ]]; then
    echo "skip ${name}"
    continue
  fi

  echo "apply ${name}"
  {
    printf 'BEGIN;\n'
    cat "$file"
    printf '\nINSERT INTO schema_migrations (filename) VALUES (%s);\n' "'${name}'"
    printf 'COMMIT;\n'
  } | psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f -
done

#!/usr/bin/env bash
set -euo pipefail

DB_HOST="${DB_HOST:-db}"
DB_NAME="${DB_NAME:-c2}"
DB_USER="${DB_USER:-c2}"
DB_PASSWORD="${DB_PASSWORD:-c2}"
SCENARIO_SQL="${SCENARIO_SQL:-/scenario/010_scenario_units.sql}"

export PGPASSWORD="${DB_PASSWORD}"

echo "[db_restore] Waiting for database ${DB_HOST}/${DB_NAME}..."
until pg_isready -h "${DB_HOST}" -U "${DB_USER}" -d "${DB_NAME}" >/dev/null 2>&1; do
  sleep 1
done

echo "[db_restore] Waiting for public.units table..."
until psql -h "${DB_HOST}" -U "${DB_USER}" -d "${DB_NAME}" -tAc \
  "SELECT to_regclass('public.units') IS NOT NULL;" | grep -q "t"; do
  sleep 1
done

echo "[db_restore] Replaying scenario from ${SCENARIO_SQL}..."
psql -h "${DB_HOST}" -U "${DB_USER}" -d "${DB_NAME}" -v ON_ERROR_STOP=1 -c "TRUNCATE TABLE public.units;"
psql -h "${DB_HOST}" -U "${DB_USER}" -d "${DB_NAME}" -v ON_ERROR_STOP=1 -f "${SCENARIO_SQL}"
echo "[db_restore] Scenario restored successfully."

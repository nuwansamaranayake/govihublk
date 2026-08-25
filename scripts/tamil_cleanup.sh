#!/bin/bash
# P6 cleanup: remove ONLY the users the Tamil gate harness created (tgate_ prefix).
# Discovers FK references dynamically rather than assuming a table list, so a table
# added later cannot silently block the delete or leave orphans.
#
#   bash tamil_cleanup.sh            # dry run, changes nothing
#   bash tamil_cleanup.sh --apply    # delete
set -u
APPLY=0
[ "${1:-}" = "--apply" ] && APPLY=1

C=govihub-spices-postgres-spices-1
P() { docker exec $C psql -U govihub -d govihub_spices -tAc "$1"; }

PATTERN="tgate\_%"

echo "=== targets (username LIKE 'tgate_%') ==="
P "select id||'  '||username||'  '||coalesce(role::text,'-')||'  '||created_at from users where username like '$PATTERN';"
N=$(P "select count(*) from users where username like '$PATTERN';" | tr -d ' ')
echo "target count: $N"
if [ "$N" = "0" ]; then echo "nothing to clean"; exit 0; fi

# Safety: refuse to touch anything that is not a tgate_ row.
BAD=$(P "select count(*) from users where username like '$PATTERN' and username !~ '^tgate_[md][0-9]{8}$';" | tr -d ' ')
if [ "$BAD" != "0" ]; then
  echo "ABORT: $BAD row(s) match the prefix but not the exact harness pattern tgate_[md]########"
  exit 1
fi

echo
echo "=== tables with a FK to users, and how many rows reference the targets ==="
TABLES=$(P "select distinct tc.table_name||'.'||kcu.column_name
            from information_schema.table_constraints tc
            join information_schema.key_column_usage kcu on tc.constraint_name=kcu.constraint_name
            join information_schema.constraint_column_usage ccu on tc.constraint_name=ccu.constraint_name
            where tc.constraint_type='FOREIGN KEY' and ccu.table_name='users';")

DEL_ORDER=""
for tc in $TABLES; do
  t="${tc%%.*}"; c="${tc##*.}"
  n=$(P "select count(*) from $t where $c in (select id from users where username like '$PATTERN');" | tr -d ' ')
  printf "  %-34s %s\n" "$tc" "$n"
  [ "$n" != "0" ] && DEL_ORDER="$DEL_ORDER $tc"
done

echo
if [ "$APPLY" = "0" ]; then
  echo "DRY RUN - nothing deleted."
  echo "would delete, in order:"
  for tc in $DEL_ORDER; do echo "  DELETE FROM ${tc%%.*} WHERE ${tc##*.} IN (targets)"; done
  echo "  DELETE FROM users WHERE username LIKE 'tgate_%'  ($N rows)"
  echo
  echo "re-run with --apply to execute"
  exit 0
fi

echo "=== applying ==="
SQL="BEGIN;"
for tc in $DEL_ORDER; do
  SQL="$SQL DELETE FROM ${tc%%.*} WHERE ${tc##*.} IN (SELECT id FROM users WHERE username LIKE '$PATTERN');"
done
SQL="$SQL DELETE FROM users WHERE username LIKE '$PATTERN'; COMMIT;"
docker exec $C psql -U govihub -d govihub_spices -v ON_ERROR_STOP=1 -c "$SQL"

echo
echo "=== after ==="
echo "remaining tgate_ rows : $(P "select count(*) from users where username like '$PATTERN';")"
echo "users                 : $(P 'select count(*) from users;')"
echo "supply_listings       : $(P 'select count(*) from supply_listings;')"
echo "harvest_listings      : $(P 'select count(*) from harvest_listings;')"

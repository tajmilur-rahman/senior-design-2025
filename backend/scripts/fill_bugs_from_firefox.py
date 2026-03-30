#!/usr/bin/env python3
"""
fill_bugs_from_firefox.py — Copy all rows from firefox_table into bugs.

firefox_table is the ML baseline (222k+ Mozilla bugs).
bugs is the universal operational table that super_admin queries.

This script upserts firefox_table → bugs, preserving existing rows and
skipping duplicates (ON CONFLICT on bug_id). Safe to re-run.

Usage:
    python fill_bugs_from_firefox.py
    python fill_bugs_from_firefox.py --limit 10000   # partial fill
    python fill_bugs_from_firefox.py --dry-run       # count only, no writes
"""

import sys
import os
import argparse
import time
import psycopg2
from psycopg2 import extras
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL must be set in environment / .env")

BATCH_SIZE = 500


def get_conn():
    return psycopg2.connect(DATABASE_URL)


def main():
    parser = argparse.ArgumentParser(description="Fill bugs table from firefox_table")
    parser.add_argument("--limit",   type=int, default=0,
                        help="Max rows to copy (0 = all)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Count source rows only, write nothing")
    args = parser.parse_args()

    print("=" * 60)
    print("Spotfixes — Fill bugs from firefox_table")
    print("=" * 60)

    conn = get_conn()
    cur  = conn.cursor()

    # Count source
    cur.execute("SELECT COUNT(*) FROM firefox_table")
    source_total = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM bugs")
    bugs_before = cur.fetchone()[0]

    print(f"  firefox_table : {source_total:>10,} rows (source)")
    print(f"  bugs (before) : {bugs_before:>10,} rows")
    if args.limit:
        print(f"  copy limit    : {args.limit:>10,} rows")
    print()

    if args.dry_run:
        print("[DRY RUN] No data written.")
        cur.close()
        conn.close()
        return

    insert_sql = """
        INSERT INTO bugs (bug_id, summary, component, severity, status, company_id)
        VALUES %s;
    """

    # Load existing bug_ids so we can skip duplicates (bug_id has no unique constraint)
    print("  Loading existing bug_ids from bugs...")
    cur.execute("SELECT bug_id FROM bugs WHERE bug_id IS NOT NULL")
    existing_ids = {row[0] for row in cur.fetchall()}
    print(f"  {len(existing_ids):,} existing bug_ids loaded.\n")

    offset    = 0
    inserted  = 0
    skipped   = 0
    t_start   = time.time()
    limit_hit = False
    target    = min(source_total, args.limit) if args.limit else source_total

    while True:
        cur.execute(
            """
            SELECT bug_id, summary, component, severity, status
            FROM firefox_table
            ORDER BY bug_id
            LIMIT %s OFFSET %s
            """,
            (BATCH_SIZE, offset),
        )
        rows = cur.fetchall()
        if not rows:
            break

        # company_id = NULL — these are universal/shared bugs
        batch = []
        for r in rows:
            if r[0] in existing_ids:
                skipped += 1
            else:
                batch.append((r[0], r[1], r[2], r[3], r[4], None))
                existing_ids.add(r[0])

        if batch:
            extras.execute_values(cur, insert_sql, batch)
            conn.commit()

        inserted += len(batch)
        offset   += len(rows)
        elapsed   = time.time() - t_start
        rate      = inserted / elapsed if elapsed > 0 else 0
        print(f"  {inserted:>8,} / {target:,} copied  ({rate:.0f} rows/s)", end="\r")

        if args.limit and inserted >= args.limit:
            limit_hit = True
            break

        if len(rows) < BATCH_SIZE:
            break  # last page

    print()

    cur.execute("SELECT COUNT(*) FROM bugs")
    bugs_after = cur.fetchone()[0]
    elapsed = time.time() - t_start

    print()
    print("=" * 60)
    print("Done!")
    print(f"  Rows copied   : {inserted:>10,}")
    print(f"  Rows skipped  : {skipped:>10,}  (already existed)")
    print(f"  bugs (after)  : {bugs_after:>10,}")
    print(f"  Time          : {elapsed:.1f}s")
    if limit_hit:
        print(f"  (stopped at --limit {args.limit:,})")
    print("=" * 60)

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()

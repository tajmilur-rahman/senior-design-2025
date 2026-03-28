#!/usr/bin/env python3
"""
nuclear_reset.py — Complete data reset for Apex SystemOS.

What this does:
  1. Clears `bugs` table (all companies' live bug data)
  2. Clears `training_batches` table
  3. Clears `firefox_table` (the ML baseline)
  4. Downloads the full Mozilla Bugzilla dataset via bugbug
  5. Repopulates `firefox_table` — clean, no company_id (ML baseline only)

What it does NOT touch:
  - `companies` table  (your accounts stay)
  - `users` table      (logins intact)
  - `feedback` table   (user corrections preserved)
  - `company_{id}_bugs` tables  (re-seeded automatically on next onboarding)

Usage:
    # Full nuclear reset (recommended for fresh demo)
    python nuclear_reset.py

    # Limit how many bugs go into firefox_table (e.g. 50k for speed)
    python nuclear_reset.py --limit 50000

    # Dry run — shows counts, writes nothing
    python nuclear_reset.py --dry-run

    # Only wipe bugs/batches, skip firefox_table repopulation
    python nuclear_reset.py --skip-seed

Requirements:
    pip install bugbug psycopg2-binary
    (bugbug is the mozilla/bugbug library)
"""

import mmap
import sys
import argparse
import time

# ─── Windows compatibility patch (for local dev on Windows) ──────────────────
if sys.platform == "win32":
    if not hasattr(mmap, "PROT_READ"):
        mmap.PROT_READ = 0x01
    _orig_mmap = mmap.mmap
    def _mmap_win(*args, **kwargs):
        if "prot" in kwargs:
            if kwargs["prot"] == mmap.PROT_READ:
                kwargs["access"] = mmap.ACCESS_READ
            del kwargs["prot"]
        kwargs.pop("flags", None)
        return _orig_mmap(*args, **kwargs)
    mmap.mmap = _mmap_win
# ─────────────────────────────────────────────────────────────────────────────

import psycopg2
from psycopg2 import extras

DATABASE_URL = (
    "postgresql://postgres.ofthvbabxgzsjercdjmo:"
    "GannonUniversity2026%24"
    "@aws-1-us-east-1.pooler.supabase.com:6543/postgres"
    "?sslmode=require"
)

# ─── Severity mapping ─────────────────────────────────────────────────────────
def map_severity(bug: dict) -> str:
    sev = str(bug.get("severity", "")).lower()
    if any(x in sev for x in ("blocker", "critical")):
        return "S1"
    if "major" in sev:
        return "S2"
    if "normal" in sev:
        return "S3"
    if any(x in sev for x in ("minor", "trivial")):
        return "S4"
    if "enhancement" in sev:
        return "S4"
    # Fall back to priority if severity is blank / "--"
    prio = str(bug.get("priority", "")).upper()
    if "P1" in prio:
        return "S1"
    if "P2" in prio:
        return "S2"
    if "P4" in prio or "P5" in prio:
        return "S4"
    return "S3"


def clean_str(val, max_len=1000) -> str:
    if not val:
        return ""
    return str(val).replace("\x00", "").encode("utf-8", "ignore").decode("utf-8")[:max_len]


# ─── DB helpers ───────────────────────────────────────────────────────────────
def get_conn():
    return psycopg2.connect(DATABASE_URL)


def wipe_table(cur, table: str, id_col: str = "id"):
    """Delete all rows from a table. Tries common PK column names."""
    try:
        cur.execute(f"DELETE FROM {table} WHERE {id_col} IS NOT NULL")
        return cur.rowcount
    except Exception:
        try:
            cur.execute(f"TRUNCATE TABLE {table} RESTART IDENTITY CASCADE")
            return -1  # rowcount not meaningful after TRUNCATE
        except Exception as e:
            print(f"  [warn] Could not wipe {table}: {e}")
            return 0


def ensure_firefox_table(cur):
    """
    Create firefox_table if it doesn't exist.
    If it already exists this is a no-op (we never DROP it to preserve
    Supabase RLS policies and any dependent RPCs).
    """
    cur.execute("""
        CREATE TABLE IF NOT EXISTS firefox_table (
            bug_id    INTEGER PRIMARY KEY,
            summary   TEXT,
            component TEXT,
            severity  TEXT,
            status    TEXT
        );
    """)


def insert_firefox_batch(cur, batch: list):
    """Upsert a batch of rows into firefox_table (no company_id — ML baseline only)."""
    query = """
        INSERT INTO firefox_table (bug_id, summary, component, severity, status)
        VALUES %s
        ON CONFLICT (bug_id) DO UPDATE SET
            summary   = EXCLUDED.summary,
            component = EXCLUDED.component,
            severity  = EXCLUDED.severity,
            status    = EXCLUDED.status;
    """
    extras.execute_values(cur, query, batch, template="(%s, %s, %s, %s, %s)")


# ─── Main ─────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Nuclear reset for Apex SystemOS data tables")
    parser.add_argument("--limit",     type=int, default=0,
                        help="Max bugs to insert into firefox_table (0 = all, ~220k)")
    parser.add_argument("--dry-run",   action="store_true",
                        help="Show what would happen, write nothing")
    parser.add_argument("--skip-seed", action="store_true",
                        help="Only wipe tables, skip downloading and seeding firefox_table")
    args = parser.parse_args()

    dry = args.dry_run
    prefix = "[DRY RUN] " if dry else ""

    print("=" * 65)
    print(f"{prefix}Apex SystemOS — Nuclear Data Reset")
    print("=" * 65)
    print("Preserving: companies, users, feedback")
    print("Wiping:     bugs, training_batches, firefox_table")
    if args.limit:
        print(f"Firefox seed limit: {args.limit:,} bugs")
    else:
        print("Firefox seed limit: ALL bugs (~220k)")
    print()

    # ── Step 1: Connect ───────────────────────────────────────────────────────
    print("Connecting to Supabase...")
    conn = get_conn()
    cur  = conn.cursor()
    print("  Connected.\n")

    # ── Step 2: Wipe live data tables ─────────────────────────────────────────
    if dry:
        print("[DRY RUN] Would wipe: bugs, training_batches, firefox_table\n")
    else:
        print("Wiping `bugs` table...")
        n = wipe_table(cur, "bugs", "bug_id")
        conn.commit()
        print(f"  Deleted {n if n >= 0 else 'all'} rows from bugs.\n")

        print("Wiping `training_batches` table...")
        n = wipe_table(cur, "training_batches", "id")
        conn.commit()
        print(f"  Deleted {n if n >= 0 else 'all'} rows from training_batches.\n")

        print("Wiping `firefox_table`...")
        ensure_firefox_table(cur)
        n = wipe_table(cur, "firefox_table", "bug_id")
        conn.commit()
        print(f"  Deleted {n if n >= 0 else 'all'} rows from firefox_table.\n")

    if args.skip_seed:
        print("--skip-seed set. Skipping bugbug download and seeding.")
        cur.close()
        conn.close()
        return

    # ── Step 3: Download bugbug dataset ───────────────────────────────────────
    print("Downloading Mozilla Bugzilla dataset via bugbug...")
    print("  (This may take several minutes on first run — ~1–2 GB download)\n")
    try:
        from bugbug import bugzilla, db
    except ImportError:
        print("ERROR: bugbug is not installed.")
        print("  Install with:  pip install bugbug")
        cur.close()
        conn.close()
        sys.exit(1)

    db.download(bugzilla.BUGS_DB)
    print("  Download complete.\n")

    # ── Step 4: Stream bugs into firefox_table ────────────────────────────────
    print(f"{prefix}Seeding firefox_table (ML baseline — no company_id)...")

    BATCH_SIZE   = 1000
    batch        = []
    total        = 0
    skipped      = 0
    t_start      = time.time()

    for bug in bugzilla.get_bugs():
        bid = bug.get("id")
        if not bid:
            skipped += 1
            continue

        summary   = clean_str(bug.get("summary", ""), 500)
        component = clean_str(bug.get("product", bug.get("component", "General")), 255)
        severity  = map_severity(bug)
        status    = clean_str(bug.get("status", "RESOLVED"), 50).upper()

        if not summary:
            skipped += 1
            continue

        batch.append((int(bid), summary, component, severity, status))

        if len(batch) >= BATCH_SIZE:
            if not dry:
                insert_firefox_batch(cur, batch)
                conn.commit()
            total += len(batch)
            batch = []

            elapsed = time.time() - t_start
            rate    = total / elapsed if elapsed > 0 else 0
            print(f"  {total:>7,} bugs inserted  ({rate:.0f}/s)", end="\r")

            if args.limit and total >= args.limit:
                break

    # Flush remainder
    if batch and not dry:
        insert_firefox_batch(cur, batch)
        conn.commit()
    total += len(batch)

    elapsed = time.time() - t_start
    print(f"\n  Done. {total:,} bugs inserted, {skipped:,} skipped  ({elapsed:.1f}s)\n")

    # ── Step 5: Indexes ───────────────────────────────────────────────────────
    if not dry:
        print("Creating indexes on firefox_table...")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_firefox_severity  ON firefox_table(severity);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_firefox_component ON firefox_table(component);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_firefox_status    ON firefox_table(status);")
        conn.commit()
        print("  Indexes created.\n")

    # ── Summary ───────────────────────────────────────────────────────────────
    if not dry:
        cur.execute("SELECT count(*) FROM firefox_table")
        ff_count = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM bugs")
        bugs_count = cur.fetchone()[0]
        print("=" * 65)
        print("Reset complete!")
        print(f"  firefox_table : {ff_count:>10,} rows  (ML baseline)")
        print(f"  bugs          : {bugs_count:>10,} rows  (should be 0 — clean slate)")
        print("  companies     :  (untouched)")
        print("  users         :  (untouched)")
        print("=" * 65)
        print()
        print("Next steps:")
        print("  1. Rebuild the global ML model:")
        print("       python ml_training/Train_Universal.py")
        print("  2. Each company admin should re-run onboarding to seed")
        print("       their company table from the fresh firefox_table.")
    else:
        print("[DRY RUN] No data was written.")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()

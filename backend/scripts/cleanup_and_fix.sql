-- =============================================================================
-- Spotfixes — Supabase Cleanup & Architecture Fix
-- Run these queries in the Supabase SQL Editor (in order).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- STEP 1: Inspect current state
-- -----------------------------------------------------------------------------

-- See all companies and their assigned tables
SELECT id, name, data_table, status FROM companies ORDER BY id;

-- Count bugs per company in the `bugs` table
SELECT company_id, count(*) AS bug_count
FROM bugs
GROUP BY company_id
ORDER BY company_id;

-- See any bugs in firefox_table that have a company_id (should be 0)
-- firefox_table may not have a company_id column — comment out if it errors
-- SELECT count(*) FROM firefox_table WHERE company_id IS NOT NULL;


-- -----------------------------------------------------------------------------
-- STEP 2: Fix Firefox admin company — point data_table to "bugs"
--
-- Any company currently pointing at firefox_table should instead use "bugs"
-- so their admins see their own scoped data and don't touch the ML baseline.
-- -----------------------------------------------------------------------------

UPDATE companies
SET data_table = 'bugs'
WHERE data_table = 'firefox_table';

-- Verify
SELECT id, name, data_table FROM companies WHERE data_table = 'bugs';


-- -----------------------------------------------------------------------------
-- STEP 3: Delete test/bulk-imported bugs from `bugs` table
--
-- Replace <FIREFOX_COMPANY_ID> with the actual company id from Step 1.
-- This removes ALL bugs for that company from the shared table.
-- The original firefox_table (ML baseline) is untouched.
-- -----------------------------------------------------------------------------

-- Option A: delete ALL bugs for the firefox company (safe if they have no real data yet)
-- DELETE FROM bugs WHERE company_id = <FIREFOX_COMPANY_ID>;

-- Option B: delete only bugs newer than a specific timestamp (safer if mixed data)
-- DELETE FROM bugs
-- WHERE company_id = <FIREFOX_COMPANY_ID>
--   AND created_at >= '2025-01-01T00:00:00Z';  -- adjust to your import date

-- Also clear any orphaned batch records for the same company
-- DELETE FROM training_batches WHERE company_id = <FIREFOX_COMPANY_ID>;


-- -----------------------------------------------------------------------------
-- STEP 4: Verify firefox_table is clean (ML baseline should be read-only)
-- -----------------------------------------------------------------------------

SELECT count(*) AS firefox_baseline_count FROM firefox_table;

-- Confirm no company data leaked in (if column exists)
-- SELECT count(*) FROM firefox_table WHERE company_id IS NOT NULL;


-- -----------------------------------------------------------------------------
-- STEP 5: Check super admin view (should show all companies' bugs in bugs table)
-- -----------------------------------------------------------------------------

SELECT
    c.name AS company_name,
    c.id   AS company_id,
    count(b.bug_id) AS bug_count
FROM companies c
LEFT JOIN bugs b ON b.company_id = c.id
GROUP BY c.id, c.name
ORDER BY c.id;

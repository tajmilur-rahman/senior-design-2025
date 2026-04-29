import requests
import datetime
import logging
from database import supabase

logger = logging.getLogger(__name__)

BUGZILLA_API_URL = "https://bugzilla.mozilla.org/rest/bug"
BUGZILLA_PRODUCTS = ["Firefox", "Core", "DevTools", "Toolkit"]

# Mozilla uses two severity schemes; map both to S1-S4
_SEVERITY_MAP = {
    "s1": "S1", "s2": "S2", "s3": "S3", "s4": "S4",
    "blocker":     "S1",
    "critical":    "S1",
    "major":       "S2",
    "normal":      "S3",
    "minor":       "S4",
    "trivial":     "S4",
    "enhancement": "S4",
}

def _map_severity(raw: str) -> str:
    return _SEVERITY_MAP.get(str(raw).lower().strip(), "S3")


def _get_firefox_company_id() -> int | None:
    """Look up the company_id of whichever tenant uses firefox_table."""
    try:
        res = supabase.table("companies") \
            .select("id") \
            .eq("data_table", "firefox_table") \
            .limit(1) \
            .execute()
        rows = res.data or []
        return rows[0]["id"] if rows else None
    except Exception as e:
        logger.warning(f"[bugzilla-sync] Could not resolve Firefox company_id: {e}")
        return None


def sync_latest_bugs(hours: int = 24) -> dict:
    """
    Pull bugs updated in the last `hours` hours from Mozilla Bugzilla
    and upsert them into firefox_table (tenant-isolated to the Firefox company).
    Returns a summary dict with counts.
    """
    since = (datetime.datetime.utcnow() - datetime.timedelta(hours=hours)).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )

    firefox_company_id = _get_firefox_company_id()

    headers = {"User-Agent": "BugPriorityOS-SeniorDesignProject/1.0"}
    fetched = []

    for product in BUGZILLA_PRODUCTS:
        params = {
            "product": product,
            "last_change_time": since,
            "include_fields": "id,summary,component,severity,status",
            "limit": 200,
        }
        try:
            response = requests.get(
                BUGZILLA_API_URL, params=params, headers=headers, timeout=15
            )
            response.raise_for_status()
            bugs = response.json().get("bugs", [])
            logger.info(f"[bugzilla-sync] {product}: {len(bugs)} bugs fetched")
            fetched.extend(bugs)
        except Exception as e:
            logger.warning(f"[bugzilla-sync] Failed to fetch {product}: {e}")

    if not fetched:
        return {"synced": 0, "skipped": 0, "error": "No bugs returned from Bugzilla API"}

    to_upsert = []
    skipped = 0
    for b in fetched:
        summary = (b.get("summary") or "").strip()
        if not summary:
            skipped += 1
            continue

        comp = b.get("component", "General")
        if isinstance(comp, list):
            comp = comp[0] if comp else "General"

        to_upsert.append({
            "bug_id":     b.get("id"),
            "summary":    summary,
            "component":  comp,
            "severity":   _map_severity(b.get("severity", "S3")),
            "status":     (b.get("status") or "NEW").upper(),
            "company_id": firefox_company_id,
        })

    if not to_upsert:
        return {"synced": 0, "skipped": skipped, "error": "All fetched bugs had empty summaries"}

    try:
        supabase.table("firefox_table") \
            .upsert(to_upsert, on_conflict="bug_id") \
            .execute()
        synced = len(to_upsert)
        logger.info(f"[bugzilla-sync] Upserted {synced} bugs into firefox_table")
        return {"synced": synced, "skipped": skipped, "error": None}
    except Exception as e:
        logger.error(f"[bugzilla-sync] Upsert failed: {e}")
        return {"synced": 0, "skipped": skipped, "error": str(e)}

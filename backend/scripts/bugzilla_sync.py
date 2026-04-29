import requests
import datetime
import logging
from database import supabase

logger = logging.getLogger(__name__)

BUGZILLA_API_URL = "https://bugzilla.mozilla.org/rest/bug"
BUGZILLA_PRODUCTS = ["Firefox", "Core", "DevTools", "Toolkit"]

# Mozilla uses two severity schemes; map both to S1-S4
_SEVERITY_MAP = {
    # New-style (already S1-S4)
    "s1": "S1", "s2": "S2", "s3": "S3", "s4": "S4",
    # Legacy word-based
    "blocker":   "S1",
    "critical":  "S1",
    "major":     "S2",
    "normal":    "S3",
    "minor":     "S4",
    "trivial":   "S4",
    "enhancement": "S4",
}

def _map_severity(raw: str) -> str:
    return _SEVERITY_MAP.get(str(raw).lower().strip(), "S3")


def sync_latest_bugs(hours: int = 24) -> dict:
    """
    Pull bugs updated in the last `hours` hours from Mozilla Bugzilla
    and upsert them into the shared `bugs` table.
    Returns a summary dict with counts.
    """
    since = (datetime.datetime.utcnow() - datetime.timedelta(hours=hours)).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )

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
            "bug_id":   b.get("id"),
            "summary":  summary,
            "component": comp,
            "severity": _map_severity(b.get("severity", "S3")),
            "status":   (b.get("status") or "NEW").upper(),
            "company_id": None,
        })

    if not to_upsert:
        return {"synced": 0, "skipped": skipped, "error": "All fetched bugs had empty summaries"}

    try:
        result = (
            supabase.table("bugs")
            .upsert(to_upsert, on_conflict="bug_id")
            .execute()
        )
        synced = len(to_upsert)
        logger.info(f"[bugzilla-sync] Upserted {synced} bugs")
        return {"synced": synced, "skipped": skipped, "error": None}
    except Exception as e:
        logger.error(f"[bugzilla-sync] Upsert failed: {e}")
        return {"synced": 0, "skipped": skipped, "error": str(e)}

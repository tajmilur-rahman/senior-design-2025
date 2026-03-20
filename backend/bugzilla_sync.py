import requests
import datetime
from database import supabase

BUGZILLA_API_URL = "https://bugzilla.mozilla.org/rest/bug"


def sync_latest_bugs(company_id: int):
    print("Starting background sync with Bugzilla...")

    # Calculate the time 24 hours ago to only fetch recent updates
    yesterday = (datetime.datetime.utcnow() - datetime.timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%SZ")

    # Query Mozilla's API for recent bugs
    params = {
        "last_change_time": yesterday,
        "include_fields": "id,summary,component,severity,status",
        "limit": 100  # Adjust limit as needed to prevent overwhelming your DB
    }

    try:
        response = requests.get(BUGZILLA_API_URL, params=params)
        response.raise_for_status()
        data = response.json()
        bugs = data.get("bugs", [])

        if not bugs:
            print("No new bugs to sync.")
            return

        bugs_to_upsert = []
        for b in bugs:
            # Map Mozilla's severity to your S1-S4 scale
            raw_sev = str(b.get("severity", "S3")).upper()
            mapped_sev = raw_sev if raw_sev in ["S1", "S2", "S3", "S4"] else "S3"

            # Ensure component is a string, as Bugzilla sometimes returns lists
            comp = b.get("component", ["General"])
            comp_str = comp[0] if isinstance(comp, list) else comp

            bugs_to_upsert.append({
                "bug_id": b.get("id"),
                "summary": b.get("summary", "No summary"),
                "component": comp_str,
                "severity": mapped_sev,
                "status": b.get("status", "NEW"),
                "company_id": company_id
            })

        # Upsert the new data into the 'bugs' table
        if bugs_to_upsert:
            supabase.table("bugs").upsert(bugs_to_upsert).execute()
            print(f"✅ Successfully synced {len(bugs_to_upsert)} bugs from Bugzilla.")

    except Exception as e:
        print(f"❌ Bugzilla Sync Failed: {e}")
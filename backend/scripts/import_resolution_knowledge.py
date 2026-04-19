import csv
import requests
from datetime import datetime
from pathlib import Path
import time

CSV_PATH = Path(__file__).resolve().parent.parent / "bugs-2026-04-17-fixed.csv"
OUTPUT_CSV = Path(__file__).resolve().parent.parent / "resolution_knowledge_full_5000.csv"

BUG_API = "https://bugzilla.mozilla.org/rest/bug/{}"
COMMENT_API = "https://bugzilla.mozilla.org/rest/bug/{}/comment"

LIMIT = 5000
SLEEP_SECONDS = 0.2


def parse_dt(dt_str):
    if not dt_str:
        return None
    return datetime.fromisoformat(dt_str.replace("Z", "+00:00"))


def normalize_severity(severity_raw):
    if not severity_raw:
        return ""

    sev = severity_raw.strip().lower()

    if sev in {"--", "", "n/a", "na", "none", "null"}:
        return ""

    severity_map = {
        "blocker": "S1",
        "critical": "S1",
        "major": "S2",
        "normal": "S3",
        "minor": "S3",
        "trivial": "S3",
        "enhancement": "S4",
        "s1": "S1",
        "s2": "S2",
        "s3": "S3",
        "s4": "S4",
    }

    return severity_map.get(sev, "")


def load_bug_ids_from_csv(csv_path):
    bug_ids = []
    seen = set()

    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)

        for row in reader:
            raw_id = row.get("Bug ID")
            status = (row.get("Status") or "").strip().upper()
            resolution = (row.get("Resolution") or "").strip().upper()

            if not raw_id:
                continue

            if status != "RESOLVED" or resolution != "FIXED":
                continue

            try:
                bug_id = int(raw_id)
            except ValueError:
                continue

            if bug_id in seen:
                continue

            seen.add(bug_id)
            bug_ids.append(bug_id)

    return bug_ids


def fetch_bug_data(bug_id):
    bug_res = requests.get(BUG_API.format(bug_id), timeout=30)
    comment_res = requests.get(COMMENT_API.format(bug_id), timeout=30)

    bug_res.raise_for_status()
    comment_res.raise_for_status()

    bug_json = bug_res.json()
    comment_json = comment_res.json()

    if not bug_json.get("bugs"):
        return None

    bug = bug_json["bugs"][0]
    comments = comment_json.get("bugs", {}).get(str(bug_id), {}).get("comments", [])

    summary = bug.get("summary", "")
    component = bug.get("component", "")
    status = bug.get("status", "")
    resolution = bug.get("resolution", "")
    severity_raw = bug.get("severity", "")
    severity = normalize_severity(severity_raw)

    creation_time = bug.get("creation_time")
    last_change_time = bug.get("last_change_time")

    created_dt = parse_dt(creation_time)
    changed_dt = parse_dt(last_change_time)

    resolved_in_days = None
    if created_dt and changed_dt:
        resolved_in_days = (changed_dt - created_dt).days

    resolution_text = ""
    if comments:
        resolution_text = comments[-1].get("text", "")[:5000]

    return {
        "source_bug_id": bug_id,
        "summary": summary,
        "component": component,
        "status": status,
        "resolution": resolution,
        "resolved_in_days": resolved_in_days,
        "resolution_text": resolution_text,
        "bug_url": f"https://bugzilla.mozilla.org/show_bug.cgi?id={bug_id}",
        "severity": severity,
    }


def main():
    print("START")
    print("CSV_PATH:", CSV_PATH)
    print("OUTPUT_CSV:", OUTPUT_CSV)
    print("LIMIT:", LIMIT)

    if not CSV_PATH.exists():
        print(f"CSV not found: {CSV_PATH}")
        return

    bug_ids = load_bug_ids_from_csv(CSV_PATH)[:LIMIT]
    print(f"Loaded {len(bug_ids)} bug IDs")

    rows_out = []
    failed = 0

    for i, bug_id in enumerate(bug_ids, start=1):
        print(f"[{i}/{len(bug_ids)}] Fetching bug {bug_id}")
        try:
            row = fetch_bug_data(bug_id)
            if row:
                rows_out.append(row)
            time.sleep(SLEEP_SECONDS)
        except Exception as e:
            print(f"  -> failed: {e}")
            failed += 1

    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "source_bug_id",
                "summary",
                "component",
                "status",
                "resolution",
                "resolved_in_days",
                "resolution_text",
                "bug_url",
                "severity",
            ],
        )
        writer.writeheader()
        writer.writerows(rows_out)

    print("=== DONE ===")
    print(f"Wrote {len(rows_out)} rows to {OUTPUT_CSV}")
    print(f"Failed: {failed}")


if __name__ == "__main__":
    main()
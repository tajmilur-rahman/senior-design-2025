import csv
import requests
from datetime import datetime
from pathlib import Path
from database import supabase

# Place the CSV in the project root (senior-design-2025/)
CSV_PATH = Path(__file__).resolve().parent.parent / "bugs-2026-03-23.csv"


def parse_dt(dt_str):
    if not dt_str:
        return None
    return datetime.fromisoformat(dt_str.replace("Z", "+00:00"))


def load_bug_ids_from_csv(csv_path):
    bug_ids = []

    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            raw_id = row.get("Bug ID")
            status = (row.get("Status") or "").strip().upper()
            resolution = (row.get("Resolution") or "").strip().upper()

            if not raw_id:
                continue

            # Only import RESOLVED + FIXED bugs for resolution knowledge
            if status != "RESOLVED" or resolution != "FIXED":
                continue

            try:
                bug_id = int(raw_id)
                bug_ids.append(bug_id)
            except ValueError:
                continue

    return bug_ids


def fetch_bug_data(bug_id):
    bug_url_api = f"https://bugzilla.mozilla.org/rest/bug/{bug_id}"
    comment_url_api = f"https://bugzilla.mozilla.org/rest/bug/{bug_id}/comment"

    bug_res = requests.get(bug_url_api, timeout=30)
    comment_res = requests.get(comment_url_api, timeout=30)

    bug_res.raise_for_status()
    comment_res.raise_for_status()

    bug_json = bug_res.json()
    comment_json = comment_res.json()

    if not bug_json.get("bugs"):
        return None

    bug_data = bug_json["bugs"][0]
    comments = comment_json.get("bugs", {}).get(str(bug_id), {}).get("comments", [])

    summary = bug_data.get("summary")
    component = bug_data.get("component")
    status = bug_data.get("status")
    resolution = bug_data.get("resolution")
    creation_time = bug_data.get("creation_time")
    last_change_time = bug_data.get("last_change_time")

    created_dt = parse_dt(creation_time)
    changed_dt = parse_dt(last_change_time)

    resolved_in_days = None
    if created_dt and changed_dt:
        resolved_in_days = (changed_dt - created_dt).days

    resolution_text = ""
    if comments:
        resolution_text = comments[-1].get("text", "")[:2000]

    row = {
        "source_bug_id": bug_id,
        "summary": summary,
        "component": component,
        "status": status,
        "resolution": resolution,
        "resolved_in_days": resolved_in_days,
        "resolution_text": resolution_text,
        "bug_url": f"https://bugzilla.mozilla.org/show_bug.cgi?id={bug_id}",
    }

    return row


def already_exists(bug_id):
    result = (
        supabase.table("resolution_knowledge")
        .select("id")
        .eq("source_bug_id", bug_id)
        .execute()
    )
    return bool(result.data)


def main():
    print("START")
    print("CSV_PATH:", CSV_PATH)
    print("CSV exists:", CSV_PATH.exists())

    if not CSV_PATH.exists():
        print(f"CSV file not found: {CSV_PATH}")
        return

    bug_ids = load_bug_ids_from_csv(CSV_PATH)[:500]
    print(f"Loaded {len(bug_ids)} bug IDs from CSV")

    inserted_count = 0
    skipped_count = 0
    failed_count = 0

    for i, bug_id in enumerate(bug_ids, start=1):
        print(f"\n[{i}/{len(bug_ids)}] Processing bug_id: {bug_id}")

        try:
            if already_exists(bug_id):
                print(f"Skipping existing bug_id: {bug_id}")
                skipped_count += 1
                continue

            row = fetch_bug_data(bug_id)
            if not row:
                print(f"No bug data found for bug_id: {bug_id}")
                failed_count += 1
                continue

            print("Inserting row:")
            print(row)

            result = supabase.table("resolution_knowledge").insert(row).execute()

            print("Insert result:")
            print(result)

            inserted_count += 1

        except Exception as e:
            print(f"Failed bug_id {bug_id}: {e}")
            failed_count += 1
            continue

    print("\n=== Import Summary ===")
    print(f"Inserted: {inserted_count}")
    print(f"Skipped:  {skipped_count}")
    print(f"Failed:   {failed_count}")


if __name__ == "__main__":
    main()

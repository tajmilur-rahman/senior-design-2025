import csv
import json
import argparse
from collections import Counter

from backend.ml_logic import predict_severity

LABELS = ["S1", "S2", "S3", "S4"]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", required=True, help="CSV with columns: summary, expected_severity (S1-S4). Optional: component, platform")
    ap.add_argument("--out", default="ml_test_results.json", help="Output JSON path")
    ap.add_argument("--threshold", type=float, default=None, help="Optional: override SEVERITY_REVIEW_THRESHOLD for this run")
    args = ap.parse_args()

    rows = []
    with open(args.csv, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append(r)

    # Confusion matrix counters
    cm = {a: Counter({p: 0 for p in LABELS}) for a in LABELS}

    results = []
    total = passed = failed = skipped = 0

    for i, r in enumerate(rows, start=1):
        summary = (r.get("summary") or "").strip()
        expected = (r.get("expected_severity") or "").strip().upper()

        if not summary:
            continue

        if expected not in LABELS:
            # allow test rows that are notes/blank/invalid without breaking the run
            results.append({
                "id": i,
                "summary": summary,
                "expected": expected,
                "skipped": True,
                "reason": "expected_severity_not_S1_to_S4",
            })
            skipped += 1
            continue

        component = (r.get("component") or "General").strip() or "General"
        platform  = (r.get("platform") or "All").strip() or "All"

        pred = predict_severity(summary, component=component, platform=platform, company_id=None)

        predicted = pred.get("prediction")
        conf = float(pred.get("confidence") or 0.0)
        needs_review = bool(pred.get("needs_review", False))
        review_reason = pred.get("review_reason")

        ok = (predicted == expected)

        total += 1
        if ok:
            passed += 1
        else:
            failed += 1

        if predicted in LABELS:
            cm[expected][predicted] += 1

        results.append({
            "id": i,
            "summary": summary,
            "component": component,
            "platform": platform,
            "expected": expected,
            "predicted": predicted,
            "confidence": round(conf, 3),
            "needs_review": needs_review,
            "review_reason": review_reason,
            "passed": ok,
        })

    # Flatten confusion matrix to your dashboard-friendly format
    cm_rows = []
    for a in LABELS:
        row = {"actual": a}
        for p in LABELS:
            row[p] = int(cm[a][p])
        cm_rows.append(row)

    # Useful focused counts (especially for your S2 vs S3 story)
    s2_as_s3 = int(cm["S2"]["S3"])
    s3_as_s2 = int(cm["S3"]["S2"])

    summary_out = {
        "total_test_cases": total,
        "passed": passed,
        "failed": failed,
        "skipped_rows": skipped,
        "pass_rate": round((passed / total), 4) if total else 0.0,
        "needs_review_count": sum(1 for r in results if r.get("needs_review")),
        "confusion_matrix": cm_rows,
        "s2_predicted_as_s3": s2_as_s3,
        "s3_predicted_as_s2": s3_as_s2,
    }

    out = {"summary": summary_out, "results": results}
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)

    print(json.dumps(summary_out, indent=2))


if __name__ == "__main__":
    main()
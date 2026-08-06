#!/usr/bin/env python3
"""Detect new or changed English copy and queue it for Spanish review.

Compares src/i18n/locales/en-GB.json against scripts/i18n_baseline.json (a
snapshot of en-GB.json as of the last time the review queue was closed out).
Any string that's new or whose English text has changed gets appended to
scripts/i18n_pending_review.txt (skipping anything already queued), then the
review .xlsx is regenerated so it reflects the full outstanding queue.

Run this after adding or editing any string in en-GB.json. Safe to run with
no changes pending, it's a no-op diff in that case.

Usage:
  python3 scripts/i18n_sync_review_queue.py
"""
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from i18n_lib import BASELINE_PATH, EN_PATH, flatten, load_json, read_pending, write_json, write_pending


def main():
    en = load_json(EN_PATH)
    current = flatten(en)

    if not BASELINE_PATH.exists():
        write_json(BASELINE_PATH, en)
        print(f"No baseline found, initialised {BASELINE_PATH.name} from the current en-GB.json.")
        print("Nothing queued (clean slate), future changes will be detected from here on.")
        return

    baseline = flatten(load_json(BASELINE_PATH))

    pending = read_pending()
    pending_set = set(pending)
    added = []

    for full_key, value in current.items():
        if full_key not in baseline or baseline[full_key] != value:
            if full_key not in pending_set:
                pending.append(full_key)
                pending_set.add(full_key)
                added.append(full_key)

    if added:
        write_pending(pending)
        print(f"Queued {len(added)} new/changed key(s):")
        for k in added:
            print(f"  {k}")
    else:
        print("No new or changed English strings since the last sync.")

    if pending:
        subprocess.run([sys.executable, str(Path(__file__).resolve().parent / "i18n_xlsx_export.py")], check=True)
    print(f"Pending review queue: {len(pending)} key(s).")


if __name__ == "__main__":
    main()

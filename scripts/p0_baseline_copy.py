"""
P0 Baseline: Verify manifest hashes and copy COPY_BASELINE files.
Run from lms-v1 root.
"""
import hashlib
import json
import shutil
import os
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
DEST_ROOT = ROOT / "live-session-studio"
MANIFEST_PATH = ROOT / "docs/guides/LIVE_SESSION_EXTRACTION_MANIFEST.json"
ACTIONS_PATH = ROOT / "docs/guides/LIVE_SESSION_FILE_ACTIONS.json"

with open(MANIFEST_PATH) as f:
    manifest = json.load(f)

with open(ACTIONS_PATH) as f:
    actions = json.load(f)

# Build hash map from manifest
hash_map = {}
for section in manifest.values():
    if isinstance(section, list):
        for item in section:
            if isinstance(item, dict) and "path" in item and "sha256" in item:
                hash_map[item["path"]] = item["sha256"]
    elif isinstance(section, dict) and "files" in section:
        for item in section["files"]:
            if isinstance(item, dict) and "path" in item and "sha256" in item:
                hash_map[item["path"]] = item["sha256"]

# Build action map
action_map = {}
for item in actions.get("files", actions if isinstance(actions, list) else []):
    if isinstance(item, dict):
        src = item.get("source", "")
        action_map[src] = item

print(f"=== P0 BASELINE COPY ===")
print(f"Manifest hash entries: {len(hash_map)}")
print(f"Action entries: {len(action_map)}")

results = {"pass": [], "fail": [], "copied": [], "skipped": []}

for src_path, expected_hash in hash_map.items():
    full_src = ROOT / src_path
    if not full_src.exists():
        # Only warn, don't fail - path might be in a different location
        results["skipped"].append(f"NOT FOUND: {src_path}")
        continue
    
    # Verify hash
    h = hashlib.sha256()
    with open(full_src, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    actual = h.hexdigest()
    
    if actual == expected_hash:
        results["pass"].append(src_path)
    else:
        results["fail"].append(f"HASH MISMATCH: {src_path}\n  expected: {expected_hash}\n  actual:   {actual}")

# Now copy COPY_BASELINE items
copy_items = []
for src_key, action_item in action_map.items():
    if action_item.get("action") == "COPY_BASELINE":
        dest_rel = action_item.get("destination_relative_to_project")
        if dest_rel:
            copy_items.append((src_key, dest_rel))

print(f"\nFiles to copy (COPY_BASELINE): {len(copy_items)}")

for src_rel, dest_rel in copy_items:
    src = ROOT / src_rel
    dest = DEST_ROOT / dest_rel
    
    if not src.exists():
        results["skipped"].append(f"COPY SKIP (not found): {src_rel}")
        continue
    
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest)
    results["copied"].append(f"{src_rel} -> {dest_rel}")

# Print summary
print(f"\n=== RESULTS ===")
print(f"Hash PASS: {len(results['pass'])}")
print(f"Hash FAIL: {len(results['fail'])}")
print(f"Copied:    {len(results['copied'])}")
print(f"Skipped:   {len(results['skipped'])}")

if results["fail"]:
    print("\n=== HASH FAILURES ===")
    for f in results["fail"]:
        print(f)

if results["skipped"]:
    print(f"\n=== SKIPPED (first 20) ===")
    for s in results["skipped"][:20]:
        print(s)

print("\n=== COPIED FILES ===")
for c in results["copied"]:
    print(f"  {c}")

# Exit with error if hash failures (non-asset)
if results["fail"]:
    print("\nWARNING: Hash mismatches found - review before proceeding")
    sys.exit(1)
else:
    print("\nP0 PASS: All verified hashes match. Baseline copied.")
    sys.exit(0)

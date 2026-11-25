import json, sys
from collections import Counter

# Read file actions
with open('LIVE_SESSION_FILE_ACTIONS.json') as f:
    actions = json.load(f)

counts = Counter()
for item in actions:
    counts[item.get('action','?')] += 1
print('=== FILE ACTIONS SUMMARY ===')
for k,v in counts.most_common():
    print(f'  {k}: {v}')

print('\n=== COPY_BASELINE items ===')
for item in actions:
    if item.get('action') == 'COPY_BASELINE':
        src = item.get('source', '?')
        dst = item.get('destination', 'same')
        print(f'  {src} -> {dst}')

print('\n=== ADAPT items ===')
for item in actions:
    if item.get('action') == 'ADAPT':
        src = item.get('source', '?')
        dst = item.get('destination', 'same')
        notes = item.get('notes', '')
        print(f'  {src} -> {dst}')
        if notes:
            print(f'    NOTE: {notes}')

print('\n=== REPLACE items ===')
for item in actions:
    if item.get('action') == 'REPLACE':
        src = item.get('source', '?')
        dst = item.get('destination', '?')
        print(f'  {src} -> {dst}')

# Read manifest
print('\n=== MANIFEST ===')
with open('LIVE_SESSION_EXTRACTION_MANIFEST.json') as f:
    manifest = json.load(f)
print('Top-level keys:', list(manifest.keys()))
# Check for files/entries
key = None
for k in ['files', 'entries', 'modules']:
    if k in manifest:
        key = k
        break
if key:
    items = manifest[key]
    print(f'Total {key}: {len(items)}')
    print('Sample entry:')
    print(json.dumps(items[0], indent=2))
    # Also show frontend version info
    print('\n=== Frontend versions (from manifest) ===')
    for it in items:
        if 'version' in it or 'versions' in it:
            print(json.dumps(it, indent=2)[:300])
else:
    print(json.dumps(manifest)[:2000])

# Read backend versions
print('\n=== BACKEND VERSIONS ===')
with open('LIVE_SESSION_BACKEND_VERSIONS.json') as f:
    bv = json.load(f)
print(json.dumps(bv, indent=2))

"""Deep check of admin@test.com user and all related Firestore data."""
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime
import os

cred = credentials.Certificate('serviceAccountKey.json')
app = firebase_admin.initialize_app(cred)
db = firestore.client()

email = 'admin@test.com'

# Get user directly by document ID (not query)
users = list(db.collection('users').where('email', '==', email).limit(1).stream())
u = users[0]
d = u.to_dict()

print(f"=== User: {u.id} ===")
for k, v in sorted(d.items()):
    if k != 'password_hash':
        print(f"  {k}: {v!r} (type: {type(v).__name__})")

# Check locked_until specifically
locked_until = d.get('locked_until')
print(f"\n=== locked_until analysis ===")
print(f"  Value: {locked_until!r}")
print(f"  Type: {type(locked_until).__name__}")

if locked_until is not None:
    now = datetime.utcnow()
    print(f"  now (naive): {now}")
    if hasattr(locked_until, 'tzinfo') and locked_until.tzinfo is not None:
        print(f"  locked_until is timezone-aware!")
        # Strip timezone
        naive = locked_until.replace(tzinfo=None)
        print(f"  naive version: {naive}")
        print(f"  Is still locked? {naive > now}")
    else:
        print(f"  locked_until is naive, comparison: {locked_until > now}")
else:
    print("  locked_until is None - account should NOT be locked")

# Check IP blocks
print(f"\n=== IP Blocks ===")
ip_docs = list(db.collection('ip_login_failures').stream())
print(f"Total IP records: {len(ip_docs)}")
for doc in ip_docs:
    d2 = doc.to_dict()
    blocked_until = d2.get('blocked_until')
    print(f"  IP: {doc.id}")
    print(f"    blocked_until: {blocked_until!r} (type: {type(blocked_until).__name__})")
    if blocked_until is not None:
        now = datetime.utcnow()
        if hasattr(blocked_until, 'tzinfo') and blocked_until.tzinfo is not None:
            naive = blocked_until.replace(tzinfo=None)
            print(f"    naive: {naive}, still blocked: {naive > now}")
        else:
            print(f"    still blocked: {blocked_until > now}")

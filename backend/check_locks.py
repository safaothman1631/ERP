import firebase_admin
from firebase_admin import credentials, firestore
import os

cred = credentials.Certificate('serviceAccountKey.json')
app = firebase_admin.initialize_app(cred)
db = firestore.client()

# Check all users for locks
users = list(db.collection('users').stream())
print(f"Total users: {len(users)}")
for u in users:
    d = u.to_dict()
    locked = d.get('locked_until')
    failed = d.get('failed_login_attempts', 0)
    if locked or failed > 0:
        email = d.get('email', 'N/A')
        print(f"LOCKED: {email} locked_until={locked} failed={failed}")

# Check IP blocks
print("\n=== IP Blocks ===")
ip_docs = list(db.collection('ip_login_failures').stream())
for doc in ip_docs:
    d = doc.to_dict()
    print(f"IP: {doc.id} blocked_until={d.get('blocked_until')} fail_count={d.get('fail_count')}")

if not ip_docs:
    print("No IP blocks found")

print("\nDone")

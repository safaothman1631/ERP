import firebase_admin
from firebase_admin import credentials, firestore
import os

cred_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'serviceAccountKey.json')
cred = credentials.Certificate(cred_path)
app = firebase_admin.initialize_app(cred)
db = firestore.client()

# List all blocked IPs
print("=== IP Login Failures ===")
ip_docs = list(db.collection('ip_login_failures').stream())
for doc in ip_docs:
    d = doc.to_dict()
    print(f"  IP: {doc.id} - fail_count: {d.get('fail_count')} - blocked_until: {d.get('blocked_until')}")

# Delete all IP blocks (reset)
print("\nClearing all IP blocks...")
for doc in ip_docs:
    db.collection('ip_login_failures').document(doc.id).delete()
    print(f"  Deleted: {doc.id}")

print("\nDone. All IP blocks cleared.")

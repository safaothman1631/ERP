"""Force unlock admin@test.com by directly setting locked_until to None."""
import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1 import DELETE_FIELD
import os

cred = credentials.Certificate('serviceAccountKey.json')
app = firebase_admin.initialize_app(cred)
db = firestore.client()

email = 'admin@test.com'
users = list(db.collection('users').where('email', '==', email).limit(1).stream())
u = users[0]
print(f"User ID: {u.id}")

# Force delete locked_until field entirely (not just set to None)
db.collection('users').document(u.id).update({
    'locked_until': DELETE_FIELD,
    'failed_login_attempts': 0,
})
print("✅ locked_until field DELETED from Firestore document")

# Also clear all IP blocks
ip_docs = list(db.collection('ip_login_failures').stream())
for doc in ip_docs:
    doc.reference.delete()
    print(f"Deleted IP block: {doc.id}")

# Verify
u2 = db.collection('users').document(u.id).get()
d2 = u2.to_dict()
print(f"\nVerification:")
print(f"  locked_until: {d2.get('locked_until', 'FIELD NOT PRESENT')!r}")
print(f"  failed_login_attempts: {d2.get('failed_login_attempts')}")
print(f"  is_active: {d2.get('is_active')}")

import firebase_admin
from firebase_admin import credentials, firestore
import bcrypt
import os

cred = credentials.Certificate('serviceAccountKey.json')
app = firebase_admin.initialize_app(cred)
db = firestore.client()

users = list(db.collection('users').where('email', '==', 'admin@test.com').limit(1).stream())
u = users[0]
d = u.to_dict()
stored_hash = d.get('password_hash', '')
print(f"Stored hash: {stored_hash[:30]}...")

# Test passwords
test_passwords = ['Admin@123456', 'Admin123456', '123456', 'admin123', 'Admin@1234']
for pw in test_passwords:
    try:
        match = bcrypt.checkpw(pw.encode(), stored_hash.encode())
        print(f"  '{pw}' -> {'✅ MATCH' if match else '❌ no match'}")
    except Exception as e:
        print(f"  '{pw}' -> ERROR: {e}")

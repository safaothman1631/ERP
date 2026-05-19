"""Reset admin@test.com password with a fresh bcrypt hash."""
import firebase_admin
from firebase_admin import credentials, firestore
import bcrypt
import os

cred = credentials.Certificate('serviceAccountKey.json')
app = firebase_admin.initialize_app(cred)
db = firestore.client()

import warnings
warnings.filterwarnings('ignore')

email = 'admin@test.com'
new_password = 'Admin@123456'

# Generate fresh hash
salt = bcrypt.gensalt(rounds=12)
new_hash = bcrypt.hashpw(new_password.encode('utf-8'), salt).decode('utf-8')
print(f"New hash: {new_hash[:30]}...")

# Verify immediately
verify = bcrypt.checkpw(new_password.encode('utf-8'), new_hash.encode('utf-8'))
print(f"Immediate verify: {'✅ OK' if verify else '❌ FAIL'}")

# Find user
users = list(db.collection('users').where('email', '==', email).limit(1).stream())
if not users:
    print("❌ User not found!")
else:
    u = users[0]
    print(f"User ID: {u.id}")
    
    # Update password hash directly
    db.collection('users').document(u.id).update({
        'password_hash': new_hash,
        'failed_login_attempts': 0,
        'is_active': True,
    })
    print(f"✅ Password updated in Firestore")
    
    # Verify from Firestore
    u2 = db.collection('users').document(u.id).get()
    stored = u2.to_dict().get('password_hash', '')
    verify2 = bcrypt.checkpw(new_password.encode('utf-8'), stored.encode('utf-8'))
    print(f"Firestore verify: {'✅ OK' if verify2 else '❌ FAIL'}")
    print(f"Stored hash: {stored[:30]}...")
    print(f"\n✅ Login credentials:")
    print(f"   Email: {email}")
    print(f"   Password: {new_password}")

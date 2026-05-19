"""Debug login flow directly against Firestore."""
import firebase_admin
from firebase_admin import credentials, firestore
import bcrypt
import os

cred = credentials.Certificate('serviceAccountKey.json')
app = firebase_admin.initialize_app(cred)
db = firestore.client()

email = 'admin@test.com'
password = 'Admin@123456'

# Step 1: Find user
print(f"Step 1: Looking up {email}...")
users_ref = db.collection('users').where('email', '==', email).limit(1).stream()
user_data = None
for doc in users_ref:
    user_data = {'id': doc.id, **doc.to_dict()}
    break

if not user_data:
    print("❌ User not found!")
else:
    print(f"✅ Found user: {user_data['id'][:8]}...")
    print(f"   is_active: {user_data.get('is_active')!r}")
    print(f"   auth_provider: {user_data.get('auth_provider')!r}")
    print(f"   locked_until: {user_data.get('locked_until')!r}")
    print(f"   failed_attempts: {user_data.get('failed_login_attempts', 0)}")
    
    stored_hash = user_data.get('password_hash', '')
    print(f"   hash prefix: {stored_hash[:20]}...")
    
    # Step 2: Verify password
    print(f"\nStep 2: Verifying password '{password}'...")
    try:
        result = bcrypt.checkpw(password.encode('utf-8'), stored_hash.encode('utf-8'))
        print(f"   bcrypt result: {'✅ MATCH' if result else '❌ NO MATCH'}")
    except Exception as e:
        print(f"   ❌ bcrypt error: {e}")
    
    # Step 3: Check org
    print(f"\nStep 3: Checking org {user_data.get('org_id')}...")
    org_doc = db.collection('organizations').document(user_data.get('org_id', '')).get()
    if org_doc.exists:
        print(f"   ✅ Org exists: {org_doc.to_dict().get('name')}")
    else:
        print(f"   ❌ Org NOT found!")
